-- P6 — add payment_type / credit_note_id to purchase_invoice_payments.
--
-- The purchase credit-note code writes these two fields when it records a credit
-- note as a settlement row, but the columns never existed on the table (only the
-- sales invoice_payments table had them). Drizzle silently dropped the values, so
-- credit-note settlement rows could not be distinguished from real payments.
-- Add the columns to match the sales side; defaults keep every existing row a
-- normal payment.

ALTER TABLE purchase_invoice_payments
  ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'payment',
  ADD COLUMN IF NOT EXISTS credit_note_id integer REFERENCES purchase_credit_notes(id);

-- ---------------------------------------------------------------------------
-- VERIFICATION (run after applying)
-- ---------------------------------------------------------------------------
--   \d purchase_invoice_payments   -- payment_type, credit_note_id present

-- ---------------------------------------------------------------------------
-- ROLLBACK (commented; this project applies migrations by hand)
-- ---------------------------------------------------------------------------
-- ALTER TABLE purchase_invoice_payments DROP COLUMN IF EXISTS credit_note_id;
-- ALTER TABLE purchase_invoice_payments DROP COLUMN IF EXISTS payment_type;
