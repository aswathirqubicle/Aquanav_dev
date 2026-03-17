ALTER TABLE "employees" ADD COLUMN "contract_currency" text;
ALTER TABLE "employees" ADD COLUMN "contract_salary" numeric(10, 2);
ALTER TABLE "employees" ALTER COLUMN "grade" TYPE integer USING grade::integer;
