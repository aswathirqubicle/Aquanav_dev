
-- Update general ledger status constraint to include 'issued'
ALTER TABLE general_ledger_entries 
DROP CONSTRAINT IF EXISTS general_ledger_entries_status_check;

ALTER TABLE general_ledger_entries 
ADD CONSTRAINT general_ledger_entries_status_check 
CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled', 'active', 'issued'));
