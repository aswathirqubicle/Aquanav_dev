
-- Add columns to payroll_entries table
ALTER TABLE payroll_entries 
ADD COLUMN IF NOT EXISTS total_additions DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_deductions DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS additions json DEFAULT '[]',
ADD COLUMN IF NOT EXISTS deductions json DEFAULT '[]';

-- Create payroll_additions table
CREATE TABLE IF NOT EXISTS payroll_additions (
  id SERIAL PRIMARY KEY,
  payroll_entry_id INTEGER REFERENCES payroll_entries(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  note TEXT
);

-- Create payroll_deductions table
CREATE TABLE IF NOT EXISTS payroll_deductions (
  id SERIAL PRIMARY KEY,
  payroll_entry_id INTEGER REFERENCES payroll_entries(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  note TEXT
);
