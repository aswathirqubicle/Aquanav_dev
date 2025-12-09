
-- Add start_date, end_date, and assigned_at columns to project_employees table
ALTER TABLE project_employees 
ADD COLUMN start_date timestamp,
ADD COLUMN end_date timestamp,
ADD COLUMN assigned_at timestamp DEFAULT NOW() NOT NULL;
