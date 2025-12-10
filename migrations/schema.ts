import { pgTable, serial, text, foreignKey, timestamp, numeric, integer, json, unique, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const companies = pgTable("companies", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	logo: text(),
	address: text(),
	phone: text(),
	email: text(),
	website: text(),
});

export const projects = pgTable("projects", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	description: text(),
	vesselName: text("vessel_name"),
	vesselImage: text("vessel_image"),
	vesselImoNumber: text("vessel_imo_number"),
	startDate: timestamp("start_date", { mode: 'string' }),
	plannedEndDate: timestamp("planned_end_date", { mode: 'string' }),
	actualEndDate: timestamp("actual_end_date", { mode: 'string' }),
	status: text().default('not_started').notNull(),
	estimatedBudget: numeric("estimated_budget", { precision: 12, scale:  2 }),
	actualCost: numeric("actual_cost", { precision: 12, scale:  2 }).default('0'),
	totalRevenue: numeric("total_revenue", { precision: 12, scale:  2 }).default('0'),
	customerId: integer("customer_id"),
	locations: json().default([]),
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
}, (table) => [
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "projects_customer_id_customers_id_fk"
		}),
]);

export const assets = pgTable("assets", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	barcode: text(),
	category: text(),
	description: text(),
	status: text().default('available').notNull(),
	projectId: integer("project_id"),
	assignedToId: integer("assigned_to_id"),
	acquisitionDate: timestamp("acquisition_date", { mode: 'string' }),
	acquisitionCost: numeric("acquisition_cost", { precision: 10, scale:  2 }),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "assets_project_id_projects_id_fk"
		}),
	foreignKey({
			columns: [table.assignedToId],
			foreignColumns: [employees.id],
			name: "assets_assigned_to_id_employees_id_fk"
		}),
	unique("assets_barcode_unique").on(table.barcode),
]);

export const employees = pgTable("employees", {
	id: serial().primaryKey().notNull(),
	employeeCode: text("employee_code").notNull(),
	firstName: text("first_name").notNull(),
	lastName: text("last_name").notNull(),
	email: text(),
	phone: text(),
	position: text(),
	department: text(),
	category: text().default('permanent').notNull(),
	salary: numeric({ precision: 10, scale:  2 }),
	hireDate: timestamp("hire_date", { mode: 'string' }),
	isActive: boolean("is_active").default(true).notNull(),
	userId: integer("user_id"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "employees_user_id_users_id_fk"
		}),
	unique("employees_employee_code_unique").on(table.employeeCode),
]);

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	username: text().notNull(),
	email: text().notNull(),
	password: text().notNull(),
	role: text().default('employee').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("users_username_unique").on(table.username),
	unique("users_email_unique").on(table.email),
]);

export const customers = pgTable("customers", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	contactPerson: text("contact_person"),
	email: text(),
	phone: text().notNull().unique(),
	address: text(),
	taxId: text("tax_id"),
	userId: integer("user_id"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "customers_user_id_users_id_fk"
		}),
]);

export const dailyActivities = pgTable("daily_activities", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id"),
	date: timestamp({ mode: 'string' }).notNull(),
	location: text(),
	completedTasks: text("completed_tasks"),
	plannedTasks: text("planned_tasks"),
	remarks: text(),
	photos: json().default([]),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "daily_activities_project_id_projects_id_fk"
		}),
]);

export const inventoryItems = pgTable("inventory_items", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	category: text().notNull(),
	unit: text().notNull(),
	currentStock: integer("current_stock").default(0).notNull(),
	minStockLevel: integer("min_stock_level").default(0).notNull(),
	avgCost: numeric("avg_cost", { precision: 10, scale:  4 }).default('0'),
});

export const inventoryTransactions = pgTable("inventory_transactions", {
	id: serial().primaryKey().notNull(),
	itemId: integer("item_id"),
	type: text().notNull(),
	quantity: integer().notNull(),
	unitCost: numeric("unit_cost", { precision: 10, scale:  4 }),
	remainingQuantity: integer("remaining_quantity").notNull(),
	projectId: integer("project_id"),
	reference: text(),
	timestamp: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.itemId],
			foreignColumns: [inventoryItems.id],
			name: "inventory_transactions_item_id_inventory_items_id_fk"
		}),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "inventory_transactions_project_id_projects_id_fk"
		}),
]);

export const payrollEntries = pgTable("payroll_entries", {
	id: serial().primaryKey().notNull(),
	employeeId: integer("employee_id"),
	projectId: integer("project_id"),
	month: integer().notNull(),
	year: integer().notNull(),
	workingDays: integer("working_days").notNull(),
	basicSalary: numeric("basic_salary", { precision: 10, scale:  2 }),
	totalAdditions: numeric("total_additions", { precision: 10, scale: 2 }).default('0'),
	totalDeductions: numeric("total_deductions", { precision: 10, scale: 2 }).default('0'),
	totalAmount: numeric("total_amount", { precision: 10, scale:  2 }),
	status: text().default('draft').notNull(),
	generatedDate: timestamp("generated_date", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "payroll_entries_employee_id_employees_id_fk"
		}),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "payroll_entries_project_id_projects_id_fk"
		}),
]);

export const projectEmployees = pgTable("project_employees", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id"),
	employeeId: integer("employee_id"),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "project_employees_project_id_projects_id_fk"
		}),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "project_employees_employee_id_employees_id_fk"
		}),
]);

export const suppliers = pgTable("suppliers", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	contactPerson: text("contact_person"),
	email: text(),
	phone: text(),
	address: text(),
	taxId: text("tax_id"),
	bankInfo: text("bank_info"),
});

export const salesInvoices = pgTable("sales_invoices", {
	id: serial().primaryKey().notNull(),
	invoiceNumber: text("invoice_number").notNull(),
	customerId: integer("customer_id"),
	projectId: integer("project_id"),
	quotationId: integer("quotation_id"),
	status: text().default('unpaid').notNull(),
	invoiceDate: timestamp("invoice_date", { mode: 'string' }).notNull(),
	dueDate: timestamp("due_date", { mode: 'string' }).notNull(),
	paymentTerms: text("payment_terms"),
	bankAccount: text("bank_account"),
	remarks: text("remarks"),
	items: json().default([]),
	subtotal: numeric({ precision: 12, scale:  2 }),
	taxAmount: numeric("tax_amount", { precision: 10, scale:  2 }),
	discount: numeric({ precision: 10, scale:  2 }).default('0'),
	totalAmount: numeric("total_amount", { precision: 12, scale:  2 }),
	paidAmount: numeric("paid_amount", { precision: 12, scale:  2 }).default('0'),
}, (table) => [
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "sales_invoices_customer_id_customers_id_fk"
		}),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "sales_invoices_project_id_projects_id_fk"
		}),
	foreignKey({
			columns: [table.quotationId],
			foreignColumns: [salesQuotations.id],
			name: "sales_invoices_quotation_id_sales_quotations_id_fk"
		}),
	unique("sales_invoices_invoice_number_unique").on(table.invoiceNumber),
]);

export const salesQuotations = pgTable("sales_quotations", {
	id: serial().primaryKey().notNull(),
	quotationNumber: text("quotation_number").notNull(),
	customerId: integer("customer_id"),
	status: text().default('draft').notNull(),
	validUntil: timestamp("valid_until", { mode: 'string' }),
	paymentTerms: text("payment_terms"),
	bankAccount: text("bank_account"),
	remarks: text("remarks"),
	items: json().default([]),
	subtotal: numeric({ precision: 12, scale:  2 }),
	taxAmount: numeric("tax_amount", { precision: 10, scale:  2 }),
	discount: numeric({ precision: 10, scale:  2 }).default('0'),
	totalAmount: numeric("total_amount", { precision: 12, scale:  2 }),
	isArchived: boolean("is_archived").default(false).notNull(),
	createdDate: timestamp("created_date", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "sales_quotations_customer_id_customers_id_fk"
		}),
	unique("sales_quotations_quotation_number_unique").on(table.quotationNumber),
]);

export const proformaInvoices = pgTable("proforma_invoices", {
	id: serial().primaryKey().notNull(),
	proformaNumber: text("proforma_number").notNull(),
	customerId: integer("customer_id"),
	projectId: integer("project_id"),
	quotationId: integer("quotation_id"),
	status: text().default('draft').notNull(),
	createdDate: timestamp("created_date", { mode: 'string' }).defaultNow().notNull(),
	invoiceDate: timestamp("invoice_date", { mode: 'string' }).defaultNow().notNull(),
	validUntil: timestamp("valid_until", { mode: 'string' }),
	paymentTerms: text("payment_terms"),
	deliveryTerms: text("delivery_terms"),
	remarks: text(),
	items: json().default([]),
	subtotal: numeric({ precision: 12, scale:  2 }),
	taxAmount: numeric("tax_amount", { precision: 10, scale:  2 }),
	discount: numeric({ precision: 10, scale:  2 }).default('0'),
	totalAmount: numeric("total_amount", { precision: 12, scale:  2 }),
	isArchived: boolean("is_archived").default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "proforma_invoices_customer_id_customers_id_fk"
		}),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "proforma_invoices_project_id_projects_id_fk"
		}),
	foreignKey({
			columns: [table.quotationId],
			foreignColumns: [salesQuotations.id],
			name: "proforma_invoices_quotation_id_sales_quotations_id_fk"
		}),
	unique("proforma_invoices_proforma_number_unique").on(table.proformaNumber),
]);

export const projectPhotoGroups = pgTable("project_photo_groups", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id"),
	title: text().notNull(),
	date: timestamp({ mode: 'string' }).notNull(),
	description: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	createdBy: integer("created_by"),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "project_photo_groups_project_id_projects_id_fk"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "project_photo_groups_created_by_users_id_fk"
		}),
]);

export const projectPhotos = pgTable("project_photos", {
	id: serial().primaryKey().notNull(),
	groupId: integer("group_id"),
	filename: text().notNull(),
	originalName: text("original_name").notNull(),
	filePath: text("file_path").notNull(),
	fileSize: integer("file_size"),
	mimeType: text("mime_type"),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.groupId],
			foreignColumns: [projectPhotoGroups.id],
			name: "project_photos_group_id_project_photo_groups_id_fk"
		}),
]);

export const payrollAdditions = pgTable("payroll_additions", {
	id: serial().primaryKey().notNull(),
	payrollEntryId: integer("payroll_entry_id"),
	description: text().notNull(),
	amount: numeric({ precision: 10, scale: 2 }).notNull(),
	note: text(),
}, (table) => [
	foreignKey({
			columns: [table.payrollEntryId],
			foreignColumns: [payrollEntries.id],
			name: "payroll_additions_payroll_entry_id_payroll_entries_id_fk"
		}),
]);

export const payrollDeductions = pgTable("payroll_deductions", {
	id: serial().primaryKey().notNull(),
	payrollEntryId: integer("payroll_entry_id"),
	description: text().notNull(),
	amount: numeric({ precision: 10, scale: 2 }).notNull(),
	note: text(),
}, (table) => [
	foreignKey({
			columns: [table.payrollEntryId],
			foreignColumns: [payrollEntries.id],
			name: "payroll_deductions_payroll_entry_id_payroll_entries_id_fk"
		}),
]);

export const invoicePayments = pgTable("invoice_payments", {
	id: serial().primaryKey().notNull(),
	invoiceId: integer("invoice_id").notNull(),
	amount: numeric({ precision: 12, scale: 2 }).notNull(),
	paymentDate: timestamp("payment_date", { mode: 'string' }).notNull(),
	paymentMethod: text("payment_method"),
	referenceNumber: text("reference_number"),
	notes: text(),
	recordedBy: integer("recorded_by"),
	recordedAt: timestamp("recorded_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [salesInvoices.id],
			name: "invoice_payments_invoice_id_sales_invoices_id_fk"
		}),
	foreignKey({
			columns: [table.recordedBy],
			foreignColumns: [users.id],
			name: "invoice_payments_recorded_by_users_id_fk"
		}),
]);

export const purchaseRequestItems = pgTable("purchase_request_items", {
	id: serial().primaryKey().notNull(),
	requestId: integer("request_id").references(() => purchaseRequests.id, { onDelete: "cascade" }).notNull(),
	description: text().notNull(),
	quantity: integer().notNull(),
	estimatedCost: numeric("estimated_cost", { precision: 10, scale: 2 }),
});

export const assetAssignments = pgTable("asset_assignments", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull().references(() => assets.id),
  projectId: integer("project_id").notNull().references(() => projects.id),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  dailyRate: numeric("daily_rate", { precision: 10, scale: 2 }).notNull(),
  totalCost: numeric("total_cost", { precision: 10, scale: 2 }).notNull(),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  assignedBy: integer("assigned_by").notNull().references(() => users.id),
});

export const assetMaintenanceRecords = pgTable("asset_maintenance_records", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull().references(() => assets.id),
  maintenanceCost: numeric("maintenance_cost", { precision: 10, scale: 2 }).notNull(),
  maintenanceDate: timestamp("maintenance_date").defaultNow().notNull(),
  description: text("description"),
  performedBy: integer("performed_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const assetMaintenanceFiles = pgTable("asset_maintenance_files", {
  id: serial("id").primaryKey(),
  maintenanceRecordId: integer("maintenance_record_id").notNull().references(() => assetMaintenanceRecords.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  contentType: text("content_type"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

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

export const creditNotes = pgTable("credit_notes", {
  id: serial("id").primaryKey(),
  creditNoteNumber: text("credit_note_number").notNull(),
  salesInvoiceId: integer("sales_invoice_id").notNull(),
  customerId: integer("customer_id"),
  projectId: integer("project_id"),
  status: text("status").default('draft').notNull(),
  creditNoteDate: timestamp("credit_note_date", { mode: 'string' }).notNull(),
  reason: text("reason"),
  items: json("items").default([]),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }),
  taxAmount: numeric("tax_amount", { precision: 10, scale: 2 }),
  discount: numeric("discount", { precision: 10, scale: 2 }).default('0'),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.salesInvoiceId],
    foreignColumns: [salesInvoices.id],
    name: "credit_notes_sales_invoice_id_sales_invoices_id_fk"
  }),
  foreignKey({
    columns: [table.customerId],
    foreignColumns: [customers.id],
    name: "credit_notes_customer_id_customers_id_fk"
  }),
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "credit_notes_project_id_projects_id_fk"
  }),
  unique("credit_notes_credit_note_number_unique").on(table.creditNoteNumber),
]);

export const creditNoteItems = pgTable("credit_note_items", {
  id: serial("id").primaryKey(),
  creditNoteId: integer("credit_note_id").notNull(),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).default('0'),
  taxAmount: numeric("tax_amount", { precision: 10, scale: 2 }).default('0'),
  lineTotal: numeric("line_total", { precision: 10, scale: 2 }).notNull(),
}, (table) => [
  foreignKey({
    columns: [table.creditNoteId],
    foreignColumns: [creditNotes.id],
    name: "credit_note_items_credit_note_id_credit_notes_id_fk"
  }),
]);

export const projectConsumables = pgTable("project_consumables", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id"),
  date: timestamp("date", { mode: 'string' }).notNull(),
  recordedBy: integer("recorded_by"),
  recordedAt: timestamp("recorded_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.projectId],
    foreignColumns: [projects.id],
    name: "project_consumables_project_id_projects_id_fk"
  }),
  foreignKey({
    columns: [table.recordedBy],
    foreignColumns: [users.id],
    name: "project_consumables_recorded_by_users_id_fk"
  }),
]);

export const projectConsumableItems = pgTable("project_consumable_items", {
  id: serial("id").primaryKey(),
  consumableId: integer("consumable_id"),
  inventoryItemId: integer("inventory_item_id"),
  quantity: integer("quantity").notNull(),
  unitCost: numeric("unit_cost", { precision: 10, scale: 4 }),
}, (table) => [
  foreignKey({
    columns: [table.consumableId],
    foreignColumns: [projectConsumables.id],
    name: "project_consumable_items_consumable_id_fk"
  }),
  foreignKey({
    columns: [table.inventoryItemId],
    foreignColumns: [inventoryItems.id],
    name: "project_consumable_items_inventory_item_id_fk"
  }),
]);

export const errorLogs = pgTable("error_logs", {
	id: serial().primaryKey().notNull(),
	message: text().notNull(),
	stack: text(),
	url: text(),
	userAgent: text("user_agent"),
	userId: integer("user_id"),
	timestamp: timestamp({ mode: 'string' }).defaultNow().notNull(),
	severity: text().default('error').notNull(),
	component: text(),
	resolved: boolean().default(false).notNull(),
}, (table) => [
	foreignKey({
		columns: [table.userId],
		foreignColumns: [users.id],
		name: "error_logs_user_id_users_id_fk"
	}),
	index("error_logs_timestamp_idx").on(table.timestamp),
	index("error_logs_user_id_idx").on(table.userId),
	index("error_logs_severity_idx").on(table.severity),
});

export const generalLedgerEntries = pgTable("general_ledger_entries", {
  id: serial().primaryKey().notNull(),
  entryType: text("entry_type").notNull(),
  referenceType: text("reference_type").notNull(),
  referenceId: integer("reference_id"),
  accountName: text("account_name").notNull(),
  description: text().notNull(),
  debitAmount: numeric("debit_amount", { precision: 12, scale: 2 }).default("0"),
  creditAmount: numeric("credit_amount", { precision: 12, scale: 2 }).default("0"),
  entityId: integer("entity_id"),
  entityName: text("entity_name"),
  invoiceNumber: text("invoice_number"),
  transactionDate: timestamp("transaction_date", { mode: "string" }).notNull(),
  dueDate: timestamp("due_date", { mode: "string" }),
  status: text().default("pending").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  createdBy: integer("created_by"),
  notes: text(),
});