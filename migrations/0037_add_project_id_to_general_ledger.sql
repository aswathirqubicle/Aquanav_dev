
-- Add project_id column to general_ledger_entries table
ALTER TABLE general_ledger_entries ADD COLUMN project_id INTEGER;

-- Create index for better performance on project filtering
CREATE INDEX IF NOT EXISTS idx_general_ledger_project_id ON general_ledger_entries(project_id);
