import { pgTable, serial, text, integer, index, timestamp, boolean, jsonb, numeric, foreignKey, unique, json, date, check, varchar, type AnyPgColumn, pgSequence } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"


export const invoiceNumberSeq = pgSequence("invoice_number_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "9223372036854775807", cache: "1", cycle: false })

export const companies = pgTable("companies", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	logo: text(),
	address: text(),
	phone: text(),
	email: text(),
	website: text(),
	financialYearStartDay: integer("financial_year_start_day").default(1),
	financialYearStartMonth: integer("financial_year_start_month").default(1),
	financialYearEndDay: integer("financial_year_end_day").default(31),
	financialYearEndMonth: integer("financial_year_end_month").default(12),
	bankAccount: text("bank_account"),
});

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
	index("error_logs_severity_idx").using("btree", table.severity.asc().nullsLast().op("text_ops")),
	index("error_logs_timestamp_idx").using("btree", table.timestamp.asc().nullsLast().op("timestamp_ops")),
	index("error_logs_user_id_idx").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
]);

export const assetTypes = pgTable("asset_types", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	category: text().notNull(),
	description: text(),
	manufacturer: text(),
	model: text(),
	specifications: jsonb().default({}),
	defaultDailyRentalRate: numeric("default_daily_rental_rate", { precision: 10, scale:  2 }),
	depreciationRate: numeric("depreciation_rate", { precision: 5, scale:  2 }).default('0'),
	warrantyPeriodMonths: integer("warranty_period_months").default(12),
	maintenanceIntervalDays: integer("maintenance_interval_days").default(90),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	totalQuantity: integer("total_quantity").default(0),
	availableQuantity: integer("available_quantity").default(0),
	assignedQuantity: integer("assigned_quantity").default(0),
	maintenanceQuantity: integer("maintenance_quantity").default(0),
	currency: text().default('AED').notNull(),
});

export const assetInventoryInstances = pgTable("asset_inventory_instances", {
	id: serial().primaryKey().notNull(),
	assetTypeId: integer("asset_type_id").notNull(),
	instanceNumber: text("instance_number").notNull(),
	assetTag: text("asset_tag").notNull(),
	serialNumber: text("serial_number").notNull(),
	barcode: text().notNull(),
	status: text().default('available').notNull(),
	condition: text().default('excellent').notNull(),
	location: text(),
	assignedProjectId: integer("assigned_project_id"),
	assignedToId: integer("assigned_to_id"),
	acquisitionDate: timestamp("acquisition_date", { mode: 'string' }),
	acquisitionCost: numeric("acquisition_cost", { precision: 10, scale:  2 }),
	currentValue: numeric("current_value", { precision: 10, scale:  2 }),
	monthlyRentalAmount: numeric("monthly_rental_amount", { precision: 10, scale:  2 }).default('0'),
	warrantyExpiryDate: timestamp("warranty_expiry_date", { mode: 'string' }),
	lastMaintenanceDate: timestamp("last_maintenance_date", { mode: 'string' }),
	nextMaintenanceDate: timestamp("next_maintenance_date", { mode: 'string' }),
	notes: text(),
	photos: json().default([]),
	isActive: boolean("is_active").default(true).notNull(),
	createdBy: integer("created_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	acquisitionCurrency: text("acquisition_currency").default('AED').notNull(),
	currentValueCurrency: text("current_value_currency").default('AED').notNull(),
	rentalCurrency: text("rental_currency").default('AED').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.assetTypeId],
			foreignColumns: [assetTypes.id],
			name: "asset_inventory_instances_asset_type_id_fkey"
		}),
	foreignKey({
			columns: [table.assignedProjectId],
			foreignColumns: [projects.id],
			name: "asset_inventory_instances_assigned_project_id_fkey"
		}),
	foreignKey({
			columns: [table.assignedToId],
			foreignColumns: [employees.id],
			name: "asset_inventory_instances_assigned_to_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "asset_inventory_instances_created_by_fkey"
		}),
	unique("asset_inventory_instances_asset_tag_key").on(table.assetTag),
	unique("asset_inventory_instances_asset_tag_unique").on(table.assetTag),
	unique("asset_inventory_instances_serial_number_key").on(table.serialNumber),
	unique("asset_inventory_instances_serial_number_unique").on(table.serialNumber),
	unique("asset_inventory_instances_barcode_key").on(table.barcode),
	unique("asset_inventory_instances_barcode_unique").on(table.barcode),
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
	salary: numeric({ precision: 10, scale:  2 }),
	hireDate: timestamp("hire_date", { mode: 'string' }),
	isActive: boolean("is_active").default(true).notNull(),
	userId: integer("user_id"),
	category: text().default('permanent').notNull(),
	grade: text(),
	dateOfBirth: date("date_of_birth"),
	height: numeric({ precision: 5, scale:  2 }),
	weight: numeric({ precision: 5, scale:  2 }),
	address: text(),
	bankName: text("bank_name"),
	bankBranch: text("bank_branch"),
	accountNumber: text("account_number"),
	accountHolderName: text("account_holder_name"),
	ifscCode: text("ifsc_code"),
	swiftCode: text("swift_code"),
	usVisaStatus: text("us_visa_status"),
	usVisaExpiryDate: date("us_visa_expiry_date"),
	schengenVisaStatus: text("schengen_visa_status"),
	schengenVisaExpiryDate: date("schengen_visa_expiry_date"),
	boilerSuitSize: text("boiler_suit_size"),
	safetyShoeSize: text("safety_shoe_size"),
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

export const assetInventoryMaintenanceRecords = pgTable("asset_inventory_maintenance_records", {
	id: serial().primaryKey().notNull(),
	instanceId: integer("instance_id").notNull(),
	maintenanceCost: numeric("maintenance_cost", { precision: 10, scale:  2 }).notNull(),
	maintenanceDate: timestamp("maintenance_date", { mode: 'string' }).defaultNow().notNull(),
	description: text(),
	performedBy: integer("performed_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.instanceId],
			foreignColumns: [assetInventoryInstances.id],
			name: "asset_inventory_maintenance_records_instance_id_fkey"
		}),
	foreignKey({
			columns: [table.performedBy],
			foreignColumns: [users.id],
			name: "asset_inventory_maintenance_records_performed_by_fkey"
		}),
]);

export const chartOfAccounts = pgTable("chart_of_accounts", {
	id: serial().primaryKey().notNull(),
	accountCode: text("account_code").notNull(),
	accountName: text("account_name").notNull(),
	accountType: text("account_type").notNull(),
	accountCategory: text("account_category").notNull(),
	parentAccountId: integer("parent_account_id"),
	isActive: boolean("is_active").default(true),
	description: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	entityType: text("entity_type"),
	entityId: integer("entity_id"),
}, (table) => [
	index("idx_chart_of_accounts_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("idx_chart_of_accounts_category").using("btree", table.accountCategory.asc().nullsLast().op("text_ops")),
	index("idx_chart_of_accounts_code").using("btree", table.accountCode.asc().nullsLast().op("text_ops")),
	index("idx_chart_of_accounts_entity").using("btree", table.entityType.asc().nullsLast().op("int4_ops"), table.entityId.asc().nullsLast().op("int4_ops")),
	index("idx_chart_of_accounts_type").using("btree", table.accountType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.parentAccountId],
			foreignColumns: [table.id],
			name: "chart_of_accounts_parent_account_id_fkey"
		}),
	unique("chart_of_accounts_account_code_key").on(table.accountCode),
	check("chart_of_accounts_account_type_check", sql`account_type = ANY (ARRAY['asset'::text, 'liability'::text, 'equity'::text, 'revenue'::text, 'expense'::text])`),
	check("chart_of_accounts_entity_type_check", sql`entity_type = ANY (ARRAY['project'::text, 'customer'::text, 'supplier'::text])`),
]);

export const creditNoteItems = pgTable("credit_note_items", {
	id: serial().primaryKey().notNull(),
	creditNoteId: integer("credit_note_id").notNull(),
	description: text().notNull(),
	quantity: integer().notNull(),
	unitPrice: numeric("unit_price", { precision: 10, scale:  2 }).notNull(),
	taxRate: numeric("tax_rate", { precision: 5, scale:  2 }).default('0'),
	taxAmount: numeric("tax_amount", { precision: 10, scale:  2 }).default('0'),
	lineTotal: numeric("line_total", { precision: 10, scale:  2 }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.creditNoteId],
			foreignColumns: [creditNotes.id],
			name: "credit_note_items_credit_note_id_credit_notes_id_fk"
		}).onDelete("cascade"),
]);

export const salesInvoices = pgTable("sales_invoices", {
	id: serial().primaryKey().notNull(),
	customerId: integer("customer_id"),
	projectId: integer("project_id"),
	quotationId: integer("quotation_id"),
	status: text().default('unpaid').notNull(),
	invoiceDate: timestamp("invoice_date", { mode: 'string' }).notNull(),
	dueDate: timestamp("due_date", { mode: 'string' }).notNull(),
	items: json().default([]),
	subtotal: numeric({ precision: 12, scale:  2 }),
	taxAmount: numeric("tax_amount", { precision: 10, scale:  2 }),
	discount: numeric({ precision: 10, scale:  2 }).default('0'),
	totalAmount: numeric("total_amount", { precision: 12, scale:  2 }),
	paidAmount: numeric("paid_amount", { precision: 12, scale:  2 }).default('0'),
	invoiceNumber: varchar("invoice_number", { length: 20 }),
	proformaInvoiceId: integer("proforma_invoice_id"),
	paymentTerms: text("payment_terms"),
	bankAccount: text("bank_account"),
	remarks: text(),
	termsAndConditions: text("terms_and_conditions"),
	billingAddress: text("billing_address"),
	submittedById: integer("submitted_by_id"),
	submittedAt: timestamp("submitted_at", { mode: 'string' }),
	approvedById: integer("approved_by_id"),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
	rejectionReason: text("rejection_reason"),
	currency: text().default('AED').notNull(),
	exchangeRate: numeric("exchange_rate", { precision: 18, scale:  8 }).default('1').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.approvedById],
			foreignColumns: [users.id],
			name: "sales_invoices_approved_by_id_fkey"
		}),
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
	foreignKey({
			columns: [table.submittedById],
			foreignColumns: [users.id],
			name: "sales_invoices_submitted_by_id_fkey"
		}),
]);

export const customerDocuments = pgTable("customer_documents", {
	id: serial().primaryKey().notNull(),
	customerId: integer("customer_id").notNull(),
	documentType: text("document_type").notNull(),
	documentName: text("document_name").notNull(),
	documentNumber: text("document_number"),
	issuingAuthority: text("issuing_authority"),
	dateOfIssue: date("date_of_issue"),
	expiryDate: date("expiry_date"),
	filePath: text("file_path"),
	fileName: text("file_name"),
	fileSize: integer("file_size"),
	status: text().default('active').notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "customer_documents_customer_id_fkey"
		}).onDelete("cascade"),
]);

export const employeeNextOfKin = pgTable("employee_next_of_kin", {
	id: serial().primaryKey().notNull(),
	employeeId: integer("employee_id").notNull(),
	name: text().notNull(),
	email: text(),
	phone: text(),
	relationship: text().notNull(),
	isPrimary: boolean("is_primary").default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "employee_next_of_kin_employee_id_fkey"
		}).onDelete("cascade"),
]);

export const employeeTrainingRecords = pgTable("employee_training_records", {
	id: serial().primaryKey().notNull(),
	employeeId: integer("employee_id").notNull(),
	trainingName: text("training_name").notNull(),
	trainingProvider: text("training_provider").default('Aquanav').notNull(),
	certificationNumber: text("certification_number"),
	trainingDate: date("training_date").notNull(),
	expiryDate: date("expiry_date"),
	status: text().default('active').notNull(),
	notes: text(),
	attachments: json().default([]),
}, (table) => [
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "employee_training_records_employee_id_fkey"
		}).onDelete("cascade"),
]);

export const exchangeRates = pgTable("exchange_rates", {
	id: serial().primaryKey().notNull(),
	fromCurrency: text("from_currency").default('AED').notNull(),
	toCurrency: text("to_currency").notNull(),
	rate: numeric({ precision: 18, scale:  8 }).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	updatedById: integer("updated_by_id"),
}, (table) => [
	foreignKey({
			columns: [table.updatedById],
			foreignColumns: [users.id],
			name: "exchange_rates_updated_by_id_fkey"
		}),
]);

export const generalLedgerEntries = pgTable("general_ledger_entries", {
	id: serial().primaryKey().notNull(),
	entryType: text("entry_type").notNull(),
	referenceType: text("reference_type").notNull(),
	referenceId: integer("reference_id"),
	accountName: text("account_name").notNull(),
	description: text().notNull(),
	debitAmount: numeric("debit_amount", { precision: 12, scale:  2 }).default('0'),
	creditAmount: numeric("credit_amount", { precision: 12, scale:  2 }).default('0'),
	entityId: integer("entity_id"),
	entityName: text("entity_name"),
	invoiceNumber: text("invoice_number"),
	transactionDate: date("transaction_date").notNull(),
	dueDate: date("due_date"),
	status: text().default('pending'),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	createdBy: integer("created_by"),
	notes: text(),
	projectId: integer("project_id"),
	accountId: integer("account_id"),
}, (table) => [
	index("idx_general_ledger_account_id").using("btree", table.accountId.asc().nullsLast().op("int4_ops")),
	index("idx_general_ledger_entity").using("btree", table.entityId.asc().nullsLast().op("int4_ops")),
	index("idx_general_ledger_entry_type").using("btree", table.entryType.asc().nullsLast().op("text_ops")),
	index("idx_general_ledger_project_id").using("btree", table.projectId.asc().nullsLast().op("int4_ops")),
	index("idx_general_ledger_reference").using("btree", table.referenceType.asc().nullsLast().op("int4_ops"), table.referenceId.asc().nullsLast().op("int4_ops")),
	index("idx_general_ledger_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_general_ledger_transaction_date").using("btree", table.transactionDate.asc().nullsLast().op("date_ops")),
	foreignKey({
			columns: [table.accountId],
			foreignColumns: [chartOfAccounts.id],
			name: "general_ledger_entries_account_id_fkey"
		}),
	check("general_ledger_entries_entry_type_check", sql`entry_type = ANY (ARRAY['payable'::text, 'receivable'::text])`),
	check("general_ledger_entries_reference_type_check", sql`reference_type = ANY (ARRAY['sales_invoice'::text, 'purchase_invoice'::text, 'payment'::text, 'credit_note'::text, 'manual'::text, 'payroll_payment'::text])`),
	check("general_ledger_entries_status_check", sql`status = ANY (ARRAY['pending'::text, 'paid'::text, 'overdue'::text, 'cancelled'::text, 'active'::text, 'issued'::text])`),
]);

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
	createdBy: integer("created_by"),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "inventory_transactions_created_by_users_id_fk"
		}),
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

export const invoicePayments = pgTable("invoice_payments", {
	id: serial().primaryKey().notNull(),
	invoiceId: integer("invoice_id").notNull(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	paymentDate: timestamp("payment_date", { mode: 'string' }).notNull(),
	paymentMethod: text("payment_method"),
	referenceNumber: text("reference_number"),
	notes: text(),
	recordedBy: integer("recorded_by"),
	recordedAt: timestamp("recorded_at", { mode: 'string' }).defaultNow().notNull(),
	paymentType: text("payment_type").default('payment').notNull(),
	creditNoteId: integer("credit_note_id"),
}, (table) => [
	foreignKey({
			columns: [table.creditNoteId],
			foreignColumns: [creditNotes.id],
			name: "invoice_payments_credit_note_id_credit_notes_id_fk"
		}),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [salesInvoices.id],
			name: "invoice_payments_invoice_id_sales_invoices_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.recordedBy],
			foreignColumns: [users.id],
			name: "invoice_payments_recorded_by_users_id_fk"
		}),
]);

export const paymentFiles = pgTable("payment_files", {
	id: serial().primaryKey().notNull(),
	paymentId: integer("payment_id").notNull(),
	fileName: text("file_name").notNull(),
	originalName: text("original_name").notNull(),
	filePath: text("file_path").notNull(),
	fileSize: integer("file_size"),
	mimeType: text("mime_type"),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("payment_files_payment_id_idx").using("btree", table.paymentId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.paymentId],
			foreignColumns: [invoicePayments.id],
			name: "payment_files_payment_id_invoice_payments_id_fk"
		}).onDelete("cascade"),
]);

export const payrollEntries = pgTable("payroll_entries", {
	id: serial().primaryKey().notNull(),
	employeeId: integer("employee_id"),
	projectId: integer("project_id"),
	month: integer().notNull(),
	year: integer().notNull(),
	workingDays: integer("working_days").notNull(),
	basicSalary: numeric("basic_salary", { precision: 10, scale:  2 }),
	totalAmount: numeric("total_amount", { precision: 10, scale:  2 }),
	status: text().default('draft').notNull(),
	generatedDate: timestamp("generated_date", { mode: 'string' }).defaultNow().notNull(),
	totalAdditions: numeric("total_additions", { precision: 10, scale:  2 }).default('0'),
	totalDeductions: numeric("total_deductions", { precision: 10, scale:  2 }).default('0'),
	additions: json().default([]),
	deductions: json().default([]),
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

export const payrollAdditions = pgTable("payroll_additions", {
	id: serial().primaryKey().notNull(),
	payrollEntryId: integer("payroll_entry_id"),
	description: text().notNull(),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	note: text(),
}, (table) => [
	foreignKey({
			columns: [table.payrollEntryId],
			foreignColumns: [payrollEntries.id],
			name: "payroll_additions_payroll_entry_id_fkey"
		}).onDelete("cascade"),
]);

export const payrollDeductions = pgTable("payroll_deductions", {
	id: serial().primaryKey().notNull(),
	payrollEntryId: integer("payroll_entry_id").notNull(),
	description: text().notNull(),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	note: text(),
}, (table) => [
	foreignKey({
			columns: [table.payrollEntryId],
			foreignColumns: [payrollEntries.id],
			name: "payroll_deductions_payroll_entry_id_fkey"
		}).onDelete("cascade"),
]);

export const proformaInvoices = pgTable("proforma_invoices", {
	id: serial().primaryKey().notNull(),
	proformaNumber: text("proforma_number").notNull(),
	customerId: integer("customer_id"),
	projectId: integer("project_id"),
	quotationId: integer("quotation_id"),
	status: text().default('draft').notNull(),
	createdDate: timestamp("created_date", { mode: 'string' }).defaultNow().notNull(),
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
	invoiceDate: timestamp("invoice_date", { mode: 'string' }).defaultNow().notNull(),
	billingAddress: text("billing_address"),
	bankAccount: text("bank_account"),
	termsAndConditions: text("terms_and_conditions"),
	submittedById: integer("submitted_by_id"),
	submittedAt: timestamp("submitted_at", { mode: 'string' }),
	approvedById: integer("approved_by_id"),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
	rejectionReason: text("rejection_reason"),
	currency: text().default('AED').notNull(),
	exchangeRate: numeric("exchange_rate", { precision: 18, scale:  8 }).default('1').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.approvedById],
			foreignColumns: [users.id],
			name: "proforma_invoices_approved_by_id_fkey"
		}),
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
	foreignKey({
			columns: [table.submittedById],
			foreignColumns: [users.id],
			name: "proforma_invoices_submitted_by_id_fkey"
		}),
	unique("proforma_invoices_proforma_number_unique").on(table.proformaNumber),
]);

export const salesQuotations = pgTable("sales_quotations", {
	id: serial().primaryKey().notNull(),
	quotationNumber: text("quotation_number").notNull(),
	customerId: integer("customer_id"),
	status: text().default('draft').notNull(),
	validUntil: timestamp("valid_until", { mode: 'string' }),
	items: json().default([]),
	subtotal: numeric({ precision: 12, scale:  2 }),
	taxAmount: numeric("tax_amount", { precision: 10, scale:  2 }),
	discount: numeric({ precision: 10, scale:  2 }).default('0'),
	totalAmount: numeric("total_amount", { precision: 12, scale:  2 }),
	createdDate: timestamp("created_date", { mode: 'string' }).defaultNow().notNull(),
	isArchived: boolean("is_archived").default(false).notNull(),
	paymentTerms: text("payment_terms"),
	bankAccount: text("bank_account"),
	remarks: text(),
	termsAndConditions: text("terms_and_conditions"),
	billingAddress: text("billing_address"),
	submittedById: integer("submitted_by_id"),
	submittedAt: timestamp("submitted_at", { mode: 'string' }),
	approvedById: integer("approved_by_id"),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
	rejectionReason: text("rejection_reason"),
	currency: text().default('AED').notNull(),
	exchangeRate: numeric("exchange_rate", { precision: 18, scale:  8 }).default('1').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.approvedById],
			foreignColumns: [users.id],
			name: "sales_quotations_approved_by_id_fkey"
		}),
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "sales_quotations_customer_id_customers_id_fk"
		}),
	foreignKey({
			columns: [table.submittedById],
			foreignColumns: [users.id],
			name: "sales_quotations_submitted_by_id_fkey"
		}),
	unique("sales_quotations_quotation_number_unique").on(table.quotationNumber),
]);

export const projectAssetAssignments = pgTable("project_asset_assignments", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id"),
	assetId: integer("asset_id"),
	startDate: timestamp("start_date", { mode: 'string' }).notNull(),
	endDate: timestamp("end_date", { mode: 'string' }).notNull(),
	monthlyRate: numeric("monthly_rate", { precision: 10, scale:  2 }).notNull(),
	totalCost: numeric("total_cost", { precision: 12, scale:  2 }).notNull(),
	assignedAt: timestamp("assigned_at", { mode: 'string' }).defaultNow().notNull(),
	assignedBy: integer("assigned_by"),
}, (table) => [
	foreignKey({
			columns: [table.assetId],
			foreignColumns: [assetInventoryInstances.id],
			name: "project_asset_assignments_asset_id_fkey"
		}),
	foreignKey({
			columns: [table.assignedBy],
			foreignColumns: [users.id],
			name: "project_asset_assignments_assigned_by_fkey"
		}),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "project_asset_assignments_project_id_fkey"
		}),
]);

export const projectAssetInstanceAssignments = pgTable("project_asset_instance_assignments", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	assetTypeId: integer("asset_type_id").notNull(),
	instanceId: integer("instance_id").notNull(),
	barcode: varchar(),
	serialNumber: varchar("serial_number"),
	startDate: timestamp("start_date", { mode: 'string' }).notNull(),
	endDate: timestamp("end_date", { mode: 'string' }),
	monthlyRate: numeric("monthly_rate", { precision: 10, scale:  2 }).notNull(),
	currency: varchar().default('AED').notNull(),
	totalCost: numeric("total_cost", { precision: 10, scale:  2 }),
	status: varchar().default('active').notNull(),
	assignedBy: integer("assigned_by"),
	returnedAt: timestamp("returned_at", { mode: 'string' }),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	assignedAt: timestamp("assigned_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.assetTypeId],
			foreignColumns: [assetTypes.id],
			name: "project_asset_instance_assignments_asset_type_id_fkey"
		}),
	foreignKey({
			columns: [table.assignedBy],
			foreignColumns: [users.id],
			name: "project_asset_instance_assignments_assigned_by_fkey"
		}),
	foreignKey({
			columns: [table.instanceId],
			foreignColumns: [assetInventoryInstances.id],
			name: "project_asset_instance_assignments_instance_id_fkey"
		}),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "project_asset_instance_assignments_project_id_fkey"
		}),
]);

export const projectConsumables = pgTable("project_consumables", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id"),
	date: timestamp({ mode: 'string' }).notNull(),
	recordedBy: integer("recorded_by"),
	recordedAt: timestamp("recorded_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_project_consumables_date").using("btree", table.date.asc().nullsLast().op("timestamp_ops")),
	index("idx_project_consumables_project_id").using("btree", table.projectId.asc().nullsLast().op("int4_ops")),
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
	id: serial().primaryKey().notNull(),
	consumableId: integer("consumable_id"),
	inventoryItemId: integer("inventory_item_id"),
	quantity: integer().notNull(),
	unitCost: numeric("unit_cost", { precision: 10, scale:  4 }),
}, (table) => [
	index("idx_project_consumable_items_consumable_id").using("btree", table.consumableId.asc().nullsLast().op("int4_ops")),
	index("idx_project_consumable_items_inventory_item_id").using("btree", table.inventoryItemId.asc().nullsLast().op("int4_ops")),
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

export const projectEmployees = pgTable("project_employees", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id"),
	employeeId: integer("employee_id"),
	startDate: timestamp("start_date", { mode: 'string' }),
	endDate: timestamp("end_date", { mode: 'string' }),
	assignedAt: timestamp("assigned_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "project_employees_employee_id_employees_id_fk"
		}),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "project_employees_project_id_projects_id_fk"
		}),
]);

export const projectPhotoGroups = pgTable("project_photo_groups", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id"),
	title: text().notNull(),
	date: timestamp({ mode: 'string' }).notNull(),
	description: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	createdBy: integer("created_by"),
	dailyActivityId: integer("daily_activity_id"),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "project_photo_groups_created_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "project_photo_groups_project_id_projects_id_fk"
		}),
	foreignKey({
		columns: [table.dailyActivityId],
		foreignColumns: [dailyActivities.id],
		name: "project_photo_groups_daily_activity_id_daily_activities_id_fk"
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

export const purchaseInvoiceItems = pgTable("purchase_invoice_items", {
	id: serial().primaryKey().notNull(),
	invoiceId: integer("invoice_id"),
	inventoryItemId: integer("inventory_item_id"),
	quantity: integer().notNull(),
	unitPrice: numeric("unit_price", { precision: 10, scale:  4 }).notNull(),
	lineTotal: numeric("line_total", { precision: 12, scale:  2 }).notNull(),
	taxRate: numeric("tax_rate", { precision: 5, scale:  2 }).default('0'),
	taxAmount: numeric("tax_amount", { precision: 10, scale:  2 }).default('0'),
	itemType: text("item_type").default('product').notNull(),
	description: text(),
	projectId: integer("project_id"),
	assetInstanceId: integer("asset_instance_id"),
}, (table) => [
	index("purchase_invoice_items_invoice_id_idx").using("btree", table.invoiceId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.assetInstanceId],
			foreignColumns: [assetInventoryInstances.id],
			name: "purchase_invoice_items_asset_instance_id_fkey"
		}),
	foreignKey({
			columns: [table.inventoryItemId],
			foreignColumns: [inventoryItems.id],
			name: "purchase_invoice_items_inventory_item_id_inventory_items_id_fk"
		}),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [purchaseInvoices.id],
			name: "purchase_invoice_items_invoice_id_purchase_invoices_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "purchase_invoice_items_project_id_fkey"
		}),
]);

export const purchaseInvoicePayments = pgTable("purchase_invoice_payments", {
	id: serial().primaryKey().notNull(),
	invoiceId: integer("invoice_id").notNull(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	paymentDate: timestamp("payment_date", { mode: 'string' }).notNull(),
	paymentMethod: text("payment_method"),
	referenceNumber: text("reference_number"),
	notes: text(),
	recordedBy: integer("recorded_by"),
	recordedAt: timestamp("recorded_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("purchase_invoice_payments_invoice_id_idx").using("btree", table.invoiceId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [purchaseInvoices.id],
			name: "purchase_invoice_payments_invoice_id_purchase_invoices_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.recordedBy],
			foreignColumns: [users.id],
			name: "purchase_invoice_payments_recorded_by_users_id_fk"
		}),
]);

export const purchaseOrderItems = pgTable("purchase_order_items", {
	id: serial().primaryKey().notNull(),
	poId: integer("po_id"),
	inventoryItemId: integer("inventory_item_id"),
	quantity: integer().notNull(),
	unitPrice: numeric("unit_price", { precision: 10, scale:  4 }).notNull(),
	lineTotal: numeric("line_total", { precision: 12, scale:  2 }).notNull(),
	receivedQuantity: integer("received_quantity").default(0).notNull(),
	taxRate: numeric("tax_rate", { precision: 5, scale:  2 }).default('0'),
	taxAmount: numeric("tax_amount", { precision: 10, scale:  2 }).default('0'),
	itemType: text("item_type").default('product').notNull(),
	description: text(),
}, (table) => [
	foreignKey({
			columns: [table.inventoryItemId],
			foreignColumns: [inventoryItems.id],
			name: "purchase_order_items_inventory_item_id_inventory_items_id_fk"
		}),
	foreignKey({
			columns: [table.poId],
			foreignColumns: [purchaseOrders.id],
			name: "purchase_order_items_po_id_purchase_orders_id_fk"
		}).onDelete("cascade"),
]);

export const purchasePaymentFiles = pgTable("purchase_payment_files", {
	id: serial().primaryKey().notNull(),
	paymentId: integer("payment_id").notNull(),
	fileName: text("file_name").notNull(),
	originalName: text("original_name").notNull(),
	filePath: text("file_path").notNull(),
	fileSize: integer("file_size"),
	mimeType: text("mime_type"),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("purchase_payment_files_payment_id_idx").using("btree", table.paymentId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.paymentId],
			foreignColumns: [purchaseInvoicePayments.id],
			name: "purchase_payment_files_payment_id_purchase_invoice_payments_id_"
		}).onDelete("cascade"),
]);

export const purchaseRequestItems = pgTable("purchase_request_items", {
	id: serial().primaryKey().notNull(),
	requestId: integer("request_id"),
	inventoryItemId: integer("inventory_item_id"),
	quantity: integer().notNull(),
	notes: text(),
	itemType: text("item_type").default('product').notNull(),
	description: text(),
	unitPrice: numeric("unit_price", { precision: 10, scale:  2 }),
}, (table) => [
	foreignKey({
			columns: [table.inventoryItemId],
			foreignColumns: [inventoryItems.id],
			name: "purchase_request_items_inventory_item_id_inventory_items_id_fk"
		}),
	foreignKey({
			columns: [table.requestId],
			foreignColumns: [purchaseRequests.id],
			name: "purchase_request_items_request_id_purchase_requests_id_fk"
		}).onDelete("cascade"),
]);

export const purchaseRequests = pgTable("purchase_requests", {
	id: serial().primaryKey().notNull(),
	requestNumber: text("request_number").notNull(),
	requestedBy: integer("requested_by"),
	status: text().default('pending').notNull(),
	urgency: text().default('normal').notNull(),
	reason: text(),
	requestDate: timestamp("request_date", { mode: 'string' }).defaultNow().notNull(),
	approvedBy: integer("approved_by"),
	approvalDate: timestamp("approval_date", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.approvedBy],
			foreignColumns: [employees.id],
			name: "purchase_requests_approved_by_employees_id_fk"
		}),
	foreignKey({
			columns: [table.requestedBy],
			foreignColumns: [employees.id],
			name: "purchase_requests_requested_by_employees_id_fk"
		}),
	unique("purchase_requests_request_number_unique").on(table.requestNumber),
]);

export const reimbursements = pgTable("reimbursements", {
	id: serial().primaryKey().notNull(),
	employeeId: integer("employee_id").notNull(),
	userId: integer("user_id").notNull(),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	description: text().notNull(),
	originalExpenseDate: date("original_expense_date").notNull(),
	submissionTimestamp: timestamp("submission_timestamp", { mode: 'string' }).defaultNow().notNull(),
	status: text().default('pending').notNull(),
	approvedById: integer("approved_by_id"),
	approvalTimestamp: timestamp("approval_timestamp", { mode: 'string' }),
	rejectionReason: text("rejection_reason"),
	payrollMonth: integer("payroll_month"),
	payrollYear: integer("payroll_year"),
	projectId: integer("project_id"),
	attachments: text().array(),
}, (table) => [
	foreignKey({
			columns: [table.approvedById],
			foreignColumns: [users.id],
			name: "reimbursements_approved_by_id_fkey"
		}),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "reimbursements_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "reimbursements_project_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "reimbursements_user_id_fkey"
		}),
]);

export const salesInvoiceItems = pgTable("sales_invoice_items", {
	id: serial().primaryKey().notNull(),
	invoiceId: integer("invoice_id").notNull(),
	description: text().notNull(),
	quantity: integer().notNull(),
	unitPrice: numeric("unit_price", { precision: 10, scale:  2 }).notNull(),
	taxRate: numeric("tax_rate", { precision: 5, scale:  2 }).default('0'),
	taxAmount: numeric("tax_amount", { precision: 10, scale:  2 }).default('0'),
	lineTotal: numeric("line_total", { precision: 10, scale:  2 }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [salesInvoices.id],
			name: "sales_invoice_items_invoice_id_sales_invoices_id_fk"
		}).onDelete("cascade"),
]);

export const salesQuotationItems = pgTable("sales_quotation_items", {
	id: serial().primaryKey().notNull(),
	quotationId: integer("quotation_id").notNull(),
	description: text().notNull(),
	quantity: integer().notNull(),
	unitPrice: numeric("unit_price", { precision: 10, scale:  2 }).notNull(),
	taxRate: numeric("tax_rate", { precision: 5, scale:  2 }).default('0'),
	taxAmount: numeric("tax_amount", { precision: 10, scale:  2 }).default('0'),
	lineTotal: numeric("line_total", { precision: 10, scale:  2 }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.quotationId],
			foreignColumns: [salesQuotations.id],
			name: "sales_quotation_items_quotation_id_sales_quotations_id_fk"
		}).onDelete("cascade"),
]);

export const supplierDocuments = pgTable("supplier_documents", {
	id: serial().primaryKey().notNull(),
	supplierId: integer("supplier_id").notNull(),
	documentType: text("document_type").notNull(),
	documentName: text("document_name").notNull(),
	documentNumber: text("document_number"),
	issuingAuthority: text("issuing_authority"),
	dateOfIssue: date("date_of_issue"),
	expiryDate: date("expiry_date"),
	filePath: text("file_path"),
	fileName: text("file_name"),
	fileSize: integer("file_size"),
	status: text().default('active').notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.supplierId],
			foreignColumns: [suppliers.id],
			name: "supplier_documents_supplier_id_fkey"
		}).onDelete("cascade"),
]);

export const supplierInventoryItems = pgTable("supplier_inventory_items", {
	id: serial().primaryKey().notNull(),
	supplierId: integer("supplier_id"),
	inventoryItemId: integer("inventory_item_id"),
	supplierPartNumber: text("supplier_part_number"),
	unitCost: numeric("unit_cost", { precision: 10, scale:  4 }),
	minimumOrderQuantity: integer("minimum_order_quantity").default(1),
	leadTimeDays: integer("lead_time_days"),
	isPreferred: boolean("is_preferred").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.inventoryItemId],
			foreignColumns: [inventoryItems.id],
			name: "supplier_inventory_items_inventory_item_id_inventory_items_id_f"
		}),
	foreignKey({
			columns: [table.supplierId],
			foreignColumns: [suppliers.id],
			name: "supplier_inventory_items_supplier_id_suppliers_id_fk"
		}),
]);

export const customers = pgTable("customers", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	contactPerson: text("contact_person"),
	email: text(),
	phone: text(),
	address: text(),
	taxId: text("tax_id"),
	userId: integer("user_id"),
	isArchived: boolean("is_archived").default(false).notNull(),
	vatNumber: text("vat_number"),
	vatRegistrationStatus: text("vat_registration_status").default('not_registered').notNull(),
	vatTreatment: text("vat_treatment").default('standard').notNull(),
	customerType: text("customer_type").default('business').notNull(),
	taxCategory: text("tax_category").default('standard').notNull(),
	paymentTerms: text("payment_terms").default('30_days'),
	currency: text().default('AED').notNull(),
	creditLimit: numeric("credit_limit", { precision: 12, scale:  2 }),
	isVatApplicable: boolean("is_vat_applicable").default(true).notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	bankAccount: text("bank_account"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "customers_user_id_users_id_fk"
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
	isArchived: boolean("is_archived").default(false).notNull(),
	vatNumber: text("vat_number"),
	vatRegistrationStatus: text("vat_registration_status").default('not_registered').notNull(),
	vatTreatment: text("vat_treatment").default('standard').notNull(),
	supplierType: text("supplier_type").default('business').notNull(),
	taxCategory: text("tax_category").default('standard').notNull(),
	paymentTerms: text("payment_terms").default('30_days'),
	currency: text().default('AED').notNull(),
	creditLimit: numeric("credit_limit", { precision: 12, scale:  2 }),
	isVatApplicable: boolean("is_vat_applicable").default(true).notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	bankAccount: text("bank_account"),
});

export const creditNotes = pgTable("credit_notes", {
	id: serial().primaryKey().notNull(),
	creditNoteNumber: text("credit_note_number").notNull(),
	salesInvoiceId: integer("sales_invoice_id"),
	customerId: integer("customer_id"),
	reason: text().notNull(),
	creditType: text("credit_type").default('partial').notNull(),
	items: json().default([]),
	subtotal: numeric({ precision: 12, scale:  2 }),
	taxAmount: numeric("tax_amount", { precision: 10, scale:  2 }),
	discount: numeric({ precision: 10, scale:  2 }).default('0'),
	totalAmount: numeric("total_amount", { precision: 12, scale:  2 }),
	status: text().default('pending').notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	createdBy: integer("created_by"),
	creditNoteDate: timestamp("credit_note_date", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	billingAddress: text("billing_address"),
	submittedById: integer("submitted_by_id"),
	submittedAt: timestamp("submitted_at", { mode: 'string' }),
	approvedById: integer("approved_by_id"),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
	rejectionReason: text("rejection_reason"),
	currency: text().default('AED').notNull(),
	exchangeRate: numeric("exchange_rate", { precision: 18, scale:  8 }).default('1').notNull(),
	bankAccount: text("bank_account"),
}, (table) => [
	foreignKey({
			columns: [table.approvedById],
			foreignColumns: [users.id],
			name: "credit_notes_approved_by_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "credit_notes_created_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "credit_notes_customer_id_customers_id_fk"
		}),
	foreignKey({
			columns: [table.salesInvoiceId],
			foreignColumns: [salesInvoices.id],
			name: "credit_notes_sales_invoice_id_sales_invoices_id_fk"
		}),
	foreignKey({
			columns: [table.submittedById],
			foreignColumns: [users.id],
			name: "credit_notes_submitted_by_id_fkey"
		}),
	unique("credit_notes_credit_note_number_unique").on(table.creditNoteNumber),
]);

export const purchaseOrders = pgTable("purchase_orders", {
	id: serial().primaryKey().notNull(),
	poNumber: text("po_number").notNull(),
	supplierId: integer("supplier_id"),
	status: text().default('draft').notNull(),
	orderDate: timestamp("order_date", { mode: 'string' }).defaultNow().notNull(),
	expectedDeliveryDate: timestamp("expected_delivery_date", { mode: 'string' }),
	subtotal: numeric({ precision: 12, scale:  2 }),
	taxAmount: numeric("tax_amount", { precision: 10, scale:  2 }).default('0'),
	totalAmount: numeric("total_amount", { precision: 12, scale:  2 }),
	notes: text(),
	createdBy: integer("created_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	bankAccount: text("bank_account"),
	paymentTerms: text("payment_terms"),
	deliveryTerms: text("delivery_terms"),
	submittedById: integer("submitted_by_id"),
	submittedAt: timestamp("submitted_at", { mode: 'string' }),
	approvedById: integer("approved_by_id"),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
	rejectionReason: text("rejection_reason"),
	convertedInvoiceId: integer("converted_invoice_id"),
	discountPercentage: numeric("discount_percentage", { precision: 5, scale:  2 }).default('0'),
	discountAmount: numeric("discount_amount", { precision: 12, scale:  2 }).default('0'),
	currency: text().default('AED').notNull(),
	exchangeRate: numeric("exchange_rate", { precision: 18, scale:  8 }).default('1').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.approvedById],
			foreignColumns: [users.id],
			name: "purchase_orders_approved_by_id_fkey"
		}),
	foreignKey({
			columns: [table.convertedInvoiceId],
			foreignColumns: [purchaseInvoices.id],
			name: "purchase_orders_converted_invoice_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "purchase_orders_created_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.submittedById],
			foreignColumns: [users.id],
			name: "purchase_orders_submitted_by_id_fkey"
		}),
	foreignKey({
			columns: [table.supplierId],
			foreignColumns: [suppliers.id],
			name: "purchase_orders_supplier_id_suppliers_id_fk"
		}),
	unique("purchase_orders_po_number_unique").on(table.poNumber),
]);

export const purchaseInvoices = pgTable("purchase_invoices", {
	id: serial().primaryKey().notNull(),
	invoiceNumber: text("invoice_number").notNull(),
	poId: integer("po_id"),
	supplierId: integer("supplier_id"),
	invoiceDate: timestamp("invoice_date", { mode: 'string' }).notNull(),
	dueDate: timestamp("due_date", { mode: 'string' }),
	subtotal: numeric({ precision: 12, scale:  2 }),
	taxAmount: numeric("tax_amount", { precision: 10, scale:  2 }).default('0'),
	totalAmount: numeric("total_amount", { precision: 12, scale:  2 }),
	status: text().default('pending').notNull(),
	receivedDate: timestamp("received_date", { mode: 'string' }),
	createdBy: integer("created_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	paidAmount: numeric("paid_amount", { precision: 12, scale:  2 }).default('0'),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
	paymentTerms: text("payment_terms"),
	notes: text(),
	bankAccount: text("bank_account"),
	submittedById: integer("submitted_by_id"),
	submittedAt: timestamp("submitted_at", { mode: 'string' }),
	rejectionReason: text("rejection_reason"),
	paymentStatus: text("payment_status").default('pending').notNull(),
	approvedById: integer("approved_by_id"),
	discountPercentage: numeric("discount_percentage", { precision: 5, scale:  2 }).default('0'),
	discountAmount: numeric("discount_amount", { precision: 12, scale:  2 }).default('0'),
	projectId: integer("project_id"),
	assetInventoryInstanceId: integer("asset_inventory_instance_id"),
	currency: text().default('AED').notNull(),
	exchangeRate: numeric("exchange_rate", { precision: 18, scale:  8 }).default('1').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.approvedById],
			foreignColumns: [users.id],
			name: "purchase_invoices_approved_by_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "purchase_invoices_created_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.poId],
			foreignColumns: [purchaseOrders.id],
			name: "purchase_invoices_po_id_purchase_orders_id_fk"
		}),
	foreignKey({
			columns: [table.submittedById],
			foreignColumns: [users.id],
			name: "purchase_invoices_submitted_by_id_fkey"
		}),
	foreignKey({
			columns: [table.supplierId],
			foreignColumns: [suppliers.id],
			name: "purchase_invoices_supplier_id_suppliers_id_fk"
		}),
	unique("purchase_invoices_invoice_number_unique").on(table.invoiceNumber),
]);

export const projects = pgTable("projects", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	description: text(),
	vesselName: text("vessel_name"),
	vesselImage: text("vessel_image"),
	startDate: timestamp("start_date", { mode: 'string' }),
	plannedEndDate: timestamp("planned_end_date", { mode: 'string' }),
	actualEndDate: timestamp("actual_end_date", { mode: 'string' }),
	status: text().default('not_started').notNull(),
	estimatedBudget: numeric("estimated_budget", { precision: 12, scale:  2 }),
	actualCost: numeric("actual_cost", { precision: 12, scale:  2 }).default('0'),
	customerId: integer("customer_id"),
	locations: json().default([]),
	vesselImoNumber: text("vessel_imo_number"),
	totalRevenue: numeric("total_revenue", { precision: 12, scale:  2 }).default('0'),
	ridgingCrewNos: text("ridging_crew_nos"),
	modeOfContract: text("mode_of_contract"),
	workingHours: text("working_hours"),
	ppe: text(),
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
	workRemainingDays: jsonb("work_remaining_days").default([]),
}, (table) => [
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "projects_customer_id_customers_id_fk"
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
	sku: text(),
});

export const dailyActivities = pgTable("daily_activities", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id"),
	date: timestamp({ mode: 'string' }).notNull(),
	location: text(),
	completedTasks: text("completed_tasks"),
	plannedTasks: text("planned_tasks"),
	remarks: text(),
	photos: json().default([]),
	hbmDailyRunningHours: text("hbm_daily_running_hours"),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "daily_activities_project_id_projects_id_fk"
		}),
]);

export const supplierBankDetails = pgTable("supplier_bank_details", {
	id: serial().primaryKey().notNull(),
	supplierId: integer("supplier_id").notNull(),
	accountDetails: text("account_details"),
});

export const employeeDocuments = pgTable("employee_documents", {
	id: serial().primaryKey().notNull(),
	employeeId: integer("employee_id").notNull(),
	documentType: text("document_type"),
	documentNumber: text("document_number"),
	placeOfIssue: text("place_of_issue"),
	issuedBy: text("issued_by"),
	dateOfIssue: text("date_of_issue"),
	expiryDate: text("expiry_date"),
	validTill: text("valid_till"),
	status: text(),
	notes: text(),
	attachmentPaths: jsonb("attachment_paths"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const assetMaintenanceFiles = pgTable("asset_maintenance_files", {
	id: serial().primaryKey().notNull(),
	maintenanceRecordId: integer("maintenance_record_id").notNull(),
	fileName: text("file_name"),
	filePath: text("file_path"),
	fileSize: integer("file_size"),
	contentType: text("content_type"),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow(),
});

export const purchaseOrderFiles = pgTable("purchase_order_files", {
	id: serial().primaryKey().notNull(),
	poId: integer("po_id").notNull(),
	fileName: text("file_name"),
	originalName: text("original_name"),
	filePath: text("file_path"),
	fileSize: integer("file_size"),
	mimeType: text("mime_type"),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow(),
});

export const purchaseCreditNotes = pgTable("purchase_credit_notes", {
	id: serial().primaryKey().notNull(),
	creditNoteNumber: text("credit_note_number").notNull(),
	purchaseInvoiceId: integer("purchase_invoice_id"),
	supplierId: integer("supplier_id"),
	status: text().default('draft'),
	creditNoteDate: timestamp("credit_note_date", { mode: 'string' }),
	reason: text(),
	items: jsonb(),
	subtotal: text(),
	taxAmount: text("tax_amount"),
	discount: text(),
	totalAmount: text("total_amount"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("purchase_credit_notes_credit_note_number_key").on(table.creditNoteNumber),
]);

export const employeeFeedback = pgTable("employee_feedback", {
	id: serial().primaryKey().notNull(),
	employeeId: integer("employee_id").notNull(),
	projectId: integer("project_id"),
	feedback: text().notNull(),
	createdById: integer("created_by_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [users.id],
			name: "employee_feedback_created_by_id_fkey"
		}),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "employee_feedback_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "employee_feedback_project_id_fkey"
		}),
]);
