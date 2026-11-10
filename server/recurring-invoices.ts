import { db } from "./db";
import { storage } from "./storage";
import {
  recurringInvoiceSchedules,
  salesInvoices,
  type RecurringInvoiceSchedule,
} from "@shared/schema";
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import {
  activeWindowFor,
  addDays,
  buildRecurringLines,
  dueDateFor,
  firstRunOnOrAfter,
  hasRecurringLine,
  localYmd,
  periodFrom,
  rangeLabel,
  windowEndsBy,
  type BillingType,
  type ScheduleTiming,
} from "@shared/recurring-billing";
import { checkCustomerDocumentCurrency } from "./lib/document-currency";

/**
 * Recurring invoices: a schedule made from an approved quotation, and the job
 * that drafts one sales invoice per billing period from it.
 *
 * Every generated invoice is a DRAFT created through storage.createSalesInvoice
 * — the same path as an invoice raised by hand, so it gets the throwaway
 * INV-DRFT- number and server-side totals, and nothing posts to the ledger until
 * finance approves it. The amounts come from shared/recurring-billing.ts.
 *
 * A period is invoiced at most once per schedule: the job checks before it
 * inserts, and the unique index from migration 0086 backs that up if two runs
 * ever race.
 */

export class RecurringScheduleError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const BILLING_TYPES: BillingType[] = [
  "one_time",
  "monthly_prorata",
  "monthly_fixed",
];

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export interface CreateScheduleInput {
  projectId?: number | null;
  generationDay?: number | null;
  lastDayOfMonth?: boolean;
  billFrom?: string;
  endDate?: string | null;
  workOrderNumber?: string | null;
  /** One per quotation line, in order. Missing entries keep the line's own type. */
  billingTypes?: (BillingType | null | undefined)[];
}

function timingOf(s: {
  generationDay: number | null;
  lastDayOfMonth: boolean;
}): ScheduleTiming {
  return { generationDay: s.generationDay, lastDayOfMonth: s.lastDayOfMonth };
}

/** Today as a calendar day on the server (the VPS runs on Asia/Dubai). */
export function todayYmd(): string {
  return localYmd(new Date());
}

export async function getActiveScheduleForQuotation(
  quotationId: number,
): Promise<RecurringInvoiceSchedule | undefined> {
  const [row] = await db
    .select()
    .from(recurringInvoiceSchedules)
    .where(
      and(
        eq(recurringInvoiceSchedules.quotationId, quotationId),
        inArray(recurringInvoiceSchedules.status, ["active", "paused"]),
      ),
    )
    .limit(1);
  return row;
}

/** The latest schedule of a quotation (any status), with its generated invoices. */
export async function getScheduleForQuotation(quotationId: number) {
  const [schedule] = await db
    .select()
    .from(recurringInvoiceSchedules)
    .where(eq(recurringInvoiceSchedules.quotationId, quotationId))
    .orderBy(sql`${recurringInvoiceSchedules.id} DESC`)
    .limit(1);
  if (!schedule) return null;

  const invoices = await db
    .select({
      id: salesInvoices.id,
      invoiceNumber: salesInvoices.invoiceNumber,
      status: salesInvoices.status,
      invoiceDate: salesInvoices.invoiceDate,
      billingPeriodStart: salesInvoices.billingPeriodStart,
      billingPeriodEnd: salesInvoices.billingPeriodEnd,
      totalAmount: salesInvoices.totalAmount,
    })
    .from(salesInvoices)
    .where(eq(salesInvoices.recurringScheduleId, schedule.id))
    .orderBy(asc(salesInvoices.billingPeriodStart));

  let projectTitle: string | null = null;
  if (schedule.projectId) {
    const project = await storage.getProject(schedule.projectId);
    projectTitle = project?.title ?? null;
  }

  return { ...schedule, projectTitle, invoices };
}

export async function createScheduleFromQuotation(
  quotationId: number,
  input: CreateScheduleInput,
  userId: number,
): Promise<RecurringInvoiceSchedule> {
  const quotation = await storage.getSalesQuotation(quotationId);
  if (!quotation) {
    throw new RecurringScheduleError(404, "Sales quotation not found");
  }
  if (quotation.status !== "approved") {
    throw new RecurringScheduleError(
      400,
      "Only approved quotations can be converted to a recurring invoice",
    );
  }
  if (await getActiveScheduleForQuotation(quotationId)) {
    throw new RecurringScheduleError(
      409,
      "This quotation already has a recurring invoice schedule",
    );
  }

  const lastDayOfMonth = input.lastDayOfMonth === true;
  const generationDay = lastDayOfMonth ? null : Number(input.generationDay);
  if (
    !lastDayOfMonth &&
    !(Number.isInteger(generationDay) && generationDay! >= 1 && generationDay! <= 30)
  ) {
    throw new RecurringScheduleError(
      400,
      "Choose a generation day between 1 and 30, or the last day of the month",
    );
  }

  const billFrom = input.billFrom;
  if (!billFrom || !YMD.test(billFrom)) {
    throw new RecurringScheduleError(400, "Choose the date to bill from");
  }

  const projectId = input.projectId ? Number(input.projectId) : null;
  const endDate = !projectId && input.endDate ? input.endDate : null;
  if (endDate && (!YMD.test(endDate) || endDate < billFrom)) {
    throw new RecurringScheduleError(
      400,
      "The end date must be on or after the bill from date",
    );
  }

  if (projectId) {
    const project = await storage.getProject(projectId);
    if (!project) {
      throw new RecurringScheduleError(400, "Project not found");
    }
    if (
      project.customerId &&
      quotation.customerId &&
      project.customerId !== quotation.customerId
    ) {
      throw new RecurringScheduleError(
        400,
        "The project belongs to a different customer than the quotation",
      );
    }
  }

  // Lines always come from the approved quotation; only how each one bills is
  // taken from the request, so the conversion cannot change a price.
  const sourceItems: any[] = Array.isArray(quotation.items) ? quotation.items : [];
  const items = sourceItems.map((item, i) => {
    const requested = input.billingTypes?.[i];
    const billingType: BillingType = BILLING_TYPES.includes(requested as BillingType)
      ? (requested as BillingType)
      : BILLING_TYPES.includes(item.billingType)
        ? item.billingType
        : "one_time";
    return {
      description: item.description,
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      taxRate: Number(item.taxRate) || 0,
      discount: Number(item.discount) || 0,
      discountType:
        item.discountType === "percentage"
          ? ("percentage" as const)
          : ("amount" as const),
      billingType,
    };
  });

  if (!hasRecurringLine(items)) {
    throw new RecurringScheduleError(
      400,
      "Mark at least one line as monthly (pro rata or fixed) to bill it every month",
    );
  }

  const currencyError = await checkCustomerDocumentCurrency(
    quotation.customerId,
    quotation.currency,
  );
  if (currencyError) throw new RecurringScheduleError(400, currencyError);

  const timing: ScheduleTiming = { generationDay, lastDayOfMonth };
  const [schedule] = await db
    .insert(recurringInvoiceSchedules)
    .values({
      quotationId,
      customerId: quotation.customerId,
      projectId,
      generationDay,
      lastDayOfMonth,
      billFrom,
      endDate,
      status: "active",
      items,
      currency: quotation.currency || "AED",
      exchangeRate: quotation.exchangeRate || "1",
      subject: quotation.subject,
      paymentTerms: quotation.paymentTerms,
      bankAccount: quotation.bankAccount,
      billingAddress: quotation.billingAddress,
      termsAndConditions: quotation.termsAndConditions,
      remarks: quotation.remarks,
      discountPercentage: quotation.discountPercentage || "0",
      workOrderNumber: input.workOrderNumber?.trim() || null,
      nextRunDate: firstRunOnOrAfter(billFrom, timing),
      createdById: userId,
    })
    .returning();

  // Unlike the plain Convert button, which only pre-fills a form, setting up a
  // schedule is the commitment itself — the quotation is billed from here on.
  await storage.updateSalesQuotation(quotationId, { status: "converted" });

  return schedule;
}

async function hasInvoiceForPeriod(scheduleId: number, periodStart: string) {
  const [row] = await db
    .select({ id: salesInvoices.id })
    .from(salesInvoices)
    .where(
      and(
        eq(salesInvoices.recurringScheduleId, scheduleId),
        eq(salesInvoices.billingPeriodStart, periodStart),
      ),
    )
    .limit(1);
  return !!row;
}

async function countInvoices(scheduleId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(salesInvoices)
    .where(eq(salesInvoices.recurringScheduleId, scheduleId));
  return row?.n ?? 0;
}

/** Drafts every period of one schedule that is due by `today`. Returns how many invoices it created. */
async function processSchedule(
  schedule: RecurringInvoiceSchedule,
  today: string,
): Promise<number> {
  const timing = timingOf(schedule);

  let project: { startDate: string | null; actualEndDate: string | null } | null =
    null;
  let projectTitle: string | null = null;
  if (schedule.projectId) {
    const p = await storage.getProject(schedule.projectId);
    if (p) {
      projectTitle = p.title;
      project = {
        startDate: p.startDate ? localYmd(new Date(p.startDate)) : null,
        actualEndDate: p.actualEndDate ? localYmd(new Date(p.actualEndDate)) : null,
      };
    }
  }
  const window = activeWindowFor(schedule.billFrom, schedule.endDate, project);

  // A quotation without payment terms falls back to the customer's own terms
  // for the due date, and one without a subject to the project's title.
  let paymentTerms = schedule.paymentTerms;
  if (!paymentTerms && schedule.customerId) {
    const customer = await storage.getCustomer(schedule.customerId);
    paymentTerms = customer?.paymentTerms ?? null;
  }
  const subject = schedule.subject?.trim() || projectTitle;

  let lastPeriodEnd = schedule.lastPeriodEnd;
  let status = schedule.status;
  let created = 0;

  // Bounded so a schedule set up with a very old Bill from cannot spin forever;
  // anything left over is picked up on the next tick.
  for (let guard = 0; guard < 36 && status === "active"; guard++) {
    const start = lastPeriodEnd ? addDays(lastPeriodEnd, 1) : schedule.billFrom;
    if (window.to && start > window.to) {
      status = "completed";
      break;
    }
    const period = periodFrom(start, timing);
    if (period.end > today) break;

    if (!(await hasInvoiceForPeriod(schedule.id, period.start))) {
      const isFirst = (await countInvoices(schedule.id)) === 0;
      const lines = buildRecurringLines(
        schedule.items as any[],
        period,
        window,
        isFirst,
        schedule.currency,
        timing,
      );
      if (lines.length > 0) {
        await storage.createSalesInvoice({
          customerId: schedule.customerId,
          projectId: schedule.projectId,
          quotationId: schedule.quotationId,
          recurringScheduleId: schedule.id,
          billingPeriodStart: period.start,
          billingPeriodEnd: period.end,
          subject: [subject, `(${rangeLabel(period.start, period.end)})`]
            .filter(Boolean)
            .join(" "),
          currency: schedule.currency,
          exchangeRate: schedule.exchangeRate,
          status: "draft",
          invoiceDate: period.end,
          dueDate: dueDateFor(period.end, paymentTerms),
          paymentTerms: schedule.paymentTerms,
          bankAccount: schedule.bankAccount,
          billingAddress: schedule.billingAddress,
          termsAndConditions: schedule.termsAndConditions,
          remarks: schedule.remarks,
          workOrderNumber: schedule.workOrderNumber,
          items: lines as any,
          discountPercentage: schedule.discountPercentage || "0",
          discount: "0",
        } as any);
        created++;
      }
    }

    lastPeriodEnd = period.end;
    if (windowEndsBy(period, window)) status = "completed";

    await db
      .update(recurringInvoiceSchedules)
      .set({
        lastPeriodEnd,
        status,
        nextRunDate: firstRunOnOrAfter(addDays(period.end, 1), timing),
      })
      .where(eq(recurringInvoiceSchedules.id, schedule.id));
  }

  if (status !== schedule.status) {
    await db
      .update(recurringInvoiceSchedules)
      .set({ status })
      .where(eq(recurringInvoiceSchedules.id, schedule.id));
  }
  return created;
}

/**
 * Drafts every invoice that is due. Called hourly by the job and straight after
 * a schedule is created (with its id), so periods already past show up at once.
 */
export async function generateDueInvoices(
  today: string = todayYmd(),
  scheduleId?: number,
): Promise<number> {
  const conditions = [
    eq(recurringInvoiceSchedules.status, "active"),
    lte(recurringInvoiceSchedules.nextRunDate, today),
  ];
  if (scheduleId) conditions.push(eq(recurringInvoiceSchedules.id, scheduleId));

  const due = await db
    .select()
    .from(recurringInvoiceSchedules)
    .where(and(...conditions));

  let created = 0;
  for (const schedule of due) {
    try {
      created += await processSchedule(schedule, today);
    } catch (error) {
      // One bad schedule must not stop the others.
      console.error(
        `[recurring-invoices] Schedule ${schedule.id} failed:`,
        error,
      );
    }
  }
  return created;
}

async function getSchedule(id: number) {
  const [row] = await db
    .select()
    .from(recurringInvoiceSchedules)
    .where(eq(recurringInvoiceSchedules.id, id))
    .limit(1);
  if (!row) throw new RecurringScheduleError(404, "Schedule not found");
  return row;
}

export async function pauseSchedule(id: number) {
  const s = await getSchedule(id);
  if (s.status !== "active") {
    throw new RecurringScheduleError(400, "Only an active schedule can be paused");
  }
  await db
    .update(recurringInvoiceSchedules)
    .set({ status: "paused" })
    .where(eq(recurringInvoiceSchedules.id, id));
}

/**
 * Resuming does not back-fill: periods that ended while it was paused are
 * passed over, and billing restarts with the period `today` falls in.
 */
export async function resumeSchedule(id: number, today: string = todayYmd()) {
  const s = await getSchedule(id);
  if (s.status !== "paused") {
    throw new RecurringScheduleError(400, "Only a paused schedule can be resumed");
  }
  const timing = timingOf(s);
  let lastPeriodEnd = s.lastPeriodEnd;
  let start = lastPeriodEnd ? addDays(lastPeriodEnd, 1) : s.billFrom;
  // Skip whole periods that ended before today.
  for (let guard = 0; guard < 120; guard++) {
    const period = periodFrom(start, timing);
    if (period.end >= today) break;
    lastPeriodEnd = period.end;
    start = addDays(period.end, 1);
  }
  await db
    .update(recurringInvoiceSchedules)
    .set({
      status: "active",
      lastPeriodEnd,
      nextRunDate: firstRunOnOrAfter(start, timing),
    })
    .where(eq(recurringInvoiceSchedules.id, id));
}

export async function cancelSchedule(id: number, userId: number) {
  const s = await getSchedule(id);
  if (s.status !== "active" && s.status !== "paused") {
    throw new RecurringScheduleError(400, "This schedule has already ended");
  }
  await db
    .update(recurringInvoiceSchedules)
    .set({ status: "cancelled", cancelledById: userId, cancelledAt: new Date() })
    .where(eq(recurringInvoiceSchedules.id, id));
}

