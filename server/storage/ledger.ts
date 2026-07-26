import { ProjectAssetStorage } from "./project-asset";
import {
  ChartOfAccount,
  chartOfAccounts,
  customers,
  generalLedgerEntries,
  payrollAdditions,
  payrollDeductions,
  payrollEntries,
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
// `sqlRaw` is the shared postgres-js connection, aliased because `sql` above is
// drizzle's query-template helper. Same convention as server/routes/system.routes.ts.
import { db, sql as sqlRaw } from "../db";

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
        // These conditions must mirror the ones used for the list, or the
        // summary describes a different set of rows than the page is showing.
        //
        // accountName was the one being dropped (L17), and it is the one that
        // matters most: a receivable posting is Dr Accounts Receivable /
        // Cr Sales Revenue / Cr VAT Payable, so summing debits less credits
        // across all of them is guaranteed to give zero — the revenue and tax
        // credits cancel the receivable debit exactly. The Receivable and
        // Payable pages both filter to their control account and so listed the
        // right rows while reporting a total of 0.00 above them.
        const summaryConditions: SQL[] = [];
        if (filters.entryType)
          summaryConditions.push(
            eq(generalLedgerEntries.entryType, filters.entryType),
          );
        if (filters.accountName)
          summaryConditions.push(
            ilike(generalLedgerEntries.accountName, `%${filters.accountName}%`),
          );
        if (filters.referenceType)
          summaryConditions.push(
            eq(generalLedgerEntries.referenceType, filters.referenceType),
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

      // Use the shared connection (1.7). This previously opened a brand-new `pg`
      // Pool per call and closed it again — a second driver alongside the app's
      // postgres-js one, and a fresh connection on every P&L report, which
      // exhausts the server's connection budget under repeated use (T1.11).
      // postgres-js `.unsafe` takes the same $1 placeholders and returns the
      // rows directly rather than wrapping them in a `.rows` property.
      const rows = await sqlRaw.unsafe(query, params);

      return { entries: rows as unknown as Awaited<
        ReturnType<LedgerStorage["getProfitLossEntries"]>
      >["entries"] };
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
  },
  /**
   * Optional transaction (1.7/L14). When a caller is posting several rows that
   * must land together, it opens one `db.transaction` and passes `tx` here so a
   * failure part-way rolls the whole set back instead of leaving a one-sided
   * ledger. Omitted, this behaves exactly as before and posts on its own.
   *
   * NOTE: passing `tx` also SKIPS the project-cost recalculation below, because
   * that recalc reads the ledger over the shared connection and from inside an
   * open transaction would compute the cost without the rows being written.
   * Callers passing `tx` must recalculate the affected projects themselves once
   * the transaction has committed — see postPayrollAccrual for the pattern.
   */
  tx?: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ): Promise<any> {
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
      const result = await (tx ?? db)
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

      // If this is a payable entry linked to a project, trigger full cost
      // recalculation — but NOT when posting inside a transaction. The recalc
      // reads the ledger over the shared connection, so from inside an open
      // transaction it cannot see the rows just written and would compute the
      // project's cost from stale data, then persist that. Callers passing `tx`
      // must recalculate the affected projects themselves AFTER the commit.
      if (!tx && entryData.entryType === "payable" && entryData.projectId) {
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

      // Every account must exist in the chart of accounts (8.5). A journal is
      // the one posting path where the account name is typed by a user rather
      // than chosen by code, so a typo silently creates a new "account" that no
      // report knows about and no statement rolls up.
      //
      // Scoped to journals deliberately. Widening it to createGeneralLedgerEntry
      // would make every posting path — sales, purchase, payroll — depend on the
      // chart matching the account names those paths hard-code, so a single COA
      // rename or deactivation would start failing approvals. Migration 0068
      // removed the one mismatch that existed (payroll credits "Provident Fund
      // Contribution"; account 2120 was still named "Tax Deducted at Source"),
      // so widening is now possible — but it is a separate decision.
      const chartRows = await db
        .select({ name: chartOfAccounts.accountName })
        .from(chartOfAccounts);
      const knownAccounts = new Set(
        chartRows.map((r) => (r.name || "").trim().toLowerCase()),
      );
      const unknown = journalData.entries
        .map((e) => (e.accountName || "").trim())
        .filter((n) => !knownAccounts.has(n.toLowerCase()));
      if (unknown.length > 0) {
        throw new Error(
          `Unknown account${unknown.length > 1 ? "s" : ""}: ${Array.from(
            new Set(unknown),
          ).join(", ")}. Journal accounts must exist in the chart of accounts.`,
        );
      }

      console.log(
        `Creating balanced journal entry: Debits=${totalDebits.toFixed(
          2,
        )}, Credits=${totalCredits.toFixed(2)}`,
      );

      // Every line of the journal in ONE transaction (1.7/L14). Posted
      // independently, a failure part-way left a journal half-posted — and a
      // journal is the one posting with no source document to re-derive it
      // from, so the ledger would be permanently unbalanced with nothing to
      // reconcile against.
      const createdEntries: any[] = [];
      const affectedProjectIds = new Set<number>();

      await db.transaction(async (tx) => {
        for (const entry of journalData.entries) {
          const glEntry = await this.createGeneralLedgerEntry(
            {
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
            },
            tx,
          );
          createdEntries.push(glEntry);
          if (entry.projectId) affectedProjectIds.add(entry.projectId);
        }
      });

      // Recalculate after the commit: passing `tx` skips the per-row recalc,
      // since from inside the transaction it could not see these rows.
      if ((journalData.entryType || "manual") === "payable") {
        for (const projectId of Array.from(affectedProjectIds)) {
          await this.recalculateProjectCost(projectId);
        }
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
      // Reverse the exact 3-row approval posting (T5.6): Cr AR (gross) /
      // Dr Sales Revenue (net) / Dr VAT/GST Payable (tax). VAT line omitted when
      // zero. Rounded so the reversal balances to the cent.
      const originalTax = parseFloat(invoiceData.taxAmount || "0");
      const aedTotal = Math.round(originalAmount * invoiceExchangeRate * 100) / 100;
      const aedTax = Math.round(originalTax * invoiceExchangeRate * 100) / 100;
      const aedRevenue = Math.round((aedTotal - aedTax) * 100) / 100;
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
        // Reverse Dr AR: credit Accounts Receivable (gross)
        await tx.insert(generalLedgerEntries).values({
          ...cancelShared,
          accountName: "Accounts Receivable",
          debitAmount: "0",
          creditAmount: aedTotal.toFixed(2),
        });

        // Reverse Cr Revenue: debit Sales Revenue (net of discount, excl. VAT)
        await tx.insert(generalLedgerEntries).values({
          ...cancelShared,
          accountName: "Sales Revenue",
          debitAmount: aedRevenue.toFixed(2),
          creditAmount: "0",
        });

        // Reverse Cr VAT: debit VAT/GST Payable (output VAT) — omitted when zero
        if (aedTax > 0.005) {
          await tx.insert(generalLedgerEntries).values({
            ...cancelShared,
            accountName: "VAT/GST Payable",
            debitAmount: aedTax.toFixed(2),
            creditAmount: "0",
          });
        }
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

  // ===========================================================================
  // Ledger rebuild (Phase 11)
  // ---------------------------------------------------------------------------
  // Re-posts the ledger from the documents that currently exist, so it reflects
  // the corrected posting rules rather than whatever historic bugs produced it.
  //
  // NOT re-posted: cancelled invoices (a cancelled document has no economic
  // effect; posting then immediately reversing it only adds noise) and
  // drafts / pending-approval documents. Payroll is cleared rather than rebuilt
  // — its GL cannot be regenerated from anything but payroll_entries, so
  // deleting the GL while leaving the sub-ledger populated would leave the two
  // permanently disagreeing.
  // ===========================================================================

  /**
   * Check the chart of accounts against the canonical list in
   * scripts/seed-chart-of-accounts.ts — the same list migration 0062 keeps in
   * step. Reports accounts that are missing entirely, and accounts whose name
   * has drifted from the planned one for that code.
   *
   * The rebuild posts to account names hard-coded in the posting logic, so a
   * missing or renamed account silently produces ledger rows for an account no
   * report knows about. That is exactly what happened with 2120: the code
   * credited "Provident Fund Contribution" while the chart still said "Tax
   * Deducted at Source (TDS)", leaving six rows outside the chart.
   */
  async verifyChartOfAccounts(): Promise<{
    ok: boolean;
    missing: { accountCode: string; accountName: string }[];
    renamed: { accountCode: string; expected: string; actual: string }[];
    unexpected: { accountCode: string; accountName: string }[];
  }> {
    const { accounts: planned } = await import("@shared/chart-of-accounts");
    const rows = (await db
      .select({
        accountCode: chartOfAccounts.accountCode,
        accountName: chartOfAccounts.accountName,
      })
      .from(chartOfAccounts)) as { accountCode: string; accountName: string }[];

    const actual = new Map(rows.map((r) => [r.accountCode, r.accountName]));
    const plannedCodes = new Set<string>();

    const missing: { accountCode: string; accountName: string }[] = [];
    const renamed: { accountCode: string; expected: string; actual: string }[] = [];
    for (const p of planned as { accountCode: string; accountName: string }[]) {
      plannedCodes.add(p.accountCode);
      const got = actual.get(p.accountCode);
      if (got === undefined) {
        missing.push({ accountCode: p.accountCode, accountName: p.accountName });
      } else if (got.trim() !== p.accountName.trim()) {
        renamed.push({ accountCode: p.accountCode, expected: p.accountName, actual: got });
      }
    }
    const unexpected = rows
      .filter((r) => !plannedCodes.has(r.accountCode))
      .map((r) => ({ accountCode: r.accountCode, accountName: r.accountName }));

    return {
      ok: missing.length === 0 && renamed.length === 0,
      missing,
      renamed,
      unexpected,
    };
  }

  /**
   * Replace the chart of accounts with the canonical list. Snapshots the
   * existing chart first. Nothing references chart_of_accounts by foreign key —
   * the ledger links to it by account NAME — so replacing rows cannot orphan
   * anything structurally. Accounts present in the database but absent from the
   * planned list are dropped; that is the point of the operation.
   */
  async reseedChartOfAccounts(): Promise<{
    backupTable: string;
    removed: number;
    inserted: number;
  }> {
    const { accounts: planned } = await import("@shared/chart-of-accounts");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
    const backupTable = `coa_backup_${stamp}`;

    const [before] = (await sqlRaw`select count(*)::int n from chart_of_accounts`) as any[];
    await sqlRaw.unsafe(
      `create table ${backupTable} as select * from chart_of_accounts`,
    );

    await db.transaction(async (tx) => {
      await tx.delete(chartOfAccounts);
      for (const a of planned as any[]) {
        await tx.insert(chartOfAccounts).values({
          accountCode: a.accountCode,
          accountName: a.accountName,
          accountType: a.accountType,
          accountCategory: a.accountCategory,
          description: a.description,
          isActive: a.isActive ?? true,
        });
      }
    });

    return { backupTable, removed: before.n, inserted: (planned as any[]).length };
  }

  /** Compute the rebuilt ledger WITHOUT writing. Safe to call any time. */
  async computeLedgerRebuild(): Promise<{
    rows: any[];
    totalDebit: number;
    totalCredit: number;
    balanced: boolean;
    byAccount: { accountName: string; debit: number; credit: number; net: number }[];
    skipped: { cancelledSales: number; cancelledPurchase: number; creditNoteSettlements: number };
  }> {
    const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
    const rows: any[] = [];
    const push = (r: any) => {
      if (Number(r.debitAmount) > 0.005 || Number(r.creditAmount) > 0.005) rows.push(r);
    };

    const salesInv = await sqlRaw`
      select s.id, s.invoice_number, s.customer_id, s.project_id, s.invoice_date,
             coalesce(s.exchange_rate,1)::numeric rate, s.total_amount::numeric total,
             coalesce(s.tax_amount,0)::numeric tax, c.name customer_name
      from sales_invoices s left join customers c on c.id = s.customer_id
      where s.status in ('approved','unpaid','partially_paid','paid','overdue') order by s.id`;
    for (const v of salesInv as any[]) {
      const gross = r2(Number(v.total) * Number(v.rate));
      const tax = r2(Number(v.tax) * Number(v.rate));
      const base = {
        entryType: "receivable", referenceType: "sales_invoice", referenceId: v.id,
        description: `Sales Invoice ${v.invoice_number} - ${v.customer_name || "Unknown Customer"}`,
        entityId: v.customer_id, entityName: v.customer_name, projectId: v.project_id,
        invoiceNumber: v.invoice_number, transactionDate: v.invoice_date, status: "pending",
      };
      push({ ...base, accountName: "Accounts Receivable", debitAmount: gross, creditAmount: 0 });
      push({ ...base, accountName: "Sales Revenue", debitAmount: 0, creditAmount: r2(gross - tax) });
      push({ ...base, accountName: "VAT/GST Payable", debitAmount: 0, creditAmount: tax });
    }

    const salesPay = await sqlRaw`
      select p.id, p.amount::numeric amount, p.payment_date, s.invoice_number,
             s.customer_id, s.project_id, coalesce(s.exchange_rate,1)::numeric rate,
             c.name customer_name
      from invoice_payments p join sales_invoices s on s.id = p.invoice_id
      left join customers c on c.id = s.customer_id
      where s.status in ('approved','unpaid','partially_paid','paid','overdue')
        and coalesce(p.payment_type,'payment') <> 'credit_note' order by p.id`;
    for (const p of salesPay as any[]) {
      const aed = r2(Number(p.amount) * Number(p.rate));
      const base = {
        entryType: "receivable", referenceType: "payment", referenceId: p.id,
        description: `Payment received for Invoice: ${p.invoice_number}`,
        entityId: p.customer_id, entityName: p.customer_name, projectId: p.project_id,
        invoiceNumber: p.invoice_number, transactionDate: p.payment_date, status: "paid",
      };
      push({ ...base, accountName: "Cash/Bank", debitAmount: aed, creditAmount: 0 });
      push({ ...base, accountName: "Accounts Receivable", debitAmount: 0, creditAmount: aed });
    }

    const cns = await sqlRaw`
      select n.id, n.credit_note_number, n.customer_id, n.credit_note_date,
             coalesce(n.exchange_rate,1)::numeric rate, coalesce(n.total_amount,0)::numeric total,
             coalesce(n.tax_amount,0)::numeric tax, s.invoice_number, s.project_id, c.name customer_name
      from credit_notes n left join sales_invoices s on s.id = n.sales_invoice_id
      left join customers c on c.id = n.customer_id where n.status='issued' order by n.id`;
    for (const v of cns as any[]) {
      const gross = r2(Number(v.total) * Number(v.rate));
      const tax = r2(Number(v.tax) * Number(v.rate));
      const base = {
        entryType: "receivable", referenceType: "credit_note", referenceId: v.id,
        description: `Credit Note: ${v.credit_note_number} for Invoice: ${v.invoice_number || "N/A"}`,
        entityId: v.customer_id, entityName: v.customer_name, projectId: v.project_id,
        invoiceNumber: v.invoice_number, transactionDate: v.credit_note_date, status: "issued",
      };
      push({ ...base, accountName: "Sales Returns and Allowances", debitAmount: r2(gross - tax), creditAmount: 0 });
      push({ ...base, accountName: "VAT/GST Payable", debitAmount: tax, creditAmount: 0 });
      push({ ...base, accountName: "Accounts Receivable", debitAmount: 0, creditAmount: gross });
    }

    const purchInv = await sqlRaw`
      select p.id, p.invoice_number, p.supplier_id, p.invoice_date,
             coalesce(p.exchange_rate,1)::numeric rate, p.total_amount::numeric total,
             coalesce(p.tax_amount,0)::numeric tax, s.name supplier_name
      from purchase_invoices p left join suppliers s on s.id = p.supplier_id
      where p.status='approved' order by p.id`;
    for (const v of purchInv as any[]) {
      const gross = r2(Number(v.total) * Number(v.rate));
      const tax = r2(Number(v.tax) * Number(v.rate));
      const expense = r2(gross - tax);
      const base = {
        entryType: "payable", referenceType: "purchase_invoice", referenceId: v.id,
        description: `Purchase Invoice ${v.invoice_number} - ${v.supplier_name || "Unknown Supplier"}`,
        entityId: v.supplier_id, entityName: v.supplier_name,
        invoiceNumber: v.invoice_number, transactionDate: v.invoice_date, status: "pending",
      };
      // expense weighted by each line's net-of-VAT amount, grouped by project
      const items = (await sqlRaw`
        select project_id, sum(line_total::numeric - coalesce(tax_amount,0)::numeric) net
        from purchase_invoice_items where invoice_id = ${v.id} group by project_id`) as any[];
      const weights = items.map((i) => Math.max(0, Number(i.net)));
      const totalW = weights.reduce((s, w) => s + w, 0);
      if (totalW > 0) {
        let allocated = 0;
        items.forEach((it, idx) => {
          const share = idx === items.length - 1
            ? r2(expense - allocated)
            : r2((expense * weights[idx]) / totalW);
          allocated = r2(allocated + share);
          push({ ...base, accountName: "Purchase Expense", debitAmount: share, creditAmount: 0, projectId: it.project_id });
        });
      } else {
        push({ ...base, accountName: "Purchase Expense", debitAmount: expense, creditAmount: 0, projectId: null });
      }
      push({ ...base, accountName: "VAT Recoverable", debitAmount: tax, creditAmount: 0, projectId: null });
      push({ ...base, accountName: "Accounts Payable", debitAmount: 0, creditAmount: gross, projectId: null });
    }

    const purchPay = await sqlRaw`
      select p.id, p.amount::numeric amount, p.payment_date, i.invoice_number, i.supplier_id,
             coalesce(i.exchange_rate,1)::numeric rate, s.name supplier_name
      from purchase_invoice_payments p join purchase_invoices i on i.id = p.invoice_id
      left join suppliers s on s.id = i.supplier_id
      where i.status='approved' and coalesce(p.payment_type,'payment') <> 'credit_note' order by p.id`;
    for (const p of purchPay as any[]) {
      const aed = r2(Number(p.amount) * Number(p.rate));
      const base = {
        entryType: "payable", referenceType: "payment", referenceId: p.id,
        description: `Payment for Purchase Invoice ${p.invoice_number}`,
        entityId: p.supplier_id, entityName: p.supplier_name, projectId: null,
        invoiceNumber: p.invoice_number, transactionDate: p.payment_date, status: "paid",
      };
      push({ ...base, accountName: "Accounts Payable", debitAmount: aed, creditAmount: 0 });
      push({ ...base, accountName: "Cash/Bank", debitAmount: 0, creditAmount: aed });
    }

    const pcns = await sqlRaw`
      select n.id, n.credit_note_number, n.supplier_id, n.credit_note_date,
             coalesce(n.total_amount,0)::numeric total, coalesce(n.tax_amount,0)::numeric tax,
             coalesce(i.exchange_rate,1)::numeric rate, i.invoice_number, s.name supplier_name
      from purchase_credit_notes n join purchase_invoices i on i.id = n.purchase_invoice_id
      left join suppliers s on s.id = n.supplier_id
      where n.status='issued' and i.status='approved' order by n.id`;
    for (const v of pcns as any[]) {
      const gross = r2(Number(v.total) * Number(v.rate));
      const tax = r2(Number(v.tax) * Number(v.rate));
      const base = {
        entryType: "payable", referenceType: "purchase_credit_note", referenceId: v.id,
        description: `Purchase Credit Note ${v.credit_note_number} for Invoice ${v.invoice_number}`,
        entityId: v.supplier_id, entityName: v.supplier_name, projectId: null,
        invoiceNumber: v.invoice_number, transactionDate: v.credit_note_date, status: "issued",
      };
      push({ ...base, accountName: "Accounts Payable", debitAmount: gross, creditAmount: 0 });
      push({ ...base, accountName: "Purchase Expense", debitAmount: 0, creditAmount: r2(gross - tax) });
      push({ ...base, accountName: "VAT Recoverable", debitAmount: 0, creditAmount: tax });
    }

    const totalDebit = r2(rows.reduce((s, r) => s + Number(r.debitAmount), 0));
    const totalCredit = r2(rows.reduce((s, r) => s + Number(r.creditAmount), 0));

    const acc = new Map<string, { debit: number; credit: number }>();
    for (const r of rows) {
      const e = acc.get(r.accountName) || { debit: 0, credit: 0 };
      e.debit = r2(e.debit + Number(r.debitAmount));
      e.credit = r2(e.credit + Number(r.creditAmount));
      acc.set(r.accountName, e);
    }

    const [cs] = (await sqlRaw`select count(*)::int n from sales_invoices where status='cancelled'`) as any[];
    const [cp] = (await sqlRaw`select count(*)::int n from purchase_invoices where status='cancelled'`) as any[];
    const [cset] = (await sqlRaw`select count(*)::int n from invoice_payments where payment_type='credit_note'`) as any[];

    return {
      rows,
      totalDebit,
      totalCredit,
      balanced: totalDebit === totalCredit,
      byAccount: Array.from(acc.entries())
        .map(([accountName, v]) => ({ accountName, ...v, net: r2(v.debit - v.credit) }))
        .sort((a, b) => a.accountName.localeCompare(b.accountName)),
      skipped: { cancelledSales: cs.n, cancelledPurchase: cp.n, creditNoteSettlements: cset.n },
    };
  }

  /**
   * Rebuild the ledger. DESTRUCTIVE. Snapshots general_ledger_entries and
   * payroll_entries to timestamped tables first, and refuses to write a ledger
   * whose debits do not equal its credits.
   */
  async executeLedgerRebuild(userId?: number): Promise<{
    backupTables: string[];
    deletedGl: number;
    deletedPayroll: number;
    postedRows: number;
    totalDebit: number;
    totalCredit: number;
    chartRepaired: { backupTable: string; removed: number; inserted: number } | null;
  }> {
    // Step 1 — the chart must match the planned one. The rebuild posts to
    // hard-coded account names, so a missing or renamed account would put rows
    // outside the chart where no report can find them. If it has drifted,
    // replace it with the canonical list rather than refusing: the chart is a
    // fixed reference set, so restoring it is the correct repair.
    let coaRepair: { backupTable: string; removed: number; inserted: number } | null = null;
    const coaBefore = await this.verifyChartOfAccounts();
    if (!coaBefore.ok) {
      coaRepair = await this.reseedChartOfAccounts();
      const coaAfter = await this.verifyChartOfAccounts();
      if (!coaAfter.ok) {
        const problems = [
          ...coaAfter.missing.map((m) => `missing ${m.accountCode} ${m.accountName}`),
          ...coaAfter.renamed.map(
            (r) => `${r.accountCode}: expected "${r.expected}", found "${r.actual}"`,
          ),
        ];
        throw new Error(
          `Refusing to rebuild: the chart of accounts still does not match the ` +
            `planned list after reseeding — ${problems.join("; ")}`,
        );
      }
    }

    // Gate 2 — never write an unbalanced ledger.
    const plan = await this.computeLedgerRebuild();
    if (!plan.balanced) {
      throw new Error(
        `Refusing to rebuild: computed ledger is out of balance by ${(
          plan.totalDebit - plan.totalCredit
        ).toFixed(2)}`,
      );
    }

    const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
    const glBackup = `gl_backup_${stamp}`;
    const payrollBackup = `payroll_backup_${stamp}`;

    const [glBefore] = (await sqlRaw`select count(*)::int n from general_ledger_entries`) as any[];
    const [payBefore] = (await sqlRaw`select count(*)::int n from payroll_entries`) as any[];

    await sqlRaw.unsafe(`create table ${glBackup} as select * from general_ledger_entries`);
    await sqlRaw.unsafe(`create table ${payrollBackup} as select * from payroll_entries`);

    await db.transaction(async (tx) => {
      await tx.delete(payrollDeductions);
      await tx.delete(payrollAdditions);
      await tx.delete(payrollEntries);
      await tx.delete(generalLedgerEntries);
      for (const r of plan.rows) {
        await tx.insert(generalLedgerEntries).values({
          entryType: r.entryType,
          referenceType: r.referenceType,
          referenceId: r.referenceId ?? null,
          accountName: r.accountName,
          description: r.description,
          debitAmount: Number(r.debitAmount).toFixed(2),
          creditAmount: Number(r.creditAmount).toFixed(2),
          entityId: r.entityId ?? null,
          entityName: r.entityName ?? null,
          projectId: r.projectId ?? null,
          invoiceNumber: r.invoiceNumber ?? null,
          transactionDate: r.transactionDate,
          status: r.status,
          createdBy: userId ?? null,
        });
      }
    });

    return {
      backupTables: coaRepair
        ? [glBackup, payrollBackup, coaRepair.backupTable]
        : [glBackup, payrollBackup],
      deletedGl: glBefore.n,
      deletedPayroll: payBefore.n,
      postedRows: plan.rows.length,
      totalDebit: plan.totalDebit,
      totalCredit: plan.totalCredit,
      chartRepaired: coaRepair,
    };
  }
}
