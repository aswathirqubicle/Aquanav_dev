/**
 * What an employee may change about themselves from My Profile, and how the
 * input is cleaned. Pure: no database, so the rules are unit-tested.
 *
 * Everything not listed here (name, code, position, department, grade, salary,
 * category, hire date, PF, bank details, training status) stays admin/PM-only.
 */

export type FieldErrors = Record<string, string>;
export interface Picked<T> {
  data: T;
  errors: FieldErrors;
}

const str = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isIsoDate = (s: string): boolean =>
  ISO_DATE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Labels shown in emails and used to describe what changed. */
export const BASIC_INFO_LABELS = {
  phone: "Phone",
  email: "Email",
  address: "Address",
  dateOfBirth: "Date of birth",
  height: "Height (cm)",
  weight: "Weight (kg)",
  boilerSuitSize: "Boiler suit size",
  safetyShoeSize: "Safety shoe size",
} as const;

export type BasicInfoField = keyof typeof BASIC_INFO_LABELS;
export type BasicInfo = Partial<Record<BasicInfoField, string | null>>;

/**
 * Only the editable personal fields, and only those present in the body, so a
 * partial update leaves the rest alone. Anything else in the body is ignored.
 */
export function pickBasicInfo(body: Record<string, unknown>): Picked<BasicInfo> {
  const data: BasicInfo = {};
  const errors: FieldErrors = {};
  for (const field of Object.keys(BASIC_INFO_LABELS) as BasicInfoField[]) {
    if (!(field in body)) continue;
    const value = str(body[field]);
    if (value === null) {
      data[field] = null;
      continue;
    }
    if (field === "email" && !EMAIL.test(value)) {
      errors.email = "Enter a valid email address";
    } else if (field === "dateOfBirth") {
      if (!isIsoDate(value)) errors.dateOfBirth = "Enter a valid date";
      else if (value > new Date().toISOString().slice(0, 10))
        errors.dateOfBirth = "Date of birth cannot be in the future";
    } else if (field === "height" || field === "weight") {
      const n = Number(value);
      const max = field === "height" ? 300 : 500;
      if (!Number.isFinite(n) || n <= 0 || n >= max) {
        errors[field] = `Enter a number between 0 and ${max}`;
      }
    } else if (value.length > 500) {
      errors[field] = "Too long";
    }
    data[field] = value;
  }
  return { data, errors };
}

export const RELATIONSHIPS = ["spouse", "parent", "sibling", "child", "other"] as const;

export interface NextOfKinInput {
  name: string;
  relationship: string;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
}

export function pickNextOfKin(body: Record<string, unknown>): Picked<NextOfKinInput> {
  const errors: FieldErrors = {};
  const name = str(body.name);
  const relationship = str(body.relationship)?.toLowerCase() ?? null;
  const phone = str(body.phone);
  const email = str(body.email);
  if (!name) errors.name = "Name is required";
  if (!relationship) errors.relationship = "Relationship is required";
  else if (!(RELATIONSHIPS as readonly string[]).includes(relationship))
    errors.relationship = "Choose a relationship from the list";
  if (email && !EMAIL.test(email)) errors.email = "Enter a valid email address";
  if (!phone && !email) errors.phone = "Enter a phone number or an email";
  return {
    data: {
      name: name ?? "",
      relationship: relationship ?? "",
      phone,
      email,
      isPrimary: body.isPrimary === true || body.isPrimary === "true",
    },
    errors,
  };
}

export interface TrainingInput {
  trainingName: string;
  trainingProvider: string;
  certificationNumber: string | null;
  trainingDate: string;
  expiryDate: string | null;
  notes: string | null;
}

/** Status is not taken from the employee: new records start active. */
export function pickTraining(body: Record<string, unknown>): Picked<TrainingInput> {
  const errors: FieldErrors = {};
  const trainingName = str(body.trainingName);
  const trainingProvider = str(body.trainingProvider);
  const trainingDate = str(body.trainingDate);
  const expiryDate = str(body.expiryDate);
  if (!trainingName) errors.trainingName = "Training name is required";
  if (!trainingProvider) errors.trainingProvider = "Provider is required";
  if (!trainingDate) errors.trainingDate = "Training date is required";
  else if (!isIsoDate(trainingDate)) errors.trainingDate = "Enter a valid date";
  if (expiryDate && !isIsoDate(expiryDate)) errors.expiryDate = "Enter a valid date";
  else if (expiryDate && trainingDate && isIsoDate(trainingDate) && expiryDate < trainingDate)
    errors.expiryDate = "Expiry date cannot be before the training date";
  return {
    data: {
      trainingName: trainingName ?? "",
      trainingProvider: trainingProvider ?? "",
      certificationNumber: str(body.certificationNumber),
      trainingDate: trainingDate ?? "",
      expiryDate,
      notes: str(body.notes),
    },
    errors,
  };
}

/** "2026-05-04" or a Date → "2026-05-04"; anything else → trimmed string. */
const normalise = (value: unknown): string | null => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = str(value);
  if (s && /^\d+\.\d+$/.test(s)) return String(Number(s)); // "172.00" → "172"
  return s;
};

/** The fields whose value actually changes, as label/new-value pairs. */
export function describeChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  labels: Record<string, string>,
): Array<{ label: string; value: string }> {
  const changes: Array<{ label: string; value: string }> = [];
  for (const [field, label] of Object.entries(labels)) {
    if (!(field in after)) continue;
    const was = normalise(before[field]);
    const now = normalise(after[field]);
    if (was !== now) changes.push({ label, value: now ?? "(removed)" });
  }
  return changes;
}
