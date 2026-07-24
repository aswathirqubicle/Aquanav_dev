import { Router } from "express";
import {
  requireAuth,
  requireRole,
} from "../middleware/auth";
import { storage } from "../storage";
import { upload } from "../middleware/upload";

export const exchangeRatesRoutes = Router();

// Company routes
exchangeRatesRoutes.get("/api/company", requireAuth, async (req, res) => {
  try {
    const company = await storage.getCompany();
    res.json(company);
  } catch (error) {
    res.status(500).json({ message: "Failed to get company info" });
  }
});

exchangeRatesRoutes.put(
  "/api/company",
  requireAuth,
  requireRole(["admin"]),
  upload.single("companyLogo"),
  async (req, res) => {
    try {
      const companyData = req.body;
      // ✅ Attach uploaded logo path if present
      if (req.file) {
        companyData.logo = `/uploads/company/${req.file.filename}`;
      }
      const company = await storage.updateCompany(companyData);
      res.json(company);
    } catch (error) {
      console.error("Update company error:", error);
      res.status(500).json({ message: "Failed to update company info" });
    }
  },
);

exchangeRatesRoutes.get(
  "/api/exchange-rates/available-currencies",
  requireAuth,
  async (req, res) => {
    try {
      const rates = await storage.getExchangeRates();
      const currencySet = new Set<string>(["AED"]);
      for (const rate of rates) {
        if (rate.isActive) {
          currencySet.add(rate.fromCurrency);
          currencySet.add(rate.toCurrency);
        }
      }
      const currencies = Array.from(currencySet).sort();
      res.json(currencies);
    } catch (error) {
      console.error("Get available currencies error:", error);
      res.status(500).json({ message: "Failed to get available currencies" });
    }
  },
);

// Exchange Rate routes
exchangeRatesRoutes.get(
  "/api/exchange-rates",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const rates = await storage.getExchangeRates();
      res.json(rates);
    } catch (error) {
      console.error("Get exchange rates error:", error);
      res.status(500).json({ message: "Failed to get exchange rates" });
    }
  },
);

exchangeRatesRoutes.post(
  "/api/exchange-rates",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const { fromCurrency, toCurrency, rate, isActive } = req.body;
      if (!fromCurrency || !toCurrency || !rate) {
        return res.status(400).json({
          message: "From currency, to currency, and rate are required",
        });
      }
      if (fromCurrency === toCurrency) {
        return res
          .status(400)
          .json({ message: "From and To currencies must be different" });
      }
      if (parseFloat(rate) <= 0) {
        return res
          .status(400)
          .json({ message: "Rate must be a positive number" });
      }
      const existingRates = await storage.getExchangeRates();
      const duplicate = existingRates.find(
        (r) => r.fromCurrency === fromCurrency && r.toCurrency === toCurrency,
      );
      if (duplicate) {
        return res.status(400).json({
          message: `Exchange rate from ${fromCurrency} to ${toCurrency} already exists. Please edit the existing rate instead.`,
        });
      }
      const newRate = await storage.createExchangeRate({
        fromCurrency,
        toCurrency,
        rate: String(rate),
        isActive: isActive !== undefined ? isActive : true,
        updatedById: req.session.userId,
      });
      res.status(201).json(newRate);
    } catch (error) {
      console.error("Create exchange rate error:", error);
      res.status(500).json({ message: "Failed to create exchange rate" });
    }
  },
);

exchangeRatesRoutes.put(
  "/api/exchange-rates/:id",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { fromCurrency, toCurrency, rate, isActive } = req.body;
      const updated = await storage.updateExchangeRate(id, {
        ...(fromCurrency && { fromCurrency }),
        ...(toCurrency && { toCurrency }),
        ...(rate !== undefined && { rate: String(rate) }),
        ...(isActive !== undefined && { isActive }),
        updatedById: req.session.userId,
      });
      if (!updated) {
        return res.status(404).json({ message: "Exchange rate not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Update exchange rate error:", error);
      res.status(500).json({ message: "Failed to update exchange rate" });
    }
  },
);

exchangeRatesRoutes.delete(
  "/api/exchange-rates/:id",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteExchangeRate(id);
      if (!deleted) {
        return res.status(404).json({ message: "Exchange rate not found" });
      }
      res.json({ message: "Exchange rate deleted" });
    } catch (error) {
      console.error("Delete exchange rate error:", error);
      res.status(500).json({ message: "Failed to delete exchange rate" });
    }
  },
);

exchangeRatesRoutes.get("/api/exchange-rates/lookup", requireAuth, async (req, res) => {
  try {
    const from = req.query.from as string;
    const to = (req.query.to as string) || "AED";
    if (!from) {
      return res.status(400).json({ message: "Missing 'from' parameter" });
    }
    const rate = await storage.getExchangeRateForCurrency(from, to);
    res.json({ fromCurrency: from, toCurrency: to, rate });
  } catch (error) {
    console.error("Lookup exchange rate error:", error);
    res.status(500).json({ message: "Failed to lookup exchange rate" });
  }
});

exchangeRatesRoutes.get(
  "/api/exchange-rates/available-currencies",
  requireAuth,
  async (req, res) => {
    try {
      const rates = await storage.getExchangeRates();
      const currencySet = new Set<string>(["AED"]);
      for (const rate of rates) {
        if (rate.isActive) {
          currencySet.add(rate.fromCurrency);
          currencySet.add(rate.toCurrency);
        }
      }
      const currencies = Array.from(currencySet).sort();
      res.json(currencies);
    } catch (error) {
      console.error("Get available currencies error:", error);
      res.status(500).json({ message: "Failed to get available currencies" });
    }
  },
);
