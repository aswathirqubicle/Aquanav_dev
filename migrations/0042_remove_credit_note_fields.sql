
-- Remove payment_terms, bank_account, and remarks columns from credit_notes table
ALTER TABLE "credit_notes" DROP COLUMN IF EXISTS "payment_terms";
ALTER TABLE "credit_notes" DROP COLUMN IF EXISTS "bank_account";  
ALTER TABLE "credit_notes" DROP COLUMN IF EXISTS "remarks";
