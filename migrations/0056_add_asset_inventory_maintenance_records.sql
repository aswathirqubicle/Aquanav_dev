
CREATE TABLE IF NOT EXISTS "asset_inventory_maintenance_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"instance_id" integer NOT NULL,
	"maintenance_cost" numeric(10, 2) NOT NULL,
	"maintenance_date" timestamp DEFAULT now() NOT NULL,
	"description" text,
	"performed_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "asset_inventory_maintenance_records_instance_id_asset_inventory_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "asset_inventory_instances"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "asset_inventory_maintenance_records_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "asset_inventory_maintenance_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"maintenance_record_id" integer NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_size" integer,
	"mime_type" varchar(100),
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "asset_inventory_maintenance_files_maintenance_record_id_asset_inventory_maintenance_records_id_fk" FOREIGN KEY ("maintenance_record_id") REFERENCES "asset_inventory_maintenance_records"("id") ON DELETE cascade ON UPDATE no action
);
