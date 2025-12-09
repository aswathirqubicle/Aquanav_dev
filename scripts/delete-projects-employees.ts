
import { db } from '../server/db';
import * as schema from '../shared/schema';

async function deleteProjectsAndEmployees() {
  console.log('Starting deletion of all projects and employees...');
  
  try {
    // Delete in order to respect foreign key constraints
    
    // 1. Delete project-related data first
    console.log('Deleting project consumable items...');
    await db.delete(schema.projectConsumableItems);
    
    console.log('Deleting project consumables...');
    await db.delete(schema.projectConsumables);
    
    console.log('Deleting project asset assignments...');
    await db.delete(schema.projectAssetAssignments);
    
    console.log('Deleting project employee assignments...');
    await db.delete(schema.projectEmployees);
    
    console.log('Deleting daily activities...');
    await db.delete(schema.dailyActivities);
    
    console.log('Deleting project photos...');
    await db.delete(schema.projectPhotos);
    
    console.log('Deleting project photo groups...');
    await db.delete(schema.projectPhotoGroups);
    
    console.log('Deleting inventory transactions related to projects...');
    await db.delete(schema.inventoryTransactions).where(
      schema.inventoryTransactions.projectId !== null
    );
    
    console.log('Deleting payroll entries...');
    await db.delete(schema.payrollAdditions);
    await db.delete(schema.payrollDeductions);
    await db.delete(schema.payrollEntries);
    
    console.log('Deleting sales invoices...');
    await db.delete(schema.invoicePayments);
    await db.delete(schema.salesInvoices);
    
    console.log('Deleting proforma invoices...');
    await db.delete(schema.proformaInvoices);
    
    console.log('Deleting credit notes...');
    await db.delete(schema.creditNotes);
    
    console.log('Deleting purchase requests...');
    await db.delete(schema.purchaseRequestItems);
    await db.delete(schema.purchaseRequests);
    
    console.log('Deleting general ledger entries related to projects...');
    await db.delete(schema.generalLedgerEntries).where(
      schema.generalLedgerEntries.projectId !== null
    );
    
    // 2. Now delete projects
    console.log('Deleting all projects...');
    const deletedProjectsResult = await db.delete(schema.projects);
    const deletedProjectsCount = deletedProjectsResult.rowCount || 0;
    
    // 3. Delete employee-related data
    console.log('Deleting asset assignments to employees...');
    await db.update(schema.assets).set({ assignedToId: null });
    
    console.log('Deleting asset maintenance records...');
    await db.delete(schema.assetMaintenanceFiles);
    await db.delete(schema.assetMaintenanceRecords);
    
    // 4. Finally delete employees
    console.log('Deleting all employees...');
    const deletedEmployeesResult = await db.delete(schema.employees);
    const deletedEmployeesCount = deletedEmployeesResult.rowCount || 0;
    
    console.log('\n✅ Deletion completed successfully!');
    console.log(`Deleted ${deletedProjectsCount} projects`);
    console.log(`Deleted ${deletedEmployeesCount} employees`);
    console.log('All related data has been cleaned up.');
    
  } catch (error) {
    console.error('❌ Error during deletion:', error);
    throw error;
  }
}

// Run the deletion
deleteProjectsAndEmployees()
  .then(() => {
    console.log('\n🎉 All projects and employees have been successfully deleted!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Deletion failed:', error);
    process.exit(1);
  });
