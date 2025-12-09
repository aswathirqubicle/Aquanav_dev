
import { execSync } from 'child_process';

async function runSeedingScript(scriptName: string, description: string) {
  console.log(`\n🚀 Running ${description}...`);
  console.log('='.repeat(50));
  
  try {
    execSync(`npx tsx scripts/${scriptName}`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log(`✅ ${description} completed successfully\n`);
  } catch (error) {
    console.error(`❌ ${description} failed:`, error);
    throw error;
  }
}

async function runMasterSeeding() {
  console.log('🌟 STARTING COMPREHENSIVE DATABASE SEEDING');
  console.log('='.repeat(60));
  console.log('This will seed all entities with realistic mock data\n');
  
  try {
    // First run the main seeding script
    await runSeedingScript('seed-all-data.ts', 'Main Data Seeding (Customers, Suppliers, Employees, Projects, Inventory, Sales)');
    
    // Then run purchase-specific seeding
    await runSeedingScript('seed-purchase-data.ts', 'Purchase Data Seeding (Quotations, Orders, Invoices)');
    
    console.log('🎉 MASTER SEEDING COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('Your database is now populated with comprehensive mock data:');
    console.log('• 50 Customers with realistic company details');
    console.log('• 30 Suppliers with contact information');
    console.log('• 40 Employees across different departments');
    console.log('• 20 Projects with various statuses');
    console.log('• 10 Inventory items with stock levels');
    console.log('• 15 Sales quotations');
    console.log('• 12 Proforma invoices');
    console.log('• 18 Sales invoices');
    console.log('• 8 Credit notes');
    console.log('• 15 Purchase requests');
    console.log('• 12 Purchase quotations');
    console.log('• 20 Purchase orders');
    console.log('• ~14 Purchase invoices');
    console.log('\nYou can now test all features of your application!');
    
  } catch (error) {
    console.error('\n💥 MASTER SEEDING FAILED');
    console.log('='.repeat(60));
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run master seeding
runMasterSeeding()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Master seeding process failed:', error);
    process.exit(1);
  });
