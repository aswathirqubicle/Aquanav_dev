import {
  getCommonStyles,
  generateCommonHeader,
  generateCommonFooter,
} from "../document-utils";
import { sanitize } from "./sanitize";

export function generateQuotationHTML(
  quotation: any,
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
      <title>Quotation ${val(quotation.quotationNumber)}</title>
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
                <h1>SALES QUOTATION</h1>
                <p><strong>Quotation Number:</strong> ${val(quotation.quotationNumber)}</p>
                <p><strong>Date:</strong> ${formatDate(quotation.createdDate)}</p>
                ${val(quotation.validUntil) ? `<p><strong>Valid Until:</strong> ${formatDate(quotation.validUntil)}</p>` : ""}
                ${val(quotation.projectId) ? `<p><strong>Project:</strong> ${val(quotation.projectName) || val(quotation.projectId)}</p>` : ""}
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
                  <p style="white-space: pre-wrap;">${val(quotation.billingAddress) || val(customer.address) || ""}</p>
                </div>
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
                  ${(quotation.items || [])
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
                        quotation.bankAccount
                          ? `
                        <div style="font-size: 11px; color: #444;">
                          <strong>Our Bank Details:</strong>
                          <div class="rich-text-content">${sanitize(quotation.bankAccount)}</div>
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
                            quotation.subtotal || 0,
                          )}</td>
                        </tr>
                        ${(() => {
                          // Total discount (header + line) derived from stored
                          // fields; the `discount` column holds only the header.
                          const totalDiscount =
                            parseFloat(quotation.subtotal || "0") +
                            parseFloat(quotation.taxAmount || "0") -
                            parseFloat(quotation.totalAmount || "0");
                          return totalDiscount > 0.005
                            ? `
                        <tr>
                          <td><strong>Discount:</strong></td>
                          <td class="text-right">-${formatCurrency(totalDiscount.toFixed(2))}</td>
                        </tr>
                        `
                            : "";
                        })()}
                        <tr>
                          <td><strong>Tax Amount:</strong></td>
                          <td class="text-right">${formatCurrency(
                            quotation.taxAmount || 0,
                          )}</td>
                        </tr>
                        <tr class="total-row">
                          <td><strong>Total Amount:</strong></td>
                          <td class="text-right">${formatCurrency(
                            quotation.totalAmount || 0,
                          )}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </div>
              <div class="terms" style="margin-bottom: 20px;">
                <h3>Terms and Conditions:</h3>
                <p>This quotation is valid until ${
                  val(quotation.validUntil)
                    ? formatDate(quotation.validUntil)
                    : "further notice"
                }.</p>
                ${val(quotation.paymentTerms) ? `<p><strong>Payment Terms:</strong> ${val(quotation.paymentTerms)}</p>` : "<p>Payment terms: Net 30 days</p>"}
                ${val(quotation.termsAndConditions) ? `<h3>Additional Terms:</h3><div class="rich-text-content">${sanitize(quotation.termsAndConditions)}</div>` : ""}
                ${val(quotation.remarks) ? `<h3>Notes:</h3><div class="rich-text-content">${sanitize(quotation.remarks)}</div>` : ""}
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
