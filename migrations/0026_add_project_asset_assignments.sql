
CREATE TABLE IF NOT EXISTS "project_asset_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"asset_id" integer,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"daily_rate" numeric(10, 2) NOT NULL,
	"total_cost" numeric(12, 2) NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"assigned_by" integer
);

DO $$ BEGIN
 ALTER TABLE "project_asset_assignments" ADD CONSTRAINT "project_asset_assignments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "project_asset_assignments" ADD CONSTRAINT "project_asset_assignments_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "project_asset_assignments" ADD CONSTRAINT "project_asset_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_project_asset_assignments_project_id" ON "project_asset_assignments"("project_id");
CREATE INDEX IF NOT EXISTS "idx_project_asset_assignments_asset_id" ON "project_asset_assignments"("asset_id");
CREATE INDEX IF NOT EXISTS "idx_project_asset_assignments_dates" ON "project_asset_assignments"("start_date", "end_date");
