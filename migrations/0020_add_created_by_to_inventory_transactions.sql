
-- Add createdBy field to inventory_transactions table
ALTER TABLE "inventory_transactions" ADD COLUMN "created_by" integer;

-- Add foreign key constraint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
