ALTER TABLE "daily_activities" ADD COLUMN IF NOT EXISTS "is_stoppage" boolean DEFAULT false;
ALTER TABLE "daily_activities" ADD COLUMN IF NOT EXISTS "stoppage_reason" text;
