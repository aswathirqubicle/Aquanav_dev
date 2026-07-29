import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { storage } from "../storage";

export const profileRoutes = Router();

/**
 * A user's own employee record.
 *
 * Every endpoint here resolves the employee from the SESSION, never from a
 * route or body parameter. These records carry passport, visa and medical data,
 * so an :id parameter would be a horizontal-privilege hole — any authenticated
 * user could read any colleague's documents. There is deliberately no way to
 * address another employee through this router; admins use /api/employees/*,
 * which is role-gated.
 *
 * A user with no linked employee row is not an error: plenty of accounts
 * (customers, service users) have none. They get employee: null and the client
 * shows only the parts of Profile that do not need one.
 */
profileRoutes.get("/api/profile/me", requireAuth, async (req, res) => {
  try {
    const employee = await storage.getEmployeeByUserId(req.session.userId!);
    if (!employee) {
      return res.json({
        employee: null,
        nextOfKin: [],
        documents: [],
        trainingRecords: [],
        readinessHistory: [],
      });
    }

    const [nextOfKin, documents, trainingRecords, readinessHistory] =
      await Promise.all([
        storage.getEmployeeNextOfKin(employee.id),
        storage.getEmployeeDocuments(employee.id),
        storage.getEmployeeTrainingRecords(employee.id),
        storage.getReadinessHistory(employee.id),
      ]);

    res.json({
      employee,
      nextOfKin,
      documents,
      trainingRecords,
      readinessHistory,
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ message: "Failed to load profile" });
  }
});

/**
 * Set your own joining readiness date.
 *
 * The employee is resolved from the session, so any employeeId in the body is
 * ignored rather than trusted — this endpoint can only ever change the caller's
 * own date. Admins set it for someone else through /api/employees/:id.
 */
profileRoutes.patch(
  "/api/profile/joining-readiness",
  requireAuth,
  async (req, res) => {
    try {
      const employee = await storage.getEmployeeByUserId(req.session.userId!);
      if (!employee) {
        return res.status(404).json({
          message: "Your account is not linked to an employee record",
        });
      }

      const { joiningReadinessDate } = req.body;
      if (
        joiningReadinessDate !== null &&
        joiningReadinessDate !== undefined &&
        typeof joiningReadinessDate !== "string"
      ) {
        return res
          .status(400)
          .json({ message: "Joining readiness date must be a date or empty" });
      }

      const user = await storage.getUser(req.session.userId!);
      const updated = await storage.updateJoiningReadiness(
        employee.id,
        joiningReadinessDate ?? null,
        req.session.userId || null,
        user?.username || null,
      );

      res.json(updated);
    } catch (error) {
      console.error("Joining readiness update error:", error);
      res.status(500).json({ message: "Failed to update joining readiness" });
    }
  },
);
