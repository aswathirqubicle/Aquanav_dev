import { Router } from "express";
import { and, count, countDistinct, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "../db";
import {
  payrollEntries,
  purchaseInvoices,
  purchaseOrders,
  purchaseRequests,
  reimbursements,
  salesInvoices,
  salesQuotations,
  users,
} from "@shared/schema";
import { requireAuth } from "../middleware/auth";

export const approvalsRoutes = Router();

// How many documents are waiting for the logged-in user's approval, per
// section, for the side menu badges. Each section counts only for roles its
// approve endpoint accepts, and in the state that endpoint approves from:
//
//   purchase requests   pending           admin, finance
//   purchase orders     pending_approval  admin
//   purchase invoices   pending_approval  admin
//   sales quotations    pending_approval  admin
//   sales invoices      pending_approval  admin  (Draft → Submit → this)
//   reimbursements      pending           admin, finance — but finance can't
//                                          approve a finance user's claim, so
//                                          those don't count for finance.
//   payroll             draft / generated admin, finance — counted as MONTHS
//                                          with any such entry, not entries,
//                                          since payroll is reviewed by period.
//                                          There is no /approve route: the
//                                          Payroll page sets status "approved"
//                                          through PUT /api/payroll/:id.
//
// Keep this in step with the requireRole lists on those approve routes.
type Counts = {
  purchaseRequests: number;
  purchaseOrders: number;
  purchaseInvoices: number;
  salesQuotations: number;
  salesInvoices: number;
  reimbursements: number;
  payroll: number;
};

// Months (year + month) that still have an entry waiting for approval.
const countPendingPayrollMonths = async () => {
  const [row] = await db
    .select({
      n: countDistinct(
        sql`(${payrollEntries.year}, ${payrollEntries.month})`,
      ),
    })
    .from(payrollEntries)
    .where(inArray(payrollEntries.status, ["draft", "generated"]));
  return Number(row?.n ?? 0);
};

const countWhere = async (table: any, where: any) => {
  const [row] = await db.select({ n: count() }).from(table).where(where);
  return Number(row?.n ?? 0);
};

approvalsRoutes.get(
  "/api/approvals/pending-counts",
  requireAuth,
  async (req, res) => {
    const role = req.session.userRole;
    const counts: Counts = {
      purchaseRequests: 0,
      purchaseOrders: 0,
      purchaseInvoices: 0,
      salesQuotations: 0,
      salesInvoices: 0,
      reimbursements: 0,
      payroll: 0,
    };

    try {
      if (role === "admin") {
        const [pr, po, pi, sq, si, rb, pay] = await Promise.all([
          countWhere(purchaseRequests, eq(purchaseRequests.status, "pending")),
          countWhere(purchaseOrders, eq(purchaseOrders.status, "pending_approval")),
          countWhere(purchaseInvoices, eq(purchaseInvoices.status, "pending_approval")),
          countWhere(salesQuotations, eq(salesQuotations.status, "pending_approval")),
          countWhere(salesInvoices, eq(salesInvoices.status, "pending_approval")),
          countWhere(reimbursements, eq(reimbursements.status, "pending")),
          countPendingPayrollMonths(),
        ]);
        Object.assign(counts, {
          purchaseRequests: pr,
          purchaseOrders: po,
          purchaseInvoices: pi,
          salesQuotations: sq,
          salesInvoices: si,
          reimbursements: rb,
          payroll: pay,
        });
      } else if (role === "finance") {
        const [pr, [rb], pay] = await Promise.all([
          countWhere(purchaseRequests, eq(purchaseRequests.status, "pending")),
          db
            .select({ n: count() })
            .from(reimbursements)
            .innerJoin(users, eq(users.id, reimbursements.userId))
            .where(
              and(
                eq(reimbursements.status, "pending"),
                ne(users.role, "finance"),
              ),
            ),
          countPendingPayrollMonths(),
        ]);
        counts.purchaseRequests = pr;
        counts.reimbursements = Number(rb?.n ?? 0);
        counts.payroll = pay;
      }

      res.json(counts);
    } catch (error) {
      console.error("Error counting pending approvals:", error);
      res.status(500).json({ message: "Failed to count pending approvals" });
    }
  },
);
