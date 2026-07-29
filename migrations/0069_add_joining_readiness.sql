-- CR5d/CR6 — employee "Joining Readiness" date and its change history.
--
-- Readiness is the date an employee expects to be available to deploy. It is
-- optional: a null date simply means the employee has not stated one, which is
-- why the column is nullable and carries no default.
--
-- Both the employee (from their Profile) and an admin (from the employee's
-- Basic Info tab) can set it, so who changed it and when has to be recorded —
-- an admin needs to see whether a date came from the employee or was entered on
-- their behalf. employee_readiness_history keeps that trail; it mirrors
-- invoice_edit_history, which is the existing precedent for this shape.
--
-- old_date is nullable because the first entry has nothing before it, and
-- new_date is nullable because clearing the date is itself a change worth
-- recording.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS joining_readiness_date date;

CREATE TABLE IF NOT EXISTS employee_readiness_history (
  id serial PRIMARY KEY,
  employee_id integer NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  old_date date,
  new_date date,
  changed_by integer REFERENCES users(id),
  changed_by_name text,
  changed_at timestamp NOT NULL DEFAULT now()
);

-- The report filters on a date range and the history is always read per
-- employee. Both are small today, but these are the two access paths.
CREATE INDEX IF NOT EXISTS idx_employees_joining_readiness_date
  ON employees (joining_readiness_date);

CREATE INDEX IF NOT EXISTS idx_employee_readiness_history_employee_id
  ON employee_readiness_history (employee_id);

-- ---------------------------------------------------------------------------
-- VERIFICATION (run after applying)
-- ---------------------------------------------------------------------------
--   \d employees                     -- joining_readiness_date present, nullable
--   \d employee_readiness_history    -- table present with both indexes
--   SELECT count(*) FROM employee_readiness_history;   -- 0 on a fresh apply

-- ---------------------------------------------------------------------------
-- ROLLBACK (commented; this project applies migrations by hand)
-- ---------------------------------------------------------------------------
-- DROP INDEX IF EXISTS idx_employee_readiness_history_employee_id;
-- DROP INDEX IF EXISTS idx_employees_joining_readiness_date;
-- DROP TABLE IF EXISTS employee_readiness_history;
-- ALTER TABLE employees DROP COLUMN IF EXISTS joining_readiness_date;
