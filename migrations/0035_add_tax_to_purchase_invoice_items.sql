
-- Add tax fields to purchase_invoice_items table
ALTER TABLE "purchase_invoice_items" ADD COLUMN IF NOT EXISTS "tax_rate" numeric(5, 2) DEFAULT '0';
ALTER TABLE "purchase_invoice_items" ADD COLUMN IF NOT EXISTS "tax_amount" numeric(10, 2) DEFAULT '0';
