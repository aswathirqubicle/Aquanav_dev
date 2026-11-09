import { db } from "../db";
import {
  employeeDocuments,
  employeeTrainingRecords,
  employees,
  notificationLog,
  users,
} from "@shared/schema";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { getEmailConfig } from "../lib/email-settings";
import { sendMail } from "../lib/graph-mail";
import { renderExpiryReminder, renderMonthlyDigest, type DigestRow } from "./templates";
import { loadEmailBrand } from "./brand";
import {
  daysBetween,
  digestSectionFor,
  milestonesDue,
  monthKeyInClientTz,
  todayInClientTz,
} from "./expiry";

/**
 * The scheduled notification work.
 *
 * ORDERING: a notification_log row is claimed BEFORE the mail is sent, and a
 * duplicate-key rejection is what stops a second send. Claiming first is what
 * makes concurrent or repeated runs safe — the database, not this code, decides
 * who sends.
 *
 * A claim that does not result in a sent message is RELEASED, so the next run
 * retries it. Getting that wrong is not theoretical: an earlier version claimed
 * first and only then discovered email was unconfigured, which marked reminders
 * as sent that never were — and a claimed milestone never fires again, so they
 * were lost for good, one per restart. Both runs now check the configuration
 * before claiming anything, and release on failure.
 *
 * The residual risk is the opposite one: if a message is delivered but the
 * response is lost, the release causes one duplicate. That is the better trade
 * — a duplicate is visible and harmless, a silently dropped expiry reminder is
 * neither — and email_send_log records every attempt either way.
 *
 * Nothing here throws. A run that hits a bad row must still process the rest.
 */

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  passport: "Passport",
  cdc: "CDC",
  covid_vaccination: "COVID Vaccination",
  stcw_course: "STCW Course",
  sid: "Seafarer Identity Document",
  ilo_medical: "ILO Medical Certificate",
};

export const labelForDocumentType = (value: string): string =>
  DOCUMENT_TYPE_LABELS[value] ??
  value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export interface ExpiringItem {
  kind: "employee_document" | "training_record";
  id: number;
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  employeeEmail: string | null;
  label: string;
  documentNumber: string | null;
  expiryDate: string;
}

/** Active users with one of these roles who have an email address, de-duplicated. */
async function getUsersByRole(
  roles: string[],
): Promise<Array<{ email: string; name: string }>> {
  const rows = await db
    .select({ email: users.email, username: users.username })
    .from(users)
    .where(and(inArray(users.role, roles), eq(users.isActive, true)));
  const seen = new Set<string>();
  const recipients: Array<{ email: string; name: string }> = [];
  for (const r of rows) {
    const email = r.email?.trim();
    if (!email || seen.has(email.toLowerCase())) continue;
    seen.add(email.toLowerCase());
    recipients.push({ email, name: r.username || email });
  }
  return recipients;
}

/**
 * Who gets what:
 *   - the employee: every per-document reminder (6, 3 and 1 month)
 *   - project managers: the 3-month and 1-month reminders only
 *   - admins: no per-document reminders, only the monthly digest
 */
const PM_MILESTONES: ReadonlySet<string> = new Set(["3_months", "1_month"]);

/**
 * Everything with an expiry date that a reminder could apply to: employee
 * documents (including validTill, which the ILO medical uses instead of
 * expiryDate) and training records.
 */
export async function getExpiringItems(): Promise<ExpiringItem[]> {
  const items: ExpiringItem[] = [];

  const docs = await db
    .select({ document: employeeDocuments, employee: employees })
    .from(employeeDocuments)
    .leftJoin(employees, eq(employeeDocuments.employeeId, employees.id))
    .where(eq(employeeDocuments.status, "active"));

  for (const { document, employee } of docs) {
    if (!employee || employee.isActive === false) continue;
    const expiry = document.expiryDate || document.validTill;
    if (!expiry) continue;
    items.push({
      kind: "employee_document",
      id: document.id,
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      employeeCode: employee.employeeCode,
      employeeEmail: employee.email ?? null,
      label: labelForDocumentType(document.documentType),
      documentNumber: document.documentNumber ?? null,
      expiryDate: String(expiry).slice(0, 10),
    });
  }

  const trainings = await db
    .select({ record: employeeTrainingRecords, employee: employees })
    .from(employeeTrainingRecords)
    .leftJoin(employees, eq(employeeTrainingRecords.employeeId, employees.id))
    .where(isNotNull(employeeTrainingRecords.expiryDate));

  for (const { record, employee } of trainings) {
    if (!employee || employee.isActive === false) continue;
    if (record.status !== "active") continue;
    if (!record.expiryDate) continue;
    items.push({
      kind: "training_record",
      id: record.id,
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      employeeCode: employee.employeeCode,
      employeeEmail: employee.email ?? null,
      label: record.trainingName,
      documentNumber: record.certificationNumber ?? null,
      expiryDate: String(record.expiryDate).slice(0, 10),
    });
  }

  return items;
}

async function getSentMilestones(): Promise<Map<string, string[]>> {
  const rows = await db
    .select()
    .from(notificationLog)
    .where(eq(notificationLog.notificationType, "document_expiry"));

  const map = new Map<string, string[]>();
  for (const row of rows) {
    const key = `${row.documentType}:${row.documentId}`;
    map.set(key, [...(map.get(key) ?? []), row.milestone]);
  }
  return map;
}

/**
 * Claim a milestone. Returns false when another run — or another instance —
 * already has it, which is what the unique index in migration 0070 enforces.
 */
async function claimMilestones(
  documentType: string,
  documentId: number,
  milestones: string[],
): Promise<boolean> {
  try {
    await db.insert(notificationLog).values(
      milestones.map((milestone) => ({
        notificationType: "document_expiry",
        documentType,
        documentId,
        milestone,
      })),
    );
    return true;
  } catch {
    // Unique violation: already claimed. Not an error worth surfacing.
    return false;
  }
}

/** Undo a claim, so a reminder that failed to send is retried next run. */
async function releaseMilestones(
  documentType: string,
  documentId: number,
  milestones: string[],
): Promise<void> {
  try {
    await db
      .delete(notificationLog)
      .where(
        and(
          eq(notificationLog.notificationType, "document_expiry"),
          eq(notificationLog.documentType, documentType),
          eq(notificationLog.documentId, documentId),
          inArray(notificationLog.milestone, milestones),
        ),
      );
  } catch (error) {
    console.error("[notifications] Failed to release milestone claim:", error);
  }
}

export interface RunSummary {
  checked: number;
  sent: number;
  skippedNotConfigured: boolean;
  failed: number;
}

export async function runExpiryReminders(
  now: Date = new Date(),
): Promise<RunSummary> {
  const summary: RunSummary = {
    checked: 0,
    sent: 0,
    skippedNotConfigured: false,
    failed: 0,
  };

  try {
    // Checked BEFORE anything is claimed. Claiming first and discovering the
    // absence of a configuration afterwards marked reminders as sent that were
    // never sent — and a claimed milestone never fires again, so those were
    // lost permanently. One burnt per restart until someone configured email.
    if (!(await getEmailConfig())) {
      summary.skippedNotConfigured = true;
      return summary;
    }

    const today = todayInClientTz(now);
    const [items, sentMap, managers, brand] = await Promise.all([
      getExpiringItems(),
      getSentMilestones(),
      getUsersByRole(["project_manager"]),
      loadEmailBrand(),
    ]);

    summary.checked = items.length;

    for (const item of items) {
      const alreadySent = sentMap.get(`${item.kind}:${item.id}`) ?? [];
      const due = milestonesDue(item.expiryDate, today, alreadySent);
      if (!due.send) continue;

      const employeeEmail = item.employeeEmail?.trim() || null;
      // Project managers only from the 3-month milestone on; never a copy of
      // a message going to their own address as the employee.
      const pmRecipients = PM_MILESTONES.has(due.send.key)
        ? managers.filter(
            (m) =>
              !employeeEmail ||
              m.email.toLowerCase() !== employeeEmail.toLowerCase(),
          )
        : [];

      // Nobody to write to (e.g. a 6-month reminder for an employee with no
      // address): skip WITHOUT claiming, so it still goes out on the first run
      // after an address is added. The digest covers the document meanwhile.
      if (!employeeEmail && pmRecipients.length === 0) continue;

      const claimed = await claimMilestones(item.kind, item.id, due.suppress);
      if (!claimed) continue;

      const reminder = {
        employeeName: item.employeeName,
        employeeCode: item.employeeCode,
        documentLabel: item.label,
        documentNumber: item.documentNumber,
        expiryDate: item.expiryDate,
        daysRemaining: due.daysRemaining,
        milestoneLabel: due.send.label,
        brand,
      };

      // Separate messages: the employee reads "your document", managers read
      // "a document belonging to X", and nobody sees anyone else's address.
      const results = [];

      if (employeeEmail) {
        const { subject, html } = renderExpiryReminder({
          ...reminder,
          forEmployee: true,
        });
        results.push(
          await sendMail({
            to: [employeeEmail],
            subject,
            html,
            recipientNames: { [employeeEmail]: item.employeeName },
            template: "expiry_reminder_employee",
            relatedType: item.kind,
            relatedId: item.id,
          }),
        );
      }

      if (pmRecipients.length > 0) {
        const { subject, html } = renderExpiryReminder({
          ...reminder,
          forEmployee: false,
        });
        results.push(
          await sendMail({
            to: pmRecipients.map((m) => m.email),
            subject,
            html,
            recipientNames: Object.fromEntries(
              pmRecipients.map((m) => [m.email, m.name]),
            ),
            template: "expiry_reminder_pm",
            relatedType: item.kind,
            relatedId: item.id,
          }),
        );
      }

      if (results.some((r) => r.sent)) {
        // At least one audience was reached, so the claim stands. If the other
        // message failed it is recorded in email_send_log; retrying it would
        // mean re-sending to the audience that already has it.
        summary.sent += 1;
        if (results.some((r) => !r.sent)) summary.failed += 1;
      } else {
        // Release the claim so the next run retries. Graph failures are usually
        // transient — a token blip or a 5xx — and permanently losing a reminder
        // to one is worse than the narrow risk of a duplicate, which only
        // arises if the message actually went out and the response was lost.
        // email_send_log records both attempts either way.
        summary.failed += 1;
        await releaseMilestones(item.kind, item.id, due.suppress);
        if (results.some((r) => r.skipped === "not_configured")) {
          summary.skippedNotConfigured = true;
          return summary;
        }
      }
    }
  } catch (error) {
    console.error("[notifications] Expiry reminder run failed:", error);
  }

  return summary;
}

export async function runMonthlyDigest(
  now: Date = new Date(),
): Promise<{
  sent: boolean;
  skippedNotConfigured?: boolean;
  noRecipients?: boolean;
  rows?: number;
}> {
  try {
    // Same reason as the expiry run: never claim a month we cannot send.
    if (!(await getEmailConfig())) {
      return { sent: false, skippedNotConfigured: true };
    }

    const today = todayInClientTz(now);
    const monthKey = monthKeyInClientTz(now);

    // Everything that can throw or come back empty happens BEFORE the claim,
    // so a claimed month always reaches a send attempt.
    const [items, recipients] = await Promise.all([
      getExpiringItems(),
      getUsersByRole(["admin"]),
    ]);

    // No active admin: leave the month unclaimed, so the
    // digest goes out on the first run after one is added, and say so in the log.
    if (recipients.length === 0) {
      return { sent: false, noRecipients: true };
    }

    // Keyed on the month, so "the 1st" means "the first run during that month".
    // A restart on the 1st cannot skip the digest — the next tick sends it.
    const claimed = await (async () => {
      try {
        await db.insert(notificationLog).values({
          notificationType: "monthly_digest",
          documentType: "digest",
          documentId: 0,
          milestone: monthKey,
        });
        return true;
      } catch {
        return false;
      }
    })();

    if (!claimed) return { sent: false };

    // Everything expiring in the next 90 days, each in its 1/2/3-month section.
    const rows: DigestRow[] = [];
    for (const item of items) {
      const section = digestSectionFor(item.expiryDate, today);
      if (section === null) continue;
      rows.push({
        section,
        employeeName: item.employeeName,
        employeeCode: item.employeeCode,
        documentLabel: item.label,
        expiryDate: item.expiryDate,
        daysRemaining: daysBetween(today, item.expiryDate),
      });
    }
    rows.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

    const monthLabel = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Dubai",
      month: "long",
      year: "numeric",
    }).format(now);

    const { subject, html } = renderMonthlyDigest({
      monthLabel,
      rows,
      brand: await loadEmailBrand(),
    });
    const result = await sendMail({
      to: recipients.map((r) => r.email),
      subject,
      html,
      recipientNames: Object.fromEntries(
        recipients.map((r) => [r.email, r.name]),
      ),
      template: "monthly_digest",
    });

    if (!result.sent) {
      // Release the claim on ANY failure, not only "not configured", so the
      // next hourly run retries. Previously a Graph error (expired secret,
      // outage) kept the claim and that month's digest was never sent. Each
      // failed attempt is still recorded in email_send_log.
      try {
        await db
          .delete(notificationLog)
          .where(
            and(
              eq(notificationLog.notificationType, "monthly_digest"),
              eq(notificationLog.milestone, monthKey),
            ),
          );
      } catch (releaseError) {
        console.error(
          "[notifications] Failed to release monthly digest claim:",
          releaseError,
        );
      }
      if (result.skipped === "not_configured") {
        return { sent: false, skippedNotConfigured: true };
      }
      console.error(
        `[notifications] Monthly digest for ${monthKey} failed and will be retried: ${result.error}`,
      );
      return { sent: false };
    }

    return { sent: true, rows: rows.length };
  } catch (error) {
    console.error("[notifications] Monthly digest run failed:", error);
    return { sent: false };
  }
}
