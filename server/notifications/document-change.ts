import { db } from "../db";
import { employeeDocuments, employees, users } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { getEmailConfig } from "../lib/email-settings";
import { sendMail } from "../lib/graph-mail";
import { renderDocumentChange } from "./templates";
import { labelForDocumentType } from "./runner";
import { CLIENT_TIMEZONE } from "./expiry";

/**
 * Emails sent when an EMPLOYEE adds or edits one of their own documents.
 *
 * Two messages: a review notice to every active project manager (the system
 * has no per-employee manager, so all of them are told about every employee),
 * and a confirmation to the employee.
 *
 * Called after the response has gone out, so the save never waits on Microsoft
 * and never fails because of email. Never throws; each send attempt, success or
 * failure, is recorded in email_send_log by sendMail.
 */
export async function notifyEmployeeDocumentChange(input: {
  documentId: number;
  action: "added" | "updated";
  /** The address the employee was using, for the "View in Aquanav" link. */
  appOrigin?: string | null;
}): Promise<void> {
  try {
    if (!(await getEmailConfig())) return;

    const [found] = await db
      .select({ document: employeeDocuments, employee: employees })
      .from(employeeDocuments)
      .innerJoin(employees, eq(employeeDocuments.employeeId, employees.id))
      .where(eq(employeeDocuments.id, input.documentId));
    if (!found) return;
    const { document, employee } = found;

    const managers = (
      await db
        .select({ email: users.email, username: users.username })
        .from(users)
        .where(and(eq(users.role, "project_manager"), eq(users.isActive, true)))
    ).filter((m) => !!m.email && m.email.trim() !== "");

    const employeeName = `${employee.firstName} ${employee.lastName}`;
    const employeeEmail = employee.email?.trim() || null;

    const changedAt = new Intl.DateTimeFormat("en-GB", {
      timeZone: CLIENT_TIMEZONE,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());

    const expiry = document.expiryDate || document.validTill;
    const common = {
      action: input.action,
      employeeName,
      employeeCode: employee.employeeCode,
      documentLabel: labelForDocumentType(document.documentType),
      documentNumber: document.documentNumber ?? null,
      dateOfIssue: document.dateOfIssue ? String(document.dateOfIssue).slice(0, 10) : null,
      expiryDate: expiry ? String(expiry).slice(0, 10) : null,
      attachmentCount: Array.isArray(document.attachmentPaths)
        ? document.attachmentPaths.length
        : 0,
      changedAt,
    };

    if (managers.length > 0) {
      const { subject, html } = renderDocumentChange({
        ...common,
        forEmployee: false,
        viewUrl: input.appOrigin ? `${input.appOrigin}/employees` : null,
      });
      await sendMail({
        to: managers.map((m) => m.email),
        subject,
        html,
        recipientNames: Object.fromEntries(
          managers.map((m) => [m.email, m.username || m.email]),
        ),
        template: "document_change_pm",
        relatedType: "employee_document",
        relatedId: document.id,
      });
    } else {
      console.warn(
        `[notifications] Document ${document.id} ${input.action} by ${employeeName}: no active project manager with an email address to notify.`,
      );
    }

    if (employeeEmail) {
      const { subject, html } = renderDocumentChange({
        ...common,
        forEmployee: true,
      });
      await sendMail({
        to: [employeeEmail],
        subject,
        html,
        recipientNames: { [employeeEmail]: employeeName },
        template: "document_change_employee",
        relatedType: "employee_document",
        relatedId: document.id,
      });
    }
  } catch (error) {
    console.error("[notifications] Document change email failed:", error);
  }
}

/**
 * The origin to link back to, taken from the browser's Origin header so a
 * staging change links to staging and production to production. Anything that
 * is not a plain http(s) origin is ignored rather than put into an email.
 */
export function appOriginFrom(header: unknown): string | null {
  if (typeof header !== "string") return null;
  try {
    const url = new URL(header);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}
