-- Create account 6160 "Employee Reimbursement".
--
-- Migration 0063 carried this INSERT (see its comment block on the reimbursement
-- category -> account map), but it never reached the database: the account is
-- absent from chart_of_accounts, and absent from both chart snapshots the
-- ledger rebuild took on 2026-07-26, so it was never there to be removed.
--
-- Why this matters: reimbursements of category 'other' resolve to code 6160,
-- and postPayrollAccrual fell back to posting the literal name when the lookup
-- found nothing. Eight ledger rows are already outside the chart because of it.
-- The trial balance flags them ("not in chart of accounts"); the P&L inner-joins
-- the chart and drops them without a word, so the two reports disagree.
--
-- 0063 is already deployed and will not be re-run, hence a migration of its own
-- rather than a correction to it. Values are copied from 0063 verbatim so the
-- two cannot disagree about what the account is.
--
-- ON CONFLICT has no target on purpose. 0063 used ON CONFLICT (account_code),
-- but chart_of_accounts is UNIQUE on account_name as well — an untargeted
-- clause makes a collision on EITHER column a no-op instead of an error, so a
-- database that already has the account under any code applies this cleanly.
--
-- No correction to the eight existing ledger rows: they carry the exact name
-- inserted here, so they join the chart the moment this runs. They also net to
-- zero (500.00 Dr against 500.00 Cr — every one has been reversed), so no
-- report figure moves.

INSERT INTO chart_of_accounts
  (account_code, account_name, account_type, account_category, description, is_active)
VALUES
  ('6160', 'Employee Reimbursement', 'expense', 'operating_expenses',
   'Employee expense claims not falling under a specific expense category', true)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- VERIFICATION (run after applying)
-- ---------------------------------------------------------------------------
--   SELECT account_code, account_name, account_type, account_category, is_active
--   FROM chart_of_accounts WHERE account_code = '6160';
--   -- expect one row, is_active = true
--
--   -- every account posted to should now exist in the chart (expect 0 rows):
--   SELECT DISTINCT g.account_name
--   FROM general_ledger_entries g
--   WHERE NOT EXISTS (
--     SELECT 1 FROM chart_of_accounts c
--     WHERE lower(trim(c.account_name)) = lower(trim(g.account_name)));

-- ---------------------------------------------------------------------------
-- ROLLBACK (commented; this project applies migrations by hand)
-- ---------------------------------------------------------------------------
-- DELETE FROM chart_of_accounts WHERE account_code = '6160';
