import { Router } from "express";
import { ZodError } from "zod";
import { insertInventoryItemSchema } from "@shared/schema";
import {
  requireAuth,
  requireRole,
} from "../middleware/auth";
import { storage } from "../storage";

export const inventoryRoutes = Router();

// Inventory routes
inventoryRoutes.get("/api/inventory", requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";
    const category = (req.query.category as string) || "";
    const lowStock = req.query.lowStock === "true";

    const result = await storage.getInventoryItemsPaginated(
      page,
      limit,
      search,
      category,
      lowStock,
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to get inventory items" });
  }
});

inventoryRoutes.post(
  "/api/inventory",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const { initialQuantity, unitPrice, ...itemData } =
        insertInventoryItemSchema.parse(req.body);
      const item = await storage.createInventoryItem({
        ...itemData,
        currentStock: initialQuantity || 0,
        avgCost: unitPrice?.toString() || "0",
      });
      res.status(201).json(item);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid data", errors: error.errors });
      }
      if (error.code === "23505") {
        return res.status(409).json({
          message: "SKU already exists. Please use a unique SKU",
        });
      }
      res.status(500).json({ message: "Failed to create inventory item" });
    }
  },
);

inventoryRoutes.put(
  "/api/inventory/:id",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const itemData = req.body;
      const item = await storage.updateInventoryItem(id, itemData);

      if (!item) {
        return res.status(404).json({ message: "Inventory item not found" });
      }

      res.json(item);
    } catch (error: any) {
      if (error.code === "23505") {
        return res
          .status(409)
          .json({
            message: "SKU already exists. Please use a unique SKU",
          });
      }
      res.status(500).json({ message: "Failed to update inventory item" });
    }
  },
);

// Goods Receipt routes
inventoryRoutes.get(
  "/api/goods-receipt",
  requireAuth,
  requireRole(["admin", "project_manager", "finance"]),
  async (req, res) => {
    try {
      const receipts = await storage.getGoodsReceipts();
      res.json(receipts);
    } catch (error) {
      console.error("Get goods receipts error:", error);
      res.status(500).json({ message: "Failed to get goods receipts" });
    }
  },
);

inventoryRoutes.post(
  "/api/goods-receipt",
  requireAuth,
  requireRole(["admin", "project_manager", "finance"]),
  async (req, res) => {
    try {
      const { reference, items } = req.body;

      console.log("Goods receipt request:", {
        reference,
        items,
        userId: req.session.userId,
      });

      if (
        !reference ||
        !items ||
        !Array.isArray(items) ||
        items.length === 0
      ) {
        return res
          .status(400)
          .json({ message: "Reference and items are required" });
      }

      // Validate items format
      for (const item of items) {
        if (
          !item.inventoryItemId ||
          typeof item.inventoryItemId !== "number" ||
          !item.quantity ||
          typeof item.quantity !== "number" ||
          item.quantity <= 0 ||
          typeof item.unitCost !== "number" ||
          item.unitCost < 0
        ) {
          return res.status(400).json({
            message:
              "Invalid item format: each item must have inventoryItemId, positive quantity, and valid unitCost",
          });
        }
      }

      const receipt = await storage.createGoodsReceipt(
        reference,
        items,
        req.session.userId,
      );
      res.status(201).json(receipt);
    } catch (error) {
      console.error("Goods receipt creation error:", error);
      console.error("Error details:", error.message);
      res.status(500).json({
        message: "Failed to create goods receipt",
        error: error.message,
      });
    }
  },
);

// Goods Issue routes
inventoryRoutes.get(
  "/api/goods-issue",
  requireAuth,
  requireRole(["admin", "project_manager", "finance"]),
  async (req, res) => {
    try {
      console.log("Getting goods issues...");
      const issues = await storage.getGoodsIssues();
      console.log("Retrieved goods issues:", issues);
      res.json(issues);
    } catch (error) {
      console.error("Get goods issues error:", error);
      res.status(500).json({ message: "Failed to get goods issues" });
    }
  },
);

inventoryRoutes.post(
  "/api/goods-issue",
  requireAuth,
  requireRole(["admin", "project_manager", "finance"]),
  async (req, res) => {
    try {
      const { reference, projectId, items } = req.body;

      // Validate required fields
      if (
        !reference ||
        !items ||
        !Array.isArray(items) ||
        items.length === 0
      ) {
        return res.status(400).json({
          message: "Reference and items array are required",
        });
      }

      // Validate items format
      for (const item of items) {
        if (
          !item.inventoryItemId ||
          typeof item.inventoryItemId !== "number" ||
          !item.quantity ||
          typeof item.quantity !== "number" ||
          item.quantity <= 0
        ) {
          return res.status(400).json({
            message:
              "Invalid item format: each item must have inventoryItemId and positive quantity",
          });
        }
      }

      const issue = await storage.createGoodsIssue(
        reference,
        projectId,
        items,
        req.session.userId,
      );
      res.status(201).json(issue);
    } catch (error) {
      console.error("Goods issue creation error:", error);
      res.status(500).json({
        message: "Failed to create goods issue",
        error: error.message,
      });
    }
  },
);

// Goods Receipt routes
inventoryRoutes.get("/api/goods-receipt", requireAuth, async (req, res) => {
  try {
    const receipts = await storage.getGoodsReceipts();
    res.json(receipts);
  } catch (error) {
    console.error("Get goods receipts error:", error);
    res.status(500).json({ message: "Failed to get goods receipts" });
  }
});

inventoryRoutes.post(
  "/api/goods-receipt",
  requireAuth,
  requireRole(["admin", "project_manager", "finance"]),
  async (req, res) => {
    try {
      const { reference, items } = req.body;

      if (
        !reference ||
        !items ||
        !Array.isArray(items) ||
        items.length === 0
      ) {
        return res
          .status(400)
          .json({ message: "Reference and items are required" });
      }

      // Validate items format
      for (const item of items) {
        if (
          !item.inventoryItemId ||
          typeof item.inventoryItemId !== "number" ||
          !item.quantity ||
          typeof item.quantity !== "number" ||
          item.quantity <= 0 ||
          typeof item.unitCost !== "number" ||
          item.unitCost < 0
        ) {
          return res.status(400).json({
            message:
              "Invalid item format: each item must have inventoryItemId, positive quantity, and valid unitCost",
          });
        }
      }

      const receipt = await storage.createGoodsReceipt(
        reference,
        items,
        req.session.userId,
      );
      res.status(201).json(receipt);
    } catch (error) {
      console.error("Goods receipt creation error:", error);
      res.status(500).json({ message: "Failed to create goods receipt" });
    }
  },
);
