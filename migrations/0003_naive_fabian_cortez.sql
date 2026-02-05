ALTER TABLE "credit_notes" ADD COLUMN "submitted_by_id" integer;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "submitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "approved_by_id" integer;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "proforma_invoices" ADD COLUMN "submitted_by_id" integer;--> statement-breakpoint
ALTER TABLE "proforma_invoices" ADD COLUMN "submitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "proforma_invoices" ADD COLUMN "approved_by_id" integer;--> statement-breakpoint
ALTER TABLE "proforma_invoices" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "proforma_invoices" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "purchase_invoice_items" ADD COLUMN "project_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_invoice_items" ADD COLUMN "asset_instance_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "submitted_by_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "submitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "approved_by_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "converted_invoice_id" integer;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD COLUMN "submitted_by_id" integer;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD COLUMN "submitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD COLUMN "approved_by_id" integer;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "sales_quotations" ADD COLUMN "submitted_by_id" integer;--> statement-breakpoint
ALTER TABLE "sales_quotations" ADD COLUMN "submitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "sales_quotations" ADD COLUMN "approved_by_id" integer;--> statement-breakpoint
ALTER TABLE "sales_quotations" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "sales_quotations" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proforma_invoices" ADD CONSTRAINT "proforma_invoices_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proforma_invoices" ADD CONSTRAINT "proforma_invoices_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_asset_instance_id_asset_inventory_instances_id_fk" FOREIGN KEY ("asset_instance_id") REFERENCES "public"."asset_inventory_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_quotations" ADD CONSTRAINT "sales_quotations_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_quotations" ADD CONSTRAINT "sales_quotations_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;