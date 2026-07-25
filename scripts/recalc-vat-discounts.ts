/**
 * P4b — recompute VAT on the DISCOUNTED base for existing discounted documents.
 *
 * Documents saved before the P4b fix charged VAT on the pre-discount amount.
 * This script recomputes every discounted document through the shared
 * document-totals engine (VAT on the discounted base, per UAE VAT law), prints
 * exactly what would change, and — only when you pass --apply — writes the
 * corrected subtotal / discount / taxAmount / totalAmount (and each line's
 * taxAmount / lineTotal) back.
 *
 * DRY RUN by default: nothing is written unless you pass --apply.
 * Safe to re-run: documents already on the correct basis show no change.
 *
 * Usage (run from a checkout that has the source + tsx; point DATABASE_URL at
 * the target database — e.g. UAT):
 *
 *   DATABASE_URL=postgres://...  npx tsx scripts/recalc-vat-discounts.ts           # report only
 *   DATABASE_URL=postgres://...  npx tsx scripts/recalc-vat-discounts.ts --apply   # apply the fix
 *
 * Scope (in-scope P4b documents that carry both a discount and VAT):
 *   sales_quotations, sales_invoices, credit_notes, proforma_invoices  (items in a JSON column)
 *   purchase_orders, purchase_invoices                                 (items in child tables)
 * Purchase requests are excluded by design (budget estimates, not tax documents).
 */
import { sql as db } from "../server/db";
import {
  computeDocumentTotals,
  type LineItemInput,
  type HeaderDiscountInput,
} from "../shared/document-totals";

const APPLY = process.argv.includes("--apply");

const num = (v: any) => parseFloat(v ?? "0") || 0;
const differs = (a: number, b: number) => Math.abs(a - b) > 0.005;
const money = (n: number) => n.toFixed(2);

/** Header discount input for the engine: percentage wins, else the stored amount. */
function headerInput(discountPercentage: any, headerAmount: any): HeaderDiscountInput {
  const pct = num(discountPercentage);
  return pct > 0
    ? { discount: pct, discountType: "percentage" }
    : { discount: num(headerAmount), discountType: "amount" };
}

function lineInputs(items: any[]): LineItemInput[] {
  return (items || []).map((it) => ({
    quantity: Number(it.quantity ?? it.qty) || 0,
    unitPrice: Number(it.unitPrice ?? it.unit_price) || 0,
    taxRate: Number(it.taxRate ?? it.tax_rate) || 0,
    discount: Number(it.discount) || 0,
    discountType:
      (it.discountType ?? it.discount_type) === "percentage" ? "percentage" : "amount",
  }));
}

/** Credit notes store items as a JSON string (sometimes double-encoded); unwrap robustly. */
function parseItems(raw: any): { items: any[]; wasString: boolean } {
  let v: any = raw;
  let wasString = false;
  for (let i = 0; i < 3 && typeof v === "string"; i++) {
    wasString = true;
    try {
      v = JSON.parse(v);
    } catch {
      break;
    }
  }
  return { items: Array.isArray(v) ? v : [], wasString };
}

let scanned = 0;
let changed = 0;

// ---------------------------------------------------------------------------
// Sales-style documents — items live in a JSON column on the row.
//   headerAmountCol is the resolved-amount column ("discount").
// ---------------------------------------------------------------------------
async function recalcSalesTable(table: string, numberCol: string) {
  const rows: any[] = await db`
    select id, ${db(numberCol)} as docnumber, items, subtotal, discount,
           discount_percentage, tax_amount, total_amount
    from ${db(table)}
    where coalesce(discount::numeric, 0) > 0
       or coalesce(discount_percentage::numeric, 0) > 0
    order by id`;

  console.log(`\n=== ${table} (${rows.length} discounted) ===`);
  for (const row of rows) {
    scanned++;
    const { items, wasString } = parseItems(row.items);
    if (items.length === 0) continue;

    const totals = computeDocumentTotals(
      lineInputs(items),
      headerInput(row.discount_percentage, row.discount),
    );

    const changes: string[] = [];
    if (differs(totals.gross, num(row.subtotal)))
      changes.push(`subtotal ${money(num(row.subtotal))} -> ${money(totals.gross)}`);
    if (differs(totals.headerDiscount, num(row.discount)))
      changes.push(`discount ${money(num(row.discount))} -> ${money(totals.headerDiscount)}`);
    if (differs(totals.taxTotal, num(row.tax_amount)))
      changes.push(`tax ${money(num(row.tax_amount))} -> ${money(totals.taxTotal)}`);
    if (differs(totals.total, num(row.total_amount)))
      changes.push(`total ${money(num(row.total_amount))} -> ${money(totals.total)}`);

    if (changes.length === 0) continue;
    changed++;
    console.log(`  ${row.docnumber}: ${changes.join(" | ")}`);

    if (APPLY) {
      const itemsOut = items.map((it, i) => ({
        ...it,
        taxAmount: totals.lines[i].taxAmount,
        lineTotal: totals.lines[i].lineTotal,
      }));
      const itemsValue: any = wasString ? JSON.stringify(itemsOut) : db.json(itemsOut);
      await db`
        update ${db(table)} set
          items = ${itemsValue},
          subtotal = ${money(totals.gross)},
          discount = ${money(totals.headerDiscount)},
          tax_amount = ${money(totals.taxTotal)},
          total_amount = ${money(totals.total)}
        where id = ${row.id}`;
    }
  }
}

// ---------------------------------------------------------------------------
// Purchase-style documents — items live in a child table.
//   headerAmountCol is "discount_amount".
// ---------------------------------------------------------------------------
async function recalcPurchaseTable(
  table: string,
  numberCol: string,
  itemsTable: string,
  fkCol: string,
) {
  const rows: any[] = await db`
    select id, ${db(numberCol)} as docnumber, subtotal, discount_amount,
           discount_percentage, tax_amount, total_amount
    from ${db(table)}
    where coalesce(discount_amount::numeric, 0) > 0
       or coalesce(discount_percentage::numeric, 0) > 0
    order by id`;

  console.log(`\n=== ${table} (${rows.length} discounted) ===`);
  for (const row of rows) {
    scanned++;
    const items: any[] = await db`
      select id, quantity, unit_price, tax_rate, discount, discount_type,
             tax_amount, line_total
      from ${db(itemsTable)}
      where ${db(fkCol)} = ${row.id}
      order by id`;
    if (items.length === 0) continue;

    const totals = computeDocumentTotals(
      lineInputs(items),
      headerInput(row.discount_percentage, row.discount_amount),
    );

    const changes: string[] = [];
    if (differs(totals.gross, num(row.subtotal)))
      changes.push(`subtotal ${money(num(row.subtotal))} -> ${money(totals.gross)}`);
    if (differs(totals.headerDiscount, num(row.discount_amount)))
      changes.push(`discount ${money(num(row.discount_amount))} -> ${money(totals.headerDiscount)}`);
    if (differs(totals.taxTotal, num(row.tax_amount)))
      changes.push(`tax ${money(num(row.tax_amount))} -> ${money(totals.taxTotal)}`);
    if (differs(totals.total, num(row.total_amount)))
      changes.push(`total ${money(num(row.total_amount))} -> ${money(totals.total)}`);

    if (changes.length === 0) continue;
    changed++;
    console.log(`  ${row.docnumber}: ${changes.join(" | ")}`);

    if (APPLY) {
      for (let i = 0; i < items.length; i++) {
        await db`
          update ${db(itemsTable)} set
            tax_amount = ${money(totals.lines[i].taxAmount)},
            line_total = ${money(totals.lines[i].lineTotal)}
          where id = ${items[i].id}`;
      }
      await db`
        update ${db(table)} set
          subtotal = ${money(totals.gross)},
          discount_amount = ${money(totals.headerDiscount)},
          tax_amount = ${money(totals.taxTotal)},
          total_amount = ${money(totals.total)}
        where id = ${row.id}`;
    }
  }
}

async function main() {
  console.log(
    APPLY
      ? "*** APPLY MODE — the corrected values WILL be written ***"
      : "DRY RUN — no changes will be written (pass --apply to write).",
  );

  await recalcSalesTable("sales_quotations", "quotation_number");
  await recalcSalesTable("sales_invoices", "invoice_number");
  await recalcSalesTable("credit_notes", "credit_note_number");
  await recalcSalesTable("proforma_invoices", "proforma_number");
  await recalcPurchaseTable("purchase_orders", "po_number", "purchase_order_items", "po_id");
  await recalcPurchaseTable("purchase_invoices", "invoice_number", "purchase_invoice_items", "invoice_id");

  console.log(
    `\nSummary: ${changed} of ${scanned} discounted documents ` +
      (APPLY ? "updated." : "would change. Re-run with --apply to write them."),
  );
  await db.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("Error:", err);
  try {
    await db.end();
  } catch {}
  process.exit(1);
});
