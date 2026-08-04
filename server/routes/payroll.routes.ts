import { Router } from "express";
import {
  requireAuth,
  requireRole,
} from "../middleware/auth";
import { storage } from "../storage";

export const payrollRoutes = Router();

payrollRoutes.get("/api/my-payslips", requireAuth, async (req, res) => {
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

payrollRoutes.get("/api/my-payslips/:id/additions", requireAuth, async (req, res) => {
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

payrollRoutes.get("/api/my-payslips/:id/deductions", requireAuth, async (req, res) => {
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

// Per-employee Provident Fund balances from the ledger (D14). Registered before
// the "/api/payroll/:id" routes so the literal path is not captured by ":id".
payrollRoutes.get(
  "/api/payroll/pf-balances",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const balances = await storage.getProvidentFundBalances();
      res.json(balances);
    } catch (error) {
      console.error("Get PF balances error:", error);
      res
        .status(500)
        .json({ message: "Failed to get provident fund balances" });
    }
  },
);

// Payroll routes
payrollRoutes.get(
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

payrollRoutes.post(
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

payrollRoutes.delete(
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

      const result = await storage.clearPayrollPeriod(
        month,
        year,
        req.session.userId,
      );
      res.json(result);
    } catch (error) {
      console.error("Clear payroll period error:", error);
      res
        .status(500)
        .json({ message: error.message || "Failed to clear payroll period" });
    }
  },
);

payrollRoutes.put(
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

      // Update the payroll entry (accrual/payment GL posts here on the status
      // transition, attributed to the acting user).
      const entry = await storage.updatePayrollEntry(
        payrollId,
        updateData,
        req.session.userId,
      );
      if (!entry) {
        return res.status(404).json({ message: "Payroll entry not found" });
      }

      // GL entries are now handled in the storage layer's updatePayrollEntry method

      res.json(entry);
    } catch (error: any) {
      console.error("Update payroll entry error:", error);
      // Surface the storage message rather than a flat "failed". The GL
      // pre-flight refuses the status change when an account it must post to is
      // missing from the chart, and that reason is the whole value of the
      // refusal — swallowed, the user sees an unexplained failure and the books
      // stay wrong.
      res.status(500).json({
        message: error?.message || "Failed to update payroll entry",
      });
    }
  },
);

payrollRoutes.get(
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

payrollRoutes.post(
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

payrollRoutes.get(
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

payrollRoutes.post(
  "/api/payroll/:id/deductions",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const payrollId = parseInt(req.params.id);
      const deductionData = { ...req.body, payrollEntryId: payrollId };

      const deduction = await storage.createPayrollDeduction(deductionData);
      res.status(201).json(deduction);
    } catch (error: any) {
      if (error?.code === "PF_PROTECTED") {
        return res.status(400).json({ message: error.message });
      }
      console.error("Create payroll deduction error:", error);
      res.status(500).json({ message: "Failed to create payroll deduction" });
    }
  },
);

// Payroll routes
payrollRoutes.get(
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

payrollRoutes.post(
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

payrollRoutes.put(
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

payrollRoutes.delete(
  "/api/payroll/clear-all",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const deletedCount = await storage.clearAllPayrollEntries(
        req.session.userId,
      );
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

payrollRoutes.delete(
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
payrollRoutes.get(
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

payrollRoutes.post(
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

payrollRoutes.put(
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

payrollRoutes.delete(
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
payrollRoutes.get(
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

payrollRoutes.post(
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

payrollRoutes.put(
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
    } catch (error: any) {
      if (error?.code === "PF_PROTECTED") {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to update payroll deduction" });
    }
  },
);

payrollRoutes.delete(
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
    } catch (error: any) {
      if (error?.code === "PF_PROTECTED") {
        return res.status(400).json({ message: error.message });
      }
      console.error("Delete payroll deduction error:", error);
      res.status(500).json({
        message: "Failed to delete payroll deduction",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);
