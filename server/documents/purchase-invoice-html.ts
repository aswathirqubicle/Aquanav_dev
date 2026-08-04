import {
  renderDocument,
  documentTotalsFor,
  formatDocumentDate,
  moneyIn,
  num,
} from "./document-layout";

/**
 * Purchase invoice PDF, on the shared layout the sales invoice uses.
 *
 * The page itself lives in document-layout.ts; this file supplies only what
 * makes a purchase invoice one — its title, the supplier's own invoice number,
 * and the paid/balance figures.
 *
 * Figures now come from computeDocumentTotals rather than from the stored
 * subtotal/taxAmount columns, so VAT sits on the discounted base. The old
 * template printed `quantity × unitPrice + tax` per line, charging VAT on the
 * gross and overstating it by the tax on any discount given.
 *
 * Only bank details print under Terms & Conditions: purchase_invoices has a
 * bank_account column but no terms_and_conditions one — that column exists on
 * purchase_orders (migration 0072) and the sales documents, not here.
 */
export function generatePurchaseInvoiceHTML(
  invoice: any,
  supplier: any,
  company: any,
  project?: any,
): string {
  const val = (v: any) =>
    v === "null" || v === null || v === undefined ? "" : v;

  const currency = invoice.currency || supplier?.currency || "AED";
  const money = moneyIn(currency);

  // Items come from purchase_invoice_items, a child table, joined to
  // inventory_items by the storage layer. A stocked line carries its name on
  // the joined inventory item rather than in its own description column, so
  // resolve the two into the one field the layout prints.
  const items: any[] = (Array.isArray(invoice.items) ? invoice.items : []).map(
    (item: any) => ({
      ...item,
      description:
        item.itemType === "product"
          ? [val(item.inventoryItemName), val(item.inventoryItemDescription)]
              .filter(Boolean)
              .join("\n") || val(item.description)
          : val(item.description),
      // The unit rides with the quantity, as the old template printed it. The
      // layout treats quantity as a display value and takes every figure from
      // the totals below, which are computed from the raw items.
      quantity: val(item.inventoryItemUnit)
        ? `${val(item.quantity)} ${val(item.inventoryItemUnit)}`
        : val(item.quantity),
    }),
  );
  const totals = documentTotalsFor(
    invoice,
    Array.isArray(invoice.items) ? invoice.items : [],
  );

  const paid = parseFloat(invoice.paidAmount || "0") || 0;
  const balanceDue = totals.total - paid;

  // An invoice that has not been approved has posted nothing to the ledger and
  // can still change. draft/pending_approval/rejected matches how the edit gate
  // defines pre-approval in purchase-invoices.routes.ts.
  const status = String(invoice.status || "").toLowerCase();
  const isApproved =
    status !== "draft" && status !== "pending_approval" && status !== "rejected";

  return renderDocument({
    company,
    title: isApproved ? "PURCHASE INVOICE" : "DRAFT PURCHASE INVOICE",
    htmlTitle: `${isApproved ? "Purchase Invoice" : "Draft Purchase Invoice"} ${val(invoice.invoiceNumber)}`,
    documentNumber: val(invoice.invoiceNumber),
    draft: !isApproved,
    currency,
    highlight: { label: "Balance Due", value: money(balanceDue) },
    parties: [
      {
        label: "Vendor",
        name: val(supplier?.name),
        address: val(supplier?.address),
        phone: val(supplier?.phone),
        vatNumber: val(supplier?.vatNumber),
      },
    ],
    meta: [
      { key: "Invoice Date", value: formatDocumentDate(invoice.invoiceDate) },
      { key: "Due Date", value: formatDocumentDate(invoice.dueDate) },
      {
        key: "Supplier Invoice #",
        value: val(invoice.supplierInvoiceNumber),
      },
      // The order this invoice bills against; the route resolves the number
      // from poId before printing.
      { key: "P.O.#", value: val(invoice.poNumber) },
      { key: "Terms", value: val(invoice.paymentTerms) },
      {
        key: "Project",
        value: val(project?.title) || val(invoice.projectName),
      },
      {
        key: "Exchange Rate",
        value:
          currency !== "AED" && val(invoice.exchangeRate)
            ? `1 ${currency} = ${val(invoice.exchangeRate)} AED`
            : "",
      },
    ],
    subject: val(invoice.subject),
    items,
    totals,
    extraTotalRows: [
      ...(paid > 0 ? [{ key: "Paid", value: `-${num(paid)}` }] : []),
      { key: "Balance Due", value: money(balanceDue), emphasis: true },
    ],
    sections: [
      { heading: "Notes", bodies: [invoice.notes] },
      { heading: "Terms &amp; Conditions", bodies: [invoice.bankAccount] },
    ],
  });
}
