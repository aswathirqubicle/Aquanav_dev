import { Router } from "express";
import path from "path";
import {
  and,
  asc,
  eq,
  inArray,
} from "drizzle-orm";
import {
  checkProjectAccess,
  requireAuth,
} from "../middleware/auth";
import {
  dailyActivities,
  photos,
} from "../../migrations/schema";
import { db } from "../db";
import { generateCompletionReportHTML } from "../documents/completion-report-html";
import { generateConsumablePrintHTML } from "../documents/consumable-print-html";
import { generateProjectPrintHTML } from "../documents/project-print-html";
import { imageSize } from "image-size";
import {
  projectPhotoGroups,
  projectPhotos,
} from "@shared/schema";
import { storage } from "../storage";
import { upload } from "../middleware/upload";

export const printRoutes = Router();

// Print Daily report
printRoutes.post(
  "/api/print/project",
  requireAuth,
  upload.single("reportImage"),
  async (req, res) => {
    try {
      const {
        id,
        fromDate,
        toDate,
        reportDate,
        includeRemainingDays,
        includeHBMHours,
      } = req.body;

      const project = await storage.getProjectPrint(
        id,
        fromDate,
        toDate,
        reportDate,
        includeRemainingDays,
        includeHBMHours,
      );

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      if (req.file) {
        project.reportImage = `/${req.file.path}`;
      }

      project.reportTitle = "WEEKLY REPORT";

      if (fromDate === toDate) project.reportTitle = "DAILY REPORT";

      project.company = await storage.getCompany();

      // 🔥 Generate HTML instead of JSON
      const html = generateProjectPrintHTML(project);

      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to generate report" });
    }
  },
);

printRoutes.post("/api/print/consumables", requireAuth, async (req, res) => {
  try {
    const { id, fromDate, toDate, reportDate } = req.body;

    if (!id || !fromDate || !toDate) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const projectId = Number(id);
    if (isNaN(projectId)) {
      return res.status(400).json({ message: "Invalid project id" });
    }

    const project = await storage.getConsumablesPrint(
      projectId,
      fromDate,
      toDate,
      reportDate,
    );

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const company = await storage.getCompany();

    const html = generateConsumablePrintHTML({
      ...project,
      company,
    });

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (error) {
    console.error("Consumables print error:", error);
    res.status(500).json({ message: "Failed to generate report" });
  }
});

// ─── Completion report: generate HTML ───────────────────────────────────────
printRoutes.post("/api/print/project-completion", requireAuth, async (req, res) => {
  try {
    const {
      projectId,
      selectedPhotoIds = [],
      sections = {},
      reportTitle,
    } = req.body;
    if (!projectId)
      return res.status(400).json({ message: "projectId required" });

    // Project metadata + access check
    const project = await storage.getProject(parseInt(projectId));
    if (!project)
      return res.status(404).json({ message: "Project not found" });
    const userRole = req.session.userRole || "";
    const userId = req.session.userId!;
    const hasAccess = await checkProjectAccess(
      parseInt(projectId),
      userId,
      userRole,
    );
    if (!hasAccess) return res.status(403).json({ message: "Access denied" });

    // Base URL for absolute photo paths
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    // All daily activities (with isStoppage) — no completedTasks filter so stoppage days are counted correctly
    const allActivities = await db
      .select({
        id: dailyActivities.id,
        date: dailyActivities.date,
        location: dailyActivities.location,
        completedTasks: dailyActivities.completedTasks,
        isStoppage: dailyActivities.isStoppage,
        stoppageReason: dailyActivities.stoppageReason,
      })
      .from(dailyActivities)
      .where(eq(dailyActivities.projectId, parseInt(projectId)))
      .orderBy(asc(dailyActivities.date));

    // Compute stats
    const startDate = project.startDate ? new Date(project.startDate) : null;
    const endDate =
      project.actualEndDate || project.plannedEndDate
        ? new Date((project.actualEndDate || project.plannedEndDate) as any)
        : new Date();
    const totalDays = startDate
      ? Math.max(
          Math.round((endDate.getTime() - startDate.getTime()) / 86400000) +
            1,
          0,
        )
      : 0;

    const activeDateSet = new Set<string>();
    const stopDateSet = new Set<string>();
    const locationDayMap = new Map<string, Set<string>>();
    const stoppageReasons: string[] = [];

    for (const a of allActivities) {
      const dateStr = new Date(a.date).toISOString().split("T")[0];
      if (a.isStoppage) {
        stopDateSet.add(dateStr);
        if (a.stoppageReason) stoppageReasons.push(a.stoppageReason);
      } else {
        activeDateSet.add(dateStr);
        if (a.location) {
          if (!locationDayMap.has(a.location))
            locationDayMap.set(a.location, new Set());
          locationDayMap.get(a.location)!.add(dateStr);
        }
      }
    }

    const activeDays = activeDateSet.size;
    const stopDays = stopDateSet.size;
    const locationDays = Array.from(locationDayMap.entries())
      .map(([loc, days]) => ({
        location: loc,
        days: days.size,
      }))
      .sort((a, b) => b.days - a.days);

    // Top stoppage reason (most frequent)
    const reasonFreq: Record<string, number> = {};
    for (const r of stoppageReasons) {
      reasonFreq[r] = (reasonFreq[r] || 0) + 1;
    }
    const topStoppageReason =
      Object.entries(reasonFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

    // Consumables (manual entries only, all dates)
    const consumableRows = await storage.getProjectConsumables(
      parseInt(projectId),
    );
    const consumableAgg = new Map<
      string,
      { itemName: string; totalQty: number; itemUnit: string }
    >();
    for (const entry of consumableRows) {
      for (const item of entry.items) {
        if (item.inventoryItemId) continue; // skip inventory-linked
        const key = `${item.itemName}||${item.itemUnit}`;
        if (!consumableAgg.has(key)) {
          consumableAgg.set(key, {
            itemName: item.itemName || "",
            totalQty: 0,
            itemUnit: item.itemUnit || "",
          });
        }
        consumableAgg.get(key)!.totalQty += Number(item.quantity);
      }
    }
    const consumables = Array.from(consumableAgg.values());

    // Selected photos with group + activity metadata
    let photosByLocation: any[] = [];
    if (selectedPhotoIds.length > 0) {
      const selectedIds = selectedPhotoIds.map(Number);
      const photos = await db
        .select({
          id: projectPhotos.id,
          filePath: projectPhotos.filePath,
          filename: projectPhotos.filename,
          originalName: projectPhotos.originalName,
          groupId: projectPhotos.groupId,
          groupTitle: projectPhotoGroups.title,
          groupDescription: projectPhotoGroups.description,
          groupDate: projectPhotoGroups.date,
          activityId: projectPhotoGroups.dailyActivityId,
          activityDate: dailyActivities.date,
          activityLocation: dailyActivities.location,
        })
        .from(projectPhotos)
        .innerJoin(
          projectPhotoGroups,
          eq(projectPhotos.groupId, projectPhotoGroups.id),
        )
        .leftJoin(
          dailyActivities,
          eq(projectPhotoGroups.dailyActivityId, dailyActivities.id),
        )
        .where(
          and(
            inArray(projectPhotos.id, selectedIds),
            eq(projectPhotoGroups.projectId, parseInt(projectId)),
          ),
        );

      // Restore user-defined order: sort fetched photos by their position in selectedIds
      const selectedIdOrder = new Map<number, number>(
        selectedIds.map((id: number, idx: number) => [id, idx]),
      );
      photos.sort(
        (a, b) =>
          (selectedIdOrder.get(a.id) ?? 0) - (selectedIdOrder.get(b.id) ?? 0),
      );

      // Group by location → groups
      const locationMap = new Map<string, Map<number, any>>();
      for (const p of photos) {
        const loc = p.activityLocation || null;
        const locKey = loc || "__GENERAL__";
        if (!locationMap.has(locKey)) locationMap.set(locKey, new Map());
        const groupMap = locationMap.get(locKey)!;
        if (!groupMap.has(p.groupId!)) {
          groupMap.set(p.groupId!, {
            groupId: p.groupId,
            title: p.groupTitle,
            description: p.groupDescription,
            date: p.groupDate,
            activityDate: p.activityDate,
            photos: [],
          });
        }
        const storedPath = p.filePath || "";
        // Build absolute URL for img src
        const absFilePath = storedPath
          ? storedPath.startsWith("http")
            ? storedPath
            : `${baseUrl}${storedPath.startsWith("/") ? "" : "/"}${storedPath}`
          : "";
        // Pre-compute aspect ratio from local filesystem path so the HTML generator
        // never needs to do filesystem I/O.  Stored paths look like "/uploads/..." so
        // we strip the leading slash before joining with cwd.
        let aspectRatio = 1.5; // landscape default
        try {
          const relPath = storedPath.startsWith("/")
            ? storedPath.slice(1)
            : storedPath;
          const fullLocalPath = path.join(process.cwd(), relPath);
          const dims = imageSize(fullLocalPath);
          if (dims.width && dims.height)
            aspectRatio = dims.width / dims.height;
        } catch {}
        groupMap.get(p.groupId!)!.photos.push({
          id: p.id,
          filePath: absFilePath,
          aspectRatio,
          filename: p.filename,
        });
      }

      // Build ordered array: named locations first (sorted by first seen), then GENERAL
      const namedLocations: any[] = [];
      const generalGroups: any[] = [];
      for (const [locKey, groupMap] of locationMap.entries()) {
        const groups = Array.from(groupMap.values());
        if (locKey === "__GENERAL__") {
          generalGroups.push(...groups);
        } else {
          namedLocations.push({ location: locKey, groups });
        }
      }
      photosByLocation = [
        ...namedLocations,
        ...(generalGroups.length
          ? [{ location: null, groups: generalGroups }]
          : []),
      ];
    }

    const company = await storage.getCompany();

    // Convert vessel image stored path to absolute URL for the HTML generator
    const rawVesselImage = (project as any).vesselImage || "";
    const vesselImageUrl = rawVesselImage
      ? rawVesselImage.startsWith("http")
        ? rawVesselImage
        : `${baseUrl}${rawVesselImage.startsWith("/") ? "" : "/"}${rawVesselImage}`
      : "";

    const html = generateCompletionReportHTML({
      project: {
        ...project,
        customerName: (project as any).customerName,
        vesselImageUrl,
      },
      company,
      sections,
      stats: {
        totalDays,
        activeDays,
        stopDays,
        locationDays,
        topStoppageReason,
      },
      photosByLocation,
      consumables,
      reportTitle: reportTitle || project.title,
    });

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (error) {
    console.error("Completion report error:", error);
    res.status(500).json({ message: "Failed to generate completion report" });
  }
});

printRoutes.post(
  "/api/print/projectbk",
  requireAuth,
  upload.single("reportImage"),
  async (req, res) => {
    try {
      const {
        id,
        fromDate,
        toDate,
        reportDate,
        includeRemainingDays,
        includeHBMHours,
      } = req.body;
      const project = await storage.getProjectPrint(
        id,
        fromDate,
        toDate,
        reportDate,
        includeRemainingDays,
        includeHBMHours,
      );

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      if (req.file) {
        project.reportImage = `/${req.file.path}`;
      }
      project.company = await storage.getCompany();

      res.json(project);
    } catch (error) {
      res.status(500).json({ message: "Failed to get project" });
    }
  },
);
