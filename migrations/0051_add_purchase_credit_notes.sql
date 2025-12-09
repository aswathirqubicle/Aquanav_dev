
-- Create purchase_credit_notes table
CREATE TABLE IF NOT EXISTS "purchase_credit_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"credit_note_number" text NOT NULL,
	"purchase_invoice_id" integer NOT NULL,
	"supplier_id" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"credit_note_date" timestamp NOT NULL,
	"reason" text,
	"items" json DEFAULT '[]'::json,
	"subtotal" numeric(12, 2),
	"tax_amount" numeric(10, 2),
	"discount" numeric(10, 2) DEFAULT '0',
	"total_amount" numeric(12, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_credit_notes_credit_note_number_unique" UNIQUE("credit_note_number")
);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "purchase_credit_notes" ADD CONSTRAINT "purchase_credit_notes_purchase_invoice_id_purchase_invoices_id_fk" FOREIGN KEY ("purchase_invoice_id") REFERENCES "purchase_invoices"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "purchase_credit_notes" ADD CONSTRAINT "purchase_credit_notes_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add credit_note_id column to purchase_invoice_payments to track when payment is actually a credit note application
ALTER TABLE "purchase_invoice_payments" ADD COLUMN IF NOT EXISTS "credit_note_id" integer;

DO $$ BEGIN
 ALTER TABLE "purchase_invoice_payments" ADD CONSTRAINT "purchase_invoice_payments_credit_note_id_purchase_credit_notes_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "purchase_credit_notes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add type column to distinguish between regular payments and credit note applications
ALTER TABLE "purchase_invoice_payments" ADD COLUMN IF NOT EXISTS "payment_type" text DEFAULT 'payment' NOT NULL;
