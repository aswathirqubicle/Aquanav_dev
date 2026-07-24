-- Phase 2 (items 2.5 / 2.6) of the ledger remediation programme.
-- See LEDGER-FIX-PLAN.md and PAYROLL-DEDUCTIONS-DESIGN.md.
--
-- Payroll deductions and additions are currently distinguished only by a
-- free-text `description`, so code cannot tell a provident-fund withholding
-- from an advance recovery, nor an earning from a reimbursement. That is why
-- the ledger cannot route them to the right account, and why the provident-fund
-- base has to be found by string-matching "Provident Fund Contribution".
--
-- These type fields replace that string matching. They are a prerequisite for:
--   2.2/2.3 - recomputing the provident fund on the correct base
--   P4      - posting each deduction to its own account rather than burying
--             everything in Salary Payable
--
-- Backfill is exhaustive: UAT holds only four distinct descriptions across all
-- payroll rows, and zero reimbursements.

-- ---------------------------------------------------------------------------
-- 1. Add the columns, nullable at first so the backfill can run
-- ---------------------------------------------------------------------------
ALTER TABLE payroll_deductions ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE payroll_additions  ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE reimbursements     ADD COLUMN IF NOT EXISTS category TEXT;

-- ---------------------------------------------------------------------------
-- 2. Backfill from the descriptions actually present
--
--    deductions: 'Provident Fund Contribution'  x25
--                'Salary advance prior joining' x2
--    additions : 'Project Fee: <project>'       x20
--                'Overtime'                     x1
-- ---------------------------------------------------------------------------
UPDATE payroll_deductions
   SET type = 'provident_fund'
 WHERE type IS NULL
   AND description = 'Provident Fund Contribution';

-- Everything else deducted is a recovery of money already paid to the employee.
UPDATE payroll_deductions
   SET type = 'advance_recovery'
 WHERE type IS NULL;

UPDATE payroll_additions
   SET type = 'project_fee'
 WHERE type IS NULL
   AND description LIKE 'Project Fee:%';

-- Reimbursements ride in as additions with this prefix. They are NOT earnings:
-- they repay the employee's own outlay, so they must not attract provident fund
-- and must not post to Salary Expense.
UPDATE payroll_additions
   SET type = 'reimbursement'
 WHERE type IS NULL
   AND description LIKE 'Reimbursement:%';

UPDATE payroll_additions
   SET type = 'overtime'
 WHERE type IS NULL
   AND description = 'Overtime';

-- Any remaining addition is a discretionary payment on top of salary.
UPDATE payroll_additions
   SET type = 'bonus'
 WHERE type IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Constrain, then require. NOT NULL is safe because the backfill above
--    covers every existing row; reimbursements has no rows at all.
-- ---------------------------------------------------------------------------
ALTER TABLE payroll_deductions
  DROP CONSTRAINT IF EXISTS payroll_deductions_type_check;
ALTER TABLE payroll_deductions
  ADD CONSTRAINT payroll_deductions_type_check
  CHECK (type = ANY (ARRAY['provident_fund'::text, 'advance_recovery'::text, 'other'::text]));
ALTER TABLE payroll_deductions ALTER COLUMN type SET NOT NULL;

ALTER TABLE payroll_additions
  DROP CONSTRAINT IF EXISTS payroll_additions_type_check;
ALTER TABLE payroll_additions
  ADD CONSTRAINT payroll_additions_type_check
  CHECK (type = ANY (ARRAY['project_fee'::text, 'overtime'::text, 'bonus'::text, 'reimbursement'::text, 'other'::text]));
ALTER TABLE payroll_additions ALTER COLUMN type SET NOT NULL;

-- Reimbursement categories map to the expense account each one debits:
--   travel          -> 6120 Travel and Entertainment
--   accommodation   -> 6125 Accommodation             (added by 0062)
--   fuel_transport  -> 6060 Fuel and Transportation
--   office_supplies -> 6080 Office Supplies
--   communication   -> 6090 Communication Expenses
--   training        -> 6130 Training and Development
--   other           -> 6160 Employee Reimbursement    (added below)
--
-- 'other' gets its OWN account rather than falling into 6000 Operating
-- Expenses. Anything the user could not classify then stays visible as a
-- distinct line that can be reclassified later, instead of dissolving into a
-- general bucket alongside unrelated costs.
INSERT INTO chart_of_accounts
  (account_code, account_name, account_type, account_category, description, is_active)
VALUES
  ('6160', 'Employee Reimbursement', 'expense', 'operating_expenses',
   'Employee expense claims not falling under a specific expense category', true)
ON CONFLICT (account_code) DO NOTHING;

ALTER TABLE reimbursements
  DROP CONSTRAINT IF EXISTS reimbursements_category_check;
ALTER TABLE reimbursements
  ADD CONSTRAINT reimbursements_category_check
  CHECK (category = ANY (ARRAY['travel'::text, 'accommodation'::text, 'fuel_transport'::text,
                               'office_supplies'::text, 'communication'::text,
                               'training'::text, 'other'::text]));

-- NOT NULL with a default, so a claim can never be uncategorised. The form
-- presents 'Other' as an explicit choice; the default only catches a client
-- that omits the field entirely, and even then the claim lands in 6160 where
-- it is visible and reclassifiable rather than lost or rejected.
UPDATE reimbursements SET category = 'other' WHERE category IS NULL;
ALTER TABLE reimbursements ALTER COLUMN category SET DEFAULT 'other';
ALTER TABLE reimbursements ALTER COLUMN category SET NOT NULL;


-- ---------------------------------------------------------------------------
-- VERIFICATION (run after applying)
-- ---------------------------------------------------------------------------
-- expect no NULLs and the counts noted above
--   SELECT type, count(*) FROM payroll_deductions GROUP BY 1 ORDER BY 2 DESC;
--   SELECT type, count(*) FROM payroll_additions  GROUP BY 1 ORDER BY 2 DESC;
--   SELECT count(*) FROM payroll_deductions WHERE type IS NULL;   -- 0
--   SELECT count(*) FROM payroll_additions  WHERE type IS NULL;   -- 0


-- ---------------------------------------------------------------------------
-- ROLLBACK (2.9) - commented; this project applies migrations by hand
-- ---------------------------------------------------------------------------
-- ALTER TABLE payroll_deductions ALTER COLUMN type DROP NOT NULL;
-- ALTER TABLE payroll_additions  ALTER COLUMN type DROP NOT NULL;
-- ALTER TABLE reimbursements     ALTER COLUMN category DROP NOT NULL;
-- ALTER TABLE reimbursements     ALTER COLUMN category DROP DEFAULT;
-- DELETE FROM chart_of_accounts WHERE account_code = '6160';
-- ALTER TABLE payroll_deductions DROP CONSTRAINT IF EXISTS payroll_deductions_type_check;
-- ALTER TABLE payroll_additions  DROP CONSTRAINT IF EXISTS payroll_additions_type_check;
-- ALTER TABLE reimbursements     DROP CONSTRAINT IF EXISTS reimbursements_category_check;
-- ALTER TABLE payroll_deductions DROP COLUMN IF EXISTS type;
-- ALTER TABLE payroll_additions  DROP COLUMN IF EXISTS type;
-- ALTER TABLE reimbursements     DROP COLUMN IF EXISTS category;
