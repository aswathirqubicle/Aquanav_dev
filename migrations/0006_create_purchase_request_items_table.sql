
-- Create purchase_request_items table
CREATE TABLE IF NOT EXISTS "purchase_request_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer,
	"inventory_item_id" integer,
	"quantity" integer NOT NULL,
	"notes" text
);

-- Add foreign key constraints
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_request_id_purchase_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "purchase_requests"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE no action ON UPDATE no action;
