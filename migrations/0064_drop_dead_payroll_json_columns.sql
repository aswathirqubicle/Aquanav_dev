-- Phase 2 (item 2.8) of the ledger remediation programme.
-- See LEDGER-FIX-PLAN.md.
--
-- payroll_entries.additions and payroll_entries.deductions are dead JSON
-- columns. Payroll line items live in the payroll_additions / payroll_deductions
-- child tables. These two columns are written by nothing and read in a single
-- mapping that only ever sees their '[]' default. UAT confirms it: all 25
-- payroll rows hold '[]' / '[]'.
--
-- Same trap class as the dead sales_invoice_items tables: left in place, they
-- invite a future writer to populate one copy while every reader uses the child
-- tables. Dropped here together with the schema.ts fields, the insert-schema
-- .extend() and the single mapping in generateMonthlyPayroll.

-- ---------------------------------------------------------------------------
-- 1. Drop the dead columns
-- ---------------------------------------------------------------------------
ALTER TABLE payroll_entries DROP COLUMN IF EXISTS additions;
ALTER TABLE payroll_entries DROP COLUMN IF EXISTS deductions;

-- ---------------------------------------------------------------------------
-- VERIFICATION (run after applying)
-- ---------------------------------------------------------------------------
--   \d payroll_entries            -- neither 'additions' nor 'deductions' remain
--   SELECT count(*) FROM payroll_entries;   -- unchanged (no rows touched)

-- ---------------------------------------------------------------------------
-- ROLLBACK (2.9) - commented; this project applies migrations by hand
-- ---------------------------------------------------------------------------
-- ALTER TABLE payroll_entries ADD COLUMN additions  json DEFAULT '[]'::json;
-- ALTER TABLE payroll_entries ADD COLUMN deductions json DEFAULT '[]'::json;
