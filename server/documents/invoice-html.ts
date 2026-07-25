import {
  getCommonStyles,
  generateCommonHeader,
  generateCommonFooter,
} from "../document-utils";
import { sanitize } from "./sanitize";

export function generateInvoiceHTML(
  invoice: any,
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
      <title>Invoice ${val(invoice.invoiceNumber)}</title>
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
                <h1>TAX INVOICE</h1>
                <p><strong>Invoice Number:</strong> ${val(invoice.invoiceNumber)}</p>
                <p><strong>Invoice Date:</strong> ${formatDate(invoice.invoiceDate)}</p>
                <p><strong>Due Date:</strong> ${formatDate(invoice.dueDate)}</p>
                ${val(invoice.projectId) ? `<p><strong>Project:</strong> ${val(invoice.projectName) || val(invoice.projectId)}</p>` : ""}
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
                  <p style="white-space: pre-wrap;">${val(invoice.billingAddress) || val(customer.address) || ""}</p>
                  ${val(customer.phone) ? `<p>Phone: ${val(customer.phone)}</p>` : ""}
                  ${val(customer.email) ? `<p>Email: ${val(customer.email)}</p>` : ""}
                  ${val(customer.vatNumber) ? `<p><strong>TRN:</strong> ${val(customer.vatNumber)}</p>` : ""}
                </div>
              </div>

              <div class="terms" style="margin-bottom: 20px;">
                <p><strong>Payment Terms:</strong></p>
                <p>${val(invoice.paymentTerms)}</p>
              </div>
              <div class="terms" style="margin-bottom: 20px;">
                <p><strong>Terms & Conditions:</strong></p>
                <div class="rich-text-content">${sanitize(invoice.termsAndConditions)}</div>
              </div>
              ${val(invoice.remarks) ? `<div class="terms" style="margin-bottom: 20px;"><p><strong>Notes:</strong></p><div class="rich-text-content">${sanitize(invoice.remarks)}</div></div>` : ""}

              ${
                val(invoice.currency) && invoice.currency !== "AED"
                  ? `
                <div style="text-align: right; margin-bottom: 10px; font-size: 12px;">
                  <strong>Exchange Rate:</strong> 1 ${invoice.currency} = ${invoice.exchangeRate} AED
                </div>
              `
                  : ""
              }
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th class="text-right">Qty</th>
                    <th class="text-right">Unit Price</th>
                    <th class="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${(invoice.items || [])
                    .map((item: any) => {
                      const lineTotal = item.quantity * item.unitPrice;
                      return `
                    <tr>
                      <td>${val(item.description)}</td>
                      <td class="text-right">${val(item.quantity)}</td>
                      <td class="text-right">${formatCurrency(item.unitPrice)}</td>
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
                        invoice.bankAccount
                          ? `
                        <div style="font-size: 11px; color: #444;">
                          <strong>Our Bank Details:</strong>
                          <div class="rich-text-content">${sanitize(invoice.bankAccount)}</div>
                        </div>
                      `
                          : ""
                      }
                    </td>
                    <td style="vertical-align: bottom; border: none !important; padding: 0 !important;">
                      <table style="width: 300px; margin-left: auto; margin-bottom: 0;">
                        <tr>
                          <td><strong>Subtotal:</strong></td>
                          <td class="text-right">${formatCurrency(invoice.subtotal || 0)}</td>
                        </tr>
                        ${(() => {
                          // Total discount (header + line) derived from stored
                          // fields; the `discount` column holds only the header.
                          const totalDiscount =
                            parseFloat(invoice.subtotal || "0") +
                            parseFloat(invoice.taxAmount || "0") -
                            parseFloat(invoice.totalAmount || "0");
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
                            invoice.taxAmount || 0,
                          )}</td>
                        </tr>
                        <tr class="total-row">
                          <td><strong>Total Amount:</strong></td>
                          <td class="text-right">${formatCurrency(
                            invoice.totalAmount || 0,
                          )}</td>
                        </tr>
                        ${
                          invoice.paidAmount &&
                          parseFloat(invoice.paidAmount) > 0
                            ? `
                        <tr>
                          <td><strong>Paid Amount:</strong></td>
                          <td class="text-right">${formatCurrency(invoice.paidAmount)}</td>
                        </tr>
                        <tr class="total-row">
                          <td><strong>Balance Due:</strong></td>
                          <td class="text-right">${formatCurrency(
                            (
                              parseFloat(invoice.totalAmount || "0") -
                              parseFloat(invoice.paidAmount)
                            ).toFixed(2),
                          )}</td>
                        </tr>
                        `
                            : ""
                        }
                      </table>
                    </td>
                  </tr>
                </table>
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
