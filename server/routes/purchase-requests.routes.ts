import { Router } from "express";
import {
  requireAuth,
  requireRole,
} from "../middleware/auth";
import { storage } from "../storage";

export const purchaseRequestsRoutes = Router();

// Purchase Requests routes
purchaseRequestsRoutes.get("/api/purchase-requests/stats", requireAuth, async (req, res) => {
  try {
    const stats = await storage.getPurchaseRequestStats();
    res.json(stats);
  } catch (error) {
    console.error("Get purchase request stats error:", error);
    res.status(500).json({ message: "Failed to get purchase request stats" });
  }
});

purchaseRequestsRoutes.get("/api/purchase-requests", requireAuth, async (req, res) => {
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

purchaseRequestsRoutes.get("/api/purchase-requests/:id", requireAuth, async (req, res) => {
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

purchaseRequestsRoutes.post("/api/purchase-requests", requireAuth, async (req, res) => {
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

purchaseRequestsRoutes.put(
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

purchaseRequestsRoutes.put(
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

purchaseRequestsRoutes.delete("/api/purchase-requests/:id", requireAuth, async (req, res) => {
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
