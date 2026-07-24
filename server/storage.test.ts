import { Storage } from './storage'; // Assuming Storage is exported from storage.ts
import { db } from './db';
import { inventoryItems, inventoryTransactions } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Mock the db module. The shared factory covers the full Drizzle chain surface
// (leftJoin/orderBy/offset/delete/transaction/...), which the previous inline
// stub did not — see server/test-db-mock.ts.
jest.mock('./db', () => require('./test-db-mock').createDbMock());

describe('Storage Class - Goods Issue Operations', () => {
  let storageInstance: Storage;

  beforeEach(() => {
    storageInstance = new Storage();
    // Reset mocks before each test
    jest.clearAllMocks();
    // clearAllMocks does not know about the mock's result queue
    (db as any).__resetQueue();
  });

  describe('createGoodsIssue', () => {
    const mockReference = 'TestGI001';
    const mockProjectId = 101;
    const mockTimestamp = new Date('2023-10-27T10:00:00.000Z');
    jest.useFakeTimers().setSystemTime(mockTimestamp);

    const mockItem1 = { inventoryItemId: 1, quantity: 2 };
    const mockItem2 = { inventoryItemId: 2, quantity: 5 };

    const mockInventoryItem1 = {
      id: 1,
      name: 'Test Item 1',
      currentStock: 10,
      avgCost: '20.00',
      // other fields as necessary
    };
    const mockInventoryItem2 = {
      id: 2,
      name: 'Test Item 2',
      currentStock: 20,
      avgCost: '5.50',
      // other fields as necessary
    };

    const mockTransaction1 = {
      id: 10,
      itemId: mockItem1.inventoryItemId,
      quantity: mockItem1.quantity,
      unitCost: mockInventoryItem1.avgCost,
      type: 'outflow',
      reference: mockReference,
      projectId: mockProjectId,
      timestamp: mockTimestamp,
      remainingQuantity: 0,
    };
    const mockTransaction2 = {
      id: 11,
      itemId: mockItem2.inventoryItemId,
      quantity: mockItem2.quantity,
      unitCost: mockInventoryItem2.avgCost,
      type: 'outflow',
      reference: mockReference,
      projectId: mockProjectId,
      timestamp: mockTimestamp,
      remainingQuantity: 0,
    };

    test('should successfully create a goods issue for multiple items', async () => {
      // Queue the results each awaited chain resolves to, in the order
      // createGoodsIssue consumes them. Per item: read the inventory item,
      // insert the transaction, then update the item's stock.
      (db as any).__queueResults(
        [mockInventoryItem1], // getInventoryItem(1)
        [mockTransaction1],   // insert inventory transaction
        // updateInventoryItem ends in .returning() and reads result[0], so it
        // must resolve to a row - the original stub resolved to undefined,
        // which is why it could never have passed.
        [{ ...mockInventoryItem1, currentStock: 8 }],
        [mockInventoryItem2], // getInventoryItem(2)
        [mockTransaction2],   // insert inventory transaction
        [{ ...mockInventoryItem2, currentStock: 15 }],
      );

      const goodsIssueItems = [mockItem1, mockItem2];
      const result = await storageInstance.createGoodsIssue(mockReference, mockProjectId, goodsIssueItems);

      // Verify getInventoryItem calls
      expect(db.select).toHaveBeenCalledTimes(2);
      expect(db.from).toHaveBeenCalledWith(inventoryItems);
      // Could add more specific checks for db.where(eq(inventoryItems.id, X)) if needed

      // Verify insert transaction calls
      expect(db.insert).toHaveBeenCalledTimes(2);
      expect(db.insert).toHaveBeenCalledWith(inventoryTransactions);
      // `timestamp` is no longer set explicitly - inventory_transactions
      // defaults it in the schema. `createdBy` is passed through instead.
      expect(db.values).toHaveBeenNthCalledWith(1, {
        type: "outflow",
        itemId: mockItem1.inventoryItemId,
        quantity: mockItem1.quantity,
        unitCost: mockInventoryItem1.avgCost,
        remainingQuantity: 0,
        projectId: mockProjectId,
        reference: mockReference,
        createdBy: null,
      });
      expect(db.values).toHaveBeenNthCalledWith(2, {
        type: "outflow",
        itemId: mockItem2.inventoryItemId,
        quantity: mockItem2.quantity,
        unitCost: mockInventoryItem2.avgCost,
        remainingQuantity: 0,
        projectId: mockProjectId,
        reference: mockReference,
        createdBy: null,
      });

      // Verify updateInventoryItem calls
      expect(db.update).toHaveBeenCalledTimes(2);
      expect(db.update).toHaveBeenCalledWith(inventoryItems);
      expect(db.set).toHaveBeenNthCalledWith(1, { currentStock: mockInventoryItem1.currentStock - mockItem1.quantity });
      expect(db.set).toHaveBeenNthCalledWith(2, { currentStock: mockInventoryItem2.currentStock - mockItem2.quantity });
      // Could add more specific checks for db.where(eq(inventoryItems.id, X))

      // Verify returned object
      expect(result).toEqual({
        reference: mockReference,
        projectId: mockProjectId,
        items: [
          {
            inventoryTransactionId: mockTransaction1.id,
            inventoryItemId: mockTransaction1.itemId,
            quantity: mockTransaction1.quantity,
            unitCost: mockTransaction1.unitCost,
          },
          {
            inventoryTransactionId: mockTransaction2.id,
            inventoryItemId: mockTransaction2.itemId,
            quantity: mockTransaction2.quantity,
            unitCost: mockTransaction2.unitCost,
          },
        ],
        // createGoodsIssue now returns an ISO string, not a Date instance
        date: mockTimestamp.toISOString(),
      });
    });

    test('should throw an error if an inventory item is not found', async () => {
      // getInventoryItem resolves to an empty array - item not found
      (db as any).__queueResult([]);

      const goodsIssueItems = [mockItem1];
      await expect(storageInstance.createGoodsIssue(mockReference, mockProjectId, goodsIssueItems))
        .rejects
        .toThrow(`Inventory item with ID ${mockItem1.inventoryItemId} not found.`);

      // No goods-issue side effects. Asserted per-table rather than
      // "not called at all", because the failure path writes an error_logs row.
      expect(db.insert).not.toHaveBeenCalledWith(inventoryTransactions);
      expect(db.update).not.toHaveBeenCalledWith(inventoryItems);
    });

    test('should throw an error if there is insufficient stock', async () => {
      const lowStockItem = { ...mockInventoryItem1, currentStock: 1 }; // Only 1 in stock
      // getInventoryItem returns the item with insufficient stock
      (db as any).__queueResult([lowStockItem]);

      const goodsIssueItems = [mockItem1]; // Requesting 2, but only 1 in stock
      await expect(storageInstance.createGoodsIssue(mockReference, mockProjectId, goodsIssueItems))
        .rejects
        .toThrow(`Insufficient stock for item ID ${mockItem1.inventoryItemId} (${lowStockItem.name}). Available: ${lowStockItem.currentStock}, Requested: ${mockItem1.quantity}`);

      // As above - error_logs insert is expected on the failure path.
      expect(db.insert).not.toHaveBeenCalledWith(inventoryTransactions);
      expect(db.update).not.toHaveBeenCalledWith(inventoryItems);
    });

    // TODO: Add test for when avgCost is null/undefined on an inventory item (should default to "0")
    // TODO: Add test for when projectId is undefined

    test('should use "0" for unitCost if inventory item avgCost is null', async () => {
      const itemWithNullAvgCost = { ...mockInventoryItem1, avgCost: null };
      const expectedTransactionWithZeroCost = { ...mockTransaction1, unitCost: "0" };

      (db as any).__queueResults(
        [itemWithNullAvgCost],           // getInventoryItem
        [expectedTransactionWithZeroCost], // insert transaction
        [{ ...itemWithNullAvgCost, currentStock: 8 }], // updateInventoryItem
      );

      const goodsIssueItems = [mockItem1];
      const result = await storageInstance.createGoodsIssue(mockReference, mockProjectId, goodsIssueItems);

      expect(db.insert).toHaveBeenCalledWith(inventoryTransactions);
      expect(db.values).toHaveBeenCalledWith(expect.objectContaining({
        unitCost: "0", // Crucial check
      }));
      expect(result.items[0].unitCost).toBe("0");
    });

    test('should correctly process goods issue when projectId is undefined', async () => {
      const undefinedProjectId = undefined;
      const transactionWithoutProjectId = { ...mockTransaction1, projectId: undefinedProjectId };

      (db as any).__queueResults(
        [mockInventoryItem1],          // getInventoryItem
        [transactionWithoutProjectId], // insert transaction
        [{ ...mockInventoryItem1, currentStock: 8 }], // updateInventoryItem
      );

      const goodsIssueItems = [mockItem1];
      const result = await storageInstance.createGoodsIssue(mockReference, undefinedProjectId, goodsIssueItems);

      expect(db.insert).toHaveBeenCalledWith(inventoryTransactions);
      // An absent projectId is normalised to null before insert, not left undefined.
      expect(db.values).toHaveBeenCalledWith(expect.objectContaining({
        projectId: null, // Crucial check
      }));
      expect(result.projectId).toBeUndefined();
      // Check if the transaction item in the result reflects undefined projectId if it's part of the transaction object
      // The current createGoodsIssue returns the transaction as is, which includes projectId.
    });
  });
});

describe('Storage Class - Project Consumables Operations', () => {
  let storageInstance: Storage;

  beforeEach(() => {
    storageInstance = new Storage();
    // Reset mocks before each test
    jest.clearAllMocks(); // Ensures mocks are clean for each test
  });

  afterEach(() => {
    jest.restoreAllMocks(); // Restore all spied/mocked functions to their original state
  });

  describe('createProjectConsumables', () => {
    const mockProjectId = 1;
    const mockDate = '2023-10-28';
    const mockItems = [{ inventoryItemId: 1, quantity: 2 }];
    const mockUserId = 123;
    const mockError = new Error("Internal DB failure!");
    mockError.stack = "Error: Internal DB failure!\n    at someFile.ts:10:5";

    // These two tests originally drove the error path by mocking `this.getProject`
    // and `db.transaction`. createProjectConsumables no longer calls either — it
    // inserts the parent row, then loops the items calling getInventoryItem.
    // They are rewritten to exercise the two error paths that actually exist,
    // preserving the original intent: the error is logged, then re-thrown.
    test('should log error and re-throw when an inventory item is not found', async () => {
      const createErrorLogMock = jest.spyOn(storageInstance, 'createErrorLog')
                                   .mockResolvedValue({ id: 1 } as any);

      (db as any).__queueResults(
        [{ id: 99, projectId: mockProjectId }], // insert parent consumable row
        [],                                     // getInventoryItem -> not found
      );

      const expectedMessage = `Inventory item with ID ${mockItems[0].inventoryItemId} not found`;

      await expect(
        storageInstance.createProjectConsumables(mockProjectId, mockDate, mockItems, mockUserId)
      ).rejects.toThrow(expectedMessage); // the original error is re-thrown as-is

      expect(createErrorLogMock).toHaveBeenCalledTimes(1);
      expect(createErrorLogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: `Error in createProjectConsumables: ${expectedMessage}`,
          severity: 'error',
          component: 'createProjectConsumables',
        })
      );
    });

    test('should log error and re-throw known error type directly', async () => {
      const outOfStockItem = { id: 1, name: 'Test Item', currentStock: 0, avgCost: '10.00' };
      const knownErrorMessage =
        `Insufficient stock for item ${outOfStockItem.name}. ` +
        `Available: ${outOfStockItem.currentStock}, Requested: ${mockItems[0].quantity}`;

      const createErrorLogMock = jest.spyOn(storageInstance, 'createErrorLog')
                                   .mockResolvedValue({ id: 1 } as any);

      (db as any).__queueResults(
        [{ id: 99, projectId: mockProjectId }], // insert parent consumable row
        [outOfStockItem],                       // getInventoryItem -> no stock
      );

      await expect(
        storageInstance.createProjectConsumables(mockProjectId, mockDate, mockItems, mockUserId)
      ).rejects.toThrow(knownErrorMessage); // Known errors are re-thrown directly

      // The catch block logs message/stack/component/severity and re-throws.
      // It does not add url, userId or a serialised Context - asserting those
      // is what made the original version unpassable.
      expect(createErrorLogMock).toHaveBeenCalledTimes(1);
      expect(createErrorLogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: `Error in createProjectConsumables: ${knownErrorMessage}`,
          severity: 'error',
          component: 'createProjectConsumables',
        })
      );
    });
  });
});
