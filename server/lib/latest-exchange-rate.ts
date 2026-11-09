import { db } from "../db";
import { exchangeRates } from "@shared/schema";
import { and, desc, eq, or } from "drizzle-orm";

export interface SavedRate {
  /** Units of `to` per 1 unit of `from`. */
  rate: number;
  /** When the rate row was last saved. */
  updatedAt: Date;
}

/**
 * The most recently saved active rate between two currencies, in either
 * direction (a saved INR→AED rate is inverted). Returns null when none is
 * saved — unlike storage.getExchangeRateForCurrency, which falls back to "1"
 * and would silently present an AED figure as INR.
 */
export async function getLatestSavedRate(
  from: string,
  to: string,
): Promise<SavedRate | null> {
  const [row] = await db
    .select()
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.isActive, true),
        or(
          and(eq(exchangeRates.fromCurrency, from), eq(exchangeRates.toCurrency, to)),
          and(eq(exchangeRates.fromCurrency, to), eq(exchangeRates.toCurrency, from)),
        ),
      ),
    )
    .orderBy(desc(exchangeRates.updatedAt), desc(exchangeRates.id))
    .limit(1);

  if (!row) return null;
  const stored = parseFloat(row.rate);
  if (!Number.isFinite(stored) || stored <= 0) return null;
  const rate = row.fromCurrency === from ? stored : 1 / stored;
  return { rate, updatedAt: row.updatedAt };
}

/** amount × rate, rounded to 2 decimals; null for an unreadable amount. */
export function convertAmount(
  amount: string | number | null | undefined,
  rate: number,
): number | null {
  const value = typeof amount === "number" ? amount : parseFloat(String(amount ?? ""));
  if (!Number.isFinite(value) || !Number.isFinite(rate)) return null;
  return Math.round(value * rate * 100) / 100;
}
