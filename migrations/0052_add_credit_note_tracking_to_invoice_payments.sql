
-- Add credit note tracking fields to invoice_payments table
ALTER TABLE "invoice_payments" ADD COLUMN IF NOT EXISTS "payment_type" text DEFAULT 'payment' NOT NULL;
ALTER TABLE "invoice_payments" ADD COLUMN IF NOT EXISTS "credit_note_id" integer;

-- Add foreign key constraint for credit note reference
DO $$ BEGIN
 ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_credit_note_id_credit_notes_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "credit_notes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
