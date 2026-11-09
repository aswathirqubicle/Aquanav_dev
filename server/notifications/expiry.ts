/**
 * Which expiry reminder is due, and when.
 *
 * Pure functions over plain date strings — no database, no clock of their own —
 * so the awkward cases can actually be tested.
 *
 * All dates are evaluated in Asia/Dubai (UTC+4), the client's timezone, rather
 * than server-local time. The VPS timezone is not something this codebase
 * controls, and "expires in 30 days" must mean the same thing regardless of how
 * the host is configured. Expiry columns are DATE, so everything here works on
 * plain YYYY-MM-DD strings and never on wall-clock instants.
 */

export const CLIENT_TIMEZONE = "Asia/Dubai";

/** Milestones, most distant first. The value is the label stored in notification_log. */
export const MILESTONES = [
  { key: "6_months", days: 180, label: "6 months" },
  { key: "3_months", days: 90, label: "3 months" },
  { key: "1_month", days: 30, label: "1 month" },
] as const;

export type MilestoneKey = (typeof MILESTONES)[number]["key"];

/** Today's calendar date in the client's timezone, as YYYY-MM-DD. */
export function todayInClientTz(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD, which is what the date columns hold.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CLIENT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** The YYYY-MM month key used to make the monthly digest fire once per month. */
export function monthKeyInClientTz(now: Date = new Date()): string {
  return todayInClientTz(now).slice(0, 7);
}

/**
 * Whole days from `from` to `to`. Both are plain dates, so they are anchored at
 * UTC midnight purely to subtract them — this is deliberately not a timezone
 * conversion, and cannot drift by an hour.
 */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  return Math.round((b - a) / 86_400_000);
}

export interface DueMilestones {
  /** The reminder to actually send, or null when none is due. */
  send: (typeof MILESTONES)[number] | null;
  /**
   * Every milestone to write to notification_log — the one being sent plus any
   * less urgent ones that are also past. Logging those suppresses them, so a
   * document added when it already has under a month left produces ONE email
   * rather than three.
   */
  suppress: MilestoneKey[];
  daysRemaining: number;
}

/**
 * Decide what to do about one expiry date.
 *
 * A milestone means "expiry is now within N days", which is what makes this
 * robust to a job that misses a run: nothing has to happen on an exact day, it
 * only has to happen eventually. Already-sent milestones are passed in so a
 * reminder is never repeated.
 *
 * Returns send: null when the document has already expired — chasing something
 * that lapsed last month is noise, and the monthly digest covers the record.
 */
export function milestonesDue(
  expiryDate: string,
  today: string,
  alreadySent: string[] = [],
): DueMilestones {
  const daysRemaining = daysBetween(today, expiryDate);

  if (Number.isNaN(daysRemaining) || daysRemaining < 0) {
    return { send: null, suppress: [], daysRemaining };
  }

  const sent = new Set(alreadySent);
  const due = MILESTONES.filter(
    (m) => daysRemaining <= m.days && !sent.has(m.key),
  );

  if (due.length === 0) {
    return { send: null, suppress: [], daysRemaining };
  }

  // MILESTONES runs most-distant first, so the last due entry is the most
  // urgent one and the honest thing to send.
  const send = due[due.length - 1];

  return {
    send,
    suppress: due.map((m) => m.key),
    daysRemaining,
  };
}

/** The monthly digest's sections, most urgent first. */
export const DIGEST_SECTIONS = [
  { key: 1, maxDays: 30, label: "Expiring within 1 month" },
  { key: 2, maxDays: 60, label: "Expiring in 1 to 2 months" },
  { key: 3, maxDays: 90, label: "Expiring in 2 to 3 months" },
] as const;

export type DigestSection = (typeof DIGEST_SECTIONS)[number]["key"];

/**
 * Which digest section an expiry date belongs in, counted in whole days from
 * `today`: 0–30 days is section 1, 31–60 section 2, 61–90 section 3. Already
 * expired or further than 90 days out returns null and is left out.
 */
export function digestSectionFor(
  expiryDate: string,
  today: string,
): DigestSection | null {
  const days = daysBetween(today, expiryDate);
  if (Number.isNaN(days) || days < 0) return null;
  const section = DIGEST_SECTIONS.find((s) => days <= s.maxDays);
  return section ? section.key : null;
}

export interface ExpiringDocumentWarning {
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  documentLabel: string;
  expiryDate: string;
  /** Negative when the document has already expired. */
  daysRemaining: number;
}

/** Three months, matching the 3-month reminder milestone. */
export const ASSIGNMENT_WARNING_DAYS = 90;

/**
 * Which of these items belong to the given employees and expire within
 * `withinDays` of `today`. Already-expired items are included (they are the
 * most urgent), most urgent first.
 */
export function selectExpiringForEmployees(
  items: Array<{
    employeeId: number;
    employeeName: string;
    employeeCode: string;
    label: string;
    expiryDate: string;
  }>,
  employeeIds: number[],
  today: string,
  withinDays: number = ASSIGNMENT_WARNING_DAYS,
): ExpiringDocumentWarning[] {
  const wanted = new Set(employeeIds);
  const warnings: ExpiringDocumentWarning[] = [];
  for (const item of items) {
    if (!wanted.has(item.employeeId)) continue;
    const daysRemaining = daysBetween(today, item.expiryDate);
    if (Number.isNaN(daysRemaining) || daysRemaining > withinDays) continue;
    warnings.push({
      employeeId: item.employeeId,
      employeeName: item.employeeName,
      employeeCode: item.employeeCode,
      documentLabel: item.label,
      expiryDate: item.expiryDate,
      daysRemaining,
    });
  }
  return warnings.sort((a, b) => a.daysRemaining - b.daysRemaining);
}
