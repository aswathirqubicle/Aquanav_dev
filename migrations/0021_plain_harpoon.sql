ALTER TABLE "credit_notes" ADD COLUMN "subject" text;--> statement-breakpoint
ALTER TABLE "proforma_invoices" ADD COLUMN "subject" text;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "subject" text;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "subject" text;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD COLUMN "subject" text;--> statement-breakpoint
ALTER TABLE "sales_quotations" ADD COLUMN "subject" text;