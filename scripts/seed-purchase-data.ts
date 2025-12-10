import { db } from '../server/db';
import * as schema from '../shared/schema';

const purchaseItems = [
  { description: "Marine Engine Parts", unitPrice: 2500, taxRate: 8.5 },
  { description: "Steel Welding Materials", unitPrice: 850, taxRate: 8.5 },
  { description: "Navigation Equipment", unitPrice: 1250, taxRate: 8.5 },
  { description: "Safety Equipment Supplies", unitPrice: 680, taxRate: 8.5 },
  { description: "Hydraulic Components", unitPrice: 1200, taxRate: 8.5 },
  { description: "Electrical Supplies", unitPrice: 950, taxRate: 8.5 },
  { description: "Deck Hardware", unitPrice: 750, taxRate: 8.5 },
  { description: "Paint and Coatings", unitPrice: 450, taxRate: 8.5 }
];

function getRandomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
}

async function seedPurchaseOrders() {
  console.log('Seeding purchase orders...');

  // Get existing suppliers and projects
  const suppliers = await db.select().from(schema.suppliers).limit(20);
  const projects = await db.select().from(schema.projects).limit(10);

  if (suppliers.length === 0) {
    console.log('No suppliers found. Please seed suppliers first.');
    return [];
  }

  const purchaseOrders = [];
  const now = new Date().toISOString();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();

  for (let i = 0; i < 20; i++) {
    const items = purchaseItems.slice(0, Math.floor(Math.random() * 3) + 2).map(item => ({
      ...item,
      quantity: Math.floor(Math.random() * 20) + 5,
      taxAmount: (item.unitPrice * (item.taxRate / 100))
    }));

    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const totalTaxAmount = items.reduce((sum, item) => sum + (item.taxAmount * item.quantity), 0);
    const totalAmount = subtotal + totalTaxAmount;

    const orderDate = getRandomDate(threeMonthsAgo, now);
    const expectedDeliveryDate = new Date(orderDate.getTime() + (Math.random() * 30 + 7) * 24 * 60 * 60 * 1000).toISOString();

    purchaseOrders.push({
      orderNumber: `PO-${Date.now() + i}`,
      supplierId: suppliers[i % suppliers.length].id,
      projectId: Math.random() > 0.6 && projects.length > 0 ? projects[i % projects.length].id : null,
      status: ['pending', 'confirmed', 'delivered', 'cancelled'][Math.floor(Math.random() * 4)],
      orderDate: orderDate,
      expectedDeliveryDate: expectedDeliveryDate,
      actualDeliveryDate: Math.random() > 0.5 ? getRandomDate(orderDate, expectedDeliveryDate) : null,
      items: JSON.stringify(items),
      subtotal: subtotal.toString(),
      taxAmount: totalTaxAmount.toString(),
      totalAmount: totalAmount.toString(),
      terms: ['Net 30 days', 'Net 15 days', '2/10 Net 30'][Math.floor(Math.random() * 3)],
      isArchived: Math.random() > 0.9
    });
  }

  await db.insert(schema.purchaseOrders).values(purchaseOrders);
  console.log(`✓ Created ${purchaseOrders.length} purchase orders`);
  return purchaseOrders;
}

async function seedPurchaseInvoices(purchaseOrders: any[]) {
  console.log('Seeding purchase invoices...');

  if (purchaseOrders.length === 0) {
    console.log('No purchase orders found. Skipping purchase invoices.');
    return [];
  }

  const purchaseInvoices = [];
  const now = new Date().toISOString();

  // Create invoices for 70% of purchase orders
  const ordersToInvoice = purchaseOrders.slice(0, Math.floor(purchaseOrders.length * 0.7));

  for (let i = 0; i < ordersToInvoice.length; i++) {
    const order = ordersToInvoice[i];
    const invoiceDate = getRandomDate(new Date(order.orderDate), now);
    const dueDate = new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Use same items as the purchase order or create variation
    const orderItems = JSON.parse(order.items);
    const items = orderItems.map((item: any) => ({
      ...item,
      // Slight variation in quantities for some realism
      quantity: Math.random() > 0.8 ? Math.max(1, item.quantity - Math.floor(Math.random() * 3)) : item.quantity
    }));

    const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
    const totalTaxAmount = items.reduce((sum: number, item: any) => sum + (item.taxAmount * item.quantity), 0);
    const totalAmount = subtotal + totalTaxAmount;
    const paidAmount = Math.random() > 0.3 ? totalAmount * Math.random() : 0;

    purchaseInvoices.push({
      invoiceNumber: `PINV-${Date.now() + i}`,
      purchaseOrderId: order.id,
      supplierId: order.supplierId,
      projectId: order.projectId,
      status: paidAmount >= totalAmount ? 'paid' : 
              paidAmount > 0 ? 'partially_paid' : 
              invoiceDate < new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) ? 'overdue' : 'pending',
      invoiceDate: invoiceDate,
      dueDate: dueDate,
      items: JSON.stringify(items),
      subtotal: subtotal.toString(),
      taxAmount: totalTaxAmount.toString(),
      totalAmount: totalAmount.toString(),
      paidAmount: paidAmount.toString(),
      paymentTerms: order.terms || 'Net 30 days',
      isArchived: Math.random() > 0.9
    });
  }

  await db.insert(schema.purchaseInvoices).values(purchaseInvoices);
  console.log(`✓ Created ${purchaseInvoices.length} purchase invoices`);
  return purchaseInvoices;
}

async function seedPurchaseQuotations() {
  console.log('Seeding purchase quotations...');

  // Get existing suppliers and projects
  const suppliers = await db.select().from(schema.suppliers).limit(15);
  const projects = await db.select().from(schema.projects).limit(8);

  if (suppliers.length === 0) {
    console.log('No suppliers found. Please seed suppliers first.');
    return [];
  }

  const purchaseQuotations = [];
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

  for (let i = 0; i < 12; i++) {
    const items = purchaseItems.slice(0, Math.floor(Math.random() * 4) + 2).map(item => ({
      ...item,
      quantity: Math.floor(Math.random() * 15) + 5,
      taxAmount: (item.unitPrice * (item.taxRate / 100))
    }));

    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const totalTaxAmount = items.reduce((sum, item) => sum + (item.taxAmount * item.quantity), 0);
    const totalAmount = subtotal + totalTaxAmount;

    const quotationDate = getRandomDate(threeMonthsAgo, now);
    const validUntil = new Date(quotationDate.getTime() + (Math.random() * 30 + 14) * 24 * 60 * 60 * 1000);

    purchaseQuotations.push({
      quotationNumber: `PQ-${Date.now() + i}`,
      supplierId: suppliers[i % suppliers.length].id,
      projectId: Math.random() > 0.6 && projects.length > 0 ? projects[i % projects.length].id : null,
      status: ['pending', 'approved', 'rejected', 'expired'][Math.floor(Math.random() * 4)],
      quotationDate: quotationDate,
      validUntil: validUntil,
      requestedDeliveryDate: getRandomDate(quotationDate, new Date(quotationDate.getTime() + 45 * 24 * 60 * 60 * 1000)),
      items: JSON.stringify(items),
      subtotal: subtotal.toString(),
      taxAmount: totalTaxAmount.toString(),
      totalAmount: totalAmount.toString(),
      terms: ['FOB Origin', 'FOB Destination', 'CIF'][Math.floor(Math.random() * 3)],
      remarks: Math.random() > 0.5 ? 'All prices include delivery and installation' : null,
      isArchived: Math.random() > 0.9
    });
  }

  await db.insert(schema.purchaseQuotations).values(purchaseQuotations);
  console.log(`✓ Created ${purchaseQuotations.length} purchase quotations`);
  return purchaseQuotations;
}

async function seedPurchaseRequests() {
  console.log('Seeding purchase requests...');

  // Get existing suppliers and projects
  const suppliers = await db.select().from(schema.suppliers).limit(30);
  const projects = await db.select().from(schema.projects).limit(15);
  const inventoryItems = await db.select().from(schema.inventoryItems).limit(50);
  const users = await db.select().from(schema.users).limit(10);

  if (suppliers.length === 0) {
    console.log('No suppliers found. Please seed suppliers first.');
    return [];
  }

  if (inventoryItems.length === 0) {
    console.log('No inventory items found. Please seed inventory first.');
    return [];
  }

  const purchaseRequests = [];
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

  for (let i = 0; i < 50; i++) {
    const totalEstimatedCost = Math.floor(Math.random() * 10000) + 1000;
    const requestDate = getRandomDate(threeMonthsAgo, now);
    const requiredDate = new Date(requestDate.getTime() + (Math.random() * 30 + 7) * 24 * 60 * 60 * 1000);
    const isApproved = Math.random() > 0.3;

    purchaseRequests.push({
      requestNumber: `PR-${Date.now() + i}`,
      requestDate: requestDate,
      status: ['pending', 'approved', 'rejected', 'completed'][Math.floor(Math.random() * 4)],
      urgency: ['low', 'normal', 'high', 'urgent'][Math.floor(Math.random() * 4)],
      requestedBy: users.length > 0 ? users[i % users.length].id : 1,
      approvedBy: isApproved && users.length > 0 ? users[Math.floor(Math.random() * users.length)].id : null,
      approvalDate: isApproved ? getRandomDate(requestDate, now) : null,
      reason: Math.random() > 0.5 ? 'Required for ongoing project operations and maintenance' : null,
    });
  }

  const insertedRequests = await db.insert(schema.purchaseRequests).values(purchaseRequests).returning();

  // Create purchase request items
  const requestItems = [];
  for (const request of insertedRequests) {
    const numItems = Math.floor(Math.random() * 5) + 2; // 2-6 items per request
    const selectedItems = inventoryItems.slice(0, numItems);

    for (const item of selectedItems) {
      requestItems.push({
        requestId: request.id,
        inventoryItemId: item.id,
        quantity: Math.floor(Math.random() * 50) + 10,
        notes: Math.random() > 0.7 ? 'Urgent requirement for project' : null,
      });
    }
  }

  await db.insert(schema.purchaseRequestItems).values(requestItems);
  console.log(`✓ Created ${purchaseRequests.length} purchase requests with ${requestItems.length} items`);
  return insertedRequests;
}

async function seedPurchaseData() {
  try {
    console.log('Starting purchase data seeding...');

    // Clear existing purchase data
    console.log('Clearing existing purchase data...');
    await db.delete(schema.purchaseInvoices);
    await db.delete(schema.purchaseOrders);
    await db.delete(schema.purchaseQuotations);
    await db.delete(schema.purchaseRequestItems);
    await db.delete(schema.purchaseRequests);

    // Seed in dependency order
    const purchaseQuotations = await seedPurchaseQuotations();
    const purchaseRequests = await seedPurchaseRequests();
    const purchaseOrders = await seedPurchaseOrders();
    const purchaseInvoices = await seedPurchaseInvoices(purchaseOrders);

    console.log('\n✅ Purchase data seeded successfully!');
    console.log('\n=== Purchase Data Summary ===');
    console.log(`Purchase Quotations: ${purchaseQuotations.length}`);
    console.log(`Purchase Requests: ${purchaseRequests.length}`);
    console.log(`Purchase Orders: ${purchaseOrders.length}`);
    console.log(`Purchase Invoices: ${purchaseInvoices.length}`);

  } catch (error) {
    console.error('Purchase data seeding failed:', error);
    throw error;
  }
}

// Run the seeding
seedPurchaseData()
  .then(() => {
    console.log('✅ Purchase data seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Purchase data seeding failed:', error);
    process.exit(1);
  });