CREATE TABLE "invoice_edit_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_type" text NOT NULL,
	"invoice_id" integer NOT NULL,
	"edit_note" text NOT NULL,
	"changes" json,
	"edited_by" integer,
	"edited_by_name" text,
	"edited_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice_edit_history" ADD CONSTRAINT "invoice_edit_history_edited_by_users_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;