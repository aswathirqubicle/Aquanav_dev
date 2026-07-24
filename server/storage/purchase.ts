import { SalesStorage } from "./sales";
import {
  InsertSupplierInventoryItem,
  SupplierInventoryItem,
  assetInventoryMaintenanceRecords,
  creditNotes,
  employees,
  generalLedgerEntries,
  inventoryItems,
  inventoryTransactions,
  purchaseCreditNotes,
  purchaseInvoiceFiles,
  purchaseInvoiceItems,
  purchaseInvoicePayments,
  purchaseInvoices,
  purchaseOrderFiles,
  purchaseOrderItems,
  purchaseOrders,
  purchasePaymentFiles,
  purchaseRequestItems,
  purchaseRequests,
  supplierInventoryItems,
  suppliers,
  users,
} from "@shared/schema";
import { PaginatedResponse } from "./types";
import { alias } from "drizzle-orm/pg-core";
import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { db } from "../db";

export class PurchaseStorage extends SalesStorage {
  // Supplier-Inventory Item mapping methods
  async getSupplierInventoryItems(
    inventoryItemId?: number,
    supplierId?: number,
  ): Promise<SupplierInventoryItem[]> {
    try {
      let query = db.select().from(supplierInventoryItems);

      if (inventoryItemId && supplierId) {
        query = query.where(
          and(
            eq(supplierInventoryItems.inventoryItemId, inventoryItemId),
            eq(supplierInventoryItems.supplierId, supplierId),
          ),
        );
      } else if (inventoryItemId) {
        query = query.where(
          eq(supplierInventoryItems.inventoryItemId, inventoryItemId),
        );
      } else if (supplierId) {
        query = query.where(eq(supplierInventoryItems.supplierId, supplierId));
      }

      return await query;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getSupplierInventoryItems: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getSupplierInventoryItems",
        severity: "error",
      });
      throw error;
    }
  }

  async createSupplierInventoryItem(
    data: InsertSupplierInventoryItem,
  ): Promise<SupplierInventoryItem> {
    try {
      console.log("Storage: Creating supplier inventory item with data:", data);

      // Validate required fields
      if (!data.supplierId || !data.inventoryItemId) {
        throw new Error("Supplier ID and Inventory Item ID are required");
      }

      // Ensure numeric fields are properly set and validated
      const cleanData = {
        supplierId: data.supplierId,
        inventoryItemId: data.inventoryItemId,
        supplierPartNumber: data.supplierPartNumber || null,
        unitCost: typeof data.unitCost === "number" ? data.unitCost : 0,
        minimumOrderQuantity:
          typeof data.minimumOrderQuantity === "number"
            ? data.minimumOrderQuantity
            : 1,
        leadTimeDays:
          typeof data.leadTimeDays === "number" ? data.leadTimeDays : 0,
        isPreferred: Boolean(data.isPreferred),
      };

      console.log("Storage: Clean data for insert:", cleanData);

      const result = await db
        .insert(supplierInventoryItems)
        .values(cleanData)
        .returning();
      console.log(
        "Storage: Successfully created supplier inventory item:",
        result[0],
      );
      return result[0];
    } catch (error: any) {
      console.error("Original error in createSupplierInventoryItem:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          "Error in createSupplierInventoryItem: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createSupplierInventoryItem",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteSupplierInventoryItemsByInventoryId(
    inventoryItemId: number,
  ): Promise<boolean> {
    try {
      const result = await db
        .delete(supplierInventoryItems)
        .where(eq(supplierInventoryItems.inventoryItemId, inventoryItemId));
      return true; // Original method did not check result.rowCount, so preserving that behavior.
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deleteSupplierInventoryItemsByInventoryId (inventoryItemId: ${inventoryItemId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteSupplierInventoryItemsByInventoryId",
        severity: "error",
      });
      throw error;
    }
  }

  async updateSupplierInventoryItem(
    id: number,
    data: Partial<InsertSupplierInventoryItem>,
  ): Promise<SupplierInventoryItem | undefined> {
    try {
      const result = await db
        .update(supplierInventoryItems)
        .set(data)
        .where(eq(supplierInventoryItems.id, id))
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateSupplierInventoryItem (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateSupplierInventoryItem",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteSupplierInventoryItem(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(supplierInventoryItems)
        .where(eq(supplierInventoryItems.id, id));
      return result.rowCount > 0;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deleteSupplierInventoryItem (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteSupplierInventoryItem",
        severity: "error",
      });
      throw error;
    }
  }

  async getSupplierInventoryItemsBySupplierId(
    supplierId: number,
  ): Promise<SupplierInventoryItem[]> {
    try {
      return await db
        .select()
        .from(supplierInventoryItems)
        .where(eq(supplierInventoryItems.supplierId, supplierId));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getSupplierInventoryItemsBySupplierId (supplierId: ${supplierId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getSupplierInventoryItemsBySupplierId",
        severity: "error",
      });
      throw error;
    }
  }

  // Purchase Request methods
  async getPurchaseRequestStats(): Promise<{
    totalRequests: number;
    pendingApproval: number;
    approved: number;
    urgentPriority: number;
  }> {
    try {
      const [stats] = await db
        .select({
          total: sql<number>`count(*)`,
          pending: sql<number>`count(*) filter (where status = 'pending')`,
          approved: sql<number>`count(*) filter (where status = 'approved')`,
          urgent: sql<number>`count(*) filter (where urgency in ('urgent', 'high'))`,
        })
        .from(purchaseRequests);

      return {
        totalRequests: Number(stats.total || 0),
        pendingApproval: Number(stats.pending || 0),
        approved: Number(stats.approved || 0),
        urgentPriority: Number(stats.urgent || 0),
      };
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getPurchaseRequestStats: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPurchaseRequestStats",
        severity: "error",
      });
      throw error;
    }
  }

  async getPurchaseRequestsPaginated(
    page: number,
    limit: number,
    filters?: {
      userId?: number;
      userRole?: string;
      status?: string;
      urgency?: string;
      search?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<PaginatedResponse<any>> {
    try {
      const requester = alias(users, "requester");
      const approver = alias(users, "approver");
      const requesterEmp = alias(employees, "requesterEmp");
      const approverEmp = alias(employees, "approverEmp");

      const queryConditions = [];
      if (
        filters?.userRole &&
        filters.userRole !== "admin" &&
        filters.userRole !== "finance" &&
        filters.userId
      ) {
        queryConditions.push(eq(purchaseRequests.requestedBy, filters.userId));
      }

      if (filters?.status && filters.status !== "all") {
        queryConditions.push(eq(purchaseRequests.status, filters.status));
      }

      if (filters?.urgency && filters.urgency !== "all") {
        queryConditions.push(eq(purchaseRequests.urgency, filters.urgency));
      }

      if (filters?.search && filters.search.trim()) {
        queryConditions.push(
          or(
            ilike(purchaseRequests.requestNumber, `%${filters.search}%`),
            ilike(purchaseRequests.reason, `%${filters.search}%`),
            ilike(requester.username, `%${filters.search}%`),
            ilike(requesterEmp.firstName, `%${filters.search}%`),
            ilike(requesterEmp.lastName, `%${filters.search}%`),
          ),
        );
      }

      if (filters?.startDate) {
        queryConditions.push(
          gte(purchaseRequests.requestDate, new Date(filters.startDate)),
        );
      }

      if (filters?.endDate) {
        queryConditions.push(
          lte(purchaseRequests.requestDate, new Date(filters.endDate)),
        );
      }

      const finalConditions =
        queryConditions.length > 0 ? and(...queryConditions) : undefined;

      const dataQueryBuilder = db
        .select({
          id: purchaseRequests.id,
          requestNumber: purchaseRequests.requestNumber,
          requestedBy: purchaseRequests.requestedBy,
          requestedByName: sql<string>`COALESCE(NULLIF(CONCAT(${requesterEmp.firstName}, ' ', ${requesterEmp.lastName}), ' '), ${requester.username}, 'Unknown')`,
          status: purchaseRequests.status,
          urgency: purchaseRequests.urgency,
          reason: purchaseRequests.reason,
          requestDate: purchaseRequests.requestDate,
          approvedBy: purchaseRequests.approvedBy,
          approvedByName: sql<string>`COALESCE(NULLIF(CONCAT(${approverEmp.firstName}, ' ', ${approverEmp.lastName}), ' '), ${approver.username}, '')`,
          approvalDate: purchaseRequests.approvalDate,
        })
        .from(purchaseRequests)
        .leftJoin(requester, eq(purchaseRequests.requestedBy, requester.id))
        .leftJoin(requesterEmp, eq(requester.id, requesterEmp.userId))
        .leftJoin(approver, eq(purchaseRequests.approvedBy, approver.id))
        .leftJoin(approverEmp, eq(approver.id, approverEmp.userId))
        .where(finalConditions)
        .orderBy(desc(purchaseRequests.requestDate));

      const countQueryBuilder = db
        .select({ count: sql<number>`count(*)` })
        .from(purchaseRequests)
        .leftJoin(requester, eq(purchaseRequests.requestedBy, requester.id))
        .leftJoin(requesterEmp, eq(requester.id, requesterEmp.userId))
        .where(finalConditions);

      const paginatedResult = await this._getPaginatedResults<any>(
        dataQueryBuilder,
        countQueryBuilder,
        page,
        limit,
      );

      // Get items for each request
      paginatedResult.data = await Promise.all(
        paginatedResult.data.map(async (request) => {
          const items = await db
            .select({
              id: purchaseRequestItems.id,
              requestId: purchaseRequestItems.requestId,
              inventoryItemId: purchaseRequestItems.inventoryItemId,
              inventoryItemName: inventoryItems.name,
              inventoryItemUnit: inventoryItems.unit,
              inventoryItemDescription: inventoryItems.description,
              quantity: purchaseRequestItems.quantity,
              notes: purchaseRequestItems.notes,
            })
            .from(purchaseRequestItems)
            .leftJoin(
              inventoryItems,
              eq(purchaseRequestItems.inventoryItemId, inventoryItems.id),
            )
            .where(eq(purchaseRequestItems.requestId, request.id));

          return {
            ...request,
            items,
          };
        }),
      );

      return paginatedResult;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getPurchaseRequestsPaginated: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPurchaseRequestsPaginated",
        severity: "error",
      });
      throw error;
    }
  }

  async getPurchaseRequests(
    userId?: number,
    userRole?: string,
  ): Promise<any[]> {
    try {
      const requester = alias(users, "requester");
      const approver = alias(users, "approver");
      // const approver = alias(employees, "approver");
      const requesterEmp = alias(employees, "requesterEmp");
      const approverEmp = alias(employees, "approverEmp");

      const conditions = [];
      if (
        userRole &&
        userRole !== "admin" &&
        userRole !== "finance" &&
        userId
      ) {
        conditions.push(eq(purchaseRequests.requestedBy, userId));
      }

      const result = await db
        .select({
          id: purchaseRequests.id,
          requestNumber: purchaseRequests.requestNumber,
          requestedBy: purchaseRequests.requestedBy,
          // requestedByName: sql<string>`COALESCE(CONCAT(employees.first_name, ' ', employees.last_name), 'Unknown')`,
          // requestedByName: sql<string>`COALESCE(users.username, '')`,
          requestedByName: sql<string>`COALESCE(NULLIF(CONCAT(${requesterEmp.firstName}, ' ', ${requesterEmp.lastName}), ' '), ${requester.username}, 'Unknown')`,
          status: purchaseRequests.status,
          urgency: purchaseRequests.urgency,
          reason: purchaseRequests.reason,
          requestDate: purchaseRequests.requestDate,
          approvedBy: purchaseRequests.approvedBy,
          // approvedByName: sql<string>`COALESCE(CONCAT(approver.first_name, ' ', approver.last_name), '')`,
          // approvedByName: sql<string>`COALESCE(CONCAT(approver.username), '')`,
          approvedByName: sql<string>`COALESCE(NULLIF(CONCAT(${approverEmp.firstName}, ' ', ${approverEmp.lastName}), ' '), ${approver.username}, '')`,
          approvalDate: purchaseRequests.approvalDate,
        })
        .from(purchaseRequests)
        // .leftJoin(employees, eq(purchaseRequests.requestedBy, employees.id))
        // .leftJoin(approver, eq(purchaseRequests.approvedBy, employees.id))
        // .leftJoin(users, eq(purchaseRequests.requestedBy, users.id))

        .leftJoin(requester, eq(purchaseRequests.requestedBy, requester.id))
        .leftJoin(requesterEmp, eq(requester.id, requesterEmp.userId))
        .leftJoin(approver, eq(purchaseRequests.approvedBy, approver.id))
        .leftJoin(approverEmp, eq(approver.id, approverEmp.userId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(purchaseRequests.requestDate));

      // Get items for each request
      const requestsWithItems = await Promise.all(
        result.map(async (request) => {
          const items = await db
            .select({
              id: purchaseRequestItems.id,
              requestId: purchaseRequestItems.requestId,
              inventoryItemId: purchaseRequestItems.inventoryItemId,
              inventoryItemName: inventoryItems.name,
              inventoryItemUnit: inventoryItems.unit,
              inventoryItemDescription: inventoryItems.description,
              quantity: purchaseRequestItems.quantity,
              notes: purchaseRequestItems.notes,
            })
            .from(purchaseRequestItems)
            .leftJoin(
              inventoryItems,
              eq(purchaseRequestItems.inventoryItemId, inventoryItems.id),
            )
            .where(eq(purchaseRequestItems.requestId, request.id));

          return {
            ...request,
            items,
          };
        }),
      );

      return requestsWithItems;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getPurchaseRequests: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPurchaseRequests",
        severity: "error",
      });
      throw error;
    }
  }

  async getPurchaseRequest(id: number): Promise<any> {
    try {
      // const emp = alias(employees, "emp");
      // const approver = alias(employees, "approver");
      const requester = alias(users, "requester");
      const approver = alias(users, "approver");
      const requesterEmp = alias(employees, "requesterEmp");
      const approverEmp = alias(employees, "approverEmp");

      const [request] = await db
        .select({
          id: purchaseRequests.id,
          requestNumber: purchaseRequests.requestNumber,
          requestedBy: purchaseRequests.requestedBy,
          // requestedByName: sql<string>`COALESCE(CONCAT(emp.first_name, ' ', emp.last_name), 'Unknown')`,
          requestedByName: sql<string>`COALESCE(NULLIF(CONCAT(${requesterEmp.firstName}, ' ', ${requesterEmp.lastName}), ' '), ${requester.username}, 'Unknown')`,
          status: purchaseRequests.status,
          urgency: purchaseRequests.urgency,
          reason: purchaseRequests.reason,
          requestDate: purchaseRequests.requestDate,
          approvedBy: purchaseRequests.approvedBy,
          // approvedByName: sql<string>`COALESCE(CONCAT(approver.first_name, ' ', approver.last_name), '')`,
          approvedByName: sql<string>`COALESCE(NULLIF(CONCAT(${approverEmp.firstName}, ' ', ${approverEmp.lastName}), ' '), ${approver.username}, '')`,
          approvalDate: purchaseRequests.approvalDate,
        })
        .from(purchaseRequests)
        // .leftJoin(emp, eq(purchaseRequests.requestedBy, emp.id))
        .leftJoin(requester, eq(purchaseRequests.requestedBy, requester.id))
        .leftJoin(requesterEmp, eq(requester.id, requesterEmp.userId))
        .leftJoin(approver, eq(purchaseRequests.approvedBy, approver.id))
        .leftJoin(approverEmp, eq(approver.id, approverEmp.userId))
        .where(eq(purchaseRequests.id, id));

      if (!request) return null;

      const items = await db
        .select({
          id: purchaseRequestItems.id,
          requestId: purchaseRequestItems.requestId,
          itemType: purchaseRequestItems.itemType,
          inventoryItemId: purchaseRequestItems.inventoryItemId,
          inventoryItemName: inventoryItems.name,
          inventoryItemUnit: inventoryItems.unit,
          inventoryItemDescription: inventoryItems.description,
          description: purchaseRequestItems.description,
          quantity: purchaseRequestItems.quantity,
          unitPrice: purchaseRequestItems.unitPrice,
          notes: purchaseRequestItems.notes,
        })
        .from(purchaseRequestItems)
        .leftJoin(
          inventoryItems,
          eq(purchaseRequestItems.inventoryItemId, inventoryItems.id),
        )
        .where(eq(purchaseRequestItems.requestId, id));

      return { ...request, items };
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getPurchaseRequest (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPurchaseRequest",
        severity: "error",
      });
      throw error;
    }
  }

  async createPurchaseRequest(requestData: any): Promise<any> {
    try {
      const requestNumber = await this.generateNextNumber(
        "PR",
        purchaseRequests,
        purchaseRequests.requestNumber,
      );

      const [request] = await db
        .insert(purchaseRequests)
        .values({
          requestNumber,
          requestedBy: requestData.requestedBy,
          urgency: requestData.urgency,
          reason: requestData.reason,
          status: "pending",
        })
        .returning();

      if (requestData.items && requestData.items.length > 0) {
        await db.insert(purchaseRequestItems).values(
          requestData.items.map((item: any) => ({
            requestId: request.id,
            itemType: item.itemType || "product",
            inventoryItemId: item.inventoryItemId || null,
            description: item.description || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice || null,
            notes: item.notes,
          })),
        );
      }

      return this.getPurchaseRequest(request.id);
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createPurchaseRequest: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createPurchaseRequest",
        severity: "error",
      });
      throw error;
    }
  }

  async updatePurchaseRequest(id: number, data: any): Promise<any> {
    try {
      await db
        .update(purchaseRequests)
        .set(data)
        .where(eq(purchaseRequests.id, id));

      return this.getPurchaseRequest(id);
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updatePurchaseRequest (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updatePurchaseRequest",
        severity: "error",
      });
      throw error;
    }
  }

  async deletePurchaseRequest(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(purchaseRequests)
        .where(eq(purchaseRequests.id, id))
        .returning();
      return result.length > 0;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deletePurchaseRequest (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deletePurchaseRequest",
        severity: "error",
      });
      throw error;
    }
  }

  // Purchase Order methods
  async getPurchaseOrderStats(): Promise<{
    totalOrders: number;
    approved: number;
    pendingApproval: number;
    totalValue: string;
  }> {
    try {
      const [stats] = await db
        .select({
          total: sql<number>`count(*)`,
          approved: sql<number>`count(*) filter (where status = 'approved')`,
          pending: sql<number>`count(*) filter (where status = 'pending_approval')`,
          totalValue: sql<number>`sum(total_amount)`,
        })
        .from(purchaseOrders);

      return {
        totalOrders: Number(stats.total || 0),
        approved: Number(stats.approved || 0),
        pendingApproval: Number(stats.pending || 0),
        totalValue: Number(stats.totalValue || 0).toFixed(2),
      };
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getPurchaseOrderStats: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPurchaseOrderStats",
        severity: "error",
      });
      throw error;
    }
  }

  async getPurchaseOrdersPaginated(
    page: number,
    limit: number,
    filters?: {
      search?: string;
      status?: string;
      supplierId?: number;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<PaginatedResponse<any>> {
    try {
      const queryConditions = [];

      if (filters?.search && filters.search.trim()) {
        queryConditions.push(
          or(
            ilike(purchaseOrders.poNumber, `%${filters.search}%`),
            ilike(suppliers.name, `%${filters.search}%`),
          ),
        );
      }

      if (filters?.status && filters.status !== "all") {
        queryConditions.push(eq(purchaseOrders.status, filters.status));
      }

      if (filters?.supplierId) {
        queryConditions.push(eq(purchaseOrders.supplierId, filters.supplierId));
      }

      if (filters?.startDate) {
        queryConditions.push(
          gte(purchaseOrders.orderDate, new Date(filters.startDate)),
        );
      }

      if (filters?.endDate) {
        queryConditions.push(
          lte(purchaseOrders.orderDate, new Date(filters.endDate)),
        );
      }

      const finalConditions =
        queryConditions.length > 0 ? and(...queryConditions) : undefined;

      const dataQueryBuilder = db
        .select({
          id: purchaseOrders.id,
          poNumber: purchaseOrders.poNumber,
          supplierId: purchaseOrders.supplierId,
          supplierName: suppliers.name,
          status: purchaseOrders.status,
          orderDate: purchaseOrders.orderDate,
          expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
          paymentTerms: purchaseOrders.paymentTerms,
          deliveryTerms: purchaseOrders.deliveryTerms,
          bankAccount: purchaseOrders.bankAccount,
          subtotal: purchaseOrders.subtotal,
          discountPercentage: purchaseOrders.discountPercentage,
          discountAmount: purchaseOrders.discountAmount,
          taxAmount: purchaseOrders.taxAmount,
          totalAmount: purchaseOrders.totalAmount,
          notes: purchaseOrders.notes,
          createdAt: purchaseOrders.createdAt,
          currency: purchaseOrders.currency,
          exchangeRate: purchaseOrders.exchangeRate,
          supplierCurrency: suppliers.currency,
          supplierVatTreatment: suppliers.vatTreatment,
        })
        .from(purchaseOrders)
        .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
        .where(finalConditions)
        .orderBy(desc(purchaseOrders.createdAt));

      const countQueryBuilder = db
        .select({ count: sql<number>`count(*)` })
        .from(purchaseOrders)
        .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
        .where(finalConditions);

      const paginatedResult = await this._getPaginatedResults<any>(
        dataQueryBuilder,
        countQueryBuilder,
        page,
        limit,
      );

      // Get items and files for each purchase order
      paginatedResult.data = await Promise.all(
        paginatedResult.data.map(async (order) => {
          const items = await this.getPurchaseOrderItems(order.id);
          const files = await db
            .select()
            .from(purchaseOrderFiles)
            .where(eq(purchaseOrderFiles.poId, order.id));
          return {
            ...order,
            items,
            files,
          };
        }),
      );

      return paginatedResult;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getPurchaseOrdersPaginated: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPurchaseOrdersPaginated",
        severity: "error",
      });
      throw error;
    }
  }

  async getPurchaseOrders(): Promise<any[]> {
    try {
      const result = await db
        .select({
          id: purchaseOrders.id,
          poNumber: purchaseOrders.poNumber,
          supplierId: purchaseOrders.supplierId,
          supplierName: suppliers.name,
          status: purchaseOrders.status,
          orderDate: purchaseOrders.orderDate,
          expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
          paymentTerms: purchaseOrders.paymentTerms,
          deliveryTerms: purchaseOrders.deliveryTerms,
          bankAccount: purchaseOrders.bankAccount,
          subtotal: purchaseOrders.subtotal,
          discountPercentage: purchaseOrders.discountPercentage,
          discountAmount: purchaseOrders.discountAmount,
          taxAmount: purchaseOrders.taxAmount,
          totalAmount: purchaseOrders.totalAmount,
          notes: purchaseOrders.notes,
          createdAt: purchaseOrders.createdAt,
          currency: purchaseOrders.currency,
          exchangeRate: purchaseOrders.exchangeRate,
          supplierCurrency: suppliers.currency,
          supplierVatTreatment: suppliers.vatTreatment,
        })
        .from(purchaseOrders)
        .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
        .orderBy(desc(purchaseOrders.createdAt));

      // Get items and files for each purchase order
      const ordersWithItems = await Promise.all(
        result.map(async (order) => {
          const items = await this.getPurchaseOrderItems(order.id);
          const files = await db
            .select()
            .from(purchaseOrderFiles)
            .where(eq(purchaseOrderFiles.poId, order.id));
          return {
            ...order,
            items,
            files,
          };
        }),
      );

      return ordersWithItems;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getPurchaseOrders: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPurchaseOrders",
        severity: "error",
      });
      throw error;
    }
  }

  async getPurchaseOrder(id: number): Promise<any> {
    try {
      const [order] = await db
        .select({
          id: purchaseOrders.id,
          poNumber: purchaseOrders.poNumber,
          supplierId: purchaseOrders.supplierId,
          supplierName: suppliers.name,
          status: purchaseOrders.status,
          orderDate: purchaseOrders.orderDate,
          expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
          paymentTerms: purchaseOrders.paymentTerms,
          deliveryTerms: purchaseOrders.deliveryTerms,
          bankAccount: purchaseOrders.bankAccount,
          subtotal: purchaseOrders.subtotal,
          discountPercentage: purchaseOrders.discountPercentage,
          discountAmount: purchaseOrders.discountAmount,
          taxAmount: purchaseOrders.taxAmount,
          totalAmount: purchaseOrders.totalAmount,
          notes: purchaseOrders.notes,
          createdAt: purchaseOrders.createdAt,
          currency: purchaseOrders.currency,
          exchangeRate: purchaseOrders.exchangeRate,
          supplierCurrency: suppliers.currency,
          supplierVatTreatment: suppliers.vatTreatment,
          submittedById: purchaseOrders.submittedById,
          submittedAt: purchaseOrders.submittedAt,
          approvedById: purchaseOrders.approvedById,
          approvedAt: purchaseOrders.approvedAt,
          rejectionReason: purchaseOrders.rejectionReason,
        })
        .from(purchaseOrders)
        .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
        .where(eq(purchaseOrders.id, id));

      if (!order) return null;

      const items = await this.getPurchaseOrderItems(id);
      const files = await db
        .select()
        .from(purchaseOrderFiles)
        .where(eq(purchaseOrderFiles.poId, id));

      return { ...order, items, files };
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getPurchaseOrder (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPurchaseOrder",
        severity: "error",
      });
      throw error;
    }
  }

  async getPurchaseOrderItems(poId: number): Promise<any[]> {
    try {
      const items = await db
        .select({
          id: purchaseOrderItems.id,
          poId: purchaseOrderItems.poId,
          itemType: purchaseOrderItems.itemType,
          inventoryItemId: purchaseOrderItems.inventoryItemId,
          inventoryItemName: inventoryItems.name,
          inventoryItemUnit: inventoryItems.unit,
          inventoryItemDescription: inventoryItems.description,
          description: purchaseOrderItems.description,
          quantity: purchaseOrderItems.quantity,
          unitPrice: purchaseOrderItems.unitPrice,
          taxRate: purchaseOrderItems.taxRate,
          taxAmount: purchaseOrderItems.taxAmount,
          lineTotal: purchaseOrderItems.lineTotal,
        })
        .from(purchaseOrderItems)
        .leftJoin(
          inventoryItems,
          eq(purchaseOrderItems.inventoryItemId, inventoryItems.id),
        )
        .where(eq(purchaseOrderItems.poId, poId));

      return items;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getPurchaseOrderItems (poId: ${poId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPurchaseOrderItems",
        severity: "error",
      });
      throw error;
    }
  }

  async createPurchaseOrder(orderData: any): Promise<any> {
    try {
      const poNumber = await this.generateNextNumber(
        "PO",
        purchaseOrders,
        purchaseOrders.poNumber,
      );

      // Create the purchase order
      const [order] = await db
        .insert(purchaseOrders)
        .values({
          poNumber,
          supplierId: orderData.supplierId,
          status: orderData.status || "draft",
          orderDate: orderData.orderDate
            ? new Date(orderData.orderDate)
            : new Date(),
          expectedDeliveryDate: orderData.expectedDeliveryDate
            ? new Date(orderData.expectedDeliveryDate)
            : null,
          paymentTerms: orderData.paymentTerms || null,
          deliveryTerms: orderData.deliveryTerms || null,
          bankAccount: orderData.bankAccount || null,
          subtotal: orderData.subtotal || "0",
          discountPercentage: orderData.discountPercentage || "0",
          discountAmount: orderData.discountAmount || "0",
          taxAmount: orderData.taxAmount || "0",
          totalAmount: orderData.totalAmount || "0",
          notes: orderData.notes || null,
          currency: orderData.currency || "AED",
          exchangeRate: orderData.exchangeRate || "1",
        })
        .returning();

      // Create order items if provided
      if (orderData.items && orderData.items.length > 0) {
        const itemsToInsert = orderData.items.map((item: any) => ({
          poId: order.id,
          itemType: item.itemType || "product",
          inventoryItemId: item.inventoryItemId || null,
          description: item.description || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toFixed(2),
          taxRate: item.taxRate ? item.taxRate.toFixed(2) : "0.00",
          taxAmount: item.taxAmount ? item.taxAmount.toFixed(2) : "0.00",
          lineTotal: (
            item.quantity * parseFloat(item.unitPrice) +
            (item.taxAmount || 0)
          ).toFixed(2),
        }));

        await db.insert(purchaseOrderItems).values(itemsToInsert);
      }

      // Handle file attachments
      if (orderData.files && orderData.files.length > 0) {
        const filesToInsert = orderData.files.map((file: any) => ({
          poId: order.id,
          fileName: file.filename,
          originalName: file.originalname,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype,
        }));
        await db.insert(purchaseOrderFiles).values(filesToInsert);
      }

      return this.getPurchaseOrder(order.id);
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createPurchaseOrder: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createPurchaseOrder",
        severity: "error",
      });
      throw error;
    }
  }

  async updatePurchaseOrder(id: number, data: any): Promise<any> {
    try {
      const updateData: any = {};

      if (data.supplierId !== undefined)
        updateData.supplierId = data.supplierId;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.orderDate !== undefined) {
        updateData.orderDate = data.orderDate
          ? new Date(data.orderDate)
          : new Date();
      }
      if (data.expectedDeliveryDate !== undefined) {
        updateData.expectedDeliveryDate = data.expectedDeliveryDate
          ? new Date(data.expectedDeliveryDate)
          : null;
      }
      if (data.paymentTerms !== undefined)
        updateData.paymentTerms = data.paymentTerms || null;
      if (data.deliveryTerms !== undefined)
        updateData.deliveryTerms = data.deliveryTerms || null;
      if (data.bankAccount !== undefined)
        updateData.bankAccount = data.bankAccount || null;
      if (data.notes !== undefined) updateData.notes = data.notes || null;
      if (data.subtotal !== undefined) updateData.subtotal = data.subtotal;
      if (data.discountPercentage !== undefined)
        updateData.discountPercentage = data.discountPercentage;
      if (data.discountAmount !== undefined)
        updateData.discountAmount = data.discountAmount;
      if (data.taxAmount !== undefined) updateData.taxAmount = data.taxAmount;
      if (data.totalAmount !== undefined)
        updateData.totalAmount = data.totalAmount;
      if (data.currency !== undefined) updateData.currency = data.currency;
      if (data.exchangeRate !== undefined)
        updateData.exchangeRate = data.exchangeRate;

      await db
        .update(purchaseOrders)
        .set(updateData)
        .where(eq(purchaseOrders.id, id));

      // Update items if provided
      if (data.items !== undefined && Array.isArray(data.items)) {
        // Delete existing items
        await db
          .delete(purchaseOrderItems)
          .where(eq(purchaseOrderItems.poId, id));

        // Insert new items
        if (data.items.length > 0) {
          const itemsToInsert = data.items.map((item: any) => ({
            poId: id,
            itemType: item.itemType || "product",
            inventoryItemId: item.inventoryItemId || null,
            description: item.description || null,
            quantity: item.quantity,
            unitPrice:
              typeof item.unitPrice === "number"
                ? item.unitPrice.toFixed(2)
                : item.unitPrice,
            taxRate: item.taxRate
              ? typeof item.taxRate === "number"
                ? item.taxRate.toFixed(2)
                : item.taxRate
              : "0.00",
            taxAmount: item.taxAmount
              ? typeof item.taxAmount === "number"
                ? item.taxAmount.toFixed(2)
                : item.taxAmount
              : "0.00",
            lineTotal: (
              item.quantity * parseFloat(item.unitPrice) +
              (item.taxAmount || 0)
            ).toFixed(2),
          }));

          await db.insert(purchaseOrderItems).values(itemsToInsert);
        }
      }

      // Handle file attachments
      if (data.files && data.files.length > 0) {
        const filesToInsert = data.files.map((file: any) => ({
          poId: id,
          fileName: file.filename,
          originalName: file.originalname,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype,
        }));
        await db.insert(purchaseOrderFiles).values(filesToInsert);
      }

      return this.getPurchaseOrder(id);
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updatePurchaseOrder (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updatePurchaseOrder",
        severity: "error",
      });
      throw error;
    }
  }

  async deletePurchaseOrder(id: number): Promise<boolean> {
    try {
      // Delete order items first
      await db
        .delete(purchaseOrderItems)
        .where(eq(purchaseOrderItems.poId, id));

      // Delete the order
      const result = await db
        .delete(purchaseOrders)
        .where(eq(purchaseOrders.id, id));

      return result.rowCount > 0;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deletePurchaseOrder (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deletePurchaseOrder",
        severity: "error",
      });
      throw error;
    }
  }

  async submitPurchaseOrderForApproval(
    id: number,
    userId: number,
  ): Promise<any> {
    try {
      await db
        .update(purchaseOrders)
        .set({
          status: "pending_approval",
          submittedById: userId,
          submittedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, id));

      return this.getPurchaseOrder(id);
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in submitPurchaseOrderForApproval (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "submitPurchaseOrderForApproval",
        severity: "error",
      });
      throw error;
    }
  }

  async approvePurchaseOrder(id: number, userId: number): Promise<any> {
    try {
      await db
        .update(purchaseOrders)
        .set({
          status: "approved",
          approvedById: userId,
          approvedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, id));

      return this.getPurchaseOrder(id);
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in approvePurchaseOrder (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "approvePurchaseOrder",
        severity: "error",
      });
      throw error;
    }
  }

  async rejectPurchaseOrder(
    id: number,
    userId: number,
    reason?: string,
  ): Promise<any> {
    try {
      await db
        .update(purchaseOrders)
        .set({
          status: "rejected",
          rejectionReason: reason,
        })
        .where(eq(purchaseOrders.id, id));

      return this.getPurchaseOrder(id);
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in rejectPurchaseOrder (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "rejectPurchaseOrder",
        severity: "error",
      });
      throw error;
    }
  }

  async convertPurchaseOrderToInvoice(
    id: number,
    userId: number,
    overrides?: {
      invoiceDate?: string;
      dueDate?: string;
      supplierInvoiceNumber?: string;
      notes?: string;
      paymentTerms?: string;
      currency?: string;
      exchangeRate?: string;
      discountPercentage?: string;
      discountAmount?: string;
      items?: Array<{
        itemType: "product" | "service";
        inventoryItemId?: number | null;
        description?: string;
        quantity: number;
        unitPrice: number;
        taxRate: number;
        taxAmount: number;
        lineTotal: number;
      }>;
      submitForApproval?: boolean;
      files?: any[];
    },
  ): Promise<any> {
    try {
      // Get the purchase order with items
      const po = await this.getPurchaseOrder(id);
      if (!po) {
        throw new Error("Purchase order not found");
      }

      if (po.status !== "approved") {
        throw new Error(
          "Only approved purchase orders can be converted to invoices",
        );
      }

      // Generate invoice number
      const invoiceNumber = await this.generateNextNumber(
        "PI",
        purchaseInvoices,
        purchaseInvoices.invoiceNumber,
      );

      // Use provided items or fall back to PO items for totals
      const itemsToUse =
        overrides?.items && overrides.items.length > 0
          ? overrides.items
          : po.items || [];

      const computedSubtotal = itemsToUse.reduce(
        (sum: number, item: any) =>
          sum + parseFloat(item.quantity) * parseFloat(item.unitPrice),
        0,
      );
      const computedTax = itemsToUse.reduce(
        (sum: number, item: any) => sum + parseFloat(item.taxAmount || "0"),
        0,
      );

      const discountAmount = parseFloat(
        overrides?.discountAmount ?? po.discountAmount ?? "0",
      );
      const computedTotal = computedSubtotal + computedTax - discountAmount;

      // Create the invoice
      const [invoice] = await db
        .insert(purchaseInvoices)
        .values({
          invoiceNumber,
          supplierInvoiceNumber: overrides?.supplierInvoiceNumber ?? null,
          supplierId: po.supplierId,
          poId: id,
          status: "draft",
          invoiceDate: overrides?.invoiceDate
            ? new Date(overrides.invoiceDate)
            : new Date(),
          dueDate: overrides?.dueDate
            ? new Date(overrides.dueDate)
            : po.expectedDeliveryDate
              ? new Date(po.expectedDeliveryDate)
              : null,
          paymentTerms: overrides?.paymentTerms ?? po.paymentTerms ?? null,
          bankAccount: po.bankAccount ?? null,
          notes: overrides?.notes ?? po.notes ?? null,
          subtotal: computedSubtotal.toFixed(2),
          discountPercentage:
            overrides?.discountPercentage ?? po.discountPercentage ?? "0",
          discountAmount: discountAmount.toFixed(2),
          taxAmount: computedTax.toFixed(2),
          totalAmount: computedTotal.toFixed(2),
          paidAmount: "0",
          currency: overrides?.currency ?? po.currency ?? "AED",
          exchangeRate: overrides?.exchangeRate ?? po.exchangeRate ?? "1",
          createdBy: userId,
        })
        .returning();

      // Insert line items (user-edited or copied from PO)
      if (itemsToUse.length > 0) {
        const invoiceItemsToInsert = itemsToUse.map((item: any) => ({
          invoiceId: invoice.id,
          itemType: item.itemType || "product",
          inventoryItemId: item.inventoryItemId || null,
          description: item.description || null,
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.unitPrice).toFixed(2),
          taxRate: parseFloat(item.taxRate || "0").toFixed(2),
          taxAmount: parseFloat(item.taxAmount || "0").toFixed(2),
          lineTotal: (
            parseFloat(item.quantity) * parseFloat(item.unitPrice)
          ).toFixed(2),
        }));

        await db.insert(purchaseInvoiceItems).values(invoiceItemsToInsert);
      }

      // Handle file attachments if provided in overrides
      if (
        overrides?.files &&
        Array.isArray(overrides.files) &&
        overrides.files.length > 0
      ) {
        const filesToInsert = overrides.files.map((file: any) => ({
          invoiceId: invoice.id,
          fileName: file.filename,
          originalName: file.originalname,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype,
        }));

        await db.insert(purchaseInvoiceFiles).values(filesToInsert);
      }

      // Update the PO status to 'converted' and link the invoice
      await db
        .update(purchaseOrders)
        .set({
          status: "converted",
          convertedInvoiceId: invoice.id,
        })
        .where(eq(purchaseOrders.id, id));

      // Submit for approval if requested
      if (overrides?.submitForApproval) {
        await db
          .update(purchaseInvoices)
          .set({
            status: "pending_approval",
            submittedById: userId,
            submittedAt: new Date(),
          })
          .where(eq(purchaseInvoices.id, invoice.id));
      }

      return {
        invoice: await this.getPurchaseInvoice(invoice.id),
        purchaseOrder: await this.getPurchaseOrder(id),
      };
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in convertPurchaseOrderToInvoice (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "convertPurchaseOrderToInvoice",
        severity: "error",
      });
      throw error;
    }
  }

  async getPurchaseInvoicesPaginated(
    page: number,
    limit: number,
    filters?: {
      startDate?: string;
      endDate?: string;
      supplierId?: number;
      status?: string;
      search?: string;
      projectId?: number;
    },
  ): Promise<PaginatedResponse<any>> {
    try {
      const queryConditions = [];

      if (filters?.search && filters.search.trim()) {
        queryConditions.push(
          or(
            ilike(purchaseInvoices.invoiceNumber, `%${filters.search}%`),
            ilike(suppliers.name, `%${filters.search}%`),
          ),
        );
      }

      if (filters?.startDate) {
        queryConditions.push(
          gte(purchaseInvoices.invoiceDate, new Date(filters.startDate)),
        );
      }

      if (filters?.endDate) {
        queryConditions.push(
          lte(purchaseInvoices.invoiceDate, new Date(filters.endDate)),
        );
      }

      if (filters?.supplierId) {
        queryConditions.push(
          eq(purchaseInvoices.supplierId, filters.supplierId),
        );
      }

      if (filters?.status && filters.status !== "all") {
        queryConditions.push(eq(purchaseInvoices.status, filters.status));
      }

      if (filters?.projectId) {
        const subquery = db
          .select({ invoiceId: purchaseInvoiceItems.invoiceId })
          .from(purchaseInvoiceItems)
          .where(eq(purchaseInvoiceItems.projectId, filters.projectId));
        queryConditions.push(inArray(purchaseInvoices.id, subquery));
      }

      const finalConditions =
        queryConditions.length > 0 ? and(...queryConditions) : undefined;

      const dataQueryBuilder = db
        .select({
          id: purchaseInvoices.id,
          invoiceNumber: purchaseInvoices.invoiceNumber,
          supplierInvoiceNumber: purchaseInvoices.supplierInvoiceNumber,
          supplierId: purchaseInvoices.supplierId,
          supplierName: suppliers.name,
          poId: purchaseInvoices.poId,
          status: purchaseInvoices.status,
          paymentStatus: purchaseInvoices.paymentStatus,
          invoiceDate: purchaseInvoices.invoiceDate,
          dueDate: purchaseInvoices.dueDate,
          subtotal: purchaseInvoices.subtotal,
          taxAmount: purchaseInvoices.taxAmount,
          totalAmount: purchaseInvoices.totalAmount,
          paidAmount: purchaseInvoices.paidAmount,
          paymentTerms: purchaseInvoices.paymentTerms,
          bankAccount: purchaseInvoices.bankAccount,
          notes: purchaseInvoices.notes,
          submittedById: purchaseInvoices.submittedById,
          submittedAt: purchaseInvoices.submittedAt,
          approvedById: purchaseInvoices.approvedById,
          approvedAt: purchaseInvoices.approvedAt,
          rejectionReason: purchaseInvoices.rejectionReason,
          createdBy: purchaseInvoices.createdBy,
          createdAt: purchaseInvoices.createdAt,
          supplierCurrency: suppliers.currency,
          supplierVatTreatment: suppliers.vatTreatment,
        })
        .from(purchaseInvoices)
        .leftJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id))
        .where(finalConditions)
        .orderBy(desc(purchaseInvoices.createdAt));

      const countQueryBuilder = db
        .select({ count: sql<number>`count(*)` })
        .from(purchaseInvoices)
        .leftJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id))
        .where(finalConditions);

      const paginatedResult = await this._getPaginatedResults<any>(
        dataQueryBuilder,
        countQueryBuilder,
        page,
        limit,
      );

      // Fetch files for each invoice
      if (paginatedResult.data && paginatedResult.data.length > 0) {
        paginatedResult.data = await Promise.all(
          paginatedResult.data.map(async (invoice: any) => {
            const files = await db
              .select()
              .from(purchaseInvoiceFiles)
              .where(eq(purchaseInvoiceFiles.invoiceId, invoice.id));
            return { ...invoice, files };
          }),
        );
      }

      return paginatedResult;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getPurchaseInvoicesPaginated: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPurchaseInvoicesPaginated",
        severity: "error",
      });
      throw error;
    }
  }

  async getPurchaseStats(): Promise<{
    totalInvoices: number;
    totalAmount: string;
    paidAmount: string;
    pendingAmount: string;
    overdueCount: number;
    overdueAmount: string;
    pendingApprovalCount: number;
  }> {
    try {
      const [invoiceStats] = await db
        .select({
          count: sql<number>`count(*) filter (where status = 'approved')`,
          totalValue: sql<number>`sum(total_amount) filter (where status = 'approved')`,
          totalPaid: sql<number>`sum(paid_amount) filter (where status = 'approved')`,
          pendingApproval: sql<number>`count(*) filter (where status = 'pending_approval')`,
        })
        .from(purchaseInvoices);

      const [overdueStats] = await db
        .select({
          count: sql<number>`count(*)`,
          amount: sql<number>`sum(total_amount - paid_amount)`,
        })
        .from(purchaseInvoices)
        .where(
          and(
            eq(purchaseInvoices.status, "approved"),
            ne(purchaseInvoices.paymentStatus, "paid"),
            lte(purchaseInvoices.dueDate, new Date()),
          ),
        );

      const totalValue = Number(invoiceStats.totalValue || 0);
      const totalPaid = Number(invoiceStats.totalPaid || 0);

      return {
        totalInvoices: Number(invoiceStats.count || 0),
        totalAmount: totalValue.toFixed(2),
        paidAmount: totalPaid.toFixed(2),
        pendingAmount: (totalValue - totalPaid).toFixed(2),
        overdueCount: Number(overdueStats.count || 0),
        overdueAmount: Number(overdueStats.amount || 0).toFixed(2),
        pendingApprovalCount: Number(invoiceStats.pendingApproval || 0),
      };
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getPurchaseStats: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPurchaseStats",
        severity: "error",
      });
      throw error;
    }
  }

  async getPurchaseInvoicesFiltered(filters: {
    startDate?: string;
    endDate?: string;
    supplierId?: number;
    status?: string;
  }): Promise<any[]> {
    try {
      let query = db
        .select({
          id: purchaseInvoices.id,
          invoiceNumber: purchaseInvoices.invoiceNumber,
          supplierInvoiceNumber: purchaseInvoices.supplierInvoiceNumber,
          supplierId: purchaseInvoices.supplierId,
          supplierName: suppliers.name,
          poId: purchaseInvoices.poId,
          // projectId: purchaseInvoices.projectId,
          // assetInventoryInstanceId: purchaseInvoices.assetInventoryInstanceId,
          status: purchaseInvoices.status,
          paymentStatus: purchaseInvoices.paymentStatus,
          invoiceDate: purchaseInvoices.invoiceDate,
          dueDate: purchaseInvoices.dueDate,
          subtotal: purchaseInvoices.subtotal,
          taxAmount: purchaseInvoices.taxAmount,
          totalAmount: purchaseInvoices.totalAmount,
          paidAmount: purchaseInvoices.paidAmount,
          paymentTerms: purchaseInvoices.paymentTerms,
          bankAccount: purchaseInvoices.bankAccount,
          notes: purchaseInvoices.notes,
          submittedById: purchaseInvoices.submittedById,
          submittedAt: purchaseInvoices.submittedAt,
          approvedById: purchaseInvoices.approvedById,
          approvedAt: purchaseInvoices.approvedAt,
          rejectionReason: purchaseInvoices.rejectionReason,
          createdBy: purchaseInvoices.createdBy,
          createdAt: purchaseInvoices.createdAt,
          supplierCurrency: suppliers.currency,
          supplierVatTreatment: suppliers.vatTreatment,
        })
        .from(purchaseInvoices)
        .leftJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id));

      const conditions = [];

      if (filters.startDate) {
        conditions.push(
          gte(purchaseInvoices.invoiceDate, new Date(filters.startDate)),
        );
      }

      if (filters.endDate) {
        conditions.push(
          lte(purchaseInvoices.invoiceDate, new Date(filters.endDate)),
        );
      }

      if (filters.supplierId) {
        conditions.push(eq(purchaseInvoices.supplierId, filters.supplierId));
      }

      if (filters.status && filters.status !== "all") {
        conditions.push(eq(purchaseInvoices.status, filters.status));
      }

      if (conditions.length) {
        query = query.where(and(...conditions));
      }

      return await query.orderBy(desc(purchaseInvoices.createdAt));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getPurchaseInvoicesFiltered: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPurchaseInvoicesFiltered",
        severity: "error",
      });
      throw error;
    }
  }

  async getPurchaseInvoices(): Promise<any[]> {
    try {
      return await db
        .select({
          id: purchaseInvoices.id,
          invoiceNumber: purchaseInvoices.invoiceNumber,
          supplierInvoiceNumber: purchaseInvoices.supplierInvoiceNumber,
          supplierId: purchaseInvoices.supplierId,
          supplierName: suppliers.name,
          poId: purchaseInvoices.poId,
          // projectId: purchaseInvoices.projectId,
          // assetInventoryInstanceId: purchaseInvoices.assetInventoryInstanceId,
          status: purchaseInvoices.status,
          paymentStatus: purchaseInvoices.paymentStatus,
          invoiceDate: purchaseInvoices.invoiceDate,
          dueDate: purchaseInvoices.dueDate,
          paymentTerms: purchaseInvoices.paymentTerms,
          bankAccount: purchaseInvoices.bankAccount,
          subtotal: purchaseInvoices.subtotal,
          taxAmount: purchaseInvoices.taxAmount,
          totalAmount: purchaseInvoices.totalAmount,
          paidAmount: purchaseInvoices.paidAmount,
          notes: purchaseInvoices.notes,
          submittedById: purchaseInvoices.submittedById,
          submittedAt: purchaseInvoices.submittedAt,
          approvedById: purchaseInvoices.approvedById,
          approvedAt: purchaseInvoices.approvedAt,
          rejectionReason: purchaseInvoices.rejectionReason,
          createdBy: purchaseInvoices.createdBy,
          createdAt: purchaseInvoices.createdAt,
          supplierCurrency: suppliers.currency,
          supplierVatTreatment: suppliers.vatTreatment,
        })
        .from(purchaseInvoices)
        .leftJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id))
        .orderBy(desc(purchaseInvoices.createdAt));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getPurchaseInvoices: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPurchaseInvoices",
        severity: "error",
      });
      throw error;
    }
  }

  async getPurchaseInvoice(id: number): Promise<any> {
    try {
      const [invoice] = await db
        .select({
          id: purchaseInvoices.id,
          invoiceNumber: purchaseInvoices.invoiceNumber,
          supplierInvoiceNumber: purchaseInvoices.supplierInvoiceNumber,
          supplierId: purchaseInvoices.supplierId,
          supplierName: suppliers.name,
          poId: purchaseInvoices.poId,
          status: purchaseInvoices.status,
          paymentStatus: purchaseInvoices.paymentStatus,
          invoiceDate: purchaseInvoices.invoiceDate,
          dueDate: purchaseInvoices.dueDate,
          paymentTerms: purchaseInvoices.paymentTerms,
          bankAccount: purchaseInvoices.bankAccount,
          subtotal: purchaseInvoices.subtotal,
          discountPercentage: purchaseInvoices.discountPercentage,
          discountAmount: purchaseInvoices.discountAmount,
          taxAmount: purchaseInvoices.taxAmount,
          totalAmount: purchaseInvoices.totalAmount,
          paidAmount: purchaseInvoices.paidAmount,
          notes: purchaseInvoices.notes,
          createdBy: purchaseInvoices.createdBy,
          createdAt: purchaseInvoices.createdAt,
          submittedById: purchaseInvoices.submittedById,
          submittedAt: purchaseInvoices.submittedAt,
          approvedById: purchaseInvoices.approvedById,
          approvedAt: purchaseInvoices.approvedAt,
          rejectionReason: purchaseInvoices.rejectionReason,
          currency: purchaseInvoices.currency,
          exchangeRate: purchaseInvoices.exchangeRate,
          supplierCurrency: suppliers.currency,
          supplierVatTreatment: suppliers.vatTreatment,
        })
        .from(purchaseInvoices)
        .leftJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id))
        .where(eq(purchaseInvoices.id, id));

      if (!invoice) return null;

      // Fetch invoice items with all fields
      const items = await db
        .select({
          id: purchaseInvoiceItems.id,
          itemType: purchaseInvoiceItems.itemType,
          inventoryItemId: purchaseInvoiceItems.inventoryItemId,
          inventoryItemName: inventoryItems.name,
          inventoryItemUnit: inventoryItems.unit,
          inventoryItemDescription: inventoryItems.description,
          description: purchaseInvoiceItems.description,
          quantity: purchaseInvoiceItems.quantity,
          unitPrice: purchaseInvoiceItems.unitPrice,
          taxRate: purchaseInvoiceItems.taxRate,
          taxAmount: purchaseInvoiceItems.taxAmount,
          lineTotal: purchaseInvoiceItems.lineTotal,
          projectId: purchaseInvoiceItems.projectId,
          assetInstanceId: purchaseInvoiceItems.assetInstanceId,
        })
        .from(purchaseInvoiceItems)
        .leftJoin(
          inventoryItems,
          eq(purchaseInvoiceItems.inventoryItemId, inventoryItems.id),
        )
        .where(eq(purchaseInvoiceItems.invoiceId, id));

      const files = await db
        .select()
        .from(purchaseInvoiceFiles)
        .where(eq(purchaseInvoiceFiles.invoiceId, id));

      return { ...invoice, items, files };
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getPurchaseInvoice (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPurchaseInvoice",
        severity: "error",
      });
      throw error;
    }
  }

  async createPurchaseInvoiceStandalone(invoiceData: any): Promise<any> {
    try {
      const invoiceNumber = await this.generateNextNumber(
        "PI",
        purchaseInvoices,
        purchaseInvoices.invoiceNumber,
      );

      const [invoice] = await db
        .insert(purchaseInvoices)
        .values({
          invoiceNumber,
          supplierInvoiceNumber: invoiceData.supplierInvoiceNumber || null,
          supplierId: invoiceData.supplierId,
          poId: invoiceData.poId || null,
          projectId: invoiceData.projectId || null,
          assetInventoryInstanceId:
            invoiceData.assetInventoryInstanceId || null,
          status: invoiceData.status || "draft",
          invoiceDate: new Date(invoiceData.invoiceDate),
          dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : null,
          paymentTerms: invoiceData.paymentTerms || null,
          bankAccount: invoiceData.bankAccount || null,
          subtotal: invoiceData.subtotal,
          discountPercentage: invoiceData.discountPercentage || "0",
          discountAmount: invoiceData.discountAmount || "0",
          taxAmount: invoiceData.taxAmount || "0",
          totalAmount: invoiceData.totalAmount,
          paidAmount: "0",
          currency: invoiceData.currency || "AED",
          exchangeRate: invoiceData.exchangeRate || "1",
          notes: invoiceData.notes || null,
          createdBy: invoiceData.createdBy,
        })
        .returning();

      // Insert invoice items if provided
      if (invoiceData.items && invoiceData.items.length > 0) {
        const invoiceItemsToInsert = invoiceData.items.map((item: any) => ({
          invoiceId: invoice.id,
          itemType: item.itemType || "product",
          inventoryItemId: item.inventoryItemId || null,
          description: item.description || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toString(),
          taxRate: item.taxRate?.toString() || "0",
          taxAmount: item.taxAmount?.toString() || "0",
          lineTotal: item.lineTotal.toString(),
        }));

        await db.insert(purchaseInvoiceItems).values(invoiceItemsToInsert);
      }

      // Handle file uploads if any
      if (
        invoiceData.files &&
        Array.isArray(invoiceData.files) &&
        invoiceData.files.length > 0
      ) {
        const filesToInsert = invoiceData.files.map((file: any) => ({
          invoiceId: invoice.id,
          fileName: file.filename,
          originalName: file.originalname,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype,
        }));

        await db.insert(purchaseInvoiceFiles).values(filesToInsert);
      }

      return this.getPurchaseInvoice(invoice.id);
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createPurchaseInvoiceStandalone: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createPurchaseInvoiceStandalone",
        severity: "error",
      });
      throw error;
    }
  }

  async updatePurchaseInvoice(
    id: number,
    invoiceData: any,
    isApprovedEdit: boolean = false,
  ): Promise<any> {
    try {
      const existing = await this.getPurchaseInvoice(id);
      if (!existing) throw new Error("Purchase invoice not found");
      if (!isApprovedEdit && existing.status !== "draft") {
        throw new Error("Only draft invoices can be edited");
      }

      const subtotal = parseFloat(invoiceData.subtotal || "0");
      const taxAmount = parseFloat(invoiceData.taxAmount || "0");
      const discountAmt = parseFloat(invoiceData.discountAmount || "0");
      const totalAmount = subtotal + taxAmount - discountAmt;

      await db
        .update(purchaseInvoices)
        .set({
          supplierId: invoiceData.supplierId,
          supplierInvoiceNumber: invoiceData.supplierInvoiceNumber || null,
          invoiceDate: new Date(invoiceData.invoiceDate),
          dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : null,
          paymentTerms: invoiceData.paymentTerms || null,
          bankAccount: invoiceData.bankAccount || null,
          notes: invoiceData.notes || null,
          currency: invoiceData.currency || "AED",
          exchangeRate: invoiceData.exchangeRate || "1",
          subtotal: subtotal.toFixed(2),
          discountPercentage: invoiceData.discountPercentage || "0",
          discountAmount: invoiceData.discountAmount || "0",
          taxAmount: taxAmount.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
        })
        .where(eq(purchaseInvoices.id, id));

      // Replace all items
      await db
        .delete(purchaseInvoiceItems)
        .where(eq(purchaseInvoiceItems.invoiceId, id));

      if (invoiceData.items && invoiceData.items.length > 0) {
        const itemsToInsert = invoiceData.items.map((item: any) => ({
          invoiceId: id,
          itemType: item.itemType || "product",
          inventoryItemId: item.inventoryItemId || null,
          description: item.description || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toString(),
          taxRate: item.taxRate?.toString() || "0",
          taxAmount: item.taxAmount?.toString() || "0",
          lineTotal: item.lineTotal.toString(),
          projectId: item.projectId || null,
          assetInstanceId: item.assetInstanceId || null,
        }));
        await db.insert(purchaseInvoiceItems).values(itemsToInsert);
      }

      // Handle file updates
      if (invoiceData.existingFiles) {
        const keptFileIds = Array.isArray(invoiceData.existingFiles)
          ? invoiceData.existingFiles.map((fid: any) => parseInt(fid))
          : [parseInt(invoiceData.existingFiles)];

        // Delete files that are no longer kept
        await db
          .delete(purchaseInvoiceFiles)
          .where(
            and(
              eq(purchaseInvoiceFiles.invoiceId, id),
              keptFileIds.length > 0
                ? notInArray(purchaseInvoiceFiles.id, keptFileIds)
                : undefined,
            ),
          );
      } else if (invoiceData.files) {
        // If files are provided but no existingFiles, we assume replacing or it's a new upload situation
        // But usually we handle it via existingFiles from frontend.
      }

      // Handle new file uploads
      if (
        invoiceData.files &&
        Array.isArray(invoiceData.files) &&
        invoiceData.files.length > 0
      ) {
        const filesToInsert = invoiceData.files.map((file: any) => ({
          invoiceId: id,
          fileName: file.filename,
          originalName: file.originalname,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype,
        }));

        await db.insert(purchaseInvoiceFiles).values(filesToInsert);
      }

      return this.getPurchaseInvoice(id);
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updatePurchaseInvoice (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updatePurchaseInvoice",
        severity: "error",
      });
      throw error;
    }
  }

  async createPurchaseInvoiceFromPO(
    poId: number,
    invoiceData: any,
  ): Promise<any> {
    try {
      // Get the purchase order
      const po = await this.getPurchaseOrder(poId);
      if (!po) {
        throw new Error("Purchase order not found");
      }

      const invoiceNumber = await this.generateNextNumber(
        "PI",
        purchaseInvoices,
        purchaseInvoices.invoiceNumber,
      );

      // Create the invoice
      const [invoice] = await db
        .insert(purchaseInvoices)
        .values({
          invoiceNumber,
          supplierInvoiceNumber: invoiceData.supplierInvoiceNumber || null,
          supplierId: po.supplierId,
          poId: poId,
          status: "draft",
          invoiceDate: new Date(invoiceData.invoiceDate),
          dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : null,
          paymentTerms: po.paymentTerms || null,
          bankAccount: po.bankAccount || null,
          subtotal: po.subtotal,
          taxAmount: po.taxAmount,
          totalAmount: po.totalAmount,
          paidAmount: "0",
          currency: invoiceData.currency || po.currency || "AED",
          exchangeRate: invoiceData.exchangeRate || po.exchangeRate || "1",
          notes: invoiceData.notes || null,
          createdBy: invoiceData.createdBy,
        })
        .returning();

      // Create purchase invoice items from PO items
      if (po.items && po.items.length > 0) {
        const invoiceItemsToInsert = po.items.map((item: any) => ({
          invoiceId: invoice.id,
          itemType: item.itemType || "product",
          inventoryItemId: item.inventoryItemId || null,
          description: item.description || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate || "0",
          taxAmount: item.taxAmount || "0",
          lineTotal: item.lineTotal,
        }));

        await db.insert(purchaseInvoiceItems).values(invoiceItemsToInsert);

        // Update inventory for received items (only for products)
        for (const item of po.items) {
          if (
            item.inventoryItemId &&
            (item.itemType === "product" || !item.itemType)
          ) {
            // Update inventory stock
            const currentItem = await db
              .select()
              .from(inventoryItems)
              .where(eq(inventoryItems.id, item.inventoryItemId))
              .limit(1);

            if (currentItem.length > 0) {
              const newStock = currentItem[0].currentStock + item.quantity;
              await db
                .update(inventoryItems)
                .set({ currentStock: newStock })
                .where(eq(inventoryItems.id, item.inventoryItemId));

              // Create inventory transaction
              await db.insert(inventoryTransactions).values({
                inventoryItemId: item.inventoryItemId,
                transactionType: "in",
                quantity: item.quantity,
                unitCost: item.unitPrice,
                totalCost: parseFloat(item.lineTotal),
                reference: `Purchase Invoice: ${invoice.invoiceNumber}`,
                createdBy: invoiceData.createdBy,
              });
            }
          }
        }
      }

      // Update purchase order status
      await this.updatePurchaseOrder(poId, { status: "completed" });

      return this.getPurchaseInvoice(invoice.id);
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in createPurchaseInvoiceFromPO (poId: ${poId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createPurchaseInvoiceFromPO",
        severity: "error",
      });
      throw error;
    }
  }

  async submitPurchaseInvoiceForApproval(
    id: number,
    userId: number,
  ): Promise<any> {
    try {
      await db
        .update(purchaseInvoices)
        .set({
          status: "pending_approval",
          submittedById: userId,
          submittedAt: new Date(),
        })
        .where(eq(purchaseInvoices.id, id));

      return this.getPurchaseInvoice(id);
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in submitPurchaseInvoiceForApproval (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "submitPurchaseInvoiceForApproval",
        severity: "error",
      });
      throw error;
    }
  }

  async approvePurchaseInvoice(id: number, userId: number): Promise<void> {
    try {
      // Get the invoice details first
      const invoice = await this.getPurchaseInvoice(id);
      console.log("invoiceinvoice", invoice);
      if (!invoice) {
        throw new Error("Purchase invoice not found");
      }

      // Update invoice approval status
      await db
        .update(purchaseInvoices)
        .set({
          status: "approved",
          approvedById: userId,
          approvedAt: new Date(),
        })
        .where(eq(purchaseInvoices.id, id));

      // Get invoice line items
      const items = await db
        .select()
        .from(purchaseInvoiceItems)
        .where(eq(purchaseInvoiceItems.invoiceId, id));

      // Process each line item for project/asset allocations
      const exchangeRateForAllocations = parseFloat(
        invoice.exchangeRate || "1",
      );
      for (const item of items) {
        const lineAmountInCurrency = parseFloat(item.lineTotal);
        const lineAmountAED = lineAmountInCurrency * exchangeRateForAllocations;

        // If line item is linked to an asset instance, create a maintenance record (in AED)
        if (item.assetInstanceId) {
          await db.insert(assetInventoryMaintenanceRecords).values({
            instanceId: item.assetInstanceId,
            maintenanceCost: lineAmountAED.toFixed(2),
            maintenanceDate: new Date().toISOString(),
            description: `Purchase Invoice: ${invoice.invoiceNumber} - ${
              item.description || "Maintenance cost"
            }`,
            performedBy: userId,
          });
        }
      }

      // Trigger full cost recalculation for all projects affected by this invoice's line items
      const affectedProjectIds = [
        ...new Set(
          items.filter((i) => i.projectId).map((i) => i.projectId as number),
        ),
      ];
      for (const pid of affectedProjectIds) {
        await this.recalculateProjectCost(pid);
      }

      // Create Goods Receipt for inventory items in the purchase invoice
      const inventoryItems_forGR = items.filter(
        (item) => item.itemType === "product" && item.inventoryItemId,
      );

      if (inventoryItems_forGR.length > 0) {
        const grReference = `PI-${invoice.invoiceNumber}`;
        const exchangeRate = parseFloat(invoice.exchangeRate || "1");
        const grItems = inventoryItems_forGR.map((item) => ({
          inventoryItemId: item.inventoryItemId!,
          quantity: item.quantity,
          unitCost: parseFloat(item.unitPrice) * exchangeRate,
        }));

        await this.createGoodsReceipt(grReference, grItems, userId);
        console.log(
          `Goods receipt ${grReference} created for purchase invoice ${invoice.invoiceNumber} with ${grItems.length} item(s)`,
        );
      }

      // Create General Ledger entries for the approved purchase invoice
      // Get supplier name
      let supplierName = "Unknown Supplier";
      if (invoice.supplierId) {
        const [supplier] = await db
          .select()
          .from(suppliers)
          .where(eq(suppliers.id, invoice.supplierId));
        if (supplier) {
          supplierName = supplier.name;
        }
      }

      const invoiceCurrency = invoice.currency || "AED";
      const invoiceExchangeRate = parseFloat(invoice.exchangeRate || "1");
      const originalAmount = parseFloat(invoice.totalAmount || "0");
      const aedAmount = (originalAmount * invoiceExchangeRate).toFixed(2);
      const currencyNote =
        invoiceCurrency !== "AED"
          ? ` (${invoiceCurrency} ${originalAmount.toFixed(2)} @ ${invoiceExchangeRate})`
          : "";
      console.log("invoiceExchangeRate111", invoiceExchangeRate);
      // Create payable entry (Credit Accounts Payable) in AED
      await db.insert(generalLedgerEntries).values({
        entryType: "payable",
        referenceType: "purchase_invoice",
        referenceId: id,
        accountName: "Accounts Payable",
        description: `Purchase Invoice ${invoice.invoiceNumber} - ${supplierName}${currencyNote}`,
        debitAmount: "0",
        creditAmount: aedAmount,
        entityId: invoice.supplierId,
        entityName: supplierName,
        projectId: invoice.projectId || null,
        invoiceNumber: invoice.invoiceNumber,
        transactionDate: invoice.invoiceDate
          ? new Date(invoice.invoiceDate).toISOString()
          : new Date().toISOString(),
        dueDate: invoice.dueDate
          ? new Date(invoice.dueDate).toISOString()
          : null,
        status: "pending",
      });
      console.log("invoiceExchangeRate", invoiceExchangeRate);
      // Create expense entry (Debit Purchase Expense) in AED
      await db.insert(generalLedgerEntries).values({
        entryType: "payable",
        referenceType: "purchase_invoice",
        referenceId: id,
        accountName: "Purchase Expense",
        description: `Purchase Invoice ${invoice.invoiceNumber} - ${supplierName}${currencyNote}`,
        debitAmount: aedAmount,
        creditAmount: "0",
        entityId: invoice.supplierId,
        entityName: supplierName,
        projectId: invoice.projectId || null,
        invoiceNumber: invoice.invoiceNumber,
        transactionDate: invoice.invoiceDate
          ? new Date(invoice.invoiceDate).toISOString()
          : new Date().toISOString(),
        dueDate: invoice.dueDate
          ? new Date(invoice.dueDate).toISOString()
          : null,
        status: "pending",
      });

      console.log(
        `GL entries created for purchase invoice ${invoice.invoiceNumber}`,
      );
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in approvePurchaseInvoice (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "approvePurchaseInvoice",
        severity: "error",
      });
      throw error;
    }
  }

  async cancelPurchaseInvoice(id: number, userId: number): Promise<any> {
    try {
      const invoice = await this.getPurchaseInvoice(id);
      if (!invoice) throw new Error("Purchase invoice not found");
      if (invoice.status !== "approved") {
        throw new Error("Only approved purchase invoices can be cancelled");
      }

      if (parseFloat(invoice.paidAmount || "0") > 0) {
        throw new Error(
          "Cannot cancel an invoice that has recorded payments. Please reverse the payments first.",
        );
      }

      await db
        .update(purchaseInvoices)
        .set({ status: "cancelled" })
        .where(eq(purchaseInvoices.id, id));

      // Reverse project cost allocations
      const items = await db
        .select()
        .from(purchaseInvoiceItems)
        .where(eq(purchaseInvoiceItems.invoiceId, id));

      const cancelExchangeRate = parseFloat(invoice.exchangeRate || "1");
      for (const item of items) {
        const lineAmountAED = parseFloat(item.lineTotal) * cancelExchangeRate;

        // Reverse asset maintenance records created during approval
        if (item.assetInstanceId) {
          const matchDesc = `Purchase Invoice: ${invoice.invoiceNumber}`;
          const maintenanceRecords = await db
            .select()
            .from(assetInventoryMaintenanceRecords)
            .where(
              and(
                eq(
                  assetInventoryMaintenanceRecords.instanceId,
                  item.assetInstanceId,
                ),
                sql`${assetInventoryMaintenanceRecords.description} LIKE ${matchDesc + "%"}`,
              ),
            );
          for (const record of maintenanceRecords) {
            await db
              .delete(assetInventoryMaintenanceRecords)
              .where(eq(assetInventoryMaintenanceRecords.id, record.id));
          }
        }
      }

      // Trigger full cost recalculation for all projects affected by this invoice's line items
      const cancelAffectedProjectIds = [
        ...new Set(
          items.filter((i) => i.projectId).map((i) => i.projectId as number),
        ),
      ];
      for (const pid of cancelAffectedProjectIds) {
        await this.recalculateProjectCost(pid);
      }

      // Reverse inventory stock for product items (goods issue)
      const inventoryItems_toReverse = items.filter(
        (item) => item.itemType === "product" && item.inventoryItemId,
      );
      if (inventoryItems_toReverse.length > 0) {
        const cancelRef = `CANCEL-PI-${invoice.invoiceNumber}`;
        const exchangeRate = parseFloat(invoice.exchangeRate || "1");
        for (const item of inventoryItems_toReverse) {
          const inventoryItem = await this.getInventoryItem(
            item.inventoryItemId!,
          );
          if (inventoryItem) {
            const unitCostAED = (
              parseFloat(item.unitPrice) * exchangeRate
            ).toFixed(4);
            await db.insert(inventoryTransactions).values({
              itemId: item.inventoryItemId!,
              type: "outflow",
              quantity: item.quantity,
              unitCost: unitCostAED,
              remainingQuantity: 0,
              reference: cancelRef,
              createdBy: userId,
            });

            const newStock = Math.max(
              0,
              inventoryItem.currentStock - item.quantity,
            );
            await this.updateInventoryItem(item.inventoryItemId!, {
              currentStock: newStock,
            });
          }
        }
      }

      // Create reverse GL entries
      let supplierName = "Unknown Supplier";
      if (invoice.supplierId) {
        const [supplier] = await db
          .select()
          .from(suppliers)
          .where(eq(suppliers.id, invoice.supplierId));
        if (supplier) supplierName = supplier.name;
      }

      const invoiceCurrency = invoice.currency || "AED";
      const invoiceExchangeRate = parseFloat(invoice.exchangeRate || "1");
      const originalAmount = parseFloat(invoice.totalAmount || "0");
      const aedAmount = (originalAmount * invoiceExchangeRate).toFixed(2);
      const currencyNote =
        invoiceCurrency !== "AED"
          ? ` (${invoiceCurrency} ${originalAmount.toFixed(2)} @ ${invoiceExchangeRate})`
          : "";

      // Reverse: Debit Accounts Payable
      await db.insert(generalLedgerEntries).values({
        entryType: "payable",
        referenceType: "purchase_invoice",
        referenceId: id,
        accountName: "Accounts Payable",
        description: `CANCELLED - Purchase Invoice ${invoice.invoiceNumber} - ${supplierName}${currencyNote}`,
        debitAmount: aedAmount,
        creditAmount: "0",
        entityId: invoice.supplierId,
        entityName: supplierName,
        invoiceNumber: invoice.invoiceNumber,
        transactionDate: new Date().toISOString(),
        status: "cancelled",
      });

      // Reverse: Credit Purchase Expense
      await db.insert(generalLedgerEntries).values({
        entryType: "payable",
        referenceType: "purchase_invoice",
        referenceId: id,
        accountName: "Purchase Expense",
        description: `CANCELLED - Purchase Invoice ${invoice.invoiceNumber} - ${supplierName}${currencyNote}`,
        debitAmount: "0",
        creditAmount: aedAmount,
        entityId: invoice.supplierId,
        entityName: supplierName,
        invoiceNumber: invoice.invoiceNumber,
        transactionDate: new Date().toISOString(),
        status: "cancelled",
      });

      return this.getPurchaseInvoice(id);
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in cancelPurchaseInvoice (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "cancelPurchaseInvoice",
        severity: "error",
      });
      throw error;
    }
  }

  async rejectPurchaseInvoice(
    id: number,
    userId: number,
    reason?: string,
  ): Promise<any> {
    try {
      await db
        .update(purchaseInvoices)
        .set({
          status: "rejected",
          rejectionReason: reason || null,
          approvedById: userId,
          approvedAt: new Date(),
        })
        .where(eq(purchaseInvoices.id, id));

      return this.getPurchaseInvoice(id);
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in rejectPurchaseInvoice (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "rejectPurchaseInvoice",
        severity: "error",
      });
      throw error;
    }
  }

  async createPurchaseInvoicePayment(paymentData: any): Promise<any> {
    try {
      // Insert the payment record
      const [payment] = await db
        .insert(purchaseInvoicePayments)
        .values({
          invoiceId: paymentData.invoiceId,
          amount: paymentData.amount,
          paymentDate: new Date(paymentData.paymentDate),
          paymentMethod: paymentData.paymentMethod,
          referenceNumber: paymentData.referenceNumber || null,
          notes: paymentData.notes || null,
          recordedBy: paymentData.recordedBy,
        })
        .returning();

      // Get the invoice to calculate new paid amount
      const invoice = await this.getPurchaseInvoice(paymentData.invoiceId);
      if (!invoice) {
        throw new Error("Invoice not found");
      }

      const newPaidAmount =
        parseFloat(invoice.paidAmount || "0") + parseFloat(paymentData.amount);
      const totalAmount = parseFloat(invoice.totalAmount);

      // Determine new status
      let newStatus = "pending";
      if (newPaidAmount >= totalAmount) {
        newStatus = "paid";
      } else if (newPaidAmount > 0) {
        newStatus = "partial";
      }

      // Update invoice paid amount and status
      await db
        .update(purchaseInvoices)
        .set({
          paidAmount: newPaidAmount.toFixed(2),
          paymentStatus: newStatus,
        })
        .where(eq(purchaseInvoices.id, paymentData.invoiceId));

      // Create General Ledger entries for the payment
      // Get supplier name
      let supplierName = "Unknown Supplier";
      if (invoice.supplierId) {
        const [supplier] = await db
          .select()
          .from(suppliers)
          .where(eq(suppliers.id, invoice.supplierId));
        if (supplier) {
          supplierName = supplier.name;
        }
      }

      const invoiceCurrency = invoice.currency || "AED";
      const invoiceExchangeRate = parseFloat(invoice.exchangeRate || "1");
      const originalAmount = parseFloat(paymentData.amount || "0");
      const aedAmount = (originalAmount * invoiceExchangeRate).toFixed(2);
      const currencyNote =
        invoiceCurrency !== "AED"
          ? ` (${invoiceCurrency} ${originalAmount.toFixed(2)} @ ${invoiceExchangeRate})`
          : "";

      // 1. Debit: Accounts Payable (reduce liability - we owe less) in AED
      await db.insert(generalLedgerEntries).values({
        entryType: "payable",
        referenceType: "payment",
        referenceId: payment.id,
        accountName: "Accounts Payable",
        description: `Payment for Purchase Invoice ${invoice.invoiceNumber} - ${supplierName}${currencyNote}`,
        debitAmount: aedAmount,
        creditAmount: "0",
        entityId: invoice.supplierId,
        entityName: supplierName,
        invoiceNumber: invoice.invoiceNumber,
        transactionDate: paymentData.paymentDate,
        status: "paid",
      });

      // 2. Credit: Cash/Bank (reduce asset - cash outflow) in AED
      await db.insert(generalLedgerEntries).values({
        entryType: "payable",
        referenceType: "payment",
        referenceId: payment.id,
        accountName: "Cash/Bank",
        description: `Payment for Purchase Invoice ${invoice.invoiceNumber} - ${supplierName}${currencyNote}`,
        debitAmount: "0",
        creditAmount: aedAmount,
        entityId: invoice.supplierId,
        entityName: supplierName,
        invoiceNumber: invoice.invoiceNumber,
        transactionDate: paymentData.paymentDate,
        status: "paid",
      });

      console.log(
        `GL entries created for purchase invoice payment ${payment.id}`,
      );

      return payment;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createPurchaseInvoicePayment: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createPurchaseInvoicePayment",
        severity: "error",
      });
      throw error;
    }
  }

  async getPurchaseInvoicePayments(invoiceId: number): Promise<any[]> {
    try {
      if (!invoiceId || isNaN(invoiceId)) {
        console.error(
          `Invalid invoiceId provided to getPurchaseInvoicePayments: ${invoiceId}`,
        );
        return [];
      }

      const payments = await db
        .select({
          id: purchaseInvoicePayments.id,
          invoiceId: purchaseInvoicePayments.invoiceId,
          amount: purchaseInvoicePayments.amount,
          paymentDate: purchaseInvoicePayments.paymentDate,
          paymentMethod: purchaseInvoicePayments.paymentMethod,
          referenceNumber: purchaseInvoicePayments.referenceNumber,
          notes: purchaseInvoicePayments.notes,
          recordedBy: purchaseInvoicePayments.recordedBy,
          recordedAt: purchaseInvoicePayments.recordedAt,
        })
        .from(purchaseInvoicePayments)
        .where(eq(purchaseInvoicePayments.invoiceId, invoiceId))
        .orderBy(desc(purchaseInvoicePayments.paymentDate));

      // Fetch files for each payment
      const enrichedPayments = await Promise.all(
        payments.map(async (payment) => {
          try {
            const files = await db
              .select({
                id: purchasePaymentFiles.id,
                paymentId: purchasePaymentFiles.paymentId,
                fileName: purchasePaymentFiles.fileName,
                originalName: purchasePaymentFiles.originalName,
                filePath: purchasePaymentFiles.filePath,
                fileSize: purchasePaymentFiles.fileSize,
                mimeType: purchasePaymentFiles.mimeType,
                uploadedAt: purchasePaymentFiles.uploadedAt,
              })
              .from(purchasePaymentFiles)
              .where(eq(purchasePaymentFiles.paymentId, payment.id));
            return { ...payment, files };
          } catch (fileError) {
            console.error(
              `Error fetching files for payment ${payment.id}:`,
              fileError,
            );
            return { ...payment, files: [] };
          }
        }),
      );

      return enrichedPayments;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getPurchaseInvoicePayments (invoiceId: ${invoiceId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPurchaseInvoicePayments",
        severity: "error",
      });
      throw error;
    }
  }

  async createPurchasePaymentFile(fileData: any): Promise<any> {
    try {
      const result = await db
        .insert(purchasePaymentFiles)
        .values({
          paymentId: fileData.paymentId,
          fileName: fileData.fileName,
          originalName: fileData.originalName,
          filePath: fileData.filePath,
          fileSize: fileData.fileSize || null,
          mimeType: fileData.mimeType || null,
        })
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createPurchasePaymentFile: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createPurchasePaymentFile",
        severity: "error",
      });
      throw error;
    }
  }

  async getPurchasePaymentFile(id: number): Promise<any | undefined> {
    try {
      const result = await db
        .select({
          id: purchasePaymentFiles.id,
          paymentId: purchasePaymentFiles.paymentId,
          fileName: purchasePaymentFiles.fileName,
          originalName: purchasePaymentFiles.originalName,
          filePath: purchasePaymentFiles.filePath,
          fileSize: purchasePaymentFiles.fileSize,
          mimeType: purchasePaymentFiles.mimeType,
          uploadedAt: purchasePaymentFiles.uploadedAt,
        })
        .from(purchasePaymentFiles)
        .where(eq(purchasePaymentFiles.id, id))
        .limit(1);
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getPurchasePaymentFile (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPurchasePaymentFile",
        severity: "error",
      });
      throw error;
    }
  }

  // Purchase Credit Notes methods
  async getPurchaseCreditNotes(): Promise<any[]> {
    try {
      const result = await db
        .select({
          id: purchaseCreditNotes.id,
          creditNoteNumber: purchaseCreditNotes.creditNoteNumber,
          purchaseInvoiceId: purchaseCreditNotes.purchaseInvoiceId,
          supplierId: purchaseCreditNotes.supplierId,
          supplierName: suppliers.name,
          invoiceNumber: purchaseInvoices.invoiceNumber,
          status: purchaseCreditNotes.status,
          creditNoteDate: purchaseCreditNotes.creditNoteDate,
          reason: purchaseCreditNotes.reason,
          items: purchaseCreditNotes.items,
          subtotal: purchaseCreditNotes.subtotal,
          taxAmount: purchaseCreditNotes.taxAmount,
          discount: purchaseCreditNotes.discount,
          totalAmount: purchaseCreditNotes.totalAmount,
          currency: creditNotes.currency,
          exchangeRate: creditNotes.exchangeRate,
          createdAt: purchaseCreditNotes.createdAt,
        })
        .from(purchaseCreditNotes)
        .leftJoin(suppliers, eq(purchaseCreditNotes.supplierId, suppliers.id))
        .leftJoin(
          purchaseInvoices,
          eq(purchaseCreditNotes.purchaseInvoiceId, purchaseInvoices.id),
        )
        .orderBy(desc(purchaseCreditNotes.createdAt));

      return result;
    } catch (error: any) {
      // console.error("Error getting purchase credit notes:", error); // Original console.error commented out
      await this.createErrorLog({
        message:
          "Error in getPurchaseCreditNotes: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPurchaseCreditNotes",
        severity: "error",
      });
      throw error;
    }
  }

  async getPurchaseCreditNote(id: number): Promise<any | undefined> {
    try {
      const result = await db
        .select()
        .from(purchaseCreditNotes)
        .where(eq(purchaseCreditNotes.id, id))
        .limit(1);
      return result[0];
    } catch (error: any) {
      // console.error("Error getting purchase credit note:", error); // Original console.error commented out
      await this.createErrorLog({
        message:
          `Error in getPurchaseCreditNote (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPurchaseCreditNote",
        severity: "error",
      });
      throw error;
    }
  }

  async createPurchaseCreditNote(creditNoteData: any): Promise<any> {
    try {
      console.log("Creating purchase credit note with data:", creditNoteData);

      const creditNoteNumber = await this.generateNextNumber(
        "PCN",
        purchaseCreditNotes,
        purchaseCreditNotes.creditNoteNumber,
      );

      const insertData = {
        ...creditNoteData,
        creditNoteNumber,
        creditNoteDate:
          creditNoteData.creditNoteDate ||
          new Date().toISOString().split("T")[0],
        items: JSON.stringify(creditNoteData.items || []),
      };

      const result = await db
        .insert(purchaseCreditNotes)
        .values(insertData)
        .returning();

      const creditNote = result[0];

      // If status is "issued", create a payment entry and update invoice
      if (creditNote.status === "issued") {
        // Create a payment entry for the credit note application
        await db.insert(purchaseInvoicePayments).values({
          invoiceId: creditNote.purchaseInvoiceId,
          amount: creditNote.totalAmount,
          paymentDate: creditNote.creditNoteDate,
          paymentMethod: "Credit Note",
          referenceNumber: creditNote.creditNoteNumber,
          notes: `Credit note applied: ${creditNote.reason || "N/A"}`,
          creditNoteId: creditNote.id,
          paymentType: "credit_note",
        });

        // Update purchase invoice paid amount
        await this.updatePurchaseInvoicePaidAmount(
          creditNote.purchaseInvoiceId,
        );
      }

      return creditNote;
    } catch (error: any) {
      // console.error("Error creating purchase credit note:", error); // Original console.error commented out
      await this.createErrorLog({
        message:
          "Error in createPurchaseCreditNote: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createPurchaseCreditNote",
        severity: "error",
      });
      throw error;
    }
  }

  async updatePurchaseCreditNote(
    id: number,
    creditNoteData: any,
  ): Promise<any | undefined> {
    try {
      const currentCreditNote = await this.getPurchaseCreditNote(id);
      if (!currentCreditNote) {
        throw new Error(`Purchase credit note ${id} not found`);
      }

      const updateData = {
        ...creditNoteData,
        items: creditNoteData.items
          ? JSON.stringify(creditNoteData.items)
          : undefined,
      };

      const result = await db
        .update(purchaseCreditNotes)
        .set(updateData)
        .where(eq(purchaseCreditNotes.id, id))
        .returning();

      const updatedCreditNote = result[0];

      // If status changed to 'issued' and wasn't already issued
      if (
        creditNoteData.status === "issued" &&
        currentCreditNote.status !== "issued" &&
        updatedCreditNote
      ) {
        // Create a payment entry for the credit note application
        await db.insert(purchaseInvoicePayments).values({
          invoiceId: updatedCreditNote.purchaseInvoiceId,
          amount: updatedCreditNote.totalAmount,
          paymentDate: updatedCreditNote.creditNoteDate,
          paymentMethod: "Credit Note",
          referenceNumber: updatedCreditNote.creditNoteNumber,
          notes: `Credit note applied: ${updatedCreditNote.reason || "N/A"}`,
          creditNoteId: updatedCreditNote.id,
          paymentType: "credit_note",
        });

        // Update purchase invoice paid amount
        await this.updatePurchaseInvoicePaidAmount(
          updatedCreditNote.purchaseInvoiceId,
        );
      }

      return updatedCreditNote;
    } catch (error: any) {
      // console.error("Error updating purchase credit note:", error); // Original console.error commented out
      await this.createErrorLog({
        message:
          `Error in updatePurchaseCreditNote (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updatePurchaseCreditNote",
        severity: "error",
      });
      throw error;
    }
  }

  async deletePurchaseCreditNote(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(purchaseCreditNotes)
        .where(eq(purchaseCreditNotes.id, id));
      return result.rowCount > 0;
    } catch (error: any) {
      // console.error("Error deleting purchase credit note:", error); // Original console.error commented out
      await this.createErrorLog({
        message:
          `Error in deletePurchaseCreditNote (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deletePurchaseCreditNote",
        severity: "error",
      });
      throw error;
    }
  }

  async getPurchaseCreditNotesByInvoice(invoiceId: number): Promise<any[]> {
    try {
      const result = await db
        .select()
        .from(purchaseCreditNotes)
        .where(eq(purchaseCreditNotes.purchaseInvoiceId, invoiceId))
        .orderBy(desc(purchaseCreditNotes.createdAt));

      return result;
    } catch (error: any) {
      // console.error("Error getting purchase credit notes by invoice:", error); // Original console.error commented out
      await this.createErrorLog({
        message:
          `Error in getPurchaseCreditNotesByInvoice (invoiceId: ${invoiceId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPurchaseCreditNotesByInvoice",
        severity: "error",
      });
      throw error;
    }
  }

  async updatePurchaseInvoicePaidAmount(invoiceId: number): Promise<void> {
    try {
      // Get all payments for this invoice
      const payments = await db
        .select({
          amount: purchaseInvoicePayments.amount,
        })
        .from(purchaseInvoicePayments)
        .where(eq(purchaseInvoicePayments.invoiceId, invoiceId));

      // Calculate total paid amount
      const totalPaid = payments.reduce((sum, payment) => {
        return sum + parseFloat(payment.amount || "0");
      }, 0);

      // Get invoice details
      const invoice = await db
        .select()
        .from(purchaseInvoices)
        .where(eq(purchaseInvoices.id, invoiceId))
        .limit(1);

      if (invoice.length === 0) {
        throw new Error(`Purchase invoice with ID ${invoiceId} not found`);
      }

      const invoiceData = invoice[0];
      const totalAmount = parseFloat(invoiceData.totalAmount || "0");

      // Determine status based on payment
      let status = "pending";
      if (totalPaid >= totalAmount) {
        status = "paid";
      } else if (totalPaid > 0) {
        status = "partially_paid";
      }

      // Update invoice
      await db
        .update(purchaseInvoices)
        .set({
          paidAmount: totalPaid.toFixed(2),
          status,
        })
        .where(eq(purchaseInvoices.id, invoiceId));

      console.log(
        `Updated purchase invoice ${invoiceId} paid amount to ${totalPaid.toFixed(
          2,
        )} with status ${status}`,
      );
    } catch (error: any) {
      console.error(
        "Original error in updatePurchaseInvoicePaidAmount:",
        error,
      ); // Original console.error kept
      await this.createErrorLog({
        message:
          `Error in updatePurchaseInvoicePaidAmount (invoiceId: ${invoiceId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updatePurchaseInvoicePaidAmount",
        severity: "error",
      });
      throw error;
    }
  }

  async updatePurchaseInvoiceGLEntries(invoiceId: number): Promise<void> {
    try {
      const invoice = await this.getPurchaseInvoice(invoiceId);
      if (!invoice)
        throw new Error(`Purchase invoice with ID ${invoiceId} not found`);

      let supplierName = "Unknown Supplier";
      if (invoice.supplierId) {
        const [supplier] = await db
          .select()
          .from(suppliers)
          .where(eq(suppliers.id, invoice.supplierId));
        if (supplier) supplierName = supplier.name;
      }

      const invoiceCurrency = invoice.currency || "AED";
      const invoiceExchangeRate = parseFloat(invoice.exchangeRate || "1");
      const originalAmount = parseFloat(invoice.totalAmount || "0");
      const aedAmount = (originalAmount * invoiceExchangeRate).toFixed(2);
      const currencyNote =
        invoiceCurrency !== "AED"
          ? ` (${invoiceCurrency} ${originalAmount.toFixed(2)} @ ${invoiceExchangeRate})`
          : "";

      const description = `Purchase Invoice ${invoice.invoiceNumber} - ${supplierName}${currencyNote}`;
      const transactionDate = invoice.invoiceDate
        ? new Date(invoice.invoiceDate).toISOString()
        : new Date().toISOString();
      const dueDate = invoice.dueDate
        ? new Date(invoice.dueDate).toISOString()
        : null;

      await db
        .update(generalLedgerEntries)
        .set({
          debitAmount: "0",
          creditAmount: aedAmount,
          description,
          entityId: invoice.supplierId,
          entityName: supplierName,
          projectId: invoice.projectId || null,
          transactionDate,
          dueDate,
        })
        .where(
          and(
            eq(generalLedgerEntries.referenceType, "purchase_invoice"),
            eq(generalLedgerEntries.referenceId, invoiceId),
            eq(generalLedgerEntries.accountName, "Accounts Payable"),
            ne(generalLedgerEntries.status, "cancelled"),
          ),
        );

      await db
        .update(generalLedgerEntries)
        .set({
          debitAmount: aedAmount,
          creditAmount: "0",
          description,
          entityId: invoice.supplierId,
          entityName: supplierName,
          projectId: invoice.projectId || null,
          transactionDate,
          dueDate,
        })
        .where(
          and(
            eq(generalLedgerEntries.referenceType, "purchase_invoice"),
            eq(generalLedgerEntries.referenceId, invoiceId),
            eq(generalLedgerEntries.accountName, "Purchase Expense"),
            ne(generalLedgerEntries.status, "cancelled"),
          ),
        );

      console.log(
        `GL entries updated for purchase invoice ${invoice.invoiceNumber}`,
      );
    } catch (error: any) {
      await this.createErrorLog({
        message: `Error in updatePurchaseInvoiceGLEntries (invoiceId: ${invoiceId}): ${error?.message || "Unknown error"}`,
        stack: error?.stack,
        component: "updatePurchaseInvoiceGLEntries",
        severity: "error",
      });
      throw error;
    }
  }
}
