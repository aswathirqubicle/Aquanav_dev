/**
 * Line-item quantities on sales and purchase documents.
 *
 * Quantities take up to 2 decimal places (1.5 hours, 2.25 m). The purchase item
 * tables store them as numeric(10,2) (migration 0087), which the driver returns
 * as a STRING ("2.00"), so anything that adds them must go through a number
 * first; the sales documents keep their lines in JSON as plain numbers. These
 * helpers are the one place both client and server parse, round and print a
 * quantity, so the two cannot disagree about what 1.005 means.
 */

/** Most decimal places a quantity may carry, matching numeric(10,2). */
export const QUANTITY_DECIMALS = 2;

/** The `step` for a quantity <input type="number">. */
export const QUANTITY_STEP = "0.01";

/** Rounds to 2 decimal places, half away from zero, without float drift. */
export function roundQuantity(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100;
}

/**
 * A quantity from a form field, request body or database row, as a number
 * rounded to 2 decimal places. Blank or unparseable input is 0.
 */
export function parseQuantity(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return roundQuantity(n);
}

/** True when the input has no more than 2 decimal places ("1.5", "2.25", "3"). */
export function hasValidQuantityPrecision(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  const s = String(value).trim();
  if (!/^-?\d*(\.\d*)?$/.test(s)) return false;
  const decimals = s.includes(".") ? s.split(".")[1].length : 0;
  return decimals <= QUANTITY_DECIMALS;
}

/**
 * A quantity for display: no trailing zeros, so a stored "2.00" reads "2" and
 * "1.50" reads "1.5", as the documents printed before quantities could be
 * fractional. Unparseable input is returned as it came, never as "NaN".
 */
export function formatQuantity(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return String(value);
  return String(roundQuantity(n));
}
