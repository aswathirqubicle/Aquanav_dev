import { StorageBase } from "./base";
import {
  Company,
  ExchangeRate,
  InsertCompany,
  InsertExchangeRate,
  companies,
  exchangeRates,
} from "@shared/schema";
import {
  and,
  eq,
} from "drizzle-orm";
import { db } from "../db";

export class CompanyStorage extends StorageBase {
  // Company methods
  async getCompany(): Promise<Company | undefined> {
    try {
      const result = await db.select().from(companies).limit(1);
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message: "Error in getCompany: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getCompany",
        severity: "error",
      });
      throw error;
    }
  }

  async updateCompany(companyData: InsertCompany): Promise<Company> {
    try {
      const existing = await this.getCompany();
      if (existing) {
        const result = await db
          .update(companies)
          .set(companyData)
          .where(eq(companies.id, existing.id))
          .returning();
        return result[0];
      } else {
        const result = await db
          .insert(companies)
          .values(companyData)
          .returning();
        return result[0];
      }
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in updateCompany: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateCompany",
        severity: "error",
      });
      throw error;
    }
  }

  // Exchange Rate methods
  async getExchangeRates(): Promise<ExchangeRate[]> {
    return await db
      .select()
      .from(exchangeRates)
      .orderBy(exchangeRates.fromCurrency, exchangeRates.toCurrency);
  }

  async getExchangeRate(id: number): Promise<ExchangeRate | undefined> {
    const results = await db
      .select()
      .from(exchangeRates)
      .where(eq(exchangeRates.id, id))
      .limit(1);
    return results[0];
  }

  async createExchangeRate(data: InsertExchangeRate): Promise<ExchangeRate> {
    const [rate] = await db
      .insert(exchangeRates)
      .values({ ...data, updatedAt: new Date() })
      .returning();
    return rate;
  }

  async updateExchangeRate(
    id: number,
    data: Partial<InsertExchangeRate>,
  ): Promise<ExchangeRate | undefined> {
    const [updated] = await db
      .update(exchangeRates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(exchangeRates.id, id))
      .returning();
    return updated;
  }

  async deleteExchangeRate(id: number): Promise<boolean> {
    const result = await db
      .delete(exchangeRates)
      .where(eq(exchangeRates.id, id))
      .returning();
    return result.length > 0;
  }

  async getExchangeRateForCurrency(
    fromCurrency: string,
    toCurrency: string = "AED",
  ): Promise<string> {
    if (fromCurrency === toCurrency) return "1";
    const results = await db
      .select()
      .from(exchangeRates)
      .where(
        and(
          eq(exchangeRates.fromCurrency, fromCurrency),
          eq(exchangeRates.toCurrency, toCurrency),
          eq(exchangeRates.isActive, true),
        ),
      )
      .limit(1);
    if (results.length > 0) return results[0].rate;
    const reverseResults = await db
      .select()
      .from(exchangeRates)
      .where(
        and(
          eq(exchangeRates.fromCurrency, toCurrency),
          eq(exchangeRates.toCurrency, fromCurrency),
          eq(exchangeRates.isActive, true),
        ),
      )
      .limit(1);
    if (reverseResults.length > 0) {
      const reverseRate = parseFloat(reverseResults[0].rate);
      return reverseRate > 0 ? (1 / reverseRate).toFixed(8) : "1";
    }
    return "1";
  }
}
