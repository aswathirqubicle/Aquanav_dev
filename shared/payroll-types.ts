/**
 * Payroll and reimbursement classification.
 *
 * Single source of truth for the three lists, shared by the admin forms, the
 * ledger posting logic and any reporting that groups by type. Kept in one file
 * because divergent copies are how this codebase ended up matching on
 * `description LIKE 'Reimbursement:%'` in one place and a `tdsAmount` variable
 * in another.
 *
 * These values are constrained in the database by
 * migrations/0063_add_payroll_type_fields.sql — keep the two in step.
 *
 * NOTE: none of this appears on the payslip. An employee sees a description and
 * an amount; the type exists only so the ledger can route the amount to the
 * correct account.
 */

/** Deduction types. Only USER_SELECTABLE ones are offered in the form. */
export const DEDUCTION_TYPES = [
  {
    value: "provident_fund",
    label: "Provident Fund",
    /** Written by the payroll engine (the automatic 5%), never by hand. */
    systemGenerated: true,
  },
  {
    value: "advance_recovery",
    label: "Advance Recovery",
    systemGenerated: false,
  },
  {
    value: "other",
    label: "Other",
    systemGenerated: false,
  },
] as const;

/** Addition types. Only USER_SELECTABLE ones are offered in the form. */
export const ADDITION_TYPES = [
  {
    value: "project_fee",
    label: "Project Fee",
    /** Written at generation from a consultant's project assignments. */
    systemGenerated: true,
  },
  {
    value: "reimbursement",
    label: "Reimbursement",
    /** Pulled in from approved reimbursement claims. Not an earning. */
    systemGenerated: true,
  },
  { value: "overtime", label: "Overtime", systemGenerated: false },
  { value: "bonus", label: "Bonus", systemGenerated: false },
  { value: "other", label: "Other", systemGenerated: false },
] as const;

/**
 * Reimbursement categories, and the expense account each one debits.
 *
 * `other` has its own account (6160) rather than falling into general
 * Operating Expenses, so an unclassified claim stays visible and
 * reclassifiable instead of dissolving into an unrelated bucket.
 */
export const REIMBURSEMENT_CATEGORIES = [
  { value: "travel", label: "Travel", accountCode: "6120" },
  { value: "accommodation", label: "Accommodation", accountCode: "6125" },
  { value: "fuel_transport", label: "Fuel & Transport", accountCode: "6060" },
  { value: "office_supplies", label: "Office Supplies", accountCode: "6080" },
  { value: "communication", label: "Communication", accountCode: "6090" },
  { value: "training", label: "Training", accountCode: "6130" },
  { value: "other", label: "Other", accountCode: "6160" },
] as const;

export type DeductionType = (typeof DEDUCTION_TYPES)[number]["value"];
export type AdditionType = (typeof ADDITION_TYPES)[number]["value"];
export type ReimbursementCategory =
  (typeof REIMBURSEMENT_CATEGORIES)[number]["value"];

/** Types a user may pick. Excludes anything the payroll engine maintains. */
export const SELECTABLE_DEDUCTION_TYPES = DEDUCTION_TYPES.filter(
  (t) => !t.systemGenerated,
);
export const SELECTABLE_ADDITION_TYPES = ADDITION_TYPES.filter(
  (t) => !t.systemGenerated,
);

/** Defaults, matching the server-side fallbacks in server/storage/payroll.ts. */
export const DEFAULT_DEDUCTION_TYPE: DeductionType = "advance_recovery";
export const DEFAULT_ADDITION_TYPE: AdditionType = "bonus";
export const DEFAULT_REIMBURSEMENT_CATEGORY: ReimbursementCategory = "other";

/** Human label for a stored value, falling back to the raw value if unknown. */
export const labelForType = (
  list: readonly { value: string; label: string }[],
  value: string | null | undefined,
): string => list.find((t) => t.value === value)?.label ?? value ?? "—";

/** Expense account a reimbursement category posts to. */
export const accountCodeForCategory = (
  category: string | null | undefined,
): string =>
  REIMBURSEMENT_CATEGORIES.find((c) => c.value === category)?.accountCode ??
  "6160";
