CREATE TABLE "purchase_invoice_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"original_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "discount_percentage" numeric(5, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "proforma_invoices" ADD COLUMN "discount_percentage" numeric(5, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD COLUMN "discount_percentage" numeric(5, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "sales_quotations" ADD COLUMN "discount_percentage" numeric(5, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "purchase_invoice_files" ADD CONSTRAINT "purchase_invoice_files_invoice_id_purchase_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."purchase_invoices"("id") ON DELETE cascade ON UPDATE no action;