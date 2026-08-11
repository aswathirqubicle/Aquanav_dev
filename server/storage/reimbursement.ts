import { PayrollStorage } from "./payroll";
import {
  InsertReimbursement,
  Reimbursement,
  employees,
  projects,
  reimbursements,
  users,
} from "@shared/schema";
import {
  and,
  desc,
  eq,
  sql,
} from "drizzle-orm";
import { db } from "../db";

export class ReimbursementStorage extends PayrollStorage {
  // Reimbursement Methods
  async getReimbursements(filters?: {
    userId?: number;
    status?: string;
    employeeId?: number;
  }): Promise<any[]> {
    try {
      let query = db
        .select({
          id: reimbursements.id,
          employeeId: reimbursements.employeeId,
          employeeName: sql<string>`COALESCE(CONCAT(${employees.firstName}, ' ', ${employees.lastName}), 'Unknown')`,
          userId: reimbursements.userId,
          userName: users.username,
          userRole: users.role,
          projectId: reimbursements.projectId,
          projectName: projects.title,
          amount: reimbursements.amount,
          description: reimbursements.description,
          category: reimbursements.category,
          originalExpenseDate: reimbursements.originalExpenseDate,
          submissionTimestamp: reimbursements.submissionTimestamp,
          status: reimbursements.status,
          approvedById: reimbursements.approvedById,
          approvalTimestamp: reimbursements.approvalTimestamp,
          rejectionReason: reimbursements.rejectionReason,
          payrollMonth: reimbursements.payrollMonth,
          payrollYear: reimbursements.payrollYear,
          attachments: reimbursements.attachments,
        })
        .from(reimbursements)
        .leftJoin(employees, eq(reimbursements.employeeId, employees.id))
        .leftJoin(users, eq(reimbursements.userId, users.id))
        .leftJoin(projects, eq(reimbursements.projectId, projects.id))
        .orderBy(desc(reimbursements.submissionTimestamp));

      const result = await query;

      // Apply filters in-memory for simplicity
      let filtered = result;
      if (filters?.userId) {
        filtered = filtered.filter((r: any) => r.userId === filters.userId);
      }
      if (filters?.status) {
        filtered = filtered.filter((r: any) => r.status === filters.status);
      }
      if (filters?.employeeId) {
        filtered = filtered.filter(
          (r: any) => r.employeeId === filters.employeeId,
        );
      }

      // Get approver names. Employee name where the approver's login is linked
      // to an employee row, else the username — same as the sales and purchase
      // documents, so the same person reads the same way everywhere.
      const enriched = await Promise.all(
        filtered.map(async (r: any) => {
          if (r.approvedById) {
            const [approver] = await db
              .select({
                name: sql<string>`COALESCE(NULLIF(CONCAT(${employees.firstName}, ' ', ${employees.lastName}), ' '), ${users.username}, '')`,
              })
              .from(users)
              .leftJoin(employees, eq(users.id, employees.userId))
              .where(eq(users.id, r.approvedById));
            return { ...r, approvedByName: approver?.name || "Unknown" };
          }
          return { ...r, approvedByName: null };
        }),
      );

      return enriched;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getReimbursements: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getReimbursements",
        severity: "error",
      });
      throw error;
    }
  }

  async getReimbursement(id: number): Promise<any | undefined> {
    try {
      const [result] = await db
        .select({
          id: reimbursements.id,
          employeeId: reimbursements.employeeId,
          userId: reimbursements.userId,
          userRole: users.role,
          projectId: reimbursements.projectId,
          amount: reimbursements.amount,
          description: reimbursements.description,
          category: reimbursements.category,
          originalExpenseDate: reimbursements.originalExpenseDate,
          submissionTimestamp: reimbursements.submissionTimestamp,
          status: reimbursements.status,
          approvedById: reimbursements.approvedById,
          approvalTimestamp: reimbursements.approvalTimestamp,
          rejectionReason: reimbursements.rejectionReason,
          payrollMonth: reimbursements.payrollMonth,
          payrollYear: reimbursements.payrollYear,
          attachments: reimbursements.attachments,
        })
        .from(reimbursements)
        .leftJoin(users, eq(reimbursements.userId, users.id))
        .where(eq(reimbursements.id, id));
      return result;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getReimbursement (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getReimbursement",
        severity: "error",
      });
      throw error;
    }
  }

  async createReimbursement(data: InsertReimbursement): Promise<Reimbursement> {
    try {
      const [result] = await db
        .insert(reimbursements)
        .values({
          ...data,
          status: "pending",
        })
        .returning();
      return result;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createReimbursement: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createReimbursement",
        severity: "error",
      });
      throw error;
    }
  }

  async updateReimbursement(
    id: number,
    data: {
      amount?: string;
      description?: string;
      originalExpenseDate?: string;
      projectId?: number | null;
      attachments?: string[];
    },
  ): Promise<Reimbursement | undefined> {
    try {
      const [result] = await db
        .update(reimbursements)
        .set(data)
        .where(eq(reimbursements.id, id))
        .returning();
      return result;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateReimbursement (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateReimbursement",
        severity: "error",
      });
      throw error;
    }
  }

  async approveReimbursement(
    id: number,
    approverId: number,
  ): Promise<Reimbursement | undefined> {
    try {
      const reimbursement = await this.getReimbursement(id);
      if (!reimbursement) {
        throw new Error("Reimbursement not found");
      }

      // payrollMonth/payrollYear are deliberately NOT set here. Approval no
      // longer predicts which payroll will carry the claim — it used to stamp
      // the current or next month off a 20th-of-month cutoff, which stranded
      // claims both ways: approved after the 20th they skipped a payroll that
      // had not run yet, and approved before it into a month already generated
      // they were never picked up at all. The stamp is now applied by
      // generateMonthlyPayroll when the claim actually lands on a payslip, so
      // NULL means "approved, awaiting the next payroll run".
      // If a project is selected, trigger full cost recalculation (includes reimbursements)
      if (reimbursement.projectId) {
        await this.recalculateProjectCost(reimbursement.projectId);
      }

      const [result] = await db
        .update(reimbursements)
        .set({
          status: "approved",
          approvedById: approverId,
          approvalTimestamp: new Date(),
        })
        .where(eq(reimbursements.id, id))
        .returning();

      return result;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in approveReimbursement (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "approveReimbursement",
        severity: "error",
      });
      throw error;
    }
  }

  async rejectReimbursement(
    id: number,
    approverId: number,
    reason?: string,
  ): Promise<Reimbursement | undefined> {
    try {
      const [result] = await db
        .update(reimbursements)
        .set({
          status: "rejected",
          approvedById: approverId,
          approvalTimestamp: new Date(),
          rejectionReason: reason || "No reason provided",
        })
        .where(eq(reimbursements.id, id))
        .returning();
      return result;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in rejectReimbursement (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "rejectReimbursement",
        severity: "error",
      });
      throw error;
    }
  }

  async getReimbursementsForPayroll(
    month: number,
    year: number,
  ): Promise<any[]> {
    try {
      const result = await db
        .select({
          id: reimbursements.id,
          employeeId: reimbursements.employeeId,
          employeeName: sql<string>`COALESCE(CONCAT(${employees.firstName}, ' ', ${employees.lastName}), 'Unknown')`,
          amount: reimbursements.amount,
          description: reimbursements.description,
          originalExpenseDate: reimbursements.originalExpenseDate,
        })
        .from(reimbursements)
        .leftJoin(employees, eq(reimbursements.employeeId, employees.id))
        .where(
          and(
            eq(reimbursements.status, "approved"),
            eq(reimbursements.payrollMonth, month),
            eq(reimbursements.payrollYear, year),
          ),
        );
      return result;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getReimbursementsForPayroll (${month}/${year}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getReimbursementsForPayroll",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteReimbursement(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(reimbursements)
        .where(eq(reimbursements.id, id));
      return (result.count ?? 0) > 0;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deleteReimbursement (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteReimbursement",
        severity: "error",
      });
      throw error;
    }
  }
}
