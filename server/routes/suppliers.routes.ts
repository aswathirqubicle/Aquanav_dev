import { Router } from "express";
import { ZodError } from "zod";
import {
  insertSupplierDocumentSchema,
  insertSupplierSchema,
} from "@shared/schema";
import {
  requireAuth,
  requireRole,
} from "../middleware/auth";
import { storage } from "../storage";
import { upload } from "../middleware/upload";

export const suppliersRoutes = Router();

// Supplier routes
suppliersRoutes.get("/api/suppliers", requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";
    const showArchived = req.query.showArchived === "true";

    const result = await storage.getSuppliersPaginated(
      page,
      limit,
      search,
      showArchived,
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to get suppliers" });
  }
});

suppliersRoutes.get("/api/suppliers/all", requireAuth, async (req, res) => {
  try {
    const result = await storage.getSuppliers();
    res.json({ data: result });
  } catch (error) {
    res.status(500).json({ message: "Failed to get all suppliers" });
  }
});

suppliersRoutes.get("/api/suppliers/stats", requireAuth, async (req, res) => {
  try {
    const stats = await storage.getSupplierStats();
    res.json(stats);
  } catch (error) {
    console.error("Get supplier stats error:", error);
    res.status(500).json({ message: "Failed to get supplier stats" });
  }
});

suppliersRoutes.post(
  "/api/suppliers",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const supplierData = insertSupplierSchema.parse(req.body);
      const supplier = await storage.createSupplier(supplierData);
      console.log("5=>", supplier);
      res.status(201).json(supplier);
    } catch (error) {
      if (error instanceof ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create supplier" });
    }
  },
);

suppliersRoutes.put(
  "/api/suppliers/:id",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const supplierData = req.body;
      const supplier = await storage.updateSupplier(id, supplierData);

      if (!supplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }

      res.json(supplier);
    } catch (error) {
      res.status(500).json({ message: "Failed to update supplier" });
    }
  },
);

suppliersRoutes.delete(
  "/api/suppliers/:id",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteSupplier(id);
      if (!deleted) {
        return res.status(404).json({ message: "Supplier not found" });
      }
      res.json({ message: "Supplier deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete supplier" });
    }
  },
);

// Supplier-specific routes
suppliersRoutes.get("/api/suppliers/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const supplier = await storage.getSupplier(id);
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ message: "Failed to get supplier" });
  }
});

suppliersRoutes.get("/api/suppliers/:id/products", requireAuth, async (req, res) => {
  try {
    const supplierId = parseInt(req.params.id);
    // For now, return inventory items that could be supplied by this supplier
    // In a real application, you'd have a supplier-product relationship table
    const products = await storage.getInventoryItems();
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Failed to get supplier products" });
  }
});

// Get supplier inventory items
suppliersRoutes.get("/api/suppliers/:id/suppliers", async (req, res) => {
  try {
    const supplierId = parseInt(req.params.id);
    const supplierItems =
      await storage.getSupplierInventoryItemsBySupplierId(supplierId);
    res.json(supplierItems);
  } catch (error) {
    console.error("Error fetching supplier inventory items:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch supplier inventory items" });
  }
});

// Get products for a specific supplier
suppliersRoutes.get("/api/suppliers/:id/products", async (req, res) => {
  try {
    const supplierId = parseInt(req.params.id);
    const products = await storage.getProductsBySupplier(supplierId);
    res.json(products);
  } catch (error) {
    console.error("Error fetching supplier products:", error);
    res.status(500).json({ message: "Failed to fetch supplier products" });
  }
});

suppliersRoutes.put(
  "/api/suppliers/:id/archive",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const supplier = await storage.updateSupplier(id, { isArchived: true });

      if (!supplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }

      res.json({ message: "Supplier archived successfully", supplier });
    } catch (error) {
      res.status(500).json({ message: "Failed to archive supplier" });
    }
  },
);

suppliersRoutes.put(
  "/api/suppliers/:id/unarchive",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const supplier = await storage.updateSupplier(id, {
        isArchived: false,
      });

      if (!supplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }

      res.json({ message: "Supplier unarchived successfully", supplier });
    } catch (error) {
      console.error("Supplier unarchive error:", error);
      res.status(500).json({ message: "Failed to unarchive supplier" });
    }
  },
);

// Supplier Documents routes
suppliersRoutes.get("/api/suppliers/:id/documents", requireAuth, async (req, res) => {
  try {
    const supplierId = parseInt(req.params.id);
    const documents = await storage.getSupplierDocuments(supplierId);
    res.json(documents);
  } catch (error) {
    console.error("Error getting supplier documents:", error);
    res.status(500).json({ message: "Failed to get supplier documents" });
  }
});

suppliersRoutes.post(
  "/api/suppliers/:id/documents",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  upload.single("file"),
  async (req, res) => {
    try {
      const supplierId = parseInt(req.params.id);
      const documentData = { ...req.body, supplierId };

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
        documentData.dateOfIssue = new Date(documentData.dateOfIssue);
      }
      if (
        documentData.expiryDate &&
        typeof documentData.expiryDate === "string"
      ) {
        documentData.expiryDate = new Date(documentData.expiryDate);
      }

      const parsedData = insertSupplierDocumentSchema.parse(documentData);
      const result = await storage.createSupplierDocument(parsedData);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating supplier document:", error);
      if (error instanceof ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create supplier document" });
    }
  },
);

suppliersRoutes.put(
  "/api/suppliers/:supplierId/documents/:documentId",
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
        documentData.dateOfIssue = new Date(documentData.dateOfIssue);
      }
      if (
        documentData.expiryDate &&
        typeof documentData.expiryDate === "string"
      ) {
        documentData.expiryDate = new Date(documentData.expiryDate);
      }

      const result = await storage.updateSupplierDocument(
        documentId,
        documentData,
      );
      if (!result) {
        return res.status(404).json({ message: "Document not found" });
      }
      res.json(result);
    } catch (error) {
      console.error("Error updating supplier document:", error);
      res.status(500).json({ message: "Failed to update supplier document" });
    }
  },
);

suppliersRoutes.delete(
  "/api/suppliers/:supplierId/documents/:documentId",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      const success = await storage.deleteSupplierDocument(documentId);
      if (!success) {
        return res.status(404).json({ message: "Document not found" });
      }
      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Error deleting supplier document:", error);
      res.status(500).json({ message: "Failed to delete supplier document" });
    }
  },
);
