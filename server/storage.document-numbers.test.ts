/**
 * Document numbering: the starting points the client carried over from their
 * previous system, and what happens at the year boundary.
 *
 * The numbers here are the client's own: the first purchase order this system
 * issues must read 0142, the first sales invoice 0165, the first quotation
 * 0092 and the first credit note 0014, because those continue books kept
 * elsewhere. Getting one wrong puts a duplicate or a gap into their accounts,
 * which is why these are pinned by test rather than left to a constant nobody
 * reads.
 */
import { StorageBase } from "./storage/base";
import { db } from "./db";
import { purchaseOrders, salesInvoices } from "@shared/schema";

jest.mock("./db", () => require("./test-db-mock").createDbMock());

describe("generateNextNumber", () => {
  let base: StorageBase;

  beforeEach(() => {
    base = new StorageBase();
    jest.clearAllMocks();
    (db as any).__resetQueue();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const inYear = (year: number) =>
    jest.useFakeTimers().setSystemTime(new Date(`${year}-06-15T08:00:00Z`));

  describe("2026, the baseline year: each type starts where the client left off", () => {
    beforeEach(() => inYear(2026));

    it.each([
      ["PO", "PO-AQNV-2026-0142"],
      ["QTN", "QTN-AQNV-2026-0092"],
      ["INV", "INV-AQNV-2026-0165"],
      ["CN", "CN-AQNV-2026-0014"],
    ])("issues %s as %s when nothing exists yet", async (prefix, expected) => {
      (db as any).__queueResult([]);
      await expect(
        base.generateNextNumber(prefix, purchaseOrders, purchaseOrders.poNumber),
      ).resolves.toBe(expected);
    });

    it.each([
      ["PRF", "PRF-AQNV-2026-0001"],
      ["PR", "PR-AQNV-2026-0001"],
      ["PI", "PI-AQNV-2026-0001"],
      ["PCN", "PCN-AQNV-2026-0001"],
    ])("starts %s at 1, having no carried-over sequence", async (prefix, expected) => {
      (db as any).__queueResult([]);
      await expect(
        base.generateNextNumber(prefix, purchaseOrders, purchaseOrders.poNumber),
      ).resolves.toBe(expected);
    });

    it("counts on from the highest number already issued", async () => {
      (db as any).__queueResult([{ number: "PO-AQNV-2026-0142" }]);
      await expect(
        base.generateNextNumber("PO", purchaseOrders, purchaseOrders.poNumber),
      ).resolves.toBe("PO-AQNV-2026-0143");
    });

    it("never steps back below the starting point", async () => {
      // A row numbered under the floor (legacy, or hand-entered) must not pull
      // the sequence back down to it.
      (db as any).__queueResult([{ number: "INV-AQNV-2026-0007" }]);
      await expect(
        base.generateNextNumber("INV", salesInvoices, salesInvoices.invoiceNumber),
      ).resolves.toBe("INV-AQNV-2026-0165");
    });

    it("keeps four digits past the thousand mark", async () => {
      (db as any).__queueResult([{ number: "PO-AQNV-2026-0999" }]);
      await expect(
        base.generateNextNumber("PO", purchaseOrders, purchaseOrders.poNumber),
      ).resolves.toBe("PO-AQNV-2026-1000");
    });
  });

  describe("later years restart at 1", () => {
    it("issues the first 2027 purchase order as 0001, not 0142", async () => {
      inYear(2027);
      (db as any).__queueResult([]);
      await expect(
        base.generateNextNumber("PO", purchaseOrders, purchaseOrders.poNumber),
      ).resolves.toBe("PO-AQNV-2027-0001");
    });

    it("issues the first 2027 sales invoice as 0001, not 0165", async () => {
      inYear(2027);
      (db as any).__queueResult([]);
      await expect(
        base.generateNextNumber("INV", salesInvoices, salesInvoices.invoiceNumber),
      ).resolves.toBe("INV-AQNV-2027-0001");
    });

    it("still counts on within the new year", async () => {
      inYear(2027);
      (db as any).__queueResult([{ number: "INV-AQNV-2027-0004" }]);
      await expect(
        base.generateNextNumber("INV", salesInvoices, salesInvoices.invoiceNumber),
      ).resolves.toBe("INV-AQNV-2027-0005");
    });
  });
});
