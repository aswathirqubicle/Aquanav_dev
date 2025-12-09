
-- Add tax fields to purchase_order_items table
ALTER TABLE "purchase_order_items" ADD COLUMN "tax_rate" numeric(5, 2) DEFAULT '0';
ALTER TABLE "purchase_order_items" ADD COLUMN "tax_amount" numeric(10, 2) DEFAULT '0';
