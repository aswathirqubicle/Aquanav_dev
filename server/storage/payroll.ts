import { PurchaseStorage } from "./purchase";
import {
  Employee,
  InsertPayrollAddition,
  InsertPayrollDeduction,
  InsertPayrollEntry,
  PayrollAddition,
  PayrollDeduction,
  PayrollEntry,
  Project,
  chartOfAccounts,
  employees,
  generalLedgerEntries,
  payrollAdditions,
  payrollDeductions,
  payrollEntries,
  projectEmployees,
  projects,
  reimbursements,
} from "@shared/schema";
import {
  PayrollEntryEmployeeDetails,
  PayrollEntryWithEmployeeDetails,
} from "./types";
import { accountCodeForCategory } from "@shared/payroll-types";
import { and, desc, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "../db";

export class PayrollStorage extends PurchaseStorage {
  // Payroll methods
  async getPayrollEntries(
    month?: number,
    year?: number,
    employeeId?: number,
    projectId?: number,
  ): Promise<PayrollEntryWithEmployeeDetails[]> {
    try {
      // Build the base query
      let baseQuery = db
        .select()
        .from(payrollEntries)
        .leftJoin(employees, eq(payrollEntries.employeeId, employees.id));

      // Add conditions if provided
      const conditions = [];
      if (month !== undefined && month !== null)
        conditions.push(eq(payrollEntries.month, month));
      if (year !== undefined && year !== null)
        conditions.push(eq(payrollEntries.year, year));
      if (employeeId !== undefined && employeeId !== null)
        conditions.push(eq(payrollEntries.employeeId, employeeId));
      if (projectId !== undefined && projectId !== null)
        conditions.push(eq(payrollEntries.projectId, projectId));

      if (conditions.length > 0) {
        if (conditions.length === 1) {
          baseQuery = baseQuery.where(conditions[0]);
        } else {
          baseQuery = baseQuery.where(and(...conditions));
        }
      }

      const result = await baseQuery.orderBy(
        desc(payrollEntries.generatedDate),
      );

      return result.map((row) => {
        let employeeDetails: PayrollEntryEmployeeDetails | undefined =
          undefined;

        // Access the payroll entry data (table name becomes the key)
        const payrollData = row.payroll_entries;
        const employeeData = row.employees;

        if (payrollData && payrollData.employeeId && employeeData) {
          employeeDetails = {
            id: payrollData.employeeId,
            firstName: employeeData.firstName,
            lastName: employeeData.lastName,
            employeeCode: employeeData.employeeCode,
            category: employeeData.category,
          };
        }

        return {
          id: payrollData.id,
          employeeId: payrollData.employeeId,
          month: payrollData.month,
          year: payrollData.year,
          workingDays: payrollData.workingDays,
          basicSalary: payrollData.basicSalary,
          totalAdditions: payrollData.totalAdditions,
          totalDeductions: payrollData.totalDeductions,
          totalAmount: payrollData.totalAmount,
          status: payrollData.status,
          generatedDate: payrollData.generatedDate,
          projectId: payrollData.projectId,
          employee: employeeDetails,
        };
      }) as PayrollEntryWithEmployeeDetails[];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getPayrollEntries: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPayrollEntries",
        severity: "error",
      });
      throw error;
    }
  }

  async getPayrollEntry(id: number): Promise<PayrollEntry | undefined> {
    try {
      const result = await db
        .select()
        .from(payrollEntries)
        .where(eq(payrollEntries.id, id))
        .limit(1);
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getPayrollEntry (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPayrollEntry",
        severity: "error",
      });
      throw error;
    }
  }

  async generateMonthlyPayroll(
    month: number,
    year: number,
    userId?: number,
  ): Promise<PayrollEntryWithEmployeeDetails[]> {
    try {
      console.log(
        `[Payroll] Starting generateMonthlyPayroll for month: ${month}, year: ${year}, userId: ${userId}`,
      );

      // Validate required parameters
      if (!userId) {
        throw new Error("User ID is required for payroll generation");
      }

      // Validate month and year
      if (!month || !year || month < 1 || month > 12) {
        throw new Error("Invalid month. Must be between 1 and 12.");
      }
      if (year < 2020 || year > 2030) {
        throw new Error("Invalid year. Must be between 2020 and 2030.");
      }

      // Check if payroll already exists for this period
      const existingPayroll = await this.getPayrollEntries(month, year);
      if (existingPayroll.length > 0) {
        throw new Error(
          `Payroll for ${this.getMonthName(month)} ${year} already exists. Please clear it first if you want to regenerate.`,
        );
      }

      // Get all active employees
      console.log(`[Payroll] Querying active employees for ${month}/${year}`);
      const activeEmployees = await db
        .select({
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          employeeCode: employees.employeeCode,
          category: employees.category,
          salary: employees.salary,
          grade: employees.grade,
          contractCurrency: employees.contractCurrency,
          contractSalary: employees.contractSalary,
          isActive: employees.isActive,
        })
        .from(employees)
        .where(eq(employees.isActive, true));

      if (activeEmployees.length === 0) {
        throw new Error(
          "No active employees found. Please add employees before generating payroll.",
        );
      }

      console.log(
        `[Payroll] Found ${activeEmployees.length} active employees.`,
      );
      if (activeEmployees.length === 0) {
        throw new Error("No active employees found.");
      }

      // Get active projects for consultant allocation
      console.log(`[Payroll] Querying active projects for ${month}/${year}`);
      const activeProjects = await db
        .select({
          id: projects.id,
          title: projects.title, // Included for context, though not directly in logic
          startDate: projects.startDate,
          plannedEndDate: projects.plannedEndDate,
          actualEndDate: projects.actualEndDate,
          status: projects.status, // Used in WHERE, included for context
        })
        .from(projects)
        .where(
          or(
            eq(projects.status, "in_progress"),
            eq(projects.status, "planning"),
          ),
        );

      console.log(`[Payroll] Found ${activeProjects.length} active projects.`);
      const generatedPayroll: PayrollEntry[] = [];

      for (const employee of activeEmployees) {
        if (!employee) {
          console.error(
            `Skipping null employee object during payroll generation for ${month}/${year}.`,
          );
          continue;
        }

        // Default names for logging if null/undefined, but category is critical
        const logFirstName = employee.firstName || "Unknown";
        const logLastName = employee.lastName || "Employee";

        if (!employee.category) {
          console.error(
            `Skipping employee ID ${employee.id || "N/A"} due to missing category during payroll generation for ${month}/${year}.`,
          );
          continue;
        }

        console.log(
          `Processing payroll for employee: ${logFirstName} ${logLastName} (${employee.category})`,
        );

        const salaryToUse = employee.salary;
        let basicSalary = "0";
        let consultantFee = 0;
        // Feeds payroll_entries.working_days. Despite the column name this now
        // holds CALENDAR days, for both permanent staff (whole month) and
        // consultants (days assigned) — payroll pro-rates on calendar days.
        // The column and the payslip's "Working Days" label are left alone
        // here; renaming them is a migration plus a UI change.
        let workingDays = this.getCalendarDaysInMonth(month, year);
        let projectId: number | null = null;
        let projectEarningsList: Array<{
          projectId: number;
          title: string;
          earnings: number;
        }> = [];

        if (employee.category === "permanent") {
          basicSalary = parseFloat(salaryToUse || "0").toFixed(2);
        } else if (
          employee.category === "consultant" ||
          employee.category === "contract"
        ) {
          // Consultants/contractors earn per project, split by real time worked.
          basicSalary = "0";
          const split = await this.computeProjectEarnings(employee, month, year);
          projectEarningsList = split.projectEarningsList;
          consultantFee = split.totalEarnings;
          // Store the calendar days actually assigned, so the payslip's day
          // count matches the basis the money was calculated on.
          workingDays = split.totalWorkingDays;
          // Keep the last project as the entry's projectId fallback.
          projectId =
            projectEarningsList.length > 0
              ? projectEarningsList[projectEarningsList.length - 1].projectId
              : null;
        }

        // PF base at generation = basic + consultant project fees (D2).
        const calculatedTotalEarnings = parseFloat(basicSalary) + consultantFee;

        // Skip employees with zero total earnings (e.g. consultants with no active project assignments)
        if (calculatedTotalEarnings === 0) {
          console.log(
            `Skipping payroll for ${logFirstName} ${logLastName} (${employee.category}) — zero earnings for ${this.getMonthName(month)} ${year}`,
          );
          continue;
        }

        // Manual additions and reimbursements do not exist yet at generation,
        // so the base here is basic + consultant project fees. It is recomputed
        // by updatePayrollEntryTotals when additions change (2.3).
        const pfAmount = this.computePfAmount(
          parseFloat(basicSalary),
          consultantFee,
        );
        const netAmount = calculatedTotalEarnings - pfAmount;

        // Create payroll entry
        const [payrollEntry] = await db
          .insert(payrollEntries)
          .values({
            employeeId: employee.id,
            month: month,
            year: year,
            workingDays: workingDays,
            basicSalary: basicSalary,
            totalAdditions: consultantFee.toFixed(2),
            totalDeductions: pfAmount.toFixed(2),
            totalAmount: netAmount.toFixed(2),
            status: "generated",
            projectId: projectId,
          })
          .returning();

        // Create the system-generated Provident Fund deduction row.
        if (pfAmount > 0) {
          await db.insert(payrollDeductions).values({
            payrollEntryId: payrollEntry.id,
            type: "provident_fund",
            description: "Provident Fund Contribution",
            amount: pfAmount.toFixed(2),
            note: "5% of PF base (basic + additions excluding reimbursements)",
          });
        }

        // Create consultant project additions if applicable
        if (
          (employee.category === "consultant" ||
            employee.category === "contract") &&
          projectEarningsList.length > 0
        ) {
          for (const projectEarning of projectEarningsList) {
            await db.insert(payrollAdditions).values({
              payrollEntryId: payrollEntry.id,
              type: "project_fee",
              description: `Project Fee: ${projectEarning.title}`,
              amount: projectEarning.earnings.toFixed(2),
              note: `Earnings for project during ${this.getMonthName(month)} ${year}`,
            });
          }
        }

        // Add every approved reimbursement not yet carried by a payslip.
        // `payrollMonth IS NULL` is the "not yet applied" marker — the stamp is
        // written below, when the claim actually lands here, so a claim can
        // never be applied twice and can never be stranded by a payroll that
        // was already generated when it was approved.
        //
        // The approval-date bound stops a claim drifting BACKWARDS onto a
        // period generated late: a claim approved in August must not appear on
        // a June payslip generated in September. `firstOfNextMonth` is the
        // first instant after the period being generated, so the claim lands on
        // the first payroll run at or after its own approval month.
        const firstOfNextMonth = new Date(year, month, 1);
        const employeeReimbursements = await db
          .select()
          .from(reimbursements)
          .where(
            and(
              eq(reimbursements.employeeId, employee.id),
              eq(reimbursements.status, "approved"),
              isNull(reimbursements.payrollMonth),
              lt(reimbursements.approvalTimestamp, firstOfNextMonth),
            ),
          );

        let totalReimbursementAmount = 0;
        for (const reimbursement of employeeReimbursements) {
          const reimbursementAmount = parseFloat(reimbursement.amount || "0");
          if (reimbursementAmount > 0) {
            await db.insert(payrollAdditions).values({
              payrollEntryId: payrollEntry.id,
              // Not an earning — repays the employee's own outlay. Typed so the
              // provident-fund base and Salary Expense can exclude it without
              // matching on the "Reimbursement: " description prefix.
              type: "reimbursement",
              description: `Reimbursement: ${reimbursement.description?.substring(0, 50) || "Expense claim"}`,
              amount: reimbursementAmount.toFixed(2),
              note: `Original expense date: ${reimbursement.originalExpenseDate}`,
            });

            // Claim the reimbursement for this period. This is what makes it
            // invisible to the next run's `payrollMonth IS NULL` filter, and it
            // is also what postPayrollAccrual reads to build the GL lines, so
            // the stamp has to be written here — before the entry can be
            // approved — not at reimbursement-approval time.
            await db
              .update(reimbursements)
              .set({ payrollMonth: month, payrollYear: year })
              .where(eq(reimbursements.id, reimbursement.id));

            totalReimbursementAmount += reimbursementAmount;
          }
        }

        // Update payroll entry totals if reimbursements were added
        if (totalReimbursementAmount > 0) {
          // Get the current payroll entry to use its existing totalAmount as base
          const currentEntry = await this.getPayrollEntry(payrollEntry.id);
          if (currentEntry) {
            // Get all additions for this payroll entry
            const allAdditions = await db
              .select()
              .from(payrollAdditions)
              .where(eq(payrollAdditions.payrollEntryId, payrollEntry.id));

            const newTotalAdditions = allAdditions.reduce(
              (sum, add) => sum + parseFloat(add.amount || "0"),
              0,
            );

            // For the total amount, we add reimbursements to the existing totalAmount
            // This avoids double-counting because the existing totalAmount was calculated correctly
            // (basicSalary - deductions for consultants, or basicSalary + additions - deductions for permanent)
            const currentTotal = parseFloat(currentEntry.totalAmount || "0");
            const newTotalAmount = currentTotal + totalReimbursementAmount;

            await db
              .update(payrollEntries)
              .set({
                totalAdditions: newTotalAdditions.toFixed(2),
                totalAmount: newTotalAmount.toFixed(2),
              })
              .where(eq(payrollEntries.id, payrollEntry.id));
          }
        }

        // No GL at generation (D7). The accrual posts when the entry is
        // APPROVED — see postPayrollAccrual — so a generated entry carries no
        // ledger rows and drafts never touch the books.

        generatedPayroll.push({
          // Map to PayrollEntryWithEmployeeDetails
          id: payrollEntry.id,
          employeeId: payrollEntry.employeeId,
          month: payrollEntry.month,
          year: payrollEntry.year,
          workingDays: payrollEntry.workingDays,
          basicSalary: payrollEntry.basicSalary,
          totalAdditions: payrollEntry.totalAdditions,
          totalDeductions: payrollEntry.totalDeductions,
          totalAmount: payrollEntry.totalAmount,
          status: payrollEntry.status,
          generatedDate: payrollEntry.generatedDate,
          projectId: payrollEntry.projectId,
          employee: {
            // Use potentially defaulted names for the final returned object as well
            id: employee.id,
            firstName: employee.firstName || "Unknown",
            lastName: employee.lastName || "Employee",
            employeeCode: employee.employeeCode,
          },
        });
      }

      console.log(
        `Successfully generated payroll for ${generatedPayroll.length} employees`,
      );
      return generatedPayroll;
    } catch (error: any) {
      console.error("Original error in generateMonthlyPayroll:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in generateMonthlyPayroll (month: ${month}, year: ${year}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "generateMonthlyPayroll",
        severity: "error",
      });
      throw error;
    }
  }

  /**
   * referenceType for the payroll accrual, kept distinct from "manual"
   * (journals) and "payroll_payment" so a period clear can target payroll rows
   * without touching a genuine journal that shares a reference id (L8).
   */
  private readonly PAYROLL_ACCRUAL_REF = "payroll";

  /**
   * Post the payroll accrual for one entry, at APPROVAL (D7). Idempotent — if the
   * accrual is already in the ledger it does nothing, so approving twice, or a
   * direct generated→paid jump that posts it on the way, is safe.
   *
   *   Dr Salary Expense      earnings (basic + additions excl. reimbursements),
   *                          split per project by real time worked (L15/L12)
   *   Dr <category account>  each reimbursement, by category, carrying projectId (D16)
   *      Cr Provident Fund 2120  the PF withheld
   *      Cr Salary Payable       earnings − PF + reimbursements (D18)
   *
   * Advances (non-PF deductions) get no line — they stay inside Salary Payable
   * and are recognised only when it is paid (D18). ΣDr = ΣCr by construction.
   */
  async postPayrollAccrual(entryId: number, userId?: number): Promise<void> {
    const entry = await this.getPayrollEntry(entryId);
    if (!entry) return;

    // Idempotent: skip if this entry already has accrual rows.
    const already = await db
      .select({ id: generalLedgerEntries.id })
      .from(generalLedgerEntries)
      .where(
        and(
          eq(generalLedgerEntries.referenceType, this.PAYROLL_ACCRUAL_REF),
          eq(generalLedgerEntries.referenceId, entryId),
        ),
      )
      .limit(1);
    if (already.length > 0) return;

    const employeeId = entry.employeeId ?? undefined;
    if (employeeId === undefined) return;

    const [employee] = await db
      .select()
      .from(employees)
      .where(eq(employees.id, employeeId))
      .limit(1);
    if (!employee) return;

    const additions = await this.getPayrollAdditions(entryId);
    const deductions = await this.getPayrollDeductions(entryId);
    const reimbRecords = await db
      .select()
      .from(reimbursements)
      .where(
        and(
          eq(reimbursements.employeeId, employeeId),
          eq(reimbursements.payrollMonth, entry.month),
          eq(reimbursements.payrollYear, entry.year),
          eq(reimbursements.status, "approved"),
        ),
      );

    const basic = parseFloat(entry.basicSalary || "0");
    const earnings =
      basic +
      additions
        .filter((a) => a.type !== "reimbursement")
        .reduce((s, a) => s + parseFloat(a.amount || "0"), 0);
    const pf = deductions
      .filter((d) => d.type === "provident_fund")
      .reduce((s, d) => s + parseFloat(d.amount || "0"), 0);
    // Every other deduction — `advance_recovery` and `other`, the remaining two
    // the CHECK constraint permits — recovers money already handed to the
    // employee outside the system and never booked when it was given. It has to
    // leave the payable, because Salary Payable is what will actually be paid:
    // without this the accrual credited gross less PF, the payment debited that
    // same figure, and Cash/Bank was credited more than left the bank. On the
    // one entry that carried an advance recovery the books said 3,334.75 was
    // paid where the employee received 2,834.75.
    const otherDeductions = deductions
      .filter((d) => d.type !== "provident_fund")
      .reduce((s, d) => s + parseFloat(d.amount || "0"), 0);
    const reimbTotal = reimbRecords.reduce(
      (s, r) => s + parseFloat(r.amount || "0"),
      0,
    );
    const payable = earnings - pf + reimbTotal - otherDeductions;

    if (earnings <= 0 && reimbTotal <= 0) return; // nothing to post (T4.18)

    const employeeName =
      `${employee.firstName || "Unknown"} ${employee.lastName || "Employee"}`.trim();
    const monthName = this.getMonthName(entry.month);
    // Month worked, not the approval date (D7).
    const transactionDate = `${entry.year}-${entry.month
      .toString()
      .padStart(2, "0")}-01`;

    const line = (over: {
      accountName: string;
      description: string;
      debitAmount?: string;
      creditAmount?: string;
      projectId?: number;
    }) => ({
      entryType: "payable",
      referenceType: this.PAYROLL_ACCRUAL_REF,
      referenceId: entryId,
      entityId: employee.id,
      entityName: employeeName,
      transactionDate,
      status: "pending",
      createdBy: userId,
      debitAmount: "0",
      creditAmount: "0",
      ...over,
    });

    // Every row of the accrual in ONE transaction (1.7/L14). Posted
    // independently, a failure part-way left the ledger one-sided — e.g. Salary
    // Expense debited with no matching credit to Salary Payable — on an entry
    // that still reported success and showed as approved.
    const affectedProjectIds = new Set<number>();

    await db.transaction(async (tx) => {
      // Dr Salary Expense — split per project by real time worked.
      if (earnings > 0) {
        const split = await this.computeProjectEarnings(
          employee,
          entry.month,
          entry.year,
        );
        if (split.projectEarningsList.length > 0) {
          const debits = this.splitAmountAcrossRows(
            split.projectEarningsList.map((p) => p.earnings),
            earnings,
          );
          for (let i = 0; i < split.projectEarningsList.length; i++) {
            await this.createGeneralLedgerEntry(
              line({
                accountName: "Salary Expense",
                description: `Salary for ${employeeName} - Project: ${split.projectEarningsList[i].title} - ${monthName} ${entry.year}`,
                debitAmount: debits[i].toFixed(2),
                projectId: split.projectEarningsList[i].projectId,
              }),
              tx,
            );
            affectedProjectIds.add(split.projectEarningsList[i].projectId);
          }
        } else {
          await this.createGeneralLedgerEntry(
            line({
              accountName: "Salary Expense",
              description: `Salary for ${employeeName} - ${monthName} ${entry.year}`,
              debitAmount: earnings.toFixed(2),
              projectId: entry.projectId || undefined,
            }),
            tx,
          );
          if (entry.projectId) affectedProjectIds.add(entry.projectId);
        }
      }

      // Dr each reimbursement to its category account (D16); the liability rides
      // Salary Payable (routed through salary — no separate reimbursement payable).
      for (const r of reimbRecords) {
        const amt = parseFloat(r.amount || "0");
        if (amt <= 0) continue;
        const code = accountCodeForCategory(r.category);
        const [acct] = await tx
          .select({ name: chartOfAccounts.accountName })
          .from(chartOfAccounts)
          .where(eq(chartOfAccounts.accountCode, code))
          .limit(1);
        await this.createGeneralLedgerEntry(
          line({
            accountName: acct?.name || "Employee Reimbursement",
            description: `Reimbursement (${r.category}) for ${employeeName} - ${monthName} ${entry.year}`,
            debitAmount: amt.toFixed(2),
            projectId: r.projectId || undefined,
          }),
          tx,
        );
        if (r.projectId) affectedProjectIds.add(r.projectId);
      }

      // Cr Provident Fund Contribution (2120).
      if (pf > 0) {
        await this.createGeneralLedgerEntry(
          line({
            accountName: "Provident Fund Contribution",
            description: `Provident Fund for ${employeeName} - ${monthName} ${entry.year}`,
            creditAmount: pf.toFixed(2),
          }),
          tx,
        );
      }

      // Cr Employee Advances (1120) — the non-PF deductions. These recover cash
      // already given to the employee and never booked at the time, so this
      // leaves the account with a CREDIT balance: a standing, visible measure of
      // disbursements that were never recorded, which someone clears by booking
      // the original payments. That is the point of putting it here rather than
      // netting it invisibly into Salary Expense.
      if (otherDeductions > 0) {
        await this.createGeneralLedgerEntry(
          line({
            accountName: "Employee Advances",
            description: `Advance / other deductions recovered from ${employeeName} - ${monthName} ${entry.year}`,
            creditAmount: otherDeductions.toFixed(2),
          }),
          tx,
        );
      }

      // Cr Salary Payable — what the employee is actually owed: earnings + reimbursements
      // less every deduction (D18, generalised beyond PF).
      await this.createGeneralLedgerEntry(
        line({
          accountName: "Salary Payable",
          description: `Salary payable to ${employeeName} - ${monthName} ${entry.year}`,
          creditAmount: payable.toFixed(2),
          projectId: entry.projectId || undefined,
        }),
        tx,
      );
      if (entry.projectId) affectedProjectIds.add(entry.projectId);
    });

    // Recalculate AFTER the commit: passing `tx` skips the per-row recalc,
    // because from inside the transaction the recalc could not see these rows.
    for (const projectId of Array.from(affectedProjectIds)) {
      await this.recalculateProjectCost(projectId);
    }
  }

  /**
   * Post the salary payment for one entry, at mark-paid ("Generate Payslip").
   * Debits Salary Payable by the exact figure the accrual credited it — read
   * back from the ledger — so the payable clears to zero with no drift (D18/L2).
   *   Dr Salary Payable (accrual credit) / Cr Cash/Bank (same)
   */
  async postPayrollPayment(entryId: number, userId?: number): Promise<void> {
    const [payableRow] = await db
      .select({ creditAmount: generalLedgerEntries.creditAmount })
      .from(generalLedgerEntries)
      .where(
        and(
          eq(generalLedgerEntries.referenceType, this.PAYROLL_ACCRUAL_REF),
          eq(generalLedgerEntries.referenceId, entryId),
          eq(generalLedgerEntries.accountName, "Salary Payable"),
        ),
      )
      .limit(1);
    const amount = payableRow ? parseFloat(payableRow.creditAmount || "0") : 0;
    if (amount <= 0) return;

    const entry = await this.getPayrollEntry(entryId);
    if (!entry) return;
    const employeeId = entry.employeeId ?? undefined;
    if (employeeId === undefined) return;
    const [employee] = await db
      .select()
      .from(employees)
      .where(eq(employees.id, employeeId))
      .limit(1);
    const employeeName = employee
      ? `${employee.firstName || "Unknown"} ${employee.lastName || "Employee"}`.trim()
      : "Unknown Employee";
    const monthName = this.getMonthName(entry.month);
    const transactionDate = new Date().toISOString().split("T")[0];

    // Both rows in ONE transaction (1.7/L14). Posted independently, a failure
    // between them debited Salary Payable — clearing the liability — with no
    // matching credit to Cash/Bank, so the salary showed as settled without the
    // money ever leaving.
    await db.transaction(async (tx) => {
      await this.createGeneralLedgerEntry(
        {
          entryType: "payable",
          referenceType: "payroll_payment",
          referenceId: entryId,
          accountName: "Salary Payable",
          description: `Paid salary to ${employeeName} - ${monthName} ${entry.year}`,
          debitAmount: amount.toFixed(2),
          creditAmount: "0",
          entityId: employeeId,
          entityName: employeeName,
          projectId: entry.projectId || undefined,
          transactionDate,
          status: "paid",
          createdBy: userId,
        },
        tx,
      );
      await this.createGeneralLedgerEntry(
        {
          entryType: "payable",
          referenceType: "payroll_payment",
          referenceId: entryId,
          accountName: "Cash/Bank",
          description: `Paid salary to ${employeeName} - ${monthName} ${entry.year}`,
          debitAmount: "0",
          creditAmount: amount.toFixed(2),
          entityId: employeeId,
          entityName: employeeName,
          projectId: entry.projectId || undefined,
          transactionDate,
          status: "paid",
          createdBy: userId,
        },
        tx,
      );
    });

    // Recalculate after the commit (passing `tx` skips the per-row recalc).
    if (entry.projectId) {
      await this.recalculateProjectCost(entry.projectId);
    }
  }

  /**
   * Reverse every payroll GL row for an entry — the accrual ("payroll") and the
   * payment ("payroll_payment") — by posting a mirror row with debit/credit
   * swapped (L3/L24). Originals are kept so the audit trail survives; each pair
   * nets to zero. Reversals carry "payroll_reversal" so a later clear cannot
   * re-reverse them. Returns the number of reversal rows posted.
   */
  private async reversePayrollGLForEntry(
    entryId: number,
    userId?: number,
  ): Promise<number> {
    const rows = await db
      .select()
      .from(generalLedgerEntries)
      .where(
        and(
          eq(generalLedgerEntries.referenceId, entryId),
          or(
            eq(generalLedgerEntries.referenceType, this.PAYROLL_ACCRUAL_REF),
            eq(generalLedgerEntries.referenceType, "payroll_payment"),
          ),
        ),
      );
    const transactionDate = new Date().toISOString().split("T")[0];
    let count = 0;
    const affectedProjectIds = new Set<number>();

    // The whole reversal set in ONE transaction (1.7/L14). A partial reversal is
    // worse than none: it leaves the entry neither properly posted nor properly
    // reversed, with no way to tell which rows were undone.
    await db.transaction(async (tx) => {
      for (const r of rows) {
        await this.createGeneralLedgerEntry(
          {
            entryType: r.entryType,
            referenceType: "payroll_reversal",
            referenceId: entryId,
            accountName: r.accountName,
            description: `Reversal: ${r.description ?? ""}`,
            debitAmount: r.creditAmount ?? "0", // swap
            creditAmount: r.debitAmount ?? "0", // swap
            entityId: r.entityId ?? undefined,
            entityName: r.entityName ?? undefined,
            projectId: r.projectId ?? undefined,
            transactionDate,
            status: r.status ?? "pending",
            createdBy: userId,
          },
          tx,
        );
        if (r.projectId) affectedProjectIds.add(r.projectId);
        count++;
      }
    });

    // Recalculate after the commit (passing `tx` skips the per-row recalc).
    for (const projectId of Array.from(affectedProjectIds)) {
      await this.recalculateProjectCost(projectId);
    }
    return count;
  }

  async updatePayrollEntry(
    id: number,
    data: Partial<InsertPayrollEntry>,
    userId?: number,
  ): Promise<PayrollEntry | undefined> {
    try {
      // Get current payroll entry to check old status
      const currentPayrollEntry = await this.getPayrollEntry(id);
      if (!currentPayrollEntry) {
        console.error(`Payroll entry with ID ${id} not found. Cannot update.`);
        return undefined;
      }
      const oldStatus = currentPayrollEntry.status;

      const result = await db
        .update(payrollEntries)
        .set(data)
        .where(eq(payrollEntries.id, id))
        .returning();

      if (result.length > 0) {
        const updatedEntry = result[0];
        // Update totals after any changes
        await this.updatePayrollEntryTotals(id);

        // Post GL on the status transitions (D7/D18/G4).
        if (updatedEntry) {
          // The accrual posts when the entry becomes approved — and also on a
          // direct generated→paid jump, so a payment never lacks its accrual.
          // postPayrollAccrual is idempotent, so approved→paid won't double it.
          if (
            (data.status === "approved" && oldStatus !== "approved") ||
            (data.status === "paid" && oldStatus !== "paid")
          ) {
            await this.postPayrollAccrual(id, userId);
          }
          // The payment posts when the entry becomes paid.
          if (data.status === "paid" && oldStatus !== "paid") {
            await this.postPayrollPayment(id, userId);
          }
        }
        return updatedEntry; // Return the updated entry from the result array
      }
      return undefined;
    } catch (error: any) {
      console.error("Original error in updatePayrollEntry:", error);
      await this.createErrorLog({
        message:
          `Error in updatePayrollEntry (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updatePayrollEntry",
        severity: "error",
      });
      throw error;
    }
  }

  private readonly PF_RATE = 0.05;

  /**
   * Sum of additions that count toward the Provident Fund base. Everything an
   * employee earns counts EXCEPT reimbursements, which are the employee's own
   * money being returned, not pay (D2). Reimbursements are identified by their
   * `type`, never by a description prefix.
   */
  private pfEligibleAdditionsSum(
    additions: { type?: string | null; amount?: string | null }[],
  ): number {
    return additions
      .filter((a) => a.type !== "reimbursement")
      .reduce((sum, a) => sum + parseFloat(a.amount || "0"), 0);
  }

  /**
   * Provident Fund amount = 5% of the PF base. The base is earnings only —
   * basic salary plus PF-eligible additions — and is NEVER reduced by
   * deductions (D2): deductions are recoveries of money already advanced, so
   * letting them shrink the base would give two identical earners different PF.
   */
  private computePfAmount(
    basicSalary: number,
    pfEligibleAdditions: number,
  ): number {
    return (basicSalary + pfEligibleAdditions) * this.PF_RATE;
  }

  /**
   * Split `total` across N rows in proportion to their current weights, each
   * rounded to 2dp, with the rounding remainder placed on the largest row so
   * the parts sum to `total` to the cent (L12). One row takes the whole total;
   * all-zero weights fall back to an even split.
   */
  private splitAmountAcrossRows(weights: number[], total: number): number[] {
    const n = weights.length;
    if (n === 0) return [];
    if (n === 1) return [total];

    const positive = weights.some((w) => w > 0);
    const effective = positive ? weights : weights.map(() => 1);
    const weightSum = effective.reduce((s, w) => s + w, 0);

    const rounded = effective.map(
      (w) => Math.round(((total * w) / weightSum) * 100) / 100,
    );
    const remainder =
      Math.round((total - rounded.reduce((s, v) => s + v, 0)) * 100) / 100;
    if (remainder !== 0) {
      let largest = 0;
      for (let i = 1; i < rounded.length; i++) {
        if (rounded[i] > rounded[largest]) largest = i;
      }
      rounded[largest] = Math.round((rounded[largest] + remainder) * 100) / 100;
    }
    return rounded;
  }

  /**
   * Per-project earnings for a consultant/contract employee in a month, split by
   * the CALENDAR days each assignment overlaps the month (the same basis as the
   * payslip). Contract assignments do not overlap, so their days sum cleanly to
   * at most the month; consultants may hold overlapping assignments and are paid
   * per project, so their days — and pay — can exceed a single month. Used at
   * generation AND when posting the accrual at approval, so the Salary Expense
   * split always reflects real time worked (4.6). Permanent staff have no
   * project earnings here (their pay is basic salary, one row, no project).
   */
  private async computeProjectEarnings(
    employee: { id: number; salary: string | null },
    month: number,
    year: number,
  ): Promise<{
    projectEarningsList: Array<{
      projectId: number;
      title: string;
      earnings: number;
    }>;
    totalEarnings: number;
    totalWorkingDays: number;
  }> {
    const projectEarningsList: Array<{
      projectId: number;
      title: string;
      earnings: number;
    }> = [];
    let totalEarnings = 0;
    let totalWorkingDays = 0;

    const assignments = await db
      .select({
        projectId: projectEmployees.projectId,
        assignmentStartDate: projectEmployees.startDate,
        assignmentEndDate: projectEmployees.endDate,
        projectTitle: projects.title,
        projectStartDate: projects.startDate,
        projectPlannedEndDate: projects.plannedEndDate,
        projectActualEndDate: projects.actualEndDate,
      })
      .from(projectEmployees)
      .leftJoin(projects, eq(projectEmployees.projectId, projects.id))
      .where(eq(projectEmployees.employeeId, employee.id));

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    const dailyRate =
      parseFloat(employee.salary || "0") /
      this.getCalendarDaysInMonth(month, year);

    for (const assignment of assignments) {
      if (!assignment.projectId) continue;

      const pStart = assignment.assignmentStartDate
        ? new Date(assignment.assignmentStartDate)
        : assignment.projectStartDate
          ? new Date(assignment.projectStartDate)
          : monthStart;
      const pEnd = assignment.assignmentEndDate
        ? new Date(assignment.assignmentEndDate)
        : assignment.projectActualEndDate
          ? new Date(assignment.projectActualEndDate)
          : assignment.projectPlannedEndDate
            ? new Date(assignment.projectPlannedEndDate)
            : monthEnd;

      const effectiveStart = pStart > monthStart ? pStart : monthStart;
      const effectiveEnd = pEnd < monthEnd ? pEnd : monthEnd;
      if (effectiveStart > effectiveEnd) continue;

      const days = this.calculateCalendarDays(effectiveStart, effectiveEnd);
      const earnings = dailyRate * days;
      if (earnings > 0) {
        totalEarnings += earnings;
        totalWorkingDays += days;
        projectEarningsList.push({
          projectId: assignment.projectId,
          title: assignment.projectTitle || "Unknown Project",
          earnings,
        });
      }
    }

    return { projectEarningsList, totalEarnings, totalWorkingDays };
  }

  async updatePayrollEntryTotals(payrollEntryId: number): Promise<void> {
    try {
      // Get all additions and deductions for this payroll entry
      const additions = await this.getPayrollAdditions(payrollEntryId);
      const deductions = await this.getPayrollDeductions(payrollEntryId);

      // Get the basic salary
      const payrollEntry = await db
        .select()
        .from(payrollEntries)
        .where(eq(payrollEntries.id, payrollEntryId))
        .limit(1);

      if (payrollEntry.length === 0) {
        throw new Error(`Payroll entry ${payrollEntryId} not found`);
      }

      const basicSalary = parseFloat(payrollEntry[0].basicSalary || "0");

      // Recompute Provident Fund before summing deductions (2.3). PF tracks the
      // additions (a bonus raises it); it does not track deductions, so this is
      // a no-op when only a deduction changed. The system-generated PF row is
      // updated in place to the new figure so it flows into totalDeductions and
      // net below; it is identified by type, and is not hand-editable (2.4).
      const pfAmount = this.computePfAmount(
        basicSalary,
        this.pfEligibleAdditionsSum(additions),
      );
      const newPf = pfAmount.toFixed(2);
      const pfRow = deductions.find((d) => d.type === "provident_fund");
      if (pfRow) {
        if (pfRow.amount !== newPf) {
          await db
            .update(payrollDeductions)
            .set({ amount: newPf })
            .where(eq(payrollDeductions.id, pfRow.id));
          pfRow.amount = newPf;
        }
      } else if (pfAmount > 0) {
        // No PF row yet — e.g. an entry generated with zero earnings that has
        // since received an addition. Create it so PF stays consistent.
        const [created] = await db
          .insert(payrollDeductions)
          .values({
            payrollEntryId: payrollEntryId,
            type: "provident_fund",
            description: "Provident Fund Contribution",
            amount: newPf,
            note: "5% of PF base (basic + additions excluding reimbursements)",
          })
          .returning();
        deductions.push(created);
      }

      const totalAdditions = additions.reduce(
        (sum, addition) => sum + parseFloat(addition.amount || "0"),
        0,
      );
      const totalDeductions = deductions.reduce(
        (sum, deduction) => sum + parseFloat(deduction.amount || "0"),
        0,
      );

      const totalEarnings = basicSalary + totalAdditions;
      const totalAmount = totalEarnings - totalDeductions;

      // Update the payroll entry
      await db
        .update(payrollEntries)
        .set({
          totalAdditions: totalAdditions.toFixed(2),
          totalDeductions: totalDeductions.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
        })
        .where(eq(payrollEntries.id, payrollEntryId));

      // No GL here anymore. Since P4 the accrual posts at approval
      // (postPayrollAccrual), and additions/deductions are locked once approved,
      // so recomputing totals never has an accrual to update — the split now
      // lives in postPayrollAccrual. This method only maintains the stored
      // totals and the system PF row (2.3).

      console.log(
        `Updated payroll entry ${payrollEntryId} totals: additions=${totalAdditions.toFixed(
          2,
        )}, deductions=${totalDeductions.toFixed(
          2,
        )}, total=${totalAmount.toFixed(2)}`,
      );
    } catch (error: any) {
      console.error("Original error in updatePayrollEntryTotals:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in updatePayrollEntryTotals (payrollEntryId: ${payrollEntryId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updatePayrollEntryTotals",
        severity: "error",
      });
      throw error;
    }
  }

  async clearPayrollPeriod(
    month: number,
    year: number,
    userId?: number,
  ): Promise<{
    deletedPayrollEntries: number;
    deletedGeneralLedgerEntries: number;
  }> {
    try {
      // Get payroll entries for this period first
      const payrollEntriesToDelete = await this.getPayrollEntries(month, year);

      if (payrollEntriesToDelete.length === 0) {
        return { deletedPayrollEntries: 0, deletedGeneralLedgerEntries: 0 };
      }

      const payrollIds = payrollEntriesToDelete.map((entry) => entry.id);

      // Reverse each entry's payroll GL — accrual AND payment — instead of the
      // old incomplete "manual" hard-delete that left PF, reimbursement, Cash
      // and payment rows orphaned (L3). Originals stay; the reversals net them
      // to zero. Then the entries themselves are removed below.
      let deletedGLCount = 0;
      for (const payrollId of payrollIds) {
        deletedGLCount += await this.reversePayrollGLForEntry(payrollId, userId);
      }

      // Release the reimbursements this period had claimed. Their addition rows
      // die with the entries below, so leaving the stamp would strand them:
      // generateMonthlyPayroll only picks up `payrollMonth IS NULL`, and they
      // would sit approved but unpayable on every future run. Nulling the stamp
      // returns them to the pool for whichever payroll is generated next.
      await db
        .update(reimbursements)
        .set({ payrollMonth: null, payrollYear: null })
        .where(
          and(
            eq(reimbursements.payrollMonth, month),
            eq(reimbursements.payrollYear, year),
          ),
        );

      // Delete payroll entries (this will cascade to delete additions and deductions)
      const payrollDeleteCount = await this.clearPayrollEntriesByPeriod(
        month,
        year,
      );

      return {
        deletedPayrollEntries: payrollDeleteCount,
        deletedGeneralLedgerEntries: deletedGLCount,
      };
    } catch (error: any) {
      console.error("Original error in clearPayrollPeriod:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in clearPayrollPeriod (month: ${month}, year: ${year}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "clearPayrollPeriod",
        severity: "error",
      });
      throw error;
    }
  }

  async clearPayrollEntriesByPeriod(
    month: number,
    year: number,
  ): Promise<number> {
    try {
      const result = await db
        .delete(payrollEntries)
        .where(
          and(eq(payrollEntries.month, month), eq(payrollEntries.year, year)),
        );
      return result.count ?? 0;
    } catch (error: any) {
      console.error("Original error in clearPayrollEntriesByPeriod:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in clearPayrollEntriesByPeriod (month: ${month}, year: ${year}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "clearPayrollEntriesByPeriod",
        severity: "error",
      });
      throw error;
    }
  }

  async clearAllPayrollEntries(userId?: number): Promise<number> {
    try {
      // Reverse the payroll GL for every entry first (L24 — it previously wiped
      // entries with no ledger handling at all), then delete the entries.
      const allEntries = await db
        .select({ id: payrollEntries.id })
        .from(payrollEntries);
      for (const e of allEntries) {
        await this.reversePayrollGLForEntry(e.id, userId);
      }
      const result = await db.delete(payrollEntries);
      return result.count ?? 0;
    } catch (error: any) {
      console.error("Original error in clearAllPayrollEntries:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          "Error in clearAllPayrollEntries: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "clearAllPayrollEntries",
        severity: "error",
      });
      throw error;
    }
  }

  /**
   * Per-employee Provident Fund balance from the ledger (D14). PF accrues as a
   * credit to "Provident Fund Contribution" (2120) each month and is cleared by
   * a debit (manual journal) when paid out on exit, so the balance is
   * Σcredit − Σdebit per employee (entityId). Reversal debits net cleared
   * payroll back out automatically.
   */
  async getProvidentFundBalances(): Promise<
    Array<{ entityId: number; entityName: string; balance: string }>
  > {
    const rows = await db
      .select({
        entityId: generalLedgerEntries.entityId,
        entityName: generalLedgerEntries.entityName,
        debitAmount: generalLedgerEntries.debitAmount,
        creditAmount: generalLedgerEntries.creditAmount,
      })
      .from(generalLedgerEntries)
      .where(
        eq(generalLedgerEntries.accountName, "Provident Fund Contribution"),
      );

    const byEmployee = new Map<number, { entityName: string; balance: number }>();
    for (const r of rows) {
      if (r.entityId == null) continue;
      const delta =
        parseFloat(String(r.creditAmount || "0")) -
        parseFloat(String(r.debitAmount || "0"));
      const cur = byEmployee.get(r.entityId) ?? {
        entityName: r.entityName || "Unknown",
        balance: 0,
      };
      cur.balance += delta;
      byEmployee.set(r.entityId, cur);
    }

    return Array.from(byEmployee.entries()).map(([entityId, v]) => ({
      entityId,
      entityName: v.entityName,
      balance: v.balance.toFixed(2),
    }));
  }

  // Payroll Additions methods
  async getPayrollAdditions(
    payrollEntryId: number,
  ): Promise<PayrollAddition[]> {
    try {
      return await db
        .select()
        .from(payrollAdditions)
        .where(eq(payrollAdditions.payrollEntryId, payrollEntryId));
    } catch (error: any) {
      console.error("Original error in getPayrollAdditions:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in getPayrollAdditions (payrollEntryId: ${payrollEntryId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPayrollAdditions",
        severity: "error",
      });
      throw error;
    }
  }

  async getPayrollAddition(id: number): Promise<PayrollAddition | undefined> {
    try {
      const result = await db
        .select()
        .from(payrollAdditions)
        .where(eq(payrollAdditions.id, id))
        .limit(1);
      return result[0];
    } catch (error: any) {
      console.error("Original error in getPayrollAddition:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in getPayrollAddition (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPayrollAddition",
        severity: "error",
      });
      throw error;
    }
  }

  async createPayrollAddition(
    additionData: InsertPayrollAddition,
  ): Promise<PayrollAddition> {
    try {
      const [addition] = await db
        .insert(payrollAdditions)
        // `type` is NOT NULL. Fall back to 'bonus' when a caller omits it, so
        // a client that has not yet been updated cannot fail outright.
        // 'bonus' is the conservative choice: it is an earning, so it attracts
        // provident fund and posts to Salary Expense like any other addition.
        // Applied AFTER the spread — placing it before leaves it dead, since
        // an explicit undefined from req.body would still overwrite it.
        .values({
          ...additionData,
          type: additionData.type ?? "bonus",
        })
        .returning();

      // Update payroll entry totals
      await this.updatePayrollEntryTotals(additionData.payrollEntryId);

      return addition;
    } catch (error: any) {
      console.error("Original error in createPayrollAddition:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          "Error in createPayrollAddition: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createPayrollAddition",
        severity: "error",
      });
      throw error;
    }
  }

  async updatePayrollAddition(
    id: number,
    data: Partial<InsertPayrollAddition>,
  ): Promise<PayrollAddition | undefined> {
    try {
      const result = await db
        .update(payrollAdditions)
        .set(data)
        .where(eq(payrollAdditions.id, id))
        .returning();

      if (result.length > 0) {
        // Update payroll entry totals
        const addition = await this.getPayrollAddition(id);
        if (addition) {
          await this.updatePayrollEntryTotals(addition.payrollEntryId);
        }
      }

      return result[0];
    } catch (error: any) {
      console.error("Original error in updatePayrollAddition:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in updatePayrollAddition (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updatePayrollAddition",
        severity: "error",
      });
      throw error;
    }
  }

  async deletePayrollAddition(id: number): Promise<boolean> {
    try {
      // Get the addition first to get payroll entry ID
      const addition = await this.getPayrollAddition(id);
      if (!addition) {
        return false;
      }

      const result = await db
        .delete(payrollAdditions)
        .where(eq(payrollAdditions.id, id));

      if (result.count && result.count > 0) {
        // Update payroll entry totals
        await this.updatePayrollEntryTotals(addition.payrollEntryId);
        return true;
      }

      return false;
    } catch (error: any) {
      console.error("Original error in deletePayrollAddition:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in deletePayrollAddition (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deletePayrollAddition",
        severity: "error",
      });
      throw error;
    }
  }

  // Payroll Deductions methods
  async getPayrollDeductions(
    payrollEntryId: number,
  ): Promise<PayrollDeduction[]> {
    try {
      return await db
        .select()
        .from(payrollDeductions)
        .where(eq(payrollDeductions.payrollEntryId, payrollEntryId));
    } catch (error: any) {
      console.error("Original error in getPayrollDeductions:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in getPayrollDeductions (payrollEntryId: ${payrollEntryId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPayrollDeductions",
        severity: "error",
      });
      throw error;
    }
  }

  async getPayrollDeduction(id: number): Promise<PayrollDeduction | undefined> {
    try {
      const result = await db
        .select()
        .from(payrollDeductions)
        .where(eq(payrollDeductions.id, id))
        .limit(1);
      return result[0];
    } catch (error: any) {
      console.error("Original error in getPayrollDeduction:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in getPayrollDeduction (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPayrollDeduction",
        severity: "error",
      });
      throw error;
    }
  }

  /**
   * The Provident Fund deduction is system-generated and kept in step with the
   * PF base by updatePayrollEntryTotals (2.3). It must never be created,
   * edited or removed by hand — the recompute assumes exactly one PF row and
   * owns its amount. The system's own writes use direct db calls, not these
   * public methods, so guarding here blocks only the manual (route) path.
   * Carries `code = "PF_PROTECTED"` so the routes can answer 400, not 500.
   */
  private providentFundProtectedError(
    action: "added" | "edited" | "removed",
  ): Error {
    const err: any = new Error(
      `The Provident Fund deduction is calculated automatically and cannot be ${action} manually.`,
    );
    err.code = "PF_PROTECTED";
    return err;
  }

  async createPayrollDeduction(
    deductionData: InsertPayrollDeduction,
  ): Promise<PayrollDeduction> {
    if (deductionData.type === "provident_fund") {
      throw this.providentFundProtectedError("added");
    }
    try {
      const [deduction] = await db
        .insert(payrollDeductions)
        // `type` is NOT NULL. Fall back to 'advance_recovery': the team
        // confirmed manual deductions are recoveries of money already paid.
        // It is also the safer default — it settles an asset rather than
        // creating a liability the company would then owe onward.
        // Applied AFTER the spread, for the reason noted in createPayrollAddition.
        .values({
          ...deductionData,
          type: deductionData.type ?? "advance_recovery",
        })
        .returning();

      // Update payroll entry totals
      await this.updatePayrollEntryTotals(deductionData.payrollEntryId);

      return deduction;
    } catch (error: any) {
      console.error("Original error in createPayrollDeduction:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          "Error in createPayrollDeduction: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createPayrollDeduction",
        severity: "error",
      });
      throw error;
    }
  }

  async updatePayrollDeduction(
    id: number,
    data: Partial<InsertPayrollDeduction>,
  ): Promise<PayrollDeduction | undefined> {
    const existing = await this.getPayrollDeduction(id);
    if (existing?.type === "provident_fund") {
      throw this.providentFundProtectedError("edited");
    }
    try {
      const result = await db
        .update(payrollDeductions)
        .set(data)
        .where(eq(payrollDeductions.id, id))
        .returning();

      if (result.length > 0) {
        // Update payroll entry totals
        const deduction = await this.getPayrollDeduction(id);
        if (deduction) {
          await this.updatePayrollEntryTotals(deduction.payrollEntryId);
        }
      }

      return result[0];
    } catch (error: any) {
      console.error("Original error in updatePayrollDeduction:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in updatePayrollDeduction (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updatePayrollDeduction",
        severity: "error",
      });
      throw error;
    }
  }

  async deletePayrollDeduction(id: number): Promise<boolean> {
    // Fetch first — for the PF guard and for the payroll entry ID. Kept out of
    // the try so the guard throw is not swallowed and logged as an error.
    const deduction = await this.getPayrollDeduction(id);
    if (!deduction) {
      return false;
    }
    if (deduction.type === "provident_fund") {
      throw this.providentFundProtectedError("removed");
    }
    try {
      const result = await db
        .delete(payrollDeductions)
        .where(eq(payrollDeductions.id, id));

      if (result.count && result.count > 0) {
        // Update payroll entry totals
        await this.updatePayrollEntryTotals(deduction.payrollEntryId);
        return true;
      }

      return false;
    } catch (error: any) {
      console.error("Original error in deletePayrollDeduction:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in deletePayrollDeduction (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deletePayrollDeduction",
        severity: "error",
      });
      throw error;
    }
  }
}
