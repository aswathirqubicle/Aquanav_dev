import { Storage } from './storage'; // Assuming Storage is exported from storage.ts
import { db } from './db';
import { inventoryItems, inventoryTransactions } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Mock the db module
jest.mock('./db', () => ({
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
  },
}));

describe('Storage Class - Goods Issue Operations', () => {
  let storageInstance: Storage;

  beforeEach(() => {
    storageInstance = new Storage();
    // Reset mocks before each test
    jest.clearAllMocks();
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
      // Mock getInventoryItem for item 1
      (db.select as jest.Mock).mockImplementationOnce(() => ({
        from: jest.fn().mockImplementationOnce(() => ({
          where: jest.fn().mockImplementationOnce(() => ({
            limit: jest.fn().mockResolvedValueOnce([mockInventoryItem1]),
          })),
        })),
      }));
      // Mock insert transaction for item 1
      (db.insert as jest.Mock).mockImplementationOnce(() => ({
        values: jest.fn().mockImplementationOnce(() => ({
          returning: jest.fn().mockResolvedValueOnce([mockTransaction1]),
        })),
      }));
      // Mock updateInventoryItem for item 1
      (db.update as jest.Mock).mockImplementationOnce(() => ({
        set: jest.fn().mockImplementationOnce(() => ({
          where: jest.fn().mockResolvedValueOnce(undefined), // Assuming update doesn't return specific data here
        })),
      }));

      // Mock getInventoryItem for item 2
      (db.select as jest.Mock).mockImplementationOnce(() => ({
        from: jest.fn().mockImplementationOnce(() => ({
          where: jest.fn().mockImplementationOnce(() => ({
            limit: jest.fn().mockResolvedValueOnce([mockInventoryItem2]),
          })),
        })),
      }));
      // Mock insert transaction for item 2
      (db.insert as jest.Mock).mockImplementationOnce(() => ({
        values: jest.fn().mockImplementationOnce(() => ({
          returning: jest.fn().mockResolvedValueOnce([mockTransaction2]),
        })),
      }));
      // Mock updateInventoryItem for item 2
      (db.update as jest.Mock).mockImplementationOnce(() => ({
        set: jest.fn().mockImplementationOnce(() => ({
          where: jest.fn().mockResolvedValueOnce(undefined),
        })),
      }));

      const goodsIssueItems = [mockItem1, mockItem2];
      const result = await storageInstance.createGoodsIssue(mockReference, mockProjectId, goodsIssueItems);

      // Verify getInventoryItem calls
      expect(db.select).toHaveBeenCalledTimes(2);
      expect(db.from).toHaveBeenCalledWith(inventoryItems);
      // Could add more specific checks for db.where(eq(inventoryItems.id, X)) if needed

      // Verify insert transaction calls
      expect(db.insert).toHaveBeenCalledTimes(2);
      expect(db.insert).toHaveBeenCalledWith(inventoryTransactions);
      expect(db.values).toHaveBeenNthCalledWith(1, {
        type: "outflow",
        itemId: mockItem1.inventoryItemId,
        quantity: mockItem1.quantity,
        unitCost: mockInventoryItem1.avgCost,
        remainingQuantity: 0,
        projectId: mockProjectId,
        reference: mockReference,
        timestamp: mockTimestamp,
      });
      expect(db.values).toHaveBeenNthCalledWith(2, {
        type: "outflow",
        itemId: mockItem2.inventoryItemId,
        quantity: mockItem2.quantity,
        unitCost: mockInventoryItem2.avgCost,
        remainingQuantity: 0,
        projectId: mockProjectId,
        reference: mockReference,
        timestamp: mockTimestamp,
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
        date: mockTimestamp,
      });
    });

    test('should throw an error if an inventory item is not found', async () => {
      // Mock getInventoryItem to return undefined for the first item
      (db.select as jest.Mock).mockImplementationOnce(() => ({
        from: jest.fn().mockImplementationOnce(() => ({
          where: jest.fn().mockImplementationOnce(() => ({
            limit: jest.fn().mockResolvedValueOnce([]), // Empty array means not found
          })),
        })),
      }));

      const goodsIssueItems = [mockItem1];
      await expect(storageInstance.createGoodsIssue(mockReference, mockProjectId, goodsIssueItems))
        .rejects
        .toThrow(`Inventory item with ID ${mockItem1.inventoryItemId} not found.`);

      expect(db.insert).not.toHaveBeenCalled();
      expect(db.update).not.toHaveBeenCalled();
    });

    test('should throw an error if there is insufficient stock', async () => {
      const lowStockItem = { ...mockInventoryItem1, currentStock: 1 }; // Only 1 in stock
      // Mock getInventoryItem for item 1 with low stock
       (db.select as jest.Mock).mockImplementationOnce(() => ({
        from: jest.fn().mockImplementationOnce(() => ({
          where: jest.fn().mockImplementationOnce(() => ({
            limit: jest.fn().mockResolvedValueOnce([lowStockItem]),
          })),
        })),
      }));

      const goodsIssueItems = [mockItem1]; // Requesting 2, but only 1 in stock
      await expect(storageInstance.createGoodsIssue(mockReference, mockProjectId, goodsIssueItems))
        .rejects
        .toThrow(`Insufficient stock for item ID ${mockItem1.inventoryItemId} (${lowStockItem.name}). Available: ${lowStockItem.currentStock}, Requested: ${mockItem1.quantity}`);

      expect(db.insert).not.toHaveBeenCalled();
      expect(db.update).not.toHaveBeenCalled();
    });

    // TODO: Add test for when avgCost is null/undefined on an inventory item (should default to "0")
    // TODO: Add test for when projectId is undefined

    test('should use "0" for unitCost if inventory item avgCost is null', async () => {
      const itemWithNullAvgCost = { ...mockInventoryItem1, avgCost: null };
      const expectedTransactionWithZeroCost = { ...mockTransaction1, unitCost: "0" };

      // Mock getInventoryItem
      (db.select as jest.Mock).mockImplementationOnce(() => ({
        from: jest.fn().mockImplementationOnce(() => ({
          where: jest.fn().mockImplementationOnce(() => ({
            limit: jest.fn().mockResolvedValueOnce([itemWithNullAvgCost]),
          })),
        })),
      }));
      // Mock insert transaction
      (db.insert as jest.Mock).mockImplementationOnce(() => ({
        values: jest.fn().mockImplementationOnce(() => ({
          returning: jest.fn().mockResolvedValueOnce([expectedTransactionWithZeroCost]),
        })),
      }));
      // Mock updateInventoryItem
      (db.update as jest.Mock).mockImplementationOnce(() => ({
        set: jest.fn().mockImplementationOnce(() => ({
          where: jest.fn().mockResolvedValueOnce(undefined),
        })),
      }));

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

      // Mock getInventoryItem
      (db.select as jest.Mock).mockImplementationOnce(() => ({
        from: jest.fn().mockImplementationOnce(() => ({
          where: jest.fn().mockImplementationOnce(() => ({
            limit: jest.fn().mockResolvedValueOnce([mockInventoryItem1]),
          })),
        })),
      }));
      // Mock insert transaction
      (db.insert as jest.Mock).mockImplementationOnce(() => ({
        values: jest.fn().mockImplementationOnce(() => ({
          returning: jest.fn().mockResolvedValueOnce([transactionWithoutProjectId]),
        })),
      }));
      // Mock updateInventoryItem
      (db.update as jest.Mock).mockImplementationOnce(() => ({
        set: jest.fn().mockImplementationOnce(() => ({
          where: jest.fn().mockResolvedValueOnce(undefined),
        })),
      }));

      const goodsIssueItems = [mockItem1];
      const result = await storageInstance.createGoodsIssue(mockReference, undefinedProjectId, goodsIssueItems);

      expect(db.insert).toHaveBeenCalledWith(inventoryTransactions);
      expect(db.values).toHaveBeenCalledWith(expect.objectContaining({
        projectId: undefinedProjectId, // Crucial check
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

    test('should log error and re-throw when an internal operation (this.getProject) fails', async () => {
      // Mock this.getProject to throw an error
      const getProjectMock = jest.spyOn(storageInstance, 'getProject')
                               .mockRejectedValue(mockError);

      // Spy on this.createErrorLog
      const createErrorLogMock = jest.spyOn(storageInstance, 'createErrorLog')
                                   .mockResolvedValue({ id: 1 } as any); // Mock successful log creation

      await expect(
        storageInstance.createProjectConsumables(mockProjectId, mockDate, mockItems, mockUserId)
      ).rejects.toThrow(`An unexpected error occurred in createProjectConsumables. Original error: ${mockError.message}`);

      expect(getProjectMock).toHaveBeenCalledWith(mockProjectId);
      expect(createErrorLogMock).toHaveBeenCalledTimes(1);
      expect(createErrorLogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: `Error in createProjectConsumables: ${mockError.message}. Context: ${JSON.stringify({ projectId: mockProjectId, date: mockDate, items: mockItems, userId: mockUserId })}`,
          stack: mockError.stack,
          url: 'server/storage.ts',
          severity: 'error',
          component: 'createProjectConsumables',
          userId: mockUserId,
        })
      );
    });

    test('should log error and re-throw known error type directly', async () => {
      const knownErrorMessage = "Insufficient stock for Test Item (ID: 1). Available: 0, Requested: 2.";
      const knownError = new Error(knownErrorMessage);
      knownError.stack = "Error: Insufficient stock...\n at someFile.ts:12:7";


      // Mock this.getProject to return a valid project to proceed to the transaction
      const mockProject = { id: mockProjectId, title: 'Test Project', /* other project fields */ };
      jest.spyOn(storageInstance, 'getProject').mockResolvedValue(mockProject as any);

      // Mock db.transaction to throw the known error
      // This requires a more complex mock since db.transaction takes a callback
      (db.transaction as jest.Mock).mockImplementationOnce(async (callback) => {
        // Simulate the callback execution that leads to an error
        try {
          // We need to ensure the callback is called and an error is thrown from within it
          // or from a db operation it calls.
          // For this test, we'll directly throw the error as if it came from an operation within the transaction.
          throw knownError;
        } catch (e) {
          throw e; // rethrow to be caught by createProjectConsumables
        }
      });

      // Spy on this.createErrorLog
      const createErrorLogMock = jest.spyOn(storageInstance, 'createErrorLog')
                                   .mockResolvedValue({ id: 1 } as any);

      await expect(
        storageInstance.createProjectConsumables(mockProjectId, mockDate, mockItems, mockUserId)
      ).rejects.toThrow(knownError); // Known errors are re-thrown directly

      expect(createErrorLogMock).toHaveBeenCalledTimes(1);
      expect(createErrorLogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: `Error in createProjectConsumables: ${knownError.message}. Context: ${JSON.stringify({ projectId: mockProjectId, date: mockDate, items: mockItems, userId: mockUserId })}`,
          stack: knownError.stack,
          url: 'server/storage.ts',
          severity: 'error',
          component: 'createProjectConsumables',
          userId: mockUserId,
        })
      );
    });
  });
});
