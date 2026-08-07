import { Router } from "express";
import {
  requireAuth,
  requireRole,
} from "../middleware/auth";
import { storage } from "../storage";

export const errorLogsRoutes = Router();

// Error Logs routes
errorLogsRoutes.get("/api/error-logs", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const severity = req.query.severity as string;
    const resolved = req.query.resolved as string;
    const userId = parseInt(req.query.userId as string);

    const result = await storage.getErrorLogs(
      page,
      limit,
      severity,
      resolved === "true" ? true : resolved === "false" ? false : undefined,
      isNaN(userId) ? undefined : userId,
    );

    res.json(result);
  } catch (error) {
    console.error("Error fetching error logs:", error);
    res.status(500).json({ message: "Failed to fetch error logs" });
  }
});

errorLogsRoutes.post("/api/error-logs", async (req, res) => {
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

errorLogsRoutes.put(
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

errorLogsRoutes.delete(
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

errorLogsRoutes.delete(
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
