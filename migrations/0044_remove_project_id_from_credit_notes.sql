-- Add missing columns to credit_notes table
ALTER TABLE "credit_notes" ADD COLUMN IF NOT EXISTS "project_id" integer;
ALTER TABLE "credit_notes" ADD COLUMN IF NOT EXISTS "credit_note_date" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Add foreign key constraint for project_id if it doesn't exist
DO $$ BEGIN
 ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;