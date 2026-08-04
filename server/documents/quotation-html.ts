import {
  renderDocument,
  documentTotalsFor,
  formatDocumentDate,
  moneyIn,
} from "./document-layout";

/**
 * Sales quotation PDF, on the shared layout the sales invoice uses.
 *
 * The page itself lives in document-layout.ts, shared with the other sales and
 * purchase documents; this file supplies only what makes a quotation a
 * quotation — its title, its meta rows, and the decision about whether it is a
 * quotation anyone has been offered yet.
 *
 * Moving it onto that layout also corrected the figures. The old template
 * computed `quantity × unitPrice + tax` per line, charging VAT on the gross, so
 * a discounted quotation quoted VAT the customer would never be charged. Every
 * figure now comes from computeDocumentTotals, the same engine the quotation
 * form and the ledger use.
 */
export function generateQuotationHTML(
  quotation: any,
  customer: any,
  company: any,
): string {
  const val = (v: any) =>
    v === "null" || v === null || v === undefined ? "" : v;

  const currency = quotation.currency || customer?.currency || "AED";
  const money = moneyIn(currency);

  const items: any[] = Array.isArray(quotation.items) ? quotation.items : [];
  const totals = documentTotalsFor(quotation, items);

  // A quotation still being drafted has not been offered to anyone, so it
  // should not present itself as one the customer can accept. draft and
  // pending_approval are pre-approval and rejected never reached it; sent,
  // approved and converted are all live offers.
  const status = String(quotation.status || "").toLowerCase();
  const isIssued =
    status !== "draft" && status !== "pending_approval" && status !== "rejected";

  return renderDocument({
    company,
    title: isIssued ? "QUOTATION" : "DRAFT QUOTATION",
    htmlTitle: `${isIssued ? "Quotation" : "Draft Quotation"} ${val(quotation.quotationNumber)}`,
    documentNumber: val(quotation.quotationNumber),
    draft: !isIssued,
    currency,
    highlight: { label: "Total", value: money(totals.total) },
    parties: [
      {
        label: "Bill To",
        name: val(customer?.name),
        address: val(quotation.billingAddress) || val(customer?.address) || "",
        // phone: val(customer?.phone),
        // TRN falls back to Tax ID: the two fields both exist on the
        // counterparty and most records carry only the latter, so printing
        // vatNumber alone left the TRN off nearly every document.
        // vatNumber: val(customer?.vatNumber) || val(customer?.taxId),
      },
    ],
    // sales_quotations carries no date column of its own — createdDate is the
    // date the quotation bears — and stores no work order number, so there is
    // no P.O.# row to print here as there is on an invoice or proforma.
    meta: [
      { key: "Quote Date", value: formatDocumentDate(quotation.createdDate) },
      { key: "Valid Until", value: formatDocumentDate(quotation.validUntil) },
      { key: "Terms", value: val(quotation.paymentTerms) },
    ],
    subject: val(quotation.subject),
    items,
    totals,
    sections: [
      { heading: "Notes", bodies: [quotation.remarks] },
      // Bank details sit under Terms & Conditions rather than a heading of
      // their own, as the approved invoice layout has them.
      {
        heading: "Terms &amp; Conditions",
        bodies: [quotation.termsAndConditions],
      },
      {
        heading: "Our Bank Details",
        bodies: [quotation.bankAccount],
      },
    ],
  });
}
