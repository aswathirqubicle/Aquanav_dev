-- Store the VesselFinder API key in the database instead of the environment.
--
-- The Live Location tab on a project calls VesselFinder with an account key.
-- Until now that key lived in the VESSEL_FINDER_API_KEY environment variable,
-- which meant changing it needed shell access to the server. It is now saved by
-- an admin in Settings, System tab.
--
-- vessel_finder_settings holds a single row.
--
--   api_key_encrypted stores CIPHERTEXT, never the raw key. It is encrypted by
--   the application with the same environment-held key that protects the email
--   client secret (EMAIL_ENCRYPTION_KEY), so a database dump — including the
--   JSON that GET /api/system/backup produces — does not hand over a key that
--   spends VesselFinder credits. The API never returns it; the page is only
--   told whether one is stored.

CREATE TABLE IF NOT EXISTS vessel_finder_settings (
  id serial PRIMARY KEY,
  api_key_encrypted text,
  updated_at timestamp NOT NULL DEFAULT now(),
  updated_by_id integer REFERENCES users(id)
);
