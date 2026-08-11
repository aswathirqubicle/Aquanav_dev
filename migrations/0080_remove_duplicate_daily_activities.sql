-- Remove duplicate daily activity records created by double submission.
--
-- WHAT A DUPLICATE IS HERE
--
-- A day holds one activity record per location, and the same location
-- legitimately repeats within a day carrying different work — project 3 logged
-- eight records for "No.4 C/H Hatch Top sides" on 27 June 2026, one per stage.
-- Matching on project, date and location alone would treat several hundred
-- records as duplicates and delete a third of the recorded work. The tasks have
-- to be part of the key.
--
-- Comparing every column is too strict in the other direction. The update route
-- enforces one remark per project per day by blanking remarks on every other
-- record for that date, so a duplicated pair routinely ends up as one row
-- holding the day's remark and its twin holding NULL. Those are not exact
-- matches, but they are the same double submission.
--
-- So records are grouped on every business column EXCEPT remarks, and each
-- group is then resolved by its remarks:
--
--   * At most one distinct remark in the group — keep the row carrying it, or
--     the lowest id when no row has one, and delete the rest.
--   * Two or more rows with DIFFERENT remarks — leave the whole group alone.
--     That is an edit history rather than a double submission, and choosing
--     which text to discard is not a decision a migration should make. The
--     verification query below surfaces these for a human to resolve.
--
-- Timestamps are compared exactly, not by calendar day, so two entries recorded
-- at different times are never treated as duplicates.
--
-- Idempotent: a group reduced to one row stops matching.
--
-- project_photo_groups.daily_activity_id is the only foreign key into this
-- table, and groups do point at rows this removes, so they are moved to the
-- surviving record first — otherwise the delete fails on the constraint.
-- Migration 0079 nulls every link anyway, making that step a no-op once 0079
-- has run; it is kept so this migration stands on its own.

-- ---------------------------------------------------------------------------
-- SURVEY (run BEFORE applying — keep the output, it is the only record)
-- ---------------------------------------------------------------------------
--   SELECT project_id, date, location, left(completed_tasks, 50) AS tasks,
--          count(*) AS copies,
--          count(DISTINCT nullif(btrim(coalesce(remarks, '')), '')) AS distinct_remarks,
--          array_agg(id ORDER BY id) AS ids
--   FROM daily_activities
--   GROUP BY project_id, date, location, completed_tasks, planned_tasks,
--            hbm_daily_running_hours, is_stoppage, stoppage_reason, photos::text
--   HAVING count(*) > 1
--   ORDER BY project_id, date;
--
-- Rows where distinct_remarks >= 2 are NOT touched and need a human decision.

-- 1. Move photo groups off the records that are about to go.
WITH keys AS (
  SELECT project_id, date, location, completed_tasks, planned_tasks,
         hbm_daily_running_hours, is_stoppage, stoppage_reason,
         photos::text AS photos_txt,
         count(*) AS group_size,
         count(DISTINCT nullif(btrim(coalesce(remarks, '')), '')) AS distinct_remarks,
         coalesce(
           min(id) FILTER (WHERE nullif(btrim(coalesce(remarks, '')), '') IS NOT NULL),
           min(id)
         ) AS keep_id
  FROM daily_activities
  GROUP BY project_id, date, location, completed_tasks, planned_tasks,
           hbm_daily_running_hours, is_stoppage, stoppage_reason, photos::text
  HAVING count(*) > 1
),
doomed AS (
  SELECT d.id, k.keep_id
  FROM daily_activities d
  JOIN keys k
    ON d.project_id IS NOT DISTINCT FROM k.project_id
   AND d.date = k.date
   AND d.location IS NOT DISTINCT FROM k.location
   AND d.completed_tasks IS NOT DISTINCT FROM k.completed_tasks
   AND d.planned_tasks IS NOT DISTINCT FROM k.planned_tasks
   AND d.hbm_daily_running_hours IS NOT DISTINCT FROM k.hbm_daily_running_hours
   AND d.is_stoppage IS NOT DISTINCT FROM k.is_stoppage
   AND d.stoppage_reason IS NOT DISTINCT FROM k.stoppage_reason
   AND d.photos::text = k.photos_txt
  WHERE k.distinct_remarks <= 1
    AND d.id <> k.keep_id
)
UPDATE project_photo_groups g
SET daily_activity_id = doomed.keep_id
FROM doomed
WHERE g.daily_activity_id = doomed.id;

-- 2. Delete the duplicates.
WITH keys AS (
  SELECT project_id, date, location, completed_tasks, planned_tasks,
         hbm_daily_running_hours, is_stoppage, stoppage_reason,
         photos::text AS photos_txt,
         count(*) AS group_size,
         count(DISTINCT nullif(btrim(coalesce(remarks, '')), '')) AS distinct_remarks,
         coalesce(
           min(id) FILTER (WHERE nullif(btrim(coalesce(remarks, '')), '') IS NOT NULL),
           min(id)
         ) AS keep_id
  FROM daily_activities
  GROUP BY project_id, date, location, completed_tasks, planned_tasks,
           hbm_daily_running_hours, is_stoppage, stoppage_reason, photos::text
  HAVING count(*) > 1
),
doomed AS (
  SELECT d.id
  FROM daily_activities d
  JOIN keys k
    ON d.project_id IS NOT DISTINCT FROM k.project_id
   AND d.date = k.date
   AND d.location IS NOT DISTINCT FROM k.location
   AND d.completed_tasks IS NOT DISTINCT FROM k.completed_tasks
   AND d.planned_tasks IS NOT DISTINCT FROM k.planned_tasks
   AND d.hbm_daily_running_hours IS NOT DISTINCT FROM k.hbm_daily_running_hours
   AND d.is_stoppage IS NOT DISTINCT FROM k.is_stoppage
   AND d.stoppage_reason IS NOT DISTINCT FROM k.stoppage_reason
   AND d.photos::text = k.photos_txt
  WHERE k.distinct_remarks <= 1
    AND d.id <> k.keep_id
)
DELETE FROM daily_activities WHERE id IN (SELECT id FROM doomed);

-- ---------------------------------------------------------------------------
-- VERIFICATION (run after applying)
-- ---------------------------------------------------------------------------
-- Should return only groups with two or more DIFFERENT remarks — the ones this
-- migration deliberately leaves for a human:
--
--   SELECT project_id, date, location, count(*) AS copies,
--          array_agg(id ORDER BY id) AS ids,
--          array_agg(DISTINCT remarks) AS remarks
--   FROM daily_activities
--   GROUP BY project_id, date, location, completed_tasks, planned_tasks,
--            hbm_daily_running_hours, is_stoppage, stoppage_reason, photos::text
--   HAVING count(*) > 1;
--
-- And no photo group should point at a missing activity:
--
--   SELECT g.id FROM project_photo_groups g
--   LEFT JOIN daily_activities d ON d.id = g.daily_activity_id
--   WHERE g.daily_activity_id IS NOT NULL AND d.id IS NULL;

-- ---------------------------------------------------------------------------
-- ROLLBACK
-- ---------------------------------------------------------------------------
-- There is no automatic rollback: the deleted rows are gone. Reverting means
-- restoring daily_activities, and project_photo_groups alongside it, from a
-- pre-migration backup. The SURVEY output identifies the affected rows but does
-- not carry their column values.
