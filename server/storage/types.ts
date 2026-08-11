import {
  CreditNote,
  InvoicePayment,
  PayrollEntry,
  ProjectConsumable,
  ProjectConsumableItem,
  SalesQuotation,
} from "@shared/schema";

// Helper type for count results
export type CountResult = { count: number };

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
  isArchived: boolean;
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
  submittedByName: string | null;
  approvedByName: string | null;
}

// For getProjectAssetAssignments return type
export interface ProjectAssetAssignmentWithAssetInfo extends ProjectAssetAssignment {
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
export interface ProjectConsumableItemWithDetails extends ProjectConsumableItem {
  itemName: string | null;
  itemUnit: string | null;
}

export interface ProjectConsumableWithItems extends ProjectConsumable {
  createdByName: string | null;
  items: ProjectConsumableItemWithDetails[];
}

// For createProjectConsumables items parameter
export interface CreateProjectConsumableItemInput {
  inventoryItemId?: number | null;
  quantity: number;
  itemName?: string;
  itemUnit?: string;
  unitCost?: string;
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
  category: string | null;
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
  invoiceNumber: string | null;
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
