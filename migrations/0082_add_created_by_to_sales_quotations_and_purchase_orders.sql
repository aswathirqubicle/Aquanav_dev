-- Who raised a sales quotation or a purchase order.
--
-- Project managers are being given these two documents, but only their own:
-- they may open, edit and submit what they raised, and nothing else. Neither
-- table could express that. Both record submitted_by_id, approved_by_id and
-- (for quotations) cancelled_by_id, but none of those is the author —
-- submitted_by_id is null until the document is sent for approval, which is
-- precisely the draft stage where its owner most needs to find it.
--
-- purchase_requests has carried requested_by for exactly this purpose since the
-- beginning, and the list query narrows on it for any role that is not admin or
-- finance. These two columns let sales_quotations and purchase_orders be scoped
-- the same way rather than inventing a second mechanism.
--
-- Deliberately nullable, and deliberately not backfilled. Nothing in either
-- table records who created these rows, so any value assigned to the existing
-- ones would be a guess — submitted_by_id is the closest candidate and is still
-- only the person who sent it onward, not necessarily its author. A null means
-- "unknown", which is the truth. The practical effect is that existing
-- documents belong to nobody and so are invisible to project managers, while
-- admin and finance continue to see everything exactly as before.

ALTER TABLE sales_quotations
  ADD COLUMN IF NOT EXISTS created_by_id integer REFERENCES users(id);

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS created_by_id integer REFERENCES users(id);

-- The scoped list queries filter on this column for every non-admin role, so it
-- is on the hot path for those users once project managers start using it.
CREATE INDEX IF NOT EXISTS idx_sales_quotations_created_by_id
  ON sales_quotations (created_by_id);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_by_id
  ON purchase_orders (created_by_id);
