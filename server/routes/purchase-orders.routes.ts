import { Router } from "express";
import { generatePurchaseOrderHTML } from "../documents/purchase-order-html";
import {
  requireAuth,
  requireRole,
} from "../middleware/auth";
import { storage } from "../storage";
import { upload } from "../middleware/upload";

export const purchaseOrdersRoutes = Router();

purchaseOrdersRoutes.get(
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

// Purchase Orders routes
purchaseOrdersRoutes.get("/api/purchase-orders/stats", requireAuth, async (req, res) => {
  try {
    const stats = await storage.getPurchaseOrderStats();
    res.json(stats);
  } catch (error) {
    console.error("Get purchase order stats error:", error);
    res.status(500).json({ message: "Failed to get purchase order stats" });
  }
});

purchaseOrdersRoutes.get(
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

purchaseOrdersRoutes.get(
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

purchaseOrdersRoutes.post(
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

purchaseOrdersRoutes.put(
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

      // Fetch existing items BEFORE the update so the items diff sees the old set.
      const existingItems = await storage.getPurchaseOrderItems(id);

      const order = await storage.updatePurchaseOrder(id, orderData);
      if (!order) {
        return res.status(404).json({ message: "Purchase order not found" });
      }

      // Diff against the PERSISTED row, not the client payload: the server
      // recomputes subtotal/discountAmount/taxAmount/totalAmount (VAT on the
      // discounted base), so orderData holds pre-recompute values that were
      // never stored. Comparing to the stored row keeps edit history accurate.
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
        let newVal = (order as any)[field];

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
        } else if (String(oldVal || "") !== String(newVal || "")) {
          changes[field] = { old: oldVal, new: newVal };
        }
      }

      if (JSON.stringify(existingItems) !== JSON.stringify(orderItems)) {
        changes["items"] = {
          old: existingItems,
          new: orderItems,
        };
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

purchaseOrdersRoutes.delete(
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
purchaseOrdersRoutes.post(
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

purchaseOrdersRoutes.patch(
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

purchaseOrdersRoutes.patch(
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

purchaseOrdersRoutes.post(
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

purchaseOrdersRoutes.get(
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
