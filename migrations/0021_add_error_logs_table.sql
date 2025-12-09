
CREATE TABLE IF NOT EXISTS "error_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"url" text,
	"user_agent" text,
	"user_id" integer,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"severity" text DEFAULT 'error' NOT NULL,
	"component" text,
	"resolved" boolean DEFAULT false NOT NULL
);

CREATE INDEX IF NOT EXISTS "error_logs_timestamp_idx" ON "error_logs" ("timestamp");
CREATE INDEX IF NOT EXISTS "error_logs_user_id_idx" ON "error_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "error_logs_severity_idx" ON "error_logs" ("severity");
