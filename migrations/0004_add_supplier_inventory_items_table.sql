
-- Create supplier_inventory_items table for supplier-inventory mappings
CREATE TABLE IF NOT EXISTS "supplier_inventory_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer,
	"inventory_item_id" integer,
	"supplier_part_number" text,
	"unit_cost" numeric(10, 4),
	"minimum_order_quantity" integer DEFAULT 1,
	"lead_time_days" integer,
	"is_preferred" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints
ALTER TABLE "supplier_inventory_items" ADD CONSTRAINT "supplier_inventory_items_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "supplier_inventory_items" ADD CONSTRAINT "supplier_inventory_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE no action ON UPDATE no action;
