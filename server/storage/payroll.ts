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
import {
  and,
  desc,
  eq,
  or,
  sql,
} from "drizzle-orm";
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
          // For consultants/contractors, check project assignments
          let totalEarnings = 0;
          let totalActualWorkingDays = 0;
          basicSalary = "0";

          // Query assignments for this employee
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

          for (const assignment of assignments) {
            if (!assignment.projectId) continue;

            const pStart = assignment.assignmentStartDate
              ? new Date(assignment.assignmentStartDate)
              : assignment.projectStartDate
                ? new Date(assignment.projectStartDate)
                : new Date(year, month - 1, 1);
            const pEnd = assignment.assignmentEndDate
              ? new Date(assignment.assignmentEndDate)
              : assignment.projectActualEndDate
                ? new Date(assignment.projectActualEndDate)
                : assignment.projectPlannedEndDate
                  ? new Date(assignment.projectPlannedEndDate)
                  : new Date(year, month, 0);

            // Calculate working days in the month for this project
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0);

            const effectiveStart = pStart > monthStart ? pStart : monthStart;
            const effectiveEnd = pEnd < monthEnd ? pEnd : monthEnd;

            if (effectiveStart <= effectiveEnd) {
              const projectWorkingDays = this.calculateWorkingDays(
                effectiveStart,
                effectiveEnd,
              );
              const salaryToUse = employee.salary;
              const dailyRate =
                parseFloat(salaryToUse || "0") /
                this.getWorkingDaysInMonth(month, year);
              const earnings = dailyRate * projectWorkingDays;

              if (earnings > 0) {
                totalEarnings += earnings;
                totalActualWorkingDays += projectWorkingDays;
                projectEarningsList.push({
                  projectId: assignment.projectId,
                  title: assignment.projectTitle || "Unknown Project",
                  earnings: earnings,
                });
                projectId = assignment.projectId; // Keep last for GL tracking as fallback
              }
            }
          }

          consultantFee = totalEarnings;
          // Store actual working days (not calendar days) for contract/consultant employees
          workingDays = totalActualWorkingDays;
        }

        // Calculate deductions (5% TDS)
        const calculatedTotalEarnings = parseFloat(basicSalary) + consultantFee;

        // Skip employees with zero total earnings (e.g. consultants with no active project assignments)
        if (calculatedTotalEarnings === 0) {
          console.log(
            `Skipping payroll for ${logFirstName} ${logLastName} (${employee.category}) — zero earnings for ${this.getMonthName(month)} ${year}`,
          );
          continue;
        }

        const tdsAmount = calculatedTotalEarnings * 0.05;
        const netAmount = calculatedTotalEarnings - tdsAmount;

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
            totalDeductions: tdsAmount.toFixed(2),
            totalAmount: netAmount.toFixed(2),
            status: "generated",
            projectId: projectId,
          })
          .returning();

        // Create automatic TDS deduction
        if (tdsAmount > 0) {
          await db.insert(payrollDeductions).values({
            payrollEntryId: payrollEntry.id,
            description: "Provident Fund Contribution",
            amount: tdsAmount.toFixed(2),
            note: "5% of total earnings",
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
              description: `Project Fee: ${projectEarning.title}`,
              amount: projectEarning.earnings.toFixed(2),
              note: `Earnings for project during ${this.getMonthName(month)} ${year}`,
            });
          }
        }

        // Add approved reimbursements for this employee in this payroll period
        const employeeReimbursements = await db
          .select()
          .from(reimbursements)
          .where(
            and(
              eq(reimbursements.employeeId, employee.id),
              eq(reimbursements.status, "approved"),
              eq(reimbursements.payrollMonth, month),
              eq(reimbursements.payrollYear, year),
            ),
          );

        let totalReimbursementAmount = 0;
        for (const reimbursement of employeeReimbursements) {
          const reimbursementAmount = parseFloat(reimbursement.amount || "0");
          if (reimbursementAmount > 0) {
            await db.insert(payrollAdditions).values({
              payrollEntryId: payrollEntry.id,
              description: `Reimbursement: ${reimbursement.description?.substring(0, 50) || "Expense claim"}`,
              amount: reimbursementAmount.toFixed(2),
              note: `Original expense date: ${reimbursement.originalExpenseDate}`,
            });
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

        // Create double-entry GL records for salary expense only if amount > 0
        if (calculatedTotalEarnings > 0) {
          const transactionDate = `${year}-${month.toString().padStart(2, "0")}-01`;

          let glEmployeeFirstName = employee.firstName;
          let glEmployeeLastName = employee.lastName;

          if (!glEmployeeFirstName && !glEmployeeLastName) {
            console.warn(
              `Employee ID ${employee.id} has null first and last names. Using defaults for GL employee name.`,
            );
            glEmployeeFirstName = "Unknown";
            glEmployeeLastName = "Employee";
          } else if (!glEmployeeFirstName) {
            glEmployeeFirstName = "Unknown";
          } else if (!glEmployeeLastName) {
            glEmployeeLastName = "Employee";
          }
          const employeeName = `${glEmployeeFirstName} ${glEmployeeLastName}`;
          const monthName = this.getMonthName(month);

          console.log(
            `Creating GL entries for ${employeeName} - ${monthName} ${year} - Amount: ${calculatedTotalEarnings.toFixed(2)}`,
          );

          // 1. Debit: Salary Expense (increase expense)
          if (projectEarningsList.length > 0) {
            // Multiple GL entries for per-project allocation
            for (const projectEarning of projectEarningsList) {
              await this.createGeneralLedgerEntry({
                entryType: "payable",
                referenceType: "manual",
                referenceId: payrollEntry.id,
                accountName: "Salary Expense",
                description: `Salary for ${employeeName} - Project: ${projectEarning.title} - ${monthName} ${year}`,
                debitAmount: projectEarning.earnings.toFixed(2),
                creditAmount: "0",
                entityId: employee.id,
                entityName: employeeName,
                projectId: projectEarning.projectId,
                transactionDate: transactionDate,
                status: "pending",
                createdBy: userId,
              });
            }
          } else {
            // Single GL entry for permanent employees or if no projects (though calculatedTotalEarnings > 0 implies one)
            await this.createGeneralLedgerEntry({
              entryType: "payable",
              referenceType: "manual",
              referenceId: payrollEntry.id,
              accountName: "Salary Expense",
              description: `Salary for ${employeeName} - ${monthName} ${year}`,
              debitAmount: calculatedTotalEarnings.toFixed(2),
              creditAmount: "0",
              entityId: employee.id,
              entityName: employeeName,
              projectId: projectId || undefined,
              transactionDate: transactionDate,
              status: "pending",
              createdBy: userId,
            });
          }

          // 2. Credit: Salary Payable (increase liability - what we owe the employee)
          await this.createGeneralLedgerEntry({
            entryType: "payable",
            referenceType: "manual",
            referenceId: payrollEntry.id,
            accountName: "Salary Payable",
            description: `Salary payable to ${employeeName} - ${monthName} ${year}`,
            debitAmount: "0",
            creditAmount: calculatedTotalEarnings.toFixed(2),
            entityId: employee.id,
            entityName: employeeName,
            projectId: projectId || undefined,
            transactionDate: transactionDate,
            status: "pending",
            createdBy: userId,
          });

          console.log(
            `Successfully created payroll entry and GL records for ${employeeName}`,
          );
        } else {
          console.log(
            `Skipping GL entries for employee ${employee.firstName} ${employee.lastName} - no earnings for ${this.getMonthName(month)} ${year}`,
          );
        }

        generatedPayroll.push({
          // Map to PayrollEntryWithEmployeeDetails
          id: payrollEntry.id,
          employeeId: payrollEntry.employeeId,
          month: payrollEntry.month,
          year: payrollEntry.year,
          workingDays: payrollEntry.workingDays,
          basicSalary: payrollEntry.basicSalary,
          additions: payrollEntry.additions,
          deductions: payrollEntry.deductions,
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

        // Check if status changed to "paid"
        if (data.status === "paid" && oldStatus !== "paid" && updatedEntry) {
          const employeeDetails = await db
            .select()
            .from(employees)
            .where(eq(employees.id, updatedEntry.employeeId))
            .limit(1);

          if (employeeDetails.length > 0) {
            const employee = employeeDetails[0];
            let glEmployeeFirstName = employee.firstName || "Unknown";
            let glEmployeeLastName = employee.lastName || "Employee";
            if (employee.firstName === null && employee.lastName === null) {
              // Already handled by initialization, but explicit log for clarity if both were null
              console.warn(
                `Employee ID ${employee.id} has null first and last names. Using defaults "Unknown Employee" for GL payment entries.`,
              );
            } else if (employee.firstName === null) {
              glEmployeeFirstName = "Unknown";
            } else if (employee.lastName === null) {
              glEmployeeLastName = "Employee";
            }
            const employeeName = `${glEmployeeFirstName} ${glEmployeeLastName}`;
            const monthName = this.getMonthName(updatedEntry.month);
            const transactionDate = new Date().toISOString().split("T")[0];
            const totalAmountStr = updatedEntry.totalAmount
              ? parseFloat(updatedEntry.totalAmount).toFixed(2)
              : "0.00";

            console.log(
              `Processing 'paid' status update for payroll entry ID ${updatedEntry.id}. Employee: ${employeeName}, Amount: ${totalAmountStr}`,
            );

            // 1. Debit: Salary Payable (decrease liability)
            await this.createGeneralLedgerEntry({
              entryType: "payable",
              referenceType: "payroll_payment",
              referenceId: updatedEntry.id,
              accountName: "Salary Payable",
              description: `Paid salary to ${employeeName} - ${monthName} ${updatedEntry.year}`,
              debitAmount: totalAmountStr,
              creditAmount: "0",
              entityId: updatedEntry.employeeId,
              entityName: employeeName,
              projectId: updatedEntry.projectId || undefined,
              transactionDate: transactionDate,
              status: "paid",
              createdBy: userId,
            });

            // 2. Credit: Cash/Bank (decrease asset)
            await this.createGeneralLedgerEntry({
              entryType: "payable", // Or "asset" if treating Cash/Bank as asset reduction. "payable" aligns with other payment GLs.
              referenceType: "payroll_payment",
              referenceId: updatedEntry.id,
              accountName: "Cash/Bank",
              description: `Paid salary to ${employeeName} - ${monthName} ${updatedEntry.year}`,
              debitAmount: "0",
              creditAmount: totalAmountStr,
              entityId: updatedEntry.employeeId,
              entityName: employeeName,
              projectId: updatedEntry.projectId || undefined,
              transactionDate: transactionDate,
              status: "paid",
              createdBy: userId,
            });
            console.log(
              `Created GL payment entries for payroll ID ${updatedEntry.id}`,
            );
          } else {
            console.error(
              `Failed to retrieve employee details for employee ID ${updatedEntry.employeeId} during GL payment entry creation.`,
            );
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

  async updatePayrollEntryTotals(payrollEntryId: number): Promise<void> {
    try {
      // Get all additions and deductions for this payroll entry
      const additions = await this.getPayrollAdditions(payrollEntryId);
      const deductions = await this.getPayrollDeductions(payrollEntryId);

      const totalAdditions = additions.reduce(
        (sum, addition) => sum + parseFloat(addition.amount || "0"),
        0,
      );
      const totalDeductions = deductions.reduce(
        (sum, deduction) => sum + parseFloat(deduction.amount || "0"),
        0,
      );

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

      // Update corresponding general ledger entries
      const employee = await db
        .select()
        .from(employees)
        .where(eq(employees.id, payrollEntry[0].employeeId))
        .limit(1);

      if (employee.length > 0) {
        const employeeName = `${employee[0].firstName} ${employee[0].lastName}`;
        const monthName = this.getMonthName(payrollEntry[0].month);

        // Update GL entries with new amounts
        const salaryDescription = `Salary for ${employeeName} - ${monthName} ${payrollEntry[0].year}`;
        const payableDescription = `Salary payable to ${employeeName} - ${monthName} ${payrollEntry[0].year}`;

        await db.execute(sql`
          UPDATE general_ledger_entries 
          SET debit_amount = ${totalEarnings.toFixed(2)},
              description = ${salaryDescription}
          WHERE reference_type = 'manual' 
            AND reference_id = ${payrollEntryId} 
            AND account_name = 'Salary Expense'
        `);

        await db.execute(sql`
          UPDATE general_ledger_entries 
          SET credit_amount = ${totalEarnings.toFixed(2)},
              description = ${payableDescription}
          WHERE reference_type = 'manual' 
            AND reference_id = ${payrollEntryId} 
            AND account_name = 'Salary Payable'
        `);
      }

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

      // Delete related general ledger entries by iterating through each payroll ID
      let deletedGLCount = 0;
      for (const payrollId of payrollIds) {
        const result = await db
          .delete(generalLedgerEntries)
          .where(
            and(
              eq(generalLedgerEntries.referenceType, "manual"),
              eq(generalLedgerEntries.referenceId, payrollId.toString()),
              or(
                eq(generalLedgerEntries.accountName, "Salary Expense"),
                eq(generalLedgerEntries.accountName, "Salary Payable"),
              ),
            ),
          );
        deletedGLCount += result.rowCount || 0;
      }

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
      return result.rowCount || 0;
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

  async clearAllPayrollEntries(): Promise<number> {
    try {
      const result = await db.delete(payrollEntries);
      return result.rowCount || 0;
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
        .values(additionData)
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

  async createPayrollDeduction(
    deductionData: InsertPayrollDeduction,
  ): Promise<PayrollDeduction> {
    try {
      const [deduction] = await db
        .insert(payrollDeductions)
        .values(deductionData)
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
    try {
      // Get the deduction first to get payroll entry ID
      const deduction = await this.getPayrollDeduction(id);
      if (!deduction) {
        return false;
      }

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
