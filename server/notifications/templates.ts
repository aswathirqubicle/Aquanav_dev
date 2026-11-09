/**
 * HTML for the notification emails.
 *
 * String builders returning a full document, mirroring server/documents/*-html.ts,
 * which is how this codebase already renders HTML.
 *
 * Unlike those, EVERY interpolated value is escaped. Document numbers, employee
 * names and training titles are user-entered, and this HTML is delivered to a
 * mail client rather than to our own print view — an unescaped apostrophe in a
 * surname would corrupt the markup, and anything worse would be worse.
 *
 * Styling is inline: Outlook and most webmail strip <style> blocks.
 */

import { DIGEST_SECTIONS, type DigestSection } from "./expiry";

const esc = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** "2027-01-25" -> "25 Jan 2027". Sliced, never parsed, so no timezone shift. */
const humanDate = (isoDate: string): string => {
  if (typeof isoDate !== "string" || isoDate.length < 10) return esc(isoDate);
  const [year, month, day] = isoDate.slice(0, 10).split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const name = months[parseInt(month, 10) - 1];
  return name ? `${day} ${name} ${year}` : esc(isoDate);
};

/** Aquanav navy, taken from the logo. */
const BRAND = "#1b2a72";
const INK = "#1f2933";
const MUTED = "#6b7785";
const LINE = "#e4e7eb";

/** Company details for the footer, passed in by the caller (no lookups here). */
export interface EmailBrand {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}

/** Picks the footer fields from a companies row (or anything shaped like it). */
export function brandFromCompany(
  company: EmailBrand | null | undefined,
): EmailBrand | null {
  if (!company) return null;
  const { name, address, phone, email, website } = company;
  return { name, address, phone, email, website };
}

const DEFAULT_COMPANY = "Aquanav Maritime Services L.L.C";

export const EMAIL_DISCLAIMER =
  "This email and any attachments are confidential and intended solely for the named recipient. " +
  "If you have received it in error, please notify the sender and delete it; any use, disclosure, " +
  "copying or distribution by anyone else is prohibited. The company does not accept liability for " +
  "any loss or damage arising from this email or its attachments, including from viruses. " +
  "This message was generated automatically by Aquanav. Please do not reply to it.";

const websiteHref = (website: string): string =>
  /^https?:\/\//i.test(website) ? website : `https://${website}`;

/**
 * The branded layout every email uses: logo, navy rule, title, body, sign-off,
 * a navy footer with the company's details, and the disclaimer. Table-based
 * with inline styles, which is what Outlook renders reliably. The logo is
 * cid:aquanav-logo, attached inline by sendMail.
 */
const shell = (title: string, body: string, brand?: EmailBrand | null): string => {
  const company = brand?.name?.trim() || DEFAULT_COMPANY;
  const details = [
    brand?.address?.trim() ? esc(brand.address.trim()) : "",
    brand?.phone?.trim() ? esc(brand.phone.trim()) : "",
    brand?.email?.trim() ? esc(brand.email.trim()) : "",
    brand?.website?.trim()
      ? `<a href="${esc(websiteHref(brand.website.trim()))}" style="color:#ffffff;">${esc(brand.website.trim())}</a>`
      : "",
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#eef1f6;font-family:Arial,Helvetica,sans-serif;color:${INK};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;">
      <tr><td align="center" style="padding:28px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid ${LINE};border-radius:8px;">
          <tr><td style="padding:22px 28px 18px;border-bottom:3px solid ${BRAND};">
            <img src="cid:aquanav-logo" width="150" alt="Aquanav" style="display:block;border:0;height:auto;" />
          </td></tr>
          <tr><td style="padding:24px 28px 8px;">
            <h1 style="margin:0 0 16px;font-size:19px;line-height:1.3;color:${BRAND};">${esc(title)}</h1>
            ${body}
          </td></tr>
          <tr><td style="padding:16px 28px 22px;">
            <p style="margin:0;font-size:12px;color:${MUTED};">Regards,<br /><strong style="color:${INK};">${esc(company)}</strong></p>
          </td></tr>
          <tr><td style="background:${BRAND};padding:16px 28px;color:#c9d2ea;font-size:11px;line-height:1.6;border-radius:0 0 7px 7px;">
            <strong style="color:#ffffff;">${esc(company)}</strong>${details.length ? `<br />${details.join(" &nbsp;·&nbsp; ")}` : ""}
          </td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;">
          <tr><td style="padding:16px 8px 0;font-size:10.5px;line-height:1.6;color:#8a94a3;">
            <strong>Disclaimer:</strong> ${esc(EMAIL_DISCLAIMER)}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
};

const row = (label: string, value: string): string => `
  <tr>
    <td style="padding:7px 16px 7px 0;color:${MUTED};font-size:13px;white-space:nowrap;vertical-align:top;">${esc(label)}</td>
    <td style="padding:7px 0;font-size:13px;font-weight:bold;color:${INK};">${value}</td>
  </tr>`;

export interface ExpiryReminderInput {
  employeeName: string;
  employeeCode: string;
  documentLabel: string;
  documentNumber?: string | null;
  expiryDate: string;
  daysRemaining: number;
  milestoneLabel: string;
  /** Softens the wording when it is going to the employee rather than an admin. */
  forEmployee: boolean;
  brand?: EmailBrand | null;
}

export function renderExpiryReminder(input: ExpiryReminderInput): {
  subject: string;
  html: string;
} {
  const subject = `${input.milestoneLabel} to expiry: ${input.documentLabel} — ${input.employeeName}`;

  const opening = input.forEmployee
    ? `Your <strong>${esc(input.documentLabel)}</strong> is due to expire. Please start the renewal in good time.`
    : `A document belonging to <strong>${esc(input.employeeName)}</strong> is due to expire.`;

  const body = `
    <p style="margin:0 0 16px;font-size:14px;">${opening}</p>
    <table style="border-collapse:collapse;margin-bottom:16px;">
      ${row("Employee", `${esc(input.employeeName)} (${esc(input.employeeCode)})`)}
      ${row("Document", esc(input.documentLabel))}
      ${input.documentNumber ? row("Number", esc(input.documentNumber)) : ""}
      ${row("Expires", humanDate(input.expiryDate))}
      ${row(
        "Time remaining",
        input.daysRemaining === 0
          ? '<span style="color:#b91c1c;">expires today</span>'
          : `${esc(input.daysRemaining)} day${input.daysRemaining === 1 ? "" : "s"}`,
      )}
    </table>
    <p style="margin:0;font-size:13px;color:#52606d;">
      This is the ${esc(input.milestoneLabel)} reminder. You will not receive another for this milestone.
    </p>`;

  return { subject, html: shell("Document expiry reminder", body, input.brand) };
}

export interface DocumentChangeInput {
  action: "added" | "updated";
  employeeName: string;
  employeeCode: string;
  documentLabel: string;
  documentNumber?: string | null;
  dateOfIssue?: string | null;
  expiryDate?: string | null;
  attachmentCount: number;
  /** Already formatted in the client's timezone, e.g. "09 Nov 2026, 21:45". */
  changedAt: string;
  /** Where "View in Aquanav" points. Omitted when the address is unknown. */
  viewUrl?: string | null;
  /** The project-manager notice, or the employee's own confirmation. */
  forEmployee: boolean;
  brand?: EmailBrand | null;
}

/**
 * Sent when an employee adds or edits one of their own documents: a review
 * notice to project managers and a confirmation to the employee, so a change
 * made by someone else on their login does not go unnoticed.
 */
export function renderDocumentChange(input: DocumentChangeInput): {
  subject: string;
  html: string;
} {
  const verb = input.action === "added" ? "added" : "updated";

  const subject = input.forEmployee
    ? `Your ${input.documentLabel} was ${verb} in Aquanav`
    : `${input.employeeName} ${verb} their ${input.documentLabel}`;

  const details = input.forEmployee
    ? `
      ${row("Document", esc(input.documentLabel))}
      ${input.documentNumber ? row("Number", esc(input.documentNumber)) : ""}
      ${input.expiryDate ? row("Expires", humanDate(input.expiryDate)) : ""}
      ${row("Changed on", esc(input.changedAt))}`
    : `
      ${row("Employee", `${esc(input.employeeName)} (${esc(input.employeeCode)})`)}
      ${row("Action", input.action === "added" ? "Added" : "Updated")}
      ${row("Document", esc(input.documentLabel))}
      ${input.documentNumber ? row("Number", esc(input.documentNumber)) : ""}
      ${input.dateOfIssue ? row("Issue date", humanDate(input.dateOfIssue)) : ""}
      ${input.expiryDate ? row("Expires", humanDate(input.expiryDate)) : ""}
      ${row(
        "Attachments",
        input.attachmentCount === 0
          ? "None"
          : `${esc(input.attachmentCount)} file${input.attachmentCount === 1 ? "" : "s"}`,
      )}
      ${row("Changed on", esc(input.changedAt))}`;

  const opening = input.forEmployee
    ? `<p style="margin:0 0 16px;font-size:14px;">Dear ${esc(input.employeeName)},</p>
       <p style="margin:0 0 16px;font-size:14px;">This confirms that your <strong>${esc(input.documentLabel)}</strong> was ${verb} in Aquanav. Your project manager has been notified.</p>`
    : `<p style="margin:0 0 16px;font-size:14px;"><strong>${esc(input.employeeName)}</strong> has ${verb} one of their documents in Aquanav. Please review it.</p>`;

  const closing = input.forEmployee
    ? `<p style="margin:0;font-size:13px;color:#52606d;">If you did not make this change, please contact HR immediately.</p>`
    : input.viewUrl
      ? `<p style="margin:0;"><a href="${esc(input.viewUrl)}" style="display:inline-block;background:${BRAND};color:#ffffff;padding:10px 18px;border-radius:6px;font-size:13px;font-weight:bold;text-decoration:none;">View in Aquanav</a></p>`
      : "";

  const body = `
    ${opening}
    <table style="border-collapse:collapse;margin-bottom:16px;">${details}
    </table>
    ${closing}`;

  return {
    subject,
    html: shell(
      input.forEmployee ? "Your document was saved" : "Employee document updated",
      body,
      input.brand,
    ),
  };
}

export interface DigestRow {
  /** 1 = within a month, 2 = 1 to 2 months, 3 = 2 to 3 months. */
  section: DigestSection;
  employeeName: string;
  employeeCode: string;
  documentLabel: string;
  expiryDate: string;
  daysRemaining: number;
}

const th = (label: string, align: "left" | "right" = "left"): string =>
  `<th style="text-align:${align};padding:9px 10px;font-size:12px;color:#ffffff;background:${BRAND};">${esc(label)}</th>`;

const digestTable = (rows: DigestRow[]): string => `
    <table style="border-collapse:collapse;width:100%;margin-bottom:8px;">
      <thead>
        <tr>
          ${th("Employee")}${th("Document")}${th("Expires", "right")}${th("Days left", "right")}
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `
        <tr>
          <td style="padding:8px;font-size:13px;border-bottom:1px solid #f0f2f4;">
            ${esc(r.employeeName)}<br />
            <span style="color:#7b8794;font-size:11px;">${esc(r.employeeCode)}</span>
          </td>
          <td style="padding:8px;font-size:13px;border-bottom:1px solid #f0f2f4;">${esc(r.documentLabel)}</td>
          <td style="padding:8px;font-size:13px;text-align:right;border-bottom:1px solid #f0f2f4;white-space:nowrap;">${humanDate(r.expiryDate)}</td>
          <td style="padding:8px;font-size:13px;text-align:right;border-bottom:1px solid #f0f2f4;">${esc(r.daysRemaining)}</td>
        </tr>`,
          )
          .join("")}
      </tbody>
    </table>`;

/**
 * The monthly digest: everything expiring in the next three months, in three
 * sections (within 1 month, 1 to 2 months, 2 to 3 months). A section with
 * nothing in it says so rather than disappearing, so an empty section reads as
 * an all-clear and not as a missing part of the email.
 */
export function renderMonthlyDigest(input: {
  monthLabel: string;
  rows: DigestRow[];
  brand?: EmailBrand | null;
}): { subject: string; html: string } {
  const subject = `Document expiry digest — ${input.monthLabel}`;

  const total = input.rows.length;
  const intro = `<p style="margin:0 0 16px;font-size:14px;">${
    total === 0
      ? "No employee documents or training records expire in the next 3 months."
      : `${esc(total)} item${total === 1 ? "" : "s"} expire in the next 3 months.`
  }</p>`;

  const sections = DIGEST_SECTIONS.map((section) => {
    const rows = input.rows.filter((r) => r.section === section.key);
    return `
    <h2 style="margin:20px 0 8px;font-size:15px;color:${BRAND};">${esc(section.label)} (${esc(rows.length)})</h2>
    ${
      rows.length === 0
        ? '<p style="margin:0 0 8px;font-size:13px;color:#7b8794;">Nothing in this period.</p>'
        : digestTable(rows)
    }`;
  }).join("");

  return { subject, html: shell(`Document expiry digest — ${input.monthLabel}`, intro + sections, input.brand) };
}

const formatMoney = (value: number, locale: string): string =>
  value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface PayslipInrTotal {
  /** Net pay in AED, as on the payslip. */
  netAed: number;
  /** Net pay converted to INR at `rate`. */
  netInr: number;
  /** INR per 1 AED. */
  rate: number;
  /** When that rate was saved. */
  rateSavedAt: Date;
}

/**
 * The email that carries a payslip PDF. The full breakdown is in the
 * attachment; the body carries only the net pay in INR at the latest saved
 * rate, which the client asked for. That figure is also kept in
 * email_send_log, so admins can see it in the Email Log report.
 */
export function renderPayslipEmail(input: {
  employeeName: string;
  periodLabel: string;
  companyName?: string | null;
  /** Omitted when no AED→INR rate is saved; the INR block is then left out. */
  inrTotal?: PayslipInrTotal | null;
  brand?: EmailBrand | null;
}): { subject: string; html: string } {
  const subject = `Payslip for ${input.periodLabel}`;

  const inr = input.inrTotal;
  const inrBlock = inr
    ? `
    <table style="border-collapse:collapse;margin:0 0 16px;">
      ${row("Net pay (AED)", `AED ${esc(formatMoney(inr.netAed, "en-US"))}`)}
      ${row("Net pay (INR)", `<span style="font-size:15px;">₹ ${esc(formatMoney(inr.netInr, "en-IN"))}</span>`)}
    </table>
    <p style="margin:0 0 16px;font-size:12px;color:#7b8794;">
      Converted at 1 AED = ${esc(inr.rate.toFixed(4).replace(/0+$/, "").replace(/\.$/, ""))} INR, the final conversion rate may change based on the banks forex rates at the time of transaction.
    </p>`
    : "";

  const body = `
    <p style="margin:0 0 16px;font-size:14px;">Dear ${esc(input.employeeName)},</p>
    <p style="margin:0 0 16px;font-size:14px;">
      Please find attached your payslip for <strong>${esc(input.periodLabel)}</strong>.
    </p>
    ${inrBlock}
    <p style="margin:0;font-size:13px;color:#52606d;">
      If anything on it looks wrong, please contact ${input.companyName ? esc(input.companyName) + " " : ""}HR or Finance.
    </p>`;

  return { subject, html: shell("Your payslip", body, input.brand) };
}

/** The Settings "Send a test message" email. */
export function renderTestEmail(brand?: EmailBrand | null): {
  subject: string;
  html: string;
} {
  return {
    subject: "Aquanav test email",
    html: shell(
      "Test email",
      `<p style="margin:0 0 12px;font-size:14px;">This is a test message from Aquanav.</p>
       <p style="margin:0;font-size:14px;">If you are reading it, the Microsoft 365 connection is working.</p>`,
      brand,
    ),
  };
}
