CREATE TABLE "exchange_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_currency" text DEFAULT 'AED' NOT NULL,
	"to_currency" text NOT NULL,
	"rate" numeric(18, 8) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by_id" integer
);
--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "currency" text DEFAULT 'AED' NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "exchange_rate" numeric(18, 8) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "proforma_invoices" ADD COLUMN "currency" text DEFAULT 'AED' NOT NULL;--> statement-breakpoint
ALTER TABLE "proforma_invoices" ADD COLUMN "exchange_rate" numeric(18, 8) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "discount_percentage" numeric(5, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "discount_amount" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "discount_percentage" numeric(5, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "discount_amount" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD COLUMN "currency" text DEFAULT 'AED' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD COLUMN "exchange_rate" numeric(18, 8) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_quotations" ADD COLUMN "currency" text DEFAULT 'AED' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_quotations" ADD COLUMN "exchange_rate" numeric(18, 8) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;