import { Router } from "express";
import path from "path";
import { employees } from "../../migrations/schema";
import {
  requireAuth,
  requireRole,
} from "../middleware/auth";
import { storage } from "../storage";
import { upload } from "../middleware/upload";

export const reimbursementsRoutes = Router();

// Reimbursement routes
reimbursementsRoutes.get("/api/reimbursements", requireAuth, async (req, res) => {
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

reimbursementsRoutes.get(
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

reimbursementsRoutes.get("/api/reimbursements/:id", requireAuth, async (req, res) => {
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

reimbursementsRoutes.post(
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

reimbursementsRoutes.put(
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

reimbursementsRoutes.put(
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

reimbursementsRoutes.put(
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

reimbursementsRoutes.delete("/api/reimbursements/:id", requireAuth, async (req, res) => {
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
