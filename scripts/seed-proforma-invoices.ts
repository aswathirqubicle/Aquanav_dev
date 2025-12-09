
import { db } from '../server/db';
import * as schema from '../shared/schema';

const proformaStatuses = ['draft', 'sent', 'approved', 'rejected', 'expired', 'converted'];

const sampleItems = [
  {
    description: "Marine Engine Overhaul Service",
    quantity: 1,
    unitPrice: 15000,
    taxRate: 8.5,
    taxAmount: 1275
  },
  {
    description: "Hull Inspection and Cleaning",
    quantity: 1,
    unitPrice: 8500,
    taxRate: 8.5,
    taxAmount: 722.5
  },
  {
    description: "Navigation Equipment Installation",
    quantity: 2,
    unitPrice: 3250,
    taxRate: 8.5,
    taxAmount: 552.5
  },
  {
    description: "Safety Equipment Certification",
    quantity: 1,
    unitPrice: 2800,
    taxRate: 8.5,
    taxAmount: 238
  },
  {
    description: "Propeller Shaft Alignment",
    quantity: 1,
    unitPrice: 4200,
    taxRate: 8.5,
    taxAmount: 357
  },
  {
    description: "Deck Equipment Maintenance",
    quantity: 3,
    unitPrice: 1850,
    taxRate: 8.5,
    taxAmount: 471.75
  },
  {
    description: "Electrical System Upgrade",
    quantity: 1,
    unitPrice: 12000,
    taxRate: 8.5,
    taxAmount: 1020
  },
  {
    description: "Hydraulic System Repair",
    quantity: 2,
    unitPrice: 2750,
    taxRate: 8.5,
    taxAmount: 467.5
  },
  {
    description: "Communication System Installation",
    quantity: 1,
    unitPrice: 6800,
    taxRate: 8.5,
    taxAmount: 578
  },
  {
    description: "Fire Safety System Inspection",
    quantity: 1,
    unitPrice: 3500,
    taxRate: 8.5,
    taxAmount: 297.5
  }
];

const paymentTermsOptions = [
  "Net 30 days",
  "Net 15 days",
  "2/10 Net 30",
  "Due upon receipt",
  "50% advance, 50% on completion",
  "30% advance, 70% on delivery"
];

const deliveryTermsOptions = [
  "FOB Origin",
  "FOB Destination",
  "Ex Works",
  "CIF (Cost, Insurance, Freight)",
  "DAP (Delivered at Place)",
  "FCA (Free Carrier)"
];

const remarksOptions = [
  "All work to be completed according to maritime standards",
  "Customer to provide dry dock facilities",
  "Quote valid for 30 days from issue date",
  "Work includes all necessary permits and certifications",
  "Materials and labor included in quoted price",
  "Subject to vessel availability and weather conditions",
  "Compliant with international maritime regulations",
  "Emergency repair services available 24/7"
];

function getRandomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateProformaItems(count: number = Math.floor(Math.random() * 3) + 2) {
  const selectedItems = [];
  const availableItems = [...sampleItems];
  
  for (let i = 0; i < count && availableItems.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * availableItems.length);
    const item = availableItems.splice(randomIndex, 1)[0];
    selectedItems.push(item);
  }
  
  return selectedItems;
}

async function seedProformaInvoices() {
  console.log('Starting to seed proforma invoices...');

  try {
    // Get existing customers for realistic foreign key references
    const customers = await db.select({ id: schema.customers.id }).from(schema.customers).limit(20);
    
    if (customers.length === 0) {
      console.log('No customers found. Please seed customers first.');
      return;
    }

    // Get existing projects for some proforma invoices
    const projects = await db.select({ id: schema.projects.id }).from(schema.projects).limit(10);

    // Get existing quotations for some proforma invoices
    const quotations = await db.select({ id: schema.salesQuotations.id }).from(schema.salesQuotations).limit(5);

    const proformaInvoices = [];
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    for (let i = 0; i < 25; i++) {
      const items = generateProformaItems();
      const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      const totalTaxAmount = items.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
      const discount = Math.random() > 0.7 ? Math.floor(Math.random() * 1000) : 0;
      const totalAmount = subtotal + totalTaxAmount - discount;

      const createdDate = getRandomDate(threeMonthsAgo, now);
      const validUntil = new Date(createdDate.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days from created
      const invoiceDate = getRandomDate(createdDate, now);

      const status = proformaStatuses[Math.floor(Math.random() * proformaStatuses.length)];
      
      proformaInvoices.push({
        proformaNumber: `PI-${Date.now() + i}`,
        customerId: customers[i % customers.length].id,
        projectId: Math.random() > 0.6 && projects.length > 0 ? projects[i % projects.length].id : null,
        quotationId: Math.random() > 0.8 && quotations.length > 0 ? quotations[i % quotations.length].id : null,
        status: status,
        createdDate: createdDate,
        invoiceDate: invoiceDate,
        validUntil: Math.random() > 0.3 ? validUntil : null,
        paymentTerms: paymentTermsOptions[Math.floor(Math.random() * paymentTermsOptions.length)],
        deliveryTerms: deliveryTermsOptions[Math.floor(Math.random() * deliveryTermsOptions.length)],
        remarks: Math.random() > 0.4 ? remarksOptions[Math.floor(Math.random() * remarksOptions.length)] : null,
        items: JSON.stringify(items),
        subtotal: subtotal.toString(),
        taxAmount: totalTaxAmount.toString(),
        discount: discount.toString(),
        totalAmount: totalAmount.toString(),
        isArchived: Math.random() > 0.9 // 10% chance of being archived
      });
    }

    // Insert proforma invoices in batches
    console.log('Inserting proforma invoices...');
    for (let i = 0; i < proformaInvoices.length; i += 5) {
      const batch = proformaInvoices.slice(i, i + 5);
      await db.insert(schema.proformaInvoices).values(batch);
      console.log(`Inserted proforma invoices ${i + 1} to ${Math.min(i + 5, proformaInvoices.length)}`);
    }

    console.log('✓ Successfully seeded 25 proforma invoices!');
    
    // Display summary
    const statusCounts = proformaInvoices.reduce((acc, invoice) => {
      acc[invoice.status] = (acc[invoice.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('\nProforma Invoice Status Distribution:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

    const totalValue = proformaInvoices.reduce((sum, invoice) => sum + parseFloat(invoice.totalAmount), 0);
    console.log(`\nTotal Value of all Proforma Invoices: $${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);

  } catch (error) {
    console.error('Error seeding proforma invoices:', error);
    throw error;
  }
}

// Run the seeding function
seedProformaInvoices()
  .then(() => {
    console.log('Proforma invoice seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Proforma invoice seeding failed:', error);
    process.exit(1);
  });
