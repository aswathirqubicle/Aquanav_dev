/**
 * P4b — VAT on the discounted base (UAE law) + line-item discounts.
 * Tests the shared calc engine used by both the forms and server validation.
 */
import { describe, it, expect } from "@jest/globals";
import {
  computeDocumentTotals,
  LineItemInput,
  DiscountType,
} from "../shared/document-totals";

const line = (
  quantity: number,
  unitPrice: number,
  taxRate?: number,
  discount?: number,
  discountType?: DiscountType,
): LineItemInput => ({ quantity, unitPrice, taxRate, discount, discountType });

const round2 = (n: number) => Math.round(n * 100) / 100;

describe("computeDocumentTotals — VAT on discounted base (P4b) + line discounts", () => {
  it("T4b.1 — 10,000 @ 5% VAT, 10% header discount → VAT 450, total 9,450", () => {
    const t = computeDocumentTotals([line(1, 10000, 5)], {
      discount: 10,
      discountType: "percentage",
    });
    expect(t.headerDiscount).toBe(1000);
    expect(t.taxableTotal).toBe(9000);
    expect(t.taxTotal).toBe(450);
    expect(t.total).toBe(9450);
  });

  it("T4b.2 — no discount → VAT 500, total 10,500 (regression guard)", () => {
    const t = computeDocumentTotals([line(1, 10000, 5)]);
    expect(t.taxTotal).toBe(500);
    expect(t.total).toBe(10500);
  });

  it("T4b.3 — fixed-amount header discount 1,000 → taxable 9,000, VAT 450", () => {
    const t = computeDocumentTotals([line(1, 10000, 5)], {
      discount: 1000,
      discountType: "amount",
    });
    expect(t.taxableTotal).toBe(9000);
    expect(t.taxTotal).toBe(450);
  });

  it("T4b.4 — mixed 5% + zero-rated, 10% discount apportioned 50/50 → VAT 225 not 250", () => {
    const t = computeDocumentTotals([line(1, 5000, 5), line(1, 5000, 0)], {
      discount: 10,
      discountType: "percentage",
    });
    expect(t.lines[0].taxable).toBe(4500);
    expect(t.lines[0].taxAmount).toBe(225);
    expect(t.lines[1].taxAmount).toBe(0);
    expect(t.taxTotal).toBe(225);
  });

  it("T4b.5 — zero-rated line with a discount posts no VAT (G2)", () => {
    const t = computeDocumentTotals([line(1, 10000, 0)], {
      discount: 10,
      discountType: "percentage",
    });
    expect(t.taxTotal).toBe(0);
    expect(t.total).toBe(9000);
  });

  it("T4b.7 — 100% discount → taxable 0, VAT 0, total 0", () => {
    const t = computeDocumentTotals([line(1, 10000, 5)], {
      discount: 100,
      discountType: "percentage",
    });
    expect(t.taxableTotal).toBe(0);
    expect(t.taxTotal).toBe(0);
    expect(t.total).toBe(0);
  });

  it("line discount only — 1,000 off a 10,000 line @ 5% → taxable 9,000, VAT 450", () => {
    const t = computeDocumentTotals([line(1, 10000, 5, 1000, "amount")]);
    expect(t.lineDiscountTotal).toBe(1000);
    expect(t.taxableTotal).toBe(9000);
    expect(t.taxTotal).toBe(450);
  });

  it("line + header together — line 10% then header 10% → taxable 8,100, VAT 405", () => {
    // 10,000 −10% line = 9,000; −10% header = 8,100; VAT 5% = 405
    const t = computeDocumentTotals([line(1, 10000, 5, 10, "percentage")], {
      discount: 10,
      discountType: "percentage",
    });
    expect(t.lineDiscountTotal).toBe(1000);
    expect(t.headerDiscount).toBe(900);
    expect(t.taxableTotal).toBe(8100);
    expect(t.taxTotal).toBe(405);
    expect(t.total).toBe(8505);
  });

  it("a line discount never drives the line negative", () => {
    const t = computeDocumentTotals([line(1, 100, 5, 500, "amount")]);
    expect(t.lines[0].afterLineDiscount).toBe(0);
    expect(t.taxTotal).toBe(0);
  });

  it("T4b.11 (H3) — per-line rounded taxes sum to the document VAT; total balances", () => {
    const t = computeDocumentTotals([
      line(1, 33.33, 5),
      line(1, 33.33, 5),
      line(1, 33.34, 5),
    ]);
    const sumLineTax = round2(
      t.lines.reduce((s, l) => s + l.taxAmount, 0),
    );
    expect(t.taxTotal).toBe(sumLineTax);
    expect(t.total).toBe(round2(t.taxableTotal + t.taxTotal));
  });

  it("header discount apportionment sums exactly across uneven lines (remainder to largest)", () => {
    const t = computeDocumentTotals(
      [line(1, 3333.33, 5), line(1, 3333.33, 5), line(1, 3333.34, 5)],
      { discount: 1000, discountType: "amount" },
    );
    const shares = round2(
      t.lines.reduce((s, l) => s + l.headerDiscountShare, 0),
    );
    expect(shares).toBe(1000);
    expect(t.taxableTotal).toBe(round2(9000)); // 10,000 gross − 1,000 header
  });
});
