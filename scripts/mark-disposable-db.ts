/**
 * Marks the current database as DISPOSABLE — safe for destructive tests.
 *
 * WHY THIS EXISTS
 * The destructive integration suites truncate real tables. The original gate
 * allowed them whenever DATABASE_URL resolved to localhost, reasoning that a
 * local database is throwaway. That reasoning breaks the moment a UAT dump is
 * restored locally: the copy sits on localhost, passes the host check, and
 * `npm run test:integration` would wipe a replica of real client data.
 *
 * So "local" is no longer sufficient. A database must ALSO carry an explicit
 * marker, created only by running this script and typing a confirmation.
 *
 * A restore drops the marker along with everything else, which is the point:
 * after restoring a UAT copy the gate blocks until a human deliberately
 * re-marks the database as disposable.
 *
 *   npx tsx scripts/mark-disposable-db.ts
 */
import * as dotenv from "dotenv";
dotenv.config();

import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "0.0.0.0"];
const CONFIRMATION = "WIPE THIS DATABASE";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const parsed = new URL(url);
  const host = parsed.hostname;
  const dbName = parsed.pathname.replace(/^\//, "");

  if (!LOCAL_HOSTS.includes(host)) {
    console.error(
      `REFUSING: host is "${host}", not local. A non-local database can ` +
        `never be marked disposable.`,
    );
    process.exit(1);
  }

  const { db } = await import("../server/db");
  const { sql } = await import("drizzle-orm");

  // Report what is actually in there, so the decision is informed rather than
  // reflexive. Restoring a UAT dump and then marking it disposable by habit is
  // exactly the mistake this is meant to prevent.
  const [counts] = (await db.execute(sql`
    select
      (select count(*) from general_ledger_entries) as gl,
      (select count(*) from sales_invoices)         as invoices,
      (select count(*) from payroll_entries)        as payroll,
      (select count(*) from customers)              as customers
  `)) as any;

  console.log(`\n  database : ${dbName} on ${host}`);
  console.log(`  contains : ${counts.gl} ledger entries · ${counts.invoices} sales invoices`);
  console.log(`             ${counts.payroll} payroll entries · ${counts.customers} customers`);
  console.log(
    `\n  Marking it disposable permits \`npm run test:integration\` to\n` +
      `  DELETE ALL ROWS from the ledger, payroll, project, employee and\n` +
      `  inventory tables.\n`,
  );
  console.log(`  Do NOT do this to a restored copy of UAT data.\n`);

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(`  Type "${CONFIRMATION}" to confirm: `);
  rl.close();

  if (answer.trim() !== CONFIRMATION) {
    console.error("\n  Not confirmed. Nothing changed.");
    process.exit(1);
  }

  await db.execute(sql`
    create table if not exists _ledger_fixture_marker (
      id            integer primary key default 1,
      marked_at     timestamptz not null default now(),
      database_name text        not null,
      note          text
    )
  `);
  await db.execute(sql`
    insert into _ledger_fixture_marker (id, database_name, note)
    values (1, ${dbName}, 'Disposable fixture database. Destructive tests permitted.')
    on conflict (id) do update
      set marked_at = now(), database_name = excluded.database_name
  `);

  console.log(`\n  "${dbName}" marked disposable. Destructive tests are now permitted.\n`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Failed:", e?.message || e);
  process.exit(1);
});
