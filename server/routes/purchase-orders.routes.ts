import { Router } from "express";
import { generatePurchaseOrderHTML } from "../documents/purchase-order-html";
import {
  requireAuth,
  requireRole,
} from "../middleware/auth";
import { checkSupplierDocumentCurrency } from "../lib/document-currency";
import {
  addAttachmentChanges,
  addLineItemChanges,
  diffDocumentFields,
  documentRequiresEditNote,
  labelReferenceChanges,
  recordDocumentEdit,
} from "../lib/document-edit-history";
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

      const currencyError = await checkSupplierDocumentCurrency(
        orderData.supplierId,
        orderData.currency,
      );
      if (currencyError) {
        return res.status(400).json({ message: currencyError });
      }

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

      // `status` is stripped from the payload: an approved or rejected order is
      // sent back to pending_approval below, and that transition is the server's
      // to decide — a client-supplied status must not override it.
      const { editNote, status: _status, ...orderDataBody } = req.body;
      // An edit note and an edit-history entry are required once the order has
      // been through approval, either way: an approved order is a commitment
      // already made, and a rejected one carries a decision someone needs to see
      // was revisited. draft and pending_approval are still being drafted, so
      // they edit freely. Read from the PERSISTED row, never req.body, so a
      // client cannot claim draft status to skip the note.
      const requiresEditNote = documentRequiresEditNote(existingOrder.status);
      if (requiresEditNote && (!editNote || !editNote.trim())) {
        return res.status(400).json({
          message:
            "Edit note is required when updating an approved or rejected purchase order",
        });
      }

      // Checked against the supplier on the payload where one is supplied, so
      // that reassigning the order and setting the currency in one request is
      // judged on where it ends up, not where it started.
      const currencyError = await checkSupplierDocumentCurrency(
        orderDataBody.supplierId ?? existingOrder.supplierId,
        orderDataBody.currency ?? existingOrder.currency,
      );
      if (currencyError) {
        return res.status(400).json({ message: currencyError });
      }

      const orderItems = JSON.parse(req.body.items || "[]");
      // Editing an order that has already been through approval puts it back in
      // the queue: the approval or rejection was made against a document that no
      // longer exists in that form, so it has to be decided again. The stale
      // trail goes with it — the view dialog renders "Approved By/Date" whenever
      // approvedAt is set and the rejection reason whenever it is set, so
      // leaving either behind would show a pending order carrying a verdict that
      // no longer applies. The editor becomes the submitter, since the edit is
      // what put it back in the queue.
      const revertsToPending = requiresEditNote;
      const orderData = {
        ...orderDataBody,
        items: orderItems,
        existingFiles: req.body.existingFiles
          ? JSON.parse(req.body.existingFiles)
          : undefined,
        files: req.files,
        ...(revertsToPending
          ? {
              status: "pending_approval",
              approvedById: null,
              approvedAt: null,
              rejectionReason: null,
              submittedById: req.session.userId ?? null,
              submittedAt: new Date(),
            }
          : {}),
      };

      const order = await storage.updatePurchaseOrder(id, orderData);
      if (!order) {
        return res.status(404).json({ message: "Purchase order not found" });
      }

      // Diff against the PERSISTED row, not the client payload: the server
      // recomputes subtotal/discountAmount/taxAmount/totalAmount (VAT on the
      // discounted base), so orderData holds pre-recompute values that were
      // never stored. Comparing to the stored row keeps edit history accurate.
      //
      // Re-read the order rather than diffing the update's return value: items
      // are child rows that were deleted and reinserted, and files were written
      // to disk, so only a fresh read carries both in their persisted form.
      // Diffing the request payload here reported the line items as changed on
      // every single edit, because DB rows carry id/orderId/createdAt that the
      // payload objects never had.
      const persistedOrder = await storage.getPurchaseOrder(id);
      const changes = diffDocumentFields(existingOrder, persistedOrder, [
        "supplierId",
        "subject",
        "status",
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
        "deliverTo",
        "bankAccount",
        "notes",
        "termsAndConditions",
      ]);
      addLineItemChanges(
        changes,
        (existingOrder as any).items,
        (persistedOrder as any)?.items,
      );
      addAttachmentChanges(
        changes,
        (existingOrder as any).files,
        (persistedOrder as any)?.files,
      );
      await labelReferenceChanges(changes);

      // Only orders that have been through approval get a history row — the same
      // set that requires the note. Pre-approval edits are the document still
      // being drafted, not changes to a decided record.
      if (requiresEditNote) {
        await recordDocumentEdit({
          invoiceType: "purchase_order",
          invoiceId: id,
          editNote,
          changes,
          userId: req.session.userId,
        });
      }

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
      // Gates mirroring the purchase invoice reject. Without them this
      // accepted any id in any status, so an approved or already-converted
      // order could be rejected, and a blank reason was stored as null —
      // leaving the view with a rejected document it cannot explain. The
      // form already requires a reason; the server is the actual boundary.
      const existingOrder = await storage.getPurchaseOrder(id);
      if (!existingOrder) {
        return res.status(404).json({ message: "Purchase order not found" });
      }
      if (existingOrder.status !== "pending_approval") {
        return res
          .status(400)
          .json({ message: "Only pending orders can be rejected" });
      }

      const { reason } = req.body;
      if (!reason || !reason.trim()) {
        return res
          .status(400)
          .json({ message: "A rejection reason is required" });
      }

      const order = await storage.rejectPurchaseOrder(
        id,
        req.session.userId!,
        reason.trim(),
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
