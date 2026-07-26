import { Router } from "express";
import fs from "fs";
import path from "path";
import { creditNotes } from "../../migrations/schema";
import { generateCreditNoteHTML } from "../documents/credit-note-html";
import { generateInvoiceHTML } from "../documents/invoice-html";
import {
  requireAuth,
  requireRole,
} from "../middleware/auth";
import { salesInvoices } from "@shared/schema";
import { storage } from "../storage";
import { upload } from "../middleware/upload";

export const salesInvoicesRoutes = Router();

salesInvoicesRoutes.post(
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

      // Consolidated approval (L13/G3): record the approver, land on "approved",
      // generate the permanent number and post the GL — the same path the PATCH
      // approve endpoint uses, so both behave identically. Payment status
      // (partially_paid / paid / overdue) is derived later by the payment flow,
      // not conflated with approval.
      await storage.approveSalesInvoice(invoiceId, req.session.userId!);

      const updatedInvoice = await storage.getSalesInvoice(invoiceId);
      res.json(updatedInvoice);
    } catch (error) {
      console.error("Sales invoice approval error:", error);
      res.status(500).json({ message: "Failed to approve sales invoice" });
    }
  },
);

salesInvoicesRoutes.get(
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

salesInvoicesRoutes.put(
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
      // Editable only in the pre-payment part of the lifecycle. partially_paid /
      // paid are excluded because a payment has been recorded (see the
      // paidAmount guard below); cancelled / rejected are terminal.
      const editableStatuses = [
        "draft",
        "pending_approval",
        "approved",
        "unpaid",
        "overdue",
      ];
      if (!editableStatuses.includes(existingInvoice.status)) {
        return res.status(400).json({
          message: "This invoice cannot be edited in its current status",
        });
      }
      // Known bug fix: once ANY payment is recorded against the invoice it must
      // not be editable. Status alone isn't enough (an overdue invoice can carry
      // a partial payment), so gate on the recorded amount.
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
        paidAmount: _paidAmount,
        ...invoiceData
      } = req.body;
      if (!editNote || !editNote.trim()) {
        return res.status(400).json({
          message: "Edit note is required when updating an invoice",
        });
      }

      const invoice = await storage.updateSalesInvoice(
        invoiceId,
        invoiceData,
      );

      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Diff against the PERSISTED row, not the client payload: the server
      // recomputes subtotal/discount/taxAmount/totalAmount (VAT on the
      // discounted base), so req.body holds pre-recompute values that were
      // never stored. Comparing to the stored row keeps edit history accurate.
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
        const newVal = (invoice as any)[field];
        if (String(oldVal || "") !== String(newVal || "")) {
          changes[field] = { old: oldVal, new: newVal };
        }
      }
      if (
        JSON.stringify(existingInvoice.items) !==
        JSON.stringify(invoice.items)
      ) {
        changes["items"] = {
          old: existingInvoice.items,
          new: invoice.items,
        };
      }

      if (existingInvoice.status !== "draft") {
        // GL is posted on approval. An invoice still awaiting approval has no
        // posting to reverse, so re-posting here would create ledger entries for
        // an unapproved document — and approval would then post the same split a
        // second time, silently doubling revenue, output VAT and receivables (the
        // doubled set still balances, so no ΣDr=ΣCr check catches it). Only an
        // already-approved invoice gets the reverse-and-re-post.
        if (existingInvoice.status !== "pending_approval") {
          await storage.updateSalesInvoiceGLEntries(invoiceId);
        }

        const paidAmount = parseFloat(invoice.paidAmount || "0");
        const newTotal = parseFloat(invoice.totalAmount || "0");
        let newStatus = existingInvoice.status;
        if (paidAmount > 0 && newTotal > 0) {
          if (paidAmount >= newTotal) {
            newStatus = "paid";
          } else {
            newStatus = "partially_paid";
          }
        } else if (
          paidAmount === 0 &&
          (existingInvoice.status === "paid" ||
            existingInvoice.status === "partially_paid")
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

salesInvoicesRoutes.get(
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

salesInvoicesRoutes.patch("/api/sales-invoices/:id/submit", requireAuth, async (req, res) => {
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

salesInvoicesRoutes.patch(
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

salesInvoicesRoutes.patch(
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

salesInvoicesRoutes.patch(
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
salesInvoicesRoutes.get(
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

salesInvoicesRoutes.post(
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
salesInvoicesRoutes.get(
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

salesInvoicesRoutes.post(
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

salesInvoicesRoutes.get(
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

salesInvoicesRoutes.delete(
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

// Credit Notes routes
salesInvoicesRoutes.get(
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

salesInvoicesRoutes.get(
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

salesInvoicesRoutes.post(
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
    } catch (error: any) {
      console.error("Error creating credit note:", error);
      // Pass the reason through, as the cancel and delete routes below do.
      // Refusals here are business rules — an unlinked invoice, for one — and a
      // bare "Failed to create credit note" leaves the user with no idea what
      // to change.
      res.status(400).json({
        message: error?.message || "Failed to create credit note",
      });
    }
  },
);

salesInvoicesRoutes.put(
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
    } catch (error: any) {
      console.error("Error updating credit note:", error);
      res.status(400).json({
        message: error?.message || "Failed to update credit note",
      });
    }
  },
);

// Cancel an issued credit note: reverses its ledger entries, removes the
// settlement row so the invoice's paid amount and status self-correct, and
// leaves the note on record as cancelled.
salesInvoicesRoutes.post(
  "/api/credit-notes/:id/cancel",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const cancelled = await storage.cancelCreditNote(id, req.session.userId);
      res.json(cancelled);
    } catch (error: any) {
      console.error("Error cancelling credit note:", error);
      // These are business-rule refusals (already cancelled, not issued, or
      // worth more than the outstanding balance), not server faults.
      res.status(400).json({
        message: error?.message || "Failed to cancel credit note",
      });
    }
  },
);

// Deleting is now only for drafts — storage refuses anything issued.
salesInvoicesRoutes.delete(
  "/api/credit-notes/:id",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCreditNote(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting credit note:", error);
      res.status(400).json({
        message: error?.message || "Failed to delete credit note",
      });
    }
  },
);

salesInvoicesRoutes.get(
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

salesInvoicesRoutes.get(
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

salesInvoicesRoutes.get(
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
