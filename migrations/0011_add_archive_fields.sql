
-- Add isArchived field to customers table
ALTER TABLE "customers" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;

-- Add isArchived field to suppliers table
ALTER TABLE "suppliers" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;
