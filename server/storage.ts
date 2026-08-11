import { format } from "date-fns";
import { db } from "./db";
import {
  getTableColumns,
  eq,
  asc,
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
  notInArray,
  like,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  users,
  companies,
  customers,
  suppliers,
  supplierBankDetails,
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
  locations,
  salesQuotations,
  salesInvoices,
  supplierInventoryItems,
  projectConsumables,
  projectConsumableItems,
  purchaseRequests,
  purchaseRequestItems,
  purchaseOrders,
  purchaseOrderItems,
  purchaseOrderFiles,
  purchaseInvoices,
  purchaseInvoiceItems,
  purchaseInvoiceFiles,
  purchaseCreditNotes,
  purchaseInvoicePayments,
  purchasePaymentFiles,
  errorLogs,
  invoicePayments,
  projectAssetAssignments,
  projectAssetInstanceAssignments,
  paymentFiles,
  proformaInvoices,
  creditNotes,
  generalLedgerEntries,
  chartOfAccounts,
  customerDocuments,
  supplierDocuments,
  reimbursements,
  exchangeRates,
  invoiceEditHistory,
  type InvoiceEditHistory,
  type InsertInvoiceEditHistory,
  employeeFeedback,
  type Reimbursement,
  type InsertReimbursement,
  type ExchangeRate,
  type InsertExchangeRate,
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
  type EmployeeReadinessHistory,
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
  type SupplierWithBankDetails,
  type SupplierBankDetails,
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
  type ChartOfAccount,
  type EmployeeFeedback,
  type InsertEmployeeFeedback,
  type Location,
} from "@shared/schema";
import bcrypt from "bcrypt";
import fs from "fs/promises";
import {
  getCommonStyles,
  generateCommonHeader,
  generateCommonFooter,
} from "./document-utils";
import { ReportStorage } from "./storage/report";
import type {
  CountResult,
  PaginatedResponse,
  AssetMaintenanceRecordWithUser,
  CreatePaymentFileData,
  AssignEmployeeData,
  PlannedActivityItem,
  SalesQuotationWithCustomerName,
  ProjectAssetAssignmentWithAssetInfo,
  AssetAssignmentHistoryEntry,
  AllAssetAssignmentsEntry,
  ProjectConsumableItemWithDetails,
  ProjectConsumableWithItems,
  CreateProjectConsumableItemInput,
  CreatedProjectConsumable,
  PayrollEntryEmployeeDetails,
  PayrollEntryWithEmployeeDetails,
  GoodsReceiptItemInput,
  GoodsReceiptItemDetails,
  GoodsReceiptDetails,
  CreatedGoodsReceiptItem,
  CreatedGoodsReceipt,
  InvoicePaymentWithCustomerName,
  CreditNoteWithDetails,
} from "./storage/types";

// The shared result types keep being exported from this module.
export * from "./storage/types";

// Storage is assembled from one linear chain of layers, so every
// method still lives on a single prototype and cross-domain this.*
// calls resolve exactly as they did when this was one class.
export class Storage extends ReportStorage {}

export interface IStorage {
  // Declared here because every caller of these is typed against IStorage;
  // without them each call site reports TS2339 even though the concrete
  // storage class implements both.
  createInvoiceEditHistory(entry: any): Promise<any>;
  getInvoiceEditHistory(invoiceType: string, invoiceId: number): Promise<any[]>;
  generateNextNumber(prefix: string, table: any, column: any): Promise<string>;
  // User methods
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUser(id: number): Promise<User | undefined>;
  getUserDisplayName(id: number): Promise<string | null>;
  getUsers(): Promise<User[]>;
  createUser(userData: InsertUser): Promise<User>;
  updateUser(
    id: number,
    userData: Partial<InsertUser>,
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
    showArchived: boolean,
  ): Promise<PaginatedResponse<Customer>>;
  getCustomer(id: number): Promise<Customer | undefined>;
  getCustomerStats(): Promise<{
    totalCustomers: number;
    activeCustomers: number;
    totalProjects: number;
    totalArchivedCustomers: number;
  }>;
  createCustomer(customerData: InsertCustomer): Promise<Customer>;
  updateCustomer(
    id: number,
    customerData: Partial<InsertCustomer>,
  ): Promise<Customer | undefined>;
  deleteCustomer(id: number): Promise<boolean>;

  // Supplier methods
  getSuppliers(): Promise<SupplierWithBankDetails[]>;
  getSupplierStats(): Promise<{
    totalSuppliers: number;
    activeSuppliers: number;
    totalArchivedSuppliers: number;
  }>;
  getSuppliersPaginated(
    page: number,
    limit: number,
    search: string,
    showArchived: boolean,
  ): Promise<PaginatedResponse<SupplierWithBankDetails>>;
  getSupplier(id: number): Promise<SupplierWithBankDetails | undefined>;
  createSupplier(
    supplierData: InsertSupplier,
  ): Promise<SupplierWithBankDetails>;
  updateSupplier(
    id: number,
    supplierData: Partial<InsertSupplier>,
  ): Promise<SupplierWithBankDetails | undefined>;
  deleteSupplier(id: number): Promise<boolean>;

  // Employee methods
  getEmployees(): Promise<Employee[]>;
  getEmployeeByUserId(userId: number): Promise<Employee | undefined>;
  getEmployeeNextOfKin(employeeId: number): Promise<EmployeeNextOfKin[]>;
  getEmployeeTrainingRecords(
    employeeId: number,
  ): Promise<EmployeeTrainingRecord[]>;
  getEmployeeDocuments(employeeId: number): Promise<EmployeeDocument[]>;
  // Joining readiness: set by the employee from Profile or by an admin from the
  // Basic Info tab; every change is recorded against who made it.
  updateJoiningReadiness(
    employeeId: number,
    newDate: string | null,
    changedBy: number | null,
    changedByName: string | null,
  ): Promise<Employee | undefined>;
  getReadinessHistory(
    employeeId: number,
  ): Promise<EmployeeReadinessHistory[]>;
  getEmployeeReadiness(
    startDate: string,
    endDate?: string | null,
  ): Promise<
    Array<{
      id: number;
      employeeCode: string;
      firstName: string;
      lastName: string;
      department: string | null;
      position: string | null;
      joiningReadinessDate: string;
    }>
  >;
  createEmployee(employeeData: InsertEmployee): Promise<Employee>;
  updateEmployee(
    id: number,
    employeeData: Partial<InsertEmployee>,
  ): Promise<Employee | undefined>;

  // Project methods
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  getProjectsByCustomer(customerId: number): Promise<Project[]>;
  getProjectsByEmployee(employeeId: number): Promise<Project[]>;
  createProject(projectData: InsertProject): Promise<Project>;
  updateProject(
    id: number,
    data: Partial<Project>,
  ): Promise<Project | undefined>;

  // Project Employee methods
  getProjectEmployees(
    projectId: number,
  ): Promise<
    Array<
      Employee & { startDate?: string; endDate?: string; assignedAt?: string }
    >
  >;
  assignEmployeeToProject(
    projectId: number,
    employeeId: number,
  ): Promise<ProjectEmployee | undefined>;
  assignEmployeesToProject(
    projectId: number,
    assignments: AssignEmployeeData[],
  ): Promise<ProjectEmployee[]>;
  recalculateProjectCost(projectId: number): Promise<void>;
  updateProjectEndDateAndRecalculate(
    projectId: number,
    endDate: Date,
  ): Promise<Project | undefined>;
  removeEmployeeFromProject(
    projectId: number,
    employeeId: number,
  ): Promise<boolean>;

  // Inventory methods
  getInventoryItems(): Promise<InventoryItem[]>;
  getInventoryItemsPaginated(
    page: number,
    limit: number,
    search: string,
    category: string,
    lowStock: boolean,
  ): Promise<PaginatedResponse<InventoryItem>>;
  getInventoryItem(id: number): Promise<InventoryItem | undefined>; // This line should remain as is
  createInventoryItem(itemData: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(
    id: number,
    itemData: Partial<InventoryItem>,
  ): Promise<InventoryItem | undefined>;

  // Asset methods
  getAssets(): Promise<Asset[]>;
  getAsset(id: number): Promise<Asset | undefined>;
  createAsset(assetData: InsertAsset): Promise<Asset>;
  updateAsset(
    id: number,
    assetData: Partial<InsertAsset>,
  ): Promise<Asset | undefined>;
  createAssetMaintenanceRecord(maintenanceData: {
    assetId: number;
    maintenanceCost: string;
    description?: string | null;
    maintenanceDate?: Date;
    performedBy?: number | null;
  }): Promise<AssetMaintenanceRecord>; // Changed from Promise<any>
  getAssetMaintenanceRecords(
    assetId: number,
  ): Promise<AssetMaintenanceRecordWithUser[]>; // Changed from Promise<any[]>
  getAllAssetMaintenanceRecords(): Promise<AssetMaintenanceRecordWithUser[]>; // Changed from Promise<any[]>

  // Daily Activity methods
  getDailyActivities(projectId: number): Promise<DailyActivity[]>;
  getDailyActivitiesPaginated(
    projectId: number,
    limit: number,
    offset: number,
  ): Promise<{ data: DailyActivity[]; total: number }>;
  createDailyActivity(
    activityData: InsertDailyActivity,
  ): Promise<DailyActivity>;

  // Planned Activities methods (added to interface)
  getPlannedActivities(projectId: number): Promise<PlannedActivityItem[]>;
  getPlannedActivitiesPaginated(
    projectId: number,
    limit: number,
    offset: number,
  ): Promise<{ data: PlannedActivityItem[]; total: number }>;
  savePlannedActivities(
    projectId: number,
    activities: PlannedActivityItem[],
  ): Promise<DailyActivity[]>;

  // Supplier-Inventory Item mapping methods
  getSupplierInventoryItems(
    inventoryItemId?: number,
    supplierId?: number,
  ): Promise<SupplierInventoryItem[]>;
  createSupplierInventoryItem(
    data: InsertSupplierInventoryItem,
  ): Promise<SupplierInventoryItem>;
  deleteSupplierInventoryItemsByInventoryId(
    inventoryItemId: number,
  ): Promise<boolean>;
  updateSupplierInventoryItem(
    id: number,
    data: Partial<InsertSupplierInventoryItem>,
  ): Promise<SupplierInventoryItem | undefined>;
  deleteSupplierInventoryItem(id: number): Promise<boolean>;
  getSupplierInventoryItemsBySupplierId(
    supplierId: number,
  ): Promise<SupplierInventoryItem[]>;
  getProductsBySupplier(supplierId: number): Promise<any[]>;

  // Project Photo Group methods
  getProjectPhotoGroups(projectId: number): Promise<any[]>;
  createProjectPhotoGroup(
    groupData: InsertProjectPhotoGroup,
  ): Promise<ProjectPhotoGroup>;
  addPhotosToPhotoGroup(
    groupId: number,
    photosData: Omit<InsertProjectPhoto, "groupId">[],
  ): Promise<ProjectPhoto[]>;
  updateProjectPhotoGroup(
    id: number,
    groupData: Partial<InsertProjectPhotoGroup>,
  ): Promise<ProjectPhotoGroup | undefined>;
  deleteProjectPhotoGroup(id: number): Promise<boolean>;

  // Project Photo methods
  getProjectPhotos(groupId: number): Promise<ProjectPhoto[]>;
  createProjectPhoto(photoData: InsertProjectPhoto): Promise<ProjectPhoto>;
  deleteProjectPhoto(photoId: number): Promise<boolean>;

  // Project Consumables methods
  getProjectConsumables(
    projectId: number,
    fromDate,
    toDate,
  ): Promise<ProjectConsumableWithItems[]>;
  createProjectConsumables(
    projectId: number,
    date: string,
    items: CreateProjectConsumableItemInput[],
    userId?: number,
  ): Promise<CreatedProjectConsumable>;
  updateProjectConsumableItem(
    itemId: number,
    projectId: number,
    data: {
      itemName: string;
      itemUnit: string;
      quantity: number;
      unitCost: number | string;
    },
  ): Promise<any>;
  createConsumablesGoodsIssue(
    projectId: number,
    consumableIds: number[],
    userId?: number,
  ): Promise<{ goodsIssueRef: string; updatedCount: number }>;

  // Payroll methods
  getPayrollEntries(
    month?: number,
    year?: number,
    employeeId?: number,
    projectId?: number,
  ): Promise<PayrollEntryWithEmployeeDetails[]>;
  generateMonthlyPayroll(
    month: number,
    year: number,
    userId?: number,
  ): Promise<PayrollEntryWithEmployeeDetails[]>;
  updatePayrollEntry(
    id: number,
    payrollData: Partial<InsertPayrollEntry>,
    userId?: number,
  ): Promise<PayrollEntry | undefined>;
  clearAllPayrollEntries(userId?: number): Promise<number>;
  clearPayrollEntriesByPeriod(month: number, year: number): Promise<number>;
  clearPayrollPeriod(
    month: number,
    year: number,
    userId?: number,
  ): Promise<{
    deletedPayrollEntries: number;
    deletedGeneralLedgerEntries: number;
  }>;
  getProvidentFundBalances(): Promise<
    Array<{ entityId: number; entityName: string; balance: string }>
  >;

  // Payroll Additions methods
  getPayrollAdditions(payrollEntryId: number): Promise<PayrollAddition[]>;
  createPayrollAddition( // Parameter type already InsertPayrollAddition in IStorage, class was Omit<>
    additionData: InsertPayrollAddition,
  ): Promise<PayrollAddition>;
  updatePayrollAddition( // Parameter type already Partial<InsertPayrollAddition> in IStorage, class was Partial<PayrollAddition>
    id: number,
    additionData: Partial<InsertPayrollAddition>,
  ): Promise<PayrollAddition | undefined>;
  deletePayrollAddition(id: number): Promise<boolean>;
  getPayrollAddition(id: number): Promise<PayrollAddition | undefined>;

  // Payroll Deductions methods
  getPayrollDeductions(payrollEntryId: number): Promise<PayrollDeduction[]>;
  createPayrollDeduction( // Parameter type already InsertPayrollDeduction in IStorage, class was Omit<>
    deductionData: InsertPayrollDeduction,
  ): Promise<PayrollDeduction>;
  updatePayrollDeduction( // Parameter type already Partial<InsertPayrollDeduction> in IStorage, class was Partial<PayrollDeduction>
    id: number,
    deductionData: Partial<InsertPayrollDeduction>,
  ): Promise<PayrollDeduction | undefined>;
  deletePayrollDeduction(id: number): Promise<boolean>;
  getPayrollDeduction(id: number): Promise<PayrollDeduction | undefined>;

  // Helper method
  updatePayrollEntryTotals(payrollEntryId: number): Promise<void>;

  // Reimbursement methods
  getReimbursements(filters?: {
    userId?: number;
    status?: string;
    employeeId?: number;
  }): Promise<any[]>;
  getReimbursement(id: number): Promise<Reimbursement | undefined>;
  createReimbursement(data: InsertReimbursement): Promise<Reimbursement>;
  approveReimbursement(
    id: number,
    approverId: number,
  ): Promise<Reimbursement | undefined>;
  rejectReimbursement(
    id: number,
    approverId: number,
    reason?: string,
  ): Promise<Reimbursement | undefined>;
  getReimbursementsForPayroll(month: number, year: number): Promise<any[]>;
  deleteReimbursement(id: number): Promise<boolean>;

  // Sales Quotation methods
  getSalesQuotations(): Promise<SalesQuotation[]>;
  createSalesQuotation(
    quotationData: InsertSalesQuotation,
  ): Promise<SalesQuotation>;
  updateSalesQuotation(
    id: number,
    quotationData: Partial<InsertSalesQuotation>,
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
    },
  ): Promise<PaginatedResponse<SalesQuotationWithCustomerName>>;

  getSalesStats(): Promise<{
    totalQuotations: number;
    totalInvoices: number;
    totalQuotationValue: string;
    totalInvoiceValue: string;
    totalReceivablesValue: string;
  }>;

  // Sales Invoice methods
  getSalesInvoices(): Promise<SalesInvoice[]>;
  getSalesInvoice(id: number): Promise<SalesInvoice | undefined>;
  createSalesInvoice(invoiceData: InsertSalesInvoice): Promise<SalesInvoice>;
  updateSalesInvoice(
    id: number,
    invoiceData: Partial<InsertSalesInvoice>,
  ): Promise<SalesInvoice | undefined>;
  deleteSalesInvoice(id: number): Promise<void>;

  // Payment file methods
  createPaymentFile(fileData: CreatePaymentFileData): Promise<PaymentFile>;
  getPaymentFiles(paymentId: number): Promise<PaymentFile[]>;
  getPaymentFile(id: number): Promise<PaymentFile | undefined>;
  deletePaymentFile(fileId: number): Promise<boolean>;

  // Invoice Payments methods
  getInvoicePayments(invoiceId: number): Promise<InvoicePayment[]>;
  createInvoicePayment(
    paymentData: InsertInvoicePayment,
  ): Promise<InvoicePayment>;
  updateInvoicePaidAmount(invoiceId: number): Promise<void>;
  getReceivables(filters?: {
    customerId?: number;
    projectId?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<any[]>;

  // Project Revenue methods
  getProjectRevenue(projectId: number): Promise<{
    projectId: number;
    totalRevenue: string;
    totalCost: string;
    profit: string;
    invoicePayments: InvoicePaymentWithCustomerName[];
    expenses: {
      purchaseItems: {
        description: string;
        amount: string;
        supplierName: string | null;
        invoiceNumber: string | null;
        date: string | null;
      }[];
      reimbursements: {
        description: string;
        amount: string;
        employeeName: string | null;
        date: string | null;
      }[];
      purchaseTotal: string;
      reimbursementTotal: string;
    };
  }>;
  updateProjectRevenue(projectId: number): Promise<void>;
  // updateInvoicePaidAmount(invoiceId: number): Promise<void>; // Already listed under Invoice Payments
  getCreditNote(id: number): Promise<CreditNote | undefined>;
  createCreditNote(creditNoteData: InsertCreditNote): Promise<CreditNote>;
  updateCreditNote(
    id: number,
    creditNoteData: Partial<InsertCreditNote>,
  ): Promise<CreditNote | undefined>;
  /** Reverse an issued credit note's ledger entries and invoice settlement. */
  cancelCreditNote(id: number, userId?: number): Promise<CreditNote>;
  getCreditNotes(): Promise<CreditNoteWithDetails[]>;
  createInvoicePaymentForCreditNote(
    invoiceId: number,
    creditNote: CreditNote,
  ): Promise<InvoicePayment>;
  updateSalesInvoiceFromCreditNote(
    invoiceId: number,
    creditNoteAmount: number,
  ): Promise<SalesInvoice | undefined>;

  // Goods Receipt and Issue methods
  getGoodsReceipts(): Promise<GoodsReceiptDetails[]>;
  createGoodsReceipt(
    reference: string,
    items: GoodsReceiptItemInput[],
    userId?: number,
  ): Promise<CreatedGoodsReceipt>;
  getGoodsIssues(): Promise<any[]>;

  createGoodsIssue(
    reference: string,
    projectId: number | undefined,
    items: Array<{ inventoryItemId: number; quantity: number }>,
    userId?: number,
  ): Promise<any>;

  // Project Asset Assignment methods
  getProjectAssetAssignments(
    projectId: number,
  ): Promise<ProjectAssetAssignmentWithAssetInfo[]>;
  createProjectAssetAssignment(
    assignmentData: InsertProjectAssetAssignment,
  ): Promise<ProjectAssetAssignment>;
  updateProjectAssetAssignment(
    id: number,
    assignmentData: Partial<InsertProjectAssetAssignment>,
  ): Promise<ProjectAssetAssignment | undefined>;
  deleteProjectAssetAssignment(id: number): Promise<boolean>;
  calculateAssetRentalCost(
    startDate: Date,
    endDate: Date,
    monthlyRate: number,
  ): Promise<number>;
  getAssetAssignmentHistory(
    assetId: number,
  ): Promise<AssetAssignmentHistoryEntry[]>;
  getAllAssetAssignments(): Promise<AllAssetAssignmentsEntry[]>;
  updateAssetStatusBasedOnAssignments(assetId: number): Promise<void>;
  updateAllAssetStatuses(): Promise<void>;

  // Purchase Request methods
  getPurchaseRequestStats(): Promise<{
    totalRequests: number;
    pendingApproval: number;
    approved: number;
    urgentPriority: number;
  }>;
  getPurchaseRequestsPaginated(
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
  ): Promise<PaginatedResponse<any>>;
  getPurchaseRequests(): Promise<any[]>;
  getPurchaseRequest(id: number): Promise<any>;
  createPurchaseRequest(requestData: any): Promise<any>;
  updatePurchaseRequest(id: number, data: any): Promise<any>;
  deletePurchaseRequest(id: number): Promise<boolean>;

  // Purchase Order methods
  getPurchaseOrderStats(): Promise<{
    totalOrders: number;
    approved: number;
    pendingApproval: number;
    totalValue: string;
  }>;
  getPurchaseOrdersPaginated(
    page: number,
    limit: number,
    filters?: {
      search?: string;
      status?: string;
      supplierId?: number;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<PaginatedResponse<any>>;
  getPurchaseOrders(): Promise<any[]>;
  getPurchaseOrder(id: number): Promise<any>;
  getPurchaseOrderItems(poId: number): Promise<any[]>;
  createPurchaseOrder(orderData: any): Promise<any>;
  updatePurchaseOrder(id: number, data: any): Promise<any>;
  deletePurchaseOrder(id: number): Promise<boolean>;
  submitPurchaseOrderForApproval(id: number, userId: number): Promise<any>;
  approvePurchaseOrder(id: number, userId: number): Promise<any>;
  rejectPurchaseOrder(
    id: number,
    userId: number,
    reason?: string,
  ): Promise<any>;
  convertPurchaseOrderToInvoice(
    id: number,
    userId: number,
    overrides: any,
  ): Promise<any>;
  getPurchaseInvoicesPaginated(
    page: number,
    limit: number,
    filters?: {
      startDate?: string;
      endDate?: string;
      supplierId?: number;
      /** Approval lifecycle: draft / pending_approval / approved / rejected / cancelled. */
      status?: string;
      /** Settlement: unpaid / partial / paid. Independent of `status`. */
      paymentStatus?: string;
      search?: string;
      projectId?: number;
    },
  ): Promise<PaginatedResponse<any>>;
  getPurchaseStats(): Promise<{
    totalInvoices: number;
    totalAmount: string;
    paidAmount: string;
    pendingAmount: string;
    overdueCount: number;
    overdueAmount: string;
    pendingApprovalCount: number;
  }>;
  getPurchaseInvoices(): Promise<any[]>;
  getPurchaseInvoicePayments(invoiceId: number): Promise<any[]>;
  getPurchasePaymentFile(id: number): Promise<any | undefined>;
  createPurchasePaymentFile(fileData: any): Promise<any>;
  getPurchaseInvoice(id: number): Promise<any>;
  updatePurchaseInvoice(id: number, invoiceData: any): Promise<any>;

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
    resolved?: boolean,
    userId?: number,
  ): Promise<any>;
  updateErrorLog(id: number, updateData: { resolved?: boolean }): Promise<any>;
  clearErrorLogs(): Promise<number>;
  clearResolvedErrorLogs(): Promise<number>;

  // General Ledger methods
  createInvoiceGLEntries(invoiceId: number): Promise<void>;

  // Chart of Accounts methods
  getChartOfAccounts(): Promise<ChartOfAccount[]>;
  getChartOfAccountByName(
    accountName: string,
  ): Promise<ChartOfAccount | undefined>;

  // Ledger rebuild (Phase 11)
  verifyChartOfAccounts(): Promise<{
    ok: boolean;
    missing: { accountCode: string; accountName: string }[];
    renamed: { accountCode: string; expected: string; actual: string }[];
    unexpected: { accountCode: string; accountName: string }[];
  }>;
  reseedChartOfAccounts(): Promise<{
    backupTable: string;
    removed: number;
    inserted: number;
  }>;
  computeLedgerRebuild(): Promise<{
    rows: any[];
    totalDebit: number;
    totalCredit: number;
    balanced: boolean;
    byAccount: {
      accountName: string;
      debit: number;
      credit: number;
      net: number;
    }[];
    skipped: {
      cancelledSales: number;
      cancelledPurchase: number;
      creditNoteSettlements: number;
    };
  }>;
  executeLedgerRebuild(userId?: number): Promise<{
    backupTables: string[];
    deletedGl: number;
    deletedPayroll: number;
    postedRows: number;
    totalDebit: number;
    totalCredit: number;
    chartRepaired: {
      backupTable: string;
      removed: number;
      inserted: number;
    } | null;
  }>;
  getLocations(): Promise<Location[]>;
  //Profile
  changePassword(
    id: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<boolean>;

  // Exchange Rate methods
  getExchangeRates(): Promise<ExchangeRate[]>;
  getExchangeRate(id: number): Promise<ExchangeRate | undefined>;
  getExchangeRateForCurrency(
    fromCurrency: string,
    toCurrency?: string,
  ): Promise<string>;
  createExchangeRate(data: InsertExchangeRate): Promise<ExchangeRate>;
  updateExchangeRate(
    id: number,
    data: Partial<InsertExchangeRate>,
  ): Promise<ExchangeRate | undefined>;
  deleteExchangeRate(id: number): Promise<boolean>;

  // Employee Feedback methods
  getEmployeeFeedback(employeeId: number): Promise<any[]>;
  createEmployeeFeedback(
    data: InsertEmployeeFeedback,
  ): Promise<EmployeeFeedback>;
  updateEmployeeFeedback(
    id: number,
    data: { feedback: string; projectId: number | null },
  ): Promise<EmployeeFeedback | undefined>;
  deleteEmployeeFeedback(id: number): Promise<boolean>;
  getEmployeeFeedbackById(id: number): Promise<EmployeeFeedback | undefined>;
  getCustomerStatement(filters: {
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
  }>;
  getSupplierStatement(filters: {
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
  }>;
}


export const storage: IStorage = new Storage();
