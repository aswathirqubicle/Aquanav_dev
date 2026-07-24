import { ReimbursementStorage } from "./reimbursement";
import {
  and,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import {
  customers,
  generalLedgerEntries,
  invoicePayments,
  projects,
  salesInvoices,
  salesQuotations,
} from "@shared/schema";
import { db } from "../db";

export class ReportStorage extends ReimbursementStorage {
  async getSalesStats(): Promise<{
    totalQuotations: number;
    totalInvoices: number;
    totalQuotationValue: string;
    totalInvoiceValue: string;
    totalReceivablesValue: string;
  }> {
    try {
      const [quotationStats] = await db
        .select({
          count: sql<number>`count(*)`,
          totalValue: sql<string>`COALESCE(SUM(${salesQuotations.totalAmount} * ${salesQuotations.exchangeRate}), 0)`,
        })
        .from(salesQuotations)
        .where(eq(salesQuotations.status, "approved"));

      const [invoiceStats] = await db
        .select({
          count: sql<number>`count(*)`,
          totalValue: sql<string>`COALESCE(SUM(${salesInvoices.totalAmount} * ${salesInvoices.exchangeRate}), 0)`,
          totalReceivables: sql<string>`COALESCE(SUM((${salesInvoices.totalAmount} - ${salesInvoices.paidAmount}) * ${salesInvoices.exchangeRate}), 0)`,
        })
        .from(salesInvoices)
        .where(
          and(
            ne(salesInvoices.status, "draft"),
            ne(salesInvoices.status, "pending_approval"),
            ne(salesInvoices.status, "rejected"),
            ne(salesInvoices.status, "cancelled"),
          ),
        );

      const [quotationCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(salesQuotations);

      return {
        totalQuotations: Number(quotationCount.count),
        totalInvoices: Number(invoiceStats.count),
        totalQuotationValue: String(quotationStats.totalValue),
        totalInvoiceValue: String(invoiceStats.totalValue),
        totalReceivablesValue: String(invoiceStats.totalReceivables),
      };
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getSalesStats: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getSalesStats",
        severity: "error",
      });
      throw error;
    }
  }

  async getPayables(): Promise<any[]> {
    try {
      const result = await db
        .select({
          id: generalLedgerEntries.id,
          description: generalLedgerEntries.description,
          amount: generalLedgerEntries.creditAmount, // Aliasing credit_amount as amount
          supplierName: generalLedgerEntries.entityName, // Aliasing entity_name as supplierName
          projectId: generalLedgerEntries.projectId,
          projectTitle: projects.title, // Selecting from joined projects table
          invoiceNumber: generalLedgerEntries.invoiceNumber,
          transactionDate: generalLedgerEntries.transactionDate,
          dueDate: generalLedgerEntries.dueDate,
          status: generalLedgerEntries.status,
          createdAt: generalLedgerEntries.createdAt,
        })
        .from(generalLedgerEntries)
        .leftJoin(projects, eq(generalLedgerEntries.projectId, projects.id))
        .where(eq(generalLedgerEntries.entryType, "payable"))
        .orderBy(desc(generalLedgerEntries.transactionDate));

      return result;
    } catch (error: any) {
      await this.createErrorLog({
        message: "Error in getPayables: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPayables",
        severity: "error",
      });
      throw error;
    }
  }

  async getReceivables(filters?: {
    customerId?: number;
    projectId?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<any[]> {
    try {
      const queryConditions = [
        ne(salesInvoices.status, "draft"),
        ne(salesInvoices.status, "rejected"),
        ne(salesInvoices.status, "pending_approval"),
        or(
          eq(salesInvoices.status, "approved"),
          eq(salesInvoices.status, "partially_paid"),
          eq(salesInvoices.status, "paid"),
          isNotNull(salesInvoices.invoiceNumber),
        ),
      ];

      if (filters?.customerId) {
        queryConditions.push(eq(salesInvoices.customerId, filters.customerId));
      }
      if (filters?.projectId) {
        if (filters.projectId === -1) {
          queryConditions.push(isNull(salesInvoices.projectId));
        } else {
          queryConditions.push(eq(salesInvoices.projectId, filters.projectId));
        }
      }
      if (filters?.startDate) {
        queryConditions.push(gte(salesInvoices.invoiceDate, filters.startDate));
      }
      if (filters?.endDate) {
        queryConditions.push(lte(salesInvoices.invoiceDate, filters.endDate));
      }

      // Get all invoices that could have receivables (exclude draft and rejected)
      const invoicesList = await db
        .select()
        .from(salesInvoices)
        .leftJoin(customers, eq(salesInvoices.customerId, customers.id))
        .where(and(...queryConditions))
        .orderBy(desc(salesInvoices.invoiceDate));
      // Get all payments for sales invoices
      const paymentsList = await db.select().from(invoicePayments);

      // Calculate outstanding amounts for each invoice
      const receivables = invoicesList
        .map((row) => {
          const invoice = row.sales_invoices;
          const customer = row.customers;

          const totalAmount = parseFloat(invoice.totalAmount || "0");
          // Use paidAmount from invoice or calculate from payments
          const invoicePaidAmount = parseFloat(invoice.paidAmount || "0");
          const paymentsPaidAmount = paymentsList
            .filter((p) => p.invoiceId === invoice.id)
            .reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);
          const paidAmount = Math.max(invoicePaidAmount, paymentsPaidAmount);
          const outstandingAmount = totalAmount - paidAmount;

          // Check if overdue
          const today = new Date();
          const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
          const isOverdue = dueDate && dueDate < today && outstandingAmount > 0;

          return {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            customerId: invoice.customerId,
            customerName: customer?.name || "Unknown Customer",
            totalAmount: totalAmount.toFixed(2),
            paidAmount: paidAmount.toFixed(2),
            outstandingAmount: outstandingAmount.toFixed(2),
            invoiceDate: invoice.invoiceDate,
            dueDate: invoice.dueDate,
            status:
              paidAmount >= totalAmount
                ? "paid"
                : paidAmount > 0
                  ? "partial"
                  : "unpaid",
            isOverdue,
          };
        })
        .filter((r) => parseFloat(r.outstandingAmount) > 0);

      return receivables;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getReceivables: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getReceivables",
        severity: "error",
      });
      throw error;
    }
  }
}
