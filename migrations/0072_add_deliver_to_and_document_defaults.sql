-- CR — "Deliver To" on purchase orders, and per-document default Notes/Terms.
--
-- deliver_to: purchase_orders has delivery *terms* and an expected *date* but
-- no address, so the Deliver To block on the client's own PO format had
-- nowhere to live. One free-text column, not structured fields, because
-- deliveries go to vessels and work sites as often as to the office —
-- "M/V Front Alta, Port Rashid berth 12" does not fit street/city/zip.
-- Nullable and stays nullable: the form pre-fills it from the company address
-- as a convenience, but an order with no delivery address is valid.
--
-- terms_and_conditions: the reference PO prints a Terms & Conditions section;
-- purchase_orders had only notes, so that block had no home.
--
-- document_defaults: the client's Notes and Terms are long standing
-- boilerplate ("attach this PO to the invoice", HKC/EU SRR clauses, ...)
-- identical on every document of a given type. One row per document type,
-- keyed by name rather than by columns on companies, so sales documents can
-- get their own defaults without another migration each time. These are
-- STARTING TEXT loaded into a new document — the user can edit or clear them
-- per document, so nothing here is enforced.

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS deliver_to text,
  ADD COLUMN IF NOT EXISTS terms_and_conditions text;

CREATE TABLE IF NOT EXISTS document_defaults (
  id serial PRIMARY KEY,
  -- sales_quotation | sales_invoice | proforma_invoice | credit_note
  -- | purchase_order | purchase_invoice
  document_type text NOT NULL UNIQUE,
  notes text,
  terms_and_conditions text,
  updated_at timestamp NOT NULL DEFAULT now(),
  updated_by_id integer REFERENCES users(id)
);

-- Undo the earlier local-only shape of this migration (two columns on
-- companies). Harmless where they never existed.
ALTER TABLE companies DROP COLUMN IF EXISTS po_default_notes;
ALTER TABLE companies DROP COLUMN IF EXISTS po_default_terms;

-- ---------------------------------------------------------------------------
-- VERIFICATION (run after applying)
-- ---------------------------------------------------------------------------
--   \d purchase_orders    -- deliver_to, terms_and_conditions present
--   \d document_defaults  -- table present, document_type unique

-- ---------------------------------------------------------------------------
-- ROLLBACK (commented; this project applies migrations by hand)
-- ---------------------------------------------------------------------------
-- DROP TABLE IF EXISTS document_defaults;
-- ALTER TABLE purchase_orders DROP COLUMN IF EXISTS terms_and_conditions;
-- ALTER TABLE purchase_orders DROP COLUMN IF EXISTS deliver_to;
