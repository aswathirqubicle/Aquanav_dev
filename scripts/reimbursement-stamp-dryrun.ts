/**
 * Reimbursement payroll-stamp backfill — DRY RUN. WRITES NOTHING.
 *
 * Approval used to predict which payroll would carry a claim, stamping
 * payroll_month/payroll_year off a 20th-of-month cutoff. Generation then looked
 * for an exact match on that stamp, so a claim could be stranded two ways:
 *
 *   Tier 1  stamped a period whose payroll was never generated. Approved after
 *           the 20th, it skipped a payroll that had not run yet, and nothing
 *           ever came back for it.
 *   Tier 2  stamped a period whose payroll WAS generated, but the claim was not
 *           in it — approved before the 20th, after that month was generated.
 *           This is the silent one: the UI shows a period, the money never came.
 *
 * The stamp is now written by generateMonthlyPayroll when a claim actually
 * lands on a payslip, and `payroll_month IS NULL` means "awaiting the next
 * payroll run". Both tiers above therefore need their stale stamp cleared or
 * generation will never see them again.
 *
 * Tier 1 is decided by the absence of any payroll entry for the period.
 * Tier 2 has no FK to lean on — the only link is the addition row generation
 * writes, so it is matched on payroll entry + amount + the truncated
 * "Reimbursement: <first 50 chars>" description that generation produces.
 * That match is reported separately, and per row, precisely because it is
 * inferred rather than guaranteed. Read it before trusting it.
 *
 * Run:  npx tsx scripts/reimbursement-stamp-dryrun.ts
 */
import { sql as db } from "../server/db";

const money = (n: number) =>
  Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const period = (m: number | null, y: number | null) =>
  m && y ? `${MONTHS[m - 1]} ${y}` : "—";

async function main() {
  console.log("\n════════ REIMBURSEMENT STAMP BACKFILL — DRY RUN (nothing is written) ════════\n");

  const stamped: any[] = await db`
    select r.id, r.employee_id, r.amount::numeric amount, r.description,
           r.payroll_month, r.payroll_year, r.approval_timestamp,
           coalesce(concat(e.first_name, ' ', e.last_name), 'Unknown') employee_name
    from reimbursements r
    left join employees e on e.id = r.employee_id
    where r.status = 'approved'
      and r.payroll_month is not null
      and r.payroll_year is not null
    order by r.payroll_year, r.payroll_month, r.id`;

  console.log(`Approved reimbursements carrying a stamp: ${stamped.length}\n`);

  const tier1: any[] = [];
  const tier2: any[] = [];
  const applied: any[] = [];
  const noTimestamp: any[] = [];

  for (const r of stamped) {
    if (!r.approval_timestamp) noTimestamp.push(r);

    // Did the stamped period actually get generated for this employee?
    const entries: any[] = await db`
      select id from payroll_entries
      where employee_id = ${r.employee_id}
        and month = ${r.payroll_month}
        and year = ${r.payroll_year}`;

    if (entries.length === 0) {
      tier1.push(r);
      continue;
    }

    // The period ran. Did an addition row for this claim land on it? Generation
    // writes `Reimbursement: ${description.substring(0,50)}` at the claim amount.
    const expected = `Reimbursement: ${String(r.description || "").substring(0, 50) || "Expense claim"}`;
    const ids = entries.map((e: any) => e.id);
    const hits: any[] = await db`
      select id from payroll_additions
      where payroll_entry_id = any(${ids})
        and type = 'reimbursement'
        and description = ${expected}
        and amount::numeric = ${r.amount}::numeric`;

    if (hits.length > 0) applied.push(r);
    else tier2.push(r);
  }

  const show = (label: string, rows: any[], verdict: string) => {
    console.log("─".repeat(78));
    console.log(`${label}: ${rows.length} row(s)`);
    console.log(`  → ${verdict}`);
    if (rows.length > 0) {
      console.log(
        "\n  " + "id".padStart(5) + "  " + "employee".padEnd(24) +
          "amount".padStart(12) + "  " + "stamped".padEnd(10) + "approved",
      );
      for (const r of rows) {
        console.log(
          "  " + String(r.id).padStart(5) + "  " +
            String(r.employee_name).substring(0, 23).padEnd(24) +
            money(r.amount).padStart(12) + "  " +
            period(r.payroll_month, r.payroll_year).padEnd(10) +
            (r.approval_timestamp
              ? new Date(r.approval_timestamp).toISOString().slice(0, 10)
              : "*** NULL ***"),
        );
      }
      const total = rows.reduce((s, r) => s + Number(r.amount), 0);
      console.log("  " + " ".repeat(31) + money(total).padStart(12) + "  (total)");
    }
    console.log("");
  };

  show(
    "TIER 1 — stamped period was never generated",
    tier1,
    "CLEAR the stamp. Unambiguous: no payslip exists for that period at all.",
  );
  show(
    "TIER 2 — period was generated, but no matching addition row (inferred)",
    tier2,
    "CLEAR the stamp — but verify these by hand first; the match is by description + amount, not a key.",
  );
  show(
    "ALREADY APPLIED — addition row found on a real payslip",
    applied,
    "LEAVE ALONE. These were genuinely paid; the stamp is now a truthful record.",
  );

  if (noTimestamp.length > 0) {
    console.log("─".repeat(78));
    console.log(`*** WARNING: ${noTimestamp.length} approved row(s) have a NULL approval_timestamp.`);
    console.log("    Generation now filters on approval_timestamp, and NULL fails that");
    console.log("    comparison — these would never be picked up even after clearing the");
    console.log("    stamp. The migration must also give them a timestamp (submission date");
    console.log("    is the sensible fallback). Ids: " + noTimestamp.map((r) => r.id).join(", "));
    console.log("");
  }

  const toClear = [...tier1, ...tier2];
  console.log("═".repeat(78));
  console.log(`SUMMARY  clear ${toClear.length} stamp(s), leave ${applied.length} alone`);
  console.log(`         value returned to the next payroll run: ${money(toClear.reduce((s, r) => s + Number(r.amount), 0))}`);
  if (toClear.length > 0) {
    console.log("\nMigration SQL this implies (review before anyone runs it):\n");
    console.log("  update reimbursements set payroll_month = null, payroll_year = null");
    console.log("  where id in (" + toClear.map((r) => r.id).join(", ") + ");");
  }
  console.log("\n(dry run — no rows were created, deleted or modified)\n");

  await db.end();
}
main().catch(async (e) => {
  console.error("ERR", e);
  try {
    await db.end();
  } catch {}
  process.exit(1);
});
