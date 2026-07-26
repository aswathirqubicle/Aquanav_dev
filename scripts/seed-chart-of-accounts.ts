import { db } from "../server/db";
import { chartOfAccounts } from "../shared/schema";
import { sql } from "drizzle-orm";

// The chart of accounts is FIXED - there are no per-entity accounts for
// customers, suppliers or employees. Accounts marked `isActive: false` are
// retained so existing references stay valid, but are hidden from the account
// picker (getChartOfAccounts filters on is_active).
// Kept in step with migrations/0062_fix_chart_of_accounts.sql.
import { accounts, type SeedAccount } from "../shared/chart-of-accounts";


async function seedChartOfAccounts() {

  await db.execute(sql`TRUNCATE TABLE ${chartOfAccounts} RESTART IDENTITY CASCADE`);

  console.log("Seeding Chart of Accounts...");
  
  for (const account of accounts) {
    try {
      await db
        .insert(chartOfAccounts)
        .values({
          ...account,
          isActive: account.isActive ?? true,
        })
        .onConflictDoNothing();
    } catch (error: any) {
      if (!error.message?.includes("duplicate key")) {
        console.error(`Error inserting account ${account.accountCode}:`, error.message);
      }
    }
  }
  
  console.log(`Chart of Accounts seeding complete. ${accounts.length} accounts processed.`);
}

seedChartOfAccounts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  });
