import { InventoryStorage } from "./inventory";
import fs from "fs/promises";
import {
  AllAssetAssignmentsEntry,
  AssetAssignmentHistoryEntry,
  AssignEmployeeData,
  CreateProjectConsumableItemInput,
  CreatedProjectConsumable,
  InvoicePaymentWithCustomerName,
  PlannedActivityItem,
  ProjectAssetAssignmentWithAssetInfo,
  ProjectConsumableItemWithDetails,
  ProjectConsumableWithItems,
} from "./types";
import {
  DailyActivity,
  Employee,
  InsertDailyActivity,
  InsertProject,
  InsertProjectPhoto,
  InsertProjectPhotoGroup,
  Project,
  ProjectPhoto,
  ProjectPhotoGroup,
  Reimbursement,
  assetInventoryInstances,
  assetInventoryMaintenanceFiles,
  assetInventoryMaintenanceRecords,
  assetTypes,
  customers,
  dailyActivities,
  employees,
  insertAssetInventoryMaintenanceRecords,
  inventoryItems,
  generalLedgerEntries,
  inventoryTransactions,
  invoicePayments,
  locations,
  payrollAdditions,
  payrollEntries,
  projectAssetAssignments,
  projectAssetInstanceAssignments,
  projectConsumableItems,
  projectConsumables,
  projectEmployees,
  projectPhotoGroups,
  projectPhotos,
  projects,
  purchaseInvoiceItems,
  purchaseInvoices,
  reimbursements,
  creditNotes,
  salesInvoices,
  suppliers,
  users,
} from "@shared/schema";
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  gte,
  inArray,
  isNotNull,
  isNull,
  like,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { db } from "../db";
import { format } from "date-fns";
import { storage } from "../storage";

export class ProjectAssetStorage extends InventoryStorage {
  async updateDailyActivity(
    id: number,
    updateData: Partial<InsertDailyActivity>,
  ): Promise<DailyActivity | undefined> {
    try {
      const result = await db
        .update(dailyActivities)
        .set(updateData)
        .where(eq(dailyActivities.id, id))
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateDailyActivity (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateDailyActivity",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteDailyActivity(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(dailyActivities)
        .where(eq(dailyActivities.id, id))
        .returning();
      return result.length > 0;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deleteDailyActivity (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteDailyActivity",
        severity: "error",
      });
      throw error;
    }
  }

  // Project methods
  async getProjects(): Promise<Project[]> {
    try {
      return await db.select().from(projects).orderBy(projects.id);
    } catch (error: any) {
      await this.createErrorLog({
        message: "Error in getProjects: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getProjects",
        severity: "error",
      });
      throw error;
    }
  }

  async getProject(id: number): Promise<Project | undefined> {
    try {
      const result = await db
        .select({
          id: projects.id,
          title: projects.title,
          description: projects.description,
          vesselName: projects.vesselName,
          vesselImage: projects.vesselImage,
          vesselImoNumber: projects.vesselImoNumber,
          startDate: projects.startDate,
          plannedEndDate: projects.plannedEndDate,
          actualEndDate: projects.actualEndDate,
          status: projects.status,
          estimatedBudget: projects.estimatedBudget,
          actualCost: projects.actualCost,
          totalRevenue: projects.totalRevenue,
          customerId: projects.customerId,
          customerName: customers.name,
          locations: projects.locations,
          ridgingCrewNos: projects.ridgingCrewNos,
          modeOfContract: projects.modeOfContract,
          workingHours: projects.workingHours,
          ppe: projects.ppe,
          additionalField1Title: projects.additionalField1Title,
          additionalField1Description: projects.additionalField1Description,
          additionalField2Title: projects.additionalField2Title,
          additionalField2Description: projects.additionalField2Description,
          additionalField3Title: projects.additionalField3Title,
          additionalField3Description: projects.additionalField3Description,
          additionalField4Title: projects.additionalField4Title,
          additionalField4Description: projects.additionalField4Description,
          additionalField5Title: projects.additionalField5Title,
          additionalField5Description: projects.additionalField5Description,
          additionalField6Title: projects.additionalField6Title,
          additionalField6Description: projects.additionalField6Description,
          surfaceTemperature: projects.surfaceTemperature,
          airTemperature: projects.airTemperature,
          relativeHumidity: projects.relativeHumidity,
          dewPointTemperature: projects.dewPointTemperature,
          dewPointSurfaceDiff: projects.dewPointSurfaceDiff,
          workRemainingDays: projects.workRemainingDays,
        })
        .from(projects)
        .leftJoin(customers, eq(projects.customerId, customers.id))
        .where(eq(projects.id, id))
        .limit(1);
      return result[0] as Project;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getProject (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getProject",
        severity: "error",
      });
      throw error;
    }
  }

  async getProjectPrint(
    id: number,
    fromDate,
    toDate,
    reportDate,
    includeRemainingDays,
    includeHBMHours,
  ): Promise<Project | undefined> {
    try {
      const result = await db
        .select({
          id: projects.id,
          title: projects.title,
          description: projects.description,
          vesselName: projects.vesselName,
          vesselImage: projects.vesselImage,
          vesselImoNumber: projects.vesselImoNumber,
          startDate: projects.startDate,
          plannedEndDate: projects.plannedEndDate,
          actualEndDate: projects.actualEndDate,
          status: projects.status,
          estimatedBudget: projects.estimatedBudget,
          actualCost: projects.actualCost,
          totalRevenue: projects.totalRevenue,
          customerId: projects.customerId,
          customerName: customers.name,
          locations: projects.locations,
          ridgingCrewNos: projects.ridgingCrewNos,
          modeOfContract: projects.modeOfContract,
          workingHours: projects.workingHours,
          ppe: projects.ppe,
          additionalField1Title: projects.additionalField1Title,
          additionalField1Description: projects.additionalField1Description,
          additionalField2Title: projects.additionalField2Title,
          additionalField2Description: projects.additionalField2Description,
          additionalField3Title: projects.additionalField3Title,
          additionalField3Description: projects.additionalField3Description,
          additionalField4Title: projects.additionalField4Title,
          additionalField4Description: projects.additionalField4Description,
          additionalField5Title: projects.additionalField5Title,
          additionalField5Description: projects.additionalField5Description,
          additionalField6Title: projects.additionalField6Title,
          additionalField6Description: projects.additionalField6Description,
          surfaceTemperature: projects.surfaceTemperature,
          airTemperature: projects.airTemperature,
          relativeHumidity: projects.relativeHumidity,
          dewPointTemperature: projects.dewPointTemperature,
          dewPointSurfaceDiff: projects.dewPointSurfaceDiff,
          workRemainingDays: projects.workRemainingDays,
        })
        .from(projects)
        .leftJoin(customers, eq(projects.customerId, customers.id))
        .where(eq(projects.id, id))
        .limit(1);
      const res = result[0];
      const completedDateConditions: any[] = [];
      const plannedDateConditions: any[] = [];

      let effectiveToDateStr = toDate;
      let originalToDateStr = toDate;

      let shouldFetchPlannedActivities = false;

      // If toDate > reportDate, we split the logic like the PHP legacy code
      if (toDate && reportDate && new Date(toDate) > new Date(reportDate)) {
        shouldFetchPlannedActivities = true;
        effectiveToDateStr = reportDate;

        // planned activities from reportDate + 1 day to original toDate
        const fFromDate = new Date(reportDate);
        fFromDate.setDate(fFromDate.getDate() + 1);
        fFromDate.setHours(0, 0, 0, 0);

        const endOfDayPlanned = new Date(originalToDateStr);
        endOfDayPlanned.setHours(23, 59, 59, 999);

        plannedDateConditions.push(gte(dailyActivities.date, fFromDate));
        plannedDateConditions.push(lte(dailyActivities.date, endOfDayPlanned));
      }

      if (fromDate) {
        completedDateConditions.push(
          gte(dailyActivities.date, new Date(fromDate)),
        );
      }

      if (effectiveToDateStr) {
        const endOfDayCompleted = new Date(effectiveToDateStr);
        endOfDayCompleted.setHours(23, 59, 59, 999);
        completedDateConditions.push(
          lte(dailyActivities.date, endOfDayCompleted),
        );
      }

      res.dailyActivities = await db
        .select({
          id: dailyActivities.id,
          location: dailyActivities.location,
          tasks: dailyActivities.completedTasks,
          date: dailyActivities.date,
          remarks: dailyActivities.remarks,
          hbmDailyRunningHours: dailyActivities.hbmDailyRunningHours,
        })
        .from(dailyActivities)
        .where(
          and(
            eq(dailyActivities.projectId, id),
            isNotNull(dailyActivities.completedTasks),
            ne(dailyActivities.completedTasks, ""),
            ...completedDateConditions,
          ),
        )
        // id breaks the date tie so a day's locations print in the order they
        // were entered. Without it the order is whatever the database returns,
        // which an edit to the day reshuffles — and the remark and HBM hours
        // below are carried on the first row of each date, so which row that is
        // has to be settled here.
        .orderBy(asc(dailyActivities.date), asc(dailyActivities.id));

      if (shouldFetchPlannedActivities) {
        res.plannedActivities = await db
          .select({
            id: dailyActivities.id,
            location: dailyActivities.location,
            tasks: dailyActivities.plannedTasks,
            date: dailyActivities.date,
            remarks: dailyActivities.remarks,
          })
          .from(dailyActivities)
          .where(
            and(
              eq(dailyActivities.projectId, id),
              isNotNull(dailyActivities.plannedTasks),
              ne(dailyActivities.plannedTasks, ""),
              ...plannedDateConditions,
            ),
          )
          .orderBy(asc(dailyActivities.date), asc(dailyActivities.id));
      } else {
        res.plannedActivities = [];
      }

      // let latestRemark = "";
      // // Use remark from the latest daily (completed) activity
      // if (res.dailyActivities && res.dailyActivities.length > 0) {
      //   const lastDaily = res.dailyActivities[res.dailyActivities.length - 1];
      //   if (lastDaily && lastDaily.remarks) {
      //     latestRemark = lastDaily.remarks;
      //   }
      // }

      // Group non-empty remarks by date
      const remarksByDate: Record<string, string> = {};
      // HBM running hours are day-level in the same way, so collect the day's
      // value too. It is not always on the day's first row — the row carrying
      // it may sort after one that has none.
      const hbmByDate: Record<string, string> = {};
      if (res.dailyActivities && res.dailyActivities.length > 0) {
        res.dailyActivities.forEach((activity) => {
          if (activity.date && activity.remarks) {
            const dateStr = activity.date.toISOString().split("T")[0];
            if (!remarksByDate[dateStr]) {
              remarksByDate[dateStr] = activity.remarks;
            }
          }
          if (activity.date && activity.hbmDailyRunningHours) {
            const dateStr = activity.date.toISOString().split("T")[0];
            if (!hbmByDate[dateStr]) {
              hbmByDate[dateStr] = activity.hbmDailyRunningHours;
            }
          }
        });

        // Carry the date's remark and HBM hours on the first activity row for
        // that date, and clear both from the rest. Left on every row the hours
        // read as if they repeated per location, and anyone totalling the
        // column counts a single day's hours once for each location worked.
        const seenDates = new Set<string>();
        res.dailyActivities.forEach((activity) => {
          if (activity.date) {
            const dateStr = activity.date.toISOString().split("T")[0];
            if (!seenDates.has(dateStr)) {
              activity.remarks = remarksByDate[dateStr] || "";
              activity.hbmDailyRunningHours = hbmByDate[dateStr] || "";
              seenDates.add(dateStr);
            } else {
              activity.remarks = "";
              activity.hbmDailyRunningHours = "";
            }
          }
        });
      }

      let latestRemark = "";
      // Set latestRemark only if fromDate and toDate are equal (daily report)
      if (
        fromDate &&
        toDate &&
        new Date(fromDate).toISOString().split("T")[0] ===
          new Date(toDate).toISOString().split("T")[0]
      ) {
        const dateStr = new Date(fromDate).toISOString().split("T")[0];
        if (remarksByDate[dateStr]) {
          latestRemark = remarksByDate[dateStr];
        }
      }
      res.latestRemark = latestRemark;

      const photoDateConditions: any[] = [];

      if (fromDate) {
        photoDateConditions.push(
          gte(projectPhotoGroups.date, new Date(fromDate)),
        );
      }

      if (toDate) {
        const endOfDay = new Date(toDate);
        endOfDay.setHours(23, 59, 59, 999);
        photoDateConditions.push(lte(projectPhotoGroups.date, endOfDay));
      }

      const groups = await db
        .select()
        .from(projectPhotoGroups)
        .where(
          and(eq(projectPhotoGroups.projectId, id), ...photoDateConditions),
        )
        .orderBy(asc(projectPhotoGroups.createdAt));

      const groupIds = groups.map((g) => g.id);

      let photos: any[] = [];

      if (groupIds.length > 0) {
        photos = await db
          .select()
          .from(projectPhotos)
          .where(inArray(projectPhotos.groupId, groupIds));
      }

      // Group photos by groupId (optimized)
      const photoMap = photos.reduce((acc: any, photo) => {
        if (!acc[photo.groupId]) {
          acc[photo.groupId] = [];
        }
        acc[photo.groupId].push(photo);
        return acc;
      }, {});

      // Final gallery structure
      const gallery = groups.map((group) => ({
        id: group.id,
        title: group.title, // 👈 photo group title becomes gallery title
        description: group.description, // 👈 photo group title becomes gallery description
        createdAt: group.createdAt,
        photos: photoMap[group.id] || [],
      }));

      res.gallery = gallery;
      res.consumables = await storage.getProjectConsumables(
        id,
        fromDate,
        toDate,
      );
      res.reportDate = reportDate;
      if (!includeRemainingDays) res.workRemainingDays = [];
      res.includeHBMHours = includeHBMHours;
      console.log("hhhhh", res);
      return res as Project;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getProject (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getProject",
        severity: "error",
      });
      throw error;
    }
  }

  async getConsumablesPrint(
    id: number,
    fromDate,
    toDate,
    reportDate,
  ): Promise<Project | undefined> {
    try {
      const result = await db
        .select({
          id: projects.id,
          title: projects.title,
          description: projects.description,
          vesselName: projects.vesselName,
          vesselImage: projects.vesselImage,
          vesselImoNumber: projects.vesselImoNumber,
          startDate: projects.startDate,
          plannedEndDate: projects.plannedEndDate,
          actualEndDate: projects.actualEndDate,
          status: projects.status,
          estimatedBudget: projects.estimatedBudget,
          actualCost: projects.actualCost,
          totalRevenue: projects.totalRevenue,
          customerId: projects.customerId,
          customerName: customers.name,
          locations: projects.locations,
          ridgingCrewNos: projects.ridgingCrewNos,
          modeOfContract: projects.modeOfContract,
          workingHours: projects.workingHours,
          ppe: projects.ppe,
          additionalField1Title: projects.additionalField1Title,
          additionalField1Description: projects.additionalField1Description,
          additionalField2Title: projects.additionalField2Title,
          additionalField2Description: projects.additionalField2Description,
          additionalField3Title: projects.additionalField3Title,
          additionalField3Description: projects.additionalField3Description,
          additionalField4Title: projects.additionalField4Title,
          additionalField4Description: projects.additionalField4Description,
          additionalField5Title: projects.additionalField5Title,
          additionalField5Description: projects.additionalField5Description,
          additionalField6Title: projects.additionalField6Title,
          additionalField6Description: projects.additionalField6Description,
          surfaceTemperature: projects.surfaceTemperature,
          airTemperature: projects.airTemperature,
          relativeHumidity: projects.relativeHumidity,
          dewPointTemperature: projects.dewPointTemperature,
          dewPointSurfaceDiff: projects.dewPointSurfaceDiff,
        })
        .from(projects)
        .leftJoin(customers, eq(projects.customerId, customers.id))
        .where(eq(projects.id, id))
        .limit(1);
      const res = result[0];
      const dateConditions: any[] = [];

      if (fromDate) {
        dateConditions.push(gte(dailyActivities.date, new Date(fromDate)));
      }

      if (toDate) {
        const endOfDay = new Date(toDate);
        endOfDay.setHours(23, 59, 59, 999);
        dateConditions.push(lte(dailyActivities.date, endOfDay));
      }
      res.consumables = await storage.getProjectConsumables(
        id,
        fromDate,
        toDate,
      );
      res.reportDate = reportDate;
      console.log("hhhhh", res);
      return res as Project;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getProject (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getProject",
        severity: "error",
      });
      throw error;
    }
  }

  async getProjectsByCustomer(customerId: number): Promise<Project[]> {
    try {
      return await db
        .select()
        .from(projects)
        .where(eq(projects.customerId, customerId));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getProjectsByCustomer (customerId: ${customerId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getProjectsByCustomer",
        severity: "error",
      });
      throw error;
    }
  }

  async getProjectsByEmployee(employeeId: number): Promise<Project[]> {
    try {
      const assignments = await db
        .select({ projectId: projectEmployees.projectId })
        .from(projectEmployees)
        .where(eq(projectEmployees.employeeId, employeeId));

      if (assignments.length === 0) return [];

      const projectIds = assignments
        .map((a) => a.projectId)
        .filter((id): id is number => id !== null);
      if (projectIds.length === 0) return [];

      return await db
        .select()
        .from(projects)
        .where(inArray(projects.id, projectIds));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getProjectsByEmployee (employeeId: ${employeeId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getProjectsByEmployee",
        severity: "error",
      });
      throw error;
    }
  }

  async createProject(projectData: InsertProject): Promise<Project> {
    try {
      // Fetch master locations to use as defaults
      const masterLocations = await this.getLocations();
      const defaultLocationNames = masterLocations.map((l) => l.name);

      // If no locations were provided, use the default master list
      const finalProjectData = {
        ...projectData,
        locations:
          projectData.locations && projectData.locations.length > 0
            ? projectData.locations
            : defaultLocationNames,
      };

      const result = await db
        .insert(projects)
        .values(finalProjectData)
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createProject: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createProject",
        severity: "error",
      });
      throw error;
    }
  }

  async updateProject(
    id: number,
    data: Partial<Project>,
  ): Promise<Project | undefined> {
    try {
      const updatePayload: Partial<Project> = {};

      // Iterate over keys in data to build the updatePayload dynamically
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          const value = (data as any)[key];
          if (
            key === "startDate" ||
            key === "plannedEndDate" ||
            key === "actualEndDate"
          ) {
            const cleanedDate = this._cleanDateValue(value);
            if (cleanedDate !== undefined) {
              (updatePayload as any)[key] = cleanedDate;
            } else if (value !== undefined) {
              // If _cleanDateValue returns undefined, but original value was present, it means invalid date to be ignored.
              console.warn(
                `Invalid date value for ${key} will be ignored:`,
                value,
              );
            }
          } else if (key === "locations") {
            if (value !== undefined) {
              // Ensure it's an array, don't modify if already valid JSON or array
              if (Array.isArray(value)) {
                (updatePayload as any)[key] = value;
              } else {
                // Attempt to parse if it's a string, otherwise default to empty array or handle error
                try {
                  const parsedLocations =
                    typeof value === "string" ? JSON.parse(value) : value;
                  (updatePayload as any)[key] = Array.isArray(parsedLocations)
                    ? parsedLocations
                    : [];
                } catch (e) {
                  console.warn(
                    `Invalid JSON for locations, defaulting to empty array:`,
                    value,
                  );
                  (updatePayload as any)[key] = [];
                }
              }
            } else {
              // if locations is explicitly undefined in payload, we might want to skip update or set to null
              // For now, let's skip if undefined. If it needs to be settable to null, adjust logic.
            }
          } else if (value !== undefined) {
            // For other fields, directly assign if the value is not undefined
            (updatePayload as any)[key] = value;
          }
        }
      }

      console.log("Storage updateProject cleaned data for DB:", updatePayload);

      // Handle locations array properly - ensure it's preserved as JSON
      if (Object.keys(updatePayload).length === 0) {
        // No valid fields to update, perhaps return current project data or handle as an error/noop
        console.log("No valid fields to update for project:", id);
        return this.getProject(id); // Or return undefined / throw error based on desired behavior
      }

      const [project] = await db
        .update(projects)
        .set(updatePayload)
        .where(eq(projects.id, id))
        .returning();

      console.log("Project updated in database:", project);
      return project;
    } catch (error: any) {
      console.error("Original error in updateProject:", error); // Keep original console.error for context if needed
      await this.createErrorLog({
        message:
          `Error in updateProject (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateProject",
        severity: "error",
      });
      throw error;
    }
  }

  // Project Employee methods
  async getProjectEmployees(
    projectId: number,
  ): Promise<
    Array<
      Employee & { startDate?: string; endDate?: string; assignedAt?: string }
    >
  > {
    try {
      console.log(
        `[Payroll] getProjectEmployees called for project ID: ${projectId}`,
      );
      console.log(
        `[Payroll] Querying project assignments for project ID: ${projectId}`,
      );
      const assignments = await db
        .select()
        .from(projectEmployees)
        .where(eq(projectEmployees.projectId, projectId));

      console.log(
        `[Payroll] Found ${assignments.length} assignments for project ID: ${projectId}`,
      );
      if (assignments.length === 0) {
        return [];
      }

      const employeeIds = assignments
        .map((a) => a.employeeId)
        .filter((id) => id != null && typeof id === "number") as number[];
      if (employeeIds.length === 0) {
        console.log(
          `[Payroll] No valid employee IDs found from assignments for project ID: ${projectId}. Returning empty.`,
        );
        return [];
      }

      console.log(
        `[Payroll] Querying employee details for ${employeeIds.length} employee IDs related to project ID: ${projectId}`,
      );
      console.log(
        `[Payroll] Employee IDs to query: ${JSON.stringify(employeeIds)}`,
      );

      // Validate that employeeIds array is not empty and contains valid numbers
      if (
        !Array.isArray(employeeIds) ||
        employeeIds.length === 0 ||
        employeeIds.some((id) => typeof id !== "number" || isNaN(id))
      ) {
        console.error(
          `[Payroll] Invalid employee IDs array: ${JSON.stringify(employeeIds)}`,
        );
        return [];
      }

      const employeesData = await db
        .select({
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          email: employees.email,
          phone: employees.phone,
          employeeCode: employees.employeeCode,
          category: employees.category,
          salary: employees.salary,
          grade: employees.grade,
          contractCurrency: employees.contractCurrency,
          contractSalary: employees.contractSalary,
          hireDate: employees.hireDate,
          department: employees.department,
          position: employees.position,
          isActive: employees.isActive,
          userId: employees.userId,
        })
        .from(employees)
        .where(inArray(employees.id, employeeIds));

      console.log(
        `[Payroll] Fetched ${employeesData.length} employee details for project ID: ${projectId}`,
      );
      // Combine employee data with assignment dates
      const result = employeesData.map((employee) => {
        // Find the corresponding assignment. Since employeeIds are unique from assignments,
        // and we filtered for employees based on these IDs, each employee should have an assignment.
        const assignment = assignments.find(
          (a) => a.employeeId === employee.id,
        );
        // If for some reason an employee record was fetched but no assignment matches
        // (e.g. if employeeId in assignments could be null and not filtered out, though employeeIds filters nulls now)
        // we might want to handle that, but current logic implies a match will be found.
        return {
          ...employee, // Spread all selected fields of Employee
          startDate: assignment?.startDate
            ? assignment.startDate.toISOString()
            : undefined,
          endDate: assignment?.endDate
            ? assignment.endDate.toISOString()
            : undefined,
          assignedAt: assignment?.assignedAt
            ? assignment.assignedAt.toISOString()
            : undefined,
        };
      });

      return result;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getProjectEmployees (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getProjectEmployees",
        severity: "error",
      });
      throw error;
    }
  }

  async assignEmployeeToProject(
    projectId: number,
    employeeId: number,
  ): Promise<ProjectEmployee | undefined> {
    try {
      const result: ProjectEmployee[] = await db
        .insert(projectEmployees)
        .values({
          projectId: projectId,
          employeeId: employeeId,
        })
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in assignEmployeeToProject (projectId: ${projectId}, employeeId: ${employeeId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "assignEmployeeToProject",
        severity: "error",
      });
      throw error;
    }
  }

  async assignEmployeesToProject(
    projectId: number,
    assignments: AssignEmployeeData[],
  ): Promise<ProjectEmployee[]> {
    try {
      const project = await this.getProject(projectId);
      if (!project) throw new Error("Project not found");

      // Validate contract employee availability
      for (const assignment of assignments) {
        const employee = await this.getEmployee(assignment.employeeId);
        if (employee && employee.category === "contract") {
          // Use assignment dates if provided, otherwise fallback to project dates
          const newStart = assignment.startDate
            ? new Date(assignment.startDate)
            : project.startDate
              ? new Date(project.startDate)
              : new Date();
          const newEnd = assignment.endDate
            ? new Date(assignment.endDate)
            : project.plannedEndDate
              ? new Date(project.plannedEndDate)
              : null;

          // Check for overlapping assignments in OTHER projects
          const existingAssignments = await db
            .select({
              projectId: projectEmployees.projectId,
              projectTitle: projects.title,
              startDate: projectEmployees.startDate,
              endDate: projectEmployees.endDate,
            })
            .from(projectEmployees)
            .leftJoin(projects, eq(projectEmployees.projectId, projects.id))
            .where(
              and(
                eq(projectEmployees.employeeId, employee.id),
                ne(projectEmployees.projectId, projectId),
              ),
            );

          for (const existing of existingAssignments) {
            const eStart = existing.startDate;
            const eEnd = existing.endDate;

            // Overlap check logic: (StartA <= EndB) AND (EndA >= StartB)
            // Using large/small dates to handle nulls (ongoing assignments)
            const startA = newStart.getTime();
            const endA = newEnd ? newEnd.getTime() : 253402300799000; // Year 9999
            const startB = eStart ? eStart.getTime() : -62135596800000; // Year 0001
            const endB = eEnd ? eEnd.getTime() : 253402300799000; // Year 9999

            if (startA <= endB && endA >= startB) {
              const conflictRange = `${eStart ? format(eStart, "dd-MMM-yyyy") : "Ongoing"} to ${eEnd ? format(eEnd, "dd-MMM-yyyy") : "Ongoing"}`;
              throw new Error(
                `Contract employee ${employee.firstName} ${employee.lastName} is already assigned to project "${existing.projectTitle || "Unknown"}" during this period (${conflictRange}).`,
              );
            }
          }
        }
      }

      // First, remove all existing assignments for this project
      await db
        .delete(projectEmployees)
        .where(eq(projectEmployees.projectId, projectId));

      // Then add the new assignments
      if (assignments.length === 0) {
        // Recalculate project cost after removing all employees
        await this.recalculateProjectCost(projectId);
        return [];
      }

      const assignmentData = assignments.map((assignment) => ({
        projectId: projectId,
        employeeId: assignment.employeeId,
        startDate: assignment.startDate ? new Date(assignment.startDate) : null,
        endDate: assignment.endDate ? new Date(assignment.endDate) : null,
        assignedAt: new Date(),
      }));

      const result: ProjectEmployee[] = await db
        .insert(projectEmployees)
        .values(assignmentData)
        .returning();

      // Recalculate project cost after assigning employees
      await this.recalculateProjectCost(projectId);

      return result;
    } catch (error: any) {
      console.error("Original error in assignEmployeesToProject:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in assignEmployeesToProject (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "assignEmployeesToProject",
        severity: "error",
      });
      throw error;
    }
  }

  async recalculateProjectCost(projectId: number): Promise<void> {
    try {
      const project = await this.getProject(projectId);
      if (!project) {
        console.log(
          `Project ${projectId} not found, skipping cost calculation`,
        );
        return;
      }

      // Labour = the per-project Salary Expense GL rows for this project, netted
      // against any reversals (L31). The accrual is split per project by real
      // time worked, so each project sees only its own share — no more single
      // fallback projectId taking 100%. No status gate (the accrual exists only
      // once approved) and no reimbursement subtraction (reimbursements post to
      // their own category accounts now, never to Salary Expense).
      const laborRows = await db
        .select({
          debitAmount: generalLedgerEntries.debitAmount,
          creditAmount: generalLedgerEntries.creditAmount,
        })
        .from(generalLedgerEntries)
        .where(
          and(
            eq(generalLedgerEntries.accountName, "Salary Expense"),
            eq(generalLedgerEntries.projectId, projectId),
          ),
        );
      const totalLaborCost = laborRows.reduce(
        (sum, r) =>
          sum +
          parseFloat(String(r.debitAmount || "0")) -
          parseFloat(String(r.creditAmount || "0")),
        0,
      );
      console.log(
        `Project ${projectId}: labor cost from GL Salary Expense (net of reversals) = ${totalLaborCost.toFixed(2)}`,
      );

      // Calculate inventory/consumables costs
      let totalInventoryCost = 0;

      // Get consumables from project_consumables tables
      const consumableRecords = await db
        .select()
        .from(projectConsumables)
        .where(eq(projectConsumables.projectId, projectId));

      for (const record of consumableRecords) {
        const items = await db
          .select({
            inventoryItemId: projectConsumableItems.inventoryItemId,
            quantity: projectConsumableItems.quantity,
            unitCost: projectConsumableItems.unitCost,
            itemName: inventoryItems.name,
          })
          .from(projectConsumableItems)
          .leftJoin(
            inventoryItems,
            eq(projectConsumableItems.inventoryItemId, inventoryItems.id),
          )
          .where(
            and(
              eq(projectConsumableItems.consumableId, record.id),
              isNotNull(projectConsumableItems.inventoryItemId),
            ),
          );

        for (const item of items) {
          if (item.unitCost) {
            const unitCost = parseFloat(item.unitCost);
            const itemCost = unitCost * item.quantity;
            totalInventoryCost += itemCost;

            console.log(
              `Consumable item ${item.itemName}: Unit cost ${unitCost.toFixed(
                4,
              )}, Quantity ${item.quantity}, Total cost ${itemCost.toFixed(2)}`,
            );
          }
        }
      }

      // Project asset assignment costs
      let totalAssetRentalCost = 0;

      // const assetAssignments = await this.getProjectAssetAssignments(projectId);
      const assetAssignments =
        await this.getProjectAssetInstanceAssignments(projectId);
      for (const assignment of assetAssignments) {
        const rentalCost = await this.calculateAssetRentalCost(
          new Date(assignment.startDate),
          new Date(assignment.endDate),
          assignment.monthlyRate,
        );
        totalAssetRentalCost += rentalCost;
      }
      console.log(
        `Total asset rental cost: ${totalAssetRentalCost.toFixed(2)}`,
      );

      // Purchase invoice line item costs (approved invoices allocated to this
      // project). Allocate the net-of-discount amount EXCLUDING VAT: lineTotal is
      // stored tax-inclusive (taxable + taxAmount), and taxable is already net of
      // the line and apportioned header discount, so lineTotal - taxAmount is the
      // discounted, ex-VAT cost. This makes Σ project cost reconcile to the GL
      // Purchase Expense, which is posted net of VAT (P6.2). (6.3 / T6.13)
      let totalPurchaseInvoiceCost = 0;
      const purchaseLineItems = await db
        .select({
          lineTotal: purchaseInvoiceItems.lineTotal,
          taxAmount: purchaseInvoiceItems.taxAmount,
          exchangeRate: purchaseInvoices.exchangeRate,
        })
        .from(purchaseInvoiceItems)
        .innerJoin(
          purchaseInvoices,
          eq(purchaseInvoiceItems.invoiceId, purchaseInvoices.id),
        )
        .where(
          and(
            eq(purchaseInvoiceItems.projectId, projectId),
            inArray(purchaseInvoices.status, [
              "approved",
              "partially_paid",
              "paid",
            ]),
          ),
        );
      for (const item of purchaseLineItems) {
        const netExVat =
          parseFloat(item.lineTotal) - parseFloat(item.taxAmount || "0");
        totalPurchaseInvoiceCost +=
          netExVat * parseFloat(item.exchangeRate || "1");
      }

      // Approved reimbursements linked to this project
      let totalReimbursementCost = 0;
      const projectReimbursements = await db
        .select({ amount: reimbursements.amount })
        .from(reimbursements)
        .where(
          and(
            eq(reimbursements.projectId, projectId),
            eq(reimbursements.status, "approved"),
          ),
        );
      for (const reimb of projectReimbursements) {
        totalReimbursementCost += parseFloat(String(reimb.amount || "0"));
      }

      const totalProjectCost =
        totalLaborCost +
        totalInventoryCost +
        totalAssetRentalCost +
        totalPurchaseInvoiceCost +
        totalReimbursementCost;

      console.log(`Project ${projectId} cost breakdown:`);
      console.log(`- Labor cost (payroll): ${totalLaborCost.toFixed(2)}`);
      console.log(`- Inventory cost: ${totalInventoryCost.toFixed(2)}`);
      console.log(`- Asset rental cost: ${totalAssetRentalCost.toFixed(2)}`);
      console.log(
        `- Purchase invoice cost: ${totalPurchaseInvoiceCost.toFixed(2)}`,
      );
      console.log(`- Reimbursement cost: ${totalReimbursementCost.toFixed(2)}`);
      console.log(`- Total cost: ${totalProjectCost.toFixed(2)}`);

      // Update project actual cost with proper formatting
      await this.updateProject(projectId, {
        actualCost: totalProjectCost.toFixed(2),
      });
    } catch (error: any) {
      console.error("Original error in recalculateProjectCost:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in recalculateProjectCost (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "recalculateProjectCost",
        severity: "error",
      });
      throw error;
    }
  }

  async updateProjectEndDateAndRecalculate(
    projectId: number,
    endDate: Date,
  ): Promise<Project | undefined> {
    try {
      const result = await this.updateProject(projectId, {
        actualEndDate: endDate,
      });
      if (result) {
        await this.recalculateProjectCost(projectId);
      }
      return result;
    } catch (error: any) {
      console.error(
        "Original error in updateProjectEndDateAndRecalculate:",
        error,
      ); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in updateProjectEndDateAndRecalculate (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateProjectEndDateAndRecalculate",
        severity: "error",
      });
      throw error;
    }
  }

  async removeEmployeeFromProject(
    projectId: number,
    employeeId: number,
  ): Promise<boolean> {
    try {
      console.log(
        `Attempting to remove employee ${employeeId} from project ${projectId}`,
      );

      // First, check if the assignment exists
      const existingAssignments = await db
        .select()
        .from(projectEmployees)
        .where(
          and(
            eq(projectEmployees.projectId, projectId),
            eq(projectEmployees.employeeId, employeeId),
          ),
        );

      console.log(
        `Found ${existingAssignments.length} existing assignments for employee ${employeeId} in project ${projectId}`,
      );

      if (existingAssignments.length === 0) {
        console.log(
          `No assignment found for employee ${employeeId} in project ${projectId}`,
        );
        return false;
      }

      // Delete using composite key (projectId and employeeId) and return deleted records
      const result = await db
        .delete(projectEmployees)
        .where(
          and(
            eq(projectEmployees.projectId, projectId),
            eq(projectEmployees.employeeId, employeeId),
          ),
        )
        .returning();

      // Check if any records were deleted by looking at the returned array
      const deleted = result.length > 0;

      if (deleted) {
        console.log(
          `Successfully deleted employee ${employeeId} from project ${projectId} - ${result.length} record(s) removed`,
        );
        // Recalculate project cost after removing employee
        await this.recalculateProjectCost(projectId);
        console.log(`Recalculated project cost for project ${projectId}`);
      } else {
        console.log(
          `No records deleted when trying to remove employee ${employeeId} from project ${projectId}`,
        );
      }

      return deleted;
    } catch (error: any) {
      console.error("Original error in removeEmployeeFromProject:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in removeEmployeeFromProject (projectId: ${projectId}, employeeId: ${employeeId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "removeEmployeeFromProject",
        severity: "error",
      });
      throw error;
    }
  }

  // Create Asset Inventory Maintenance Records
  async createAssetInventoryMaintenanceRecord(maintenanceData: {
    instanceId: number;
    maintenanceCost: string;
    maintenanceType: string;
    description?: string | null;
    startDate?: Date;
    completedDate?: Date;
    maintenanceDate?: Date;
    performedBy?: number | null;
  }): Promise<any> {
    try {
      const result = await db
        .insert(assetInventoryMaintenanceRecords)
        .values({
          instanceId: maintenanceData.instanceId,
          maintenanceCost: maintenanceData.maintenanceCost,
          description: maintenanceData.description || null,
          startDate: maintenanceData.startDate || null,
          completedDate: maintenanceData.completedDate || null,
          maintenanceDate: maintenanceData.maintenanceDate || new Date(),
          maintenanceType: maintenanceData.maintenanceType || null,
          performedBy: maintenanceData.performedBy || null,
          createdAt: new Date(),
        })
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createAssetInventoryMaintenanceRecord: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createAssetInventoryMaintenanceRecord",
        severity: "error",
      });
      throw error;
    }
  }

  //Update Maintenance record
  async updateAssetInventoryMaintenanceRecord(
    id: number,
    maintenanceData: Partial<insertAssetInventoryMaintenanceRecords>,
  ): Promise<any> {
    try {
      const result = await db
        .update(assetInventoryMaintenanceRecords)
        .set(maintenanceData)
        .where(eq(assetInventoryMaintenanceRecords.id, id))
        .returning();

      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateAssetInventoryMaintenanceRecord (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateAssetInventoryMaintenanceRecord",
        severity: "error",
      });
      throw error;
    }
  }

  async getAssetInventoryMaintenanceRecords(
    instanceId: number,
  ): Promise<any[]> {
    try {
      const records = await db.execute(sql`
        SELECT 
          aimr.id,
          aimr.instance_id as "instanceId",
          aimr.maintenance_cost as "maintenanceCost",
          aimr.description,
          aimr.performed_by as "performedBy",
          aimr.maintenance_date as "maintenanceDate",
          u.username as "performedByName",
          aimr.created_at as "createdAt",
          aimr.is_archived as "isArchived"
        FROM asset_inventory_maintenance_records aimr
        LEFT JOIN users u ON aimr.performed_by = u.id
        WHERE aimr.instance_id = ${instanceId}
        ORDER BY aimr.maintenance_date DESC
      `);

      return records;
    } catch (error: any) {
      console.error(
        `Error in getAssetInventoryMaintenanceRecords (instanceId: ${instanceId}):`,
        error,
      );
      throw error;
    }
  }

  async createAssetInventoryMaintenanceFile(fileData: {
    maintenanceRecordId: number;
    fileName: string;
    originalName: string;
    filePath: string;
    fileSize?: number;
    mimeType?: string;
  }): Promise<any> {
    try {
      const result = await db
        .insert(assetInventoryMaintenanceFiles)
        .values({
          maintenanceRecordId: fileData.maintenanceRecordId,
          fileName: fileData.fileName,
          originalName: fileData.originalName,
          filePath: fileData.filePath,
          fileSize: fileData.fileSize || null,
          mimeType: fileData.mimeType || null,
          uploadedAt: new Date(),
        })
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createAssetInventoryMaintenanceFile: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createAssetInventoryMaintenanceFile",
        severity: "error",
      });
      throw error;
    }
  }

  async getAssetInventoryMaintenanceFiles(
    maintenanceRecordId: number,
  ): Promise<any[]> {
    try {
      const files = await db
        .select()
        .from(assetInventoryMaintenanceFiles)
        .where(
          eq(
            assetInventoryMaintenanceFiles.maintenanceRecordId,
            maintenanceRecordId,
          ),
        )
        .orderBy(assetInventoryMaintenanceFiles.uploadedAt);
      console.log(files, "files");
      return files;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getAssetInventoryMaintenanceFiles (maintenanceRecordId: ${maintenanceRecordId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getAssetInventoryMaintenanceFiles",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteAssetInventoryMaintenanceFile(fileId: number): Promise<void> {
    try {
      await db
        .delete(assetInventoryMaintenanceFiles)
        .where(eq(assetInventoryMaintenanceFiles.id, fileId));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deleteAssetInventoryMaintenanceFile (fileId: ${fileId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteAssetInventoryMaintenanceFile",
        severity: "error",
      });
      throw error;
    }
  }

  async getAssetInventoryInstance(id: number): Promise<any> {
    try {
      const result = await db
        .select()
        .from(assetInventoryInstances)
        .where(eq(assetInventoryInstances.id, id))
        .limit(1);
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getAssetInventoryInstance (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getAssetInventoryInstance",
        severity: "error",
      });
      throw error;
    }
  }

  // Enhanced Asset Inventory Instance Methods
  async getAllAssetInventoryInstances(): Promise<any[]> {
    try {
      const instances = await db
        .select({
          id: assetInventoryInstances.id,
          assetTypeId: assetInventoryInstances.assetTypeId,
          assetTypeName: assetTypes.name,
          instanceNumber: assetInventoryInstances.instanceNumber,
          assetTag: assetInventoryInstances.assetTag,
          serialNumber: assetInventoryInstances.serialNumber,
          barcode: assetInventoryInstances.barcode,
          status: assetInventoryInstances.status,
          condition: assetInventoryInstances.condition,
          location: assetInventoryInstances.location,
          assignedProjectId: assetInventoryInstances.assignedProjectId,
          assignedToId: assetInventoryInstances.assignedToId,
          acquisitionDate: assetInventoryInstances.acquisitionDate,
          acquisitionCost: assetInventoryInstances.acquisitionCost,
          acquisitionCurrency: assetInventoryInstances.acquisitionCurrency,
          currentValue: assetInventoryInstances.currentValue,
          currentValueCurrency: assetInventoryInstances.currentValueCurrency,
          monthlyRentalAmount: assetInventoryInstances.monthlyRentalAmount,
          rentalCurrency: assetInventoryInstances.rentalCurrency,
          warrantyExpiryDate: assetInventoryInstances.warrantyExpiryDate,
          lastMaintenanceDate: assetInventoryInstances.lastMaintenanceDate,
          nextMaintenanceDate: assetInventoryInstances.nextMaintenanceDate,
          notes: assetInventoryInstances.notes,
          photos: assetInventoryInstances.photos,
          isActive: assetInventoryInstances.isActive,
          createdBy: assetInventoryInstances.createdBy,
          createdAt: assetInventoryInstances.createdAt,
          updatedAt: assetInventoryInstances.updatedAt,
        })
        .from(assetInventoryInstances)
        .leftJoin(
          assetTypes,
          eq(assetInventoryInstances.assetTypeId, assetTypes.id),
        )
        .where(eq(assetInventoryInstances.isActive, true))
        .orderBy(assetTypes.name, assetInventoryInstances.instanceNumber);

      return instances;
    } catch (error: any) {
      console.error("Error in getAllAssetInventoryInstances:", error);
      throw error;
    }
  }

  async getAssetInventoryInstancesByType(assetTypeId: number): Promise<any[]> {
    try {
      const instances = await db
        .select({
          id: assetInventoryInstances.id,
          assetTypeId: assetInventoryInstances.assetTypeId,
          instanceNumber: assetInventoryInstances.instanceNumber,
          assetTag: assetInventoryInstances.assetTag,
          serialNumber: assetInventoryInstances.serialNumber,
          barcode: assetInventoryInstances.barcode,
          status: assetInventoryInstances.status,
          condition: assetInventoryInstances.condition,
          location: assetInventoryInstances.location,
          assignedProjectId: assetInventoryInstances.assignedProjectId,
          monthlyRentalAmount: assetInventoryInstances.monthlyRentalAmount,
          currentValue: assetInventoryInstances.currentValue,
          acquisitionCost: assetInventoryInstances.acquisitionCost,
          notes: assetInventoryInstances.notes,
          isActive: assetInventoryInstances.isActive,
          createdAt: assetInventoryInstances.createdAt,
        })
        .from(assetInventoryInstances)
        .where(
          and(
            eq(assetInventoryInstances.assetTypeId, assetTypeId),
            eq(assetInventoryInstances.isActive, true),
          ),
        )
        .orderBy(assetInventoryInstances.instanceNumber);

      return instances;
    } catch (error: any) {
      console.error("Error in getAssetInventoryInstancesByType:", error);
      throw error;
    }
  }

  async getAvailableInstancesForAssignment(
    assetTypeId: number,
  ): Promise<any[]> {
    try {
      const instances = await db
        .select({
          id: assetInventoryInstances.id,
          instanceNumber: assetInventoryInstances.instanceNumber,
          assetTag: assetInventoryInstances.assetTag,
          serialNumber: assetInventoryInstances.serialNumber,
          barcode: assetInventoryInstances.barcode,
          monthlyRentalAmount: assetInventoryInstances.monthlyRentalAmount,
          condition: assetInventoryInstances.condition,
          location: assetInventoryInstances.location,
        })
        .from(assetInventoryInstances)
        .where(
          and(
            eq(assetInventoryInstances.assetTypeId, assetTypeId),
            eq(assetInventoryInstances.status, "available"),
            eq(assetInventoryInstances.isActive, true),
          ),
        )
        .orderBy(assetInventoryInstances.instanceNumber);

      return instances;
    } catch (error: any) {
      console.error("Error in getAvailableInstancesForAssignment:", error);
      throw error;
    }
  }

  async createAssetInventoryInstance(data: any): Promise<any> {
    try {
      const nextInstanceNumber = await this.getNextInstanceNumber(
        data.assetTypeId,
      );

      // Clean up data before saving - convert empty strings to null for date fields and numeric values
      const cleanData = { ...data };

      // Handle date fields - convert empty strings to null
      [
        "acquisitionDate",
        "warrantyExpiryDate",
        "lastMaintenanceDate",
        "nextMaintenanceDate",
      ].forEach((field) => {
        if (cleanData[field] === "") {
          cleanData[field] = null;
        } else if (cleanData[field] && typeof cleanData[field] === "string") {
          // Ensure valid date format
          cleanData[field] = new Date(cleanData[field]);
        }
      });

      // Handle numeric fields - convert empty strings to null
      ["acquisitionCost", "currentValue", "dailyRentalRate"].forEach(
        (field) => {
          if (cleanData[field] === "") {
            cleanData[field] = null;
          } else if (cleanData[field] && typeof cleanData[field] === "string") {
            const numValue = parseFloat(cleanData[field]);
            cleanData[field] = isNaN(numValue) ? null : numValue.toString();
          }
        },
      );

      // Handle optional unique fields - convert empty strings to null
      ["barcode"].forEach((field) => {
        if (cleanData[field] === "") {
          cleanData[field] = null;
        }
      });

      // Handle assignment fields - convert "unassigned" to null
      ["assignedProjectId", "assignedToId"].forEach((field) => {
        if (cleanData[field] === "unassigned" || cleanData[field] === "") {
          cleanData[field] = null;
        } else if (cleanData[field] && typeof cleanData[field] === "string") {
          const numValue = parseInt(cleanData[field]);
          cleanData[field] = isNaN(numValue) ? null : numValue;
        }
      });

      const instance = await db
        .insert(assetInventoryInstances)
        .values({
          ...cleanData,
          instanceNumber: `Instance ${nextInstanceNumber}`,
        })
        .returning();

      // Update asset type quantities
      await this.updateAssetTypeQuantities(cleanData.assetTypeId);

      return instance[0];
    } catch (error: any) {
      console.error("Error in createAssetInventoryInstance:", error);
      await this.createErrorLog({
        message:
          `Error in createAssetInventoryInstance: ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createAssetInventoryInstance",
        severity: "error",
      });
      throw error;
    }
  }

  async updateAssetInventoryInstance(id: number, data: any): Promise<any> {
    try {
      const oldInstance = await db
        .select({ assetTypeId: assetInventoryInstances.assetTypeId })
        .from(assetInventoryInstances)
        .where(eq(assetInventoryInstances.id, id))
        .limit(1);

      // Clean up data before saving - convert empty strings to null for date fields and numeric values
      const cleanData = { ...data };

      // Handle date fields - convert empty strings to null
      [
        "acquisitionDate",
        "warrantyExpiryDate",
        "lastMaintenanceDate",
        "nextMaintenanceDate",
      ].forEach((field) => {
        if (cleanData[field] === "") {
          cleanData[field] = null;
        } else if (cleanData[field] && typeof cleanData[field] === "string") {
          // Ensure valid date format
          cleanData[field] = new Date(cleanData[field]);
        }
      });

      // Handle numeric fields - convert empty strings to null
      ["acquisitionCost", "currentValue", "dailyRentalRate"].forEach(
        (field) => {
          if (cleanData[field] === "") {
            cleanData[field] = null;
          } else if (cleanData[field] && typeof cleanData[field] === "string") {
            const numValue = parseFloat(cleanData[field]);
            cleanData[field] = isNaN(numValue) ? null : numValue.toString();
          }
        },
      );

      // Handle optional unique fields - convert empty strings to null
      ["barcode"].forEach((field) => {
        if (cleanData[field] === "") {
          cleanData[field] = null;
        }
      });

      // Handle assignment fields - convert "unassigned" to null
      ["assignedProjectId", "assignedToId"].forEach((field) => {
        if (cleanData[field] === "unassigned" || cleanData[field] === "") {
          cleanData[field] = null;
        } else if (cleanData[field] && typeof cleanData[field] === "string") {
          const numValue = parseInt(cleanData[field]);
          cleanData[field] = isNaN(numValue) ? null : numValue;
        }
      });

      const instance = await db
        .update(assetInventoryInstances)
        .set({ ...cleanData, updatedAt: new Date() })
        .where(eq(assetInventoryInstances.id, id))
        .returning();

      // Update quantities for both old and new asset types if changed
      if (oldInstance[0]) {
        await this.updateAssetTypeQuantities(oldInstance[0].assetTypeId);
        if (
          cleanData.assetTypeId &&
          cleanData.assetTypeId !== oldInstance[0].assetTypeId
        ) {
          await this.updateAssetTypeQuantities(cleanData.assetTypeId);
        }
      }

      return instance[0];
    } catch (error: any) {
      console.error("Error in updateAssetInventoryInstance:", error);
      await this.createErrorLog({
        message:
          `Error in updateAssetInventoryInstance (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateAssetInventoryInstance",
        severity: "error",
      });
      throw error;
    }
  }

  private async getNextInstanceNumber(assetTypeId: number): Promise<number> {
    try {
      const maxInstance = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(assetInventoryInstances)
        .where(eq(assetInventoryInstances.assetTypeId, assetTypeId));

      return (maxInstance[0]?.count || 0) + 1;
    } catch (error: any) {
      console.error("Error in getNextInstanceNumber:", error);
      return 1;
    }
  }

  private async updateAssetTypeQuantities(assetTypeId: number): Promise<void> {
    try {
      const counts = await db
        .select({
          total: sql<number>`COUNT(*)`,
          available: sql<number>`COUNT(*) FILTER (WHERE status = 'available')`,
          assigned: sql<number>`COUNT(*) FILTER (WHERE status = 'in_use')`,
          maintenance: sql<number>`COUNT(*) FILTER (WHERE status = 'maintenance')`,
        })
        .from(assetInventoryInstances)
        .where(
          and(
            eq(assetInventoryInstances.assetTypeId, assetTypeId),
            eq(assetInventoryInstances.isActive, true),
          ),
        );

      const count = counts[0];
      await db
        .update(assetTypes)
        .set({
          totalQuantity: count.total,
          availableQuantity: count.available,
          assignedQuantity: count.assigned,
          maintenanceQuantity: count.maintenance,
        })
        .where(eq(assetTypes.id, assetTypeId));
    } catch (error: any) {
      console.error("Error in updateAssetTypeQuantities:", error);
    }
  }

  async getAllAssetMaintenanceRecords(): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          amr.id,
          amr.instance_id as "instanceId",
          amr.maintenance_type as "maintenanceType",
          amr.start_date as "startDate",
          amr.completed_date as "completedDate",
          amr.maintenance_cost as "maintenanceCost",
          amr.description,
          amr.performed_by as "performedBy",
          amr.maintenance_date as "maintenanceDate",
          u.username as "performedByName",
          amr.created_at as "createdAt",
          amr.is_archived as "isArchived",
          jsonb_build_object(
            'id', ai.id,
            'assetTag', ai.asset_tag,
            'serialNumber', ai.serial_number,
            'barcode', ai.barcode,
            'assetType', jsonb_build_object(
              'id', at.id,
              'name', at.name,
              'category', at.category
            )
          ) as "assetInstance"
        FROM asset_inventory_maintenance_records amr
        LEFT JOIN users u ON amr.performed_by = u.id
        LEFT JOIN asset_inventory_instances ai ON amr.instance_id = ai.id
        LEFT JOIN asset_types at ON ai.asset_type_id = at.id
        ORDER BY amr.maintenance_date DESC
      `);

      return Array.isArray(result) ? result : result.rows || [];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getAllAssetMaintenanceRecords: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getAllAssetMaintenanceRecords",
        severity: "error",
      });
      throw error;
    }
  }

  // Daily Activity methods
  async getDailyActivities(projectId: number): Promise<DailyActivity[]> {
    try {
      return await db
        .select()
        .from(dailyActivities)
        .where(
          and(
            eq(dailyActivities.projectId, projectId),
            isNotNull(dailyActivities.completedTasks),
            ne(dailyActivities.completedTasks, ""),
          ),
        )
        // Ordering by id within a date keeps a day's locations in the order
        // they were entered. Without it the order is whatever Postgres returns
        // from the heap, which an UPDATE reshuffles.
        .orderBy(desc(dailyActivities.date), asc(dailyActivities.id));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getDailyActivities (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getDailyActivities",
        severity: "error",
      });
      throw error;
    }
  }

  async getDailyActivitiesPaginated(
    projectId: number,
    limit: number,
    offset: number,
  ): Promise<{ data: DailyActivity[]; total: number }> {
    try {
      const whereCondition = and(
        eq(dailyActivities.projectId, projectId),
        isNotNull(dailyActivities.completedTasks),
        ne(dailyActivities.completedTasks, ""),
      );

      const [data, countResult] = await Promise.all([
        db
          .select()
          .from(dailyActivities)
          .where(whereCondition)
          // id breaks date ties so a day's locations keep their entry order and
          // pagination stays stable across pages.
          .orderBy(desc(dailyActivities.date), asc(dailyActivities.id))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(dailyActivities)
          .where(whereCondition),
      ]);

      const total = Number(countResult[0]?.count || 0);
      return { data, total };
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getDailyActivitiesPaginated (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getDailyActivitiesPaginated",
        severity: "error",
      });
      throw error;
    }
  }

  async createDailyActivity(
    activityData: InsertDailyActivity,
  ): Promise<DailyActivity> {
    try {
      const result = await db
        .insert(dailyActivities)
        .values(activityData)
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createDailyActivity: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createDailyActivity",
        severity: "error",
      });
      throw error;
    }
  }

  // Planned Activities methods
  async getPlannedActivities(
    projectId: number,
  ): Promise<PlannedActivityItem[]> {
    try {
      const result: Array<{
        id: number;
        location: string | null;
        tasks: string | null;
        date: Date;
        remarks: string | null;
      }> = await db
        .select({
          id: dailyActivities.id,
          location: dailyActivities.location,
          tasks: dailyActivities.plannedTasks,
          date: dailyActivities.date,
          remarks: dailyActivities.remarks,
        })
        .from(dailyActivities)
        .where(
          and(
            eq(dailyActivities.projectId, projectId),
            isNotNull(dailyActivities.plannedTasks),
            ne(dailyActivities.plannedTasks, ""),
          ),
        )
        // id breaks date ties so a day's rows keep their entry order.
        .orderBy(desc(dailyActivities.date), asc(dailyActivities.id));

      return result.map((row) => ({
        location: row.location || "",
        tasks: row.tasks || "",
        date: row.date.toISOString().split("T")[0],
        remarks: row.remarks || null,
      }));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getPlannedActivities (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPlannedActivities",
        severity: "error",
      });
      throw error;
    }
  }

  async getPlannedActivitiesPaginated(
    projectId: number,
    limit: number,
    offset: number,
  ): Promise<{ data: PlannedActivityItem[]; total: number }> {
    try {
      const whereCondition = and(
        eq(dailyActivities.projectId, projectId),
        isNotNull(dailyActivities.plannedTasks),
        ne(dailyActivities.plannedTasks, ""),
      );

      const [result, countResult] = await Promise.all([
        db
          .select({
            id: dailyActivities.id,
            location: dailyActivities.location,
            tasks: dailyActivities.plannedTasks,
            date: dailyActivities.date,
            remarks: dailyActivities.remarks,
          })
          .from(dailyActivities)
          .where(whereCondition)
          // id breaks date ties so a day's rows keep their entry order and
          // pagination stays stable across pages.
          .orderBy(desc(dailyActivities.date), asc(dailyActivities.id))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(dailyActivities)
          .where(whereCondition),
      ]);

      const data = result.map((row) => ({
        location: row.location || "",
        tasks: row.tasks || "",
        date: row.date.toISOString().split("T")[0],
        remarks: row.remarks || null,
      }));

      const total = Number(countResult[0]?.count || 0);
      return { data, total };
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getPlannedActivitiesPaginated (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPlannedActivitiesPaginated",
        severity: "error",
      });
      throw error;
    }
  }

  async savePlannedActivities(
    projectId: number,
    activities: PlannedActivityItem[],
  ): Promise<DailyActivity[]> {
    try {
      const results: DailyActivity[] = [];

      for (const activity of activities) {
        // Create a daily activity entry with planned tasks
        const activityData: InsertDailyActivity = {
          projectId,
          date: new Date(activity.date),
          location: activity.location || "",
          completedTasks: "", // Empty for planned activities
          plannedTasks: activity.tasks,
          remarks: "Planned activity",
          photos: [], // Assuming photos is part of InsertDailyActivity and can be an empty array
        };

        const resultItem: DailyActivity[] = await db
          .insert(dailyActivities)
          .values(activityData)
          .returning();

        if (resultItem[0]) {
          results.push(resultItem[0]);
        }
      }

      return results;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in savePlannedActivities (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "savePlannedActivities",
        severity: "error",
      });
      throw error;
    }
  }

  // Project Revenue methods
  async getProjectRevenue(projectId: number): Promise<{
    projectId: number;
    totalRevenue: string;
    totalCost: string;
    profit: string;
    invoicePayments: InvoicePaymentWithCustomerName[];
  }> {
    try {
      const project = await this.getProject(projectId);
      if (!project) {
        throw new Error(`Project with ID ${projectId} not found`);
      }

      // Get all invoice payments for this project with currency info
      const projectInvoicePaymentsRaw = await db
        .select({
          // Explicitly list all fields from InvoicePayment schema type
          id: invoicePayments.id,
          invoiceId: invoicePayments.invoiceId,
          amount: invoicePayments.amount,
          paymentDate: invoicePayments.paymentDate,
          paymentMethod: invoicePayments.paymentMethod,
          referenceNumber: invoicePayments.referenceNumber,
          notes: invoicePayments.notes,
          recordedBy: invoicePayments.recordedBy,
          recordedAt: invoicePayments.recordedAt,
          paymentType: invoicePayments.paymentType,
          creditNoteId: invoicePayments.creditNoteId,
          // Joined field
          customerName: customers.name,
          invoiceNumber: salesInvoices.invoiceNumber,
          invoiceCurrency: salesInvoices.currency,
          invoiceExchangeRate: salesInvoices.exchangeRate,
          invoiceTotalAmount: salesInvoices.totalAmount,
          invoiceTaxAmount: salesInvoices.taxAmount,
        })
        .from(invoicePayments)
        .leftJoin(
          salesInvoices,
          eq(invoicePayments.invoiceId, salesInvoices.id),
        )
        .leftJoin(customers, eq(salesInvoices.customerId, customers.id))
        .where(eq(salesInvoices.projectId, projectId))
        .orderBy(desc(invoicePayments.paymentDate));

      const projectInvoicePayments: InvoicePaymentWithCustomerName[] =
        projectInvoicePaymentsRaw.map((p) => ({
          id: p.id,
          invoiceId: p.invoiceId,
          amount: p.amount,
          paymentDate: p.paymentDate,
          paymentMethod: p.paymentMethod,
          referenceNumber: p.referenceNumber,
          notes: p.notes,
          recordedBy: p.recordedBy,
          recordedAt: p.recordedAt,
          paymentType: p.paymentType,
          creditNoteId: p.creditNoteId,
          customerName: p.customerName,
          invoiceNumber: p.invoiceNumber,
        }));

      // Get purchase invoice items linked to this project
      const purchaseItemsData = await db
        .select({
          description: purchaseInvoiceItems.description,
          quantity: purchaseInvoiceItems.quantity,
          unitPrice: purchaseInvoiceItems.unitPrice,
          taxAmount: purchaseInvoiceItems.taxAmount,
          lineTotal: purchaseInvoiceItems.lineTotal,
          exchangeRate: purchaseInvoices.exchangeRate,
          supplierName: suppliers.name,
          invoiceNumber: purchaseInvoices.invoiceNumber,
          invoiceDate: purchaseInvoices.invoiceDate,
        })
        .from(purchaseInvoiceItems)
        .leftJoin(
          purchaseInvoices,
          eq(purchaseInvoiceItems.invoiceId, purchaseInvoices.id),
        )
        .leftJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id))
        .where(
          and(
            eq(purchaseInvoiceItems.projectId, projectId),
            inArray(purchaseInvoices.status, [
              "approved",
              "partially_paid",
              "paid",
            ]),
          ),
        )
        .orderBy(desc(purchaseInvoices.invoiceDate));

      const purchaseItems = purchaseItemsData.map((item) => {
        // Net of VAT (lineTotal is stored tax-inclusive; strip taxAmount) so the
        // displayed purchase-expense breakdown reconciles to actualCost and the
        // GL Purchase Expense, both net of VAT. (6.3)
        const lineTotal = parseFloat(String(item.lineTotal || "0"));
        const taxAmount = parseFloat(String(item.taxAmount || "0"));
        const exRate = parseFloat(String(item.exchangeRate || "1"));
        const totalAmountAED = (lineTotal - taxAmount) * exRate;
        return {
          description: item.description || "Unknown item",
          amount: totalAmountAED.toFixed(2),
          supplierName: item.supplierName,
          invoiceNumber: item.invoiceNumber,
          date: item.invoiceDate ? String(item.invoiceDate) : null,
        };
      });

      // Get approved reimbursements linked to this project
      const reimbursementsData = await db
        .select({
          description: reimbursements.description,
          amount: reimbursements.amount,
          firstName: employees.firstName,
          lastName: employees.lastName,
          approvalTimestamp: reimbursements.approvalTimestamp,
        })
        .from(reimbursements)
        .leftJoin(employees, eq(reimbursements.employeeId, employees.id))
        .where(
          and(
            eq(reimbursements.projectId, projectId),
            eq(reimbursements.status, "approved"),
          ),
        )
        .orderBy(desc(reimbursements.approvalTimestamp));

      const reimbursementItems = reimbursementsData.map((item) => ({
        description: item.description || "Reimbursement",
        amount: String(item.amount || "0"),
        employeeName:
          item.firstName && item.lastName
            ? `${item.firstName} ${item.lastName}`
            : null,
        date: item.approvalTimestamp
          ? new Date(item.approvalTimestamp).toISOString()
          : null,
      }));

      // Labor cost breakdown from approved/paid payroll entries
      const laborPayrollRows = await db
        .select({
          id: payrollEntries.id,
          totalAmount: payrollEntries.totalAmount,
          basicSalary: payrollEntries.basicSalary,
          month: payrollEntries.month,
          year: payrollEntries.year,
          workingDays: payrollEntries.workingDays,
          firstName: employees.firstName,
          lastName: employees.lastName,
        })
        .from(payrollEntries)
        .leftJoin(employees, eq(payrollEntries.employeeId, employees.id))
        .where(
          and(
            eq(payrollEntries.projectId, projectId),
            inArray(payrollEntries.status, ["approved", "paid"]),
          ),
        )
        .orderBy(desc(payrollEntries.year), desc(payrollEntries.month));

      // Subtract reimbursement additions baked into each payroll entry's totalAmount
      const laborPayrollEntryIds = laborPayrollRows
        .map((r) => r.id)
        .filter(Boolean);
      let reimbByEntryId: Record<number, number> = {};
      if (laborPayrollEntryIds.length > 0) {
        const reimbAdditionRows = await db
          .select({
            payrollEntryId: payrollAdditions.payrollEntryId,
            amount: payrollAdditions.amount,
          })
          .from(payrollAdditions)
          .where(
            and(
              inArray(payrollAdditions.payrollEntryId, laborPayrollEntryIds),
              like(payrollAdditions.description, "Reimbursement:%"),
            ),
          );
        for (const r of reimbAdditionRows) {
          const eid = r.payrollEntryId!;
          reimbByEntryId[eid] =
            (reimbByEntryId[eid] || 0) + parseFloat(String(r.amount || "0"));
        }
      }

      const laborItems: {
        name: string;
        month: number;
        year: number;
        workingDays: number;
        amount: string;
      }[] = laborPayrollRows.map((row) => {
        const entryId = row.id;
        const netAmount =
          parseFloat(String(row.totalAmount || "0")) -
          (reimbByEntryId[entryId] || 0);
        return {
          name:
            row.firstName && row.lastName
              ? `${row.firstName} ${row.lastName}`
              : "Employee",
          month: row.month,
          year: row.year,
          workingDays: row.workingDays,
          amount: Math.max(0, netAmount).toFixed(2),
        };
      });
      let totalLaborCost = laborItems.reduce(
        (sum, item) => sum + parseFloat(item.amount),
        0,
      );

      // Consumables breakdown
      const consumableItems: {
        name: string;
        quantity: number;
        unitCost: string;
        amount: string;
        date: string | null;
      }[] = [];
      let totalConsumablesCost = 0;
      const consumableRecords = await db
        .select()
        .from(projectConsumables)
        .where(eq(projectConsumables.projectId, projectId));
      for (const record of consumableRecords) {
        const cItems = await db
          .select({
            quantity: projectConsumableItems.quantity,
            unitCost: projectConsumableItems.unitCost,
            itemName: inventoryItems.name,
          })
          .from(projectConsumableItems)
          .leftJoin(
            inventoryItems,
            eq(projectConsumableItems.inventoryItemId, inventoryItems.id),
          )
          .where(
            and(
              eq(projectConsumableItems.consumableId, record.id),
              isNotNull(projectConsumableItems.inventoryItemId),
            ),
          );
        for (const ci of cItems) {
          if (ci.unitCost) {
            const unitCost = parseFloat(ci.unitCost);
            const amount = unitCost * ci.quantity;
            totalConsumablesCost += amount;
            consumableItems.push({
              name: ci.itemName || "Unknown item",
              quantity: ci.quantity,
              unitCost: unitCost.toFixed(2),
              amount: amount.toFixed(2),
              date: record.date ? String(record.date) : null,
            });
          }
        }
      }

      // Asset rental breakdown
      const assetRentalItems: {
        name: string;
        startDate: string;
        endDate: string;
        monthlyRate: string;
        amount: string;
      }[] = [];
      let totalAssetRentalCost = 0;
      const assetAssignments =
        await this.getProjectAssetInstanceAssignments(projectId);
      for (const assignment of assetAssignments) {
        const rentalCost = await this.calculateAssetRentalCost(
          new Date(assignment.startDate),
          new Date(assignment.endDate),
          assignment.monthlyRate,
        );
        totalAssetRentalCost += rentalCost;
        assetRentalItems.push({
          name:
            (assignment as any).assetName || `Asset #${assignment.instanceId}`,
          startDate: String(assignment.startDate),
          endDate: String(assignment.endDate),
          monthlyRate: String(assignment.monthlyRate || "0"),
          amount: rentalCost.toFixed(2),
        });
      }

      // Calculate totals
      const purchaseTotal = purchaseItems.reduce(
        (sum, item) => sum + parseFloat(item.amount),
        0,
      );
      const reimbursementTotal = reimbursementItems.reduce(
        (sum, item) => sum + parseFloat(item.amount),
        0,
      );

      // Calculate total revenue from payments (convert to AED using exchange
      // rate), EXCLUDING VAT. A payment settles the gross invoice, part of which
      // is output VAT owed to the tax authority rather than income. Apportion it
      // out by the invoice's own net share ((total - tax) / total) so this
      // reconciles with project cost, which is likewise net of its input VAT.
      const totalRevenue = projectInvoicePaymentsRaw.reduce((sum, payment) => {
        const exchangeRate = parseFloat(payment.invoiceExchangeRate || "1");
        const invTotal = parseFloat(payment.invoiceTotalAmount || "0");
        const invTax = parseFloat(payment.invoiceTaxAmount || "0");
        const netShare = invTotal > 0 ? (invTotal - invTax) / invTotal : 1;
        return (
          sum + parseFloat(payment.amount || "0") * netShare * exchangeRate
        );
      }, 0);

      // Get project cost
      const totalCost = parseFloat(project.actualCost || "0");

      // Calculate profit/loss
      const profit = totalRevenue - totalCost;

      return {
        projectId,
        totalRevenue: totalRevenue.toFixed(2),
        totalCost: totalCost.toFixed(2),
        profit: profit.toFixed(2),
        invoicePayments: projectInvoicePayments,
        expenses: {
          purchaseItems,
          reimbursements: reimbursementItems,
          laborItems,
          consumableItems,
          assetRentalItems,
          purchaseTotal: purchaseTotal.toFixed(2),
          reimbursementTotal: reimbursementTotal.toFixed(2),
          laborTotal: totalLaborCost.toFixed(2),
          consumablesTotal: totalConsumablesCost.toFixed(2),
          assetRentalTotal: totalAssetRentalCost.toFixed(2),
        },
      };
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getProjectRevenue (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getProjectRevenue",
        severity: "error",
      });
      throw error;
    }
  }

  async updateProjectRevenue(projectId: number): Promise<void> {
    try {
      // Sum total invoice amounts (in AED) for all approved sales invoices linked to this project.
      // Revenue is recognised on accrual basis (invoice approval), not cash basis (payment received).
      // Only count invoices that have been formally approved: approved, unpaid, partially_paid, paid, overdue.
      // Excluded: draft (not submitted), pending_approval (awaiting review), cancelled (voided), rejected (denied).
      const approvedStatuses = [
        "approved",
        "unpaid",
        "partially_paid",
        "paid",
        "overdue",
      ];
      const activeInvoices = await db
        .select({
          totalAmount: salesInvoices.totalAmount,
          taxAmount: salesInvoices.taxAmount,
          exchangeRate: salesInvoices.exchangeRate,
        })
        .from(salesInvoices)
        .where(
          and(
            eq(salesInvoices.projectId, projectId),
            inArray(salesInvoices.status, approvedStatuses),
          ),
        );

      // Recognise revenue EXCLUDING VAT. Output VAT is collected on behalf of
      // the tax authority and is a liability, never income — the GL books it to
      // VAT/GST Payable, not Sales Revenue. Summing the gross total here would
      // overstate project profit by the VAT on every invoice, and would not
      // reconcile to GL Sales Revenue (which is net) or to project cost (which
      // is also net of its input VAT).
      const totalRevenue = activeInvoices.reduce((sum, inv) => {
        const amount =
          parseFloat(inv.totalAmount || "0") - parseFloat(inv.taxAmount || "0");
        const rate = parseFloat(inv.exchangeRate || "1");
        return sum + amount * rate;
      }, 0);

      // Credit notes reduce revenue. In the ledger a credit note debits Sales
      // Returns and Allowances — a contra-revenue account — so true revenue is
      // Sales Revenue less Sales Returns. Summing invoices alone counts only
      // the first half and overstates the project by every credit note raised
      // against it.
      //
      // Only ISSUED notes count: a draft has posted nothing, and a cancelled
      // one has had its postings reversed, so deducting either would understate
      // revenue. Netted of VAT like the invoice side, and converted at the
      // credit note's OWN exchange rate — which is what the ledger uses, and
      // does not always match its invoice's currency.
      //
      // credit_notes carries no projectId, so the project comes from the
      // invoice it credits.
      const projectCreditNotes = await db
        .select({
          totalAmount: creditNotes.totalAmount,
          taxAmount: creditNotes.taxAmount,
          exchangeRate: creditNotes.exchangeRate,
        })
        .from(creditNotes)
        .innerJoin(
          salesInvoices,
          eq(salesInvoices.id, creditNotes.salesInvoiceId),
        )
        .where(
          and(
            eq(salesInvoices.projectId, projectId),
            inArray(salesInvoices.status, approvedStatuses),
            eq(creditNotes.status, "issued"),
          ),
        );

      const totalCredited = projectCreditNotes.reduce((sum, cn) => {
        const amount =
          parseFloat(cn.totalAmount || "0") - parseFloat(cn.taxAmount || "0");
        const rate = parseFloat(cn.exchangeRate || "1");
        return sum + amount * rate;
      }, 0);

      const netRevenue = totalRevenue - totalCredited;

      await this.updateProject(projectId, {
        totalRevenue: netRevenue.toFixed(2),
      });

      console.log(
        `Updated project ${projectId} total revenue to ${netRevenue.toFixed(2)} ` +
          `(${activeInvoices.length} invoice(s) ${totalRevenue.toFixed(2)} less ` +
          `${projectCreditNotes.length} credit note(s) ${totalCredited.toFixed(2)})`,
      );
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateProjectRevenue (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateProjectRevenue",
        severity: "error",
      });
      throw error;
    }
  }

  // Asset Types methods
  async getAssetTypes(): Promise<any[]> {
    try {
      const assetTypesWithCounts = await db
        .select({
          id: assetTypes.id,
          name: assetTypes.name,
          category: assetTypes.category,
          description: assetTypes.description,
          manufacturer: assetTypes.manufacturer,
          model: assetTypes.model,
          specifications: assetTypes.specifications,
          defaultDailyRentalRate: assetTypes.defaultDailyRentalRate,
          depreciationRate: assetTypes.depreciationRate,
          warrantyPeriodMonths: assetTypes.warrantyPeriodMonths,
          maintenanceIntervalDays: assetTypes.maintenanceIntervalDays,
          totalQuantity: assetTypes.totalQuantity,
          availableQuantity: assetTypes.availableQuantity,
          assignedQuantity: assetTypes.assignedQuantity,
          maintenanceQuantity: assetTypes.maintenanceQuantity,
          isActive: assetTypes.isActive,
          createdAt: assetTypes.createdAt,
        })
        .from(assetTypes)
        .where(eq(assetTypes.isActive, true))
        .orderBy(assetTypes.name);

      return assetTypesWithCounts;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getAssetTypes: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getAssetTypes",
        severity: "error",
      });
      throw error;
    }
  }

  async createAssetType(assetTypeData: any): Promise<any> {
    try {
      const result = await db
        .insert(assetTypes)
        .values({
          ...assetTypeData,
          totalQuantity: 0,
          availableQuantity: 0,
          assignedQuantity: 0,
          maintenanceQuantity: 0,
          isActive: true,
        })
        .returning();

      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createAssetType: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createAssetType",
        severity: "error",
      });
      throw error;
    }
  }

  async updateAssetType(id: number, assetTypeData: any): Promise<any> {
    try {
      const result = await db
        .update(assetTypes)
        .set(assetTypeData)
        .where(eq(assetTypes.id, id))
        .returning();

      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateAssetType (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateAssetType",
        severity: "error",
      });
      throw error;
    }
  }

  // Project Asset Assignment methods // THIS IS THE SECOND BLOCK OF ASSET ASSIGNMENT METHODS
  async getProjectAssetAssignments(
    projectId: number,
  ): Promise<ProjectAssetAssignmentWithAssetInfo[]> {
    try {
      const assignments: ProjectAssetAssignmentWithAssetInfo[] = await db
        .select({
          id: projectAssetAssignments.id,
          projectId: projectAssetAssignments.projectId,
          assetId: projectAssetAssignments.assetId,
          startDate: projectAssetAssignments.startDate,
          endDate: projectAssetAssignments.endDate,
          monthlyRate: projectAssetAssignments.monthlyRate,
          totalCost: projectAssetAssignments.totalCost,
          assignedAt: projectAssetAssignments.assignedAt,
          assetName: assetTypes.name,
          assetCode: assetInventoryInstances.serialNumber,
        })
        .from(projectAssetAssignments)
        .leftJoin(
          assetInventoryInstances,
          eq(projectAssetAssignments.assetId, assetInventoryInstances.id),
        )
        .leftJoin(
          assetTypes,
          eq(assetInventoryInstances.assetTypeId, assetTypes.id),
        )
        .where(eq(projectAssetAssignments.projectId, projectId))
        .orderBy(desc(projectAssetAssignments.assignedAt));

      return assignments;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getProjectAssetAssignments (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getProjectAssetAssignments (second block)",
        severity: "error",
      });
      throw error;
    }
  }

  async createProjectAssetAssignment(
    assignmentData: InsertProjectAssetAssignment,
  ): Promise<ProjectAssetAssignment> {
    try {
      const result = await db
        .insert(projectAssetAssignments)
        .values(assignmentData)
        .returning();

      const assignment = result[0];

      // Update asset status to assigned
      await this.updateAssetInventoryInstance(assignment.assetId, {
        status: "in_use",
      });

      // Calculate and update total cost if start and end dates are provided
      if (
        assignment.startDate &&
        assignment.endDate &&
        assignment.monthlyRate
      ) {
        const totalCost = await this.calculateAssetRentalCost(
          new Date(assignment.startDate),
          new Date(assignment.endDate),
          parseFloat(assignment.monthlyRate.toString()),
        );

        await db
          .update(projectAssetAssignments)
          .set({ totalCost: totalCost.toString() })
          .where(eq(projectAssetAssignments.id, assignment.id));
      }

      // Recalculate project cost
      await this.recalculateProjectCost(assignment.projectId);

      return assignment;
    } catch (error: any) {
      console.error(
        "Original error in createProjectAssetAssignment (second block):",
        error,
      ); // Keep original console.error
      await this.createErrorLog({
        message:
          "Error in createProjectAssetAssignment (second block): " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createProjectAssetAssignment (second block)",
        severity: "error",
      });
      throw error;
    }
  }

  async updateProjectAssetAssignment(
    id: number,
    assignmentData: Partial<InsertProjectAssetAssignment>,
  ): Promise<ProjectAssetAssignment | undefined> {
    try {
      const result = await db
        .update(projectAssetAssignments)
        .set(assignmentData)
        .where(eq(projectAssetAssignments.id, id))
        .returning();

      const assignment = result[0];

      if (assignment) {
        // Recalculate total cost if dates or daily rate changed
        if (
          assignment.startDate &&
          assignment.endDate &&
          assignment.monthlyRate &&
          (assignmentData.startDate ||
            assignmentData.endDate ||
            assignmentData.monthlyRate)
        ) {
          const totalCost = await this.calculateAssetRentalCost(
            new Date(assignment.startDate),
            new Date(assignment.endDate),
            parseFloat(assignment.monthlyRate.toString()),
          );

          await db
            .update(projectAssetAssignments)
            .set({ totalCost: totalCost.toString() })
            .where(eq(projectAssetAssignments.id, id));
        }

        // Recalculate project cost
        await this.recalculateProjectCost(assignment.projectId);
      }

      return assignment;
    } catch (error: any) {
      console.error(
        "Original error in updateProjectAssetAssignment (second block):",
        error,
      ); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in updateProjectAssetAssignment (second block, id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateProjectAssetAssignment (second block)",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteProjectAssetAssignment(id: number): Promise<boolean> {
    try {
      // Get assignment info before deletion
      const assignment = await db
        .select()
        .from(projectAssetAssignments)
        .where(eq(projectAssetAssignments.id, id))
        .limit(1);

      if (assignment.length === 0) {
        return false;
      }

      const assetId = assignment[0].assetId;
      const projectId = assignment[0].projectId;

      // Delete the assignment
      const result = await db
        .delete(projectAssetAssignments)
        .where(eq(projectAssetAssignments.id, id));

      if (result.length && result.length > 0) {
        // Update asset status based on remaining assignments
        await this.updateAssetStatusBasedOnAssignments(assetId);

        // Recalculate project cost
        await this.recalculateProjectCost(projectId);

        return true;
      }

      return false;
    } catch (error: any) {
      console.error(
        "Original error in deleteProjectAssetAssignment (second block):",
        error,
      ); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in deleteProjectAssetAssignment (second block, id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteProjectAssetAssignment (second block)",
        severity: "error",
      });
      throw error;
    }
  }

  async calculateAssetRentalCost(
    // This is the second calculateAssetRentalCost
    startDate: Date,
    endDate: Date,
    monthlyRate: number,
  ): Promise<number> {
    try {
      // Calculate pro-rated cost based on days utilized * (Monthly rent / days in that month)
      // If usage spans multiple months, calculate cost for each month separately

      let totalCost = 0;
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        // Get the first and last day of the current month
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const daysInMonth = lastDayOfMonth.getDate();

        // Determine the start and end of the period within this month
        const periodStart = currentDate >= startDate ? currentDate : startDate;
        const periodEnd = endDate <= lastDayOfMonth ? endDate : lastDayOfMonth;

        // Calculate days used in this month (inclusive of both start and end dates)
        const diffTime = periodEnd.getTime() - periodStart.getTime();
        const daysUsedInMonth = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        // Calculate pro-rated cost for this month
        const dailyRateForMonth = monthlyRate / daysInMonth;
        const costForMonth = daysUsedInMonth * dailyRateForMonth;

        totalCost += costForMonth;

        // Move to the first day of the next month
        currentDate.setMonth(currentDate.getMonth() + 1);
        currentDate.setDate(1);
      }

      return totalCost;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in calculateAssetRentalCost (second block): " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "calculateAssetRentalCost (second block)",
        severity: "error",
      });
      throw error;
    }
  }

  async getAssetAssignmentHistory(assetId: number): Promise<any[]> {
    try {
      const history: AssetAssignmentHistoryEntry[] = await db
        .select({
          id: projectAssetAssignments.id,
          projectId: projectAssetAssignments.projectId,
          projectTitle: projects.title,
          startDate: projectAssetAssignments.startDate,
          endDate: projectAssetAssignments.endDate,
          monthlyRate: projectAssetAssignments.monthlyRate,
          totalCost: projectAssetAssignments.totalCost,
          assignedAt: projectAssetAssignments.assignedAt,
        })
        .from(projectAssetAssignments)
        .leftJoin(projects, eq(projectAssetAssignments.projectId, projects.id))
        .where(eq(projectAssetAssignments.assetId, assetId))
        .orderBy(desc(projectAssetAssignments.assignedAt));

      return history;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getAssetAssignmentHistory (second block, assetId: ${assetId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getAssetAssignmentHistory (second block)",
        severity: "error",
      });
      throw error;
    }
  }

  async getAllAssetAssignments(): Promise<AllAssetAssignmentsEntry[]> {
    try {
      const assignments: AllAssetAssignmentsEntry[] = await db
        .select({
          id: projectAssetAssignments.id,
          projectId: projectAssetAssignments.projectId,
          projectTitle: projects.title,
          assetId: projectAssetAssignments.assetId,
          assetName: assetTypes.name,
          assetCode: assetInventoryInstances.barcode,
          startDate: projectAssetAssignments.startDate,
          endDate: projectAssetAssignments.endDate,
          monthlyRate: projectAssetAssignments.monthlyRate,
          totalCost: projectAssetAssignments.totalCost,
          assignedAt: projectAssetAssignments.assignedAt,
        })
        .from(projectAssetAssignments)
        .leftJoin(projects, eq(projectAssetAssignments.projectId, projects.id))
        .leftJoin(
          assetInventoryInstances,
          eq(projectAssetAssignments.assetId, assetInventoryInstances.id),
        )
        .leftJoin(
          assetTypes,
          eq(assetInventoryInstances.assetTypeId, assetTypes.id),
        )
        .orderBy(desc(projectAssetAssignments.assignedAt));

      return assignments;
    } catch (error: any) {
      console.error("Error in getAllAssetAssignments:", error);
      throw error;
    }
  }

  async updateAssetStatusBasedOnAssignments(assetId: number): Promise<void> {
    try {
      // Get current assignments for this asset
      const currentAssignments = await db
        .select()
        .from(projectAssetAssignments)
        .where(
          and(
            eq(projectAssetAssignments.assetId, assetId),
            or(
              isNull(projectAssetAssignments.endDate),
              gte(projectAssetAssignments.endDate, new Date()),
            ),
          ),
        );

      // Update asset status based on assignments
      const newStatus =
        currentAssignments.length > 0 ? "assigned" : "available";

      await this.updateAsset(assetId, { status: newStatus });

      console.log(
        `Updated asset ${assetId} status to ${newStatus} based on ${currentAssignments.length} active assignments`,
      );
    } catch (error: any) {
      console.error(
        "Original error in updateAssetStatusBasedOnAssignments (second block):",
        error,
      ); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in updateAssetStatusBasedOnAssignments (second block, assetId: ${assetId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateAssetStatusBasedOnAssignments (second block)",
        severity: "error",
      });
      throw error;
    }
  }

  // Method to update all asset statuses (useful for maintenance/cron jobs)
  async updateAllAssetStatuses(): Promise<void> {
    try {
      const allAssets = await this.getAssets();

      for (const asset of allAssets) {
        await this.updateAssetStatusBasedOnAssignments(asset.id);
      }

      console.log(`Updated status for ${allAssets.length} assets`);
    } catch (error: any) {
      console.error("Original error in updateAllAssetStatuses:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          "Error in updateAllAssetStatuses: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateAllAssetStatuses",
        severity: "error",
      });
      throw error;
    }
  }

  // Project Asset Instance Assignment methods (new)
  async getProjectAssetInstanceAssignments(projectId: number): Promise<any[]> {
    try {
      const assignments = await db
        .select({
          id: projectAssetInstanceAssignments.id,
          projectId: projectAssetInstanceAssignments.projectId,
          assetTypeId: projectAssetInstanceAssignments.assetTypeId,
          instanceId: projectAssetInstanceAssignments.instanceId,
          barcode: projectAssetInstanceAssignments.barcode,
          serialNumber: projectAssetInstanceAssignments.serialNumber,
          startDate: projectAssetInstanceAssignments.startDate,
          endDate: projectAssetInstanceAssignments.endDate,
          monthlyRate: projectAssetInstanceAssignments.monthlyRate,
          totalCost: projectAssetInstanceAssignments.totalCost,
          status: projectAssetInstanceAssignments.status,
          assignedBy: projectAssetInstanceAssignments.assignedBy,
          assignedAt: projectAssetInstanceAssignments.assignedAt,
          returnedAt: projectAssetInstanceAssignments.returnedAt,
          notes: projectAssetInstanceAssignments.notes,
          assetTypeName: assetTypes.name,
          assetTag: assetInventoryInstances.assetTag,
        })
        .from(projectAssetInstanceAssignments)
        .leftJoin(
          assetInventoryInstances,
          eq(
            projectAssetInstanceAssignments.instanceId,
            assetInventoryInstances.id,
          ),
        )
        .leftJoin(
          assetTypes,
          eq(projectAssetInstanceAssignments.assetTypeId, assetTypes.id),
        )
        .where(eq(projectAssetInstanceAssignments.projectId, projectId))
        .orderBy(desc(projectAssetInstanceAssignments.assignedAt));

      return assignments;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getProjectAssetInstanceAssignments (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getProjectAssetInstanceAssignments",
        severity: "error",
      });
      throw error;
    }
  }

  async getAllAssetInstanceAssignments(): Promise<any[]> {
    try {
      const assignments = await db
        .select({
          id: projectAssetInstanceAssignments.id,
          projectId: projectAssetInstanceAssignments.projectId,
          projectTitle: projects.title,
          assetTypeId: projectAssetInstanceAssignments.assetTypeId,
          instanceId: projectAssetInstanceAssignments.instanceId,
          barcode: projectAssetInstanceAssignments.barcode,
          serialNumber: projectAssetInstanceAssignments.serialNumber,
          startDate: projectAssetInstanceAssignments.startDate,
          endDate: projectAssetInstanceAssignments.endDate,
          monthlyRate: projectAssetInstanceAssignments.monthlyRate,
          totalCost: projectAssetInstanceAssignments.totalCost,
          status: projectAssetInstanceAssignments.status,
          assignedAt: projectAssetInstanceAssignments.assignedAt,
          assetTypeName: assetTypes.name,
          assetTypeCategory: assetTypes.category,
          assetTag: assetInventoryInstances.assetTag,
          instanceMonthlyRental: assetInventoryInstances.monthlyRentalAmount,
          instanceAcquisitionCost: assetInventoryInstances.acquisitionCost,
          instanceStatus: assetInventoryInstances.status,
        })
        .from(projectAssetInstanceAssignments)
        .leftJoin(
          projects,
          eq(projectAssetInstanceAssignments.projectId, projects.id),
        )
        .leftJoin(
          assetInventoryInstances,
          eq(
            projectAssetInstanceAssignments.instanceId,
            assetInventoryInstances.id,
          ),
        )
        .leftJoin(
          assetTypes,
          eq(projectAssetInstanceAssignments.assetTypeId, assetTypes.id),
        )
        .orderBy(desc(projectAssetInstanceAssignments.assignedAt));

      return assignments;
    } catch (error: any) {
      console.error("Error in getAllAssetInstanceAssignments:", error);
      return [];
    }
  }

  async createProjectAssetInstanceAssignment(
    assignmentData: InsertProjectAssetInstanceAssignment,
  ): Promise<ProjectAssetInstanceAssignment> {
    try {
      const result = await db
        .insert(projectAssetInstanceAssignments)
        .values(assignmentData)
        .returning();
      const assignment = result[0];

      // Calculate and update total cost if start and end dates are provided
      if (
        assignment.startDate &&
        assignment.endDate &&
        assignment.monthlyRate
      ) {
        const totalCost = await this.calculateAssetRentalCost(
          new Date(assignment.startDate),
          new Date(assignment.endDate),
          parseFloat(assignment.monthlyRate.toString()),
        );

        await db
          .update(projectAssetInstanceAssignments)
          .set({ totalCost: totalCost.toString() })
          .where(eq(projectAssetInstanceAssignments.id, assignment.id));
      }

      // Update asset instance status to in_use
      if (assignment.instanceId) {
        await this.updateAssetInventoryInstance(assignment.instanceId, {
          status: "in_use",
          assignedProjectId: assignment.projectId,
        });
      }

      // Recalculate project cost
      await this.recalculateProjectCost(assignment.projectId);

      return assignment;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createProjectAssetInstanceAssignment: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createProjectAssetInstanceAssignment",
        severity: "error",
      });
      throw error;
    }
  }

  async updateProjectAssetInstanceAssignment(
    id: number,
    assignmentData: Partial<InsertProjectAssetInstanceAssignment>,
  ): Promise<ProjectAssetInstanceAssignment | undefined> {
    try {
      const result = await db
        .update(projectAssetInstanceAssignments)
        .set(assignmentData)
        .where(eq(projectAssetInstanceAssignments.id, id))
        .returning();

      const assignment = result[0];

      if (assignment) {
        // Recalculate total cost if dates or rate changed
        if (
          assignment.startDate &&
          assignment.endDate &&
          assignment.monthlyRate &&
          (assignmentData.startDate ||
            assignmentData.endDate ||
            assignmentData.monthlyRate)
        ) {
          const totalCost = await this.calculateAssetRentalCost(
            new Date(assignment.startDate),
            new Date(assignment.endDate),
            parseFloat(assignment.monthlyRate.toString()),
          );

          await db
            .update(projectAssetInstanceAssignments)
            .set({ totalCost: totalCost.toString() })
            .where(eq(projectAssetInstanceAssignments.id, id));
        }

        // Recalculate project cost
        await this.recalculateProjectCost(assignment.projectId);
      }

      return assignment;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateProjectAssetInstanceAssignment (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateProjectAssetInstanceAssignment",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteProjectAssetInstanceAssignment(id: number): Promise<boolean> {
    try {
      // Get assignment details before deleting
      const assignment = await db
        .select()
        .from(projectAssetInstanceAssignments)
        .where(eq(projectAssetInstanceAssignments.id, id))
        .limit(1);

      if (assignment.length === 0) {
        return false;
      }

      const { projectId, instanceId } = assignment[0];

      // Delete the assignment
      const result = await db
        .delete(projectAssetInstanceAssignments)
        .where(eq(projectAssetInstanceAssignments.id, id))
        .returning({ id: projectAssetInstanceAssignments.id });

      if (result.length > 0) {
        // Update asset instance status back to available if no other active assignments
        if (instanceId) {
          const activeAssignments = await db
            .select()
            .from(projectAssetInstanceAssignments)
            .where(
              and(
                eq(projectAssetInstanceAssignments.instanceId, instanceId),
                eq(projectAssetInstanceAssignments.status, "active"),
              ),
            );

          if (activeAssignments.length === 0) {
            await this.updateAssetInventoryInstance(instanceId, {
              status: "available",
              assignedProjectId: null,
            });
          }
        }

        // Recalculate project cost
        await this.recalculateProjectCost(projectId);

        return true;
      }

      return false;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deleteProjectAssetInstanceAssignment (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteProjectAssetInstanceAssignment",
        severity: "error",
      });
      throw error;
    }
  }

  // Project Consumables methods
  async getProjectConsumables(
    projectId: number,
    fromDate?: string,
    toDate?: string,
  ): Promise<ProjectConsumableWithItems[]> {
    try {
      const conditions: any[] = [eq(projectConsumables.projectId, projectId)];

      if (fromDate) {
        conditions.push(gte(projectConsumables.date, new Date(fromDate)));
      }

      if (toDate) {
        const endOfDay = new Date(toDate);
        endOfDay.setHours(23, 59, 59, 999);
        conditions.push(lte(projectConsumables.date, endOfDay));
      }
      const consumables: Array<Omit<ProjectConsumableWithItems, "items">> =
        await db
          .select({
            id: projectConsumables.id,
            projectId: projectConsumables.projectId,
            date: projectConsumables.date,
            createdBy: projectConsumables.recordedBy,
            createdAt: projectConsumables.recordedAt,
            createdByName: users.username,
            goodsIssueRef: (projectConsumables as any).goodsIssueRef,
          })
          .from(projectConsumables)
          .leftJoin(users, eq(projectConsumables.recordedBy, users.id))
          .where(and(...conditions))
          .orderBy(desc(projectConsumables.date));

      // Get items for each consumable record
      const consumablesWithItems: ProjectConsumableWithItems[] =
        await Promise.all(
          consumables.map(async (consumable) => {
            const items: ProjectConsumableItemWithDetails[] = await db
              .select({
                id: projectConsumableItems.id,
                consumableId: projectConsumableItems.consumableId,
                inventoryItemId: projectConsumableItems.inventoryItemId,
                quantity: projectConsumableItems.quantity,
                unitCost: projectConsumableItems.unitCost,
                itemName:
                  sql<string>`COALESCE(${inventoryItems.name}, ${projectConsumableItems.itemName})`.as(
                    "item_name",
                  ),
                itemUnit:
                  sql<string>`COALESCE(${inventoryItems.unit}, ${projectConsumableItems.itemUnit})`.as(
                    "item_unit",
                  ),
              })
              .from(projectConsumableItems)
              .leftJoin(
                inventoryItems,
                eq(projectConsumableItems.inventoryItemId, inventoryItems.id),
              )
              .where(eq(projectConsumableItems.consumableId, consumable.id));

            return {
              ...consumable,
              items,
            };
          }),
        );

      return consumablesWithItems;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getProjectConsumables (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getProjectConsumables",
        severity: "error",
      });
      throw error;
    }
  }

  async createProjectConsumables(
    projectId: number,
    date: string,
    items: CreateProjectConsumableItemInput[],
    userId?: number,
  ): Promise<CreatedProjectConsumable> {
    try {
      console.log("Creating project consumables:", {
        projectId,
        date,
        items,
        userId,
      });

      // Create the consumable record
      const [consumable] = await db
        .insert(projectConsumables)
        .values({
          projectId: projectId,
          date: new Date(date),
          recordedBy: userId || null,
        })
        .returning();

      console.log("Created consumable record:", consumable);

      // Process each item
      const consumableItems = [];
      for (const item of items) {
        if (item.inventoryItemId) {
          // Inventory item - deduct from stock
          const inventoryItem = await this.getInventoryItem(
            item.inventoryItemId,
          );
          if (!inventoryItem) {
            throw new Error(
              `Inventory item with ID ${item.inventoryItemId} not found`,
            );
          }

          if (inventoryItem.currentStock < item.quantity) {
            throw new Error(
              `Insufficient stock for item ${inventoryItem.name}. Available: ${inventoryItem.currentStock}, Requested: ${item.quantity}`,
            );
          }

          const unitCost = inventoryItem.avgCost || "0";

          const [consumableItem] = await db
            .insert(projectConsumableItems)
            .values({
              consumableId: consumable.id,
              inventoryItemId: item.inventoryItemId,
              quantity: item.quantity,
              unitCost: unitCost,
            })
            .returning();

          consumableItems.push(consumableItem);

          const newStock = inventoryItem.currentStock - item.quantity;
          await this.updateInventoryItem(item.inventoryItemId, {
            currentStock: newStock,
          });

          await db.insert(inventoryTransactions).values({
            itemId: item.inventoryItemId,
            type: "outflow",
            quantity: item.quantity,
            unitCost: unitCost,
            remainingQuantity: 0,
            projectId: projectId,
            reference: `Project Consumables - ${date}`,
            createdBy: userId || null,
            consumableId: consumable.id,
          } as any);

          console.log(
            `Updated inventory item ${item.inventoryItemId} stock from ${inventoryItem.currentStock} to ${newStock}`,
          );
        } else {
          // Manual entry - no inventory deduction
          const [consumableItem] = await db
            .insert(projectConsumableItems)
            .values({
              consumableId: consumable.id,
              inventoryItemId: null,
              quantity: item.quantity,
              unitCost: item.unitCost || "0",
              itemName: item.itemName || "Manual Item",
              itemUnit: item.itemUnit || "pcs",
            })
            .returning();

          consumableItems.push(consumableItem);

          console.log(
            `Added manual consumable item: ${item.itemName}, qty: ${item.quantity}`,
          );
        }
      }

      // Recalculate project cost after adding consumables
      await this.recalculateProjectCost(projectId);

      return {
        ...consumable,
        items: consumableItems,
      };
    } catch (error: any) {
      console.error("Original error in createProjectConsumables:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          "Error in createProjectConsumables: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createProjectConsumables",
        severity: "error",
      });
      throw error;
    }
  }

  async updateProjectConsumableItem(
    itemId: number,
    projectId: number,
    data: {
      itemName: string;
      itemUnit: string;
      quantity: number;
      unitCost: number | string;
    },
  ): Promise<any> {
    try {
      // Check if the item is a manual entry (inventoryItemId is null)
      const existingItem = await db
        .select()
        .from(projectConsumableItems)
        .where(eq(projectConsumableItems.id, itemId))
        .limit(1);

      if (!existingItem.length || existingItem[0].inventoryItemId !== null) {
        throw new Error("Only manual consumable items can be edited.");
      }

      const result = await db
        .update(projectConsumableItems)
        .set({
          itemName: data.itemName,
          itemUnit: data.itemUnit,
          quantity: data.quantity,
          unitCost: data.unitCost.toString(),
        })
        .where(eq(projectConsumableItems.id, itemId))
        .returning();

      // Recalculate project cost after update
      await this.recalculateProjectCost(projectId);

      return result[0];
    } catch (error: any) {
      console.error("Error in updateProjectConsumableItem:", error);
      throw error;
    }
  }

  async createConsumablesGoodsIssue(
    projectId: number,
    consumableIds: number[],
    userId?: number,
  ): Promise<{ goodsIssueRef: string; updatedCount: number }> {
    try {
      const timestamp = Date.now();
      const goodsIssueRef = `GI-CONS-${timestamp}`;

      // Update inventory_transactions reference for all transactions linked to these consumable records
      for (const consumableId of consumableIds) {
        await db
          .update(inventoryTransactions)
          .set({ reference: goodsIssueRef } as any)
          .where(eq((inventoryTransactions as any).consumableId, consumableId));

        // Mark the consumable record as issued
        await db
          .update(projectConsumables)
          .set({ goodsIssueRef } as any)
          .where(eq(projectConsumables.id, consumableId));
      }

      return { goodsIssueRef, updatedCount: consumableIds.length };
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createConsumablesGoodsIssue: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createConsumablesGoodsIssue",
        severity: "error",
      });
      throw error;
    }
  }

  // Project Photo Group methods
  async getProjectPhotoGroups(projectId: number): Promise<ProjectPhotoGroup[]> {
    try {
      const groups = await db
        .select({
          ...getTableColumns(projectPhotoGroups),
          dailyActivity: {
            id: dailyActivities.id,
            date: dailyActivities.date,
            location: dailyActivities.location,
            completedTasks: dailyActivities.completedTasks,
          },
        })
        .from(projectPhotoGroups)
        .leftJoin(
          dailyActivities,
          eq(projectPhotoGroups.dailyActivityId, dailyActivities.id),
        )
        .where(eq(projectPhotoGroups.projectId, projectId))
        .orderBy(desc(projectPhotoGroups.createdAt));

      const groupIds = groups.map((g) => g.id);
      if (groupIds.length === 0) {
        return [];
      }

      const photos = await db
        .select()
        .from(projectPhotos)
        .where(inArray(projectPhotos.groupId, groupIds));

      return groups.map((group) => ({
        ...group,
        photos: photos.filter((p) => p.groupId === group.id),
      }));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getProjectPhotoGroups (projectId: ${projectId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getProjectPhotoGroups",
        severity: "error",
      });
      throw error;
    }
  }

  async createProjectPhotoGroup(
    groupData: InsertProjectPhotoGroup,
  ): Promise<ProjectPhotoGroup> {
    try {
      const result = await db
        .insert(projectPhotoGroups)
        .values(groupData)
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createProjectPhotoGroup: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createProjectPhotoGroup",
        severity: "error",
      });
      throw error;
    }
  }

  async addPhotosToPhotoGroup(
    groupId: number,
    photosData: Omit<InsertProjectPhoto, "groupId">[],
  ): Promise<ProjectPhoto[]> {
    if (!photosData || photosData.length === 0) {
      return [];
    }

    const photosToInsert = photosData.map((photo) => ({
      ...photo,
      groupId: groupId,
    }));

    const savedPhotos = await db
      .insert(projectPhotos)
      .values(photosToInsert)
      .returning();

    return savedPhotos;
  }

  async updateProjectPhotoGroup(
    id: number,
    groupData: Partial<InsertProjectPhotoGroup>,
  ): Promise<ProjectPhotoGroup | undefined> {
    try {
      const result = await db
        .update(projectPhotoGroups)
        .set(groupData)
        .where(eq(projectPhotoGroups.id, id))
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateProjectPhotoGroup (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateProjectPhotoGroup",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteProjectPhotoGroup(id: number): Promise<boolean> {
    try {
      await db.transaction(async (tx) => {
        // 1. Get all photos in the group
        const photosToDelete = await tx
          .select()
          .from(projectPhotos)
          .where(eq(projectPhotos.groupId, id));

        // 2. Delete photo files from the filesystem
        for (const photo of photosToDelete) {
          if (photo.filePath) {
            // filePath is stored as '/uploads/...', remove leading '/' for fs operations
            const filePath = photo.filePath.substring(1);
            try {
              await fs.unlink(filePath);
            } catch (fileError: any) {
              // If file not found, log it but don't block the deletion process
              if (fileError.code !== "ENOENT") {
                throw fileError; // Re-throw other file system errors
              }
              console.warn(`File not found, skipping deletion: ${filePath}`);
            }
          }
        }

        // 3. Delete photo records from the database
        await tx.delete(projectPhotos).where(eq(projectPhotos.groupId, id));

        // 4. Delete the photo group record
        await tx
          .delete(projectPhotoGroups)
          .where(eq(projectPhotoGroups.id, id));
      });
      return true;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deleteProjectPhotoGroup (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteProjectPhotoGroup",
        severity: "error",
      });
      throw error;
    }
  }

  // Project Photo methods
  async getProjectPhotos(groupId: number): Promise<ProjectPhoto[]> {
    try {
      return await db
        .select()
        .from(projectPhotos)
        .where(eq(projectPhotos.groupId, groupId))
        .orderBy(desc(projectPhotos.createdAt));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getProjectPhotos (groupId: ${groupId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getProjectPhotos",
        severity: "error",
      });
      throw error;
    }
  }

  async createProjectPhoto(
    photoData: InsertProjectPhoto,
  ): Promise<ProjectPhoto> {
    try {
      const result = await db
        .insert(projectPhotos)
        .values(photoData)
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createProjectPhoto: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createProjectPhoto",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteProjectPhoto(photoId: number): Promise<boolean> {
    try {
      const result = await db
        .delete(projectPhotos)
        .where(eq(projectPhotos.id, photoId));
      return result.count > 0;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deleteProjectPhoto (photoId: ${photoId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteProjectPhoto",
        severity: "error",
      });
      throw error;
    }
  }
}
