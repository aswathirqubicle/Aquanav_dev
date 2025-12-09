
-- Create purchase_orders table
CREATE TABLE IF NOT EXISTS "purchase_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"po_number" text NOT NULL,
	"supplier_id" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"order_date" timestamp DEFAULT now() NOT NULL,
	"expected_delivery_date" timestamp,
	"subtotal" numeric(12, 2),
	"tax_amount" numeric(10, 2) DEFAULT '0',
	"total_amount" numeric(12, 2),
	"notes" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_po_number_unique" UNIQUE("po_number")
);

-- Create purchase_order_items table
CREATE TABLE IF NOT EXISTS "purchase_order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"po_id" integer,
	"inventory_item_id" integer,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 4) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	"received_quantity" integer DEFAULT 0 NOT NULL
);

-- Create purchase_invoices table
CREATE TABLE IF NOT EXISTS "purchase_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"po_id" integer,
	"supplier_id" integer,
	"invoice_date" timestamp NOT NULL,
	"due_date" timestamp,
	"subtotal" numeric(12, 2),
	"tax_amount" numeric(10, 2) DEFAULT '0',
	"total_amount" numeric(12, 2),
	"status" text DEFAULT 'pending' NOT NULL,
	"received_date" timestamp,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_invoices_invoice_number_unique" UNIQUE("invoice_number")
);

-- Create purchase_invoice_items table
CREATE TABLE IF NOT EXISTS "purchase_invoice_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer,
	"inventory_item_id" integer,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 4) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL
);

-- Add foreign key constraints
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_invoice_id_purchase_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "purchase_invoices"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE no action ON UPDATE no action;
