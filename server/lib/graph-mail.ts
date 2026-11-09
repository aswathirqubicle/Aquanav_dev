import fs from "fs";
import path from "path";
import { db } from "../db";
import { emailSendLog } from "@shared/schema";
import { getEmailConfig, type EmailConfig } from "./email-settings";
import { renderTestEmail } from "../notifications/templates";

/**
 * The Aquanav logo, embedded in every templated email as an inline image
 * (cid:aquanav-logo) so it shows without the reader allowing remote images.
 * Read once; null if the file is missing, in which case the email goes out
 * with the logo's alt text instead.
 */
export const LOGO_CONTENT_ID = "aquanav-logo";
let logoCache: Buffer | null | undefined;
function loadEmailLogo(): Buffer | null {
  if (logoCache === undefined) {
    const file = path.join(process.cwd(), "server/assets/email-logo.png");
    logoCache = fs.existsSync(file) ? fs.readFileSync(file) : null;
  }
  return logoCache;
}

/**
 * Sending mail through Microsoft Graph with the client-credentials flow.
 *
 * Node 20 has global fetch, so this needs no HTTP client and no Azure SDK — one
 * token request and one sendMail request, both plain JSON.
 *
 * The Entra app registration needs the APPLICATION permission Mail.Send with
 * admin consent granted. Delegated Mail.Send will authenticate fine and then
 * fail at send time, which is a confusing failure, so the error handling below
 * passes Graph's own message through rather than flattening it.
 *
 * Nothing here logs the client secret. Errors quote Graph's response body,
 * which never contains it — the secret only ever travels in a request body.
 */

interface TokenCache {
  token: string;
  expiresAt: number;
  clientId: string;
}

let cache: TokenCache | null = null;

/** 60s of slack so a token cannot expire between the check and the send. */
const EXPIRY_SKEW_MS = 60_000;

async function getAccessToken(config: EmailConfig): Promise<string> {
  if (
    cache &&
    cache.clientId === config.clientId &&
    Date.now() < cache.expiresAt - EXPIRY_SKEW_MS
  ) {
    return cache.token;
  }

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Microsoft rejected the sign-in (${response.status}). ${text.slice(0, 400)}`,
    );
  }

  const data = JSON.parse(text) as {
    access_token: string;
    expires_in: number;
  };
  cache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    clientId: config.clientId,
  };
  return data.access_token;
}

export interface SendMailInput {
  to: string[];
  subject: string;
  html: string;
  /**
   * email -> display name, for the Email Log report. Resolved by the caller
   * because only it knows whether an address belongs to a user or an employee.
   */
  recipientNames?: Record<string, string>;
  /**
   * Files sent with the message. They are not stored in email_send_log.
   * Graph's sendMail takes attachments up to 3 MB in total this way.
   */
  attachments?: Array<{
    name: string;
    contentType: string;
    content: Buffer;
    /** Set for an image the HTML shows via cid:<contentId>. */
    contentId?: string;
  }>;
  /** For the audit trail only. */
  template?: string;
  relatedType?: string;
  relatedId?: number;
}

export interface SendMailResult {
  sent: boolean;
  skipped?: "not_configured";
  error?: string;
}

/**
 * Send one message. Every attempt is written to email_send_log, success or
 * failure, so a silent delivery problem is visible without reading logs.
 *
 * Returns rather than throws: a failed reminder must not abort the run and
 * leave the rest of the batch unsent.
 */
export async function sendMail(
  input: SendMailInput,
): Promise<SendMailResult> {
  const recipients = input.to.filter((address) => !!address && address.trim() !== "");
  if (recipients.length === 0) {
    return { sent: false, error: "No recipients" };
  }

  const config = await getEmailConfig();
  if (!config) {
    // Not an error: the system simply is not configured yet.
    return { sent: false, skipped: "not_configured" };
  }

  // The branded layout references the logo by content id; attach it inline.
  const attachments = [...(input.attachments ?? [])];
  const logo = input.html.includes(`cid:${LOGO_CONTENT_ID}`) ? loadEmailLogo() : null;
  if (logo) {
    attachments.push({
      name: "aquanav-logo.png",
      contentType: "image/png",
      content: logo,
      contentId: LOGO_CONTENT_ID,
    });
  }

  try {
    const token = await getAccessToken(config);

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.senderEmail)}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            subject: input.subject,
            body: { contentType: "HTML", content: input.html },
            toRecipients: recipients.map((address) => ({
              emailAddress: { address },
            })),
            ...(attachments.length
              ? {
                  attachments: attachments.map((file) => ({
                    "@odata.type": "#microsoft.graph.fileAttachment",
                    name: file.name,
                    contentType: file.contentType,
                    contentBytes: file.content.toString("base64"),
                    ...(file.contentId
                      ? { isInline: true, contentId: file.contentId }
                      : {}),
                  })),
                }
              : {}),
          },
          saveToSentItems: true,
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `Graph refused the message (${response.status}). ${detail.slice(0, 400)}`,
      );
    }

    await logSend(recipients, input, "sent", null);
    return { sent: true };
  } catch (error: any) {
    const message = error?.message || "Unknown error";
    await logSend(recipients, input, "failed", message);
    return { sent: false, error: message };
  }
}

async function logSend(
  recipients: string[],
  input: SendMailInput,
  status: "sent" | "failed",
  error: string | null,
): Promise<void> {
  try {
    await db.insert(emailSendLog).values(
      recipients.map((address) => ({
        toEmail: address,
        recipientName: input.recipientNames?.[address] ?? null,
        subject: input.subject,
        bodyHtml: input.html,
        template: input.template ?? null,
        status,
        error,
        relatedType: input.relatedType ?? null,
        relatedId: input.relatedId ?? null,
      })),
    );
  } catch (logError) {
    // Never let the audit write break the send path.
    console.error("[email] Failed to write send log:", logError);
  }
}

/** Proves the credentials work without waiting for a scheduled run. */
export async function sendTestEmail(to: string): Promise<SendMailResult> {
  const { subject, html } = renderTestEmail();
  return sendMail({ to: [to], subject, html, template: "test" });
}
