ALTER TABLE "employees" ALTER COLUMN "grade" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "contract_currency" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "contract_salary" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "supplier_invoice_number" text;