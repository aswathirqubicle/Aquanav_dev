
-- Create credit_notes table
CREATE TABLE IF NOT EXISTS "credit_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"credit_note_number" text NOT NULL,
	"sales_invoice_id" integer,
	"customer_id" integer,
	"project_id" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"credit_note_date" timestamp NOT NULL,
	"reason" text,
	"payment_terms" text,
	"bank_account" text,
	"remarks" text,
	"items" json DEFAULT '[]'::json,
	"subtotal" numeric(12, 2),
	"tax_amount" numeric(10, 2),
	"discount" numeric(10, 2) DEFAULT '0',
	"total_amount" numeric(12, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "credit_notes_credit_note_number_unique" UNIQUE("credit_note_number")
);

-- Add project_id column if it doesn't exist
ALTER TABLE "credit_notes" ADD COLUMN IF NOT EXISTS "project_id" integer;

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_sales_invoice_id_sales_invoices_id_fk" FOREIGN KEY ("sales_invoice_id") REFERENCES "sales_invoices"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create credit_note_items table
CREATE TABLE IF NOT EXISTS "credit_note_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"credit_note_id" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT 0,
	"tax_amount" numeric(10, 2) DEFAULT 0,
	"line_total" numeric(10, 2) NOT NULL
);

-- Add foreign key constraint for credit note items
ALTER TABLE "credit_note_items" ADD CONSTRAINT "credit_note_items_credit_note_id_credit_notes_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "credit_notes"("id") ON DELETE cascade ON UPDATE no action;
