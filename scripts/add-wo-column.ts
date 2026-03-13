import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    console.log("Adding work_order_number to sales_invoices...");
    await db.execute(sql`ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS work_order_number text;`);
    console.log("Adding work_order_number to proforma_invoices...");
    await db.execute(sql`ALTER TABLE proforma_invoices ADD COLUMN IF NOT EXISTS work_order_number text;`);
    console.log("Success!");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main();
