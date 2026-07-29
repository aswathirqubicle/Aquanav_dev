/**
 * Line-item descriptions can contain newlines. HTML collapses whitespace, so
 * every printed document must carry white-space: pre-wrap on the description
 * cell or a multi-line description prints as one run-on line.
 *
 * These render the real templates over plain fixtures — no DB, no browser.
 */
import { describe, it, expect } from "@jest/globals";
import { generateQuotationHTML } from "./documents/quotation-html";
import { generateInvoiceHTML } from "./documents/invoice-html";
import { generateProformaHTML } from "./documents/proforma-html";
import { generateCreditNoteHTML } from "./documents/credit-note-html";
import { generatePurchaseOrderHTML } from "./documents/purchase-order-html";
import { generatePurchaseInvoiceHTML } from "./documents/purchase-invoice-html";

const MULTILINE = "Hull cleaning\nPort side and waterline\nIncludes anode check";

const company = {
  name: "Aquanav Maritime Services L.L.C",
  address: "Dubai, UAE",
  phone: "+971 4 000 0000",
  email: "info@example.test",
};

const customer = { name: "Test Customer", currency: "AED", address: "Port City" };
const supplier = { name: "Test Supplier", currency: "AED", address: "Port City" };

const salesItem = {
  description: MULTILINE,
  quantity: 2,
  unitPrice: 100,
  taxRate: 5,
  taxAmount: 10,
  discount: 0,
  discountType: "amount",
};

// Purchase templates print inventoryItemName for product lines and description
// for service lines, so the service branch is the one under test.
const purchaseItem = { ...salesItem, itemType: "service" };

const salesDoc = {
  items: [salesItem],
  subtotal: "200",
  taxAmount: "10",
  totalAmount: "210",
  discount: "0",
  discountPercentage: "0",
  currency: "AED",
};

const purchaseDoc = { ...salesDoc, items: [purchaseItem] };

/**
 * The description cell must be styled pre-wrap. Assert on the rendered element
 * rather than merely "the string appears somewhere", so a stray pre-wrap on an
 * unrelated block (the address, for instance) cannot make this pass.
 */
const expectPreWrappedDescription = (html: string) => {
  expect(html).toContain(MULTILINE);

  const idx = html.indexOf(MULTILINE);
  // Walk back to the opening tag of the element holding the description.
  const openTag = html.lastIndexOf("<", idx);
  const enclosing = html.slice(openTag, idx);

  expect(enclosing).toContain("white-space: pre-wrap");
};

describe("printed documents preserve newlines in line-item descriptions", () => {
  it("sales quotation", () => {
    expectPreWrappedDescription(
      generateQuotationHTML(salesDoc, customer, company),
    );
  });

  it("sales invoice", () => {
    expectPreWrappedDescription(
      generateInvoiceHTML(salesDoc, customer, company),
    );
  });

  it("proforma invoice", () => {
    expectPreWrappedDescription(
      generateProformaHTML(salesDoc, customer, company, null),
    );
  });

  it("credit note", () => {
    expectPreWrappedDescription(
      generateCreditNoteHTML(salesDoc, customer, company),
    );
  });

  it("purchase order", () => {
    expectPreWrappedDescription(
      generatePurchaseOrderHTML(purchaseDoc, supplier, company),
    );
  });

  it("purchase invoice", () => {
    expectPreWrappedDescription(
      generatePurchaseInvoiceHTML(purchaseDoc, supplier, company),
    );
  });
});
