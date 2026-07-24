-- Phase 0 of the ledger remediation programme (see LEDGER-FIX-PLAN.md).
--
-- The chart of accounts is FIXED: no per-entity accounts for customers,
-- suppliers or employees. Per-entity receivables and payables are tracked from
-- invoice and payment records instead.
--
-- IMPORTANT: no account is RENAMED by this migration. general_ledger_entries
-- references accounts by NAME with no foreign key, and the P&L query
-- inner-joins on that name, so renaming an account would silently drop every
-- affected row from the P&L. Only additions, removals and deactivations here.

-- 0.1 / 0.2 / 0.7 - accounts required by the corrected postings
--   1030 Cash/Bank       every cash movement already posts to this name (L6)
--   1130 VAT Recoverable input VAT; 2220 VAT/GST Payable is output-only (D5)
--   6125 Accommodation   reimbursement category (D16)
INSERT INTO chart_of_accounts
  (account_code, account_name, account_type, account_category, description, is_active)
VALUES
  ('1030', 'Cash/Bank', 'asset', 'current_assets',
   'Combined cash and bank account used by all cash postings', true),
  ('1130', 'VAT Recoverable', 'asset', 'current_assets',
   'Input VAT recoverable from the Federal Tax Authority', true),
  ('6125', 'Accommodation', 'expense', 'operating_expenses',
   'Employee accommodation costs', true)
ON CONFLICT (account_code) DO NOTHING;

-- 0.4 - remove the per-entity sub-accounts created by 0041's backfill.
-- Defensive: detach any row whose parent is about to be deleted. 0041 parented
-- its sub-accounts to the control accounts (1100/2000/4000/5000), not to the
-- templates, so this should affect nothing - it guards against manual edits.
UPDATE chart_of_accounts SET parent_account_id = NULL
WHERE parent_account_id IN (
  SELECT id FROM chart_of_accounts
  WHERE account_code LIKE '1100-C%'
     OR account_code LIKE '2000-S%'
     OR account_code LIKE '4000-P%'
     OR account_code LIKE '5000-P%'
);

DELETE FROM chart_of_accounts
WHERE account_code LIKE '1100-C-%'
   OR account_code LIKE '2000-S-%'
   OR account_code LIKE '4000-P-%'
   OR account_code LIKE '5000-P-%';

-- 0.3 - remove the four template accounts. They are selectable in the account
-- picker today, so a user could post to "Customer Receivables Template".
DELETE FROM chart_of_accounts
WHERE account_code IN ('1100-C', '2000-S', '4000-P', '5000-P');

-- 0.5 - deactivate duplicates rather than deleting them, so any existing
-- reference stays valid while they disappear from the account picker
-- (getChartOfAccounts filters on is_active).
--   1110 Customer Receivables      duplicates 1100 Accounts Receivable
--   2010 Supplier Payables         duplicates 2000 Accounts Payable
--   1000 / 1010 / 1020             superseded by 1030 Cash/Bank
UPDATE chart_of_accounts SET is_active = false
WHERE account_code IN ('1110', '2010', '1000', '1010', '1020');

-- 0.5b - deactivate any SUB-ACCOUNT of a retired account too. Found on the
-- local database: '1020-1 Bank Account 1' and '1020-2 Bank Account 2' are
-- children of 1020 and are not in the seed script, so something created them
-- outside it. Without this they stay selectable in the account picker while
-- their parent is retired - an inconsistency that becomes a real mis-posting
-- risk once the journal form (P8) lets users choose accounts freely.
-- Written against parent_account_id rather than hardcoded codes, because
-- UAT may hold sub-accounts this local database does not.
UPDATE chart_of_accounts SET is_active = false
WHERE parent_account_id IN (
  SELECT id FROM chart_of_accounts
  WHERE account_code IN ('1110', '2010', '1000', '1010', '1020')
);

-- 0.6 - 2120 is named "Provident Fund Contribution" but was described as
-- withholding tax, which is what made the deduction read as TDS on audit.
UPDATE chart_of_accounts
SET description = 'Employee provident fund contributions withheld, held until the employee leaves'
WHERE account_code = '2120';

-- 0.9 - widen entry_type so a balanced manual journal can be posted. Neither
-- 'payable' nor 'receivable' fits a general journal such as a provident fund
-- payout (Dr 2120 / Cr Cash/Bank). Without this the journal form has no valid
-- value to send and every manual entry fails (L16).
ALTER TABLE general_ledger_entries
  DROP CONSTRAINT IF EXISTS general_ledger_entries_entry_type_check;
ALTER TABLE general_ledger_entries
  ADD CONSTRAINT general_ledger_entries_entry_type_check
  CHECK (entry_type = ANY (ARRAY['payable'::text, 'receivable'::text, 'manual'::text]));

-- 0.11 - drop the 0041 per-entity account functions. They are never called from
-- application code, but any invocation would recreate the sub-accounts that the
-- fixed-chart decision rejected.
DROP FUNCTION IF EXISTS create_project_accounts(INTEGER, TEXT);
DROP FUNCTION IF EXISTS create_customer_accounts(INTEGER, TEXT);
DROP FUNCTION IF EXISTS create_supplier_accounts(INTEGER, TEXT);


-- ---------------------------------------------------------------------------
-- VERIFICATION (run manually after applying - see plan tests T0.1 to T0.8)
-- ---------------------------------------------------------------------------
-- T0.1  new accounts exist and are active
--   SELECT account_code, account_name, account_type, is_active
--     FROM chart_of_accounts WHERE account_code IN ('1030','1130','6125');
--
-- T0.2  no template or sub-account rows remain (expect 0)
--   SELECT count(*) FROM chart_of_accounts
--    WHERE account_code LIKE '%-C%' OR account_code LIKE '%-S%'
--       OR account_code LIKE '%-P%';
--
-- T0.5  every account name posted in the ledger resolves to the chart
--       (expect 0 rows - this is what the P&L inner join silently drops)
--   SELECT DISTINCT g.account_name
--     FROM general_ledger_entries g
--     LEFT JOIN chart_of_accounts c ON c.account_name = g.account_name
--    WHERE c.id IS NULL;
--
-- T0.9  no active account has a retired parent (expect 0)
--   SELECT c.account_code, c.account_name
--     FROM chart_of_accounts c
--     JOIN chart_of_accounts p ON p.id = c.parent_account_id
--    WHERE c.is_active AND NOT p.is_active;
--
-- T0.8  the 0041 functions are gone (expect 0)
--   SELECT count(*) FROM pg_proc
--    WHERE proname IN ('create_project_accounts',
--                      'create_customer_accounts',
--                      'create_supplier_accounts');


-- ---------------------------------------------------------------------------
-- ROLLBACK (commented deliberately - this project applies migrations by hand
-- and has no down-migration runner; execute manually if this must be reverted)
-- ---------------------------------------------------------------------------
-- ALTER TABLE general_ledger_entries
--   DROP CONSTRAINT IF EXISTS general_ledger_entries_entry_type_check;
-- ALTER TABLE general_ledger_entries
--   ADD CONSTRAINT general_ledger_entries_entry_type_check
--   CHECK (entry_type = ANY (ARRAY['payable'::text, 'receivable'::text]));
--
-- UPDATE chart_of_accounts SET is_active = true
--  WHERE parent_account_id IN (
--    SELECT id FROM chart_of_accounts
--     WHERE account_code IN ('1110','2010','1000','1010','1020'));
-- UPDATE chart_of_accounts SET is_active = true
--  WHERE account_code IN ('1110', '2010', '1000', '1010', '1020');
--
-- UPDATE chart_of_accounts
--    SET description = 'Withholding taxes to be remitted'
--  WHERE account_code = '2120';
--
-- DELETE FROM chart_of_accounts WHERE account_code IN ('1030', '1130', '6125');
--
-- The template accounts, their sub-accounts and the three 0041 functions are
-- NOT restored by this rollback. Re-run migration 0041 if they are genuinely
-- needed again - but note that contradicts the fixed-chart decision.
