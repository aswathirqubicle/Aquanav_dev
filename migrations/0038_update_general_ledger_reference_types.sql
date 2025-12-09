
-- Update general ledger reference type constraint to include payroll
ALTER TABLE general_ledger_entries 
DROP CONSTRAINT general_ledger_entries_reference_type_check;

ALTER TABLE general_ledger_entries 
ADD CONSTRAINT general_ledger_entries_reference_type_check 
CHECK (reference_type IN ('sales_invoice', 'purchase_invoice', 'payment', 'manual', 'payroll'));
