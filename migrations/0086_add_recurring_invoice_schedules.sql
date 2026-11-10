-- Recurring invoices raised from an approved sales quotation.
--
-- Converting a quotation as "Recurring invoice" stores a schedule here instead
-- of pre-filling one invoice. A job then drafts one sales invoice per billing
-- period on the chosen generation day (1–30, or the last day of the month; 29
-- and 30 fall back to the last day in February). Every generated invoice is a
-- DRAFT: finance reviews, edits or removes lines and approves it as usual, so
-- nothing posts to the ledger until a person signs it off.
--
-- The schedule keeps its own copy of the quotation lines, each with a
-- billingType (one_time / monthly_prorata / monthly_fixed), so correcting how a
-- line bills at conversion never edits the approved quotation itself.

CREATE TABLE IF NOT EXISTS recurring_invoice_schedules (
  id serial PRIMARY KEY,
  quotation_id integer NOT NULL REFERENCES sales_quotations(id),
  customer_id integer REFERENCES customers(id),
  project_id integer REFERENCES projects(id),
  -- 1–30, or null with last_day_of_month = true.
  generation_day integer,
  last_day_of_month boolean NOT NULL DEFAULT false,
  bill_from date NOT NULL,
  -- Only used when there is no project; with a project its own dates decide.
  end_date date,
  status text NOT NULL DEFAULT 'active', -- active, paused, completed, cancelled
  items json NOT NULL DEFAULT '[]'::json,
  currency text NOT NULL DEFAULT 'AED',
  exchange_rate numeric(18, 8) NOT NULL DEFAULT 1,
  subject text,
  payment_terms text,
  bank_account text,
  billing_address text,
  terms_and_conditions text,
  remarks text,
  discount_percentage numeric(5, 2) DEFAULT 0,
  work_order_number text,
  -- End of the last period billed (or skipped), and when the next one is due.
  last_period_end date,
  next_run_date date NOT NULL,
  created_by_id integer REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  cancelled_by_id integer REFERENCES users(id),
  cancelled_at timestamp,
  CONSTRAINT recurring_invoice_schedules_generation_day_check
    CHECK (last_day_of_month OR generation_day BETWEEN 1 AND 30)
);

CREATE INDEX IF NOT EXISTS idx_recurring_invoice_schedules_quotation_id
  ON recurring_invoice_schedules (quotation_id);

-- The job scans for due schedules every hour.
CREATE INDEX IF NOT EXISTS idx_recurring_invoice_schedules_due
  ON recurring_invoice_schedules (status, next_run_date);

ALTER TABLE sales_invoices
  ADD COLUMN IF NOT EXISTS recurring_schedule_id integer
    REFERENCES recurring_invoice_schedules(id),
  ADD COLUMN IF NOT EXISTS billing_period_start date,
  ADD COLUMN IF NOT EXISTS billing_period_end date;

-- A period can be invoiced once per schedule, however often the job runs or
-- however many processes run it.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_invoices_recurring_period
  ON sales_invoices (recurring_schedule_id, billing_period_start)
  WHERE recurring_schedule_id IS NOT NULL;
