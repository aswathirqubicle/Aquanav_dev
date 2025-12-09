
ALTER TABLE "proforma_invoices" ADD COLUMN "invoice_date" timestamp DEFAULT now() NOT NULL;
