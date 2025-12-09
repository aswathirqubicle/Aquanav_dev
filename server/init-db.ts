import { db } from './db';
import * as schema from '../shared/schema';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { storage } from "./storage";

export async function initializeDatabase() {
  try {
    // Check if admin user exists
    const adminUser = await storage.getUserByUsername('admin');

    if (!adminUser) {
      // Create default admin user
      await storage.createUser({
        username: 'admin',
        email: 'admin@aquanav.com',
        password: 'admin123',
        role: 'admin',
        isActive: true,
      });
      console.log('Default admin user created: admin/admin123');
    }

    // Initialize company if not exists
    const company = await storage.getCompany();
    if (!company) {
      await storage.updateCompany({
        name: 'Aquanav Marine Solutions',
        email: 'info@aquanav.com',
        phone: '+1-555-MARINE',
        address: '123 Harbor Drive, Marine City, MC 12345',
        website: 'https://aquanav.com',
      });
      console.log('Default company information created');
    }

    // Create sample customer
    const existingCustomers = await db.select().from(schema.customers).limit(1);
    if (existingCustomers.length === 0) {
      await db.insert(schema.customers).values({
        name: 'Atlantic Shipping Co.',
        email: 'contact@atlanticship.com',
        phone: '+1-555-SHIP',
        address: '456 Port Avenue, Harbor City, HC 67890',
        contactPerson: 'Captain James Wilson',
        taxId: 'TAX123456789',
        userId: null
      });
      console.log('✓ Sample customer created');
    }

    // Create sample project
    const existingProjects = await db.select().from(schema.projects).limit(1);
    if (existingProjects.length === 0) {
      const customers = await db.select().from(schema.customers).limit(1);
      if (customers.length > 0) {
        await db.insert(schema.projects).values({
          title: 'Hull Maintenance - Atlantic Explorer',
          description: 'Complete hull inspection and maintenance for Atlantic Explorer vessel',
          vesselName: 'Atlantic Explorer',
          vesselImage: null,
          startDate: new Date('2024-01-15'),
          plannedEndDate: new Date('2024-02-28'),
          actualEndDate: null,
          status: 'in_progress',
          estimatedBudget: '125000.00',
          actualCost: '45000.00',
          customerId: customers[0].id,
          locations: ['Port A', 'Dry Dock B']
        });
        console.log('✓ Sample project created');
      }
    }

    // Create sample inventory item
    const existingInventory = await db.select().from(schema.inventoryItems).limit(1);
    if (existingInventory.length === 0) {
      await db.insert(schema.inventoryItems).values({
        name: 'Marine Grade Paint',
        description: 'High-quality anti-corrosive paint for marine vessels',
        category: 'consumables',
        unit: 'gallon',
        currentStock: 25,
        minStockLevel: 10,
        avgCost: '89.99'
      });
      console.log('✓ Sample inventory item created');
    }

    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}