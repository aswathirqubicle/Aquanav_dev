-- Indexes for the purchase module, plus the one-employee-per-login rule.
--
-- The purchase tables carried only their primary keys and the unique document
-- number constraints — 99 foreign keys across the schema, none of them indexed.
-- Every child lookup (items, files, payments for a document) and every
-- paginated list sort was a sequential scan. Fine at UAT volume; it is the
-- first thing to bite as order and invoice counts grow.
--
-- Two kinds of index here:
--   1. The foreign keys the purchase queries actually join or filter on.
--   2. created_at on the parent tables, which every paginated list orders by
--      (ORDER BY created_at DESC with OFFSET), so the sort can use an index
--      instead of re-sorting the whole matching set per page.
--
-- CONCURRENTLY is deliberately not used: it cannot run inside a transaction
-- block, and these tables are small enough that a brief lock is not a concern.
-- Revisit that if this is ever applied to a much larger dataset.

-- Purchase order children
CREATE INDEX IF NOT EXISTS "idx_purchase_order_items_po_id"
  ON "purchase_order_items" ("po_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_purchase_order_files_po_id"
  ON "purchase_order_files" ("po_id");--> statement-breakpoint

-- Purchase invoice children
CREATE INDEX IF NOT EXISTS "idx_purchase_invoice_items_invoice_id"
  ON "purchase_invoice_items" ("invoice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_purchase_invoice_files_invoice_id"
  ON "purchase_invoice_files" ("invoice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_purchase_invoice_payments_invoice_id"
  ON "purchase_invoice_payments" ("invoice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_purchase_payment_files_payment_id"
  ON "purchase_payment_files" ("payment_id");--> statement-breakpoint

-- Purchase request children
CREATE INDEX IF NOT EXISTS "idx_purchase_request_items_request_id"
  ON "purchase_request_items" ("request_id");--> statement-breakpoint

-- Supplier filters on the list screens
CREATE INDEX IF NOT EXISTS "idx_purchase_orders_supplier_id"
  ON "purchase_orders" ("supplier_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_purchase_invoices_supplier_id"
  ON "purchase_invoices" ("supplier_id");--> statement-breakpoint

-- purchase_invoices.po_id is joined to resolve the linked order's number
CREATE INDEX IF NOT EXISTS "idx_purchase_invoices_po_id"
  ON "purchase_invoices" ("po_id");--> statement-breakpoint

-- Paginated list ordering
CREATE INDEX IF NOT EXISTS "idx_purchase_orders_created_at"
  ON "purchase_orders" ("created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_purchase_invoices_created_at"
  ON "purchase_invoices" ("created_at" DESC);--> statement-breakpoint

-- Edit history is looked up by (invoice_type, invoice_id) on every document view
CREATE INDEX IF NOT EXISTS "idx_invoice_edit_history_type_invoice"
  ON "invoice_edit_history" ("invoice_type", "invoice_id");--> statement-breakpoint

-- One employee per login. employees.user_id had a foreign key but no unique
-- constraint, so two employee rows could share a user. Every query resolving a
-- submitter or approver to a name joins users -> employees on this column, and
-- a duplicate there would multiply the parent rows — silently doubling entries
-- in a paginated list. Confirmed as the intended rule.
--
-- Verify BEFORE applying; this will fail if any duplicates exist:
--   SELECT user_id, count(*) FROM employees
--    WHERE user_id IS NOT NULL GROUP BY user_id HAVING count(*) > 1;
-- (Zero rows at the time of writing.) NULL user_id is unaffected: Postgres
-- allows any number of NULLs in a unique index, so unlinked employees are fine.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_employees_user_id_unique"
  ON "employees" ("user_id");

-- ---------------------------------------------------------------------------
-- ROLLBACK (commented; this project applies migrations by hand)
-- ---------------------------------------------------------------------------
-- DROP INDEX IF EXISTS "idx_employees_user_id_unique";
-- DROP INDEX IF EXISTS "idx_invoice_edit_history_type_invoice";
-- DROP INDEX IF EXISTS "idx_purchase_invoices_created_at";
-- DROP INDEX IF EXISTS "idx_purchase_orders_created_at";
-- DROP INDEX IF EXISTS "idx_purchase_invoices_po_id";
-- DROP INDEX IF EXISTS "idx_purchase_invoices_supplier_id";
-- DROP INDEX IF EXISTS "idx_purchase_orders_supplier_id";
-- DROP INDEX IF EXISTS "idx_purchase_request_items_request_id";
-- DROP INDEX IF EXISTS "idx_purchase_payment_files_payment_id";
-- DROP INDEX IF EXISTS "idx_purchase_invoice_payments_invoice_id";
-- DROP INDEX IF EXISTS "idx_purchase_invoice_files_invoice_id";
-- DROP INDEX IF EXISTS "idx_purchase_invoice_items_invoice_id";
-- DROP INDEX IF EXISTS "idx_purchase_order_files_po_id";
-- DROP INDEX IF EXISTS "idx_purchase_order_items_po_id";
