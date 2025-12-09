
-- Add payment_terms column to purchase_orders table
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "payment_terms" text;

-- Add payment_terms column to purchase_invoices table  
ALTER TABLE "purchase_invoices" ADD COLUMN IF NOT EXISTS "payment_terms" text;
