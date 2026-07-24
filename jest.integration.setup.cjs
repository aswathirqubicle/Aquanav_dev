/**
 * Safety gate for the destructive integration tests.
 *
 * Both integration test files truncate real tables with unfiltered DELETEs:
 *   storage.payroll.integration.test.ts  -> general_ledger_entries, payroll_*,
 *                                           project_employees, projects, employees
 *   storage.goods_receipt.test.ts        -> inventory_transactions, inventory_items
 *
 * Run against the wrong DATABASE_URL, that destroys the general ledger and
 * master data. This gate runs once before any test file loads and aborts the
 * entire run unless ALL THREE conditions hold:
 *
 *   1. ALLOW_DESTRUCTIVE_TESTS=1 is set explicitly,
 *   2. DATABASE_URL points at a host on this machine, and
 *   3. the database carries the _ledger_fixture_marker table.
 *
 * Condition 3 was added when a full UAT data copy was brought local. "Local"
 * alone stopped being sufficient at that moment: a restored UAT database sits
 * on localhost, passes the host check, and would be wiped. A restore drops the
 * marker along with everything else, so after restoring a copy the gate blocks
 * until a human deliberately re-marks the database via
 * `npx tsx scripts/mark-disposable-db.ts`.
 *
 * Written as .cjs so it needs no transform and cannot itself fail to load.
 */
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];

module.exports = async () => {
  require('dotenv').config();

  const fail = (reason, detail) => {
    throw new Error(
      `\n\nREFUSING TO RUN DESTRUCTIVE INTEGRATION TESTS\n` +
      `  Reason: ${reason}\n` +
      (detail ? `  ${detail}\n` : '') +
      `\nThese tests DELETE ALL ROWS from general_ledger_entries, payroll,\n` +
      `projects, employees and inventory tables. They are only safe against a\n` +
      `disposable local database.\n\n` +
      `To run them deliberately:\n` +
      `  ALLOW_DESTRUCTIVE_TESTS=1 npm run test:integration\n\n`
    );
  };

  if (process.env.ALLOW_DESTRUCTIVE_TESTS !== '1') {
    fail('ALLOW_DESTRUCTIVE_TESTS is not set to 1');
  }

  const url = process.env.DATABASE_URL;
  if (!url) fail('DATABASE_URL is not set');

  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    fail('DATABASE_URL is not a parseable URL');
  }

  if (!LOCAL_HOSTS.includes(host)) {
    fail(
      `DATABASE_URL points at a non-local host`,
      `Host is "${host}". Refusing in case this is UAT or production.`
    );
  }

  // Condition 3 — the database must be explicitly marked disposable.
  // A restored UAT copy is local but NOT marked, so this is what stops it
  // being wiped.
  const postgres = require('postgres');
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  let marked = false;
  let dbName = '(unknown)';
  try {
    const rows = await sql`
      select database_name, marked_at
        from _ledger_fixture_marker
       limit 1
    `;
    marked = rows.length > 0;
    if (marked) dbName = rows[0].database_name;
  } catch {
    marked = false; // table absent -> not marked
  } finally {
    await sql.end();
  }

  if (!marked) {
    fail(
      `this database is not marked disposable`,
      `No _ledger_fixture_marker table found. If you have just restored a UAT\n` +
      `  copy, that is exactly why this is blocked — the restore dropped the\n` +
      `  marker. Mark it deliberately only if the data is genuinely throwaway:\n` +
      `      npx tsx scripts/mark-disposable-db.ts`
    );
  }

  console.warn(
    `\n[integration] Destructive tests enabled against "${dbName}" on "${host}".\n` +
    `[integration] Marked disposable. All rows in the ledger, payroll, project,\n` +
    `[integration] employee and inventory tables will be deleted.\n`
  );
};
