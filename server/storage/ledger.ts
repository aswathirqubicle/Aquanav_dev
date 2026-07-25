import { ProjectAssetStorage } from "./project-asset";
import {
  ChartOfAccount,
  chartOfAccounts,
  customers,
  generalLedgerEntries,
  projects,
  salesInvoices,
} from "@shared/schema";
import {
  and,
  desc,
  eq,
  gte,
  ilike,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { db } from "../db";

export class LedgerStorage extends ProjectAssetStorage {
  // Chart of Accounts methods
  async getChartOfAccounts(): Promise<ChartOfAccount[]> {
    try {
      const accounts = await db
        .select()
        .from(chartOfAccounts)
        .where(eq(chartOfAccounts.isActive, true))
        .orderBy(chartOfAccounts.accountCode);
      return accounts;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getChartOfAccounts: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getChartOfAccounts",
        severity: "error",
      });
      throw error;
    }
  }

  async getChartOfAccountByName(
    accountName: string,
  ): Promise<ChartOfAccount | undefined> {
    try {
      const accounts = await db
        .select()
        .from(chartOfAccounts)
        .where(eq(chartOfAccounts.accountName, accountName))
        .limit(1);
      return accounts[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getChartOfAccountByName: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getChartOfAccountByName",
        severity: "error",
      });
      throw error;
    }
  }

  // General Ledger methods
  async getGeneralLedgerEntries(filters: {
    entryType?: string;
    referenceType?: string;
    entityId?: number;
    startDate?: string;
    endDate?: string;
    status?: string;
    projectId?: number;
    accountName?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 20;

      const conditionsArray: SQL[] = [];

      if (filters.entryType) {
        conditionsArray.push(
          eq(generalLedgerEntries.entryType, filters.entryType),
        );
      }
      if (filters.referenceType) {
        conditionsArray.push(
          eq(generalLedgerEntries.referenceType, filters.referenceType),
        );
      }
      if (filters.entityId) {
        conditionsArray.push(
          eq(generalLedgerEntries.entityId, filters.entityId),
        );
      }
      if (filters.startDate) {
        conditionsArray.push(
          gte(generalLedgerEntries.transactionDate, filters.startDate),
        );
      }
      if (filters.endDate) {
        conditionsArray.push(
          lte(generalLedgerEntries.transactionDate, filters.endDate),
        );
      }
      if (filters.status) {
        conditionsArray.push(eq(generalLedgerEntries.status, filters.status));
      }
      if (filters.projectId) {
        conditionsArray.push(
          eq(generalLedgerEntries.projectId, filters.projectId),
        );
      }
      if (filters.accountName) {
        conditionsArray.push(
          ilike(generalLedgerEntries.accountName, `%${filters.accountName}%`),
        );
      }
      if (filters.search) {
        conditionsArray.push(
          or(
            ilike(generalLedgerEntries.description, `%${filters.search}%`),
            ilike(generalLedgerEntries.entityName, `%${filters.search}%`),
            ilike(generalLedgerEntries.invoiceNumber, `%${filters.search}%`),
          ),
        );
      }

      const finalConditions =
        conditionsArray.length > 0 ? and(...conditionsArray) : undefined;

      const dataQueryBuilder = db
        .select({
          id: generalLedgerEntries.id,
          entryType: generalLedgerEntries.entryType,
          referenceType: generalLedgerEntries.referenceType,
          referenceId: generalLedgerEntries.referenceId,
          accountName: generalLedgerEntries.accountName,
          description: generalLedgerEntries.description,
          debitAmount: generalLedgerEntries.debitAmount,
          creditAmount: generalLedgerEntries.creditAmount,
          entityId: generalLedgerEntries.entityId,
          entityName: generalLedgerEntries.entityName,
          projectId: generalLedgerEntries.projectId,
          projectTitle: projects.title, // Select title from joined projects table
          invoiceNumber: generalLedgerEntries.invoiceNumber,
          transactionDate: generalLedgerEntries.transactionDate,
          dueDate: generalLedgerEntries.dueDate,
          status: generalLedgerEntries.status,
          createdAt: generalLedgerEntries.createdAt,
          notes: generalLedgerEntries.notes,
        })
        .from(generalLedgerEntries)
        .leftJoin(projects, eq(generalLedgerEntries.projectId, projects.id)) // Join with projects
        .where(finalConditions)
        .orderBy(
          desc(generalLedgerEntries.createdAt),
          desc(generalLedgerEntries.id),
        );
      // .limit(limit) // Limit and offset will be applied by _getPaginatedResults
      // .offset(offset);

      const countQueryBuilder = db
        .select({ count: sql<number>`count(*)` })
        .from(generalLedgerEntries)
        .leftJoin(projects, eq(generalLedgerEntries.projectId, projects.id))
        .where(finalConditions);

      const result = await this._getPaginatedResults<any>(
        dataQueryBuilder,
        countQueryBuilder,
        page,
        limit,
      );

      // Add summary statistics if requested or for specific ledger types
      if (
        filters.entryType === "receivable" ||
        filters.entryType === "payable"
      ) {
        const summaryConditions: SQL[] = [];
        if (filters.entryType)
          summaryConditions.push(
            eq(generalLedgerEntries.entryType, filters.entryType),
          );
        if (filters.startDate)
          summaryConditions.push(
            gte(generalLedgerEntries.transactionDate, filters.startDate),
          );
        if (filters.endDate)
          summaryConditions.push(
            lte(generalLedgerEntries.transactionDate, filters.endDate),
          );
        if (filters.entityId)
          summaryConditions.push(
            eq(generalLedgerEntries.entityId, filters.entityId),
          );
        if (filters.projectId)
          summaryConditions.push(
            eq(generalLedgerEntries.projectId, filters.projectId),
          );
        if (filters.status)
          summaryConditions.push(
            eq(generalLedgerEntries.status, filters.status),
          );
        if (filters.search) {
          summaryConditions.push(
            or(
              ilike(generalLedgerEntries.description, `%${filters.search}%`),
              ilike(generalLedgerEntries.entityName, `%${filters.search}%`),
              ilike(generalLedgerEntries.invoiceNumber, `%${filters.search}%`),
            ),
          );
        }

        const finalSummaryConditions =
          summaryConditions.length > 0 ? and(...summaryConditions) : undefined;

        const [totals] = await db
          .select({
            totalDebit: sql<string>`COALESCE(SUM(debit_amount::numeric), 0)`,
            totalCredit: sql<string>`COALESCE(SUM(credit_amount::numeric), 0)`,
          })
          .from(generalLedgerEntries)
          .where(finalSummaryConditions);

        const today = new Date().toISOString().split("T")[0];
        const [overdue] = await db
          .select({
            amount: sql<string>`COALESCE(SUM(${filters.entryType === "receivable" ? generalLedgerEntries.debitAmount : generalLedgerEntries.creditAmount}::numeric), 0)`,
          })
          .from(generalLedgerEntries)
          .where(
            and(
              finalSummaryConditions,
              sql`due_date < ${today}`,
              ne(generalLedgerEntries.status, "paid"),
              sql`${filters.entryType === "receivable" ? generalLedgerEntries.debitAmount : generalLedgerEntries.creditAmount}::numeric > 0`,
            ),
          );

        const totalDebit = parseFloat(totals?.totalDebit || "0");
        const totalCredit = parseFloat(totals?.totalCredit || "0");
        const overdueAmount = parseFloat(overdue?.amount || "0");

        if (filters.entryType === "receivable") {
          const totalReceivable = totalDebit - totalCredit;
          return {
            ...result,
            summary: {
              totalReceivable: totalReceivable.toFixed(2),
              overdueReceivable: overdueAmount.toFixed(2),
              pendingReceivable: (totalReceivable - overdueAmount).toFixed(2),
            },
          };
        } else {
          const totalPayable = totalCredit - totalDebit;
          return {
            ...result,
            summary: {
              totalPayable: totalPayable.toFixed(2),
              overduePayable: overdueAmount.toFixed(2),
              pendingPayable: (totalPayable - overdueAmount).toFixed(2),
            },
          };
        }
      }

      return result;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getGeneralLedgerEntries: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getGeneralLedgerEntries",
        severity: "error",
      });
      throw error;
    }
  }

  async getProfitLossEntries(filters: {
    startDate?: string;
    endDate?: string;
    projectId?: number;
  }): Promise<{
    entries: {
      id: number;
      entryType: string;
      referenceType: string;
      referenceId: number | null;
      accountName: string;
      accountType: string;
      accountCategory: string;
      description: string;
      debitAmount: string;
      creditAmount: string;
      entityId: number | null;
      entityName: string | null;
      projectId: number | null;
      projectTitle: string | null;
      invoiceNumber: string | null;
      transactionDate: string;
      status: string;
      notes: string | null;
    }[];
  }> {
    try {
      const conditions: string[] = [
        `coa.account_type IN ('revenue', 'expense')`,
      ];
      const params: (string | number)[] = [];
      let paramIdx = 1;

      if (filters.startDate) {
        conditions.push(`gle.transaction_date >= $${paramIdx++}`);
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        conditions.push(`gle.transaction_date <= $${paramIdx++}`);
        params.push(filters.endDate);
      }
      if (filters.projectId) {
        conditions.push(`gle.project_id = $${paramIdx++}`);
        params.push(filters.projectId);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const query = `
        SELECT
          gle.id,
          gle.entry_type       AS "entryType",
          gle.reference_type   AS "referenceType",
          gle.reference_id     AS "referenceId",
          gle.account_name     AS "accountName",
          coa.account_type     AS "accountType",
          coa.account_category AS "accountCategory",
          gle.description,
          gle.debit_amount     AS "debitAmount",
          gle.credit_amount    AS "creditAmount",
          gle.entity_id        AS "entityId",
          gle.entity_name      AS "entityName",
          gle.project_id       AS "projectId",
          p.title              AS "projectTitle",
          gle.invoice_number   AS "invoiceNumber",
          gle.transaction_date AS "transactionDate",
          gle.status,
          gle.notes
        FROM general_ledger_entries gle
        JOIN chart_of_accounts coa
          ON LOWER(TRIM(gle.account_name)) = LOWER(TRIM(coa.account_name))
        LEFT JOIN projects p ON gle.project_id = p.id
        ${whereClause}
        ORDER BY gle.transaction_date DESC, gle.created_at DESC
      `;

      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const result = await pool.query(query, params);
      await pool.end();

      return { entries: result.rows };
    } catch (error: any) {
      console.error("Error in getProfitLossEntries:", error?.message);
      throw error;
    }
  }

  async createGeneralLedgerEntry(entryData: {
    entryType: string;
    referenceType: string;
    referenceId?: number;
    accountName: string;
    description: string;
    debitAmount: string;
    creditAmount: string;
    entityId?: number;
    entityName?: string;
    projectId?: number;
    invoiceNumber?: string;
    transactionDate: string;
    dueDate?: string;
    status?: string;
    notes?: string;
    createdBy?: number;
  }): Promise<any> {
    try {
      console.log("Creating GL entry with data:", entryData);

      // Validate double-entry accounting rules
      const debitAmount = parseFloat(entryData.debitAmount || "0");
      const creditAmount = parseFloat(entryData.creditAmount || "0");

      // Ensure exactly one of debit or credit is non-zero (not both)
      if (debitAmount > 0 && creditAmount > 0) {
        throw new Error(
          "Double-entry violation: Both debit and credit amounts cannot be non-zero in a single entry",
        );
      }

      if (debitAmount === 0 && creditAmount === 0) {
        throw new Error(
          "Double-entry violation: Either debit or credit amount must be non-zero",
        );
      }

      // Ensure amounts are positive
      if (debitAmount < 0 || creditAmount < 0) {
        throw new Error(
          "Double-entry violation: Debit and credit amounts must be positive values",
        );
      }

      // Validate required fields for double-entry accounting
      if (!entryData.accountName || entryData.accountName.trim() === "") {
        throw new Error("Account name is required for general ledger entry");
      }

      if (!entryData.description || entryData.description.trim() === "") {
        throw new Error("Description is required for general ledger entry");
      }

      if (!entryData.transactionDate) {
        throw new Error(
          "Transaction date is required for general ledger entry",
        );
      }

      // Use the generalLedgerEntries table from schema instead of raw SQL
      const result = await db
        .insert(generalLedgerEntries)
        .values({
          entryType: entryData.entryType,
          referenceType: entryData.referenceType,
          referenceId: entryData.referenceId || null,
          accountName: entryData.accountName.trim(),
          description: entryData.description.trim(),
          debitAmount: debitAmount.toFixed(2),
          creditAmount: creditAmount.toFixed(2),
          entityId: entryData.entityId || null,
          entityName: entryData.entityName?.trim() || null,
          projectId: entryData.projectId || null,
          invoiceNumber: entryData.invoiceNumber?.trim() || null,
          transactionDate: entryData.transactionDate,
          dueDate: entryData.dueDate || null,
          status: entryData.status || "pending",
          notes: entryData.notes?.trim() || null,
          createdBy: entryData.createdBy || null,
        })
        .returning();

      console.log("GL entry created successfully:", result[0]);
      console.log(
        `Double-entry: ${debitAmount > 0 ? "DEBIT" : "CREDIT"} ${
          entryData.accountName
        } ${debitAmount > 0 ? debitAmount.toFixed(2) : creditAmount.toFixed(2)}`,
      );

      // If this is a payable entry linked to a project, trigger full cost recalculation
      if (entryData.entryType === "payable" && entryData.projectId) {
        await this.recalculateProjectCost(entryData.projectId);
      }

      return result[0];
    } catch (error: any) {
      console.error("Original error in createGeneralLedgerEntry:", error); // Keep original console.error
      console.error("Entry data that failed:", entryData); // Keep original console.error
      await this.createErrorLog({
        message:
          "Error in createGeneralLedgerEntry: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createGeneralLedgerEntry",
        severity: "error",
      });
      throw error;
    }
  }

  // Helper method to create balanced journal entries for double-entry accounting
  async createJournalEntry(journalData: {
    referenceType: string;
    referenceId?: number;
    description: string;
    transactionDate: string;
    entries: Array<{
      accountName: string;
      debitAmount?: string;
      creditAmount?: string;
      entityId?: number;
      entityName?: string;
      projectId?: number;
      invoiceNumber?: string;
      notes?: string;
    }>;
    entryType?: string;
    dueDate?: string;
    status?: string;
    createdBy?: number;
  }): Promise<any[]> {
    try {
      console.log("Creating balanced journal entry with data:", journalData);

      // Validate that we have at least 2 entries (minimum for double-entry)
      if (!journalData.entries || journalData.entries.length < 2) {
        throw new Error(
          "Journal entry must have at least 2 account entries for double-entry accounting",
        );
      }

      // Validate that debits equal credits
      let totalDebits = 0;
      let totalCredits = 0;

      for (const entry of journalData.entries) {
        const debitAmount = parseFloat(entry.debitAmount || "0");
        const creditAmount = parseFloat(entry.creditAmount || "0");

        // Ensure only one of debit or credit is set per entry
        if (debitAmount > 0 && creditAmount > 0) {
          throw new Error(
            `Account ${entry.accountName}: Cannot have both debit and credit amounts in a single entry`,
          );
        }

        if (debitAmount === 0 && creditAmount === 0) {
          throw new Error(
            `Account ${entry.accountName}: Must have either debit or credit amount`,
          );
        }

        totalDebits += debitAmount;
        totalCredits += creditAmount;
      }

      // Verify accounting equation: Debits = Credits
      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        // Allow for small rounding differences
        throw new Error(
          `Journal entry is not balanced: Total debits (${totalDebits.toFixed(
            2,
          )}) must equal total credits (${totalCredits.toFixed(2)})`,
        );
      }

      console.log(
        `Creating balanced journal entry: Debits=${totalDebits.toFixed(
          2,
        )}, Credits=${totalCredits.toFixed(2)}`,
      );

      // Create all entries in the journal
      const createdEntries = [];
      for (const entry of journalData.entries) {
        const glEntry = await this.createGeneralLedgerEntry({
          entryType: journalData.entryType || "manual",
          referenceType: journalData.referenceType,
          referenceId: journalData.referenceId,
          accountName: entry.accountName,
          description: journalData.description,
          debitAmount: entry.debitAmount || "0",
          creditAmount: entry.creditAmount || "0",
          entityId: entry.entityId,
          entityName: entry.entityName,
          projectId: entry.projectId,
          invoiceNumber: entry.invoiceNumber,
          transactionDate: journalData.transactionDate,
          dueDate: journalData.dueDate,
          status: journalData.status,
          notes: entry.notes,
          createdBy: journalData.createdBy,
        });
        createdEntries.push(glEntry);
      }

      console.log(
        `Successfully created ${createdEntries.length} balanced journal entries`,
      );
      return createdEntries;
    } catch (error: any) {
      console.error("Error in createJournalEntry:", error);
      await this.createErrorLog({
        message:
          "Error in createJournalEntry: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createJournalEntry",
        severity: "error",
      });
      throw error;
    }
  }

  async updateGeneralLedgerEntry(id: number, updateData: any): Promise<any> {
    try {
      // Build the update object with proper field mapping
      const updateFields: any = {};

      if (updateData.entryType !== undefined)
        updateFields.entryType = updateData.entryType;
      if (updateData.referenceType !== undefined)
        updateFields.referenceType = updateData.referenceType;
      if (updateData.referenceId !== undefined)
        updateFields.referenceId = updateData.referenceId;
      if (updateData.accountName !== undefined)
        updateFields.accountName = updateData.accountName;
      if (updateData.description !== undefined)
        updateFields.description = updateData.description;
      if (updateData.debitAmount !== undefined)
        updateFields.debitAmount = updateData.debitAmount;
      if (updateData.creditAmount !== undefined)
        updateFields.creditAmount = updateData.creditAmount;
      if (updateData.entityId !== undefined)
        updateFields.entityId = updateData.entityId;
      if (updateData.entityName !== undefined)
        updateFields.entityName = updateData.entityName;
      if (updateData.projectId !== undefined)
        updateFields.projectId = updateData.projectId;
      if (updateData.invoiceNumber !== undefined)
        updateFields.invoiceNumber = updateData.invoiceNumber;
      if (updateData.transactionDate !== undefined)
        updateFields.transactionDate = updateData.transactionDate;
      if (updateData.dueDate !== undefined)
        updateFields.dueDate = updateData.dueDate;
      if (updateData.status !== undefined)
        updateFields.status = updateData.status;
      if (updateData.notes !== undefined) updateFields.notes = updateData.notes;
      if (updateData.createdBy !== undefined)
        updateFields.createdBy = updateData.createdBy;

      if (Object.keys(updateFields).length === 0) {
        throw new Error("No fields to update");
      }

      const result = await db
        .update(generalLedgerEntries)
        .set(updateFields)
        .where(eq(generalLedgerEntries.id, id))
        .returning();

      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateGeneralLedgerEntry (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateGeneralLedgerEntry",
        severity: "error",
      });
      throw error;
    }
  }

  async createCancellationGLEntries(invoiceId: number): Promise<void> {
    try {
      const invoice = await db
        .select()
        .from(salesInvoices)
        .leftJoin(customers, eq(salesInvoices.customerId, customers.id))
        .where(eq(salesInvoices.id, invoiceId))
        .limit(1);

      if (!invoice[0])
        throw new Error(`Invoice with ID ${invoiceId} not found`);

      const invoiceData = invoice[0].sales_invoices;
      const customerData = invoice[0].customers;

      const invoiceCurrency = invoiceData.currency || "AED";
      const invoiceExchangeRate = parseFloat(invoiceData.exchangeRate || "1");
      const originalAmount = parseFloat(invoiceData.totalAmount || "0");
      const aedAmount = (originalAmount * invoiceExchangeRate).toFixed(2);
      const currencyNote =
        invoiceCurrency !== "AED"
          ? ` (${invoiceCurrency} ${originalAmount.toFixed(2)} @ ${invoiceExchangeRate})`
          : "";

      // Both reversal rows in ONE transaction (L14) — a half-written reversal
      // is worse than none, since it silently unbalances the ledger.
      const cancelShared = {
        entryType: "receivable" as const,
        referenceType: "sales_invoice" as const,
        referenceId: invoiceId,
        description: `CANCELLED - Sales Invoice ${invoiceData.invoiceNumber} - ${customerData?.name || "Unknown Customer"}${currencyNote}`,
        entityId: invoiceData.customerId,
        entityName: customerData?.name || null,
        projectId: invoiceData.projectId,
        invoiceNumber: invoiceData.invoiceNumber,
        transactionDate: new Date().toISOString(),
        dueDate: invoiceData.dueDate,
        status: "cancelled" as const,
      };

      await db.transaction(async (tx) => {
        await tx.insert(generalLedgerEntries).values({
          ...cancelShared,
          accountName: "Accounts Receivable",
          debitAmount: "0",
          creditAmount: aedAmount,
        });

        await tx.insert(generalLedgerEntries).values({
          ...cancelShared,
          accountName: "Sales Revenue",
          debitAmount: aedAmount,
          creditAmount: "0",
        });
      });

      console.log(
        `Cancellation GL entries created for invoice ${invoiceData.invoiceNumber}`,
      );
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in createCancellationGLEntries (invoiceId: ${invoiceId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createCancellationGLEntries",
        severity: "error",
      });
      throw error;
    }
  }

  async createInvoiceGLEntries(invoiceId: number): Promise<void> {
    try {
      // Get the invoice details
      const invoice = await db
        .select()
        .from(salesInvoices)
        .leftJoin(customers, eq(salesInvoices.customerId, customers.id))
        .where(eq(salesInvoices.id, invoiceId))
        .limit(1);

      if (!invoice[0]) {
        throw new Error(`Invoice with ID ${invoiceId} not found`);
      }

      const invoiceData = invoice[0].sales_invoices;
      const customerData = invoice[0].customers;

      const invoiceCurrency = invoiceData.currency || "AED";
      const invoiceExchangeRate = parseFloat(invoiceData.exchangeRate || "1");
      const originalAmount = parseFloat(invoiceData.totalAmount || "0");
      // Standard VAT posting (D5): AR is the gross the customer owes; Sales
      // Revenue is net of discount and EXCLUDING VAT; the output VAT collected
      // is a liability (VAT/GST Payable). Rounded so Dr AR == Cr Revenue + Cr VAT
      // to the cent by construction.
      const originalTax = parseFloat(invoiceData.taxAmount || "0");
      const aedTotal = Math.round(originalAmount * invoiceExchangeRate * 100) / 100;
      const aedTax = Math.round(originalTax * invoiceExchangeRate * 100) / 100;
      const aedRevenue = Math.round((aedTotal - aedTax) * 100) / 100;
      const currencyNote =
        invoiceCurrency !== "AED"
          ? ` (${invoiceCurrency} ${originalAmount.toFixed(2)} @ ${invoiceExchangeRate})`
          : "";

      // Both sides are written in ONE transaction (L14). Previously these were
      // two independent inserts: a failure between them left the ledger
      // permanently one-sided, with a debit and no matching credit. This
      // matters more from P5 onward, where VAT and discount lines turn the
      // pair into a 3-4 row posting.
      const shared = {
        entryType: "receivable" as const,
        referenceType: "sales_invoice" as const,
        referenceId: invoiceId,
        description: `Sales Invoice ${invoiceData.invoiceNumber} - ${customerData?.name || "Unknown Customer"}${currencyNote}`,
        entityId: invoiceData.customerId,
        entityName: customerData?.name || null,
        projectId: invoiceData.projectId,
        invoiceNumber: invoiceData.invoiceNumber,
        transactionDate: invoiceData.invoiceDate,
        dueDate: invoiceData.dueDate,
        status: "pending" as const,
      };

      await db.transaction(async (tx) => {
        // Debit Accounts Receivable (gross, incl. VAT), in AED
        await tx.insert(generalLedgerEntries).values({
          ...shared,
          accountName: "Accounts Receivable",
          debitAmount: aedTotal.toFixed(2),
          creditAmount: "0",
        });

        // Credit Sales Revenue (net of discount, excl. VAT), in AED
        await tx.insert(generalLedgerEntries).values({
          ...shared,
          accountName: "Sales Revenue",
          debitAmount: "0",
          creditAmount: aedRevenue.toFixed(2),
        });

        // Credit VAT/GST Payable (output VAT) — omitted when zero (G2)
        if (aedTax > 0.005) {
          await tx.insert(generalLedgerEntries).values({
            ...shared,
            accountName: "VAT/GST Payable",
            debitAmount: "0",
            creditAmount: aedTax.toFixed(2),
          });
        }
      });

      console.log(
        `GL entries created for invoice ${invoiceData.invoiceNumber}`,
      );
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in createInvoiceGLEntries (invoiceId: ${invoiceId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createInvoiceGLEntries",
        severity: "error",
      });
      throw error;
    }
  }
}
