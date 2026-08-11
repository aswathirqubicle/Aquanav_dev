import { Router } from "express";
import { generateProformaHTML } from "../documents/proforma-html";
import { generateQuotationHTML } from "../documents/quotation-html";
import {
  requireAuth,
  requireRole,
} from "../middleware/auth";
import { checkCustomerDocumentCurrency } from "../lib/document-currency";
import {
  addLineItemChanges,
  diffDocumentFields,
  documentRequiresEditNote,
  labelReferenceChanges,
  recordDocumentEdit,
} from "../lib/document-edit-history";
import { storage } from "../storage";

export const salesQuotationsRoutes = Router();

salesQuotationsRoutes.get(
  "/api/sales-quotations/:id/edit-history",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const history = await storage.getInvoiceEditHistory(
        "sales_quotation",
        id,
      );
      res.json(history);
    } catch (error) {
      console.error("Get sales quotation edit history error:", error);
      res.status(500).json({ message: "Failed to get edit history" });
    }
  },
);

// Sales Quotations routes
salesQuotationsRoutes.get(
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

salesQuotationsRoutes.post(
  "/api/sales-quotations",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const quotationData = { ...req.body };

      const currencyError = await checkCustomerDocumentCurrency(
        quotationData.customerId,
        quotationData.currency,
      );
      if (currencyError) {
        return res.status(400).json({ message: currencyError });
      }

      // A quotation being drafted gets a throwaway number, not a sequence one.
      // The permanent QTN-AQNV- number is drawn at approval, so a draft that is
      // deleted or never approved does not consume a serial and leave a hole in
      // the sequence. Mirrors createSalesInvoice.
      if (!quotationData.quotationNumber) {
        const timestamp = Date.now().toString().slice(-10);
        quotationData.quotationNumber = `QTN-DRFT-${timestamp}`;
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

// Reading one quotation by id. Added for Convert to Invoice: the invoice page
// is a separate route now, so it loads the quotation it was sent rather than
// finding it in a list it no longer holds. Same shape as the proforma
// equivalent below.
salesQuotationsRoutes.get(
  "/api/sales-quotations/:id",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const quotation = await storage.getSalesQuotation(id);

      if (!quotation) {
        return res.status(404).json({ message: "Sales quotation not found" });
      }

      res.json(quotation);
    } catch (error) {
      console.error("Error fetching sales quotation:", error);
      res.status(500).json({ message: "Failed to fetch sales quotation" });
    }
  },
);

salesQuotationsRoutes.put(
  "/api/sales-quotations/:id",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const quotationId = parseInt(req.params.id);
      const existingQuotation = await storage.getSalesQuotation(quotationId);
      if (!existingQuotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      const editableStatuses = [
        "draft",
        "pending_approval",
        "approved",
        "rejected",
      ];
      if (!editableStatuses.includes(existingQuotation.status)) {
        return res.status(400).json({
          message: "This quotation cannot be edited in its current status",
        });
      }

      // `status` is stripped from the payload: an approved or rejected
      // quotation is sent back to pending_approval below, and that transition is
      // the server's to decide — a client-supplied status must not override it.
      const { editNote, status: _status, ...quotationDataBody } = req.body;
      // An edit note and an edit-history entry are required once the quotation
      // has been through approval, either way: an approved quotation is a price
      // already put to the customer, and a rejected one carries a decision
      // someone needs to see was revisited. draft and pending_approval are still
      // being drafted, so they edit freely. Read from the PERSISTED row, never
      // req.body, so a client cannot claim draft status to skip the note.
      const requiresEditNote = documentRequiresEditNote(
        existingQuotation.status,
      );
      if (requiresEditNote && (!editNote || !editNote.trim())) {
        return res.status(400).json({
          message:
            "Edit note is required when updating an approved or rejected quotation",
        });
      }

      // Checked against the customer on the payload where one is supplied, so
      // that reassigning the quotation and setting the currency in one request
      // is judged on where it ends up, not where it started.
      const currencyError = await checkCustomerDocumentCurrency(
        quotationDataBody.customerId ?? existingQuotation.customerId,
        quotationDataBody.currency ?? existingQuotation.currency,
      );
      if (currencyError) {
        return res.status(400).json({ message: currencyError });
      }

      // Date fields should remain as ISO strings (YYYY-MM-DD format)
      // No conversion needed - Drizzle expects strings for timestamp({ mode: 'string' }) columns

      // Editing a quotation that has already been through approval puts it back
      // in the queue: the approval or rejection was made against a document that
      // no longer exists in that form, so it has to be decided again. The stale
      // trail goes with it — the details dialog renders "Approved By/Date"
      // whenever approvedAt is set and the rejection reason whenever it is set,
      // so leaving either behind would show a pending quotation carrying a
      // verdict that no longer applies. The editor becomes the submitter, since
      // the edit is what put it back in the queue.
      const revertsToPending = requiresEditNote;
      const quotationData = {
        ...quotationDataBody,
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

      const quotation = await storage.updateSalesQuotation(
        quotationId,
        quotationData,
      );

      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      // Diff against the PERSISTED row, not the client payload: the server
      // recomputes subtotal/discount/taxAmount/totalAmount and the per-line tax
      // (VAT on the discounted base) in applySalesDocumentTotals, so
      // quotationData holds pre-recompute values that were never stored.
      // Comparing stored to stored keeps edit history accurate — items
      // included, which is why they are diffed off the two rows as well.
      const changes = diffDocumentFields(existingQuotation, quotation, [
        "customerId",
        "subject",
        "status",
        "totalAmount",
        "subtotal",
        "taxAmount",
        "discountPercentage",
        "discount",
        "createdDate",
        "validUntil",
        "currency",
        "exchangeRate",
        "paymentTerms",
        "bankAccount",
        "billingAddress",
        "termsAndConditions",
        "remarks",
      ]);
      addLineItemChanges(changes, existingQuotation.items, quotation.items);
      await labelReferenceChanges(changes);

      // Only quotations that have been through approval get a history row — the
      // same set that requires the note. Pre-approval edits are the document
      // still being drafted, not changes to a decided record.
      if (requiresEditNote) {
        await recordDocumentEdit({
          invoiceType: "sales_quotation",
          invoiceId: quotationId,
          editNote,
          changes,
          userId: req.session.userId,
        });
      }

      res.json(quotation);
    } catch (error) {
      console.error("Sales quotation update error:", error);
      res.status(500).json({ message: "Failed to update sales quotation" });
    }
  },
);

salesQuotationsRoutes.patch(
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

salesQuotationsRoutes.patch(
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

salesQuotationsRoutes.patch(
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

// Withdrawing an approved quotation. The reason is mandatory for the same
// reason the rejection reason and the edit note are: a decision taken against
// an approved document has to be one someone can account for later. The status
// gate itself lives in storage.cancelSalesQuotation, which reads the persisted
// row — see the sales invoice cancel route, which is shaped the same way.
salesQuotationsRoutes.patch(
  "/api/sales-quotations/:id/cancel",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const cancellationReason = req.body?.cancellationReason;
      if (!cancellationReason || !String(cancellationReason).trim()) {
        return res
          .status(400)
          .json({ message: "A cancellation reason is required" });
      }

      const cancelled = await storage.cancelSalesQuotation(
        id,
        req.session.userId!,
        String(cancellationReason).trim(),
      );
      res.json({
        message: "Sales quotation cancelled successfully",
        quotation: cancelled,
      });
    } catch (error: any) {
      console.error("Cancel sales quotation error:", error);
      // Business-rule refusals (not found, wrong status) come back from storage
      // as thrown errors, the same way the sales invoice cancel route treats them.
      res
        .status(400)
        .json({ message: error?.message || "Failed to cancel sales quotation" });
    }
  },
);

salesQuotationsRoutes.get(
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

salesQuotationsRoutes.put(
  "/api/sales-quotations/:id/archive",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const quotationId = parseInt(req.params.id);
      const existing = await storage.getSalesQuotation(quotationId);
      if (!existing) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      // A converted quotation is the origin of a live invoice. Archiving hides
      // it from the default list, which would leave that invoice traceable back
      // to a document nobody can find. Every other status may be archived.
      // Read from the PERSISTED row, never req.body.
      if (existing.status === "converted") {
        return res.status(400).json({
          message:
            "A converted quotation cannot be archived — it is the origin of an invoice",
        });
      }

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

salesQuotationsRoutes.put(
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

// Proforma Invoices routes
salesQuotationsRoutes.get(
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

salesQuotationsRoutes.get(
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

salesQuotationsRoutes.post(
  "/api/proforma-invoices",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      console.log("Creating proforma invoice with data:", req.body);
      const proformaData = req.body;

      const currencyError = await checkCustomerDocumentCurrency(
        proformaData.customerId,
        proformaData.currency,
      );
      if (currencyError) {
        return res.status(400).json({ message: currencyError });
      }

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

salesQuotationsRoutes.put(
  "/api/proforma-invoices/:id",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log("Updating proforma invoice", id, "with data:", req.body);

      const existingProforma = await storage.getProformaInvoice(id);

      // If this is a status update to approved, add some validation
      if (req.body.status === "approved") {
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

      // Rejection is gated exactly as approval is — the two are the same
      // decision with opposite outcomes, so a proforma that cannot be approved
      // from its current status cannot be rejected from it either. The reason
      // is mandatory: a rejection nobody can explain is not reviewable.
      if (req.body.status === "rejected") {
        if (!existingProforma) {
          return res
            .status(404)
            .json({ message: "Proforma invoice not found" });
        }

        if (
          existingProforma.status !== "draft" &&
          existingProforma.status !== "sent"
        ) {
          return res.status(400).json({
            message: `Cannot reject proforma invoice from ${existingProforma.status} status`,
          });
        }

        if (
          !req.body.rejectionReason ||
          !String(req.body.rejectionReason).trim()
        ) {
          return res
            .status(400)
            .json({ message: "A reason is required to reject a proforma invoice" });
        }
      }

      // Checked against the customer on the payload where one is supplied, so
      // that reassigning the proforma and setting the currency in one request
      // is judged on where it ends up, not where it started. A proforma that no
      // longer exists is left to the 404 below.
      const currencyError = await checkCustomerDocumentCurrency(
        req.body.customerId ?? existingProforma?.customerId,
        req.body.currency ?? existingProforma?.currency,
      );
      if (currencyError) {
        return res.status(400).json({ message: currencyError });
      }

      // Stamp who approved and when, server-side. Taken from the session, not
      // the payload: a client-supplied approver is a claim, not a record.
      // Approval was previously stored as a bare status, leaving approvedById
      // and approvedAt null forever on every proforma ever approved.
      const proformaUpdate =
        req.body.status === "approved"
          ? {
              ...req.body,
              approvedById: req.session.userId ?? null,
              approvedAt: new Date(),
            }
          : req.body;

      const proformaInvoice = await storage.updateProformaInvoice(
        id,
        proformaUpdate,
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

salesQuotationsRoutes.post(
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

salesQuotationsRoutes.delete(
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

salesQuotationsRoutes.get(
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
