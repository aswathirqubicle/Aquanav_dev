import {
  getCommonStyles,
  generateCommonHeader,
  generateCommonFooter,
} from "../document-utils";
import { sanitize } from "./sanitize";
import { computeDocumentTotals } from "@shared/document-totals";

/**
 * Sales invoice PDF, laid out to match the format the client already issues.
 *
 * Every figure comes from computeDocumentTotals — the same engine the forms and
 * the ledger use — rather than being recalculated here. The previous version
 * printed `quantity × unitPrice` as the line total, ignoring both the discount
 * and the tax: on any invoice carrying a line discount the printed lines did
 * not add up to the printed subtotal, with nothing on the page to explain the
 * difference.
 *
 * Following the reference format, figures inside the item table carry NO
 * currency code — it is stated in the totals block and the tax summary instead,
 * which keeps the table readable and lets Description take the slack.
 */
export function generateInvoiceHTML(
  invoice: any,
  customer: any,
  company: any,
): string {
  const val = (v: any) =>
    v === "null" || v === null || v === undefined ? "" : v;

  const currency = invoice.currency || customer.currency || "AED";

  /** Plain grouped number — the item table repeats no currency code. */
  const num = (amount: string | number) => {
    const n = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(n) ? n : 0);
  };

  /** Currency-prefixed — totals and tax summary only. */
  const money = (amount: string | number) => `${currency}${num(amount)}`;

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    const day = String(d.getDate()).padStart(2, "0");
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const items: any[] = Array.isArray(invoice.items) ? invoice.items : [];

  // Header discount is a percentage when one is set, otherwise the stored
  // amount — mirroring how the forms resolve it.
  const headerPct = parseFloat(invoice.discountPercentage || "0") || 0;
  const totals = computeDocumentTotals(
    items.map((it) => ({
      quantity: Number(it.quantity) || 0,
      unitPrice: Number(it.unitPrice) || 0,
      taxRate: Number(it.taxRate) || 0,
      discount: Number(it.discount) || 0,
      discountType: it.discountType === "percentage" ? "percentage" : "amount",
    })),
    headerPct > 0
      ? { discount: headerPct, discountType: "percentage" as const }
      : {
          discount: parseFloat(invoice.discount || "0") || 0,
          discountType: "amount" as const,
        },
  );

  // The Discount column only appears when something was actually discounted,
  // so an ordinary invoice keeps the wider Description of the reference format.
  const anyDiscount = totals.discountTotal > 0.005;

  // Tax stated per rate band. A tax invoice has to show the tax charged at each
  // rate, which a single aggregate figure cannot do once an invoice mixes
  // standard and zero-rated lines.
  const byRate = new Map<number, { taxable: number; tax: number }>();
  items.forEach((it, i) => {
    const line = totals.lines[i];
    if (!line) return;
    const rate = Number(it.taxRate) || 0;
    const bucket = byRate.get(rate) || { taxable: 0, tax: 0 };
    bucket.taxable += line.taxable;
    bucket.tax += line.taxAmount;
    byRate.set(rate, bucket);
  });
  const rateBands = Array.from(byRate.entries()).sort((a, b) => a[0] - b[0]);
  const rateLabel = (rate: number) =>
    rate === 0 ? "Zero Rate (0%)" : `Standard Rate (${rate}%)`;

  const paid = parseFloat(invoice.paidAmount || "0") || 0;
  const balanceDue = totals.total - paid;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${val(invoice.invoiceNumber)}</title>
      ${getCommonStyles()}
      <style>
        .inv-title { font-size: 22px; letter-spacing: 3px; font-weight: 700; text-align: right; margin: 0; }
        .inv-number { text-align: right; font-size: 12px; margin: 2px 0 14px; }
        .inv-balance-box { text-align: right; margin-bottom: 18px; }
        .inv-balance-box .label { font-size: 11px; color: #555; }
        .inv-balance-box .value { font-size: 16px; font-weight: 700; }
        .inv-parties { width: 100%; border-collapse: collapse; border: none !important; margin-bottom: 14px; }
        .inv-parties td { border: none !important; vertical-align: top; padding: 0; font-size: 11px; }
        .inv-meta { width: 100%; border-collapse: collapse; border: none !important; }
        .inv-meta td { border: none !important; padding: 2px 0; font-size: 11px; }
        .inv-meta .k { color: #555; text-align: right; padding-right: 10px; white-space: nowrap; }
        .inv-meta .v { text-align: right; white-space: nowrap; font-weight: 600; }
        .inv-subject { font-size: 11px; margin: 6px 0 14px; }
        .inv-subject .k { font-weight: 700; }
        table.inv-items { width: 100%; border-collapse: collapse; table-layout: fixed; }
        table.inv-items th { background: #33475b; color: #fff; font-size: 10px; font-weight: 600; padding: 7px 6px; text-align: right; }
        table.inv-items th.l { text-align: left; }
        table.inv-items td { font-size: 10.5px; padding: 7px 6px; vertical-align: top; text-align: right; border-bottom: 1px solid #e6e6e6; }
        table.inv-items td.l { text-align: left; white-space: pre-wrap; word-break: break-word; }
        table.inv-items td.c { text-align: center; }
        .inv-taxrate { display: block; font-size: 9px; color: #666; }
        .inv-totals { width: 62%; margin-left: auto; border-collapse: collapse; border: none !important; margin-top: 4px; page-break-inside: avoid; break-inside: avoid; }
        .inv-totals td { border: none !important; font-size: 11px; padding: 4px 6px; }
        .inv-totals td.k { text-align: right; color: #444; }
        .inv-totals td.v { text-align: right; width: 130px; font-weight: 600; }
        .inv-totals tr.grand td { border-top: 1px solid #333 !important; font-size: 12.5px; font-weight: 700; }
        .inv-totals tr.due td { background: #f3f5f7; font-weight: 700; }
        .inv-taxsummary { width: 100%; border-collapse: collapse; margin-top: 6px; }
        .inv-taxsummary th { background: #f3f5f7; font-size: 10px; padding: 6px; text-align: right; border-bottom: 1px solid #ddd; }
        .inv-taxsummary th.l { text-align: left; }
        .inv-taxsummary td { font-size: 10.5px; padding: 6px; text-align: right; border-bottom: 1px solid #eee; }
        .inv-taxsummary td.l { text-align: left; }
        .inv-taxsummary tr.tot td { font-weight: 700; border-top: 1px solid #333; }
        .inv-section-h { font-size: 12px; font-weight: 700; margin: 18px 0 4px; }
        .inv-block { font-size: 10.5px; white-space: pre-wrap; }
        .inv-keep { page-break-inside: avoid; break-inside: avoid; }
      </style>
    </head>
    <body>
      ${generateCommonHeader({ company })}
      <table class="report-wrapper" style="width: 100%; border-collapse: collapse; border: none !important;">
        <thead>
          <tr><td style="border: none !important; padding: 0 !important;"><div class="report-header-space"></div>
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="report-content-cell">

              <h1 class="inv-title">TAX INVOICE</h1>
              <p class="inv-number"># ${val(invoice.invoiceNumber)}</p>

              <div class="inv-balance-box">
                <div class="label">Balance Due</div>
                <div class="value">${money(balanceDue)}</div>
              </div>

              <table class="inv-parties">
                <tr>
                  <td style="width: 55%;">
                    <p style="margin:0 0 2px;"><strong>${val(company.name)}</strong></p>
                    <p style="margin:0; white-space: pre-wrap;">${val(company.address)}</p>
                    ${val(company.email) ? `<p style="margin:0;">${val(company.email)}</p>` : ""}
                    ${val(company.vatNumber) ? `<p style="margin:2px 0 0;"><strong>TRN:</strong> ${val(company.vatNumber)}</p>` : ""}
                  </td>
                  <td style="width: 45%;">
                    <table class="inv-meta">
                      <tr><td class="k">Invoice Date :</td><td class="v">${formatDate(invoice.invoiceDate)}</td></tr>
                      ${val(invoice.paymentTerms) ? `<tr><td class="k">Terms :</td><td class="v">${val(invoice.paymentTerms)}</td></tr>` : ""}
                      <tr><td class="k">Due Date :</td><td class="v">${formatDate(invoice.dueDate)}</td></tr>
                      ${val(invoice.workOrderNumber) ? `<tr><td class="k">P.O.# :</td><td class="v">${val(invoice.workOrderNumber)}</td></tr>` : ""}
                    </table>
                  </td>
                </tr>
              </table>

              <div style="margin-bottom: 10px;">
                <p style="margin:0 0 2px; font-size: 11px; font-weight: 700;">Bill To</p>
                <p style="margin:0; font-size: 11px;"><strong>${val(customer.name)}</strong></p>
                <p style="margin:0; font-size: 11px; white-space: pre-wrap;">${val(invoice.billingAddress) || val(customer.address) || ""}</p>
                ${val(customer.phone) ? `<p style="margin:0; font-size: 11px;">PH: ${val(customer.phone)}</p>` : ""}
                ${val(customer.vatNumber) ? `<p style="margin:0; font-size: 11px;"><strong>TRN:</strong> ${val(customer.vatNumber)}</p>` : ""}
              </div>

              ${
                val(invoice.subject)
                  ? `<div class="inv-subject"><span class="k">Subject :</span><br />${val(invoice.subject)}</div>`
                  : ""
              }

              <table class="inv-items">
                <colgroup>
                  <col style="width: 26px;" />
                  <col />
                  <col style="width: 46px;" />
                  <col style="width: 74px;" />
                  ${anyDiscount ? `<col style="width: 68px;" />` : ""}
                  <col style="width: 82px;" />
                  <col style="width: 62px;" />
                  <col style="width: 82px;" />
                </colgroup>
                <thead>
                  <tr>
                    <th class="l">#</th>
                    <th class="l">Item &amp; Description</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    ${anyDiscount ? `<th>Discount</th>` : ""}
                    <th>Taxable Amount</th>
                    <th>Tax</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${items
                    .map((item: any, i: number) => {
                      const line = totals.lines[i];
                      if (!line) return "";
                      const rate = Number(item.taxRate) || 0;
                      // The line's own discount plus its share of the header
                      // discount, so the taxable amount is never smaller than
                      // rate × qty with nothing on the page accounting for it.
                      const shownDiscount =
                        line.lineDiscount + line.headerDiscountShare;
                      return `
                    <tr>
                      <td class="c">${i + 1}</td>
                      <!-- pre-wrap is set inline as well as on .l: descriptions
                           are multi-line and the guarantee that newlines survive
                           into the PDF should not depend on a stylesheet rule
                           someone could edit from a distance. -->
                      <td class="l" style="white-space: pre-wrap;">${val(item.description)}</td>
                      <td>${val(item.quantity)}</td>
                      <td>${num(item.unitPrice)}</td>
                      ${anyDiscount ? `<td>${shownDiscount > 0.005 ? num(shownDiscount) : "-"}</td>` : ""}
                      <td>${num(line.taxable)}</td>
                      <td>${num(line.taxAmount)}<span class="inv-taxrate">${rate}%</span></td>
                      <td>${num(line.lineTotal)}</td>
                    </tr>`;
                    })
                    .join("")}
                </tbody>
              </table>

              <table class="inv-totals">
                ${
                  anyDiscount
                    ? `
                <tr><td class="k">Gross</td><td class="v">${num(totals.gross)}</td></tr>
                <tr><td class="k">Discount</td><td class="v">-${num(totals.discountTotal)}</td></tr>`
                    : ""
                }
                <tr><td class="k">Sub Total</td><td class="v">${num(totals.taxableTotal)}</td></tr>
                <tr><td class="k">Tax</td><td class="v">${num(totals.taxTotal)}</td></tr>
                <tr class="grand"><td class="k">Total</td><td class="v">${money(totals.total)}</td></tr>
                ${
                  paid > 0
                    ? `<tr><td class="k">Paid</td><td class="v">-${num(paid)}</td></tr>`
                    : ""
                }
                <tr class="due"><td class="k">Balance Due</td><td class="v">${money(balanceDue)}</td></tr>
              </table>

              <div class="inv-keep">
                <div class="inv-section-h">Tax Summary</div>
                <table class="inv-taxsummary">
                  <thead>
                    <tr>
                      <th class="l">Tax Details</th>
                      <th>Taxable Amount (${currency})</th>
                      <th>Tax Amount (${currency})</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rateBands
                      .map(
                        ([rate, b]) => `
                    <tr>
                      <td class="l">${rateLabel(rate)}</td>
                      <td>${num(b.taxable)}</td>
                      <td>${num(b.tax)}</td>
                    </tr>`,
                      )
                      .join("")}
                    <tr class="tot">
                      <td class="l">Total</td>
                      <td>${money(totals.taxableTotal)}</td>
                      <td>${money(totals.taxTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              ${
                val(invoice.remarks)
                  ? `<div class="inv-keep"><div class="inv-section-h">Notes</div><div class="rich-text-content inv-block">${sanitize(invoice.remarks)}</div></div>`
                  : ""
              }

              ${
                val(invoice.termsAndConditions) || val(invoice.bankAccount)
                  ? `<div class="inv-keep"><div class="inv-section-h">Terms &amp; Conditions</div>
                     ${val(invoice.termsAndConditions) ? `<div class="rich-text-content inv-block">${sanitize(invoice.termsAndConditions)}</div>` : ""}
                     ${val(invoice.bankAccount) ? `<div class="rich-text-content inv-block" style="margin-top:6px;">${sanitize(invoice.bankAccount)}</div>` : ""}</div>`
                  : ""
              }

            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr><td style="border: none !important; padding: 0 !important;"><div class="report-footer-space"></div>
            </td>
          </tr>
        </tfoot>
      </table>
      ${generateCommonFooter({ company })}
    </body>
    </html>
  `;
}
