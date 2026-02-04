ALTER TABLE projects
ADD COLUMN additional_field_4_title TEXT,
ADD COLUMN additional_field_4_description TEXT,
ADD COLUMN additional_field_5_title TEXT,
ADD COLUMN additional_field_5_description TEXT,
ADD COLUMN additional_field_6_title TEXT,
ADD COLUMN additional_field_6_description TEXT;

ALTER TABLE asset_maintenance_records
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS start_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS completed_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS maintenance_type VARCHAR(255);
