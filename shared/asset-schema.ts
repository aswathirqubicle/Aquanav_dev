import { pgTable, text, serial, integer, boolean, timestamp, decimal, json, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users, employees, projects, suppliers } from "./schema";

// Asset Types (Master catalog for asset categories)
export const assetTypes = pgTable("asset_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(), // equipment, tools, vehicles, electronics, furniture
  description: text("description"),
  manufacturer: text("manufacturer"),
  model: text("model"),
  specifications: json("specifications").$type<Record<string, any>>().default({}),
  defaultMonthlyRentalRate: decimal("default_monthly_rental_rate", { precision: 10, scale: 2 }),
  depreciationRate: decimal("depreciation_rate", { precision: 5, scale: 2 }).default("0"), // annual percentage
  warrantyPeriodMonths: integer("warranty_period_months").default(12),
  maintenanceIntervalDays: integer("maintenance_interval_days").default(90),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Individual Asset Instances
export const assetInstances = pgTable("asset_instances", {
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
  monthlyRentalAmount: decimal("monthly_rental_amount", { precision: 10, scale: 2 }),
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
  assetInstanceId: integer("asset_instance_id").references(() => assetInstances.id).notNull(),
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
export const assetMaintenanceHistory = pgTable("asset_maintenance_history", {
  id: serial("id").primaryKey(),
  assetInstanceId: integer("asset_instance_id").references(() => assetInstances.id).notNull(),
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
export const assetDepreciationHistory = pgTable("asset_depreciation_history", {
  id: serial("id").primaryKey(),
  assetInstanceId: integer("asset_instance_id").references(() => assetInstances.id).notNull(),
  depreciationMethod: text("depreciation_method").notNull().default("straight_line"), // straight_line, declining_balance
  depreciationDate: date("depreciation_date").notNull(),
  originalValue: decimal("original_value", { precision: 10, scale: 2 }).notNull(),
  depreciationAmount: decimal("depreciation_amount", { precision: 10, scale: 2 }).notNull(),
  accumulatedDepreciation: decimal("accumulated_depreciation", { precision: 10, scale: 2 }).notNull(),
  bookValue: decimal("book_value", { precision: 10, scale: 2 }).notNull(),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Asset Inventory Status (Real-time summary)
export const assetInventoryStatus = pgTable("asset_inventory_status", {
  id: serial("id").primaryKey(),
  assetTypeId: integer("asset_type_id").references(() => assetTypes.id).notNull(),
  totalCount: integer("total_count").notNull().default(0),
  availableCount: integer("available_count").notNull().default(0),
  inUseCount: integer("in_use_count").notNull().default(0),
  maintenanceCount: integer("maintenance_count").notNull().default(0),
  retiredCount: integer("retired_count").notNull().default(0),
  totalValue: decimal("total_value", { precision: 12, scale: 2 }).default("0"),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

// Zod Schemas
export const insertAssetTypeSchema = createInsertSchema(assetTypes).omit({ id: true, createdAt: true });
export const insertAssetInstanceSchema = createInsertSchema(assetInstances).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAssetMovementSchema = createInsertSchema(assetMovements).omit({ id: true, createdAt: true });
export const insertAssetMaintenanceHistorySchema = createInsertSchema(assetMaintenanceHistory).omit({ id: true, createdAt: true });
export const insertAssetDepreciationHistorySchema = createInsertSchema(assetDepreciationHistory).omit({ id: true, createdAt: true });
export const insertAssetInventoryStatusSchema = createInsertSchema(assetInventoryStatus).omit({ id: true, lastUpdated: true });

// TypeScript Types
export type AssetType = typeof assetTypes.$inferSelect;
export type InsertAssetType = z.infer<typeof insertAssetTypeSchema>;
export type AssetInstance = typeof assetInstances.$inferSelect;
export type InsertAssetInstance = z.infer<typeof insertAssetInstanceSchema>;
export type AssetMovement = typeof assetMovements.$inferSelect;
export type InsertAssetMovement = z.infer<typeof insertAssetMovementSchema>;
export type AssetMaintenanceHistory = typeof assetMaintenanceHistory.$inferSelect;
export type InsertAssetMaintenanceHistory = z.infer<typeof insertAssetMaintenanceHistorySchema>;
export type AssetDepreciationHistory = typeof assetDepreciationHistory.$inferSelect;
export type InsertAssetDepreciationHistory = z.infer<typeof insertAssetDepreciationHistorySchema>;
export type AssetInventoryStatus = typeof assetInventoryStatus.$inferSelect;
export type InsertAssetInventoryStatus = z.infer<typeof insertAssetInventoryStatusSchema>;