import {
  getCommonStyles,
  generateCommonHeader,
  generateCommonFooter,
} from "../document-utils";
import { sanitize } from "./sanitize";

export function generateCreditNoteHTML(
  creditNote: any,
  customer: any,
  company: any,
): string {
  const val = (v: any) =>
    v === "null" || v === null || v === undefined ? "" : v;
  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    const currency = customer.currency || "AED";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      currencyDisplay: "code",
    })
      .format(num)
      .replace(currency, currency + " ");
  };

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    const day = String(d.getDate()).padStart(2, "0");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Credit Note ${val(creditNote.creditNoteNumber)}</title>
      ${getCommonStyles()}
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
              <div class="document-info">
                <h1>CREDIT NOTE</h1>
                <p><strong>Credit Note Number:</strong> ${val(creditNote.creditNoteNumber)}</p>
                <p><strong>Date:</strong> ${formatDate(creditNote.creditNoteDate)}</p>
                ${val(creditNote.invoiceNumber) ? `<p><strong>Related Invoice:</strong> ${val(creditNote.invoiceNumber)}</p>` : ""}
                ${val(creditNote.reason) ? `<p><strong>Reason:</strong> ${val(creditNote.reason)}</p>` : ""}
                ${val(creditNote.projectId) ? `<p><strong>Project:</strong> ${val(creditNote.projectName) || val(creditNote.projectId)}</p>` : ""}
              </div>

              <div class="info-grid">
                <div class="info-box">
                  <h3>From:</h3>
                  <p><strong>${val(company.name)}</strong></p>
                  <p style="white-space: pre-wrap;">${val(company.address)}</p>
                  ${val(company.phone) ? `<p>Phone: ${val(company.phone)}</p>` : ""}
                  ${val(company.email) ? `<p>Email: ${val(company.email)}</p>` : ""}
                  ${val(company.website) ? `<p>Website: ${val(company.website)}</p>` : ""}
                  ${val(company.vatNumber) ? `<p><strong>TRN:</strong> ${val(company.vatNumber)}</p>` : ""}
                </div>
                <div class="info-box">
                  <h3>Bill To:</h3>
                  <p><strong>${val(customer.name)}</strong></p>
                  ${val(customer.contactPerson) ? `<p>Contact: ${val(customer.contactPerson)}</p>` : ""}
                  <p style="white-space: pre-wrap;">${val(creditNote.billingAddress) || val(customer.address) || ""}</p>
                  ${val(customer.phone) ? `<p>Phone: ${val(customer.phone)}</p>` : ""}
                  ${val(customer.email) ? `<p>Email: ${val(customer.email)}</p>` : ""}
                  ${val(customer.vatNumber) ? `<p><strong>TRN:</strong> ${val(customer.vatNumber)}</p>` : ""}
                </div>
              </div>

              <div style="margin-bottom: 20px;">
                <p><strong>Payment Terms:</strong></p>
                <p>${
                  val(creditNote.paymentTerms) ||
                  "This credit note will be applied to your account balance."
                }</p>
                ${
                  val(creditNote.remarks)
                    ? `<p><strong>Remarks:</strong> ${val(creditNote.remarks)}</p>`
                    : ""
                }
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th class="text-right">Qty</th>
                    <th class="text-right">Unit Price</th>
                    <th class="text-right">Tax Rate</th>
                    <th class="text-right">Tax Amount</th>
                    <th class="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${(creditNote.items || [])
                    .map((item: any) => {
                      const lineSubtotal = item.quantity * item.unitPrice;
                      const taxAmount =
                        lineSubtotal * ((item.taxRate || 0) / 100);
                      const lineTotal = lineSubtotal + taxAmount;
                      return `
                    <tr>
                      <td>${val(item.description)}</td>
                      <td class="text-right">${val(item.quantity)}</td>
                      <td class="text-right">${formatCurrency(item.unitPrice)}</td>
                      <td class="text-right">${item.taxRate || 0}%</td>
                      <td class="text-right">${formatCurrency(taxAmount)}</td>
                      <td class="text-right">${formatCurrency(lineTotal)}</td>
                    </tr>
                    `;
                    })
                    .join("")}
                </tbody>
              </table>

              <div style="margin-top: 30px;">
                <table style="width: 100%; border-collapse: collapse; border: none !important;">
                  <tr>
                    <td style="vertical-align: bottom; border: none !important; padding: 0 !important;">
                      ${
                        creditNote.bankAccount
                          ? `
                        <div style="font-size: 11px; color: #444;">
                          <strong>Bank Details:</strong>
                          <div class="rich-text-content">${sanitize(creditNote.bankAccount)}</div>
                        </div>
                      `
                          : ""
                      }
                    </td>
                    <td style="vertical-align: bottom; border: none !important; padding: 0 !important;">
                      <table style="width: 300px; margin-left: auto; margin-bottom: 0;">
                        <tr>
                          <td><strong>Subtotal:</strong></td>
                          <td class="text-right">${formatCurrency(
                            creditNote.subtotal || 0,
                          )}</td>
                        </tr>
                        ${
                          creditNote.discount &&
                          parseFloat(creditNote.discount) > 0
                            ? `
                        <tr>
                          <td><strong>Discount:</strong></td>
                          <td class="text-right">-${formatCurrency(creditNote.discount)}</td>
                        </tr>
                        `
                            : ""
                        }
                        <tr>
                          <td><strong>Tax Amount:</strong></td>
                          <td class="text-right">${formatCurrency(
                            creditNote.taxAmount || 0,
                          )}</td>
                        </tr>
                        <tr class="total-row">
                          <td><strong>Credit Amount:</strong></td>
                          <td class="text-right">${formatCurrency(
                            creditNote.totalAmount || 0,
                          )}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </div>

              <div style="margin-top: 50px;">
                <p>Thank you for your business!</p>
              </div>
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
