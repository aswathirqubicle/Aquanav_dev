
CREATE TABLE IF NOT EXISTS "asset_maintenance_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_id" integer NOT NULL,
	"maintenance_cost" numeric(10, 2) NOT NULL,
	"maintenance_date" timestamp DEFAULT now() NOT NULL,
	"description" text,
	"performed_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "asset_maintenance_records_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "asset_maintenance_records_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "asset_maintenance_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"maintenance_record_id" integer NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_size" integer,
	"content_type" varchar(100),
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "asset_maintenance_files_maintenance_record_id_asset_maintenance_records_id_fk" FOREIGN KEY ("maintenance_record_id") REFERENCES "asset_maintenance_records"("id") ON DELETE cascade ON UPDATE no action
);
