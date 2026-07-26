-- P8 (0.6 completion) — name account 2120 "Provident Fund Contribution".
--
-- Phase 0 item 0.6 required 2120 to be "Provident Fund Contribution". Migration
-- 0062 implemented only half of it: its comment states the account "is named
-- Provident Fund Contribution" and it corrects only the DESCRIPTION. On any
-- database seeded before scripts/seed-chart-of-accounts.ts was updated, the
-- account_name is still the old "Tax Deducted at Source (TDS)".
--
-- The deduction is a provident fund, not withholding tax — `tdsAmount` was
-- renamed to `pfAmount` in the payroll code for the same reason (P2.2).
--
-- Why this matters beyond naming: postPayrollAccrual credits the literal string
-- "Provident Fund Contribution", so on those databases the payroll accrual posts
-- to an account that does not exist in the chart of accounts. Six such rows are
-- already in the ledger. That in turn blocks validating journal account names
-- against the chart (P8.5), because the check would reject payroll's own account.
--
-- Idempotent: matches on the old name, so re-running is a no-op.

UPDATE chart_of_accounts
SET account_name = 'Provident Fund Contribution'
WHERE account_code = '2120'
  AND account_name = 'Tax Deducted at Source (TDS)';

-- ---------------------------------------------------------------------------
-- VERIFICATION (run after applying)
-- ---------------------------------------------------------------------------
--   SELECT account_code, account_name, description
--   FROM chart_of_accounts WHERE account_code = '2120';
--   -- expect account_name = 'Provident Fund Contribution'
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
-- UPDATE chart_of_accounts
-- SET account_name = 'Tax Deducted at Source (TDS)'
-- WHERE account_code = '2120';
