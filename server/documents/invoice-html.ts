import {
  renderDocument,
  documentTotalsFor,
  formatDocumentDate,
  moneyIn,
  num,
} from "./document-layout";

/**
 * Sales invoice PDF, laid out to match the format the client already issues.
 *
 * The page itself lives in document-layout.ts, shared with the other five
 * sales and purchase documents; this file supplies only what makes an invoice
 * an invoice — its title, its meta rows, the paid/balance figures, and the
 * decision about whether it may call itself a tax invoice at all.
 */
export function generateInvoiceHTML(
  invoice: any,
  customer: any,
  company: any,
): string {
  const val = (v: any) =>
    v === "null" || v === null || v === undefined ? "" : v;

  const currency = invoice.currency || customer?.currency || "AED";
  const money = moneyIn(currency);

  const items: any[] = Array.isArray(invoice.items) ? invoice.items : [];
  const totals = documentTotalsFor(invoice, items);

  const paid = parseFloat(invoice.paidAmount || "0") || 0;
  const balanceDue = totals.total - paid;

  // Only an approved invoice is a tax invoice. Before approval it carries a
  // throwaway INV-DRFT-<timestamp> number and has posted nothing to the ledger,
  // so calling it a TAX INVOICE would present a working document as a VAT
  // document a customer could act on. Rejected never reached approval either.
  // draft/pending_approval matches how the edit-note gate defines pre-approval
  // in sales-invoices.routes.ts, so the two cannot drift apart.
  const status = String(invoice.status || "").toLowerCase();
  const isApproved =
    status !== "draft" && status !== "pending_approval" && status !== "rejected";

  return renderDocument({
    company,
    title: isApproved ? "TAX INVOICE" : "DRAFT INVOICE",
    htmlTitle: `${isApproved ? "Invoice" : "Draft Invoice"} ${val(invoice.invoiceNumber)}`,
    documentNumber: val(invoice.invoiceNumber),
    draft: !isApproved,
    currency,
    highlight: { label: "Balance Due", value: money(balanceDue) },
    parties: [
      {
        label: "Bill To",
        name: val(customer?.name),
        address: val(invoice.billingAddress) || val(customer?.address) || "",
        phone: val(customer?.phone),
        // TRN falls back to Tax ID: the two fields both exist on the
        // counterparty and most records carry only the latter, so printing
        // vatNumber alone left the TRN off nearly every document.
        vatNumber: val(customer?.vatNumber) || val(customer?.taxId),
      },
    ],
    meta: [
      { key: "Invoice Date", value: formatDocumentDate(invoice.invoiceDate) },
      { key: "Terms", value: val(invoice.paymentTerms) },
      { key: "Due Date", value: formatDocumentDate(invoice.dueDate) },
      { key: "P.O.#", value: val(invoice.workOrderNumber) },
    ],
    subject: val(invoice.subject),
    items,
    totals,
    extraTotalRows: [
      ...(paid > 0
        ? [{ key: "Paid", value: `-${num(paid)}` }]
        : []),
      { key: "Balance Due", value: money(balanceDue), emphasis: true },
    ],
    sections: [
      { heading: "Notes", bodies: [invoice.remarks] },
      // Bank details sit under Terms & Conditions rather than a heading of
      // their own, as the approved layout has them.
      {
        heading: "Terms &amp; Conditions",
        bodies: [invoice.termsAndConditions, invoice.bankAccount],
      },
    ],
  });
}
