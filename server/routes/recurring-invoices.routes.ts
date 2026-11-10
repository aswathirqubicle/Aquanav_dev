import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  RecurringScheduleError,
  cancelSchedule,
  createScheduleFromQuotation,
  generateDueInvoices,
  getScheduleForQuotation,
  pauseSchedule,
  resumeSchedule,
} from "../recurring-invoices";

/**
 * Recurring invoices made from a sales quotation. The same roles as creating a
 * sales invoice (admin, finance) — a schedule raises invoices, if only drafts.
 */
export const recurringInvoicesRoutes = Router();

function sendError(res: any, error: any, fallback: string) {
  if (error instanceof RecurringScheduleError) {
    return res.status(error.status).json({ message: error.message });
  }
  console.error(`${fallback}:`, error);
  return res.status(500).json({ message: fallback });
}

recurringInvoicesRoutes.get(
  "/api/sales-quotations/:id/recurring-schedule",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const schedule = await getScheduleForQuotation(parseInt(req.params.id));
      res.json(schedule);
    } catch (error) {
      sendError(res, error, "Failed to load the recurring invoice schedule");
    }
  },
);

recurringInvoicesRoutes.post(
  "/api/sales-quotations/:id/recurring-schedule",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const schedule = await createScheduleFromQuotation(
        parseInt(req.params.id),
        req.body || {},
        req.session.userId!,
      );
      // Periods that have already ended (a Bill from in the past) are drafted
      // now rather than at the next hourly tick. A failure here must not undo
      // the schedule, which exists by this point; the job retries it.
      let created = 0;
      try {
        created = await generateDueInvoices(undefined, schedule.id);
      } catch (generationError) {
        console.error(
          "Recurring schedule created, but generating its due invoices failed:",
          generationError,
        );
      }
      res.status(201).json({ schedule, invoicesCreated: created });
    } catch (error) {
      sendError(res, error, "Failed to create the recurring invoice schedule");
    }
  },
);

recurringInvoicesRoutes.post(
  "/api/recurring-invoice-schedules/:id/pause",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      await pauseSchedule(parseInt(req.params.id));
      res.json({ message: "Recurring invoice paused" });
    } catch (error) {
      sendError(res, error, "Failed to pause the recurring invoice");
    }
  },
);

recurringInvoicesRoutes.post(
  "/api/recurring-invoice-schedules/:id/resume",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await resumeSchedule(id);
      // Resuming on a run date bills that period straight away.
      await generateDueInvoices(undefined, id);
      res.json({ message: "Recurring invoice resumed" });
    } catch (error) {
      sendError(res, error, "Failed to resume the recurring invoice");
    }
  },
);

recurringInvoicesRoutes.post(
  "/api/recurring-invoice-schedules/:id/cancel",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      await cancelSchedule(parseInt(req.params.id), req.session.userId!);
      res.json({ message: "Recurring invoice stopped" });
    } catch (error) {
      sendError(res, error, "Failed to stop the recurring invoice");
    }
  },
);
