
-- Add payment terms, bank account, and remarks to sales_quotations
ALTER TABLE "sales_quotations" ADD COLUMN "payment_terms" text;
ALTER TABLE "sales_quotations" ADD COLUMN "bank_account" text;
ALTER TABLE "sales_quotations" ADD COLUMN "remarks" text;

-- Add payment terms, bank account, and remarks to sales_invoices
ALTER TABLE "sales_invoices" ADD COLUMN "payment_terms" text;
ALTER TABLE "sales_invoices" ADD COLUMN "bank_account" text;
ALTER TABLE "sales_invoices" ADD COLUMN "remarks" text;
