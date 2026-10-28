-- Cache the last vessel position VesselFinder gave us, per project.
--
-- The project page's Live Location tab calls VesselFinder, which bills a credit
-- for every position it returns. Until now the call was keyed on the IMO alone,
-- needed no login, and ran every five minutes from every open browser, so the
-- credit spend scaled with how many people had the tab open rather than with
-- how many vessels we follow.
--
-- The position now lives on the project. A request within four hours of the
-- last fetch is answered from these columns without calling VesselFinder; the
-- stored data carries the IMO it was fetched for, so changing a project's IMO
-- never serves the old vessel's position.
--
-- Deliberately nullable, and deliberately not backfilled: null means "never
-- fetched", which is the truth for every existing project.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS vessel_location_data jsonb;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS vessel_location_fetched_at timestamp;
