ALTER TABLE "purchase_invoices" DROP CONSTRAINT IF EXISTS purchase_invoices_project_id_projects_id_fk
--> statement-breakpoint
ALTER TABLE "purchase_invoices" DROP CONSTRAINT IF EXISTS "purchase_invoices_asset_inventory_instance_id_asset_inventory_instances_id_fk";
--> statement-breakpoint
ALTER TABLE "purchase_invoices" DROP CONSTRAINT IF EXISTS "purchase_invoices_approved_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "purchase_invoices" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "additional_field_4_title" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "additional_field_4_description" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "additional_field_5_title" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "additional_field_5_description" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "additional_field_6_title" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "additional_field_6_description" text;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "payment_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "submitted_by_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "submitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "approved_by_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoices" DROP COLUMN IF EXISTS "project_id";--> statement-breakpoint
ALTER TABLE "purchase_invoices" DROP COLUMN IF EXISTS "asset_inventory_instance_id";--> statement-breakpoint
ALTER TABLE "purchase_invoices" DROP COLUMN IF EXISTS "approval_status";--> statement-breakpoint
ALTER TABLE "purchase_invoices" DROP COLUMN IF EXISTS "approved_by";