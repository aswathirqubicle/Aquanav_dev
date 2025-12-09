CREATE TABLE "assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"barcode" text,
	"category" text,
	"description" text,
	"status" text DEFAULT 'available' NOT NULL,
	"project_id" integer,
	"assigned_to_id" integer,
	"acquisition_date" timestamp,
	"acquisition_cost" numeric(10, 2),
	CONSTRAINT "assets_barcode_unique" UNIQUE("barcode")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"logo" text,
	"address" text,
	"phone" text,
	"email" text,
	"website" text
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact_person" text,
	"email" text,
	"phone" text,
	"address" text,
	"tax_id" text,
	"user_id" integer
);
--> statement-breakpoint
CREATE TABLE "daily_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"date" timestamp NOT NULL,
	"location" text,
	"completed_tasks" text,
	"planned_tasks" text,
	"remarks" text,
	"photos" json DEFAULT '[]'::json,
	"inventory_used" json DEFAULT '[]'::json
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_code" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"position" text,
	"department" text,
	"salary" numeric(10, 2),
	"hire_date" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"user_id" integer,
	CONSTRAINT "employees_employee_code_unique" UNIQUE("employee_code")
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"unit" text NOT NULL,
	"current_stock" integer DEFAULT 0 NOT NULL,
	"min_stock_level" integer DEFAULT 0 NOT NULL,
	"avg_cost" numeric(10, 4) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "inventory_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer,
	"type" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_cost" numeric(10, 4),
	"remaining_quantity" integer NOT NULL,
	"project_id" integer,
	"reference" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer,
	"project_id" integer,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"working_days" integer NOT NULL,
	"basic_salary" numeric(10, 2),
	"total_amount" numeric(10, 2),
	"status" text DEFAULT 'draft' NOT NULL,
	"generated_date" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"employee_id" integer
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"vessel_name" text,
	"vessel_image" text,
	"start_date" timestamp,
	"planned_end_date" timestamp,
	"actual_end_date" timestamp,
	"status" text DEFAULT 'not_started' NOT NULL,
	"estimated_budget" numeric(12, 2),
	"actual_cost" numeric(12, 2) DEFAULT '0',
	"customer_id" integer,
	"locations" json DEFAULT '[]'::json
);
--> statement-breakpoint
CREATE TABLE "purchase_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"po_id" integer,
	"supplier_id" integer,
	"invoice_date" timestamp NOT NULL,
	"total_amount" numeric(12, 2),
	"items" json DEFAULT '[]'::json
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"po_number" text NOT NULL,
	"supplier_id" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"delivery_date" timestamp,
	"total_amount" numeric(12, 2),
	"tax_amount" numeric(10, 2),
	"items" json DEFAULT '[]'::json,
	"created_date" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_po_number_unique" UNIQUE("po_number")
);
--> statement-breakpoint
CREATE TABLE "purchase_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_number" text NOT NULL,
	"requested_by" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"urgency" text DEFAULT 'normal' NOT NULL,
	"reason" text,
	"items" json DEFAULT '[]'::json,
	"total_estimated_cost" numeric(10, 2),
	"request_date" timestamp DEFAULT now() NOT NULL,
	"approved_by" integer,
	"approval_date" timestamp,
	CONSTRAINT "purchase_requests_request_number_unique" UNIQUE("request_number")
);
--> statement-breakpoint
CREATE TABLE "sales_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"customer_id" integer,
	"project_id" integer,
	"quotation_id" integer,
	"status" text DEFAULT 'unpaid' NOT NULL,
	"invoice_date" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"items" json DEFAULT '[]'::json,
	"subtotal" numeric(12, 2),
	"tax_amount" numeric(10, 2),
	"discount" numeric(10, 2) DEFAULT '0',
	"total_amount" numeric(12, 2),
	"paid_amount" numeric(12, 2) DEFAULT '0',
	CONSTRAINT "sales_invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "sales_quotations" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotation_number" text NOT NULL,
	"customer_id" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"valid_until" timestamp,
	"items" json DEFAULT '[]'::json,
	"subtotal" numeric(12, 2),
	"tax_amount" numeric(10, 2),
	"discount" numeric(10, 2) DEFAULT '0',
	"total_amount" numeric(12, 2),
	"created_date" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sales_quotations_quotation_number_unique" UNIQUE("quotation_number")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact_person" text,
	"email" text,
	"phone" text,
	"address" text,
	"tax_id" text,
	"bank_info" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'employee' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_assigned_to_id_employees_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_activities" ADD CONSTRAINT "daily_activities_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_employees" ADD CONSTRAINT "project_employees_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_employees" ADD CONSTRAINT "project_employees_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_requested_by_employees_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_approved_by_employees_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_quotation_id_sales_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."sales_quotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_quotations" ADD CONSTRAINT "sales_quotations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;