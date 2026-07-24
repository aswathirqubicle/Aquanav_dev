import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { storage } from "../storage";

export const assetsRoutes = Router();

// Asset Types routes for Enhanced Asset Inventory
assetsRoutes.get("/api/asset-types", requireAuth, async (req, res) => {
  try {
    const assetTypes = await storage.getAssetTypes();
    res.json(assetTypes);
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error?.message || "Failed to fetch asset types" });
  }
});

assetsRoutes.post("/api/asset-types", requireAuth, async (req, res) => {
  try {
    const assetType = await storage.createAssetType(req.body);
    res.status(201).json(assetType);
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error?.message || "Failed to create asset type" });
  }
});

assetsRoutes.put("/api/asset-types/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const assetType = await storage.updateAssetType(id, req.body);
    res.json(assetType);
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error?.message || "Failed to update asset type" });
  }
});

// Enhanced Asset Inventory Instance routes
assetsRoutes.get("/api/asset-inventory/instances", requireAuth, async (req, res) => {
  try {
    const instances = await storage.getAllAssetInventoryInstances();
    res.json(instances);
  } catch (error: any) {
    res.status(500).json({
      message: error?.message || "Failed to fetch asset inventory instances",
    });
  }
});

assetsRoutes.get(
  "/api/asset-inventory/instances/by-type/:assetTypeId",
  requireAuth,
  async (req, res) => {
    try {
      const instances = await storage.getAssetInventoryInstancesByType(
        parseInt(req.params.assetTypeId),
      );
      res.json(instances);
    } catch (error: any) {
      res.status(500).json({
        message: error?.message || "Failed to fetch instances for asset type",
      });
    }
  },
);

assetsRoutes.get(
  "/api/asset-inventory/instances/available/:assetTypeId",
  requireAuth,
  async (req, res) => {
    try {
      const instances = await storage.getAvailableInstancesForAssignment(
        parseInt(req.params.assetTypeId),
      );
      res.json(instances);
    } catch (error: any) {
      res.status(500).json({
        message: error?.message || "Failed to fetch available instances",
      });
    }
  },
);

assetsRoutes.get(
  "/api/asset-inventory/instances/:id",
  requireAuth,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const instance = await storage.getAssetInventoryInstance(id);
      if (!instance) {
        return res.status(404).json({ message: "Asset instance not found" });
      }
      res.json(instance);
    } catch (error: any) {
      res.status(500).json({
        message: error?.message || "Failed to fetch asset instance",
      });
    }
  },
);

assetsRoutes.post("/api/asset-inventory/instances", requireAuth, async (req, res) => {
  try {
    const instance = await storage.createAssetInventoryInstance(req.body);
    res.status(201).json(instance);
  } catch (error: any) {
    res.status(500).json({
      message: error?.message || "Failed to create asset inventory instance",
    });
  }
});

assetsRoutes.put(
  "/api/asset-inventory/instances/:id",
  requireAuth,
  async (req, res) => {
    try {
      const instance = await storage.updateAssetInventoryInstance(
        parseInt(req.params.id),
        req.body,
      );
      res.json(instance);
    } catch (error: any) {
      res.status(500).json({
        message:
          error?.message || "Failed to update asset inventory instance",
      });
    }
  },
);

// Get all maintenance records for reporting
assetsRoutes.get("/api/maintenance-records", requireAuth, async (req, res) => {
  try {
    const maintenanceRecords = await storage.getAllAssetMaintenanceRecords();
    res.json(maintenanceRecords);
  } catch (error) {
    console.error("Error fetching all maintenance records:", error);
    res.status(500).json({ message: "Failed to fetch maintenance records" });
  }
});

// Get all asset assignments for earnings calculation (legacy)
assetsRoutes.get("/api/asset-assignments", requireAuth, async (req, res) => {
  try {
    const assignments = await storage.getAllAssetAssignments();
    res.json(assignments);
  } catch (error) {
    console.error("Error getting all asset assignments:", error);
    res.json([]); // Return empty array instead of error to prevent reports from failing
  }
});

// Get all asset instance assignments for reports
assetsRoutes.get("/api/asset-instance-assignments", requireAuth, async (req, res) => {
  try {
    const assignments = await storage.getAllAssetInstanceAssignments();
    res.json(assignments);
  } catch (error) {
    console.error("Error getting all asset instance assignments:", error);
    res.json([]);
  }
});
