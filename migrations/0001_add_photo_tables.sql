
-- Create project photo groups table
CREATE TABLE IF NOT EXISTS "project_photo_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"title" text NOT NULL,
	"date" timestamp NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer
);

-- Create project photos table  
CREATE TABLE IF NOT EXISTS "project_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer,
	"filename" text NOT NULL,
	"original_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "project_photo_groups" ADD CONSTRAINT "project_photo_groups_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "project_photo_groups" ADD CONSTRAINT "project_photo_groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "project_photos" ADD CONSTRAINT "project_photos_group_id_project_photo_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "project_photo_groups"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
