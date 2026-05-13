CREATE TABLE "locations" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" text NOT NULL UNIQUE,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);
