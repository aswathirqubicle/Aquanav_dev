import {
  getCommonStyles,
  generateCommonHeader,
  generateCommonFooter,
} from "../document-utils";
import { sanitize } from "./sanitize";

export function generatePurchaseOrderHTML(
  order: any,
  supplier: any,
  company: any,
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
      <title>Purchase Order ${val(order.poNumber)}</title>
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
                <h1>PURCHASE ORDER</h1>
                <p><strong>PO Number:</strong> ${val(order.poNumber)}</p>
                <p><strong>Date:</strong> ${formatDate(order.orderDate)}</p>
                ${val(order.expectedDeliveryDate) ? `<p><strong>Expected Delivery:</strong> ${formatDate(order.expectedDeliveryDate)}</p>` : ""}
                ${val(order.projectId) ? `<p><strong>Project:</strong> ${val(order.projectName) || val(order.projectId)}</p>` : ""}
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
                  <h3>Ship To / Bill To:</h3>
                  <p><strong>${val(company.name)}</strong></p>
                  <p style="white-space: pre-wrap;">${val(company.address) || ""}</p>
                  ${val(company.phone) ? `<p>Phone: ${val(company.phone)}</p>` : ""}
                  ${val(company.email) ? `<p>Email: ${val(company.email)}</p>` : ""}
                  ${val(company.website) ? `<p>Website: ${val(company.website)}</p>` : ""}
                  ${val(company.vatNumber) ? `<p><strong>TRN:</strong> ${val(company.vatNumber)}</p>` : ""}
                </div>
              </div>

              <div class="terms" style="margin-bottom: 20px;">
                ${val(order.paymentTerms) ? `<p><strong>Payment Terms:</strong> ${val(order.paymentTerms)}</p>` : ""}
                ${val(order.deliveryTerms) ? `<p><strong>Delivery Terms:</strong> ${val(order.deliveryTerms)}</p>` : ""}
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
                  ${(order.items || [])
                    .map((item: any) => {
                      const lineSubtotal = item.quantity * item.unitPrice;
                      const taxAmount =
                        lineSubtotal * ((item.taxRate || 0) / 100);
                      const lineTotal = lineSubtotal + taxAmount;
                      return `
                    <tr>
                      <td>
                        <div style="font-weight: 500; white-space: pre-wrap;">${item.itemType === "product" ? val(item.inventoryItemName) : val(item.description)}</div>
                        ${item.itemType === "product" && val(item.inventoryItemDescription) ? `<div style="font-size: 10px; color: #666; margin-top: 2px;">${val(item.inventoryItemDescription)}</div>` : ""}
                      </td>
                      <td class="text-right">${val(item.quantity)} ${item.itemType === "product" ? val(item.inventoryItemUnit) : ""}</td>
                      <td class="text-right">${formatCurrency(item.unitPrice)}</td>
                      <td class="text-right">${item.taxRate || 0}%</td>
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
                        order.bankAccount
                          ? `
                        <div style="font-size: 11px; color: #444;">
                          <strong>Bank Account Details:</strong>
                          <div class="rich-text-content">${sanitize(order.bankAccount)}</div>
                        </div>
                      `
                          : ""
                      }
                    </td>
                    <td style="vertical-align: bottom; border: none !important; padding: 0 !important;">
                      <table style="width: 300px; margin-left: auto; margin-bottom: 0;">
                        <tr>
                          <td><strong>Subtotal:</strong></td>
                          <td class="text-right">${formatCurrency(order.subtotal || 0)}</td>
                        </tr>
                         ${(() => {
                           // Total discount (header + line) derived from stored
                           // fields; the discountAmount column holds only the header.
                           const totalDiscount =
                             parseFloat(order.subtotal || "0") +
                             parseFloat(order.taxAmount || "0") -
                             parseFloat(order.totalAmount || "0");
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
                          <td class="text-right">${formatCurrency(order.taxAmount || 0)}</td>
                        </tr>
                        <tr class="total-row">
                          <td><strong>Total Amount:</strong></td>
                          <td class="text-right">${formatCurrency(order.totalAmount || 0)}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </div>

              ${val(order.notes) ? `<div class="terms" style="margin-top: 20px;"><h3>Notes:</h3><div>${sanitize(order.notes)}</div></div>` : ""}
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
