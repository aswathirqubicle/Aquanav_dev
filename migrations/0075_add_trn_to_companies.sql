-- CR — the company's own TRN.
--
-- companies carried no tax identifier of any kind: not a VAT number, not a
-- Tax ID. Customers and suppliers have both, and the document templates
-- already render a TRN block for the issuing company — it simply had no value
-- to print, so no document ever showed one.
--
-- UAE VAT requires the supplier's TRN on a tax invoice and on a tax credit
-- note, so without this no document Aquanav issues is complete.
--
-- Named vat_number rather than trn to match customers and suppliers, which
-- both store the same thing under that name; the forms and documents label it
-- TRN, which is the UAE term for it. Nullable, so a company that is not
-- VAT-registered simply has none and the block stays off the page.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS vat_number text;

-- ---------------------------------------------------------------------------
-- VERIFICATION (run after applying)
-- ---------------------------------------------------------------------------
--   \d companies   -- vat_number present, nullable
--
-- Then set it in the app: Settings -> Company -> TRN. Until it is set, the
-- TRN block stays absent from documents exactly as before.

-- ---------------------------------------------------------------------------
-- ROLLBACK (commented; this project applies migrations by hand)
-- ---------------------------------------------------------------------------
-- ALTER TABLE companies DROP COLUMN IF EXISTS vat_number;
