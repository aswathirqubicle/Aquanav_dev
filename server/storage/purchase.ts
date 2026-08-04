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
import {
  apportion,
  computeDocumentTotals,
  type HeaderDiscountInput,
  type LineItemInput,
} from "@shared/document-totals";
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
      return true; // Original method did not check the affected-row count, so preserving that behavior.
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
      return result.count > 0;
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
          subject: purchaseOrders.subject,
          status: purchaseOrders.status,
          orderDate: purchaseOrders.orderDate,
          expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
          paymentTerms: purchaseOrders.paymentTerms,
          deliveryTerms: purchaseOrders.deliveryTerms,
          deliverTo: purchaseOrders.deliverTo,
          termsAndConditions: purchaseOrders.termsAndConditions,
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

      // Items and files are deliberately NOT loaded here. This used to run two
      // extra queries per row — 21 round trips for a 10-row page, growing with
      // the page size and independent of any index. Nothing in the list table
      // renders them; the only consumers were the edit, duplicate and view
      // flows, which all fetch the order by id now. Callers that need children
      // should use getPurchaseOrder(id).
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
          deliverTo: purchaseOrders.deliverTo,
          termsAndConditions: purchaseOrders.termsAndConditions,
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
      // Resolve submitter / approver to a person's name in SQL, same as
      // getPurchaseInvoice. /api/users is admin-only while finance and
      // project_manager can both open this document, so the client cannot look
      // these ids up itself and the view fell back to "User ID: n". Employee
      // name where the login is linked to an employee row, else the username.
      // purchase_orders has no created_by column, so there are only two pairs.
      const submitter = alias(users, "poSubmitter");
      const submitterEmp = alias(employees, "poSubmitterEmp");
      const approver = alias(users, "poApprover");
      const approverEmp = alias(employees, "poApproverEmp");
      const convertedInvoice = alias(purchaseInvoices, "convertedInvoice");

      const [order] = await db
        .select({
          id: purchaseOrders.id,
          poNumber: purchaseOrders.poNumber,
          supplierId: purchaseOrders.supplierId,
          supplierName: suppliers.name,
          subject: purchaseOrders.subject,
          status: purchaseOrders.status,
          orderDate: purchaseOrders.orderDate,
          expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
          paymentTerms: purchaseOrders.paymentTerms,
          deliveryTerms: purchaseOrders.deliveryTerms,
          deliverTo: purchaseOrders.deliverTo,
          termsAndConditions: purchaseOrders.termsAndConditions,
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
          submittedByName: sql<string>`COALESCE(NULLIF(CONCAT(${submitterEmp.firstName}, ' ', ${submitterEmp.lastName}), ' '), ${submitter.username}, '')`,
          submittedAt: purchaseOrders.submittedAt,
          approvedById: purchaseOrders.approvedById,
          approvedByName: sql<string>`COALESCE(NULLIF(CONCAT(${approverEmp.firstName}, ' ', ${approverEmp.lastName}), ' '), ${approver.username}, '')`,
          approvedAt: purchaseOrders.approvedAt,
          rejectionReason: purchaseOrders.rejectionReason,
          // Where a converted order ended up. The id alone was never selected,
          // so the view could not tell the reader which invoice it became.
          convertedInvoiceId: purchaseOrders.convertedInvoiceId,
          convertedInvoiceNumber: convertedInvoice.invoiceNumber,
        })
        .from(purchaseOrders)
        .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
        .leftJoin(submitter, eq(purchaseOrders.submittedById, submitter.id))
        .leftJoin(submitterEmp, eq(submitter.id, submitterEmp.userId))
        .leftJoin(approver, eq(purchaseOrders.approvedById, approver.id))
        .leftJoin(approverEmp, eq(approver.id, approverEmp.userId))
        .leftJoin(
          convertedInvoice,
          eq(purchaseOrders.convertedInvoiceId, convertedInvoice.id),
        )
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
          discount: purchaseOrderItems.discount,
          discountType: purchaseOrderItems.discountType,
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
      orderData = this.applyPurchaseDocumentTotals(orderData);
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
          subject: orderData.subject || null,
          status: orderData.status || "draft",
          orderDate: orderData.orderDate
            ? new Date(orderData.orderDate)
            : new Date(),
          expectedDeliveryDate: orderData.expectedDeliveryDate
            ? new Date(orderData.expectedDeliveryDate)
            : null,
          paymentTerms: orderData.paymentTerms || null,
          deliveryTerms: orderData.deliveryTerms || null,
          deliverTo: orderData.deliverTo || null,
          bankAccount: orderData.bankAccount || null,
          subtotal: orderData.subtotal || "0",
          discountPercentage: orderData.discountPercentage || "0",
          discountAmount: orderData.discountAmount || "0",
          taxAmount: orderData.taxAmount || "0",
          totalAmount: orderData.totalAmount || "0",
          notes: orderData.notes || null,
          termsAndConditions: orderData.termsAndConditions || null,
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
          discount: (item.discount ?? 0).toString(),
          discountType: item.discountType || "amount",
          taxRate: item.taxRate ? item.taxRate.toFixed(2) : "0.00",
          taxAmount: item.taxAmount ? item.taxAmount.toFixed(2) : "0.00",
          lineTotal: (item.lineTotal ?? 0).toString(),
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
      data = this.applyPurchaseDocumentTotals(data);
      const updateData: any = {};

      if (data.supplierId !== undefined)
        updateData.supplierId = data.supplierId;
      if (data.subject !== undefined) updateData.subject = data.subject || null;
      if (data.status !== undefined) updateData.status = data.status;
      // Approval-trail fields. Written only by the edit route when an approved
      // or rejected order is sent back to pending_approval, which clears the
      // stale verdict and re-stamps the submitter. `|| null` is deliberately NOT
      // used: these are cleared by passing an explicit null, and a falsy id is
      // not a value any caller sends.
      if (data.approvedById !== undefined)
        updateData.approvedById = data.approvedById;
      if (data.approvedAt !== undefined) updateData.approvedAt = data.approvedAt;
      if (data.rejectionReason !== undefined)
        updateData.rejectionReason = data.rejectionReason;
      if (data.submittedById !== undefined)
        updateData.submittedById = data.submittedById;
      if (data.submittedAt !== undefined)
        updateData.submittedAt = data.submittedAt;
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
      if (data.deliverTo !== undefined)
        updateData.deliverTo = data.deliverTo || null;
      if (data.termsAndConditions !== undefined)
        updateData.termsAndConditions = data.termsAndConditions || null;
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
            discount: (item.discount ?? 0).toString(),
            discountType: item.discountType || "amount",
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
            lineTotal: (item.lineTotal ?? 0).toString(),
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

      return result.count > 0;
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
      subject?: string;
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

      const convertDiscountPercentage =
        overrides?.discountPercentage ?? po.discountPercentage ?? "0";
      const convertDiscountAmountInput =
        overrides?.discountAmount ?? po.discountAmount ?? "0";

      // Recompute through the shared engine (VAT on the discounted base; line
      // discount first, then header apportioned) — the same path every other
      // purchase document uses. Replaces the old gross + tax - headerDiscount
      // formula, which ignored line discounts.
      const convertComputed: any = this.applyPurchaseDocumentTotals({
        items: itemsToUse.map((item: any) => ({
          quantity: parseFloat(item.quantity) || 0,
          unitPrice: parseFloat(item.unitPrice) || 0,
          taxRate: parseFloat(item.taxRate || "0") || 0,
          discount: parseFloat(item.discount ?? "0") || 0,
          discountType:
            item.discountType === "percentage" ? "percentage" : "amount",
        })),
        discountPercentage: convertDiscountPercentage,
        discountAmount: convertDiscountAmountInput,
      });
      const convertItems = convertComputed.items;

      // Create the invoice
      const [invoice] = await db
        .insert(purchaseInvoices)
        .values({
          invoiceNumber,
          supplierInvoiceNumber: overrides?.supplierInvoiceNumber ?? null,
          supplierId: po.supplierId,
          subject: overrides?.subject ?? po.subject ?? null,
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
          subtotal: convertComputed.subtotal,
          discountPercentage: convertDiscountPercentage,
          discountAmount: convertComputed.discountAmount,
          taxAmount: convertComputed.taxAmount,
          totalAmount: convertComputed.totalAmount,
          paidAmount: "0",
          currency: overrides?.currency ?? po.currency ?? "AED",
          exchangeRate: overrides?.exchangeRate ?? po.exchangeRate ?? "1",
          createdBy: userId,
        })
        .returning();

      // Insert line items (user-edited or copied from PO)
      if (itemsToUse.length > 0) {
        const invoiceItemsToInsert = itemsToUse.map((item: any, i: number) => ({
          invoiceId: invoice.id,
          itemType: item.itemType || "product",
          inventoryItemId: item.inventoryItemId || null,
          description: item.description || null,
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.unitPrice).toFixed(2),
          taxRate: parseFloat(item.taxRate || "0").toFixed(2),
          discount: (parseFloat(item.discount ?? "0") || 0).toString(),
          discountType:
            item.discountType === "percentage" ? "percentage" : "amount",
          taxAmount: Number(convertItems[i].taxAmount).toFixed(2),
          lineTotal: Number(convertItems[i].lineTotal).toFixed(2),
          // Carry per-line allocation through the conversion when the payload
          // provides it (6.3). Purchase-order items have no projectId column, so
          // this is null for a straight PO copy and set only when the conversion
          // form assigns one — never a regression.
          projectId: item.projectId || null,
          assetInstanceId: item.assetInstanceId || null,
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
      paymentStatus?: string;
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

      // Separate from status: status is the approval lifecycle (draft ->
      // approved), paymentStatus is settlement (unpaid / partial / paid). An
      // invoice can be approved and unpaid, so filtering on one says nothing
      // about the other. Note the stored value is "partial", not
      // "partially_paid" — the sales side uses the longer spelling.
      if (filters?.paymentStatus && filters.paymentStatus !== "all") {
        queryConditions.push(
          eq(purchaseInvoices.paymentStatus, filters.paymentStatus),
        );
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
          subject: purchaseInvoices.subject,
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
          termsAndConditions: purchaseInvoices.termsAndConditions,
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

      // Files are deliberately NOT loaded here — one extra query per row, and
      // nothing in the list table renders them. The view, edit and duplicate
      // flows all fetch the invoice by id. Callers that need files should use
      // getPurchaseInvoice(id).
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
          termsAndConditions: purchaseInvoices.termsAndConditions,
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
          termsAndConditions: purchaseInvoices.termsAndConditions,
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
      // Resolve submitter / approver / creator to a person's name in SQL.
      // /api/users is admin-only while finance and project_manager can both
      // open this document, so the client cannot look these ids up itself and
      // the view fell back to printing "User ID: n". Employee name when the
      // login is linked to an employee row, else the username. Mirrors the
      // purchase request queries above.
      const submitter = alias(users, "submitter");
      const submitterEmp = alias(employees, "submitterEmp");
      const approver = alias(users, "approver");
      const approverEmp = alias(employees, "approverEmp");
      const creator = alias(users, "creator");
      const creatorEmp = alias(employees, "creatorEmp");

      const [invoice] = await db
        .select({
          id: purchaseInvoices.id,
          invoiceNumber: purchaseInvoices.invoiceNumber,
          supplierInvoiceNumber: purchaseInvoices.supplierInvoiceNumber,
          supplierId: purchaseInvoices.supplierId,
          supplierName: suppliers.name,
          subject: purchaseInvoices.subject,
          poId: purchaseInvoices.poId,
          // The view printed "PO-{poId}" — the raw row id, not the document
          // number the supplier and the purchase order list both show.
          poNumber: purchaseOrders.poNumber,
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
          termsAndConditions: purchaseInvoices.termsAndConditions,
          createdBy: purchaseInvoices.createdBy,
          createdByName: sql<string>`COALESCE(NULLIF(CONCAT(${creatorEmp.firstName}, ' ', ${creatorEmp.lastName}), ' '), ${creator.username}, '')`,
          createdAt: purchaseInvoices.createdAt,
          submittedById: purchaseInvoices.submittedById,
          submittedByName: sql<string>`COALESCE(NULLIF(CONCAT(${submitterEmp.firstName}, ' ', ${submitterEmp.lastName}), ' '), ${submitter.username}, '')`,
          submittedAt: purchaseInvoices.submittedAt,
          approvedById: purchaseInvoices.approvedById,
          approvedByName: sql<string>`COALESCE(NULLIF(CONCAT(${approverEmp.firstName}, ' ', ${approverEmp.lastName}), ' '), ${approver.username}, '')`,
          approvedAt: purchaseInvoices.approvedAt,
          rejectionReason: purchaseInvoices.rejectionReason,
          currency: purchaseInvoices.currency,
          exchangeRate: purchaseInvoices.exchangeRate,
          supplierCurrency: suppliers.currency,
          supplierVatTreatment: suppliers.vatTreatment,
        })
        .from(purchaseInvoices)
        .leftJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id))
        .leftJoin(purchaseOrders, eq(purchaseInvoices.poId, purchaseOrders.id))
        .leftJoin(submitter, eq(purchaseInvoices.submittedById, submitter.id))
        .leftJoin(submitterEmp, eq(submitter.id, submitterEmp.userId))
        .leftJoin(approver, eq(purchaseInvoices.approvedById, approver.id))
        .leftJoin(approverEmp, eq(approver.id, approverEmp.userId))
        .leftJoin(creator, eq(purchaseInvoices.createdBy, creator.id))
        .leftJoin(creatorEmp, eq(creator.id, creatorEmp.userId))
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
          discount: purchaseInvoiceItems.discount,
          discountType: purchaseInvoiceItems.discountType,
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

  /**
   * Recompute a purchase document's totals authoritatively from its line items
   * and discounts (P4b), so VAT is charged on the discounted base and the server
   * never trusts a client-supplied `taxAmount`. Header discount is
   * `discountPercentage` (%) or, when that is zero, the fixed `discountAmount`.
   * Returns `data` with each item's `taxAmount`/`lineTotal` and the document
   * `subtotal`/`discountAmount` (line + header total)/`taxAmount`/`totalAmount`
   * corrected. A document with no items array is returned unchanged.
   */
  private applyPurchaseDocumentTotals<T extends Record<string, any>>(data: T): T {
    const items = Array.isArray((data as any).items)
      ? ((data as any).items as any[])
      : null;
    if (!items || items.length === 0) return data;

    const lineInputs: LineItemInput[] = items.map((it) => ({
      quantity: Number(it.quantity) || 0,
      unitPrice: Number(it.unitPrice) || 0,
      taxRate: Number(it.taxRate) || 0,
      discount: Number(it.discount) || 0,
      discountType: it.discountType === "percentage" ? "percentage" : "amount",
    }));

    const headerPct = Number((data as any).discountPercentage) || 0;
    const header: HeaderDiscountInput =
      headerPct > 0
        ? { discount: headerPct, discountType: "percentage" }
        : {
            discount: Number((data as any).discountAmount) || 0,
            discountType: "amount",
          };

    const totals = computeDocumentTotals(lineInputs, header);

    const itemsOut = items.map((it, i) => ({
      ...it,
      taxAmount: totals.lines[i].taxAmount,
      lineTotal: totals.lines[i].lineTotal,
    }));

    return {
      ...data,
      items: itemsOut,
      subtotal: totals.gross.toFixed(2),
      // Store the HEADER discount only (its pre-P4b meaning) so the edit/convert
      // forms reload it correctly. The combined total (header + line) is derived
      // for display as subtotal + taxAmount - totalAmount, which equals
      // discountTotal to the cent.
      discountAmount: totals.headerDiscount.toFixed(2),
      taxAmount: totals.taxTotal.toFixed(2),
      totalAmount: totals.total.toFixed(2),
    };
  }

  /**
   * Split a purchase invoice's expense amount across the projects its LINE ITEMS
   * are allocated to. Purchase projects are per line, so one invoice can carry
   * cost for several projects; posting a single Purchase Expense row with the
   * invoice-level projectId (usually null) leaves the ledger unattributable to
   * any project.
   *
   * Weights are each line's net-of-discount, ex-VAT amount (`lineTotal -
   * taxAmount`) — the same basis as the project-cost rollup. `amount` is
   * apportioned across the groups so the parts sum to it EXACTLY, keeping the
   * posting balanced to the cent under any exchange rate. Lines with no project
   * group under a null projectId. Zero-value groups are dropped (G2), and an
   * invoice with no usable line weights falls back to one unallocated row.
   */
  private async allocatePurchaseExpense(
    invoiceId: number,
    amount: number,
    fallbackProjectId: number | null,
  ): Promise<Array<{ projectId: number | null; amount: number }>> {
    const items = await db
      .select({
        projectId: purchaseInvoiceItems.projectId,
        lineTotal: purchaseInvoiceItems.lineTotal,
        taxAmount: purchaseInvoiceItems.taxAmount,
      })
      .from(purchaseInvoiceItems)
      .where(eq(purchaseInvoiceItems.invoiceId, invoiceId));

    const groups = new Map<number | null, number>();
    for (const item of items) {
      const net =
        parseFloat(item.lineTotal || "0") - parseFloat(item.taxAmount || "0");
      const key = item.projectId ?? null;
      groups.set(key, (groups.get(key) || 0) + net);
    }

    const keys = Array.from(groups.keys());
    const weights = keys.map((k) => groups.get(k) as number);
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    if (keys.length === 0 || totalWeight <= 0) {
      return [{ projectId: fallbackProjectId, amount }];
    }

    const parts = apportion(weights, amount);
    return keys
      .map((k, i) => ({ projectId: k, amount: parts[i] }))
      .filter((p) => Math.abs(p.amount) > 0.005);
  }

  async createPurchaseInvoiceStandalone(invoiceData: any): Promise<any> {
    invoiceData = this.applyPurchaseDocumentTotals(invoiceData);
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
          subject: invoiceData.subject || null,
          poId: invoiceData.poId || null,
          // project_id and asset_inventory_instance_id were dropped from
          // purchase_invoices by migration 0002 and are absent from the live
          // schema; Drizzle silently discarded both keys. Allocation to a
          // project or asset is per line item (purchase_invoice_items).
          // L28: always create as draft. A caller-supplied status (e.g.
          // "approved") must NOT be honored — approval is the only path that
          // posts GL, goods receipts and project cost, so accepting it here
          // would let a create skip the entire approval workflow.
          status: "draft",
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
          termsAndConditions: invoiceData.termsAndConditions || null,
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
          discount: (item.discount ?? 0).toString(),
          discountType: item.discountType || "amount",
          taxRate: item.taxRate?.toString() || "0",
          taxAmount: item.taxAmount?.toString() || "0",
          lineTotal: item.lineTotal.toString(),
          // Per-line allocation (6.3). Mirrors updatePurchaseInvoice — without
          // these the create path silently drops the line's project/asset, so
          // project cost and asset maintenance were never allocated on approve.
          projectId: item.projectId || null,
          assetInstanceId: item.assetInstanceId || null,
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

      invoiceData = this.applyPurchaseDocumentTotals(invoiceData);

      // Only write what the caller actually supplied. This used to set every
      // column unconditionally with a literal fallback, so a payload that
      // omitted a field silently overwrote it — most damagingly
      // `currency: invoiceData.currency || "AED"` and
      // `exchangeRate: invoiceData.exchangeRate || "1"`, which rewrote a
      // USD invoice to AED at rate 1. The amounts kept their numbers but
      // changed denomination, understating the liability, and a later edit to
      // an approved invoice would then re-post the ledger at the wrong value.
      // Mirrors updatePurchaseOrder above. The form always sends all of these,
      // so this changes nothing for the UI — it only stops partial payloads
      // from destroying stored values.
      const updateData: any = {};

      if (invoiceData.supplierId !== undefined)
        updateData.supplierId = invoiceData.supplierId;
      if (invoiceData.supplierInvoiceNumber !== undefined)
        updateData.supplierInvoiceNumber =
          invoiceData.supplierInvoiceNumber || null;
      if (invoiceData.subject !== undefined)
        updateData.subject = invoiceData.subject || null;
      if (invoiceData.invoiceDate !== undefined)
        updateData.invoiceDate = new Date(invoiceData.invoiceDate);
      if (invoiceData.dueDate !== undefined)
        updateData.dueDate = invoiceData.dueDate
          ? new Date(invoiceData.dueDate)
          : null;
      if (invoiceData.paymentTerms !== undefined)
        updateData.paymentTerms = invoiceData.paymentTerms || null;
      if (invoiceData.bankAccount !== undefined)
        updateData.bankAccount = invoiceData.bankAccount || null;
      if (invoiceData.notes !== undefined)
        updateData.notes = invoiceData.notes || null;
      if (invoiceData.termsAndConditions !== undefined)
        updateData.termsAndConditions = invoiceData.termsAndConditions || null;
      if (invoiceData.currency !== undefined)
        updateData.currency = invoiceData.currency;
      if (invoiceData.exchangeRate !== undefined)
        updateData.exchangeRate = invoiceData.exchangeRate;
      if (invoiceData.discountPercentage !== undefined)
        updateData.discountPercentage = invoiceData.discountPercentage || "0";
      if (invoiceData.discountAmount !== undefined)
        updateData.discountAmount = invoiceData.discountAmount || "0";
      if (invoiceData.subtotal !== undefined)
        updateData.subtotal = parseFloat(invoiceData.subtotal || "0").toFixed(2);
      if (invoiceData.taxAmount !== undefined)
        updateData.taxAmount = parseFloat(invoiceData.taxAmount || "0").toFixed(
          2,
        );
      // Use the engine's total (nets both line and header discounts). Do NOT
      // recompute as subtotal + tax - headerDiscount, which ignores line discounts.
      if (invoiceData.totalAmount !== undefined)
        updateData.totalAmount = parseFloat(
          invoiceData.totalAmount || "0",
        ).toFixed(2);

      if (Object.keys(updateData).length > 0) {
        await db
          .update(purchaseInvoices)
          .set(updateData)
          .where(eq(purchaseInvoices.id, id));
      }

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
          discount: (item.discount ?? 0).toString(),
          discountType: item.discountType || "amount",
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
      // Standard VAT posting (D5): AP is the gross owed to the supplier; Purchase
      // Expense is net of discount and EXCLUDING VAT; the input VAT is recoverable
      // (an asset). Rounded so Dr Expense + Dr VAT == Cr AP to the cent.
      const originalTax = parseFloat(invoice.taxAmount || "0");
      const aedTotal = Math.round(originalAmount * invoiceExchangeRate * 100) / 100;
      const aedTax = Math.round(originalTax * invoiceExchangeRate * 100) / 100;
      const aedExpense = Math.round((aedTotal - aedTax) * 100) / 100;
      const currencyNote =
        invoiceCurrency !== "AED"
          ? ` (${invoiceCurrency} ${originalAmount.toFixed(2)} @ ${invoiceExchangeRate})`
          : "";
      // All rows in ONE transaction (L14). Independent inserts could leave a
      // credit to Accounts Payable with no matching expense/VAT debit.
      const approvalShared = {
        entryType: "payable" as const,
        referenceType: "purchase_invoice" as const,
        referenceId: id,
        description: `Purchase Invoice ${invoice.invoiceNumber} - ${supplierName}${currencyNote}`,
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
        status: "pending" as const,
      };

      // One Purchase Expense row per project the line items are allocated to, so
      // the ledger is attributable to a project. VAT Recoverable and Accounts
      // Payable stay whole: input VAT is reclaimed from the tax authority and the
      // payable is owed to the supplier — neither is a project cost.
      const expenseAllocation = await this.allocatePurchaseExpense(
        id,
        aedExpense,
        invoice.projectId || null,
      );

      await db.transaction(async (tx) => {
        // Debit Purchase Expense (net of discount, excl. VAT), in AED
        for (const alloc of expenseAllocation) {
          await tx.insert(generalLedgerEntries).values({
            ...approvalShared,
            projectId: alloc.projectId,
            accountName: "Purchase Expense",
            debitAmount: alloc.amount.toFixed(2),
            creditAmount: "0",
          });
        }

        // Debit VAT Recoverable (input VAT, recoverable) — omitted when zero (G2)
        if (aedTax > 0.005) {
          await tx.insert(generalLedgerEntries).values({
            ...approvalShared,
            accountName: "VAT Recoverable",
            debitAmount: aedTax.toFixed(2),
            creditAmount: "0",
          });
        }

        // Credit Accounts Payable (gross, incl. VAT), in AED
        await tx.insert(generalLedgerEntries).values({
          ...approvalShared,
          accountName: "Accounts Payable",
          debitAmount: "0",
          creditAmount: aedTotal.toFixed(2),
        });
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
      // Reverse the 3-row approval posting (T6.7): Dr AP (gross) / Cr Purchase
      // Expense (net) / Cr VAT Recoverable (tax). VAT line omitted when zero.
      const originalTax = parseFloat(invoice.taxAmount || "0");
      const aedTotal = Math.round(originalAmount * invoiceExchangeRate * 100) / 100;
      const aedTax = Math.round(originalTax * invoiceExchangeRate * 100) / 100;
      const aedExpense = Math.round((aedTotal - aedTax) * 100) / 100;
      const currencyNote =
        invoiceCurrency !== "AED"
          ? ` (${invoiceCurrency} ${originalAmount.toFixed(2)} @ ${invoiceExchangeRate})`
          : "";

      // All reversal rows in ONE transaction (L14). projectId now carried (L11).
      const cancelShared = {
        entryType: "payable" as const,
        referenceType: "purchase_invoice" as const,
        referenceId: id,
        description: `CANCELLED - Purchase Invoice ${invoice.invoiceNumber} - ${supplierName}${currencyNote}`,
        entityId: invoice.supplierId,
        entityName: supplierName,
        projectId: invoice.projectId || null,
        invoiceNumber: invoice.invoiceNumber,
        transactionDate: new Date().toISOString(),
        status: "cancelled" as const,
      };

      const cancelAllocation = await this.allocatePurchaseExpense(
        id,
        aedExpense,
        invoice.projectId || null,
      );

      await db.transaction(async (tx) => {
        // Reverse Cr AP: debit Accounts Payable (gross)
        await tx.insert(generalLedgerEntries).values({
          ...cancelShared,
          accountName: "Accounts Payable",
          debitAmount: aedTotal.toFixed(2),
          creditAmount: "0",
        });

        // Reverse Dr Expense: credit Purchase Expense (net of discount, excl.
        // VAT), mirroring the per-project rows the approval posted so each
        // project's ledger returns to zero.
        for (const alloc of cancelAllocation) {
          await tx.insert(generalLedgerEntries).values({
            ...cancelShared,
            projectId: alloc.projectId,
            accountName: "Purchase Expense",
            debitAmount: "0",
            creditAmount: alloc.amount.toFixed(2),
          });
        }

        // Reverse Dr VAT: credit VAT Recoverable (input VAT) — omitted when zero
        if (aedTax > 0.005) {
          await tx.insert(generalLedgerEntries).values({
            ...cancelShared,
            accountName: "VAT Recoverable",
            debitAmount: "0",
            creditAmount: aedTax.toFixed(2),
          });
        }
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

      // Determine new payment status (unpaid -> partial -> paid). This is the
      // payment lifecycle; the approval `status` is never touched here.
      let newStatus = "unpaid";
      if (newPaidAmount >= totalAmount) {
        newStatus = "paid";
      } else if (newPaidAmount > 0) {
        newStatus = "partial";
      }

      // Update invoice paid amount and payment status
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

      // Both sides in ONE transaction (L14).
      // NOTE: projectId is absent here, matching the original — that is
      // finding L11, fixed in P6. P1 changes no ledger amounts or attributes.
      const paymentShared = {
        entryType: "payable" as const,
        referenceType: "payment" as const,
        referenceId: payment.id,
        description: `Payment for Purchase Invoice ${invoice.invoiceNumber} - ${supplierName}${currencyNote}`,
        entityId: invoice.supplierId,
        entityName: supplierName,
        projectId: invoice.projectId || null,
        invoiceNumber: invoice.invoiceNumber,
        transactionDate: paymentData.paymentDate,
        status: "paid" as const,
      };

      await db.transaction(async (tx) => {
        // 1. Debit: Accounts Payable (reduce liability - we owe less) in AED
        await tx.insert(generalLedgerEntries).values({
          ...paymentShared,
          accountName: "Accounts Payable",
          debitAmount: aedAmount,
          creditAmount: "0",
        });

        // 2. Credit: Cash/Bank (reduce asset - cash outflow) in AED
        await tx.insert(generalLedgerEntries).values({
          ...paymentShared,
          accountName: "Cash/Bank",
          debitAmount: "0",
          creditAmount: aedAmount,
        });
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

      // Same name resolution as getPurchaseInvoice: the client cannot turn a
      // recordedBy id into a person without /api/users, which it may not read.
      const recorder = alias(users, "paymentRecorder");
      const recorderEmp = alias(employees, "paymentRecorderEmp");

      const payments = await db
        .select({
          id: purchaseInvoicePayments.id,
          invoiceId: purchaseInvoicePayments.invoiceId,
          amount: purchaseInvoicePayments.amount,
          paymentDate: purchaseInvoicePayments.paymentDate,
          paymentMethod: purchaseInvoicePayments.paymentMethod,
          referenceNumber: purchaseInvoicePayments.referenceNumber,
          notes: purchaseInvoicePayments.notes,
          // A credit note applied to the invoice is stored as a payment row.
          // Without these two the view showed it as an ordinary cash payment.
          paymentType: purchaseInvoicePayments.paymentType,
          creditNoteId: purchaseInvoicePayments.creditNoteId,
          recordedBy: purchaseInvoicePayments.recordedBy,
          recordedByName: sql<string>`COALESCE(NULLIF(CONCAT(${recorderEmp.firstName}, ' ', ${recorderEmp.lastName}), ' '), ${recorder.username}, '')`,
          recordedAt: purchaseInvoicePayments.recordedAt,
        })
        .from(purchaseInvoicePayments)
        .leftJoin(recorder, eq(purchaseInvoicePayments.recordedBy, recorder.id))
        .leftJoin(recorderEmp, eq(recorder.id, recorderEmp.userId))
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

  /**
   * Post the GL for an issued purchase credit note (L5/H1). A purchase return
   * reverses the payable and the recoverable input VAT:
   *   Dr Accounts Payable (gross) / Cr Purchase Expense (net) / Cr VAT Recoverable (tax)
   * VAT line omitted when zero. Balances to the cent. Shared by both entry paths
   * (create-as-issued and draft->issued). The credit note's own settlement row in
   * purchase_invoice_payments carries no GL (it's inserted directly, not via
   * createPurchaseInvoicePayment) — D1 symmetry with the sales side.
   */
  private async postPurchaseCreditNoteGL(creditNote: any): Promise<void> {
    const invoice = creditNote.purchaseInvoiceId
      ? await this.getPurchaseInvoice(creditNote.purchaseInvoiceId)
      : null;
    const supplierId: number | null = invoice?.supplierId ?? null;
    let supplierName = "Unknown Supplier";
    if (supplierId) {
      const [supplier] = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, supplierId));
      if (supplier) supplierName = supplier.name;
    }

    const rate = parseFloat(invoice?.exchangeRate || "1");
    const currency = invoice?.currency || "AED";
    const originalTotal = parseFloat(creditNote.totalAmount || "0");
    const originalTax = parseFloat(creditNote.taxAmount || "0");
    const aedTotal = Math.round(originalTotal * rate * 100) / 100;
    const aedTax = Math.round(originalTax * rate * 100) / 100;
    const aedNet = Math.round((aedTotal - aedTax) * 100) / 100;
    const currencyNote =
      currency !== "AED"
        ? ` (${currency} ${originalTotal.toFixed(2)} @ ${rate})`
        : "";

    const shared = {
      entryType: "payable" as const,
      referenceType: "purchase_credit_note" as const,
      referenceId: creditNote.id,
      description: `Purchase Credit Note ${creditNote.creditNoteNumber} for Invoice ${invoice?.invoiceNumber || "N/A"}${currencyNote}`,
      entityId: supplierId,
      entityName: supplierName,
      projectId: invoice?.projectId || null,
      invoiceNumber: invoice?.invoiceNumber || null,
      transactionDate:
        creditNote.creditNoteDate || new Date().toISOString().split("T")[0],
      status: "issued" as const,
    };

    // A purchase credit note carries no project of its own — the only link is the
    // invoice — so credit each project in proportion to its share of that
    // invoice's net cost, the same weights the original expense was posted on.
    const creditAllocation = await this.allocatePurchaseExpense(
      creditNote.purchaseInvoiceId,
      aedNet,
      invoice?.projectId || null,
    );

    await db.transaction(async (tx) => {
      await tx.insert(generalLedgerEntries).values({
        ...shared,
        accountName: "Accounts Payable",
        debitAmount: aedTotal.toFixed(2),
        creditAmount: "0",
      });
      for (const alloc of creditAllocation) {
        await tx.insert(generalLedgerEntries).values({
          ...shared,
          projectId: alloc.projectId,
          accountName: "Purchase Expense",
          debitAmount: "0",
          creditAmount: alloc.amount.toFixed(2),
        });
      }
      if (aedTax > 0.005) {
        await tx.insert(generalLedgerEntries).values({
          ...shared,
          accountName: "VAT Recoverable",
          debitAmount: "0",
          creditAmount: aedTax.toFixed(2),
        });
      }
    });
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
          paymentDate: new Date(creditNote.creditNoteDate),
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

        // Post the credit-note GL (L5) — previously nothing was posted.
        await this.postPurchaseCreditNoteGL(creditNote);
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
          paymentDate: new Date(updatedCreditNote.creditNoteDate),
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

        // Post the credit-note GL (L5) — previously nothing was posted.
        await this.postPurchaseCreditNoteGL(updatedCreditNote);
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
      return result.count > 0;
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

      // The payment lifecycle lives in paymentStatus (unpaid -> partial -> paid).
      // The approval `status` must be left untouched, so a payment on an approved
      // invoice keeps status = "approved" (previously this clobbered status with a
      // payment value, destroying the approval state).
      let paymentStatus = "unpaid";
      if (totalPaid >= totalAmount) {
        paymentStatus = "paid";
      } else if (totalPaid > 0) {
        paymentStatus = "partial";
      }

      // Update invoice — only paidAmount + paymentStatus.
      await db
        .update(purchaseInvoices)
        .set({
          paidAmount: totalPaid.toFixed(2),
          paymentStatus,
        })
        .where(eq(purchaseInvoices.id, invoiceId));

      console.log(
        `Updated purchase invoice ${invoiceId} paid amount to ${totalPaid.toFixed(
          2,
        )} with paymentStatus ${paymentStatus}`,
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
      // Recompute the 3-row split from the EDITED figures.
      const originalTax = parseFloat(invoice.taxAmount || "0");
      const aedTotal = Math.round(originalAmount * invoiceExchangeRate * 100) / 100;
      const aedTax = Math.round(originalTax * invoiceExchangeRate * 100) / 100;
      const aedExpense = Math.round((aedTotal - aedTax) * 100) / 100;
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

      const shared = {
        entryType: "payable" as const,
        referenceType: "purchase_invoice" as const,
        referenceId: invoiceId,
        description,
        entityId: invoice.supplierId,
        entityName: supplierName,
        projectId: invoice.projectId || null,
        invoiceNumber: invoice.invoiceNumber,
        transactionDate,
        dueDate,
        status: "pending" as const,
      };

      // Reverse-and-re-post (H2): a fixed 2-row UPDATE can neither add a VAT row
      // nor remove one when an edit changes the tax. Reverse the current active
      // posting and post the new split — atomically, keeping the reversal visible.
      const activeRows = await db
        .select()
        .from(generalLedgerEntries)
        .where(
          and(
            eq(generalLedgerEntries.referenceType, "purchase_invoice"),
            eq(generalLedgerEntries.referenceId, invoiceId),
            eq(generalLedgerEntries.status, "pending"),
          ),
        );

      const repostAllocation = await this.allocatePurchaseExpense(
        invoiceId,
        aedExpense,
        invoice.projectId || null,
      );

      await db.transaction(async (tx) => {
        for (const row of activeRows) {
          await tx.insert(generalLedgerEntries).values({
            entryType: row.entryType,
            referenceType: "purchase_invoice",
            referenceId: invoiceId,
            accountName: row.accountName,
            description: `REVERSAL (edit) - ${row.description}`,
            debitAmount: row.creditAmount,
            creditAmount: row.debitAmount,
            entityId: row.entityId,
            entityName: row.entityName,
            projectId: row.projectId,
            invoiceNumber: row.invoiceNumber,
            transactionDate: row.transactionDate,
            dueDate: row.dueDate,
            status: "reversed",
          });
          await tx
            .update(generalLedgerEntries)
            .set({ status: "reversed" })
            .where(eq(generalLedgerEntries.id, row.id));
        }

        // Re-post the new split from the edited figures (VAT line omitted when
        // zero), one Purchase Expense row per project the edited lines allocate
        // to — the edit may have moved a line to a different project.
        for (const alloc of repostAllocation) {
          await tx.insert(generalLedgerEntries).values({
            ...shared,
            projectId: alloc.projectId,
            accountName: "Purchase Expense",
            debitAmount: alloc.amount.toFixed(2),
            creditAmount: "0",
          });
        }
        if (aedTax > 0.005) {
          await tx.insert(generalLedgerEntries).values({
            ...shared,
            accountName: "VAT Recoverable",
            debitAmount: aedTax.toFixed(2),
            creditAmount: "0",
          });
        }
        await tx.insert(generalLedgerEntries).values({
          ...shared,
          accountName: "Accounts Payable",
          debitAmount: "0",
          creditAmount: aedTotal.toFixed(2),
        });
      });

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
