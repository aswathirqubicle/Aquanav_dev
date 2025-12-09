
-- Remove inventory_used column from daily_activities table
ALTER TABLE "daily_activities" DROP COLUMN IF EXISTS "inventory_used";
