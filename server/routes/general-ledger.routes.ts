import { Router } from "express";
import {
  requireAuth,
  requireRole,
} from "../middleware/auth";
import { storage } from "../storage";

export const generalLedgerRoutes = Router();

// Chart of Accounts routes
generalLedgerRoutes.get(
  "/api/chart-of-accounts",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const accounts = await storage.getChartOfAccounts();
      res.json(accounts);
    } catch (error: any) {
      console.error("Error fetching chart of accounts:", error);
      res.status(500).json({ message: "Failed to fetch chart of accounts" });
    }
  },
);

// General Ledger routes
generalLedgerRoutes.get(
  "/api/general-ledger",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const filters = {
        entryType: req.query.entryType as string,
        referenceType: req.query.referenceType as string,
        entityId: req.query.entityId
          ? parseInt(req.query.entityId as string)
          : undefined,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        status: req.query.status as string,
        projectId: req.query.projectId
          ? parseInt(req.query.projectId as string)
          : undefined,
        accountName: req.query.accountName as string,
        search: req.query.search as string,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      };

      const result = await storage.getGeneralLedgerEntries(filters);
      res.json(result);
    } catch (error) {
      console.error("Get general ledger entries error:", error);
      res
        .status(500)
        .json({ message: "Failed to get general ledger entries" });
    }
  },
);

// Retired (8.3/D3). This posted ONE ledger row at a time, so a caller had to
// remember to post the opposite side itself and nothing checked that it did —
// the ledger could be left permanently one-sided. Use the journal endpoint
// below, which takes every line together and rejects the set unless debits
// equal credits. Answers 410 rather than 404 so an existing caller is told
// what to do instead of seeing a routing bug.
generalLedgerRoutes.post(
  "/api/general-ledger",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (_req, res) => {
    res.status(410).json({
      message:
        "Single-sided ledger entries are no longer accepted. Post a balanced " +
        "entry to /api/general-ledger/journal instead — it takes all lines at " +
        "once and requires debits to equal credits.",
    });
  },
);

generalLedgerRoutes.post(
  "/api/general-ledger/journal",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const journalData = {
        ...req.body,
        createdBy: req.session.userId,
      };
      const entries = await storage.createJournalEntry(journalData);
      res.status(201).json(entries);
    } catch (error) {
      console.error("Create journal entry error:", error);
      res.status(500).json({
        message: error.message || "Failed to create journal entry",
        error: error.message,
      });
    }
  },
);

generalLedgerRoutes.put(
  "/api/general-ledger/:id",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);

      // A posted amount or account may never be edited in place (8.4/D3).
      // Editing them rewrites history: the ledger stops showing what was
      // actually posted, so it can no longer be reconciled against the document
      // or statement it came from, and an audit cannot tell a correction from a
      // fabrication. Corrections go through reversal-and-repost — post a
      // balanced reversing journal, then the corrected one — which leaves the
      // original on record. Descriptive fields stay editable.
      const financialFields = ["debitAmount", "creditAmount", "accountName"];
      const attempted = financialFields.filter(
        (f) => req.body[f] !== undefined,
      );
      if (attempted.length > 0) {
        return res.status(400).json({
          message:
            `Cannot edit ${attempted.join(", ")} on a posted ledger entry. ` +
            `Post a reversing journal entry and re-post the correction, so the ` +
            `original remains on record.`,
        });
      }

      const updateData = {
        ...req.body,
        createdBy: req.session.userId,
      };

      console.log("Updating general ledger entry:", entryId, updateData);

      const entry = await storage.updateGeneralLedgerEntry(
        entryId,
        updateData,
      );

      if (!entry) {
        return res
          .status(404)
          .json({ message: "General ledger entry not found" });
      }

      res.json(entry);
    } catch (error) {
      console.error("Update general ledger entry error:", error);
      res.status(500).json({
        message: error.message || "Failed to update general ledger entry",
      });
    }
  },
);

generalLedgerRoutes.get(
  "/api/general-ledger/receivables",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const { customerId, projectId, startDate, endDate } = req.query;
      const filters = {
        customerId: customerId ? parseInt(customerId as string) : undefined,
        projectId: projectId ? parseInt(projectId as string) : undefined,
        startDate: startDate as string,
        endDate: endDate as string,
      };
      const receivables = await storage.getReceivables(filters);
      res.json(receivables);
    } catch (error) {
      console.error("Get receivables error:", error);
      res.status(500).json({ message: "Failed to get receivables" });
    }
  },
);
