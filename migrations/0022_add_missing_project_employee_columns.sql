
-- Add missing columns to project_employees table
ALTER TABLE project_employees 
ADD COLUMN IF NOT EXISTS start_date timestamp,
ADD COLUMN IF NOT EXISTS end_date timestamp,
ADD COLUMN IF NOT EXISTS assigned_at timestamp DEFAULT now();
