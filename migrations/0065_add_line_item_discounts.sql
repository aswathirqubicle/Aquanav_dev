-- Phase 4b — line-item discounts on purchase documents.
-- See LEDGER-FIX-PLAN.md.
--
-- Purchase line items live in child tables (unlike sales, whose line items are a
-- JSON column that needs no migration). Add a per-line discount to the purchase
-- invoice and purchase order item tables so VAT can be charged on the discounted
-- consideration per line (UAE VAT law). `discount` holds the value; `discount_type`
-- says whether it is a fixed amount or a percentage. Purchase REQUESTS are left
-- alone by decision — they are budget estimates, not tax documents.
--
-- Defaults keep every existing row a no-op (discount 0, type 'amount').

ALTER TABLE purchase_invoice_items
  ADD COLUMN IF NOT EXISTS discount numeric(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'amount';

ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS discount numeric(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'amount';

-- ---------------------------------------------------------------------------
-- VERIFICATION (run after applying)
-- ---------------------------------------------------------------------------
--   \d purchase_invoice_items   -- discount, discount_type present
--   \d purchase_order_items     -- discount, discount_type present

-- ---------------------------------------------------------------------------
-- ROLLBACK (commented; this project applies migrations by hand)
-- ---------------------------------------------------------------------------
-- ALTER TABLE purchase_invoice_items DROP COLUMN IF EXISTS discount;
-- ALTER TABLE purchase_invoice_items DROP COLUMN IF EXISTS discount_type;
-- ALTER TABLE purchase_order_items   DROP COLUMN IF EXISTS discount;
-- ALTER TABLE purchase_order_items   DROP COLUMN IF EXISTS discount_type;
