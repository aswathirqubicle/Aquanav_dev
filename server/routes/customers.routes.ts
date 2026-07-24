import { Router } from "express";
import { ZodError } from "zod";
import {
  insertCustomerDocumentSchema,
  insertCustomerSchema,
} from "@shared/schema";
import {
  requireAuth,
  requireRole,
} from "../middleware/auth";
import { storage } from "../storage";
import { upload } from "../middleware/upload";

export const customersRoutes = Router();

// Customer routes
customersRoutes.get("/api/customers", requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";
    const showArchived = req.query.showArchived === "true";

    const result = await storage.getCustomersPaginated(
      page,
      limit,
      search,
      showArchived,
    );
    res.json(result);
  } catch (error) {
    console.error("Get customers error:", error);
    res.status(500).json({ message: "Failed to get customers" });
  }
});

customersRoutes.get("/api/customers/all", requireAuth, async (req, res) => {
  try {
    const allCustomers = await storage.getCustomers();
    res.json(allCustomers);
  } catch (error) {
    console.error("Get all customers error:", error);
    res.status(500).json({ message: "Failed to get all customers" });
  }
});

customersRoutes.get("/api/customers/stats", requireAuth, async (req, res) => {
  try {
    const stats = await storage.getCustomerStats();
    res.json(stats);
  } catch (error) {
    console.error("Get customer stats error:", error);
    res.status(500).json({ message: "Failed to get customer stats" });
  }
});

customersRoutes.post(
  "/api/customers",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const customerData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(customerData);
      res.status(201).json(customer);
    } catch (error) {
      if (error instanceof ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid data", errors: error.errors });
      }
      if (error instanceof Error && error.message) {
        return res.status(500).json({
          message: error.message,
        });
      }
      res.status(500).json({ message: "Failed to create customer" });
    }
  },
);

customersRoutes.put(
  "/api/customers/:id",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const customerData = req.body;
      const customer = await storage.updateCustomer(id, customerData);

      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      res.json(customer);
    } catch (error: any) {
      if (error.message?.includes("already exists")) {
        return res.status(409).json({
          message: error.message,
        });
      }
      res.status(500).json({ message: "Failed to update customer" });
    }
  },
);

customersRoutes.put(
  "/api/customers/:id/archive",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const customer = await storage.updateCustomer(id, { isArchived: true });

      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      res.json({ message: "Customer archived successfully", customer });
    } catch (error) {
      res.status(500).json({ message: "Failed to archive customer" });
    }
  },
);

customersRoutes.put(
  "/api/customers/:id/unarchive",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const customer = await storage.updateCustomer(id, {
        isArchived: false,
      });

      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      res.json({ message: "Customer unarchived successfully", customer });
    } catch (error) {
      res.status(500).json({ message: "Failed to unarchive customer" });
    }
  },
);

// Customer Documents routes
customersRoutes.get("/api/customers/:id/documents", requireAuth, async (req, res) => {
  try {
    const customerId = parseInt(req.params.id);
    const documents = await storage.getCustomerDocuments(customerId);
    res.json(documents);
  } catch (error) {
    console.error("Error getting customer documents:", error);
    res.status(500).json({ message: "Failed to get customer documents" });
  }
});

customersRoutes.post(
  "/api/customers/:id/documents",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  upload.single("file"),
  async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      const documentData = { ...req.body, customerId };

      // Handle file upload
      if (req.file) {
        documentData.filePath = req.file.path;
        documentData.fileName = req.file.originalname;
        documentData.fileSize = req.file.size;
      }

      // Convert date strings to Date objects
      if (
        documentData.dateOfIssue &&
        typeof documentData.dateOfIssue === "string"
      ) {
        documentData.dateOfIssue = new Date(
          documentData.dateOfIssue,
        ).toISOString();
      }
      if (
        documentData.expiryDate &&
        typeof documentData.expiryDate === "string"
      ) {
        documentData.expiryDate = new Date(
          documentData.expiryDate,
        ).toISOString();
      }

      const parsedData = insertCustomerDocumentSchema.parse(documentData);
      const result = await storage.createCustomerDocument(parsedData);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating customer document:", error);
      if (error instanceof ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create customer document" });
    }
  },
);

customersRoutes.put(
  "/api/customers/:customerId/documents/:documentId",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  upload.single("file"),
  async (req, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      const documentData = { ...req.body };

      // Handle file upload
      if (req.file) {
        documentData.filePath = req.file.path;
        documentData.fileName = req.file.originalname;
        documentData.fileSize = req.file.size;
      }

      // Convert date strings to Date objects
      if (
        documentData.dateOfIssue &&
        typeof documentData.dateOfIssue === "string"
      ) {
        documentData.dateOfIssue = new Date(
          documentData.dateOfIssue,
        ).toISOString();
      }
      if (
        documentData.expiryDate &&
        typeof documentData.expiryDate === "string"
      ) {
        documentData.expiryDate = new Date(
          documentData.expiryDate,
        ).toISOString();
      }

      const result = await storage.updateCustomerDocument(
        documentId,
        documentData,
      );
      if (!result) {
        return res.status(404).json({ message: "Document not found" });
      }
      res.json(result);
    } catch (error) {
      console.error("Error updating customer document:", error);
      res.status(500).json({ message: "Failed to update customer document" });
    }
  },
);

customersRoutes.delete(
  "/api/customers/:customerId/documents/:documentId",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      const success = await storage.deleteCustomerDocument(documentId);
      if (!success) {
        return res.status(404).json({ message: "Document not found" });
      }
      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Error deleting customer document:", error);
      res.status(500).json({ message: "Failed to delete customer document" });
    }
  },
);
