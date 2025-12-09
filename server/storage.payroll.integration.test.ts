import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { db } from "./db";
import { storage, type IStorage } from "./storage";
import {
  employees,
  projects,
  projectEmployees,
  payrollEntries,
  payrollAdditions,
  payrollDeductions,
  generalLedgerEntries,
  type InsertEmployee,
  type InsertProject,
  type InsertPayrollEntry,
  type PayrollEntry as ActualPayrollEntry,
  type Employee as ActualEmployee,
  type Project as ActualProject,
} from "@shared/schema";
import { eq, and, desc, sql, or, like, gte, lte, isNull, ne, inArray } from "drizzle-orm";

const clearTables = async () => {
  await db.delete(generalLedgerEntries).execute();
  await db.delete(payrollAdditions).execute();
  await db.delete(payrollDeductions).execute();
  await db.delete(payrollEntries).execute();
  await db.delete(projectEmployees).execute();
  await db.delete(projects).execute();
  await db.delete(employees).execute();
};

const getTestMonthName = (month: number): string => {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return months[month - 1] || "Unknown";
};

const calculateTestWorkingDays = (startDate: Date | null, endDate: Date | null): number => {
    if (!startDate || !endDate || endDate < startDate) {
      return 0;
    }
    let workingDays = 0;
    let currentDate = new Date(startDate.getTime());
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return workingDays;
};

const mockUserId = 1; // Define a mock user ID for testing 'createdBy'

describe('Storage Payroll Integration Tests', () => {
  beforeEach(async () => {
    await clearTables();
    // Suppress console.log, console.warn, console.error for cleaner test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  describe('Payroll Generation and GL Integration - Permanent Employee', () => {
    it('should generate payroll, create initial GL entries with createdBy, and payment GL entries with createdBy for a permanent employee', async () => {
      const permEmployeeData: InsertEmployee = {
        firstName: "Permanent", lastName: "Employee", email: "perm@example.com",
        category: "permanent", salary: "5000.00", isActive: true, employeeCode: "EMP001",
      };
      const [permEmployee] = await db.insert(employees).values(permEmployeeData).returning();

      const payrollMonth = 3;
      const payrollYear = 2024;

      await storage.generateMonthlyPayroll(payrollMonth, payrollYear, mockUserId);

      const entries = await db.select().from(payrollEntries).where(eq(payrollEntries.employeeId, permEmployee.id));
      expect(entries.length).toBe(1);
      const payrollEntry = entries[0];
      // ... (existing payroll entry assertions)
      expect(payrollEntry.basicSalary).toBe("5000.00");
      const expectedTDS = 5000.00 * 0.05;
      const expectedTotalAmount = 5000.00 - expectedTDS;
      expect(payrollEntry.totalDeductions).toBe(expectedTDS.toFixed(2));
      expect(payrollEntry.totalAmount).toBe(expectedTotalAmount.toFixed(2));


      let glEntriesInitial = await db.select().from(generalLedgerEntries)
        .where(and(eq(generalLedgerEntries.referenceId, payrollEntry.id), eq(generalLedgerEntries.referenceType, "manual")))
        .orderBy(generalLedgerEntries.accountName);

      expect(glEntriesInitial.length).toBe(2);
      const expenseEntry = glEntriesInitial.find(gl => gl.accountName === "Salary Expense");
      const payableEntry = glEntriesInitial.find(gl => gl.accountName === "Salary Payable");

      expect(expenseEntry?.createdBy).toBe(mockUserId);
      expect(payableEntry?.createdBy).toBe(mockUserId);

      await storage.updatePayrollEntry(payrollEntry.id, { status: "paid" }, mockUserId);

      const paymentGlEntries = await db.select().from(generalLedgerEntries)
        .where(and(eq(generalLedgerEntries.referenceId, payrollEntry.id), eq(generalLedgerEntries.referenceType, "payroll_payment")))
        .orderBy(generalLedgerEntries.accountName);
      expect(paymentGlEntries.length).toBe(2);

      const debitPayablePayment = paymentGlEntries.find(gl => gl.accountName === "Salary Payable");
      const creditCashBank = paymentGlEntries.find(gl => gl.accountName === "Cash/Bank");

      expect(debitPayablePayment?.debitAmount).toBe(expectedTotalAmount.toFixed(2));
      expect(debitPayablePayment?.createdBy).toBe(mockUserId);
      expect(creditCashBank?.creditAmount).toBe(expectedTotalAmount.toFixed(2));
      expect(creditCashBank?.createdBy).toBe(mockUserId);
    });
  });

  describe('Payroll Generation and GL Integration - Consultant Employee', () => {
    const payrollMonth = 4;
    const payrollYear = 2024;
    const consultantSalary = "4400.00";
    const dailyRate = parseFloat(consultantSalary) / 22;

    it('should generate payroll for a consultant with a single project assignment (full month) and audit GLs', async () => {
      const consultantData: InsertEmployee = {
        firstName: "Consultant", lastName: "One", email: "consult1@example.com",
        category: "consultant", salary: consultantSalary, isActive: true, employeeCode: "C001"
      };
      const [consultant] = await db.insert(employees).values(consultantData).returning();

      const projectStartDate = new Date(payrollYear, payrollMonth - 1, 1);
      const projectEndDate = new Date(payrollYear, payrollMonth - 1, 30);
      const projectData: InsertProject = {
        title: "Project Alpha", customerId: 1,
        startDate: projectStartDate, plannedEndDate: projectEndDate, status: "in_progress",
      };
      const [project] = await db.insert(projects).values(projectData).returning();
      await db.insert(projectEmployees).values({ projectId: project.id, employeeId: consultant.id });

      await storage.generateMonthlyPayroll(payrollMonth, payrollYear, mockUserId);

      const entries = await db.select().from(payrollEntries).where(eq(payrollEntries.employeeId, consultant.id));
      const payrollEntry = entries[0];
      // ... (assertions for amounts)
      const workingDaysInMonth = calculateTestWorkingDays(projectStartDate, projectEndDate);
      const expectedEarnings = dailyRate * workingDaysInMonth;
      expect(payrollEntry.basicSalary).toBe(expectedEarnings.toFixed(2));


      const glEntries = await db.select().from(generalLedgerEntries)
        .where(and(eq(generalLedgerEntries.referenceId, payrollEntry.id), eq(generalLedgerEntries.referenceType, "manual")));
      expect(glEntries.length).toBe(2);
      glEntries.forEach(gl => expect(gl.createdBy).toBe(mockUserId));
      const expenseEntry = glEntries.find(gl => gl.accountName === "Salary Expense");
      expect(expenseEntry?.debitAmount).toBe(expectedEarnings.toFixed(2));
      expect(expenseEntry?.projectId).toBe(project.id);
    });

    it('should generate payroll for a consultant with a project starting mid-month and audit GLs', async () => {
      const consultantData: InsertEmployee = {
        firstName: "Consultant", lastName: "Two", email: "consult2@example.com",
        category: "consultant", salary: consultantSalary, isActive: true, employeeCode: "C002"
      };
      const [consultant] = await db.insert(employees).values(consultantData).returning();

      const projectStartDate = new Date(payrollYear, payrollMonth - 1, 15);
      const projectEndDate = new Date(payrollYear, payrollMonth - 1, 30);
      const projectData: InsertProject = {
        title: "Project Beta", customerId: 1,
        startDate: projectStartDate, plannedEndDate: projectEndDate, status: "in_progress",
      };
      const [project] = await db.insert(projects).values(projectData).returning();
      await db.insert(projectEmployees).values({ projectId: project.id, employeeId: consultant.id });

      await storage.generateMonthlyPayroll(payrollMonth, payrollYear, mockUserId);

      const entries = await db.select().from(payrollEntries).where(eq(payrollEntries.employeeId, consultant.id));
      const payrollEntry = entries[0];
      // ... (assertions for amounts)
       const workingDaysInProjectPeriod = calculateTestWorkingDays(projectStartDate, projectEndDate);
      const expectedEarnings = dailyRate * workingDaysInProjectPeriod;
      expect(payrollEntry.basicSalary).toBe(expectedEarnings.toFixed(2));

      const glEntries = await db.select().from(generalLedgerEntries)
        .where(and(eq(generalLedgerEntries.referenceId, payrollEntry.id), eq(generalLedgerEntries.referenceType, "manual")));
      expect(glEntries.length).toBe(2);
      glEntries.forEach(gl => expect(gl.createdBy).toBe(mockUserId));
    });

    it('should generate payroll for a consultant with no project work in the month and audit GLs', async () => {
      const consultantData: InsertEmployee = {
        firstName: "Consultant", lastName: "Three", email: "consult3@example.com",
        category: "consultant", salary: consultantSalary, isActive: true, employeeCode: "C003"
      };
      const [consultant] = await db.insert(employees).values(consultantData).returning();

      const projectData: InsertProject = {
        title: "Project Gamma", customerId: 1,
        startDate: new Date(payrollYear, payrollMonth, 1),
        plannedEndDate: new Date(payrollYear, payrollMonth, 31), status: "planning",
      };
      const [project] = await db.insert(projects).values(projectData).returning();
      await db.insert(projectEmployees).values({ projectId: project.id, employeeId: consultant.id });

      await storage.generateMonthlyPayroll(payrollMonth, payrollYear, mockUserId);

      const entries = await db.select().from(payrollEntries).where(eq(payrollEntries.employeeId, consultant.id));
      const payrollEntry = entries[0];
      expect(parseFloat(payrollEntry.basicSalary || "0")).toBe(0);

      const glEntries = await db.select().from(generalLedgerEntries)
        .where(and(eq(generalLedgerEntries.referenceId, payrollEntry.id), eq(generalLedgerEntries.referenceType, "manual")));
      expect(glEntries.length).toBe(2);
      glEntries.forEach(gl => expect(gl.createdBy).toBe(mockUserId));
      const expenseEntry = glEntries.find(gl => gl.accountName === "Salary Expense");
      expect(parseFloat(expenseEntry?.debitAmount || "0")).toBe(0);
    });

    it('should correctly use default project dates if project dates are null and audit GLs', async () => {
      const consultantData: InsertEmployee = {
        firstName: "Consultant", lastName: "Four", email: "consult4@example.com",
        category: "consultant", salary: consultantSalary, isActive: true, employeeCode: "C004"
      };
      const [consultant] = await db.insert(employees).values(consultantData).returning();

      const projectData: InsertProject = {
        title: "Project Delta", customerId: 1,
        startDate: null, actualEndDate: null, plannedEndDate: null, status: "in_progress",
      };
      const [project] = await db.insert(projects).values(projectData).returning();
      await db.insert(projectEmployees).values({ projectId: project.id, employeeId: consultant.id });

      await storage.generateMonthlyPayroll(payrollMonth, payrollYear, mockUserId);

      const entries = await db.select().from(payrollEntries).where(eq(payrollEntries.employeeId, consultant.id));
      const payrollEntry = entries[0];
      // ... (assertions for amounts)
      const firstDayOfMonth = new Date(payrollYear, payrollMonth - 1, 1);
      const lastDayOfMonth = new Date(payrollYear, payrollMonth, 0);
      const workingDaysInDefaultMonth = calculateTestWorkingDays(firstDayOfMonth, lastDayOfMonth);
      const expectedEarnings = dailyRate * workingDaysInDefaultMonth;
      expect(payrollEntry.basicSalary).toBe(expectedEarnings.toFixed(2));

      const glEntries = await db.select().from(generalLedgerEntries)
        .where(and(eq(generalLedgerEntries.referenceId, payrollEntry.id), eq(generalLedgerEntries.referenceType, "manual")));
      expect(glEntries.length).toBe(2);
      glEntries.forEach(gl => expect(gl.createdBy).toBe(mockUserId));
    });
  });

  describe('Data Integrity and Error Handling', () => {
    const payrollMonth = 5;
    const payrollYear = 2024;

    it('should handle an employee with missing salary (default to 0) and audit GLs', async () => {
      const employeeNoSalaryData: InsertEmployee = {
        firstName: "No", lastName: "Salary", email: "nosalary@example.com",
        category: "permanent", salary: null, isActive: true, employeeCode: "NS001"
      };
      const [employeeNoSalary] = await db.insert(employees).values(employeeNoSalaryData).returning();

      await storage.generateMonthlyPayroll(payrollMonth, payrollYear, mockUserId);

      const entries = await db.select().from(payrollEntries).where(eq(payrollEntries.employeeId, employeeNoSalary.id));
      const payrollEntry = entries[0];
      expect(payrollEntry.basicSalary).toBe("0.00");

      const glEntries = await db.select().from(generalLedgerEntries)
        .where(and(eq(generalLedgerEntries.referenceId, payrollEntry.id), eq(generalLedgerEntries.referenceType, "manual")));
      expect(glEntries.length).toBe(2);
      glEntries.forEach(gl => expect(gl.createdBy).toBe(mockUserId));
      const expenseEntry = glEntries.find(gl => gl.accountName === "Salary Expense");
      expect(expenseEntry?.debitAmount).toBe("0.00");
    });

    it('should skip an employee with a missing category', async () => {
      // ... (setup as before)
      const employeeNoCategoryData: InsertEmployee = {
        firstName: "No", lastName: "Category", email: "nocat@example.com",
        salary: "3000.00", category: null, isActive: true, employeeCode: "NC001"
      };
      const [employeeNoCategory] = await db.insert(employees).values(employeeNoCategoryData).returning();

      const validEmployeeData: InsertEmployee = {
        firstName: "Valid", lastName: "Worker", email: "valid@example.com",
        category: "permanent", salary: "3000.00", isActive: true, employeeCode: "V001"
      };
      await db.insert(employees).values(validEmployeeData).returning();

      await storage.generateMonthlyPayroll(payrollMonth, payrollYear, mockUserId);

      const entriesNoCategory = await db.select().from(payrollEntries).where(eq(payrollEntries.employeeId, employeeNoCategory.id));
      expect(entriesNoCategory.length).toBe(0);
    });

    it('should generate payroll successfully for employees/projects with many null or empty permissible fields and audit GLs', async () => {
      const permEmployeeSparseData: InsertEmployee = {
        firstName: "PermSparse", lastName: "User", employeeCode: "PS001",
        category: "permanent", salary: "6000.00", isActive: true,
        email: null, phone: "", address: null, department: "", jobTitle: null, profilePhotoUrl: ""
      };
      const [permEmployee] = await db.insert(employees).values(permEmployeeSparseData).returning();

      const consultantSparseData: InsertEmployee = {
        firstName: "ConsultSparse", lastName: "User", employeeCode: "CS001",
        category: "consultant", salary: "5500.00", isActive: true,
        email: "", phone: null, hireDate: null
      };
      const [consultantEmployee] = await db.insert(employees).values(consultantSparseData).returning();

      const projectSparseData: InsertProject = {
        title: "Sparse Project", customerId: 1, status: "in_progress",
        startDate: new Date(payrollYear, payrollMonth - 1, 1),
        actualEndDate: new Date(payrollYear, payrollMonth - 1, 15),
        description: null, clientContact: "", projectManagerId: null, estimatedBudget: null, currency: ""
      };
      const [project] = await db.insert(projects).values(projectSparseData).returning();
      await db.insert(projectEmployees).values({ projectId: project.id, employeeId: consultantEmployee.id });

      await storage.generateMonthlyPayroll(payrollMonth, payrollYear, mockUserId);

      const permEntries = await db.select().from(payrollEntries).where(eq(payrollEntries.employeeId, permEmployee.id));
      expect(permEntries.length).toBe(1);
      const permGlEntries = await db.select().from(generalLedgerEntries)
        .where(and(eq(generalLedgerEntries.referenceId, permEntries[0].id), eq(generalLedgerEntries.referenceType, "manual")));
      expect(permGlEntries.length).toBe(2);
      permGlEntries.forEach(gl => expect(gl.createdBy).toBe(mockUserId));

      const consEntries = await db.select().from(payrollEntries).where(eq(payrollEntries.employeeId, consultantEmployee.id));
      expect(consEntries.length).toBe(1);
      const consGlEntries = await db.select().from(generalLedgerEntries)
        .where(and(eq(generalLedgerEntries.referenceId, consEntries[0].id), eq(generalLedgerEntries.referenceType, "manual")));
      expect(consGlEntries.length).toBe(2);
      consGlEntries.forEach(gl => expect(gl.createdBy).toBe(mockUserId));
    });
  });

  describe('Payroll Additions and Deductions', () => {
    it('should correctly update totals and GL (including createdBy) when additions/deductions are managed', async () => {
      const employeeData: InsertEmployee = {
        firstName: "Add", lastName: "Deduct", email: "add@example.com",
        category: "permanent", salary: "3000.00", isActive: true, employeeCode: "AD001"
      };
      const [employee] = await db.insert(employees).values(employeeData).returning();

      const payrollMonth = 6;
      const payrollYear = 2024;
      await storage.generateMonthlyPayroll(payrollMonth, payrollYear, mockUserId);

      let payrollEntry = (await db.select().from(payrollEntries).where(eq(payrollEntries.employeeId, employee.id)))[0];
      // ... (existing assertions for amounts after additions/deductions)
      const baseSalary = parseFloat(payrollEntry.basicSalary!);
      const initialTDS = baseSalary * 0.05;
      const bonusAmount = 500.00;
      await db.insert(payrollAdditions).values({ payrollEntryId: payrollEntry.id, description: "Bonus", amount: bonusAmount.toFixed(2) });
      await storage.updatePayrollEntryTotals(payrollEntry.id); // Note: updatePayrollEntryTotals doesn't take userId

      payrollEntry = (await db.select().from(payrollEntries).where(eq(payrollEntries.id, payrollEntry.id)))[0];
      let currentTotalEarnings = baseSalary + bonusAmount;
      expect(payrollEntry.totalAmount).toBe((currentTotalEarnings - initialTDS).toFixed(2));

      // Check initial GLs were updated by updatePayrollEntryTotals (they should still have original createdBy if not re-created)
      let initialGlEntries = await db.select().from(generalLedgerEntries)
        .where(and(eq(generalLedgerEntries.referenceId, payrollEntry.id), eq(generalLedgerEntries.referenceType, "manual")));
      initialGlEntries.forEach(gl => {
          expect(gl.createdBy).toBe(mockUserId); // createdBy from generateMonthlyPayroll
          if (gl.accountName === "Salary Expense") expect(gl.debitAmount).toBe(currentTotalEarnings.toFixed(2));
          if (gl.accountName === "Salary Payable") expect(gl.creditAmount).toBe(currentTotalEarnings.toFixed(2));
      });

      const deductionAmount = 200.00;
      await db.insert(payrollDeductions).values({ payrollEntryId: payrollEntry.id, description: "Staff Loan", amount: deductionAmount.toFixed(2) });
      await storage.updatePayrollEntryTotals(payrollEntry.id);

      payrollEntry = (await db.select().from(payrollEntries).where(eq(payrollEntries.id, payrollEntry.id)))[0];
      let totalDeductionsNow = initialTDS + deductionAmount;
      let finalTotalAmount = currentTotalEarnings - totalDeductionsNow;
      expect(payrollEntry.totalAmount).toBe(finalTotalAmount.toFixed(2));

      await storage.updatePayrollEntry(payrollEntry.id, { status: "paid" }, mockUserId); // Pass mockUserId here

      const paymentGlEntries = await db.select().from(generalLedgerEntries)
        .where(and(eq(generalLedgerEntries.referenceId, payrollEntry.id), eq(generalLedgerEntries.referenceType, "payroll_payment")));
      expect(paymentGlEntries.length).toBe(2);
      paymentGlEntries.forEach(gl => expect(gl.createdBy).toBe(mockUserId)); // Assert createdBy for payment GLs
    });
  });

  describe('Clear Payroll Period', () => {
    it('should clear all relevant payroll data for a period', async () => {
      const payrollMonth = 7;
      const payrollYear = 2024;
      const emp1Data: InsertEmployee = { firstName: "Clear", lastName: "Me", salary: "1000", category: "permanent", isActive: true, email:"c1@c.com", employeeCode: "CL001" };
      const [emp1] = await db.insert(employees).values(emp1Data).returning();
      
      await storage.generateMonthlyPayroll(payrollMonth, payrollYear, mockUserId); // Pass mockUserId
      const entriesBeforeClear = await db.select().from(payrollEntries).where(and(eq(payrollEntries.month, payrollMonth), eq(payrollEntries.year, payrollYear)));
      const entry1Id = entriesBeforeClear[0].id;

      // ... (rest of the test setup and assertions, no changes needed for createdBy here as data is deleted)
      const clearResult = await storage.clearPayrollPeriod(payrollMonth, payrollYear);
      expect(clearResult.deletedPayrollEntries).toBe(1);
      expect(clearResult.deletedGeneralLedgerEntries).toBe(2);

      const entriesAfterClear = await db.select().from(payrollEntries).where(eq(payrollEntries.id, entry1Id));
      expect(entriesAfterClear.length).toBe(0);
    });
  });
});
