CREATE TABLE "locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD COLUMN "consumable_id" integer;--> statement-breakpoint
ALTER TABLE "project_consumables" ADD COLUMN "goods_issue_ref" text;
