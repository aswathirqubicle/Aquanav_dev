
-- Remove project_id column from credit_notes table
ALTER TABLE "credit_notes" DROP COLUMN IF EXISTS "project_id";

-- Remove foreign key constraint if it exists
ALTER TABLE "credit_notes" DROP CONSTRAINT IF EXISTS "credit_notes_project_id_projects_id_fk";
