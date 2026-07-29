-- CR4 — email notifications via Microsoft Graph.
--
-- Three tables:
--
-- email_settings holds the Entra app registration the client sends mail
-- through. Single row — there is one sending identity for the company — kept as
-- a table rather than columns on `companies` so the credential lives somewhere
-- that can be granted separately from general company settings.
--
--   client_secret_encrypted stores CIPHERTEXT, never the raw secret. It is
--   encrypted by the application with a key held only in the environment, so a
--   database dump — including the JSON that GET /api/system/backup produces —
--   does not hand over a credential that can send mail as the company. The
--   column is named for what it holds so nobody later writes a plaintext value
--   into it by mistake.
--
-- notification_log is what makes sending idempotent. A reminder fires once per
-- (notification, milestone) and never again, so a server restart, a job that
-- runs twice in a day, or two app instances sharing this database cannot send
-- the same reminder twice. The unique constraint is the mechanism, not the
-- application logic.
--
--   For an expiry reminder:  ('document_expiry', 'employee_document', 42, '3_months')
--   For the monthly digest:  ('monthly_digest', 'digest', 0, '2026-08')
--
-- email_send_log records each individual send attempt and its outcome, so a
-- failure is visible rather than silent. It is deliberately separate from
-- notification_log: one notification can email several recipients, and one
-- recipient failing must not cause the whole notification to be retried and
-- re-delivered to everyone else.

CREATE TABLE IF NOT EXISTS email_settings (
  id serial PRIMARY KEY,
  tenant_id text,
  client_id text,
  client_secret_id text,
  client_secret_encrypted text,
  sender_email text,
  is_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamp NOT NULL DEFAULT now(),
  updated_by_id integer REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notification_log (
  id serial PRIMARY KEY,
  notification_type text NOT NULL,
  document_type text NOT NULL,
  document_id integer NOT NULL,
  milestone text NOT NULL,
  sent_at timestamp NOT NULL DEFAULT now()
);

-- The idempotency guarantee. Without this the application would be relying on
-- check-then-insert, which races between two instances.
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_log_unique
  ON notification_log (notification_type, document_type, document_id, milestone);

CREATE TABLE IF NOT EXISTS email_send_log (
  id serial PRIMARY KEY,
  to_email text NOT NULL,
  subject text,
  template text,
  status text NOT NULL,
  error text,
  related_type text,
  related_id integer,
  sent_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_send_log_sent_at
  ON email_send_log (sent_at);

-- ---------------------------------------------------------------------------
-- VERIFICATION (run after applying)
-- ---------------------------------------------------------------------------
--   \d email_settings        -- client_secret_encrypted present
--   \d notification_log      -- idx_notification_log_unique present
--   \d email_send_log
--   SELECT count(*) FROM email_settings;   -- 0 until configured in Settings

-- ---------------------------------------------------------------------------
-- ROLLBACK (commented; this project applies migrations by hand)
-- ---------------------------------------------------------------------------
-- DROP INDEX IF EXISTS idx_email_send_log_sent_at;
-- DROP TABLE IF EXISTS email_send_log;
-- DROP INDEX IF EXISTS idx_notification_log_unique;
-- DROP TABLE IF EXISTS notification_log;
-- DROP TABLE IF EXISTS email_settings;
