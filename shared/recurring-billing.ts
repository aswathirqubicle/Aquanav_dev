/**
 * Recurring invoice billing — the ONE place the periods and line amounts of a
 * recurring schedule are worked out, shared by the convert dialog (client) and
 * the generation job (server/recurring-invoices.ts).
 *
 * Dates are plain "YYYY-MM-DD" calendar strings throughout and are added and
 * compared with UTC arithmetic, so the result never depends on the timezone of
 * whoever runs it.
 *
 * Rules (agreed with the client, 2026-11-10):
 *  - A schedule runs on a generation day of 1–30, or on the last day of the
 *    month. 29 and 30 fall back to the month's last day where the month is
 *    shorter (February). Crews work round the clock, so there is no working-day
 *    adjustment.
 *  - An invoice covers the period since the previous run date, up to and
 *    including its own run date. With "last day of month" that is the calendar
 *    month.
 *  - Pro rata lines bill rate ÷ 30 per active calendar day, and exactly the rate
 *    for a period they are active throughout — the same basis as the
 *    consultant project fee in payroll (computeProjectEarnings).
 *  - Fixed monthly lines bill the full rate in any period with an active day.
 *    One-time lines bill once, on the first invoice generated.
 */

export type BillingType = "one_time" | "monthly_prorata" | "monthly_fixed";

export const BILLING_TYPE_LABELS: Record<BillingType, string> = {
  one_time: "One-time",
  monthly_prorata: "Monthly – pro rata",
  monthly_fixed: "Monthly – fixed",
};

export interface ScheduleTiming {
  /** 1–30. Ignored when lastDayOfMonth is true. */
  generationDay: number | null;
  lastDayOfMonth: boolean;
}

export interface Period {
  start: string; // inclusive
  end: string; // inclusive — the run date
}

/** When the billed work is active. `to` null = open-ended. */
export interface ActiveWindow {
  from: string;
  to: string | null;
}

export interface RecurringSourceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  discount?: number;
  discountType?: "amount" | "percentage";
  billingType?: BillingType;
}

export interface RecurringInvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
  discountType: "amount" | "percentage";
}

const round2 = (n: number): number =>
  Math.round((n + Number.EPSILON) * 100) / 100;

const pad2 = (n: number): string => String(n).padStart(2, "0");

function parts(ymd: string): [number, number, number] {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  return [y, m, d];
}

function toYmd(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function toUtc(ymd: string): number {
  const [y, m, d] = parts(ymd);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): string {
  const dt = new Date(ms);
  return toYmd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(ymd: string, n: number): string {
  return fromUtc(toUtc(ymd) + n * DAY_MS);
}

/** Inclusive count of calendar days from `start` to `end`; 0 if end < start. */
export function daysBetween(start: string, end: string): number {
  const n = Math.round((toUtc(end) - toUtc(start)) / DAY_MS) + 1;
  return n > 0 ? n : 0;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** A local Date (e.g. a timestamp read from the DB) as its calendar day. */
export function localYmd(date: Date): string {
  return toYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

const maxYmd = (a: string, b: string): string => (a > b ? a : b);
const minYmd = (a: string, b: string): string => (a < b ? a : b);

/** The run date of a schedule in a given month (month is 1–12). */
export function runDateFor(
  year: number,
  month: number,
  timing: ScheduleTiming,
): string {
  const last = daysInMonth(year, month);
  const day = timing.lastDayOfMonth
    ? last
    : Math.min(Math.max(1, timing.generationDay ?? last), last);
  return toYmd(year, month, day);
}

function shiftMonth(year: number, month: number, by: number): [number, number] {
  const idx = year * 12 + (month - 1) + by;
  return [Math.floor(idx / 12), (idx % 12) + 1];
}

/** The first run date on or after `ymd`. */
export function firstRunOnOrAfter(ymd: string, timing: ScheduleTiming): string {
  const [y, m] = parts(ymd);
  const thisMonth = runDateFor(y, m, timing);
  if (thisMonth >= ymd) return thisMonth;
  const [ny, nm] = shiftMonth(y, m, 1);
  return runDateFor(ny, nm, timing);
}

/** The full period a run date closes: the day after the previous run date, up to it. */
export function periodEnding(runDate: string, timing: ScheduleTiming): Period {
  const [y, m] = parts(runDate);
  const [py, pm] = shiftMonth(y, m, -1);
  return { start: addDays(runDateFor(py, pm, timing), 1), end: runDate };
}

/**
 * The next period to bill, starting at `start` (the Bill from date, or the day
 * after the last period billed). The first one can be shorter than a full
 * period when Bill from falls inside it.
 */
export function periodFrom(start: string, timing: ScheduleTiming): Period {
  return { start, end: firstRunOnOrAfter(start, timing) };
}

/**
 * Default Bill from: the start of the period `today` falls in, or the project
 * start if that is later — so converting mid-job never back-fills earlier
 * months unless someone picks an earlier date.
 */
export function defaultBillFrom(
  today: string,
  timing: ScheduleTiming,
  projectStart?: string | null,
): string {
  const current = periodEnding(firstRunOnOrAfter(today, timing), timing).start;
  return projectStart ? maxYmd(current, projectStart) : current;
}

/** How many days of `period` fall inside the active window. */
export function activeDays(period: Period, window: ActiveWindow): number {
  const start = maxYmd(period.start, window.from);
  const end = window.to ? minYmd(period.end, window.to) : period.end;
  return daysBetween(start, end);
}

/** The window ends inside (or before) this period, so nothing is left to bill after it. */
export function windowEndsBy(period: Period, window: ActiveWindow): boolean {
  return window.to !== null && window.to <= period.end;
}

/**
 * The active window of a schedule: Bill from → End date, narrowed to the
 * project's start → actual end when a project is linked. The project's PLANNED
 * end is deliberately never used — payroll learned on Front Polaris that a
 * planned end bills full months for a job that finished early.
 */
export function activeWindowFor(
  billFrom: string,
  endDate: string | null,
  project?: { startDate: string | null; actualEndDate: string | null } | null,
): ActiveWindow {
  let from = billFrom;
  let to = endDate;
  if (project) {
    if (project.startDate) from = maxYmd(from, project.startDate);
    if (project.actualEndDate) {
      to = to ? minYmd(to, project.actualEndDate) : project.actualEndDate;
    }
  }
  return { from, to };
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function shortDate(ymd: string, withYear: boolean): string {
  const [y, m, d] = parts(ymd);
  return `${pad2(d)} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ""}`;
}

/** "29 Sep – 30 Sep 2026" (year shown once unless the range crosses years). */
export function rangeLabel(start: string, end: string): string {
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${shortDate(start, !sameYear)} – ${shortDate(end, true)}`;
}

function money(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** True when at least one line bills every month. */
export function hasRecurringLine(items: RecurringSourceLine[]): boolean {
  return items.some(
    (i) =>
      i.billingType === "monthly_prorata" || i.billingType === "monthly_fixed",
  );
}

/**
 * The invoice lines for one period. Returns no lines when the work is not
 * active on any day of the period — such a period is skipped, and its one-time
 * lines wait for the first period that does bill.
 *
 * Quantity stays as the quotation had it (usually headcount); a prorated rate
 * goes into unitPrice and the description says how it was reached, the way
 * INV-AQNV-2026-163 was written by hand.
 */
export function buildRecurringLines(
  items: RecurringSourceLine[],
  period: Period,
  window: ActiveWindow,
  isFirstInvoice: boolean,
  currency: string,
  timing: ScheduleTiming,
): RecurringInvoiceLine[] {
  const days = activeDays(period, window);
  if (days === 0) return [];

  const fullPeriodDays = daysBetween(
    periodEnding(period.end, timing).start,
    period.end,
  );
  const billedFrom = maxYmd(period.start, window.from);
  const billedTo = window.to ? minYmd(period.end, window.to) : period.end;

  const lines: RecurringInvoiceLine[] = [];
  for (const item of items) {
    const type: BillingType = item.billingType ?? "one_time";
    const base: RecurringInvoiceLine = {
      description: item.description,
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      taxRate: Number(item.taxRate) || 0,
      discount: Number(item.discount) || 0,
      discountType: item.discountType === "percentage" ? "percentage" : "amount",
    };

    if (type === "one_time") {
      if (isFirstInvoice) lines.push(base);
      continue;
    }
    if (type === "monthly_fixed" || days >= fullPeriodDays) {
      lines.push(base);
      continue;
    }

    // Pro rata over a part period: rate ÷ 30 per day.
    const factor = days / 30;
    const prorated = round2(base.unitPrice * factor);
    lines.push({
      ...base,
      unitPrice: prorated,
      discount:
        base.discountType === "amount" ? round2(base.discount * factor) : base.discount,
      description:
        `${item.description}\n` +
        `${money(base.unitPrice)} ${currency} per month. Pro-rata for ` +
        `${pad2(days)} days (${rangeLabel(billedFrom, billedTo)}) = ` +
        `${money(prorated)} ${currency}`,
    });
  }
  return lines;
}

/** Due date from the quotation's payment terms ("Net 15", "30_days", "Due on receipt"). */
export function dueDateFor(invoiceDate: string, paymentTerms?: string | null): string {
  const t = (paymentTerms || "").trim();
  const net = /^net\s*(\d+)$/i.exec(t) || /^(\d+)_days$/i.exec(t);
  return addDays(invoiceDate, net ? parseInt(net[1], 10) : 0);
}
