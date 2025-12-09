
-- Add isArchived field to sales_quotations table
ALTER TABLE "sales_quotations" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;
