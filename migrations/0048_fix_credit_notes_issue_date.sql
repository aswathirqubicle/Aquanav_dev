
-- Drop the issue_date column if it exists and add credit_note_date
ALTER TABLE "credit_notes" DROP COLUMN IF EXISTS "issue_date";
ALTER TABLE "credit_notes" ADD COLUMN IF NOT EXISTS "credit_note_date" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Ensure all required columns exist
ALTER TABLE "credit_notes" ADD COLUMN IF NOT EXISTS "reason" text;
ALTER TABLE "credit_notes" ADD COLUMN IF NOT EXISTS "items" json DEFAULT '[]'::json;
ALTER TABLE "credit_notes" ADD COLUMN IF NOT EXISTS "subtotal" numeric(12, 2);
ALTER TABLE "credit_notes" ADD COLUMN IF NOT EXISTS "tax_amount" numeric(10, 2);
ALTER TABLE "credit_notes" ADD COLUMN IF NOT EXISTS "discount" numeric(10, 2) DEFAULT '0';
ALTER TABLE "credit_notes" ADD COLUMN IF NOT EXISTS "total_amount" numeric(12, 2);
ALTER TABLE "credit_notes" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;

-- Remove project_id column if it exists (as per the requirement)
ALTER TABLE "credit_notes" DROP COLUMN IF EXISTS "project_id";
ALTER TABLE "credit_notes" DROP CONSTRAINT IF EXISTS "credit_notes_project_id_projects_id_fk";
