import { relations } from "drizzle-orm/relations";
import { assetTypes, assetInventoryInstances, projects, employees, users, assetInventoryMaintenanceRecords, chartOfAccounts, creditNotes, creditNoteItems, salesInvoices, customers, salesQuotations, customerDocuments, employeeNextOfKin, employeeTrainingRecords, exchangeRates, generalLedgerEntries, inventoryTransactions, inventoryItems, invoicePayments, paymentFiles, payrollEntries, payrollAdditions, payrollDeductions, proformaInvoices, projectAssetAssignments, projectAssetInstanceAssignments, projectConsumables, projectConsumableItems, projectEmployees, projectPhotoGroups, projectPhotos, purchaseInvoiceItems, purchaseInvoices, purchaseInvoicePayments, purchaseOrderItems, purchaseOrders, purchasePaymentFiles, purchaseRequestItems, purchaseRequests, reimbursements, salesInvoiceItems, salesQuotationItems, suppliers, supplierDocuments, supplierInventoryItems, dailyActivities, employeeFeedback } from "./schema";

export const assetInventoryInstancesRelations = relations(assetInventoryInstances, ({one, many}) => ({
	assetType: one(assetTypes, {
		fields: [assetInventoryInstances.assetTypeId],
		references: [assetTypes.id]
	}),
	project: one(projects, {
		fields: [assetInventoryInstances.assignedProjectId],
		references: [projects.id]
	}),
	employee: one(employees, {
		fields: [assetInventoryInstances.assignedToId],
		references: [employees.id]
	}),
	user: one(users, {
		fields: [assetInventoryInstances.createdBy],
		references: [users.id]
	}),
	assetInventoryMaintenanceRecords: many(assetInventoryMaintenanceRecords),
	projectAssetAssignments: many(projectAssetAssignments),
	projectAssetInstanceAssignments: many(projectAssetInstanceAssignments),
	purchaseInvoiceItems: many(purchaseInvoiceItems),
}));

export const assetTypesRelations = relations(assetTypes, ({many}) => ({
	assetInventoryInstances: many(assetInventoryInstances),
	projectAssetInstanceAssignments: many(projectAssetInstanceAssignments),
}));

export const projectsRelations = relations(projects, ({one, many}) => ({
	assetInventoryInstances: many(assetInventoryInstances),
	salesInvoices: many(salesInvoices),
	inventoryTransactions: many(inventoryTransactions),
	payrollEntries: many(payrollEntries),
	proformaInvoices: many(proformaInvoices),
	projectAssetAssignments: many(projectAssetAssignments),
	projectAssetInstanceAssignments: many(projectAssetInstanceAssignments),
	projectConsumables: many(projectConsumables),
	projectEmployees: many(projectEmployees),
	projectPhotoGroups: many(projectPhotoGroups),
	purchaseInvoiceItems: many(purchaseInvoiceItems),
	reimbursements: many(reimbursements),
	customer: one(customers, {
		fields: [projects.customerId],
		references: [customers.id]
	}),
	dailyActivities: many(dailyActivities),
	employeeFeedbacks: many(employeeFeedback),
}));

export const employeesRelations = relations(employees, ({one, many}) => ({
	assetInventoryInstances: many(assetInventoryInstances),
	user: one(users, {
		fields: [employees.userId],
		references: [users.id]
	}),
	employeeNextOfKins: many(employeeNextOfKin),
	employeeTrainingRecords: many(employeeTrainingRecords),
	payrollEntries: many(payrollEntries),
	projectEmployees: many(projectEmployees),
	purchaseRequests_approvedBy: many(purchaseRequests, {
		relationName: "purchaseRequests_approvedBy_employees_id"
	}),
	purchaseRequests_requestedBy: many(purchaseRequests, {
		relationName: "purchaseRequests_requestedBy_employees_id"
	}),
	reimbursements: many(reimbursements),
	employeeFeedbacks: many(employeeFeedback),
}));

export const usersRelations = relations(users, ({many}) => ({
	assetInventoryInstances: many(assetInventoryInstances),
	employees: many(employees),
	assetInventoryMaintenanceRecords: many(assetInventoryMaintenanceRecords),
	salesInvoices_approvedById: many(salesInvoices, {
		relationName: "salesInvoices_approvedById_users_id"
	}),
	salesInvoices_submittedById: many(salesInvoices, {
		relationName: "salesInvoices_submittedById_users_id"
	}),
	exchangeRates: many(exchangeRates),
	inventoryTransactions: many(inventoryTransactions),
	invoicePayments: many(invoicePayments),
	proformaInvoices_approvedById: many(proformaInvoices, {
		relationName: "proformaInvoices_approvedById_users_id"
	}),
	proformaInvoices_submittedById: many(proformaInvoices, {
		relationName: "proformaInvoices_submittedById_users_id"
	}),
	salesQuotations_approvedById: many(salesQuotations, {
		relationName: "salesQuotations_approvedById_users_id"
	}),
	salesQuotations_submittedById: many(salesQuotations, {
		relationName: "salesQuotations_submittedById_users_id"
	}),
	projectAssetAssignments: many(projectAssetAssignments),
	projectAssetInstanceAssignments: many(projectAssetInstanceAssignments),
	projectConsumables: many(projectConsumables),
	projectPhotoGroups: many(projectPhotoGroups),
	purchaseInvoicePayments: many(purchaseInvoicePayments),
	reimbursements_approvedById: many(reimbursements, {
		relationName: "reimbursements_approvedById_users_id"
	}),
	reimbursements_userId: many(reimbursements, {
		relationName: "reimbursements_userId_users_id"
	}),
	customers: many(customers),
	creditNotes_approvedById: many(creditNotes, {
		relationName: "creditNotes_approvedById_users_id"
	}),
	creditNotes_createdBy: many(creditNotes, {
		relationName: "creditNotes_createdBy_users_id"
	}),
	creditNotes_submittedById: many(creditNotes, {
		relationName: "creditNotes_submittedById_users_id"
	}),
	purchaseOrders_approvedById: many(purchaseOrders, {
		relationName: "purchaseOrders_approvedById_users_id"
	}),
	purchaseOrders_createdBy: many(purchaseOrders, {
		relationName: "purchaseOrders_createdBy_users_id"
	}),
	purchaseOrders_submittedById: many(purchaseOrders, {
		relationName: "purchaseOrders_submittedById_users_id"
	}),
	purchaseInvoices_approvedById: many(purchaseInvoices, {
		relationName: "purchaseInvoices_approvedById_users_id"
	}),
	purchaseInvoices_createdBy: many(purchaseInvoices, {
		relationName: "purchaseInvoices_createdBy_users_id"
	}),
	purchaseInvoices_submittedById: many(purchaseInvoices, {
		relationName: "purchaseInvoices_submittedById_users_id"
	}),
	employeeFeedbacks: many(employeeFeedback),
}));

export const assetInventoryMaintenanceRecordsRelations = relations(assetInventoryMaintenanceRecords, ({one}) => ({
	assetInventoryInstance: one(assetInventoryInstances, {
		fields: [assetInventoryMaintenanceRecords.instanceId],
		references: [assetInventoryInstances.id]
	}),
	user: one(users, {
		fields: [assetInventoryMaintenanceRecords.performedBy],
		references: [users.id]
	}),
}));

export const chartOfAccountsRelations = relations(chartOfAccounts, ({one, many}) => ({
	chartOfAccount: one(chartOfAccounts, {
		fields: [chartOfAccounts.parentAccountId],
		references: [chartOfAccounts.id],
		relationName: "chartOfAccounts_parentAccountId_chartOfAccounts_id"
	}),
	chartOfAccounts: many(chartOfAccounts, {
		relationName: "chartOfAccounts_parentAccountId_chartOfAccounts_id"
	}),
	generalLedgerEntries: many(generalLedgerEntries),
}));

export const creditNoteItemsRelations = relations(creditNoteItems, ({one}) => ({
	creditNote: one(creditNotes, {
		fields: [creditNoteItems.creditNoteId],
		references: [creditNotes.id]
	}),
}));

export const creditNotesRelations = relations(creditNotes, ({one, many}) => ({
	creditNoteItems: many(creditNoteItems),
	invoicePayments: many(invoicePayments),
	user_approvedById: one(users, {
		fields: [creditNotes.approvedById],
		references: [users.id],
		relationName: "creditNotes_approvedById_users_id"
	}),
	user_createdBy: one(users, {
		fields: [creditNotes.createdBy],
		references: [users.id],
		relationName: "creditNotes_createdBy_users_id"
	}),
	customer: one(customers, {
		fields: [creditNotes.customerId],
		references: [customers.id]
	}),
	salesInvoice: one(salesInvoices, {
		fields: [creditNotes.salesInvoiceId],
		references: [salesInvoices.id]
	}),
	user_submittedById: one(users, {
		fields: [creditNotes.submittedById],
		references: [users.id],
		relationName: "creditNotes_submittedById_users_id"
	}),
}));

export const salesInvoicesRelations = relations(salesInvoices, ({one, many}) => ({
	user_approvedById: one(users, {
		fields: [salesInvoices.approvedById],
		references: [users.id],
		relationName: "salesInvoices_approvedById_users_id"
	}),
	customer: one(customers, {
		fields: [salesInvoices.customerId],
		references: [customers.id]
	}),
	project: one(projects, {
		fields: [salesInvoices.projectId],
		references: [projects.id]
	}),
	salesQuotation: one(salesQuotations, {
		fields: [salesInvoices.quotationId],
		references: [salesQuotations.id]
	}),
	user_submittedById: one(users, {
		fields: [salesInvoices.submittedById],
		references: [users.id],
		relationName: "salesInvoices_submittedById_users_id"
	}),
	invoicePayments: many(invoicePayments),
	salesInvoiceItems: many(salesInvoiceItems),
	creditNotes: many(creditNotes),
}));

export const customersRelations = relations(customers, ({one, many}) => ({
	salesInvoices: many(salesInvoices),
	customerDocuments: many(customerDocuments),
	proformaInvoices: many(proformaInvoices),
	salesQuotations: many(salesQuotations),
	user: one(users, {
		fields: [customers.userId],
		references: [users.id]
	}),
	creditNotes: many(creditNotes),
	projects: many(projects),
}));

export const salesQuotationsRelations = relations(salesQuotations, ({one, many}) => ({
	salesInvoices: many(salesInvoices),
	proformaInvoices: many(proformaInvoices),
	user_approvedById: one(users, {
		fields: [salesQuotations.approvedById],
		references: [users.id],
		relationName: "salesQuotations_approvedById_users_id"
	}),
	customer: one(customers, {
		fields: [salesQuotations.customerId],
		references: [customers.id]
	}),
	user_submittedById: one(users, {
		fields: [salesQuotations.submittedById],
		references: [users.id],
		relationName: "salesQuotations_submittedById_users_id"
	}),
	salesQuotationItems: many(salesQuotationItems),
}));

export const customerDocumentsRelations = relations(customerDocuments, ({one}) => ({
	customer: one(customers, {
		fields: [customerDocuments.customerId],
		references: [customers.id]
	}),
}));

export const employeeNextOfKinRelations = relations(employeeNextOfKin, ({one}) => ({
	employee: one(employees, {
		fields: [employeeNextOfKin.employeeId],
		references: [employees.id]
	}),
}));

export const employeeTrainingRecordsRelations = relations(employeeTrainingRecords, ({one}) => ({
	employee: one(employees, {
		fields: [employeeTrainingRecords.employeeId],
		references: [employees.id]
	}),
}));

export const exchangeRatesRelations = relations(exchangeRates, ({one}) => ({
	user: one(users, {
		fields: [exchangeRates.updatedById],
		references: [users.id]
	}),
}));

export const generalLedgerEntriesRelations = relations(generalLedgerEntries, ({one}) => ({
	chartOfAccount: one(chartOfAccounts, {
		fields: [generalLedgerEntries.accountId],
		references: [chartOfAccounts.id]
	}),
}));

export const inventoryTransactionsRelations = relations(inventoryTransactions, ({one}) => ({
	user: one(users, {
		fields: [inventoryTransactions.createdBy],
		references: [users.id]
	}),
	inventoryItem: one(inventoryItems, {
		fields: [inventoryTransactions.itemId],
		references: [inventoryItems.id]
	}),
	project: one(projects, {
		fields: [inventoryTransactions.projectId],
		references: [projects.id]
	}),
}));

export const inventoryItemsRelations = relations(inventoryItems, ({many}) => ({
	inventoryTransactions: many(inventoryTransactions),
	projectConsumableItems: many(projectConsumableItems),
	purchaseInvoiceItems: many(purchaseInvoiceItems),
	purchaseOrderItems: many(purchaseOrderItems),
	purchaseRequestItems: many(purchaseRequestItems),
	supplierInventoryItems: many(supplierInventoryItems),
}));

export const invoicePaymentsRelations = relations(invoicePayments, ({one, many}) => ({
	creditNote: one(creditNotes, {
		fields: [invoicePayments.creditNoteId],
		references: [creditNotes.id]
	}),
	salesInvoice: one(salesInvoices, {
		fields: [invoicePayments.invoiceId],
		references: [salesInvoices.id]
	}),
	user: one(users, {
		fields: [invoicePayments.recordedBy],
		references: [users.id]
	}),
	paymentFiles: many(paymentFiles),
}));

export const paymentFilesRelations = relations(paymentFiles, ({one}) => ({
	invoicePayment: one(invoicePayments, {
		fields: [paymentFiles.paymentId],
		references: [invoicePayments.id]
	}),
}));

export const payrollEntriesRelations = relations(payrollEntries, ({one, many}) => ({
	employee: one(employees, {
		fields: [payrollEntries.employeeId],
		references: [employees.id]
	}),
	project: one(projects, {
		fields: [payrollEntries.projectId],
		references: [projects.id]
	}),
	payrollAdditions: many(payrollAdditions),
	payrollDeductions: many(payrollDeductions),
}));

export const payrollAdditionsRelations = relations(payrollAdditions, ({one}) => ({
	payrollEntry: one(payrollEntries, {
		fields: [payrollAdditions.payrollEntryId],
		references: [payrollEntries.id]
	}),
}));

export const payrollDeductionsRelations = relations(payrollDeductions, ({one}) => ({
	payrollEntry: one(payrollEntries, {
		fields: [payrollDeductions.payrollEntryId],
		references: [payrollEntries.id]
	}),
}));

export const proformaInvoicesRelations = relations(proformaInvoices, ({one}) => ({
	user_approvedById: one(users, {
		fields: [proformaInvoices.approvedById],
		references: [users.id],
		relationName: "proformaInvoices_approvedById_users_id"
	}),
	customer: one(customers, {
		fields: [proformaInvoices.customerId],
		references: [customers.id]
	}),
	project: one(projects, {
		fields: [proformaInvoices.projectId],
		references: [projects.id]
	}),
	salesQuotation: one(salesQuotations, {
		fields: [proformaInvoices.quotationId],
		references: [salesQuotations.id]
	}),
	user_submittedById: one(users, {
		fields: [proformaInvoices.submittedById],
		references: [users.id],
		relationName: "proformaInvoices_submittedById_users_id"
	}),
}));

export const projectAssetAssignmentsRelations = relations(projectAssetAssignments, ({one}) => ({
	assetInventoryInstance: one(assetInventoryInstances, {
		fields: [projectAssetAssignments.assetId],
		references: [assetInventoryInstances.id]
	}),
	user: one(users, {
		fields: [projectAssetAssignments.assignedBy],
		references: [users.id]
	}),
	project: one(projects, {
		fields: [projectAssetAssignments.projectId],
		references: [projects.id]
	}),
}));

export const projectAssetInstanceAssignmentsRelations = relations(projectAssetInstanceAssignments, ({one}) => ({
	assetType: one(assetTypes, {
		fields: [projectAssetInstanceAssignments.assetTypeId],
		references: [assetTypes.id]
	}),
	user: one(users, {
		fields: [projectAssetInstanceAssignments.assignedBy],
		references: [users.id]
	}),
	assetInventoryInstance: one(assetInventoryInstances, {
		fields: [projectAssetInstanceAssignments.instanceId],
		references: [assetInventoryInstances.id]
	}),
	project: one(projects, {
		fields: [projectAssetInstanceAssignments.projectId],
		references: [projects.id]
	}),
}));

export const projectConsumablesRelations = relations(projectConsumables, ({one, many}) => ({
	project: one(projects, {
		fields: [projectConsumables.projectId],
		references: [projects.id]
	}),
	user: one(users, {
		fields: [projectConsumables.recordedBy],
		references: [users.id]
	}),
	projectConsumableItems: many(projectConsumableItems),
}));

export const projectConsumableItemsRelations = relations(projectConsumableItems, ({one}) => ({
	projectConsumable: one(projectConsumables, {
		fields: [projectConsumableItems.consumableId],
		references: [projectConsumables.id]
	}),
	inventoryItem: one(inventoryItems, {
		fields: [projectConsumableItems.inventoryItemId],
		references: [inventoryItems.id]
	}),
}));

export const projectEmployeesRelations = relations(projectEmployees, ({one}) => ({
	employee: one(employees, {
		fields: [projectEmployees.employeeId],
		references: [employees.id]
	}),
	project: one(projects, {
		fields: [projectEmployees.projectId],
		references: [projects.id]
	}),
}));

export const projectPhotoGroupsRelations = relations(projectPhotoGroups, ({one, many}) => ({
	user: one(users, {
		fields: [projectPhotoGroups.createdBy],
		references: [users.id]
	}),
	project: one(projects, {
		fields: [projectPhotoGroups.projectId],
		references: [projects.id]
	}),
	projectPhotos: many(projectPhotos),
}));

export const projectPhotosRelations = relations(projectPhotos, ({one}) => ({
	projectPhotoGroup: one(projectPhotoGroups, {
		fields: [projectPhotos.groupId],
		references: [projectPhotoGroups.id]
	}),
}));

export const purchaseInvoiceItemsRelations = relations(purchaseInvoiceItems, ({one}) => ({
	assetInventoryInstance: one(assetInventoryInstances, {
		fields: [purchaseInvoiceItems.assetInstanceId],
		references: [assetInventoryInstances.id]
	}),
	inventoryItem: one(inventoryItems, {
		fields: [purchaseInvoiceItems.inventoryItemId],
		references: [inventoryItems.id]
	}),
	purchaseInvoice: one(purchaseInvoices, {
		fields: [purchaseInvoiceItems.invoiceId],
		references: [purchaseInvoices.id]
	}),
	project: one(projects, {
		fields: [purchaseInvoiceItems.projectId],
		references: [projects.id]
	}),
}));

export const purchaseInvoicesRelations = relations(purchaseInvoices, ({one, many}) => ({
	purchaseInvoiceItems: many(purchaseInvoiceItems),
	purchaseInvoicePayments: many(purchaseInvoicePayments),
	purchaseOrders: many(purchaseOrders, {
		relationName: "purchaseOrders_convertedInvoiceId_purchaseInvoices_id"
	}),
	user_approvedById: one(users, {
		fields: [purchaseInvoices.approvedById],
		references: [users.id],
		relationName: "purchaseInvoices_approvedById_users_id"
	}),
	user_createdBy: one(users, {
		fields: [purchaseInvoices.createdBy],
		references: [users.id],
		relationName: "purchaseInvoices_createdBy_users_id"
	}),
	purchaseOrder: one(purchaseOrders, {
		fields: [purchaseInvoices.poId],
		references: [purchaseOrders.id],
		relationName: "purchaseInvoices_poId_purchaseOrders_id"
	}),
	user_submittedById: one(users, {
		fields: [purchaseInvoices.submittedById],
		references: [users.id],
		relationName: "purchaseInvoices_submittedById_users_id"
	}),
	supplier: one(suppliers, {
		fields: [purchaseInvoices.supplierId],
		references: [suppliers.id]
	}),
}));

export const purchaseInvoicePaymentsRelations = relations(purchaseInvoicePayments, ({one, many}) => ({
	purchaseInvoice: one(purchaseInvoices, {
		fields: [purchaseInvoicePayments.invoiceId],
		references: [purchaseInvoices.id]
	}),
	user: one(users, {
		fields: [purchaseInvoicePayments.recordedBy],
		references: [users.id]
	}),
	purchasePaymentFiles: many(purchasePaymentFiles),
}));

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({one}) => ({
	inventoryItem: one(inventoryItems, {
		fields: [purchaseOrderItems.inventoryItemId],
		references: [inventoryItems.id]
	}),
	purchaseOrder: one(purchaseOrders, {
		fields: [purchaseOrderItems.poId],
		references: [purchaseOrders.id]
	}),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({one, many}) => ({
	purchaseOrderItems: many(purchaseOrderItems),
	user_approvedById: one(users, {
		fields: [purchaseOrders.approvedById],
		references: [users.id],
		relationName: "purchaseOrders_approvedById_users_id"
	}),
	purchaseInvoice: one(purchaseInvoices, {
		fields: [purchaseOrders.convertedInvoiceId],
		references: [purchaseInvoices.id],
		relationName: "purchaseOrders_convertedInvoiceId_purchaseInvoices_id"
	}),
	user_createdBy: one(users, {
		fields: [purchaseOrders.createdBy],
		references: [users.id],
		relationName: "purchaseOrders_createdBy_users_id"
	}),
	user_submittedById: one(users, {
		fields: [purchaseOrders.submittedById],
		references: [users.id],
		relationName: "purchaseOrders_submittedById_users_id"
	}),
	supplier: one(suppliers, {
		fields: [purchaseOrders.supplierId],
		references: [suppliers.id]
	}),
	purchaseInvoices: many(purchaseInvoices, {
		relationName: "purchaseInvoices_poId_purchaseOrders_id"
	}),
}));

export const purchasePaymentFilesRelations = relations(purchasePaymentFiles, ({one}) => ({
	purchaseInvoicePayment: one(purchaseInvoicePayments, {
		fields: [purchasePaymentFiles.paymentId],
		references: [purchaseInvoicePayments.id]
	}),
}));

export const purchaseRequestItemsRelations = relations(purchaseRequestItems, ({one}) => ({
	inventoryItem: one(inventoryItems, {
		fields: [purchaseRequestItems.inventoryItemId],
		references: [inventoryItems.id]
	}),
	purchaseRequest: one(purchaseRequests, {
		fields: [purchaseRequestItems.requestId],
		references: [purchaseRequests.id]
	}),
}));

export const purchaseRequestsRelations = relations(purchaseRequests, ({one, many}) => ({
	purchaseRequestItems: many(purchaseRequestItems),
	employee_approvedBy: one(employees, {
		fields: [purchaseRequests.approvedBy],
		references: [employees.id],
		relationName: "purchaseRequests_approvedBy_employees_id"
	}),
	employee_requestedBy: one(employees, {
		fields: [purchaseRequests.requestedBy],
		references: [employees.id],
		relationName: "purchaseRequests_requestedBy_employees_id"
	}),
}));

export const reimbursementsRelations = relations(reimbursements, ({one}) => ({
	user_approvedById: one(users, {
		fields: [reimbursements.approvedById],
		references: [users.id],
		relationName: "reimbursements_approvedById_users_id"
	}),
	employee: one(employees, {
		fields: [reimbursements.employeeId],
		references: [employees.id]
	}),
	project: one(projects, {
		fields: [reimbursements.projectId],
		references: [projects.id]
	}),
	user_userId: one(users, {
		fields: [reimbursements.userId],
		references: [users.id],
		relationName: "reimbursements_userId_users_id"
	}),
}));

export const salesInvoiceItemsRelations = relations(salesInvoiceItems, ({one}) => ({
	salesInvoice: one(salesInvoices, {
		fields: [salesInvoiceItems.invoiceId],
		references: [salesInvoices.id]
	}),
}));

export const salesQuotationItemsRelations = relations(salesQuotationItems, ({one}) => ({
	salesQuotation: one(salesQuotations, {
		fields: [salesQuotationItems.quotationId],
		references: [salesQuotations.id]
	}),
}));

export const supplierDocumentsRelations = relations(supplierDocuments, ({one}) => ({
	supplier: one(suppliers, {
		fields: [supplierDocuments.supplierId],
		references: [suppliers.id]
	}),
}));

export const suppliersRelations = relations(suppliers, ({many}) => ({
	supplierDocuments: many(supplierDocuments),
	supplierInventoryItems: many(supplierInventoryItems),
	purchaseOrders: many(purchaseOrders),
	purchaseInvoices: many(purchaseInvoices),
}));

export const supplierInventoryItemsRelations = relations(supplierInventoryItems, ({one}) => ({
	inventoryItem: one(inventoryItems, {
		fields: [supplierInventoryItems.inventoryItemId],
		references: [inventoryItems.id]
	}),
	supplier: one(suppliers, {
		fields: [supplierInventoryItems.supplierId],
		references: [suppliers.id]
	}),
}));

export const dailyActivitiesRelations = relations(dailyActivities, ({one}) => ({
	project: one(projects, {
		fields: [dailyActivities.projectId],
		references: [projects.id]
	}),
}));

export const employeeFeedbackRelations = relations(employeeFeedback, ({one}) => ({
	user: one(users, {
		fields: [employeeFeedback.createdById],
		references: [users.id]
	}),
	employee: one(employees, {
		fields: [employeeFeedback.employeeId],
		references: [employees.id]
	}),
	project: one(projects, {
		fields: [employeeFeedback.projectId],
		references: [projects.id]
	}),
}));