-- Create purchase order files table
CREATE TABLE IF NOT EXISTS purchase_order_files (
    id SERIAL PRIMARY KEY,
    po_id INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Foreign key constraint (safe for re-run)
DO $$
BEGIN
    ALTER TABLE purchase_order_files
    ADD CONSTRAINT purchase_order_files_po_id_purchase_orders_id_fk
    FOREIGN KEY (po_id)
    REFERENCES purchase_orders(id)
    ON DELETE CASCADE
    ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Index for faster lookups by purchase order
CREATE INDEX IF NOT EXISTS idx_purchase_order_files_po_id
ON purchase_order_files(po_id);
