/**
 * updatePurchaseInvoice used to set every column unconditionally with a literal
 * fallback, so a payload that omitted a field silently overwrote it. The worst
 * case was `currency: invoiceData.currency || "AED"` together with
 * `exchangeRate: invoiceData.exchangeRate || "1"`, which rewrote a USD invoice
 * to AED at rate 1 — the amounts kept their numbers but changed denomination,
 * and a later edit to an approved invoice would re-post the ledger at the wrong
 * value.
 *
 * These assert the update writes only what the caller actually supplied.
 */
import { describe, it, expect, beforeEach } from "@jest/globals";
import { Storage } from "./storage";
import { db } from "./db";

jest.mock("./db", () => require("./test-db-mock").createDbMock());

/** The `.set()` call that targets the invoice row (the one carrying its columns). */
const invoiceSetCall = () => {
  const calls = (db as any).set.mock.calls as any[][];
  const match = calls.find(
    (c) =>
      c[0] &&
      typeof c[0] === "object" &&
      ("supplierId" in c[0] ||
        "currency" in c[0] ||
        "totalAmount" in c[0] ||
        "supplierInvoiceNumber" in c[0]),
  );
  return match ? match[0] : undefined;
};

describe("updatePurchaseInvoice — only writes fields the caller supplied", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = new Storage();
    jest.clearAllMocks();
    (db as any).__resetQueue();
    // getPurchaseInvoice() runs first and must find an existing row.
    (db as any).__queueResult([
      {
        id: 1,
        status: "approved",
        currency: "USD",
        exchangeRate: "3.67255500",
        totalAmount: "1025.00",
      },
    ]);
  });

  it("leaves currency and exchangeRate alone when the payload omits them", async () => {
    await storage.updatePurchaseInvoice(
      1,
      {
        supplierId: 7,
        items: [
          {
            quantity: 2,
            unitPrice: 100,
            taxRate: 5,
            discount: 0,
            discountType: "amount",
          },
        ],
      },
      true,
    );

    const written = invoiceSetCall();
    expect(written).toBeDefined();
    // The regression: these keys must not appear at all, so the stored USD @
    // 3.672555 survives. Previously they were written as "AED" and "1".
    expect(written).not.toHaveProperty("currency");
    expect(written).not.toHaveProperty("exchangeRate");
  });

  it("still writes currency and exchangeRate when they are supplied", async () => {
    await storage.updatePurchaseInvoice(
      1,
      {
        supplierId: 7,
        currency: "USD",
        exchangeRate: "3.67255500",
        items: [
          {
            quantity: 2,
            unitPrice: 100,
            taxRate: 5,
            discount: 0,
            discountType: "amount",
          },
        ],
      },
      true,
    );

    const written = invoiceSetCall();
    expect(written).toBeDefined();
    expect(written.currency).toBe("USD");
    expect(written.exchangeRate).toBe("3.67255500");
  });

  it("does not blank the optional text fields when they are omitted", async () => {
    await storage.updatePurchaseInvoice(
      1,
      {
        supplierId: 7,
        items: [
          {
            quantity: 1,
            unitPrice: 50,
            taxRate: 0,
            discount: 0,
            discountType: "amount",
          },
        ],
      },
      true,
    );

    const written = invoiceSetCall();
    expect(written).toBeDefined();
    // Each of these previously fell back to null / "0" and wiped stored data.
    expect(written).not.toHaveProperty("supplierInvoiceNumber");
    expect(written).not.toHaveProperty("paymentTerms");
    expect(written).not.toHaveProperty("bankAccount");
    expect(written).not.toHaveProperty("notes");
    expect(written).not.toHaveProperty("discountPercentage");
    // discountAmount is deliberately NOT in that list. It is a derived output of
    // applyPurchaseDocumentTotals (the header discount the engine actually
    // applied), so it is always defined once items are supplied and is written
    // with the totals. Holding it back would leave a stored discount attached to
    // a total computed without it — inconsistent, and worse than overwriting.
    expect(written.discountAmount).toBe("0.00");
  });

  it("writes the recomputed totals, since the engine derives them from items", async () => {
    await storage.updatePurchaseInvoice(
      1,
      {
        supplierId: 7,
        items: [
          {
            quantity: 2,
            unitPrice: 100,
            taxRate: 5,
            discount: 0,
            discountType: "amount",
          },
        ],
      },
      true,
    );

    const written = invoiceSetCall();
    expect(written).toBeDefined();
    // 2 x 100 = 200 subtotal, 5% VAT = 10, total 210.
    expect(written.subtotal).toBe("200.00");
    expect(written.taxAmount).toBe("10.00");
    expect(written.totalAmount).toBe("210.00");
  });

  /**
   * The tests above all assert a field is ABSENT when the caller omits it.
   * That shape cannot tell "absent because omitted" from "absent always" — and
   * that is exactly how termsAndConditions came to be missing from updateData
   * entirely, so every edit silently discarded it while the suite stayed green.
   *
   * These assert the other direction: supply a value, and it must reach the
   * write. One case per writable text column, so a column dropped from the
   * hand-maintained allowlist fails here instead of in production.
   */
  describe.each([
    ["supplierInvoiceNumber", "SUP-INV-99"],
    ["subject", "Deck refit consumables"],
    ["paymentTerms", "Net 45 days"],
    ["bankAccount", "<p>Emirates NBD 1234567</p>"],
    ["notes", "<p>Deliver to berth 4</p>"],
    ["termsAndConditions", "Goods remain our property until paid in full."],
  ])("writes %s when the caller supplies it", (field, value) => {
    it("reaches the update", async () => {
      await storage.updatePurchaseInvoice(
        1,
        {
          supplierId: 7,
          [field]: value,
          items: [
            {
              quantity: 1,
              unitPrice: 10,
              taxRate: 0,
              discount: 0,
              discountType: "amount",
            },
          ],
        },
        true,
      );

      const written = invoiceSetCall();
      expect(written).toBeDefined();
      expect(written[field]).toBe(value);
    });
  });

  it("clears a text field when the caller supplies an empty string", async () => {
    await storage.updatePurchaseInvoice(
      1,
      {
        supplierId: 7,
        termsAndConditions: "",
        items: [
          {
            quantity: 1,
            unitPrice: 10,
            taxRate: 0,
            discount: 0,
            discountType: "amount",
          },
        ],
      },
      true,
    );

    const written = invoiceSetCall();
    expect(written).toBeDefined();
    // Empty string is a deliberate clear, stored as null — distinct from
    // omitting the key, which must leave the stored value alone.
    expect(written).toHaveProperty("termsAndConditions");
    expect(written.termsAndConditions).toBeNull();
  });
});
