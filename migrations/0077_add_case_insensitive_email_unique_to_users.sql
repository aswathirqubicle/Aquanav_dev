-- Email uniqueness must ignore case: Admin@x.com and admin@x.com are the same
-- account and only one of them may exist.
--
-- The existing users_email_unique constraint is an exact match, so it lets both
-- of those rows in. This index enforces the intended rule in the database.
-- It is needed in addition to the check in the users route because users are
-- also created from the employee module (server/routes/employees.routes.ts)
-- and from the database seed (server/init-db.ts), neither of which goes
-- through that route.
--
-- users_email_unique is deliberately left in place; it is implied by this
-- index and removing it is not needed for the rule to hold.
--
-- Before applying: this will fail if two rows already differ only by case.
-- Check first, and reconcile any matches by hand:
--
--   SELECT lower(email), count(*), array_agg(email), array_agg(id)
--   FROM users
--   GROUP BY lower(email)
--   HAVING count(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
  ON users (lower(email));
