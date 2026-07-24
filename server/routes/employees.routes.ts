import { Router } from "express";
import { ZodError } from "zod";
import { db } from "../db";
import {
  desc,
  eq,
} from "drizzle-orm";
import {
  employees,
  projects,
} from "../../migrations/schema";
import {
  insertEmployeeDocumentSchema,
  insertEmployeeNextOfKinSchema,
  insertEmployeeSchema,
  insertEmployeeTrainingRecordSchema,
  projectEmployees,
  updateEmployeeSchema,
} from "@shared/schema";
import {
  requireAuth,
  requireRole,
} from "../middleware/auth";
import { storage } from "../storage";
import { upload } from "../middleware/upload";

export const employeesRoutes = Router();

// Employee routes
employeesRoutes.put(
  "/api/employees/:id",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = req.body;

      // Convert date strings to Date objects
      if (updateData.hireDate) {
        updateData.hireDate = new Date(updateData.hireDate);
      }
      if (updateData.dateOfBirth) {
        updateData.dateOfBirth = new Date(updateData.dateOfBirth);
      }

      const parsedData = insertEmployeeSchema.parse(updateData);
      const result = await storage.updateEmployee(id, parsedData);
      if (!result) {
        return res.status(404).json({ message: "Employee not found" });
      }
      res.json(result);
    } catch (error) {
      console.error("Update employee error:", error);
      if (error instanceof ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update employee" });
    }
  },
);

employeesRoutes.get("/api/employees", requireAuth, async (req, res) => {
  try {
    const employees = await storage.getEmployees();
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: "Failed to get employees" });
  }
});

employeesRoutes.post(
  "/api/employees",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const { createUserAccount, ...employeeData } = req.body;

      console.log("Received employee data:", employeeData);

      // Convert hireDate string to Date object if provided
      if (
        employeeData.hireDate &&
        typeof employeeData.hireDate === "string" &&
        employeeData.hireDate.trim() !== ""
      ) {
        employeeData.hireDate = new Date(employeeData.hireDate);
      } else {
        employeeData.hireDate = null;
      }

      // Ensure category has a default value
      if (!employeeData.category || employeeData.category.trim() === "") {
        employeeData.category = "permanent";
      }

      // Convert salary to decimal string if provided
      if (employeeData.salary && typeof employeeData.salary === "number") {
        employeeData.salary = employeeData.salary.toString();
      } else if (
        employeeData.salary &&
        typeof employeeData.salary === "string" &&
        employeeData.salary.trim() === ""
      ) {
        employeeData.salary = null;
      }

      // Clean up null/empty string fields
      Object.keys(employeeData).forEach((key) => {
        if (employeeData[key] === "" || employeeData[key] === undefined) {
          employeeData[key] = null;
        }
      });

      // Ensure required fields are not null
      if (!employeeData.firstName || employeeData.firstName.trim() === "") {
        return res.status(400).json({ message: "First name is required" });
      }
      if (!employeeData.lastName || employeeData.lastName.trim() === "") {
        return res.status(400).json({ message: "Last name is required" });
      }
      if (
        !employeeData.employeeCode ||
        employeeData.employeeCode.trim() === ""
      ) {
        return res.status(400).json({ message: "Employee code is required" });
      }

      employeeData.employeeCode = employeeData.employeeCode.trim();

      const existingEmployee = (await storage.getEmployees()).find(
        (employee) =>
          employee.employeeCode.toLowerCase() ===
          employeeData.employeeCode.toLowerCase(),
      );
      if (existingEmployee) {
        return res
          .status(409)
          .json({ message: "Employee code already exists" });
      }

      const parsedEmployeeData = insertEmployeeSchema.parse(employeeData);
      const employee = await storage.createEmployee(parsedEmployeeData);

      // Create user account only if explicitly requested and email is provided
      if (createUserAccount && employee.email && employee.email.trim()) {
        try {
          const username =
            `${employee.firstName.toLowerCase()}.${employee.lastName.toLowerCase()}`.replace(
              /\s+/g,
              "",
            );
          const defaultPassword = `${
            employee.employeeCode
          }@${new Date().getFullYear()}`;

          const userData = {
            username: username,
            email: employee.email.trim(),
            password: defaultPassword,
            role: "employee" as const,
            isActive: employee.isActive,
          };

          const user = await storage.createUser(userData);

          // Link the user to the employee
          await storage.updateEmployee(employee.id, { userId: user.id });

          res.status(201).json({
            ...employee,
            userId: user.id,
            generatedCredentials: {
              username: username,
              password: defaultPassword,
              message:
                "User account created successfully. Please share these credentials with the employee.",
            },
          });
        } catch (userError) {
          console.error("User creation error:", userError);
          // If user creation fails, still return the employee but with a warning
          res.status(201).json({
            ...employee,
            warning:
              "Employee created but user account creation failed. Please create manually.",
          });
        }
      } else {
        res.status(201).json(employee);
      }
    } catch (error) {
      console.error("Employee creation error:", error);
      if (error instanceof ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create employee" });
    }
  },
);

employeesRoutes.patch(
  "/api/employees/:id",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const raw = { ...req.body };

      // First parse/coerce with Zod (this converts strings to Date for date fields)
      const parsed = updateEmployeeSchema.parse(raw);

      // Now format fields for DB:
      // - For timestamp columns (hireDate) keep JS Date objects (drizzle accepts Date for timestamp)
      // - For date-only columns (dateOfBirth) convert to "YYYY-MM-DD" string
      const prepared: any = { ...parsed };

      if (prepared.hireDate) {
        // ensure it's a Date (z.coerce.date already made it Date) — keep as Date
        // optionally: prepared.hireDate = new Date(prepared.hireDate);
      }

      if (prepared.dateOfBirth) {
        const d = new Date(prepared.dateOfBirth);
        prepared.dateOfBirth = d.toISOString().split("T")[0]; // YYYY-MM-DD
      }

      // Remove undefined values to avoid accidental NULLs
      Object.keys(prepared).forEach(
        (k) => prepared[k] === undefined && delete prepared[k],
      );

      const result = await storage.updateEmployee(id, prepared);
      if (!result)
        return res.status(404).json({ message: "Employee not found" });

      res.json(result);
    } catch (err) {
      console.error("Update employee error:", err);
      if (err instanceof ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid data", errors: err.errors });
      }
      res.status(500).json({ message: "Failed to update employee" });
    }
  },
);

// Get single employee with full details
employeesRoutes.get("/api/employees/:id", requireAuth, async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);
    const employee = await storage.getEmployee(employeeId);

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: "Failed to get employee" });
  }
});

// Employee Next of Kin routes
employeesRoutes.get("/api/employees/:id/next-of-kin", requireAuth, async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);
    const nextOfKin = await storage.getEmployeeNextOfKin(employeeId);
    res.json(nextOfKin);
  } catch (error) {
    res.status(500).json({ message: "Failed to get next of kin data" });
  }
});

employeesRoutes.get("/api/employees/:id/next-of-kin", requireAuth, async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);
    const nextOfKinRecords = await storage.getEmployeeNextOfKin(employeeId);
    res.json(nextOfKinRecords);
  } catch (error) {
    res.status(500).json({ message: "Failed to get next of kin records" });
  }
});

employeesRoutes.post(
  "/api/employees/:id/next-of-kin",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const nextOfKinData = { ...req.body, employeeId };

      const parsedData = insertEmployeeNextOfKinSchema.parse(nextOfKinData);
      const result = await storage.createEmployeeNextOfKin(parsedData);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid data", errors: error.errors });
      }
      res
        .status(500)
        .json({ message: "Failed to create next of kin record" });
    }
  },
);

employeesRoutes.put(
  "/api/employees/next-of-kin/:id",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = req.body;

      const result = await storage.updateEmployeeNextOfKin(id, updateData);
      if (!result) {
        return res
          .status(404)
          .json({ message: "Next of kin record not found" });
      }
      res.json(result);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Failed to update next of kin record" });
    }
  },
);

employeesRoutes.delete(
  "/api/employees/next-of-kin/:id",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    console.log("DELETE NOK API HIT"); // 👈 add this
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteEmployeeNextOfKin(id);

      res.json({ message: "Next of kin record deleted successfully" });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Failed to delete next of kin record" });
    }
  },
);

// Employee Training Records routes
employeesRoutes.get(
  "/api/employees/:id/training-records",
  requireAuth,
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const trainingRecords =
        await storage.getEmployeeTrainingRecords(employeeId);
      res.json(trainingRecords);
    } catch (error) {
      res.status(500).json({ message: "Failed to get training records" });
    }
  },
);

employeesRoutes.post(
  "/api/employees/:id/training-records",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  upload.array("files"),
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const trainingData = { ...req.body, employeeId };

      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        const attachments = req.files.map((file) => ({
          fileName: file.filename,
          originalName: file.originalname,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype,
        }));
        trainingData.attachments = attachments;
      }

      const parsedData =
        insertEmployeeTrainingRecordSchema.parse(trainingData);
      const result = await storage.createEmployeeTrainingRecord(parsedData);
      res.status(201).json(result);
    } catch (error) {
      console.error("Training record creation error:", error);
      if (error instanceof ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create training record" });
    }
  },
);

employeesRoutes.put(
  "/api/employees/training-records/:id",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  upload.array("files"),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { existingAttachments, ...updateData } = req.body;

      const currentRecord = await storage.getEmployeeTrainingRecord(id);
      if (!currentRecord) {
        return res.status(404).json({ message: "Training record not found" });
      }

      let attachments = [];
      if (existingAttachments) {
        attachments = Array.isArray(existingAttachments)
          ? existingAttachments.map((a) => JSON.parse(a))
          : [JSON.parse(existingAttachments)];
      }

      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        const newAttachments = req.files.map((file) => ({
          fileName: file.filename,
          originalName: file.originalname,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype,
        }));
        attachments = [...attachments, ...newAttachments];
      }

      const result = await storage.updateEmployeeTrainingRecord(id, {
        ...updateData,
        attachments,
      });

      res.json(result);
    } catch (error) {
      console.error("Update training record error:", error);
      res.status(500).json({ message: "Failed to update training record" });
    }
  },
);

employeesRoutes.delete(
  "/api/employees/training-records/:id",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteEmployeeTrainingRecord(id);
      res.json({ message: "Training record deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete training record" });
    }
  },
);

// Employee Documents routes
employeesRoutes.get("/api/employees/:id/documents", requireAuth, async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);
    const documents = await storage.getEmployeeDocuments(employeeId);
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: "Failed to get employee documents" });
  }
});

employeesRoutes.post(
  "/api/employees/:id/documents",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  upload.array("files", 10),
  async (req, res) => {
    try {
      const employeeId = req.params.id;
      const documentData = { ...req.body, employeeId: Number(employeeId) };
      var f = [];
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        for (const file of req.files) {
          f.push({
            fileName: file.filename,
            originalName: file.originalname,
            filePath: file.path,
            fileSize: file.size,
            mimeType: file.mimetype,
          });
        }
        documentData.attachmentPaths = f;
      }
      const parsedData = insertEmployeeDocumentSchema.parse(documentData);
      const result = await storage.createEmployeeDocument(parsedData);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid data", errors: error.errors });
      }
      res
        .status(500)
        .json({ message: "Failed to create employee document", error });
    }
  },
);

employeesRoutes.put(
  "/api/employees/documents/:id",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  upload.array("files", 10),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = req.body;
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        var f = [];
        for (const file of req.files) {
          f.push({
            fileName: file.filename,
            originalName: file.originalname,
            filePath: file.path,
            fileSize: file.size,
            mimeType: file.mimetype,
          });
        }
        updateData.attachmentPaths = f;
      }
      const result = await storage.updateEmployeeDocument(id, updateData);
      if (!result) {
        return res
          .status(404)
          .json({ message: "Employee document not found" });
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to update employee document" });
    }
  },
);

employeesRoutes.delete(
  "/api/employees/documents/:id",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteEmployeeDocument(id);
      res.json({ message: "Employee document deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete employee document" });
    }
  },
);

// Get expiring employee documents for notification
employeesRoutes.get(
  "/api/employees/expiring-employee-documents",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const daysAhead = parseInt(req.query.daysAhead as string) || 30;
      const expiringDocs =
        await storage.getExpiringEmployeeDocuments(daysAhead);
      res.json(expiringDocs);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Failed to get expiring employee documents" });
    }
  },
);

// Get expiring documents for notification
employeesRoutes.get(
  "/api/employees/expiring-documents",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const daysAhead = parseInt(req.query.daysAhead as string) || 30;
      const expiringDocs = await storage.getExpiringDocuments(daysAhead);
      res.json(expiringDocs);
    } catch (error) {
      res.status(500).json({ message: "Failed to get expiring documents" });
    }
  },
);

// Generate employment contract
employeesRoutes.get(
  "/api/employees/:id/employment-contract",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const contractHtml =
        await storage.generateEmploymentContract(employeeId);

      res.setHeader("Content-Type", "text/html");
      res.send(contractHtml);
    } catch (error) {
      if (error.message === "Employee not found") {
        return res.status(404).json({ message: "Employee not found" });
      }
      res
        .status(500)
        .json({ message: "Failed to generate employment contract" });
    }
  },
);

// Employee Projects route
employeesRoutes.get(
  "/api/employees/:employeeId/projects",
  requireAuth,
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.employeeId);
      const assignments = await db
        .select({
          id: projectEmployees.id,
          projectId: projectEmployees.projectId,
          startDate: projectEmployees.startDate,
          endDate: projectEmployees.endDate,
          assignedAt: projectEmployees.assignedAt,
          projectTitle: projects.title,
          projectStatus: projects.status,
          vesselName: projects.vesselName,
        })
        .from(projectEmployees)
        .innerJoin(projects, eq(projects.id, projectEmployees.projectId))
        .where(eq(projectEmployees.employeeId, employeeId))
        .orderBy(desc(projectEmployees.assignedAt));
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching employee projects:", error);
      res.status(500).json({ message: "Failed to fetch employee projects" });
    }
  },
);

// Employee Feedback routes
employeesRoutes.get(
  "/api/employees/:employeeId/feedback",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.employeeId);
      const feedback = await storage.getEmployeeFeedback(employeeId);
      res.json(feedback);
    } catch (error) {
      console.error("Error fetching employee feedback:", error);
      res.status(500).json({ message: "Failed to fetch feedback" });
    }
  },
);

employeesRoutes.post(
  "/api/employees/:employeeId/feedback",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const employeeId = parseInt(req.params.employeeId);
      const { feedback, projectId } = req.body;
      if (!feedback || !feedback.trim()) {
        return res.status(400).json({ message: "Feedback text is required" });
      }
      const result = await storage.createEmployeeFeedback({
        employeeId,
        feedback: feedback.trim(),
        projectId: projectId || null,
        createdById: req.session.userId,
      });
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating employee feedback:", error);
      res.status(500).json({ message: "Failed to create feedback" });
    }
  },
);

employeesRoutes.put(
  "/api/employees/feedback/:id",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getEmployeeFeedbackById(id);
      if (!existing) {
        return res.status(404).json({ message: "Feedback not found" });
      }
      if (
        req.session.userRole === "project_manager" &&
        existing.createdById !== req.session.userId
      ) {
        return res
          .status(403)
          .json({ message: "You can only edit your own feedback" });
      }
      const { feedback, projectId } = req.body;
      if (!feedback || !feedback.trim()) {
        return res.status(400).json({ message: "Feedback text is required" });
      }
      const result = await storage.updateEmployeeFeedback(id, {
        feedback: feedback.trim(),
        projectId: projectId || null,
      });
      res.json(result);
    } catch (error) {
      console.error("Error updating employee feedback:", error);
      res.status(500).json({ message: "Failed to update feedback" });
    }
  },
);

employeesRoutes.delete(
  "/api/employees/feedback/:id",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getEmployeeFeedbackById(id);
      if (!existing) {
        return res.status(404).json({ message: "Feedback not found" });
      }
      if (
        req.session.userRole === "project_manager" &&
        existing.createdById !== req.session.userId
      ) {
        return res
          .status(403)
          .json({ message: "You can only delete your own feedback" });
      }
      await storage.deleteEmployeeFeedback(id);
      res.json({ message: "Feedback deleted successfully" });
    } catch (error) {
      console.error("Error deleting employee feedback:", error);
      res.status(500).json({ message: "Failed to delete feedback" });
    }
  },
);
