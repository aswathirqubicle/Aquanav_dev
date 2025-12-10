
import { db } from '../server/db';
import * as schema from '../shared/schema';

// Sample data arrays
const firstNames = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth',
  'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Christopher', 'Karen',
  'Charles', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Helen', 'Mark', 'Sandra'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'
];

const companyNames = [
  'Atlantic Shipping Co.', 'Pacific Marine Services', 'Coastal Transport Ltd.', 'Harbor Logistics Inc.',
  'Ocean Freight Solutions', 'Maritime Cargo Systems', 'Blue Water Shipping', 'Deep Sea Logistics',
  'Port Authority Services', 'Marine Transport Corp.', 'Seafarer Shipping Lines', 'Anchor Bay Marine',
  'Tidal Wave Logistics', 'Compass Rose Shipping', 'Starboard Marine Services', 'Lighthouse Cargo'
];

const supplierNames = [
  'Marine Parts Supply Co.', 'Nautical Equipment Ltd.', 'Ship Components Inc.', 'Ocean Tools Supply',
  'Maritime Hardware Store', 'Deck Equipment Co.', 'Engine Parts Warehouse', 'Rope & Rigging Supply',
  'Navigation Instruments Ltd.', 'Safety Equipment Corp.', 'Hull Materials Supply', 'Paint & Coatings Co.'
];

const projectTitles = [
  'Hull Maintenance - Atlantic Explorer', 'Engine Overhaul - Pacific Star', 'Navigation Upgrade - Ocean Voyager',
  'Safety System Installation - Sea Pioneer', 'Deck Refurbishment - Marine Victory', 'Propulsion System Repair - Blue Horizon',
  'Electrical System Upgrade - Coastal Guardian', 'Hull Inspection - Port Master', 'Emergency Repair - Wave Runner',
  'Scheduled Maintenance - Deep Explorer', 'Retrofit Project - Ocean Spirit', 'Complete Overhaul - Sea Champion'
];

const inventoryItems = [
  { name: 'Marine Engine Oil', category: 'Lubricants', unit: 'liters' },
  { name: 'Steel Plates', category: 'Materials', unit: 'pieces' },
  { name: 'Navigation Lights', category: 'Electronics', unit: 'pieces' },
  { name: 'Safety Harnesses', category: 'Safety Equipment', unit: 'pieces' },
  { name: 'Welding Rods', category: 'Consumables', unit: 'pieces' },
  { name: 'Paint - Marine Grade', category: 'Coatings', unit: 'liters' },
  { name: 'Hydraulic Fluid', category: 'Lubricants', unit: 'liters' },
  { name: 'Electrical Cables', category: 'Electronics', unit: 'meters' },
  { name: 'Deck Bolts', category: 'Fasteners', unit: 'pieces' },
  { name: 'Life Jackets', category: 'Safety Equipment', unit: 'pieces' }
];

const serviceItems = [
  { description: "Marine Engine Overhaul Service", unitPrice: 15000, taxRate: 8.5 },
  { description: "Hull Inspection and Cleaning", unitPrice: 8500, taxRate: 8.5 },
  { description: "Navigation Equipment Installation", unitPrice: 3250, taxRate: 8.5 },
  { description: "Safety Equipment Certification", unitPrice: 2800, taxRate: 8.5 },
  { description: "Propeller Shaft Alignment", unitPrice: 4200, taxRate: 8.5 },
  { description: "Deck Equipment Maintenance", unitPrice: 1850, taxRate: 8.5 },
  { description: "Electrical System Upgrade", unitPrice: 12000, taxRate: 8.5 },
  { description: "Hydraulic System Repair", unitPrice: 2750, taxRate: 8.5 }
];

function getRandomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
}

function generatePhoneNumber(): string {
  const areaCode = Math.floor(Math.random() * 900) + 100;
  const exchange = Math.floor(Math.random() * 900) + 100;
  const number = Math.floor(Math.random() * 9000) + 1000;
  return `+1-${areaCode}-${exchange}-${number}`;
}

function generateTaxId(): string {
  return `TAX${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`;
}

async function seedCustomers() {
  console.log('Seeding customers...');
  const customers = [];
  
  for (let i = 0; i < 50; i++) {
    const companyName = companyNames[i % companyNames.length] + ` ${Math.floor(i / companyNames.length) + 1}`;
    const contactPerson = firstNames[i % firstNames.length] + ' ' + lastNames[i % lastNames.length];
    
    customers.push({
      name: companyName,
      contactPerson: contactPerson,
      email: `contact${i + 1}@${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      phone: generatePhoneNumber(),
      address: `${Math.floor(Math.random() * 9999) + 1} Harbor Drive, Port City, FL ${Math.floor(Math.random() * 90000) + 10000}`,
      taxId: generateTaxId(),
      userId: null
    });
  }

  await db.insert(schema.customers).values(customers);
  console.log(`✓ Created ${customers.length} customers`);
  return customers;
}

async function seedSuppliers() {
  console.log('Seeding suppliers...');
  const suppliers = [];
  
  for (let i = 0; i < 30; i++) {
    const supplierName = supplierNames[i % supplierNames.length] + ` ${Math.floor(i / supplierNames.length) + 1}`;
    const contactPerson = firstNames[(i + 10) % firstNames.length] + ' ' + lastNames[(i + 10) % lastNames.length];
    
    suppliers.push({
      name: supplierName,
      contactPerson: contactPerson,
      email: `supplier${i + 1}@${supplierName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      phone: generatePhoneNumber(),
      address: `${Math.floor(Math.random() * 9999) + 1} Industrial Blvd, Supply City, FL ${Math.floor(Math.random() * 90000) + 10000}`,
      taxId: generateTaxId(),
      bankInfo: `Bank: ${Math.floor(Math.random() * 1000000000).toString().padStart(10, '0')}`
    });
  }

  await db.insert(schema.suppliers).values(suppliers);
  console.log(`✓ Created ${suppliers.length} suppliers`);
  return suppliers;
}

async function seedEmployees() {
  console.log('Seeding employees...');
  const employees = [];
  const positions = ['Marine Engineer', 'Deck Officer', 'Welding Specialist', 'Project Manager', 'Quality Controller'];
  const departments = ['Engineering', 'Operations', 'Marine Services', 'Administration', 'Maintenance'];
  
  for (let i = 0; i < 40; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[i % lastNames.length];
    
    employees.push({
      employeeCode: `EMP${(i + 1).toString().padStart(3, '0')}`,
      firstName: firstName,
      lastName: lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@company.com`,
      phone: generatePhoneNumber(),
      position: positions[i % positions.length],
      department: departments[i % departments.length],
      category: ['permanent', 'consultant', 'contract'][i % 3],
      salary: (Math.floor(Math.random() * 85000) + 35000).toString(),
      hireDate: getRandomDate(new Date(2020, 0, 1), new Date()),
      isActive: Math.random() > 0.1,
      userId: null
    });
  }

  await db.insert(schema.employees).values(employees);
  console.log(`✓ Created ${employees.length} employees`);
  return employees;
}

async function seedProjects(customers: any[]) {
  console.log('Seeding projects...');
  const projects = [];
  const now = new Date().toISOString();
  
  for (let i = 0; i < 20; i++) {
    const startDate = getRandomDate(new Date(2024, 0, 1), now);
    const plannedEndDate = new Date(startDate.getTime() + (Math.random() * 90 + 30) * 24 * 60 * 60 * 1000); // 30-120 days
    const status = ['planning', 'in_progress', 'completed', 'on_hold'][Math.floor(Math.random() * 4)];
    const actualEndDate = status === 'completed' ? getRandomDate(startDate, plannedEndDate) : null;
    
    projects.push({
      title: projectTitles[i % projectTitles.length],
      description: `Complete maintenance and inspection project for vessel ${projectTitles[i % projectTitles.length].split(' - ')[1]}`,
      vesselName: projectTitles[i % projectTitles.length].split(' - ')[1],
      vesselImage: null,
      startDate: startDate,
      plannedEndDate: plannedEndDate,
      actualEndDate: actualEndDate,
      status: status,
      estimatedBudget: (Math.floor(Math.random() * 200000) + 50000).toString(),
      actualCost: (Math.floor(Math.random() * 150000) + 25000).toString(),
      customerId: customers[i % customers.length].id,
      locations: [`Port ${String.fromCharCode(65 + (i % 26))}`, `Dock ${i + 1}`]
    });
  }

  await db.insert(schema.projects).values(projects);
  console.log(`✓ Created ${projects.length} projects`);
  return projects;
}

async function seedInventory() {
  console.log('Seeding inventory...');
  const items = [];
  
  for (let i = 0; i < inventoryItems.length; i++) {
    const item = inventoryItems[i];
    const avgCost = Math.floor(Math.random() * 100) + 10;
    const currentStock = Math.floor(Math.random() * 1000) + 100;
    
    items.push({
      itemCode: `ITM${(i + 1).toString().padStart(3, '0')}`,
      name: item.name,
      description: `${item.name} for marine applications`,
      category: item.category,
      unit: item.unit,
      currentStock: currentStock,
      minStockLevel: Math.floor(currentStock * 0.2),
      maxStockLevel: Math.floor(currentStock * 2),
      avgCost: avgCost.toString(),
      lastUpdated: new Date().toISOString(),
      location: `Warehouse ${String.fromCharCode(65 + (i % 5))}`,
      isActive: true
    });
  }

  await db.insert(schema.inventoryItems).values(items);
  console.log(`✓ Created ${items.length} inventory items`);
  return items;
}

async function seedSalesQuotations(customers: any[], projects: any[]) {
  console.log('Seeding sales quotations...');
  const quotations = [];
  const now = new Date().toISOString();
  
  for (let i = 0; i < 15; i++) {
    const items = serviceItems.slice(0, Math.floor(Math.random() * 3) + 2).map(item => ({
      ...item,
      quantity: Math.floor(Math.random() * 3) + 1,
      taxAmount: (item.unitPrice * (item.taxRate / 100))
    }));
    
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const totalTaxAmount = items.reduce((sum, item) => sum + (item.taxAmount * item.quantity), 0);
    const discount = Math.random() > 0.7 ? Math.floor(Math.random() * 1000) : 0;
    const totalAmount = subtotal + totalTaxAmount - discount;
    
    quotations.push({
      quotationNumber: `QT-${Date.now() + i}`,
      customerId: customers[i % customers.length].id,
      projectId: Math.random() > 0.5 ? projects[i % projects.length].id : null,
      status: ['draft', 'sent', 'approved', 'rejected'][Math.floor(Math.random() * 4)],
      quotationDate: getRandomDate(new Date(2024, 0, 1), now),
      validUntil: getRandomDate(now, new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)),
      items: JSON.stringify(items),
      subtotal: subtotal.toString(),
      taxAmount: totalTaxAmount.toString(),
      discount: discount.toString(),
      totalAmount: totalAmount.toString(),
      isArchived: Math.random() > 0.9
    });
  }

  await db.insert(schema.salesQuotations).values(quotations);
  console.log(`✓ Created ${quotations.length} sales quotations`);
  return quotations;
}

async function seedProformaInvoices(customers: any[], projects: any[], quotations: any[]) {
  console.log('Seeding proforma invoices...');
  const proformas = [];
  const now = new Date().toISOString();
  
  for (let i = 0; i < 12; i++) {
    const items = serviceItems.slice(0, Math.floor(Math.random() * 3) + 2).map(item => ({
      ...item,
      quantity: Math.floor(Math.random() * 3) + 1,
      taxAmount: (item.unitPrice * (item.taxRate / 100))
    }));
    
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const totalTaxAmount = items.reduce((sum, item) => sum + (item.taxAmount * item.quantity), 0);
    const discount = Math.random() > 0.7 ? Math.floor(Math.random() * 1000) : 0;
    const totalAmount = subtotal + totalTaxAmount - discount;
    
    const createdDate = getRandomDate(new Date(2024, 0, 1), now);
    
    proformas.push({
      proformaNumber: `PI-${Date.now() + i}`,
      customerId: customers[i % customers.length].id,
      projectId: Math.random() > 0.6 ? projects[i % projects.length].id : null,
      quotationId: Math.random() > 0.7 ? quotations[i % quotations.length].id : null,
      status: ['draft', 'sent', 'approved', 'rejected', 'converted'][Math.floor(Math.random() * 5)],
      createdDate: createdDate,
      invoiceDate: getRandomDate(createdDate, now),
      validUntil: getRandomDate(now, new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)),
      paymentTerms: ['Net 30 days', 'Net 15 days', '2/10 Net 30'][Math.floor(Math.random() * 3)],
      deliveryTerms: ['FOB Origin', 'FOB Destination', 'CIF'][Math.floor(Math.random() * 3)],
      remarks: Math.random() > 0.5 ? 'All work to be completed according to maritime standards' : null,
      items: JSON.stringify(items),
      subtotal: subtotal.toString(),
      taxAmount: totalTaxAmount.toString(),
      discount: discount.toString(),
      totalAmount: totalAmount.toString(),
      isArchived: Math.random() > 0.9
    });
  }

  await db.insert(schema.proformaInvoices).values(proformas);
  console.log(`✓ Created ${proformas.length} proforma invoices`);
  return proformas;
}

async function seedSalesInvoices(customers: any[], projects: any[]) {
  console.log('Seeding sales invoices...');
  const invoices = [];
  const now = new Date().toISOString();
  
  for (let i = 0; i < 18; i++) {
    const items = serviceItems.slice(0, Math.floor(Math.random() * 3) + 2).map(item => ({
      ...item,
      quantity: Math.floor(Math.random() * 3) + 1,
      taxAmount: (item.unitPrice * (item.taxRate / 100))
    }));
    
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const totalTaxAmount = items.reduce((sum, item) => sum + (item.taxAmount * item.quantity), 0);
    const discount = Math.random() > 0.7 ? Math.floor(Math.random() * 1000) : 0;
    const totalAmount = subtotal + totalTaxAmount - discount;
    
    const invoiceDate = getRandomDate(new Date(2024, 0, 1), now);
    const dueDate = new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    invoices.push({
      invoiceNumber: `INV-${Date.now() + i}`,
      customerId: customers[i % customers.length].id,
      projectId: Math.random() > 0.5 ? projects[i % projects.length].id : null,
      status: ['draft', 'sent', 'paid', 'overdue', 'cancelled'][Math.floor(Math.random() * 5)],
      invoiceDate: invoiceDate,
      dueDate: dueDate,
      items: JSON.stringify(items),
      subtotal: subtotal.toString(),
      taxAmount: totalTaxAmount.toString(),
      discount: discount.toString(),
      totalAmount: totalAmount.toString(),
      paidAmount: Math.random() > 0.5 ? (totalAmount * Math.random()).toString() : '0',
      isArchived: Math.random() > 0.9
    });
  }

  await db.insert(schema.salesInvoices).values(invoices);
  console.log(`✓ Created ${invoices.length} sales invoices`);
  return invoices;
}

async function seedCreditNotes(customers: any[], salesInvoices: any[]) {
  console.log('Seeding credit notes...');
  const creditNotes = [];
  const now = new Date().toISOString();
  
  for (let i = 0; i < 8; i++) {
    const relatedInvoice = salesInvoices[i % salesInvoices.length];
    const items = [
      {
        description: "Refund for damaged equipment",
        quantity: 1,
        unitPrice: Math.floor(Math.random() * 1000) + 500,
        taxRate: 8.5,
        taxAmount: 0
      }
    ];
    
    items[0].taxAmount = items[0].unitPrice * (items[0].taxRate / 100);
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const totalTaxAmount = items.reduce((sum, item) => sum + item.taxAmount, 0);
    const totalAmount = subtotal + totalTaxAmount;
    
    creditNotes.push({
      creditNoteNumber: `CN-${Date.now() + i}`,
      salesInvoiceId: relatedInvoice.id,
      customerId: customers[i % customers.length].id,
      status: ['draft', 'issued', 'applied'][Math.floor(Math.random() * 3)],
      creditNoteDate: getRandomDate(new Date(2024, 0, 1), now),
      reason: ['Damaged goods', 'Service not satisfactory', 'Billing error', 'Customer return'][Math.floor(Math.random() * 4)],
      paymentTerms: 'Applied to customer account',
      bankAccount: 'BANK-001',
      remarks: Math.random() > 0.5 ? 'Credit processed as per customer request' : null,
      items: JSON.stringify(items),
      subtotal: subtotal.toString(),
      taxAmount: totalTaxAmount.toString(),
      discount: '0.00',
      totalAmount: totalAmount.toString(),
      createdAt: getRandomDate(new Date(2024, 0, 1), now)
    });
  }

  await db.insert(schema.creditNotes).values(creditNotes);
  console.log(`✓ Created ${creditNotes.length} credit notes`);
  return creditNotes;
}

async function seedPurchaseRequests(suppliers: any[], projects: any[], inventoryItems: any[]) {
  console.log('Seeding purchase requests...');
  const requests = [];
  const now = new Date().toISOString();
  
  for (let i = 0; i < 15; i++) {
    const requestItems = inventoryItems.slice(0, Math.floor(Math.random() * 4) + 2).map(item => ({
      inventoryItemId: item.id,
      quantity: Math.floor(Math.random() * 50) + 10,
      unitPrice: Math.floor(Math.random() * 100) + 20,
      totalPrice: 0
    }));
    
    requestItems.forEach(item => {
      item.totalPrice = item.quantity * item.unitPrice;
    });
    
    const totalAmount = requestItems.reduce((sum, item) => sum + item.totalPrice, 0);
    
    requests.push({
      requestNumber: `PR-${Date.now() + i}`,
      supplierId: suppliers[i % suppliers.length].id,
      projectId: Math.random() > 0.5 ? projects[i % projects.length].id : null,
      status: ['pending', 'approved', 'rejected', 'ordered'][Math.floor(Math.random() * 4)],
      requestDate: getRandomDate(new Date(2024, 0, 1), now),
      requiredDate: getRandomDate(now, new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)),
      justification: `Required materials for project operations and maintenance`,
      items: JSON.stringify(requestItems),
      totalAmount: totalAmount.toString(),
      isArchived: Math.random() > 0.9
    });
  }

  await db.insert(schema.purchaseRequests).values(requests);
  console.log(`✓ Created ${requests.length} purchase requests`);
  return requests;
}

async function seedAll() {
  try {
    console.log('Starting comprehensive data seeding...');
    
    // Clear existing data (in reverse dependency order)
    console.log('Clearing existing data...');
    await db.delete(schema.creditNotes);
    await db.delete(schema.salesInvoices);
    await db.delete(schema.proformaInvoices);
    await db.delete(schema.salesQuotations);
    await db.delete(schema.purchaseRequests);
    await db.delete(schema.inventoryItems);
    await db.delete(schema.projects);
    await db.delete(schema.employees);
    await db.delete(schema.suppliers);
    await db.delete(schema.customers);
    
    // Seed in dependency order
    const customers = await seedCustomers();
    const suppliers = await seedSuppliers();
    const employees = await seedEmployees();
    const projects = await seedProjects(customers);
    const inventoryItems = await seedInventory();
    const quotations = await seedSalesQuotations(customers, projects);
    const proformas = await seedProformaInvoices(customers, projects, quotations);
    const salesInvoices = await seedSalesInvoices(customers, projects);
    const creditNotes = await seedCreditNotes(customers, salesInvoices);
    const purchaseRequests = await seedPurchaseRequests(suppliers, projects, inventoryItems);
    
    console.log('\n✅ All data seeded successfully!');
    console.log('\n=== Seeding Summary ===');
    console.log(`Customers: ${customers.length}`);
    console.log(`Suppliers: ${suppliers.length}`);
    console.log(`Employees: ${employees.length}`);
    console.log(`Projects: ${projects.length}`);
    console.log(`Inventory Items: ${inventoryItems.length}`);
    console.log(`Sales Quotations: ${quotations.length}`);
    console.log(`Proforma Invoices: ${proformas.length}`);
    console.log(`Sales Invoices: ${salesInvoices.length}`);
    console.log(`Credit Notes: ${creditNotes.length}`);
    console.log(`Purchase Requests: ${purchaseRequests.length}`);
    
  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  }
}

// Run the seeding
seedAll()
  .then(() => {
    console.log('✅ Comprehensive seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Comprehensive seeding failed:', error);
    process.exit(1);
  });
