
CREATE TABLE IF NOT EXISTS "project_consumables" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"date" timestamp NOT NULL,
	"recorded_by" integer,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "project_consumable_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"consumable_id" integer,
	"inventory_item_id" integer,
	"quantity" integer NOT NULL,
	"unit_cost" numeric(10, 4)
);

DO $$ BEGIN
 ALTER TABLE "project_consumables" ADD CONSTRAINT "project_consumables_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "project_consumables" ADD CONSTRAINT "project_consumables_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "project_consumable_items" ADD CONSTRAINT "project_consumable_items_consumable_id_project_consumables_id_fk" FOREIGN KEY ("consumable_id") REFERENCES "project_consumables"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "project_consumable_items" ADD CONSTRAINT "project_consumable_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
