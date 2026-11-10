import { db } from "../db";
import { users } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { getEmailConfig } from "../lib/email-settings";
import { sendMail } from "../lib/graph-mail";
import { renderProfileChange, type ProfileChangeInput } from "./templates";
import { CLIENT_TIMEZONE } from "./expiry";

/**
 * Emails sent when an employee changes their own basic info, next of kin or
 * training from My Profile: every active project manager is told, and the
 * employee gets a confirmation. Same audience and behaviour as the document
 * change email (server/notifications/document-change.ts).
 *
 * Called after the response has gone out, so a save never waits on Microsoft
 * and never fails because of email. Never throws; sendMail records every
 * attempt in email_send_log.
 */
export async function notifyEmployeeProfileChange(input: {
  employee: {
    id: number;
    firstName: string;
    lastName: string;
    employeeCode: string;
    email: string | null;
  };
  sectionLabel: string;
  itemLabel?: string | null;
  action: "added" | "updated";
  details: ProfileChangeInput["details"];
  relatedType: string;
  relatedId: number;
  appOrigin?: string | null;
}): Promise<void> {
  try {
    if (input.details.length === 0) return; // nothing actually changed
    if (!(await getEmailConfig())) return;

    const managers = (
      await db
        .select({ email: users.email, username: users.username })
        .from(users)
        .where(and(eq(users.role, "project_manager"), eq(users.isActive, true)))
    ).filter((m) => !!m.email && m.email.trim() !== "");

    const employeeName = `${input.employee.firstName} ${input.employee.lastName}`.trim();
    const employeeEmail = input.employee.email?.trim() || null;
    const changedAt = new Intl.DateTimeFormat("en-GB", {
      timeZone: CLIENT_TIMEZONE,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());

    const common = {
      sectionLabel: input.sectionLabel,
      itemLabel: input.itemLabel ?? null,
      action: input.action,
      employeeName,
      employeeCode: input.employee.employeeCode,
      details: input.details,
      changedAt,
    };

    if (managers.length > 0) {
      const { subject, html } = renderProfileChange({
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
        template: "profile_change_pm",
        relatedType: input.relatedType,
        relatedId: input.relatedId,
      });
    } else {
      console.warn(
        `[notifications] ${employeeName} changed their ${input.sectionLabel.toLowerCase()}: no active project manager with an email address to notify.`,
      );
    }

    if (employeeEmail) {
      const { subject, html } = renderProfileChange({ ...common, forEmployee: true });
      await sendMail({
        to: [employeeEmail],
        subject,
        html,
        recipientNames: { [employeeEmail]: employeeName },
        template: "profile_change_employee",
        relatedType: input.relatedType,
        relatedId: input.relatedId,
      });
    }
  } catch (error) {
    console.error("[notifications] Profile change email failed:", error);
  }
}
