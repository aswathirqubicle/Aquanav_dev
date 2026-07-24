import { and, eq } from "drizzle-orm";
import { storage } from "../storage";
import { db } from "../db";
import { employees } from "../../migrations/schema";
import { projectEmployees } from "@shared/schema";

// Auth middleware
export const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
};

export const requireRole = (roles: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.session.userRole || !roles.includes(req.session.userRole)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
};

// ─── Completion report: project-level access check helper ───────────────────
export async function checkProjectAccess(
  projectId: number,
  userId: number,
  userRole: string,
): Promise<boolean> {
  if (["admin", "finance", "project_manager"].includes(userRole)) return true;
  // Check if user is the project creator
  const proj = await storage.getProject(projectId);
  if (proj && (proj as any).createdBy === userId) return true;
  // Resolve userId → employees.id (employees.userId = users.id)
  const empRows = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.userId, userId))
    .limit(1);
  if (empRows.length === 0) return false;
  const employeeId = empRows[0].id;
  // Verify that employee is assigned to this project
  const assignments = await db
    .select({ id: projectEmployees.id })
    .from(projectEmployees)
    .where(
      and(
        eq(projectEmployees.projectId, projectId),
        eq(projectEmployees.employeeId, employeeId),
      ),
    )
    .limit(1);
  return assignments.length > 0;
}
