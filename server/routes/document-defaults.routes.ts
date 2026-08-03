import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { db } from "../db";
import { documentDefaults } from "@shared/schema";
import { eq } from "drizzle-orm";

export const documentDefaultsRoutes = Router();

/**
 * Standing Notes / Terms & Conditions per document type, loaded into a new
 * document as its starting text.
 *
 * Reading needs only authentication: every role that can create a document
 * needs its defaults, and the content is boilerplate the client puts on paper
 * anyway. Writing is admin-only — these are company-wide wording.
 */

// The closed set of types a row may describe. A typo'd type would silently
// create a default nothing ever reads, so unknown names are rejected.
const DOCUMENT_TYPES = [
  "sales_quotation",
  "sales_invoice",
  "proforma_invoice",
  "credit_note",
  "purchase_order",
  "purchase_invoice",
] as const;

documentDefaultsRoutes.get(
  "/api/document-defaults",
  requireAuth,
  async (_req, res) => {
    try {
      const rows = await db.select().from(documentDefaults);
      res.json(rows);
    } catch (error) {
      console.error("Document defaults fetch error:", error);
      res.status(500).json({ message: "Failed to load document defaults" });
    }
  },
);

documentDefaultsRoutes.put(
  "/api/document-defaults/:documentType",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const documentType = req.params.documentType;
      if (!DOCUMENT_TYPES.includes(documentType as any)) {
        return res.status(400).json({
          message: `Unknown document type. Expected one of: ${DOCUMENT_TYPES.join(", ")}`,
        });
      }

      const { notes, termsAndConditions } = req.body ?? {};
      const values = {
        documentType,
        notes: typeof notes === "string" && notes.trim() !== "" ? notes : null,
        termsAndConditions:
          typeof termsAndConditions === "string" &&
          termsAndConditions.trim() !== ""
            ? termsAndConditions
            : null,
        updatedAt: new Date(),
        updatedById: req.session.userId ?? null,
      };

      const existing = await db
        .select()
        .from(documentDefaults)
        .where(eq(documentDefaults.documentType, documentType));

      if (existing.length > 0) {
        const [row] = await db
          .update(documentDefaults)
          .set(values)
          .where(eq(documentDefaults.documentType, documentType))
          .returning();
        return res.json(row);
      }

      const [row] = await db.insert(documentDefaults).values(values).returning();
      res.json(row);
    } catch (error) {
      console.error("Document defaults save error:", error);
      res.status(500).json({ message: "Failed to save document defaults" });
    }
  },
);
