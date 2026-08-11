-- Clear every photo group's daily activity link.
--
-- Creating a photo group used to link it to a daily activity automatically:
-- when no activity was chosen, the create route looked for any activity of the
-- same project on the same date and attached the first one the database
-- happened to return. That query had no ORDER BY, and this system stores one
-- activity record per location per day, so on a multi-location day the group
-- was attached to an arbitrary location — and an edit to that day, which
-- rewrites the rows, could change which one.
--
-- Linking is now explicit and optional: a group created without an activity
-- stays unlinked, and the link can be set, changed or removed afterwards from
-- the Photos tab.
--
-- Nothing records HOW an existing link was made, so a deliberate choice cannot
-- be told apart from an automatic guess. Every link is therefore cleared
-- rather than leaving unreliable ones in place. The completion report groups
-- photos by the linked activity's location, so until a group is re-linked its
-- photos print under the general heading instead of a location.
--
-- Idempotent: rows already NULL are excluded, so re-running changes nothing.

-- ---------------------------------------------------------------------------
-- PRE-MIGRATION CAPTURE (run BEFORE applying and keep the output)
-- ---------------------------------------------------------------------------
-- This migration is not reversible from the data it leaves behind. Save the
-- existing links first if they may need to be restored:
--
--   SELECT id, project_id, title, date, daily_activity_id
--   FROM project_photo_groups
--   WHERE daily_activity_id IS NOT NULL
--   ORDER BY project_id, id;

UPDATE project_photo_groups
SET daily_activity_id = NULL
WHERE daily_activity_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- VERIFICATION (run after applying — should return 0 rows)
-- ---------------------------------------------------------------------------
--   SELECT id, project_id, title, daily_activity_id
--   FROM project_photo_groups
--   WHERE daily_activity_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- ROLLBACK
-- ---------------------------------------------------------------------------
-- There is no automatic rollback: once cleared, the previous values are gone.
-- Reverting means replaying the PRE-MIGRATION CAPTURE output as UPDATE
-- statements, or restoring project_photo_groups from a pre-migration backup.
