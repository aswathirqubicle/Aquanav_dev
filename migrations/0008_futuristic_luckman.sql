ALTER TABLE "purchase_invoices" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'AED' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN IF NOT EXISTS "exchange_rate" numeric(18, 8) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'AED' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "exchange_rate" numeric(18, 8) DEFAULT '1' NOT NULL;