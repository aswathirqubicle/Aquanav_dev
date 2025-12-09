
-- Create sales_quotation_items table
CREATE TABLE IF NOT EXISTS "sales_quotation_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotation_id" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT 0,
	"tax_amount" numeric(10, 2) DEFAULT 0,
	"line_total" numeric(10, 2) NOT NULL
);

-- Add foreign key constraint
ALTER TABLE "sales_quotation_items" ADD CONSTRAINT "sales_quotation_items_quotation_id_sales_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "sales_quotations"("id") ON DELETE cascade ON UPDATE no action;
