import {
  getCommonStyles,
  generateCommonHeader,
  generateCommonFooter,
} from "../document-utils";
import { sanitize } from "./sanitize";

export function generatePurchaseInvoiceHTML(
  invoice: any,
  supplier: any,
  company: any,
  project?: any,
): string {
  const val = (v: any) =>
    v === "null" || v === null || v === undefined ? "" : v;
  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    const currency = supplier.currency || "AED";
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
      <title>Purchase Invoice ${val(invoice.invoiceNumber)}</title>
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
                <h1>PURCHASE INVOICE</h1>
                <p><strong>Invoice Number:</strong> ${val(invoice.invoiceNumber)}</p>
                ${val(invoice.supplierInvoiceNumber) ? `<p><strong>Supplier Invoice Number:</strong> ${val(invoice.supplierInvoiceNumber)}</p>` : ""}
                <p><strong>Date:</strong> ${formatDate(invoice.invoiceDate)}</p>
                ${val(invoice.dueDate) ? `<p><strong>Due Date:</strong> ${formatDate(invoice.dueDate)}</p>` : ""}
                ${val(invoice.poNumber) ? `<p><strong>Linked PO:</strong> ${val(invoice.poNumber)}</p>` : val(invoice.poId) ? `<p><strong>Linked PO:</strong> PO-${val(invoice.poId)}</p>` : ""}
                ${project ? `<p><strong>Project:</strong> ${val(project.title)}</p>` : ""}
              </div>

              <div class="info-grid">
                <div class="info-box">
                  <h3>Supplier:</h3>
                  <p><strong>${val(supplier.name)}</strong></p>
                  ${val(supplier.address) ? `<p style="white-space: pre-wrap;">${val(supplier.address)}</p>` : ""}
                  ${val(supplier.phone) ? `<p>Phone: ${val(supplier.phone)}</p>` : ""}
                  ${val(supplier.email) ? `<p>Email: ${val(supplier.email)}</p>` : ""}
                  ${val(supplier.vatNumber) ? `<p><strong>TRN:</strong> ${val(supplier.vatNumber)}</p>` : ""}
                </div>
                <div class="info-box">
                  <h3>Bill To:</h3>
                  <p><strong>${val(company.name)}</strong></p>
                  <p style="white-space: pre-wrap;">${val(company.address) || ""}</p>
                  ${val(company.phone) ? `<p>Phone: ${val(company.phone)}</p>` : ""}
                  ${val(company.email) ? `<p>Email: ${val(company.email)}</p>` : ""}
                  ${val(company.website) ? `<p>Website: ${val(company.website)}</p>` : ""}
                  ${val(company.vatNumber) ? `<p><strong>TRN:</strong> ${val(company.vatNumber)}</p>` : ""}
                </div>
              </div>

              <div class="terms" style="margin-bottom: 20px;">
                ${val(invoice.paymentTerms) ? `<p><strong>Payment Terms:</strong> ${val(invoice.paymentTerms)}</p>` : ""}
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th class="text-right">Qty</th>
                    <th class="text-right">Unit Price</th>
                    <th class="text-right">Tax Rate</th>
                    <th class="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${(invoice.items || [])
                    .map((item: any) => {
                      const lineSubtotal = item.quantity * item.unitPrice;
                      const taxAmount = parseFloat(item.taxAmount || 0);
                      const lineTotal = parseFloat(
                        item.lineTotal || lineSubtotal + taxAmount,
                      );
                      const taxRate =
                        item.taxRate ||
                        (lineSubtotal > 0
                          ? (taxAmount / lineSubtotal) * 100
                          : 0);

                      return `
                    <tr>
                      <td>
                        <div style="font-weight: 500; white-space: pre-wrap;">${item.itemType === "product" ? val(item.inventoryItemName) : val(item.description)}</div>
                        ${item.itemType === "product" && val(item.inventoryItemDescription) ? `<div style="font-size: 10px; color: #666; margin-top: 2px;">${val(item.inventoryItemDescription)}</div>` : ""}
                      </td>
                      <td class="text-right">${val(item.quantity)} ${item.itemType === "product" ? val(item.inventoryItemUnit) : ""}</td>
                      <td class="text-right">${formatCurrency(item.unitPrice)}</td>
                      <td class="text-right">${parseFloat(taxRate).toFixed(0)}%</td>
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
                          <strong>Bank Account Details:</strong>
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
                          // fields; the discountAmount column holds only the header.
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
                          <td class="text-right">${formatCurrency(invoice.taxAmount || 0)}</td>
                        </tr>
                        <tr class="total-row">
                          <td><strong>Total Amount:</strong></td>
                          <td class="text-right">${formatCurrency(invoice.totalAmount || 0)}</td>
                        </tr>
                        ${
                          parseFloat(invoice.paidAmount || 0) > 0
                            ? `
                        <tr>
                          <td><strong>Paid Amount:</strong></td>
                          <td class="text-right">${formatCurrency(invoice.paidAmount)}</td>
                        </tr>
                        <tr class="total-row" style="color: ${parseFloat(invoice.paidAmount) >= parseFloat(invoice.totalAmount) ? "green" : "red"};">
                          <td><strong>Balance Due:</strong></td>
                          <td class="text-right">${formatCurrency(parseFloat(invoice.totalAmount) - parseFloat(invoice.paidAmount))}</td>
                        </tr>
                        `
                            : ""
                        }
                      </table>
                    </td>
                  </tr>
                </table>
              </div>

              ${val(invoice.notes) ? `<div class="terms" style="margin-top: 20px;"><h3>Notes:</h3><div>${sanitize(invoice.notes)}</div></div>` : ""}
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
