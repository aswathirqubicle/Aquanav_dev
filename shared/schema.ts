import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  varchar,
  decimal,
  json,
  numeric,
  date,
} from "drizzle-orm/pg-core";
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
  bankAccount: text("bank_account"),
  bankAccount2: text("bank_account_2"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  financialYearStartDay: integer("financial_year_start_day").default(1),
  financialYearStartMonth: integer("financial_year_start_month").default(1),
  financialYearEndDay: integer("financial_year_end_day").default(31),
  financialYearEndMonth: integer("financial_year_end_month").default(12),
});

// Customers
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone").notNull().unique(),
  address: text("address"),
  taxId: text("tax_id"),
  userId: integer("user_id").references(() => users.id),
  isArchived: boolean("is_archived").notNull().default(false),
  // UAE VAT Compliance Fields
  vatNumber: text("vat_number"), // 15-digit VAT registration number
  vatRegistrationStatus: text("vat_registration_status")
    .notNull()
    .default("not_registered"), // not_registered, registered, exempt, suspended
  vatTreatment: text("vat_treatment").notNull().default("standard"), // standard, zero_rated, exempt, out_of_scope
  customerType: text("customer_type").notNull().default("business"), // business, individual, government, non_profit
  taxCategory: text("tax_category").notNull().default("standard"), // standard, export, gcc_customer, free_zone
  paymentTerms: text("payment_terms").default("30_days"), // 30_days, 15_days, 7_days, immediate, net_30, etc.
  currency: text("currency").notNull().default("AED"), // AED, USD, EUR, etc.
  creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }),
  isVatApplicable: boolean("is_vat_applicable").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
  // bankInfo: text("bank_info"),
  isArchived: boolean("is_archived").notNull().default(false),
  // UAE VAT Compliance Fields
  vatNumber: text("vat_number"), // 15-digit VAT registration number
  vatRegistrationStatus: text("vat_registration_status")
    .notNull()
    .default("not_registered"), // not_registered, registered, exempt, suspended
  vatTreatment: text("vat_treatment").notNull().default("standard"), // standard, zero_rated, exempt, out_of_scope
  supplierType: text("supplier_type").notNull().default("business"), // business, individual, government, non_profit
  taxCategory: text("tax_category").notNull().default("standard"), // standard, import, gcc_supplier, free_zone
  paymentTerms: text("payment_terms").default("30_days"), // 30_days, 15_days, 7_days, immediate, net_30, etc.
  currency: text("currency").notNull().default("AED"), // AED, USD, EUR, etc.
  creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }),
  isVatApplicable: boolean("is_vat_applicable").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const supplierBankDetails = pgTable("supplier_bank_details", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id")
    .notNull()
    .references(() => suppliers.id, { onDelete: "cascade" }),
  accountDetails: text("account_details").notNull(),
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
  grade: integer("grade"), // Grade 1, Grade 2, Grade 3, Grade 4 for contract employees
  salary: decimal("salary", { precision: 10, scale: 2 }),
  contractCurrency: text("contract_currency"),
  contractSalary: decimal("contract_salary", { precision: 10, scale: 2 }),
  hireDate: timestamp("hire_date"),
  isActive: boolean("is_active").notNull().default(true),
  userId: integer("user_id").references(() => users.id),

  // Personal Particulars
  dateOfBirth: date("date_of_birth"),
  height: decimal("height", { precision: 5, scale: 2 }), // in cm
  weight: decimal("weight", { precision: 5, scale: 2 }), // in kg
  address: text("address"),

  // Bank Details
  bankName: text("bank_name"),
  bankBranch: text("bank_branch"),
  accountNumber: text("account_number"),
  accountHolderName: text("account_holder_name"),
  ifscCode: text("ifsc_code"),
  swiftCode: text("swift_code"),

  // Safety Equipment Sizes
  boilerSuitSize: text("boiler_suit_size"),
  safetyShoeSize: text("safety_shoe_size"),

  // The date the employee expects to be available to deploy. Optional — a null
  // date means none has been stated. Set by the employee from their Profile or
  // by an admin from the Basic Info tab; every change is recorded in
  // employee_readiness_history.
  joiningReadinessDate: date("joining_readiness_date"),
});

// Employee Next of Kin
export const employeeNextOfKin = pgTable("employee_next_of_kin", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  relationship: text("relationship").notNull(), // spouse, parent, sibling, child, other
  isPrimary: boolean("is_primary").notNull().default(false),
});

// Employee Training Records
export const employeeTrainingRecords = pgTable("employee_training_records", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  trainingName: text("training_name").notNull(),
  trainingProvider: text("training_provider").notNull().default("Aquanav"),
  certificationNumber: text("certification_number"),
  trainingDate: date("training_date").notNull(),
  expiryDate: date("expiry_date"),
  status: text("status").notNull().default("active"), // active, expired, cancelled
  notes: text("notes"),
  attachments: json("attachments").$type<any[]>().default([]),
});

// Employee Documents Management
export const employeeDocuments = pgTable("employee_documents", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  documentType: text("document_type").notNull(), // passport, cdc, covid_vaccination, stcw_course, sid, ilo_medical
  documentNumber: text("document_number"),
  placeOfIssue: text("place_of_issue"),
  issuedBy: text("issued_by"), // For ILO Medical certificate
  dateOfIssue: date("date_of_issue"),
  expiryDate: date("expiry_date"),
  validTill: date("valid_till"), // For ILO Medical certificate
  status: text("status").notNull().default("active"), // active, expired, pending_renewal
  notes: text("notes"),
  attachmentPaths: json("attachment_paths").$type<string[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
  totalRevenue: decimal("total_revenue", { precision: 12, scale: 2 }).default(
    "0",
  ),
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
  additionalField4Title: text("additional_field_4_title"),
  additionalField4Description: text("additional_field_4_description"),
  additionalField5Title: text("additional_field_5_title"),
  additionalField5Description: text("additional_field_5_description"),
  additionalField6Title: text("additional_field_6_title"),
  additionalField6Description: text("additional_field_6_description"),
  surfaceTemperature: text("surface_temperature"),
  airTemperature: text("air_temperature"),
  relativeHumidity: text("relative_humidity"),
  dewPointTemperature: text("dew_point_temperature"),
  dewPointSurfaceDiff: text("dew_point_surface_diff"),
  workRemainingDays: json("work_remaining_days")
    .$type<{ location: string; days: string }[]>()
    .default([]),
});

// Locations
export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
  sku: text("sku").notNull().unique(),
  description: text("description"),
  category: text("category").notNull(), // consumables, tools, equipment
  unit: text("unit").notNull(),
  currentStock: decimal("current_stock", { precision: 10, scale: 2 }).notNull().default("0"),
  minStockLevel: decimal("min_stock_level", { precision: 10, scale: 2 }).notNull().default("0"),
  avgCost: decimal("avg_cost", { precision: 10, scale: 4 }).default("0"),
});

// Inventory Transactions (for FIFO tracking)
export const inventoryTransactions = pgTable("inventory_transactions", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").references(() => inventoryItems.id),
  type: text("type").notNull(), // inflow, outflow
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 4 }),
  remainingQuantity: decimal("remaining_quantity", { precision: 10, scale: 2 }).notNull(),
  projectId: integer("project_id").references(() => projects.id),
  reference: text("reference"), // PI number, GI number, etc.
  createdBy: integer("created_by").references(() => users.id),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  consumableId: integer("consumable_id"), // link back to project_consumables record
});

// Asset Types (Master catalog for asset categories with inventory tracking)
export const assetTypes = pgTable("asset_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(), // equipment, tools, vehicles, electronics, furniture
  description: text("description"),
  manufacturer: text("manufacturer"),
  model: text("model"),
  specifications: json("specifications")
    .$type<Record<string, any>>()
    .default({}),
  defaultDailyRentalRate: decimal("default_daily_rental_rate", {
    precision: 10,
    scale: 2,
  }),
  currency: text("currency").notNull().default("AED"), // AED, USD, EUR, etc.
  depreciationRate: decimal("depreciation_rate", {
    precision: 5,
    scale: 2,
  }).default("0"), // annual percentage
  warrantyPeriodMonths: integer("warranty_period_months").default(12),
  maintenanceIntervalDays: integer("maintenance_interval_days").default(90),
  // Inventory tracking fields
  totalQuantity: integer("total_quantity").notNull().default(0), // total assets of this type
  availableQuantity: integer("available_quantity").notNull().default(0), // currently available
  assignedQuantity: integer("assigned_quantity").notNull().default(0), // assigned to projects
  maintenanceQuantity: integer("maintenance_quantity").notNull().default(0), // in maintenance
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Asset Inventory Instances (For enhanced inventory tracking with multiple instances per asset type)
export const assetInventoryInstances = pgTable("asset_inventory_instances", {
  id: serial("id").primaryKey(),
  assetTypeId: integer("asset_type_id")
    .references(() => assetTypes.id)
    .notNull(),
  instanceNumber: text("instance_number").notNull(), // "Instance 1", "Instance 2", etc.
  assetTag: text("asset_tag").notNull().unique(), // ASSET-0001, ASSET-0002, etc.
  serialNumber: text("serial_number").notNull().unique(), // SN00000001, SN00000002, etc.
  barcode: text("barcode").unique(), // unique barcode for scanning
  status: text("status").notNull().default("available"), // available, in_use, maintenance, under_repair, retired, lost, stolen
  condition: text("condition").notNull().default("excellent"), // excellent, good, fair, poor, damaged
  location: text("location"), // current physical location
  assignedProjectId: integer("assigned_project_id").references(
    () => projects.id,
  ), // currently assigned project
  assignedToId: integer("assigned_to_id").references(() => employees.id), // if assigned to person
  acquisitionDate: timestamp("acquisition_date"),
  acquisitionCost: decimal("acquisition_cost", { precision: 10, scale: 2 }),
  acquisitionCurrency: text("acquisition_currency").notNull().default("AED"), // Currency for acquisition cost
  currentValue: decimal("current_value", { precision: 10, scale: 2 }),
  currentValueCurrency: text("current_value_currency").notNull().default("AED"), // Currency for current value
  monthlyRentalAmount: decimal("monthly_rental_amount", {
    precision: 10,
    scale: 2,
  }).default("0"),
  rentalCurrency: text("rental_currency").notNull().default("AED"), // Currency for rental rates
  warrantyExpiryDate: timestamp("warranty_expiry_date"),
  lastMaintenanceDate: timestamp("last_maintenance_date"),
  nextMaintenanceDate: timestamp("next_maintenance_date"),
  notes: text("notes"),
  photos: json("photos").$type<string[]>().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Daily Activities
export const dailyActivities = pgTable("daily_activities", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id),
  date: timestamp("date").notNull(),
  location: text("location"),
  completedTasks: text("completed_tasks"),
  plannedTasks: text("planned_tasks"),
  hbmDailyRunningHours: decimal("hbm_daily_running_hours", {
    precision: 10,
    scale: 2,
  }),
  remarks: text("remarks"),
  photos: json("photos").$type<string[]>().default([]),
  isStoppage: boolean("is_stoppage").notNull().default(false),
  stoppageReason: text("stoppage_reason"),
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
  dailyActivityId: integer("daily_activity_id").references(
    () => dailyActivities.id,
  ),
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
  currency: text("currency").notNull().default("AED"),
  exchangeRate: decimal("exchange_rate", { precision: 18, scale: 8 })
    .notNull()
    .default("1"),
  status: text("status").notNull().default("draft"), // draft, sent, approved, rejected, converted
  validUntil: timestamp("valid_until", { mode: "string" }),
  paymentTerms: text("payment_terms"),
  bankAccount: text("bank_account"),
  billingAddress: text("billing_address"),
  termsAndConditions: text("terms_and_conditions"),
  remarks: text("remarks"),
  items: json("items")
    .$type<
      {
        description: string;
        quantity: number;
        unitPrice: number;
        taxRate?: number;
        taxAmount?: number;
      }[]
    >()
    .default([]),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }),
  discountPercentage: decimal("discount_percentage", {
    precision: 5,
    scale: 2,
  }).default("0"),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
  submittedById: integer("submitted_by_id").references(() => users.id),
  submittedAt: timestamp("submitted_at"),
  approvedById: integer("approved_by_id").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  isArchived: boolean("is_archived").notNull().default(false),
  createdDate: timestamp("created_date", { mode: "string" })
    .notNull()
    .defaultNow(),
});

// Sales Quotation Items
export const salesQuotationItems = pgTable("sales_quotation_items", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id")
    .notNull()
    .references(() => salesQuotations.id, { onDelete: "cascade" }),
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
  invoiceNumber: text("invoice_number").unique(),
  customerId: integer("customer_id").references(() => customers.id),
  projectId: integer("project_id").references(() => projects.id),
  quotationId: integer("quotation_id").references(() => salesQuotations.id),
  currency: text("currency").notNull().default("AED"),
  exchangeRate: decimal("exchange_rate", { precision: 18, scale: 8 })
    .notNull()
    .default("1"),
  status: text("status").notNull().default("draft"), // draft, approved, unpaid, partially_paid, paid, overdue
  invoiceDate: timestamp("invoice_date", { mode: "string" }).notNull(),
  dueDate: timestamp("due_date", { mode: "string" }).notNull(),
  paymentTerms: text("payment_terms"),
  bankAccount: text("bank_account"),
  billingAddress: text("billing_address"),
  termsAndConditions: text("terms_and_conditions"),
  remarks: text("remarks"),
  items: json("items")
    .$type<{ description: string; quantity: number; unitPrice: number }[]>()
    .default([]),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }),
  discountPercentage: decimal("discount_percentage", {
    precision: 5,
    scale: 2,
  }).default("0"),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).default("0"),
  submittedById: integer("submitted_by_id").references(() => users.id),
  submittedAt: timestamp("submitted_at"),
  approvedById: integer("approved_by_id").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  workOrderNumber: text("work_order_number"),
});

// Sales Invoice Items
export const salesInvoiceItems = pgTable("sales_invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id")
    .notNull()
    .references(() => salesInvoices.id, { onDelete: "cascade" }),
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
  invoiceId: integer("invoice_id")
    .notNull()
    .references(() => salesInvoices.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date", { mode: "string" }).notNull(),
  paymentMethod: text("payment_method"), // cash, bank_transfer, cheque, credit_note, etc.
  referenceNumber: text("reference_number"),
  notes: text("notes"),
  recordedBy: integer("recorded_by").references(() => users.id),
  recordedAt: timestamp("recorded_at", { mode: "string" })
    .notNull()
    .defaultNow(),
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
  goodsIssueRef: text("goods_issue_ref"),
});

// Project Consumable Items
export const projectConsumableItems = pgTable("project_consumable_items", {
  id: serial("id").primaryKey(),
  consumableId: integer("consumable_id").references(
    () => projectConsumables.id,
  ),
  inventoryItemId: integer("inventory_item_id").references(
    () => inventoryItems.id,
  ),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 4 }),
  itemName: text("item_name"),
  itemUnit: text("item_unit"),
});

// Project Asset Assignments (Legacy)
export const projectAssetAssignments = pgTable("project_asset_assignments", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id),
  assetId: integer("asset_id").references(() => assetInventoryInstances.id),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  monthlyRate: decimal("monthly_rate", { precision: 10, scale: 2 }).notNull(),
  totalCost: decimal("total_cost", { precision: 12, scale: 2 }).notNull(),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  assignedBy: integer("assigned_by").references(() => users.id),
});

// Enhanced Project Asset Assignments (using inventory instances with barcode selection)
export const projectAssetInstanceAssignments = pgTable(
  "project_asset_instance_assignments",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .references(() => projects.id)
      .notNull(),
    assetTypeId: integer("asset_type_id")
      .references(() => assetTypes.id)
      .notNull(),
    instanceId: integer("instance_id")
      .references(() => assetInventoryInstances.id)
      .notNull(),
    barcode: text("barcode"), // selected barcode for this assignment
    serialNumber: text("serial_number").notNull(), // reference to the instance's serial number
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date"),
    monthlyRate: decimal("monthly_rate", { precision: 10, scale: 2 }),
    totalCost: decimal("total_cost", { precision: 12, scale: 2 }),
    status: text("status").notNull().default("active"), // active, completed, cancelled
    assignedBy: integer("assigned_by")
      .references(() => users.id)
      .notNull(),
    assignedAt: timestamp("assigned_at").notNull().defaultNow(),
    returnedAt: timestamp("returned_at"),
    notes: text("notes"),
  },
);

// Removing duplicate assetMaintenanceRecords - using the comprehensive version defined earlier

// Asset Inventory Maintenance Records
export const assetInventoryMaintenanceRecords = pgTable(
  "asset_inventory_maintenance_records",
  {
    id: serial("id").primaryKey(),
    instanceId: integer("instance_id")
      .references(() => assetInventoryInstances.id)
      .notNull(),
    maintenanceCost: decimal("maintenance_cost", {
      precision: 10,
      scale: 2,
    }).notNull(),
    maintenanceDate: timestamp("maintenance_date").defaultNow().notNull(),
    maintenanceType: varchar("maintenance_type", { length: 255 }),
    startDate: timestamp("start_date", { withTimezone: false }),
    completedDate: timestamp("completed_date", { withTimezone: false }),
    description: text("description"),
    performedBy: integer("performed_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    isArchived: boolean("is_archived").notNull().default(false),
  },
);

export const insertAssetInventoryMaintenanceRecords = createInsertSchema(
  assetInventoryMaintenanceRecords,
).omit({ id: true });
export const updateAssetInventoryMaintenanceRecord =
  insertAssetInventoryMaintenanceRecords.partial();

// Asset Inventory Maintenance Files
export const assetInventoryMaintenanceFiles = pgTable(
  "asset_inventory_maintenance_files",
  {
    id: serial("id").primaryKey(),
    maintenanceRecordId: integer("maintenance_record_id")
      .notNull()
      .references(() => assetInventoryMaintenanceRecords.id, {
        onDelete: "cascade",
      }),
    fileName: text("file_name").notNull(),
    originalName: text("original_name").notNull(),
    filePath: text("file_path").notNull(),
    fileSize: integer("file_size"),
    mimeType: text("mime_type"),
    uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  },
);

// Asset Maintenance Files
export const assetMaintenanceFiles = pgTable("asset_maintenance_files", {
  id: serial("id").primaryKey(),
  maintenanceRecordId: integer("maintenance_record_id")
    .notNull()
    .references(() => assetInventoryMaintenanceRecords.id, {
      onDelete: "cascade",
    }),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  contentType: text("content_type"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

// Payment Files
export const paymentFiles = pgTable("payment_files", {
  id: serial("id").primaryKey(),
  paymentId: integer("payment_id")
    .notNull()
    .references(() => invoicePayments.id, { onDelete: "cascade" }),
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
  totalAdditions: decimal("total_additions", { precision: 10, scale: 2 }),
  totalDeductions: decimal("total_deductions", { precision: 10, scale: 2 }),
  // Note: line items live in the payroll_additions / payroll_deductions child
  // tables. The former `additions` / `deductions` JSON columns here were dead
  // (never written) and were dropped in migration 0064 (plan item 2.8).
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("draft"), // draft, approved, paid
  generatedDate: timestamp("generated_date").notNull().defaultNow(),
});

// Payroll Additions
export const payrollAdditions = pgTable("payroll_additions", {
  id: serial("id").primaryKey(),
  payrollEntryId: integer("payroll_entry_id").references(
    () => payrollEntries.id,
    { onDelete: "cascade" },
  ),
  description: text("description").notNull(),
  // project_fee | overtime | bonus | reimbursement | other
  // `reimbursement` is NOT an earning — it repays the employee's own outlay,
  // so it is excluded from the provident-fund base and posts to its own
  // expense account rather than Salary Expense.
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  note: text("note"),
});

// Payroll Deductions
export const payrollDeductions = pgTable("payroll_deductions", {
  id: serial("id").primaryKey(),
  payrollEntryId: integer("payroll_entry_id").references(
    () => payrollEntries.id,
    { onDelete: "cascade" },
  ),
  description: text("description").notNull(),
  // provident_fund | advance_recovery | other
  // These behave differently in the ledger: provident_fund creates a liability
  // the company owes onward, advance_recovery settles money already paid to
  // the employee. Treating them alike is why deductions currently vanish into
  // a Salary Payable residue that never clears.
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  note: text("note"),
});

// Employee Reimbursements
export const reimbursements = pgTable("reimbursements", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id), // The user who submitted
  projectId: integer("project_id").references(() => projects.id), // Optional project association
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  // travel | accommodation | fuel_transport | office_supplies | communication
  // | training | other — determines which expense account the reimbursement
  // debits. 'other' posts to 6160 Employee Reimbursement, its own account, so
  // an unclassified claim stays visible and reclassifiable rather than
  // dissolving into general Operating Expenses.
  category: text("category").notNull().default("other"),
  originalExpenseDate: date("original_expense_date").notNull(),
  submissionTimestamp: timestamp("submission_timestamp").notNull().defaultNow(),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  approvedById: integer("approved_by_id").references(() => users.id),
  approvalTimestamp: timestamp("approval_timestamp"),
  rejectionReason: text("rejection_reason"),
  payrollMonth: integer("payroll_month"), // Month for payroll integration (1-12)
  payrollYear: integer("payroll_year"), // Year for payroll integration
  attachments: text("attachments").array(), // Array of file paths for multiple attachments
});

// Proforma Invoices table
export const proformaInvoices = pgTable("proforma_invoices", {
  id: serial("id").primaryKey(),
  proformaNumber: text("proforma_number").notNull().unique(),
  customerId: integer("customer_id").references(() => customers.id),
  projectId: integer("project_id").references(() => projects.id),
  quotationId: integer("quotation_id").references(() => salesQuotations.id),
  currency: text("currency").notNull().default("AED"),
  exchangeRate: decimal("exchange_rate", { precision: 18, scale: 8 })
    .notNull()
    .default("1"),
  status: text("status").notNull().default("draft"), // draft, sent, approved, rejected, expired, converted
  createdDate: timestamp("created_date", { mode: "string" })
    .notNull()
    .defaultNow(),
  invoiceDate: timestamp("invoice_date", { mode: "string" })
    .notNull()
    .defaultNow(),
  validUntil: timestamp("valid_until", { mode: "string" }),
  paymentTerms: text("payment_terms"),
  deliveryTerms: text("delivery_terms"),
  bankAccount: text("bank_account"),
  billingAddress: text("billing_address"),
  termsAndConditions: text("terms_and_conditions"),
  remarks: text("remarks"),
  items: json("items")
    .$type<
      {
        description: string;
        quantity: number;
        unitPrice: number;
        taxRate?: number;
        taxAmount?: number;
      }[]
    >()
    .default([]),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }),
  discountPercentage: decimal("discount_percentage", {
    precision: 5,
    scale: 2,
  }).default("0"),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
  submittedById: integer("submitted_by_id").references(() => users.id),
  submittedAt: timestamp("submitted_at"),
  approvedById: integer("approved_by_id").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  isArchived: boolean("is_archived").notNull().default(false),
  workOrderNumber: text("work_order_number"),
});

// Credit Notes table
export const creditNotes = pgTable("credit_notes", {
  id: serial("id").primaryKey(),
  creditNoteNumber: text("credit_note_number").notNull().unique(),
  salesInvoiceId: integer("sales_invoice_id").references(
    () => salesInvoices.id,
  ),
  customerId: integer("customer_id").references(() => customers.id),
  currency: text("currency").notNull().default("AED"),
  exchangeRate: decimal("exchange_rate", { precision: 18, scale: 8 })
    .notNull()
    .default("1"),
  status: text("status").notNull().default("draft"), // draft, issued, cancelled
  creditNoteDate: timestamp("credit_note_date", { mode: "string" }).notNull(),
  billingAddress: text("billing_address"),
  reason: text("reason"),
  items: json("items")
    .$type<
      {
        description: string;
        quantity: number;
        unitPrice: number;
        taxRate?: number;
        taxAmount?: number;
      }[]
    >()
    .default([]),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }),
  discountPercentage: decimal("discount_percentage", {
    precision: 5,
    scale: 2,
  }).default("0"),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
  submittedById: integer("submitted_by_id").references(() => users.id),
  submittedAt: timestamp("submitted_at"),
  approvedById: integer("approved_by_id").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Credit Note Items table
export const creditNoteItems = pgTable("credit_note_items", {
  id: serial("id").primaryKey(),
  creditNoteId: integer("credit_note_id")
    .notNull()
    .references(() => creditNotes.id, { onDelete: "cascade" }),
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
  requestId: integer("request_id")
    .notNull()
    .references(() => purchaseRequests.id, { onDelete: "cascade" }),
  itemType: text("item_type").notNull().default("product"), // product, service
  inventoryItemId: integer("inventory_item_id").references(
    () => inventoryItems.id,
  ),
  description: text("description"), // For service items or additional details
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }), // For budget estimation
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
  bankAccount: text("bank_account"),
  notes: text("notes"),
  currency: text("currency").notNull().default("AED"),
  exchangeRate: decimal("exchange_rate", { precision: 18, scale: 8 })
    .notNull()
    .default("1"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  discountPercentage: decimal("discount_percentage", {
    precision: 5,
    scale: 2,
  }).default("0"),
  discountAmount: decimal("discount_amount", {
    precision: 12,
    scale: 2,
  }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
  submittedById: integer("submitted_by_id").references(() => users.id),
  submittedAt: timestamp("submitted_at"),
  approvedById: integer("approved_by_id").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  convertedInvoiceId: integer("converted_invoice_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Purchase Order Items table
export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  poId: integer("po_id")
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: "cascade" }),
  itemType: text("item_type").notNull().default("product"), // product, service
  inventoryItemId: integer("inventory_item_id").references(
    () => inventoryItems.id,
  ),
  description: text("description"), // For service items or additional details
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  discountType: text("discount_type").default("amount"), // amount | percentage
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0"),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
});

// Purchase Order Files table
export const purchaseOrderFiles = pgTable("purchase_order_files", {
  id: serial("id").primaryKey(),
  poId: integer("po_id")
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

// Purchase Invoice Files table
export const purchaseInvoiceFiles = pgTable("purchase_invoice_files", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id")
    .notNull()
    .references(() => purchaseInvoices.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

// Purchase Invoices table
export const purchaseInvoices = pgTable("purchase_invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  supplierInvoiceNumber: text("supplier_invoice_number"),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  poId: integer("po_id").references(() => purchaseOrders.id),
  // projectId: integer("project_id").references(() => projects.id),
  // assetInventoryInstanceId: integer("asset_inventory_instance_id").references(() => assetInventoryInstances.id),
  status: text("status").notNull().default("draft"), // draft, pending_approval, approved, rejected, cancelled
  paymentStatus: text("payment_status").notNull().default("unpaid"), // unpaid, partial, paid
  invoiceDate: timestamp("invoice_date").notNull(),
  dueDate: timestamp("due_date"),
  paymentTerms: text("payment_terms"),
  bankAccount: text("bank_account"),
  notes: text("notes"),
  currency: text("currency").notNull().default("AED"),
  exchangeRate: decimal("exchange_rate", { precision: 18, scale: 8 })
    .notNull()
    .default("1"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  discountPercentage: decimal("discount_percentage", {
    precision: 5,
    scale: 2,
  }).default("0"),
  discountAmount: decimal("discount_amount", {
    precision: 12,
    scale: 2,
  }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).default("0"),
  submittedById: integer("submitted_by_id").references(() => users.id),
  submittedAt: timestamp("submitted_at"),
  approvedById: integer("approved_by_id").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Purchase Invoice Payments table
export const purchaseInvoicePayments = pgTable("purchase_invoice_payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id")
    .notNull()
    .references(() => purchaseInvoices.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  paymentMethod: text("payment_method"),
  referenceNumber: text("reference_number"),
  notes: text("notes"),
  paymentType: text("payment_type").notNull().default("payment"), // payment, credit_note
  creditNoteId: integer("credit_note_id").references(
    () => purchaseCreditNotes.id,
  ),
  recordedBy: integer("recorded_by").references(() => users.id),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});

// Purchase Payment Files table
export const purchasePaymentFiles = pgTable("purchase_payment_files", {
  id: serial("id").primaryKey(),
  paymentId: integer("payment_id")
    .notNull()
    .references(() => purchaseInvoicePayments.id, { onDelete: "cascade" }),
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
  purchaseInvoiceId: integer("purchase_invoice_id")
    .notNull()
    .references(() => purchaseInvoices.id),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  status: text("status").notNull().default("draft"), // draft, issued, cancelled
  creditNoteDate: timestamp("credit_note_date", { mode: "string" }).notNull(),
  reason: text("reason"),
  items: json("items")
    .$type<
      {
        description: string;
        quantity: number;
        unitPrice: number;
        taxRate?: number;
        taxAmount?: number;
      }[]
    >()
    .default([]),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Purchase Invoice Items table
export const purchaseInvoiceItems = pgTable("purchase_invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id")
    .notNull()
    .references(() => purchaseInvoices.id, { onDelete: "cascade" }),
  itemType: text("item_type").notNull().default("product"), // product, service
  inventoryItemId: integer("inventory_item_id").references(
    () => inventoryItems.id,
  ),
  description: text("description"), // For service items or additional details
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  discountType: text("discount_type").default("amount"), // amount | percentage
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0"),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
  projectId: integer("project_id").references(() => projects.id), // Optional: allocate to project
  assetInstanceId: integer("asset_instance_id").references(
    () => assetInventoryInstances.id,
  ), // Optional: allocate to asset instance
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

// Chart of Accounts table
export const chartOfAccounts = pgTable("chart_of_accounts", {
  id: serial("id").primaryKey(),
  accountCode: text("account_code").notNull().unique(),
  accountName: text("account_name").notNull().unique(),
  accountType: text("account_type").notNull(), // asset, liability, equity, revenue, expense
  accountCategory: text("account_category").notNull(), // current_assets, fixed_assets, current_liabilities, etc.
  parentAccountId: integer("parent_account_id"),
  isActive: boolean("is_active").default(true),
  description: text("description"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
});

// General Ledger Entries table
export const generalLedgerEntries = pgTable("general_ledger_entries", {
  id: serial("id").primaryKey(),
  entryType: text("entry_type").notNull(),
  referenceType: text("reference_type").notNull(),
  referenceId: integer("reference_id"),
  accountName: text("account_name").notNull(),
  description: text("description").notNull(),
  debitAmount: numeric("debit_amount", { precision: 12, scale: 2 }).default(
    "0",
  ),
  creditAmount: numeric("credit_amount", { precision: 12, scale: 2 }).default(
    "0",
  ),
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
  supplierId: integer("supplier_id")
    .notNull()
    .references(() => suppliers.id),
  inventoryItemId: integer("inventory_item_id")
    .notNull()
    .references(() => inventoryItems.id),
  supplierPartNumber: text("supplier_part_number"),
  unitCost: decimal("unit_cost", { precision: 10, scale: 4 }).default("0"),
  minimumOrderQuantity: integer("minimum_order_quantity").default(1).notNull(),
  leadTimeDays: integer("lead_time_days").default(0).notNull(),
  isPreferred: boolean("is_preferred").default(false).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Customer Documents
export const customerDocuments = pgTable("customer_documents", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  documentType: text("document_type").notNull(), // trade_license, tax_registration, vat_certificate, commercial_license, establishment_card, chamber_membership, iso_certificate, insurance_certificate, bank_guarantee, other
  documentName: text("document_name").notNull(),
  documentNumber: text("document_number"),
  issuingAuthority: text("issuing_authority"),
  dateOfIssue: date("date_of_issue"),
  expiryDate: date("expiry_date"),
  filePath: text("file_path"),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  status: text("status").notNull().default("active"), // active, expired, pending_renewal, cancelled
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Supplier Documents
export const supplierDocuments = pgTable("supplier_documents", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id")
    .notNull()
    .references(() => suppliers.id, { onDelete: "cascade" }),
  documentType: text("document_type").notNull(), // trade_license, tax_registration, vat_certificate, commercial_license, establishment_card, chamber_membership, iso_certificate, insurance_certificate, bank_guarantee, supplier_agreement, quality_certificate, other
  documentName: text("document_name").notNull(),
  documentNumber: text("document_number"),
  issuingAuthority: text("issuing_authority"),
  dateOfIssue: date("date_of_issue"),
  expiryDate: date("expiry_date"),
  filePath: text("file_path"),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  status: text("status").notNull().default("active"), // active, expired, pending_renewal, cancelled
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Currency Exchange Rates
export const exchangeRates = pgTable("exchange_rates", {
  id: serial("id").primaryKey(),
  fromCurrency: text("from_currency").notNull().default("AED"),
  toCurrency: text("to_currency").notNull(),
  rate: decimal("rate", { precision: 18, scale: 8 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedById: integer("updated_by_id").references(() => users.id),
});

export const invoiceEditHistory = pgTable("invoice_edit_history", {
  id: serial("id").primaryKey(),
  invoiceType: text("invoice_type").notNull(),
  invoiceId: integer("invoice_id").notNull(),
  editNote: text("edit_note").notNull(),
  changes: json("changes").$type<Record<string, { old: any; new: any }>>(),
  editedBy: integer("edited_by").references(() => users.id),
  editedByName: text("edited_by_name"),
  editedAt: timestamp("edited_at").notNull().defaultNow(),
});

// Insert Schemas
export const insertInvoiceEditHistorySchema = createInsertSchema(
  invoiceEditHistory,
).omit({
  id: true,
  editedAt: true,
});
export type InsertInvoiceEditHistory = z.infer<
  typeof insertInvoiceEditHistorySchema
>;
export type InvoiceEditHistory = typeof invoiceEditHistory.$inferSelect;

// Who changed an employee's joining readiness date, and to what. Both the
// employee and an admin can set it, so an admin needs to see whether a date
// came from the employee or was entered on their behalf. Mirrors
// invoiceEditHistory. oldDate is null on the first entry; newDate is null when
// the date is cleared, which is itself a change worth recording.
export const employeeReadinessHistory = pgTable(
  "employee_readiness_history",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    oldDate: date("old_date"),
    newDate: date("new_date"),
    changedBy: integer("changed_by").references(() => users.id),
    changedByName: text("changed_by_name"),
    changedAt: timestamp("changed_at").notNull().defaultNow(),
  },
);

export const insertEmployeeReadinessHistorySchema = createInsertSchema(
  employeeReadinessHistory,
).omit({
  id: true,
  changedAt: true,
});
export type InsertEmployeeReadinessHistory = z.infer<
  typeof insertEmployeeReadinessHistorySchema
>;
export type EmployeeReadinessHistory =
  typeof employeeReadinessHistory.$inferSelect;

// The Entra app registration the company sends mail through. One row.
// clientSecretEncrypted holds CIPHERTEXT — the raw secret is never stored, so a
// database dump does not hand over a credential that can send mail as the
// company. See server/lib/secret-box.ts.
export const emailSettings = pgTable("email_settings", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id"),
  clientId: text("client_id"),
  clientSecretId: text("client_secret_id"),
  clientSecretEncrypted: text("client_secret_encrypted"),
  senderEmail: text("sender_email"),
  isEnabled: boolean("is_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedById: integer("updated_by_id").references(() => users.id),
});

// What makes sending idempotent. A reminder fires once per (notification,
// milestone) and never again — a restart, a job running twice, or two app
// instances sharing this database cannot re-send it. The unique index in
// migration 0070 is the mechanism; this table is just its shape.
export const notificationLog = pgTable("notification_log", {
  id: serial("id").primaryKey(),
  notificationType: text("notification_type").notNull(),
  documentType: text("document_type").notNull(),
  documentId: integer("document_id").notNull(),
  milestone: text("milestone").notNull(),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

// Each individual send and its outcome, so a failure is visible rather than
// silent. Separate from notificationLog because one notification can email
// several recipients, and one failing must not cause the whole notification to
// be retried and re-delivered to everyone else.
export const emailSendLog = pgTable("email_send_log", {
  id: serial("id").primaryKey(),
  toEmail: text("to_email").notNull(),
  // Resolved at send time: the address may belong to a user or an employee, and
  // looking the name up later would misattribute a recipient whose record has
  // since been renamed or removed.
  recipientName: text("recipient_name"),
  subject: text("subject"),
  bodyHtml: text("body_html"),
  template: text("template"),
  status: text("status").notNull(), // sent, failed
  error: text("error"),
  relatedType: text("related_type"),
  relatedId: integer("related_id"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

export type EmailSettings = typeof emailSettings.$inferSelect;
export type NotificationLog = typeof notificationLog.$inferSelect;
export type EmailSendLog = typeof emailSendLog.$inferSelect;

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});
export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
});
export const insertCustomerSchema = createInsertSchema(customers)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    vatRegistrationStatus: z
      .enum(["not_registered", "registered", "exempt", "suspended"])
      .default("not_registered"),
    vatTreatment: z
      .enum(["standard", "zero_rated", "exempt", "out_of_scope"])
      .default("standard"),
    customerType: z
      .enum(["business", "individual", "government", "non_profit"])
      .default("business"),
    taxCategory: z
      .enum(["standard", "export", "gcc_customer", "free_zone"])
      .default("standard"),
    paymentTerms: z
      .enum([
        "30_days",
        "15_days",
        "7_days",
        "immediate",
        "net_30",
        "net_60",
        "net_90",
      ])
      .default("30_days"),
    currency: z.string().default("AED"),
    creditLimit: z.string().nullable().optional(),
    isVatApplicable: z.boolean().default(true),
  });
export const insertSupplierSchema = createInsertSchema(suppliers)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    vatRegistrationStatus: z
      .enum(["not_registered", "registered", "exempt", "suspended"])
      .default("not_registered"),
    vatTreatment: z
      .enum(["standard", "zero_rated", "exempt", "out_of_scope"])
      .default("standard"),
    supplierType: z
      .enum(["business", "individual", "government", "non_profit"])
      .default("business"),
    taxCategory: z
      .enum(["standard", "import", "gcc_supplier", "free_zone"])
      .default("standard"),
    paymentTerms: z
      .enum([
        "30_days",
        "15_days",
        "7_days",
        "immediate",
        "net_30",
        "net_60",
        "net_90",
      ])
      .default("30_days"),
    currency: z.string().default("AED"),
    creditLimit: z.string().nullable().optional(),
    isVatApplicable: z.boolean().default(true),
    bankAccountDetails: z
      .array(
        z.object({
          id: z.number().optional(),
          accountDetails: z.string(),
        }),
      )
      .optional(),
  });
export const insertEmployeeSchema = createInsertSchema(employees)
  .omit({ id: true })
  .extend({
    hireDate: z.coerce.date().nullable().optional(),
    salary: z.string().nullable().optional(),
    category: z
      .enum(["permanent", "consultant", "contract"])
      .default("permanent"),
    grade: z.coerce.number().nullable().optional(),
    contractSalary: z.string().nullable().optional(),
    contractCurrency: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    position: z.string().nullable().optional(),
    department: z.string().nullable().optional(),
    userId: z.number().nullable().optional(),

    // Personal Particulars
    dateOfBirth: z.coerce.date().nullable().optional(),
    height: z.string().nullable().optional(),
    weight: z.string().nullable().optional(),
    address: z.string().nullable().optional(),

    // Bank Details
    bankName: z.string().nullable().optional(),
    bankBranch: z.string().nullable().optional(),
    accountNumber: z.string().nullable().optional(),
    accountHolderName: z.string().nullable().optional(),
    ifscCode: z.string().nullable().optional(),
    swiftCode: z.string().nullable().optional(),

    // Safety Equipment Sizes
    boilerSuitSize: z.string().nullable().optional(),
    safetyShoeSize: z.string().nullable().optional(),
  });

export const updateEmployeeSchema = insertEmployeeSchema.partial();

export const insertEmployeeNextOfKinSchema = createInsertSchema(
  employeeNextOfKin,
).omit({ id: true });
export const insertEmployeeTrainingRecordSchema = createInsertSchema(
  employeeTrainingRecords,
)
  .omit({ id: true })
  .extend({
    trainingDate: z.coerce.date(),
    expiryDate: z.coerce.date().nullable().optional(),
    status: z.enum(["active", "expired", "cancelled"]).default("active"),
  });

export const insertEmployeeDocumentSchema = createInsertSchema(
  employeeDocuments,
)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    documentType: z.enum([
      "passport",
      "cdc",
      "covid_vaccination",
      "stcw_course",
      "sid",
      "ilo_medical",
      "yellow_fever",
      "pp_photos",
      "us_visa",
      "schengen_visa",
      "uk_visa",
      "canada_visa",
      "australia_visa",
      "uae_visa",
      "saudi_visa",
      "singapore_visa",
      "work_permit",
      "residence_permit",
    ]),
    dateOfIssue: z.coerce
      .date()
      .nullable()
      .optional()
      .transform((d) => (d ? d.toISOString().slice(0, 10) : null)),
    expiryDate: z.coerce
      .date()
      .nullable()
      .optional()
      .transform((d) => (d ? d.toISOString().slice(0, 10) : null)),
    validTill: z.coerce
      .date()
      .nullable()
      .optional()
      .transform((d) => (d ? d.toISOString().slice(0, 10) : null)),
    status: z.enum(["active", "expired", "pending_renewal"]).default("active"),
  });
export const insertLocationSchema = createInsertSchema(locations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectSchema = createInsertSchema(projects)
  .omit({ id: true, actualCost: true })
  .extend({
    description: z.string().optional(),
    vesselName: z.string().optional(),
    vesselImage: z.string().optional(),
    vesselImoNumber: z.string().optional(),
    startDate: z.date().optional(),
    plannedEndDate: z.date().optional(),
    estimatedBudget: z
      .string()
      .transform((val) => {
        if (!val || val.trim() === "") return undefined;
        const num = parseFloat(val);
        return isNaN(num) || num < 0 ? undefined : num.toFixed(2);
      })
      .optional(),
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
    additionalField4Title: z.string().optional(),
    additionalField4Description: z.string().optional(),
    additionalField5Title: z.string().optional(),
    additionalField5Description: z.string().optional(),
    additionalField6Title: z.string().optional(),
    additionalField6Description: z.string().optional(),
    surfaceTemperature: z.string().optional(),
    airTemperature: z.string().optional(),
    relativeHumidity: z.string().optional(),
    dewPointTemperature: z.string().optional(),
    dewPointSurfaceDiff: z.string().optional(),
    workRemainingDays: z
      .array(
        z.object({
          location: z.string(),
          days: z.string(),
        }),
      )
      .optional(),
  });
export const insertInventoryItemSchema = createInsertSchema(inventoryItems)
  .omit({ id: true, currentStock: true, avgCost: true })
  .extend({
    initialQuantity: z.number().optional(),
    unitPrice: z.number().optional(),
  });

export const insertDailyActivitySchema = createInsertSchema(dailyActivities)
  .omit({ id: true })
  .extend({
    hbmDailyRunningHours: z
      .string()
      .transform((val) => {
        if (!val || val.trim() === "") return undefined;
        const num = parseFloat(val);
        return isNaN(num) ? undefined : num.toFixed(2);
      })
      .optional(),
  });

export const insertSalesQuotationSchema = createInsertSchema(
  salesQuotations,
).omit({ id: true, quotationNumber: true, createdDate: true });
export const insertSalesQuotationItemSchema = createInsertSchema(
  salesQuotationItems,
).omit({ id: true });
export const insertSalesInvoiceSchema = createInsertSchema(salesInvoices)
  .omit({ id: true })
  .extend({
    invoiceNumber: z.string().optional(),
  });
export const insertSalesInvoiceItemSchema = createInsertSchema(
  salesInvoiceItems,
).omit({ id: true });
export const insertInvoicePaymentSchema = createInsertSchema(
  invoicePayments,
).omit({ id: true, recordedAt: true });
export const insertSupplierInventoryItemSchema = createInsertSchema(
  supplierInventoryItems,
).omit({ id: true, createdAt: true });
export const insertProjectPhotoGroupSchema = createInsertSchema(
  projectPhotoGroups,
)
  .omit({ id: true, createdAt: true })
  .extend({
    date: z
      .string()
      .or(z.date())
      .transform((val) => new Date(val)),
  });
export const insertProjectPhotoSchema = createInsertSchema(projectPhotos).omit({
  id: true,
  uploadedAt: true,
});
export const insertProjectConsumableSchema = createInsertSchema(
  projectConsumables,
).omit({ id: true, recordedAt: true });
export const insertProjectConsumableItemSchema = createInsertSchema(
  projectConsumableItems,
).omit({ id: true });

export const insertPayrollEntrySchema = createInsertSchema(payrollEntries).omit({
  id: true,
  generatedDate: true,
});
export const insertPayrollAdditionSchema = createInsertSchema(
  payrollAdditions,
).omit({ id: true });
export const insertPayrollDeductionSchema = createInsertSchema(
  payrollDeductions,
).omit({ id: true });

export const insertProformaInvoiceSchema = createInsertSchema(
  proformaInvoices,
).omit({ id: true, proformaNumber: true, createdDate: true });
export const insertCreditNoteSchema = createInsertSchema(creditNotes).omit({
  id: true,
  creditNoteNumber: true,
  createdAt: true,
});
export const insertCreditNoteItemSchema = createInsertSchema(
  creditNoteItems,
).omit({ id: true });

export const insertPurchaseRequestSchema = createInsertSchema(
  purchaseRequests,
).omit({ id: true, requestNumber: true, requestDate: true });
export const insertPurchaseRequestItemSchema = createInsertSchema(
  purchaseRequestItems,
).omit({ id: true });
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
  submittedById: integer("submitted_by_id").references(() => users.id),
  submittedAt: timestamp("submitted_at"),
  approvedById: integer("approved_by_id").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  convertedInvoiceId: integer("converted_invoice_id").references(
    () => purchaseInvoices.id,
  ),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertPurchaseOrderSchema = createInsertSchema(
  purchaseOrdersTable,
).omit({ id: true, poNumber: true, createdAt: true });
export const insertPurchaseOrderItemSchema = createInsertSchema(
  purchaseOrderItems,
).omit({ id: true });
export const insertPurchaseInvoiceSchema = createInsertSchema(
  purchaseInvoices,
).omit({ id: true, createdAt: true });
export const insertPurchaseInvoiceItemSchema = createInsertSchema(
  purchaseInvoiceItems,
).omit({ id: true });
export const insertPurchaseCreditNoteSchema = createInsertSchema(
  purchaseCreditNotes,
).omit({ id: true, creditNoteNumber: true, createdAt: true });

export const insertGeneralLedgerEntrySchema = createInsertSchema(
  generalLedgerEntries,
).omit({ id: true, createdAt: true });

// Chart of Accounts Schema
export const insertChartOfAccountsSchema = createInsertSchema(chartOfAccounts)
  .omit({ id: true, createdAt: true })
  .extend({
    accountType: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
    accountCategory: z.string(),
  });

// Customer and Supplier Document Schemas
export const insertCustomerDocumentSchema = createInsertSchema(
  customerDocuments,
)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    documentType: z.enum([
      "trade_license",
      "tax_registration",
      "vat_certificate",
      "commercial_license",
      "establishment_card",
      "chamber_membership",
      "iso_certificate",
      "insurance_certificate",
      "bank_guarantee",
      "other",
    ]),
    dateOfIssue: z.string().nullable().optional(),
    expiryDate: z.string().nullable().optional(),
    status: z
      .enum(["active", "expired", "pending_renewal", "cancelled"])
      .default("active"),
  });

export const insertSupplierDocumentSchema = createInsertSchema(
  supplierDocuments,
)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    documentType: z.enum([
      "trade_license",
      "tax_registration",
      "vat_certificate",
      "commercial_license",
      "establishment_card",
      "chamber_membership",
      "iso_certificate",
      "insurance_certificate",
      "bank_guarantee",
      "supplier_agreement",
      "quality_certificate",
      "other",
    ]),
    dateOfIssue: z.coerce.date().nullable().optional(),
    expiryDate: z.coerce.date().nullable().optional(),
    status: z
      .enum(["active", "expired", "pending_renewal", "cancelled"])
      .default("active"),
  });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Customer = typeof customers.$inferSelect;
export interface CustomerWithProjectCount extends Customer {
  projectCount: number;
}
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type SupplierBankDetails = typeof supplierBankDetails.$inferSelect;
export type InsertSupplierBankDetails = typeof supplierBankDetails.$inferInsert;
export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type EmployeeNextOfKin = typeof employeeNextOfKin.$inferSelect;
export type InsertEmployeeNextOfKin = z.infer<
  typeof insertEmployeeNextOfKinSchema
>;
export type EmployeeTrainingRecord =
  typeof employeeTrainingRecords.$inferSelect;
export type InsertEmployeeTrainingRecord = z.infer<
  typeof insertEmployeeTrainingRecordSchema
>;
export type EmployeeDocument = typeof employeeDocuments.$inferSelect;
export type InsertEmployeeDocument = z.infer<
  typeof insertEmployeeDocumentSchema
>;
// export type Project = typeof projects.$inferSelect;
export type Project = typeof projects.$inferSelect & { customerName?: string };
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Location = typeof locations.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;

export type DailyActivity = typeof dailyActivities.$inferSelect;
export type InsertDailyActivity = z.infer<typeof insertDailyActivitySchema>;

export type SalesQuotation = typeof salesQuotations.$inferSelect;
export type InsertSalesQuotation = z.infer<typeof insertSalesQuotationSchema>;
export type SalesQuotationItem = typeof salesQuotationItems.$inferSelect;
export type InsertSalesQuotationItem = z.infer<
  typeof insertSalesQuotationItemSchema
>;
export type SalesInvoice = typeof salesInvoices.$inferSelect;
export type InsertSalesInvoice = z.infer<typeof insertSalesInvoiceSchema>;
export type SalesInvoiceItem = typeof salesInvoiceItems.$inferSelect;
export type InsertSalesInvoiceItem = z.infer<
  typeof insertSalesInvoiceItemSchema
>;
export type InvoicePayment = typeof invoicePayments.$inferSelect;
export type InsertInvoicePayment = z.infer<typeof insertInvoicePaymentSchema>;
export type SupplierInventoryItem = typeof supplierInventoryItems.$inferSelect;
export type InsertSupplierInventoryItem = z.infer<
  typeof insertSupplierInventoryItemSchema
>;
export type ProjectPhotoGroup = typeof projectPhotoGroups.$inferSelect;
export type InsertProjectPhotoGroup = z.infer<
  typeof insertProjectPhotoGroupSchema
>;
export type ProjectPhoto = typeof projectPhotos.$inferSelect;
export type InsertProjectPhoto = z.infer<typeof insertProjectPhotoSchema>;
export type ProjectConsumable = typeof projectConsumables.$inferSelect;
export type InsertProjectConsumable = z.infer<
  typeof insertProjectConsumableSchema
>;
export type ProjectConsumableItem = typeof projectConsumableItems.$inferSelect;
export type InsertProjectConsumableItem = z.infer<
  typeof insertProjectConsumableItemSchema
>;

export type PayrollEntry = typeof payrollEntries.$inferSelect;
export type InsertPayrollEntry = z.infer<typeof insertPayrollEntrySchema>;
export type PayrollAddition = typeof payrollAdditions.$inferSelect;
export type InsertPayrollAddition = z.infer<typeof insertPayrollAdditionSchema>;
export type PayrollDeduction = typeof payrollDeductions.$inferSelect;
export type InsertPayrollDeduction = z.infer<
  typeof insertPayrollDeductionSchema
>;

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
export type InsertPurchaseRequestItem = z.infer<
  typeof insertPurchaseRequestItemSchema
>;
export type PurchaseOrder = typeof purchaseOrdersTable.$inferSelect;
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type InsertPurchaseOrderItem = z.infer<
  typeof insertPurchaseOrderItemSchema
>;
export type PurchaseInvoice = typeof purchaseInvoices.$inferSelect;
export type InsertPurchaseInvoice = z.infer<typeof insertPurchaseInvoiceSchema>;
export type PurchaseInvoiceItem = typeof purchaseInvoiceItems.$inferSelect;
export type InsertPurchaseInvoiceItem = z.infer<
  typeof insertPurchaseInvoiceItemSchema
>;
export type PurchaseCreditNote = typeof purchaseCreditNotes.$inferSelect;
export type InsertPurchaseCreditNote = z.infer<
  typeof insertPurchaseCreditNoteSchema
>;
export type ErrorLog = typeof errorLogs.$inferSelect;
export type InsertErrorLog = typeof errorLogs.$inferInsert;
export type GeneralLedgerEntry = typeof generalLedgerEntries.$inferSelect;
export type InsertGeneralLedgerEntry = z.infer<
  typeof insertGeneralLedgerEntrySchema
>;
export type ChartOfAccount = typeof chartOfAccounts.$inferSelect;
export type InsertChartOfAccount = z.infer<typeof insertChartOfAccountsSchema>;

// Customer and Supplier Document Types
export type CustomerDocument = typeof customerDocuments.$inferSelect;
export type InsertCustomerDocument = z.infer<
  typeof insertCustomerDocumentSchema
>;
export type SupplierDocument = typeof supplierDocuments.$inferSelect;
export type InsertSupplierDocument = z.infer<
  typeof insertSupplierDocumentSchema
>;

// Asset Management Schemas
// Asset Management Schemas - consolidated from duplicates above
export const insertAssetTypeSchema = createInsertSchema(assetTypes).omit({
  id: true,
  createdAt: true,
});

// New enhanced asset inventory schemas
export const insertAssetInventoryInstanceSchema = createInsertSchema(
  assetInventoryInstances,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectAssetInstanceAssignmentSchema = createInsertSchema(
  projectAssetInstanceAssignments,
).omit({ id: true, assignedAt: true });

// Asset Management Types - consolidated from duplicates above
export type AssetType = typeof assetTypes.$inferSelect;
export type InsertAssetType = z.infer<typeof insertAssetTypeSchema>;

// New enhanced asset inventory types
export type AssetInventoryInstance =
  typeof assetInventoryInstances.$inferSelect;
export type InsertAssetInventoryInstance = z.infer<
  typeof insertAssetInventoryInstanceSchema
>;
export type ProjectAssetInstanceAssignment =
  typeof projectAssetInstanceAssignments.$inferSelect;
export type InsertProjectAssetInstanceAssignment = z.infer<
  typeof insertProjectAssetInstanceAssignmentSchema
>;

// Dashboard Statistics Types
export const dashboardStatsSchema = z.object({
  activeProjects: z.number(),
  activeProjectsChange: z.number(),
  activeProjectsChangeLabel: z.string(),
  completedProjects: z.number(),
  completedProjectsChange: z.number(),
  completedProjectsChangeLabel: z.string(),
  lowStockItems: z.number(),
  lowStockItemsChange: z.number(),
  lowStockItemsChangeLabel: z.string(),
  monthlyRevenue: z.number(),
  monthlyRevenueChange: z.number(),
  monthlyRevenueChangeLabel: z.string(),
  monthlyRevenuePercentageChange: z.number(),
});

export type DashboardStats = z.infer<typeof dashboardStatsSchema>;

export type SupplierWithBankDetails = Supplier & {
  bankAccountDetails: SupplierBankDetails[];
};

// Reimbursement schemas and types
export const insertReimbursementSchema = createInsertSchema(
  reimbursements,
).omit({
  id: true,
  submissionTimestamp: true,
  approvedById: true,
  approvalTimestamp: true,
  payrollMonth: true,
  payrollYear: true,
});
export type Reimbursement = typeof reimbursements.$inferSelect;
export type InsertReimbursement = z.infer<typeof insertReimbursementSchema>;

// Employee Feedback
export const employeeFeedback = pgTable("employee_feedback", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id),
  projectId: integer("project_id").references(() => projects.id),
  feedback: text("feedback").notNull(),
  createdById: integer("created_by_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEmployeeFeedbackSchema = createInsertSchema(
  employeeFeedback,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type EmployeeFeedback = typeof employeeFeedback.$inferSelect;
export type InsertEmployeeFeedback = z.infer<
  typeof insertEmployeeFeedbackSchema
>;

// Exchange Rate schemas and types
export const insertExchangeRateSchema = createInsertSchema(exchangeRates).omit({
  id: true,
  updatedAt: true,
});
export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type InsertExchangeRate = z.infer<typeof insertExchangeRateSchema>;
