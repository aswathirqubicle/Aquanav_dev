CREATE TABLE "asset_inventory_instances" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_type_id" integer NOT NULL,
	"instance_number" text NOT NULL,
	"asset_tag" text NOT NULL,
	"serial_number" text NOT NULL,
	"barcode" text NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"condition" text DEFAULT 'excellent' NOT NULL,
	"location" text,
	"assigned_project_id" integer,
	"assigned_to_id" integer,
	"acquisition_date" timestamp,
	"acquisition_cost" numeric(10, 2),
	"acquisition_currency" text DEFAULT 'AED' NOT NULL,
	"current_value" numeric(10, 2),
	"current_value_currency" text DEFAULT 'AED' NOT NULL,
	"monthly_rental_amount" numeric(10, 2) DEFAULT '0',
	"rental_currency" text DEFAULT 'AED' NOT NULL,
	"warranty_expiry_date" timestamp,
	"last_maintenance_date" timestamp,
	"next_maintenance_date" timestamp,
	"notes" text,
	"photos" json DEFAULT '[]'::json,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "asset_inventory_instances_asset_tag_unique" UNIQUE("asset_tag"),
	CONSTRAINT "asset_inventory_instances_serial_number_unique" UNIQUE("serial_number"),
	CONSTRAINT "asset_inventory_instances_barcode_unique" UNIQUE("barcode")
);
--> statement-breakpoint
CREATE TABLE "asset_inventory_maintenance_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"maintenance_record_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"original_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_inventory_maintenance_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"instance_id" integer NOT NULL,
	"maintenance_cost" numeric(10, 2) NOT NULL,
	"maintenance_date" timestamp DEFAULT now() NOT NULL,
	"maintenance_type" varchar(255),
	"start_date" timestamp,
	"completed_date" timestamp,
	"description" text,
	"performed_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_maintenance_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"maintenance_record_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"content_type" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"manufacturer" text,
	"model" text,
	"specifications" json DEFAULT '{}'::json,
	"default_daily_rental_rate" numeric(10, 2),
	"currency" text DEFAULT 'AED' NOT NULL,
	"depreciation_rate" numeric(5, 2) DEFAULT '0',
	"warranty_period_months" integer DEFAULT 12,
	"maintenance_interval_days" integer DEFAULT 90,
	"total_quantity" integer DEFAULT 0 NOT NULL,
	"available_quantity" integer DEFAULT 0 NOT NULL,
	"assigned_quantity" integer DEFAULT 0 NOT NULL,
	"maintenance_quantity" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chart_of_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_code" text NOT NULL,
	"account_name" text NOT NULL,
	"account_type" text NOT NULL,
	"account_category" text NOT NULL,
	"parent_account_id" integer,
	"is_active" boolean DEFAULT true,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"entity_type" text,
	"entity_id" integer,
	CONSTRAINT "chart_of_accounts_account_code_unique" UNIQUE("account_code"),
	CONSTRAINT "chart_of_accounts_account_name_unique" UNIQUE("account_name")
);
--> statement-breakpoint
CREATE TABLE "credit_note_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"credit_note_id" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0',
	"tax_amount" numeric(10, 2) DEFAULT '0',
	"line_total" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"credit_note_number" text NOT NULL,
	"sales_invoice_id" integer,
	"customer_id" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"credit_note_date" timestamp NOT NULL,
	"billing_address" text,
	"reason" text,
	"items" json DEFAULT '[]'::json,
	"subtotal" numeric(12, 2),
	"tax_amount" numeric(10, 2),
	"discount" numeric(10, 2) DEFAULT '0',
	"total_amount" numeric(12, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "credit_notes_credit_note_number_unique" UNIQUE("credit_note_number")
);
--> statement-breakpoint
CREATE TABLE "customer_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"document_type" text NOT NULL,
	"document_name" text NOT NULL,
	"document_number" text,
	"issuing_authority" text,
	"date_of_issue" date,
	"expiry_date" date,
	"file_path" text,
	"file_name" text,
	"file_size" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"document_type" text NOT NULL,
	"document_number" text,
	"place_of_issue" text,
	"issued_by" text,
	"date_of_issue" date,
	"expiry_date" date,
	"valid_till" date,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"attachment_paths" json DEFAULT '[]'::json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_next_of_kin" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"relationship" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_training_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"training_name" text NOT NULL,
	"training_provider" text DEFAULT 'Aquanav' NOT NULL,
	"certification_number" text,
	"training_date" date NOT NULL,
	"expiry_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"attachments" json DEFAULT '[]'::json
);
--> statement-breakpoint
CREATE TABLE "error_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"url" text,
	"user_agent" text,
	"user_id" integer,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"severity" text DEFAULT 'error' NOT NULL,
	"component" text,
	"resolved" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "general_ledger_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_type" text NOT NULL,
	"reference_type" text NOT NULL,
	"reference_id" integer,
	"account_name" text NOT NULL,
	"description" text NOT NULL,
	"debit_amount" numeric(12, 2) DEFAULT '0',
	"credit_amount" numeric(12, 2) DEFAULT '0',
	"entity_id" integer,
	"entity_name" text,
	"project_id" integer,
	"invoice_number" text,
	"transaction_date" timestamp NOT NULL,
	"due_date" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "invoice_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_date" timestamp NOT NULL,
	"payment_method" text,
	"reference_number" text,
	"notes" text,
	"recorded_by" integer,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"payment_type" text DEFAULT 'payment' NOT NULL,
	"credit_note_id" integer
);
--> statement-breakpoint
CREATE TABLE "payment_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"original_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_additions" (
	"id" serial PRIMARY KEY NOT NULL,
	"payroll_entry_id" integer,
	"description" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "payroll_deductions" (
	"id" serial PRIMARY KEY NOT NULL,
	"payroll_entry_id" integer,
	"description" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "proforma_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"proforma_number" text NOT NULL,
	"customer_id" integer,
	"project_id" integer,
	"quotation_id" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_date" timestamp DEFAULT now() NOT NULL,
	"invoice_date" timestamp DEFAULT now() NOT NULL,
	"valid_until" timestamp,
	"payment_terms" text,
	"delivery_terms" text,
	"bank_account" text,
	"billing_address" text,
	"terms_and_conditions" text,
	"remarks" text,
	"items" json DEFAULT '[]'::json,
	"subtotal" numeric(12, 2),
	"tax_amount" numeric(10, 2),
	"discount" numeric(10, 2) DEFAULT '0',
	"total_amount" numeric(12, 2),
	"is_archived" boolean DEFAULT false NOT NULL,
	CONSTRAINT "proforma_invoices_proforma_number_unique" UNIQUE("proforma_number")
);
--> statement-breakpoint
CREATE TABLE "project_asset_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"asset_id" integer,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"monthly_rate" numeric(10, 2) NOT NULL,
	"total_cost" numeric(12, 2) NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"assigned_by" integer
);
--> statement-breakpoint
CREATE TABLE "project_asset_instance_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"asset_type_id" integer NOT NULL,
	"instance_id" integer NOT NULL,
	"barcode" text NOT NULL,
	"serial_number" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"monthly_rate" numeric(10, 2),
	"total_cost" numeric(12, 2),
	"status" text DEFAULT 'active' NOT NULL,
	"assigned_by" integer NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"returned_at" timestamp,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "project_consumable_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"consumable_id" integer,
	"inventory_item_id" integer,
	"quantity" integer NOT NULL,
	"unit_cost" numeric(10, 4)
);
--> statement-breakpoint
CREATE TABLE "project_consumables" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"date" timestamp NOT NULL,
	"recorded_by" integer,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_photo_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"title" text NOT NULL,
	"date" timestamp NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "project_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer,
	"filename" text NOT NULL,
	"original_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_credit_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"credit_note_number" text NOT NULL,
	"purchase_invoice_id" integer NOT NULL,
	"supplier_id" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"credit_note_date" timestamp NOT NULL,
	"reason" text,
	"items" json DEFAULT '[]'::json,
	"subtotal" numeric(12, 2),
	"tax_amount" numeric(10, 2),
	"discount" numeric(10, 2) DEFAULT '0',
	"total_amount" numeric(12, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_credit_notes_credit_note_number_unique" UNIQUE("credit_note_number")
);
--> statement-breakpoint
CREATE TABLE "purchase_invoice_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"item_type" text DEFAULT 'product' NOT NULL,
	"inventory_item_id" integer,
	"description" text,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0',
	"tax_amount" numeric(10, 2) DEFAULT '0',
	"line_total" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_invoice_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_date" timestamp NOT NULL,
	"payment_method" text,
	"reference_number" text,
	"notes" text,
	"recorded_by" integer,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_order_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"po_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"original_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"po_id" integer NOT NULL,
	"item_type" text DEFAULT 'product' NOT NULL,
	"inventory_item_id" integer,
	"description" text,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0',
	"tax_amount" numeric(10, 2) DEFAULT '0',
	"line_total" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_payment_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"original_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_request_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"item_type" text DEFAULT 'product' NOT NULL,
	"inventory_item_id" integer,
	"description" text,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "reimbursements" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"project_id" integer,
	"amount" numeric(10, 2) NOT NULL,
	"description" text NOT NULL,
	"original_expense_date" date NOT NULL,
	"submission_timestamp" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_by_id" integer,
	"approval_timestamp" timestamp,
	"rejection_reason" text,
	"payroll_month" integer,
	"payroll_year" integer,
	"attachments" text[]
);
--> statement-breakpoint
CREATE TABLE "sales_invoice_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0',
	"tax_amount" numeric(10, 2) DEFAULT '0',
	"line_total" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_quotation_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotation_id" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0',
	"tax_amount" numeric(10, 2) DEFAULT '0',
	"line_total" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_bank_details" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"account_details" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"document_type" text NOT NULL,
	"document_name" text NOT NULL,
	"document_number" text,
	"issuing_authority" text,
	"date_of_issue" date,
	"expiry_date" date,
	"file_path" text,
	"file_name" text,
	"file_size" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_inventory_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"inventory_item_id" integer NOT NULL,
	"supplier_part_number" text,
	"unit_cost" numeric(10, 4) DEFAULT '0',
	"minimum_order_quantity" integer DEFAULT 1 NOT NULL,
	"lead_time_days" integer DEFAULT 0 NOT NULL,
	"is_preferred" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "assets" CASCADE;--> statement-breakpoint
ALTER TABLE "purchase_requests" DROP CONSTRAINT "purchase_requests_requested_by_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "purchase_requests" DROP CONSTRAINT "purchase_requests_approved_by_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "phone" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_requests" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "sales_invoices" ALTER COLUMN "invoice_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_invoices" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "bank_account" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "financial_year_start_day" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "financial_year_start_month" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "financial_year_end_day" integer DEFAULT 31;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "financial_year_end_month" integer DEFAULT 12;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "vat_number" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "vat_registration_status" text DEFAULT 'not_registered' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "vat_treatment" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "customer_type" text DEFAULT 'business' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "tax_category" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "payment_terms" text DEFAULT '30_days';--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "currency" text DEFAULT 'AED' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "credit_limit" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "is_vat_applicable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "category" text DEFAULT 'permanent' NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "grade" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "height" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "weight" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "bank_name" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "bank_branch" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "account_number" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "account_holder_name" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "ifsc_code" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "swift_code" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "boiler_suit_size" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "safety_shoe_size" text;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "sku" text NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD COLUMN "created_by" integer;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD COLUMN "additions" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD COLUMN "deductions" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "project_employees" ADD COLUMN "start_date" timestamp;--> statement-breakpoint
ALTER TABLE "project_employees" ADD COLUMN "end_date" timestamp;--> statement-breakpoint
ALTER TABLE "project_employees" ADD COLUMN "assigned_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "vessel_imo_number" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "total_revenue" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "ridging_crew_nos" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "mode_of_contract" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "working_hours" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "ppe" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "additional_field_1_title" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "additional_field_1_description" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "additional_field_2_title" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "additional_field_2_description" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "additional_field_3_title" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "additional_field_3_description" text;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "project_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "asset_inventory_instance_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "approval_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "due_date" timestamp;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "payment_terms" text;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "bank_account" text;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "subtotal" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "tax_amount" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "paid_amount" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "created_by" integer;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "approved_by" integer;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "order_date" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "expected_delivery_date" timestamp;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "payment_terms" text;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "delivery_terms" text;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "bank_account" text;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "subtotal" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD COLUMN "payment_terms" text;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD COLUMN "bank_account" text;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD COLUMN "billing_address" text;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD COLUMN "terms_and_conditions" text;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD COLUMN "remarks" text;--> statement-breakpoint
ALTER TABLE "sales_quotations" ADD COLUMN "payment_terms" text;--> statement-breakpoint
ALTER TABLE "sales_quotations" ADD COLUMN "bank_account" text;--> statement-breakpoint
ALTER TABLE "sales_quotations" ADD COLUMN "billing_address" text;--> statement-breakpoint
ALTER TABLE "sales_quotations" ADD COLUMN "terms_and_conditions" text;--> statement-breakpoint
ALTER TABLE "sales_quotations" ADD COLUMN "remarks" text;--> statement-breakpoint
ALTER TABLE "sales_quotations" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "vat_number" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "vat_registration_status" text DEFAULT 'not_registered' NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "vat_treatment" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "supplier_type" text DEFAULT 'business' NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "tax_category" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "payment_terms" text DEFAULT '30_days';--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "currency" text DEFAULT 'AED' NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "credit_limit" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "is_vat_applicable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_inventory_instances" ADD CONSTRAINT "asset_inventory_instances_asset_type_id_asset_types_id_fk" FOREIGN KEY ("asset_type_id") REFERENCES "public"."asset_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_inventory_instances" ADD CONSTRAINT "asset_inventory_instances_assigned_project_id_projects_id_fk" FOREIGN KEY ("assigned_project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_inventory_instances" ADD CONSTRAINT "asset_inventory_instances_assigned_to_id_employees_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_inventory_instances" ADD CONSTRAINT "asset_inventory_instances_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_inventory_maintenance_files" ADD CONSTRAINT "asset_inventory_maintenance_files_maintenance_record_id_asset_inventory_maintenance_records_id_fk" FOREIGN KEY ("maintenance_record_id") REFERENCES "public"."asset_inventory_maintenance_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_inventory_maintenance_records" ADD CONSTRAINT "asset_inventory_maintenance_records_instance_id_asset_inventory_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."asset_inventory_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_inventory_maintenance_records" ADD CONSTRAINT "asset_inventory_maintenance_records_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_maintenance_files" ADD CONSTRAINT "asset_maintenance_files_maintenance_record_id_asset_inventory_maintenance_records_id_fk" FOREIGN KEY ("maintenance_record_id") REFERENCES "public"."asset_inventory_maintenance_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_items" ADD CONSTRAINT "credit_note_items_credit_note_id_credit_notes_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "public"."credit_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_sales_invoice_id_sales_invoices_id_fk" FOREIGN KEY ("sales_invoice_id") REFERENCES "public"."sales_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_documents" ADD CONSTRAINT "customer_documents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_next_of_kin" ADD CONSTRAINT "employee_next_of_kin_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_training_records" ADD CONSTRAINT "employee_training_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "general_ledger_entries" ADD CONSTRAINT "general_ledger_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "general_ledger_entries" ADD CONSTRAINT "general_ledger_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_sales_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."sales_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_credit_note_id_credit_notes_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "public"."credit_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_files" ADD CONSTRAINT "payment_files_payment_id_invoice_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."invoice_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_additions" ADD CONSTRAINT "payroll_additions_payroll_entry_id_payroll_entries_id_fk" FOREIGN KEY ("payroll_entry_id") REFERENCES "public"."payroll_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_deductions" ADD CONSTRAINT "payroll_deductions_payroll_entry_id_payroll_entries_id_fk" FOREIGN KEY ("payroll_entry_id") REFERENCES "public"."payroll_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proforma_invoices" ADD CONSTRAINT "proforma_invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proforma_invoices" ADD CONSTRAINT "proforma_invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proforma_invoices" ADD CONSTRAINT "proforma_invoices_quotation_id_sales_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."sales_quotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_asset_assignments" ADD CONSTRAINT "project_asset_assignments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_asset_assignments" ADD CONSTRAINT "project_asset_assignments_asset_id_asset_inventory_instances_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset_inventory_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_asset_assignments" ADD CONSTRAINT "project_asset_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_asset_instance_assignments" ADD CONSTRAINT "project_asset_instance_assignments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_asset_instance_assignments" ADD CONSTRAINT "project_asset_instance_assignments_asset_type_id_asset_types_id_fk" FOREIGN KEY ("asset_type_id") REFERENCES "public"."asset_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_asset_instance_assignments" ADD CONSTRAINT "project_asset_instance_assignments_instance_id_asset_inventory_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."asset_inventory_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_asset_instance_assignments" ADD CONSTRAINT "project_asset_instance_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_consumable_items" ADD CONSTRAINT "project_consumable_items_consumable_id_project_consumables_id_fk" FOREIGN KEY ("consumable_id") REFERENCES "public"."project_consumables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_consumable_items" ADD CONSTRAINT "project_consumable_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_consumables" ADD CONSTRAINT "project_consumables_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_consumables" ADD CONSTRAINT "project_consumables_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_photo_groups" ADD CONSTRAINT "project_photo_groups_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_photo_groups" ADD CONSTRAINT "project_photo_groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_photos" ADD CONSTRAINT "project_photos_group_id_project_photo_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."project_photo_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_credit_notes" ADD CONSTRAINT "purchase_credit_notes_purchase_invoice_id_purchase_invoices_id_fk" FOREIGN KEY ("purchase_invoice_id") REFERENCES "public"."purchase_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_credit_notes" ADD CONSTRAINT "purchase_credit_notes_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_invoice_id_purchase_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."purchase_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoice_payments" ADD CONSTRAINT "purchase_invoice_payments_invoice_id_purchase_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."purchase_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoice_payments" ADD CONSTRAINT "purchase_invoice_payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_files" ADD CONSTRAINT "purchase_order_files_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_payment_files" ADD CONSTRAINT "purchase_payment_files_payment_id_purchase_invoice_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."purchase_invoice_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_request_id_purchase_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."purchase_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_invoice_id_sales_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."sales_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_quotation_items" ADD CONSTRAINT "sales_quotation_items_quotation_id_sales_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."sales_quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_bank_details" ADD CONSTRAINT "supplier_bank_details_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_documents" ADD CONSTRAINT "supplier_documents_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_inventory_items" ADD CONSTRAINT "supplier_inventory_items_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_inventory_items" ADD CONSTRAINT "supplier_inventory_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_asset_inventory_instance_id_asset_inventory_instances_id_fk" FOREIGN KEY ("asset_inventory_instance_id") REFERENCES "public"."asset_inventory_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_activities" DROP COLUMN "inventory_used";--> statement-breakpoint
ALTER TABLE "purchase_invoices" DROP COLUMN "items";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN "delivery_date";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN "items";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN "created_date";--> statement-breakpoint
ALTER TABLE "purchase_requests" DROP COLUMN "items";--> statement-breakpoint
ALTER TABLE "purchase_requests" DROP COLUMN "total_estimated_cost";--> statement-breakpoint
ALTER TABLE "suppliers" DROP COLUMN "bank_info";--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_phone_unique" UNIQUE("phone");--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_sku_unique" UNIQUE("sku");--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_invoice_number_unique" UNIQUE("invoice_number");