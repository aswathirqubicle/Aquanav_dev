import { Router } from "express";
import fs from "fs";
import path from "path";
import { creditNotes } from "../../migrations/schema";
import { generatePurchaseInvoiceHTML } from "../documents/purchase-invoice-html";
import {
  requireAuth,
  requireRole,
} from "../middleware/auth";
import { checkSupplierDocumentCurrency } from "../lib/document-currency";
import { storage } from "../storage";
import { upload } from "../middleware/upload";

export const purchaseInvoicesRoutes = Router();

purchaseInvoicesRoutes.get(
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

// Purchase Invoices routes
purchaseInvoicesRoutes.get("/api/purchase-invoices/stats", requireAuth, async (req, res) => {
  try {
    const stats = await storage.getPurchaseStats();
    res.json(stats);
  } catch (error) {
    console.error("Get purchase stats error:", error);
    res.status(500).json({ message: "Failed to get purchase stats" });
  }
});

purchaseInvoicesRoutes.get(
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
      const paymentStatus = req.query.paymentStatus as string;
      // The client has always sent projectId and the storage layer has always
      // supported it, but this handler never read it — so the Project filter
      // silently did nothing.
      const projectId = req.query.projectId
        ? parseInt(req.query.projectId as string)
        : undefined;

      const result = await storage.getPurchaseInvoicesPaginated(page, limit, {
        startDate,
        endDate,
        supplierId,
        status,
        paymentStatus,
        projectId,
        search,
      });
      res.json(result);
    } catch (error) {
      console.error("Get purchase invoices error:", error);
      res.status(500).json({ message: "Failed to get purchase invoices" });
    }
  },
);

purchaseInvoicesRoutes.get(
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

purchaseInvoicesRoutes.post(
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

      const currencyError = await checkSupplierDocumentCurrency(
        invoiceData.supplierId,
        invoiceData.currency,
      );
      if (currencyError) {
        return res.status(400).json({ message: currencyError });
      }

      const invoice =
        await storage.createPurchaseInvoiceStandalone(invoiceData);
      res.status(201).json(invoice);
    } catch (error) {
      console.error("Create purchase invoice error:", error);
      res.status(500).json({ message: "Failed to create purchase invoice" });
    }
  },
);

purchaseInvoicesRoutes.put(
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
      // Editable statuses are approval-lifecycle values. partially-paid / paid
      // live in paymentStatus, not status, so they were never valid here; the
      // paidAmount guard below is what actually blocks edits after payment.
      const editableStatuses = ["draft", "pending_approval", "approved"];
      if (!editableStatuses.includes(existingInvoice.status)) {
        return res.status(400).json({
          message: "This invoice cannot be edited in its current status",
        });
      }
      // Once any payment (or credit note) is recorded, the invoice is locked
      // from edits — mirrors the sales side.
      if (parseFloat(existingInvoice.paidAmount || "0") > 0) {
        return res.status(400).json({
          message:
            "This invoice has recorded payments and can no longer be edited",
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
      // An edit note and an edit-history entry are required only once the
      // invoice has been approved and its ledger entries exist. draft and
      // pending_approval are still pre-ledger, so they edit freely. Read from
      // the PERSISTED row, never req.body, so a client cannot claim draft
      // status to skip the note. Kept separate from isApprovedEdit below,
      // which drives GL posting and must keep its existing meaning.
      const requiresEditNote = existingInvoice.status === "approved";
      if (requiresEditNote && (!editNote || !editNote.trim())) {
        return res.status(400).json({
          message: "Edit note is required when updating an approved invoice",
        });
      }

      // Checked against the supplier on the payload where one is supplied, so
      // that reassigning the invoice and setting the currency in one request is
      // judged on where it ends up, not where it started.
      const currencyError = await checkSupplierDocumentCurrency(
        invoiceData.supplierId ?? existingInvoice.supplierId,
        invoiceData.currency ?? existingInvoice.currency,
      );
      if (currencyError) {
        return res.status(400).json({ message: currencyError });
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

      // Diff against the PERSISTED row, not the client payload: the server
      // recomputes subtotal/discountAmount/taxAmount/totalAmount (VAT on the
      // discounted base), so req.body holds pre-recompute values that were
      // never stored. Comparing to the stored row keeps edit history accurate.
      const changes: Record<string, { old: any; new: any }> = {};
      const fieldsToTrack = [
        "supplierId",
        "subject",
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
        "termsAndConditions",
        "paymentTerms",
        "bankAccount",
      ];
      for (const field of fieldsToTrack) {
        const oldVal = (existingInvoice as any)[field];
        const newVal = (invoice as any)[field];
        if (String(oldVal || "") !== String(newVal || "")) {
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

      if (existingInvoice.status !== "draft") {
        // GL is posted on approval. An invoice still awaiting approval has no
        // posting to reverse, so re-posting here would create ledger entries for
        // an unapproved document — and approval would then post the same split a
        // second time, silently doubling expense, input VAT and payable (the
        // doubled set still balances, so no ΣDr=ΣCr check catches it). Only an
        // already-approved invoice gets the reverse-and-re-post.
        if (existingInvoice.status !== "pending_approval") {
          await storage.updatePurchaseInvoiceGLEntries(id);
        }

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

      // Only approved invoices get a history row. Pre-approval edits are the
      // document still being drafted, not changes to an approved record.
      if (requiresEditNote) {
        const user = await storage.getUser(req.session.userId!);
        await storage.createInvoiceEditHistory({
          invoiceType: "purchase",
          invoiceId: id,
          editNote: editNote.trim(),
          changes: Object.keys(changes).length > 0 ? changes : null,
          editedBy: req.session.userId || null,
          editedByName: user?.username || null,
        });
      }

      res.json(invoice);
    } catch (error: any) {
      console.error("Update purchase invoice error:", error);
      res.status(400).json({
        message: error.message || "Failed to update purchase invoice",
      });
    }
  },
);

purchaseInvoicesRoutes.get(
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

purchaseInvoicesRoutes.patch(
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

purchaseInvoicesRoutes.patch(
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

purchaseInvoicesRoutes.patch(
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

      // A blank reason was stored as null, leaving the view with a rejected
      // document it cannot explain. The form already requires one; the server
      // is the actual boundary.
      const { reason } = req.body;
      if (!reason || !reason.trim()) {
        return res
          .status(400)
          .json({ message: "A rejection reason is required" });
      }

      const updated = await storage.rejectPurchaseInvoice(
        id,
        req.session.userId!,
        reason.trim(),
      );
      res.json({ message: "Purchase invoice rejected", invoice: updated });
    } catch (error) {
      console.error("Reject purchase invoice error:", error);
      res.status(500).json({ message: "Failed to reject purchase invoice" });
    }
  },
);

purchaseInvoicesRoutes.post(
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

purchaseInvoicesRoutes.post(
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

purchaseInvoicesRoutes.get(
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

purchaseInvoicesRoutes.get(
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

// Purchase Credit Notes routes
purchaseInvoicesRoutes.get(
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

purchaseInvoicesRoutes.get(
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

purchaseInvoicesRoutes.post(
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

purchaseInvoicesRoutes.put(
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

purchaseInvoicesRoutes.delete(
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

purchaseInvoicesRoutes.get(
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
