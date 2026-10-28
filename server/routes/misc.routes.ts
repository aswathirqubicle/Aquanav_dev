import { Router } from "express";
import {
  requireAuth,
  requireRole,
} from "../middleware/auth";
import { storage } from "../storage";

export const miscRoutes = Router();

miscRoutes.get("/api/locations", requireAuth, async (req, res) => {
  try {
    const locations = await storage.getLocations();
    res.json(locations);
  } catch (error) {
    console.error("Get locations error:", error);
    res.status(500).json({ message: "Failed to get locations" });
  }
});

miscRoutes.get(
  "/api/sales/stats",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (_req, res) => {
    try {
      const stats = await storage.getSalesStats();
      res.json(stats);
    } catch (error) {
      console.error("Get sales stats error:", error);
      res.status(500).json({ message: "Failed to get sales stats" });
    }
  },
);
