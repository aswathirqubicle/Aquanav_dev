import { CustomerStorage } from "./customer";
import {
  InsertSupplier,
  InsertSupplierDocument,
  Supplier,
  SupplierBankDetails,
  SupplierDocument,
  SupplierWithBankDetails,
  generalLedgerEntries,
  inventoryItems,
  supplierBankDetails,
  supplierDocuments,
  supplierInventoryItems,
  suppliers,
} from "@shared/schema";
import { PaginatedResponse } from "./types";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { db } from "../db";

export class SupplierStorage extends CustomerStorage {
  // Supplier methods
  async getSuppliers(): Promise<SupplierWithBankDetails[]> {
    try {
      const allSuppliers = await db
        .select()
        .from(suppliers)
        .orderBy(asc(suppliers.id));
      if (allSuppliers.length === 0) {
        return [];
      }
      const supplierIds = allSuppliers.map((s) => s.id);
      const bankDetails = await db
        .select()
        .from(supplierBankDetails)
        .where(inArray(supplierBankDetails.supplierId, supplierIds));

      const bankDetailsMap = new Map<number, SupplierBankDetails[]>();
      for (const detail of bankDetails) {
        if (!bankDetailsMap.has(detail.supplierId)) {
          bankDetailsMap.set(detail.supplierId, []);
        }
        bankDetailsMap.get(detail.supplierId)!.push(detail);
      }

      return allSuppliers.map((supplier) => ({
        ...supplier,
        bankAccountDetails: bankDetailsMap.get(supplier.id) || [],
      }));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getSuppliers: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getSuppliers",
        severity: "error",
      });
      throw error;
    }
  }

  async getSuppliersPaginated(
    page: number,
    limit: number,
    search: string,
    showArchived: boolean,
  ): Promise<PaginatedResponse<SupplierWithBankDetails>> {
    try {
      const whereClauses = [];
      if (search) {
        whereClauses.push(
          or(
            ilike(suppliers.name, `%${search}%`),
            ilike(suppliers.email, `%${search}%`),
            ilike(suppliers.phone, `%${search}%`),
          ),
        );
      }
      whereClauses.push(eq(suppliers.isArchived, showArchived));

      const conditions =
        whereClauses.length > 0 ? and(...whereClauses) : undefined;

      // 1. Get total count
      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(suppliers)
        .where(conditions);
      const total = Number(totalResult[0].count);
      const totalPages = Math.ceil(total / limit);

      // 2. Fetch paginated suppliers
      const supplierData = await db
        .select()
        .from(suppliers)
        .where(conditions)
        .orderBy(suppliers.id)
        .limit(limit)
        .offset((page - 1) * limit);

      if (supplierData.length === 0) {
        return {
          data: [],
          pagination: { page, limit, total, totalPages },
        };
      }

      // 3. Fetch bank details for these suppliers
      const supplierIds = supplierData.map((s) => s.id);
      const bankDetails = await db
        .select()
        .from(supplierBankDetails)
        .where(inArray(supplierBankDetails.supplierId, supplierIds));

      // 4. Map bank details back to suppliers
      const bankDetailsMap = new Map<number, SupplierBankDetails[]>();
      for (const detail of bankDetails) {
        if (!bankDetailsMap.has(detail.supplierId)) {
          bankDetailsMap.set(detail.supplierId, []);
        }
        bankDetailsMap.get(detail.supplierId)!.push(detail);
      }

      const dataWithDetails: SupplierWithBankDetails[] = supplierData.map(
        (supplier) => {
          return {
            ...supplier,
            bankAccountDetails: bankDetailsMap.get(supplier.id) || [],
          };
        },
      );

      return {
        data: dataWithDetails,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getSuppliersPaginated: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getSuppliersPaginated",
        severity: "error",
      });
      throw error;
    }
  }

  async getSupplier(id: number): Promise<SupplierWithBankDetails | undefined> {
    try {
      const [supplierData] = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, id));

      if (!supplierData) {
        return undefined;
      }

      const bankDetails = await db
        .select()
        .from(supplierBankDetails)
        .where(eq(supplierBankDetails.supplierId, id));

      const supplierWithDetails: SupplierWithBankDetails = {
        ...supplierData,
        bankAccountDetails: bankDetails,
      };

      return supplierWithDetails;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getSupplier (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getSupplier",
        severity: "error",
      });
      throw error;
    }
  }

  async getSupplierStats(): Promise<{
    totalSuppliers: number;
    activeSuppliers: number;
    totalArchivedSuppliers: number;
  }> {
    try {
      const [stats] = await db
        .select({
          totalSuppliers: sql<number>`count(*)`,
          activeSuppliers: sql<number>`count(*) filter (where is_archived = false)`,
          totalArchivedSuppliers: sql<number>`count(*) filter (where is_archived = true)`,
        })
        .from(suppliers);

      return {
        totalSuppliers: Number(stats.totalSuppliers),
        activeSuppliers: Number(stats.activeSuppliers),
        totalArchivedSuppliers: Number(stats.totalArchivedSuppliers),
      };
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getSupplierStats: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getSupplierStats",
        severity: "error",
      });
      throw error;
    }
  }

  async createSupplier(
    supplierData: InsertSupplier,
  ): Promise<SupplierWithBankDetails> {
    try {
      const { bankAccountDetails, ...supplierInfo } = supplierData;

      const newSupplierWithDetails = await db.transaction(async (tx) => {
        const [newSupplier] = await tx
          .insert(suppliers)
          .values(supplierInfo)
          .returning();

        if (!newSupplier) {
          throw new Error("Supplier insert failed");
        }

        let newBankDetails: SupplierBankDetails[] = [];

        const cleanedBankDetails =
          bankAccountDetails?.filter(
            (detail) => detail.accountDetails?.trim() !== "",
          ) ?? [];

        if (cleanedBankDetails.length > 0) {
          const detailsToInsert = cleanedBankDetails.map((detail) => ({
            supplierId: newSupplier.id,
            accountDetails: detail.accountDetails.trim(),
          }));

          newBankDetails = await tx
            .insert(supplierBankDetails)
            .values(detailsToInsert)
            .returning();
        }

        return {
          ...newSupplier,
          bankAccountDetails: newBankDetails,
        };
      });

      return newSupplierWithDetails;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createSupplier: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createSupplier",
        severity: "error",
      });
      throw error;
    }
  }

  async updateSupplier(
    id: number,
    supplierData: Partial<InsertSupplier>,
  ): Promise<SupplierWithBankDetails | undefined> {
    try {
      const { bankAccountDetails, ...supplierInfo } = supplierData;

      const updatedSupplierWithDetails = await db.transaction(async (tx) => {
        let updatedSupplier: Supplier | undefined;
        if (Object.keys(supplierInfo).length > 0) {
          [updatedSupplier] = await tx
            .update(suppliers)
            .set(supplierInfo)
            .where(eq(suppliers.id, id))
            .returning();
        } else {
          [updatedSupplier] = await tx
            .select()
            .from(suppliers)
            .where(eq(suppliers.id, id));
        }

        if (!updatedSupplier) {
          // If the supplier doesn't exist, we can't proceed.
          // Returning null from transaction will cause db.transaction to return null.
          return null;
        }

        if (bankAccountDetails) {
          const validDetails = bankAccountDetails.filter(
            (detail) => detail.accountDetails.trim() !== "",
          );

          const existingDetails = await tx
            .select()
            .from(supplierBankDetails)
            .where(eq(supplierBankDetails.supplierId, id));
          const existingIds = existingDetails.map((d) => d.id);
          const incomingIds = validDetails
            .map((d) => d.id)
            .filter((id): id is number => !!id);

          // Delete details that are no longer present
          const toDelete = existingIds.filter(
            (id) => !incomingIds.includes(id),
          );
          if (toDelete.length > 0) {
            await tx
              .delete(supplierBankDetails)
              .where(inArray(supplierBankDetails.id, toDelete));
          }

          // Update existing and insert new details
          for (const detail of validDetails) {
            if (detail.id && existingIds.includes(detail.id)) {
              // Update existing
              await tx
                .update(supplierBankDetails)
                .set({ accountDetails: detail.accountDetails })
                .where(eq(supplierBankDetails.id, detail.id));
            } else {
              // Insert new
              await tx.insert(supplierBankDetails).values({
                supplierId: id,
                accountDetails: detail.accountDetails,
              });
            }
          }
        }

        const finalBankDetails = await tx
          .select()
          .from(supplierBankDetails)
          .where(eq(supplierBankDetails.supplierId, id));
        return { ...updatedSupplier, bankAccountDetails: finalBankDetails };
      });

      // If transaction returned null, it means supplier was not found.
      if (!updatedSupplierWithDetails) {
        return undefined;
      }

      return updatedSupplierWithDetails;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateSupplier (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateSupplier",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteSupplier(id: number): Promise<boolean> {
    try {
      const result = await db.delete(suppliers).where(eq(suppliers.id, id));
      return result.count > 0;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deleteSupplier (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteSupplier",
        severity: "error",
      });
      throw error;
    }
  }

  // Supplier Documents methods
  async getSupplierDocuments(supplierId: number): Promise<SupplierDocument[]> {
    try {
      return await db
        .select()
        .from(supplierDocuments)
        .where(eq(supplierDocuments.supplierId, supplierId))
        .orderBy(desc(supplierDocuments.createdAt));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getSupplierDocuments (supplierId: ${supplierId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getSupplierDocuments",
        severity: "error",
      });
      throw error;
    }
  }

  async createSupplierDocument(
    data: InsertSupplierDocument,
  ): Promise<SupplierDocument> {
    try {
      const result = await db
        .insert(supplierDocuments)
        .values(data)
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createSupplierDocument: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createSupplierDocument",
        severity: "error",
      });
      throw error;
    }
  }

  async updateSupplierDocument(
    id: number,
    data: Partial<InsertSupplierDocument>,
  ): Promise<SupplierDocument | null> {
    try {
      const result = await db
        .update(supplierDocuments)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(supplierDocuments.id, id))
        .returning();
      return result[0] || null;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateSupplierDocument (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateSupplierDocument",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteSupplierDocument(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(supplierDocuments)
        .where(eq(supplierDocuments.id, id))
        .returning();
      return result.length > 0;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deleteSupplierDocument (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteSupplierDocument",
        severity: "error",
      });
      throw error;
    }
  }

  async getProductsBySupplier(supplierId: number): Promise<any[]> {
    try {
      const result = await db
        .select({
          id: inventoryItems.id,
          name: inventoryItems.name,
          description: inventoryItems.description,
          category: inventoryItems.category,
          unit: inventoryItems.unit,
          currentStock: inventoryItems.currentStock,
          minStockLevel: inventoryItems.minStockLevel,
          avgCost: inventoryItems.avgCost,
          supplierPartNumber: supplierInventoryItems.supplierPartNumber,
          unitCost: supplierInventoryItems.unitCost,
          minimumOrderQuantity: supplierInventoryItems.minimumOrderQuantity,
          leadTimeDays: supplierInventoryItems.leadTimeDays,
          isPreferred: supplierInventoryItems.isPreferred,
        })
        .from(inventoryItems)
        .innerJoin(
          supplierInventoryItems,
          eq(inventoryItems.id, supplierInventoryItems.inventoryItemId),
        )
        .where(eq(supplierInventoryItems.supplierId, supplierId));

      return result;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getProductsBySupplier (supplierId: ${supplierId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getProductsBySupplier",
        severity: "error",
      });
      throw error;
    }
  }

  async getSupplierStatement(filters: {
    supplierId?: number;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: any[];
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
      hasMore: boolean;
    };
    totals: {
      debit: number;
      credit: number;
      balance: number;
    };
    priorBalance: number;
  }> {
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const offset = (page - 1) * limit;

      const conditions: any[] = [
        eq(generalLedgerEntries.accountName, "Accounts Payable"),
        eq(generalLedgerEntries.entryType, "payable"),
      ];

      if (filters.supplierId) {
        conditions.push(eq(generalLedgerEntries.entityId, filters.supplierId));
      }
      if (filters.dateFrom) {
        conditions.push(
          gte(generalLedgerEntries.transactionDate, filters.dateFrom),
        );
      }
      if (filters.dateTo) {
        // Append end-of-day time so the full dateTo day is included
        const dateToEndOfDay = filters.dateTo.includes("T")
          ? filters.dateTo
          : `${filters.dateTo}T23:59:59`;
        conditions.push(
          lte(generalLedgerEntries.transactionDate, dateToEndOfDay),
        );
      }

      const finalConditions = and(...conditions);

      // Fetch totals across the whole filtered set
      const totalsResult = await db
        .select({
          debit: sql<string>`SUM(CAST(${generalLedgerEntries.debitAmount} AS DECIMAL))`,
          credit: sql<string>`SUM(CAST(${generalLedgerEntries.creditAmount} AS DECIMAL))`,
        })
        .from(generalLedgerEntries)
        .where(finalConditions);

      const totalDebit = parseFloat(totalsResult[0]?.debit || "0");
      const totalCredit = parseFloat(totalsResult[0]?.credit || "0");

      // Fetch count
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(generalLedgerEntries)
        .where(finalConditions);
      const totalCount = Number(countResult[0]?.count || 0);
      const totalPages = Math.ceil(totalCount / limit);

      // Compute the cumulative balance for all rows that come BEFORE this page
      // so the frontend can start the running balance from the correct opening figure
      let priorBalance = 0;
      if (offset > 0) {
        const priorRows = await db
          .select({
            debit: generalLedgerEntries.debitAmount,
            credit: generalLedgerEntries.creditAmount,
          })
          .from(generalLedgerEntries)
          .where(finalConditions)
          .orderBy(
            asc(generalLedgerEntries.transactionDate),
            asc(generalLedgerEntries.id),
          )
          .limit(offset);

        // AP convention: credit = invoice (increases payable), debit = payment/reversal (reduces payable)
        // Outstanding balance = credit - debit (positive = you owe the supplier)
        priorBalance = priorRows.reduce(
          (sum, row) =>
            sum + parseFloat(row.credit || "0") - parseFloat(row.debit || "0"),
          0,
        );
      }

      // Fetch current page data
      const data = await db
        .select({
          id: generalLedgerEntries.id,
          date: generalLedgerEntries.transactionDate,
          type: generalLedgerEntries.referenceType,
          reference: generalLedgerEntries.invoiceNumber,
          description: generalLedgerEntries.description,
          debit: generalLedgerEntries.debitAmount,
          credit: generalLedgerEntries.creditAmount,
          supplierId: generalLedgerEntries.entityId,
          supplierName: generalLedgerEntries.entityName,
        })
        .from(generalLedgerEntries)
        .where(finalConditions)
        .orderBy(
          asc(generalLedgerEntries.transactionDate),
          asc(generalLedgerEntries.id),
        )
        .limit(limit)
        .offset(offset);

      return {
        data: data.map((t) => ({
          ...t,
          debit: parseFloat(t.debit || "0"),
          credit: parseFloat(t.credit || "0"),
        })),
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasMore: page < totalPages,
        },
        totals: {
          debit: totalDebit,
          credit: totalCredit,
          // AP convention: outstanding balance = credit - debit (positive = owed to supplier)
          balance: totalCredit - totalDebit,
        },
        priorBalance,
      };
    } catch (error) {
      console.error("Error in getSupplierStatement:", error);
      throw error;
    }
  }
}
