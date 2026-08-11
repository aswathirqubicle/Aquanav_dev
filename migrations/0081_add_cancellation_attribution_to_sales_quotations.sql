-- Who cancelled a sales quotation, when, and why.
--
-- An approved quotation is a price already put to the customer. Until now the
-- only way to take one off the table was to edit it (which sends it back for
-- approval) or archive it (which merely hides it from the default list and says
-- nothing about why). Neither records a decision, so a withdrawn price left no
-- trace of who withdrew it.
--
-- These mirror the columns migration 0078 added to sales_invoices and
-- purchase_invoices, so a cancellation reads as one more step on the same
-- approval trail — submitted_by_id, approved_by_id, cancelled_by_id — rather
-- than as a separate kind of record.
--
-- Unlike an invoice, a quotation posts nothing to the ledger, moves no stock
-- and contributes no project revenue, so cancelling one reverses nothing. It is
-- a status change plus attribution and nothing more.
--
-- No backfill: no quotation has ever held status 'cancelled', so there are no
-- existing rows whose attribution needs reconstructing.

ALTER TABLE sales_quotations
  ADD COLUMN IF NOT EXISTS cancelled_by_id integer REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS cancelled_at timestamp,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;
