import { relations } from "drizzle-orm/relations";
import { customers, projects, assets, employees, users, dailyActivities, inventoryItems, inventoryTransactions, payrollEntries, projectEmployees, suppliers, purchaseOrders, purchaseInvoices, purchaseRequests, salesInvoices, salesQuotations, proformaInvoices, projectPhotoGroups, projectPhotos } from "./schema";

export const projectsRelations = relations(projects, ({one, many}) => ({
	customer: one(customers, {
		fields: [projects.customerId],
		references: [customers.id]
	}),
	assets: many(assets),
	dailyActivities: many(dailyActivities),
	inventoryTransactions: many(inventoryTransactions),
	payrollEntries: many(payrollEntries),
	projectEmployees: many(projectEmployees),
	salesInvoices: many(salesInvoices),
	proformaInvoices: many(proformaInvoices),
	projectPhotoGroups: many(projectPhotoGroups),
}));

export const customersRelations = relations(customers, ({one, many}) => ({
	projects: many(projects),
	user: one(users, {
		fields: [customers.userId],
		references: [users.id]
	}),
	salesInvoices: many(salesInvoices),
	salesQuotations: many(salesQuotations),
	proformaInvoices: many(proformaInvoices),
}));

export const assetsRelations = relations(assets, ({one}) => ({
	project: one(projects, {
		fields: [assets.projectId],
		references: [projects.id]
	}),
	employee: one(employees, {
		fields: [assets.assignedToId],
		references: [employees.id]
	}),
}));

export const employeesRelations = relations(employees, ({one, many}) => ({
	assets: many(assets),
	user: one(users, {
		fields: [employees.userId],
		references: [users.id]
	}),
	payrollEntries: many(payrollEntries),
	projectEmployees: many(projectEmployees),
	purchaseRequests_requestedBy: many(purchaseRequests, {
		relationName: "purchaseRequests_requestedBy_employees_id"
	}),
	purchaseRequests_approvedBy: many(purchaseRequests, {
		relationName: "purchaseRequests_approvedBy_employees_id"
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	employees: many(employees),
	customers: many(customers),
	projectPhotoGroups: many(projectPhotoGroups),
}));

export const dailyActivitiesRelations = relations(dailyActivities, ({one}) => ({
	project: one(projects, {
		fields: [dailyActivities.projectId],
		references: [projects.id]
	}),
}));

export const inventoryTransactionsRelations = relations(inventoryTransactions, ({one}) => ({
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
}));

export const payrollEntriesRelations = relations(payrollEntries, ({one}) => ({
	employee: one(employees, {
		fields: [payrollEntries.employeeId],
		references: [employees.id]
	}),
	project: one(projects, {
		fields: [payrollEntries.projectId],
		references: [projects.id]
	}),
}));

export const projectEmployeesRelations = relations(projectEmployees, ({one}) => ({
	project: one(projects, {
		fields: [projectEmployees.projectId],
		references: [projects.id]
	}),
	employee: one(employees, {
		fields: [projectEmployees.employeeId],
		references: [employees.id]
	}),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({one, many}) => ({
	supplier: one(suppliers, {
		fields: [purchaseOrders.supplierId],
		references: [suppliers.id]
	}),
	purchaseInvoices: many(purchaseInvoices),
}));

export const suppliersRelations = relations(suppliers, ({many}) => ({
	purchaseOrders: many(purchaseOrders),
	purchaseInvoices: many(purchaseInvoices),
}));

export const purchaseInvoicesRelations = relations(purchaseInvoices, ({one}) => ({
	purchaseOrder: one(purchaseOrders, {
		fields: [purchaseInvoices.poId],
		references: [purchaseOrders.id]
	}),
	supplier: one(suppliers, {
		fields: [purchaseInvoices.supplierId],
		references: [suppliers.id]
	}),
}));

export const purchaseRequestsRelations = relations(purchaseRequests, ({one}) => ({
	employee_requestedBy: one(employees, {
		fields: [purchaseRequests.requestedBy],
		references: [employees.id],
		relationName: "purchaseRequests_requestedBy_employees_id"
	}),
	employee_approvedBy: one(employees, {
		fields: [purchaseRequests.approvedBy],
		references: [employees.id],
		relationName: "purchaseRequests_approvedBy_employees_id"
	}),
}));

export const salesInvoicesRelations = relations(salesInvoices, ({one}) => ({
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
}));

export const salesQuotationsRelations = relations(salesQuotations, ({one, many}) => ({
	salesInvoices: many(salesInvoices),
	proformaInvoices: many(proformaInvoices),
	customer: one(customers, {
		fields: [salesQuotations.customerId],
		references: [customers.id]
	}),
}));

export const proformaInvoicesRelations = relations(proformaInvoices, ({one}) => ({
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
}));

export const projectPhotoGroupsRelations = relations(projectPhotoGroups, ({one, many}) => ({
	project: one(projects, {
		fields: [projectPhotoGroups.projectId],
		references: [projects.id]
	}),
	user: one(users, {
		fields: [projectPhotoGroups.createdBy],
		references: [users.id]
	}),
	projectPhotos: many(projectPhotos),
}));

export const projectPhotosRelations = relations(projectPhotos, ({one}) => ({
	projectPhotoGroup: one(projectPhotoGroups, {
		fields: [projectPhotos.groupId],
		references: [projectPhotoGroups.id]
	}),
}));