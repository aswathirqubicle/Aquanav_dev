import { Router } from "express";
import { db } from "../db";
import {
  inventoryItems,
  projects,
} from "../../migrations/schema";
import {
  requireAuth,
  requireRole,
} from "../middleware/auth";
import { salesInvoices } from "@shared/schema";
import { storage } from "../storage";
import { sum } from "drizzle-orm";

export const dashboardRoutes = Router();

// Dashboard routes
dashboardRoutes.get("/api/dashboard/stats", requireAuth, async (req, res) => {
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

dashboardRoutes.get(
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

dashboardRoutes.get(
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

dashboardRoutes.get(
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
