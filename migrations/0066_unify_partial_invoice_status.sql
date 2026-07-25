-- P5 (G6) — settle the mid-payment sales-invoice status on a single value.
--
-- The payment path writes 'partially_paid' (the value documented in
-- shared/schema.ts and used by receivables, jobs and project rollups); the
-- invoice edit route previously wrote 'partial'. That split blocked edits and
-- confused filters. The code now uses 'partially_paid' everywhere; this migrates
-- any stray 'partial' rows so the data agrees.

UPDATE sales_invoices SET status = 'partially_paid' WHERE status = 'partial';

-- ---------------------------------------------------------------------------
-- VERIFICATION (run after applying)
-- ---------------------------------------------------------------------------
--   SELECT status, count(*) FROM sales_invoices GROUP BY status;
--   -- expect no rows with status = 'partial'

-- ---------------------------------------------------------------------------
-- ROLLBACK (commented; this project applies migrations by hand)
-- ---------------------------------------------------------------------------
-- UPDATE sales_invoices SET status = 'partial' WHERE status = 'partially_paid';
