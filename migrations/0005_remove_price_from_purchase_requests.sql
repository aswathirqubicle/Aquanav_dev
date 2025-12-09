
-- Remove price-related columns from purchase_requests and purchase_request_items tables
ALTER TABLE "purchase_requests" DROP COLUMN IF EXISTS "total_estimated_cost";
ALTER TABLE "purchase_request_items" DROP COLUMN IF EXISTS "estimated_cost";
