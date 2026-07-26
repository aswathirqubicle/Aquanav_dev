/**
 * GL REBUILD (Phase 11).
 *
 * Deletes the general ledger and re-posts it from the documents that currently
 * exist, so the ledger reflects the corrected posting rules (VAT split, net-of-
 * discount revenue/expense, per-project purchase expense, no phantom cash on
 * credit-note settlements) rather than whatever historic bugs produced it.
 *
 * Payroll: the payroll sub-ledger is cleared too. Payroll GL cannot be rebuilt
 * from anything else, so leaving payroll_entries populated while deleting their
 * GL would leave the sub-ledger and the ledger permanently disagreeing.
 *
 *   npx tsx scripts/gl-rebuild.ts             -> DRY RUN, writes nothing
 *   npx tsx scripts/gl-rebuild.ts --execute   -> takes a backup, then rebuilds
 *
 * Documents NOT re-posted: cancelled invoices (a cancelled document has no
 * economic effect, so posting it and immediately reversing it only adds noise)
 * and drafts / pending-approval documents (not yet approved).
 */
import { sql as db } from "../server/db";

const EXECUTE = process.argv.includes("--execute");
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Row = {
  entryType: string; referenceType: string; referenceId: number | null;
  accountName: string; description: string; debit: number; credit: number;
  entityId: number | null; entityName: string | null; projectId: number | null;
  invoiceNumber: string | null; transactionDate: string; status: string;
};
const rows: Row[] = [];
const add = (r: Row) => { if (r.debit > 0.005 || r.credit > 0.005) rows.push(r); };

async function build() {
  // ---------------- SALES INVOICES ----------------
  const si: any[] = await db`
    select s.id, s.invoice_number, s.customer_id, s.project_id,
           s.invoice_date, s.due_date, coalesce(s.exchange_rate,1)::numeric rate,
           s.total_amount::numeric total, coalesce(s.tax_amount,0)::numeric tax,
           c.name customer_name
    from sales_invoices s left join customers c on c.id = s.customer_id
    where s.status in ('approved','unpaid','partially_paid','paid','overdue')
    order by s.id`;
  for (const v of si) {
    const rate = Number(v.rate);
    const gross = r2(Number(v.total) * rate);
    const tax = r2(Number(v.tax) * rate);
    const net = r2(gross - tax);
    const base = {
      entryType: "receivable", referenceType: "sales_invoice", referenceId: v.id,
      description: `Sales Invoice ${v.invoice_number} - ${v.customer_name || "Unknown Customer"}`,
      entityId: v.customer_id, entityName: v.customer_name,
      projectId: v.project_id, invoiceNumber: v.invoice_number,
      transactionDate: v.invoice_date, status: "pending",
    };
    add({ ...base, accountName: "Accounts Receivable", debit: gross, credit: 0 });
    add({ ...base, accountName: "Sales Revenue", debit: 0, credit: net });
    add({ ...base, accountName: "VAT/GST Payable", debit: 0, credit: tax });
  }

  // ---------------- SALES PAYMENTS (credit-note settlements post no cash) ----
  const sp: any[] = await db`
    select p.id, p.amount::numeric amount, p.payment_date, p.payment_type,
           s.id inv_id, s.invoice_number, s.customer_id, s.project_id,
           coalesce(s.exchange_rate,1)::numeric rate, c.name customer_name
    from invoice_payments p
    join sales_invoices s on s.id = p.invoice_id
    left join customers c on c.id = s.customer_id
    where s.status in ('approved','unpaid','partially_paid','paid','overdue')
      and coalesce(p.payment_type,'payment') <> 'credit_note'
    order by p.id`;
  for (const p of sp) {
    const aed = r2(Number(p.amount) * Number(p.rate));
    const base = {
      entryType: "receivable", referenceType: "payment", referenceId: p.id,
      description: `Payment received for Invoice: ${p.invoice_number}`,
      entityId: p.customer_id, entityName: p.customer_name,
      projectId: p.project_id, invoiceNumber: p.invoice_number,
      transactionDate: p.payment_date, status: "paid",
    };
    add({ ...base, accountName: "Cash/Bank", debit: aed, credit: 0 });
    add({ ...base, accountName: "Accounts Receivable", debit: 0, credit: aed });
  }

  // ---------------- SALES CREDIT NOTES ----------------
  const cn: any[] = await db`
    select n.id, n.credit_note_number, n.customer_id, n.sales_invoice_id,
           n.credit_note_date, coalesce(n.exchange_rate,1)::numeric rate,
           coalesce(n.total_amount,0)::numeric total, coalesce(n.tax_amount,0)::numeric tax,
           s.invoice_number, s.project_id, c.name customer_name
    from credit_notes n
    left join sales_invoices s on s.id = n.sales_invoice_id
    left join customers c on c.id = n.customer_id
    where n.status = 'issued' order by n.id`;
  for (const v of cn) {
    const rate = Number(v.rate);
    const gross = r2(Number(v.total) * rate);
    const tax = r2(Number(v.tax) * rate);
    const base = {
      entryType: "receivable", referenceType: "credit_note", referenceId: v.id,
      description: `Credit Note: ${v.credit_note_number} for Invoice: ${v.invoice_number || "N/A"}`,
      entityId: v.customer_id, entityName: v.customer_name,
      projectId: v.project_id, invoiceNumber: v.invoice_number,
      transactionDate: v.credit_note_date, status: "issued",
    };
    add({ ...base, accountName: "Sales Returns and Allowances", debit: r2(gross - tax), credit: 0 });
    add({ ...base, accountName: "VAT/GST Payable", debit: tax, credit: 0 });
    add({ ...base, accountName: "Accounts Receivable", debit: 0, credit: gross });
  }

  // ---------------- PURCHASE INVOICES (expense split per line project) -------
  const pi: any[] = await db`
    select p.id, p.invoice_number, p.supplier_id, p.invoice_date, p.due_date,
           coalesce(p.exchange_rate,1)::numeric rate,
           p.total_amount::numeric total, coalesce(p.tax_amount,0)::numeric tax,
           s.name supplier_name
    from purchase_invoices p left join suppliers s on s.id = p.supplier_id
    where p.status = 'approved' order by p.id`;
  for (const v of pi) {
    const rate = Number(v.rate);
    const gross = r2(Number(v.total) * rate);
    const tax = r2(Number(v.tax) * rate);
    const expense = r2(gross - tax);
    const base = {
      entryType: "payable", referenceType: "purchase_invoice", referenceId: v.id,
      description: `Purchase Invoice ${v.invoice_number} - ${v.supplier_name || "Unknown Supplier"}`,
      entityId: v.supplier_id, entityName: v.supplier_name,
      invoiceNumber: v.invoice_number, transactionDate: v.invoice_date, status: "pending",
    };
    // weight the expense by each line's net-of-VAT amount, grouped by project
    const items: any[] = await db`
      select project_id, sum(line_total::numeric - coalesce(tax_amount,0)::numeric) net
      from purchase_invoice_items where invoice_id = ${v.id} group by project_id`;
    const weights = items.map((i) => Math.max(0, Number(i.net)));
    const totalW = weights.reduce((s, w) => s + w, 0);
    if (totalW > 0) {
      let allocated = 0;
      items.forEach((it, idx) => {
        const isLast = idx === items.length - 1;
        const share = isLast ? r2(expense - allocated) : r2((expense * weights[idx]) / totalW);
        allocated = r2(allocated + share);
        add({ ...base, accountName: "Purchase Expense", debit: share, credit: 0,
              projectId: it.project_id });
      });
    } else {
      add({ ...base, accountName: "Purchase Expense", debit: expense, credit: 0, projectId: null });
    }
    add({ ...base, accountName: "VAT Recoverable", debit: tax, credit: 0, projectId: null });
    add({ ...base, accountName: "Accounts Payable", debit: 0, credit: gross, projectId: null });
  }

  // ---------------- PURCHASE PAYMENTS ----------------
  const pp: any[] = await db`
    select p.id, p.amount::numeric amount, p.payment_date, p.payment_type,
           i.invoice_number, i.supplier_id, coalesce(i.exchange_rate,1)::numeric rate,
           s.name supplier_name
    from purchase_invoice_payments p
    join purchase_invoices i on i.id = p.invoice_id
    left join suppliers s on s.id = i.supplier_id
    where i.status = 'approved' and coalesce(p.payment_type,'payment') <> 'credit_note'
    order by p.id`;
  for (const p of pp) {
    const aed = r2(Number(p.amount) * Number(p.rate));
    const base = {
      entryType: "payable", referenceType: "payment", referenceId: p.id,
      description: `Payment for Purchase Invoice ${p.invoice_number}`,
      entityId: p.supplier_id, entityName: p.supplier_name, projectId: null,
      invoiceNumber: p.invoice_number, transactionDate: p.payment_date, status: "paid",
    };
    add({ ...base, accountName: "Accounts Payable", debit: aed, credit: 0 });
    add({ ...base, accountName: "Cash/Bank", debit: 0, credit: aed });
  }

  // ---------------- PURCHASE CREDIT NOTES ----------------
  const pcn: any[] = await db`
    select n.id, n.credit_note_number, n.supplier_id, n.credit_note_date,
           coalesce(n.total_amount,0)::numeric total, coalesce(n.tax_amount,0)::numeric tax,
           coalesce(i.exchange_rate,1)::numeric rate, i.invoice_number, s.name supplier_name
    from purchase_credit_notes n
    join purchase_invoices i on i.id = n.purchase_invoice_id
    left join suppliers s on s.id = n.supplier_id
    where n.status = 'issued' and i.status = 'approved' order by n.id`;
  for (const v of pcn) {
    const rate = Number(v.rate);
    const gross = r2(Number(v.total) * rate);
    const tax = r2(Number(v.tax) * rate);
    const base = {
      entryType: "payable", referenceType: "purchase_credit_note", referenceId: v.id,
      description: `Purchase Credit Note ${v.credit_note_number} for Invoice ${v.invoice_number}`,
      entityId: v.supplier_id, entityName: v.supplier_name, projectId: null,
      invoiceNumber: v.invoice_number, transactionDate: v.credit_note_date, status: "issued",
    };
    add({ ...base, accountName: "Accounts Payable", debit: gross, credit: 0 });
    add({ ...base, accountName: "Purchase Expense", debit: 0, credit: r2(gross - tax) });
    add({ ...base, accountName: "VAT Recoverable", debit: 0, credit: tax });
  }

  // ---------------- PAYROLL ----------------
  // Cleared, not rebuilt — see the header note.
}

async function main() {
  console.log(`\n════════ GL REBUILD ${EXECUTE ? "— EXECUTING" : "— DRY RUN (no writes)"} ════════`);
  await build();

  const dr = r2(rows.reduce((s, r) => s + r.debit, 0));
  const cr = r2(rows.reduce((s, r) => s + r.credit, 0));
  console.log(`\nComputed ${rows.length} rows.  Dr ${money(dr)}  Cr ${money(cr)}  ${dr === cr ? "BALANCED" : "*** OUT OF BALANCE ***"}`);
  if (dr !== cr) { console.log("Refusing to write an unbalanced ledger."); await db.end(); process.exit(1); }

  if (!EXECUTE) {
    console.log("\nDry run — pass --execute to apply.\n");
    await db.end();
    return;
  }

  const stamp = "rebuild_" + new Date(2026, 6, 26).toISOString().slice(0, 10).replace(/-/g, "");
  console.log(`\nBacking up to gl_backup_${stamp} / payroll_backup_${stamp} ...`);
  await db.unsafe(`drop table if exists gl_backup_${stamp}`);
  await db.unsafe(`create table gl_backup_${stamp} as select * from general_ledger_entries`);
  await db.unsafe(`drop table if exists payroll_backup_${stamp}`);
  await db.unsafe(`create table payroll_backup_${stamp} as select * from payroll_entries`);

  console.log("Clearing payroll sub-ledger and general ledger ...");
  await db`delete from payroll_deductions`;
  await db`delete from payroll_additions`;
  await db`delete from payroll_entries`;
  await db`delete from general_ledger_entries`;

  console.log(`Posting ${rows.length} rows ...`);
  for (const r of rows) {
    await db`
      insert into general_ledger_entries
        (entry_type, reference_type, reference_id, account_name, description,
         debit_amount, credit_amount, entity_id, entity_name, project_id,
         invoice_number, transaction_date, status)
      values (${r.entryType}, ${r.referenceType}, ${r.referenceId}, ${r.accountName},
              ${r.description}, ${r.debit.toFixed(2)}, ${r.credit.toFixed(2)},
              ${r.entityId}, ${r.entityName}, ${r.projectId},
              ${r.invoiceNumber}, ${r.transactionDate}, ${r.status})`;
  }
  console.log("Done.\n");
  await db.end();
}
main().catch(async (e) => { console.error("ERR", e); try { await db.end(); } catch {} process.exit(1); });
