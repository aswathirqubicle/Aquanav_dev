import { Router } from "express";
import { generateProformaHTML } from "../documents/proforma-html";
import { generateQuotationHTML } from "../documents/quotation-html";
import {
  requireAuth,
  requireRole,
} from "../middleware/auth";
import { salesQuotations } from "@shared/schema";
import { storage } from "../storage";

export const salesQuotationsRoutes = Router();

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

      // Auto-generate quotation number if not provided
      if (!quotationData.quotationNumber) {
        quotationData.quotationNumber = await storage.generateNextNumber(
          "QTN",
          salesQuotations,
          salesQuotations.quotationNumber,
        );
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

salesQuotationsRoutes.put(
  "/api/sales-quotations/:id",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const quotationId = parseInt(req.params.id);
      const quotationData = req.body;

      // Date fields should remain as ISO strings (YYYY-MM-DD format)
      // No conversion needed - Drizzle expects strings for timestamp({ mode: 'string' }) columns

      const quotation = await storage.updateSalesQuotation(
        quotationId,
        quotationData,
      );

      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
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

salesQuotationsRoutes.post(
  "/api/sales-quotations/:id/approve",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const quotationId = parseInt(req.params.id);
      const quotation = await storage.updateSalesQuotation(quotationId, {
        status: "approved",
      });

      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      res.json(quotation);
    } catch (error) {
      console.error("Sales quotation approval error:", error);
      res.status(500).json({ message: "Failed to approve sales quotation" });
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

      // If this is a status update to approved, add some validation
      if (req.body.status === "approved") {
        const existingProforma = await storage.getProformaInvoice(id);
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

      const proformaInvoice = await storage.updateProformaInvoice(
        id,
        req.body,
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
