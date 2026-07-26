import { ReimbursementStorage } from "./reimbursement";
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  ne,
  sql,
} from "drizzle-orm";
import {
  customers,
  generalLedgerEntries,
  invoicePayments,
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

  async getReceivables(filters?: {
    customerId?: number;
    projectId?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<any[]> {
    try {
      // Receivables are document-driven: what each invoice still owes.
      //
      // A cancelled invoice owes nothing — it posts no ledger entry at all, so
      // leaving it here made the report disagree with the AR control account by
      // the full value of every invoice ever cancelled (L22a). The trailing
      // `or(... isNotNull(invoiceNumber))` was what let it through: every
      // approved invoice has a number, so that branch re-admitted every status
      // the lines above had just excluded, cancelled included. Listing the
      // statuses that do owe money says the same thing without the loophole.
      const queryConditions = [
        inArray(salesInvoices.status, [
          "approved",
          "unpaid",
          "partially_paid",
          "partial",
          "paid",
          "overdue",
        ]),
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

          // Report in AED (L22b). These figures are labelled AED wherever they
          // are shown and are summed into an AED total, so a foreign-currency
          // invoice reported at its face value understates the debt by the
          // whole exchange rate — a USD 1,050 invoice appeared as "AED 1,050"
          // rather than 3,856.13. `getSalesStats.totalReceivables` already
          // converts, which is why the Sales page's Total Receivables card and
          // this list disagreed.
          const rate = parseFloat(invoice.exchangeRate || "1");
          const docTotalAmount = parseFloat(invoice.totalAmount || "0");
          // Use paidAmount from invoice or calculate from payments
          const invoicePaidAmount = parseFloat(invoice.paidAmount || "0");
          const paymentsPaidAmount = paymentsList
            .filter((p) => p.invoiceId === invoice.id)
            .reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);
          const docPaidAmount = Math.max(invoicePaidAmount, paymentsPaidAmount);
          const docOutstandingAmount = docTotalAmount - docPaidAmount;

          const totalAmount = docTotalAmount * rate;
          const paidAmount = docPaidAmount * rate;
          const outstandingAmount = docOutstandingAmount * rate;

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
            // The document's own currency, kept alongside so a caller can show
            // what was actually invoiced rather than only the AED equivalent.
            currency: invoice.currency || "AED",
            exchangeRate: rate.toString(),
            documentTotalAmount: docTotalAmount.toFixed(2),
            documentPaidAmount: docPaidAmount.toFixed(2),
            documentOutstandingAmount: docOutstandingAmount.toFixed(2),
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
