import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { assetRoutes } from "./asset-routes";
import bcrypt from "bcrypt";
import session from "express-session";
import multer from "multer";
import path from "path";
import fs from "fs";
import { imageSize } from "image-size";
import {
  insertUserSchema,
  insertProjectSchema,
  insertCustomerSchema,
  insertEmployeeSchema,
  updateEmployeeSchema,
  insertEmployeeNextOfKinSchema,
  insertEmployeeTrainingRecordSchema,
  insertEmployeeDocumentSchema,
  insertInventoryItemSchema,
  insertDailyActivitySchema,
  insertSupplierSchema,
  insertSupplierInventoryItemSchema,
  insertProjectPhotoGroupSchema,
  insertProjectPhotoSchema,
  insertPayrollEntrySchema,
  insertCustomerDocumentSchema,
  insertSupplierDocumentSchema,
} from "@shared/schema";
import { ZodError } from "zod";
import {
  desc,
  eq,
  and,
  gte,
  lte,
  isNull,
  isNotNull,
  or,
  asc,
  like,
  sum,
  count,
  sql,
  ne,
  inArray,
} from "drizzle-orm";
import {
  users,
  companies,
  customers,
  suppliers,
  employees,
  projects,
  inventory,
  inventoryTransactions,
  dailyActivities,
  photos,
  projectConsumables,
  projectConsumableItems,
  inventoryItems,
  supplierInventoryItems,
  purchaseRequestItems,
  salesQuotationItems,
  salesInvoiceItems,
  invoicePayments,
  purchaseRequestSuppliers,
  payrollEntries,
  payrollAdditions,
  payrollDeductions,
  purchaseOrders,
  purchaseOrderItems,
  errorLogs,
  creditNotes,
} from "../migrations/schema";
import {
  purchaseInvoices,
  purchaseInvoicePayments,
  projectEmployees,
  salesInvoices,
  salesQuotations,
  projectPhotos,
  projectPhotoGroups,
} from "@shared/schema";
import { db } from "./db";
import { sql as sqlRaw } from "./db";
import { generateQuotationHTML } from "./documents/quotation-html";
import { generateCreditNoteHTML } from "./documents/credit-note-html";
import { generateInvoiceHTML } from "./documents/invoice-html";
import { generateProformaHTML } from "./documents/proforma-html";
import { generatePurchaseOrderHTML } from "./documents/purchase-order-html";
import { generatePurchaseInvoiceHTML } from "./documents/purchase-invoice-html";
import { generateProjectPrintHTML } from "./documents/project-print-html";
import { generateCompletionReportHTML } from "./documents/completion-report-html";
import { generateConsumablePrintHTML } from "./documents/consumable-print-html";
import { upload } from "./middleware/upload";
import {
  requireAuth,
  requireRole,
  checkProjectAccess,
} from "./middleware/auth";
import { parseProjectDataFromFormData } from "./lib/parse-project-form";


declare module "express-session" {
  interface SessionData {
    userId?: number;
    userRole?: string;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(
    "/attached_assets",
    express.static(path.join(process.cwd(), "attached_assets")),
  );
  // Serve uploaded files statically
  app.use("/uploads", express.static("uploads"));

  // Session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "aquanav-secret-key",
      resave: false,
      saveUninitialized: false,
      rolling: true, // Extend session on each request
      cookie: {
        secure: false, // Set to true in production with HTTPS
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true, // Prevent XSS attacks
        sameSite: "lax", // CSRF protection
      },
    }),
  );

  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res
          .status(400)
          .json({ message: "Username and password are required" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (!user.isActive) {
        return res.status(401).json({ message: "Account is disabled" });
      }

      req.session.userId = user.id;
      req.session.userRole = user.role;

      // Ensure session is saved before responding to avoid race conditions
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res
            .status(500)
            .json({ message: "Login failed to save session" });
        }
        const { password: _, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/locations", requireAuth, async (req, res) => {
    try {
      const locations = await storage.getLocations();
      res.json(locations);
    } catch (error) {
      console.error("Get locations error:", error);
      res.status(500).json({ message: "Failed to get locations" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(req.session.userId!); // Added non-null assertion
      if (!user || !user.isActive) {
        req.session.destroy(() => {});
        return res.status(401).json({ message: "User not found or inactive" });
      }

      // Update session timestamp to keep it alive
      req.session.touch();

      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Get current user error:", error);
      res.status(500).json({ message: "Failed to get user info" });
    }
  });

  // User management routes
  app.get(
    "/api/users",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const users = await storage.getUsers();
        const usersWithoutPasswords = users.map(
          ({ password, ...user }) => user,
        );
        res.json(usersWithoutPasswords);
      } catch (error) {
        res.status(500).json({ message: "Failed to get users" });
      }
    },
  );

  app.get(
    "/api/users/:id",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const user = await storage.getUser(id);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      } catch (error) {
        res.status(500).json({ message: "Failed to get user" });
      }
    },
  );

  app.get(
    "/api/purchase-orders/:id/edit-history",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const history = await storage.getInvoiceEditHistory(
          "purchase_order",
          id,
        );
        res.json(history);
      } catch (error) {
        console.error("Get purchase order edit history error:", error);
        res.status(500).json({ message: "Failed to get edit history" });
      }
    },
  );

  app.post(
    "/api/users",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const { employeeId, ...userData } = req.body;
        const parsedUserData = insertUserSchema.parse(userData);

        // Validate employeeId if provided
        if (
          employeeId !== undefined &&
          employeeId !== null &&
          employeeId !== ""
        ) {
          const empId = parseInt(employeeId);
          if (isNaN(empId)) {
            return res
              .status(400)
              .json({ message: "Invalid employee ID format" });
          }
          const employee = await storage.getEmployee(empId);
          if (!employee) {
            return res.status(404).json({ message: "Employee not found" });
          }
          if (employee.userId) {
            return res.status(400).json({
              message: "This employee is already linked to another user",
            });
          }
        }

        const user = await storage.createUser(parsedUserData);

        // Link employee to user if employeeId provided
        if (
          employeeId !== undefined &&
          employeeId !== null &&
          employeeId !== ""
        ) {
          await storage.updateEmployee(parseInt(employeeId), {
            userId: user.id,
          });
        }
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      } catch (error) {
        if (error instanceof ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid user data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create user" });
      }
    },
  );

  app.put(
    "/api/users/:id",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const { employeeId, ...userData } = req.body;

        if (userData.password) {
          userData.password = await bcrypt.hash(userData.password, 10);
        }

        // Check if user already has a linked employee
        const allEmployees = await storage.getEmployees();
        const existingLinkedEmployee = allEmployees.find(
          (e) => e.userId === id,
        );

        // If user already has a linked employee, reject any attempt to change it
        if (existingLinkedEmployee) {
          // Check if employeeId is provided and differs from existing link
          if (
            employeeId !== undefined &&
            employeeId !== null &&
            employeeId !== ""
          ) {
            const providedEmpId = parseInt(employeeId);
            if (providedEmpId !== existingLinkedEmployee.id) {
              return res.status(400).json({
                message: "Cannot change employee link once established",
              });
            }
          }
        } else if (
          employeeId !== undefined &&
          employeeId !== null &&
          employeeId !== ""
        ) {
          // No existing link, validate and link new employee
          const empId = parseInt(employeeId);
          if (isNaN(empId)) {
            return res
              .status(400)
              .json({ message: "Invalid employee ID format" });
          }
          const employee = await storage.getEmployee(empId);
          if (!employee) {
            return res.status(404).json({ message: "Employee not found" });
          }
          if (employee.userId && employee.userId !== id) {
            return res.status(400).json({
              message: "This employee is already linked to another user",
            });
          }
          await storage.updateEmployee(empId, { userId: id });
        }

        const user = await storage.updateUser(id, userData);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      } catch (error) {
        res.status(500).json({ message: "Failed to update user" });
      }
    },
  );

  app.delete(
    "/api/users/:id",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const deleted = await storage.deleteUser(id);
        if (!deleted) {
          return res.status(404).json({ message: "User not found" });
        }
        res.json({ message: "User deleted successfully" });
      } catch (error) {
        res.status(500).json({ message: "Failed to delete user" });
      }
    },
  );

  // Dashboard routes
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      const allProjects = await storage.getProjects();
      const inventoryItems = await storage.getInventoryItems();

      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();
      const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

      const activeProjects = allProjects.filter(
        (p) => p.status === "in_progress",
      ).length;

      const totalCompletedProjects = allProjects.filter(
        (p) => p.status === "completed",
      ).length;

      const lowStockItems = inventoryItems.filter(
        (item) => item.currentStock <= item.minStockLevel,
      ).length;

      const lowStockItemsList = inventoryItems
        .filter((item) => item.currentStock <= item.minStockLevel)
        .map((item) => ({
          id: item.id,
          name: item.name,
          currentStock: item.currentStock,
          minStockLevel: item.minStockLevel,
        }));

      const allSalesInvoices = await db
        .select({
          id: salesInvoices.id,
          invoiceDate: salesInvoices.invoiceDate,
          totalAmount: salesInvoices.totalAmount,
          status: salesInvoices.status,
        })
        .from(salesInvoices);

      const currentMonthInvoices = allSalesInvoices.filter((inv) => {
        if (!inv.invoiceDate) return false;
        const invDate = new Date(inv.invoiceDate);
        return (
          invDate.getMonth() === currentMonth &&
          invDate.getFullYear() === currentYear &&
          inv.status !== "cancelled" &&
          inv.status !== "rejected" &&
          inv.status !== "draft"
        );
      });

      const previousMonthInvoices = allSalesInvoices.filter((inv) => {
        if (!inv.invoiceDate) return false;
        const invDate = new Date(inv.invoiceDate);
        return (
          invDate.getMonth() === previousMonth &&
          invDate.getFullYear() === previousYear &&
          inv.status !== "cancelled" &&
          inv.status !== "rejected" &&
          inv.status !== "draft"
        );
      });

      const currentMonthRevenue = currentMonthInvoices.reduce(
        (sum, inv) => sum + parseFloat(inv.totalAmount || "0"),
        0,
      );

      const previousMonthRevenue = previousMonthInvoices.reduce(
        (sum, inv) => sum + parseFloat(inv.totalAmount || "0"),
        0,
      );

      const previousActiveProjects = allProjects.filter((p) => {
        if (p.status !== "in_progress") return false;
        if (!p.startDate) return true;
        const startDate = new Date(p.startDate);
        return startDate <= new Date(previousYear, previousMonth + 1, 0);
      }).length;

      const activeProjectsChange = activeProjects - previousActiveProjects;

      const monthlyRevenuePercentageChange =
        previousMonthRevenue > 0
          ? Math.round(
              ((currentMonthRevenue - previousMonthRevenue) /
                previousMonthRevenue) *
                100,
            )
          : currentMonthRevenue > 0
            ? 100
            : 0;

      const lowStockItemsChangeLabel =
        lowStockItems > 0 ? "Action needed" : "All items stocked";

      res.json({
        activeProjects,
        activeProjectsChange,
        activeProjectsChangeLabel:
          activeProjectsChange >= 0
            ? `+${activeProjectsChange} from last month`
            : `${activeProjectsChange} from last month`,
        completedProjects: totalCompletedProjects,
        lowStockItems,
        lowStockItemsChange: lowStockItems,
        lowStockItemsChangeLabel,
        lowStockItemsList,
        monthlyRevenue: currentMonthRevenue,
        monthlyRevenueChange: currentMonthRevenue - previousMonthRevenue,
        monthlyRevenueChangeLabel:
          monthlyRevenuePercentageChange >= 0
            ? `+${monthlyRevenuePercentageChange}% from last month`
            : `${monthlyRevenuePercentageChange}% from last month`,
        monthlyRevenuePercentageChange,
      });
    } catch (error: any) {
      console.error("Dashboard stats error:", error?.message || error);
      res.status(500).json({ message: "Failed to get dashboard stats" });
    }
  });

  app.get(
    "/api/dashboard/finance-stats",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        const salesInvoices = await storage.getSalesInvoices();
        const purchaseInvoicesList = await storage.getPurchaseInvoices();
        const reimbursementsList = await storage.getReimbursements();
        const customersList = await storage.getCustomers();
        const customersMap = new Map(
          customersList.map((c: any) => [c.id, c.name]),
        );

        const currentMonthSales = salesInvoices.filter((inv: any) => {
          const d = new Date(inv.invoiceDate);
          return (
            d.getMonth() === currentMonth && d.getFullYear() === currentYear
          );
        });
        const previousMonthSales = salesInvoices.filter((inv: any) => {
          const d = new Date(inv.invoiceDate);
          return (
            d.getMonth() === previousMonth && d.getFullYear() === previousYear
          );
        });

        const totalReceivable = salesInvoices
          .filter(
            (inv: any) =>
              inv.status === "approved" ||
              inv.status === "unpaid" ||
              inv.status === "partially_paid" ||
              inv.status === "overdue",
          )
          .reduce(
            (sum: number, inv: any) =>
              sum +
              parseFloat(inv.totalAmount || "0") -
              parseFloat(inv.paidAmount || "0"),
            0,
          );

        const totalPayable = purchaseInvoicesList
          .filter(
            (inv: any) =>
              inv.status === "approved" &&
              (inv.paymentStatus === "unpaid" ||
                inv.paymentStatus === "partial"),
          )
          .reduce(
            (sum: number, inv: any) =>
              sum +
              parseFloat(inv.totalAmount || "0") -
              parseFloat(inv.paidAmount || "0"),
            0,
          );

        const currentMonthRevenue = currentMonthSales
          .filter(
            (inv: any) =>
              inv.status !== "draft" &&
              inv.status !== "rejected" &&
              inv.status !== "cancelled",
          )
          .reduce(
            (sum: number, inv: any) => sum + parseFloat(inv.totalAmount || "0"),
            0,
          );
        const previousMonthRevenue = previousMonthSales
          .filter(
            (inv: any) =>
              inv.status !== "draft" &&
              inv.status !== "rejected" &&
              inv.status !== "cancelled",
          )
          .reduce(
            (sum: number, inv: any) => sum + parseFloat(inv.totalAmount || "0"),
            0,
          );
        const revenueChange =
          previousMonthRevenue > 0
            ? Math.round(
                ((currentMonthRevenue - previousMonthRevenue) /
                  previousMonthRevenue) *
                  100,
              )
            : currentMonthRevenue > 0
              ? 100
              : 0;

        const currentMonthExpenses = purchaseInvoicesList
          .filter((inv: any) => {
            const d = new Date(inv.invoiceDate);
            return (
              d.getMonth() === currentMonth &&
              d.getFullYear() === currentYear &&
              inv.status === "approved"
            );
          })
          .reduce(
            (sum: number, inv: any) => sum + parseFloat(inv.totalAmount || "0"),
            0,
          );
        const previousMonthExpenses = purchaseInvoicesList
          .filter((inv: any) => {
            const d = new Date(inv.invoiceDate);
            return (
              d.getMonth() === previousMonth &&
              d.getFullYear() === previousYear &&
              inv.status === "approved"
            );
          })
          .reduce(
            (sum: number, inv: any) => sum + parseFloat(inv.totalAmount || "0"),
            0,
          );
        const expensesChange =
          previousMonthExpenses > 0
            ? Math.round(
                ((currentMonthExpenses - previousMonthExpenses) /
                  previousMonthExpenses) *
                  100,
              )
            : currentMonthExpenses > 0
              ? 100
              : 0;

        const pendingApprovalSales = salesInvoices.filter(
          (inv: any) => inv.status === "pending_approval",
        ).length;
        const pendingApprovalPurchases = purchaseInvoicesList.filter(
          (inv: any) => inv.status === "pending_approval",
        ).length;
        const pendingReimbursements = reimbursementsList.filter(
          (r: any) => r.status === "pending",
        ).length;

        const overdueSalesInvoices = salesInvoices.filter((inv: any) => {
          if (
            inv.status === "paid" ||
            inv.status === "draft" ||
            inv.status === "cancelled" ||
            inv.status === "rejected"
          )
            return false;
          return inv.dueDate && new Date(inv.dueDate) < currentDate;
        }).length;

        const overduePurchaseInvoices = purchaseInvoicesList.filter(
          (inv: any) => {
            if (inv.paymentStatus === "paid" || inv.status !== "approved")
              return false;
            return inv.dueDate && new Date(inv.dueDate) < currentDate;
          },
        ).length;

        const recentSalesInvoices = salesInvoices
          .sort(
            (a: any, b: any) =>
              new Date(b.invoiceDate || b.createdAt).getTime() -
              new Date(a.invoiceDate || a.createdAt).getTime(),
          )
          .slice(0, 5)
          .map((inv: any) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            customerName:
              customersMap.get(inv.customerId) || `Customer #${inv.customerId}`,
            totalAmount: inv.totalAmount,
            paidAmount: inv.paidAmount,
            status: inv.status,
            dueDate: inv.dueDate,
            currency: inv.currency || "AED",
          }));

        const recentPurchaseInvoices = purchaseInvoicesList
          .sort(
            (a: any, b: any) =>
              new Date(b.invoiceDate || b.createdAt).getTime() -
              new Date(a.invoiceDate || a.createdAt).getTime(),
          )
          .slice(0, 5)
          .map((inv: any) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            supplierName: inv.supplierName || `Supplier #${inv.supplierId}`,
            totalAmount: inv.totalAmount,
            paidAmount: inv.paidAmount,
            status: inv.status,
            paymentStatus: inv.paymentStatus,
            dueDate: inv.dueDate,
            currency: inv.currency || "AED",
          }));

        res.json({
          totalReceivable,
          totalPayable,
          currentMonthRevenue,
          revenueChange,
          currentMonthExpenses,
          expensesChange,
          pendingApprovalSales,
          pendingApprovalPurchases,
          pendingReimbursements,
          overdueSalesInvoices,
          overduePurchaseInvoices,
          recentSalesInvoices,
          recentPurchaseInvoices,
        });
      } catch (error) {
        console.error("Error getting finance dashboard stats:", error);
        res
          .status(500)
          .json({ message: "Failed to get finance dashboard stats" });
      }
    },
  );

  app.get(
    "/api/dashboard/pm-stats",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const projects = await storage.getProjects();
        const purchaseRequests = await storage.getPurchaseRequests(
          req.session.userId,
          req.session.userRole,
        );
        const reimbursementsList = await storage.getReimbursements({
          userId: req.session.userId,
        });
        const inventoryItems = await storage.getInventoryItems();

        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();

        const activeProjects = projects.filter(
          (p: any) => p.status === "in_progress",
        ).length;
        const completedProjects = projects.filter(
          (p: any) => p.status === "completed",
        ).length;
        const onHoldProjects = projects.filter(
          (p: any) => p.status === "on_hold",
        ).length;
        const totalProjects = projects.length;

        const pendingPurchaseRequests = purchaseRequests.filter(
          (pr: any) => pr.status === "pending",
        ).length;
        const myPendingReimbursements = reimbursementsList.filter(
          (r: any) => r.status === "pending",
        ).length;
        const lowStockItems = inventoryItems.filter(
          (item: any) => item.currentStock <= item.minStockLevel,
        ).length;

        const totalBudget = projects
          .filter((p: any) => p.status === "in_progress")
          .reduce(
            (sum: number, p: any) => sum + parseFloat(p.estimatedBudget || "0"),
            0,
          );
        const totalActualCost = projects
          .filter((p: any) => p.status === "in_progress")
          .reduce(
            (sum: number, p: any) => sum + parseFloat(p.actualCost || "0"),
            0,
          );

        const upcomingDeadlines = projects
          .filter((p: any) => {
            if (p.status !== "in_progress" || !p.plannedEndDate) return false;
            const endDate = new Date(p.plannedEndDate);
            const daysUntil = Math.ceil(
              (endDate.getTime() - currentDate.getTime()) /
                (1000 * 60 * 60 * 24),
            );
            return daysUntil >= 0 && daysUntil <= 30;
          })
          .sort(
            (a: any, b: any) =>
              new Date(a.plannedEndDate).getTime() -
              new Date(b.plannedEndDate).getTime(),
          )
          .slice(0, 5)
          .map((p: any) => ({
            id: p.id,
            title: p.title,
            vesselName: p.vesselName,
            plannedEndDate: p.plannedEndDate,
            status: p.status,
            daysRemaining: Math.ceil(
              (new Date(p.plannedEndDate).getTime() - currentDate.getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          }));

        const recentProjects = projects
          .filter((p: any) => p.status === "in_progress")
          .sort(
            (a: any, b: any) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )
          .slice(0, 5)
          .map((p: any) => ({
            id: p.id,
            title: p.title,
            vesselName: p.vesselName,
            status: p.status,
            estimatedBudget: p.estimatedBudget,
            actualCost: p.actualCost,
            plannedEndDate: p.plannedEndDate,
            progress: p.progress,
          }));

        res.json({
          activeProjects,
          completedProjects,
          onHoldProjects,
          totalProjects,
          pendingPurchaseRequests,
          myPendingReimbursements,
          lowStockItems,
          totalBudget,
          totalActualCost,
          upcomingDeadlines,
          recentProjects,
        });
      } catch (error) {
        console.error("Error getting PM dashboard stats:", error);
        res.status(500).json({ message: "Failed to get PM dashboard stats" });
      }
    },
  );

  app.get(
    "/api/dashboard/employee-stats",
    requireAuth,
    requireRole(["admin", "employee"]),
    async (req, res) => {
      try {
        const userId = req.session.userId;
        const employee = await storage.getEmployeeByUserId(userId!);
        const projects = employee
          ? await storage.getProjectsByEmployee(employee.id)
          : [];
        const reimbursementsList = await storage.getReimbursements({ userId });

        const activeProjects = projects.filter(
          (p: any) => p.status === "in_progress",
        ).length;
        const totalProjects = projects.length;

        const pendingReimbursements = reimbursementsList.filter(
          (r: any) => r.status === "pending",
        ).length;
        const approvedReimbursements = reimbursementsList.filter(
          (r: any) => r.status === "approved",
        ).length;
        const totalReimbursementAmount = reimbursementsList
          .filter((r: any) => r.status === "approved")
          .reduce(
            (sum: number, r: any) => sum + parseFloat(r.amount || "0"),
            0,
          );

        const recentProjects = projects
          .filter((p: any) => p.status === "in_progress")
          .sort(
            (a: any, b: any) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )
          .slice(0, 5)
          .map((p: any) => ({
            id: p.id,
            title: p.title,
            vesselName: p.vesselName,
            status: p.status,
            plannedEndDate: p.plannedEndDate,
          }));

        const recentReimbursements = reimbursementsList
          .sort(
            (a: any, b: any) =>
              new Date(b.submissionTimestamp).getTime() -
              new Date(a.submissionTimestamp).getTime(),
          )
          .slice(0, 5)
          .map((r: any) => ({
            id: r.id,
            amount: r.amount,
            description: r.description,
            status: r.status,
            submissionTimestamp: r.submissionTimestamp,
          }));

        res.json({
          activeProjects,
          totalProjects,
          pendingReimbursements,
          approvedReimbursements,
          totalReimbursementAmount,
          recentProjects,
          recentReimbursements,
        });
      } catch (error) {
        console.error("Error getting employee dashboard stats:", error);
        res
          .status(500)
          .json({ message: "Failed to get employee dashboard stats" });
      }
    },
  );

  // Company routes
  app.get("/api/company", requireAuth, async (req, res) => {
    try {
      const company = await storage.getCompany();
      res.json(company);
    } catch (error) {
      res.status(500).json({ message: "Failed to get company info" });
    }
  });

  app.put(
    "/api/company",
    requireAuth,
    requireRole(["admin"]),
    upload.single("companyLogo"),
    async (req, res) => {
      try {
        const companyData = req.body;
        // ✅ Attach uploaded logo path if present
        if (req.file) {
          companyData.logo = `/uploads/company/${req.file.filename}`;
        }
        const company = await storage.updateCompany(companyData);
        res.json(company);
      } catch (error) {
        console.error("Update company error:", error);
        res.status(500).json({ message: "Failed to update company info" });
      }
    },
  );

  app.get(
    "/api/exchange-rates/available-currencies",
    requireAuth,
    async (req, res) => {
      try {
        const rates = await storage.getExchangeRates();
        const currencySet = new Set<string>(["AED"]);
        for (const rate of rates) {
          if (rate.isActive) {
            currencySet.add(rate.fromCurrency);
            currencySet.add(rate.toCurrency);
          }
        }
        const currencies = Array.from(currencySet).sort();
        res.json(currencies);
      } catch (error) {
        console.error("Get available currencies error:", error);
        res.status(500).json({ message: "Failed to get available currencies" });
      }
    },
  );

  // Customer routes
  app.get("/api/customers", requireAuth, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || "";
      const showArchived = req.query.showArchived === "true";

      const result = await storage.getCustomersPaginated(
        page,
        limit,
        search,
        showArchived,
      );
      res.json(result);
    } catch (error) {
      console.error("Get customers error:", error);
      res.status(500).json({ message: "Failed to get customers" });
    }
  });

  app.get("/api/customers/all", requireAuth, async (req, res) => {
    try {
      const allCustomers = await storage.getCustomers();
      res.json(allCustomers);
    } catch (error) {
      console.error("Get all customers error:", error);
      res.status(500).json({ message: "Failed to get all customers" });
    }
  });

  app.get("/api/customers/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getCustomerStats();
      res.json(stats);
    } catch (error) {
      console.error("Get customer stats error:", error);
      res.status(500).json({ message: "Failed to get customer stats" });
    }
  });

  app.post(
    "/api/customers",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const customerData = insertCustomerSchema.parse(req.body);
        const customer = await storage.createCustomer(customerData);
        res.status(201).json(customer);
      } catch (error) {
        if (error instanceof ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        if (error instanceof Error && error.message) {
          return res.status(500).json({
            message: error.message,
          });
        }
        res.status(500).json({ message: "Failed to create customer" });
      }
    },
  );

  app.put(
    "/api/customers/:id",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const customerData = req.body;
        const customer = await storage.updateCustomer(id, customerData);

        if (!customer) {
          return res.status(404).json({ message: "Customer not found" });
        }

        res.json(customer);
      } catch (error: any) {
        if (error.message?.includes("already exists")) {
          return res.status(409).json({
            message: error.message,
          });
        }
        res.status(500).json({ message: "Failed to update customer" });
      }
    },
  );

  app.put(
    "/api/customers/:id/archive",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const customer = await storage.updateCustomer(id, { isArchived: true });

        if (!customer) {
          return res.status(404).json({ message: "Customer not found" });
        }

        res.json({ message: "Customer archived successfully", customer });
      } catch (error) {
        res.status(500).json({ message: "Failed to archive customer" });
      }
    },
  );

  app.put(
    "/api/customers/:id/unarchive",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const customer = await storage.updateCustomer(id, {
          isArchived: false,
        });

        if (!customer) {
          return res.status(404).json({ message: "Customer not found" });
        }

        res.json({ message: "Customer unarchived successfully", customer });
      } catch (error) {
        res.status(500).json({ message: "Failed to unarchive customer" });
      }
    },
  );

  // Supplier routes
  app.get("/api/suppliers", requireAuth, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || "";
      const showArchived = req.query.showArchived === "true";

      const result = await storage.getSuppliersPaginated(
        page,
        limit,
        search,
        showArchived,
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get suppliers" });
    }
  });

  app.get("/api/suppliers/all", requireAuth, async (req, res) => {
    try {
      const result = await storage.getSuppliers();
      res.json({ data: result });
    } catch (error) {
      res.status(500).json({ message: "Failed to get all suppliers" });
    }
  });

  app.get("/api/suppliers/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getSupplierStats();
      res.json(stats);
    } catch (error) {
      console.error("Get supplier stats error:", error);
      res.status(500).json({ message: "Failed to get supplier stats" });
    }
  });

  app.post(
    "/api/suppliers",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const supplierData = insertSupplierSchema.parse(req.body);
        const supplier = await storage.createSupplier(supplierData);
        console.log("5=>", supplier);
        res.status(201).json(supplier);
      } catch (error) {
        if (error instanceof ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create supplier" });
      }
    },
  );

  app.put(
    "/api/suppliers/:id",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const supplierData = req.body;
        const supplier = await storage.updateSupplier(id, supplierData);

        if (!supplier) {
          return res.status(404).json({ message: "Supplier not found" });
        }

        res.json(supplier);
      } catch (error) {
        res.status(500).json({ message: "Failed to update supplier" });
      }
    },
  );

  app.delete(
    "/api/suppliers/:id",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const deleted = await storage.deleteSupplier(id);
        if (!deleted) {
          return res.status(404).json({ message: "Supplier not found" });
        }
        res.json({ message: "Supplier deleted successfully" });
      } catch (error) {
        res.status(500).json({ message: "Failed to delete supplier" });
      }
    },
  );

  // Supplier-specific routes
  app.get("/api/suppliers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const supplier = await storage.getSupplier(id);
      if (!supplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }
      res.json(supplier);
    } catch (error) {
      res.status(500).json({ message: "Failed to get supplier" });
    }
  });

  app.get("/api/suppliers/:id/products", requireAuth, async (req, res) => {
    try {
      const supplierId = parseInt(req.params.id);
      // For now, return inventory items that could be supplied by this supplier
      // In a real application, you'd have a supplier-product relationship table
      const products = await storage.getInventoryItems();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to get supplier products" });
    }
  });

  // Employee routes
  app.put(
    "/api/employees/:id",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const updateData = req.body;

        // Convert date strings to Date objects
        if (updateData.hireDate) {
          updateData.hireDate = new Date(updateData.hireDate);
        }
        if (updateData.dateOfBirth) {
          updateData.dateOfBirth = new Date(updateData.dateOfBirth);
        }

        const parsedData = insertEmployeeSchema.parse(updateData);
        const result = await storage.updateEmployee(id, parsedData);
        if (!result) {
          return res.status(404).json({ message: "Employee not found" });
        }
        res.json(result);
      } catch (error) {
        console.error("Update employee error:", error);
        if (error instanceof ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to update employee" });
      }
    },
  );

  app.get("/api/employees", requireAuth, async (req, res) => {
    try {
      const employees = await storage.getEmployees();
      res.json(employees);
    } catch (error) {
      res.status(500).json({ message: "Failed to get employees" });
    }
  });

  app.post(
    "/api/employees",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const { createUserAccount, ...employeeData } = req.body;

        console.log("Received employee data:", employeeData);

        // Convert hireDate string to Date object if provided
        if (
          employeeData.hireDate &&
          typeof employeeData.hireDate === "string" &&
          employeeData.hireDate.trim() !== ""
        ) {
          employeeData.hireDate = new Date(employeeData.hireDate);
        } else {
          employeeData.hireDate = null;
        }

        // Ensure category has a default value
        if (!employeeData.category || employeeData.category.trim() === "") {
          employeeData.category = "permanent";
        }

        // Convert salary to decimal string if provided
        if (employeeData.salary && typeof employeeData.salary === "number") {
          employeeData.salary = employeeData.salary.toString();
        } else if (
          employeeData.salary &&
          typeof employeeData.salary === "string" &&
          employeeData.salary.trim() === ""
        ) {
          employeeData.salary = null;
        }

        // Clean up null/empty string fields
        Object.keys(employeeData).forEach((key) => {
          if (employeeData[key] === "" || employeeData[key] === undefined) {
            employeeData[key] = null;
          }
        });

        // Ensure required fields are not null
        if (!employeeData.firstName || employeeData.firstName.trim() === "") {
          return res.status(400).json({ message: "First name is required" });
        }
        if (!employeeData.lastName || employeeData.lastName.trim() === "") {
          return res.status(400).json({ message: "Last name is required" });
        }
        if (
          !employeeData.employeeCode ||
          employeeData.employeeCode.trim() === ""
        ) {
          return res.status(400).json({ message: "Employee code is required" });
        }

        employeeData.employeeCode = employeeData.employeeCode.trim();

        const existingEmployee = (await storage.getEmployees()).find(
          (employee) =>
            employee.employeeCode.toLowerCase() ===
            employeeData.employeeCode.toLowerCase(),
        );
        if (existingEmployee) {
          return res
            .status(409)
            .json({ message: "Employee code already exists" });
        }

        const parsedEmployeeData = insertEmployeeSchema.parse(employeeData);
        const employee = await storage.createEmployee(parsedEmployeeData);

        // Create user account only if explicitly requested and email is provided
        if (createUserAccount && employee.email && employee.email.trim()) {
          try {
            const username =
              `${employee.firstName.toLowerCase()}.${employee.lastName.toLowerCase()}`.replace(
                /\s+/g,
                "",
              );
            const defaultPassword = `${
              employee.employeeCode
            }@${new Date().getFullYear()}`;

            const userData = {
              username: username,
              email: employee.email.trim(),
              password: defaultPassword,
              role: "employee" as const,
              isActive: employee.isActive,
            };

            const user = await storage.createUser(userData);

            // Link the user to the employee
            await storage.updateEmployee(employee.id, { userId: user.id });

            res.status(201).json({
              ...employee,
              userId: user.id,
              generatedCredentials: {
                username: username,
                password: defaultPassword,
                message:
                  "User account created successfully. Please share these credentials with the employee.",
              },
            });
          } catch (userError) {
            console.error("User creation error:", userError);
            // If user creation fails, still return the employee but with a warning
            res.status(201).json({
              ...employee,
              warning:
                "Employee created but user account creation failed. Please create manually.",
            });
          }
        } else {
          res.status(201).json(employee);
        }
      } catch (error) {
        console.error("Employee creation error:", error);
        if (error instanceof ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create employee" });
      }
    },
  );

  // Update employee

  app.patch(
    "/api/employees/:id",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const id = Number(req.params.id);
        const raw = { ...req.body };

        // First parse/coerce with Zod (this converts strings to Date for date fields)
        const parsed = updateEmployeeSchema.parse(raw);

        // Now format fields for DB:
        // - For timestamp columns (hireDate) keep JS Date objects (drizzle accepts Date for timestamp)
        // - For date-only columns (dateOfBirth) convert to "YYYY-MM-DD" string
        const prepared: any = { ...parsed };

        if (prepared.hireDate) {
          // ensure it's a Date (z.coerce.date already made it Date) — keep as Date
          // optionally: prepared.hireDate = new Date(prepared.hireDate);
        }

        if (prepared.dateOfBirth) {
          const d = new Date(prepared.dateOfBirth);
          prepared.dateOfBirth = d.toISOString().split("T")[0]; // YYYY-MM-DD
        }

        // Remove undefined values to avoid accidental NULLs
        Object.keys(prepared).forEach(
          (k) => prepared[k] === undefined && delete prepared[k],
        );

        const result = await storage.updateEmployee(id, prepared);
        if (!result)
          return res.status(404).json({ message: "Employee not found" });

        res.json(result);
      } catch (err) {
        console.error("Update employee error:", err);
        if (err instanceof ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: err.errors });
        }
        res.status(500).json({ message: "Failed to update employee" });
      }
    },
  );

  // Get single employee with full details
  app.get("/api/employees/:id", requireAuth, async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const employee = await storage.getEmployee(employeeId);

      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }

      res.json(employee);
    } catch (error) {
      res.status(500).json({ message: "Failed to get employee" });
    }
  });

  // Employee Next of Kin routes
  app.get("/api/employees/:id/next-of-kin", requireAuth, async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const nextOfKin = await storage.getEmployeeNextOfKin(employeeId);
      res.json(nextOfKin);
    } catch (error) {
      res.status(500).json({ message: "Failed to get next of kin data" });
    }
  });

  app.get("/api/employees/:id/next-of-kin", requireAuth, async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const nextOfKinRecords = await storage.getEmployeeNextOfKin(employeeId);
      res.json(nextOfKinRecords);
    } catch (error) {
      res.status(500).json({ message: "Failed to get next of kin records" });
    }
  });

  app.post(
    "/api/employees/:id/next-of-kin",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const employeeId = parseInt(req.params.id);
        const nextOfKinData = { ...req.body, employeeId };

        const parsedData = insertEmployeeNextOfKinSchema.parse(nextOfKinData);
        const result = await storage.createEmployeeNextOfKin(parsedData);
        res.status(201).json(result);
      } catch (error) {
        if (error instanceof ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res
          .status(500)
          .json({ message: "Failed to create next of kin record" });
      }
    },
  );

  app.put(
    "/api/employees/next-of-kin/:id",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const updateData = req.body;

        const result = await storage.updateEmployeeNextOfKin(id, updateData);
        if (!result) {
          return res
            .status(404)
            .json({ message: "Next of kin record not found" });
        }
        res.json(result);
      } catch (error) {
        res
          .status(500)
          .json({ message: "Failed to update next of kin record" });
      }
    },
  );

  app.delete(
    "/api/employees/next-of-kin/:id",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      console.log("DELETE NOK API HIT"); // 👈 add this
      try {
        const id = parseInt(req.params.id);
        const success = await storage.deleteEmployeeNextOfKin(id);

        res.json({ message: "Next of kin record deleted successfully" });
      } catch (error) {
        res
          .status(500)
          .json({ message: "Failed to delete next of kin record" });
      }
    },
  );

  // Employee Training Records routes
  app.get(
    "/api/employees/:id/training-records",
    requireAuth,
    async (req, res) => {
      try {
        const employeeId = parseInt(req.params.id);
        const trainingRecords =
          await storage.getEmployeeTrainingRecords(employeeId);
        res.json(trainingRecords);
      } catch (error) {
        res.status(500).json({ message: "Failed to get training records" });
      }
    },
  );

  app.post(
    "/api/employees/:id/training-records",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    upload.array("files"),
    async (req, res) => {
      try {
        const employeeId = parseInt(req.params.id);
        const trainingData = { ...req.body, employeeId };

        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
          const attachments = req.files.map((file) => ({
            fileName: file.filename,
            originalName: file.originalname,
            filePath: file.path,
            fileSize: file.size,
            mimeType: file.mimetype,
          }));
          trainingData.attachments = attachments;
        }

        const parsedData =
          insertEmployeeTrainingRecordSchema.parse(trainingData);
        const result = await storage.createEmployeeTrainingRecord(parsedData);
        res.status(201).json(result);
      } catch (error) {
        console.error("Training record creation error:", error);
        if (error instanceof ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create training record" });
      }
    },
  );

  app.put(
    "/api/employees/training-records/:id",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    upload.array("files"),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const { existingAttachments, ...updateData } = req.body;

        const currentRecord = await storage.getEmployeeTrainingRecord(id);
        if (!currentRecord) {
          return res.status(404).json({ message: "Training record not found" });
        }

        let attachments = [];
        if (existingAttachments) {
          attachments = Array.isArray(existingAttachments)
            ? existingAttachments.map((a) => JSON.parse(a))
            : [JSON.parse(existingAttachments)];
        }

        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
          const newAttachments = req.files.map((file) => ({
            fileName: file.filename,
            originalName: file.originalname,
            filePath: file.path,
            fileSize: file.size,
            mimeType: file.mimetype,
          }));
          attachments = [...attachments, ...newAttachments];
        }

        const result = await storage.updateEmployeeTrainingRecord(id, {
          ...updateData,
          attachments,
        });

        res.json(result);
      } catch (error) {
        console.error("Update training record error:", error);
        res.status(500).json({ message: "Failed to update training record" });
      }
    },
  );

  app.delete(
    "/api/employees/training-records/:id",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const success = await storage.deleteEmployeeTrainingRecord(id);
        res.json({ message: "Training record deleted successfully" });
      } catch (error) {
        res.status(500).json({ message: "Failed to delete training record" });
      }
    },
  );

  // Employee Documents routes
  app.get("/api/employees/:id/documents", requireAuth, async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const documents = await storage.getEmployeeDocuments(employeeId);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ message: "Failed to get employee documents" });
    }
  });

  app.post(
    "/api/employees/:id/documents",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    upload.array("files", 10),
    async (req, res) => {
      try {
        const employeeId = req.params.id;
        const documentData = { ...req.body, employeeId: Number(employeeId) };
        var f = [];
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
          for (const file of req.files) {
            f.push({
              fileName: file.filename,
              originalName: file.originalname,
              filePath: file.path,
              fileSize: file.size,
              mimeType: file.mimetype,
            });
          }
          documentData.attachmentPaths = f;
        }
        const parsedData = insertEmployeeDocumentSchema.parse(documentData);
        const result = await storage.createEmployeeDocument(parsedData);
        res.status(201).json(result);
      } catch (error) {
        if (error instanceof ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res
          .status(500)
          .json({ message: "Failed to create employee document", error });
      }
    },
  );

  app.put(
    "/api/employees/documents/:id",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    upload.array("files", 10),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const updateData = req.body;
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
          var f = [];
          for (const file of req.files) {
            f.push({
              fileName: file.filename,
              originalName: file.originalname,
              filePath: file.path,
              fileSize: file.size,
              mimeType: file.mimetype,
            });
          }
          updateData.attachmentPaths = f;
        }
        const result = await storage.updateEmployeeDocument(id, updateData);
        if (!result) {
          return res
            .status(404)
            .json({ message: "Employee document not found" });
        }
        res.json(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to update employee document" });
      }
    },
  );

  app.delete(
    "/api/employees/documents/:id",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const success = await storage.deleteEmployeeDocument(id);
        res.json({ message: "Employee document deleted successfully" });
      } catch (error) {
        res.status(500).json({ message: "Failed to delete employee document" });
      }
    },
  );

  // Get expiring employee documents for notification
  app.get(
    "/api/employees/expiring-employee-documents",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const daysAhead = parseInt(req.query.daysAhead as string) || 30;
        const expiringDocs =
          await storage.getExpiringEmployeeDocuments(daysAhead);
        res.json(expiringDocs);
      } catch (error) {
        res
          .status(500)
          .json({ message: "Failed to get expiring employee documents" });
      }
    },
  );

  // Get expiring documents for notification
  app.get(
    "/api/employees/expiring-documents",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const daysAhead = parseInt(req.query.daysAhead as string) || 30;
        const expiringDocs = await storage.getExpiringDocuments(daysAhead);
        res.json(expiringDocs);
      } catch (error) {
        res.status(500).json({ message: "Failed to get expiring documents" });
      }
    },
  );

  // Generate employment contract
  app.get(
    "/api/employees/:id/employment-contract",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const employeeId = parseInt(req.params.id);
        const contractHtml =
          await storage.generateEmploymentContract(employeeId);

        res.setHeader("Content-Type", "text/html");
        res.send(contractHtml);
      } catch (error) {
        if (error.message === "Employee not found") {
          return res.status(404).json({ message: "Employee not found" });
        }
        res
          .status(500)
          .json({ message: "Failed to generate employment contract" });
      }
    },
  );

  // Project routes
  app.get("/api/projects", requireAuth, async (req, res) => {
    try {
      const customerParam = req.query.customer;
      let projects;

      // CUSTOMER ROLE: force own projects only
      if (req.session.userRole === "customer") {
        const user = await storage.getUser(req.session.userId!);
        if (!user) {
          return res.status(403).json({ message: "Unauthorized" });
        }

        const customers = await storage.getCustomers();
        const customer = customers.find((c) => c.userId === user.id);

        if (!customer) {
          return res.json([]);
        }

        projects = await storage.getProjectsByCustomer(customer.id);
      }
      // EMPLOYEE ROLE: force team-assigned projects only
      else if (req.session.userRole === "employee") {
        const employee = await storage.getEmployeeByUserId(req.session.userId!);
        if (employee) {
          projects = await storage.getProjectsByEmployee(employee.id);
        } else {
          projects = [];
        }
      }
      //NON-CUSTOMER/EMPLOYEE ROLE + customer filter
      else if (customerParam) {
        projects = await storage.getProjectsByCustomer(Number(customerParam));
      }
      //NON-CUSTOMER/EMPLOYEE ROLE + no filter
      else {
        projects = await storage.getProjects();
      }

      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to get projects" });
    }
  });

  app.get(
    "/api/projects/revenues",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const projectIds = req.query.projectIds as string;
        if (!projectIds) {
          return res.status(400).json({ message: "Project IDs are required" });
        }

        const ids = projectIds
          .split(",")
          .map((id) => parseInt(id.trim()))
          .filter((id) => !isNaN(id));
        if (ids.length === 0) {
          return res
            .status(400)
            .json({ message: "Valid project IDs are required" });
        }

        const revenuePromises = ids.map(async (projectId) => {
          try {
            const revenueData = await storage.getProjectRevenue(projectId);
            return { projectId, ...revenueData };
          } catch (error) {
            console.error(
              `Failed to get revenue for project ${projectId}:`,
              error,
            );
            return { projectId, error: true };
          }
        });

        const results = await Promise.all(revenuePromises);
        res.json(results.filter((result) => !result.error));
      } catch (error) {
        console.error("Get bulk project revenues error:", error);
        res.status(500).json({ message: "Failed to get project revenues" });
      }
    },
  );

  app.get("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const project = await storage.getProject(id);

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      if (req.session.userRole === "employee") {
        const employee = await storage.getEmployeeByUserId(req.session.userId!);
        if (employee) {
          const assignedProjects = await storage.getProjectsByEmployee(
            employee.id,
          );
          if (!assignedProjects.some((p) => p.id === id)) {
            return res
              .status(403)
              .json({ message: "You are not assigned to this project" });
          }
        } else {
          return res.status(403).json({ message: "No employee record found" });
        }
      }

      res.json(project);
    } catch (error) {
      res.status(500).json({ message: "Failed to get project" });
    }
  });
  // Print Daily report
  app.post(
    "/api/print/project",
    requireAuth,
    upload.single("reportImage"),
    async (req, res) => {
      try {
        const {
          id,
          fromDate,
          toDate,
          reportDate,
          includeRemainingDays,
          includeHBMHours,
        } = req.body;

        const project = await storage.getProjectPrint(
          id,
          fromDate,
          toDate,
          reportDate,
          includeRemainingDays,
          includeHBMHours,
        );

        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }

        if (req.file) {
          project.reportImage = `/${req.file.path}`;
        }

        project.reportTitle = "WEEKLY REPORT";

        if (fromDate === toDate) project.reportTitle = "DAILY REPORT";

        project.company = await storage.getCompany();

        // 🔥 Generate HTML instead of JSON
        const html = generateProjectPrintHTML(project);

        res.setHeader("Content-Type", "text/html");
        res.send(html);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to generate report" });
      }
    },
  );
  app.post("/api/print/consumables", requireAuth, async (req, res) => {
    try {
      const { id, fromDate, toDate, reportDate } = req.body;

      if (!id || !fromDate || !toDate) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const projectId = Number(id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project id" });
      }

      const project = await storage.getConsumablesPrint(
        projectId,
        fromDate,
        toDate,
        reportDate,
      );

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const company = await storage.getCompany();

      const html = generateConsumablePrintHTML({
        ...project,
        company,
      });

      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (error) {
      console.error("Consumables print error:", error);
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  // ─── Completion report: photo listing ───────────────────────────────────────
  app.get(
    "/api/projects/:id/completion-report/photos",
    requireAuth,
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.id);
        if (isNaN(projectId))
          return res.status(400).json({ message: "Invalid project ID" });
        const userRole = req.session.userRole || "";
        const userId = req.session.userId!;
        const hasAccess = await checkProjectAccess(projectId, userId, userRole);
        if (!hasAccess)
          return res.status(403).json({ message: "Access denied" });
        const groups = await storage.getProjectPhotoGroups(projectId);
        res.json(groups);
      } catch (error) {
        console.error("Completion report photos error:", error);
        res.status(500).json({ message: "Failed to fetch photo groups" });
      }
    },
  );

  // ─── Completion report: generate HTML ───────────────────────────────────────
  app.post("/api/print/project-completion", requireAuth, async (req, res) => {
    try {
      const {
        projectId,
        selectedPhotoIds = [],
        sections = {},
        reportTitle,
      } = req.body;
      if (!projectId)
        return res.status(400).json({ message: "projectId required" });

      // Project metadata + access check
      const project = await storage.getProject(parseInt(projectId));
      if (!project)
        return res.status(404).json({ message: "Project not found" });
      const userRole = req.session.userRole || "";
      const userId = req.session.userId!;
      const hasAccess = await checkProjectAccess(
        parseInt(projectId),
        userId,
        userRole,
      );
      if (!hasAccess) return res.status(403).json({ message: "Access denied" });

      // Base URL for absolute photo paths
      const baseUrl = `${req.protocol}://${req.get("host")}`;

      // All daily activities (with isStoppage) — no completedTasks filter so stoppage days are counted correctly
      const allActivities = await db
        .select({
          id: dailyActivities.id,
          date: dailyActivities.date,
          location: dailyActivities.location,
          completedTasks: dailyActivities.completedTasks,
          isStoppage: dailyActivities.isStoppage,
          stoppageReason: dailyActivities.stoppageReason,
        })
        .from(dailyActivities)
        .where(eq(dailyActivities.projectId, parseInt(projectId)))
        .orderBy(asc(dailyActivities.date));

      // Compute stats
      const startDate = project.startDate ? new Date(project.startDate) : null;
      const endDate =
        project.actualEndDate || project.plannedEndDate
          ? new Date((project.actualEndDate || project.plannedEndDate) as any)
          : new Date();
      const totalDays = startDate
        ? Math.max(
            Math.round((endDate.getTime() - startDate.getTime()) / 86400000) +
              1,
            0,
          )
        : 0;

      const activeDateSet = new Set<string>();
      const stopDateSet = new Set<string>();
      const locationDayMap = new Map<string, Set<string>>();
      const stoppageReasons: string[] = [];

      for (const a of allActivities) {
        const dateStr = new Date(a.date).toISOString().split("T")[0];
        if (a.isStoppage) {
          stopDateSet.add(dateStr);
          if (a.stoppageReason) stoppageReasons.push(a.stoppageReason);
        } else {
          activeDateSet.add(dateStr);
          if (a.location) {
            if (!locationDayMap.has(a.location))
              locationDayMap.set(a.location, new Set());
            locationDayMap.get(a.location)!.add(dateStr);
          }
        }
      }

      const activeDays = activeDateSet.size;
      const stopDays = stopDateSet.size;
      const locationDays = Array.from(locationDayMap.entries())
        .map(([loc, days]) => ({
          location: loc,
          days: days.size,
        }))
        .sort((a, b) => b.days - a.days);

      // Top stoppage reason (most frequent)
      const reasonFreq: Record<string, number> = {};
      for (const r of stoppageReasons) {
        reasonFreq[r] = (reasonFreq[r] || 0) + 1;
      }
      const topStoppageReason =
        Object.entries(reasonFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

      // Consumables (manual entries only, all dates)
      const consumableRows = await storage.getProjectConsumables(
        parseInt(projectId),
      );
      const consumableAgg = new Map<
        string,
        { itemName: string; totalQty: number; itemUnit: string }
      >();
      for (const entry of consumableRows) {
        for (const item of entry.items) {
          if (item.inventoryItemId) continue; // skip inventory-linked
          const key = `${item.itemName}||${item.itemUnit}`;
          if (!consumableAgg.has(key)) {
            consumableAgg.set(key, {
              itemName: item.itemName || "",
              totalQty: 0,
              itemUnit: item.itemUnit || "",
            });
          }
          consumableAgg.get(key)!.totalQty += Number(item.quantity);
        }
      }
      const consumables = Array.from(consumableAgg.values());

      // Selected photos with group + activity metadata
      let photosByLocation: any[] = [];
      if (selectedPhotoIds.length > 0) {
        const selectedIds = selectedPhotoIds.map(Number);
        const photos = await db
          .select({
            id: projectPhotos.id,
            filePath: projectPhotos.filePath,
            filename: projectPhotos.filename,
            originalName: projectPhotos.originalName,
            groupId: projectPhotos.groupId,
            groupTitle: projectPhotoGroups.title,
            groupDescription: projectPhotoGroups.description,
            groupDate: projectPhotoGroups.date,
            activityId: projectPhotoGroups.dailyActivityId,
            activityDate: dailyActivities.date,
            activityLocation: dailyActivities.location,
          })
          .from(projectPhotos)
          .innerJoin(
            projectPhotoGroups,
            eq(projectPhotos.groupId, projectPhotoGroups.id),
          )
          .leftJoin(
            dailyActivities,
            eq(projectPhotoGroups.dailyActivityId, dailyActivities.id),
          )
          .where(
            and(
              inArray(projectPhotos.id, selectedIds),
              eq(projectPhotoGroups.projectId, parseInt(projectId)),
            ),
          );

        // Restore user-defined order: sort fetched photos by their position in selectedIds
        const selectedIdOrder = new Map<number, number>(
          selectedIds.map((id: number, idx: number) => [id, idx]),
        );
        photos.sort(
          (a, b) =>
            (selectedIdOrder.get(a.id) ?? 0) - (selectedIdOrder.get(b.id) ?? 0),
        );

        // Group by location → groups
        const locationMap = new Map<string, Map<number, any>>();
        for (const p of photos) {
          const loc = p.activityLocation || null;
          const locKey = loc || "__GENERAL__";
          if (!locationMap.has(locKey)) locationMap.set(locKey, new Map());
          const groupMap = locationMap.get(locKey)!;
          if (!groupMap.has(p.groupId!)) {
            groupMap.set(p.groupId!, {
              groupId: p.groupId,
              title: p.groupTitle,
              description: p.groupDescription,
              date: p.groupDate,
              activityDate: p.activityDate,
              photos: [],
            });
          }
          const storedPath = p.filePath || "";
          // Build absolute URL for img src
          const absFilePath = storedPath
            ? storedPath.startsWith("http")
              ? storedPath
              : `${baseUrl}${storedPath.startsWith("/") ? "" : "/"}${storedPath}`
            : "";
          // Pre-compute aspect ratio from local filesystem path so the HTML generator
          // never needs to do filesystem I/O.  Stored paths look like "/uploads/..." so
          // we strip the leading slash before joining with cwd.
          let aspectRatio = 1.5; // landscape default
          try {
            const relPath = storedPath.startsWith("/")
              ? storedPath.slice(1)
              : storedPath;
            const fullLocalPath = path.join(process.cwd(), relPath);
            const dims = imageSize(fullLocalPath);
            if (dims.width && dims.height)
              aspectRatio = dims.width / dims.height;
          } catch {}
          groupMap.get(p.groupId!)!.photos.push({
            id: p.id,
            filePath: absFilePath,
            aspectRatio,
            filename: p.filename,
          });
        }

        // Build ordered array: named locations first (sorted by first seen), then GENERAL
        const namedLocations: any[] = [];
        const generalGroups: any[] = [];
        for (const [locKey, groupMap] of locationMap.entries()) {
          const groups = Array.from(groupMap.values());
          if (locKey === "__GENERAL__") {
            generalGroups.push(...groups);
          } else {
            namedLocations.push({ location: locKey, groups });
          }
        }
        photosByLocation = [
          ...namedLocations,
          ...(generalGroups.length
            ? [{ location: null, groups: generalGroups }]
            : []),
        ];
      }

      const company = await storage.getCompany();

      // Convert vessel image stored path to absolute URL for the HTML generator
      const rawVesselImage = (project as any).vesselImage || "";
      const vesselImageUrl = rawVesselImage
        ? rawVesselImage.startsWith("http")
          ? rawVesselImage
          : `${baseUrl}${rawVesselImage.startsWith("/") ? "" : "/"}${rawVesselImage}`
        : "";

      const html = generateCompletionReportHTML({
        project: {
          ...project,
          customerName: (project as any).customerName,
          vesselImageUrl,
        },
        company,
        sections,
        stats: {
          totalDays,
          activeDays,
          stopDays,
          locationDays,
          topStoppageReason,
        },
        photosByLocation,
        consumables,
        reportTitle: reportTitle || project.title,
      });

      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (error) {
      console.error("Completion report error:", error);
      res.status(500).json({ message: "Failed to generate completion report" });
    }
  });

  app.post(
    "/api/print/projectbk",
    requireAuth,
    upload.single("reportImage"),
    async (req, res) => {
      try {
        const {
          id,
          fromDate,
          toDate,
          reportDate,
          includeRemainingDays,
          includeHBMHours,
        } = req.body;
        const project = await storage.getProjectPrint(
          id,
          fromDate,
          toDate,
          reportDate,
          includeRemainingDays,
          includeHBMHours,
        );

        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }
        if (req.file) {
          project.reportImage = `/${req.file.path}`;
        }
        project.company = await storage.getCompany();

        res.json(project);
      } catch (error) {
        res.status(500).json({ message: "Failed to get project" });
      }
    },
  );

  app.post(
    "/api/projects",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    upload.single("vesselImage"),
    async (req, res) => {
      try {
        const parsedData = parseProjectDataFromFormData(req.body);

        if (req.file) {
          parsedData.vesselImage = `/${req.file.path}`;
        }

        const validatedData = insertProjectSchema.parse(parsedData);
        const project = await storage.createProject(validatedData);
        res.status(201).json(project);
      } catch (error) {
        console.error("Project creation error:", error);
        if (error instanceof ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create project" });
      }
    },
  );

  app.put(
    "/api/projects/:id",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    upload.single("vesselImage"),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const projectData = parseProjectDataFromFormData(req.body);

        if (req.file) {
          projectData.vesselImage = `/${req.file.path}`;
        }

        // If status is being changed to completed, set actual end date
        if (projectData.status === "completed" && !projectData.actualEndDate) {
          projectData.actualEndDate = new Date();
        }

        const project = await storage.updateProject(id, projectData);

        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }

        // Recalculate cost if the project dates changed or status changed
        if (
          projectData.startDate ||
          projectData.actualEndDate ||
          projectData.status
        ) {
          await storage.recalculateProjectCost(id);
        }

        res.json(project);
      } catch (error) {
        console.error("Project update error:", error);
        res.status(500).json({ message: "Failed to update project" });
      }
    },
  );

  // Manual cost recalculation endpoint
  app.post(
    "/api/projects/:id/recalculate-cost",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.id);
        await storage.recalculateProjectCost(projectId);

        const updatedProject = await storage.getProject(projectId);
        res.json({
          message: "Project cost recalculated successfully",
          project: updatedProject,
        });
      } catch (error) {
        res.status(500).json({ message: "Failed to recalculate project cost" });
      }
    },
  );

  // Project revenue routes (restricted to admin and finance)
  app.get(
    "/api/projects/:id/revenue",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.id);
        const revenueData = await storage.getProjectRevenue(projectId);
        res.json(revenueData);
      } catch (error) {
        console.error("Get project revenue error:", error);
        res.status(500).json({ message: "Failed to get project revenue" });
      }
    },
  );

  app.post(
    "/api/projects/:id/recalculate-revenue",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.id);
        await storage.updateProjectRevenue(projectId);

        const revenueData = await storage.getProjectRevenue(projectId);
        res.json({
          message: "Project revenue recalculated successfully",
          revenue: revenueData,
        });
      } catch (error) {
        console.error("Recalculate project revenue error:", error);
        res
          .status(500)
          .json({ message: "Failed to recalculate project revenue" });
      }
    },
  );

  // Project Employee Assignment routes
  app.get("/api/projects/:id/employees", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }
      const employees = await storage.getProjectEmployees(projectId);
      res.json(employees);
    } catch (error) {
      console.error("Error getting project employees:", error);
      res.status(500).json({ message: "Failed to get project employees" });
    }
  });

  app.post(
    "/api/projects/:id/employees",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.id);
        const { assignments } = req.body;

        console.log("Received team assignment request:", {
          projectId,
          assignments,
        });

        if (!Array.isArray(assignments)) {
          return res
            .status(400)
            .json({ message: "Assignments must be an array" });
        }

        if (assignments.length === 0) {
          return res
            .status(400)
            .json({ message: "At least one assignment is required" });
        }

        // Validate assignment structure
        for (const assignment of assignments) {
          if (
            !assignment.employeeId ||
            typeof assignment.employeeId !== "number"
          ) {
            return res.status(400).json({
              message: "Each assignment must have a valid employeeId",
            });
          }

          // Validate date formats if provided
          if (assignment.startDate && assignment.startDate.trim()) {
            const startDate = new Date(assignment.startDate);
            if (isNaN(startDate.getTime())) {
              return res
                .status(400)
                .json({ message: "Invalid start date format" });
            }
          }

          if (assignment.endDate && assignment.endDate.trim()) {
            const endDate = new Date(assignment.endDate);
            if (isNaN(endDate.getTime())) {
              return res
                .status(400)
                .json({ message: "Invalid end date format" });
            }
          }
        }

        const result = await storage.assignEmployeesToProject(
          projectId,
          assignments,
        );
        console.log("Team assignment result:", result);
        res.status(201).json(result);
      } catch (error) {
        console.error("Team assignment error:", error);
        const status = (error as any).message?.includes("already assigned")
          ? 400
          : 500;
        res
          .status(status)
          .send(error instanceof Error ? error.message : "Unknown error");
      }
    },
  );

  app.delete(
    "/api/projects/:id/employees/:employeeId",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.id);
        const employeeId = parseInt(req.params.employeeId);

        console.log(
          `API: Removing employee ${employeeId} from project ${projectId}`,
        );

        // Validate parameters
        if (isNaN(projectId) || isNaN(employeeId)) {
          console.log(
            `Invalid parameters: projectId=${req.params.id}, employeeId=${req.params.employeeId}`,
          );
          return res
            .status(400)
            .json({ message: "Invalid project ID or employee ID" });
        }

        // Check if project exists
        const project = await storage.getProject(projectId);
        if (!project) {
          console.log(`Project ${projectId} not found`);
          return res.status(404).json({ message: "Project not found" });
        }

        // Check if employee exists
        const employees = await storage.getEmployees();
        const employee = employees.find((emp) => emp.id === employeeId);
        if (!employee) {
          console.log(`Employee ${employeeId} not found`);
          return res.status(404).json({ message: "Employee not found" });
        }

        const removed = await storage.removeEmployeeFromProject(
          projectId,
          employeeId,
        );
        if (!removed) {
          console.log(
            `Assignment not found for employee ${employeeId} in project ${projectId}`,
          );
          return res.status(404).json({ message: "Assignment not found" });
        }

        console.log(
          `Successfully removed employee ${employeeId} from project ${projectId}`,
        );
        res.json({ message: "Employee removed from project successfully" });
      } catch (error) {
        console.error("Error removing employee from project:", error);
        res
          .status(500)
          .json({ message: "Failed to remove employee from project" });
      }
    },
  );

  // Inventory routes
  app.get("/api/inventory", requireAuth, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || "";
      const category = (req.query.category as string) || "";
      const lowStock = req.query.lowStock === "true";

      const result = await storage.getInventoryItemsPaginated(
        page,
        limit,
        search,
        category,
        lowStock,
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get inventory items" });
    }
  });

  app.post(
    "/api/inventory",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const { initialQuantity, unitPrice, ...itemData } =
          insertInventoryItemSchema.parse(req.body);
        const item = await storage.createInventoryItem({
          ...itemData,
          currentStock: initialQuantity || 0,
          avgCost: unitPrice?.toString() || "0",
        });
        res.status(201).json(item);
      } catch (error: any) {
        if (error instanceof ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        if (error.code === "23505") {
          return res.status(409).json({
            message: "SKU already exists. Please use a unique SKU",
          });
        }
        res.status(500).json({ message: "Failed to create inventory item" });
      }
    },
  );

  app.put(
    "/api/inventory/:id",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const itemData = req.body;
        const item = await storage.updateInventoryItem(id, itemData);

        if (!item) {
          return res.status(404).json({ message: "Inventory item not found" });
        }

        res.json(item);
      } catch (error: any) {
        if (error.code === "23505") {
          return res
            .status(409)
            .json({
              message: "SKU already exists. Please use a unique SKU",
            });
        }
        res.status(500).json({ message: "Failed to update inventory item" });
      }
    },
  );

  // Asset Types routes for Enhanced Asset Inventory
  app.get("/api/asset-types", requireAuth, async (req, res) => {
    try {
      const assetTypes = await storage.getAssetTypes();
      res.json(assetTypes);
    } catch (error: any) {
      res
        .status(500)
        .json({ message: error?.message || "Failed to fetch asset types" });
    }
  });

  app.post("/api/asset-types", requireAuth, async (req, res) => {
    try {
      const assetType = await storage.createAssetType(req.body);
      res.status(201).json(assetType);
    } catch (error: any) {
      res
        .status(500)
        .json({ message: error?.message || "Failed to create asset type" });
    }
  });

  app.put("/api/asset-types/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const assetType = await storage.updateAssetType(id, req.body);
      res.json(assetType);
    } catch (error: any) {
      res
        .status(500)
        .json({ message: error?.message || "Failed to update asset type" });
    }
  });

  // Enhanced Asset Inventory Instance routes
  app.get("/api/asset-inventory/instances", requireAuth, async (req, res) => {
    try {
      const instances = await storage.getAllAssetInventoryInstances();
      res.json(instances);
    } catch (error: any) {
      res.status(500).json({
        message: error?.message || "Failed to fetch asset inventory instances",
      });
    }
  });

  app.get(
    "/api/asset-inventory/instances/by-type/:assetTypeId",
    requireAuth,
    async (req, res) => {
      try {
        const instances = await storage.getAssetInventoryInstancesByType(
          parseInt(req.params.assetTypeId),
        );
        res.json(instances);
      } catch (error: any) {
        res.status(500).json({
          message: error?.message || "Failed to fetch instances for asset type",
        });
      }
    },
  );

  app.get(
    "/api/asset-inventory/instances/available/:assetTypeId",
    requireAuth,
    async (req, res) => {
      try {
        const instances = await storage.getAvailableInstancesForAssignment(
          parseInt(req.params.assetTypeId),
        );
        res.json(instances);
      } catch (error: any) {
        res.status(500).json({
          message: error?.message || "Failed to fetch available instances",
        });
      }
    },
  );

  app.get(
    "/api/asset-inventory/instances/:id",
    requireAuth,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const instance = await storage.getAssetInventoryInstance(id);
        if (!instance) {
          return res.status(404).json({ message: "Asset instance not found" });
        }
        res.json(instance);
      } catch (error: any) {
        res.status(500).json({
          message: error?.message || "Failed to fetch asset instance",
        });
      }
    },
  );

  app.post("/api/asset-inventory/instances", requireAuth, async (req, res) => {
    try {
      const instance = await storage.createAssetInventoryInstance(req.body);
      res.status(201).json(instance);
    } catch (error: any) {
      res.status(500).json({
        message: error?.message || "Failed to create asset inventory instance",
      });
    }
  });

  app.put(
    "/api/asset-inventory/instances/:id",
    requireAuth,
    async (req, res) => {
      try {
        const instance = await storage.updateAssetInventoryInstance(
          parseInt(req.params.id),
          req.body,
        );
        res.json(instance);
      } catch (error: any) {
        res.status(500).json({
          message:
            error?.message || "Failed to update asset inventory instance",
        });
      }
    },
  );

  // Get all maintenance records for reporting
  app.get("/api/maintenance-records", requireAuth, async (req, res) => {
    try {
      const maintenanceRecords = await storage.getAllAssetMaintenanceRecords();
      res.json(maintenanceRecords);
    } catch (error) {
      console.error("Error fetching all maintenance records:", error);
      res.status(500).json({ message: "Failed to fetch maintenance records" });
    }
  });
  // Daily Activities routes
  app.get("/api/projects/activities", requireAuth, async (req, res) => {
    try {
      // This is for the general activities page - return all activities
      // You might want to implement this differently based on your needs
      res.json([]);
    } catch (error) {
      console.error("Error getting all daily activities:", error);
      res.status(500).json({ message: "Failed to get daily activities" });
    }
  });

  app.get(
    "/api/projects/:projectId/activities",
    requireAuth,
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.projectId);
        if (isNaN(projectId)) {
          return res.status(400).json({ message: "Invalid project ID" });
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;

        const result = await storage.getDailyActivitiesPaginated(
          projectId,
          limit,
          offset,
        );
        res.json(result);
      } catch (error) {
        console.error("Error getting daily activities:", error);
        res.status(500).json({ message: "Failed to get daily activities" });
      }
    },
  );

  app.get(
    "/api/projects/:projectId/activities/all",
    requireAuth,
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.projectId);
        if (isNaN(projectId)) {
          return res.status(400).json({ message: "Invalid project ID" });
        }

        const activities = await storage.getDailyActivities(projectId);
        res.json(activities);
      } catch (error) {
        console.error("Error getting all daily activities:", error);
        res.status(500).json({ message: "Failed to get daily activities" });
      }
    },
  );

  app.get(
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

  app.get(
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

  app.get(
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

  // Planned Activities routes
  app.get(
    "/api/projects/:projectId/planned-activities",
    requireAuth,
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.projectId);
        if (isNaN(projectId)) {
          return res.status(400).json({ message: "Invalid project ID" });
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;

        const result = await storage.getPlannedActivitiesPaginated(
          projectId,
          limit,
          offset,
        );
        res.json(result);
      } catch (error) {
        console.error("Error getting planned activities:", error);
        res.status(500).json({ message: "Failed to get planned activities" });
      }
    },
  );

  app.post(
    "/api/projects/:projectId/planned-activities",
    requireAuth,
    requireRole(["admin", "project_manager", "employee"]),
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.projectId);
        if (isNaN(projectId)) {
          return res.status(400).json({ message: "Invalid project ID" });
        }

        const activities = req.body;
        if (!Array.isArray(activities) || activities.length === 0) {
          return res
            .status(400)
            .json({ message: "Activities array is required" });
        }

        // Validate each activity
        for (const activity of activities) {
          if (!activity.tasks || !activity.date) {
            return res
              .status(400)
              .json({ message: "Each activity must have tasks and date" });
          }
        }

        const result = await storage.savePlannedActivities(
          projectId,
          activities,
        );
        res.status(201).json(result);
      } catch (error) {
        console.error("Error saving planned activities:", error);
        res.status(500).json({ message: "Failed to save planned activities" });
      }
    },
  );

  app.post(
    "/api/projects/:id/photo-groups",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    (req, res, next) => {
      upload.array("photos", 20)(req, res, (err) => {
        if (err instanceof multer.MulterError) {
          // A Multer error occurred when uploading.
          return res.status(400).json({ message: err.message });
        } else if (err) {
          // An unknown error occurred when uploading.
          return res.status(400).json({ message: err.message });
        }
        next();
      });
    },
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.id);
        const { title, date, description } = req.body;
        let { dailyActivityId } = req.body;

        if (!title || !date) {
          return res
            .status(400)
            .json({ message: "Title and date are required" });
        }

        if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
          return res
            .status(400)
            .json({ message: "At least one photo is required" });
        }

        const project = await storage.getProject(projectId);
        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }

        const photoDate = new Date(date);
        if (project.startDate && photoDate < new Date(project.startDate)) {
          return res.status(400).json({
            message: "Photo group date cannot be before project start date",
          });
        }

        const projectEndDate = project.actualEndDate || project.plannedEndDate;
        if (projectEndDate && photoDate > new Date(projectEndDate)) {
          return res.status(400).json({
            message: "Photo group date cannot be after project end date",
          });
        }

        // Auto-link to daily activity if not provided
        if (!dailyActivityId) {
          const activities = await storage.getDailyActivities(projectId);
          const matchingActivity = activities.find((a) => {
            const activityDate = new Date(a.date);
            return (
              activityDate.getUTCFullYear() === photoDate.getUTCFullYear() &&
              activityDate.getUTCMonth() === photoDate.getUTCMonth() &&
              activityDate.getUTCDate() === photoDate.getUTCDate()
            );
          });
          if (matchingActivity) {
            dailyActivityId = matchingActivity.id;
          }
        }

        const parsedGroupData = insertProjectPhotoGroupSchema.parse({
          projectId,
          title,
          date,
          description,
          dailyActivityId: dailyActivityId ? parseInt(dailyActivityId) : null,
          createdBy: req.session.userId,
        });

        const group = await storage.createProjectPhotoGroup(parsedGroupData);

        if (req.files && (req.files as Express.Multer.File[]).length > 0) {
          const files = req.files as Express.Multer.File[];
          const photosData = files.map((file) => ({
            filename: file.filename,
            originalName: file.originalname,
            filePath: `/${file.path.replace(/\\/g, "/")}`,
            fileSize: file.size,
            mimeType: file.mimetype,
          }));

          await storage.addPhotosToPhotoGroup(group.id, photosData);
        }

        res.status(201).json(group);
      } catch (error) {
        console.error("Create photo group error:", error);
        res.status(500).json({ message: "Failed to create photo group" });
      }
    },
  );

  app.get("/api/projects/:id/photo-groups", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const photoGroups = await storage.getProjectPhotoGroups(projectId);
      res.json(photoGroups);
    } catch (error) {
      console.error("Get photo groups error:", error);
      res.status(500).json({ message: "Failed to get photo groups" });
    }
  });

  app.delete(
    "/api/projects/:projectId/photo-groups/:groupId",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const groupId = parseInt(req.params.groupId);
        if (isNaN(groupId)) {
          return res.status(400).json({ message: "Invalid group ID" });
        }

        const deleted = await storage.deleteProjectPhotoGroup(groupId);
        if (!deleted) {
          // This might happen if the group was already deleted, but we'll treat it
          // as a success for the client to avoid unnecessary error messages.
          console.warn(
            `Attempted to delete a photo group that might not exist: ID ${groupId}`,
          );
        }

        res.status(200).json({ message: "Photo group deleted successfully" });
      } catch (error) {
        console.error("Delete photo group error:", error);
        res.status(500).json({ message: "Failed to delete photo group" });
      }
    },
  );

  // Project Consumables routes
  app.get(
    "/api/projects/:projectId/consumables",
    requireAuth,
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.projectId);
        if (isNaN(projectId)) {
          return res.status(400).json({ message: "Invalid project ID" });
        }
        const consumables = await storage.getProjectConsumables(projectId);
        res.json(consumables);
      } catch (error) {
        console.error("Error getting project consumables:", error);
        res.status(500).json({ message: "Failed to get project consumables" });
      }
    },
  );

  app.post(
    "/api/projects/:projectId/consumables",
    requireAuth,
    requireRole(["admin", "project_manager", "employee"]),
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.projectId);
        if (isNaN(projectId)) {
          return res.status(400).json({ message: "Invalid project ID" });
        }

        const { date, items } = req.body;

        if (!date || !items || !Array.isArray(items) || items.length === 0) {
          return res
            .status(400)
            .json({ message: "Date and items array are required" });
        }

        // Validate each item
        for (const item of items) {
          if (!item.quantity || item.quantity <= 0) {
            return res.status(400).json({
              message: "Each item must have a positive quantity",
            });
          }
          if (!item.inventoryItemId && !item.itemName) {
            return res.status(400).json({
              message:
                "Each item must have either an inventory item or a name for manual entry",
            });
          }
        }

        const result = await storage.createProjectConsumables(
          projectId,
          date,
          items,
          req.session.userId,
        );

        res.status(201).json(result);
      } catch (error) {
        console.error("Error creating project consumables:", error);
        res.status(500).json({
          message: "Failed to record consumables usage",
          error: error.message,
        });
      }
    },
  );

  // UPDATE a manual consumable item
  app.put(
    "/api/projects/:projectId/consumables/items/:itemId",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.projectId);
        const itemId = parseInt(req.params.itemId);

        if (isNaN(projectId) || isNaN(itemId)) {
          return res.status(400).json({ message: "Invalid ID parameters" });
        }

        const { itemName, itemUnit, quantity, unitCost } = req.body;

        if (!itemName || !quantity || quantity <= 0) {
          return res
            .status(400)
            .json({ message: "Invalid item data provided" });
        }

        const result = await storage.updateProjectConsumableItem(
          itemId,
          projectId,
          {
            itemName,
            itemUnit: itemUnit || "pcs",
            quantity,
            unitCost: unitCost || 0,
          },
        );

        res.json(result);
      } catch (error: any) {
        console.error("Error updating consumable item:", error);
        res.status(500).json({
          message: error.message || "Failed to update consumable item",
        });
      }
    },
  );

  app.post(
    "/api/projects/:projectId/consumables/goods-issue",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.projectId);
        if (isNaN(projectId)) {
          return res.status(400).json({ message: "Invalid project ID" });
        }
        const { consumableIds } = req.body;
        if (
          !consumableIds ||
          !Array.isArray(consumableIds) ||
          consumableIds.length === 0
        ) {
          return res
            .status(400)
            .json({ message: "consumableIds array is required" });
        }
        const result = await storage.createConsumablesGoodsIssue(
          projectId,
          consumableIds,
          req.session.userId,
        );
        res.status(201).json(result);
      } catch (error) {
        console.error("Error creating consumables goods issue:", error);
        res.status(500).json({
          message: "Failed to create goods issue",
          error: error.message,
        });
      }
    },
  );

  app.get(
    "/api/projects/activities/activities",
    requireAuth,
    async (req, res) => {
      try {
        // Return empty array for now - implement based on your requirements
        res.json([]);
      } catch (error) {
        console.error("Error getting activities:", error);
        res.status(500).json({ message: "Failed to get activities" });
      }
    },
  );

  app.get(
    "/api/projects/activities/employees",
    requireAuth,
    async (req, res) => {
      try {
        // Return empty array for now - implement based on your requirements
        res.json([]);
      } catch (error) {
        console.error("Error getting employees:", error);
        res.status(500).json({ message: "Failed to get employees" });
      }
    },
  );

  app.get(
    "/api/projects/activities/consumables",
    requireAuth,
    async (req, res) => {
      try {
        // Return empty array for now - implement based on your requirements
        res.json([]);
      } catch (error) {
        console.error("Error getting consumables:", error);
        res.status(500).json({ message: "Failed to get consumables" });
      }
    },
  );

  app.post(
    "/api/projects/:projectId/activities",
    requireAuth,
    requireRole(["admin", "project_manager", "employee"]),
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.projectId);

        // Ensure date is properly formatted
        const activityData = {
          ...req.body,
          projectId,
          date: new Date(req.body.date),
          photos: req.body.photos || [],
        };

        console.log("Activity data to validate:", activityData);

        const validatedData = insertDailyActivitySchema.parse(activityData);
        const activity = await storage.createDailyActivity(validatedData);
        res.status(201).json(activity);
      } catch (error) {
        console.error("Activity creation error:", error);
        if (error instanceof ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create daily activity" });
      }
    },
  );

  app.put(
    "/api/projects/:projectId/activities/:activityId",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const activityId = parseInt(req.params.activityId);
        const projectId = parseInt(req.params.projectId);

        const activityData = {
          ...req.body,
          projectId,
          date: req.body.date ? new Date(req.body.date) : undefined,
        };

        const validatedData = insertDailyActivitySchema
          .partial()
          .parse(activityData);

        const activity = await storage.updateDailyActivity(
          activityId,
          validatedData,
        );
        if (!activity) {
          return res.status(404).json({ message: "Daily activity not found" });
        }

        // Enforce one remark per day: if this record has a remark, clear remarks
        // from all other records for the same project and date
        if (activity.remarks && activity.date) {
          const activityDate = new Date(activity.date);
          const startOfDay = new Date(activityDate);
          startOfDay.setUTCHours(0, 0, 0, 0);
          const endOfDay = new Date(activityDate);
          endOfDay.setUTCHours(23, 59, 59, 999);

          await db
            .update(dailyActivities)
            .set({ remarks: "" })
            .where(
              and(
                eq(dailyActivities.projectId, projectId),
                gte(
                  dailyActivities.date,
                  sql`${startOfDay.toISOString()}::timestamp`,
                ),
                lte(
                  dailyActivities.date,
                  sql`${endOfDay.toISOString()}::timestamp`,
                ),
                ne(dailyActivities.id, activityId),
              ),
            );
        }

        res.json(activity);
      } catch (error) {
        console.error("Activity update error:", error);
        res.status(500).json({ message: "Failed to update daily activity" });
      }
    },
  );

  app.delete(
    "/api/projects/:projectId/activities/:activityId",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const activityId = parseInt(req.params.activityId);
        const success = await storage.deleteDailyActivity(activityId);
        if (!success) {
          return res.status(404).json({ message: "Daily activity not found" });
        }
        res.json({ message: "Daily activity deleted successfully" });
      } catch (error) {
        console.error("Activity deletion error:", error);
        res.status(500).json({ message: "Failed to delete daily activity" });
      }
    },
  );

  // Asset assignment routes
  app.post(
    "/api/projects/:id/asset-assignments",
    requireAuth,
    async (req: any, res: any) => {
      try {
        const projectId = parseInt(req.params.id);
        const { assetId, startDate, endDate, monthlyRate } = req.body;

        if (!assetId || !startDate || !endDate || !monthlyRate) {
          return res.status(400).json({
            message:
              "Asset ID, start date, end date, and monthly rate are required",
          });
        }

        // Validate that the provided monthly rate matches the asset's rate
        const asset = await storage.getAssetInventoryInstance(assetId);
        if (!asset) {
          return res.status(404).json({ message: "Asset instance not found" });
        }

        const assetMonthlyRate = asset.monthlyRentalAmount
          ? parseFloat(asset.monthlyRentalAmount)
          : 0;
        if (Math.abs(monthlyRate - assetMonthlyRate) > 0.01) {
          // Allow small floating point differences
          return res.status(400).json({
            message: `Monthly rate mismatch. Asset rate is ${assetMonthlyRate}, provided rate is ${monthlyRate}`,
          });
        }

        // Calculate total cost based on monthly rate and duration (pro-rated)
        const start = new Date(startDate);
        const end = new Date(endDate);
        const totalCost = await storage.calculateAssetRentalCost(
          start,
          end,
          parseFloat(monthlyRate),
        );

        const assignmentData = {
          projectId,
          assetId: parseInt(assetId),
          startDate: start,
          endDate: end,
          monthlyRate: monthlyRate.toString(),
          totalCost: totalCost.toString(),
          assignedBy: req.session.userId,
        };

        const assignment =
          await storage.createProjectAssetAssignment(assignmentData);
        res.status(201).json(assignment);
      } catch (error) {
        console.error("Error assigning asset to project:", error);
        res.status(500).json({ message: "Failed to assign asset to project" });
      }
    },
  );

  app.put(
    "/api/projects/:projectId/asset-assignments/:assignmentId",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const assignmentId = parseInt(req.params.assignmentId);
        const { startDate, endDate, monthlyRate } = req.body;

        if (!startDate || !endDate || !monthlyRate) {
          return res.status(400).json({
            message: "Start date, end date, and monthly rate are required",
          });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (end <= start) {
          return res
            .status(400)
            .json({ message: "End date must be after start date" });
        }

        const totalCost = await storage.calculateAssetRentalCost(
          start,
          end,
          parseFloat(monthlyRate),
        );

        const assignmentData = {
          startDate: start,
          endDate: end,
          monthlyRate: monthlyRate.toString(),
          totalCost: totalCost.toString(),
        };

        const assignment = await storage.updateProjectAssetAssignment(
          assignmentId,
          assignmentData,
        );

        if (!assignment) {
          return res
            .status(404)
            .json({ message: "Asset assignment not found" });
        }

        res.json(assignment);
      } catch (error) {
        console.error("Error updating project asset assignment:", error);
        res.status(500).json({ message: "Failed to update asset assignment" });
      }
    },
  );

  app.delete(
    "/api/projects/:projectId/asset-assignments/:assignmentId",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const assignmentId = parseInt(req.params.assignmentId);
        const deleted =
          await storage.deleteProjectAssetAssignment(assignmentId);

        if (!deleted) {
          return res
            .status(404)
            .json({ message: "Asset assignment not found" });
        }

        res.json({ message: "Asset assignment deleted successfully" });
      } catch (error) {
        console.error("Error deleting project asset assignment:", error);
        res.status(500).json({ message: "Failed to delete asset assignment" });
      }
    },
  );

  // Asset Instance Assignment routes (NEW)
  app.get(
    "/api/projects/:id/asset-instance-assignments",
    requireAuth,
    async (req: any, res: any) => {
      try {
        const projectId = parseInt(req.params.id);
        const assignments =
          await storage.getProjectAssetInstanceAssignments(projectId);
        res.json(assignments);
      } catch (error) {
        console.error(
          "Error getting project asset instance assignments:",
          error,
        );
        res
          .status(500)
          .json({ message: "Failed to get asset instance assignments" });
      }
    },
  );

  app.post(
    "/api/projects/:id/asset-instance-assignments",
    requireAuth,
    async (req: any, res: any) => {
      try {
        const projectId = parseInt(req.params.id);
        const { instanceId, startDate, endDate, notes, monthlyRate } = req.body;

        if (!instanceId || !startDate || !monthlyRate) {
          return res.status(400).json({
            message: "Instance ID, start date and monthly rate are required",
          });
        }

        // Get asset instance details
        const instance = await storage.getAssetInventoryInstance(instanceId);
        if (!instance) {
          return res.status(404).json({ message: "Asset instance not found" });
        }

        // Validate dates if endDate is provided
        if (endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          if (end <= start) {
            return res.status(400).json({
              message: "End date must be after start date",
            });
          }
        }

        // Create assignment data
        const assignmentData = {
          projectId,
          assetTypeId: instance.assetTypeId,
          instanceId,
          barcode: instance.barcode,
          serialNumber: instance.serialNumber,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          monthlyRate: monthlyRate.toString(),
          status: "active",
          assignedBy: req.session.userId,
          notes: notes || null,
        };

        const assignment =
          await storage.createProjectAssetInstanceAssignment(assignmentData);
        res.status(201).json(assignment);
      } catch (error) {
        console.error("Error creating asset instance assignment:", error);
        res
          .status(500)
          .json({ message: "Failed to create asset instance assignment" });
      }
    },
  );

  app.put(
    "/api/projects/:projectId/asset-instance-assignments/:assignmentId",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const assignmentId = parseInt(req.params.assignmentId);
        const { startDate, endDate, status, notes, monthlyRate } = req.body;

        const updateData: any = {};

        if (startDate) {
          updateData.startDate = new Date(startDate);
        }
        if (endDate) {
          updateData.endDate = new Date(endDate);
        }
        if (status) {
          updateData.status = status;
        }
        if (notes !== undefined) {
          updateData.notes = notes;
        }
        if (monthlyRate) {
          updateData.monthlyRate = monthlyRate.toString();
        }

        // If status is being changed to completed, set returnedAt
        if (status === "completed" && !updateData.returnedAt) {
          updateData.returnedAt = new Date();
        }

        const updatedAssignment =
          await storage.updateProjectAssetInstanceAssignment(
            assignmentId,
            updateData,
          );

        if (!updatedAssignment) {
          return res
            .status(404)
            .json({ message: "Asset instance assignment not found" });
        }

        res.json(updatedAssignment);
      } catch (error) {
        console.error("Error updating asset instance assignment:", error);
        res
          .status(500)
          .json({ message: "Failed to update asset instance assignment" });
      }
    },
  );

  app.delete(
    "/api/projects/:projectId/asset-instance-assignments/:assignmentId",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const assignmentId = parseInt(req.params.assignmentId);
        const deleted =
          await storage.deleteProjectAssetInstanceAssignment(assignmentId);

        if (!deleted) {
          return res
            .status(404)
            .json({ message: "Asset instance assignment not found" });
        }

        res.json({ message: "Asset instance assignment deleted successfully" });
      } catch (error) {
        console.error("Error deleting asset instance assignment:", error);
        res
          .status(500)
          .json({ message: "Failed to delete asset instance assignment" });
      }
    },
  );

  // Get all asset assignments for earnings calculation (legacy)
  app.get("/api/asset-assignments", requireAuth, async (req, res) => {
    try {
      const assignments = await storage.getAllAssetAssignments();
      res.json(assignments);
    } catch (error) {
      console.error("Error getting all asset assignments:", error);
      res.json([]); // Return empty array instead of error to prevent reports from failing
    }
  });

  // Get all asset instance assignments for reports
  app.get("/api/asset-instance-assignments", requireAuth, async (req, res) => {
    try {
      const assignments = await storage.getAllAssetInstanceAssignments();
      res.json(assignments);
    } catch (error) {
      console.error("Error getting all asset instance assignments:", error);
      res.json([]);
    }
  });

  app.get("/api/my-payslips", requireAuth, async (req, res) => {
    try {
      const employee = await storage.getEmployeeByUserId(req.session.userId!);
      if (!employee) {
        return res.json([]);
      }

      const month = req.query.month
        ? parseInt(req.query.month as string)
        : undefined;
      const year = req.query.year
        ? parseInt(req.query.year as string)
        : undefined;

      const entries = await storage.getPayrollEntries(month, year, employee.id);
      const paidEntries = entries.filter((e: any) => e.status === "paid");
      res.json(paidEntries);
    } catch (error) {
      console.error("Get my payslips error:", error);
      res.json([]);
    }
  });

  app.get("/api/my-payslips/:id/additions", requireAuth, async (req, res) => {
    try {
      const employee = await storage.getEmployeeByUserId(req.session.userId!);
      if (!employee) {
        return res.status(403).json({ message: "No employee record found" });
      }
      const payrollId = parseInt(req.params.id);
      const entry = await storage.getPayrollEntry(payrollId);
      if (!entry || entry.employeeId !== employee.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      const additions = await storage.getPayrollAdditions(payrollId);
      res.json(additions);
    } catch (error) {
      console.error("Get my payslip additions error:", error);
      res.status(500).json({ message: "Failed to get additions" });
    }
  });

  app.get("/api/my-payslips/:id/deductions", requireAuth, async (req, res) => {
    try {
      const employee = await storage.getEmployeeByUserId(req.session.userId!);
      if (!employee) {
        return res.status(403).json({ message: "No employee record found" });
      }
      const payrollId = parseInt(req.params.id);
      const entry = await storage.getPayrollEntry(payrollId);
      if (!entry || entry.employeeId !== employee.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      const deductions = await storage.getPayrollDeductions(payrollId);
      res.json(deductions);
    } catch (error) {
      console.error("Get my payslip deductions error:", error);
      res.status(500).json({ message: "Failed to get deductions" });
    }
  });

  // Payroll routes
  app.get(
    "/api/payroll",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const month = req.query.month
          ? parseInt(req.query.month as string)
          : undefined;
        const year = req.query.year
          ? parseInt(req.query.year as string)
          : undefined;

        const entries = await storage.getPayrollEntries(month, year);
        res.json(entries);
      } catch (error) {
        console.error("Get payroll entries error:", error);
        res.json([]); // Return empty array instead of error to prevent reports from failing
      }
    },
  );

  app.post(
    "/api/payroll/generate",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const { month, year } = req.body;

        if (!month || !year) {
          return res
            .status(400)
            .json({ message: "Month and year are required" });
        }

        if (!req.session?.userId) {
          return res.status(401).json({ message: "User session required" });
        }

        console.log(
          `[Payroll Route] Generating payroll for month: ${month}, year: ${year}, userId: ${req.session.userId}`,
        );

        const entries = await storage.generateMonthlyPayroll(
          month,
          year,
          req.session.userId,
        );
        res.status(201).json(entries);
      } catch (error) {
        console.error("Generate payroll error:", error);
        res
          .status(500)
          .json({ message: error.message || "Failed to generate payroll" });
      }
    },
  );

  app.delete(
    "/api/payroll/clear-period",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const month = parseInt(req.query.month as string);
        const year = parseInt(req.query.year as string);

        if (!month || !year || isNaN(month) || isNaN(year)) {
          return res
            .status(400)
            .json({ message: "Valid month and year are required" });
        }

        if (month < 1 || month > 12) {
          return res
            .status(400)
            .json({ message: "Month must be between 1 and 12" });
        }

        const result = await storage.clearPayrollPeriod(month, year);
        res.json(result);
      } catch (error) {
        console.error("Clear payroll period error:", error);
        res
          .status(500)
          .json({ message: error.message || "Failed to clear payroll period" });
      }
    },
  );

  app.put(
    "/api/payroll/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const payrollId = parseInt(req.params.id);
        const updateData = req.body;

        // Get the current payroll entry before updating
        const currentEntry = await storage.getPayrollEntry(payrollId);
        if (!currentEntry) {
          return res.status(404).json({ message: "Payroll entry not found" });
        }

        // Update the payroll entry
        const entry = await storage.updatePayrollEntry(payrollId, updateData);
        if (!entry) {
          return res.status(404).json({ message: "Payroll entry not found" });
        }

        // GL entries are now handled in the storage layer's updatePayrollEntry method

        res.json(entry);
      } catch (error) {
        console.error("Update payroll entry error:", error);
        res.status(500).json({ message: "Failed to update payroll entry" });
      }
    },
  );

  app.get(
    "/api/payroll/:id/additions",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const payrollId = parseInt(req.params.id);
        const additions = await storage.getPayrollAdditions(payrollId);
        res.json(additions);
      } catch (error) {
        console.error("Get payroll additions error:", error);
        res.status(500).json({ message: "Failed to get payroll additions" });
      }
    },
  );

  app.post(
    "/api/payroll/:id/additions",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const payrollId = parseInt(req.params.id);
        const additionData = { ...req.body, payrollEntryId: payrollId };

        const addition = await storage.createPayrollAddition(additionData);
        res.status(201).json(addition);
      } catch (error) {
        console.error("Create payroll addition error:", error);
        res.status(500).json({ message: "Failed to create payroll addition" });
      }
    },
  );

  app.get(
    "/api/payroll/:id/deductions",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const payrollId = parseInt(req.params.id);
        const deductions = await storage.getPayrollDeductions(payrollId);
        res.json(deductions);
      } catch (error) {
        console.error("Get payroll deductions error:", error);
        res.status(500).json({ message: "Failed to get payroll deductions" });
      }
    },
  );

  app.post(
    "/api/payroll/:id/deductions",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const payrollId = parseInt(req.params.id);
        const deductionData = { ...req.body, payrollEntryId: payrollId };

        const deduction = await storage.createPayrollDeduction(deductionData);
        res.status(201).json(deduction);
      } catch (error) {
        console.error("Create payroll deduction error:", error);
        res.status(500).json({ message: "Failed to create payroll deduction" });
      }
    },
  );

  app.get(
    "/api/sales/stats",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (_req, res) => {
      try {
        const stats = await storage.getSalesStats();
        res.json(stats);
      } catch (error) {
        console.error("Get sales stats error:", error);
        res.status(500).json({ message: "Failed to get sales stats" });
      }
    },
  );

  // Sales Quotations routes
  app.get(
    "/api/sales-quotations",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const filters = {
          search: req.query.search as string,
          status: req.query.status as string,
          customerId: req.query.customerId
            ? parseInt(req.query.customerId as string)
            : undefined,
          archived:
            req.query.archived === "true"
              ? true
              : req.query.archived === "false"
                ? false
                : undefined,
          startDate: req.query.startDate as string,
          endDate: req.query.endDate as string,
        };

        const result = await storage.getSalesQuotationsPaginated(
          page,
          limit,
          filters,
        );
        res.json(result);
      } catch (error) {
        console.error("Get sales quotations error:", error);
        res.status(500).json({ message: "Failed to get sales quotations" });
      }
    },
  );

  app.post(
    "/api/sales-quotations",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const quotationData = { ...req.body };

        // Auto-generate quotation number if not provided
        if (!quotationData.quotationNumber) {
          quotationData.quotationNumber = await storage.generateNextNumber(
            "QTN",
            salesQuotations,
            salesQuotations.quotationNumber,
          );
        }

        // Date fields should remain as ISO strings (YYYY-MM-DD format)
        // No conversion needed - Drizzle expects strings for date() columns

        console.log(
          `Attempting to create sales quotation: ${quotationData.quotationNumber}`,
        );

        // Ensure numeric fields are strings for decimal columns
        const decimalFields = [
          "subtotal",
          "taxAmount",
          "discount",
          "totalAmount",
          "exchangeRate",
          "discountPercentage",
        ];
        decimalFields.forEach((field) => {
          if (
            quotationData[field] !== undefined &&
            quotationData[field] !== null
          ) {
            quotationData[field] = quotationData[field].toString();
          }
        });

        const quotation = await storage.createSalesQuotation(quotationData);
        res.status(201).json(quotation);
      } catch (error: any) {
        console.error("Sales quotation creation error:", error);
        res.status(500).json({
          message: "Failed to create sales quotation",
          details: error?.message || "Unknown error",
        });
      }
    },
  );

  app.put(
    "/api/sales-quotations/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const quotationId = parseInt(req.params.id);
        const quotationData = req.body;

        // Date fields should remain as ISO strings (YYYY-MM-DD format)
        // No conversion needed - Drizzle expects strings for timestamp({ mode: 'string' }) columns

        const quotation = await storage.updateSalesQuotation(
          quotationId,
          quotationData,
        );

        if (!quotation) {
          return res.status(404).json({ message: "Quotation not found" });
        }

        res.json(quotation);
      } catch (error) {
        console.error("Sales quotation update error:", error);
        res.status(500).json({ message: "Failed to update sales quotation" });
      }
    },
  );

  app.patch(
    "/api/sales-quotations/:id/submit",
    requireAuth,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const quotation = await storage.getSalesQuotation(id);

        if (!quotation) {
          return res.status(404).json({ message: "Sales quotation not found" });
        }

        if (quotation.status !== "draft") {
          return res
            .status(400)
            .json({ message: "Only draft quotations can be submitted" });
        }

        const updated = await storage.submitSalesQuotationForApproval(
          id,
          req.session.userId!,
        );
        res.json({
          message: "Sales quotation submitted for approval",
          quotation: updated,
        });
      } catch (error) {
        console.error("Submit sales quotation error:", error);
        res.status(500).json({ message: "Failed to submit sales quotation" });
      }
    },
  );

  app.patch(
    "/api/sales-quotations/:id/approve",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const quotation = await storage.getSalesQuotation(id);

        if (!quotation) {
          return res.status(404).json({ message: "Sales quotation not found" });
        }

        if (quotation.status === "approved") {
          return res
            .status(400)
            .json({ message: "Quotation is already approved" });
        }

        if (quotation.status !== "pending_approval") {
          return res
            .status(400)
            .json({ message: "Only pending quotations can be approved" });
        }

        await storage.approveSalesQuotation(id, req.session.userId!);
        res.json({ message: "Sales quotation approved successfully" });
      } catch (error) {
        console.error("Approve sales quotation error:", error);
        res.status(500).json({ message: "Failed to approve sales quotation" });
      }
    },
  );

  app.patch(
    "/api/sales-quotations/:id/reject",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const quotation = await storage.getSalesQuotation(id);

        if (!quotation) {
          return res.status(404).json({ message: "Sales quotation not found" });
        }

        if (quotation.status !== "pending_approval") {
          return res
            .status(400)
            .json({ message: "Only pending quotations can be rejected" });
        }

        const { reason } = req.body;
        const updated = await storage.rejectSalesQuotation(
          id,
          req.session.userId!,
          reason,
        );
        res.json({ message: "Sales quotation rejected", quotation: updated });
      } catch (error) {
        console.error("Reject sales quotation error:", error);
        res.status(500).json({ message: "Failed to reject sales quotation" });
      }
    },
  );

  app.post(
    "/api/sales-quotations/:id/approve",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const quotationId = parseInt(req.params.id);
        const quotation = await storage.updateSalesQuotation(quotationId, {
          status: "approved",
        });

        if (!quotation) {
          return res.status(404).json({ message: "Quotation not found" });
        }

        res.json(quotation);
      } catch (error) {
        console.error("Sales quotation approval error:", error);
        res.status(500).json({ message: "Failed to approve sales quotation" });
      }
    },
  );

  app.post(
    "/api/sales-invoices/:id/approve",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const invoiceId = parseInt(req.params.id);
        const invoice = await storage.getSalesInvoice(invoiceId);

        if (!invoice) {
          return res.status(404).json({ message: "Invoice not found" });
        }

        if (invoice.status !== "draft") {
          return res
            .status(400)
            .json({ message: "Only draft invoices can be approved" });
        }

        // Generate invoice number if not already assigned
        let invoiceNumber = invoice.invoiceNumber;
        if (!invoiceNumber) {
          invoiceNumber = await storage.generateNextNumber(
            "INV",
            salesInvoices,
            salesInvoices.invoiceNumber,
          );
        }

        // Update invoice to assign invoice number and set initial status to unpaid
        await storage.updateSalesInvoice(invoiceId, {
          status: "unpaid",
          invoiceNumber: invoiceNumber,
        });

        // Create general ledger entries for the approved invoice
        await storage.createInvoiceGLEntries(invoiceId);

        // Update invoice status based on payment amounts and due date
        await storage.updateInvoicePaidAmount(invoiceId);

        // If invoice is linked to a project, update project total revenue (accrual basis)
        if (invoice.projectId) {
          await storage.updateProjectRevenue(invoice.projectId);
        }

        // Fetch and return the updated invoice with correct status
        const updatedInvoice = await storage.getSalesInvoice(invoiceId);
        res.json(updatedInvoice);
      } catch (error) {
        console.error("Sales invoice approval error:", error);
        res.status(500).json({ message: "Failed to approve sales invoice" });
      }
    },
  );

  app.get(
    "/api/sales-quotations/:id/pdf",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const quotationId = parseInt(req.params.id);
        const quotation = await storage.getSalesQuotation(quotationId);
        const customer = await storage.getCustomer(quotation?.customerId);
        const company = await storage.getCompany();

        if (!quotation || !customer || !company) {
          return res
            .status(404)
            .json({ message: "Quotation or related data not found" });
        }

        const html = generateQuotationHTML(quotation, customer, company);

        res.setHeader("Content-Type", "text/html");
        res.send(html);
      } catch (error) {
        console.error("PDF generation error:", error);
        res.status(500).json({ message: "Failed to generate PDF" });
      }
    },
  );

  app.put(
    "/api/sales-quotations/:id/archive",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const quotationId = parseInt(req.params.id);
        const quotation = await storage.updateSalesQuotation(quotationId, {
          isArchived: true,
        });

        if (!quotation) {
          return res.status(404).json({ message: "Quotation not found" });
        }

        res.json({ message: "Quotation archived successfully", quotation });
      } catch (error) {
        console.error("Sales quotation archive error:", error);
        res.status(500).json({ message: "Failed to archive sales quotation" });
      }
    },
  );

  app.put(
    "/api/sales-quotations/:id/unarchive",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const quotationId = parseInt(req.params.id);
        const quotation = await storage.updateSalesQuotation(quotationId, {
          isArchived: false,
        });

        if (!quotation) {
          return res.status(404).json({ message: "Quotation not found" });
        }

        res.json({ message: "Quotation unarchived successfully", quotation });
      } catch (error) {
        console.error("Sales quotation unarchive error:", error);
        res
          .status(500)
          .json({ message: "Failed to unarchive sales quotation" });
      }
    },
  );

  // Chart of Accounts routes
  app.get(
    "/api/chart-of-accounts",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const accounts = await storage.getChartOfAccounts();
        res.json(accounts);
      } catch (error: any) {
        console.error("Error fetching chart of accounts:", error);
        res.status(500).json({ message: "Failed to fetch chart of accounts" });
      }
    },
  );

  // General Ledger routes
  app.get(
    "/api/general-ledger",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const filters = {
          entryType: req.query.entryType as string,
          referenceType: req.query.referenceType as string,
          entityId: req.query.entityId
            ? parseInt(req.query.entityId as string)
            : undefined,
          startDate: req.query.startDate as string,
          endDate: req.query.endDate as string,
          status: req.query.status as string,
          projectId: req.query.projectId
            ? parseInt(req.query.projectId as string)
            : undefined,
          accountName: req.query.accountName as string,
          search: req.query.search as string,
          page: req.query.page ? parseInt(req.query.page as string) : 1,
          limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        };

        const result = await storage.getGeneralLedgerEntries(filters);
        res.json(result);
      } catch (error) {
        console.error("Get general ledger entries error:", error);
        res
          .status(500)
          .json({ message: "Failed to get general ledger entries" });
      }
    },
  );

  app.get(
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

  app.post(
    "/api/general-ledger",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const entryData = {
          ...req.body,
          createdBy: req.session.userId,
        };
        const entry = await storage.createGeneralLedgerEntry(entryData);
        res.status(201).json(entry);
      } catch (error) {
        console.error("Create general ledger entry error:", error);
        res
          .status(500)
          .json({ message: "Failed to create general ledger entry" });
      }
    },
  );

  app.post(
    "/api/general-ledger/journal",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const journalData = {
          ...req.body,
          createdBy: req.session.userId,
        };
        const entries = await storage.createJournalEntry(journalData);
        res.status(201).json(entries);
      } catch (error) {
        console.error("Create journal entry error:", error);
        res.status(500).json({
          message: error.message || "Failed to create journal entry",
          error: error.message,
        });
      }
    },
  );

  app.put(
    "/api/general-ledger/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const entryId = parseInt(req.params.id);
        const updateData = {
          ...req.body,
          createdBy: req.session.userId,
        };

        console.log("Updating general ledger entry:", entryId, updateData);

        const entry = await storage.updateGeneralLedgerEntry(
          entryId,
          updateData,
        );

        if (!entry) {
          return res
            .status(404)
            .json({ message: "General ledger entry not found" });
        }

        res.json(entry);
      } catch (error) {
        console.error("Update general ledger entry error:", error);
        res.status(500).json({
          message: error.message || "Failed to update general ledger entry",
        });
      }
    },
  );

  app.get(
    "/api/general-ledger/payables",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const payables = await storage.getPayables();
        res.json(payables);
      } catch (error) {
        console.error("Get payables error:", error);
        res.status(500).json({ message: "Failed to get payables" });
      }
    },
  );

  app.get(
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

  app.get(
    "/api/general-ledger/receivables",
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

  app.get(
    "/api/sales-invoices/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const invoiceId = parseInt(req.params.id);
        const invoice = await storage.getSalesInvoice(invoiceId);

        if (!invoice) {
          return res.status(404).json({ message: "Invoice not found" });
        }

        res.json(invoice);
      } catch (error) {
        console.error("Get sales invoice error:", error);
        res.status(500).json({ message: "Failed to get sales invoice" });
      }
    },
  );

  app.put(
    "/api/sales-invoices/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const invoiceId = parseInt(req.params.id);
        const existingInvoice = await storage.getSalesInvoice(invoiceId);
        if (!existingInvoice) {
          return res.status(404).json({ message: "Invoice not found" });
        }
        const isAdmin = req.session.userRole === "admin";
        const editableStatuses = ["draft", "approved", "partial", "paid"];
        if (!editableStatuses.includes(existingInvoice.status)) {
          return res.status(400).json({
            message: "This invoice cannot be edited in its current status",
          });
        }
        if (existingInvoice.status !== "draft" && !isAdmin) {
          return res
            .status(403)
            .json({ message: "Only admin can edit non-draft invoices" });
        }
        const {
          editNote,
          status: _status,
          paidAmount: _paidAmount,
          ...invoiceData
        } = req.body;
        if (!editNote || !editNote.trim()) {
          return res.status(400).json({
            message: "Edit note is required when updating an invoice",
          });
        }

        const changes: Record<string, { old: any; new: any }> = {};
        const fieldsToTrack = [
          "customerId",
          "totalAmount",
          "subtotal",
          "taxAmount",
          "discountPercentage",
          "discount",
          "invoiceDate",
          "dueDate",
          "currency",
          "exchangeRate",
          "remarks",
          "workOrderNumber",
          "paymentTerms",
          "bankAccount",
          "billingAddress",
          "termsAndConditions",
        ];
        for (const field of fieldsToTrack) {
          const oldVal = (existingInvoice as any)[field];
          const newVal = invoiceData[field];
          if (
            newVal !== undefined &&
            String(oldVal || "") !== String(newVal || "")
          ) {
            changes[field] = { old: oldVal, new: newVal };
          }
        }
        if (
          JSON.stringify(existingInvoice.items) !==
          JSON.stringify(invoiceData.items)
        ) {
          changes["items"] = {
            old: existingInvoice.items,
            new: invoiceData.items,
          };
        }

        const invoice = await storage.updateSalesInvoice(
          invoiceId,
          invoiceData,
        );

        if (!invoice) {
          return res.status(404).json({ message: "Invoice not found" });
        }

        if (existingInvoice.status !== "draft") {
          await storage.updateSalesInvoiceGLEntries(invoiceId);

          const paidAmount = parseFloat(invoice.paidAmount || "0");
          const newTotal = parseFloat(invoice.totalAmount || "0");
          let newStatus = existingInvoice.status;
          if (paidAmount > 0 && newTotal > 0) {
            if (paidAmount >= newTotal) {
              newStatus = "paid";
            } else {
              newStatus = "partial";
            }
          } else if (
            paidAmount === 0 &&
            (existingInvoice.status === "paid" ||
              existingInvoice.status === "partial")
          ) {
            newStatus = "approved";
          }

          if (newStatus !== existingInvoice.status) {
            await storage.updateSalesInvoice(invoiceId, {
              status: newStatus,
            } as any);
            invoice.status = newStatus;
            changes["status"] = { old: existingInvoice.status, new: newStatus };
          }
        }

        const user = await storage.getUser(req.session.userId!);
        await storage.createInvoiceEditHistory({
          invoiceType: "sales",
          invoiceId,
          editNote: editNote.trim(),
          changes: Object.keys(changes).length > 0 ? changes : null,
          editedBy: req.session.userId || null,
          editedByName: user?.username || null,
        });

        res.json(invoice);
      } catch (error) {
        console.error("Sales invoice update error:", error);
        res.status(500).json({ message: "Failed to update sales invoice" });
      }
    },
  );

  app.get(
    "/api/sales-invoices/:id/edit-history",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const history = await storage.getInvoiceEditHistory("sales", id);
        res.json(history);
      } catch (error) {
        console.error("Get sales invoice edit history error:", error);
        res.status(500).json({ message: "Failed to get edit history" });
      }
    },
  );

  app.patch("/api/sales-invoices/:id/submit", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const invoice = await storage.getSalesInvoice(id);

      if (!invoice) {
        return res.status(404).json({ message: "Sales invoice not found" });
      }

      if (invoice.status !== "draft") {
        return res
          .status(400)
          .json({ message: "Only draft invoices can be submitted" });
      }

      const updated = await storage.submitSalesInvoiceForApproval(
        id,
        req.session.userId!,
      );
      res.json({
        message: "Sales invoice submitted for approval",
        invoice: updated,
      });
    } catch (error) {
      console.error("Submit sales invoice error:", error);
      res.status(500).json({ message: "Failed to submit sales invoice" });
    }
  });

  app.patch(
    "/api/sales-invoices/:id/approve",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const invoice = await storage.getSalesInvoice(id);

        if (!invoice) {
          return res.status(404).json({ message: "Sales invoice not found" });
        }

        if (invoice.status === "approved") {
          return res
            .status(400)
            .json({ message: "Invoice is already approved" });
        }

        if (invoice.status !== "pending_approval") {
          return res
            .status(400)
            .json({ message: "Only pending invoices can be approved" });
        }

        await storage.approveSalesInvoice(id, req.session.userId!);
        res.json({ message: "Sales invoice approved successfully" });
      } catch (error) {
        console.error("Approve sales invoice error:", error);
        res.status(500).json({ message: "Failed to approve sales invoice" });
      }
    },
  );

  app.patch(
    "/api/sales-invoices/:id/reject",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const invoice = await storage.getSalesInvoice(id);

        if (!invoice) {
          return res.status(404).json({ message: "Sales invoice not found" });
        }

        if (invoice.status !== "pending_approval") {
          return res
            .status(400)
            .json({ message: "Only pending invoices can be rejected" });
        }

        const { reason } = req.body;
        const updated = await storage.rejectSalesInvoice(
          id,
          req.session.userId!,
          reason,
        );
        res.json({ message: "Sales invoice rejected", invoice: updated });
      } catch (error) {
        console.error("Reject sales invoice error:", error);
        res.status(500).json({ message: "Failed to reject sales invoice" });
      }
    },
  );

  app.patch(
    "/api/sales-invoices/:id/cancel",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const updated = await storage.cancelSalesInvoice(
          id,
          req.session.userId!,
        );
        res.json({
          message: "Sales invoice cancelled successfully",
          invoice: updated,
        });
      } catch (error: any) {
        console.error("Cancel sales invoice error:", error);
        res
          .status(400)
          .json({ message: error.message || "Failed to cancel sales invoice" });
      }
    },
  );

  // Sales Invoices routes
  app.get(
    "/api/sales-invoices",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const search = req.query.search as string;
        const status = req.query.status as string;
        const startDate = req.query.startDate as string;
        const endDate = req.query.endDate as string;
        const customerId = req.query.customerId
          ? parseInt(req.query.customerId as string)
          : undefined;
        const projectId = req.query.projectId
          ? parseInt(req.query.projectId as string)
          : undefined;

        const result = await storage.getSalesInvoicesPaginated(page, limit, {
          search,
          status,
          startDate,
          endDate,
          customerId,
          projectId,
        });
        res.json(result);
      } catch (error) {
        console.error("Get sales invoices error:", error);
        res.status(500).json({ message: "Failed to get sales invoices" });
      }
    },
  );

  app.post(
    "/api/sales-invoices",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const invoiceData = req.body;

        // Date fields should remain as ISO strings (YYYY-MM-DD format)
        // No conversion needed - Drizzle expects strings for date() columns

        const invoice = await storage.createSalesInvoice(invoiceData);
        res.status(201).json(invoice);
      } catch (error) {
        console.error("Sales invoice creation error:", error);
        res.status(500).json({ message: "Failed to create sales invoice" });
      }
    },
  );

  // Invoice Payments routes
  app.get(
    "/api/sales-invoices/:id/payments",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const invoiceId = parseInt(req.params.id);
        const payments = await storage.getInvoicePayments(invoiceId);
        res.json(payments);
      } catch (error) {
        console.error("Get invoice payments error:", error);
        res.status(500).json({ message: "Failed to get invoice payments" });
      }
    },
  );

  app.post(
    "/api/sales-invoices/:id/payments",
    requireAuth,
    requireRole(["admin", "finance"]),
    upload.array("paymentFiles", 10),
    async (req, res) => {
      try {
        const invoiceId = parseInt(req.params.id);
        const paymentData = {
          ...req.body,
          invoiceId,
          recordedBy: req.session.userId,
        };

        const payment = await storage.createInvoicePayment(paymentData);

        // Handle file uploads if any
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
          for (const file of req.files) {
            await storage.createPaymentFile({
              paymentId: payment.id,
              fileName: file.filename,
              originalName: file.originalname,
              filePath: file.path,
              fileSize: file.size,
              mimeType: file.mimetype,
            });
          }
        }

        res.status(201).json(payment);
      } catch (error) {
        console.error("Record payment error:", error);
        res.status(500).json({ message: "Failed to record payment" });
      }
    },
  );

  // Payment file routes
  app.get(
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

  app.get(
    "/api/payment-files/:id/download",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const fileId = parseInt(req.params.id);
        const file = await storage.getPaymentFile(fileId);

        if (!file) {
          return res.status(404).json({ message: "File not found" });
        }
        const filePath = path.resolve(file.filePath);

        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ message: "File not found on disk" });
        }

        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${file.originalName}"`,
        );
        res.setHeader(
          "Content-Type",
          file.mimeType || "application/octet-stream",
        );

        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
      } catch (error) {
        console.error("Download payment file error:", error);
        res.status(500).json({ message: "Failed to download file" });
      }
    },
  );

  app.delete(
    "/api/payment-files/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const fileId = parseInt(req.params.id);
        const file = await storage.getPaymentFile(fileId);

        if (file) {
          // Delete file from disk
          if (fs.existsSync(file.filePath)) {
            fs.unlinkSync(file.filePath);
          }
        }

        const deleted = await storage.deletePaymentFile(fileId);

        if (!deleted) {
          return res.status(404).json({ message: "File not found" });
        }

        res.json({ message: "File deleted successfully" });
      } catch (error) {
        console.error("Delete payment file error:", error);
        res.status(500).json({ message: "Failed to delete file" });
      }
    },
  );

  // Goods Receipt routes
  app.get(
    "/api/goods-receipt",
    requireAuth,
    requireRole(["admin", "project_manager", "finance"]),
    async (req, res) => {
      try {
        const receipts = await storage.getGoodsReceipts();
        res.json(receipts);
      } catch (error) {
        console.error("Get goods receipts error:", error);
        res.status(500).json({ message: "Failed to get goods receipts" });
      }
    },
  );

  app.post(
    "/api/goods-receipt",
    requireAuth,
    requireRole(["admin", "project_manager", "finance"]),
    async (req, res) => {
      try {
        const { reference, items } = req.body;

        console.log("Goods receipt request:", {
          reference,
          items,
          userId: req.session.userId,
        });

        if (
          !reference ||
          !items ||
          !Array.isArray(items) ||
          items.length === 0
        ) {
          return res
            .status(400)
            .json({ message: "Reference and items are required" });
        }

        // Validate items format
        for (const item of items) {
          if (
            !item.inventoryItemId ||
            typeof item.inventoryItemId !== "number" ||
            !item.quantity ||
            typeof item.quantity !== "number" ||
            item.quantity <= 0 ||
            typeof item.unitCost !== "number" ||
            item.unitCost < 0
          ) {
            return res.status(400).json({
              message:
                "Invalid item format: each item must have inventoryItemId, positive quantity, and valid unitCost",
            });
          }
        }

        const receipt = await storage.createGoodsReceipt(
          reference,
          items,
          req.session.userId,
        );
        res.status(201).json(receipt);
      } catch (error) {
        console.error("Goods receipt creation error:", error);
        console.error("Error details:", error.message);
        res.status(500).json({
          message: "Failed to create goods receipt",
          error: error.message,
        });
      }
    },
  );

  // Goods Issue routes
  app.get(
    "/api/goods-issue",
    requireAuth,
    requireRole(["admin", "project_manager", "finance"]),
    async (req, res) => {
      try {
        console.log("Getting goods issues...");
        const issues = await storage.getGoodsIssues();
        console.log("Retrieved goods issues:", issues);
        res.json(issues);
      } catch (error) {
        console.error("Get goods issues error:", error);
        res.status(500).json({ message: "Failed to get goods issues" });
      }
    },
  );

  app.post(
    "/api/goods-issue",
    requireAuth,
    requireRole(["admin", "project_manager", "finance"]),
    async (req, res) => {
      try {
        const { reference, projectId, items } = req.body;

        // Validate required fields
        if (
          !reference ||
          !items ||
          !Array.isArray(items) ||
          items.length === 0
        ) {
          return res.status(400).json({
            message: "Reference and items array are required",
          });
        }

        // Validate items format
        for (const item of items) {
          if (
            !item.inventoryItemId ||
            typeof item.inventoryItemId !== "number" ||
            !item.quantity ||
            typeof item.quantity !== "number" ||
            item.quantity <= 0
          ) {
            return res.status(400).json({
              message:
                "Invalid item format: each item must have inventoryItemId and positive quantity",
            });
          }
        }

        const issue = await storage.createGoodsIssue(
          reference,
          projectId,
          items,
          req.session.userId,
        );
        res.status(201).json(issue);
      } catch (error) {
        console.error("Goods issue creation error:", error);
        res.status(500).json({
          message: "Failed to create goods issue",
          error: error.message,
        });
      }
    },
  );

  // Payroll routes
  app.get(
    "/api/payroll",
    requireAuth,
    requireRole(["admin", "project_manager", "finance"]),
    async (req, res) => {
      try {
        const { month, year, employeeId, projectId } = req.query;
        const payroll = await storage.getPayrollEntries(
          month ? parseInt(month as string) : undefined,
          year ? parseInt(year as string) : undefined,
          employeeId ? parseInt(employeeId as string) : undefined,
          projectId ? parseInt(projectId as string) : undefined,
        );
        res.json(payroll);
      } catch (error) {
        res.status(500).json({ message: "Failed to get payroll entries" });
      }
    },
  );

  app.post(
    "/api/payroll/generate",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const { month, year } = req.body;

        if (!month || !year) {
          return res
            .status(400)
            .json({ message: "Month and year are required" });
        }

        const payroll = await storage.generateMonthlyPayroll(month, year);
        res.status(201).json(payroll);
      } catch (error) {
        console.error("Payroll generation error:", error);
        res.status(500).json({ message: "Failed to generate payroll" });
      }
    },
  );

  app.put(
    "/api/payroll/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const payrollData = req.body;

        // Get the current payroll entry before update
        const currentEntry = await storage.getPayrollEntry(id);
        if (!currentEntry) {
          return res.status(404).json({ message: "Payroll entry not found" });
        }

        // Update the payroll entry
        // The storage.updatePayrollEntry method now handles GL creation if status changes to 'paid'
        // and will use the userId passed to it.
        const updatedEntry = await storage.updatePayrollEntry(
          id,
          payrollData,
          req.session.userId,
        );
        if (!updatedEntry) {
          return res.status(404).json({ message: "Payroll entry not found" });
        }

        // If status is being updated (even if not to 'paid'), totals might need recalculation
        // This is already handled by updatePayrollEntry calling updatePayrollEntryTotals.
        // No need for an explicit call here if payrollData.status is the only trigger.
        // However, if other fields that affect totals are updated without a status change,
        // updatePayrollEntryTotals should be robust enough or called regardless.
        // The current implementation of updatePayrollEntry always calls updatePayrollEntryTotals.

        // Get the potentially updated entry (especially if totals were recalculated)
        const finalEntry = await storage.getPayrollEntry(id);
        res.json(finalEntry || updatedEntry); // Prefer finalEntry if available
      } catch (error) {
        console.error("Update payroll entry error:", error);
        res.status(500).json({ message: "Failed to update payroll entry" });
      }
    },
  );

  app.delete(
    "/api/payroll/clear-all",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const deletedCount = await storage.clearAllPayrollEntries();
        res.json({
          message: "All payroll entries cleared successfully",
          deletedCount,
        });
      } catch (error) {
        console.error("Clear payroll error:", error);
        res.status(500).json({ message: "Failed to clear payroll entries" });
      }
    },
  );

  app.delete(
    "/api/payroll/clear-period",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const { month, year } = req.query;

        if (!month || !year) {
          return res
            .status(400)
            .json({ message: "Month and year are required" });
        }

        const deletedCount = await storage.clearPayrollEntriesByPeriod(
          parseInt(month as string),
          parseInt(year as string),
        );
        res.json({
          message: `Payroll entries for ${month}/${year} cleared successfully`,
          deletedCount,
        });
      } catch (error) {
        console.error("Clear payroll by period error:", error);
        res.status(500).json({ message: "Failed to clear payroll entries" });
      }
    },
  );

  // Payroll Additions routes
  app.get(
    "/api/payroll/:id/additions",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const payrollEntryId = parseInt(req.params.id);
        const additions = await storage.getPayrollAdditions(payrollEntryId);
        res.json(additions);
      } catch (error) {
        res.status(500).json({ message: "Failed to get payroll additions" });
      }
    },
  );

  app.post(
    "/api/payroll/:id/additions",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const payrollEntryId = parseInt(req.params.id);
        const additionData = {
          ...req.body,
          payrollEntryId,
        };

        const addition = await storage.createPayrollAddition(additionData);

        // Update payroll entry totals
        await storage.updatePayrollEntryTotals(payrollEntryId);

        res.status(201).json(addition);
      } catch (error) {
        console.error("Payroll addition creation error:", error);
        res.status(500).json({ message: "Failed to create payroll addition" });
      }
    },
  );

  app.put(
    "/api/payroll/additions/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const additionData = req.body;

        const updatedAddition = await storage.updatePayrollAddition(
          id,
          additionData,
        );
        if (!updatedAddition) {
          return res
            .status(404)
            .json({ message: "Payroll addition not found" });
        }

        // Get the payroll entry ID associated with this addition
        const addition = await storage.getPayrollAddition(id);
        if (addition) {
          await storage.updatePayrollEntryTotals(addition.payrollEntryId);
        }

        res.json(updatedAddition);
      } catch (error) {
        res.status(500).json({ message: "Failed to update payroll addition" });
      }
    },
  );

  app.delete(
    "/api/payroll/additions/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);

        if (isNaN(id)) {
          return res.status(400).json({ message: "Invalid addition ID" });
        }

        // Get the payroll entry ID associated with this addition BEFORE deleting
        const addition = await storage.getPayrollAddition(id);
        if (!addition) {
          return res
            .status(404)
            .json({ message: "Payroll addition not found" });
        }

        const deleted = await storage.deletePayrollAddition(id);
        if (deleted) {
          res.json({ message: "Payroll addition deleted successfully" });
        } else {
          res
            .status(500)
            .json({ message: "Failed to delete payroll addition" });
        }
      } catch (error) {
        console.error("Delete payroll addition error:", error);
        res.status(500).json({
          message: "Failed to delete payroll addition",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // Payroll Deductions routes
  app.get(
    "/api/payroll/:id/deductions",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const payrollEntryId = parseInt(req.params.id);
        const deductions = await storage.getPayrollDeductions(payrollEntryId);
        res.json(deductions);
      } catch (error) {
        res.status(500).json({ message: "Failed to get payroll deductions" });
      }
    },
  );

  app.post(
    "/api/payroll/:id/deductions",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const payrollEntryId = parseInt(req.params.id);
        const deductionData = {
          ...req.body,
          payrollEntryId,
        };

        const deduction = await storage.createPayrollDeduction(deductionData);

        // Update payroll entry totals
        await storage.updatePayrollEntryTotals(payrollEntryId);

        res.status(201).json(deduction);
      } catch (error) {
        console.error("Payroll deduction creation error:", error);
        res.status(500).json({ message: "Failed to create payroll deduction" });
      }
    },
  );

  app.put(
    "/api/payroll/deductions/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const deductionData = req.body;

        const updatedDeduction = await storage.updatePayrollDeduction(
          id,
          deductionData,
        );
        if (!updatedDeduction) {
          return res
            .status(404)
            .json({ message: "Payroll deduction not found" });
        }

        // Get the payroll entry ID associated with this deduction
        const deduction = await storage.getPayrollDeduction(id);
        if (deduction) {
          await storage.updatePayrollEntryTotals(deduction.payrollEntryId);
        }

        res.json(updatedDeduction);
      } catch (error) {
        res.status(500).json({ message: "Failed to update payroll deduction" });
      }
    },
  );

  app.delete(
    "/api/payroll/deductions/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);

        if (isNaN(id)) {
          return res.status(400).json({ message: "Invalid deduction ID" });
        }

        // Get the payroll entry ID associated with this deduction BEFORE deleting
        const deduction = await storage.getPayrollDeduction(id);
        if (!deduction) {
          return res
            .status(404)
            .json({ message: "Payroll deduction not found" });
        }

        const deleted = await storage.deletePayrollDeduction(id);
        if (deleted) {
          res.json({ message: "Payroll deduction deleted successfully" });
        } else {
          res
            .status(500)
            .json({ message: "Failed to delete payroll deduction" });
        }
      } catch (error) {
        console.error("Delete payroll deduction error:", error);
        res.status(500).json({
          message: "Failed to delete payroll deduction",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // Reimbursement routes
  app.get("/api/reimbursements", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.userRole!;
      const { status, view } = req.query;

      let filters: { userId?: number; status?: string } = {};

      // If not admin/finance, only show own reimbursements
      if (!["admin", "finance"].includes(userRole)) {
        filters.userId = userId;
      } else if (view === "my") {
        // Admin/Finance can filter to see only their own
        filters.userId = userId;
      }

      if (status && typeof status === "string") {
        filters.status = status;
      }

      const reimbursements = await storage.getReimbursements(filters);
      res.json(reimbursements);
    } catch (error: any) {
      console.error("Get reimbursements error:", error);
      await storage.createErrorLog({
        message:
          "Error in GET /api/reimbursements: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "reimbursements",
        severity: "error",
        userId: req.session.userId,
        userName: req.session.userRole,
      });
      res.status(500).json({ message: "Failed to get reimbursements" });
    }
  });

  app.get(
    "/api/reimbursements/payroll/:month/:year",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const month = parseInt(req.params.month);
        const year = parseInt(req.params.year);

        if (isNaN(month) || isNaN(year)) {
          return res.status(400).json({ message: "Invalid month or year" });
        }

        const reimbursements = await storage.getReimbursementsForPayroll(
          month,
          year,
        );
        res.json(reimbursements);
      } catch (error: any) {
        console.error("Get reimbursements for payroll error:", error);
        await storage.createErrorLog({
          message:
            "Error in GET /api/reimbursements/payroll: " +
            (error?.message || "Unknown error"),
          stack: error?.stack,
          component: "reimbursements",
          severity: "error",
          userId: req.session.userId,
        });
        res
          .status(500)
          .json({ message: "Failed to get reimbursements for payroll" });
      }
    },
  );

  app.get("/api/reimbursements/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reimbursement ID" });
      }

      const reimbursement = await storage.getReimbursement(id);
      if (!reimbursement) {
        return res.status(404).json({ message: "Reimbursement not found" });
      }

      // Check access - user can only see their own unless admin/finance
      const userId = req.session.userId!;
      const userRole = req.session.userRole!;
      if (
        !["admin", "finance"].includes(userRole) &&
        reimbursement.userId !== userId
      ) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(reimbursement);
    } catch (error: any) {
      console.error("Get reimbursement error:", error);
      await storage.createErrorLog({
        message:
          "Error in GET /api/reimbursements/:id: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "reimbursements",
        severity: "error",
        userId: req.session.userId,
      });
      res.status(500).json({ message: "Failed to get reimbursement" });
    }
  });

  app.post(
    "/api/reimbursements",
    requireAuth,
    upload.array("attachments", 5),
    async (req, res) => {
      try {
        const userId = req.session.userId!;
        const userRole = req.session.userRole!;
        const {
          amount,
          description,
          originalExpenseDate,
          projectId,
          employeeId: requestedEmployeeId,
        } = req.body;

        // Validation
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
          return res
            .status(400)
            .json({ message: "Amount is required and must be greater than 0" });
        }
        if (
          !description ||
          typeof description !== "string" ||
          description.trim().length === 0
        ) {
          return res.status(400).json({ message: "Description is required" });
        }
        if (!originalExpenseDate) {
          return res
            .status(400)
            .json({ message: "Original expense date is required" });
        }

        // Validate date format
        const expenseDate = new Date(originalExpenseDate);
        if (isNaN(expenseDate.getTime())) {
          return res
            .status(400)
            .json({ message: "Invalid expense date format" });
        }

        const employees = await storage.getEmployees();
        let targetEmployeeId: number;

        // Check if user can create for others (admin, finance, project_manager)
        const canCreateForOthers = [
          "admin",
          "finance",
          "project_manager",
        ].includes(userRole);

        if (requestedEmployeeId && canCreateForOthers) {
          // Privileged user creating for specific employee
          const targetEmployee = employees.find(
            (e: any) => e.id === parseInt(requestedEmployeeId),
          );
          if (!targetEmployee) {
            return res
              .status(400)
              .json({ message: "Selected employee not found" });
          }
          targetEmployeeId = targetEmployee.id;
        } else {
          // Regular employee or privileged user creating for themselves
          const ownEmployee = employees.find((e: any) => e.userId === userId);
          if (!ownEmployee) {
            return res.status(400).json({
              message:
                "No employee record linked to your account. Please contact HR.",
            });
          }
          targetEmployeeId = ownEmployee.id;
        }

        // Handle file uploads
        const files = req.files as Express.Multer.File[];
        const attachments =
          files && files.length > 0 ? files.map((f) => f.path) : null;

        const reimbursement = await storage.createReimbursement({
          employeeId: targetEmployeeId,
          userId: userId,
          projectId: projectId ? parseInt(projectId) : null,
          amount: parseFloat(amount).toFixed(2),
          description: description.trim(),
          originalExpenseDate,
          status: "pending",
          attachments,
        });

        res.status(201).json(reimbursement);
      } catch (error) {
        console.error("Create reimbursement error:", error);
        await storage.createErrorLog({
          message:
            "Error in POST /api/reimbursements: " +
            (error?.message || "Unknown error"),
          stack: error?.stack,
          component: "reimbursements",
          severity: "error",
          userId: req.session.userId,
        });
        res.status(500).json({ message: "Failed to create reimbursement" });
      }
    },
  );

  app.put(
    "/api/reimbursements/:id/approve",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const userId = req.session.userId!;
        const userRole = req.session.userRole!;

        if (isNaN(id)) {
          return res.status(400).json({ message: "Invalid reimbursement ID" });
        }

        // Get the reimbursement to check ownership
        const reimbursement = await storage.getReimbursement(id);
        if (!reimbursement) {
          return res.status(404).json({ message: "Reimbursement not found" });
        }

        // Finance users cannot approve reimbursements created by finance users (only Admin can)
        if (userRole === "finance" && reimbursement.userRole === "finance") {
          return res.status(403).json({
            message:
              "Finance users cannot approve reimbursements created by finance users. An Admin must approve this request.",
          });
        }

        const approved = await storage.approveReimbursement(id, userId);
        res.json(approved);
      } catch (error: any) {
        console.error("Approve reimbursement error:", error);
        await storage.createErrorLog({
          message:
            "Error in PUT /api/reimbursements/:id/approve: " +
            (error?.message || "Unknown error"),
          stack: error?.stack,
          component: "reimbursements",
          severity: "error",
          userId: req.session.userId,
        });
        res.status(500).json({ message: "Failed to approve reimbursement" });
      }
    },
  );

  app.put(
    "/api/reimbursements/:id/reject",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const userId = req.session.userId!;
        const userRole = req.session.userRole!;
        const { reason } = req.body;

        if (isNaN(id)) {
          return res.status(400).json({ message: "Invalid reimbursement ID" });
        }

        // Get the reimbursement to check ownership
        const reimbursement = await storage.getReimbursement(id);
        if (!reimbursement) {
          return res.status(404).json({ message: "Reimbursement not found" });
        }

        // Finance users cannot reject reimbursements created by finance users (only Admin can)
        if (userRole === "finance" && reimbursement.userRole === "finance") {
          return res.status(403).json({
            message:
              "Finance users cannot reject reimbursements created by finance users. An Admin must handle this request.",
          });
        }

        const rejected = await storage.rejectReimbursement(id, userId, reason);
        res.json(rejected);
      } catch (error: any) {
        console.error("Reject reimbursement error:", error);
        await storage.createErrorLog({
          message:
            "Error in PUT /api/reimbursements/:id/reject: " +
            (error?.message || "Unknown error"),
          stack: error?.stack,
          component: "reimbursements",
          severity: "error",
          userId: req.session.userId,
        });
        res.status(500).json({ message: "Failed to reject reimbursement" });
      }
    },
  );

  app.put(
    "/api/reimbursements/:id",
    requireAuth,
    upload.array("attachments", 5),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const userId = req.session.userId!;
        const userRole = req.session.userRole!;
        const {
          amount,
          description,
          originalExpenseDate,
          projectId,
          existingAttachments,
        } = req.body;

        if (isNaN(id)) {
          return res.status(400).json({ message: "Invalid reimbursement ID" });
        }

        const reimbursement = await storage.getReimbursement(id);
        if (!reimbursement) {
          return res.status(404).json({ message: "Reimbursement not found" });
        }

        // Only pending reimbursements can be edited
        if (reimbursement.status !== "pending") {
          return res
            .status(400)
            .json({ message: "Only pending reimbursements can be edited" });
        }

        // Only the creator or admin can edit
        if (userRole !== "admin" && reimbursement.userId !== userId) {
          return res.status(403).json({ message: "Access denied" });
        }

        // Validation
        if (amount && (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)) {
          return res
            .status(400)
            .json({ message: "Amount must be greater than 0" });
        }
        if (
          description &&
          (typeof description !== "string" || description.trim().length === 0)
        ) {
          return res
            .status(400)
            .json({ message: "Description cannot be empty" });
        }
        if (originalExpenseDate) {
          const expenseDate = new Date(originalExpenseDate);
          if (isNaN(expenseDate.getTime())) {
            return res
              .status(400)
              .json({ message: "Invalid expense date format" });
          }
        }

        const updateData: any = {};
        if (amount) updateData.amount = parseFloat(amount).toFixed(2);
        if (description) updateData.description = description.trim();
        if (originalExpenseDate)
          updateData.originalExpenseDate = originalExpenseDate;
        if (projectId !== undefined)
          updateData.projectId = projectId ? parseInt(projectId) : null;

        // Handle attachments
        let attachments: string[] = [];
        const isMultipart = req.is("multipart/form-data");

        if (existingAttachments) {
          const provided = Array.isArray(existingAttachments)
            ? existingAttachments
            : [existingAttachments];

          // Security: only allow paths that already belonged to this reimbursement
          const current = reimbursement.attachments || [];
          attachments = provided.filter((path) => current.includes(path));
        } else if (isMultipart) {
          // In multipart (from our Edit Dialog), if existingAttachments is missing,
          // it means all existing attachments were removed.
          attachments = [];
        } else {
          // For JSON requests, if attachments field is missing, keep existing ones
          attachments = reimbursement.attachments || [];
        }

        // Add new uploads
        const files = req.files as Express.Multer.File[];
        if (files && files.length > 0) {
          const newAttachments = files.map((f) => f.path);
          attachments = [...attachments, ...newAttachments];
        }

        updateData.attachments = attachments.length > 0 ? attachments : null;

        const updated = await storage.updateReimbursement(id, updateData);
        res.json(updated);
      } catch (error: any) {
        console.error("Update reimbursement error:", error);
        await storage.createErrorLog({
          message:
            "Error in PUT /api/reimbursements/:id: " +
            (error?.message || "Unknown error"),
          stack: error?.stack,
          component: "reimbursements",
          severity: "error",
          userId: req.session.userId,
        });
        res.status(500).json({ message: "Failed to update reimbursement" });
      }
    },
  );

  app.delete("/api/reimbursements/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.session.userId!;
      const userRole = req.session.userRole!;

      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reimbursement ID" });
      }

      const reimbursement = await storage.getReimbursement(id);
      if (!reimbursement) {
        return res.status(404).json({ message: "Reimbursement not found" });
      }

      // Only owner can delete pending reimbursements, or admin can delete any
      if (userRole !== "admin" && reimbursement.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (reimbursement.status !== "pending" && userRole !== "admin") {
        return res
          .status(400)
          .json({ message: "Can only delete pending reimbursements" });
      }

      await storage.deleteReimbursement(id);
      res.json({ message: "Reimbursement deleted successfully" });
    } catch (error: any) {
      console.error("Delete reimbursement error:", error);
      await storage.createErrorLog({
        message:
          "Error in DELETE /api/reimbursements/:id: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "reimbursements",
        severity: "error",
        userId: req.session.userId,
      });
      res.status(500).json({ message: "Failed to delete reimbursement" });
    }
  });

  // Goods Receipt routes
  app.get("/api/goods-receipt", requireAuth, async (req, res) => {
    try {
      const receipts = await storage.getGoodsReceipts();
      res.json(receipts);
    } catch (error) {
      console.error("Get goods receipts error:", error);
      res.status(500).json({ message: "Failed to get goods receipts" });
    }
  });

  app.post(
    "/api/goods-receipt",
    requireAuth,
    requireRole(["admin", "project_manager", "finance"]),
    async (req, res) => {
      try {
        const { reference, items } = req.body;

        if (
          !reference ||
          !items ||
          !Array.isArray(items) ||
          items.length === 0
        ) {
          return res
            .status(400)
            .json({ message: "Reference and items are required" });
        }

        // Validate items format
        for (const item of items) {
          if (
            !item.inventoryItemId ||
            typeof item.inventoryItemId !== "number" ||
            !item.quantity ||
            typeof item.quantity !== "number" ||
            item.quantity <= 0 ||
            typeof item.unitCost !== "number" ||
            item.unitCost < 0
          ) {
            return res.status(400).json({
              message:
                "Invalid item format: each item must have inventoryItemId, positive quantity, and valid unitCost",
            });
          }
        }

        const receipt = await storage.createGoodsReceipt(
          reference,
          items,
          req.session.userId,
        );
        res.status(201).json(receipt);
      } catch (error) {
        console.error("Goods receipt creation error:", error);
        res.status(500).json({ message: "Failed to create goods receipt" });
      }
    },
  );

  // Purchase Requests routes
  app.get("/api/purchase-requests/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getPurchaseRequestStats();
      res.json(stats);
    } catch (error) {
      console.error("Get purchase request stats error:", error);
      res.status(500).json({ message: "Failed to get purchase request stats" });
    }
  });

  app.get("/api/purchase-requests", requireAuth, async (req, res) => {
    try {
      const { userId, userRole } = req.session;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || "";
      const status = (req.query.status as string) || "all";
      const urgency = (req.query.urgency as string) || "all";

      const result = await storage.getPurchaseRequestsPaginated(page, limit, {
        userId,
        userRole,
        search,
        status,
        urgency,
      });
      res.json(result);
    } catch (error) {
      console.error("Get purchase requests error:", error);
      res.status(500).json({ message: "Failed to get purchase requests" });
    }
  });

  app.get("/api/purchase-requests/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const request = await storage.getPurchaseRequest(id);

      if (!request) {
        return res.status(404).json({ message: "Purchase request not found" });
      }

      res.json(request);
    } catch (error) {
      console.error("Get purchase request error:", error);
      res.status(500).json({ message: "Failed to get purchase request" });
    }
  });

  app.post("/api/purchase-requests", requireAuth, async (req, res) => {
    try {
      const { items, ...requestData } = req.body;

      // Get employee ID from current user (use user ID directly if no employee record)
      // const user = await storage.getUser(req.session.userId!);
      // if (!user) {
      //   return res.status(401).json({ message: "User not found" });
      // }

      const requestedBy = req.session.userId;

      // const employees = await storage.getEmployees();
      // const employee = employees.find((emp) => emp.userId === user.id);

      // Use employee ID if found, otherwise use user ID directly
      // const requestedBy = employee ? employee.id : user.id;

      if (!requestedBy) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Validate items
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res
          .status(400)
          .json({ message: "At least one item is required" });
      }

      for (const item of items) {
        if (item.itemType === "service") {
          if (!item.description || !item.quantity || item.quantity <= 0) {
            return res.status(400).json({
              message:
                "Invalid service item: description and positive quantity are required",
            });
          }
        } else {
          if (!item.inventoryItemId || !item.quantity || item.quantity <= 0) {
            return res.status(400).json({
              message:
                "Invalid product item: inventory item and positive quantity are required",
            });
          }
        }
      }

      const request = await storage.createPurchaseRequest({
        ...requestData,
        requestedBy: requestedBy,
        items,
      });

      res.status(201).json(request);
    } catch (error) {
      console.error("Create purchase request error:", error);
      res.status(500).json({ message: "Failed to create purchase request" });
    }
  });

  app.put(
    "/api/purchase-requests/:id/approve",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);

        // Get employee ID from current user
        // const user = await storage.getUser(req.session.userId!);
        // if (!user) {
        //   return res.status(401).json({ message: "User not found" });
        // }

        // const employees = await storage.getEmployees();
        // const employee = employees.find((emp) => emp.userId === user.id);

        // Get userId from session
        const approvedBy = req.session.userId;

        // if (!employee) {
        //   return res
        //     .status(400)
        //     .json({ message: "Employee record not found for current user" });
        // }

        if (!approvedBy) {
          return res.status(401).json({ message: "Authentication required" });
        }

        const request = await storage.updatePurchaseRequest(id, {
          status: "approved",
          // approvedBy: employee.id,
          // approvedBy: employee ? employee.id : user.id,
          approvedBy: approvedBy,
          approvalDate: new Date(),
        });

        if (!request) {
          return res
            .status(404)
            .json({ message: "Purchase request not found" });
        }

        res.json(request);
      } catch (error) {
        console.error("Approve purchase request error:", error);
        res.status(500).json({ message: "Failed to approve purchase request" });
      }
    },
  );

  app.put(
    "/api/purchase-requests/:id/reject",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);

        // Get employee ID from current user
        // const user = await storage.getUser(req.session.userId!);
        // if (!user) {
        //   return res.status(401).json({ message: "User not found" });
        // }

        // const employees = await storage.getEmployees();
        // const employee = employees.find((emp) => emp.userId === user.id);

        // Get userId from session
        const rejectedBy = req.session.userId;

        // if (!employee) {
        //   return res
        //     .status(400)
        //     .json({ message: "Employee record not found for current user" });
        // }

        if (!rejectedBy) {
          return res.status(401).json({ message: "Authentication required" });
        }

        const request = await storage.updatePurchaseRequest(id, {
          status: "rejected",
          // approvedBy: employee.id,
          // approvedBy: employee ? employee.id : user.id,
          approvedBy: rejectedBy,
          approvalDate: new Date(),
        });

        if (!request) {
          return res
            .status(404)
            .json({ message: "Purchase request not found" });
        }

        res.json(request);
      } catch (error) {
        console.error("Reject purchase request error:", error);
        res.status(500).json({ message: "Failed to reject purchase request" });
      }
    },
  );

  app.delete("/api/purchase-requests/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deletePurchaseRequest(id);

      if (!deleted) {
        return res.status(404).json({ message: "Purchase request not found" });
      }

      res.json({ message: "Purchase request deleted successfully" });
    } catch (error) {
      console.error("Delete purchase request error:", error);
      res.status(500).json({ message: "Failed to delete purchase request" });
    }
  });

  // Purchase Orders routes
  app.get("/api/purchase-orders/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getPurchaseOrderStats();
      res.json(stats);
    } catch (error) {
      console.error("Get purchase order stats error:", error);
      res.status(500).json({ message: "Failed to get purchase order stats" });
    }
  });

  app.get(
    "/api/purchase-orders",
    requireAuth,
    requireRole(["admin", "finance", "project_manager"]),
    async (req, res) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const search = (req.query.search as string) || "";
        const status = (req.query.status as string) || "all";
        const supplierId = req.query.supplierId
          ? parseInt(req.query.supplierId as string)
          : undefined;

        const result = await storage.getPurchaseOrdersPaginated(page, limit, {
          search,
          status,
          supplierId,
        });
        res.json(result);
      } catch (error) {
        console.error("Get purchase orders error:", error);
        res.json({
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        });
      }
    },
  );

  app.get(
    "/api/purchase-orders/:id",
    requireAuth,
    requireRole(["admin", "finance", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const order = await storage.getPurchaseOrder(id);

        if (!order) {
          return res.status(404).json({ message: "Purchase order not found" });
        }

        res.json(order);
      } catch (error) {
        console.error("Get purchase order error:", error);
        res.status(500).json({ message: "Failed to get purchase order" });
      }
    },
  );

  app.post(
    "/api/purchase-orders",
    requireAuth,
    requireRole(["admin", "finance"]),
    upload.array("files"),
    async (req, res) => {
      try {
        const orderData = {
          ...req.body,
          items: JSON.parse(req.body.items || "[]"),
          files: req.files,
          createdBy: req.session.userId,
        };

        const order = await storage.createPurchaseOrder(orderData);
        res.status(201).json(order);
      } catch (error) {
        console.error("Create purchase order error:", error);
        res.status(500).json({ message: "Failed to create purchase order" });
      }
    },
  );

  app.put(
    "/api/purchase-orders/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    upload.array("files"),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const existingOrder = await storage.getPurchaseOrder(id);
        if (!existingOrder) {
          return res.status(404).json({ message: "Purchase order not found" });
        }

        const isAdmin = req.session.userRole === "admin";
        const editableStatuses = [
          "draft",
          "pending_approval",
          "approved",
          "rejected",
        ];
        if (!editableStatuses.includes(existingOrder.status)) {
          return res.status(400).json({
            message:
              "This purchase order cannot be edited in its current status",
          });
        }

        if (
          existingOrder.status !== "draft" &&
          !isAdmin &&
          req.session.userRole !== "finance"
        ) {
          return res.status(403).json({
            message: "Insufficient permissions to edit this purchase order",
          });
        }

        const { editNote, ...orderDataBody } = req.body;
        if (!editNote || !editNote.trim()) {
          return res.status(400).json({
            message: "Edit note is required when updating a purchase order",
          });
        }

        const orderItems = JSON.parse(req.body.items || "[]");
        const orderData = {
          ...orderDataBody,
          items: orderItems,
          existingFiles: req.body.existingFiles
            ? JSON.parse(req.body.existingFiles)
            : undefined,
          files: req.files,
        };

        const changes: Record<string, { old: any; new: any }> = {};
        const fieldsToTrack = [
          "supplierId",
          "totalAmount",
          "subtotal",
          "taxAmount",
          "discountPercentage",
          "discountAmount",
          "orderDate",
          "expectedDeliveryDate",
          "currency",
          "exchangeRate",
          "paymentTerms",
          "deliveryTerms",
          "bankAccount",
          "notes",
        ];

        for (const field of fieldsToTrack) {
          const oldVal = (existingOrder as any)[field];
          let newVal = orderData[field];

          if (field === "orderDate" || field === "expectedDeliveryDate") {
            const oldDate = oldVal
              ? new Date(oldVal).toISOString().split("T")[0]
              : null;
            const newDate = newVal
              ? new Date(newVal).toISOString().split("T")[0]
              : null;
            if (oldDate !== newDate) {
              changes[field] = { old: oldDate, new: newDate };
            }
          } else if (
            newVal !== undefined &&
            String(oldVal || "") !== String(newVal || "")
          ) {
            changes[field] = { old: oldVal, new: newVal };
          }
        }

        const existingItems = await storage.getPurchaseOrderItems(id);
        if (JSON.stringify(existingItems) !== JSON.stringify(orderItems)) {
          changes["items"] = {
            old: existingItems,
            new: orderItems,
          };
        }

        const order = await storage.updatePurchaseOrder(id, orderData);
        if (!order) {
          return res.status(404).json({ message: "Purchase order not found" });
        }

        const user = await storage.getUser(req.session.userId!);
        await storage.createInvoiceEditHistory({
          invoiceType: "purchase_order",
          invoiceId: id,
          editNote: editNote.trim(),
          changes: Object.keys(changes).length > 0 ? changes : null,
          editedBy: req.session.userId || null,
          editedByName: user?.username || null,
        });

        res.json(order);
      } catch (error) {
        console.error("Update purchase order error:", error);
        res.status(500).json({ message: "Failed to update purchase order" });
      }
    },
  );

  app.delete(
    "/api/purchase-orders/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const deleted = await storage.deletePurchaseOrder(id);

        if (!deleted) {
          return res.status(404).json({ message: "Purchase order not found" });
        }

        res.json({ message: "Purchase order deleted successfully" });
      } catch (error) {
        console.error("Delete purchase order error:", error);
        res.status(500).json({ message: "Failed to delete purchase order" });
      }
    },
  );

  // Purchase Order Approval routes
  app.post(
    "/api/purchase-orders/:id/submit",
    requireAuth,
    requireRole(["admin", "finance", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const order = await storage.submitPurchaseOrderForApproval(
          id,
          req.session.userId!,
        );
        res.json(order);
      } catch (error) {
        console.error("Submit purchase order error:", error);
        res
          .status(500)
          .json({ message: "Failed to submit purchase order for approval" });
      }
    },
  );

  app.patch(
    "/api/purchase-orders/:id/approve",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const order = await storage.approvePurchaseOrder(
          id,
          req.session.userId!,
        );
        res.json(order);
      } catch (error) {
        console.error("Approve purchase order error:", error);
        res.status(500).json({ message: "Failed to approve purchase order" });
      }
    },
  );

  app.patch(
    "/api/purchase-orders/:id/reject",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const { reason } = req.body;
        const order = await storage.rejectPurchaseOrder(
          id,
          req.session.userId!,
          reason,
        );
        res.json(order);
      } catch (error) {
        console.error("Reject purchase order error:", error);
        res.status(500).json({ message: "Failed to reject purchase order" });
      }
    },
  );

  app.get(
    "/api/purchase-invoices/:id/pdf",
    requireAuth,
    requireRole(["admin", "finance", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const invoice = await storage.getPurchaseInvoice(id);
        if (invoice?.poId) {
          const po = await storage.getPurchaseOrder(invoice.poId);
          invoice.poNumber = po?.poNumber;
        }
        const supplier = await storage.getSupplier(invoice?.supplierId);
        const company = await storage.getCompany();
        let project = null;
        if (invoice?.projectId) {
          project = await storage.getProject(invoice.projectId);
        }

        if (!invoice || !supplier || !company) {
          return res
            .status(404)
            .json({ message: "Purchase invoice or related data not found" });
        }

        const html = generatePurchaseInvoiceHTML(
          invoice,
          supplier,
          company,
          project,
        );

        res.setHeader("Content-Type", "text/html");
        res.send(html);
      } catch (error) {
        console.error("PDF generation error:", error);
        res.status(500).json({ message: "Failed to generate PDF" });
      }
    },
  );

  app.post(
    "/api/purchase-orders/:id/convert-to-invoice",
    requireAuth,
    requireRole(["admin", "finance"]),
    upload.array("files"),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        let overrides = undefined;
        if (req.body && Object.keys(req.body).length > 0) {
          overrides = { ...req.body };
          if (overrides.items && typeof overrides.items === "string") {
            try {
              overrides.items = JSON.parse(overrides.items);
            } catch (e) {
              console.error("Error parsing items in PO conversion:", e);
            }
          }
          overrides.files = req.files;
        }

        const result = await storage.convertPurchaseOrderToInvoice(
          id,
          req.session.userId!,
          overrides,
        );
        res.json(result);
      } catch (error: any) {
        console.error("Convert purchase order to invoice error:", error);
        res.status(500).json({
          message:
            error.message || "Failed to convert purchase order to invoice",
        });
      }
    },
  );

  app.get(
    "/api/purchase-orders/:id/pdf",
    requireAuth,
    requireRole(["admin", "finance", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const order = await storage.getPurchaseOrder(id);
        const supplier = await storage.getSupplier(order?.supplierId);
        const company = await storage.getCompany();

        if (!order || !supplier || !company) {
          return res
            .status(404)
            .json({ message: "Purchase order or related data not found" });
        }

        const html = generatePurchaseOrderHTML(order, supplier, company);

        res.setHeader("Content-Type", "text/html");
        res.send(html);
      } catch (error) {
        console.error("PDF generation error:", error);
        res.status(500).json({ message: "Failed to generate PDF" });
      }
    },
  );

  // Purchase Invoices routes
  app.get("/api/purchase-invoices/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getPurchaseStats();
      res.json(stats);
    } catch (error) {
      console.error("Get purchase stats error:", error);
      res.status(500).json({ message: "Failed to get purchase stats" });
    }
  });

  app.get(
    "/api/purchase-invoices",
    requireAuth,
    requireRole(["admin", "finance", "project_manager"]),
    async (req, res) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const search = (req.query.search as string) || "";
        const startDate = req.query.startDate as string;
        const endDate = req.query.endDate as string;
        const supplierId = req.query.supplierId
          ? parseInt(req.query.supplierId as string)
          : undefined;
        const status = req.query.status as string;

        const result = await storage.getPurchaseInvoicesPaginated(page, limit, {
          startDate,
          endDate,
          supplierId,
          status,
          search,
        });
        res.json(result);
      } catch (error) {
        console.error("Get purchase invoices error:", error);
        res.status(500).json({ message: "Failed to get purchase invoices" });
      }
    },
  );

  app.get(
    "/api/purchase-invoices/:id",
    requireAuth,
    requireRole(["admin", "finance", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const invoice = await storage.getPurchaseInvoice(id);

        if (!invoice) {
          return res
            .status(404)
            .json({ message: "Purchase invoice not found" });
        }

        res.json(invoice);
      } catch (error) {
        console.error("Get purchase invoice error:", error);
        res.status(500).json({ message: "Failed to get purchase invoice" });
      }
    },
  );

  app.post(
    "/api/purchase-invoices",
    requireAuth,
    requireRole(["admin", "finance"]),
    upload.array("files"),
    async (req, res) => {
      try {
        const invoiceData = {
          ...req.body,
          items: JSON.parse(req.body.items || "[]"),
          files: req.files,
          createdBy: req.session.userId,
        };

        const invoice =
          await storage.createPurchaseInvoiceStandalone(invoiceData);
        res.status(201).json(invoice);
      } catch (error) {
        console.error("Create purchase invoice error:", error);
        res.status(500).json({ message: "Failed to create purchase invoice" });
      }
    },
  );

  app.put(
    "/api/purchase-invoices/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    upload.array("files"),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const existingInvoice = await storage.getPurchaseInvoice(id);
        if (!existingInvoice) {
          return res
            .status(404)
            .json({ message: "Purchase invoice not found" });
        }
        const isAdmin = req.session.userRole === "admin";
        const editableStatuses = ["draft", "approved", "partial", "paid"];
        if (!editableStatuses.includes(existingInvoice.status)) {
          return res.status(400).json({
            message: "This invoice cannot be edited in its current status",
          });
        }
        if (existingInvoice.status !== "draft" && !isAdmin) {
          return res
            .status(403)
            .json({ message: "Only admin can edit non-draft invoices" });
        }
        const {
          editNote,
          status: _status,
          paymentStatus: _paymentStatus,
          paidAmount: _paidAmount,
          ...invoiceData
        } = req.body;
        if (!editNote || !editNote.trim()) {
          return res.status(400).json({
            message: "Edit note is required when updating an invoice",
          });
        }

        const changes: Record<string, { old: any; new: any }> = {};
        const fieldsToTrack = [
          "supplierId",
          "totalAmount",
          "subtotal",
          "taxAmount",
          "discountPercentage",
          "discountAmount",
          "invoiceDate",
          "dueDate",
          "currency",
          "exchangeRate",
          "notes",
          "paymentTerms",
          "bankAccount",
        ];
        for (const field of fieldsToTrack) {
          const oldVal = (existingInvoice as any)[field];
          const newVal = invoiceData[field];
          if (
            newVal !== undefined &&
            String(oldVal || "") !== String(newVal || "")
          ) {
            changes[field] = { old: oldVal, new: newVal };
          }
        }
        if (
          JSON.stringify(existingInvoice.items) !==
          JSON.stringify(invoiceData.items)
        ) {
          changes["items"] = {
            old: existingInvoice.items,
            new: invoiceData.items,
          };
        }

        const isApprovedEdit = existingInvoice.status !== "draft";

        const updatedInvoiceData = {
          ...invoiceData,
          items: JSON.parse(invoiceData.items || "[]"),
          existingFiles: req.body.existingFiles
            ? JSON.parse(req.body.existingFiles)
            : undefined,
          files: req.files,
        };

        const invoice = await storage.updatePurchaseInvoice(
          id,
          updatedInvoiceData,
          isApprovedEdit,
        );

        if (existingInvoice.status !== "draft") {
          await storage.updatePurchaseInvoiceGLEntries(id);

          const paidAmount = parseFloat(invoice.paidAmount || "0");
          const newTotal = parseFloat(invoice.totalAmount || "0");
          let newPaymentStatus = invoice.paymentStatus;
          if (paidAmount > 0 && newTotal > 0) {
            if (paidAmount >= newTotal) {
              newPaymentStatus = "paid";
            } else {
              newPaymentStatus = "partial";
            }
          } else if (
            paidAmount === 0 &&
            (invoice.paymentStatus === "paid" ||
              invoice.paymentStatus === "partial")
          ) {
            newPaymentStatus = "unpaid";
          }

          if (newPaymentStatus !== invoice.paymentStatus) {
            await storage.updatePurchaseInvoice(
              id,
              { paymentStatus: newPaymentStatus } as any,
              false,
            );
            invoice.paymentStatus = newPaymentStatus;
            changes["paymentStatus"] = {
              old: existingInvoice.paymentStatus,
              new: newPaymentStatus,
            };
          }
        }

        const user = await storage.getUser(req.session.userId!);
        await storage.createInvoiceEditHistory({
          invoiceType: "purchase",
          invoiceId: id,
          editNote: editNote.trim(),
          changes: Object.keys(changes).length > 0 ? changes : null,
          editedBy: req.session.userId || null,
          editedByName: user?.username || null,
        });

        res.json(invoice);
      } catch (error: any) {
        console.error("Update purchase invoice error:", error);
        res.status(400).json({
          message: error.message || "Failed to update purchase invoice",
        });
      }
    },
  );

  app.get(
    "/api/purchase-invoices/:id/edit-history",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const history = await storage.getInvoiceEditHistory("purchase", id);
        res.json(history);
      } catch (error) {
        console.error("Get purchase invoice edit history error:", error);
        res.status(500).json({ message: "Failed to get edit history" });
      }
    },
  );

  app.patch(
    "/api/purchase-invoices/:id/submit",
    requireAuth,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const invoice = await storage.getPurchaseInvoice(id);

        if (!invoice) {
          return res
            .status(404)
            .json({ message: "Purchase invoice not found" });
        }

        if (invoice.status !== "draft") {
          return res
            .status(400)
            .json({ message: "Only draft invoices can be submitted" });
        }

        const updated = await storage.submitPurchaseInvoiceForApproval(
          id,
          req.session.userId!,
        );
        res.json({
          message: "Purchase invoice submitted for approval",
          invoice: updated,
        });
      } catch (error) {
        console.error("Submit purchase invoice error:", error);
        res.status(500).json({ message: "Failed to submit purchase invoice" });
      }
    },
  );

  app.patch(
    "/api/purchase-invoices/:id/approve",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const invoice = await storage.getPurchaseInvoice(id);

        if (!invoice) {
          return res
            .status(404)
            .json({ message: "Purchase invoice not found" });
        }

        if (invoice.status === "approved") {
          return res
            .status(400)
            .json({ message: "Invoice is already approved" });
        }

        if (invoice.status !== "pending_approval") {
          return res
            .status(400)
            .json({ message: "Only pending invoices can be approved" });
        }

        await storage.approvePurchaseInvoice(id, req.session.userId!);
        res.json({ message: "Purchase invoice approved successfully" });
      } catch (error) {
        console.error("Approve purchase invoice error:", error);
        res.status(500).json({ message: "Failed to approve purchase invoice" });
      }
    },
  );

  app.patch(
    "/api/purchase-invoices/:id/reject",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const invoice = await storage.getPurchaseInvoice(id);

        if (!invoice) {
          return res
            .status(404)
            .json({ message: "Purchase invoice not found" });
        }

        if (invoice.status !== "pending_approval") {
          return res
            .status(400)
            .json({ message: "Only pending invoices can be rejected" });
        }

        const { reason } = req.body;
        const updated = await storage.rejectPurchaseInvoice(
          id,
          req.session.userId!,
          reason,
        );
        res.json({ message: "Purchase invoice rejected", invoice: updated });
      } catch (error) {
        console.error("Reject purchase invoice error:", error);
        res.status(500).json({ message: "Failed to reject purchase invoice" });
      }
    },
  );

  app.post(
    "/api/purchase-invoices/:id/cancel",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const invoice = await storage.getPurchaseInvoice(id);

        if (!invoice) {
          return res
            .status(404)
            .json({ message: "Purchase invoice not found" });
        }

        if (invoice.status !== "approved") {
          return res
            .status(400)
            .json({ message: "Only approved invoices can be cancelled" });
        }

        if (parseFloat(invoice.paidAmount || "0") > 0) {
          return res.status(400).json({
            message:
              "Cannot cancel an invoice that has recorded payments. Please reverse the payments first.",
          });
        }

        const result = await storage.cancelPurchaseInvoice(
          id,
          req.session.userId!,
        );
        res.json({ message: "Purchase invoice cancelled", invoice: result });
      } catch (error) {
        console.error("Cancel purchase invoice error:", error);
        res.status(500).json({ message: "Failed to cancel purchase invoice" });
      }
    },
  );

  app.post(
    "/api/purchase-invoices/:id/payments",
    requireAuth,
    requireRole(["admin", "finance"]),
    upload.array("paymentFiles", 10),
    async (req, res) => {
      try {
        const invoiceId = parseInt(req.params.id);
        const paymentData = {
          ...req.body,
          invoiceId,
          recordedBy: req.session.userId,
        };

        const payment = await storage.createPurchaseInvoicePayment(paymentData);

        // Handle file uploads if any
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
          for (const file of req.files) {
            await storage.createPurchasePaymentFile({
              paymentId: payment.id,
              fileName: file.filename,
              originalName: file.originalname,
              filePath: file.path,
              fileSize: file.size,
              mimeType: file.mimetype,
            });
          }
        }

        res.status(201).json(payment);
      } catch (error) {
        console.error("Record purchase payment error:", error);
        res.status(500).json({ message: "Failed to record payment" });
      }
    },
  );

  app.get(
    "/api/purchase-invoices/:id/payments",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const invoiceId = parseInt(req.params.id);
        const payments = await storage.getPurchaseInvoicePayments(invoiceId);
        res.json(payments);
      } catch (error) {
        console.error("Get purchase invoice payments error:", error);
        res
          .status(500)
          .json({ message: "Failed to get purchase invoice payments" });
      }
    },
  );

  app.get(
    "/api/purchase-payment-files/:id/download",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const fileId = parseInt(req.params.id);
        const file = await storage.getPurchasePaymentFile(fileId);

        if (!file) {
          return res.status(404).json({ message: "File not found" });
        }
        const filePath = path.resolve(file.filePath);

        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ message: "File not found on disk" });
        }

        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${file.originalName}"`,
        );
        res.setHeader(
          "Content-Type",
          file.mimeType || "application/octet-stream",
        );

        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
      } catch (error) {
        console.error("Download purchase payment file error:", error);
        res.status(500).json({ message: "Failed to download file" });
      }
    },
  );

  // app.post(
  //   "/api/purchase-orders/:id/convert-to-invoice",
  //   requireAuth,
  //   requireRole(["admin", "finance"]),
  //   async (req, res) => {
  //     try {
  //       const poId = parseInt(req.params.id);
  //       const invoiceData = {
  //         ...req.body,
  //         createdBy: req.session.userId,
  //       };

  //       const invoice = await storage.createPurchaseInvoiceFromPO(
  //         poId,
  //         invoiceData,
  //       );
  //       res.status(201).json(invoice);
  //     } catch (error) {
  //       console.error("Convert PO to invoice error:", error);
  //       res
  //         .status(500)
  //         .json({ message: "Failed to convert purchase order to invoice" });
  //     }
  //   },
  // );

  // Get supplier inventory items
  app.get("/api/suppliers/:id/suppliers", async (req, res) => {
    try {
      const supplierId = parseInt(req.params.id);
      const supplierItems =
        await storage.getSupplierInventoryItemsBySupplierId(supplierId);
      res.json(supplierItems);
    } catch (error) {
      console.error("Error fetching supplier inventory items:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch supplier inventory items" });
    }
  });

  // Get products for a specific supplier
  app.get("/api/suppliers/:id/products", async (req, res) => {
    try {
      const supplierId = parseInt(req.params.id);
      const products = await storage.getProductsBySupplier(supplierId);
      res.json(products);
    } catch (error) {
      console.error("Error fetching supplier products:", error);
      res.status(500).json({ message: "Failed to fetch supplier products" });
    }
  });

  app.put(
    "/api/suppliers/:id/archive",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const supplier = await storage.updateSupplier(id, { isArchived: true });

        if (!supplier) {
          return res.status(404).json({ message: "Supplier not found" });
        }

        res.json({ message: "Supplier archived successfully", supplier });
      } catch (error) {
        res.status(500).json({ message: "Failed to archive supplier" });
      }
    },
  );

  app.put(
    "/api/suppliers/:id/unarchive",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const supplier = await storage.updateSupplier(id, {
          isArchived: false,
        });

        if (!supplier) {
          return res.status(404).json({ message: "Supplier not found" });
        }

        res.json({ message: "Supplier unarchived successfully", supplier });
      } catch (error) {
        console.error("Supplier unarchive error:", error);
        res.status(500).json({ message: "Failed to unarchive supplier" });
      }
    },
  );

  // ============================================================================
  // Vessel Location Tracking
  // ============================================================================

  // Get vessel location using IMO number
  app.get("/api/vessel-location/:imo", async (req, res) => {
    const { imo } = req.params;

    if (!imo) {
      return res.status(400).json({ message: "IMO number is required" });
    }

    try {
      // Note: You'll need to set up VesselFinder API credentials
      // For demo purposes, we'll simulate the API response
      // Replace this with actual VesselFinder API call

      const vesselFinderApiKey = process.env.VESSEL_FINDER_API_KEY;

      if (!vesselFinderApiKey) {
        // Return mock data for development
        const mockData = {
          imo: imo,
          name: "Sample Vessel",
          lat: 25.276987,
          lon: 55.296249, // Dubai coordinates as example
          course: 45,
          speed: 12.5,
          heading: 42,
          timestamp: new Date().toISOString(),
          destination: "DUBAI",
          eta: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          status: "Under way using engine",
        };

        return res.json(mockData);
      }

      // Actual VesselFinder API call
      const vesselFinderUrl = `https://api.vesselfinder.com/vessels?userkey=${vesselFinderApiKey}&imo=${imo}&format=json`;

      const apiResponse = await fetch(vesselFinderUrl);

      if (!apiResponse.ok) {
        throw new Error(`VesselFinder API error: ${apiResponse.statusText}`);
      }

      const apiData = await apiResponse.json();

      if (!apiData || apiData.length === 0) {
        return res.status(404).json({ message: "Vessel not found" });
      }

      const vessel = apiData[0]; // Get first result

      // Transform API response to our format
      const vesselData = {
        imo: vessel.IMO || imo,
        name: vessel.SHIPNAME || "Unknown",
        lat: parseFloat(vessel.LAT) || 0,
        lon: parseFloat(vessel.LON) || 0,
        course: parseFloat(vessel.COURSE) || 0,
        speed: parseFloat(vessel.SPEED) || 0,
        heading: parseFloat(vessel.HEADING) || 0,
        timestamp: vessel.TIMESTAMP || new Date().toISOString(),
        destination: vessel.DESTINATION || "",
        eta: vessel.ETA || "",
        status: vessel.NAVSTAT || "Unknown",
      };

      res.json(vesselData);
    } catch (error) {
      console.error("Vessel location fetch error:", error);
      res.status(500).json({
        message: "Failed to fetch vessel location",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ============================================================================
  // Error Logs
  // ============================================================================

  // Proforma Invoices routes
  app.get(
    "/api/proforma-invoices",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const proformaInvoices = await storage.getProformaInvoices();
        res.json(proformaInvoices);
      } catch (error) {
        console.error("Error fetching proforma invoices:", error);
        res.status(500).json({ message: "Failed to fetch proforma invoices" });
      }
    },
  );

  app.get(
    "/api/proforma-invoices/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const proformaInvoice = await storage.getProformaInvoice(id);

        if (!proformaInvoice) {
          return res
            .status(404)
            .json({ message: "Proforma invoice not found" });
        }

        res.json(proformaInvoice);
      } catch (error) {
        console.error("Error fetching proforma invoice:", error);
        res.status(500).json({ message: "Failed to fetch proforma invoice" });
      }
    },
  );

  app.post(
    "/api/proforma-invoices",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        console.log("Creating proforma invoice with data:", req.body);
        const proformaData = req.body;

        // Date fields should remain as ISO strings (YYYY-MM-DD format)
        // No conversion needed - Drizzle expects strings for date() columns

        const proformaInvoice =
          await storage.createProformaInvoice(proformaData);
        console.log("Created proforma invoice:", proformaInvoice);
        res.status(201).json(proformaInvoice);
      } catch (error) {
        console.error("Error creating proforma invoice:", error);
        res.status(500).json({ message: "Failed to create proforma invoice" });
      }
    },
  );

  app.put(
    "/api/proforma-invoices/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        console.log("Updating proforma invoice", id, "with data:", req.body);

        // If this is a status update to approved, add some validation
        if (req.body.status === "approved") {
          const existingProforma = await storage.getProformaInvoice(id);
          if (!existingProforma) {
            return res
              .status(404)
              .json({ message: "Proforma invoice not found" });
          }

          // Only allow approval from draft or sent status
          if (
            existingProforma.status !== "draft" &&
            existingProforma.status !== "sent"
          ) {
            return res.status(400).json({
              message: `Cannot approve proforma invoice from ${existingProforma.status} status`,
            });
          }
        }

        const proformaInvoice = await storage.updateProformaInvoice(
          id,
          req.body,
        );

        if (!proformaInvoice) {
          return res
            .status(404)
            .json({ message: "Proforma invoice not found" });
        }

        console.log("Updated proforma invoice:", proformaInvoice);
        res.json(proformaInvoice);
      } catch (error) {
        console.error("Error updating proforma invoice:", error);
        res.status(500).json({ message: "Failed to update proforma invoice" });
      }
    },
  );

  app.post(
    "/api/proforma-invoices/:id/convert-to-invoice",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const proformaId = parseInt(req.params.id);

        // Get the proforma invoice
        const proforma = await storage.getProformaInvoice(proformaId);
        if (!proforma) {
          return res
            .status(404)
            .json({ message: "Proforma invoice not found" });
        }

        // Check if proforma is approved
        if (proforma.status !== "approved") {
          return res.status(400).json({
            message:
              "Only approved proforma invoices can be converted to sales invoices",
          });
        }

        // Generate invoice number
        // const invoiceNumber = `INV-${Date.now()}`;

        // Create sales invoice data
        const invoiceData = {
          // invoiceNumber,
          customerId: proforma.customerId,
          projectId: proforma.projectId,
          quotationId: proforma.quotationId,
          currency: proforma.currency || "AED",
          exchangeRate: proforma.exchangeRate || "1",
          status: "draft",
          invoiceDate: new Date().toISOString().split("T")[0],
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0], // 30 days from now
          items: proforma.items || [],
          subtotal: proforma.subtotal,
          taxAmount: proforma.taxAmount,
          discount: proforma.discount,
          discountPercentage: proforma.discountPercentage,
          totalAmount: proforma.totalAmount,
          paidAmount: "0",
        };

        // Create the sales invoice
        const salesInvoice = await storage.createSalesInvoice(invoiceData);

        // Update proforma status to converted
        await storage.updateProformaInvoice(proformaId, {
          status: "converted",
        });

        res.status(201).json({
          message: "Proforma invoice converted to sales invoice successfully",
          salesInvoice,
          proformaInvoice: await storage.getProformaInvoice(proformaId),
        });
      } catch (error) {
        console.error(
          "Error converting proforma invoice to sales invoice:",
          error,
        );
        res.status(500).json({
          message: "Failed to convert proforma invoice to sales invoice",
        });
      }
    },
  );

  app.delete(
    "/api/proforma-invoices/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        await storage.deleteProformaInvoice(id);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting proforma invoice:", error);
        res.status(500).json({ message: "Failed to delete proforma invoice" });
      }
    },
  );

  app.get(
    "/api/proforma-invoices/:id/pdf",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const proforma = await storage.getProformaInvoice(id);
        const customer = await storage.getCustomer(proforma?.customerId);
        const company = await storage.getCompany();
        const project = await storage.getProject(proforma?.projectId);

        if (!proforma || !customer || !company) {
          return res
            .status(404)
            .json({ message: "Proforma invoice or related data not found" });
        }

        const html = generateProformaHTML(proforma, customer, company, project);

        res.setHeader("Content-Type", "text/html");
        res.send(html);
      } catch (error) {
        console.error("PDF generation error:", error);
        res.status(500).json({ message: "Failed to generate PDF" });
      }
    },
  );

  // Credit Notes routes
  app.get(
    "/api/credit-notes",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const creditNotes = await storage.getCreditNotes();
        res.json(creditNotes);
      } catch (error) {
        console.error("Error fetching credit notes:", error);
        res.status(500).json({ message: "Failed to fetch credit notes" });
      }
    },
  );

  app.get(
    "/api/credit-notes/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const creditNote = await storage.getCreditNote(id);

        if (!creditNote) {
          return res.status(404).json({ message: "Credit note not found" });
        }

        res.json(creditNote);
      } catch (error) {
        console.error("Error fetching credit note:", error);
        res.status(500).json({ message: "Failed to fetch credit note" });
      }
    },
  );

  app.post(
    "/api/credit-notes",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        console.log("Creating credit note with data:", req.body);
        const creditNoteData = req.body;

        // Date fields should remain as ISO strings (YYYY-MM-DD format)
        // No conversion needed - Drizzle expects strings for date() columns

        const creditNote = await storage.createCreditNote(creditNoteData);
        console.log("Created credit note:", creditNote);
        res.status(201).json(creditNote);
      } catch (error) {
        console.error("Error creating credit note:", error);
        res.status(500).json({ message: "Failed to create credit note" });
      }
    },
  );

  app.put(
    "/api/credit-notes/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        console.log("Updating credit note", id, "with data:", req.body);

        const creditNote = await storage.updateCreditNote(id, req.body);

        if (!creditNote) {
          return res.status(404).json({ message: "Credit note not found" });
        }

        console.log("Updated credit note:", creditNote);
        res.json(creditNote);
      } catch (error) {
        console.error("Error updating credit note:", error);
        res.status(500).json({ message: "Failed to update credit note" });
      }
    },
  );

  app.delete(
    "/api/credit-notes/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        await storage.deleteCreditNote(id);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting credit note:", error);
        res.status(500).json({ message: "Failed to delete credit note" });
      }
    },
  );

  app.get(
    "/api/sales-invoices/:id/credit-notes",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const invoiceId = parseInt(req.params.id);
        const creditNotes = await storage.getCreditNotesByInvoice(invoiceId);
        res.json(creditNotes);
      } catch (error) {
        console.error("Error fetching credit notes for invoice:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch credit notes for invoice" });
      }
    },
  );

  // Purchase Credit Notes routes
  app.get(
    "/api/purchase-credit-notes",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const creditNotes = await storage.getPurchaseCreditNotes();
        res.json(creditNotes);
      } catch (error) {
        console.error("Error fetching purchase credit notes:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch purchase credit notes" });
      }
    },
  );

  app.get(
    "/api/purchase-credit-notes/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const creditNote = await storage.getPurchaseCreditNote(id);

        if (!creditNote) {
          return res
            .status(404)
            .json({ message: "Purchase credit note not found" });
        }

        res.json(creditNote);
      } catch (error) {
        console.error("Error fetching purchase credit note:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch purchase credit note" });
      }
    },
  );

  app.post(
    "/api/purchase-credit-notes",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        console.log("Creating purchase credit note with data:", req.body);
        const creditNote = await storage.createPurchaseCreditNote(req.body);
        console.log("Created purchase credit note:", creditNote);
        res.status(201).json(creditNote);
      } catch (error) {
        console.error("Error creating purchase credit note:", error);
        res
          .status(500)
          .json({ message: "Failed to create purchase credit note" });
      }
    },
  );

  app.put(
    "/api/purchase-credit-notes/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        console.log(
          "Updating purchase credit note",
          id,
          "with data:",
          req.body,
        );

        const creditNote = await storage.updatePurchaseCreditNote(id, req.body);

        if (!creditNote) {
          return res
            .status(404)
            .json({ message: "Purchase credit note not found" });
        }

        console.log("Updated purchase credit note:", creditNote);
        res.json(creditNote);
      } catch (error) {
        console.error("Error updating purchase credit note:", error);
        res
          .status(500)
          .json({ message: "Failed to update purchase credit note" });
      }
    },
  );

  app.delete(
    "/api/purchase-credit-notes/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        await storage.deletePurchaseCreditNote(id);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting purchase credit note:", error);
        res
          .status(500)
          .json({ message: "Failed to delete purchase credit note" });
      }
    },
  );

  app.get(
    "/api/purchase-invoices/:id/credit-notes",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const invoiceId = parseInt(req.params.id);
        const creditNotes =
          await storage.getPurchaseCreditNotesByInvoice(invoiceId);
        res.json(creditNotes);
      } catch (error) {
        console.error(
          "Error fetching purchase credit notes for invoice:",
          error,
        );
        res.status(500).json({
          message: "Failed to fetch purchase credit notes for invoice",
        });
      }
    },
  );

  // Error Logs routes
  app.get("/api/error-logs", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const severity = req.query.severity as string;
      const resolved = req.query.resolved as string;

      const result = await storage.getErrorLogs(
        page,
        limit,
        severity,
        resolved === "true" ? true : resolved === "false" ? false : undefined,
      );

      res.json(result);
    } catch (error) {
      console.error("Error fetching error logs:", error);
      res.status(500).json({ message: "Failed to fetch error logs" });
    }
  });

  app.post("/api/error-logs", async (req, res) => {
    try {
      const errorData = {
        message: req.body.message,
        stack: req.body.stack,
        url: req.body.url,
        userAgent: req.headers["user-agent"],
        userId: req.session.userId || null,
        severity: req.body.severity || "error",
        component: req.body.component,
      };

      const errorLog = await storage.createErrorLog(errorData);
      res.status(201).json(errorLog);
    } catch (error) {
      console.error("Create error log error:", error);
      res.status(500).json({ message: "Failed to create error log" });
    }
  });

  app.put(
    "/api/error-logs/:id/resolve",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const errorLog = await storage.updateErrorLog(id, { resolved: true });

        if (!errorLog) {
          return res.status(404).json({ message: "Error log not found" });
        }

        res.json(errorLog);
      } catch (error) {
        console.error("Resolve error log error:", error);
        res.status(500).json({ message: "Failed to resolve error log" });
      }
    },
  );

  app.delete(
    "/api/error-logs/clear",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const deletedCount = await storage.clearErrorLogs();
        res.json({
          message: "All error logs cleared successfully",
          deletedCount,
        });
      } catch (error) {
        console.error("Clear error logs error:", error);
        res.status(500).json({ message: "Failed to clear error logs" });
      }
    },
  );

  app.delete(
    "/api/error-logs/clear-resolved",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const deletedCount = await storage.clearResolvedErrorLogs();
        res.json({
          message: "Resolved error logs cleared successfully",
          deletedCount,
        });
      } catch (error) {
        console.error("Clear resolved error logs error:", error);
        res
          .status(500)
          .json({ message: "Failed to clear resolved error logs" });
      }
    },
  );

  app.get(
    "/api/credit-notes/:id/pdf",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const creditNoteId = parseInt(req.params.id);
        const creditNote = await storage.getCreditNote(creditNoteId);
        const customer = await storage.getCustomer(creditNote?.customerId);
        const company = await storage.getCompany();

        if (!creditNote || !customer || !company) {
          return res
            .status(404)
            .json({ message: "Credit note or related data not found" });
        }

        const html = generateCreditNoteHTML(creditNote, customer, company);

        res.setHeader("Content-Type", "text/html");
        res.send(html);
      } catch (error) {
        console.error("Credit note PDF generation error:", error);
        res.status(500).json({ message: "Failed to generate credit note PDF" });
      }
    },
  );

  app.get(
    "/api/sales-invoices/:id/pdf",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const invoiceId = parseInt(req.params.id);
        const invoice = await storage.getSalesInvoice(invoiceId);
        const customer = await storage.getCustomer(invoice?.customerId);
        const company = await storage.getCompany();

        if (!invoice || !customer || !company) {
          return res
            .status(404)
            .json({ message: "Invoice or related data not found" });
        }

        const html = generateInvoiceHTML(invoice, customer, company);

        res.setHeader("Content-Type", "text/html");
        res.send(html);
      } catch (error) {
        console.error("PDF generation error:", error);
        res.status(500).json({ message: "Failed to generate PDF" });
      }
    },
  );

  // Customer Documents routes
  app.get("/api/customers/:id/documents", requireAuth, async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      const documents = await storage.getCustomerDocuments(customerId);
      res.json(documents);
    } catch (error) {
      console.error("Error getting customer documents:", error);
      res.status(500).json({ message: "Failed to get customer documents" });
    }
  });

  app.post(
    "/api/customers/:id/documents",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    upload.single("file"),
    async (req, res) => {
      try {
        const customerId = parseInt(req.params.id);
        const documentData = { ...req.body, customerId };

        // Handle file upload
        if (req.file) {
          documentData.filePath = req.file.path;
          documentData.fileName = req.file.originalname;
          documentData.fileSize = req.file.size;
        }

        // Convert date strings to Date objects
        if (
          documentData.dateOfIssue &&
          typeof documentData.dateOfIssue === "string"
        ) {
          documentData.dateOfIssue = new Date(
            documentData.dateOfIssue,
          ).toISOString();
        }
        if (
          documentData.expiryDate &&
          typeof documentData.expiryDate === "string"
        ) {
          documentData.expiryDate = new Date(
            documentData.expiryDate,
          ).toISOString();
        }

        const parsedData = insertCustomerDocumentSchema.parse(documentData);
        const result = await storage.createCustomerDocument(parsedData);
        res.status(201).json(result);
      } catch (error) {
        console.error("Error creating customer document:", error);
        if (error instanceof ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create customer document" });
      }
    },
  );

  app.put(
    "/api/customers/:customerId/documents/:documentId",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    upload.single("file"),
    async (req, res) => {
      try {
        const documentId = parseInt(req.params.documentId);
        const documentData = { ...req.body };

        // Handle file upload
        if (req.file) {
          documentData.filePath = req.file.path;
          documentData.fileName = req.file.originalname;
          documentData.fileSize = req.file.size;
        }

        // Convert date strings to Date objects
        if (
          documentData.dateOfIssue &&
          typeof documentData.dateOfIssue === "string"
        ) {
          documentData.dateOfIssue = new Date(
            documentData.dateOfIssue,
          ).toISOString();
        }
        if (
          documentData.expiryDate &&
          typeof documentData.expiryDate === "string"
        ) {
          documentData.expiryDate = new Date(
            documentData.expiryDate,
          ).toISOString();
        }

        const result = await storage.updateCustomerDocument(
          documentId,
          documentData,
        );
        if (!result) {
          return res.status(404).json({ message: "Document not found" });
        }
        res.json(result);
      } catch (error) {
        console.error("Error updating customer document:", error);
        res.status(500).json({ message: "Failed to update customer document" });
      }
    },
  );

  app.delete(
    "/api/customers/:customerId/documents/:documentId",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const documentId = parseInt(req.params.documentId);
        const success = await storage.deleteCustomerDocument(documentId);
        if (!success) {
          return res.status(404).json({ message: "Document not found" });
        }
        res.json({ message: "Document deleted successfully" });
      } catch (error) {
        console.error("Error deleting customer document:", error);
        res.status(500).json({ message: "Failed to delete customer document" });
      }
    },
  );

  // Supplier Documents routes
  app.get("/api/suppliers/:id/documents", requireAuth, async (req, res) => {
    try {
      const supplierId = parseInt(req.params.id);
      const documents = await storage.getSupplierDocuments(supplierId);
      res.json(documents);
    } catch (error) {
      console.error("Error getting supplier documents:", error);
      res.status(500).json({ message: "Failed to get supplier documents" });
    }
  });

  app.post(
    "/api/suppliers/:id/documents",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    upload.single("file"),
    async (req, res) => {
      try {
        const supplierId = parseInt(req.params.id);
        const documentData = { ...req.body, supplierId };

        // Handle file upload
        if (req.file) {
          documentData.filePath = req.file.path;
          documentData.fileName = req.file.originalname;
          documentData.fileSize = req.file.size;
        }

        // Convert date strings to Date objects
        if (
          documentData.dateOfIssue &&
          typeof documentData.dateOfIssue === "string"
        ) {
          documentData.dateOfIssue = new Date(documentData.dateOfIssue);
        }
        if (
          documentData.expiryDate &&
          typeof documentData.expiryDate === "string"
        ) {
          documentData.expiryDate = new Date(documentData.expiryDate);
        }

        const parsedData = insertSupplierDocumentSchema.parse(documentData);
        const result = await storage.createSupplierDocument(parsedData);
        res.status(201).json(result);
      } catch (error) {
        console.error("Error creating supplier document:", error);
        if (error instanceof ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create supplier document" });
      }
    },
  );

  app.put(
    "/api/suppliers/:supplierId/documents/:documentId",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    upload.single("file"),
    async (req, res) => {
      try {
        const documentId = parseInt(req.params.documentId);
        const documentData = { ...req.body };

        // Handle file upload
        if (req.file) {
          documentData.filePath = req.file.path;
          documentData.fileName = req.file.originalname;
          documentData.fileSize = req.file.size;
        }

        // Convert date strings to Date objects
        if (
          documentData.dateOfIssue &&
          typeof documentData.dateOfIssue === "string"
        ) {
          documentData.dateOfIssue = new Date(documentData.dateOfIssue);
        }
        if (
          documentData.expiryDate &&
          typeof documentData.expiryDate === "string"
        ) {
          documentData.expiryDate = new Date(documentData.expiryDate);
        }

        const result = await storage.updateSupplierDocument(
          documentId,
          documentData,
        );
        if (!result) {
          return res.status(404).json({ message: "Document not found" });
        }
        res.json(result);
      } catch (error) {
        console.error("Error updating supplier document:", error);
        res.status(500).json({ message: "Failed to update supplier document" });
      }
    },
  );

  app.delete(
    "/api/suppliers/:supplierId/documents/:documentId",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const documentId = parseInt(req.params.documentId);
        const success = await storage.deleteSupplierDocument(documentId);
        if (!success) {
          return res.status(404).json({ message: "Document not found" });
        }
        res.json({ message: "Document deleted successfully" });
      } catch (error) {
        console.error("Error deleting supplier document:", error);
        res.status(500).json({ message: "Failed to delete supplier document" });
      }
    },
  );

  //Profile
  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.session.userId;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "All fields are required" });
      }

      await storage.changePassword(userId!, currentPassword, newPassword);

      res.json({ message: "Password changed successfully" });
    } catch (error: any) {
      console.error("Change password error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Exchange Rate routes
  app.get(
    "/api/exchange-rates",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const rates = await storage.getExchangeRates();
        res.json(rates);
      } catch (error) {
        console.error("Get exchange rates error:", error);
        res.status(500).json({ message: "Failed to get exchange rates" });
      }
    },
  );

  app.post(
    "/api/exchange-rates",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const { fromCurrency, toCurrency, rate, isActive } = req.body;
        if (!fromCurrency || !toCurrency || !rate) {
          return res.status(400).json({
            message: "From currency, to currency, and rate are required",
          });
        }
        if (fromCurrency === toCurrency) {
          return res
            .status(400)
            .json({ message: "From and To currencies must be different" });
        }
        if (parseFloat(rate) <= 0) {
          return res
            .status(400)
            .json({ message: "Rate must be a positive number" });
        }
        const existingRates = await storage.getExchangeRates();
        const duplicate = existingRates.find(
          (r) => r.fromCurrency === fromCurrency && r.toCurrency === toCurrency,
        );
        if (duplicate) {
          return res.status(400).json({
            message: `Exchange rate from ${fromCurrency} to ${toCurrency} already exists. Please edit the existing rate instead.`,
          });
        }
        const newRate = await storage.createExchangeRate({
          fromCurrency,
          toCurrency,
          rate: String(rate),
          isActive: isActive !== undefined ? isActive : true,
          updatedById: req.session.userId,
        });
        res.status(201).json(newRate);
      } catch (error) {
        console.error("Create exchange rate error:", error);
        res.status(500).json({ message: "Failed to create exchange rate" });
      }
    },
  );

  app.put(
    "/api/exchange-rates/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const { fromCurrency, toCurrency, rate, isActive } = req.body;
        const updated = await storage.updateExchangeRate(id, {
          ...(fromCurrency && { fromCurrency }),
          ...(toCurrency && { toCurrency }),
          ...(rate !== undefined && { rate: String(rate) }),
          ...(isActive !== undefined && { isActive }),
          updatedById: req.session.userId,
        });
        if (!updated) {
          return res.status(404).json({ message: "Exchange rate not found" });
        }
        res.json(updated);
      } catch (error) {
        console.error("Update exchange rate error:", error);
        res.status(500).json({ message: "Failed to update exchange rate" });
      }
    },
  );

  app.delete(
    "/api/exchange-rates/:id",
    requireAuth,
    requireRole(["admin", "finance"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const deleted = await storage.deleteExchangeRate(id);
        if (!deleted) {
          return res.status(404).json({ message: "Exchange rate not found" });
        }
        res.json({ message: "Exchange rate deleted" });
      } catch (error) {
        console.error("Delete exchange rate error:", error);
        res.status(500).json({ message: "Failed to delete exchange rate" });
      }
    },
  );

  app.get("/api/exchange-rates/lookup", requireAuth, async (req, res) => {
    try {
      const from = req.query.from as string;
      const to = (req.query.to as string) || "AED";
      if (!from) {
        return res.status(400).json({ message: "Missing 'from' parameter" });
      }
      const rate = await storage.getExchangeRateForCurrency(from, to);
      res.json({ fromCurrency: from, toCurrency: to, rate });
    } catch (error) {
      console.error("Lookup exchange rate error:", error);
      res.status(500).json({ message: "Failed to lookup exchange rate" });
    }
  });

  app.get(
    "/api/exchange-rates/available-currencies",
    requireAuth,
    async (req, res) => {
      try {
        const rates = await storage.getExchangeRates();
        const currencySet = new Set<string>(["AED"]);
        for (const rate of rates) {
          if (rate.isActive) {
            currencySet.add(rate.fromCurrency);
            currencySet.add(rate.toCurrency);
          }
        }
        const currencies = Array.from(currencySet).sort();
        res.json(currencies);
      } catch (error) {
        console.error("Get available currencies error:", error);
        res.status(500).json({ message: "Failed to get available currencies" });
      }
    },
  );

  // ==================== System Administration Endpoints ====================

  // System Health Check
  app.get(
    "/api/system/health",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const healthStart = Date.now();

        // Check database connectivity
        const dbCheck = await sqlRaw`SELECT 1 as check`;
        const dbLatency = Date.now() - healthStart;

        // Get table row counts
        const tableCounts = await sqlRaw`
        SELECT schemaname, relname as table_name, n_live_tup as row_count
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
      `;

        // Get database size
        const dbSize = await sqlRaw`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `;

        // Get total rows across all tables
        const totalRows = tableCounts.reduce(
          (sum: number, t: any) => sum + parseInt(t.row_count || "0"),
          0,
        );

        // Get index usage stats
        const indexStats = await sqlRaw`
        SELECT count(*) as total_indexes,
               sum(idx_scan) as total_index_scans
        FROM pg_stat_user_indexes
      `;

        // Get dead tuple count (rows needing vacuum)
        const deadTuples = await sqlRaw`
        SELECT sum(n_dead_tup) as total_dead_tuples
        FROM pg_stat_user_tables
      `;

        res.json({
          status: "healthy",
          database: {
            connected: true,
            latency: `${dbLatency}ms`,
            size: dbSize[0]?.size || "Unknown",
            totalTables: tableCounts.length,
            totalRows,
            totalIndexes: parseInt(indexStats[0]?.total_indexes || "0"),
            totalIndexScans: parseInt(indexStats[0]?.total_index_scans || "0"),
            deadTuples: parseInt(deadTuples[0]?.total_dead_tuples || "0"),
          },
          tables: tableCounts.map((t: any) => ({
            name: t.table_name,
            rows: parseInt(t.row_count || "0"),
          })),
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Health check error:", error);
        res
          .status(500)
          .json({ status: "unhealthy", error: "Database connection failed" });
      }
    },
  );

  // Optimize Database
  app.post(
    "/api/system/optimize",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const startTime = Date.now();

        // Get dead tuples before optimization
        const beforeStats = await sqlRaw`
        SELECT sum(n_dead_tup) as dead_tuples
        FROM pg_stat_user_tables
      `;

        // Run VACUUM ANALYZE on all tables
        await sqlRaw`VACUUM ANALYZE`;

        // Reindex all user tables
        const tables = await sqlRaw`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      `;

        let reindexedTables = 0;
        for (const table of tables) {
          try {
            await sqlRaw.unsafe(`REINDEX TABLE "${table.tablename}"`);
            reindexedTables++;
          } catch (e) {
            // Some tables may fail to reindex, skip them
          }
        }

        // Get dead tuples after optimization
        const afterStats = await sqlRaw`
        SELECT sum(n_dead_tup) as dead_tuples
        FROM pg_stat_user_tables
      `;

        const duration = Date.now() - startTime;

        res.json({
          success: true,
          duration: `${duration}ms`,
          details: {
            vacuumAnalyze: "Completed",
            tablesReindexed: reindexedTables,
            totalTables: tables.length,
            deadTuplesBefore: parseInt(beforeStats[0]?.dead_tuples || "0"),
            deadTuplesAfter: parseInt(afterStats[0]?.dead_tuples || "0"),
          },
        });
      } catch (error) {
        console.error("Optimize database error:", error);
        res
          .status(500)
          .json({ success: false, error: "Failed to optimize database" });
      }
    },
  );

  // Download System Backup (JSON)
  app.get(
    "/api/system/backup",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const tables = await sqlRaw`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
      `;

        const backup: Record<string, any[]> = {};
        for (const table of tables) {
          try {
            const rows = await sqlRaw.unsafe(
              `SELECT * FROM "${table.tablename}"`,
            );
            backup[table.tablename] = rows;
          } catch (e) {
            backup[table.tablename] = [];
          }
        }

        const backupData = JSON.stringify(
          {
            version: "1.0.0",
            exportDate: new Date().toISOString(),
            database: "aquanav_erp",
            tables: backup,
          },
          null,
          2,
        );

        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=aquanav_backup_${new Date().toISOString().split("T")[0]}.json`,
        );
        res.send(backupData);
      } catch (error) {
        console.error("Backup error:", error);
        res.status(500).json({ error: "Failed to generate backup" });
      }
    },
  );

  // Export All Data (CSV format in JSON wrapper)
  app.get(
    "/api/system/export",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const tables = await sqlRaw`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
      `;

        const exportData: Record<string, { headers: string[]; rows: any[][] }> =
          {};

        for (const table of tables) {
          try {
            const rows = await sqlRaw.unsafe(
              `SELECT * FROM "${table.tablename}"`,
            );
            if (rows.length > 0) {
              const headers = Object.keys(rows[0]);
              exportData[table.tablename] = {
                headers,
                rows: rows.map((row: any) =>
                  headers.map((h) => {
                    const val = row[h];
                    if (val === null || val === undefined) return "";
                    if (val instanceof Date) return val.toISOString();
                    if (typeof val === "object") return JSON.stringify(val);
                    return String(val);
                  }),
                ),
              };
            } else {
              exportData[table.tablename] = { headers: [], rows: [] };
            }
          } catch (e) {
            exportData[table.tablename] = { headers: [], rows: [] };
          }
        }

        // Build CSV content for each table
        const csvFiles: Record<string, string> = {};
        for (const [tableName, data] of Object.entries(exportData)) {
          if (data.headers.length === 0) continue;
          const escapeCsv = (val: string) => {
            if (val.includes(",") || val.includes('"') || val.includes("\n")) {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return val;
          };
          const headerLine = data.headers.map(escapeCsv).join(",");
          const dataLines = data.rows.map((row) =>
            row.map(escapeCsv).join(","),
          );
          csvFiles[tableName] = [headerLine, ...dataLines].join("\n");
        }

        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=aquanav_export_${new Date().toISOString().split("T")[0]}.json`,
        );
        res.json({
          version: "1.0.0",
          exportDate: new Date().toISOString(),
          format: "csv",
          tables: csvFiles,
        });
      } catch (error) {
        console.error("Export error:", error);
        res.status(500).json({ error: "Failed to export data" });
      }
    },
  );

  // Employee Projects route
  app.get(
    "/api/employees/:employeeId/projects",
    requireAuth,
    async (req, res) => {
      try {
        const employeeId = parseInt(req.params.employeeId);
        const assignments = await db
          .select({
            id: projectEmployees.id,
            projectId: projectEmployees.projectId,
            startDate: projectEmployees.startDate,
            endDate: projectEmployees.endDate,
            assignedAt: projectEmployees.assignedAt,
            projectTitle: projects.title,
            projectStatus: projects.status,
            vesselName: projects.vesselName,
          })
          .from(projectEmployees)
          .innerJoin(projects, eq(projects.id, projectEmployees.projectId))
          .where(eq(projectEmployees.employeeId, employeeId))
          .orderBy(desc(projectEmployees.assignedAt));
        res.json(assignments);
      } catch (error) {
        console.error("Error fetching employee projects:", error);
        res.status(500).json({ message: "Failed to fetch employee projects" });
      }
    },
  );

  // Employee Feedback routes
  app.get(
    "/api/employees/:employeeId/feedback",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const employeeId = parseInt(req.params.employeeId);
        const feedback = await storage.getEmployeeFeedback(employeeId);
        res.json(feedback);
      } catch (error) {
        console.error("Error fetching employee feedback:", error);
        res.status(500).json({ message: "Failed to fetch feedback" });
      }
    },
  );

  app.post(
    "/api/employees/:employeeId/feedback",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const employeeId = parseInt(req.params.employeeId);
        const { feedback, projectId } = req.body;
        if (!feedback || !feedback.trim()) {
          return res.status(400).json({ message: "Feedback text is required" });
        }
        const result = await storage.createEmployeeFeedback({
          employeeId,
          feedback: feedback.trim(),
          projectId: projectId || null,
          createdById: req.session.userId,
        });
        res.status(201).json(result);
      } catch (error) {
        console.error("Error creating employee feedback:", error);
        res.status(500).json({ message: "Failed to create feedback" });
      }
    },
  );

  app.put(
    "/api/employees/feedback/:id",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const existing = await storage.getEmployeeFeedbackById(id);
        if (!existing) {
          return res.status(404).json({ message: "Feedback not found" });
        }
        if (
          req.session.userRole === "project_manager" &&
          existing.createdById !== req.session.userId
        ) {
          return res
            .status(403)
            .json({ message: "You can only edit your own feedback" });
        }
        const { feedback, projectId } = req.body;
        if (!feedback || !feedback.trim()) {
          return res.status(400).json({ message: "Feedback text is required" });
        }
        const result = await storage.updateEmployeeFeedback(id, {
          feedback: feedback.trim(),
          projectId: projectId || null,
        });
        res.json(result);
      } catch (error) {
        console.error("Error updating employee feedback:", error);
        res.status(500).json({ message: "Failed to update feedback" });
      }
    },
  );

  app.delete(
    "/api/employees/feedback/:id",
    requireAuth,
    requireRole(["admin", "project_manager"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const existing = await storage.getEmployeeFeedbackById(id);
        if (!existing) {
          return res.status(404).json({ message: "Feedback not found" });
        }
        if (
          req.session.userRole === "project_manager" &&
          existing.createdById !== req.session.userId
        ) {
          return res
            .status(403)
            .json({ message: "You can only delete your own feedback" });
        }
        await storage.deleteEmployeeFeedback(id);
        res.json({ message: "Feedback deleted successfully" });
      } catch (error) {
        console.error("Error deleting employee feedback:", error);
        res.status(500).json({ message: "Failed to delete feedback" });
      }
    },
  );

  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Asset routes
  app.use(assetRoutes);

  const httpServer = createServer(app);
  return httpServer;
}
