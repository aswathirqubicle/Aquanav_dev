import { db } from "./db";
import { salesInvoices } from "@shared/schema";
import { and, inArray, lt, sql } from "drizzle-orm";
import { runExpiryReminders, runMonthlyDigest } from "./notifications/runner";

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

const ONE_HOUR = 60 * 60 * 1000;

/**
 * Expiry reminders and the monthly digest.
 *
 * Ticks hourly rather than daily, because setInterval measures from process
 * start and pm2 restarts reset it — "daily" would quietly become "whenever it
 * last booted". Hourly bounds the delay to an hour instead of a day.
 *
 * Correctness does not depend on this timer at all. Every send is claimed in
 * notification_log first, under a unique index, so running often, running twice,
 * or running from several processes cannot send anything twice. The tick only
 * decides how promptly a due reminder goes out.
 *
 * Both runs no-op quietly until Microsoft 365 is configured in Settings, so an
 * unconfigured system logs one line rather than erroring every hour.
 */
async function runNotifications(): Promise<void> {
  try {
    const expiry = await runExpiryReminders();
    if (expiry.skippedNotConfigured) {
      console.log(
        "[notifications] Email is not configured yet — skipping this run.",
      );
      return;
    }
    if (expiry.sent > 0 || expiry.failed > 0) {
      console.log(
        `[notifications] Expiry reminders: ${expiry.sent} sent, ${expiry.failed} failed, ${expiry.checked} checked.`,
      );
    }

    const digest = await runMonthlyDigest();
    if (digest.sent) {
      console.log(
        `[notifications] Monthly digest sent (${digest.rows ?? 0} items).`,
      );
    }
  } catch (error) {
    console.error("[notifications] Run failed:", error);
  }
}

export function startNotificationJob(): void {
  runNotifications();
  setInterval(runNotifications, ONE_HOUR);
  console.log("[jobs] Notification job scheduled (runs hourly).");
}
