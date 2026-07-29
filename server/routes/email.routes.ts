import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { db } from "../db";
import { emailSendLog } from "@shared/schema";
import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import {
  getEmailSettingsPublic,
  saveEmailSettings,
} from "../lib/email-settings";
import { sendTestEmail } from "../lib/graph-mail";

export const emailRoutes = Router();

/**
 * Microsoft 365 settings.
 *
 * The response can never contain the client secret: getEmailSettingsPublic
 * returns a type without that field, so it cannot be leaked by spreading. The
 * UI is told only WHETHER one is stored.
 */
emailRoutes.get(
  "/api/email-settings",
  requireAuth,
  requireRole(["admin"]),
  async (_req, res) => {
    try {
      res.json(await getEmailSettingsPublic());
    } catch (error) {
      console.error("Email settings fetch error:", error);
      res.status(500).json({ message: "Failed to load email settings" });
    }
  },
);

emailRoutes.put(
  "/api/email-settings",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const { tenantId, clientId, clientSecretId, clientSecret, senderEmail, isEnabled } =
        req.body ?? {};

      await saveEmailSettings(
        {
          tenantId,
          clientId,
          clientSecretId,
          // Blank means "leave the stored one alone" — the UI never receives the
          // secret, so it cannot echo it back, and treating absent as "clear it"
          // would wipe the credential whenever the sender address was edited.
          clientSecret: clientSecret || undefined,
          senderEmail,
          isEnabled,
        },
        req.session.userId || null,
      );

      res.json(await getEmailSettingsPublic());
    } catch (error: any) {
      // Surfaced rather than swallowed: the most likely cause is a missing
      // EMAIL_ENCRYPTION_KEY, and the admin needs to be told exactly that.
      console.error("Email settings save error:", error?.message);
      res
        .status(400)
        .json({ message: error?.message || "Failed to save email settings" });
    }
  },
);

emailRoutes.post(
  "/api/email-settings/test",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const to = req.body?.to;
      if (!to || typeof to !== "string") {
        return res
          .status(400)
          .json({ message: "An address to send the test to is required" });
      }

      const result = await sendTestEmail(to);
      if (result.skipped === "not_configured") {
        return res.status(400).json({
          message:
            "Email is not configured yet. Save the tenant, client, secret and sender first, and enable sending.",
        });
      }
      if (!result.sent) {
        return res.status(400).json({ message: result.error || "Send failed" });
      }
      res.json({ sent: true });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Failed to send test" });
    }
  },
);

/**
 * The Email Log report.
 *
 * Read-only, and admin-only for the same reason the settings are: the bodies
 * name employees and their documents.
 */
emailRoutes.get(
  "/api/reports/email-log",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const conditions = [];

      const startDate =
        typeof req.query.startDate === "string" && req.query.startDate
          ? req.query.startDate
          : null;
      const endDate =
        typeof req.query.endDate === "string" && req.query.endDate
          ? req.query.endDate
          : null;
      const status =
        typeof req.query.status === "string" && req.query.status !== "all"
          ? req.query.status
          : null;
      const search =
        typeof req.query.search === "string" && req.query.search.trim() !== ""
          ? req.query.search.trim()
          : null;

      if (startDate) {
        conditions.push(gte(emailSendLog.sentAt, new Date(`${startDate}T00:00:00`)));
      }
      if (endDate) {
        // Inclusive of the end day, which is what a date picker implies.
        conditions.push(lte(emailSendLog.sentAt, new Date(`${endDate}T23:59:59.999`)));
      }
      if (status) {
        conditions.push(eq(emailSendLog.status, status));
      }
      if (search) {
        const pattern = `%${search}%`;
        conditions.push(
          or(
            ilike(emailSendLog.toEmail, pattern),
            ilike(emailSendLog.recipientName, pattern),
            ilike(emailSendLog.subject, pattern),
          )!,
        );
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select()
        .from(emailSendLog)
        .where(where)
        .orderBy(desc(emailSendLog.sentAt))
        // Bounded so one screen cannot pull the whole history; bodies are large.
        .limit(500);

      const [counts] = await db
        .select({
          total: sql<number>`count(*)::int`,
          sent: sql<number>`count(*) filter (where status = 'sent')::int`,
          failed: sql<number>`count(*) filter (where status = 'failed')::int`,
        })
        .from(emailSendLog)
        .where(where);

      res.json({ rows, counts });
    } catch (error) {
      console.error("Email log error:", error);
      res.status(500).json({ message: "Failed to load email log" });
    }
  },
);
