/**
 * Fractional line-item quantities (up to 2 decimal places) and the VAT wording
 * on the printed sales invoice.
 *
 * Renders the real templates over plain fixtures — no DB, no browser.
 */
import { describe, it, expect } from "@jest/globals";
import {
  formatQuantity,
  hasValidQuantityPrecision,
  parseQuantity,
  roundQuantity,
} from "@shared/quantity";
import { computeDocumentTotals } from "@shared/document-totals";
import { generateInvoiceHTML } from "./documents/invoice-html";
import { generateQuotationHTML } from "./documents/quotation-html";
import { generatePurchaseInvoiceHTML } from "./documents/purchase-invoice-html";

const company = { name: "Aquanav Maritime Services L.L.C", address: "Dubai" };
const customer = { name: "Test Customer", currency: "AED" };
const supplier = { name: "Test Supplier", currency: "AED" };

const item = {
  description: "Diver hours",
  quantity: 1.5,
  unitPrice: 10.25,
  taxRate: 5,
  discount: 0,
  discountType: "amount",
};
const doc = {
  items: [item],
  discount: "0",
  discountPercentage: "0",
  currency: "AED",
  status: "approved",
};

describe("quantity helpers", () => {
  it("parses form, body and numeric(10,2) values", () => {
    expect(parseQuantity("1.5")).toBe(1.5);
    expect(parseQuantity("2.00")).toBe(2);
    expect(parseQuantity(2.25)).toBe(2.25);
    expect(parseQuantity("")).toBe(0);
    expect(parseQuantity(null)).toBe(0);
    expect(parseQuantity("abc")).toBe(0);
  });

  it("rounds to 2 decimal places without float drift", () => {
    expect(roundQuantity(1.005)).toBe(1.01);
    expect(roundQuantity(2.345)).toBe(2.35);
    expect(roundQuantity(3)).toBe(3);
  });

  it("accepts at most 2 decimal places", () => {
    expect(hasValidQuantityPrecision("1.5")).toBe(true);
    expect(hasValidQuantityPrecision("2.25")).toBe(true);
    expect(hasValidQuantityPrecision(3)).toBe(true);
    expect(hasValidQuantityPrecision("1.234")).toBe(false);
    expect(hasValidQuantityPrecision(1.234)).toBe(false);
  });

  it("displays without trailing zeros", () => {
    expect(formatQuantity("2.00")).toBe("2");
    expect(formatQuantity("1.50")).toBe("1.5");
    expect(formatQuantity(2.25)).toBe("2.25");
    expect(formatQuantity(null)).toBe("");
  });
});

describe("totals with a fractional quantity", () => {
  it("1.5 × 10.25 at 5% VAT", () => {
    const totals = computeDocumentTotals(
      [{ quantity: 1.5, unitPrice: 10.25, taxRate: 5, discount: 0, discountType: "amount" }],
      { discount: 0, discountType: "amount" },
    );
    // 15.375 taxable and 0.76875 VAT, each rounded to 2 places as the line
    // prints them; the total is their sum, so the page adds up.
    expect(totals.taxableTotal).toBeCloseTo(15.38, 2);
    expect(totals.taxTotal).toBeCloseTo(0.77, 2);
    expect(totals.total).toBeCloseTo(16.15, 2);
  });

  it("a numeric(10,2) string quantity totals the same as the number", () => {
    const html = generatePurchaseInvoiceHTML(
      { ...doc, items: [{ ...item, itemType: "service", quantity: "1.50" }] },
      supplier,
      company,
    );
    expect(html).toContain("15.38");
    // Printed as 1.5, not 1.50.
    expect(html).toMatch(/<td>1\.5<\/td>/);
  });
});

describe("sales invoice prints VAT, other documents keep Tax", () => {
  it("sales invoice", () => {
    const html = generateInvoiceHTML(doc, customer, company);
    expect(html).toContain("<th>VAT(AED)</th>");
    expect(html).toContain("<th>VAT Amount (AED)</th>");
    expect(html).not.toContain("<th>Tax (AED)</th>");
    expect(html).not.toContain("<th>Tax Amount (AED)</th>");
    // Fractional quantity prints as entered.
    expect(html).toMatch(/<td>1\.5<\/td>/);
  });

  it("quotation is unchanged", () => {
    const html = generateQuotationHTML(doc, customer, company);
    expect(html).toContain("<th>Tax (AED)</th>");
    expect(html).toContain("<th>Tax Amount (AED)</th>");
  });
});
