
-- Create payment_files table
CREATE TABLE IF NOT EXISTS "payment_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"original_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraint
ALTER TABLE "payment_files" ADD CONSTRAINT "payment_files_payment_id_invoice_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "invoice_payments"("id") ON DELETE cascade ON UPDATE no action;

-- Create index for better query performance
CREATE INDEX "payment_files_payment_id_idx" ON "payment_files" ("payment_id");
