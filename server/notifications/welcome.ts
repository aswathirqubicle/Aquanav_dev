import { db } from "../db";
import { companies } from "@shared/schema";
import { sendMail } from "../lib/graph-mail";
import { renderWelcomeEmail } from "./templates";

/** What the Email Log keeps in place of the real temporary password. */
export const MASKED_PASSWORD = "••••••••••••••";

/**
 * Email a new employee their login details. Called after the create response
 * has gone out; never throws, and sendMail records the attempt in the Email
 * Log — with the password masked, so it is not stored in plain text there.
 */
export async function sendWelcomeEmail(input: {
  employee: {
    id: number;
    firstName: string;
    lastName: string;
    email: string | null;
  };
  username: string;
  temporaryPassword: string;
  appOrigin?: string | null;
}): Promise<void> {
  try {
    const to = input.employee.email?.trim();
    if (!to) return;

    let companyName: string | null = null;
    try {
      const [company] = await db.select().from(companies).limit(1);
      companyName = company?.name ?? null;
    } catch {
      // The company name is a nicety; send without it.
    }

    const employeeName = `${input.employee.firstName} ${input.employee.lastName}`.trim();
    const common = {
      employeeName,
      companyName,
      loginUrl: input.appOrigin ?? null,
      username: input.username,
    };
    const { subject, html } = renderWelcomeEmail({
      ...common,
      temporaryPassword: input.temporaryPassword,
    });

    await sendMail({
      to: [to],
      subject,
      html,
      logHtml: renderWelcomeEmail({ ...common, temporaryPassword: MASKED_PASSWORD }).html,
      recipientNames: { [to]: employeeName },
      template: "welcome",
      relatedType: "employee",
      relatedId: input.employee.id,
    });
  } catch (error) {
    console.error("[email] Welcome email failed:", error);
  }
}
