-- Backfill: mark already-billed sales quotations as converted.
--
-- Nothing in the system ever set a sales quotation to 'converted'. The Convert
-- to Invoice button only pre-filled the invoice form, and no code path touched
-- the quotation afterwards, so the status was unreachable and the Converted
-- filter could never match. Raising an invoice from a quotation now converts
-- it, but every quotation billed BEFORE that change still reads approved.
--
-- This corrects those rows. The condition matches the live rule exactly — a
-- quotation is converted once an invoice has been raised from it, whatever
-- that invoice's own status. Draft invoices count deliberately: the live code
-- marks on creation, and a backfill that disagreed would leave the same
-- quotation reading differently depending on which side of the change it fell.
--
-- Idempotent: rows already 'converted' are excluded, so re-running changes
-- nothing. No row is touched that has no invoice referencing it.

UPDATE sales_quotations q
SET status = 'converted'
WHERE q.status <> 'converted'
  AND EXISTS (
    SELECT 1 FROM sales_invoices i WHERE i.quotation_id = q.id
  );

-- ---------------------------------------------------------------------------
-- VERIFICATION (run after applying — both should return 0 rows)
-- ---------------------------------------------------------------------------
--   -- quotations with an invoice but not marked converted:
--   SELECT q.id, q.quotation_number, q.status
--   FROM sales_quotations q
--   WHERE q.status <> 'converted'
--     AND EXISTS (SELECT 1 FROM sales_invoices i WHERE i.quotation_id = q.id);
--
--   -- quotations marked converted with no invoice behind them:
--   SELECT q.id, q.quotation_number
--   FROM sales_quotations q
--   WHERE q.status = 'converted'
--     AND NOT EXISTS (SELECT 1 FROM sales_invoices i WHERE i.quotation_id = q.id);

-- ---------------------------------------------------------------------------
-- ROLLBACK
-- ---------------------------------------------------------------------------
-- There is no safe automatic rollback: this migration cannot distinguish the
-- rows it changed from those already converted by the application. Reverting
-- means restoring the affected rows from a pre-migration backup.
