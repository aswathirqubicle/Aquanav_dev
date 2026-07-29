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

const BRAND = "#0f4c81";

const shell = (title: string, body: string): string => `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2933;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      <div style="background:${BRAND};color:#ffffff;padding:16px 20px;border-radius:6px 6px 0 0;">
        <h1 style="margin:0;font-size:18px;">${esc(title)}</h1>
      </div>
      <div style="background:#ffffff;padding:20px;border:1px solid #e4e7eb;border-top:none;border-radius:0 0 6px 6px;">
        ${body}
      </div>
      <p style="margin:16px 0 0;font-size:12px;color:#7b8794;">
        Sent automatically by Aquanav. Please do not reply to this message.
      </p>
    </div>
  </body>
</html>`;

const row = (label: string, value: string): string => `
  <tr>
    <td style="padding:6px 12px 6px 0;color:#7b8794;font-size:13px;white-space:nowrap;">${esc(label)}</td>
    <td style="padding:6px 0;font-size:13px;font-weight:bold;">${value}</td>
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

  return { subject, html: shell("Document expiry reminder", body) };
}

export interface DigestRow {
  employeeName: string;
  employeeCode: string;
  documentLabel: string;
  expiryDate: string;
}

export function renderMonthlyDigest(input: {
  monthLabel: string;
  rows: DigestRow[];
}): { subject: string; html: string } {
  const subject = `Documents expiring in ${input.monthLabel}`;

  // An empty month still sends: silence is ambiguous — it could equally mean
  // the job is broken — whereas "nothing expires" is a useful all-clear.
  const body =
    input.rows.length === 0
      ? `<p style="margin:0;font-size:14px;">No employee documents or training records expire in ${esc(input.monthLabel)}.</p>`
      : `
    <p style="margin:0 0 16px;font-size:14px;">
      ${esc(input.rows.length)} item${input.rows.length === 1 ? "" : "s"} expire in <strong>${esc(input.monthLabel)}</strong>.
    </p>
    <table style="border-collapse:collapse;width:100%;">
      <thead>
        <tr style="background:#f4f6f8;">
          <th style="text-align:left;padding:8px;font-size:12px;color:#52606d;border-bottom:1px solid #e4e7eb;">Employee</th>
          <th style="text-align:left;padding:8px;font-size:12px;color:#52606d;border-bottom:1px solid #e4e7eb;">Document</th>
          <th style="text-align:right;padding:8px;font-size:12px;color:#52606d;border-bottom:1px solid #e4e7eb;">Expires</th>
        </tr>
      </thead>
      <tbody>
        ${input.rows
          .map(
            (r) => `
        <tr>
          <td style="padding:8px;font-size:13px;border-bottom:1px solid #f0f2f4;">
            ${esc(r.employeeName)}<br />
            <span style="color:#7b8794;font-size:11px;">${esc(r.employeeCode)}</span>
          </td>
          <td style="padding:8px;font-size:13px;border-bottom:1px solid #f0f2f4;">${esc(r.documentLabel)}</td>
          <td style="padding:8px;font-size:13px;text-align:right;border-bottom:1px solid #f0f2f4;white-space:nowrap;">${humanDate(r.expiryDate)}</td>
        </tr>`,
          )
          .join("")}
      </tbody>
    </table>`;

  return { subject, html: shell(`Expiring this month — ${input.monthLabel}`, body) };
}
