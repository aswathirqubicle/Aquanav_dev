import { db } from "./db";
import {
  eq,
  desc,
  sql,
  and,
  gte,
  lte,
  isNull,
  isNotNull,
  or,
  ilike,
  ne,
  inArray,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  users,
  companies,
  customers,
  suppliers,
  employees,
  employeeNextOfKin,
  employeeTrainingRecords,
  employeeDocuments,
  projects,
  projectEmployees,
  inventoryItems,
  inventoryTransactions,
  assetTypes,
  assetInventoryInstances,
  assetInventoryMaintenanceRecords,
  assetInventoryMaintenanceFiles,
  dailyActivities,
  projectPhotoGroups,
  projectPhotos,
  payrollEntries,
  payrollAdditions,
  payrollDeductions,
  salesQuotations,
  salesInvoices,
  supplierInventoryItems,
  projectConsumables,
  projectConsumableItems,
  purchaseRequests,
  purchaseRequestItems,
  purchaseOrders,
  purchaseOrderItems,
  purchaseInvoices,
  purchaseInvoiceItems,
  purchaseCreditNotes,
  purchaseInvoicePayments,
  errorLogs,
  invoicePayments,
  projectAssetAssignments,
  projectAssetInstanceAssignments,
  paymentFiles,
  proformaInvoices,
  creditNotes,
  generalLedgerEntries,
  customerDocuments,
  supplierDocuments,
  type User,
  type InsertUser,
  type Company,
  type InsertCompany,
  type Customer,
  type InsertCustomer,
  type Employee,
  type InsertEmployee,
  type insertAssetInventoryMaintenanceRecords,
  type EmployeeNextOfKin,
  type InsertEmployeeNextOfKin,
  type EmployeeTrainingRecord,
  type InsertEmployeeTrainingRecord,
  type EmployeeDocument,
  type InsertEmployeeDocument,
  type CustomerDocument,
  type InsertCustomerDocument,
  type SupplierDocument,
  type InsertSupplierDocument,
  type Project,
  type InsertProject,
  type InventoryItem,
  type InsertInventoryItem,
  type DailyActivity,
  type InsertDailyActivity,
  type Supplier,
  type InsertSupplier,
  type SupplierInventoryItem,
  type InsertSupplierInventoryItem,
  type ProjectPhotoGroup,
  type InsertProjectPhotoGroup,
  type ProjectPhoto,
  type InsertProjectPhoto,
  type ProjectConsumable,
  type InsertProjectConsumable,
  type ProjectConsumableItem,
  type InsertProjectConsumableItem,
  type SalesQuotation,
  type InsertSalesQuotation,
  type SalesQuotationItem,
  type InsertSalesQuotationItem,
  type SalesInvoice,
  type InsertSalesInvoice,
  type CreditNote, // Added for createInvoicePaymentForCreditNote
  type InsertCreditNote, // Added for create/updateCreditNote
  type PayrollEntry,
  type InsertPayrollEntry,
  type PayrollAddition,
  type InsertPayrollAddition,
  type PayrollDeduction,
  type InsertPayrollDeduction,
  type InvoicePayment,
  type insertAssetInventoryMaintenanceRecord,
  type InsertInvoicePayment,
  type PaymentFile, // Ensure PaymentFile is imported
  type ErrorLog, // Will be used later
  type AssetType,
  type InsertAssetType,
} from "@shared/schema";
import bcrypt from "bcrypt";
import fs from "fs/promises";

// Helper type for count results
type CountResult = { count: number };

// Generic Paginated Response Type
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// For getAssetMaintenanceRecords and getAllAssetMaintenanceRecords
export interface AssetMaintenanceRecordWithUser {
  id: number;
  instanceId: number;
  maintenanceCost: string;
  maintenanceDate: Date;
  startDate: Date;
  completedDate: Date;
  maintenanceType: string | null;
  description: string | null;
  performedBy: number | null;
  createdAt: Date;
  performedByName?: string | null;
}

// For createAssetMaintenanceRecord data parameter
// export interface CreateAssetMaintenanceRecordData {
//   assetId: number;
//   maintenanceCost: string;
//   description?: string | null;
//   maintenanceDate?: Date;
//   performedBy?: number | null;
// }

// For createPaymentFile data parameter
export interface CreatePaymentFileData {
  paymentId: number;
  fileName: string;
  originalName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
}

// For assignEmployeesToProject assignments parameter
export interface AssignEmployeeData {
  employeeId: number;
  startDate?: string;
  endDate?: string;
}

// For getPlannedActivities return type and savePlannedActivities parameter
export interface PlannedActivityItem {
  location: string;
  tasks: string;
  date: string;
  remarks?: string | null;
}

// For getSalesQuotationsPaginated return type
export interface SalesQuotationWithCustomerName extends SalesQuotation {
  customerName: string | null;
}

// For getProjectAssetAssignments return type
export interface ProjectAssetAssignmentWithAssetInfo
  extends ProjectAssetAssignment {
  assetName: string | null;
  assetCode: string | null;
}

// For getAssetAssignmentHistory return type
export interface AssetAssignmentHistoryEntry extends ProjectAssetAssignment {
  projectTitle: string | null;
}

// For getAllAssetAssignments return type
export interface AllAssetAssignmentsEntry extends ProjectAssetAssignment {
  projectTitle: string | null;
  assetName: string | null;
  assetCode: string | null;
}

// For getProjectConsumables return type
export interface ProjectConsumableItemWithDetails
  extends ProjectConsumableItem {
  itemName: string | null;
  itemUnit: string | null;
}

export interface ProjectConsumableWithItems extends ProjectConsumable {
  createdByName: string | null;
  items: ProjectConsumableItemWithDetails[];
}

// For createProjectConsumables items parameter
export interface CreateProjectConsumableItemInput {
  inventoryItemId: number;
  quantity: number;
}

// For createProjectConsumables return type
export interface CreatedProjectConsumable extends ProjectConsumable {
  items: ProjectConsumableItem[];
}

// For Payroll methods - getPayrollEntries, generateMonthlyPayroll
export interface PayrollEntryEmployeeDetails {
  id: number;
  firstName: string | null;
  lastName: string | null;
  employeeCode: string | null;
}

export interface PayrollEntryWithEmployeeDetails extends PayrollEntry {
  employee?: PayrollEntryEmployeeDetails;
}

// For Goods Receipt methods
export interface GoodsReceiptItemInput {
  inventoryItemId: number;
  quantity: number;
  unitCost: number;
}

export interface GoodsReceiptItemDetails {
  inventoryItemName: string | null;
  quantity: number;
  unit: string | null;
  unitCost: string | null; // Based on inventory_transactions.unitCost which is decimal
}

export interface GoodsReceiptDetails {
  id: number; // transactionId
  reference: string | null;
  timestamp: Date; // or string if that's how it's used
  projectId: number | null; // Was null in original SQL for getGoodsReceipts
  projectTitle: string | null; // Was null in original SQL
  createdByName: string | null;
  items: GoodsReceiptItemDetails[];
}

// For createGoodsReceipt return type
export interface CreatedGoodsReceiptItem {
  inventoryTransactionId: number;
  inventoryItemId: number;
  quantity: number;
  unitCost: string | null; // Matches inventory_transactions.unitCost
}

export interface CreatedGoodsReceipt {
  reference: string | null;
  items: CreatedGoodsReceiptItem[];
  date: string; // ISO date string
}

// For getProjectRevenue's invoicePayments array
export interface InvoicePaymentWithCustomerName extends InvoicePayment {
  customerName: string | null;
}

// For getCreditNotes return type
// This was defined twice, removing duplicate
// export interface CreditNoteWithDetails extends CreditNote {
// customerName: string | null;
// invoiceNumber: string | null;
// }

// For getCreditNotes return type (ensure it's here or correctly placed)
export interface CreditNoteWithDetails extends CreditNote {
  customerName: string | null;
  invoiceNumber: string | null;
}

class Storage {
  private _cleanDateValue(value: any): Date | null | undefined {
    // Test comment
    if (value === null || value === "") {
      return null;
    }
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? undefined : value;
    }
    if (typeof value === "string") {
      const parsedDate = new Date(value);
      return isNaN(parsedDate.getTime()) ? undefined : parsedDate;
    }
    return undefined;
  }

  private async _getPaginatedResults<TData>(
    dataQueryBuilder: Select,
    countQueryBuilder: Select<CountResult>,
    page: number,
    limit: number
  ): Promise<PaginatedResponse<TData>> {
    try {
      const totalResult = await countQueryBuilder;
      const total = Number(totalResult[0].count);
      const totalPages = Math.ceil(total / limit);

      // The dataQueryBuilder should already have conditions and ordering applied.
      // We just add limit and offset here.
      const data = await dataQueryBuilder
        .limit(limit)
        .offset((page - 1) * limit);

      return {
        data: data as TData[], // We cast here, assuming TData is the correct shape
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      console.error("Error in _getPaginatedResults:", error);
      throw error;
    }
  }

  // User methods
  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);
      return result[0];
    } catch (error: any) {
      // Log to console only to avoid recursive database errors
      console.error("Error in getUserByUsername:", error);
      throw error;
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    try {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getUser (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getUser",
        severity: "error",
      });
      throw error;
    }
  }

  async getUsers(): Promise<User[]> {
    try {
      return await db.select().from(users);
    } catch (error: any) {
      await this.createErrorLog({
        message: "Error in getUsers: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getUsers",
        severity: "error",
      });
      throw error;
    }
  }

  async createUser(userData: InsertUser): Promise<User> {
    try {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const result = await db
        .insert(users)
        .values({
          ...userData,
          password: hashedPassword,
        })
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message: "Error in createUser: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createUser",
        severity: "error",
        // Optionally log parts of userData, but be careful with sensitive info
      });
      throw error;
    }
  }

  async updateUser(
    id: number,
    userData: Partial<InsertUser>
  ): Promise<User | undefined> {
    try {
      const result = await db
        .update(users)
        .set(userData)
        .where(eq(users.id, id))
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateUser (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateUser",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteUser(id: number): Promise<boolean> {
    try {
      const result = await db.delete(users).where(eq(users.id, id)).returning();
      return result.length > 0;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deleteUser (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteUser",
        severity: "error",
      });
      throw error;
    }
  }

  // Company methods
  async getCompany(): Promise<Company | undefined> {
    try {
      const result = await db.select().from(companies).limit(1);
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message: "Error in getCompany: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getCompany",
        severity: "error",
      });
      throw error;
    }
  }

  async updateCompany(companyData: InsertCompany): Promise<Company> {
    try {
      const existing = await this.getCompany();
      if (existing) {
        const result = await db
          .update(companies)
          .set(companyData)
          .where(eq(companies.id, existing.id))
          .returning();
        return result[0];
      } else {
        const result = await db
          .insert(companies)
          .values(companyData)
          .returning();
        return result[0];
      }
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in updateCompany: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateCompany",
        severity: "error",
      });
      throw error;
    }
  }

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
    showArchived: boolean
  ): Promise<PaginatedResponse<Customer>> {
    try {
      const whereClauses = [];
      if (search) {
        whereClauses.push(ilike(customers.name, `%${search}%`));
      }
      whereClauses.push(eq(customers.isArchived, showArchived));

      const conditions =
        whereClauses.length > 0 ? and(...whereClauses) : undefined;

      const dataQueryBuilder = db
        .select()
        .from(customers)
        .where(conditions)
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
        limit
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

  async createCustomer(customerData: InsertCustomer): Promise<Customer> {
    try {
      if (customerData.phone && customerData.phone.trim() !== "") {
        const existing = await db
          .select()
          .from(customers)
          .where(eq(customers.phone, customerData.phone));

        if (existing.length > 0) {
          throw new Error(
            `Customer with phone ${customerData.phone} already exists`
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
    customerData: Partial<InsertCustomer>
  ): Promise<Customer | undefined> {
    try {
      if (customerData.phone && customerData.phone.trim() !== "") {
        const existing = await db
          .select()
          .from(customers)
          .where(
            and(eq(customers.phone, customerData.phone), ne(customers.id, id))
          );

        if (existing.length > 0) {
          throw new Error(
            `Customer with phone ${customerData.phone} already exists`
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

  // Supplier methods
  async getSuppliers(): Promise<Supplier[]> {
    try {
      return await db.select().from(suppliers);
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
    showArchived: boolean
  ): Promise<PaginatedResponse<Supplier>> {
    try {
      const whereClauses = [];
      if (search) {
        whereClauses.push(ilike(suppliers.name, `%${search}%`));
      }
      whereClauses.push(eq(suppliers.isArchived, showArchived));

      const conditions =
        whereClauses.length > 0 ? and(...whereClauses) : undefined;

      const dataQueryBuilder = db
        .select()
        .from(suppliers)
        .where(conditions)
        .orderBy(suppliers.id);
      // Original count query for suppliers also only filtered by showArchived.
      // Sticking to applying all conditions for count for consistency in the helper.
      const countQueryBuilder = db
        .select({ count: sql<number>`count(*)` })
        .from(suppliers)
        .where(conditions);

      return this._getPaginatedResults<Supplier>(
        dataQueryBuilder,
        countQueryBuilder,
        page,
        limit
      );
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

  async getSupplier(id: number): Promise<Supplier | undefined> {
    try {
      const result = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, id))
        .limit(1);
      return result[0];
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

  async createSupplier(supplierData: InsertSupplier): Promise<Supplier> {
    try {
      const result = await db
        .insert(suppliers)
        .values(supplierData)
        .returning();

      const supplier = result[0];

      // Create general ledger account for the supplier
      // await this.createGeneralLedgerEntry({
      //   entryType: "payable",
      //   referenceType: "manual",
      //   accountName: `Supplier: ${supplier.name}`,
      //   description: `Supplier account created: ${supplier.name}`,
      //   debitAmount: "0",
      //   creditAmount: "0",
      //   entityId: supplier.id,
      //   entityName: supplier.name,
      //   transactionDate: new Date().toISOString().split("T")[0],
      //   status: "active",
      // });

      return supplier;
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
    supplierData: Partial<InsertSupplier>
  ): Promise<Supplier | undefined> {
    try {
      const result = await db
        .update(suppliers)
        .set(supplierData)
        .where(eq(suppliers.id, id))
        .returning();
      return result[0];
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
      return result.rowCount > 0;
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
    data: InsertCustomerDocument
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
    data: Partial<InsertCustomerDocument>
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
    data: InsertSupplierDocument
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
    data: Partial<InsertSupplierDocument>
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

  // Employee methods
  async getEmployees(): Promise<Employee[]> {
    try {
      return await db.select().from(employees);
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getEmployees: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getEmployees",
        severity: "error",
      });
      throw error;
    }
  }

  async createEmployee(employeeData: InsertEmployee): Promise<Employee> {
    try {
      const result = await db
        .insert(employees)
        .values(employeeData)
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createEmployee: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createEmployee",
        severity: "error",
      });
      throw error;
    }
  }

  async updateEmployee(
    id: number,
    employeeData: Partial<InsertEmployee>
  ): Promise<Employee | undefined> {
    try {
      const result = await db
        .update(employees)
        .set(employeeData)
        .where(eq(employees.id, id))
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateEmployee (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateEmployee",
        severity: "error",
      });
      throw error;
    }
  }

  async getEmployee(id: number): Promise<Employee | undefined> {
    try {
      const result = await db
        .select()
        .from(employees)
        .where(eq(employees.id, id));
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getEmployee (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getEmployee",
        severity: "error",
      });
      throw error;
    }
  }

  // Employee Next of Kin methods
  async getEmployeeNextOfKin(employeeId: number): Promise<EmployeeNextOfKin[]> {
    try {
      return await db
        .select()
        .from(employeeNextOfKin)
        .where(eq(employeeNextOfKin.employeeId, employeeId));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getEmployeeNextOfKin (employeeId: ${employeeId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getEmployeeNextOfKin",
        severity: "error",
      });
      throw error;
    }
  }

  async createEmployeeNextOfKin(
    data: InsertEmployeeNextOfKin
  ): Promise<EmployeeNextOfKin> {
    try {
      const result = await db
        .insert(employeeNextOfKin)
        .values(data)
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createEmployeeNextOfKin: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createEmployeeNextOfKin",
        severity: "error",
      });
      throw error;
    }
  }

  async updateEmployeeNextOfKin(
    id: number,
    data: Partial<InsertEmployeeNextOfKin>
  ): Promise<EmployeeNextOfKin | undefined> {
    try {
      const result = await db
        .update(employeeNextOfKin)
        .set(data)
        .where(eq(employeeNextOfKin.id, id))
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateEmployeeNextOfKin (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateEmployeeNextOfKin",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteEmployeeNextOfKin(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(employeeNextOfKin)
        .where(eq(employeeNextOfKin.id, id));
      return result.rowCount > 0;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deleteEmployeeNextOfKin (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteEmployeeNextOfKin",
        severity: "error",
      });
      throw error;
    }
  }

  // Employee Training Records methods
  async getEmployeeTrainingRecords(
    employeeId: number
  ): Promise<EmployeeTrainingRecord[]> {
    try {
      return await db
        .select()
        .from(employeeTrainingRecords)
        .where(eq(employeeTrainingRecords.employeeId, employeeId))
        .orderBy(desc(employeeTrainingRecords.trainingDate));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getEmployeeTrainingRecords (employeeId: ${employeeId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getEmployeeTrainingRecords",
        severity: "error",
      });
      throw error;
    }
  }

  async createEmployeeTrainingRecord(
    data: InsertEmployeeTrainingRecord
  ): Promise<EmployeeTrainingRecord> {
    console.log(data);
    try {
      const normalizedData = {
        ...data,
        trainingDate:
          data.trainingDate instanceof Date
            ? data.trainingDate.toISOString().split("T")[0]
            : data.trainingDate,

        expiryDate:
          data.expiryDate instanceof Date
            ? data.expiryDate.toISOString().split("T")[0]
            : data.expiryDate ?? null,
      };
      const result = await db
        .insert(employeeTrainingRecords)
        .values(normalizedData)
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createEmployeeTrainingRecord: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createEmployeeTrainingRecord",
        severity: "error",
      });
      throw error;
    }
  }

  async updateEmployeeTrainingRecord(
    id: number,
    data: Partial<InsertEmployeeTrainingRecord>
  ): Promise<EmployeeTrainingRecord | undefined> {
    try {
      const result = await db
        .update(employeeTrainingRecords)
        .set(data)
        .where(eq(employeeTrainingRecords.id, id))
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateEmployeeTrainingRecord (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateEmployeeTrainingRecord",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteEmployeeTrainingRecord(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(employeeTrainingRecords)
        .where(eq(employeeTrainingRecords.id, id));
      return result.rowCount > 0;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deleteEmployeeTrainingRecord (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteEmployeeTrainingRecord",
        severity: "error",
      });
      throw error;
    }
  }

  async getExpiringDocuments(daysAhead: number = 30): Promise<{
    visas: Array<
      Employee & {
        documentType: string;
        expiryDate: string;
        daysToExpiry: number;
      }
    >;
    trainings: Array<
      EmployeeTrainingRecord & { employee: Employee; daysToExpiry: number }
    >;
  }> {
    try {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysAhead);

      // Get expiring visas
      const employeesWithExpiringVisas = await db
        .select()
        .from(employees)
        .where(
          or(
            and(
              eq(employees.usVisaStatus, "valid"),
              lte(
                employees.usVisaExpiryDate,
                targetDate.toISOString().split("T")[0]
              )
            ),
            and(
              eq(employees.schengenVisaStatus, "valid"),
              lte(
                employees.schengenVisaExpiryDate,
                targetDate.toISOString().split("T")[0]
              )
            )
          )
        );

      // Get expiring training records
      const expiringTrainings = await db
        .select({
          training: employeeTrainingRecords,
          employee: employees,
        })
        .from(employeeTrainingRecords)
        .leftJoin(
          employees,
          eq(employeeTrainingRecords.employeeId, employees.id)
        )
        .where(
          and(
            eq(employeeTrainingRecords.status, "active"),
            isNotNull(employeeTrainingRecords.expiryDate),
            lte(
              employeeTrainingRecords.expiryDate,
              targetDate.toISOString().split("T")[0]
            )
          )
        );

      // Transform data to include days to expiry
      const visas = employeesWithExpiringVisas.flatMap((emp) => {
        const results = [];
        if (emp.usVisaStatus === "valid" && emp.usVisaExpiryDate) {
          const daysToExpiry = Math.ceil(
            (new Date(emp.usVisaExpiryDate).getTime() - new Date().getTime()) /
              (1000 * 60 * 60 * 24)
          );
          results.push({
            ...emp,
            documentType: "US Visa",
            expiryDate: emp.usVisaExpiryDate,
            daysToExpiry,
          });
        }
        if (emp.schengenVisaStatus === "valid" && emp.schengenVisaExpiryDate) {
          const daysToExpiry = Math.ceil(
            (new Date(emp.schengenVisaExpiryDate).getTime() -
              new Date().getTime()) /
              (1000 * 60 * 60 * 24)
          );
          results.push({
            ...emp,
            documentType: "Schengen Visa",
            expiryDate: emp.schengenVisaExpiryDate,
            daysToExpiry,
          });
        }
        return results;
      });

      const trainings = expiringTrainings.map(({ training, employee }) => {
        const daysToExpiry = Math.ceil(
          (new Date(training.expiryDate!).getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24)
        );
        return {
          ...training,
          employee: employee!,
          daysToExpiry,
        };
      });

      return { visas, trainings };
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getExpiringDocuments: ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getExpiringDocuments",
        severity: "error",
      });
      throw error;
    }
  }

  async generateEmploymentContract(employeeId: number): Promise<string> {
    try {
      const employee = await this.getEmployee(employeeId);
      if (!employee) {
        throw new Error("Employee not found");
      }

      // UAE Employment Contract Template
      const contractTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Employment Contract - ${employee.firstName} ${
        employee.lastName
      }</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .title { font-size: 18px; font-weight: bold; text-decoration: underline; }
        .section { margin: 20px 0; }
        .signature-section { margin-top: 50px; display: flex; justify-content: space-between; }
        .signature-box { width: 200px; text-align: center; }
        .signature-line { border-bottom: 1px solid #000; margin-bottom: 5px; height: 40px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #000; padding: 8px; text-align: left; }
        th { background-color: #f0f0f0; }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">EMPLOYMENT CONTRACT</div>
        <p><strong>UNITED ARAB EMIRATES</strong></p>
    </div>

    <div class="section">
        <p>This Employment Contract is entered into between:</p>
        
        <table>
            <tr>
                <th>EMPLOYER</th>
                <td>
                    <strong>AQUANAV MARINE ENGINEERING LLC</strong><br>
                    Address: [Company Address]<br>
                    P.O. Box: [P.O. Box]<br>
                    UAE
                </td>
            </tr>
            <tr>
                <th>EMPLOYEE</th>
                <td>
                    <strong>${employee.firstName} ${
        employee.lastName
      }</strong><br>
                    Employee ID: ${employee.employeeCode}<br>
                    ${employee.grade ? `Grade: ${employee.grade}<br>` : ""}
                    Position: ${employee.position || "Marine Engineer"}<br>
                    Department: ${employee.department || "Engineering"}
                </td>
            </tr>
        </table>
    </div>

    <div class="section">
        <h3>ARTICLE 1: EMPLOYMENT TERMS</h3>
        <p>The Employer hereby employs the Employee and the Employee accepts employment under the terms and conditions set forth in this contract.</p>
        
        <table>
            <tr>
                <th>Position/Job Title</th>
                <td>${employee.position || "Marine Engineer"}</td>
            </tr>
            <tr>
                <th>Department</th>
                <td>${employee.department || "Engineering"}</td>
            </tr>
            ${
              employee.grade
                ? `
            <tr>
                <th>Employee Grade</th>
                <td>${employee.grade}</td>
            </tr>
            `
                : ""
            }
            <tr>
                <th>Start Date</th>
                <td>${
                  employee.hireDate
                    ? new Date(employee.hireDate).toLocaleDateString()
                    : "[To be filled]"
                }</td>
            </tr>
            <tr>
                <th>Contract Duration</th>
                <td>2 Years (Renewable)</td>
            </tr>
        </table>
    </div>

    <div class="section">
        <h3>ARTICLE 2: SALARY AND BENEFITS</h3>
        <table>
            <tr>
                <th>Basic Salary</th>
                <td>AED ${
                  employee.salary
                    ? parseFloat(employee.salary).toLocaleString()
                    : "[To be filled]"
                } per month</td>
            </tr>
            <tr>
                <th>Housing Allowance</th>
                <td>As per UAE Labor Law</td>
            </tr>
            <tr>
                <th>Transportation</th>
                <td>As per company policy</td>
            </tr>
            <tr>
                <th>Annual Leave</th>
                <td>30 days per year</td>
            </tr>
            <tr>
                <th>Sick Leave</th>
                <td>As per UAE Labor Law</td>
            </tr>
        </table>
    </div>

    <div class="section">
        <h3>ARTICLE 3: WORKING HOURS</h3>
        <p>The Employee shall work 8 hours per day, 6 days per week, with Friday as the weekly rest day, unless otherwise required by business needs.</p>
    </div>

    <div class="section">
        <h3>ARTICLE 4: DUTIES AND RESPONSIBILITIES</h3>
        <p>The Employee shall:</p>
        <ul>
            <li>Perform all duties assigned by the Employer with diligence and professionalism</li>
            <li>Comply with all company policies, procedures, and safety regulations</li>
            <li>Maintain confidentiality of company information</li>
            <li>Report to work punctually and regularly</li>
        </ul>
    </div>

    <div class="section">
        <h3>ARTICLE 5: TERMINATION</h3>
        <p>This contract may be terminated by either party with 30 days written notice or as per UAE Labor Law provisions.</p>
    </div>

    <div class="section">
        <h3>ARTICLE 6: GOVERNING LAW</h3>
        <p>This contract shall be governed by and construed in accordance with the laws of the United Arab Emirates.</p>
    </div>

    <div class="signature-section">
        <div class="signature-box">
            <div class="signature-line"></div>
            <p><strong>EMPLOYER</strong><br>
            Aquanav Marine Engineering LLC<br>
            Date: _____________</p>
        </div>
        
        <div class="signature-box">
            <div class="signature-line"></div>
            <p><strong>EMPLOYEE</strong><br>
            ${employee.firstName} ${employee.lastName}<br>
            Date: _____________</p>
        </div>
    </div>

    <div class="section" style="margin-top: 50px;">
        <p><small>
            This contract is prepared in accordance with UAE Federal Law No. 8 of 1980 (UAE Labor Law) 
            and its amendments. Both parties acknowledge they have read, understood, and agree to be bound by the terms herein.
        </small></p>
    </div>
</body>
</html>
      `;

      return contractTemplate;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in generateEmploymentContract (employeeId: ${employeeId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "generateEmploymentContract",
        severity: "error",
      });
      throw error;
    }
  }

  // Employee Documents CRUD operations
  async getEmployeeDocuments(employeeId: number): Promise<EmployeeDocument[]> {
    try {
      return await db
        .select()
        .from(employeeDocuments)
        .where(eq(employeeDocuments.employeeId, employeeId))
        .orderBy(desc(employeeDocuments.createdAt));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getEmployeeDocuments (employeeId: ${employeeId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getEmployeeDocuments",
        severity: "error",
      });
      throw error;
    }
  }

  async createEmployeeDocument(
    data: InsertEmployeeDocument
  ): Promise<EmployeeDocument> {
    try {
      const result = await db
        .insert(employeeDocuments)
        .values(data)
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in createEmployeeDocument: ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createEmployeeDocument",
        severity: "error",
      });
      throw error;
    }
  }

  async updateEmployeeDocument(
    id: number,
    data: Partial<InsertEmployeeDocument>
  ): Promise<EmployeeDocument | null> {
    try {
      const result = await db
        .update(employeeDocuments)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(employeeDocuments.id, id))
        .returning();
      return result[0] || null;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateEmployeeDocument (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateEmployeeDocument",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteEmployeeDocument(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(employeeDocuments)
        .where(eq(employeeDocuments.id, id));
      return result.rowCount > 0;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deleteEmployeeDocument (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteEmployeeDocument",
        severity: "error",
      });
      throw error;
    }
  }

  async getExpiringEmployeeDocuments(
    daysAhead: number = 30
  ): Promise<
    Array<EmployeeDocument & { employee: Employee; daysToExpiry: number }>
  > {
    try {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysAhead);

      const result = await db
        .select({
          document: employeeDocuments,
          employee: employees,
        })
        .from(employeeDocuments)
        .leftJoin(employees, eq(employeeDocuments.employeeId, employees.id))
        .where(
          and(
            eq(employeeDocuments.status, "active"),
            or(
              lte(
                employeeDocuments.expiryDate,
                targetDate.toISOString().split("T")[0]
              ),
              lte(
                employeeDocuments.validTill,
                targetDate.toISOString().split("T")[0]
              )
            )
          )
        );

      return result.map(({ document, employee }) => {
        const expiryDate = document.expiryDate || document.validTill;
        const daysToExpiry = expiryDate
          ? Math.ceil(
              (new Date(expiryDate).getTime() - new Date().getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : 0;
        return {
          ...document,
          employee: employee!,
          daysToExpiry,
        };
      });
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getExpiringEmployeeDocuments: ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getExpiringEmployeeDocuments",
        severity: "error",
      });
      throw error;
    }
  }

  // Project methods
  async getProjects(): Promise<Project[]> {
    try {
      return await db.select().from(projects).orderBy(projects.id);
    } catch (error: any) {
      await this.createErrorLog({
        message: "Error in getProjects: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getProjects",
        severity: "error",
      });
      throw error;
    }
  }

  async getProject(id: number): Promise<Project | undefined> {
    try {
      const result = await db
        .select()
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1);
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getProject (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getProject",
        severity: "error",
      });
      throw error;
    }
  }

  async getProjectsByCustomer(customerId: number): Promise<Project[]> {
    try {
      return await db
        .select()
        .from(projects)
        .where(eq(projects.customerId, customerId));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getProjectsByCustomer (customerId: ${customerId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getProjectsByCustomer",
        severity: "error",
      });
      throw error;
    }
  }

  async createProject(projectData: InsertProject): Promise<Project> {
    try {
      const result = await db.insert(projects).values(projectData).returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createProject: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createProject",
        severity: "error",
      });
      throw error;
    }
  }

  async updateProject(
    id: number,
    data: Partial<Project>
  ): Promise<Project | undefined> {
    try {
      const updatePayload: Partial<Project> = {};

      // Iterate over keys in data to build the updatePayload dynamically
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          const value = (data as any)[key];
          if (
            key === "startDate" ||
            key === "plannedEndDate" ||
            key === "actualEndDate"
          ) {
            const cleanedDate = this._cleanDateValue(value);
            if (cleanedDate !== undefined) {
              (updatePayload as any)[key] = cleanedDate;
            } else if (value !== undefined) {
              // If _cleanDateValue returns undefined, but original value was present, it means invalid date to be ignored.
              console.warn(
                `Invalid date value for ${key} will be ignored:`,
                value
              );
            }
          } else if (key === "locations") {
            if (value !== undefined) {
              // Ensure it's an array, don't modify if already valid JSON or array
              if (Array.isArray(value)) {
                (updatePayload as any)[key] = value;
              } else {
                // Attempt to parse if it's a string, otherwise default to empty array or handle error
                try {
                  const parsedLocations =
                    typeof value === "string" ? JSON.parse(value) : value;
                  (updatePayload as any)[key] = Array.isArray(parsedLocations)
                    ? parsedLocations
                    : [];
                } catch (e) {
                  console.warn(
                    `Invalid JSON for locations, defaulting to empty array:`,
                    value
                  );
                  (updatePayload as any)[key] = [];
                }
              }
            } else {
              // if locations is explicitly undefined in payload, we might want to skip update or set to null
              // For now, let's skip if undefined. If it needs to be settable to null, adjust logic.
            }
          } else if (value !== undefined) {
            // For other fields, directly assign if the value is not undefined
            (updatePayload as any)[key] = value;
          }
        }
      }

      console.log("Storage updateProject cleaned data for DB:", updatePayload);

      // Handle locations array properly - ensure it's preserved as JSON
      if (Object.keys(updatePayload).length === 0) {
        // No valid fields to update, perhaps return current project data or handle as an error/noop
        console.log("No valid fields to update for project:", id);
        return this.getProject(id); // Or return undefined / throw error based on desired behavior
      }

      const [project] = await db
        .update(projects)
        .set(updatePayload)
        .where(eq(projects.id, id))
        .returning();

      console.log("Project updated in database:", project);
      return project;
    } catch (error: any) {
      console.error("Original error in updateProject:", error); // Keep original console.error for context if needed
      await this.createErrorLog({
        message:
          `Error in updateProject (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateProject",
        severity: "error",
      });
      throw error;
    }
  }

  // Project Employee methods
  async getProjectEmployees(
    projectId: number
  ): Promise<
    Array<
      Employee & { startDate?: string; endDate?: string; assignedAt?: string }
    >
  > {
    try {
      console.log(
        `[Payroll] getProjectEmployees called for project ID: ${projectId}`
      );
      console.log(
        `[Payroll] Querying project assignments for project ID: ${projectId}`
      );
      const assignments = await db
        .select()
        .from(projectEmployees)
        .where(eq(projectEmployees.projectId, projectId));

      console.log(
        `[Payroll] Found ${assignments.length} assignments for project ID: ${projectId}`
      );
      if (assignments.length === 0) {
        return [];
      }

      const employeeIds = assignments
        .map((a) => a.employeeId)
        .filter((id) => id != null && typeof id === "number") as number[];
      if (employeeIds.length === 0) {
        console.log(
          `[Payroll] No valid employee IDs found from assignments for project ID: ${projectId}. Returning empty.`
        );
        return [];
      }

      console.log(
        `[Payroll] Querying employee details for ${employeeIds.length} employee IDs related to project ID: ${projectId}`
      );
      console.log(
        `[Payroll] Employee IDs to query: ${JSON.stringify(employeeIds)}`
      );

      // Validate that employeeIds array is not empty and contains valid numbers
      if (
        !Array.isArray(employeeIds) ||
        employeeIds.length === 0 ||
        employeeIds.some((id) => typeof id !== "number" || isNaN(id))
      ) {
        console.error(
          `[Payroll] Invalid employee IDs array: ${JSON.stringify(employeeIds)}`
        );
        return [];
      }

      const employeesData = await db
        .select({
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          email: employees.email,
          phone: employees.phone,
          employeeCode: employees.employeeCode,
          category: employees.category,
          salary: employees.salary,
          hireDate: employees.hireDate,
          department: employees.department,
          position: employees.position,
          isActive: employees.isActive,
          userId: employees.userId,
        })
        .from(employees)
        .where(inArray(employees.id, employeeIds));

      console.log(
        `[Payroll] Fetched ${employeesData.length} employee details for project ID: ${projectId}`
      );
      // Combine employee data with assignment dates
      const result = employeesData.map((employee) => {
        // Find the corresponding assignment. Since employeeIds are unique from assignments,
        // and we filtered for employees based on these IDs, each employee should have an assignment.
        const assignment = assignments.find(
          (a) => a.employeeId === employee.id
        );
        // If for some reason an employee record was fetched but no assignment matches
        // (e.g. if employeeId in assignments could be null and not filtered out, though employeeIds filters nulls now)
        // we might want to handle that, but current logic implies a match will be found.
        return {
          ...employee, // Spread all selected fields of Employee
          startDate: assignment?.startDate
            ? assignment.startDate.toISOString()
            : undefined,
          endDate: assignment?.endDate
            ? assignment.endDate.toISOString()
            : undefined,
          assignedAt: assignment?.assignedAt
            ? assignment.assignedAt.toISOString()
            : undefined,
        };
      });

      return result;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getProjectEmployees (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getProjectEmployees",
        severity: "error",
      });
      throw error;
    }
  }

  async assignEmployeeToProject(
    projectId: number,
    employeeId: number
  ): Promise<ProjectEmployee | undefined> {
    try {
      const result: ProjectEmployee[] = await db
        .insert(projectEmployees)
        .values({
          projectId: projectId,
          employeeId: employeeId,
        })
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in assignEmployeeToProject (projectId: ${projectId}, employeeId: ${employeeId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "assignEmployeeToProject",
        severity: "error",
      });
      throw error;
    }
  }

  async assignEmployeesToProject(
    projectId: number,
    assignments: AssignEmployeeData[]
  ): Promise<ProjectEmployee[]> {
    try {
      // First, remove all existing assignments for this project
      await db
        .delete(projectEmployees)
        .where(eq(projectEmployees.projectId, projectId));

      // Then add the new assignments
      if (assignments.length === 0) {
        // Recalculate project cost after removing all employees
        await this.recalculateProjectCost(projectId);
        return [];
      }

      const assignmentData = assignments.map((assignment) => ({
        projectId: projectId,
        employeeId: assignment.employeeId,
        startDate: assignment.startDate ? new Date(assignment.startDate) : null,
        endDate: assignment.endDate ? new Date(assignment.endDate) : null,
        assignedAt: new Date(),
      }));

      const result: ProjectEmployee[] = await db
        .insert(projectEmployees)
        .values(assignmentData)
        .returning();

      // Recalculate project cost after assigning employees
      await this.recalculateProjectCost(projectId);

      return result;
    } catch (error: any) {
      console.error("Original error in assignEmployeesToProject:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in assignEmployeesToProject (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "assignEmployeesToProject",
        severity: "error",
      });
      throw error;
    }
  }

  async recalculateProjectCost(projectId: number): Promise<void> {
    try {
      const project = await this.getProject(projectId);
      if (!project) {
        console.log(
          `Project ${projectId} not found, skipping cost calculation`
        );
        return;
      }

      const projectEmployeesList = await this.getProjectEmployees(projectId);
      console.log(
        `Recalculating cost for project ${projectId} with ${projectEmployeesList.length} employees`
      );

      // Calculate labor costs
      let totalLaborCost = 0;
      if (projectEmployeesList.length > 0) {
        // Use project start date or current date if no start date
        const startDate = project.startDate
          ? new Date(project.startDate)
          : new Date();
        const endDate = project.actualEndDate
          ? new Date(project.actualEndDate)
          : new Date();
        const workingDays = this.calculateWorkingDays(startDate, endDate);

        console.log(
          `Project ${projectId}: ${workingDays} working days from ${startDate.toDateString()} to ${endDate.toDateString()}`
        );

        // Calculate total salary cost
        for (const employee of projectEmployeesList) {
          if (employee.salary && parseFloat(employee.salary) > 0) {
            const monthlySalary = parseFloat(employee.salary);
            let employeeCost: number;

            if (employee.category === "permanent") {
              // For permanent employees, allocate full monthly salary to project
              employeeCost = monthlySalary;
              console.log(
                `Employee ${employee.firstName} ${
                  employee.lastName
                } (Permanent): Monthly salary ${monthlySalary}, Total cost ${employeeCost.toFixed(
                  2
                )}`
              );
            } else {
              // For consultants and contract employees, calculate based on actual working days
              const dailyRate = monthlySalary / 22; // More accurate working days per month
              employeeCost = dailyRate * workingDays;
              console.log(
                `Employee ${employee.firstName} ${employee.lastName} (${
                  employee.category
                }): Monthly salary ${monthlySalary}, Daily rate ${dailyRate.toFixed(
                  2
                )}, Total cost ${employeeCost.toFixed(2)}`
              );
            }

            totalLaborCost += employeeCost;
          }
        }
      }

      // Calculate inventory/consumables costs
      let totalInventoryCost = 0;

      // Get consumables from project_consumables tables
      const consumableRecords = await db
        .select()
        .from(projectConsumables)
        .where(eq(projectConsumables.projectId, projectId));

      for (const record of consumableRecords) {
        const items = await db
          .select({
            inventoryItemId: projectConsumableItems.inventoryItemId,
            quantity: projectConsumableItems.quantity,
            unitCost: projectConsumableItems.unitCost,
            itemName: inventoryItems.name,
          })
          .from(projectConsumableItems)
          .leftJoin(
            inventoryItems,
            eq(projectConsumableItems.inventoryItemId, inventoryItems.id)
          )
          .where(eq(projectConsumableItems.consumableId, record.id));

        for (const item of items) {
          if (item.unitCost) {
            const unitCost = parseFloat(item.unitCost);
            const itemCost = unitCost * item.quantity;
            totalInventoryCost += itemCost;

            console.log(
              `Consumable item ${item.itemName}: Unit cost ${unitCost.toFixed(
                4
              )}, Quantity ${item.quantity}, Total cost ${itemCost.toFixed(2)}`
            );
          }
        }
      }

      // Project asset assignment costs
      let totalAssetRentalCost = 0;

      const assetAssignments = await this.getProjectAssetAssignments(projectId);
      for (const assignment of assetAssignments) {
        const rentalCost = await this.calculateAssetRentalCost(
          new Date(assignment.startDate),
          new Date(assignment.endDate),
          assignment.monthlyRate
        );
        totalAssetRentalCost += rentalCost;
      }
      console.log(
        `Total asset rental cost: ${totalAssetRentalCost.toFixed(2)}`
      );

      const totalProjectCost =
        totalLaborCost + totalInventoryCost + totalAssetRentalCost;

      console.log(`Project ${projectId} cost breakdown:`);
      console.log(`- Labor cost: ${totalLaborCost.toFixed(2)}`);
      console.log(`- Inventory cost: ${totalInventoryCost.toFixed(2)}`);
      console.log(`- Asset rental cost: ${totalAssetRentalCost.toFixed(2)}`);
      console.log(`- Total cost: ${totalProjectCost.toFixed(2)}`);

      // Update project actual cost with proper formatting
      await this.updateProject(projectId, {
        actualCost: totalProjectCost.toFixed(2),
      });
    } catch (error: any) {
      console.error("Original error in recalculateProjectCost:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in recalculateProjectCost (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "recalculateProjectCost",
        severity: "error",
      });
      throw error;
    }
  }

  private calculateWorkingDays(startDate: Date, endDate: Date): number {
    // Ensure we have valid dates
    if (!startDate || !endDate) {
      return 0;
    }

    // If end date is before start date, return 0
    if (endDate < startDate) {
      return 0;
    }

    let workingDays = 0;
    let currentDate = new Date(startDate.getTime()); // Create a copy to avoid modifying original

    while (currentDate <= endDate) {
      // Count only weekdays (Monday = 1, Sunday = 0)
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Not Sunday or Saturday
        workingDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return workingDays;
  }

  async updateProjectEndDateAndRecalculate(
    projectId: number,
    endDate: Date
  ): Promise<Project | undefined> {
    try {
      const result = await this.updateProject(projectId, {
        actualEndDate: endDate,
      });
      if (result) {
        await this.recalculateProjectCost(projectId);
      }
      return result;
    } catch (error: any) {
      console.error(
        "Original error in updateProjectEndDateAndRecalculate:",
        error
      ); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in updateProjectEndDateAndRecalculate (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateProjectEndDateAndRecalculate",
        severity: "error",
      });
      throw error;
    }
  }

  async removeEmployeeFromProject(
    projectId: number,
    employeeId: number
  ): Promise<boolean> {
    try {
      console.log(
        `Attempting to remove employee ${employeeId} from project ${projectId}`
      );

      // First, check if the assignment exists
      const existingAssignments = await db
        .select()
        .from(projectEmployees)
        .where(
          and(
            eq(projectEmployees.projectId, projectId),
            eq(projectEmployees.employeeId, employeeId)
          )
        );

      console.log(
        `Found ${existingAssignments.length} existing assignments for employee ${employeeId} in project ${projectId}`
      );

      if (existingAssignments.length === 0) {
        console.log(
          `No assignment found for employee ${employeeId} in project ${projectId}`
        );
        return false;
      }

      // Delete using composite key (projectId and employeeId) and return deleted records
      const result = await db
        .delete(projectEmployees)
        .where(
          and(
            eq(projectEmployees.projectId, projectId),
            eq(projectEmployees.employeeId, employeeId)
          )
        )
        .returning();

      // Check if any records were deleted by looking at the returned array
      const deleted = result.length > 0;

      if (deleted) {
        console.log(
          `Successfully deleted employee ${employeeId} from project ${projectId} - ${result.length} record(s) removed`
        );
        // Recalculate project cost after removing employee
        await this.recalculateProjectCost(projectId);
        console.log(`Recalculated project cost for project ${projectId}`);
      } else {
        console.log(
          `No records deleted when trying to remove employee ${employeeId} from project ${projectId}`
        );
      }

      return deleted;
    } catch (error: any) {
      console.error("Original error in removeEmployeeFromProject:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in removeEmployeeFromProject (projectId: ${projectId}, employeeId: ${employeeId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "removeEmployeeFromProject",
        severity: "error",
      });
      throw error;
    }
  }

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
    lowStock: boolean
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
          lte(inventoryItems.currentStock, inventoryItems.minStockLevel)
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
            lte(inventoryItems.currentStock, inventoryItems.minStockLevel)
          )
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
        limit
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
    itemData: InsertInventoryItem
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
    itemData: Partial<InventoryItem>
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

  // Create Asset Inventory Maintenance Records
  async createAssetInventoryMaintenanceRecord(maintenanceData: {
    instanceId: number;
    maintenanceCost: string;
    maintenanceType: string;
    description?: string | null;
    startDate?: Date;
    completedDate?: Date;
    maintenanceDate?: Date;
    performedBy?: number | null;
  }): Promise<any> {
    try {
      const result = await db
        .insert(assetInventoryMaintenanceRecords)
        .values({
          instanceId: maintenanceData.instanceId,
          maintenanceCost: maintenanceData.maintenanceCost,
          description: maintenanceData.description || null,
          startDate: maintenanceData.startDate || null,
          completedDate: maintenanceData.completedDate || null,
          maintenanceDate: maintenanceData.maintenanceDate || new Date(),
          maintenanceType: maintenanceData.maintenanceType || null,
          performedBy: maintenanceData.performedBy || null,
          createdAt: new Date(),
        })
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createAssetInventoryMaintenanceRecord: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createAssetInventoryMaintenanceRecord",
        severity: "error",
      });
      throw error;
    }
  }

  //Update Maintenance record
  async updateAssetInventoryMaintenanceRecord(
    id: number,
    maintenanceData: Partial<insertAssetInventoryMaintenanceRecords>
  ): Promise<any> {
    try {
      const result = await db
        .update(assetInventoryMaintenanceRecords)
        .set(maintenanceData)
        .where(eq(assetInventoryMaintenanceRecords.id, id))
        .returning();

      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateAssetInventoryMaintenanceRecord (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateAssetInventoryMaintenanceRecord",
        severity: "error",
      });
      throw error;
    }
  }

  async getAssetInventoryMaintenanceRecords(
    instanceId: number
  ): Promise<any[]> {
    try {
      const records = await db.execute(sql`
        SELECT 
          aimr.id,
          aimr.instance_id as "instanceId",
          aimr.maintenance_cost as "maintenanceCost",
          aimr.description,
          aimr.performed_by as "performedBy",
          aimr.maintenance_date as "maintenanceDate",
          u.username as "performedByName",
          aimr.created_at as "createdAt"
        FROM asset_inventory_maintenance_records aimr
        LEFT JOIN users u ON aimr.performed_by = u.id
        WHERE aimr.instance_id = ${instanceId}
        ORDER BY aimr.maintenance_date DESC
      `);

      return records;
    } catch (error: any) {
      console.error(
        `Error in getAssetInventoryMaintenanceRecords (instanceId: ${instanceId}):`,
        error
      );
      throw error;
    }
  }

  async createAssetInventoryMaintenanceFile(fileData: {
    maintenanceRecordId: number;
    fileName: string;
    originalName: string;
    filePath: string;
    fileSize?: number;
    mimeType?: string;
  }): Promise<any> {
    try {
      const result = await db
        .insert(assetInventoryMaintenanceFiles)
        .values({
          maintenanceRecordId: fileData.maintenanceRecordId,
          fileName: fileData.fileName,
          originalName: fileData.originalName,
          filePath: fileData.filePath,
          fileSize: fileData.fileSize || null,
          mimeType: fileData.mimeType || null,
          uploadedAt: new Date(),
        })
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createAssetInventoryMaintenanceFile: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createAssetInventoryMaintenanceFile",
        severity: "error",
      });
      throw error;
    }
  }

  async getAssetInventoryMaintenanceFiles(
    maintenanceRecordId: number
  ): Promise<any[]> {
    try {
      const files = await db
        .select()
        .from(assetInventoryMaintenanceFiles)
        .where(
          eq(
            assetInventoryMaintenanceFiles.maintenanceRecordId,
            maintenanceRecordId
          )
        )
        .orderBy(assetInventoryMaintenanceFiles.uploadedAt);
      console.log(files, "files");
      return files;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getAssetInventoryMaintenanceFiles (maintenanceRecordId: ${maintenanceRecordId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getAssetInventoryMaintenanceFiles",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteAssetInventoryMaintenanceFile(fileId: number): Promise<void> {
    try {
      await db
        .delete(assetInventoryMaintenanceFiles)
        .where(eq(assetInventoryMaintenanceFiles.id, fileId));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deleteAssetInventoryMaintenanceFile (fileId: ${fileId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteAssetInventoryMaintenanceFile",
        severity: "error",
      });
      throw error;
    }
  }

  async getAssetInventoryInstance(id: number): Promise<any> {
    try {
      const result = await db
        .select()
        .from(assetInventoryInstances)
        .where(eq(assetInventoryInstances.id, id))
        .limit(1);
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getAssetInventoryInstance (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getAssetInventoryInstance",
        severity: "error",
      });
      throw error;
    }
  }

  async updateAssetInventoryInstance(id: number, data: any): Promise<any> {
    try {
      const result = await db
        .update(assetInventoryInstances)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(assetInventoryInstances.id, id))
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateAssetInventoryInstance (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateAssetInventoryInstance",
        severity: "error",
      });
      throw error;
    }
  }

  // Enhanced Asset Inventory Instance Methods
  async getAllAssetInventoryInstances(): Promise<any[]> {
    try {
      const instances = await db
        .select({
          id: assetInventoryInstances.id,
          assetTypeId: assetInventoryInstances.assetTypeId,
          assetTypeName: assetTypes.name,
          instanceNumber: assetInventoryInstances.instanceNumber,
          assetTag: assetInventoryInstances.assetTag,
          serialNumber: assetInventoryInstances.serialNumber,
          barcode: assetInventoryInstances.barcode,
          status: assetInventoryInstances.status,
          condition: assetInventoryInstances.condition,
          location: assetInventoryInstances.location,
          assignedProjectId: assetInventoryInstances.assignedProjectId,
          assignedToId: assetInventoryInstances.assignedToId,
          acquisitionDate: assetInventoryInstances.acquisitionDate,
          acquisitionCost: assetInventoryInstances.acquisitionCost,
          acquisitionCurrency: assetInventoryInstances.acquisitionCurrency,
          currentValue: assetInventoryInstances.currentValue,
          currentValueCurrency: assetInventoryInstances.currentValueCurrency,
          monthlyRentalAmount: assetInventoryInstances.monthlyRentalAmount,
          rentalCurrency: assetInventoryInstances.rentalCurrency,
          warrantyExpiryDate: assetInventoryInstances.warrantyExpiryDate,
          lastMaintenanceDate: assetInventoryInstances.lastMaintenanceDate,
          nextMaintenanceDate: assetInventoryInstances.nextMaintenanceDate,
          notes: assetInventoryInstances.notes,
          photos: assetInventoryInstances.photos,
          isActive: assetInventoryInstances.isActive,
          createdBy: assetInventoryInstances.createdBy,
          createdAt: assetInventoryInstances.createdAt,
          updatedAt: assetInventoryInstances.updatedAt,
        })
        .from(assetInventoryInstances)
        .leftJoin(
          assetTypes,
          eq(assetInventoryInstances.assetTypeId, assetTypes.id)
        )
        .where(eq(assetInventoryInstances.isActive, true))
        .orderBy(assetTypes.name, assetInventoryInstances.instanceNumber);

      return instances;
    } catch (error: any) {
      console.error("Error in getAllAssetInventoryInstances:", error);
      throw error;
    }
  }

  async getAssetInventoryInstancesByType(assetTypeId: number): Promise<any[]> {
    try {
      const instances = await db
        .select({
          id: assetInventoryInstances.id,
          assetTypeId: assetInventoryInstances.assetTypeId,
          instanceNumber: assetInventoryInstances.instanceNumber,
          assetTag: assetInventoryInstances.assetTag,
          serialNumber: assetInventoryInstances.serialNumber,
          barcode: assetInventoryInstances.barcode,
          status: assetInventoryInstances.status,
          condition: assetInventoryInstances.condition,
          location: assetInventoryInstances.location,
          assignedProjectId: assetInventoryInstances.assignedProjectId,
          monthlyRentalAmount: assetInventoryInstances.monthlyRentalAmount,
          currentValue: assetInventoryInstances.currentValue,
          acquisitionCost: assetInventoryInstances.acquisitionCost,
          notes: assetInventoryInstances.notes,
          isActive: assetInventoryInstances.isActive,
          createdAt: assetInventoryInstances.createdAt,
        })
        .from(assetInventoryInstances)
        .where(
          and(
            eq(assetInventoryInstances.assetTypeId, assetTypeId),
            eq(assetInventoryInstances.isActive, true)
          )
        )
        .orderBy(assetInventoryInstances.instanceNumber);

      return instances;
    } catch (error: any) {
      console.error("Error in getAssetInventoryInstancesByType:", error);
      throw error;
    }
  }

  async getAvailableInstancesForAssignment(
    assetTypeId: number
  ): Promise<any[]> {
    try {
      const instances = await db
        .select({
          id: assetInventoryInstances.id,
          instanceNumber: assetInventoryInstances.instanceNumber,
          assetTag: assetInventoryInstances.assetTag,
          serialNumber: assetInventoryInstances.serialNumber,
          barcode: assetInventoryInstances.barcode,
          monthlyRentalAmount: assetInventoryInstances.monthlyRentalAmount,
          condition: assetInventoryInstances.condition,
          location: assetInventoryInstances.location,
        })
        .from(assetInventoryInstances)
        .where(
          and(
            eq(assetInventoryInstances.assetTypeId, assetTypeId),
            eq(assetInventoryInstances.status, "available"),
            eq(assetInventoryInstances.isActive, true)
          )
        )
        .orderBy(assetInventoryInstances.instanceNumber);

      return instances;
    } catch (error: any) {
      console.error("Error in getAvailableInstancesForAssignment:", error);
      throw error;
    }
  }

  async createAssetInventoryInstance(data: any): Promise<any> {
    try {
      const nextInstanceNumber = await this.getNextInstanceNumber(
        data.assetTypeId
      );

      // Clean up data before saving - convert empty strings to null for date fields and numeric values
      const cleanData = { ...data };

      // Handle date fields - convert empty strings to null
      [
        "acquisitionDate",
        "warrantyExpiryDate",
        "lastMaintenanceDate",
        "nextMaintenanceDate",
      ].forEach((field) => {
        if (cleanData[field] === "") {
          cleanData[field] = null;
        } else if (cleanData[field] && typeof cleanData[field] === "string") {
          // Ensure valid date format
          cleanData[field] = new Date(cleanData[field]);
        }
      });

      // Handle numeric fields - convert empty strings to null
      ["acquisitionCost", "currentValue", "dailyRentalRate"].forEach(
        (field) => {
          if (cleanData[field] === "") {
            cleanData[field] = null;
          } else if (cleanData[field] && typeof cleanData[field] === "string") {
            const numValue = parseFloat(cleanData[field]);
            cleanData[field] = isNaN(numValue) ? null : numValue.toString();
          }
        }
      );

      // Handle assignment fields - convert "unassigned" to null
      ["assignedProjectId", "assignedToId"].forEach((field) => {
        if (cleanData[field] === "unassigned" || cleanData[field] === "") {
          cleanData[field] = null;
        } else if (cleanData[field] && typeof cleanData[field] === "string") {
          const numValue = parseInt(cleanData[field]);
          cleanData[field] = isNaN(numValue) ? null : numValue;
        }
      });

      const instance = await db
        .insert(assetInventoryInstances)
        .values({
          ...cleanData,
          instanceNumber: `Instance ${nextInstanceNumber}`,
        })
        .returning();

      // Update asset type quantities
      await this.updateAssetTypeQuantities(cleanData.assetTypeId);

      return instance[0];
    } catch (error: any) {
      console.error("Error in createAssetInventoryInstance:", error);
      await this.createErrorLog({
        message:
          `Error in createAssetInventoryInstance: ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createAssetInventoryInstance",
        severity: "error",
      });
      throw error;
    }
  }

  async updateAssetInventoryInstance(id: number, data: any): Promise<any> {
    try {
      const oldInstance = await db
        .select({ assetTypeId: assetInventoryInstances.assetTypeId })
        .from(assetInventoryInstances)
        .where(eq(assetInventoryInstances.id, id))
        .limit(1);

      // Clean up data before saving - convert empty strings to null for date fields and numeric values
      const cleanData = { ...data };

      // Handle date fields - convert empty strings to null
      [
        "acquisitionDate",
        "warrantyExpiryDate",
        "lastMaintenanceDate",
        "nextMaintenanceDate",
      ].forEach((field) => {
        if (cleanData[field] === "") {
          cleanData[field] = null;
        } else if (cleanData[field] && typeof cleanData[field] === "string") {
          // Ensure valid date format
          cleanData[field] = new Date(cleanData[field]);
        }
      });

      // Handle numeric fields - convert empty strings to null
      ["acquisitionCost", "currentValue", "dailyRentalRate"].forEach(
        (field) => {
          if (cleanData[field] === "") {
            cleanData[field] = null;
          } else if (cleanData[field] && typeof cleanData[field] === "string") {
            const numValue = parseFloat(cleanData[field]);
            cleanData[field] = isNaN(numValue) ? null : numValue.toString();
          }
        }
      );

      // Handle assignment fields - convert "unassigned" to null
      ["assignedProjectId", "assignedToId"].forEach((field) => {
        if (cleanData[field] === "unassigned" || cleanData[field] === "") {
          cleanData[field] = null;
        } else if (cleanData[field] && typeof cleanData[field] === "string") {
          const numValue = parseInt(cleanData[field]);
          cleanData[field] = isNaN(numValue) ? null : numValue;
        }
      });

      const instance = await db
        .update(assetInventoryInstances)
        .set({ ...cleanData, updatedAt: new Date() })
        .where(eq(assetInventoryInstances.id, id))
        .returning();

      // Update quantities for both old and new asset types if changed
      if (oldInstance[0]) {
        await this.updateAssetTypeQuantities(oldInstance[0].assetTypeId);
        if (
          cleanData.assetTypeId &&
          cleanData.assetTypeId !== oldInstance[0].assetTypeId
        ) {
          await this.updateAssetTypeQuantities(cleanData.assetTypeId);
        }
      }

      return instance[0];
    } catch (error: any) {
      console.error("Error in updateAssetInventoryInstance:", error);
      await this.createErrorLog({
        message:
          `Error in updateAssetInventoryInstance (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateAssetInventoryInstance",
        severity: "error",
      });
      throw error;
    }
  }

  private async getNextInstanceNumber(assetTypeId: number): Promise<number> {
    try {
      const maxInstance = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(assetInventoryInstances)
        .where(eq(assetInventoryInstances.assetTypeId, assetTypeId));

      return (maxInstance[0]?.count || 0) + 1;
    } catch (error: any) {
      console.error("Error in getNextInstanceNumber:", error);
      return 1;
    }
  }

  private async updateAssetTypeQuantities(assetTypeId: number): Promise<void> {
    try {
      const counts = await db
        .select({
          total: sql<number>`COUNT(*)`,
          available: sql<number>`COUNT(*) FILTER (WHERE status = 'available')`,
          assigned: sql<number>`COUNT(*) FILTER (WHERE status = 'in_use')`,
          maintenance: sql<number>`COUNT(*) FILTER (WHERE status = 'maintenance')`,
        })
        .from(assetInventoryInstances)
        .where(
          and(
            eq(assetInventoryInstances.assetTypeId, assetTypeId),
            eq(assetInventoryInstances.isActive, true)
          )
        );

      const count = counts[0];
      await db
        .update(assetTypes)
        .set({
          totalQuantity: count.total,
          availableQuantity: count.available,
          assignedQuantity: count.assigned,
          maintenanceQuantity: count.maintenance,
        })
        .where(eq(assetTypes.id, assetTypeId));
    } catch (error: any) {
      console.error("Error in updateAssetTypeQuantities:", error);
    }
  }

  async getAllAssetMaintenanceRecords(): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          amr.id,
          amr.instance_id as "instanceId",
          amr.maintenance_type as "maintenanceType",
          amr.start_date as "startDate",
          amr.completed_date as "completedDate",
          amr.maintenance_cost as "maintenanceCost",
          amr.description,
          amr.performed_by as "performedBy",
          amr.maintenance_date as "maintenanceDate",
          u.username as "performedByName",
          amr.created_at as "createdAt",
          jsonb_build_object(
            'id', ai.id,
            'assetTag', ai.asset_tag,
            'serialNumber', ai.serial_number,
            'barcode', ai.barcode,
            'assetType', jsonb_build_object(
              'id', at.id,
              'name', at.name,
              'category', at.category
            )
          ) as "assetInstance"
        FROM asset_inventory_maintenance_records amr
        LEFT JOIN users u ON amr.performed_by = u.id
        LEFT JOIN asset_inventory_instances ai ON amr.instance_id = ai.id
        LEFT JOIN asset_types at ON ai.asset_type_id = at.id
        ORDER BY amr.maintenance_date DESC
      `);

      return Array.isArray(result) ? result : result.rows || [];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getAllAssetMaintenanceRecords: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getAllAssetMaintenanceRecords",
        severity: "error",
      });
      throw error;
    }
  }

  // Payment file methods
  async createPaymentFile(
    fileData: CreatePaymentFileData
  ): Promise<PaymentFile> {
    try {
      const result = await db
        .insert(paymentFiles)
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
          "Error in createPaymentFile: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createPaymentFile",
        severity: "error",
      });
      throw error;
    }
  }

  async getPaymentFiles(paymentId: number): Promise<PaymentFile[]> {
    try {
      const files: PaymentFile[] = await db
        .select()
        .from(paymentFiles)
        .where(eq(paymentFiles.paymentId, paymentId))
        .orderBy(desc(paymentFiles.uploadedAt));

      return files;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getPaymentFiles (paymentId: ${paymentId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPaymentFiles",
        severity: "error",
      });
      throw error;
    }
  }

  async deletePaymentFile(fileId: number): Promise<boolean> {
    try {
      const result = await db
        .delete(paymentFiles)
        .where(eq(paymentFiles.id, fileId));
      return result.rowCount && result.rowCount > 0;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deletePaymentFile (fileId: ${fileId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deletePaymentFile",
        severity: "error",
      });
      throw error;
    }
  }

  // Daily Activity methods
  async getDailyActivities(projectId: number): Promise<DailyActivity[]> {
    try {
      return await db
        .select()
        .from(dailyActivities)
        .where(eq(dailyActivities.projectId, projectId));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getDailyActivities (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getDailyActivities",
        severity: "error",
      });
      throw error;
    }
  }

  async getDailyActivitiesPaginated(
    projectId: number,
    limit: number,
    offset: number
  ): Promise<{ data: DailyActivity[]; total: number }> {
    try {
      const [data, countResult] = await Promise.all([
        db
          .select()
          .from(dailyActivities)
          .where(eq(dailyActivities.projectId, projectId))
          .orderBy(desc(dailyActivities.date))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(dailyActivities)
          .where(eq(dailyActivities.projectId, projectId)),
      ]);

      const total = Number(countResult[0]?.count || 0);
      return { data, total };
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getDailyActivitiesPaginated (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getDailyActivitiesPaginated",
        severity: "error",
      });
      throw error;
    }
  }

  async createDailyActivity(
    activityData: InsertDailyActivity
  ): Promise<DailyActivity> {
    try {
      const result = await db
        .insert(dailyActivities)
        .values(activityData)
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createDailyActivity: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createDailyActivity",
        severity: "error",
      });
      throw error;
    }
  }

  // Planned Activities methods
  async getPlannedActivities(
    projectId: number
  ): Promise<PlannedActivityItem[]> {
    try {
      const result: Array<{
        id: number;
        location: string | null;
        tasks: string | null;
        date: Date;
        remarks: string | null;
      }> = await db
        .select({
          id: dailyActivities.id,
          location: dailyActivities.location,
          tasks: dailyActivities.plannedTasks,
          date: dailyActivities.date,
          remarks: dailyActivities.remarks,
        })
        .from(dailyActivities)
        .where(
          and(
            eq(dailyActivities.projectId, projectId),
            isNotNull(dailyActivities.plannedTasks),
            ne(dailyActivities.plannedTasks, "")
          )
        )
        .orderBy(desc(dailyActivities.date));

      return result.map((row) => ({
        location: row.location || "",
        tasks: row.tasks || "",
        date: row.date.toISOString().split("T")[0],
        remarks: row.remarks || null,
      }));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getPlannedActivities (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPlannedActivities",
        severity: "error",
      });
      throw error;
    }
  }

  async getPlannedActivitiesPaginated(
    projectId: number,
    limit: number,
    offset: number
  ): Promise<{ data: PlannedActivityItem[]; total: number }> {
    try {
      const whereCondition = and(
        eq(dailyActivities.projectId, projectId),
        isNotNull(dailyActivities.plannedTasks),
        ne(dailyActivities.plannedTasks, "")
      );

      const [result, countResult] = await Promise.all([
        db
          .select({
            id: dailyActivities.id,
            location: dailyActivities.location,
            tasks: dailyActivities.plannedTasks,
            date: dailyActivities.date,
            remarks: dailyActivities.remarks,
          })
          .from(dailyActivities)
          .where(whereCondition)
          .orderBy(desc(dailyActivities.date))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(dailyActivities)
          .where(whereCondition),
      ]);

      const data = result.map((row) => ({
        location: row.location || "",
        tasks: row.tasks || "",
        date: row.date.toISOString().split("T")[0],
        remarks: row.remarks || null,
      }));

      const total = Number(countResult[0]?.count || 0);
      return { data, total };
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getPlannedActivitiesPaginated (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPlannedActivitiesPaginated",
        severity: "error",
      });
      throw error;
    }
  }

  async savePlannedActivities(
    projectId: number,
    activities: PlannedActivityItem[]
  ): Promise<DailyActivity[]> {
    try {
      const results: DailyActivity[] = [];

      for (const activity of activities) {
        // Create a daily activity entry with planned tasks
        const activityData: InsertDailyActivity = {
          projectId,
          date: new Date(activity.date),
          location: activity.location || "",
          completedTasks: "", // Empty for planned activities
          plannedTasks: activity.tasks,
          remarks: "Planned activity",
          photos: [], // Assuming photos is part of InsertDailyActivity and can be an empty array
        };

        const resultItem: DailyActivity[] = await db
          .insert(dailyActivities)
          .values(activityData)
          .returning();

        if (resultItem[0]) {
          results.push(resultItem[0]);
        }
      }

      return results;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in savePlannedActivities (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "savePlannedActivities",
        severity: "error",
      });
      throw error;
    }
  }

  // Project Consumables methods
  // async getProjectConsumables(projectId: number): Promise<any[]> {
  //   try {
  //     const result = await db
  //       .select({
  //         id: projectConsumables.id,
  //         projectId: projectConsumables.projectId,
  //         date: projectConsumables.date,
  //         recordedBy: projectConsumables.recordedBy,
  //         recordedAt: projectConsumables.recordedAt,
  //         items: sql<any>`
  //           json_agg(
  //             json_build_object(
  //               'id', pci.id,
  //               'inventoryItemId', pci.inventory_item_id,
  //               'inventoryItemName', ii.name,
  //               'quantity', pci.quantity,
  //               'unitCost', pci.unit_cost,
  //               'unit', ii.unit
  //             )
  //           )
  //         `,
  //       })
  //       .from(projectConsumables)
  //       .leftJoin(
  //         projectConsumableItems,
  //         eq(projectConsumables.id, projectConsumableItems.consumableId)
  //       )
  //       .leftJoin(
  //         inventoryItems,
  //         eq(projectConsumableItems.inventoryItemId, inventoryItems.id)
  //       )
  //       .where(eq(projectConsumables.projectId, projectId))
  //       .groupBy(
  //         projectConsumables.id,
  //         projectConsumables.projectId,
  //         projectConsumables.date,
  //         projectConsumables.recordedBy,
  //         projectConsumables.recordedAt
  //       )
  //       .orderBy(desc(projectConsumables.date));

  //     return result;
  //   } catch (error) {
  //     console.error("Error getting project consumables:", error);
  //     throw error;
  //   }
  // }

  // async createProjectConsumables(
  //   projectId: number,
  //   date: string,
  //   items: Array<{ inventoryItemId: number; quantity: number }>,
  //   userId?: number
  // ): Promise<any> {
  //   try {
  //     // Validate project exists
  //     const project = await this.getProject(projectId);
  //     if (!project) {
  //       throw new Error(`Project with ID ${projectId} not found`);
  //     }

  //     // Create the project consumables record
  //     const consumableRecord = await db
  //       .insert(projectConsumables)
  //       .values({
  //         projectId,
  //         date: new Date(date),
  //         recordedBy: userId || null,
  //       })
  //       .returning();

  //     const consumableId = consumableRecord[0].id;

  //     // Create inventory transactions and consumable items
  //     const createdItems = [];
  //     let totalCost = 0;

  //     for (const item of items) {
  //       // Get inventory item details
  //       const inventoryItem = await this.getInventoryItem(item.inventoryItemId);
  //       if (!inventoryItem) {
  //         throw new Error(
  //           `Inventory item with ID ${item.inventoryItemId} not found`
  //         );
  //       }

  //       // Check if there's enough stock
  //       if (inventoryItem.currentStock < item.quantity) {
  //         throw new Error(
  //           `Insufficient stock for ${inventoryItem.name}. Available: ${inventoryItem.currentStock}, Required: ${item.quantity}`
  //         );
  //       }

  //       // Use average cost as unit cost
  //       const unitCost = parseFloat(inventoryItem.avgCost || "0");
  //       const itemTotalCost = unitCost * item.quantity;
  //       totalCost += itemTotalCost;

  //       // Create inventory transaction (outflow)
  //       await db.insert(inventoryTransactions).values({
  //         itemId: item.inventoryItemId,
  //         type: "outflow",
  //         quantity: item.quantity,
  //         unitCost: unitCost.toString(),
  //         remainingQuantity: 0, // For outflow, remaining is 0
  //         projectId: projectId,
  //         reference: `CONSUMABLES-${consumableId}`,
  //         createdBy: userId || null,
  //       });

  //       // Update inventory stock
  //       await this.updateInventoryItem(item.inventoryItemId, {
  //         currentStock: inventoryItem.currentStock - item.quantity,
  //       });

  //       // Create project consumable item record
  //       const consumableItem = await db
  //         .insert(projectConsumableItems)
  //         .values({
  //           consumableId: consumableId,
  //           inventoryItemId: item.inventoryItemId,
  //           quantity: item.quantity,
  //           unitCost: unitCost.toString(),
  //         })
  //         .returning();

  //       createdItems.push({
  //         ...consumableItem[0],
  //         inventoryItemName: inventoryItem.name,
  //         unit: inventoryItem.unit,
  //       });
  //     }

  //     // Update project cost
  //     if (totalCost > 0) {
  //       const currentCost = parseFloat(project.actualCost || "0");
  //       const newCost = currentCost + totalCost;
  //       await this.updateProject(projectId, {
  //         actualCost: newCost.toFixed(2),
  //       });
  //     }

  //     return {
  //       id: consumableId,
  //       projectId,
  //       date,
  //       items: createdItems,
  //       totalCost: totalCost.toFixed(2),
  //       recordedBy: userId,
  //     };
  //   } catch (error) {
  //     console.error("Error creating project consumables:", error);
  //     throw error;
  //   }
  // }

  // Supplier-Inventory Item mapping methods
  async getSupplierInventoryItems(
    inventoryItemId?: number,
    supplierId?: number
  ): Promise<SupplierInventoryItem[]> {
    try {
      let query = db.select().from(supplierInventoryItems);

      if (inventoryItemId && supplierId) {
        query = query.where(
          and(
            eq(supplierInventoryItems.inventoryItemId, inventoryItemId),
            eq(supplierInventoryItems.supplierId, supplierId)
          )
        );
      } else if (inventoryItemId) {
        query = query.where(
          eq(supplierInventoryItems.inventoryItemId, inventoryItemId)
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
    data: InsertSupplierInventoryItem
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
        result[0]
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
    inventoryItemId: number
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
    data: Partial<InsertSupplierInventoryItem>
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
    supplierId: number
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
          eq(inventoryItems.id, supplierInventoryItems.inventoryItemId)
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

  // Project Revenue methods
  async getProjectRevenue(projectId: number): Promise<{
    projectId: number;
    totalRevenue: string;
    totalCost: string;
    profit: string;
    invoicePayments: InvoicePaymentWithCustomerName[];
  }> {
    try {
      const project = await this.getProject(projectId);
      if (!project) {
        throw new Error(`Project with ID ${projectId} not found`);
      }

      // Get all invoice payments for this project
      const projectInvoicePayments: InvoicePaymentWithCustomerName[] = await db
        .select({
          // Explicitly list all fields from InvoicePayment schema type
          id: invoicePayments.id,
          invoiceId: invoicePayments.invoiceId,
          amount: invoicePayments.amount,
          paymentDate: invoicePayments.paymentDate,
          paymentMethod: invoicePayments.paymentMethod,
          referenceNumber: invoicePayments.referenceNumber,
          notes: invoicePayments.notes,
          recordedBy: invoicePayments.recordedBy,
          recordedAt: invoicePayments.recordedAt,
          paymentType: invoicePayments.paymentType,
          creditNoteId: invoicePayments.creditNoteId,
          // Joined field
          customerName: customers.name,
        })
        .from(invoicePayments)
        .leftJoin(
          salesInvoices,
          eq(invoicePayments.invoiceId, salesInvoices.id)
        )
        .leftJoin(customers, eq(salesInvoices.customerId, customers.id))
        .where(eq(salesInvoices.projectId, projectId))
        .orderBy(desc(invoicePayments.paymentDate));

      // Calculate total revenue from payments
      const totalRevenue = projectInvoicePayments.reduce((sum, payment) => {
        return sum + parseFloat(payment.amount || "0");
      }, 0);

      // Get project cost
      const totalCost = parseFloat(project.actualCost || "0");

      // Calculate profit/loss
      const profit = totalRevenue - totalCost;

      return {
        projectId,
        totalRevenue: totalRevenue.toFixed(2),
        totalCost: totalCost.toFixed(2),
        profit: profit.toFixed(2),
        invoicePayments: projectInvoicePayments,
      };
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getProjectRevenue (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getProjectRevenue",
        severity: "error",
      });
      throw error;
    }
  }

  async updateProjectRevenue(projectId: number): Promise<void> {
    try {
      // Get all invoice payments for this project
      const projectPayments = await db
        .select({
          amount: invoicePayments.amount,
        })
        .from(invoicePayments)
        .leftJoin(
          salesInvoices,
          eq(invoicePayments.invoiceId, salesInvoices.id)
        )
        .where(eq(salesInvoices.projectId, projectId));

      // Calculate total revenue
      const totalRevenue = projectPayments.reduce((sum, payment) => {
        return sum + parseFloat(payment.amount || "0");
      }, 0);

      // Update project total revenue
      await this.updateProject(projectId, {
        totalRevenue: totalRevenue.toFixed(2),
      });

      console.log(
        `Updated project ${projectId} total revenue to ${totalRevenue.toFixed(
          2
        )}`
      );
    } catch (error: any) {
      console.error("Original error in updateProjectRevenue:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in updateProjectRevenue (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateProjectRevenue",
        severity: "error",
      });
      throw error;
    }
  }

  async updateInvoicePaidAmount(invoiceId: number): Promise<void> {
    try {
      // Get all payments for this invoice
      const payments = await db
        .select({
          amount: invoicePayments.amount,
        })
        .from(invoicePayments)
        .where(eq(invoicePayments.invoiceId, invoiceId));

      // Calculate total paid amount
      const totalPaid = payments.reduce((sum, payment) => {
        return sum + parseFloat(payment.amount || "0");
      }, 0);

      // Get invoice details
      const invoice = await db
        .select()
        .from(salesInvoices)
        .where(eq(salesInvoices.id, invoiceId))
        .limit(1);

      if (invoice.length === 0) {
        throw new Error(`Invoice with ID ${invoiceId} not found`);
      }

      const invoiceData = invoice[0];
      const totalAmount = parseFloat(invoiceData.totalAmount || "0");

      // Determine status based on payment amounts and due date
      let status = "unpaid";
      if (totalPaid >= totalAmount) {
        status = "paid";
      } else if (totalPaid > 0) {
        status = "partially_paid";
      }

      // Check if invoice is overdue (only if not fully paid and not draft)
      if (invoiceData.status !== "draft" && status !== "paid") {
        const currentDate = new Date();
        const dueDate = new Date(invoiceData.dueDate);
        if (currentDate > dueDate) {
          status = "overdue";
        }
      }

      // Update invoice
      await db
        .update(salesInvoices)
        .set({
          paidAmount: totalPaid.toFixed(2),
          status,
        })
        .where(eq(salesInvoices.id, invoiceId));

      // Update project revenue if invoice is linked to a project
      if (invoiceData.projectId) {
        await this.updateProjectRevenue(invoiceData.projectId);
      }

      console.log(
        `Updated invoice ${invoiceId} paid amount to ${totalPaid.toFixed(
          2
        )} with status ${status}`
      );
    } catch (error: any) {
      console.error("Original error in updateInvoicePaidAmount:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in updateInvoicePaidAmount (invoiceId: ${invoiceId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateInvoicePaidAmount",
        severity: "error",
      });
      throw error;
    }
  }

  async getCreditNote(id: number): Promise<CreditNote | undefined> {
    try {
      const result: CreditNote[] = await db
        .select()
        .from(creditNotes)
        .where(eq(creditNotes.id, id))
        .limit(1);
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getCreditNote (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getCreditNote",
        severity: "error",
      });
      throw error;
    }
  }

  async createCreditNote(
    creditNoteData: InsertCreditNote
  ): Promise<CreditNote> {
    try {
      console.log("Creating credit note with data:", creditNoteData);

      // Generate credit note number
      const creditNoteNumber = `CN-${Date.now()}`;

      // The InsertCreditNote type from schema.ts should be used.
      // If creditNoteData might contain fields not in InsertCreditNote (like projectId), they should be handled.
      const { projectId, ...validCreditNoteData } = creditNoteData as any; // Cast if necessary

      const insertData = {
        ...validCreditNoteData,
        creditNoteNumber, // Generated above
        // Ensure date fields are correctly formatted if they are part of InsertCreditNote and are strings
        creditNoteDate: validCreditNoteData.creditNoteDate
          ? new Date(validCreditNoteData.creditNoteDate)
              .toISOString()
              .split("T")[0]
          : new Date().toISOString().split("T")[0],
        // items should be handled by the schema type (e.g. JSON stringified if needed by Drizzle)
        items: validCreditNoteData.items
          ? typeof validCreditNoteData.items === "string"
            ? validCreditNoteData.items
            : JSON.stringify(validCreditNoteData.items)
          : JSON.stringify([]),
      };

      const result: CreditNote[] = await db
        .insert(creditNotes)
        .values(insertData)
        .returning();

      const createdCreditNote = result[0];
      console.log("Credit note created:", createdCreditNote);

      if (!createdCreditNote || !createdCreditNote.id) {
        throw new Error(
          "Failed to create credit note - no credit note record returned"
        );
      }

      // Get related invoice and customer information for GL entries
      // Ensure salesInvoiceId and customerId are numbers if they are not null/undefined
      const invoice = await this.getSalesInvoice(
        createdCreditNote.salesInvoiceId as number
      );
      const customer = await this.getCustomer(
        createdCreditNote.customerId as number
      );

      console.log("Retrieved invoice:", invoice);
      console.log("Retrieved customer:", customer);

      // Only create GL entries if status is "issued"
      if (createdCreditNote.status === "issued") {
        console.log(
          `Creating double-entry GL records for credit note ${
            createdCreditNote.id
          } - ${createdCreditNote.creditNoteNumber || "N/A"} - Amount: ${
            createdCreditNote.totalAmount
          }`
        );

        // Create double-entry accounting records for credit note

        // 1. Debit: Sales Returns and Allowances (contra-revenue account)
        try {
          const debitEntry = await this.createGeneralLedgerEntry({
            entryType: "receivable",
            referenceType: "credit_note",
            referenceId: createdCreditNote.id,
            accountName: "Sales Returns and Allowances",
            description: `Credit Note: ${
              createdCreditNote.creditNoteNumber || "N/A"
            } for Invoice: ${invoice?.invoiceNumber || "N/A"}`,
            debitAmount: createdCreditNote.totalAmount as string,
            creditAmount: "0",
            entityId: createdCreditNote.customerId as number,
            entityName: customer?.name || "Unknown Customer",
            projectId: invoice?.projectId || undefined,
            invoiceNumber: invoice?.invoiceNumber || undefined,
            transactionDate:
              createdCreditNote.creditNoteDate || // Already a string
              new Date().toISOString().split("T")[0],
            status: "issued",
          });

          console.log(
            `Successfully created debit entry (Sales Returns and Allowances):`,
            debitEntry
          );
        } catch (debitError) {
          console.error("Error creating debit GL entry:", debitError);
          throw new Error(
            `Failed to create debit GL entry: ${
              debitError instanceof Error
                ? debitError.message
                : String(debitError)
            }`
          );
        }

        // 2. Credit: Accounts Receivable (reduce what customer owes)
        try {
          const creditEntry = await this.createGeneralLedgerEntry({
            entryType: "receivable",
            referenceType: "credit_note",
            referenceId: createdCreditNote.id,
            accountName: "Accounts Receivable",
            description: `Credit Note: ${
              createdCreditNote.creditNoteNumber || "N/A"
            } for Invoice: ${invoice?.invoiceNumber || "N/A"}`,
            debitAmount: "0",
            creditAmount: createdCreditNote.totalAmount as string,
            entityId: createdCreditNote.customerId as number,
            entityName: customer?.name || "Unknown Customer",
            projectId: invoice?.projectId || undefined,
            invoiceNumber: invoice?.invoiceNumber || undefined,
            transactionDate:
              createdCreditNote.creditNoteDate ||
              new Date().toISOString().split("T")[0],
            status: "issued",
          });

          console.log(
            `Successfully created credit entry (Accounts Receivable):`,
            creditEntry
          );
        } catch (creditError) {
          console.error("Error creating credit GL entry:", creditError);
          throw new Error(
            `Failed to create credit GL entry: ${
              creditError instanceof Error
                ? creditError.message
                : String(creditError)
            }`
          );
        }

        console.log(
          `Successfully created 2 GL entries for credit note ${createdCreditNote.id}`
        );

        // Update the related sales invoice
        if (invoice) {
          await this.updateSalesInvoiceFromCreditNote(
            invoice.id,
            parseFloat(createdCreditNote.totalAmount as string)
          );

          // Create an invoice payment entry to show credit note application in payment history
          await this.createInvoicePaymentForCreditNote(
            invoice.id,
            createdCreditNote
          );
        }
      }

      return createdCreditNote;
    } catch (error: any) {
      // Preserve existing console.error and specific error logging structure
      console.error("Error creating credit note:", error);
      if (!error.isLogged) {
        // Avoid double logging if error is already from createErrorLog
        await this.createErrorLog({
          message: `Error in createCreditNote: ${
            error?.message || String(error)
          }. Context: ${JSON.stringify(creditNoteData)}`,
          stack: error?.stack,
          url: "server/storage.ts",
          severity: "error",
          component: "createCreditNote",
        });
      }
      throw error;
    }
  }

  async updateCreditNote(
    id: number,
    creditNoteData: Partial<InsertCreditNote>
  ): Promise<CreditNote | undefined> {
    try {
      // Get the current credit note before update
      const currentCreditNote = await this.getCreditNote(id);
      if (!currentCreditNote) {
        throw new Error(`Credit note ${id} not found`);
      }

      // Remove projectId from the data if present, as it's not in creditNotes table
      const { projectId, ...validCreditNoteData } = creditNoteData as any;

      const updateData: Partial<InsertCreditNote> = { ...validCreditNoteData };

      // Ensure date fields are correctly formatted
      if (validCreditNoteData.creditNoteDate) {
        updateData.creditNoteDate = new Date(validCreditNoteData.creditNoteDate)
          .toISOString()
          .split("T")[0];
      }
      // Handle items: stringify if it's an object and the field expects a string
      if (
        validCreditNoteData.items &&
        typeof validCreditNoteData.items !== "string"
      ) {
        updateData.items = JSON.stringify(validCreditNoteData.items);
      }

      const result: CreditNote[] = await db
        .update(creditNotes)
        .set(updateData)
        .where(eq(creditNotes.id, id))
        .returning();

      const updatedCreditNote = result[0];

      // If status changed to 'issued' and wasn't already issued, create double-entry GL records
      if (
        validCreditNoteData.status === "issued" &&
        currentCreditNote.status !== "issued" &&
        updatedCreditNote
      ) {
        try {
          // Get related invoice and customer information
          const invoice = await this.getSalesInvoice(
            updatedCreditNote.salesInvoiceId as number
          );
          const customer = await this.getCustomer(
            updatedCreditNote.customerId as number
          );

          if (customer) {
            const transactionDate =
              updatedCreditNote.creditNoteDate || // Already a string
              new Date().toISOString().split("T")[0];

            // Create double-entry GL records for credit note

            // 1. Debit: Sales Returns and Allowances (contra-revenue account)
            await this.createGeneralLedgerEntry({
              entryType: "receivable",
              referenceType: "credit_note",
              referenceId: updatedCreditNote.id,
              accountName: "Sales Returns and Allowances",
              description: `Credit Note: ${
                updatedCreditNote.creditNoteNumber || "N/A"
              } for Invoice: ${invoice?.invoiceNumber || "N/A"}`,
              debitAmount: updatedCreditNote.totalAmount as string,
              creditAmount: "0",
              entityId: customer.id,
              entityName: customer.name,
              projectId: invoice?.projectId || undefined,
              invoiceNumber: invoice?.invoiceNumber || undefined,
              transactionDate: transactionDate,
              status: "issued",
            });

            // 2. Credit: Accounts Receivable (reduce what customer owes)
            await this.createGeneralLedgerEntry({
              entryType: "receivable",
              referenceType: "credit_note",
              referenceId: updatedCreditNote.id,
              accountName: "Accounts Receivable",
              description: `Credit Note: ${
                updatedCreditNote.creditNoteNumber || "N/A"
              } for Invoice: ${invoice?.invoiceNumber || "N/A"}`,
              debitAmount: "0",
              creditAmount: updatedCreditNote.totalAmount as string,
              entityId: customer.id,
              entityName: customer.name,
              projectId: invoice?.projectId || undefined,
              invoiceNumber: invoice?.invoiceNumber || undefined,
              transactionDate: transactionDate,
              status: "issued",
            });

            console.log(
              `Created double-entry GL records for credit note ${updatedCreditNote.id}`
            );

            // Update the related sales invoice
            if (invoice) {
              await this.updateSalesInvoiceFromCreditNote(
                invoice.id,
                parseFloat(updatedCreditNote.totalAmount as string)
              );

              // Create an invoice payment entry to show credit note application in payment history
              await this.createInvoicePaymentForCreditNote(
                invoice.id,
                updatedCreditNote
              );
            }
          }
        } catch (glError) {
          console.error("Error creating GL entries for credit note:", glError);
          // Don't fail the entire request if GL entry creation fails
        }
      }

      return updatedCreditNote;
    } catch (error: any) {
      console.error("Original error in updateCreditNote:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in updateCreditNote (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateCreditNote",
        severity: "error",
      });
      throw error;
    }
  }

  async getCreditNotes(): Promise<CreditNoteWithDetails[]> {
    try {
      const result: CreditNoteWithDetails[] = await db
        .select({
          // All fields from CreditNote schema
          id: creditNotes.id,
          creditNoteNumber: creditNotes.creditNoteNumber,
          salesInvoiceId: creditNotes.salesInvoiceId,
          customerId: creditNotes.customerId,
          status: creditNotes.status,
          creditNoteDate: creditNotes.creditNoteDate,
          reason: creditNotes.reason,
          items: creditNotes.items,
          subtotal: creditNotes.subtotal,
          taxAmount: creditNotes.taxAmount,
          discount: creditNotes.discount,
          totalAmount: creditNotes.totalAmount,
          createdAt: creditNotes.createdAt,
          // Joined fields
          customerName: customers.name,
          invoiceNumber: salesInvoices.invoiceNumber,
        })
        .from(creditNotes)
        .leftJoin(customers, eq(creditNotes.customerId, customers.id))
        .leftJoin(
          salesInvoices,
          eq(creditNotes.salesInvoiceId, salesInvoices.id)
        )
        .orderBy(desc(creditNotes.createdAt));

      return result;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getCreditNotes: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getCreditNotes",
        severity: "error",
      });
      throw error;
    }
  }

  async createInvoicePaymentForCreditNote(
    invoiceId: number,
    creditNote: CreditNote
  ): Promise<InvoicePayment> {
    try {
      const paymentData: InsertInvoicePayment = {
        invoiceId: invoiceId,
        amount: creditNote.totalAmount as string,
        paymentDate: creditNote.creditNoteDate,
        paymentMethod: "Credit Note",
        referenceNumber: creditNote.creditNoteNumber,
        notes: `Credit note applied: ${creditNote.reason || "N/A"}`,
        paymentType: "credit_note",
        creditNoteId: creditNote.id,
        // recordedBy is optional in InsertInvoicePayment based on schema (nullable, no default)
      };

      // Ensure createInvoicePayment is awaited as it's an async function
      const payment = await this.createInvoicePayment(paymentData);
      return payment;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in createInvoicePaymentForCreditNote (invoiceId: ${invoiceId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createInvoicePaymentForCreditNote",
        severity: "error",
      });
      throw error;
    }
  }

  async updateSalesInvoiceFromCreditNote(
    invoiceId: number,
    creditNoteAmount: number
  ): Promise<SalesInvoice | undefined> {
    try {
      const invoice = await this.getSalesInvoice(invoiceId);
      if (!invoice) {
        throw new Error(`Sales invoice ${invoiceId} not found`);
      }

      const currentPaidAmount = parseFloat(invoice.paidAmount || "0");
      const newPaidAmount = currentPaidAmount + creditNoteAmount; // Credit note effectively "pays" this amount

      // Update invoice paid amount and status
      await this.updateInvoicePaidAmount(invoiceId); // This will recalculate status

      // Return the updated invoice
      return this.getSalesInvoice(invoiceId);
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateSalesInvoiceFromCreditNote (invoiceId: ${invoiceId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateSalesInvoiceFromCreditNote",
        severity: "error",
      });
      throw error;
    }
  }

  async getInvoicePayments(invoiceId: number): Promise<InvoicePayment[]> {
    try {
      const result = await db
        .select()
        .from(invoicePayments)
        .where(eq(invoicePayments.invoiceId, invoiceId))
        .orderBy(desc(invoicePayments.paymentDate));
      return result;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getInvoicePayments (invoiceId: ${invoiceId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getInvoicePayments",
        severity: "error",
      });
      throw error;
    }
  }

  async createInvoicePayment(
    paymentData: InsertInvoicePayment
  ): Promise<InvoicePayment> {
    try {
      console.log("Creating invoice payment with data:", paymentData);

      const result = await db
        .insert(invoicePayments)
        .values(paymentData)
        .returning();

      const payment = result[0];
      console.log("Payment created:", payment);

      if (!payment || !payment.id) {
        throw new Error(
          "Failed to create payment - no payment record returned"
        );
      }

      // Get invoice and customer information
      const invoice = await this.getSalesInvoice(paymentData.invoiceId);
      console.log("Retrieved invoice:", invoice);

      if (!invoice) {
        throw new Error(`Invoice with ID ${paymentData.invoiceId} not found`);
      }

      const customer = await this.getCustomer(invoice.customerId);
      console.log("Retrieved customer:", customer);

      console.log(
        `Creating double-entry GL records for payment ${
          payment.id
        } - Invoice: ${invoice.invoiceNumber || "N/A"} - Amount: ${
          payment.amount
        }`
      );

      // Create double-entry accounting records for payment

      // 1. Debit: Cash/Bank (increase asset - cash received)
      try {
        const debitEntry = await this.createGeneralLedgerEntry({
          entryType: "receivable",
          referenceType: "payment",
          referenceId: payment.id,
          accountName: "Cash/Bank",
          description: `Payment received for Invoice: ${
            invoice.invoiceNumber || "N/A"
          }`,
          debitAmount: payment.amount,
          creditAmount: "0",
          entityId: invoice.customerId,
          entityName: customer?.name || "Unknown Customer",
          projectId: invoice.projectId || undefined,
          invoiceNumber: invoice.invoiceNumber,
          transactionDate:
            payment.paymentDate || new Date().toISOString().split("T")[0],
          status: "paid",
        });

        console.log(
          `Successfully created debit entry (Cash/Bank):`,
          debitEntry
        );
      } catch (debitError) {
        console.error("Error creating debit GL entry:", debitError);
        throw new Error(
          `Failed to create debit GL entry: ${
            debitError instanceof Error
              ? debitError.message
              : String(debitError)
          }`
        );
      }

      // 2. Credit: Accounts Receivable (reduce asset - customer no longer owes this amount)
      try {
        const creditEntry = await this.createGeneralLedgerEntry({
          entryType: "receivable",
          referenceType: "payment",
          referenceId: payment.id,
          accountName: "Accounts Receivable",
          description: `Payment received for Invoice: ${
            invoice.invoiceNumber || "N/A"
          }`,
          debitAmount: "0",
          creditAmount: payment.amount,
          entityId: invoice.customerId,
          entityName: customer?.name || "Unknown Customer",
          projectId: invoice.projectId || undefined,
          invoiceNumber: invoice.invoiceNumber,
          transactionDate:
            payment.paymentDate || new Date().toISOString().split("T")[0],
          status: "paid",
        });

        console.log(
          `Successfully created credit entry (Accounts Receivable):`,
          creditEntry
        );
      } catch (creditError) {
        console.error("Error creating credit GL entry:", creditError);
        throw new Error(
          `Failed to create credit GL entry: ${
            creditError instanceof Error
              ? creditError.message
              : String(creditError)
          }`
        );
      }

      console.log(
        `Successfully created 2 GL entries for payment ${payment.id}`
      );

      // Update invoice paid amount and project revenue
      await this.updateInvoicePaidAmount(paymentData.invoiceId);

      return payment;
    } catch (error: any) {
      // Preserve existing console.error and specific error logging structure
      console.error("Error creating invoice payment:", error);
      if (!error.isLogged) {
        // Avoid double logging
        await this.createErrorLog({
          message: `Error in createInvoicePayment: ${
            error?.message || String(error)
          }. Context: ${JSON.stringify(paymentData)}`,
          stack: error?.stack,
          url: "server/storage.ts",
          severity: "error",
          component: "createInvoicePayment",
        });
      }
      throw error;
    }
  }

  // Sales Quotations pagination method
  async getSalesQuotationsPaginated(
    page: number,
    limit: number,
    filters?: {
      search?: string;
      status?: string;
      customerId?: number;
      archived?: boolean;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<PaginatedResponse<SalesQuotationWithCustomerName>> {
    try {
      const queryConditions = [];
      // Search filter
      if (filters?.search && filters.search.trim()) {
        queryConditions.push(
          or(
            like(salesQuotations.quotationNumber, `%${filters.search}%`),
            like(customers.name, `%${filters.search}%`)
          )
        );
      }
      // Customer filter
      if (filters?.customerId) {
        queryConditions.push(
          eq(salesQuotations.customerId, filters.customerId)
        );
      }
      // Date range filters
      if (filters?.startDate) {
        queryConditions.push(
          gte(salesQuotations.createdDate, new Date(filters.startDate))
        );
      }
      if (filters?.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        queryConditions.push(lte(salesQuotations.createdDate, endDate));
      }
      // Status filter
      if (filters?.status && filters.status !== "all") {
        queryConditions.push(eq(salesQuotations.status, filters.status));
      }
      // Archive filter
      if (filters?.archived !== undefined) {
        queryConditions.push(eq(salesQuotations.isArchived, filters.archived));
      }

      const finalConditions =
        queryConditions.length > 0 ? and(...queryConditions) : undefined;

      const dataQueryBuilder = db
        .select({
          id: salesQuotations.id,
          quotationNumber: salesQuotations.quotationNumber,
          customerId: salesQuotations.customerId,
          customerName: customers.name,
          status: salesQuotations.status,
          validUntil: salesQuotations.validUntil,
          paymentTerms: salesQuotations.paymentTerms,
          bankAccount: salesQuotations.bankAccount,
          billingAddress: salesQuotations.billingAddress,
          termsAndConditions: salesQuotations.termsAndConditions,
          remarks: salesQuotations.remarks,
          items: salesQuotations.items,
          subtotal: salesQuotations.subtotal,
          taxAmount: salesQuotations.taxAmount,
          discount: salesQuotations.discount,
          totalAmount: salesQuotations.totalAmount,
          isArchived: salesQuotations.isArchived,
          createdDate: salesQuotations.createdDate,
        })
        .from(salesQuotations)
        .leftJoin(customers, eq(salesQuotations.customerId, customers.id))
        .where(finalConditions)
        .orderBy(desc(salesQuotations.createdDate));

      const countQueryBuilder = db
        .select({ count: sql<number>`count(*)` })
        .from(salesQuotations)
        .leftJoin(customers, eq(salesQuotations.customerId, customers.id))
        .where(finalConditions);

      return this._getPaginatedResults<SalesQuotationWithCustomerName>(
        dataQueryBuilder,
        countQueryBuilder,
        page,
        limit
      );
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getSalesQuotationsPaginated: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getSalesQuotationsPaginated",
        severity: "error",
      });
      throw error;
    }
  }

  // Sales Invoices pagination method
  async getSalesInvoicesPaginated(
    page: number,
    limit: number,
    filters?: {
      status?: string;
      startDate?: string;
      endDate?: string;
      customerId?: number;
      projectId?: number;
    }
  ): Promise<{
    data: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const queryConditions = [];
      if (filters?.status && filters.status !== "all") {
        if (filters.status === "unpaid") {
          queryConditions.push(
            or(
              eq(salesInvoices.status, "unpaid"),
              eq(salesInvoices.status, "partially_paid"),
              eq(salesInvoices.status, "overdue")
            )
          );
        } else {
          queryConditions.push(eq(salesInvoices.status, filters.status));
        }
      }
      if (filters?.startDate) {
        queryConditions.push(gte(salesInvoices.invoiceDate, filters.startDate));
      }
      if (filters?.endDate) {
        queryConditions.push(lte(salesInvoices.invoiceDate, filters.endDate));
      }
      if (filters?.customerId) {
        queryConditions.push(eq(salesInvoices.customerId, filters.customerId));
      }
      if (filters?.projectId) {
        if (filters.projectId === -1) {
          queryConditions.push(isNull(salesInvoices.projectId));
        } else {
          queryConditions.push(eq(salesInvoices.projectId, filters.projectId));
        }
      }

      const finalConditions =
        queryConditions.length > 0 ? and(...queryConditions) : undefined;

      const dataQueryBuilder = db
        .select({
          id: salesInvoices.id,
          invoiceNumber: salesInvoices.invoiceNumber,
          customerId: salesInvoices.customerId,
          customerName: customers.name,
          projectId: salesInvoices.projectId,
          projectTitle: projects.title,
          quotationId: salesInvoices.quotationId,
          status: salesInvoices.status,
          invoiceDate: salesInvoices.invoiceDate,
          dueDate: salesInvoices.dueDate,
          paymentTerms: salesInvoices.paymentTerms,
          bankAccount: salesInvoices.bankAccount,
          remarks: salesInvoices.remarks,
          items: salesInvoices.items,
          subtotal: salesInvoices.subtotal,
          taxAmount: salesInvoices.taxAmount,
          discount: salesInvoices.discount,
          totalAmount: salesInvoices.totalAmount,
          paidAmount: salesInvoices.paidAmount,
        })
        .from(salesInvoices)
        .leftJoin(customers, eq(salesInvoices.customerId, customers.id))
        .leftJoin(projects, eq(salesInvoices.projectId, projects.id))
        .where(finalConditions)
        .orderBy(desc(salesInvoices.invoiceDate));

      const countQueryBuilder = db
        .select({ count: sql<number>`count(*)` })
        .from(salesInvoices)
        .leftJoin(customers, eq(salesInvoices.customerId, customers.id))
        .leftJoin(projects, eq(salesInvoices.projectId, projects.id))
        .where(finalConditions);

      return this._getPaginatedResults<any>( // Using any for TData due to custom select shape
        dataQueryBuilder,
        countQueryBuilder,
        page,
        limit
      );
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getSalesInvoicesPaginated: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getSalesInvoicesPaginated",
        severity: "error",
      });
      throw error;
    }
  }

  // General Ledger methods
  async getGeneralLedgerEntries(filters: {
    entryType?: string;
    referenceType?: string;
    entityId?: number;
    startDate?: string;
    endDate?: string;
    status?: string;
    projectId?: number;
    accountName?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 20;

      const conditionsArray: SQL[] = [];

      if (filters.entryType) {
        conditionsArray.push(
          eq(generalLedgerEntries.entryType, filters.entryType)
        );
      }
      if (filters.referenceType) {
        conditionsArray.push(
          eq(generalLedgerEntries.referenceType, filters.referenceType)
        );
      }
      if (filters.entityId) {
        conditionsArray.push(
          eq(generalLedgerEntries.entityId, filters.entityId)
        );
      }
      if (filters.startDate) {
        conditionsArray.push(
          gte(generalLedgerEntries.transactionDate, filters.startDate)
        );
      }
      if (filters.endDate) {
        conditionsArray.push(
          lte(generalLedgerEntries.transactionDate, filters.endDate)
        );
      }
      if (filters.status) {
        conditionsArray.push(eq(generalLedgerEntries.status, filters.status));
      }
      if (filters.projectId) {
        conditionsArray.push(
          eq(generalLedgerEntries.projectId, filters.projectId)
        );
      }
      if (filters.accountName) {
        conditionsArray.push(
          ilike(generalLedgerEntries.accountName, `%${filters.accountName}%`)
        );
      }
      if (filters.search) {
        conditionsArray.push(
          or(
            ilike(generalLedgerEntries.description, `%${filters.search}%`),
            ilike(generalLedgerEntries.entityName, `%${filters.search}%`),
            ilike(generalLedgerEntries.invoiceNumber, `%${filters.search}%`)
          )
        );
      }

      const finalConditions =
        conditionsArray.length > 0 ? and(...conditionsArray) : undefined;

      const dataQueryBuilder = db
        .select({
          id: generalLedgerEntries.id,
          entryType: generalLedgerEntries.entryType,
          referenceType: generalLedgerEntries.referenceType,
          referenceId: generalLedgerEntries.referenceId,
          accountName: generalLedgerEntries.accountName,
          description: generalLedgerEntries.description,
          debitAmount: generalLedgerEntries.debitAmount,
          creditAmount: generalLedgerEntries.creditAmount,
          entityId: generalLedgerEntries.entityId,
          entityName: generalLedgerEntries.entityName,
          projectId: generalLedgerEntries.projectId,
          projectTitle: projects.title, // Select title from joined projects table
          invoiceNumber: generalLedgerEntries.invoiceNumber,
          transactionDate: generalLedgerEntries.transactionDate,
          dueDate: generalLedgerEntries.dueDate,
          status: generalLedgerEntries.status,
          createdAt: generalLedgerEntries.createdAt,
          notes: generalLedgerEntries.notes,
        })
        .from(generalLedgerEntries)
        .leftJoin(projects, eq(generalLedgerEntries.projectId, projects.id)) // Join with projects
        .where(finalConditions)
        .orderBy(
          desc(generalLedgerEntries.transactionDate),
          desc(generalLedgerEntries.createdAt)
        );
      // .limit(limit) // Limit and offset will be applied by _getPaginatedResults
      // .offset(offset);

      const countQueryBuilder = db
        .select({ count: sql<number>`count(*)` })
        .from(generalLedgerEntries)
        .leftJoin(projects, eq(generalLedgerEntries.projectId, projects.id)) // Ensure join for count consistency if filters use joined table
        .where(finalConditions);

      return this._getPaginatedResults<any>( // Using 'any' for TData due to the custom select object
        dataQueryBuilder,
        countQueryBuilder,
        page,
        limit
      );
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getGeneralLedgerEntries: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getGeneralLedgerEntries",
        severity: "error",
      });
      throw error;
    }
  }

  async createGeneralLedgerEntry(entryData: {
    entryType: string;
    referenceType: string;
    referenceId?: number;
    accountName: string;
    description: string;
    debitAmount: string;
    creditAmount: string;
    entityId?: number;
    entityName?: string;
    projectId?: number;
    invoiceNumber?: string;
    transactionDate: string;
    dueDate?: string;
    status?: string;
    notes?: string;
    createdBy?: number;
  }): Promise<any> {
    try {
      console.log("Creating GL entry with data:", entryData);

      // Validate double-entry accounting rules
      const debitAmount = parseFloat(entryData.debitAmount || "0");
      const creditAmount = parseFloat(entryData.creditAmount || "0");

      // Ensure exactly one of debit or credit is non-zero (not both)
      if (debitAmount > 0 && creditAmount > 0) {
        throw new Error(
          "Double-entry violation: Both debit and credit amounts cannot be non-zero in a single entry"
        );
      }

      if (debitAmount === 0 && creditAmount === 0) {
        throw new Error(
          "Double-entry violation: Either debit or credit amount must be non-zero"
        );
      }

      // Ensure amounts are positive
      if (debitAmount < 0 || creditAmount < 0) {
        throw new Error(
          "Double-entry violation: Debit and credit amounts must be positive values"
        );
      }

      // Validate required fields for double-entry accounting
      if (!entryData.accountName || entryData.accountName.trim() === "") {
        throw new Error("Account name is required for general ledger entry");
      }

      if (!entryData.description || entryData.description.trim() === "") {
        throw new Error("Description is required for general ledger entry");
      }

      if (!entryData.transactionDate) {
        throw new Error(
          "Transaction date is required for general ledger entry"
        );
      }

      // Use the generalLedgerEntries table from schema instead of raw SQL
      const result = await db
        .insert(generalLedgerEntries)
        .values({
          entryType: entryData.entryType,
          referenceType: entryData.referenceType,
          referenceId: entryData.referenceId || null,
          accountName: entryData.accountName.trim(),
          description: entryData.description.trim(),
          debitAmount: debitAmount.toFixed(2),
          creditAmount: creditAmount.toFixed(2),
          entityId: entryData.entityId || null,
          entityName: entryData.entityName?.trim() || null,
          projectId: entryData.projectId || null,
          invoiceNumber: entryData.invoiceNumber?.trim() || null,
          transactionDate: entryData.transactionDate,
          dueDate: entryData.dueDate || null,
          status: entryData.status || "pending",
          notes: entryData.notes?.trim() || null,
          createdBy: entryData.createdBy || null,
        })
        .returning();

      console.log("GL entry created successfully:", result[0]);
      console.log(
        `Double-entry: ${debitAmount > 0 ? "DEBIT" : "CREDIT"} ${
          entryData.accountName
        } ${debitAmount > 0 ? debitAmount.toFixed(2) : creditAmount.toFixed(2)}`
      );

      // If this is a payable entry linked to a project, add to project costs
      if (entryData.entryType === "payable" && entryData.projectId) {
        const project = await this.getProject(entryData.projectId);
        if (project) {
          const currentCost = parseFloat(project.actualCost || "0");
          const additionalCost = parseFloat(entryData.creditAmount || "0");
          const newCost = currentCost + additionalCost;

          await this.updateProject(entryData.projectId, {
            actualCost: newCost.toFixed(2),
          });
        }
      }

      return result[0];
    } catch (error: any) {
      console.error("Original error in createGeneralLedgerEntry:", error); // Keep original console.error
      console.error("Entry data that failed:", entryData); // Keep original console.error
      await this.createErrorLog({
        message:
          "Error in createGeneralLedgerEntry: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createGeneralLedgerEntry",
        severity: "error",
      });
      throw error;
    }
  }

  // Helper method to create balanced journal entries for double-entry accounting
  async createJournalEntry(journalData: {
    referenceType: string;
    referenceId?: number;
    description: string;
    transactionDate: string;
    entries: Array<{
      accountName: string;
      debitAmount?: string;
      creditAmount?: string;
      entityId?: number;
      entityName?: string;
      projectId?: number;
      invoiceNumber?: string;
      notes?: string;
    }>;
    entryType?: string;
    dueDate?: string;
    status?: string;
    createdBy?: number;
  }): Promise<any[]> {
    try {
      console.log("Creating balanced journal entry with data:", journalData);

      // Validate that we have at least 2 entries (minimum for double-entry)
      if (!journalData.entries || journalData.entries.length < 2) {
        throw new Error(
          "Journal entry must have at least 2 account entries for double-entry accounting"
        );
      }

      // Validate that debits equal credits
      let totalDebits = 0;
      let totalCredits = 0;

      for (const entry of journalData.entries) {
        const debitAmount = parseFloat(entry.debitAmount || "0");
        const creditAmount = parseFloat(entry.creditAmount || "0");

        // Ensure only one of debit or credit is set per entry
        if (debitAmount > 0 && creditAmount > 0) {
          throw new Error(
            `Account ${entry.accountName}: Cannot have both debit and credit amounts in a single entry`
          );
        }

        if (debitAmount === 0 && creditAmount === 0) {
          throw new Error(
            `Account ${entry.accountName}: Must have either debit or credit amount`
          );
        }

        totalDebits += debitAmount;
        totalCredits += creditAmount;
      }

      // Verify accounting equation: Debits = Credits
      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        // Allow for small rounding differences
        throw new Error(
          `Journal entry is not balanced: Total debits (${totalDebits.toFixed(
            2
          )}) must equal total credits (${totalCredits.toFixed(2)})`
        );
      }

      console.log(
        `Creating balanced journal entry: Debits=${totalDebits.toFixed(
          2
        )}, Credits=${totalCredits.toFixed(2)}`
      );

      // Create all entries in the journal
      const createdEntries = [];
      for (const entry of journalData.entries) {
        const glEntry = await this.createGeneralLedgerEntry({
          entryType: journalData.entryType || "manual",
          referenceType: journalData.referenceType,
          referenceId: journalData.referenceId,
          accountName: entry.accountName,
          description: journalData.description,
          debitAmount: entry.debitAmount || "0",
          creditAmount: entry.creditAmount || "0",
          entityId: entry.entityId,
          entityName: entry.entityName,
          projectId: entry.projectId,
          invoiceNumber: entry.invoiceNumber,
          transactionDate: journalData.transactionDate,
          dueDate: journalData.dueDate,
          status: journalData.status,
          notes: entry.notes,
          createdBy: journalData.createdBy,
        });
        createdEntries.push(glEntry);
      }

      console.log(
        `Successfully created ${createdEntries.length} balanced journal entries`
      );
      return createdEntries;
    } catch (error: any) {
      console.error("Error in createJournalEntry:", error);
      await this.createErrorLog({
        message:
          "Error in createJournalEntry: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createJournalEntry",
        severity: "error",
      });
      throw error;
    }
  }

  async updateGeneralLedgerEntry(id: number, updateData: any): Promise<any> {
    try {
      // Build the update object with proper field mapping
      const updateFields: any = {};

      if (updateData.entryType !== undefined)
        updateFields.entryType = updateData.entryType;
      if (updateData.referenceType !== undefined)
        updateFields.referenceType = updateData.referenceType;
      if (updateData.referenceId !== undefined)
        updateFields.referenceId = updateData.referenceId;
      if (updateData.accountName !== undefined)
        updateFields.accountName = updateData.accountName;
      if (updateData.description !== undefined)
        updateFields.description = updateData.description;
      if (updateData.debitAmount !== undefined)
        updateFields.debitAmount = updateData.debitAmount;
      if (updateData.creditAmount !== undefined)
        updateFields.creditAmount = updateData.creditAmount;
      if (updateData.entityId !== undefined)
        updateFields.entityId = updateData.entityId;
      if (updateData.entityName !== undefined)
        updateFields.entityName = updateData.entityName;
      if (updateData.projectId !== undefined)
        updateFields.projectId = updateData.projectId;
      if (updateData.invoiceNumber !== undefined)
        updateFields.invoiceNumber = updateData.invoiceNumber;
      if (updateData.transactionDate !== undefined)
        updateFields.transactionDate = updateData.transactionDate;
      if (updateData.dueDate !== undefined)
        updateFields.dueDate = updateData.dueDate;
      if (updateData.status !== undefined)
        updateFields.status = updateData.status;
      if (updateData.notes !== undefined) updateFields.notes = updateData.notes;
      if (updateData.createdBy !== undefined)
        updateFields.createdBy = updateData.createdBy;

      if (Object.keys(updateFields).length === 0) {
        throw new Error("No fields to update");
      }

      const result = await db
        .update(generalLedgerEntries)
        .set(updateFields)
        .where(eq(generalLedgerEntries.id, id))
        .returning();

      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateGeneralLedgerEntry (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateGeneralLedgerEntry",
        severity: "error",
      });
      throw error;
    }
  }

  async getPayables(): Promise<any[]> {
    try {
      const result = await db
        .select({
          id: generalLedgerEntries.id,
          description: generalLedgerEntries.description,
          amount: generalLedgerEntries.creditAmount, // Aliasing credit_amount as amount
          supplierName: generalLedgerEntries.entityName, // Aliasing entity_name as supplierName
          projectId: generalLedgerEntries.projectId,
          projectTitle: projects.title, // Selecting from joined projects table
          invoiceNumber: generalLedgerEntries.invoiceNumber,
          transactionDate: generalLedgerEntries.transactionDate,
          dueDate: generalLedgerEntries.dueDate,
          status: generalLedgerEntries.status,
          createdAt: generalLedgerEntries.createdAt,
        })
        .from(generalLedgerEntries)
        .leftJoin(projects, eq(generalLedgerEntries.projectId, projects.id))
        .where(eq(generalLedgerEntries.entryType, "payable"))
        .orderBy(desc(generalLedgerEntries.transactionDate));

      return result;
    } catch (error: any) {
      await this.createErrorLog({
        message: "Error in getPayables: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPayables",
        severity: "error",
      });
      throw error;
    }
  }

  async getReceivables(): Promise<any[]> {
    try {
      const result = await db
        .select({
          id: generalLedgerEntries.id,
          description: generalLedgerEntries.description,
          amount: generalLedgerEntries.debitAmount, // Aliasing debit_amount as amount
          customerName: generalLedgerEntries.entityName, // Aliasing entity_name as customerName
          projectId: generalLedgerEntries.projectId,
          projectTitle: projects.title, // Selecting from joined projects table
          invoiceNumber: generalLedgerEntries.invoiceNumber,
          transactionDate: generalLedgerEntries.transactionDate,
          dueDate: generalLedgerEntries.dueDate,
          status: generalLedgerEntries.status,
          createdAt: generalLedgerEntries.createdAt,
        })
        .from(generalLedgerEntries)
        .leftJoin(projects, eq(generalLedgerEntries.projectId, projects.id))
        .where(eq(generalLedgerEntries.entryType, "receivable"))
        .orderBy(desc(generalLedgerEntries.transactionDate));

      return result;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getReceivables: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getReceivables",
        severity: "error",
      });
      throw error;
    }
  }

  // Sales Quotation methods
  async getSalesQuotation(id: number): Promise<SalesQuotation | undefined> {
    try {
      const result = await db
        .select()
        .from(salesQuotations)
        .where(eq(salesQuotations.id, id))
        .limit(1);
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getSalesQuotation (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getSalesQuotation",
        severity: "error",
      });
      throw error;
    }
  }

  async createSalesQuotation(
    quotationData: InsertSalesQuotation
  ): Promise<SalesQuotation> {
    try {
      const result = await db
        .insert(salesQuotations)
        .values(quotationData)
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createSalesQuotation: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createSalesQuotation",
        severity: "error",
      });
      throw error;
    }
  }

  async updateSalesQuotation(
    id: number,
    quotationData: Partial<InsertSalesQuotation>
  ): Promise<SalesQuotation | undefined> {
    try {
      const result = await db
        .update(salesQuotations)
        .set(quotationData)
        .where(eq(salesQuotations.id, id))
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateSalesQuotation (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateSalesQuotation",
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
          eq(inventoryTransactions.itemId, inventoryItems.id)
        )
        .where(eq(inventoryTransactions.type, "outflow"))
        .orderBy(
          inventoryTransactions.reference, // Order to help with grouping
          inventoryTransactions.projectId, // Order to help with grouping
          users.username, // Order to help with grouping
          projects.title, // Order to help with grouping
          inventoryTransactions.id // Mimics ORDER BY it.id for items array
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
    userId?: number
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
            `Inventory item with ID ${item.inventoryItemId} not found.`
          );
        }

        // Check stock availability
        if (inventoryItem.currentStock < item.quantity) {
          throw new Error(
            `Insufficient stock for item ID ${item.inventoryItemId} (${inventoryItem.name}). Available: ${inventoryItem.currentStock}, Requested: ${item.quantity}`
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
          `Updated inventory item ${item.inventoryItemId} stock from ${inventoryItem.currentStock} to ${newStock}`
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

  // Asset Types methods
  async getAssetTypes(): Promise<any[]> {
    try {
      const assetTypesWithCounts = await db
        .select({
          id: assetTypes.id,
          name: assetTypes.name,
          category: assetTypes.category,
          description: assetTypes.description,
          manufacturer: assetTypes.manufacturer,
          model: assetTypes.model,
          specifications: assetTypes.specifications,
          defaultDailyRentalRate: assetTypes.defaultDailyRentalRate,
          depreciationRate: assetTypes.depreciationRate,
          warrantyPeriodMonths: assetTypes.warrantyPeriodMonths,
          maintenanceIntervalDays: assetTypes.maintenanceIntervalDays,
          totalQuantity: assetTypes.totalQuantity,
          availableQuantity: assetTypes.availableQuantity,
          assignedQuantity: assetTypes.assignedQuantity,
          maintenanceQuantity: assetTypes.maintenanceQuantity,
          isActive: assetTypes.isActive,
          createdAt: assetTypes.createdAt,
        })
        .from(assetTypes)
        .where(eq(assetTypes.isActive, true))
        .orderBy(assetTypes.name);

      return assetTypesWithCounts;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getAssetTypes: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getAssetTypes",
        severity: "error",
      });
      throw error;
    }
  }

  async createAssetType(assetTypeData: any): Promise<any> {
    try {
      const result = await db
        .insert(assetTypes)
        .values({
          ...assetTypeData,
          totalQuantity: 0,
          availableQuantity: 0,
          assignedQuantity: 0,
          maintenanceQuantity: 0,
          isActive: true,
        })
        .returning();

      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createAssetType: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createAssetType",
        severity: "error",
      });
      throw error;
    }
  }

  async updateAssetType(id: number, assetTypeData: any): Promise<any> {
    try {
      const result = await db
        .update(assetTypes)
        .set(assetTypeData)
        .where(eq(assetTypes.id, id))
        .returning();

      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateAssetType (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateAssetType",
        severity: "error",
      });
      throw error;
    }
  }

  // Goods Receipt methods
  async getGoodsReceipts(): Promise<GoodsReceiptDetails[]> {
    try {
      const flatTransactions: Array<{
        transactionId: number;
        reference: string | null;
        timestamp: Date;
        createdByName: string | null;
        inventoryItemName: string | null;
        quantity: number;
        unit: string | null;
        unitCost: string | null; // Assuming unitCost from inventory_transactions is string or can be converted
      }> = await db
        .select({
          transactionId: inventoryTransactions.id,
          reference: inventoryTransactions.reference,
          timestamp: inventoryTransactions.timestamp,
          // projectId: inventoryTransactions.projectId, // Not in original SQL group by or select
          // projectTitle: projects.title, // Not in original SQL group by or select
          createdById: inventoryTransactions.createdBy,
          createdByName: users.username,
          inventoryItemId: inventoryItems.id,
          inventoryItemName: inventoryItems.name,
          quantity: inventoryTransactions.quantity,
          unit: inventoryItems.unit,
          unitCost: inventoryTransactions.unitCost, // unit_cost is from inventory_transactions
        })
        .from(inventoryTransactions)
        // .leftJoin(projects, eq(inventoryTransactions.projectId, projects.id)) // Not in original
        .leftJoin(users, eq(inventoryTransactions.createdBy, users.id))
        .leftJoin(
          inventoryItems,
          eq(inventoryTransactions.itemId, inventoryItems.id)
        )
        .where(eq(inventoryTransactions.type, "inflow"))
        .orderBy(
          inventoryTransactions.reference, // Order to help with grouping
          users.username, // Order to help with grouping
          inventoryTransactions.id // Mimics ORDER BY it.id for items array
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
            projectId: null, // As per original SQL
            projectTitle: null, // As per original SQL
            createdByName: t.createdByName,
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
    userId?: number
  ): Promise<CreatedGoodsReceipt> {
    try {
      console.log("Creating goods receipt:", { reference, items, userId });

      const createdTransactions = [];

      for (const item of items) {
        // Get inventory item details
        const inventoryItem = await this.getInventoryItem(item.inventoryItemId);
        if (!inventoryItem) {
          throw new Error(
            `Inventory item with ID ${item.inventoryItemId} not found.`
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

        // Update inventory item stock and average cost
        const newStock = inventoryItem.currentStock + item.quantity;
        const currentValue =
          inventoryItem.currentStock * parseFloat(inventoryItem.avgCost || "0");
        const newValue = currentValue + item.quantity * item.unitCost;
        const newAvgCost =
          newStock > 0 ? (newValue / newStock).toFixed(4) : "0";

        await this.updateInventoryItem(item.inventoryItemId, {
          currentStock: newStock,
          avgCost: newAvgCost,
        });

        console.log(
          `Updated inventory item ${item.inventoryItemId} stock from ${inventoryItem.currentStock} to ${newStock}, avg cost: ${newAvgCost}`
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

  // Error Log methods
  async createErrorLog(errorData: {
    message: string;
    stack?: string;
    url?: string;
    userAgent?: string;
    userId?: number;
    severity?: string;
    component?: string;
  }): Promise<any> {
    try {
      const result = await db
        .insert(errorLogs)
        .values({
          message: errorData.message,
          stack: errorData.stack || null,
          url: errorData.url || null,
          userAgent: errorData.userAgent || null,
          userId: errorData.userId || null,
          severity: errorData.severity || "error",
          component: errorData.component || null,
          resolved: false,
        })
        .returning();
      return result[0];
    } catch (error) {
      // Don't throw here to avoid recursive errors when DB is down
      console.error("Error creating error log:", error);
      return null;
    }
  }

  async getErrorLogs(
    page: number = 1,
    limit: number = 20,
    severity?: string,
    resolved?: string
  ): Promise<{
    data: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const queryConditions = [];
      if (severity && severity !== "all") {
        queryConditions.push(eq(errorLogs.severity, severity));
      }
      if (resolved !== undefined && resolved !== "all") {
        // Check for undefined explicitly
        queryConditions.push(eq(errorLogs.resolved, resolved === "true"));
      }

      const finalConditions =
        queryConditions.length > 0 ? and(...queryConditions) : undefined;

      const dataQueryBuilder = db
        .select({
          id: errorLogs.id,
          message: errorLogs.message,
          stack: errorLogs.stack,
          url: errorLogs.url,
          userAgent: errorLogs.userAgent,
          userId: errorLogs.userId,
          userName: users.username,
          timestamp: errorLogs.timestamp,
          severity: errorLogs.severity,
          component: errorLogs.component,
          resolved: errorLogs.resolved,
        })
        .from(errorLogs)
        .leftJoin(users, eq(errorLogs.userId, users.id))
        .where(finalConditions)
        .orderBy(desc(errorLogs.timestamp));

      // Count query needs to join as well if conditions depend on joined table,
      // though in this case, `users.username` is not part of filters.
      // For consistency, joining for count if data query joins.
      const countQueryBuilder = db
        .select({ count: sql<number>`count(*)` })
        .from(errorLogs)
        .leftJoin(users, eq(errorLogs.userId, users.id)) // Added join here for count
        .where(finalConditions);

      return this._getPaginatedResults<any>( // Using any for TData due to custom select shape
        dataQueryBuilder,
        countQueryBuilder,
        page,
        limit
      );
    } catch (error) {
      console.error("Error getting error logs paginated:", error);
      throw error;
    }
  }

  async updateErrorLog(id: number, data: { resolved?: boolean }): Promise<any> {
    try {
      const result = await db
        .update(errorLogs)
        .set(data)
        .where(eq(errorLogs.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating error log:", error);
    }
  }

  async clearErrorLogs(): Promise<number> {
    try {
      const result = await db.delete(errorLogs);
      return result.rowCount || 0;
    } catch (error) {
      console.error("Error clearing error logs:", error);
      throw error;
    }
  }

  async clearResolvedErrorLogs(): Promise<number> {
    try {
      const result = await db
        .delete(errorLogs)
        .where(eq(errorLogs.resolved, true));
      return result.rowCount || 0;
    } catch (error) {
      console.error("Error clearing resolved error logs:", error);
      throw error;
    }
  }

  // Project Asset Assignment methods // THIS IS THE SECOND BLOCK OF ASSET ASSIGNMENT METHODS
  async getProjectAssetAssignments(
    projectId: number
  ): Promise<ProjectAssetAssignmentWithAssetInfo[]> {
    try {
      const assignments: ProjectAssetAssignmentWithAssetInfo[] = await db
        .select({
          id: projectAssetAssignments.id,
          projectId: projectAssetAssignments.projectId,
          assetId: projectAssetAssignments.assetId,
          startDate: projectAssetAssignments.startDate,
          endDate: projectAssetAssignments.endDate,
          monthlyRate: projectAssetAssignments.monthlyRate,
          totalCost: projectAssetAssignments.totalCost,
          assignedAt: projectAssetAssignments.assignedAt,
          assetName: assetTypes.name,
          assetCode: assetInventoryInstances.serialNumber,
        })
        .from(projectAssetAssignments)
        .leftJoin(
          assetInventoryInstances,
          eq(projectAssetAssignments.assetId, assetInventoryInstances.id)
        )
        .leftJoin(
          assetTypes,
          eq(assetInventoryInstances.assetTypeId, assetTypes.id)
        )
        .where(eq(projectAssetAssignments.projectId, projectId))
        .orderBy(desc(projectAssetAssignments.assignedAt));

      return assignments;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getProjectAssetAssignments (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getProjectAssetAssignments (second block)",
        severity: "error",
      });
      throw error;
    }
  }

  async createProjectAssetAssignment(
    assignmentData: InsertProjectAssetAssignment
  ): Promise<ProjectAssetAssignment> {
    try {
      const result = await db
        .insert(projectAssetAssignments)
        .values(assignmentData)
        .returning();

      const assignment = result[0];

      // Update asset status to assigned
      await this.updateAssetInventoryInstance(assignment.assetId, {
        status: "in_use",
      });

      // Calculate and update total cost if start and end dates are provided
      if (
        assignment.startDate &&
        assignment.endDate &&
        assignment.monthlyRate
      ) {
        const totalCost = await this.calculateAssetRentalCost(
          new Date(assignment.startDate),
          new Date(assignment.endDate),
          parseFloat(assignment.monthlyRate.toString())
        );

        await db
          .update(projectAssetAssignments)
          .set({ totalCost: totalCost.toString() })
          .where(eq(projectAssetAssignments.id, assignment.id));
      }

      // Recalculate project cost
      await this.recalculateProjectCost(assignment.projectId);

      return assignment;
    } catch (error: any) {
      console.error(
        "Original error in createProjectAssetAssignment (second block):",
        error
      ); // Keep original console.error
      await this.createErrorLog({
        message:
          "Error in createProjectAssetAssignment (second block): " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createProjectAssetAssignment (second block)",
        severity: "error",
      });
      throw error;
    }
  }

  async updateProjectAssetAssignment(
    id: number,
    assignmentData: Partial<InsertProjectAssetAssignment>
  ): Promise<ProjectAssetAssignment | undefined> {
    try {
      const result = await db
        .update(projectAssetAssignments)
        .set(assignmentData)
        .where(eq(projectAssetAssignments.id, id))
        .returning();

      const assignment = result[0];

      if (assignment) {
        // Recalculate total cost if dates or daily rate changed
        if (
          assignment.startDate &&
          assignment.endDate &&
          assignment.monthlyRate &&
          (assignmentData.startDate ||
            assignmentData.endDate ||
            assignmentData.monthlyRate)
        ) {
          const totalCost = await this.calculateAssetRentalCost(
            new Date(assignment.startDate),
            new Date(assignment.endDate),
            parseFloat(assignment.monthlyRate.toString())
          );

          await db
            .update(projectAssetAssignments)
            .set({ totalCost: totalCost.toString() })
            .where(eq(projectAssetAssignments.id, id));
        }

        // Recalculate project cost
        await this.recalculateProjectCost(assignment.projectId);
      }

      return assignment;
    } catch (error: any) {
      console.error(
        "Original error in updateProjectAssetAssignment (second block):",
        error
      ); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in updateProjectAssetAssignment (second block, id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateProjectAssetAssignment (second block)",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteProjectAssetAssignment(id: number): Promise<boolean> {
    try {
      // Get assignment info before deletion
      const assignment = await db
        .select()
        .from(projectAssetAssignments)
        .where(eq(projectAssetAssignments.id, id))
        .limit(1);

      if (assignment.length === 0) {
        return false;
      }

      const assetId = assignment[0].assetId;
      const projectId = assignment[0].projectId;

      // Delete the assignment
      const result = await db
        .delete(projectAssetAssignments)
        .where(eq(projectAssetAssignments.id, id));

      if (result.rowCount && result.rowCount > 0) {
        // Update asset status based on remaining assignments
        await this.updateAssetStatusBasedOnAssignments(assetId);

        // Recalculate project cost
        await this.recalculateProjectCost(projectId);

        return true;
      }

      return false;
    } catch (error: any) {
      console.error(
        "Original error in deleteProjectAssetAssignment (second block):",
        error
      ); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in deleteProjectAssetAssignment (second block, id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteProjectAssetAssignment (second block)",
        severity: "error",
      });
      throw error;
    }
  }

  async calculateAssetRentalCost(
    // This is the second calculateAssetRentalCost
    startDate: Date,
    endDate: Date,
    monthlyRate: number
  ): Promise<number> {
    try {
      // Calculate pro-rated cost based on days utilized * (Monthly rent / days in that month)
      // If usage spans multiple months, calculate cost for each month separately

      let totalCost = 0;
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        // Get the first and last day of the current month
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const daysInMonth = lastDayOfMonth.getDate();

        // Determine the start and end of the period within this month
        const periodStart = currentDate >= startDate ? currentDate : startDate;
        const periodEnd = endDate <= lastDayOfMonth ? endDate : lastDayOfMonth;

        // Calculate days used in this month (inclusive of both start and end dates)
        const diffTime = periodEnd.getTime() - periodStart.getTime();
        const daysUsedInMonth = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        // Calculate pro-rated cost for this month
        const dailyRateForMonth = monthlyRate / daysInMonth;
        const costForMonth = daysUsedInMonth * dailyRateForMonth;

        totalCost += costForMonth;

        // Move to the first day of the next month
        currentDate.setMonth(currentDate.getMonth() + 1);
        currentDate.setDate(1);
      }

      return totalCost;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in calculateAssetRentalCost (second block): " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "calculateAssetRentalCost (second block)",
        severity: "error",
      });
      throw error;
    }
  }

  async getAssetAssignmentHistory(assetId: number): Promise<any[]> {
    try {
      const history: AssetAssignmentHistoryEntry[] = await db
        .select({
          id: projectAssetAssignments.id,
          projectId: projectAssetAssignments.projectId,
          projectTitle: projects.title,
          startDate: projectAssetAssignments.startDate,
          endDate: projectAssetAssignments.endDate,
          monthlyRate: projectAssetAssignments.monthlyRate,
          totalCost: projectAssetAssignments.totalCost,
          assignedAt: projectAssetAssignments.assignedAt,
        })
        .from(projectAssetAssignments)
        .leftJoin(projects, eq(projectAssetAssignments.projectId, projects.id))
        .where(eq(projectAssetAssignments.assetId, assetId))
        .orderBy(desc(projectAssetAssignments.assignedAt));

      return history;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getAssetAssignmentHistory (second block, assetId: ${assetId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getAssetAssignmentHistory (second block)",
        severity: "error",
      });
      throw error;
    }
  }

  async getAllAssetAssignments(): Promise<AllAssetAssignmentsEntry[]> {
    try {
      const assignments: AllAssetAssignmentsEntry[] = await db
        .select({
          id: projectAssetAssignments.id,
          projectId: projectAssetAssignments.projectId,
          projectTitle: projects.title,
          assetId: projectAssetAssignments.assetId,
          assetName: assetTypes.name,
          assetCode: assets.assetTag,
          startDate: projectAssetAssignments.startDate,
          endDate: projectAssetAssignments.endDate,
          monthlyRate: projectAssetAssignments.monthlyRate,
          totalCost: projectAssetAssignments.totalCost,
          assignedAt: projectAssetAssignments.assignedAt,
        })
        .from(projectAssetAssignments)
        .leftJoin(projects, eq(projectAssetAssignments.projectId, projects.id))
        .leftJoin(assets, eq(projectAssetAssignments.assetId, assets.id))
        .leftJoin(assetTypes, eq(assets.assetTypeId, assetTypes.id))
        .orderBy(desc(projectAssetAssignments.assignedAt));

      return assignments;
    } catch (error: any) {
      console.error("Error in getAllAssetAssignments:", error);
      throw error;
    }
  }

  async updateAssetStatusBasedOnAssignments(assetId: number): Promise<void> {
    try {
      // Get current assignments for this asset
      const currentAssignments = await db
        .select()
        .from(projectAssetAssignments)
        .where(
          and(
            eq(projectAssetAssignments.assetId, assetId),
            or(
              isNull(projectAssetAssignments.endDate),
              gte(projectAssetAssignments.endDate, new Date())
            )
          )
        );

      // Update asset status based on assignments
      const newStatus =
        currentAssignments.length > 0 ? "assigned" : "available";

      await this.updateAsset(assetId, { status: newStatus });

      console.log(
        `Updated asset ${assetId} status to ${newStatus} based on ${currentAssignments.length} active assignments`
      );
    } catch (error: any) {
      console.error(
        "Original error in updateAssetStatusBasedOnAssignments (second block):",
        error
      ); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in updateAssetStatusBasedOnAssignments (second block, assetId: ${assetId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateAssetStatusBasedOnAssignments (second block)",
        severity: "error",
      });
      throw error;
    }
  }

  // Method to update all asset statuses (useful for maintenance/cron jobs)
  async updateAllAssetStatuses(): Promise<void> {
    try {
      const allAssets = await this.getAssets();

      for (const asset of allAssets) {
        await this.updateAssetStatusBasedOnAssignments(asset.id);
      }

      console.log(`Updated status for ${allAssets.length} assets`);
    } catch (error: any) {
      console.error("Original error in updateAllAssetStatuses:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          "Error in updateAllAssetStatuses: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateAllAssetStatuses",
        severity: "error",
      });
      throw error;
    }
  }

  // Proforma Invoice methods
  async getProformaInvoices(): Promise<any[]> {
    try {
      const result = await db
        .select({
          id: proformaInvoices.id,
          proformaNumber: proformaInvoices.proformaNumber,
          customerId: proformaInvoices.customerId,
          customerName: customers.name,
          projectId: proformaInvoices.projectId,
          status: proformaInvoices.status,
          createdDate: proformaInvoices.createdDate,
          validUntil: proformaInvoices.validUntil,
          paymentTerms: proformaInvoices.paymentTerms,
          deliveryTerms: proformaInvoices.deliveryTerms,
          remarks: proformaInvoices.remarks,
          items: proformaInvoices.items,
          subtotal: proformaInvoices.subtotal,
          taxAmount: proformaInvoices.taxAmount,
          discount: proformaInvoices.discount,
          totalAmount: proformaInvoices.totalAmount,
          isArchived: proformaInvoices.isArchived,
        })
        .from(proformaInvoices)
        .leftJoin(customers, eq(proformaInvoices.customerId, customers.id))
        .orderBy(desc(proformaInvoices.createdDate));

      return result;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getProformaInvoices: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getProformaInvoices",
        severity: "error",
      });
      throw error;
    }
  }

  async getProformaInvoice(id: number): Promise<any | undefined> {
    try {
      const result = await db
        .select({
          id: proformaInvoices.id,
          proformaNumber: proformaInvoices.proformaNumber,
          customerId: proformaInvoices.customerId,
          customerName: customers.name,
          projectId: proformaInvoices.projectId,
          status: proformaInvoices.status,
          createdDate: proformaInvoices.createdDate,
          validUntil: proformaInvoices.validUntil,
          paymentTerms: proformaInvoices.paymentTerms,
          deliveryTerms: proformaInvoices.deliveryTerms,
          remarks: proformaInvoices.remarks,
          items: proformaInvoices.items,
          subtotal: proformaInvoices.subtotal,
          taxAmount: proformaInvoices.taxAmount,
          discount: proformaInvoices.discount,
          totalAmount: proformaInvoices.totalAmount,
          isArchived: proformaInvoices.isArchived,
        })
        .from(proformaInvoices)
        .leftJoin(customers, eq(proformaInvoices.customerId, customers.id))
        .where(eq(proformaInvoices.id, id))
        .limit(1);

      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getProformaInvoice (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getProformaInvoice",
        severity: "error",
      });
      throw error;
    }
  }

  async createProformaInvoice(proformaData: any): Promise<any> {
    try {
      console.log(
        "Storage: Creating proforma invoice with data:",
        proformaData
      );

      // Generate proforma number
      const proformaNumber = `PI-${Date.now()}`;

      // Prepare the data
      const insertData = {
        proformaNumber,
        customerId: proformaData.customerId,
        projectId: proformaData.projectId || null,
        quotationId: proformaData.quotationId || null,
        status: proformaData.status || "draft",
        validUntil: proformaData.validUntil
          ? new Date(proformaData.validUntil)
          : null,
        paymentTerms: proformaData.paymentTerms || null,
        deliveryTerms: proformaData.deliveryTerms || null,
        remarks: proformaData.remarks || null,
        items: JSON.stringify(proformaData.items || []),
        subtotal: proformaData.subtotal || null,
        taxAmount: proformaData.taxAmount || null,
        discount: proformaData.discount || "0",
        totalAmount: proformaData.totalAmount || null,
        isArchived: false,
      };

      console.log("Storage: Insert data:", insertData);

      const result = await db
        .insert(proformaInvoices)
        .values(insertData)
        .returning();

      console.log("Storage: Created proforma invoice:", result[0]);
      return result[0];
    } catch (error: any) {
      console.error("Original error in createProformaInvoice:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          "Error in createProformaInvoice: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createProformaInvoice",
        severity: "error",
      });
      throw error;
    }
  }

  async updateProformaInvoice(
    id: number,
    proformaData: any
  ): Promise<any | undefined> {
    try {
      console.log(
        "Storage: Updating proforma invoice",
        id,
        "with data:",
        proformaData
      );

      // Get existing proforma to preserve data that's not being updated
      const existing = await this.getProformaInvoice(id);
      if (!existing) {
        throw new Error(`Proforma invoice with ID ${id} not found`);
      }

      // Prepare the update data, only updating fields that are provided
      const updateData: any = {};

      if (proformaData.customerId !== undefined)
        updateData.customerId = proformaData.customerId;
      if (proformaData.projectId !== undefined)
        updateData.projectId = proformaData.projectId || null;
      if (proformaData.quotationId !== undefined)
        updateData.quotationId = proformaData.quotationId || null;
      if (proformaData.status !== undefined)
        updateData.status = proformaData.status;
      if (proformaData.invoiceDate !== undefined)
        updateData.invoiceDate = proformaData.invoiceDate
          ? new Date(proformaData.invoiceDate)
          : null;
      if (proformaData.validUntil !== undefined)
        updateData.validUntil = proformaData.validUntil
          ? new Date(proformaData.validUntil)
          : null;
      if (proformaData.paymentTerms !== undefined)
        updateData.paymentTerms = proformaData.paymentTerms || null;
      if (proformaData.deliveryTerms !== undefined)
        updateData.deliveryTerms = proformaData.deliveryTerms || null;
      if (proformaData.remarks !== undefined)
        updateData.remarks = proformaData.remarks || null;
      if (proformaData.items !== undefined)
        updateData.items = JSON.stringify(proformaData.items || []);
      if (proformaData.subtotal !== undefined)
        updateData.subtotal = proformaData.subtotal || null;
      if (proformaData.taxAmount !== undefined) updateData.taxAmount || null;
      if (proformaData.discount !== undefined)
        updateData.discount = proformaData.discount || "0";
      if (proformaData.totalAmount !== undefined)
        updateData.totalAmount = proformaData.totalAmount || null;
      if (proformaData.isArchived !== undefined)
        updateData.isArchived = proformaData.isArchived || false;

      console.log("Storage: Update data after filtering:", updateData);

      const result = await db
        .update(proformaInvoices)
        .set(updateData)
        .where(eq(proformaInvoices.id, id))
        .returning();

      console.log("Storage: Updated proforma invoice:", result[0]);
      return result[0];
    } catch (error: any) {
      console.error("Original error in updateProformaInvoice:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in updateProformaInvoice (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateProformaInvoice",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteProformaInvoice(id: number): Promise<void> {
    try {
      await db.delete(proformaInvoices).where(eq(proformaInvoices.id, id));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deleteProformaInvoice (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteProformaInvoice",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteCreditNote(id: number): Promise<boolean> {
    // This is for sales credit notes
    try {
      const result = await db.delete(creditNotes).where(eq(creditNotes.id, id));
      return result.rowCount > 0;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deleteCreditNote (sales, id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteCreditNote",
        severity: "error",
      });
      throw error;
    }
  }

  async getCreditNotesByInvoice(invoiceId: number): Promise<any[]> {
    try {
      const result = await db
        .select()
        .from(creditNotes)
        .where(eq(creditNotes.salesInvoiceId, invoiceId))
        .orderBy(desc(creditNotes.createdAt));

      return result;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getCreditNotesByInvoice (invoiceId: ${invoiceId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getCreditNotesByInvoice",
        severity: "error",
      });
      throw error;
    }
  }

  async createInvoicePaymentForCreditNote(
    invoiceId: number,
    creditNote: CreditNote
  ): Promise<InvoicePayment> {
    try {
      const paymentData: InsertInvoicePayment = {
        invoiceId: invoiceId,
        amount: creditNote.totalAmount as string,
        paymentDate: creditNote.creditNoteDate,
        paymentMethod: "Credit Note",
        referenceNumber: creditNote.creditNoteNumber,
        notes: `Credit note applied: ${creditNote.reason || "N/A"}`,
        paymentType: "credit_note",
        creditNoteId: creditNote.id,
        // recordedBy is optional in InsertInvoicePayment based on schema (nullable, no default)
      };

      // Ensure createInvoicePayment is awaited as it's an async function
      const payment = await this.createInvoicePayment(paymentData);
      return payment;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in createInvoicePaymentForCreditNote (invoiceId: ${invoiceId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createInvoicePaymentForCreditNote",
        severity: "error",
      });
      throw error;
    }
  }

  async updateSalesInvoiceFromCreditNote(
    invoiceId: number,
    creditNoteAmount: number
  ): Promise<SalesInvoice | undefined> {
    try {
      const invoice = await this.getSalesInvoice(invoiceId);
      if (!invoice) {
        throw new Error(`Sales invoice ${invoiceId} not found`);
      }

      const currentPaidAmount = parseFloat(invoice.paidAmount || "0");
      const newPaidAmount = currentPaidAmount + creditNoteAmount; // Credit note effectively "pays" this amount

      // Update invoice paid amount and status
      await this.updateInvoicePaidAmount(invoiceId); // This will recalculate status

      // Return the updated invoice
      return this.getSalesInvoice(invoiceId);
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateSalesInvoiceFromCreditNote (invoiceId: ${invoiceId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateSalesInvoiceFromCreditNote",
        severity: "error",
      });
      throw error;
    }
  }

  // Purchase Request methods
  async getPurchaseRequests(): Promise<any[]> {
    try {
      const approver = alias(employees, "approver");
      const result = await db
        .select({
          id: purchaseRequests.id,
          requestNumber: purchaseRequests.requestNumber,
          requestedBy: purchaseRequests.requestedBy,
          requestedByName: sql<string>`COALESCE(CONCAT(employees.first_name, ' ', employees.last_name), 'Unknown')`,
          status: purchaseRequests.status,
          urgency: purchaseRequests.urgency,
          reason: purchaseRequests.reason,
          requestDate: purchaseRequests.requestDate,
          approvedBy: purchaseRequests.approvedBy,
          approvedByName: sql<string>`COALESCE(CONCAT(approver.first_name, ' ', approver.last_name), '')`,
          approvalDate: purchaseRequests.approvalDate,
        })
        .from(purchaseRequests)
        .leftJoin(employees, eq(purchaseRequests.requestedBy, employees.id))
        .leftJoin(approver, eq(purchaseRequests.approvedBy, employees.id))
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
              quantity: purchaseRequestItems.quantity,
              notes: purchaseRequestItems.notes,
            })
            .from(purchaseRequestItems)
            .leftJoin(
              inventoryItems,
              eq(purchaseRequestItems.inventoryItemId, inventoryItems.id)
            )
            .where(eq(purchaseRequestItems.requestId, request.id));

          return {
            ...request,
            items,
          };
        })
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
      const emp = alias(employees, "emp");
      const approver = alias(employees, "approver");
      const [request] = await db
        .select({
          id: purchaseRequests.id,
          requestNumber: purchaseRequests.requestNumber,
          requestedBy: purchaseRequests.requestedBy,
          requestedByName: sql<string>`COALESCE(CONCAT(emp.first_name, ' ', emp.last_name), 'Unknown')`,
          status: purchaseRequests.status,
          urgency: purchaseRequests.urgency,
          reason: purchaseRequests.reason,
          requestDate: purchaseRequests.requestDate,
          approvedBy: purchaseRequests.approvedBy,
          approvedByName: sql<string>`COALESCE(CONCAT(approver.first_name, ' ', approver.last_name), '')`,
          approvalDate: purchaseRequests.approvalDate,
        })
        .from(purchaseRequests)
        .leftJoin(emp, eq(purchaseRequests.requestedBy, emp.id))
        .leftJoin(approver, eq(purchaseRequests.approvedBy, emp.id))
        .where(eq(purchaseRequests.id, id));

      if (!request) return null;

      const items = await db
        .select({
          id: purchaseRequestItems.id,
          requestId: purchaseRequestItems.requestId,
          inventoryItemId: purchaseRequestItems.inventoryItemId,
          inventoryItemName: inventoryItems.name,
          inventoryItemUnit: inventoryItems.unit,
          quantity: purchaseRequestItems.quantity,
          notes: purchaseRequestItems.notes,
        })
        .from(purchaseRequestItems)
        .leftJoin(
          inventoryItems,
          eq(purchaseRequestItems.inventoryItemId, inventoryItems.id)
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
      const requestNumber = `PR-${Date.now()}`;

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
          }))
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
          taxAmount: purchaseOrders.taxAmount,
          totalAmount: purchaseOrders.totalAmount,
          notes: purchaseOrders.notes,
          createdAt: purchaseOrders.createdAt,
        })
        .from(purchaseOrders)
        .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
        .orderBy(desc(purchaseOrders.createdAt));

      // Get items for each purchase order
      const ordersWithItems = await Promise.all(
        result.map(async (order) => {
          const items = await this.getPurchaseOrderItems(order.id);
          return {
            ...order,
            items,
          };
        })
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
          deliveryTerms: purchaseOrders.deliveryTerms,
          subtotal: purchaseOrders.subtotal,
          taxAmount: purchaseOrders.taxAmount,
          totalAmount: purchaseOrders.totalAmount,
          notes: purchaseOrders.notes,
          createdAt: purchaseOrders.createdAt,
        })
        .from(purchaseOrders)
        .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
        .where(eq(purchaseOrders.id, id));

      if (!order) return null;

      const items = await this.getPurchaseOrderItems(id);
      return { ...order, items };
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
          description: purchaseOrderItems.description,
          quantity: purchaseOrderItems.quantity,
          unitPrice: purchaseOrderItems.unitPrice,
          lineTotal: purchaseOrderItems.lineTotal,
        })
        .from(purchaseOrderItems)
        .leftJoin(
          inventoryItems,
          eq(purchaseOrderItems.inventoryItemId, inventoryItems.id)
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
      const poNumber = `PO-${Date.now()}`;

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
          taxAmount: orderData.taxAmount || "0",
          totalAmount: orderData.totalAmount || "0",
          notes: orderData.notes || null,
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

      if (data.status !== undefined) updateData.status = data.status;
      if (data.expectedDeliveryDate !== undefined) {
        updateData.expectedDeliveryDate = data.expectedDeliveryDate
          ? new Date(data.expectedDeliveryDate)
          : null;
      }
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.subtotal !== undefined) updateData.subtotal = data.subtotal;
      if (data.taxAmount !== undefined) updateData.taxAmount = data.taxAmount;
      if (data.totalAmount !== undefined)
        updateData.totalAmount = data.totalAmount;

      await db
        .update(purchaseOrders)
        .set(updateData)
        .where(eq(purchaseOrders.id, id));

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

  async getPurchaseInvoices(): Promise<any[]> {
    try {
      const result = await db
        .select({
          id: purchaseInvoices.id,
          invoiceNumber: purchaseInvoices.invoiceNumber,
          supplierId: purchaseInvoices.supplierId,
          supplierName: suppliers.name,
          poId: purchaseInvoices.poId,
          status: purchaseInvoices.status,
          approvalStatus: purchaseInvoices.approvalStatus,
          approvedBy: purchaseInvoices.approvedBy,
          approvedAt: purchaseInvoices.approvedAt,
          invoiceDate: purchaseInvoices.invoiceDate,
          dueDate: purchaseInvoices.dueDate,
          subtotal: purchaseInvoices.subtotal,
          taxAmount: purchaseInvoices.taxAmount,
          totalAmount: purchaseInvoices.totalAmount,
          paidAmount: purchaseInvoices.paidAmount,
          notes: purchaseInvoices.notes,
          createdAt: purchaseInvoices.createdAt,
        })
        .from(purchaseInvoices)
        .leftJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id))
        .orderBy(desc(purchaseInvoices.createdAt));

      return result;
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
          supplierId: purchaseInvoices.supplierId,
          supplierName: suppliers.name,
          poId: purchaseInvoices.poId,
          status: purchaseInvoices.status,
          approvalStatus: purchaseInvoices.approvalStatus,
          approvedBy: purchaseInvoices.approvedBy,
          approvedAt: purchaseInvoices.approvedAt,
          invoiceDate: purchaseInvoices.invoiceDate,
          dueDate: purchaseInvoices.dueDate,
          subtotal: purchaseInvoices.subtotal,
          taxAmount: purchaseInvoices.taxAmount,
          totalAmount: purchaseInvoices.totalAmount,
          paidAmount: purchaseInvoices.paidAmount,
          notes: purchaseInvoices.notes,
          createdAt: purchaseInvoices.createdAt,
        })
        .from(purchaseInvoices)
        .leftJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id));

      const conditions = [];

      if (filters.startDate) {
        conditions.push(
          gte(purchaseInvoices.invoiceDate, new Date(filters.startDate))
        );
      }
      if (filters.endDate) {
        conditions.push(
          lte(purchaseInvoices.invoiceDate, new Date(filters.endDate))
        );
      }
      if (filters.supplierId) {
        conditions.push(eq(purchaseInvoices.supplierId, filters.supplierId));
      }
      if (filters.status && filters.status !== "all") {
        conditions.push(eq(purchaseInvoices.status, filters.status));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const result = await query.orderBy(desc(purchaseInvoices.createdAt));
      return result;
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

  async getPurchaseInvoice(id: number): Promise<any> {
    try {
      const [invoice] = await db
        .select({
          id: purchaseInvoices.id,
          invoiceNumber: purchaseInvoices.invoiceNumber,
          supplierId: purchaseInvoices.supplierId,
          supplierName: suppliers.name,
          poId: purchaseInvoices.poId,
          projectId: purchaseInvoices.projectId,
          assetInventoryInstanceId: purchaseInvoices.assetInventoryInstanceId,
          status: purchaseInvoices.status,
          approvalStatus: purchaseInvoices.approvalStatus,
          invoiceDate: purchaseInvoices.invoiceDate,
          dueDate: purchaseInvoices.dueDate,
          paymentTerms: purchaseInvoices.paymentTerms,
          bankAccount: purchaseInvoices.bankAccount,
          subtotal: purchaseInvoices.subtotal,
          taxAmount: purchaseInvoices.taxAmount,
          totalAmount: purchaseInvoices.totalAmount,
          paidAmount: purchaseInvoices.paidAmount,
          notes: purchaseInvoices.notes,
          createdAt: purchaseInvoices.createdAt,
          approvedBy: purchaseInvoices.approvedBy,
          approvedAt: purchaseInvoices.approvedAt,
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
          description: purchaseInvoiceItems.description,
          quantity: purchaseInvoiceItems.quantity,
          unitPrice: purchaseInvoiceItems.unitPrice,
          taxAmount: purchaseInvoiceItems.taxAmount,
          lineTotal: purchaseInvoiceItems.lineTotal,
        })
        .from(purchaseInvoiceItems)
        .leftJoin(
          inventoryItems,
          eq(purchaseInvoiceItems.inventoryItemId, inventoryItems.id)
        )
        .where(eq(purchaseInvoiceItems.invoiceId, id));

      return { ...invoice, items };
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
      const invoiceNumber = `PI-${Date.now()}`;

      const [invoice] = await db
        .insert(purchaseInvoices)
        .values({
          invoiceNumber,
          supplierId: invoiceData.supplierId,
          poId: invoiceData.poId || null,
          projectId: invoiceData.projectId || null,
          assetInventoryInstanceId:
            invoiceData.assetInventoryInstanceId || null,
          status: invoiceData.status || "pending",
          invoiceDate: new Date(invoiceData.invoiceDate),
          dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : null,
          paymentTerms: invoiceData.paymentTerms || null,
          bankAccount: invoiceData.bankAccount || null,
          subtotal: invoiceData.subtotal,
          taxAmount: invoiceData.taxAmount || "0",
          totalAmount: invoiceData.totalAmount,
          paidAmount: "0",
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

  async createPurchaseInvoiceFromPO(
    poId: number,
    invoiceData: any
  ): Promise<any> {
    try {
      // Get the purchase order
      const po = await this.getPurchaseOrder(poId);
      if (!po) {
        throw new Error("Purchase order not found");
      }

      const invoiceNumber = `PI-${Date.now()}`;

      // Create the invoice
      const [invoice] = await db
        .insert(purchaseInvoices)
        .values({
          invoiceNumber,
          supplierId: po.supplierId,
          poId: poId,
          status: "pending",
          invoiceDate: new Date(invoiceData.invoiceDate),
          dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : null,
          paymentTerms: po.paymentTerms || null,
          bankAccount: po.bankAccount || null,
          subtotal: po.subtotal,
          taxAmount: po.taxAmount,
          totalAmount: po.totalAmount,
          paidAmount: "0",
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

  async approvePurchaseInvoice(id: number, userId: number): Promise<void> {
    try {
      // Get the invoice details first
      const invoice = await this.getPurchaseInvoice(id);
      if (!invoice) {
        throw new Error("Purchase invoice not found");
      }

      // Update invoice approval status
      await db
        .update(purchaseInvoices)
        .set({
          approvalStatus: "approved",
          approvedBy: userId,
          approvedAt: new Date(),
        })
        .where(eq(purchaseInvoices.id, id));

      // If linked to a project, add amount to project's actual cost
      if (invoice.projectId) {
        const [project] = await db
          .select()
          .from(projects)
          .where(eq(projects.id, invoice.projectId));

        if (project) {
          const currentCost = parseFloat(project.actualCost || "0");
          const invoiceAmount = parseFloat(invoice.totalAmount);
          const newCost = currentCost + invoiceAmount;

          await db
            .update(projects)
            .set({ actualCost: newCost.toFixed(2) })
            .where(eq(projects.id, invoice.projectId));
        }
      }

      // If linked to an asset instance, create a maintenance record
      if (invoice.assetInventoryInstanceId) {
        await db.insert(assetInventoryMaintenanceRecords).values({
          instanceId: invoice.assetInventoryInstanceId,
          maintenanceCost: invoice.totalAmount,
          maintenanceDate: new Date(),
          description: `Purchase Invoice: ${invoice.invoiceNumber} - ${
            invoice.notes || "Maintenance cost"
          }`,
          performedBy: userId,
        });
      }
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
        newStatus = "partially_paid";
      }

      // Update invoice paid amount and status
      await db
        .update(purchaseInvoices)
        .set({
          paidAmount: newPaidAmount.toFixed(2),
          status: newStatus,
        })
        .where(eq(purchaseInvoices.id, paymentData.invoiceId));

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
      const payments = await db
        .select({
          id: purchaseInvoicePayments.id,
          amount: purchaseInvoicePayments.amount,
          paymentDate: purchaseInvoicePayments.paymentDate,
          paymentMethod: purchaseInvoicePayments.paymentMethod,
          referenceNumber: purchaseInvoicePayments.referenceNumber,
          notes: purchaseInvoicePayments.notes,
          recordedAt: purchaseInvoicePayments.recordedAt,
        })
        .from(purchaseInvoicePayments)
        .where(eq(purchaseInvoicePayments.invoiceId, invoiceId))
        .orderBy(desc(purchaseInvoicePayments.paymentDate));

      return payments;
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
      // This would be implemented similar to sales payment files
      // For now, return a basic structure
      const newFile = {
        // Added variable to hold the created file data
        id: Date.now(),
        ...fileData,
        uploadedAt: new Date(),
      };
      return newFile; // Return the created file data
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

  // Project Consumables methods
  async getProjectConsumables(
    projectId: number
  ): Promise<ProjectConsumableWithItems[]> {
    try {
      const consumables: Array<Omit<ProjectConsumableWithItems, "items">> =
        await db
          .select({
            id: projectConsumables.id,
            projectId: projectConsumables.projectId,
            date: projectConsumables.date,
            createdBy: projectConsumables.createdBy,
            createdAt: projectConsumables.createdAt,
            createdByName: users.username,
          })
          .from(projectConsumables)
          .leftJoin(users, eq(projectConsumables.createdBy, users.id))
          .where(eq(projectConsumables.projectId, projectId))
          .orderBy(desc(projectConsumables.date));

      // Get items for each consumable record
      const consumablesWithItems: ProjectConsumableWithItems[] =
        await Promise.all(
          consumables.map(async (consumable) => {
            const items: ProjectConsumableItemWithDetails[] = await db
              .select({
                id: projectConsumableItems.id,
                consumableId: projectConsumableItems.consumableId, // Ensure all fields from ProjectConsumableItem are present
                inventoryItemId: projectConsumableItems.inventoryItemId,
                quantity: projectConsumableItems.quantity,
                unitCost: projectConsumableItems.unitCost,
                createdAt: projectConsumableItems.createdAt, // Ensure all fields from ProjectConsumableItem
                updatedAt: projectConsumableItems.updatedAt, // Ensure all fields from ProjectConsumableItem
                itemName: inventoryItems.name,
                itemUnit: inventoryItems.unit,
              })
              .from(projectConsumableItems)
              .leftJoin(
                inventoryItems,
                eq(projectConsumableItems.inventoryItemId, inventoryItems.id)
              )
              .where(eq(projectConsumableItems.consumableId, consumable.id));

            return {
              ...consumable,
              items,
            };
          })
        );

      return consumablesWithItems;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getProjectConsumables (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getProjectConsumables",
        severity: "error",
      });
      throw error;
    }
  }

  async createProjectConsumables(
    projectId: number,
    date: string,
    items: CreateProjectConsumableItemInput[],
    userId?: number
  ): Promise<CreatedProjectConsumable> {
    try {
      console.log("Creating project consumables:", {
        projectId,
        date,
        items,
        userId,
      });

      // Create the consumable record
      const [consumable] = await db
        .insert(projectConsumables)
        .values({
          projectId: projectId,
          date: new Date(date),
          createdBy: userId || null,
        })
        .returning();

      console.log("Created consumable record:", consumable);

      // Process each item
      const consumableItems = [];
      for (const item of items) {
        // Get inventory item details
        const inventoryItem = await this.getInventoryItem(item.inventoryItemId);
        if (!inventoryItem) {
          throw new Error(
            `Inventory item with ID ${item.inventoryItemId} not found`
          );
        }

        // Check stock availability
        if (inventoryItem.currentStock < item.quantity) {
          throw new Error(
            `Insufficient stock for item ${inventoryItem.name}. Available: ${inventoryItem.currentStock}, Requested: ${item.quantity}`
          );
        }

        // Use avgCost as unit cost
        const unitCost = inventoryItem.avgCost || "0";

        // Create consumable item
        const [consumableItem] = await db
          .insert(projectConsumableItems)
          .values({
            consumableId: consumable.id,
            inventoryItemId: item.inventoryItemId,
            quantity: item.quantity,
            unitCost: unitCost,
          })
          .returning();

        consumableItems.push(consumableItem);

        // Update inventory stock
        const newStock = inventoryItem.currentStock - item.quantity;
        await this.updateInventoryItem(item.inventoryItemId, {
          currentStock: newStock,
        });

        // Create inventory transaction for tracking
        await db.insert(inventoryTransactions).values({
          itemId: item.inventoryItemId,
          type: "outflow",
          quantity: item.quantity,
          unitCost: unitCost,
          remainingQuantity: 0, // For outflow, remaining quantity is 0
          projectId: projectId,
          reference: `Project Consumables - ${date}`,
          createdBy: userId || null,
        });

        console.log(
          `Updated inventory item ${item.inventoryItemId} stock from ${inventoryItem.currentStock} to ${newStock}`
        );
      }

      // Recalculate project cost after adding consumables
      await this.recalculateProjectCost(projectId);

      return {
        ...consumable,
        items: consumableItems,
      };
    } catch (error: any) {
      console.error("Original error in createProjectConsumables:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          "Error in createProjectConsumables: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createProjectConsumables",
        severity: "error",
      });
      throw error;
    }
  }

  // Project Photo Group methods
  async getProjectPhotoGroups(projectId: number): Promise<ProjectPhotoGroup[]> {
    try {
      const groups = await db
        .select()
        .from(projectPhotoGroups)
        .where(eq(projectPhotoGroups.projectId, projectId))
        .orderBy(desc(projectPhotoGroups.createdAt));

      const groupIds = groups.map((g) => g.id);
      if (groupIds.length === 0) {
        return [];
      }

      const photos = await db
        .select()
        .from(projectPhotos)
        .where(inArray(projectPhotos.groupId, groupIds));

      return groups.map((group) => ({
        ...group,
        photos: photos.filter((p) => p.groupId === group.id),
      }));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getProjectPhotoGroups (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getProjectPhotoGroups",
        severity: "error",
      });
      throw error;
    }
  }

  async createProjectPhotoGroup(
    groupData: InsertProjectPhotoGroup
  ): Promise<ProjectPhotoGroup> {
    try {
      const result = await db
        .insert(projectPhotoGroups)
        .values(groupData)
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createProjectPhotoGroup: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createProjectPhotoGroup",
        severity: "error",
      });
      throw error;
    }
  }

  async addPhotosToPhotoGroup(
    groupId: number,
    photosData: Omit<InsertProjectPhoto, "groupId">[]
  ): Promise<ProjectPhoto[]> {
    if (!photosData || photosData.length === 0) {
      return [];
    }

    const photosToInsert = photosData.map((photo) => ({
      ...photo,
      groupId: groupId,
    }));

    const savedPhotos = await db
      .insert(projectPhotos)
      .values(photosToInsert)
      .returning();

    return savedPhotos;
  }

  async updateProjectPhotoGroup(
    id: number,
    groupData: Partial<InsertProjectPhotoGroup>
  ): Promise<ProjectPhotoGroup | undefined> {
    try {
      const result = await db
        .update(projectPhotoGroups)
        .set(groupData)
        .where(eq(projectPhotoGroups.id, id))
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateProjectPhotoGroup (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateProjectPhotoGroup",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteProjectPhotoGroup(id: number): Promise<boolean> {
    try {
      await db.transaction(async (tx) => {
        // 1. Get all photos in the group
        const photosToDelete = await tx
          .select()
          .from(projectPhotos)
          .where(eq(projectPhotos.groupId, id));

        // 2. Delete photo files from the filesystem
        for (const photo of photosToDelete) {
          if (photo.filePath) {
            // filePath is stored as '/uploads/...', remove leading '/' for fs operations
            const filePath = photo.filePath.substring(1);
            try {
              await fs.unlink(filePath);
            } catch (fileError: any) {
              // If file not found, log it but don't block the deletion process
              if (fileError.code !== "ENOENT") {
                throw fileError; // Re-throw other file system errors
              }
              console.warn(`File not found, skipping deletion: ${filePath}`);
            }
          }
        }

        // 3. Delete photo records from the database
        await tx.delete(projectPhotos).where(eq(projectPhotos.groupId, id));

        // 4. Delete the photo group record
        await tx
          .delete(projectPhotoGroups)
          .where(eq(projectPhotoGroups.id, id));
      });
      return true;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deleteProjectPhotoGroup (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteProjectPhotoGroup",
        severity: "error",
      });
      throw error;
    }
  }

  // Project Photo methods
  async getProjectPhotos(groupId: number): Promise<ProjectPhoto[]> {
    try {
      return await db
        .select()
        .from(projectPhotos)
        .where(eq(projectPhotos.groupId, groupId))
        .orderBy(desc(projectPhotos.createdAt));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getProjectPhotos (groupId: ${groupId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getProjectPhotos",
        severity: "error",
      });
      throw error;
    }
  }

  async createProjectPhoto(
    photoData: InsertProjectPhoto
  ): Promise<ProjectPhoto> {
    try {
      const result = await db
        .insert(projectPhotos)
        .values(photoData)
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createProjectPhoto: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createProjectPhoto",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteProjectPhoto(photoId: number): Promise<boolean> {
    try {
      const result = await db
        .delete(projectPhotos)
        .where(eq(projectPhotos.id, photoId));
      return result.rowCount > 0;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deleteProjectPhoto (photoId: ${photoId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteProjectPhoto",
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
          createdAt: purchaseCreditNotes.createdAt,
        })
        .from(purchaseCreditNotes)
        .leftJoin(suppliers, eq(purchaseCreditNotes.supplierId, suppliers.id))
        .leftJoin(
          purchaseInvoices,
          eq(purchaseCreditNotes.purchaseInvoiceId, purchaseInvoices.id)
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

  // Payroll methods
  async getPayrollEntries(
    month?: number,
    year?: number,
    employeeId?: number,
    projectId?: number
  ): Promise<PayrollEntryWithEmployeeDetails[]> {
    try {
      // Build the base query
      let baseQuery = db
        .select()
        .from(payrollEntries)
        .leftJoin(employees, eq(payrollEntries.employeeId, employees.id));

      // Add conditions if provided
      const conditions = [];
      if (month !== undefined && month !== null)
        conditions.push(eq(payrollEntries.month, month));
      if (year !== undefined && year !== null)
        conditions.push(eq(payrollEntries.year, year));
      if (employeeId !== undefined && employeeId !== null)
        conditions.push(eq(payrollEntries.employeeId, employeeId));
      if (projectId !== undefined && projectId !== null)
        conditions.push(eq(payrollEntries.projectId, projectId));

      if (conditions.length > 0) {
        if (conditions.length === 1) {
          baseQuery = baseQuery.where(conditions[0]);
        } else {
          baseQuery = baseQuery.where(and(...conditions));
        }
      }

      const result = await baseQuery.orderBy(
        desc(payrollEntries.generatedDate)
      );

      return result.map((row) => {
        let employeeDetails: PayrollEntryEmployeeDetails | undefined =
          undefined;

        // Access the payroll entry data (table name becomes the key)
        const payrollData = row.payroll_entries;
        const employeeData = row.employees;

        if (payrollData && payrollData.employeeId && employeeData) {
          employeeDetails = {
            id: payrollData.employeeId,
            firstName: employeeData.firstName,
            lastName: employeeData.lastName,
            employeeCode: employeeData.employeeCode,
          };
        }

        return {
          id: payrollData.id,
          employeeId: payrollData.employeeId,
          month: payrollData.month,
          year: payrollData.year,
          workingDays: payrollData.workingDays,
          basicSalary: payrollData.basicSalary,
          totalAdditions: payrollData.totalAdditions,
          totalDeductions: payrollData.totalDeductions,
          totalAmount: payrollData.totalAmount,
          status: payrollData.status,
          generatedDate: payrollData.generatedDate,
          projectId: payrollData.projectId,
          employee: employeeDetails,
        };
      }) as PayrollEntryWithEmployeeDetails[];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getPayrollEntries: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPayrollEntries",
        severity: "error",
      });
      throw error;
    }
  }

  async getPayrollEntry(id: number): Promise<PayrollEntry | undefined> {
    try {
      const result = await db
        .select()
        .from(payrollEntries)
        .where(eq(payrollEntries.id, id))
        .limit(1);
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getPayrollEntry (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPayrollEntry",
        severity: "error",
      });
      throw error;
    }
  }

  async generateMonthlyPayroll(
    month: number,
    year: number,
    userId?: number
  ): Promise<PayrollEntryWithEmployeeDetails[]> {
    try {
      console.log(
        `[Payroll] Starting generateMonthlyPayroll for month: ${month}, year: ${year}, userId: ${userId}`
      );

      // Validate required parameters
      if (!userId) {
        throw new Error("User ID is required for payroll generation");
      }

      // Validate month and year
      if (!month || !year || month < 1 || month > 12) {
        throw new Error("Invalid month. Must be between 1 and 12.");
      }
      if (year < 2020 || year > 2030) {
        throw new Error("Invalid year. Must be between 2020 and 2030.");
      }

      // Check if payroll already exists for this period
      const existingPayroll = await this.getPayrollEntries(month, year);
      if (existingPayroll.length > 0) {
        throw new Error(
          `Payroll for ${this.getMonthName(
            month
          )} ${year} already exists. Please clear it first if you want to regenerate.`
        );
      }

      // Get all active employees
      console.log(`[Payroll] Querying active employees for ${month}/${year}`);
      const activeEmployees = await db
        .select({
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          employeeCode: employees.employeeCode,
          category: employees.category,
          salary: employees.salary,
          isActive: employees.isActive,
        })
        .from(employees)
        .where(eq(employees.isActive, true));

      if (activeEmployees.length === 0) {
        throw new Error(
          "No active employees found. Please add employees before generating payroll."
        );
      }

      console.log(
        `[Payroll] Found ${activeEmployees.length} active employees.`
      );
      if (activeEmployees.length === 0) {
        throw new Error("No active employees found.");
      }

      // Get active projects for consultant allocation
      console.log(`[Payroll] Querying active projects for ${month}/${year}`);
      const activeProjects = await db
        .select({
          id: projects.id,
          title: projects.title, // Included for context, though not directly in logic
          startDate: projects.startDate,
          plannedEndDate: projects.plannedEndDate,
          actualEndDate: projects.actualEndDate,
          status: projects.status, // Used in WHERE, included for context
        })
        .from(projects)
        .where(
          or(
            eq(projects.status, "in_progress"),
            eq(projects.status, "planning")
          )
        );

      console.log(`[Payroll] Found ${activeProjects.length} active projects.`);
      const generatedPayroll: PayrollEntry[] = [];

      for (const employee of activeEmployees) {
        if (!employee) {
          console.error(
            `Skipping null employee object during payroll generation for ${month}/${year}.`
          );
          continue;
        }

        // Default names for logging if null/undefined, but category is critical
        const logFirstName = employee.firstName || "Unknown";
        const logLastName = employee.lastName || "Employee";

        if (!employee.category) {
          console.error(
            `Skipping employee ID ${
              employee.id || "N/A"
            } due to missing category during payroll generation for ${month}/${year}.`
          );
          continue;
        }

        console.log(
          `Processing payroll for employee: ${logFirstName} ${logLastName} (${employee.category})`
        );

        let basicSalary = parseFloat(employee.salary || "0").toString(); // Ensure consistent use of "0" default for salary
        let workingDays = this.getCalendarDaysInMonth(month, year);
        let projectId: number | null = null;

        // Basic salary is already defaulted using (employee.salary || "0") above

        if (employee.category === "permanent") {
          // For permanent employees, use full monthly salary - already handled by initialization of basicSalary
        } else if (
          employee.category === "consultant" ||
          employee.category === "contract"
        ) {
          // For consultants/contractors, check project assignments
          let totalEarnings = 0;

          for (const project of activeProjects) {
            if (!project || project.id == null) {
              console.error(
                `Skipping null project or project with null ID during payroll calculation for employee ID ${
                  employee.id
                }. Project data: ${JSON.stringify(project)}`
              );
              continue;
            }
            console.log(
              `[Payroll] Getting project assignments for employee ID: ${employee.id} (${employee.firstName} ${employee.lastName}) for project ID: ${project.id}`
            );
            const projectEmployees = await this.getProjectEmployees(project.id);
            const isAssigned = projectEmployees.some(
              (pe) => pe && pe.id != null && pe.id === employee.id
            );

            if (isAssigned) {
              let projectStartDate;
              if (project.startDate) {
                projectStartDate = new Date(project.startDate);
              } else {
                projectStartDate = new Date(year, month - 1, 1);
                console.warn(
                  `Project ID ${
                    project.id
                  } has null startDate. Defaulting to ${projectStartDate.toDateString()} for payroll calculation for employee ID ${
                    employee.id
                  }.`
                );
              }

              let projectEndDate;
              if (project.actualEndDate) {
                projectEndDate = new Date(project.actualEndDate);
              } else if (project.plannedEndDate) {
                projectEndDate = new Date(project.plannedEndDate);
                console.warn(
                  `Project ID ${
                    project.id
                  } has null actualEndDate, using plannedEndDate ${projectEndDate.toDateString()} for payroll calculation for employee ID ${
                    employee.id
                  }.`
                );
              } else {
                projectEndDate = new Date(year, month, 0); // Last day of current payroll month
                console.warn(
                  `Project ID ${
                    project.id
                  } has null actualEndDate and plannedEndDate. Defaulting to ${projectEndDate.toDateString()} for payroll calculation for employee ID ${
                    employee.id
                  }.`
                );
              }

              // Calculate working days in the month for this project
              const monthStart = new Date(year, month - 1, 1);
              const monthEnd = new Date(year, month, 0); // Corrected to last day of current month

              const effectiveStart =
                projectStartDate > monthStart ? projectStartDate : monthStart;
              const effectiveEnd =
                projectEndDate < monthEnd ? projectEndDate : monthEnd;

              if (effectiveStart <= effectiveEnd) {
                const projectWorkingDays = this.calculateWorkingDays(
                  effectiveStart,
                  effectiveEnd
                );
                const dailyRate = parseFloat(employee.salary || "0") / 22; // Assuming 22 working days per month
                totalEarnings += dailyRate * projectWorkingDays;
                projectId = project.id; // Assign to the last project for GL tracking
              }
            }
          }

          basicSalary = totalEarnings.toFixed(2);
        }

        // Calculate deductions (5% TDS)
        const calculatedTotalEarnings = parseFloat(basicSalary); // Renamed to avoid conflict
        const tdsAmount = calculatedTotalEarnings * 0.05;
        const netAmount = calculatedTotalEarnings - tdsAmount;

        // Create payroll entry
        const [payrollEntry] = await db
          .insert(payrollEntries)
          .values({
            employeeId: employee.id,
            month: month,
            year: year,
            workingDays: workingDays,
            basicSalary: basicSalary,
            totalAdditions: "0",
            totalDeductions: tdsAmount.toFixed(2),
            totalAmount: netAmount.toFixed(2),
            status: "generated",
            projectId: projectId,
          })
          .returning();

        // Create automatic TDS deduction
        if (tdsAmount > 0) {
          await db.insert(payrollDeductions).values({
            payrollEntryId: payrollEntry.id,
            description: "Tax Deducted at Source",
            amount: tdsAmount.toFixed(2),
            note: "5% of total earnings",
          });
        }

        // Create consultant project addition if applicable
        if (
          (employee.category === "consultant" ||
            employee.category === "contract") &&
          parseFloat(basicSalary) > 0
        ) {
          await db.insert(payrollAdditions).values({
            payrollEntryId: payrollEntry.id,
            description: "Project Consultant Fee",
            amount: basicSalary,
            note: `Consultant fee for ${this.getMonthName(month)} ${year}`,
          });

          // Update total additions
          await db
            .update(payrollEntries)
            .set({ totalAdditions: basicSalary })
            .where(eq(payrollEntries.id, payrollEntry.id));
        }

        // Create double-entry GL records for salary expense only if amount > 0
        if (calculatedTotalEarnings > 0) {
          const transactionDate = `${year}-${month
            .toString()
            .padStart(2, "0")}-01`;

          let glEmployeeFirstName = employee.firstName;
          let glEmployeeLastName = employee.lastName;

          if (!glEmployeeFirstName && !glEmployeeLastName) {
            console.warn(
              `Employee ID ${employee.id} has null first and last names. Using defaults for GL employee name.`
            );
            glEmployeeFirstName = "Unknown";
            glEmployeeLastName = "Employee";
          } else if (!glEmployeeFirstName) {
            glEmployeeFirstName = "Unknown";
          } else if (!glEmployeeLastName) {
            glEmployeeLastName = "Employee";
          }
          const employeeName = `${glEmployeeFirstName} ${glEmployeeLastName}`;
          const monthName = this.getMonthName(month);

          console.log(
            `Creating GL entries for ${employeeName} - ${monthName} ${year} - Amount: ${calculatedTotalEarnings.toFixed(
              2
            )}`
          );

          // 1. Debit: Salary Expense (increase expense)
          await this.createGeneralLedgerEntry({
            entryType: "payable",
            referenceType: "manual",
            referenceId: payrollEntry.id,
            accountName: "Salary Expense",
            description: `Salary for ${employeeName} - ${monthName} ${year}`,
            debitAmount: calculatedTotalEarnings.toFixed(2),
            creditAmount: "0",
            entityId: employee.id,
            entityName: employeeName,
            projectId: projectId || undefined,
            transactionDate: transactionDate,
            status: "pending",
            createdBy: userId,
          });

          // 2. Credit: Salary Payable (increase liability - what we owe the employee)
          await this.createGeneralLedgerEntry({
            entryType: "payable",
            referenceType: "manual",
            referenceId: payrollEntry.id,
            accountName: "Salary Payable",
            description: `Salary payable to ${employeeName} - ${monthName} ${year}`,
            debitAmount: "0",
            creditAmount: calculatedTotalEarnings.toFixed(2),
            entityId: employee.id,
            entityName: employeeName,
            projectId: projectId || undefined,
            transactionDate: transactionDate,
            status: "pending",
            createdBy: userId,
          });

          console.log(
            `Successfully created payroll entry and GL records for ${employeeName}`
          );
        } else {
          console.log(
            `Skipping GL entries for employee ${employee.firstName} ${
              employee.lastName
            } - no earnings for ${this.getMonthName(month)} ${year}`
          );
        }

        generatedPayroll.push({
          // Map to PayrollEntryWithEmployeeDetails
          id: payrollEntry.id,
          employeeId: payrollEntry.employeeId,
          month: payrollEntry.month,
          year: payrollEntry.year,
          workingDays: payrollEntry.workingDays,
          basicSalary: payrollEntry.basicSalary,
          additions: payrollEntry.additions,
          deductions: payrollEntry.deductions,
          totalAdditions: payrollEntry.totalAdditions,
          totalDeductions: payrollEntry.totalDeductions,
          totalAmount: payrollEntry.totalAmount,
          status: payrollEntry.status,
          generatedDate: payrollEntry.generatedDate,
          projectId: payrollEntry.projectId,
          employee: {
            // Use potentially defaulted names for the final returned object as well
            id: employee.id,
            firstName: employee.firstName || "Unknown",
            lastName: employee.lastName || "Employee",
            employeeCode: employee.employeeCode,
          },
        });
      }

      console.log(
        `Successfully generated payroll for ${generatedPayroll.length} employees`
      );
      return generatedPayroll;
    } catch (error: any) {
      console.error("Original error in generateMonthlyPayroll:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in generateMonthlyPayroll (month: ${month}, year: ${year}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "generateMonthlyPayroll",
        severity: "error",
      });
      throw error;
    }
  }

  async updatePayrollEntry(
    id: number,
    data: Partial<InsertPayrollEntry>,
    userId?: number
  ): Promise<PayrollEntry | undefined> {
    try {
      // Get current payroll entry to check old status
      const currentPayrollEntry = await this.getPayrollEntry(id);
      if (!currentPayrollEntry) {
        console.error(`Payroll entry with ID ${id} not found. Cannot update.`);
        return undefined;
      }
      const oldStatus = currentPayrollEntry.status;

      const result = await db
        .update(payrollEntries)
        .set(data)
        .where(eq(payrollEntries.id, id))
        .returning();

      if (result.length > 0) {
        const updatedEntry = result[0];
        // Update totals after any changes
        await this.updatePayrollEntryTotals(id);

        // Check if status changed to "paid"
        if (data.status === "paid" && oldStatus !== "paid" && updatedEntry) {
          const employeeDetails = await db
            .select()
            .from(employees)
            .where(eq(employees.id, updatedEntry.employeeId))
            .limit(1);

          if (employeeDetails.length > 0) {
            const employee = employeeDetails[0];
            let glEmployeeFirstName = employee.firstName || "Unknown";
            let glEmployeeLastName = employee.lastName || "Employee";
            if (employee.firstName === null && employee.lastName === null) {
              // Already handled by initialization, but explicit log for clarity if both were null
              console.warn(
                `Employee ID ${employee.id} has null first and last names. Using defaults "Unknown Employee" for GL payment entries.`
              );
            } else if (employee.firstName === null) {
              glEmployeeFirstName = "Unknown";
            } else if (employee.lastName === null) {
              glEmployeeLastName = "Employee";
            }
            const employeeName = `${glEmployeeFirstName} ${glEmployeeLastName}`;
            const monthName = this.getMonthName(updatedEntry.month);
            const transactionDate = new Date().toISOString().split("T")[0];
            const totalAmountStr = updatedEntry.totalAmount
              ? parseFloat(updatedEntry.totalAmount).toFixed(2)
              : "0.00";

            console.log(
              `Processing 'paid' status update for payroll entry ID ${updatedEntry.id}. Employee: ${employeeName}, Amount: ${totalAmountStr}`
            );

            // 1. Debit: Salary Payable (decrease liability)
            await this.createGeneralLedgerEntry({
              entryType: "payable",
              referenceType: "payroll_payment",
              referenceId: updatedEntry.id,
              accountName: "Salary Payable",
              description: `Paid salary to ${employeeName} - ${monthName} ${updatedEntry.year}`,
              debitAmount: totalAmountStr,
              creditAmount: "0",
              entityId: updatedEntry.employeeId,
              entityName: employeeName,
              projectId: updatedEntry.projectId || undefined,
              transactionDate: transactionDate,
              status: "paid",
              createdBy: userId,
            });

            // 2. Credit: Cash/Bank (decrease asset)
            await this.createGeneralLedgerEntry({
              entryType: "payable", // Or "asset" if treating Cash/Bank as asset reduction. "payable" aligns with other payment GLs.
              referenceType: "payroll_payment",
              referenceId: updatedEntry.id,
              accountName: "Cash/Bank",
              description: `Paid salary to ${employeeName} - ${monthName} ${updatedEntry.year}`,
              debitAmount: "0",
              creditAmount: totalAmountStr,
              entityId: updatedEntry.employeeId,
              entityName: employeeName,
              projectId: updatedEntry.projectId || undefined,
              transactionDate: transactionDate,
              status: "paid",
              createdBy: userId,
            });
            console.log(
              `Created GL payment entries for payroll ID ${updatedEntry.id}`
            );
          } else {
            console.error(
              `Failed to retrieve employee details for employee ID ${updatedEntry.employeeId} during GL payment entry creation.`
            );
          }
        }
        return updatedEntry; // Return the updated entry from the result array
      }
      return undefined;
    } catch (error: any) {
      console.error("Original error in updatePayrollEntry:", error);
      await this.createErrorLog({
        message:
          `Error in updatePayrollEntry (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updatePayrollEntry",
        severity: "error",
      });
      throw error;
    }
  }

  async updatePayrollEntryTotals(payrollEntryId: number): Promise<void> {
    try {
      // Get all additions and deductions for this payroll entry
      const additions = await this.getPayrollAdditions(payrollEntryId);
      const deductions = await this.getPayrollDeductions(payrollEntryId);

      const totalAdditions = additions.reduce(
        (sum, addition) => sum + parseFloat(addition.amount || "0"),
        0
      );
      const totalDeductions = deductions.reduce(
        (sum, deduction) => sum + parseFloat(deduction.amount || "0"),
        0
      );

      // Get the basic salary
      const payrollEntry = await db
        .select()
        .from(payrollEntries)
        .where(eq(payrollEntries.id, payrollEntryId))
        .limit(1);

      if (payrollEntry.length === 0) {
        throw new Error(`Payroll entry ${payrollEntryId} not found`);
      }

      const basicSalary = parseFloat(payrollEntry[0].basicSalary || "0");
      const totalEarnings = basicSalary + totalAdditions;
      const totalAmount = totalEarnings - totalDeductions;

      // Update the payroll entry
      await db
        .update(payrollEntries)
        .set({
          totalAdditions: totalAdditions.toString(),
          totalDeductions: totalDeductions.toString(),
          totalAmount: totalAmount.toString(),
        })
        .where(eq(payrollEntries.id, payrollEntryId));

      // Update corresponding general ledger entries
      const employee = await db
        .select()
        .from(employees)
        .where(eq(employees.id, payrollEntry[0].employeeId))
        .limit(1);

      if (employee.length > 0) {
        const employeeName = `${employee[0].firstName} ${employee[0].lastName}`;
        const monthName = this.getMonthName(payrollEntry[0].month);

        // Update GL entries with new amounts
        const salaryDescription = `Salary for ${employeeName} - ${monthName} ${payrollEntry[0].year}`;
        const payableDescription = `Salary payable to ${employeeName} - ${monthName} ${payrollEntry[0].year}`;

        await db.execute(sql`
          UPDATE general_ledger_entries 
          SET debit_amount = ${totalEarnings.toString()},
              description = ${salaryDescription}
          WHERE reference_type = 'manual' 
            AND reference_id = ${payrollEntryId} 
            AND account_name = 'Salary Expense'
        `);

        await db.execute(sql`
          UPDATE general_ledger_entries 
          SET credit_amount = ${totalEarnings.toString()},
              description = ${payableDescription}
          WHERE reference_type = 'manual' 
            AND reference_id = ${payrollEntryId} 
            AND account_name = 'Salary Payable'
        `);
      }

      console.log(
        `Updated payroll entry ${payrollEntryId} totals: additions=${totalAdditions.toFixed(
          2
        )}, deductions=${totalDeductions.toFixed(
          2
        )}, total=${totalAmount.toFixed(2)}`
      );
    } catch (error: any) {
      console.error("Original error in updatePayrollEntryTotals:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in updatePayrollEntryTotals (payrollEntryId: ${payrollEntryId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updatePayrollEntryTotals",
        severity: "error",
      });
      throw error;
    }
  }

  async clearPayrollPeriod(
    month: number,
    year: number
  ): Promise<{
    deletedPayrollEntries: number;
    deletedGeneralLedgerEntries: number;
  }> {
    try {
      // Get payroll entries for this period first
      const payrollEntriesToDelete = await this.getPayrollEntries(month, year);

      if (payrollEntriesToDelete.length === 0) {
        return { deletedPayrollEntries: 0, deletedGeneralLedgerEntries: 0 };
      }

      const payrollIds = payrollEntriesToDelete.map((entry) => entry.id);

      // Delete related general ledger entries by iterating through each payroll ID
      let deletedGLCount = 0;
      for (const payrollId of payrollIds) {
        const result = await db
          .delete(generalLedgerEntries)
          .where(
            and(
              eq(generalLedgerEntries.referenceType, "manual"),
              eq(generalLedgerEntries.referenceId, payrollId.toString()),
              or(
                eq(generalLedgerEntries.accountName, "Salary Expense"),
                eq(generalLedgerEntries.accountName, "Salary Payable")
              )
            )
          );
        deletedGLCount += result.rowCount || 0;
      }

      // Delete payroll entries (this will cascade to delete additions and deductions)
      const payrollDeleteCount = await this.clearPayrollEntriesByPeriod(
        month,
        year
      );

      return {
        deletedPayrollEntries: payrollDeleteCount,
        deletedGeneralLedgerEntries: deletedGLCount,
      };
    } catch (error: any) {
      console.error("Original error in clearPayrollPeriod:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in clearPayrollPeriod (month: ${month}, year: ${year}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "clearPayrollPeriod",
        severity: "error",
      });
      throw error;
    }
  }

  async clearPayrollEntriesByPeriod(
    month: number,
    year: number
  ): Promise<number> {
    try {
      const result = await db
        .delete(payrollEntries)
        .where(
          and(eq(payrollEntries.month, month), eq(payrollEntries.year, year))
        );
      return result.rowCount || 0;
    } catch (error: any) {
      console.error("Original error in clearPayrollEntriesByPeriod:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in clearPayrollEntriesByPeriod (month: ${month}, year: ${year}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "clearPayrollEntriesByPeriod",
        severity: "error",
      });
      throw error;
    }
  }

  async clearAllPayrollEntries(): Promise<number> {
    try {
      const result = await db.delete(payrollEntries);
      return result.rowCount || 0;
    } catch (error: any) {
      console.error("Original error in clearAllPayrollEntries:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          "Error in clearAllPayrollEntries: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "clearAllPayrollEntries",
        severity: "error",
      });
      throw error;
    }
  }

  // Payroll Additions methods
  async getPayrollAdditions(
    payrollEntryId: number
  ): Promise<PayrollAddition[]> {
    try {
      return await db
        .select()
        .from(payrollAdditions)
        .where(eq(payrollAdditions.payrollEntryId, payrollEntryId));
    } catch (error: any) {
      console.error("Original error in getPayrollAdditions:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in getPayrollAdditions (payrollEntryId: ${payrollEntryId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPayrollAdditions",
        severity: "error",
      });
      throw error;
    }
  }

  async getPayrollAddition(id: number): Promise<PayrollAddition | undefined> {
    try {
      const result = await db
        .select()
        .from(payrollAdditions)
        .where(eq(payrollAdditions.id, id))
        .limit(1);
      return result[0];
    } catch (error: any) {
      console.error("Original error in getPayrollAddition:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in getPayrollAddition (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPayrollAddition",
        severity: "error",
      });
      throw error;
    }
  }

  async createPayrollAddition(
    additionData: InsertPayrollAddition
  ): Promise<PayrollAddition> {
    try {
      const [addition] = await db
        .insert(payrollAdditions)
        .values(additionData)
        .returning();

      // Update payroll entry totals
      await this.updatePayrollEntryTotals(additionData.payrollEntryId);

      return addition;
    } catch (error: any) {
      console.error("Original error in createPayrollAddition:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          "Error in createPayrollAddition: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createPayrollAddition",
        severity: "error",
      });
      throw error;
    }
  }

  async updatePayrollAddition(
    id: number,
    data: Partial<InsertPayrollAddition>
  ): Promise<PayrollAddition | undefined> {
    try {
      const result = await db
        .update(payrollAdditions)
        .set(data)
        .where(eq(payrollAdditions.id, id))
        .returning();

      if (result.length > 0) {
        // Update payroll entry totals
        const addition = await this.getPayrollAddition(id);
        if (addition) {
          await this.updatePayrollEntryTotals(addition.payrollEntryId);
        }
      }

      return result[0];
    } catch (error: any) {
      console.error("Original error in updatePayrollAddition:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in updatePayrollAddition (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updatePayrollAddition",
        severity: "error",
      });
      throw error;
    }
  }

  async deletePayrollAddition(id: number): Promise<boolean> {
    try {
      // Get the addition first to get payroll entry ID
      const addition = await this.getPayrollAddition(id);
      if (!addition) {
        return false;
      }

      const result = await db
        .delete(payrollAdditions)
        .where(eq(payrollAdditions.id, id));

      if (result.rowCount && result.rowCount > 0) {
        // Update payroll entry totals
        await this.updatePayrollEntryTotals(addition.payrollEntryId);
        return true;
      }

      return false;
    } catch (error: any) {
      console.error("Original error in deletePayrollAddition:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in deletePayrollAddition (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deletePayrollAddition",
        severity: "error",
      });
      throw error;
    }
  }

  // Payroll Deductions methods
  async getPayrollDeductions(
    payrollEntryId: number
  ): Promise<PayrollDeduction[]> {
    try {
      return await db
        .select()
        .from(payrollDeductions)
        .where(eq(payrollDeductions.payrollEntryId, payrollEntryId));
    } catch (error: any) {
      console.error("Original error in getPayrollDeductions:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in getPayrollDeductions (payrollEntryId: ${payrollEntryId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPayrollDeductions",
        severity: "error",
      });
      throw error;
    }
  }

  async getPayrollDeduction(id: number): Promise<PayrollDeduction | undefined> {
    try {
      const result = await db
        .select()
        .from(payrollDeductions)
        .where(eq(payrollDeductions.id, id))
        .limit(1);
      return result[0];
    } catch (error: any) {
      console.error("Original error in getPayrollDeduction:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in getPayrollDeduction (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPayrollDeduction",
        severity: "error",
      });
      throw error;
    }
  }

  async createPayrollDeduction(
    deductionData: InsertPayrollDeduction
  ): Promise<PayrollDeduction> {
    try {
      const [deduction] = await db
        .insert(payrollDeductions)
        .values(deductionData)
        .returning();

      // Update payroll entry totals
      await this.updatePayrollEntryTotals(deductionData.payrollEntryId);

      return deduction;
    } catch (error: any) {
      console.error("Original error in createPayrollDeduction:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          "Error in createPayrollDeduction: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createPayrollDeduction",
        severity: "error",
      });
      throw error;
    }
  }

  async updatePayrollDeduction(
    id: number,
    data: Partial<InsertPayrollDeduction>
  ): Promise<PayrollDeduction | undefined> {
    try {
      const result = await db
        .update(payrollDeductions)
        .set(data)
        .where(eq(payrollDeductions.id, id))
        .returning();

      if (result.length > 0) {
        // Update payroll entry totals
        const deduction = await this.getPayrollDeduction(id);
        if (deduction) {
          await this.updatePayrollEntryTotals(deduction.payrollEntryId);
        }
      }

      return result[0];
    } catch (error: any) {
      console.error("Original error in updatePayrollDeduction:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in updatePayrollDeduction (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updatePayrollDeduction",
        severity: "error",
      });
      throw error;
    }
  }

  async deletePayrollDeduction(id: number): Promise<boolean> {
    try {
      // Get the deduction first to get payroll entry ID
      const deduction = await this.getPayrollDeduction(id);
      if (!deduction) {
        return false;
      }

      const result = await db
        .delete(payrollDeductions)
        .where(eq(payrollDeductions.id, id));

      if (result.rowCount && result.rowCount > 0) {
        // Update payroll entry totals
        await this.updatePayrollEntryTotals(deduction.payrollEntryId);
        return true;
      }

      return false;
    } catch (error: any) {
      console.error("Original error in deletePayrollDeduction:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in deletePayrollDeduction (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deletePayrollDeduction",
        severity: "error",
      });
      throw error;
    }
  }

  // Helper methods for payroll
  private getMonthName(month: number): string {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return months[month - 1] || "Unknown";
  }

  private getCalendarDaysInMonth(month: number, year: number): number {
    return new Date(year, month, 0).getDate();
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

      const creditNoteNumber = `PCN-${Date.now()}`;

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
          creditNote.purchaseInvoiceId
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
    creditNoteData: any
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
          updatedCreditNote.purchaseInvoiceId
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
          2
        )} with status ${status}`
      );
    } catch (error: any) {
      console.error(
        "Original error in updatePurchaseInvoicePaidAmount:",
        error
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

  async getSalesQuotations(): Promise<SalesQuotation[]> {
    try {
      return await db.select().from(salesQuotations);
    } catch (error: any) {
      // console.error("Error getting sales quotations:", error); // Original console.error commented out
      await this.createErrorLog({
        message:
          "Error in getSalesQuotations: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getSalesQuotations",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteSalesQuotation(id: number): Promise<void> {
    try {
      await db.delete(salesQuotations).where(eq(salesQuotations.id, id));
    } catch (error: any) {
      // console.error("Error deleting sales quotation:", error); // Original console.error commented out
      await this.createErrorLog({
        message:
          `Error in deleteSalesQuotation (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteSalesQuotation",
        severity: "error",
      });
      throw error;
    }
  }

  async getSalesInvoices(): Promise<SalesInvoice[]> {
    try {
      return await db.select().from(salesInvoices);
    } catch (error: any) {
      // console.error("Error getting sales invoices:", error); // Original console.error commented out
      await this.createErrorLog({
        message:
          "Error in getSalesInvoices: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getSalesInvoices",
        severity: "error",
      });
      throw error;
    }
  }

  async getSalesInvoice(id: number): Promise<SalesInvoice | undefined> {
    try {
      const result = await db
        .select()
        .from(salesInvoices)
        .where(eq(salesInvoices.id, id))
        .limit(1);
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getSalesInvoice (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getSalesInvoice",
        severity: "error",
      });
      throw error;
    }
  }

  async createSalesInvoice(
    invoiceData: InsertSalesInvoice
  ): Promise<SalesInvoice> {
    try {
      const result = await db
        .insert(salesInvoices)
        .values(invoiceData)
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createSalesInvoice: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createSalesInvoice",
        severity: "error",
      });
      throw error;
    }
  }

  async updateSalesInvoice(
    id: number,
    invoiceData: Partial<InsertSalesInvoice>
  ): Promise<SalesInvoice | undefined> {
    try {
      const result = await db
        .update(salesInvoices)
        .set(invoiceData)
        .where(eq(salesInvoices.id, id))
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateSalesInvoice (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateSalesInvoice",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteSalesInvoice(id: number): Promise<void> {
    try {
      await db.delete(salesInvoices).where(eq(salesInvoices.id, id));
    } catch (error: any) {
      // console.error("Error deleting sales invoice:", error); // Original console.error commented out
      await this.createErrorLog({
        message:
          `Error in deleteSalesInvoice (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteSalesInvoice",
        severity: "error",
      });
      throw error;
    }
  }

  async createInvoiceGLEntries(invoiceId: number): Promise<void> {
    try {
      // Get the invoice details
      const invoice = await db
        .select()
        .from(salesInvoices)
        .leftJoin(customers, eq(salesInvoices.customerId, customers.id))
        .where(eq(salesInvoices.id, invoiceId))
        .limit(1);

      if (!invoice[0]) {
        throw new Error(`Invoice with ID ${invoiceId} not found`);
      }

      const invoiceData = invoice[0].sales_invoices;
      const customerData = invoice[0].customers;

      // Create receivable entry (Debit Accounts Receivable)
      await db.insert(generalLedgerEntries).values({
        entryType: "receivable",
        referenceType: "sales_invoice",
        referenceId: invoiceId,
        accountName: "Accounts Receivable",
        description: `Sales Invoice ${invoiceData.invoiceNumber} - ${
          customerData?.name || "Unknown Customer"
        }`,
        debitAmount: invoiceData.totalAmount || "0",
        creditAmount: "0",
        entityId: invoiceData.customerId,
        entityName: customerData?.name || null,
        projectId: invoiceData.projectId,
        invoiceNumber: invoiceData.invoiceNumber,
        transactionDate: invoiceData.invoiceDate,
        dueDate: invoiceData.dueDate,
        status: "pending",
      });

      // Create revenue entry (Credit Sales Revenue)
      await db.insert(generalLedgerEntries).values({
        entryType: "receivable",
        referenceType: "sales_invoice",
        referenceId: invoiceId,
        accountName: "Sales Revenue",
        description: `Sales Invoice ${invoiceData.invoiceNumber} - ${
          customerData?.name || "Unknown Customer"
        }`,
        debitAmount: "0",
        creditAmount: invoiceData.totalAmount || "0",
        entityId: invoiceData.customerId,
        entityName: customerData?.name || null,
        projectId: invoiceData.projectId,
        invoiceNumber: invoiceData.invoiceNumber,
        transactionDate: invoiceData.invoiceDate,
        dueDate: invoiceData.dueDate,
        status: "pending",
      });

      console.log(
        `GL entries created for invoice ${invoiceData.invoiceNumber}`
      );
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in createInvoiceGLEntries (invoiceId: ${invoiceId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createInvoiceGLEntries",
        severity: "error",
      });
      throw error;
    }
  }
}

export interface IStorage {
  // User methods
  getUserByUsername(username: string): Promise<User | undefined>;
  getUser(id: number): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(userData: InsertUser): Promise<User>;
  updateUser(
    id: number,
    userData: Partial<InsertUser>
  ): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;

  // Company methods
  getCompany(): Promise<Company | undefined>;
  updateCompany(companyData: InsertCompany): Promise<Company>;

  // Customer methods
  getCustomers(): Promise<Customer[]>;
  getCustomersPaginated(
    page: number,
    limit: number,
    search: string,
    showArchived: boolean
  ): Promise<PaginatedResponse<Customer>>;
  getCustomer(id: number): Promise<Customer | undefined>;
  createCustomer(customerData: InsertCustomer): Promise<Customer>;
  updateCustomer(
    id: number,
    customerData: Partial<InsertCustomer>
  ): Promise<Customer | undefined>;
  deleteCustomer(id: number): Promise<boolean>;

  // Supplier methods
  getSuppliers(): Promise<Supplier[]>;
  getSuppliersPaginated(
    page: number,
    limit: number,
    search: string,
    showArchived: boolean
  ): Promise<PaginatedResponse<Supplier>>;
  getSupplier(id: number): Promise<Supplier | undefined>;
  createSupplier(supplierData: InsertSupplier): Promise<Supplier>;
  updateSupplier(
    id: number,
    supplierData: Partial<InsertSupplier>
  ): Promise<Supplier | undefined>;
  deleteSupplier(id: number): Promise<boolean>;

  // Employee methods
  getEmployees(): Promise<Employee[]>;
  createEmployee(employeeData: InsertEmployee): Promise<Employee>;
  updateEmployee(
    id: number,
    employeeData: Partial<InsertEmployee>
  ): Promise<Employee | undefined>;

  // Project methods
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  getProjectsByCustomer(customerId: number): Promise<Project[]>;
  createProject(projectData: InsertProject): Promise<Project>;
  updateProject(
    id: number,
    data: Partial<Project>
  ): Promise<Project | undefined>;

  // Project Employee methods
  getProjectEmployees(
    projectId: number
  ): Promise<
    Array<
      Employee & { startDate?: string; endDate?: string; assignedAt?: string }
    >
  >;
  assignEmployeeToProject(
    projectId: number,
    employeeId: number
  ): Promise<ProjectEmployee | undefined>;
  assignEmployeesToProject(
    projectId: number,
    assignments: AssignEmployeeData[]
  ): Promise<ProjectEmployee[]>;
  recalculateProjectCost(projectId: number): Promise<void>;
  updateProjectEndDateAndRecalculate(
    projectId: number,
    endDate: Date
  ): Promise<Project | undefined>;
  removeEmployeeFromProject(
    projectId: number,
    employeeId: number
  ): Promise<boolean>;

  // Inventory methods
  getInventoryItems(): Promise<InventoryItem[]>;
  getInventoryItemsPaginated(
    page: number,
    limit: number,
    search: string,
    category: string,
    lowStock: boolean
  ): Promise<PaginatedResponse<InventoryItem>>;
  getInventoryItem(id: number): Promise<InventoryItem | undefined>; // This line should remain as is
  createInventoryItem(itemData: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(
    id: number,
    itemData: Partial<InventoryItem>
  ): Promise<InventoryItem | undefined>;

  // Asset methods
  getAssets(): Promise<Asset[]>;
  getAsset(id: number): Promise<Asset | undefined>;
  createAsset(assetData: InsertAsset): Promise<Asset>;
  updateAsset(
    id: number,
    assetData: Partial<InsertAsset>
  ): Promise<Asset | undefined>;
  createAssetMaintenanceRecord(maintenanceData: {
    assetId: number;
    maintenanceCost: string;
    description?: string | null;
    maintenanceDate?: Date;
    performedBy?: number | null;
  }): Promise<AssetMaintenanceRecord>; // Changed from Promise<any>
  getAssetMaintenanceRecords(
    assetId: number
  ): Promise<AssetMaintenanceRecordWithUser[]>; // Changed from Promise<any[]>
  getAllAssetMaintenanceRecords(): Promise<AssetMaintenanceRecordWithUser[]>; // Changed from Promise<any[]>

  // Daily Activity methods
  getDailyActivities(projectId: number): Promise<DailyActivity[]>;
  getDailyActivitiesPaginated(
    projectId: number,
    limit: number,
    offset: number
  ): Promise<{ data: DailyActivity[]; total: number }>;
  createDailyActivity(
    activityData: InsertDailyActivity
  ): Promise<DailyActivity>;

  // Planned Activities methods (added to interface)
  getPlannedActivities(projectId: number): Promise<PlannedActivityItem[]>;
  getPlannedActivitiesPaginated(
    projectId: number,
    limit: number,
    offset: number
  ): Promise<{ data: PlannedActivityItem[]; total: number }>;
  savePlannedActivities(
    projectId: number,
    activities: PlannedActivityItem[]
  ): Promise<DailyActivity[]>;

  // Supplier-Inventory Item mapping methods
  getSupplierInventoryItems(
    inventoryItemId?: number,
    supplierId?: number
  ): Promise<SupplierInventoryItem[]>;
  createSupplierInventoryItem(
    data: InsertSupplierInventoryItem
  ): Promise<SupplierInventoryItem>;
  deleteSupplierInventoryItemsByInventoryId(
    inventoryItemId: number
  ): Promise<boolean>;
  updateSupplierInventoryItem(
    id: number,
    data: Partial<InsertSupplierInventoryItem>
  ): Promise<SupplierInventoryItem | undefined>;
  deleteSupplierInventoryItem(id: number): Promise<boolean>;
  getSupplierInventoryItemsBySupplierId(
    supplierId: number
  ): Promise<SupplierInventoryItem[]>;
  getProductsBySupplier(supplierId: number): Promise<any[]>;

  // Project Photo Group methods
  getProjectPhotoGroups(projectId: number): Promise<ProjectPhotoGroup[]>;
  createProjectPhotoGroup(
    groupData: InsertProjectPhotoGroup
  ): Promise<ProjectPhotoGroup>;
  addPhotosToPhotoGroup(
    groupId: number,
    photosData: Omit<InsertProjectPhoto, "groupId">[]
  ): Promise<ProjectPhoto[]>;
  updateProjectPhotoGroup(
    id: number,
    groupData: Partial<InsertProjectPhotoGroup>
  ): Promise<ProjectPhotoGroup | undefined>;
  deleteProjectPhotoGroup(id: number): Promise<boolean>;

  // Project Photo methods
  getProjectPhotos(groupId: number): Promise<ProjectPhoto[]>;
  createProjectPhoto(photoData: InsertProjectPhoto): Promise<ProjectPhoto>;
  deleteProjectPhoto(photoId: number): Promise<boolean>;

  // Project Consumables methods
  getProjectConsumables(
    projectId: number
  ): Promise<ProjectConsumableWithItems[]>;
  createProjectConsumables(
    projectId: number,
    date: string,
    items: CreateProjectConsumableItemInput[],
    userId?: number
  ): Promise<CreatedProjectConsumable>;

  // Payroll methods
  getPayrollEntries(
    month?: number,
    year?: number,
    employeeId?: number,
    projectId?: number
  ): Promise<PayrollEntryWithEmployeeDetails[]>;
  generateMonthlyPayroll(
    month: number,
    year: number,
    userId?: number
  ): Promise<PayrollEntryWithEmployeeDetails[]>;
  updatePayrollEntry(
    id: number,
    payrollData: Partial<InsertPayrollEntry>,
    userId?: number
  ): Promise<PayrollEntry | undefined>;
  clearAllPayrollEntries(): Promise<number>;
  clearPayrollEntriesByPeriod(month: number, year: number): Promise<number>;
  clearPayrollPeriod(
    month: number,
    year: number
  ): Promise<{
    deletedPayrollEntries: number;
    deletedGeneralLedgerEntries: number;
  }>;

  // Payroll Additions methods
  getPayrollAdditions(payrollEntryId: number): Promise<PayrollAddition[]>;
  createPayrollAddition( // Parameter type already InsertPayrollAddition in IStorage, class was Omit<>
    additionData: InsertPayrollAddition
  ): Promise<PayrollAddition>;
  updatePayrollAddition( // Parameter type already Partial<InsertPayrollAddition> in IStorage, class was Partial<PayrollAddition>
    id: number,
    additionData: Partial<InsertPayrollAddition>
  ): Promise<PayrollAddition | undefined>;
  deletePayrollAddition(id: number): Promise<boolean>;
  getPayrollAddition(id: number): Promise<PayrollAddition | undefined>;

  // Payroll Deductions methods
  getPayrollDeductions(payrollEntryId: number): Promise<PayrollDeduction[]>;
  createPayrollDeduction( // Parameter type already InsertPayrollDeduction in IStorage, class was Omit<>
    deductionData: InsertPayrollDeduction
  ): Promise<PayrollDeduction>;
  updatePayrollDeduction( // Parameter type already Partial<InsertPayrollDeduction> in IStorage, class was Partial<PayrollDeduction>
    id: number,
    deductionData: Partial<InsertPayrollDeduction>
  ): Promise<PayrollDeduction | undefined>;
  deletePayrollDeduction(id: number): Promise<boolean>;
  getPayrollDeduction(id: number): Promise<PayrollDeduction | undefined>;

  // Helper method
  updatePayrollEntryTotals(payrollEntryId: number): Promise<void>;

  // Sales Quotation methods
  getSalesQuotations(): Promise<SalesQuotation[]>;
  createSalesQuotation(
    quotationData: InsertSalesQuotation
  ): Promise<SalesQuotation>;
  updateSalesQuotation(
    id: number,
    quotationData: Partial<InsertSalesQuotation>
  ): Promise<SalesQuotation | undefined>;
  getSalesQuotation(id: number): Promise<SalesQuotation | undefined>;
  deleteSalesQuotation(id: number): Promise<void>;
  getSalesQuotationsPaginated(
    page: number,
    limit: number,
    filters?: {
      search?: string;
      status?: string;
      customerId?: number;
      archived?: boolean;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<PaginatedResponse<SalesQuotationWithCustomerName>>;

  // Sales Invoice methods
  getSalesInvoices(): Promise<SalesInvoice[]>;
  getSalesInvoice(id: number): Promise<SalesInvoice | undefined>;
  createSalesInvoice(invoiceData: InsertSalesInvoice): Promise<SalesInvoice>;
  updateSalesInvoice(
    id: number,
    invoiceData: Partial<InsertSalesInvoice>
  ): Promise<SalesInvoice | undefined>;
  deleteSalesInvoice(id: number): Promise<void>;

  // Invoice Payments methods
  getInvoicePayments(invoiceId: number): Promise<InvoicePayment[]>;
  createInvoicePayment(
    paymentData: InsertInvoicePayment
  ): Promise<InvoicePayment>;
  updateInvoicePaidAmount(invoiceId: number): Promise<void>;
  getReceivables(): Promise<any[]>;

  // Project Revenue methods
  getProjectRevenue(projectId: number): Promise<{
    projectId: number;
    totalRevenue: string;
    totalCost: string;
    profit: string;
    invoicePayments: InvoicePaymentWithCustomerName[];
  }>;
  updateProjectRevenue(projectId: number): Promise<void>;
  // updateInvoicePaidAmount(invoiceId: number): Promise<void>; // Already listed under Invoice Payments
  getCreditNote(id: number): Promise<CreditNote | undefined>;
  createCreditNote(creditNoteData: InsertCreditNote): Promise<CreditNote>;
  updateCreditNote(
    id: number,
    creditNoteData: Partial<InsertCreditNote>
  ): Promise<CreditNote | undefined>;
  getCreditNotes(): Promise<CreditNoteWithDetails[]>;
  createInvoicePaymentForCreditNote(
    invoiceId: number,
    creditNote: CreditNote
  ): Promise<InvoicePayment>;
  updateSalesInvoiceFromCreditNote(
    invoiceId: number,
    creditNoteAmount: number
  ): Promise<SalesInvoice | undefined>;

  // Goods Receipt and Issue methods
  getGoodsReceipts(): Promise<GoodsReceiptDetails[]>;
  createGoodsReceipt(
    reference: string,
    items: GoodsReceiptItemInput[],
    userId?: number
  ): Promise<CreatedGoodsReceipt>;
  getGoodsIssues(): Promise<any[]>;

  createGoodsIssue(
    reference: string,
    projectId: number | undefined,
    items: Array<{ inventoryItemId: number; quantity: number }>,
    userId?: number
  ): Promise<any>;

  // Project Asset Assignment methods
  getProjectAssetAssignments(
    projectId: number
  ): Promise<ProjectAssetAssignmentWithAssetInfo[]>;
  createProjectAssetAssignment(
    assignmentData: InsertProjectAssetAssignment
  ): Promise<ProjectAssetAssignment>;
  updateProjectAssetAssignment(
    id: number,
    assignmentData: Partial<InsertProjectAssetAssignment>
  ): Promise<ProjectAssetAssignment | undefined>;
  deleteProjectAssetAssignment(id: number): Promise<boolean>;
  calculateAssetRentalCost(
    startDate: Date,
    endDate: Date,
    monthlyRate: number
  ): Promise<number>;
  getAssetAssignmentHistory(
    assetId: number
  ): Promise<AssetAssignmentHistoryEntry[]>;
  getAllAssetAssignments(): Promise<AllAssetAssignmentsEntry[]>;
  updateAssetStatusBasedOnAssignments(assetId: number): Promise<void>;
  updateAllAssetStatuses(): Promise<void>;

  // Purchase Request methods
  getPurchaseRequests(): Promise<any[]>;
  getPurchaseRequest(id: number): Promise<any>;
  createPurchaseRequest(requestData: any): Promise<any>;
  updatePurchaseRequest(id: number, data: any): Promise<any>;
  deletePurchaseRequest(id: number): Promise<boolean>;

  // Purchase Order methods
  getPurchaseOrders(): Promise<any[]>;
  getPurchaseOrder(id: number): Promise<any>;
  getPurchaseOrderItems(poId: number): Promise<any[]>;
  createPurchaseOrder(orderData: any): Promise<any>;
  updatePurchaseOrder(id: number, data: any): Promise<any>;
  deletePurchaseOrder(id: number): Promise<boolean>;
  getPurchaseInvoices(): Promise<any[]>;
  createPurchaseInvoiceFromPO(poId: number, invoiceData: any): Promise<any>;

  // Error Logs methods
  createErrorLog(errorData: {
    message: string;
    stack?: string;
    url?: string;
    userAgent?: string;
    userId?: number;
    severity?: string;
    component?: string;
  }): Promise<any>;
  getErrorLogs(
    page?: number,
    limit?: number,
    severity?: string,
    resolved?: boolean
  ): Promise<any>;
  updateErrorLog(id: number, updateData: { resolved?: boolean }): Promise<any>;
  clearErrorLogs(): Promise<number>;
  clearResolvedErrorLogs(): Promise<number>;

  // General Ledger methods
  createInvoiceGLEntries(invoiceId: number): Promise<void>;
}

import {
  invoicePayments,
  type InsertInvoicePayment,
  type PurchaseRequest,
  type InsertPurchaseRequest,
  purchaseOrders,
  purchaseOrderItems,
  purchaseInvoices,
  type InsertPurchaseOrder,
  type InsertPurchaseOrderItem,
  type InsertPurchaseInvoice,
} from "@shared/schema";

export const storage: IStorage = new Storage();
