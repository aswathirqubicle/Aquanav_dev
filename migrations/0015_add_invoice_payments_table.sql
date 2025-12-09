
-- Create invoice_payments table
CREATE TABLE IF NOT EXISTS "invoice_payments" (
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

-- Add foreign key constraints
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_sales_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "sales_invoices"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
