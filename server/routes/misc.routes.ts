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

// Get vessel location using IMO number
miscRoutes.get("/api/vessel-location/:imo", async (req, res) => {
  const { imo } = req.params;

  if (!imo) {
    return res.status(400).json({ message: "IMO number is required" });
  }

  try {
    // Note: You'll need to set up VesselFinder API credentials
    // For demo purposes, we'll simulate the API response
    // Replace this with actual VesselFinder API call

    const vesselFinderApiKey = process.env.VESSEL_FINDER_API_KEY;

    if (!vesselFinderApiKey) {
      // Return mock data for development
      const mockData = {
        imo: imo,
        name: "Sample Vessel",
        lat: 25.276987,
        lon: 55.296249, // Dubai coordinates as example
        course: 45,
        speed: 12.5,
        heading: 42,
        timestamp: new Date().toISOString(),
        destination: "DUBAI",
        eta: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: "Under way using engine",
      };

      return res.json(mockData);
    }

    // Actual VesselFinder API call
    const vesselFinderUrl = `https://api.vesselfinder.com/vessels?userkey=${vesselFinderApiKey}&imo=${imo}&format=json`;

    const apiResponse = await fetch(vesselFinderUrl);

    if (!apiResponse.ok) {
      throw new Error(`VesselFinder API error: ${apiResponse.statusText}`);
    }

    const apiData = await apiResponse.json();

    if (!apiData || apiData.length === 0) {
      return res.status(404).json({ message: "Vessel not found" });
    }

    const vessel = apiData[0]; // Get first result

    // Transform API response to our format
    const vesselData = {
      imo: vessel.IMO || imo,
      name: vessel.SHIPNAME || "Unknown",
      lat: parseFloat(vessel.LAT) || 0,
      lon: parseFloat(vessel.LON) || 0,
      course: parseFloat(vessel.COURSE) || 0,
      speed: parseFloat(vessel.SPEED) || 0,
      heading: parseFloat(vessel.HEADING) || 0,
      timestamp: vessel.TIMESTAMP || new Date().toISOString(),
      destination: vessel.DESTINATION || "",
      eta: vessel.ETA || "",
      status: vessel.NAVSTAT || "Unknown",
    };

    res.json(vesselData);
  } catch (error) {
    console.error("Vessel location fetch error:", error);
    res.status(500).json({
      message: "Failed to fetch vessel location",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
