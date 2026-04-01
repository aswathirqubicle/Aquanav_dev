
import { db } from '../server/db';
import * as schema from '../shared/schema';
import { eq } from 'drizzle-orm';
import { storage } from '../server/storage';

/**
 * Script to zero out revenue and cost for a specific project by unlinking all financial contributors.
 * Usage: npx tsx scripts/zero-project-financials.ts [ProjectTitle]
 */
async function zeroProjectFinancials() {
  const projectTitle = process.argv[2] || "Hull Maintenance - Atlantic Explorer";
  console.log(`Starting process to zero out financials for project: "${projectTitle}"`);

  try {
    const projectResults = await db.select().from(schema.projects).where(eq(schema.projects.title, projectTitle));
    
    if (projectResults.length === 0) {
      console.log(`Project "${projectTitle}" not found. No actions taken.`);
      return;
    }

    if (projectResults.length > 1) {
      console.log(`Multiple projects found with title "${projectTitle}". Please specify a unique title or modify the script to use ID.`);
      projectResults.forEach(p => console.log(`- ID: ${p.id}`));
      return;
    }

    const project = projectResults[0];
    const projectId = project.id;
    console.log(`Targeting Project ID: ${projectId}`);

    await db.transaction(async (tx) => {
      // 1. Unlink Revenue contributing items
      console.log('Unlinking sales invoices...');
      await tx.update(schema.salesInvoices).set({ projectId: null }).where(eq(schema.salesInvoices.projectId, projectId));
      
      console.log('Unlinking proforma invoices...');
      await tx.update(schema.proformaInvoices).set({ projectId: null }).where(eq(schema.proformaInvoices.projectId, projectId));

      // 2. Unlink Cost contributing items
      console.log('Unlinking purchase invoice items...');
      await tx.update(schema.purchaseInvoiceItems).set({ projectId: null }).where(eq(schema.purchaseInvoiceItems.projectId, projectId));

      console.log('Unlinking reimbursements...');
      await tx.update(schema.reimbursements).set({ projectId: null }).where(eq(schema.reimbursements.projectId, projectId));

      console.log('Unlinking inventory transactions...');
      await tx.update(schema.inventoryTransactions).set({ projectId: null }).where(eq(schema.inventoryTransactions.projectId, projectId));

      // 3. Remove Labor assignments
      console.log('Deleting employee assignments...');
      await tx.delete(schema.projectEmployees).where(eq(schema.projectEmployees.projectId, projectId));

      // 4. Remove Asset assignments
      console.log('Deleting legacy asset assignments...');
      await tx.delete(schema.projectAssetAssignments).where(eq(schema.projectAssetAssignments.projectId, projectId));

      console.log('Deleting asset instance assignments...');
      await tx.delete(schema.projectAssetInstanceAssignments).where(eq(schema.projectAssetInstanceAssignments.projectId, projectId));

      // 5. Delete Consumables
      console.log('Deleting project consumable items...');
      const consumableRecords = await tx.select().from(schema.projectConsumables).where(eq(schema.projectConsumables.projectId, projectId));
      for (const record of consumableRecords) {
        await tx.delete(schema.projectConsumableItems).where(eq(schema.projectConsumableItems.consumableId, record.id));
      }
      console.log('Deleting project consumable records...');
      await tx.delete(schema.projectConsumables).where(eq(schema.projectConsumables.projectId, projectId));

      // 6. Unlink non-financial but related items
      console.log('Unlinking general ledger entries...');
      await tx.update(schema.generalLedgerEntries).set({ projectId: null }).where(eq(schema.generalLedgerEntries.projectId, projectId));
      
      console.log('Unlinking payroll entries...');
      await tx.update(schema.payrollEntries).set({ projectId: null }).where(eq(schema.payrollEntries.projectId, projectId));

      console.log('Unlinking employee feedback...');
      await tx.update(schema.employeeFeedback).set({ projectId: null }).where(eq(schema.employeeFeedback.projectId, projectId));

      // 7. Finally update the project summary fields directly
      console.log('Zeroing project summary fields...');
      await tx.update(schema.projects).set({
        totalRevenue: "0.00",
        actualCost: "0.00"
      }).where(eq(schema.projects.id, projectId));
    });

    console.log('\n✅ Financials zeroed successfully!');
    
    // Verification using storage method (if possible without live DB, otherwise skip)
    try {
        const revenueStats = await storage.getProjectRevenue(projectId);
        console.log('\n=== Project Financial Status (Verified via Storage API) ===');
        console.log(`Total Revenue: ${revenueStats.totalRevenue}`);
        console.log(`Total Cost: ${revenueStats.totalCost}`);
        console.log(`Profit: ${revenueStats.profit}`);
    } catch (e) {
        console.log('\nFinancials successfully unlinked in DB. (Verification skipped due to connection)');
    }

  } catch (error) {
    console.error('❌ Error while zeroing financials:', error);
    process.exit(1);
  }
}

zeroProjectFinancials().then(() => {
  console.log('\nProcess completed.');
  process.exit(0);
});
