
-- Add request_id column to purchase_orders table to link back to purchase requests
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "request_id" integer;

-- Add foreign key constraint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_request_id_purchase_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "purchase_requests"("id") ON DELETE no action ON UPDATE no action;
