-- CR — Terms & Conditions on purchase invoices.
--
-- purchase_invoices had notes and bank_account but no terms column, so the
-- printed invoice had nowhere to put the Terms & Conditions block its sibling
-- documents carry. The PDF was printing bank details under a "Terms &
-- Conditions" heading for want of anywhere better, which mislabels them.
--
-- Nullable and stays nullable: an invoice with no standing terms is valid.
-- The form pre-fills it from Settings -> Documents Default (the
-- purchase_invoice row of document_defaults, added in 0072) as a starting
-- point, and it can be edited or cleared per invoice.

ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS terms_and_conditions text;

-- ---------------------------------------------------------------------------
-- VERIFICATION (run after applying)
-- ---------------------------------------------------------------------------
--   \d purchase_invoices   -- terms_and_conditions present, nullable

-- ---------------------------------------------------------------------------
-- ROLLBACK (commented; this project applies migrations by hand)
-- ---------------------------------------------------------------------------
-- ALTER TABLE purchase_invoices DROP COLUMN IF EXISTS terms_and_conditions;
