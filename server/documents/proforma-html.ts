import {
  renderDocument,
  documentTotalsFor,
  formatDocumentDate,
  moneyIn,
} from "./document-layout";

/**
 * Proforma invoice PDF, on the shared layout the sales invoice uses.
 *
 * The page itself lives in document-layout.ts, shared with the other sales and
 * purchase documents; this file supplies only what makes a proforma a proforma
 * — its title, its meta rows, and the decision about whether it has been
 * issued to the customer at all.
 *
 * Moving it onto that layout also corrected the figures. The old template
 * computed `quantity × unitPrice + tax` per line, charging VAT on the gross, so
 * a discounted proforma asked for VAT the customer would never be charged.
 * Every figure now comes from computeDocumentTotals, the same engine the
 * proforma form and the ledger use.
 */
export function generateProformaHTML(
  proforma: any,
  customer: any,
  company: any,
  /**
   * Accepted but deliberately unprinted, as on the purchase invoice: the
   * project drives internal cost allocation, not anything the customer needs
   * to read. The parameter stays because both callers pass it.
   */
  _project?: any,
): string {
  const val = (v: any) =>
    v === "null" || v === null || v === undefined ? "" : v;

  const currency = proforma.currency || customer?.currency || "AED";
  const money = moneyIn(currency);

  const items: any[] = Array.isArray(proforma.items) ? proforma.items : [];
  const totals = documentTotalsFor(proforma, items);

  // A proforma still being drafted has not been put in front of the customer,
  // so it should not present itself as one they can pay against. draft and sent
  // are the states the form still lets anyone edit, and rejected never reached
  // approval; approved, expired and converted have all been issued.
  const status = String(proforma.status || "").toLowerCase();
  const isIssued =
    status !== "draft" && status !== "sent" && status !== "rejected";

  return renderDocument({
    company,
    title: isIssued ? "PROFORMA INVOICE" : "DRAFT PROFORMA INVOICE",
    htmlTitle: `${isIssued ? "Proforma Invoice" : "Draft Proforma Invoice"} ${val(proforma.proformaNumber)}`,
    documentNumber: val(proforma.proformaNumber),
    draft: !isIssued,
    currency,
    highlight: { label: "Total", value: money(totals.total) },
    parties: [
      {
        label: "Bill To",
        name: val(customer?.name),
        address: val(proforma.billingAddress) || val(customer?.address) || "",
        // phone: val(customer?.phone),
        // TRN falls back to Tax ID: the two fields both exist on the
        // counterparty and most records carry only the latter, so printing
        // vatNumber alone left the TRN off nearly every document.
        // vatNumber: val(customer?.vatNumber) || val(customer?.taxId),
      },
    ],
    meta: [
      { key: "Invoice Date", value: formatDocumentDate(proforma.invoiceDate) },
      { key: "Valid Until", value: formatDocumentDate(proforma.validUntil) },
      { key: "Terms", value: val(proforma.paymentTerms) },
      { key: "Delivery Terms", value: val(proforma.deliveryTerms) },
      // The route looks the project up for this row alone; it is the only use
      // the fourth argument has.
      { key: "P.O.#", value: val(proforma.workOrderNumber) },
    ],
    subject: val(proforma.subject),
    items,
    totals,
    sections: [
      { heading: "Notes", bodies: [proforma.remarks] },
      // Bank details sit under Terms & Conditions rather than a heading of
      // their own, as the approved invoice layout has them.
      {
        heading: "Terms &amp; Conditions",
         bodies: [proforma.termsAndConditions],
      },
      {
        heading: "Our Bank Details",
        bodies: [proforma.bankAccount],
      },
    ],
  });
}
