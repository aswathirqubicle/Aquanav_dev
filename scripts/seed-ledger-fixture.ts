/**
 * Ledger verification fixture — Phase 0c of LEDGER-FIX-PLAN.md.
 *
 * Creates the documents the ledger verification tests need in order to be
 * meaningful. Without it, T0.5, T12.1, T12.5 and T11.8/9 all pass against an
 * empty or thin ledger and prove nothing.
 *
 * IMPORTANT — this runs against the CURRENT, UNFIXED code on purpose.
 * The GL entries it produces are knowingly wrong: doubled AR credits from
 * credit notes (L1), a phantom Cash/Bank debit, purchase credit notes posting
 * nothing at all (L5). That is the "before" state each fix is measured
 * against, and it gives T0.5 real posted account names to validate.
 *
 * Local databases only. Refuses to run against a non-local host.
 *
 *   npx tsx scripts/seed-ledger-fixture.ts
 */
import * as dotenv from "dotenv";
dotenv.config();

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "0.0.0.0"];
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const host = new URL(dbUrl).hostname;
if (!LOCAL_HOSTS.includes(host)) {
  console.error(
    `REFUSING: DATABASE_URL host is "${host}", not local.\n` +
      `This fixture writes documents and ledger entries; it is for local ` +
      `verification databases only.`,
  );
  process.exit(1);
}

// `storage` is exported as IStorage, but that interface is ~110 methods out of
// sync with the concrete class — approvePurchaseInvoice, createPurchaseCreditNote
// and others are missing from it, which is why server/routes/*.ts produce the
// same "does not exist on type 'IStorage'" errors. Cast to the concrete class
// so this script does not add to that backlog.
import { storage as storageAsInterface, Storage } from "../server/storage";
const storage = storageAsInterface as unknown as Storage;
import { db } from "../server/db";
import {
  salesInvoices,
  creditNotes,
  purchaseInvoices,
  purchaseCreditNotes,
} from "../shared/schema";
import { eq } from "drizzle-orm";

const ADMIN_USER_ID = 1;

const step = (n: string, detail: string) =>
  console.log(`\n[fixture] ${n}\n          ${detail}`);

async function main() {
  console.log(`[fixture] target: ${host} — local, proceeding`);

  // ---------------------------------------------------------------- sales
  const [invoice] = await db
    .select()
    .from(salesInvoices)
    .where(eq(salesInvoices.id, 1));

  if (!invoice) {
    console.error("Expected sales invoice id=1 to exist. Aborting.");
    process.exit(1);
  }

  // 1. Partial payment on the approved invoice.
  //    Expected GL: Dr Cash/Bank 5000 / Cr Accounts Receivable 5000
  const existingPayments = await storage.getInvoicePayments(invoice.id);
  if (existingPayments.length === 0) {
    step("1/5 sales invoice payment", "Dr Cash/Bank 5000 / Cr AR 5000");
    await storage.createInvoicePayment({
      invoiceId: invoice.id,
      amount: "5000.00",
      paymentDate: "2026-07-20",
      paymentMethod: "Bank Transfer",
      referenceNumber: "FIXTURE-PAY-1",
      notes: "Ledger fixture: partial payment",
    } as any);
  } else {
    console.log("[fixture] 1/5 payment already present, skipping");
  }

  // 2. Issue the draft credit note.
  //    Expected GL (CORRECT half):  Dr Sales Returns / Cr AR
  //    Expected GL (L1 DEFECT):     + Dr Cash/Bank / Cr AR  <- phantom cash
  //    So AR moves by TWICE the credit note value. This is the L1 evidence.
  const [cn] = await db
    .select()
    .from(creditNotes)
    .where(eq(creditNotes.id, 1));

  if (cn && cn.status !== "issued") {
    step(
      "2/5 issue credit note (L1 evidence)",
      `value ${cn.totalAmount} — expect AR to move by TWICE that, plus a phantom Cash/Bank debit`,
    );
    await storage.updateCreditNote(cn.id, { status: "issued" } as any);
  } else {
    console.log("[fixture] 2/5 credit note already issued, skipping");
  }

  // ------------------------------------------------------------- purchase
  // 3. Approve a purchase invoice.
  //    Expected GL: Cr Accounts Payable / Dr Purchase Expense (both gross,
  //    VAT not split — that is L9/D5, fixed in P6).
  const [pi] = await db
    .select()
    .from(purchaseInvoices)
    .where(eq(purchaseInvoices.id, 1));

  if (pi && pi.status === "draft") {
    step(
      "3/5 approve purchase invoice",
      `Cr Accounts Payable ${pi.totalAmount} / Dr Purchase Expense ${pi.totalAmount} (gross — VAT unsplit)`,
    );
    await storage.approvePurchaseInvoice(pi.id, ADMIN_USER_ID);
  } else {
    console.log("[fixture] 3/5 purchase invoice not draft, skipping");
  }

  // 4. Supplier payment.
  //    Expected GL: Dr Accounts Payable / Cr Cash/Bank
  const existingPurchasePayments =
    await storage.getPurchaseInvoicePayments?.(1);
  if (!existingPurchasePayments || existingPurchasePayments.length === 0) {
    step("4/5 supplier payment", "Dr Accounts Payable 3000 / Cr Cash/Bank 3000");
    await storage.createPurchaseInvoicePayment({
      invoiceId: 1,
      amount: "3000.00",
      paymentDate: new Date("2026-07-21").toISOString(),
      paymentMethod: "Bank Transfer",
      referenceNumber: "FIXTURE-SUPP-PAY-1",
      recordedBy: ADMIN_USER_ID,
    });
  } else {
    console.log("[fixture] 4/5 supplier payment already present, skipping");
  }

  // 5. Issued purchase credit note.
  //    Expected GL: NOTHING AT ALL. This is the L5 evidence — the mirror of
  //    L1. AP is never reduced, so the supplier statement overstates the
  //    amount owed permanently.
  const existingPcn = await db.select().from(purchaseCreditNotes);
  if (existingPcn.length === 0) {
    step(
      "5/5 issue purchase credit note (L5 evidence)",
      "expect ZERO GL rows — AP is never reduced",
    );
    await storage.createPurchaseCreditNote({
      purchaseInvoiceId: 1,
      supplierId: pi?.supplierId ?? 101,
      status: "issued",
      creditNoteDate: new Date("2026-07-22").toISOString(),
      reason: "Ledger fixture: L5 evidence",
      items: [],
      subtotal: "2000.00",
      taxAmount: "100.00",
      discount: "0",
      totalAmount: "2100.00",
    });
  } else {
    console.log("[fixture] 5/5 purchase credit note already present, skipping");
  }

  console.log("\n[fixture] done. Run the P0c verification queries next.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n[fixture] FAILED:", err?.message || err);
    console.error(err);
    process.exit(1);
  });
