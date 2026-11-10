import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { storage } from "../storage";
import { upload } from "../middleware/upload";
import {
  BASIC_INFO_LABELS,
  describeChanges,
  pickBasicInfo,
  pickNextOfKin,
  pickTraining,
} from "../lib/profile-self-service";
import { notifyEmployeeProfileChange } from "../notifications/profile-change";
import { appOriginFrom } from "../notifications/document-change";

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

/**
 * Loads the caller's own employee row into res.locals.employee, or answers 404.
 * Runs before multer, so a refused request never leaves uploaded files on disk.
 */
const loadOwnEmployee = async (req: any, res: any, next: any) => {
  try {
    const employee = await storage.getEmployeeByUserId(req.session.userId!);
    if (!employee) {
      return res.status(404).json({
        message: "Your account is not linked to an employee record",
      });
    }
    res.locals.employee = employee;
    next();
  } catch (error) {
    console.error("Profile employee lookup error:", error);
    res.status(500).json({ message: "Failed to load your employee record" });
  }
};

const invalid = (res: any, errors: Record<string, string>) =>
  res.status(400).json({
    message: Object.values(errors)[0] || "Invalid data",
    errors,
  });

/**
 * Edit your own personal details. Only the fields in BASIC_INFO_LABELS are
 * taken from the body; name, position, salary, bank details and the rest stay
 * admin/PM-only and are ignored if sent.
 */
profileRoutes.patch(
  "/api/profile/basic",
  requireAuth,
  loadOwnEmployee,
  async (req, res) => {
    try {
      const employee = res.locals.employee;
      const { data, errors } = pickBasicInfo(req.body ?? {});
      if (Object.keys(errors).length) return invalid(res, errors);
      if (Object.keys(data).length === 0) return res.json(employee);

      const updated = await storage.updateEmployee(employee.id, data as any);
      res.json(updated);

      void notifyEmployeeProfileChange({
        employee,
        sectionLabel: "Basic info",
        action: "updated",
        details: describeChanges(employee, data, BASIC_INFO_LABELS),
        relatedType: "employee",
        relatedId: employee.id,
        appOrigin: appOriginFrom(req.get("origin")),
      });
    } catch (error) {
      console.error("Profile basic info update error:", error);
      res.status(500).json({ message: "Failed to update your details" });
    }
  },
);

const NEXT_OF_KIN_LABELS = {
  name: "Name",
  relationship: "Relationship",
  phone: "Phone",
  email: "Email",
  isPrimary: "Primary contact",
};

const nextOfKinDetails = (record: Record<string, unknown>) =>
  describeChanges(
    {},
    { ...record, isPrimary: record.isPrimary ? "Yes" : "No" },
    NEXT_OF_KIN_LABELS,
  );

profileRoutes.post(
  "/api/profile/next-of-kin",
  requireAuth,
  loadOwnEmployee,
  async (req, res) => {
    try {
      const employee = res.locals.employee;
      const { data, errors } = pickNextOfKin(req.body ?? {});
      if (Object.keys(errors).length) return invalid(res, errors);

      const created = await storage.createEmployeeNextOfKin({
        ...data,
        employeeId: employee.id,
      });
      res.status(201).json(created);

      void notifyEmployeeProfileChange({
        employee,
        sectionLabel: "Next of kin",
        itemLabel: data.name,
        action: "added",
        details: nextOfKinDetails(data as any),
        relatedType: "employee_next_of_kin",
        relatedId: created.id,
        appOrigin: appOriginFrom(req.get("origin")),
      });
    } catch (error) {
      console.error("Profile next of kin create error:", error);
      res.status(500).json({ message: "Failed to add next of kin" });
    }
  },
);

profileRoutes.put(
  "/api/profile/next-of-kin/:id",
  requireAuth,
  loadOwnEmployee,
  async (req, res) => {
    try {
      const employee = res.locals.employee;
      const id = Number(req.params.id);
      const own = (await storage.getEmployeeNextOfKin(employee.id)).find(
        (k: any) => k.id === id,
      );
      if (!own) {
        return res.status(404).json({ message: "Next of kin not found" });
      }

      const { data, errors } = pickNextOfKin(req.body ?? {});
      if (Object.keys(errors).length) return invalid(res, errors);

      const updated = await storage.updateEmployeeNextOfKin(id, data);
      res.json(updated);

      void notifyEmployeeProfileChange({
        employee,
        sectionLabel: "Next of kin",
        itemLabel: data.name,
        action: "updated",
        details: describeChanges(
          { ...own, isPrimary: own.isPrimary ? "Yes" : "No" },
          { ...data, isPrimary: data.isPrimary ? "Yes" : "No" },
          NEXT_OF_KIN_LABELS,
        ),
        relatedType: "employee_next_of_kin",
        relatedId: id,
        appOrigin: appOriginFrom(req.get("origin")),
      });
    } catch (error) {
      console.error("Profile next of kin update error:", error);
      res.status(500).json({ message: "Failed to update next of kin" });
    }
  },
);

const TRAINING_LABELS = {
  trainingName: "Training",
  trainingProvider: "Provider",
  certificationNumber: "Certificate number",
  trainingDate: "Training date",
  expiryDate: "Expiry date",
  notes: "Notes",
};

const uploadedFiles = (req: any) =>
  Array.isArray(req.files)
    ? req.files.map((file: any) => ({
        fileName: file.filename,
        originalName: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
      }))
    : [];

profileRoutes.post(
  "/api/profile/training-records",
  requireAuth,
  loadOwnEmployee,
  upload.array("files", 10),
  async (req, res) => {
    try {
      const employee = res.locals.employee;
      const { data, errors } = pickTraining(req.body ?? {});
      if (Object.keys(errors).length) return invalid(res, errors);

      const files = uploadedFiles(req);
      const created = await storage.createEmployeeTrainingRecord({
        ...data,
        employeeId: employee.id,
        status: "active",
        attachments: files,
      } as any);
      res.status(201).json(created);

      void notifyEmployeeProfileChange({
        employee,
        sectionLabel: "Training",
        itemLabel: data.trainingName,
        action: "added",
        details: [
          ...describeChanges({}, data as any, TRAINING_LABELS),
          ...(files.length
            ? [{ label: "Attachments", value: `${files.length} file${files.length === 1 ? "" : "s"}` }]
            : []),
        ],
        relatedType: "employee_training_record",
        relatedId: created.id,
        appOrigin: appOriginFrom(req.get("origin")),
      });
    } catch (error) {
      console.error("Profile training create error:", error);
      res.status(500).json({ message: "Failed to add training record" });
    }
  },
);

/**
 * Edit one of your own training records. Status stays as it is (admins manage
 * it). Existing attachments are kept only if they already belong to this
 * record, matched by stored file name, so the body cannot point a record at
 * someone else's file; new uploads are appended.
 */
profileRoutes.put(
  "/api/profile/training-records/:id",
  requireAuth,
  loadOwnEmployee,
  upload.array("files", 10),
  async (req, res) => {
    try {
      const employee = res.locals.employee;
      const id = Number(req.params.id);
      const current = await storage.getEmployeeTrainingRecord(id);
      if (!current || current.employeeId !== employee.id) {
        return res.status(404).json({ message: "Training record not found" });
      }

      const { data, errors } = pickTraining(req.body ?? {});
      if (Object.keys(errors).length) return invalid(res, errors);

      const keepNames = new Set<string>();
      const raw = req.body?.existingAttachments;
      for (const item of raw === undefined ? [] : Array.isArray(raw) ? raw : [raw]) {
        try {
          const parsed = typeof item === "string" ? JSON.parse(item) : item;
          if (parsed?.fileName) keepNames.add(String(parsed.fileName));
        } catch {
          keepNames.add(String(item));
        }
      }
      const kept = (Array.isArray(current.attachments) ? current.attachments : []).filter(
        (a: any) => keepNames.has(a?.fileName),
      );
      const files = uploadedFiles(req);

      const updated = await storage.updateEmployeeTrainingRecord(id, {
        ...data,
        attachments: [...kept, ...files],
      } as any);
      res.json(updated);

      const details = describeChanges(
        {
          ...current,
          trainingDate: current.trainingDate ? String(current.trainingDate).slice(0, 10) : null,
          expiryDate: current.expiryDate ? String(current.expiryDate).slice(0, 10) : null,
        },
        data as any,
        TRAINING_LABELS,
      );
      if (files.length) {
        details.push({ label: "New attachments", value: `${files.length} file${files.length === 1 ? "" : "s"}` });
      }
      void notifyEmployeeProfileChange({
        employee,
        sectionLabel: "Training",
        itemLabel: data.trainingName,
        action: "updated",
        details,
        relatedType: "employee_training_record",
        relatedId: id,
        appOrigin: appOriginFrom(req.get("origin")),
      });
    } catch (error) {
      console.error("Profile training update error:", error);
      res.status(500).json({ message: "Failed to update training record" });
    }
  },
);
