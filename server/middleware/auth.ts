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

// ─── Own-document access check ──────────────────────────────────────────────
// Sales quotations and purchase orders are visible to a project manager only
// when they raised them; admin and finance see everything. Same rule the
// purchase request list already applies through requestedBy.
//
// A null creator belongs to nobody, so it is nobody's to open. Every row that
// predates created_by_id is null, which is what keeps the existing documents
// out of a project manager's view.
export function canAccessOwnDocument(
  createdById: number | null | undefined,
  userId: number | undefined,
  userRole: string | undefined,
): boolean {
  if (userRole === "admin" || userRole === "finance") return true;
  return !!createdById && !!userId && createdById === userId;
}

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
