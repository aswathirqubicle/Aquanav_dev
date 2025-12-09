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
