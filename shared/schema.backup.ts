import { pgTable, text, serial, integer, boolean, timestamp, decimal, json, numeric, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users and Authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("employee"), // admin, project_manager, finance, customer, employee
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Company Configuration
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logo: text("logo"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
});

// Customers
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  taxId: text("tax_id"),
  userId: integer("user_id").references(() => users.id),
  isArchived: boolean("is_archived").notNull().default(false),
});

// Suppliers
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  taxId: text("tax_id"),
  bankInfo: text("bank_info"),
  isArchived: boolean("is_archived").notNull().default(false),
});

// Employees
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  employeeCode: text("employee_code").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  position: text("position"),
  department: text("department"),
  category: text("category").notNull().default("permanent"), // permanent, consultant, contract
  salary: decimal("salary", { precision: 10, scale: 2 }),
  hireDate: timestamp("hire_date"),
  isActive: boolean("is_active").notNull().default(true),
  userId: integer("user_id").references(() => users.id),
});

// Projects
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  vesselName: text("vessel_name"),
  vesselImage: text("vessel_image"),
  vesselImoNumber: text("vessel_imo_number"),
  startDate: timestamp("start_date"),
  plannedEndDate: timestamp("planned_end_date"),
  actualEndDate: timestamp("actual_end_date"),
  status: text("status").notNull().default("not_started"), // not_started, in_progress, on_hold, completed, cancelled
  estimatedBudget: decimal("estimated_budget", { precision: 12, scale: 2 }),
  actualCost: decimal("actual_cost", { precision: 12, scale: 2 }).default("0"),
  totalRevenue: decimal("total_revenue", { precision: 12, scale: 2 }).default("0"),
  customerId: integer("customer_id").references(() => customers.id),
  locations: json("locations").$type<string[]>().default([]),
  ridgingCrewNos: text("ridging_crew_nos"),
  modeOfContract: text("mode_of_contract"),
  workingHours: text("working_hours"),
  ppe: text("ppe"),
  additionalField1Title: text("additional_field_1_title"),
  additionalField1Description: text("additional_field_1_description"),
  additionalField2Title: text("additional_field_2_title"),
  additionalField2Description: text("additional_field_2_description"),
  additionalField3Title: text("additional_field_3_title"),
  additionalField3Description: text("additional_field_3_description"),
});

// Project Employee Assignments
export const projectEmployees = pgTable("project_employees", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id),
  employeeId: integer("employee_id").references(() => employees.id),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
});

// Inventory Items
export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(), // consumables, tools, equipment
  unit: text("unit").notNull(),
  currentStock: integer("current_stock").notNull().default(0),
  minStockLevel: integer("min_stock_level").notNull().default(0),
  avgCost: decimal("avg_cost", { precision: 10, scale: 4 }).default("0"),
});

// Inventory Transactions (for FIFO tracking)
export const inventoryTransactions = pgTable("inventory_transactions", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").references(() => inventoryItems.id),
  type: text("type").notNull(), // inflow, outflow
  quantity: integer("quantity").notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 4 }),
  remainingQuantity: integer("remaining_quantity").notNull(),
  projectId: integer("project_id").references(() => projects.id),
  reference: text("reference"), // PI number, GI number, etc.
  createdBy: integer("created_by").references(() => users.id),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Asset Types (Master catalog for asset categories)
export const assetTypes = pgTable("asset_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(), // equipment, tools, vehicles, electronics, furniture
  description: text("description"),
  manufacturer: text("manufacturer"),
  model: text("model"),
  specifications: json("specifications").$type<Record<string, any>>().default({}),
  defaultDailyRentalRate: decimal("default_daily_rental_rate", { precision: 10, scale: 2 }),
  depreciationRate: decimal("depreciation_rate", { precision: 5, scale: 2 }).default("0"), // annual percentage
  warrantyPeriodMonths: integer("warranty_period_months").default(12),
  maintenanceIntervalDays: integer("maintenance_interval_days").default(90),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Individual Asset Instances
export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  assetTypeId: integer("asset_type_id").references(() => assetTypes.id).notNull(),
  assetTag: text("asset_tag").notNull().unique(), // unique identifier like "EQP-001", "VEH-012"
  serialNumber: text("serial_number"), // manufacturer serial number
  barcode: text("barcode").unique(),
  status: text("status").notNull().default("available"), // available, in_use, maintenance, under_repair, retired, lost, stolen
  condition: text("condition").notNull().default("good"), // excellent, good, fair, poor, damaged
  location: text("location"), // current physical location
  projectId: integer("project_id").references(() => projects.id), // if assigned to project
  assignedToId: integer("assigned_to_id").references(() => employees.id), // if assigned to person
  supplierId: integer("supplier_id").references(() => suppliers.id), // where purchased from
  acquisitionDate: timestamp("acquisition_date"),
  acquisitionCost: decimal("acquisition_cost", { precision: 10, scale: 2 }),
  currentValue: decimal("current_value", { precision: 10, scale: 2 }), // depreciated value
  dailyRentalAmount: decimal("daily_rental_amount", { precision: 10, scale: 2 }),
  warrantyExpiryDate: timestamp("warranty_expiry_date"),
  lastMaintenanceDate: timestamp("last_maintenance_date"),
  nextMaintenanceDate: timestamp("next_maintenance_date"),
  notes: text("notes"),
  images: json("images").$type<string[]>().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Asset Movements/History
export const assetMovements = pgTable("asset_movements", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").references(() => assets.id).notNull(),
  movementType: text("movement_type").notNull(), // assignment, return, transfer, maintenance, repair
  fromLocation: text("from_location"),
  toLocation: text("to_location"),
  fromProjectId: integer("from_project_id").references(() => projects.id),
  toProjectId: integer("to_project_id").references(() => projects.id),
  fromEmployeeId: integer("from_employee_id").references(() => employees.id),
  toEmployeeId: integer("to_employee_id").references(() => employees.id),
  reason: text("reason"),
  notes: text("notes"),
  documentReference: text("document_reference"), // reference to related document
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Asset Maintenance Records
export const assetMaintenanceRecords = pgTable("asset_maintenance_records", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").references(() => assets.id).notNull(),
  maintenanceType: text("maintenance_type").notNull(), // preventive, corrective, emergency, inspection
  description: text("description").notNull(),
  performedBy: text("performed_by"), // internal employee or external vendor
  vendorId: integer("vendor_id").references(() => suppliers.id), // if external maintenance
  cost: decimal("cost", { precision: 10, scale: 2 }),
  laborHours: decimal("labor_hours", { precision: 8, scale: 2 }),
  partsUsed: json("parts_used").$type<{name: string, quantity: number, cost: number}[]>().default([]),
  maintenanceDate: timestamp("maintenance_date").notNull(),
  nextScheduledDate: timestamp("next_scheduled_date"),
  status: text("status").notNull().default("completed"), // scheduled, in_progress, completed, cancelled
  priority: text("priority").notNull().default("medium"), // low, medium, high, critical
  downtime: integer("downtime_hours"), // hours asset was unavailable
  notes: text("notes"),
  attachments: json("attachments").$type<string[]>().default([]),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Asset Depreciation Records
export const assetDepreciationRecords = pgTable("asset_depreciation_records", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").references(() => assets.id).notNull(),
  depreciationMethod: text("depreciation_method").notNull().default("straight_line"), // straight_line, declining_balance
  depreciationDate: date("depreciation_date").notNull(),
  originalValue: decimal("original_value", { precision: 10, scale: 2 }).notNull(),
  depreciationAmount: decimal("depreciation_amount", { precision: 10, scale: 2 }).notNull(),
  accumulatedDepreciation: decimal("accumulated_depreciation", { precision: 10, scale: 2 }).notNull(),
  bookValue: decimal("book_value", { precision: 10, scale: 2 }).notNull(),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Daily Activities
export const dailyActivities = pgTable("daily_activities", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id),
  date: timestamp("date").notNull(),
  location: text("location"),
  completedTasks: text("completed_tasks"),
  plannedTasks: text("planned_tasks"),
  remarks: text("remarks"),
  photos: json("photos").$type<string[]>().default([]),
});



// Project Photo Groups
export const projectPhotoGroups = pgTable("project_photo_groups", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id),
  title: text("title").notNull(),
  date: timestamp("date").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

// Project Photos
export const projectPhotos = pgTable("project_photos", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").references(() => projectPhotoGroups.id),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

// Sales Quotations
export const salesQuotations = pgTable("sales_quotations", {
  id: serial("id").primaryKey(),
  quotationNumber: text("quotation_number").notNull().unique(),
  customerId: integer("customer_id").references(() => customers.id),
  status: text("status").notNull().default("draft"), // draft, sent, approved, rejected, converted
  validUntil: timestamp("valid_until"),
  paymentTerms: text("payment_terms"),
  bankAccount: text("bank_account"),
  remarks: text("remarks"),
  items: json("items").$type<{description: string, quantity: number, unitPrice: number, taxRate?: number, taxAmount?: number}[]>().default([]),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
  isArchived: boolean("is_archived").notNull().default(false),
  createdDate: timestamp("created_date").notNull().defaultNow(),
});

// Sales Quotation Items
export const salesQuotationItems = pgTable("sales_quotation_items", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id").notNull().references(() => salesQuotations.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0"),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
});

// Sales Invoices
export const salesInvoices = pgTable("sales_invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  customerId: integer("customer_id").references(() => customers.id),
  projectId: integer("project_id").references(() => projects.id),
  quotationId: integer("quotation_id").references(() => salesQuotations.id),
  status: text("status").notNull().default("draft"), // draft, approved, unpaid, partially_paid, paid, overdue
  invoiceDate: timestamp("invoice_date", { mode: 'string' }).notNull(),
  dueDate: timestamp("due_date", { mode: 'string' }).notNull(),
  paymentTerms: text("payment_terms"),
  bankAccount: text("bank_account"),
  remarks: text("remarks"),
  items: json("items").$type<{description: string, quantity: number, unitPrice: number}[]>().default([]),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).default("0"),
});

// Sales Invoice Items
export const salesInvoiceItems = pgTable("sales_invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => salesInvoices.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0"),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
});

// Invoice Payments
export const invoicePayments = pgTable("invoice_payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => salesInvoices.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date", { mode: 'string' }).notNull(),
  paymentMethod: text("payment_method"), // cash, bank_transfer, cheque, credit_note, etc.
  referenceNumber: text("reference_number"),
  notes: text("notes"),
  recordedBy: integer("recorded_by").references(() => users.id),
  recordedAt: timestamp("recorded_at", { mode: 'string' }).notNull().defaultNow(),
  paymentType: text("payment_type").notNull().default("payment"), // payment, credit_note
  creditNoteId: integer("credit_note_id").references(() => creditNotes.id),
});

// Project Consumables
export const projectConsumables = pgTable("project_consumables", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id),
  date: timestamp("date").notNull(),
  recordedBy: integer("recorded_by").references(() => users.id),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});

// Project Consumable Items
export const projectConsumableItems = pgTable("project_consumable_items", {
  id: serial("id").primaryKey(),
  consumableId: integer("consumable_id").references(() => projectConsumables.id),
  inventoryItemId: integer("inventory_item_id").references(() => inventoryItems.id),
  quantity: integer("quantity").notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 4 }),
});

// Project Asset Assignments
export const projectAssetAssignments = pgTable("project_asset_assignments", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id),
  assetId: integer("asset_id").references(() => assets.id),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  dailyRate: decimal("daily_rate", { precision: 10, scale: 2 }).notNull(),
  totalCost: decimal("total_cost", { precision: 12, scale: 2 }).notNull(),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  assignedBy: integer("assigned_by").references(() => users.id),
});

// Removing duplicate assetMaintenanceRecords - using the comprehensive version defined earlier

// Asset Maintenance Files
export const assetMaintenanceFiles = pgTable("asset_maintenance_files", {
  id: serial("id").primaryKey(),
  maintenanceRecordId: integer("maintenance_record_id").notNull().references(() => assetMaintenanceRecords.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  contentType: text("content_type"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

// Payment Files
export const paymentFiles = pgTable("payment_files", {
  id: serial("id").primaryKey(),
  paymentId: integer("payment_id").notNull().references(() => invoicePayments.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

// Payroll
export const payrollEntries = pgTable("payroll_entries", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id),
  projectId: integer("project_id").references(() => projects.id),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  workingDays: integer("working_days").notNull(),
  basicSalary: decimal("basic_salary", { precision: 10, scale: 2 }),
  additions: json("additions").$type<{description: string, amount: number, note?: string}[]>().default([]),
  deductions: json("deductions").$type<{description: string, amount: number, note?: string}[]>().default([]),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("draft"), // draft, approved, paid
  generatedDate: timestamp("generated_date").notNull().defaultNow(),
});

// Payroll Additions
export const payrollAdditions = pgTable("payroll_additions", {
  id: serial("id").primaryKey(),
  payrollEntryId: integer("payroll_entry_id").references(() => payrollEntries.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  note: text("note"),
});

// Payroll Deductions
export const payrollDeductions = pgTable("payroll_deductions", {
  id: serial("id").primaryKey(),
  payrollEntryId: integer("payroll_entry_id").references(() => payrollEntries.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  note: text("note"),
});

// Proforma Invoices table
export const proformaInvoices = pgTable("proforma_invoices", {
  id: serial("id").primaryKey(),
  proformaNumber: text("proforma_number").notNull().unique(),
  customerId: integer("customer_id").references(() => customers.id),
  projectId: integer("project_id").references(() => projects.id),
  quotationId: integer("quotation_id").references(() => salesQuotations.id),
  status: text("status").notNull().default("draft"), // draft, sent, approved, rejected, expired, converted
  createdDate: timestamp("created_date").notNull().defaultNow(),
  invoiceDate: timestamp("invoice_date").notNull().defaultNow(),
  validUntil: timestamp("valid_until"),
  paymentTerms: text("payment_terms"),
  deliveryTerms: text("delivery_terms"),
  remarks: text("remarks"),
  items: json("items").$type<{description: string, quantity: number, unitPrice: number, taxRate?: number, taxAmount?: number}[]>().default([]),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
  isArchived: boolean("is_archived").notNull().default(false),
});

// Credit Notes table
export const creditNotes = pgTable("credit_notes", {
  id: serial("id").primaryKey(),
  creditNoteNumber: text("credit_note_number").notNull().unique(),
  salesInvoiceId: integer("sales_invoice_id").references(() => salesInvoices.id),
  customerId: integer("customer_id").references(() => customers.id),
  status: text("status").notNull().default("draft"), // draft, issued, cancelled
  creditNoteDate: timestamp("credit_note_date", { mode: 'string' }).notNull(),
  reason: text("reason"),
  items: json("items").$type<{description: string, quantity: number, unitPrice: number, taxRate?: number, taxAmount?: number}[]>().default([]),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Credit Note Items table
export const creditNoteItems = pgTable("credit_note_items", {
  id: serial("id").primaryKey(),
  creditNoteId: integer("credit_note_id").notNull().references(() => creditNotes.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0"),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
});

// Purchase Requests table
export const purchaseRequests = pgTable("purchase_requests", {
  id: serial("id").primaryKey(),
  requestNumber: text("request_number").notNull().unique(),
  requestDate: timestamp("request_date").notNull().defaultNow(),
  status: text("status").notNull().default("pending"), // pending, approved, rejected, completed
  requestedBy: integer("requested_by").references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  approvalDate: timestamp("approval_date"),
  urgency: text("urgency").notNull().default("normal"), // low, normal, high, urgent
  reason: text("reason"),
});

// Purchase Request Items table
export const purchaseRequestItems = pgTable("purchase_request_items", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => purchaseRequests.id, { onDelete: "cascade" }),
  inventoryItemId: integer("inventory_item_id").references(() => inventoryItems.id),
  quantity: integer("quantity").notNull(),
  notes: text("notes"),
});

// Purchase Orders table
export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  poNumber: text("po_number").notNull().unique(),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  status: text("status").notNull().default("draft"), // draft, sent, confirmed, received, cancelled
  orderDate: timestamp("order_date").notNull().defaultNow(),
  expectedDeliveryDate: timestamp("expected_delivery_date"),
  paymentTerms: text("payment_terms"),
  deliveryTerms: text("delivery_terms"),
  notes: text("notes"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Purchase Order Items table
export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  poId: integer("po_id").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
  inventoryItemId: integer("inventory_item_id").references(() => inventoryItems.id),
  description: text("description"),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0"),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
});

// Purchase Invoices table
export const purchaseInvoices = pgTable("purchase_invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  poId: integer("po_id").references(() => purchaseOrders.id),
  status: text("status").notNull().default("pending"), // pending, partially_paid, paid, overdue
  invoiceDate: timestamp("invoice_date").notNull(),
  dueDate: timestamp("due_date"),
  paymentTerms: text("payment_terms"),
  notes: text("notes"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).default("0"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Purchase Invoice Payments table
export const purchaseInvoicePayments = pgTable("purchase_invoice_payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => purchaseInvoices.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  paymentMethod: text("payment_method"),
  referenceNumber: text("reference_number"),
  notes: text("notes"),
  recordedBy: integer("recorded_by").references(() => users.id),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
  creditNoteId: integer("credit_note_id").references(() => purchaseCreditNotes.id),
  paymentType: text("payment_type").notNull().default("payment"), // payment, credit_note
});

// Purchase Payment Files table
export const purchasePaymentFiles = pgTable("purchase_payment_files", {
  id: serial("id").primaryKey(),
  paymentId: integer("payment_id").notNull().references(() => purchaseInvoicePayments.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

// Purchase Credit Notes table
export const purchaseCreditNotes = pgTable("purchase_credit_notes", {
  id: serial("id").primaryKey(),
  creditNoteNumber: text("credit_note_number").notNull().unique(),
  purchaseInvoiceId: integer("purchase_invoice_id").notNull().references(() => purchaseInvoices.id),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  status: text("status").notNull().default("draft"), // draft, issued, cancelled
  creditNoteDate: timestamp("credit_note_date", { mode: 'string' }).notNull(),
  reason: text("reason"),
  items: json("items").$type<{description: string, quantity: number, unitPrice: number, taxRate?: number, taxAmount?: number}[]>().default([]),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Purchase Invoice Items table
export const purchaseInvoiceItems = pgTable("purchase_invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => purchaseInvoices.id, { onDelete: "cascade" }),
  inventoryItemId: integer("inventory_item_id").references(() => inventoryItems.id),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0"),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
});

// Error Logs table
export const errorLogs = pgTable("error_logs", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  stack: text("stack"),
  url: text("url"),
  userAgent: text("user_agent"),
  userId: integer("user_id").references(() => users.id),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  severity: text("severity").notNull().default("error"),
  component: text("component"),
  resolved: boolean("resolved").notNull().default(false),
});

// General Ledger Entries table
export const generalLedgerEntries = pgTable("general_ledger_entries", {
  id: serial("id").primaryKey(),
  entryType: text("entry_type").notNull(),
  referenceType: text("reference_type").notNull(),
  referenceId: integer("reference_id"),
  accountName: text("account_name").notNull(),
  description: text("description").notNull(),
  debitAmount: numeric("debit_amount", { precision: 12, scale: 2 }).default("0"),
  creditAmount: numeric("credit_amount", { precision: 12, scale: 2 }).default("0"),
  entityId: integer("entity_id"),
  entityName: text("entity_name"),
  projectId: integer("project_id").references(() => projects.id),
  invoiceNumber: text("invoice_number"),
  transactionDate: timestamp("transaction_date", { mode: "string" }).notNull(),
  dueDate: timestamp("due_date", { mode: "string" }),
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id),
  notes: text("notes"),
});

// Supplier-Inventory Item Mapping (Many-to-Many)
export const supplierInventoryItems = pgTable("supplier_inventory_items", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").notNull().references(() => suppliers.id),
  inventoryItemId: integer("inventory_item_id").notNull().references(() => inventoryItems.id),
  supplierPartNumber: text("supplier_part_number"),
  unitCost: decimal("unit_cost", { precision: 10, scale: 4 }).default("0"),
  minimumOrderQuantity: integer("minimum_order_quantity").default(1).notNull(),
  leadTimeDays: integer("lead_time_days").default(0).notNull(),
  isPreferred: boolean("is_preferred").default(false).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});



// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertCompanySchema = createInsertSchema(companies).omit({ id: true });
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true });
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true });
export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true }).extend({
  hireDate: z.date().nullable().optional(),
  salary: z.string().nullable().optional(),
  category: z.enum(["permanent", "consultant", "contract"]).default("permanent"),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  position: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  userId: z.number().nullable().optional(),
});
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, actualCost: true }).extend({
  description: z.string().optional(),
  vesselName: z.string().optional(),
  vesselImage: z.string().optional(),
  vesselImoNumber: z.string().optional(),
  startDate: z.date().optional(),
  plannedEndDate: z.date().optional(),
  estimatedBudget: z.string().transform((val) => {
    if (!val || val.trim() === '') return undefined;
    const num = parseFloat(val);
    return isNaN(num) || num < 0 ? undefined : num.toFixed(2);
  }).optional(),
  customerId: z.number().optional(),
  ridgingCrewNos: z.string().optional(),
  modeOfContract: z.string().optional(),
  workingHours: z.string().optional(),
  ppe: z.string().optional(),
  additionalField1Title: z.string().optional(),
  additionalField1Description: z.string().optional(),
  additionalField2Title: z.string().optional(),
  additionalField2Description: z.string().optional(),
  additionalField3Title: z.string().optional(),
  additionalField3Description: z.string().optional(),
});
export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({ id: true, currentStock: true, avgCost: true }).extend({
  initialQuantity: z.number().optional(),
  unitPrice: z.number().optional(),
});
export const insertAssetSchema = createInsertSchema(assets, { acquisitionDate: z.coerce.date().optional().nullable() }).omit({ id: true });
export const insertDailyActivitySchema = createInsertSchema(dailyActivities).omit({ id: true });

export const insertSalesQuotationSchema = createInsertSchema(salesQuotations).omit({ id: true, quotationNumber: true, createdDate: true });
export const insertSalesQuotationItemSchema = createInsertSchema(salesQuotationItems).omit({ id: true });
export const insertSalesInvoiceSchema = createInsertSchema(salesInvoices).omit({ id: true });
export const insertSalesInvoiceItemSchema = createInsertSchema(salesInvoiceItems).omit({ id: true });
export const insertInvoicePaymentSchema = createInsertSchema(invoicePayments).omit({ id: true, recordedAt: true });
export const insertSupplierInventoryItemSchema = createInsertSchema(supplierInventoryItems).omit({ id: true, createdAt: true });
export const insertProjectPhotoGroupSchema = createInsertSchema(projectPhotoGroups).omit({ id: true, createdAt: true }).extend({
  date: z.string().or(z.date()).transform((val) => new Date(val)),
});
export const insertProjectPhotoSchema = createInsertSchema(projectPhotos).omit({ id: true, uploadedAt: true });
export const insertProjectConsumableSchema = createInsertSchema(projectConsumables).omit({ id: true, recordedAt: true });
export const insertProjectConsumableItemSchema = createInsertSchema(projectConsumableItems).omit({ id: true });
export const insertProjectAssetAssignmentSchema = createInsertSchema(projectAssetAssignments).omit({ id: true, assignedAt: true });
export const insertAssetMaintenanceRecordSchema = createInsertSchema(assetMaintenanceRecords).omit({ id: true, createdAt: true });
export const insertAssetMaintenanceFileSchema = createInsertSchema(assetMaintenanceFiles).omit({ id: true, uploadedAt: true });
export const insertPayrollEntrySchema = createInsertSchema(payrollEntries).omit({ id: true, generatedDate: true }).extend({
  additions: z.array(z.object({
    description: z.string(),
    amount: z.number(),
    note: z.string().optional(),
  })).default([]),
  deductions: z.array(z.object({
    description: z.string(),
    amount: z.number(),
    note: z.string().optional(),
  })).default([]),
});
export const insertPayrollAdditionSchema = createInsertSchema(payrollAdditions).omit({ id: true });
export const insertPayrollDeductionSchema = createInsertSchema(payrollDeductions).omit({ id: true });

export const insertProformaInvoiceSchema = createInsertSchema(proformaInvoices).omit({ id: true, proformaNumber: true, createdDate: true });
export const insertCreditNoteSchema = createInsertSchema(creditNotes).omit({ id: true, creditNoteNumber: true, createdAt: true });
export const insertCreditNoteItemSchema = createInsertSchema(creditNoteItems).omit({ id: true });

export const insertPurchaseRequestSchema = createInsertSchema(purchaseRequests).omit({ id: true, requestNumber: true, requestDate: true });
export const insertPurchaseRequestItemSchema = createInsertSchema(purchaseRequestItems).omit({ id: true });
const purchaseOrdersTable = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  poNumber: text("po_number").notNull().unique(),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  status: text("status").notNull().default("draft"), // draft, sent, confirmed, received, cancelled
  orderDate: timestamp("order_date").notNull().defaultNow(),
  expectedDeliveryDate: timestamp("expected_delivery_date"),
  paymentTerms: text("payment_terms"),
  deliveryTerms: text("delivery_terms"),
  notes: text("notes"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrdersTable).omit({ id: true, poNumber: true, createdAt: true });
export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({ id: true });
export const insertPurchaseInvoiceSchema = createInsertSchema(purchaseInvoices).omit({ id: true, createdAt: true });
export const insertPurchaseInvoiceItemSchema = createInsertSchema(purchaseInvoiceItems).omit({ id: true });
export const insertPurchaseCreditNoteSchema = createInsertSchema(purchaseCreditNotes).omit({ id: true, creditNoteNumber: true, createdAt: true });

export const insertGeneralLedgerEntrySchema = createInsertSchema(generalLedgerEntries).omit({ id: true, createdAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type Asset = typeof assets.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type DailyActivity = typeof dailyActivities.$inferSelect;
export type InsertDailyActivity = z.infer<typeof insertDailyActivitySchema>;

export type SalesQuotation = typeof salesQuotations.$inferSelect;
export type InsertSalesQuotation = z.infer<typeof insertSalesQuotationSchema>;
export type SalesQuotationItem = typeof salesQuotationItems.$inferSelect;
export type InsertSalesQuotationItem = z.infer<typeof insertSalesQuotationItemSchema>;
export type SalesInvoice = typeof salesInvoices.$inferSelect;
export type InsertSalesInvoice = z.infer<typeof insertSalesInvoiceSchema>;
export type SalesInvoiceItem = typeof salesInvoiceItems.$inferSelect;
export type InsertSalesInvoiceItem = z
.infer<typeof insertSalesInvoiceItemSchema>;
export type InvoicePayment = typeof invoicePayments.$inferSelect;
export type InsertInvoicePayment = z.infer<typeof insertInvoicePaymentSchema>;
export type SupplierInventoryItem = typeof supplierInventoryItems.$inferSelect;
export type InsertSupplierInventoryItem = z.infer<typeof insertSupplierInventoryItemSchema>;
export type ProjectPhotoGroup = typeof projectPhotoGroups.$inferSelect;
export type InsertProjectPhotoGroup = z.infer<typeof insertProjectPhotoGroupSchema>;
export type ProjectPhoto = typeof projectPhotos.$inferSelect;
export type InsertProjectPhoto = z.infer<typeof insertProjectPhotoSchema>;
export type ProjectConsumable = typeof projectConsumables.$inferSelect;
export type InsertProjectConsumable = z.infer<typeof insertProjectConsumableSchema>;
export type ProjectConsumableItem = typeof projectConsumableItems.$inferSelect;
export type InsertProjectConsumableItem = z.infer<typeof insertProjectConsumableItemSchema>;
export type ProjectAssetAssignment = typeof projectAssetAssignments.$inferSelect;
export type InsertProjectAssetAssignment = z.infer<typeof insertProjectAssetAssignmentSchema>;
export type AssetMaintenanceRecord = typeof assetMaintenanceRecords.$inferSelect;
export type InsertAssetMaintenanceRecord = z.infer<typeof insertAssetMaintenanceRecordSchema>;
export type AssetMaintenanceFile = typeof assetMaintenanceFiles.$inferSelect;
export type InsertAssetMaintenanceFile = z.infer<typeof insertAssetMaintenanceFileSchema>;
export type PayrollEntry = typeof payrollEntries.$inferSelect;
export type InsertPayrollEntry = z.infer<typeof insertPayrollEntrySchema>;
export type PayrollAddition = typeof payrollAdditions.$inferSelect;
export type InsertPayrollAddition = z.infer<typeof insertPayrollAdditionSchema>;
export type PayrollDeduction = typeof payrollDeductions.$inferSelect;
export type InsertPayrollDeduction = z.infer<typeof insertPayrollDeductionSchema>;

export type PaymentFile = typeof paymentFiles.$inferSelect;
export type InsertPaymentFile = z.infer<typeof insertInvoicePaymentSchema>;
export type ProformaInvoice = typeof proformaInvoices.$inferSelect;
export type InsertProformaInvoice = z.infer<typeof insertProformaInvoiceSchema>;
export type CreditNote = typeof creditNotes.$inferSelect;
export type InsertCreditNote = z.infer<typeof insertCreditNoteSchema>;
export type CreditNoteItem = typeof creditNoteItems.$inferSelect;
export type InsertCreditNoteItem = z.infer<typeof insertCreditNoteItemSchema>;
export type PurchaseRequest = typeof purchaseRequests.$inferSelect;
export type InsertPurchaseRequest = z.infer<typeof insertPurchaseRequestSchema>;
export type PurchaseRequestItem = typeof purchaseRequestItems.$inferSelect;
export type InsertPurchaseRequestItem = z.infer<typeof insertPurchaseRequestItemSchema>;
export type PurchaseOrder = typeof purchaseOrdersTable.$inferSelect;
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>;
export type PurchaseInvoice = typeof purchaseInvoices.$inferSelect;
export type InsertPurchaseInvoice = z.infer<typeof insertPurchaseInvoiceSchema>;
export type PurchaseInvoiceItem = typeof purchaseInvoiceItems.$inferSelect;
export type InsertPurchaseInvoiceItem = z.infer<typeof insertPurchaseInvoiceItemSchema>;
export type PurchaseCreditNote = typeof purchaseCreditNotes.$inferSelect;
export type InsertPurchaseCreditNote = z.infer<typeof insertPurchaseCreditNoteSchema>;
export type ErrorLog = typeof errorLogs.$inferSelect;
export type InsertErrorLog = typeof errorLogs.$inferInsert;
export type GeneralLedgerEntry = typeof generalLedgerEntries.$inferSelect;
export type InsertGeneralLedgerEntry = z.infer<typeof insertGeneralLedgerEntrySchema>;

// Asset Management Schemas
export const insertAssetTypeSchema = createInsertSchema(assetTypes);
export const insertAssetSchema = createInsertSchema(assets).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAssetMovementSchema = createInsertSchema(assetMovements).omit({ id: true, createdAt: true });
export const insertAssetMaintenanceRecordSchema = createInsertSchema(assetMaintenanceRecords).omit({ id: true, createdAt: true });
export const insertAssetDepreciationRecordSchema = createInsertSchema(assetDepreciationRecords).omit({ id: true, createdAt: true });

// Asset Management Types
export type AssetType = typeof assetTypes.$inferSelect;
export type InsertAssetType = z.infer<typeof insertAssetTypeSchema>;
export type Asset = typeof assets.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type AssetMovement = typeof assetMovements.$inferSelect;
export type InsertAssetMovement = z.infer<typeof insertAssetMovementSchema>;
export type AssetMaintenanceRecord = typeof assetMaintenanceRecords.$inferSelect;
export type InsertAssetMaintenanceRecord = z.infer<typeof insertAssetMaintenanceRecordSchema>;
export type AssetDepreciationRecord = typeof assetDepreciationRecords.$inferSelect;
export type InsertAssetDepreciationRecord = z.infer<typeof insertAssetDepreciationRecordSchema>;