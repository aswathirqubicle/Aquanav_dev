import { UserStorage } from "./user";
import {
  Customer,
  CustomerDocument,
  InsertCustomer,
  InsertCustomerDocument,
  customerDocuments,
  customers,
  generalLedgerEntries,
  projects,
} from "@shared/schema";
import { PaginatedResponse } from "./types";
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  gte,
  ilike,
  isNotNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { db } from "../db";

export class CustomerStorage extends UserStorage {
  // Customer methods
  async getCustomers(): Promise<Customer[]> {
    try {
      return await db.select().from(customers);
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getCustomers: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getCustomers",
        severity: "error",
      });
      throw error;
    }
  }

  async getCustomersPaginated(
    page: number,
    limit: number,
    search: string,
    showArchived: boolean,
  ): Promise<PaginatedResponse<Customer>> {
    try {
      const whereClauses = [];
      if (search) {
        whereClauses.push(
          or(
            ilike(customers.name, `%${search}%`),
            ilike(customers.email, `%${search}%`),
            ilike(customers.phone, `%${search}%`),
          ),
        );
      }
      whereClauses.push(eq(customers.isArchived, showArchived));

      const conditions =
        whereClauses.length > 0 ? and(...whereClauses) : undefined;

      const customerColumns = getTableColumns(customers);

      const dataQueryBuilder = db
        .select({
          ...customerColumns,
          projectCount: sql<number>`COUNT(${projects.id})`.as("projectCount"),
        })
        .from(customers)
        .leftJoin(projects, eq(projects.customerId, customers.id))
        .where(conditions)
        .groupBy(customers.id)
        .orderBy(customers.id);

      // Note: original count query had a simpler where clause `eq(customers.isArchived, showArchived)`
      // This should ideally be consistent. For now, using the combined `conditions` for count.
      const countQueryBuilder = db
        .select({ count: sql<number>`count(*)` })
        .from(customers)
        .where(conditions);

      return this._getPaginatedResults<Customer>(
        dataQueryBuilder,
        countQueryBuilder,
        page,
        limit,
      );
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getCustomersPaginated: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getCustomersPaginated",
        severity: "error",
      });
      throw error;
    }
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    try {
      const result = await db
        .select()
        .from(customers)
        .where(eq(customers.id, id))
        .limit(1);
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getCustomer (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getCustomer",
        severity: "error",
      });
      throw error;
    }
  }

  async getCustomerStats(): Promise<{
    totalCustomers: number;
    activeCustomers: number;
    totalProjects: number;
    totalArchivedCustomers: number;
  }> {
    try {
      const [customerStats] = await db
        .select({
          totalCustomers: sql<number>`count(*)`,
          activeCustomers: sql<number>`count(*) filter (where is_archived = false)`,
          totalArchivedCustomers: sql<number>`count(*) filter (where is_archived = true)`,
        })
        .from(customers);

      const [projectStats] = await db
        .select({ count: sql<number>`count(*)` })
        .from(projects)
        .where(isNotNull(projects.customerId));

      return {
        totalCustomers: Number(customerStats.totalCustomers),
        activeCustomers: Number(customerStats.activeCustomers),
        totalProjects: Number(projectStats.count),
        totalArchivedCustomers: Number(customerStats.totalArchivedCustomers),
      };
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getCustomerStats: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getCustomerStats",
        severity: "error",
      });
      throw error;
    }
  }

  async createCustomer(customerData: InsertCustomer): Promise<Customer> {
    try {
      if (customerData.phone && customerData.phone.trim() !== "") {
        const existing = await db
          .select()
          .from(customers)
          .where(eq(customers.phone, customerData.phone));

        if (existing.length > 0) {
          throw new Error(
            `Customer with phone ${customerData.phone} already exists`,
          );
        }
      }

      const result = await db
        .insert(customers)
        .values(customerData)
        .returning();

      const customer = result[0];

      // Create general ledger account for the customer
      // await this.createGeneralLedgerEntry({
      //   entryType: "receivable",
      //   referenceType: "manual",
      //   accountName: `Customer: ${customer.name}`,
      //   description: `Customer account created: ${customer.name}`,
      //   debitAmount: "0",
      //   creditAmount: "0",
      //   entityId: customer.id,
      //   entityName: customer.name,
      //   transactionDate: new Date().toISOString().split("T")[0],
      //   status: "active",
      // });

      return customer;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createCustomer: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createCustomer",
        severity: "error",
      });
      throw error;
    }
  }

  async updateCustomer(
    id: number,
    customerData: Partial<InsertCustomer>,
  ): Promise<Customer | undefined> {
    try {
      if (customerData.phone && customerData.phone.trim() !== "") {
        const existing = await db
          .select()
          .from(customers)
          .where(
            and(eq(customers.phone, customerData.phone), ne(customers.id, id)),
          );

        if (existing.length > 0) {
          throw new Error(
            `Customer with phone ${customerData.phone} already exists`,
          );
        }
      }
      const result = await db
        .update(customers)
        .set(customerData)
        .where(eq(customers.id, id))
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateCustomer (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateCustomer",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteCustomer(id: number): Promise<boolean> {
    try {
      const result = await db.delete(customers).where(eq(customers.id, id));
      return result.rowCount > 0;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deleteCustomer (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteCustomer",
        severity: "error",
      });
      throw error;
    }
  }

  // Customer Documents methods
  async getCustomerDocuments(customerId: number): Promise<CustomerDocument[]> {
    try {
      return await db
        .select()
        .from(customerDocuments)
        .where(eq(customerDocuments.customerId, customerId))
        .orderBy(desc(customerDocuments.createdAt));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getCustomerDocuments (customerId: ${customerId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getCustomerDocuments",
        severity: "error",
      });
      throw error;
    }
  }

  async createCustomerDocument(
    data: InsertCustomerDocument,
  ): Promise<CustomerDocument> {
    try {
      const result = await db
        .insert(customerDocuments)
        .values(data)
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createCustomerDocument: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createCustomerDocument",
        severity: "error",
      });
      throw error;
    }
  }

  async updateCustomerDocument(
    id: number,
    data: Partial<InsertCustomerDocument>,
  ): Promise<CustomerDocument | null> {
    try {
      const result = await db
        .update(customerDocuments)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(customerDocuments.id, id))
        .returning();
      return result[0] || null;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateCustomerDocument (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateCustomerDocument",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteCustomerDocument(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(customerDocuments)
        .where(eq(customerDocuments.id, id))
        .returning();
      return result.length > 0;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deleteCustomerDocument (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteCustomerDocument",
        severity: "error",
      });
      throw error;
    }
  }

  async getCustomerStatement(filters: {
    customerId?: number;
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
        eq(generalLedgerEntries.accountName, "Accounts Receivable"),
        eq(generalLedgerEntries.entryType, "receivable"),
      ];

      if (filters.customerId) {
        conditions.push(eq(generalLedgerEntries.entityId, filters.customerId));
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

        priorBalance = priorRows.reduce(
          (sum, row) =>
            sum + parseFloat(row.debit || "0") - parseFloat(row.credit || "0"),
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
          customerId: generalLedgerEntries.entityId,
          customerName: generalLedgerEntries.entityName,
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
          balance: totalDebit - totalCredit,
        },
        priorBalance,
      };
    } catch (error) {
      console.error("Error in getCustomerStatement:", error);
      throw error;
    }
  }
}
