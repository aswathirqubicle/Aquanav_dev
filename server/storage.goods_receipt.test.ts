import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { storage } from "./storage"; // Adjust path as necessary
import { db } from "./db"; // Adjust path as necessary
import {
  inventoryItems,
  inventoryTransactions,
  type InsertInventoryItem,
  type InventoryItem,
  type InventoryTransaction,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

// Helper function to clear tables
const clearTables = async () => {
  await db.delete(inventoryTransactions);
  await db.delete(inventoryItems);
};

// Helper function to seed inventory items
const seedInventoryItem = async (itemData: InsertInventoryItem): Promise<InventoryItem> => {
  const [item] = await db.insert(inventoryItems).values(itemData).returning();
  return item;
};

describe("Storage - createGoodsReceipt", () => {
  beforeEach(async () => {
    await clearTables();
  });

  afterEach(async () => {
    await clearTables();
  });

  it("Test 1: Successful Single Item Goods Receipt", async () => {
    const initialItem = await seedInventoryItem({
      name: "Test Item 1",
      description: "Description for item 1",
      unit: "PCS",
      category: "general",
      currentStock: 10,
      minStockLevel: 5,
      avgCost: "100.00", // Initial average cost
    });

    const reference = "GR-TEST-001";
    const itemsToReceive = [
      { inventoryItemId: initialItem.id, quantity: 5, unitCost: 120.00 },
    ];
    const userId = 1;

    const result = await storage.createGoodsReceipt(reference, itemsToReceive, userId);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Goods receipt created successfully");
    expect(result.createdTransactions).toHaveLength(1);
    expect(result.createdTransactions[0].inventoryItemId).toBe(initialItem.id);
    expect(result.createdTransactions[0].quantity).toBe(itemsToReceive[0].quantity);
    expect(result.createdTransactions[0].unitCost).toBe(itemsToReceive[0].unitCost.toString());

    // Verify inventory_transactions table
    const transactions = await db
      .select()
      .from(inventoryTransactions)
      .where(eq(inventoryTransactions.itemId, initialItem.id));
    expect(transactions).toHaveLength(1);
    const transaction = transactions[0];
    expect(transaction.type).toBe("inflow");
    expect(transaction.itemId).toBe(initialItem.id);
    expect(transaction.quantity).toBe(itemsToReceive[0].quantity);
    expect(transaction.unitCost).toBe(itemsToReceive[0].unitCost.toString());
    expect(transaction.reference).toBe(reference);
    expect(transaction.remainingQuantity).toBe(itemsToReceive[0].quantity);
    expect(transaction.createdBy).toBe(userId);

    // Verify inventoryItems table
    const updatedItem = await storage.getInventoryItem(initialItem.id);
    expect(updatedItem).toBeDefined();
    expect(updatedItem!.currentStock).toBe(10 + 5); // initialStock + receivedQuantity
    const expectedAvgCost = ((10 * 100.00) + (5 * 120.00)) / (10 + 5);
    expect(parseFloat(updatedItem!.avgCost!)).toBeCloseTo(expectedAvgCost, 2);
  });

  it("Test 2: Successful Multi-Item Goods Receipt", async () => {
    const item1 = await seedInventoryItem({
      name: "Multi Item 1",
      currentStock: 20,
      avgCost: "50.00",
      unit: "PCS",
      category: "multi",
      minStockLevel: 10,
    });
    const item2 = await seedInventoryItem({
      name: "Multi Item 2",
      currentStock: 30,
      avgCost: "75.00",
      unit: "BOX",
      category: "multi",
      minStockLevel: 15,
    });

    const reference = "GR-MULTI-001";
    const itemsToReceive = [
      { inventoryItemId: item1.id, quantity: 10, unitCost: 55.00 },
      { inventoryItemId: item2.id, quantity: 15, unitCost: 80.00 },
    ];
    const userId = 2;

    const result = await storage.createGoodsReceipt(reference, itemsToReceive, userId);
    expect(result.success).toBe(true);
    expect(result.createdTransactions).toHaveLength(2);

    // Verify Item 1
    const updatedItem1 = await storage.getInventoryItem(item1.id);
    expect(updatedItem1!.currentStock).toBe(20 + 10);
    const expectedAvgCost1 = ((20 * 50.00) + (10 * 55.00)) / (20 + 10);
    expect(parseFloat(updatedItem1!.avgCost!)).toBeCloseTo(expectedAvgCost1, 2);
    const transaction1 = await db.select().from(inventoryTransactions).where(and(eq(inventoryTransactions.itemId, item1.id), eq(inventoryTransactions.reference, reference))).then(rows => rows[0]);
    expect(transaction1).toBeDefined();
    expect(transaction1.quantity).toBe(10);
    expect(transaction1.unitCost).toBe("55.00");
    expect(transaction1.createdBy).toBe(userId);

    // Verify Item 2
    const updatedItem2 = await storage.getInventoryItem(item2.id);
    expect(updatedItem2!.currentStock).toBe(30 + 15);
    const expectedAvgCost2 = ((30 * 75.00) + (15 * 80.00)) / (30 + 15);
    expect(parseFloat(updatedItem2!.avgCost!)).toBeCloseTo(expectedAvgCost2, 2);
    const transaction2 = await db.select().from(inventoryTransactions).where(and(eq(inventoryTransactions.itemId, item2.id), eq(inventoryTransactions.reference, reference))).then(rows => rows[0]);
    expect(transaction2).toBeDefined();
    expect(transaction2.quantity).toBe(15);
    expect(transaction2.unitCost).toBe("80.00");
    expect(transaction2.createdBy).toBe(userId);
  });

  it("Test 3: Goods Receipt for a New Item (Stock 0)", async () => {
    const newItem = await seedInventoryItem({
      name: "New Stock Item",
      currentStock: 0,
      avgCost: "0",
      unit: "PCS",
      category: "new",
      minStockLevel: 5,
    });

    const reference = "GR-NEWSTOCK-001";
    const itemsToReceive = [
      { inventoryItemId: newItem.id, quantity: 25, unitCost: 40.00 },
    ];

    await storage.createGoodsReceipt(reference, itemsToReceive);

    const updatedItem = await storage.getInventoryItem(newItem.id);
    expect(updatedItem!.currentStock).toBe(25);
    expect(parseFloat(updatedItem!.avgCost!)).toBeCloseTo(40.00, 2);

    const transaction = await db.select().from(inventoryTransactions).where(eq(inventoryTransactions.itemId, newItem.id)).then(rows => rows[0]);
    expect(transaction).toBeDefined();
    expect(transaction.quantity).toBe(25);
    expect(transaction.unitCost).toBe("40.00");
  });

  it("Test 4: Goods Receipt for Non-Existent Item", async () => {
    const reference = "GR-NONEXIST-001";
    const nonExistentItemId = 99999;
    const itemsToReceive = [
      { inventoryItemId: nonExistentItemId, quantity: 10, unitCost: 10.00 },
    ];

    try {
      await storage.createGoodsReceipt(reference, itemsToReceive);
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain(`Inventory item with ID ${nonExistentItemId} not found`);
    }
  });

  it("Test 5: Average Cost Calculation Accuracy", async () => {
    const item = await seedInventoryItem({
      name: "Avg Cost Test Item",
      currentStock: 50,
      avgCost: "20.00", // Initial: 50 units @ $20/unit = $1000 value
      unit: "KG",
      category: "test",
      minStockLevel: 10,
    });

    const reference = "GR-AVGCOST-001";
    // Receive 30 units @ $25/unit = $750 value
    const itemsToReceive = [
      { inventoryItemId: item.id, quantity: 30, unitCost: 25.00 },
    ];

    await storage.createGoodsReceipt(reference, itemsToReceive);

    // Expected: Total value = $1000 + $750 = $1750. Total stock = 50 + 30 = 80 units.
    // New avg cost = $1750 / 80 = $21.875
    const expectedAvgCost = ((50 * 20.00) + (30 * 25.00)) / (50 + 30);

    const updatedItem = await storage.getInventoryItem(item.id);
    expect(updatedItem!.currentStock).toBe(80);
    expect(parseFloat(updatedItem!.avgCost!)).toBeCloseTo(expectedAvgCost, 2); // Drizzle stores numeric as string, ensure comparison is float
  });

  it("Test 6: createdBy field population", async () => {
    const item = await seedInventoryItem({
      name: "CreatedBy Test Item",
      currentStock: 10,
      avgCost: "5.00",
      unit: "PCS",
      category: "test",
      minStockLevel: 1,
    });

    const referenceWithUser = "GR-USER-001";
    const userId = 123;
    const itemsToReceive = [{ inventoryItemId: item.id, quantity: 5, unitCost: 6.00 }];

    // Test with userId
    await storage.createGoodsReceipt(referenceWithUser, itemsToReceive, userId);
    const transactionWithUser = await db
      .select()
      .from(inventoryTransactions)
      .where(and(eq(inventoryTransactions.itemId, item.id), eq(inventoryTransactions.reference, referenceWithUser)))
      .then(rows => rows[0]);
    expect(transactionWithUser).toBeDefined();
    expect(transactionWithUser.createdBy).toBe(userId);

    // Clear and re-seed for the next part of the test or use a different reference
    await db.delete(inventoryTransactions).where(eq(inventoryTransactions.reference, referenceWithUser));
    // Note: item stock/avgCost was modified by the previous call, if this matters for subsequent checks, re-seed or update.
    // For this test, we only care about createdBy, so it's fine.

    const referenceWithoutUser = "GR-NOUSER-001";
    // Test without userId
    await storage.createGoodsReceipt(referenceWithoutUser, itemsToReceive);
    const transactionWithoutUser = await db
      .select()
      .from(inventoryTransactions)
      .where(and(eq(inventoryTransactions.itemId, item.id), eq(inventoryTransactions.reference, referenceWithoutUser)))
      .then(rows => rows[0]);
    expect(transactionWithoutUser).toBeDefined();
    expect(transactionWithoutUser.createdBy).toBeNull();
  });
});
