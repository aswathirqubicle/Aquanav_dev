-- Line-item quantities on sales and purchase documents take up to 2 decimals.
--
-- Work is often billed and bought in fractions — 1.5 hours of labour, 2.25 m of
-- pipe — and the document item tables stored quantity as an integer, so a
-- fractional quantity could not be saved at all. numeric(10,2) matches the
-- inventory side (inventory_transactions.quantity and inventory_items
-- .current_stock are already numeric(10,2)), so a fractional purchase books
-- into stock without rounding.
--
-- Widening only: every existing integer converts exactly (3 -> 3.00), and no
-- amount, tax or ledger figure is recalculated.
--
-- The purchase side (request, order, invoice items) is where this matters: those
-- lines live in these tables. Quotations, sales invoices, proformas and credit
-- notes keep their lines in a JSON column, which already holds decimals; their
-- item tables below are declared in shared/schema.ts but unused, and are widened
-- only so the schema and the database agree.
--
-- Each table is altered only if its quantity column exists and is still an
-- integer, so the file is safe to re-run and does not fail on an install where
-- one of the unused tables was never created.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sales_quotation_items',
    'sales_invoice_items',
    'credit_note_items',
    'purchase_request_items',
    'purchase_order_items',
    'purchase_invoice_items'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = t
        AND column_name = 'quantity'
        AND data_type = 'integer'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN quantity TYPE numeric(10,2) USING quantity::numeric(10,2)',
        t
      );
      RAISE NOTICE 'widened %.quantity to numeric(10,2)', t;
    END IF;
  END LOOP;
END $$;
