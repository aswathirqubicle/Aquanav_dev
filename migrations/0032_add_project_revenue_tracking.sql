
-- Add total_revenue column to projects table for tracking revenue from invoice payments
ALTER TABLE "projects" ADD COLUMN "total_revenue" numeric(12, 2) DEFAULT '0';
