
-- Manual script to create consumables tables
-- Run this if migration fails: psql $DATABASE_URL -f scripts/create_consumables_tables.sql

-- Drop tables if they exist (be careful with this in production)
DROP TABLE IF EXISTS "project_consumable_items" CASCADE;
DROP TABLE IF EXISTS "project_consumables" CASCADE;

-- Create project_consumables table
CREATE TABLE "project_consumables" (
    "id" SERIAL PRIMARY KEY,
    "project_id" INTEGER,
    "date" TIMESTAMP NOT NULL,
    "recorded_by" INTEGER,
    "recorded_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create project_consumable_items table
CREATE TABLE "project_consumable_items" (
    "id" SERIAL PRIMARY KEY,
    "consumable_id" INTEGER,
    "inventory_item_id" INTEGER,
    "quantity" INTEGER NOT NULL,
    "unit_cost" NUMERIC(10, 4)
);

-- Add foreign key constraints
ALTER TABLE "project_consumables" 
ADD CONSTRAINT "project_consumables_project_id_projects_id_fk" 
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "project_consumables" 
ADD CONSTRAINT "project_consumables_recorded_by_users_id_fk" 
FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "project_consumable_items" 
ADD CONSTRAINT "project_consumable_items_consumable_id_fk" 
FOREIGN KEY ("consumable_id") REFERENCES "project_consumables"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "project_consumable_items" 
ADD CONSTRAINT "project_consumable_items_inventory_item_id_fk" 
FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_project_consumables_project_id" ON "project_consumables"("project_id");
CREATE INDEX IF NOT EXISTS "idx_project_consumables_date" ON "project_consumables"("date");
CREATE INDEX IF NOT EXISTS "idx_project_consumable_items_consumable_id" ON "project_consumable_items"("consumable_id");
CREATE INDEX IF NOT EXISTS "idx_project_consumable_items_inventory_item_id" ON "project_consumable_items"("inventory_item_id");

-- Verify tables were created
SELECT 'project_consumables created' as status, count(*) as row_count FROM project_consumables;
SELECT 'project_consumable_items created' as status, count(*) as row_count FROM project_consumable_items;
