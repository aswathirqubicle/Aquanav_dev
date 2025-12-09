
-- Create sales_invoice_items table
CREATE TABLE IF NOT EXISTS "sales_invoice_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT 0,
	"tax_amount" numeric(10, 2) DEFAULT 0,
	"line_total" numeric(10, 2) NOT NULL
);

-- Add foreign key constraint
ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_invoice_id_sales_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "sales_invoices"("id") ON DELETE cascade ON UPDATE no action;
