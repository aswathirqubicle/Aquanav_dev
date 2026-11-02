-- Whether an employee takes part in the provident fund.
--
-- Payroll has deducted PF (5% of the PF base) from every employee. Some staff
-- are not enrolled, so the deduction has to be switchable per employee.
-- pf_applicable decides it: payroll generation, and every later recalculation
-- of an entry's totals, create PF only where it is true.
--
-- Defaults to true so that existing employees keep their PF and nobody's pay
-- changes until someone unticks the box. Existing payroll entries are not
-- touched; the flag applies to entries generated or recalculated afterwards.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS pf_applicable boolean NOT NULL DEFAULT true;
