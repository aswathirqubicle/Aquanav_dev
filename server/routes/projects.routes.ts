import { Router } from "express";
import multer from "multer";
import { ZodError } from "zod";
import {
  and,
  eq,
  gte,
  lte,
  ne,
  sql,
} from "drizzle-orm";
import {
  checkProjectAccess,
  requireAuth,
  requireRole,
} from "../middleware/auth";
import {
  customers,
  dailyActivities,
  employees,
  projects,
} from "../../migrations/schema";
import { db } from "../db";
import {
  insertDailyActivitySchema,
  insertProjectPhotoGroupSchema,
  insertProjectSchema,
} from "@shared/schema";
import { parseProjectDataFromFormData } from "../lib/parse-project-form";
import { storage } from "../storage";
import { upload } from "../middleware/upload";

export const projectsRoutes = Router();

// Project routes
projectsRoutes.get("/api/projects", requireAuth, async (req, res) => {
  try {
    const customerParam = req.query.customer;
    let projects;

    // CUSTOMER ROLE: force own projects only
    if (req.session.userRole === "customer") {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const customers = await storage.getCustomers();
      const customer = customers.find((c) => c.userId === user.id);

      if (!customer) {
        return res.json([]);
      }

      projects = await storage.getProjectsByCustomer(customer.id);
    }
    // EMPLOYEE ROLE: force team-assigned projects only
    else if (req.session.userRole === "employee") {
      const employee = await storage.getEmployeeByUserId(req.session.userId!);
      if (employee) {
        projects = await storage.getProjectsByEmployee(employee.id);
      } else {
        projects = [];
      }
    }
    //NON-CUSTOMER/EMPLOYEE ROLE + customer filter
    else if (customerParam) {
      projects = await storage.getProjectsByCustomer(Number(customerParam));
    }
    //NON-CUSTOMER/EMPLOYEE ROLE + no filter
    else {
      projects = await storage.getProjects();
    }

    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: "Failed to get projects" });
  }
});

projectsRoutes.get(
  "/api/projects/revenues",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const projectIds = req.query.projectIds as string;
      if (!projectIds) {
        return res.status(400).json({ message: "Project IDs are required" });
      }

      const ids = projectIds
        .split(",")
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id));
      if (ids.length === 0) {
        return res
          .status(400)
          .json({ message: "Valid project IDs are required" });
      }

      const revenuePromises = ids.map(async (projectId) => {
        try {
          const revenueData = await storage.getProjectRevenue(projectId);
          return { projectId, ...revenueData };
        } catch (error) {
          console.error(
            `Failed to get revenue for project ${projectId}:`,
            error,
          );
          return { projectId, error: true };
        }
      });

      const results = await Promise.all(revenuePromises);
      res.json(results.filter((result) => !result.error));
    } catch (error) {
      console.error("Get bulk project revenues error:", error);
      res.status(500).json({ message: "Failed to get project revenues" });
    }
  },
);

projectsRoutes.get("/api/projects/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const project = await storage.getProject(id);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (req.session.userRole === "employee") {
      const employee = await storage.getEmployeeByUserId(req.session.userId!);
      if (employee) {
        const assignedProjects = await storage.getProjectsByEmployee(
          employee.id,
        );
        if (!assignedProjects.some((p) => p.id === id)) {
          return res
            .status(403)
            .json({ message: "You are not assigned to this project" });
        }
      } else {
        return res.status(403).json({ message: "No employee record found" });
      }
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: "Failed to get project" });
  }
});

// ─── Completion report: photo listing ───────────────────────────────────────
projectsRoutes.get(
  "/api/projects/:id/completion-report/photos",
  requireAuth,
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId))
        return res.status(400).json({ message: "Invalid project ID" });
      const userRole = req.session.userRole || "";
      const userId = req.session.userId!;
      const hasAccess = await checkProjectAccess(projectId, userId, userRole);
      if (!hasAccess)
        return res.status(403).json({ message: "Access denied" });
      const groups = await storage.getProjectPhotoGroups(projectId);
      res.json(groups);
    } catch (error) {
      console.error("Completion report photos error:", error);
      res.status(500).json({ message: "Failed to fetch photo groups" });
    }
  },
);

projectsRoutes.post(
  "/api/projects",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  upload.single("vesselImage"),
  async (req, res) => {
    try {
      const parsedData = parseProjectDataFromFormData(req.body);

      if (req.file) {
        parsedData.vesselImage = `/${req.file.path}`;
      }

      const validatedData = insertProjectSchema.parse(parsedData);
      const project = await storage.createProject(validatedData);
      res.status(201).json(project);
    } catch (error) {
      console.error("Project creation error:", error);
      if (error instanceof ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create project" });
    }
  },
);

projectsRoutes.put(
  "/api/projects/:id",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  upload.single("vesselImage"),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const projectData = parseProjectDataFromFormData(req.body);

      if (req.file) {
        projectData.vesselImage = `/${req.file.path}`;
      }

      // If status is being changed to completed, set actual end date
      if (projectData.status === "completed" && !projectData.actualEndDate) {
        projectData.actualEndDate = new Date();
      }

      const project = await storage.updateProject(id, projectData);

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Recalculate cost if the project dates changed or status changed
      if (
        projectData.startDate ||
        projectData.actualEndDate ||
        projectData.status
      ) {
        await storage.recalculateProjectCost(id);
      }

      res.json(project);
    } catch (error) {
      console.error("Project update error:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  },
);

// Manual cost recalculation endpoint
projectsRoutes.post(
  "/api/projects/:id/recalculate-cost",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      await storage.recalculateProjectCost(projectId);

      const updatedProject = await storage.getProject(projectId);
      res.json({
        message: "Project cost recalculated successfully",
        project: updatedProject,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to recalculate project cost" });
    }
  },
);

// Project revenue routes (restricted to admin and finance)
projectsRoutes.get(
  "/api/projects/:id/revenue",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const revenueData = await storage.getProjectRevenue(projectId);
      res.json(revenueData);
    } catch (error) {
      console.error("Get project revenue error:", error);
      res.status(500).json({ message: "Failed to get project revenue" });
    }
  },
);

projectsRoutes.post(
  "/api/projects/:id/recalculate-revenue",
  requireAuth,
  requireRole(["admin", "finance"]),
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      await storage.updateProjectRevenue(projectId);

      const revenueData = await storage.getProjectRevenue(projectId);
      res.json({
        message: "Project revenue recalculated successfully",
        revenue: revenueData,
      });
    } catch (error) {
      console.error("Recalculate project revenue error:", error);
      res
        .status(500)
        .json({ message: "Failed to recalculate project revenue" });
    }
  },
);

// Project Employee Assignment routes
projectsRoutes.get("/api/projects/:id/employees", requireAuth, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }
    const employees = await storage.getProjectEmployees(projectId);
    res.json(employees);
  } catch (error) {
    console.error("Error getting project employees:", error);
    res.status(500).json({ message: "Failed to get project employees" });
  }
});

projectsRoutes.post(
  "/api/projects/:id/employees",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { assignments } = req.body;

      console.log("Received team assignment request:", {
        projectId,
        assignments,
      });

      if (!Array.isArray(assignments)) {
        return res
          .status(400)
          .json({ message: "Assignments must be an array" });
      }

      if (assignments.length === 0) {
        return res
          .status(400)
          .json({ message: "At least one assignment is required" });
      }

      // Validate assignment structure
      for (const assignment of assignments) {
        if (
          !assignment.employeeId ||
          typeof assignment.employeeId !== "number"
        ) {
          return res.status(400).json({
            message: "Each assignment must have a valid employeeId",
          });
        }

        // Validate date formats if provided
        if (assignment.startDate && assignment.startDate.trim()) {
          const startDate = new Date(assignment.startDate);
          if (isNaN(startDate.getTime())) {
            return res
              .status(400)
              .json({ message: "Invalid start date format" });
          }
        }

        if (assignment.endDate && assignment.endDate.trim()) {
          const endDate = new Date(assignment.endDate);
          if (isNaN(endDate.getTime())) {
            return res
              .status(400)
              .json({ message: "Invalid end date format" });
          }
        }
      }

      const result = await storage.assignEmployeesToProject(
        projectId,
        assignments,
      );
      console.log("Team assignment result:", result);
      res.status(201).json(result);
    } catch (error) {
      console.error("Team assignment error:", error);
      const status = (error as any).message?.includes("already assigned")
        ? 400
        : 500;
      res
        .status(status)
        .send(error instanceof Error ? error.message : "Unknown error");
    }
  },
);

projectsRoutes.delete(
  "/api/projects/:id/employees/:employeeId",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const employeeId = parseInt(req.params.employeeId);

      console.log(
        `API: Removing employee ${employeeId} from project ${projectId}`,
      );

      // Validate parameters
      if (isNaN(projectId) || isNaN(employeeId)) {
        console.log(
          `Invalid parameters: projectId=${req.params.id}, employeeId=${req.params.employeeId}`,
        );
        return res
          .status(400)
          .json({ message: "Invalid project ID or employee ID" });
      }

      // Check if project exists
      const project = await storage.getProject(projectId);
      if (!project) {
        console.log(`Project ${projectId} not found`);
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if employee exists
      const employees = await storage.getEmployees();
      const employee = employees.find((emp) => emp.id === employeeId);
      if (!employee) {
        console.log(`Employee ${employeeId} not found`);
        return res.status(404).json({ message: "Employee not found" });
      }

      const removed = await storage.removeEmployeeFromProject(
        projectId,
        employeeId,
      );
      if (!removed) {
        console.log(
          `Assignment not found for employee ${employeeId} in project ${projectId}`,
        );
        return res.status(404).json({ message: "Assignment not found" });
      }

      console.log(
        `Successfully removed employee ${employeeId} from project ${projectId}`,
      );
      res.json({ message: "Employee removed from project successfully" });
    } catch (error) {
      console.error("Error removing employee from project:", error);
      res
        .status(500)
        .json({ message: "Failed to remove employee from project" });
    }
  },
);

// Daily Activities routes
projectsRoutes.get("/api/projects/activities", requireAuth, async (req, res) => {
  try {
    // This is for the general activities page - return all activities
    // You might want to implement this differently based on your needs
    res.json([]);
  } catch (error) {
    console.error("Error getting all daily activities:", error);
    res.status(500).json({ message: "Failed to get daily activities" });
  }
});

projectsRoutes.get(
  "/api/projects/:projectId/activities",
  requireAuth,
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const hasAccess = await checkProjectAccess(
        projectId,
        req.session.userId!,
        req.session.userRole || "",
      );
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      const result = await storage.getDailyActivitiesPaginated(
        projectId,
        limit,
        offset,
      );
      res.json(result);
    } catch (error) {
      console.error("Error getting daily activities:", error);
      res.status(500).json({ message: "Failed to get daily activities" });
    }
  },
);

projectsRoutes.get(
  "/api/projects/:projectId/activities/all",
  requireAuth,
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const hasAccess = await checkProjectAccess(
        projectId,
        req.session.userId!,
        req.session.userRole || "",
      );
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const activities = await storage.getDailyActivities(projectId);
      res.json(activities);
    } catch (error) {
      console.error("Error getting all daily activities:", error);
      res.status(500).json({ message: "Failed to get daily activities" });
    }
  },
);

// Planned Activities routes
projectsRoutes.get(
  "/api/projects/:projectId/planned-activities",
  requireAuth,
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      const result = await storage.getPlannedActivitiesPaginated(
        projectId,
        limit,
        offset,
      );
      res.json(result);
    } catch (error) {
      console.error("Error getting planned activities:", error);
      res.status(500).json({ message: "Failed to get planned activities" });
    }
  },
);

projectsRoutes.post(
  "/api/projects/:projectId/planned-activities",
  requireAuth,
  requireRole(["admin", "project_manager", "employee"]),
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const activities = req.body;
      if (!Array.isArray(activities) || activities.length === 0) {
        return res
          .status(400)
          .json({ message: "Activities array is required" });
      }

      // Validate each activity
      for (const activity of activities) {
        if (!activity.tasks || !activity.date) {
          return res
            .status(400)
            .json({ message: "Each activity must have tasks and date" });
        }
      }

      const result = await storage.savePlannedActivities(
        projectId,
        activities,
      );
      res.status(201).json(result);
    } catch (error) {
      console.error("Error saving planned activities:", error);
      res.status(500).json({ message: "Failed to save planned activities" });
    }
  },
);

projectsRoutes.post(
  "/api/projects/:id/photo-groups",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  (req, res, next) => {
    upload.array("photos", 20)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        // A Multer error occurred when uploading.
        return res.status(400).json({ message: err.message });
      } else if (err) {
        // An unknown error occurred when uploading.
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { title, date, description, dailyActivityId } = req.body;

      if (!title || !date) {
        return res
          .status(400)
          .json({ message: "Title and date are required" });
      }

      if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
        return res
          .status(400)
          .json({ message: "At least one photo is required" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const photoDate = new Date(date);
      if (project.startDate && photoDate < new Date(project.startDate)) {
        return res.status(400).json({
          message: "Photo group date cannot be before project start date",
        });
      }

      const projectEndDate = project.actualEndDate || project.plannedEndDate;
      if (projectEndDate && photoDate > new Date(projectEndDate)) {
        return res.status(400).json({
          message: "Photo group date cannot be after project end date",
        });
      }

      // Linking is optional, but a link that is given has to point at an
      // activity of this same project — the same check the edit route makes.
      let linkedActivityId: number | null = null;
      if (
        dailyActivityId !== undefined &&
        dailyActivityId !== null &&
        dailyActivityId !== ""
      ) {
        linkedActivityId = parseInt(dailyActivityId);
        const activities = await storage.getDailyActivities(projectId);
        if (
          isNaN(linkedActivityId) ||
          !activities.some((a) => a.id === linkedActivityId)
        ) {
          return res.status(400).json({
            message: "Daily activity does not belong to this project",
          });
        }
      }

      const parsedGroupData = insertProjectPhotoGroupSchema.parse({
        projectId,
        title,
        date,
        description,
        dailyActivityId: linkedActivityId,
        createdBy: req.session.userId,
      });

      const group = await storage.createProjectPhotoGroup(parsedGroupData);

      if (req.files && (req.files as Express.Multer.File[]).length > 0) {
        const files = req.files as Express.Multer.File[];
        const photosData = files.map((file) => ({
          filename: file.filename,
          originalName: file.originalname,
          filePath: `/${file.path.replace(/\\/g, "/")}`,
          fileSize: file.size,
          mimeType: file.mimetype,
        }));

        await storage.addPhotosToPhotoGroup(group.id, photosData);
      }

      res.status(201).json(group);
    } catch (error) {
      console.error("Create photo group error:", error);
      res.status(500).json({ message: "Failed to create photo group" });
    }
  },
);

projectsRoutes.get("/api/projects/:id/photo-groups", requireAuth, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    const hasAccess = await checkProjectAccess(
      projectId,
      req.session.userId!,
      req.session.userRole || "",
    );
    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const result = await storage.getProjectPhotoGroupsPaginated(
      projectId,
      limit,
      offset,
      {
        from: (req.query.from as string) || undefined,
        to: (req.query.to as string) || undefined,
        location: (req.query.location as string) || undefined,
      },
    );
    res.json(result);
  } catch (error) {
    console.error("Get photo groups error:", error);
    res.status(500).json({ message: "Failed to get photo groups" });
  }
});

// The locations available to filter photo groups by, plus whether any group is
// unlinked, which is what the "General" option in the filter stands for.
projectsRoutes.get(
  "/api/projects/:id/photo-groups/locations",
  requireAuth,
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const hasAccess = await checkProjectAccess(
        projectId,
        req.session.userId!,
        req.session.userRole || "",
      );
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const locations = await storage.getProjectPhotoGroupLocations(projectId);
      res.json(locations);
    } catch (error) {
      console.error("Get photo group locations error:", error);
      res
        .status(500)
        .json({ message: "Failed to get photo group locations" });
    }
  },
);

projectsRoutes.delete(
  "/api/projects/:projectId/photo-groups/:groupId",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const groupId = parseInt(req.params.groupId);
      if (isNaN(projectId) || isNaN(groupId)) {
        return res
          .status(400)
          .json({ message: "Invalid project or group ID" });
      }

      // Storage deletes by group id alone, so without this a group could be
      // deleted through another project's URL.
      const groups = await storage.getProjectPhotoGroups(projectId);
      if (!groups.some((g) => g.id === groupId)) {
        return res.status(404).json({ message: "Photo group not found" });
      }

      const deleted = await storage.deleteProjectPhotoGroup(groupId);
      if (!deleted) {
        // This might happen if the group was already deleted, but we'll treat it
        // as a success for the client to avoid unnecessary error messages.
        console.warn(
          `Attempted to delete a photo group that might not exist: ID ${groupId}`,
        );
      }

      res.status(200).json({ message: "Photo group deleted successfully" });
    } catch (error) {
      console.error("Delete photo group error:", error);
      res.status(500).json({ message: "Failed to delete photo group" });
    }
  },
);

// Edits a photo group's details and its daily activity link. Photos themselves
// are not touched here: adding or removing them still means deleting the group
// and creating it again.
projectsRoutes.put(
  "/api/projects/:projectId/photo-groups/:groupId",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const groupId = parseInt(req.params.groupId);
      if (isNaN(projectId) || isNaN(groupId)) {
        return res
          .status(400)
          .json({ message: "Invalid project or group ID" });
      }

      const { title, date, description, dailyActivityId } = req.body;

      if (!title || !date) {
        return res
          .status(400)
          .json({ message: "Title and date are required" });
      }

      // Reading the group through the project's own groups proves both that it
      // exists and that it belongs to this project.
      const groups = await storage.getProjectPhotoGroups(projectId);
      if (!groups.some((g) => g.id === groupId)) {
        return res.status(404).json({ message: "Photo group not found" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // The same window the create route enforces, so an edit cannot move a
      // group to a date creating it there would have rejected.
      const photoDate = new Date(date);
      if (project.startDate && photoDate < new Date(project.startDate)) {
        return res.status(400).json({
          message: "Photo group date cannot be before project start date",
        });
      }

      const projectEndDate = project.actualEndDate || project.plannedEndDate;
      if (projectEndDate && photoDate > new Date(projectEndDate)) {
        return res.status(400).json({
          message: "Photo group date cannot be after project end date",
        });
      }

      // Linking is optional — an absent or empty value clears the link — but a
      // link that is given has to point at an activity of this same project.
      let linkedActivityId: number | null = null;
      if (
        dailyActivityId !== undefined &&
        dailyActivityId !== null &&
        dailyActivityId !== ""
      ) {
        linkedActivityId = parseInt(dailyActivityId);
        const activities = await storage.getDailyActivities(projectId);
        if (
          isNaN(linkedActivityId) ||
          !activities.some((a) => a.id === linkedActivityId)
        ) {
          return res.status(400).json({
            message: "Daily activity does not belong to this project",
          });
        }
      }

      const parsedGroupData = insertProjectPhotoGroupSchema.partial().parse({
        title,
        date,
        description: description ?? null,
        dailyActivityId: linkedActivityId,
      });

      const group = await storage.updateProjectPhotoGroup(
        groupId,
        parsedGroupData,
      );
      if (!group) {
        return res.status(404).json({ message: "Photo group not found" });
      }

      res.json(group);
    } catch (error) {
      console.error("Update photo group error:", error);
      res.status(500).json({ message: "Failed to update photo group" });
    }
  },
);

// Project Consumables routes
projectsRoutes.get(
  "/api/projects/:projectId/consumables",
  requireAuth,
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }
      const consumables = await storage.getProjectConsumables(projectId);
      res.json(consumables);
    } catch (error) {
      console.error("Error getting project consumables:", error);
      res.status(500).json({ message: "Failed to get project consumables" });
    }
  },
);

projectsRoutes.post(
  "/api/projects/:projectId/consumables",
  requireAuth,
  requireRole(["admin", "project_manager", "employee"]),
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const { date, items } = req.body;

      if (!date || !items || !Array.isArray(items) || items.length === 0) {
        return res
          .status(400)
          .json({ message: "Date and items array are required" });
      }

      // Validate each item
      for (const item of items) {
        if (!item.quantity || item.quantity <= 0) {
          return res.status(400).json({
            message: "Each item must have a positive quantity",
          });
        }
        if (!item.inventoryItemId && !item.itemName) {
          return res.status(400).json({
            message:
              "Each item must have either an inventory item or a name for manual entry",
          });
        }
      }

      const result = await storage.createProjectConsumables(
        projectId,
        date,
        items,
        req.session.userId,
      );

      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating project consumables:", error);
      res.status(500).json({
        message: "Failed to record consumables usage",
        error: error.message,
      });
    }
  },
);

// UPDATE a manual consumable item
projectsRoutes.put(
  "/api/projects/:projectId/consumables/items/:itemId",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const itemId = parseInt(req.params.itemId);

      if (isNaN(projectId) || isNaN(itemId)) {
        return res.status(400).json({ message: "Invalid ID parameters" });
      }

      const { itemName, itemUnit, quantity, unitCost } = req.body;

      if (!itemName || !quantity || quantity <= 0) {
        return res
          .status(400)
          .json({ message: "Invalid item data provided" });
      }

      const result = await storage.updateProjectConsumableItem(
        itemId,
        projectId,
        {
          itemName,
          itemUnit: itemUnit || "pcs",
          quantity,
          unitCost: unitCost || 0,
        },
      );

      res.json(result);
    } catch (error: any) {
      console.error("Error updating consumable item:", error);
      res.status(500).json({
        message: error.message || "Failed to update consumable item",
      });
    }
  },
);

projectsRoutes.post(
  "/api/projects/:projectId/consumables/goods-issue",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }
      const { consumableIds } = req.body;
      if (
        !consumableIds ||
        !Array.isArray(consumableIds) ||
        consumableIds.length === 0
      ) {
        return res
          .status(400)
          .json({ message: "consumableIds array is required" });
      }
      const result = await storage.createConsumablesGoodsIssue(
        projectId,
        consumableIds,
        req.session.userId,
      );
      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating consumables goods issue:", error);
      res.status(500).json({
        message: "Failed to create goods issue",
        error: error.message,
      });
    }
  },
);

projectsRoutes.get(
  "/api/projects/activities/activities",
  requireAuth,
  async (req, res) => {
    try {
      // Return empty array for now - implement based on your requirements
      res.json([]);
    } catch (error) {
      console.error("Error getting activities:", error);
      res.status(500).json({ message: "Failed to get activities" });
    }
  },
);

projectsRoutes.get(
  "/api/projects/activities/employees",
  requireAuth,
  async (req, res) => {
    try {
      // Return empty array for now - implement based on your requirements
      res.json([]);
    } catch (error) {
      console.error("Error getting employees:", error);
      res.status(500).json({ message: "Failed to get employees" });
    }
  },
);

projectsRoutes.get(
  "/api/projects/activities/consumables",
  requireAuth,
  async (req, res) => {
    try {
      // Return empty array for now - implement based on your requirements
      res.json([]);
    } catch (error) {
      console.error("Error getting consumables:", error);
      res.status(500).json({ message: "Failed to get consumables" });
    }
  },
);

projectsRoutes.post(
  "/api/projects/:projectId/activities",
  requireAuth,
  requireRole(["admin", "project_manager", "employee"]),
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);

      // employee is allowed this route, so membership decides which projects
      // they may log against.
      const hasAccess = await checkProjectAccess(
        projectId,
        req.session.userId!,
        req.session.userRole || "",
      );
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Ensure date is properly formatted
      const activityData = {
        ...req.body,
        projectId,
        date: new Date(req.body.date),
        photos: req.body.photos || [],
      };

      console.log("Activity data to validate:", activityData);

      const validatedData = insertDailyActivitySchema.parse(activityData);
      const activity = await storage.createDailyActivity(validatedData);
      res.status(201).json(activity);
    } catch (error) {
      console.error("Activity creation error:", error);
      if (error instanceof ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create daily activity" });
    }
  },
);

// Storage looks activities up by id alone, so the id in the path has to be
// checked against the project in the path. Without it an activity can be
// changed or removed through another project's URL.
async function activityBelongsToProject(
  activityId: number,
  projectId: number,
): Promise<boolean> {
  const rows = await db
    .select({ id: dailyActivities.id })
    .from(dailyActivities)
    .where(
      and(
        eq(dailyActivities.id, activityId),
        eq(dailyActivities.projectId, projectId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

projectsRoutes.put(
  "/api/projects/:projectId/activities/:activityId",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const activityId = parseInt(req.params.activityId);
      const projectId = parseInt(req.params.projectId);
      if (isNaN(activityId) || isNaN(projectId)) {
        return res
          .status(400)
          .json({ message: "Invalid project or activity ID" });
      }

      if (!(await activityBelongsToProject(activityId, projectId))) {
        return res.status(404).json({ message: "Daily activity not found" });
      }

      const activityData = {
        ...req.body,
        projectId,
        date: req.body.date ? new Date(req.body.date) : undefined,
      };

      const validatedData = insertDailyActivitySchema
        .partial()
        .parse(activityData);

      const activity = await storage.updateDailyActivity(
        activityId,
        validatedData,
      );
      if (!activity) {
        return res.status(404).json({ message: "Daily activity not found" });
      }

      // Enforce one remark per day: if this record has a remark, clear remarks
      // from all other records for the same project and date
      if (activity.remarks && activity.date) {
        const activityDate = new Date(activity.date);
        const startOfDay = new Date(activityDate);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(activityDate);
        endOfDay.setUTCHours(23, 59, 59, 999);

        await db
          .update(dailyActivities)
          .set({ remarks: "" })
          .where(
            and(
              eq(dailyActivities.projectId, projectId),
              gte(
                dailyActivities.date,
                sql`${startOfDay.toISOString()}::timestamp`,
              ),
              lte(
                dailyActivities.date,
                sql`${endOfDay.toISOString()}::timestamp`,
              ),
              ne(dailyActivities.id, activityId),
            ),
          );
      }

      res.json(activity);
    } catch (error) {
      console.error("Activity update error:", error);
      res.status(500).json({ message: "Failed to update daily activity" });
    }
  },
);

projectsRoutes.delete(
  "/api/projects/:projectId/activities/:activityId",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const activityId = parseInt(req.params.activityId);
      const projectId = parseInt(req.params.projectId);
      if (isNaN(activityId) || isNaN(projectId)) {
        return res
          .status(400)
          .json({ message: "Invalid project or activity ID" });
      }

      if (!(await activityBelongsToProject(activityId, projectId))) {
        return res.status(404).json({ message: "Daily activity not found" });
      }

      // A photo group pointing at this activity holds a foreign key to it, so
      // deleting would fail in the database and surface as a bare 500. Say what
      // is in the way instead — the link can be removed from the Photos tab.
      const groups = await storage.getProjectPhotoGroups(projectId);
      const linkedGroups = groups.filter(
        (g) => (g as any).dailyActivityId === activityId,
      );
      if (linkedGroups.length > 0) {
        return res.status(409).json({
          message: `Photos are linked to this activity (${linkedGroups
            .map((g) => g.title)
            .join(", ")}). Remove the link or delete the photo group first.`,
        });
      }

      const success = await storage.deleteDailyActivity(activityId);
      if (!success) {
        return res.status(404).json({ message: "Daily activity not found" });
      }
      res.json({ message: "Daily activity deleted successfully" });
    } catch (error) {
      console.error("Activity deletion error:", error);
      res.status(500).json({ message: "Failed to delete daily activity" });
    }
  },
);

// Asset assignment routes
projectsRoutes.post(
  "/api/projects/:id/asset-assignments",
  requireAuth,
  async (req: any, res: any) => {
    try {
      const projectId = parseInt(req.params.id);
      const { assetId, startDate, endDate, monthlyRate } = req.body;

      if (!assetId || !startDate || !endDate || !monthlyRate) {
        return res.status(400).json({
          message:
            "Asset ID, start date, end date, and monthly rate are required",
        });
      }

      // Validate that the provided monthly rate matches the asset's rate
      const asset = await storage.getAssetInventoryInstance(assetId);
      if (!asset) {
        return res.status(404).json({ message: "Asset instance not found" });
      }

      const assetMonthlyRate = asset.monthlyRentalAmount
        ? parseFloat(asset.monthlyRentalAmount)
        : 0;
      if (Math.abs(monthlyRate - assetMonthlyRate) > 0.01) {
        // Allow small floating point differences
        return res.status(400).json({
          message: `Monthly rate mismatch. Asset rate is ${assetMonthlyRate}, provided rate is ${monthlyRate}`,
        });
      }

      // Calculate total cost based on monthly rate and duration (pro-rated)
      const start = new Date(startDate);
      const end = new Date(endDate);
      const totalCost = await storage.calculateAssetRentalCost(
        start,
        end,
        parseFloat(monthlyRate),
      );

      const assignmentData = {
        projectId,
        assetId: parseInt(assetId),
        startDate: start,
        endDate: end,
        monthlyRate: monthlyRate.toString(),
        totalCost: totalCost.toString(),
        assignedBy: req.session.userId,
      };

      const assignment =
        await storage.createProjectAssetAssignment(assignmentData);
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error assigning asset to project:", error);
      res.status(500).json({ message: "Failed to assign asset to project" });
    }
  },
);

projectsRoutes.put(
  "/api/projects/:projectId/asset-assignments/:assignmentId",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const assignmentId = parseInt(req.params.assignmentId);
      const { startDate, endDate, monthlyRate } = req.body;

      if (!startDate || !endDate || !monthlyRate) {
        return res.status(400).json({
          message: "Start date, end date, and monthly rate are required",
        });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (end <= start) {
        return res
          .status(400)
          .json({ message: "End date must be after start date" });
      }

      const totalCost = await storage.calculateAssetRentalCost(
        start,
        end,
        parseFloat(monthlyRate),
      );

      const assignmentData = {
        startDate: start,
        endDate: end,
        monthlyRate: monthlyRate.toString(),
        totalCost: totalCost.toString(),
      };

      const assignment = await storage.updateProjectAssetAssignment(
        assignmentId,
        assignmentData,
      );

      if (!assignment) {
        return res
          .status(404)
          .json({ message: "Asset assignment not found" });
      }

      res.json(assignment);
    } catch (error) {
      console.error("Error updating project asset assignment:", error);
      res.status(500).json({ message: "Failed to update asset assignment" });
    }
  },
);

projectsRoutes.delete(
  "/api/projects/:projectId/asset-assignments/:assignmentId",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const assignmentId = parseInt(req.params.assignmentId);
      const deleted =
        await storage.deleteProjectAssetAssignment(assignmentId);

      if (!deleted) {
        return res
          .status(404)
          .json({ message: "Asset assignment not found" });
      }

      res.json({ message: "Asset assignment deleted successfully" });
    } catch (error) {
      console.error("Error deleting project asset assignment:", error);
      res.status(500).json({ message: "Failed to delete asset assignment" });
    }
  },
);

// Asset Instance Assignment routes (NEW)
projectsRoutes.get(
  "/api/projects/:id/asset-instance-assignments",
  requireAuth,
  async (req: any, res: any) => {
    try {
      const projectId = parseInt(req.params.id);
      const assignments =
        await storage.getProjectAssetInstanceAssignments(projectId);
      res.json(assignments);
    } catch (error) {
      console.error(
        "Error getting project asset instance assignments:",
        error,
      );
      res
        .status(500)
        .json({ message: "Failed to get asset instance assignments" });
    }
  },
);

projectsRoutes.post(
  "/api/projects/:id/asset-instance-assignments",
  requireAuth,
  async (req: any, res: any) => {
    try {
      const projectId = parseInt(req.params.id);
      const { instanceId, startDate, endDate, notes, monthlyRate } = req.body;

      if (!instanceId || !startDate || !monthlyRate) {
        return res.status(400).json({
          message: "Instance ID, start date and monthly rate are required",
        });
      }

      // Get asset instance details
      const instance = await storage.getAssetInventoryInstance(instanceId);
      if (!instance) {
        return res.status(404).json({ message: "Asset instance not found" });
      }

      // Validate dates if endDate is provided
      if (endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end <= start) {
          return res.status(400).json({
            message: "End date must be after start date",
          });
        }
      }

      // Create assignment data
      const assignmentData = {
        projectId,
        assetTypeId: instance.assetTypeId,
        instanceId,
        barcode: instance.barcode,
        serialNumber: instance.serialNumber,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        monthlyRate: monthlyRate.toString(),
        status: "active",
        assignedBy: req.session.userId,
        notes: notes || null,
      };

      const assignment =
        await storage.createProjectAssetInstanceAssignment(assignmentData);
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error creating asset instance assignment:", error);
      res
        .status(500)
        .json({ message: "Failed to create asset instance assignment" });
    }
  },
);

projectsRoutes.put(
  "/api/projects/:projectId/asset-instance-assignments/:assignmentId",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const assignmentId = parseInt(req.params.assignmentId);
      const { startDate, endDate, status, notes, monthlyRate } = req.body;

      const updateData: any = {};

      if (startDate) {
        updateData.startDate = new Date(startDate);
      }
      if (endDate) {
        updateData.endDate = new Date(endDate);
      }
      if (status) {
        updateData.status = status;
      }
      if (notes !== undefined) {
        updateData.notes = notes;
      }
      if (monthlyRate) {
        updateData.monthlyRate = monthlyRate.toString();
      }

      // If status is being changed to completed, set returnedAt
      if (status === "completed" && !updateData.returnedAt) {
        updateData.returnedAt = new Date();
      }

      const updatedAssignment =
        await storage.updateProjectAssetInstanceAssignment(
          assignmentId,
          updateData,
        );

      if (!updatedAssignment) {
        return res
          .status(404)
          .json({ message: "Asset instance assignment not found" });
      }

      res.json(updatedAssignment);
    } catch (error) {
      console.error("Error updating asset instance assignment:", error);
      res
        .status(500)
        .json({ message: "Failed to update asset instance assignment" });
    }
  },
);

projectsRoutes.delete(
  "/api/projects/:projectId/asset-instance-assignments/:assignmentId",
  requireAuth,
  requireRole(["admin", "project_manager"]),
  async (req, res) => {
    try {
      const assignmentId = parseInt(req.params.assignmentId);
      const deleted =
        await storage.deleteProjectAssetInstanceAssignment(assignmentId);

      if (!deleted) {
        return res
          .status(404)
          .json({ message: "Asset instance assignment not found" });
      }

      res.json({ message: "Asset instance assignment deleted successfully" });
    } catch (error) {
      console.error("Error deleting asset instance assignment:", error);
      res
        .status(500)
        .json({ message: "Failed to delete asset instance assignment" });
    }
  },
);
