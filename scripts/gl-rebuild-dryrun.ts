/**
 * GL rebuild — DRY RUN (Phase 11 pre-flight).
 *
 * Computes the ledger that WOULD be produced by re-posting every document that
 * currently exists, and reports the delta against the ledger as it stands.
 * WRITES NOTHING.
 *
 * Uses the same formulas as the live posting code, so the output is what an
 * actual rebuild would produce — not an approximation:
 *   sales approved   Dr AR (total x rate) / Cr Revenue ((total-tax) x rate) / Cr VAT (tax x rate)
 *   sales payment    Dr Cash / Cr AR                    (credit-note settlements post nothing)
 *   credit note      Dr Sales Returns (net) / Dr VAT / Cr AR (gross)
 *   purchase approved Dr Purchase Expense per project (net) / Dr VAT Recoverable / Cr AP
 *   purchase payment Dr AP / Cr Cash
 *   purchase CN      Dr AP / Cr Purchase Expense / Cr VAT Recoverable
 *   payroll          from payroll_entries (currently empty)
 *
 * Run:  npx tsx scripts/gl-rebuild-dryrun.ts
 */
import { sql as db } from "../server/db";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Book = Map<string, { dr: number; cr: number }>;
const book: Book = new Map();
const post = (account: string, dr: number, cr: number) => {
  const e = book.get(account) || { dr: 0, cr: 0 };
  e.dr = r2(e.dr + dr);
  e.cr = r2(e.cr + cr);
  book.set(account, e);
};

const notes: string[] = [];
let rowsWouldPost = 0;
const addRow = () => rowsWouldPost++;

async function main() {
  console.log("\n════════ GL REBUILD — DRY RUN (nothing is written) ════════");

  // ---------------- SALES ----------------
  const salesApproved: any[] = await db`
    select id, invoice_number, status, exchange_rate::numeric rate,
           total_amount::numeric total, tax_amount::numeric tax
    from sales_invoices
    where status in ('approved','unpaid','partially_paid','paid','overdue')
    order by id`;
  for (const si of salesApproved) {
    const rate = Number(si.rate || 1);
    const aedTotal = r2(Number(si.total) * rate);
    const aedTax = r2(Number(si.tax) * rate);
    const aedRev = r2(aedTotal - aedTax);
    post("Accounts Receivable", aedTotal, 0); addRow();
    post("Sales Revenue", 0, aedRev); addRow();
    if (aedTax > 0.005) { post("VAT/GST Payable", 0, aedTax); addRow(); }
  }
  const salesCancelled: any[] = await db`
    select count(*)::int n, coalesce(sum(total_amount*exchange_rate),0)::numeric v
    from sales_invoices where status='cancelled'`;
  notes.push(
    `Cancelled sales invoices SKIPPED: ${salesCancelled[0].n} documents, ` +
      `${money(Number(salesCancelled[0].v))} AED — a cancelled invoice has no economic effect`,
  );

  // sales payments — credit-note settlements post no cash (D1)
  const salesPays: any[] = await db`
    select p.amount::numeric amount, si.exchange_rate::numeric rate, p.payment_type
    from invoice_payments p join sales_invoices si on si.id=p.invoice_id
    where si.status <> 'cancelled'`;
  let cnSettlements = 0;
  for (const p of salesPays) {
    if (p.payment_type === "credit_note") { cnSettlements++; continue; }
    const aed = r2(Number(p.amount) * Number(p.rate || 1));
    post("Cash/Bank", aed, 0); addRow();
    post("Accounts Receivable", 0, aed); addRow();
  }
  notes.push(`Sales credit-note settlements posting NO cash GL (D1): ${cnSettlements}`);

  // sales credit notes
  const cns: any[] = await db`
    select cn.total_amount::numeric total, cn.tax_amount::numeric tax,
           coalesce(cn.exchange_rate,1)::numeric rate
    from credit_notes cn where cn.status='issued'`;
  for (const cn of cns) {
    const rate = Number(cn.rate || 1);
    const aedTotal = r2(Number(cn.total || 0) * rate);
    const aedTax = r2(Number(cn.tax || 0) * rate);
    post("Sales Returns and Allowances", r2(aedTotal - aedTax), 0); addRow();
    if (aedTax > 0.005) { post("VAT/GST Payable", aedTax, 0); addRow(); }
    post("Accounts Receivable", 0, aedTotal); addRow();
  }

  // ---------------- PURCHASE ----------------
  const purchApproved: any[] = await db`
    select id, invoice_number, exchange_rate::numeric rate,
           total_amount::numeric total, tax_amount::numeric tax
    from purchase_invoices where status='approved' order by id`;
  for (const pi of purchApproved) {
    const rate = Number(pi.rate || 1);
    const aedTotal = r2(Number(pi.total) * rate);
    const aedTax = r2(Number(pi.tax) * rate);
    const aedExp = r2(aedTotal - aedTax);
    // expense splits per project, but account totals are unaffected by the split
    post("Purchase Expense", aedExp, 0); addRow();
    if (aedTax > 0.005) { post("VAT Recoverable", aedTax, 0); addRow(); }
    post("Accounts Payable", 0, aedTotal); addRow();
  }
  const purchCancelled: any[] = await db`
    select count(*)::int n from purchase_invoices where status='cancelled'`;
  notes.push(`Cancelled purchase invoices SKIPPED: ${purchCancelled[0].n}`);

  const purchPays: any[] = await db`
    select p.amount::numeric amount, pi.exchange_rate::numeric rate, p.payment_type
    from purchase_invoice_payments p join purchase_invoices pi on pi.id=p.invoice_id
    where pi.status='approved'`;
  let pcnSettlements = 0;
  for (const p of purchPays) {
    if (p.payment_type === "credit_note") { pcnSettlements++; continue; }
    const aed = r2(Number(p.amount) * Number(p.rate || 1));
    post("Accounts Payable", aed, 0); addRow();
    post("Cash/Bank", 0, aed); addRow();
  }
  notes.push(`Purchase credit-note settlements posting NO cash GL: ${pcnSettlements}`);

  const pcns: any[] = await db`
    select pcn.total_amount::numeric total, pcn.tax_amount::numeric tax,
           coalesce(pi.exchange_rate,1)::numeric rate
    from purchase_credit_notes pcn
    join purchase_invoices pi on pi.id=pcn.purchase_invoice_id
    where pcn.status='issued'`;
  for (const cn of pcns) {
    const rate = Number(cn.rate || 1);
    const aedTotal = r2(Number(cn.total || 0) * rate);
    const aedTax = r2(Number(cn.tax || 0) * rate);
    post("Accounts Payable", aedTotal, 0); addRow();
    post("Purchase Expense", 0, r2(aedTotal - aedTax)); addRow();
    if (aedTax > 0.005) { post("VAT Recoverable", 0, aedTax); addRow(); }
  }

  // ---------------- PAYROLL ----------------
  const payroll: any[] = await db`select count(*)::int n from payroll_entries`;
  notes.push(
    `Payroll entries available to rebuild from: ${payroll[0].n} ` +
      `(rebuild reads payroll_entries, so this stays correct once payroll is used)`,
  );

  // ---------------- COMPARE ----------------
  const current: any[] = await db`
    select account_name, sum(debit_amount)::numeric dr, sum(credit_amount)::numeric cr
    from general_ledger_entries group by account_name`;
  const cur = new Map<string, { dr: number; cr: number }>();
  for (const c of current) cur.set(c.account_name, { dr: Number(c.dr), cr: Number(c.cr) });

  const accounts = Array.from(new Set([...book.keys(), ...cur.keys()])).sort();
  console.log("\nPer-account NET balance (Dr positive). Delta = rebuilt − current:\n");
  console.log(
    "  " + "Account".padEnd(30) + "Current".padStart(15) + "Rebuilt".padStart(15) + "Delta".padStart(15),
  );
  console.log("  " + "-".repeat(75));
  let totalDrNew = 0, totalCrNew = 0;
  for (const a of accounts) {
    const b = book.get(a) || { dr: 0, cr: 0 };
    const c = cur.get(a) || { dr: 0, cr: 0 };
    const netNew = r2(b.dr - b.cr);
    const netCur = r2(c.dr - c.cr);
    const delta = r2(netNew - netCur);
    totalDrNew = r2(totalDrNew + b.dr);
    totalCrNew = r2(totalCrNew + b.cr);
    const flag = Math.abs(delta) > 0.005 ? "  <<<" : "";
    console.log(
      "  " + a.padEnd(30) + money(netCur).padStart(15) + money(netNew).padStart(15) +
        money(delta).padStart(15) + flag,
    );
  }

  const curTotals: any[] = await db`
    select count(*)::int n, sum(debit_amount)::numeric dr, sum(credit_amount)::numeric cr
    from general_ledger_entries`;
  console.log("\n  " + "-".repeat(75));
  console.log(`  Rows      current ${curTotals[0].n}   ->  rebuilt ${rowsWouldPost}   (${rowsWouldPost - curTotals[0].n >= 0 ? "+" : ""}${rowsWouldPost - curTotals[0].n})`);
  console.log(`  Debits    current ${money(Number(curTotals[0].dr))}   ->  rebuilt ${money(totalDrNew)}`);
  console.log(`  Credits   current ${money(Number(curTotals[0].cr))}   ->  rebuilt ${money(totalCrNew)}`);
  console.log(
    `  Rebuilt ledger balances: ${totalDrNew === totalCrNew ? "YES" : "*** NO — " + money(r2(totalDrNew - totalCrNew)) + " ***"}`,
  );

  console.log("\nNotes:");
  for (const n of notes) console.log("  • " + n);
  console.log("\n(dry run — no rows were created, deleted or modified)\n");

  await db.end();
}
main().catch(async (e) => { console.error("ERR", e); try { await db.end(); } catch {} process.exit(1); });
