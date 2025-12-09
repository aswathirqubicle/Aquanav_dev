
CREATE TABLE IF NOT EXISTS "proforma_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"proforma_number" text NOT NULL,
	"customer_id" integer,
	"project_id" integer,
	"quotation_id" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_date" timestamp DEFAULT now() NOT NULL,
	"valid_until" timestamp,
	"payment_terms" text,
	"delivery_terms" text,
	"remarks" text,
	"items" json DEFAULT '[]'::json,
	"subtotal" numeric(12,2),
	"tax_amount" numeric(10,2),
	"discount" numeric(10,2) DEFAULT '0',
	"total_amount" numeric(12,2),
	"is_archived" boolean DEFAULT false NOT NULL,
	CONSTRAINT "proforma_invoices_proforma_number_unique" UNIQUE("proforma_number")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "proforma_invoices" ADD CONSTRAINT "proforma_invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "proforma_invoices" ADD CONSTRAINT "proforma_invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "proforma_invoices" ADD CONSTRAINT "proforma_invoices_quotation_id_sales_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "sales_quotations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
