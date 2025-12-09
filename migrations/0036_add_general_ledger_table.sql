
-- Create general ledger table for tracking payables and receivables
CREATE TABLE IF NOT EXISTS general_ledger_entries (
  id SERIAL PRIMARY KEY,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('payable', 'receivable')),
  reference_type TEXT NOT NULL CHECK (reference_type IN ('sales_invoice', 'purchase_invoice', 'payment', 'manual')),
  reference_id INTEGER,
  account_name TEXT NOT NULL,
  description TEXT NOT NULL,
  debit_amount DECIMAL(12,2) DEFAULT 0,
  credit_amount DECIMAL(12,2) DEFAULT 0,
  entity_id INTEGER, -- customer_id for receivables, supplier_id for payables
  entity_name TEXT,
  invoice_number TEXT,
  transaction_date DATE NOT NULL,
  due_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER,
  notes TEXT
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_general_ledger_entry_type ON general_ledger_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_general_ledger_reference ON general_ledger_entries(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_general_ledger_entity ON general_ledger_entries(entity_id);
CREATE INDEX IF NOT EXISTS idx_general_ledger_status ON general_ledger_entries(status);
CREATE INDEX IF NOT EXISTS idx_general_ledger_transaction_date ON general_ledger_entries(transaction_date);
