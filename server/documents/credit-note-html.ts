import {
  renderDocument,
  documentTotalsFor,
  formatDocumentDate,
  moneyIn,
} from "./document-layout";

/**
 * Credit note PDF, on the shared layout the sales invoice uses.
 *
 * The page itself lives in document-layout.ts; this file supplies only what
 * makes a credit note a credit note — its title, the invoice it credits, and
 * the reason it was raised.
 *
 * Figures now come from computeDocumentTotals, the engine the forms and the
 * ledger use, so VAT sits on the discounted base. The old template computed
 * `quantity × unitPrice + tax` per line, charging VAT on the gross and
 * overstating the credit by the tax on any discount given.
 *
 * There is no Terms & Conditions section: credit_notes has neither a
 * terms_and_conditions nor a bank_account column — migration 0042 dropped
 * payment_terms, bank_account and remarks from the table. A credit note's
 * `reason` is its note, so that is what Notes prints.
 */
export function generateCreditNoteHTML(
  creditNote: any,
  customer: any,
  company: any,
): string {
  const val = (v: any) =>
    v === "null" || v === null || v === undefined ? "" : v;

  const currency = creditNote.currency || customer?.currency || "AED";
  const money = moneyIn(currency);

  const items: any[] = Array.isArray(creditNote.items) ? creditNote.items : [];
  const totals = documentTotalsFor(creditNote, items);

  // Only an issued credit note has posted to the ledger; anything else credits
  // the customer nothing yet and can still change, so it should not present
  // itself as a credit note the customer can act on. The column's states are
  // draft | issued | cancelled.
  // Three states, three titles. Lumping cancelled in with draft would label a
  // note that WAS issued — posted to the ledger and since reversed — as though
  // it had never been raised. Both non-issued states print muted, since neither
  // is a live credit the customer can act on.
  const status = String(creditNote.status || "").toLowerCase();
  const isIssued = status === "issued";
  const isCancelled = status === "cancelled";
  // "Tax Credit Note" is the wording UAE VAT requires on the document itself,
  // and only an issued note is one: a draft has posted nothing and a cancelled
  // one has been reversed, so neither may present itself as a tax document the
  // customer can reclaim against.
  const label = isIssued
    ? "Tax Credit Note"
    : isCancelled
      ? "Cancelled Credit Note"
      : "Draft Credit Note";

  return renderDocument({
    company,
    title: label.toUpperCase(),
    htmlTitle: `${label} ${val(creditNote.creditNoteNumber)}`,
    documentNumber: val(creditNote.creditNoteNumber),
    draft: !isIssued,
    currency,
    highlight: { label: "Total", value: money(totals.total) },
    parties: [
      {
        label: "Bill To",
        name: val(customer?.name),
        address:
          val(creditNote.billingAddress) || val(customer?.address) || "",
        phone: val(customer?.phone),
        // TRN falls back to Tax ID: the two fields both exist on the
        // counterparty and most records carry only the latter, so printing
        // vatNumber alone left the TRN off nearly every document.
        vatNumber: val(customer?.vatNumber) || val(customer?.taxId),
      },
    ],
    meta: [
      {
        key: "Credit Note Date",
        value: formatDocumentDate(creditNote.creditNoteDate),
      },
      // The table stores only salesInvoiceId; the invoice *number* is a joined
      // field, carried by some callers and not others. A bare row id would tell
      // the customer nothing, so the row is dropped rather than printed when
      // the number is absent.
      // Identifying the original tax invoice is a UAE requirement, not a
      // convenience: the credited amounts mean nothing without the supply they
      // adjust. Both rows drop when the caller has not resolved them rather
      // than printing a bare row id, which would tell the customer nothing.
      { key: "Against Tax Invoice", value: val(creditNote.invoiceNumber) },
      {
        key: "Original Invoice Date",
        value: formatDocumentDate(creditNote.invoiceDate),
      },
    ],
    subject: val(creditNote.subject),
    items,
    totals,
    // UAE VAT requires a brief explanation of the circumstances giving rise
    // to the adjustment, which is exactly what `reason` holds — so it is
    // headed as such rather than as generic notes.
    sections: [
      { heading: "Reason for Adjustment", bodies: [creditNote.reason] },
    ],
  });
}
