import { EmployeeStorage } from "./employee";
import {
  CreatedGoodsReceipt,
  GoodsReceiptDetails,
  GoodsReceiptItemInput,
} from "./types";
import {
  InsertInventoryItem,
  InventoryItem,
  inventoryItems,
  inventoryTransactions,
  projects,
  purchaseInvoices,
  suppliers,
  users,
} from "@shared/schema";
import {
  and,
  eq,
  ilike,
  lte,
  sql,
} from "drizzle-orm";
import { db } from "../db";

export class InventoryStorage extends EmployeeStorage {
  // Inventory methods
  async getInventoryItems(): Promise<InventoryItem[]> {
    try {
      return await db.select().from(inventoryItems);
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getInventoryItems: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getInventoryItems",
        severity: "error",
      });
      throw error;
    }
  }

  async getInventoryItemsPaginated(
    page: number,
    limit: number,
    search: string,
    category: string,
    lowStock: boolean,
  ): Promise<{
    data: InventoryItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    lowStockTotal: number;
    totalInventoryValue: number;
  }> {
    try {
      const whereClauses = [];
      if (search) {
        whereClauses.push(ilike(inventoryItems.name, `%${search}%`));
      }
      if (category) {
        whereClauses.push(eq(inventoryItems.category, category));
      }
      if (lowStock) {
        whereClauses.push(
          lte(inventoryItems.currentStock, inventoryItems.minStockLevel),
        );
      }
      const conditions =
        whereClauses.length > 0 ? and(...whereClauses) : undefined;

      const dataQueryBuilder = db
        .select()
        .from(inventoryItems)
        .where(conditions)
        .orderBy(inventoryItems.id);
      const countQueryBuilder = db
        .select({ count: sql<number>`count(*)` })
        .from(inventoryItems)
        .where(conditions);

      const lowStockCountQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(inventoryItems)
        .where(
          and(
            conditions,
            lte(inventoryItems.currentStock, inventoryItems.minStockLevel),
          ),
        );

      const totalValueQuery = db
        .select({
          total: sql<number>`
          COALESCE(SUM(${inventoryItems.currentStock} * ${inventoryItems.avgCost}), 0)
        `,
        })
        .from(inventoryItems)
        .where(conditions);

      const paginatedResult = await this._getPaginatedResults<InventoryItem>(
        dataQueryBuilder,
        countQueryBuilder,
        page,
        limit,
      );

      const [lowStockResult] = await lowStockCountQuery;
      const [valueResult] = await totalValueQuery;

      return {
        ...paginatedResult,
        lowStockTotal: lowStockResult?.count ?? 0,
        totalInventoryValue: valueResult?.total ?? 0,
      };
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getInventoryItemsPaginated: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getInventoryItemsPaginated",
        severity: "error",
      });
      throw error;
    }
  }

  async createInventoryItem(
    itemData: InsertInventoryItem,
  ): Promise<InventoryItem> {
    try {
      const result = await db
        .insert(inventoryItems)
        .values(itemData)
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createInventoryItem: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createInventoryItem",
        severity: "error",
      });
      throw error;
    }
  }

  async updateInventoryItem(
    id: number,
    itemData: Partial<InventoryItem>,
  ): Promise<InventoryItem | undefined> {
    try {
      const result = await db
        .update(inventoryItems)
        .set(itemData)
        .where(eq(inventoryItems.id, id))
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateInventoryItem (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateInventoryItem",
        severity: "error",
      });
      throw error;
    }
  }

  // Goods Issue methods
  async getGoodsIssues(): Promise<any[]> {
    try {
      const flatTransactions = await db
        .select({
          transactionId: inventoryTransactions.id,
          reference: inventoryTransactions.reference,
          timestamp: inventoryTransactions.timestamp,
          projectId: inventoryTransactions.projectId,
          projectTitle: projects.title,
          createdById: inventoryTransactions.createdBy,
          createdByName: users.username,
          inventoryItemId: inventoryItems.id,
          inventoryItemName: inventoryItems.name,
          quantity: inventoryTransactions.quantity,
          unit: inventoryItems.unit,
        })
        .from(inventoryTransactions)
        .leftJoin(projects, eq(inventoryTransactions.projectId, projects.id))
        .leftJoin(users, eq(inventoryTransactions.createdBy, users.id))
        .leftJoin(
          inventoryItems,
          eq(inventoryTransactions.itemId, inventoryItems.id),
        )
        .where(eq(inventoryTransactions.type, "outflow"))
        .orderBy(
          inventoryTransactions.reference, // Order to help with grouping
          inventoryTransactions.projectId, // Order to help with grouping
          users.username, // Order to help with grouping
          projects.title, // Order to help with grouping
          inventoryTransactions.id, // Mimics ORDER BY it.id for items array
        );

      if (flatTransactions.length === 0) {
        return [];
      }

      const groupedByReference = new Map<string, any>();

      for (const t of flatTransactions) {
        // Create a composite key for grouping, as the original SQL did
        const groupKey = `${t.reference || "null"}-${t.projectId || "null"}-${
          t.createdByName || "null"
        }-${t.projectTitle || "null"}`;

        if (!groupedByReference.has(groupKey)) {
          groupedByReference.set(groupKey, {
            // Use the transactionId of the first item in the group as the main 'id'
            // and its timestamp as the main 'timestamp' for the group
            id: t.transactionId,
            reference: t.reference,
            timestamp: t.timestamp,
            projectId: t.projectId,
            projectTitle: t.projectTitle,
            createdByName: t.createdByName,
            items: [],
          });
        }

        const group = groupedByReference.get(groupKey)!;
        // Update timestamp if current transaction's timestamp is earlier
        if (t.timestamp < group.timestamp) {
          group.timestamp = t.timestamp;
          group.id = t.transactionId; // Also update id if timestamp is earlier
        }

        group.items.push({
          inventoryItemName: t.inventoryItemName,
          quantity: t.quantity,
          unit: t.unit,
        });
      }

      const result = Array.from(groupedByReference.values());
      // Sort by the group's timestamp (which is MIN(timestamp) due to the update logic)
      result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return result;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getGoodsIssues: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getGoodsIssues",
        severity: "error",
      });
      throw error;
    }
  }

  async createGoodsIssue(
    reference: string,
    projectId: number | undefined,
    items: Array<{ inventoryItemId: number; quantity: number }>,
    userId?: number,
  ): Promise<any> {
    try {
      console.log("Creating goods issue:", {
        reference,
        projectId,
        items,
        userId,
      });

      const createdTransactions = [];

      for (const item of items) {
        // Get inventory item details
        const inventoryItem = await this.getInventoryItem(item.inventoryItemId);
        if (!inventoryItem) {
          throw new Error(
            `Inventory item with ID ${item.inventoryItemId} not found.`,
          );
        }

        // Check stock availability
        if (inventoryItem.currentStock < item.quantity) {
          throw new Error(
            `Insufficient stock for item ID ${item.inventoryItemId} (${inventoryItem.name}). Available: ${inventoryItem.currentStock}, Requested: ${item.quantity}`,
          );
        }

        // Use avgCost as unit cost, default to "0" if null
        const unitCost = inventoryItem.avgCost || "0";

        // Create outflow transaction
        const transactionData = {
          itemId: item.inventoryItemId,
          type: "outflow" as const,
          quantity: item.quantity,
          unitCost: unitCost,
          remainingQuantity: 0, // For outflow, remaining quantity is 0
          projectId: projectId || null,
          reference: reference,
          createdBy: userId || null,
        };

        console.log("Creating transaction with data:", transactionData);

        const transaction = await db
          .insert(inventoryTransactions)
          .values(transactionData)
          .returning();

        console.log("Created transaction:", transaction[0]);

        createdTransactions.push(transaction[0]);

        // Update inventory item stock
        const newStock = inventoryItem.currentStock - item.quantity;
        await this.updateInventoryItem(item.inventoryItemId, {
          currentStock: newStock,
        });

        console.log(
          `Updated inventory item ${item.inventoryItemId} stock from ${inventoryItem.currentStock} to ${newStock}`,
        );
      }

      console.log("Goods issue created successfully");

      return {
        reference,
        projectId,
        items: createdTransactions.map((transaction) => ({
          inventoryTransactionId: transaction.id,
          inventoryItemId: transaction.itemId,
          quantity: transaction.quantity,
          unitCost: transaction.unitCost,
        })),
        date: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error("Original error in createGoodsIssue:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          "Error in createGoodsIssue: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createGoodsIssue",
        severity: "error",
      });
      throw error;
    }
  }

  async getInventoryItem(id: number): Promise<InventoryItem | undefined> {
    try {
      const result = await db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, id))
        .limit(1);
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getInventoryItem (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getInventoryItem",
        severity: "error",
      });
      throw error;
    }
  }

  // Goods Receipt methods
  async getGoodsReceipts(): Promise<GoodsReceiptDetails[]> {
    try {
      const flatTransactions = await db
        .select({
          transactionId: inventoryTransactions.id,
          reference: inventoryTransactions.reference,
          timestamp: inventoryTransactions.timestamp,
          createdById: inventoryTransactions.createdBy,
          createdByName: users.username,
          inventoryItemId: inventoryItems.id,
          inventoryItemName: inventoryItems.name,
          quantity: inventoryTransactions.quantity,
          unit: inventoryItems.unit,
          unitCost: inventoryTransactions.unitCost,
          supplierName: suppliers.name,
        })
        .from(inventoryTransactions)
        .leftJoin(users, eq(inventoryTransactions.createdBy, users.id))
        .leftJoin(
          inventoryItems,
          eq(inventoryTransactions.itemId, inventoryItems.id),
        )
        .leftJoin(
          purchaseInvoices,
          sql`${inventoryTransactions.reference} = 'PI-' || ${purchaseInvoices.invoiceNumber}`,
        )
        .leftJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id))
        .where(eq(inventoryTransactions.type, "inflow"))
        .orderBy(
          inventoryTransactions.reference,
          users.username,
          inventoryTransactions.id,
        );

      if (flatTransactions.length === 0) {
        return [];
      }

      const groupedByRefAndUser = new Map<string, any>();

      for (const t of flatTransactions) {
        const groupKey = `${t.reference || "null"}-${
          t.createdByName || "null"
        }`;

        if (!groupedByRefAndUser.has(groupKey)) {
          groupedByRefAndUser.set(groupKey, {
            id: t.transactionId,
            reference: t.reference,
            timestamp: t.timestamp,
            projectId: null,
            projectTitle: null,
            createdByName: t.createdByName,
            supplierName: (t as any).supplierName || null,
            items: [],
          });
        }

        const group = groupedByRefAndUser.get(groupKey)!;
        // Update timestamp if current transaction's timestamp is earlier
        if (t.timestamp < group.timestamp) {
          group.timestamp = t.timestamp;
          group.id = t.transactionId; // Also update id if timestamp is earlier
        }

        group.items.push({
          inventoryItemName: t.inventoryItemName,
          quantity: t.quantity,
          unit: t.unit,
          unitCost: t.unitCost,
        });
      }

      const result = Array.from(groupedByRefAndUser.values());
      result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return result;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getGoodsReceipts: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getGoodsReceipts",
        severity: "error",
      });
      throw error;
    }
  }

  async createGoodsReceipt(
    reference: string,
    items: GoodsReceiptItemInput[],
    userId?: number,
  ): Promise<CreatedGoodsReceipt> {
    try {
      console.log("Creating goods receipt:", { reference, items, userId });

      const createdTransactions = [];

      for (const item of items) {
        // Get inventory item details
        const inventoryItem = await this.getInventoryItem(item.inventoryItemId);
        if (!inventoryItem) {
          throw new Error(
            `Inventory item with ID ${item.inventoryItemId} not found.`,
          );
        }

        // Create inflow transaction
        const transactionData = {
          itemId: item.inventoryItemId,
          type: "inflow" as const,
          quantity: item.quantity,
          unitCost: item.unitCost.toString(),
          remainingQuantity: item.quantity,
          reference: reference,
          createdBy: userId || null,
        };

        console.log("Creating inflow transaction with data:", transactionData);

        const transaction = await db
          .insert(inventoryTransactions)
          .values(transactionData)
          .returning();

        console.log("Created transaction:", transaction[0]);

        createdTransactions.push(transaction[0]);

        // Update inventory item stock and average cost.
        //
        // currentStock is numeric(10,2), which comes back from the driver as a
        // STRING. `currentStock + quantity` was therefore string concatenation,
        // not addition: receiving 7 against a stock of "0.00" produced "0.007",
        // which the column then stored as 0.01. Every goods receipt — including
        // the one each purchase invoice approval creates — wrote a nonsense
        // figure, and avgCost below was derived from it. The other two lines
        // coerce correctly because `*` and `/` have no string meaning, so only
        // the addition was wrong.
        const stockBefore = Number(inventoryItem.currentStock);
        const newStock = stockBefore + Number(item.quantity);
        const currentValue =
          stockBefore * parseFloat(inventoryItem.avgCost || "0");
        const newValue = currentValue + item.quantity * item.unitCost;
        const newAvgCost =
          newStock > 0 ? (newValue / newStock).toFixed(4) : "0";

        await this.updateInventoryItem(item.inventoryItemId, {
          currentStock: newStock,
          avgCost: newAvgCost,
        });

        console.log(
          `Updated inventory item ${item.inventoryItemId} stock from ${inventoryItem.currentStock} to ${newStock}, avg cost: ${newAvgCost}`,
        );
      }

      console.log("Goods receipt created successfully");

      return {
        reference,
        items: createdTransactions.map((transaction) => ({
          inventoryTransactionId: transaction.id,
          inventoryItemId: transaction.itemId,
          quantity: transaction.quantity,
          unitCost: transaction.unitCost,
        })),
        date: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error("Original error in createGoodsReceipt:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          "Error in createGoodsReceipt: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createGoodsReceipt",
        severity: "error",
      });
      throw error;
    }
  }
}
