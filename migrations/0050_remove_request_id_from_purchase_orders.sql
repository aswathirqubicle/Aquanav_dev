
-- Remove request_id column from purchase_orders table if it exists
ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "request_id";
