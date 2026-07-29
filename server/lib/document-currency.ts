import { storage } from "../storage";

/**
 * A document is denominated in the currency of the party it bills or is owed
 * to. A customer's and a supplier's currency is fixed once the record exists
 * (see the guards in customers.routes.ts / suppliers.routes.ts), so the two can
 * only disagree if a document is written with a currency of its own — which is
 * what these check for.
 *
 * The counterparty's currency is read from the database, never from the request,
 * so the check cannot be talked out of by the payload that is being validated.
 *
 * Both return an error message to send back, or null when the document is fine.
 * Absent and empty currencies are treated as the "AED" the column defaults to,
 * so a payload that simply omits the field is not rejected.
 */

const norm = (value: unknown): string =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : "AED";

export async function checkCustomerDocumentCurrency(
  customerId: number | null | undefined,
  documentCurrency: unknown,
): Promise<string | null> {
  if (!customerId) return null;

  const customer = await storage.getCustomer(customerId);
  // A missing customer is someone else's error to report; the FK and the
  // route's own 404 handling cover it. Do not fail the request here.
  if (!customer) return null;

  const expected = norm(customer.currency);
  const actual = norm(documentCurrency);
  if (expected === actual) return null;

  return `This document is in ${actual} but the customer is billed in ${expected}. A document must use its customer's currency.`;
}

export async function checkSupplierDocumentCurrency(
  supplierId: number | null | undefined,
  documentCurrency: unknown,
): Promise<string | null> {
  if (!supplierId) return null;

  const supplier = await storage.getSupplier(supplierId);
  if (!supplier) return null;

  const expected = norm(supplier.currency);
  const actual = norm(documentCurrency);
  if (expected === actual) return null;

  return `This document is in ${actual} but the supplier trades in ${expected}. A document must use its supplier's currency.`;
}

/**
 * A credit note is checked against the INVOICE it credits, not the customer.
 * Settlement adds the note's total straight onto the invoice's paid amount, so
 * the two must share a currency or that arithmetic silently mixes denominations.
 * The invoice is in turn checked against the customer by the function above,
 * which is what keeps the whole chain consistent.
 */
export async function checkCreditNoteCurrency(
  salesInvoiceId: number | null | undefined,
  creditNoteCurrency: unknown,
): Promise<string | null> {
  if (!salesInvoiceId) return null;

  const invoice = await storage.getSalesInvoice(salesInvoiceId);
  if (!invoice) return null;

  const expected = norm(invoice.currency);
  const actual = norm(creditNoteCurrency);
  if (expected === actual) return null;

  return `This credit note is in ${actual} but invoice ${invoice.invoiceNumber} is in ${expected}. A credit note must use the currency of the invoice it credits.`;
}
