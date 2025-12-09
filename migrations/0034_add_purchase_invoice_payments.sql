
-- Create purchase_invoice_items table if not exists
CREATE TABLE IF NOT EXISTS "purchase_invoice_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"inventory_item_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 4) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL
);

-- Create purchase_invoice_payments table
CREATE TABLE IF NOT EXISTS "purchase_invoice_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_date" timestamp NOT NULL,
	"payment_method" text,
	"reference_number" text,
	"notes" text,
	"recorded_by" integer,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);

-- Create purchase_payment_files table
CREATE TABLE IF NOT EXISTS "purchase_payment_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"original_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);

-- Add missing columns to purchase_invoices if they don't exist
ALTER TABLE "purchase_invoices" ADD COLUMN IF NOT EXISTS "paid_amount" numeric(12, 2) DEFAULT '0';
ALTER TABLE "purchase_invoices" ADD COLUMN IF NOT EXISTS "created_by" integer;

-- Add foreign key constraints
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_invoice_id_purchase_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "purchase_invoices"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "purchase_invoice_payments" ADD CONSTRAINT "purchase_invoice_payments_invoice_id_purchase_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "purchase_invoices"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "purchase_invoice_payments" ADD CONSTRAINT "purchase_invoice_payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "purchase_payment_files" ADD CONSTRAINT "purchase_payment_files_payment_id_purchase_invoice_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "purchase_invoice_payments"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "purchase_invoice_items_invoice_id_idx" ON "purchase_invoice_items" ("invoice_id");
CREATE INDEX IF NOT EXISTS "purchase_invoice_payments_invoice_id_idx" ON "purchase_invoice_payments" ("invoice_id");
CREATE INDEX IF NOT EXISTS "purchase_payment_files_payment_id_idx" ON "purchase_payment_files" ("payment_id");
