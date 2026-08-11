-- Who cancelled an invoice, when, and why.
--
-- Cancelling an approved invoice reverses posted ledger entries and, on the
-- purchase side, unwinds project cost allocations, inventory movements and
-- asset maintenance records. Until now none of that was attributable: both
-- cancelSalesInvoice and cancelPurchaseInvoice already received the acting
-- user's id and simply set status = 'cancelled' without recording it, so the
-- only trace of who reversed a posted document was in the application logs.
--
-- These mirror the submitted_by_id / approved_by_id columns already on both
-- tables, so the cancellation reads as one more step on the same approval
-- trail rather than as a separate kind of record.
--
-- Existing cancelled invoices are deliberately left untouched. The attribution
-- for those was never captured and cannot be reconstructed, so their columns
-- stay NULL; the Activity trail renders the Cancelled step only when
-- cancelled_at is set, and those invoices go on displaying exactly as they do
-- today.

ALTER TABLE sales_invoices
  ADD COLUMN IF NOT EXISTS cancelled_by_id integer REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS cancelled_at timestamp,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS cancelled_by_id integer REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS cancelled_at timestamp,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;
