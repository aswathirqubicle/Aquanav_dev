import { db } from "./db";
import { salesInvoices } from "@shared/schema";
import { and, inArray, lt, sql } from "drizzle-orm";

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

async function updateOverdueSalesInvoices(): Promise<void> {
  try {
    const result = await db
      .update(salesInvoices)
      .set({ status: "overdue" })
      .where(
        and(
          inArray(salesInvoices.status, ["approved", "unpaid", "partially_paid"]),
          lt(salesInvoices.dueDate, sql`NOW()`)
        )
      );
    console.log("[jobs] Overdue sales invoice update complete.");
  } catch (error) {
    console.error("[jobs] Failed to update overdue sales invoices:", error);
  }
}

export function startOverdueInvoiceJob(): void {
  updateOverdueSalesInvoices();
  setInterval(updateOverdueSalesInvoices, TWENTY_FOUR_HOURS);
  console.log("[jobs] Overdue invoice job scheduled (runs every 24 hours).");
}
