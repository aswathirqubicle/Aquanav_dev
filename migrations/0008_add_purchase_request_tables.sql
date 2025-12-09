
-- Create purchase requests table
CREATE TABLE IF NOT EXISTS "purchase_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_number" text NOT NULL,
	"requested_by" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"urgency" text DEFAULT 'normal' NOT NULL,
	"reason" text,
	"request_date" timestamp DEFAULT now() NOT NULL,
	"approved_by" integer,
	"approval_date" timestamp,
	CONSTRAINT "purchase_requests_request_number_unique" UNIQUE("request_number")
);

-- Create purchase request items table
CREATE TABLE IF NOT EXISTS "purchase_request_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer,
	"inventory_item_id" integer,
	"quantity" integer NOT NULL,
	"notes" text
);

-- Create purchase orders table
CREATE TABLE IF NOT EXISTS "purchase_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"po_number" text NOT NULL,
	"supplier_id" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"delivery_date" timestamp,
	"total_amount" numeric(12, 2),
	"tax_amount" numeric(10, 2),
	"items" json DEFAULT '[]'::json,
	"created_date" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_po_number_unique" UNIQUE("po_number")
);

-- Add foreign key constraints
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_requested_by_employees_id_fk" FOREIGN KEY ("requested_by") REFERENCES "employees"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_approved_by_employees_id_fk" FOREIGN KEY ("approved_by") REFERENCES "employees"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_request_id_purchase_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "purchase_requests"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE no action ON UPDATE no action;
