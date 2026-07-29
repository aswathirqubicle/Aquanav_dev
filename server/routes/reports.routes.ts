import { Router } from "express";
import { dailyActivities } from "../../migrations/schema";
import { db } from "../db";
import {
  desc,
  eq,
} from "drizzle-orm";
import {
  requireAuth,
  requireRole,
} from "../middleware/auth";
// `Storage` is imported alongside the singleton only so the two statement
// routes below can name its concrete type: the singleton is declared as
// `IStorage`, which does not list the ledger reporting methods.
import { Storage, storage } from "../storage";

export const reportsRoutes = Router();

reportsRoutes.get(
  "/api/reports/customer-statement",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const filters = {
        customerId: req.query.customerId
          ? parseInt(req.query.customerId as string)
          : undefined,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      };

      const result = await storage.getCustomerStatement(filters);
      res.json(result);
    } catch (error) {
      console.error("Customer statement report error:", error);
      res
        .status(500)
        .json({ message: "Failed to generate customer statement report" });
    }
  },
);

reportsRoutes.get(
  "/api/reports/supplier-statement",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const filters = {
        supplierId: req.query.supplierId
          ? parseInt(req.query.supplierId as string)
          : undefined,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      };

      const result = await storage.getSupplierStatement(filters);
      res.json(result);
    } catch (error) {
      console.error("Supplier statement report error:", error);
      res
        .status(500)
        .json({ message: "Failed to generate supplier statement report" });
    }
  },
);

reportsRoutes.get(
  "/api/reports/project-location/:projectId",
  requireAuth,
  requireRole(["admin", "project_manager", "finance"]),
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const activities = await db
        .select()
        .from(dailyActivities)
        .where(eq(dailyActivities.projectId, projectId))
        .orderBy(desc(dailyActivities.date));

      const locationMap: Record<
        string,
        {
          totalDays: number;
          dates: string[];
          activities: {
            date: string;
            completedTasks: string | null;
            remarks: string | null;
            hbmDailyRunningHours: string | null;
          }[];
        }
      > = {};

      function extractLocationsFromTasks(text: string): string[] {
        const matches = text.match(/\[([^\]]+)\]/g);
        if (!matches) return [];
        return matches.map((m) => m.slice(1, -1).trim()).filter(Boolean);
      }

      function addToLocationMap(
        loc: string,
        activity: any,
        dateStr: string | null,
      ) {
        if (!locationMap[loc]) {
          locationMap[loc] = { totalDays: 0, dates: [], activities: [] };
        }
        if (dateStr && !locationMap[loc].dates.includes(dateStr)) {
          locationMap[loc].dates.push(dateStr);
          locationMap[loc].totalDays++;
        }
        locationMap[loc].activities.push({
          date: dateStr || "",
          completedTasks: activity.completedTasks,
          remarks: activity.remarks,
          hbmDailyRunningHours: activity.hbmDailyRunningHours,
        });
      }

      for (const activity of activities) {
        const dateStr = activity.date
          ? new Date(activity.date).toISOString().split("T")[0]
          : null;

        const loc = activity.location?.trim();
        if (loc) {
          addToLocationMap(loc, activity, dateStr);
        } else if (activity.completedTasks) {
          const extracted = extractLocationsFromTasks(
            activity.completedTasks,
          );
          if (extracted.length > 0) {
            for (const extractedLoc of extracted) {
              addToLocationMap(extractedLoc, activity, dateStr);
            }
          } else {
            addToLocationMap("Unspecified Location", activity, dateStr);
          }
        } else {
          addToLocationMap("Unspecified Location", activity, dateStr);
        }
      }

      const locations = Object.entries(locationMap)
        .map(([location, data]) => ({
          location,
          totalDays: data.totalDays,
          activities: data.activities,
        }))
        .sort((a, b) => b.totalDays - a.totalDays);

      res.json({
        project: {
          id: project.id,
          title: project.title,
          locations: project.locations || [],
        },
        locationReport: locations,
        totalActivities: activities.length,
      });
    } catch (error) {
      console.error("Project location report error:", error);
      res
        .status(500)
        .json({ message: "Failed to generate project location report" });
    }
  },
);

reportsRoutes.get(
  "/api/reports/profit-loss-entries",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const filters = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        projectId: req.query.projectId
          ? parseInt(req.query.projectId as string)
          : undefined,
      };
      const result = await storage.getProfitLossEntries(filters);
      res.json(result);
    } catch (error) {
      console.error("Get profit loss entries error:", error);
      res.status(500).json({ message: "Failed to get profit loss entries" });
    }
  },
);

reportsRoutes.get(
  "/api/reports/trial-balance",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const filters = {
        asOfDate: req.query.asOfDate as string | undefined,
        // Presence of startDate — not its value — switches the report from an
        // as-at balance to a period movement.
        startDate: req.query.startDate as string | undefined,
        includeZero: req.query.includeZero === "true",
      };
      const result = await (storage as unknown as Storage).getTrialBalance(filters);
      res.json(result);
    } catch (error) {
      console.error("Get trial balance error:", error);
      res.status(500).json({ message: "Failed to get trial balance" });
    }
  },
);

reportsRoutes.get(
  "/api/reports/balance-sheet",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const filters = {
        asOfDate: req.query.asOfDate as string | undefined,
      };
      const result = await (storage as unknown as Storage).getBalanceSheet(filters);
      res.json(result);
    } catch (error) {
      console.error("Get balance sheet error:", error);
      res.status(500).json({ message: "Failed to get balance sheet" });
    }
  },
);

reportsRoutes.get(
  "/api/receivables",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const { customerId, projectId, startDate, endDate } = req.query;
      const filters = {
        customerId: customerId ? parseInt(customerId as string) : undefined,
        projectId: projectId ? parseInt(projectId as string) : undefined,
        startDate: startDate as string,
        endDate: endDate as string,
      };
      const receivables = await storage.getReceivables(filters);
      res.json(receivables);
    } catch (error) {
      console.error("Get receivables error:", error);
      res.status(500).json({ message: "Failed to get receivables" });
    }
  },
);

// Payment file routes
reportsRoutes.get(
  "/api/payments/:id/files",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const paymentId = parseInt(req.params.id);
      const files = await storage.getPaymentFiles(paymentId);
      res.json(files);
    } catch (error) {
      console.error("Get payment files error:", error);
      res.status(500).json({ message: "Failed to get payment files" });
    }
  },
);

/**
 * Employee readiness — who is becoming available to deploy, and when.
 *
 * Defaults to today onward with no end date, which is the question the report
 * exists to answer; a caller can narrow it from either side. Active employees
 * only, and only those with a date set — see storage.getEmployeeReadiness.
 *
 * Project managers need it for resourcing, finance for cost planning, so the
 * gate is wider than most reports.
 */
reportsRoutes.get(
  "/api/reports/employee-readiness",
  requireAuth,
  requireRole(["admin", "project_manager", "finance"]),
  async (req, res) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const startDate =
        typeof req.query.startDate === "string" && req.query.startDate
          ? req.query.startDate
          : today;
      const endDate =
        typeof req.query.endDate === "string" && req.query.endDate
          ? req.query.endDate
          : null;

      const rows = await storage.getEmployeeReadiness(startDate, endDate);
      res.json({ startDate, endDate, employees: rows });
    } catch (error) {
      console.error("Employee readiness report error:", error);
      res
        .status(500)
        .json({ message: "Failed to load employee readiness report" });
    }
  },
);
