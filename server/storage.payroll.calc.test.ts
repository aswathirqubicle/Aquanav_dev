/**
 * Phase 2 — payroll calculation tests (LEDGER-FIX-PLAN.md).
 *
 * Covers the calendar-day basis (§1.6) and the provident-fund base (D2).
 * These target pure calculation, not ledger postings — GL behaviour is P4.
 *
 * Authored under the rules in the plan's "Test authoring rules": assertions are
 * on observable outcomes, expected values were characterised against the real
 * code first, and each case was confirmed to FAIL before the fix and pass after.
 */
import { describe, it, expect, beforeEach } from "@jest/globals";
import { Storage } from "./storage";
import { db } from "./db";

jest.mock("./db", () => require("./test-db-mock").createDbMock());

// July 2026 — 31 calendar days, 23 weekdays. The gap between those two numbers
// is what makes the calendar-vs-working-day basis observable.
const JULY = { month: 7, year: 2026 };
const MONTHLY_SALARY = 10000;

describe("Payroll calculation — calendar-day basis (§1.6)", () => {
  let storage: any;

  beforeEach(() => {
    storage = new Storage();
    jest.clearAllMocks();
    (db as any).__resetQueue();
  });

  // calculateCalendarDays / getCalendarDaysInMonth are `protected`, so they are
  // reached through the instance. Testing them directly keeps these cases
  // independent of generateMonthlyPayroll's database orchestration.
  const calDays = (from: string, to: string): number =>
    storage.calculateCalendarDays(new Date(from), new Date(to));

  // 30-day basis: the daily rate does not depend on the month's length.
  const dailyRate = () => MONTHLY_SALARY / 30;

  // Drives the real computeProjectEarnings with the given assignments.
  const earn = async (
    salary: string,
    month: number,
    year: number,
    ranges: Array<[Date, Date]>,
  ) => {
    (db as any).__queueResults(
      ranges.map(([s, e], i) => ({
        projectId: 100 + i,
        assignmentStartDate: s,
        assignmentEndDate: e,
        projectTitle: `P${i}`,
      })),
    );
    return storage.computeProjectEarnings({ id: 1, salary }, month, year);
  };

  it("counts July 2026 as 31 calendar days, not 23 working days", () => {
    expect(storage.getCalendarDaysInMonth(JULY.month, JULY.year)).toBe(31);
  });

  it("T2.1 — a whole-month assignment earns the full salary", async () => {
    const days = calDays("2026-07-01", "2026-07-31");
    expect(days).toBe(31);
    const r = await earn("10000", 7, 2026, [[new Date(2026, 6, 1), new Date(2026, 6, 31)]]);
    expect(r.totalEarnings).toBe(10000); // not 31/30 of it
  });

  it("a full 31-day August earns exactly the salary", async () => {
    const r = await earn("3672.50", 8, 2026, [[new Date(2026, 7, 1), new Date(2026, 7, 31)]]);
    expect(r.totalEarnings).toBe(3672.5);
  });

  it("a full February 2026 (28 days) earns exactly the salary", async () => {
    const r = await earn("3672.50", 2, 2026, [[new Date(2026, 1, 1), new Date(2026, 1, 28)]]);
    expect(r.totalEarnings).toBe(3672.5); // not 28/30 of it
  });

  it("10–31 August 2026 on 3,672.50 earns 2,693.17 (22 days at salary / 30)", async () => {
    const r = await earn("3672.50", 8, 2026, [[new Date(2026, 7, 10), new Date(2026, 7, 31)]]);
    expect(r.totalWorkingDays).toBe(22);
    expect(r.totalEarnings).toBeCloseTo(2693.17, 2);
  });

  // Drizzle returns timestamp-without-tz columns as UTC midnight, which is
  // 04:00 local in Asia/Dubai; Date.UTC reproduces that skew.
  it("an assignment starting on the last day of the month earns that 1 day (UTC-midnight dates)", async () => {
    const r = await earn("1836.45", 9, 2026, [[new Date(Date.UTC(2026, 8, 30)), new Date(Date.UTC(2026, 9, 16))]]);
    expect(r.totalWorkingDays).toBe(1);
    expect(r.totalEarnings).toBeCloseTo(61.22, 2);
  });

  it("an assignment ending on the 1st of the month earns that 1 day (UTC-midnight dates)", async () => {
    const r = await earn("1836.45", 9, 2026, [[new Date(Date.UTC(2026, 7, 20)), new Date(Date.UTC(2026, 8, 1))]]);
    expect(r.totalWorkingDays).toBe(1);
    expect(r.totalEarnings).toBeCloseTo(61.22, 2);
  });

  it("a whole-month assignment with UTC-midnight dates still earns the full salary", async () => {
    const r = await earn("1836.45", 9, 2026, [[new Date(Date.UTC(2026, 8, 1)), new Date(Date.UTC(2026, 8, 30))]]);
    expect(r.totalWorkingDays).toBe(30);
    expect(r.totalEarnings).toBe(1836.45);
  });

  it("two non-overlapping assignments covering all of August total exactly the salary", async () => {
    const r = await earn("3672.50", 8, 2026, [
      [new Date(2026, 7, 1), new Date(2026, 7, 10)],
      [new Date(2026, 7, 11), new Date(2026, 7, 31)],
    ]);
    expect(r.totalWorkingDays).toBe(31);
    expect(r.totalEarnings).toBe(3672.5);
    expect(r.projectEarningsList).toHaveLength(2);
    const sum = r.projectEarningsList.reduce((a: number, p: any) => a + p.earnings, 0);
    expect(sum).toBeCloseTo(3672.5, 2);
    // 10 and 21 days: the split follows time worked
    expect(r.projectEarningsList[0].earnings).toBeLessThan(r.projectEarningsList[1].earnings);
  });

  it("T2.2 — 1–15 July earns 5,000.00 (salary / 30 x 15)", () => {
    const days = calDays("2026-07-01", "2026-07-15");
    expect(days).toBe(15); // 11 weekdays under the old basis
    expect(dailyRate() * days).toBeCloseTo(5000.0, 2);
  });

  it("T2.3 — 6–10 July earns 1,666.67 (5 days at salary / 30)", () => {
    const days = calDays("2026-07-06", "2026-07-10");
    expect(days).toBe(5);
    expect(dailyRate() * days).toBeCloseTo(1666.67, 2);
  });

  it("T2.4 — a weekend-only assignment earns 666.67 instead of nothing", () => {
    // 4-5 July 2026 is a Saturday and Sunday. The old basis counted ZERO
    // working days, so earnings were 0 and the employee was dropped from
    // payroll entirely by the `calculatedTotalEarnings === 0` guard.
    const days = calDays("2026-07-04", "2026-07-05");
    expect(days).toBe(2);
    const earnings = dailyRate() * days;
    expect(earnings).toBeCloseTo(666.67, 2);
    expect(earnings).toBeGreaterThan(0); // the employee now appears at all
  });

  it("counts a single day as 1, inclusive of both ends", () => {
    expect(calDays("2026-07-15", "2026-07-15")).toBe(1);
  });

  it("returns 0 when the range is inverted", () => {
    expect(calDays("2026-07-20", "2026-07-10")).toBe(0);
  });

  it("is unaffected by a time component within the same local day", () => {
    // Counted on LOCAL date components, consistent with the rest of payroll,
    // which builds month boundaries as `new Date(year, month - 1, 1)`.
    // Constructed from local parts rather than a Z-suffixed string, because a
    // UTC instant late in the day resolves to the following local date and
    // would be measuring the timezone rather than the day count.
    const start = new Date(2026, 6, 1, 23, 30); // 1 July, local
    const end = new Date(2026, 6, 3, 0, 15); //    3 July, local
    expect(storage.calculateCalendarDays(start, end)).toBe(3);
  });
});

describe("generateMonthlyPayroll uses the calendar-day basis (§1.6)", () => {
  let storage: any;

  beforeEach(() => {
    storage = new Storage();
    jest.clearAllMocks();
    (db as any).__resetQueue();
  });

  /**
   * This is the case that actually guards the fix.
   *
   * The isolated helper tests above verify arithmetic, but they keep passing if
   * the CALL SITES revert to calculateWorkingDays/getWorkingDaysInMonth — the
   * helpers still exist and still work. Verified by reverting and re-running:
   * all 21 stayed green. So this drives generateMonthlyPayroll end to end and
   * asserts on the figure written to payroll_entries.
   *
   * A consultant on 10,000/month assigned 1-15 July 2026:
   *   30-day basis    10,000 / 30 x 15 = 5,000.00   <- expected
   *   working basis   10,000 / 23 x 11 = 4,782.61   <- old behaviour
   */
  it("T2.2 (end to end) — writes 5,000.00, not the working-day 4,782.61", async () => {
    const consultant = {
      id: 501,
      firstName: "Test",
      lastName: "Consultant",
      employeeCode: "EMP-501",
      category: "consultant",
      salary: "10000.00",
      grade: null,
      contractCurrency: null,
      contractSalary: null,
      isActive: true,
    };

    (db as any).__queueResults(
      [], //                                    no existing payroll for the period
      [consultant], //                          active employees
      [{ id: 900, title: "Test Project", startDate: null, plannedEndDate: null, actualEndDate: null, status: "in_progress" }],
      [
        {
          projectId: 900,
          assignmentStartDate: new Date(2026, 6, 1), //  1 July, local
          assignmentEndDate: new Date(2026, 6, 15), //  15 July, local
          projectTitle: "Test Project",
          projectStartDate: null,
          projectPlannedEndDate: null,
          projectActualEndDate: null,
        },
      ],
      [{ id: 7001, employeeId: 501, month: 7, year: 2026, basicSalary: "0", totalAdditions: "5000.00", totalDeductions: "250.00", totalAmount: "4750.00", status: "generated" }],
    );

    await storage.generateMonthlyPayroll(7, 2026, 1);

    // Find the values passed when inserting the payroll entry itself.
    const entryInsert = (db.values as jest.Mock).mock.calls
      .map((c) => c[0])
      .find((v: any) => v && v.month === 7 && v.year === 2026 && "totalAmount" in v);

    expect(entryInsert).toBeDefined();

    // 10,000 / 30 x 15 = 5,000.00. The working-day basis would give
    // 4,782.61, so this assertion distinguishes the two.
    expect(parseFloat(entryInsert.totalAdditions)).toBeCloseTo(5000.0, 2);
    expect(parseFloat(entryInsert.totalAdditions)).not.toBeCloseTo(4782.61, 2);

    // Days recorded must match the basis the money was calculated on.
    expect(entryInsert.workingDays).toBe(15);
  });
});

describe("generateMonthlyPayroll pays permanent staff from their hire date", () => {
  let storage: any;

  beforeEach(() => {
    storage = new Storage();
    jest.clearAllMocks();
    (db as any).__resetQueue();
  });

  const perm = (hireDate: Date | null) => ({
    id: 601,
    firstName: "Perm",
    lastName: "Staff",
    employeeCode: "EMP-601",
    category: "permanent",
    salary: "4132.00",
    hireDate,
    grade: null,
    contractCurrency: null,
    contractSalary: null,
    isActive: true,
  });

  const run = async (month: number, year: number, hireDate: Date | null) => {
    (db as any).__queueResults(
      [], //                                    no existing payroll for the period
      [perm(hireDate)], //                      active employees
      [], //                                    active projects
      [{ id: 7100, employeeId: 601, month, year, status: "generated" }],
    );
    await storage.generateMonthlyPayroll(month, year, 1);
    return (db.values as jest.Mock).mock.calls
      .map((c) => c[0])
      .find((v: any) => v && v.month === month && v.year === year && "totalAmount" in v);
  };

  it("hired 25 July 2026 on 4,132 -> July basic 964.13 for 7 days", async () => {
    const entry = await run(7, 2026, new Date(2026, 6, 25));
    expect(entry).toBeDefined();
    expect(parseFloat(entry.basicSalary)).toBeCloseTo(964.13, 2);
    expect(entry.workingDays).toBe(7);
  });

  it("hired 1 September 2026 -> no August entry", async () => {
    const entry = await run(8, 2026, new Date(2026, 8, 1));
    expect(entry).toBeUndefined();
  });

  it("null hire date -> no entry", async () => {
    const entry = await run(8, 2026, null);
    expect(entry).toBeUndefined();
  });

  it("hired in 2025 -> full salary and the month's calendar days", async () => {
    const entry = await run(8, 2026, new Date(2025, 2, 10));
    expect(entry).toBeDefined();
    expect(entry.basicSalary).toBe("4132.00");
    expect(entry.workingDays).toBe(31);
  });
});

describe("Provident fund base (D2) — via the real computePfAmount", () => {
  let storage: any;

  beforeEach(() => {
    storage = new Storage();
    jest.clearAllMocks();
    (db as any).__resetQueue();
  });

  // Exercises the SHIPPING helpers (computePfAmount + pfEligibleAdditionsSum),
  // not a copy of the formula. An earlier version of these tests recomputed
  // `earnings * 0.05` inline and so stayed green even if the real code was
  // wrong — the R1 falsifiability trap. `additions` are {type, amount} objects
  // exactly as getPayrollAdditions returns them.
  //
  // The rule: PF = 5% of CONTRACTUAL pay — basic salary plus project fees, and
  // nothing else. A bonus, overtime or any ad-hoc addition does not raise it,
  // and neither does a reimbursement (the employee's own money coming back).
  // Deductions never enter the base — otherwise two people earning the same
  // accrue different funds purely because one took an advance.
  const pf = (basic: number, additions: { type: string; amount: string }[] = []) =>
    Number(
      storage
        .computePfAmount(basic, storage.pfEligibleAdditionsSum(additions))
        .toFixed(2),
    );

  it("T2.7 — basic 10,000, nothing else → PF 500.00", () => {
    expect(pf(10000)).toBe(500.0);
  });

  it("T2.8 — basic 10,000 + overtime 1,000 → PF stays 500.00 (overtime excluded)", () => {
    // Overtime is not contractual pay, so it does not enter the base. The same
    // amount booked as a project fee WOULD — asserted below so this proves the
    // filter rather than merely returning the basic-only figure.
    expect(pf(10000, [{ type: "overtime", amount: "1000" }])).toBe(500.0);
    expect(pf(10000, [{ type: "project_fee", amount: "1000" }])).toBe(550.0);
  });

  it("T2.9 — deductions are not an input to the base → PF stays 500.00", () => {
    // The D2 regression. computePfAmount has no deduction parameter at all;
    // the base is basic + eligible additions only. Netting an advance off the
    // base (the rejected reading) would give 5% x 8,000 = 400.00.
    expect(pf(10000)).toBe(500.0);
    expect(Number(storage.computePfAmount(8000, 0).toFixed(2))).not.toBe(500.0);
  });

  it("T2.10 — a reimbursement addition does NOT attract PF", () => {
    // pfEligibleAdditionsSum admits project fees only. The identical amount
    // booked as a project fee WOULD raise PF — proving the filter, not just a
    // zero. 'other' is checked too: the catch-all must not slip into the base.
    expect(pf(10000, [{ type: "reimbursement", amount: "500" }])).toBe(500.0);
    expect(pf(10000, [{ type: "other", amount: "500" }])).toBe(500.0);
    expect(pf(10000, [{ type: "project_fee", amount: "500" }])).toBe(525.0);
  });

  it("UAT entry 28 shape — project fee 2,002.91, later overtime 690.43", () => {
    // A consultant's basic is 0; pay arrives as project-fee additions, so the
    // project fee alone IS the base. Overtime added afterwards leaves PF where
    // it was — the figure tracks the contract, not the month's extras.
    expect(pf(0, [{ type: "project_fee", amount: "2002.91" }])).toBe(100.15);
    expect(
      pf(0, [
        { type: "project_fee", amount: "2002.91" },
        { type: "overtime", amount: "690.43" },
      ]),
    ).toBe(100.15);
  });

  it("UAT entry 26 shape — project fee 1,736.09 → PF 86.80", () => {
    expect(pf(0, [{ type: "project_fee", amount: "1736.09" }])).toBe(86.8);
  });
});

describe("updatePayrollEntryTotals recomputes PF when additions change (2.3)", () => {
  let storage: any;

  beforeEach(() => {
    storage = new Storage();
    jest.clearAllMocks();
    (db as any).__resetQueue();
  });

  // These drive the REAL method end to end through the db mock and assert on
  // what it persists. Deleting the recompute block fails these — which the
  // pure-arithmetic tests above would not catch. A bare { amount } is written
  // only by the PF-row update; the entry update writes {total*}. An empty
  // employee result short-circuits the GL branch, which is P4's concern.
  const setCalls = () => (db.set as jest.Mock).mock.calls.map((c: any[]) => c[0]);

  it("T2.11 — adding a 2,000 bonus does NOT lift PF, but still raises net pay", async () => {
    (db as any).__queueResults(
      [{ id: 1, type: "bonus", amount: "2000" }], //                 getPayrollAdditions
      [{ id: 99, type: "provident_fund", amount: "500.00" }], //     getPayrollDeductions
      [{ id: 7, basicSalary: "10000", employeeId: 501, month: 7, year: 2026 }], // entry
      [], //                                                         PF-row UPDATE (not expected)
      [], //                                                         entry UPDATE
      [], //                                                         employees select -> empty -> GL skipped
    );

    await storage.updatePayrollEntryTotals(7);

    // The bonus is not contractual pay, so the base stays at the basic salary:
    // 5% x 10,000 = 500.00. The already-correct PF row is left untouched.
    expect(setCalls()).not.toContainEqual({ amount: "600.00" });
    // The bonus still reaches the employee — it is excluded from PF, not from
    // earnings: 12,000 - 500 = 11,500.
    expect(setCalls()).toContainEqual(
      expect.objectContaining({ totalDeductions: "500.00", totalAmount: "11500.00" }),
    );
  });

  it("T2.11b — adding a 2,000 project fee DOES lift PF 500 → 600", async () => {
    // The counterpart to T2.11: the recompute still happens, and still rewrites
    // the PF row, when the addition is contractual pay. Without this, T2.11
    // would pass just as well against a recompute that had been deleted.
    (db as any).__queueResults(
      [{ id: 1, type: "project_fee", amount: "2000" }], //           getPayrollAdditions
      [{ id: 99, type: "provident_fund", amount: "500.00" }], //     getPayrollDeductions (stale)
      [{ id: 7, basicSalary: "10000", employeeId: 501, month: 7, year: 2026 }], // entry
      [], //                                                         PF-row UPDATE
      [], //                                                         entry UPDATE
      [], //                                                         employees select -> empty -> GL skipped
    );

    await storage.updatePayrollEntryTotals(7);

    expect(setCalls()).toContainEqual({ amount: "600.00" });
    expect(setCalls()).toContainEqual(
      expect.objectContaining({ totalDeductions: "600.00", totalAmount: "11400.00" }),
    );
  });

  it("T2.12 — adding a 1,000 advance does NOT change PF (stays 500)", async () => {
    (db as any).__queueResults(
      [], //                                                         no additions -> base = basic
      [
        { id: 99, type: "provident_fund", amount: "500.00" },
        { id: 100, type: "advance_recovery", amount: "1000" },
      ], //                                                          getPayrollDeductions
      [{ id: 7, basicSalary: "10000", employeeId: 501, month: 7, year: 2026 }], // entry
      [], //                                                         entry UPDATE (no PF update fires)
      [], //                                                         employees select -> empty -> GL skipped
    );

    await storage.updatePayrollEntryTotals(7);

    // PF base unchanged (10,000), so the row is left alone: no { amount } write.
    expect(setCalls()).not.toContainEqual(
      expect.objectContaining({ amount: expect.anything() }),
    );
    // net = 10,000 - (500 PF + 1,000 advance) = 8,500
    expect(setCalls()).toContainEqual(
      expect.objectContaining({ totalDeductions: "1500.00", totalAmount: "8500.00" }),
    );
  });
});

describe("The system PF deduction row is protected (2.4)", () => {
  let storage: any;

  beforeEach(() => {
    storage = new Storage();
    jest.clearAllMocks();
    (db as any).__resetQueue();
  });

  // T2.13. The recompute owns the PF row; a hand edit/delete/add would desync it
  // or create a second row the recompute can't reconcile. The guard rejects at
  // the storage boundary, so it holds regardless of the route or client.
  it("T2.13a — creating a provident_fund deduction by hand is rejected", async () => {
    await expect(
      storage.createPayrollDeduction({
        payrollEntryId: 7,
        type: "provident_fund",
        description: "x",
        amount: "1",
      }),
    ).rejects.toThrow(/cannot be added manually/);
  });

  it("T2.13b — editing the PF row is rejected", async () => {
    // getPayrollDeduction resolves to the PF row, so the guard fires.
    (db as any).__queueResults([
      { id: 99, type: "provident_fund", amount: "105.00", payrollEntryId: 7 },
    ]);
    await expect(
      storage.updatePayrollDeduction(99, { amount: "1" }),
    ).rejects.toThrow(/cannot be edited manually/);
  });

  it("T2.13c — deleting the PF row is rejected", async () => {
    (db as any).__queueResults([
      { id: 99, type: "provident_fund", amount: "105.00", payrollEntryId: 7 },
    ]);
    await expect(storage.deletePayrollDeduction(99)).rejects.toThrow(
      /cannot be removed manually/,
    );
  });

  it("T2.13d — a non-PF deduction passes the guard (fails later, not on PF)", async () => {
    // With an empty mock the create clears the guard and only fails deeper, in
    // updatePayrollEntryTotals ("entry not found"). Proves the guard is keyed to
    // provident_fund and does not block ordinary deductions.
    await expect(
      storage.createPayrollDeduction({
        payrollEntryId: 7,
        type: "advance_recovery",
        description: "x",
        amount: "1",
      }),
    ).rejects.toThrow(/not found/);
  });
});

describe("Salary Expense split across projects (Phase 3 — L15 / L12)", () => {
  let storage: any;

  beforeEach(() => {
    storage = new Storage();
    jest.clearAllMocks();
    (db as any).__resetQueue();
  });

  // --- the pure split helper (L12 rounding) -------------------------------
  it("splits by weight: [5000,3000,2000] of 13,000 → 6500/3900/2600", () => {
    expect(storage.splitAmountAcrossRows([5000, 3000, 2000], 13000)).toEqual([
      6500, 3900, 2600,
    ]);
  });

  it("T3.6 — 3-way even split of 10,000 sums to exactly 10,000", () => {
    const parts = storage.splitAmountAcrossRows([1, 1, 1], 10000);
    expect(parts).toHaveLength(3);
    // round the float accumulation to cents — the parts are exact to 2dp
    expect(
      Math.round(parts.reduce((s: number, v: number) => s + v, 0) * 100) / 100,
    ).toBe(10000);
  });

  it("T3.7 — 7-way even split of 10,000 sums to exactly 10,000, nothing dropped", () => {
    const parts = storage.splitAmountAcrossRows([1, 1, 1, 1, 1, 1, 1], 10000);
    expect(parts).toHaveLength(7);
    // round the float accumulation to cents — the parts are exact to 2dp
    expect(
      Math.round(parts.reduce((s: number, v: number) => s + v, 0) * 100) / 100,
    ).toBe(10000);
    expect(parts.every((p: number) => p > 0)).toBe(true);
  });

  it("a single row takes the whole total", () => {
    expect(storage.splitAmountAcrossRows([9999], 500)).toEqual([500]);
  });

  it("all-zero weights fall back to an even split", () => {
    expect(storage.splitAmountAcrossRows([0, 0], 100)).toEqual([50, 50]);
  });

  it("the rounding remainder lands on the largest share", () => {
    const parts = storage.splitAmountAcrossRows([1, 2], 10000);
    // round the float accumulation to cents — the parts are exact to 2dp
    expect(
      Math.round(parts.reduce((s: number, v: number) => s + v, 0) * 100) / 100,
    ).toBe(10000);
    expect(parts[1]).toBeGreaterThan(parts[0]);
  });

  // (The per-project split now posts in postPayrollAccrual at approval — see
  // the "Payroll accrual + payment posting (Phase 4)" suite below.)
});

describe("Payroll accrual + payment posting (Phase 4)", () => {
  let storage: any;

  beforeEach(() => {
    storage = new Storage();
    jest.clearAllMocks();
    (db as any).__resetQueue();
  });

  // Drives postPayrollAccrual / postPayrollPayment end to end, spying on
  // createGeneralLedgerEntry to capture the posted lines. Queue order matches
  // the method's reads: entry, existing-accrual check, employee, additions,
  // deductions, reimbursements, assignments (computeProjectEarnings).
  const lines = (spy: any) => spy.mock.calls.map((c: any[]) => c[0]);
  const sum = (ls: any[], k: string) =>
    ls.reduce((s: number, l: any) => s + parseFloat(l[k] || "0"), 0);

  it("T4.3 — accrual (permanent): Dr Salary Expense 10,000 / Cr PF 500 / Cr Salary Payable 9,500 (gross − PF)", async () => {
    const gl = jest
      .spyOn(storage, "createGeneralLedgerEntry")
      .mockResolvedValue({} as any);
    (db as any).__queueResults(
      [{ id: 7, basicSalary: "10000", employeeId: 501, month: 7, year: 2026, projectId: null }],
      [], //                                            no existing accrual
      [{ id: 501, firstName: "Perm", lastName: "Staff", salary: "10000" }],
      [], //                                            additions
      [{ id: 99, type: "provident_fund", amount: "500.00" }], // deductions
      [], //                                            reimbursements
      [], //                                            assignments -> single row
    );

    await storage.postPayrollAccrual(7, 1);

    const ls = lines(gl);
    const by = (acct: string) => ls.find((l: any) => l.accountName === acct);
    expect(by("Salary Expense").debitAmount).toBe("10000.00");
    expect(by("Provident Fund Contribution").creditAmount).toBe("500.00");
    expect(by("Salary Payable").creditAmount).toBe("9500.00");
    expect(sum(ls, "debitAmount")).toBeCloseTo(sum(ls, "creditAmount"), 2);
    expect(sum(ls, "debitAmount")).toBeCloseTo(10000, 2);
    gl.mockRestore();
  });

  it("T4.3 (split) — consultant on 2 projects: two Salary Expense rows summing to earnings", async () => {
    const gl = jest
      .spyOn(storage, "createGeneralLedgerEntry")
      .mockResolvedValue({} as any);
    const fullMonth = (projectId: number, title: string) => ({
      projectId,
      assignmentStartDate: new Date(2026, 6, 1),
      assignmentEndDate: new Date(2026, 6, 31),
      projectTitle: title,
      projectStartDate: null,
      projectPlannedEndDate: null,
      projectActualEndDate: null,
    });
    (db as any).__queueResults(
      [{ id: 8, basicSalary: "0", employeeId: 502, month: 7, year: 2026, projectId: 2 }],
      [],
      [{ id: 502, firstName: "Con", lastName: "Sultant", salary: "6200" }],
      [
        { id: 1, type: "project_fee", amount: "6200" },
        { id: 2, type: "project_fee", amount: "6200" },
      ], //                                             earnings 12,400
      [{ id: 99, type: "provident_fund", amount: "620.00" }],
      [],
      [fullMonth(1, "A"), fullMonth(2, "B")], //        6,200 each (full month)
    );

    await storage.postPayrollAccrual(8, 1);

    const ls = lines(gl);
    const seDebits = ls
      .filter((l: any) => l.accountName === "Salary Expense")
      .map((l: any) => l.debitAmount);
    expect(seDebits).toHaveLength(2); // one row per project, not one lumped row
    expect(seDebits).toEqual(["6200.00", "6200.00"]);
    expect(
      ls.find((l: any) => l.accountName === "Salary Payable").creditAmount,
    ).toBe("11780.00"); // 12,400 − 620 PF
    expect(sum(ls, "debitAmount")).toBeCloseTo(sum(ls, "creditAmount"), 2);
    gl.mockRestore();
  });

  it("accrual is idempotent — a second call with rows already present posts nothing", async () => {
    const gl = jest
      .spyOn(storage, "createGeneralLedgerEntry")
      .mockResolvedValue({} as any);
    (db as any).__queueResults(
      [{ id: 7, basicSalary: "10000", employeeId: 501, month: 7, year: 2026 }],
      [{ id: 1234 }], //                                accrual already exists
    );
    await storage.postPayrollAccrual(7, 1);
    expect(gl).not.toHaveBeenCalled();
    gl.mockRestore();
  });

  it("T4.5 — payment debits Salary Payable by the exact accrual credit, credits Cash (clears to zero)", async () => {
    const gl = jest
      .spyOn(storage, "createGeneralLedgerEntry")
      .mockResolvedValue({} as any);
    (db as any).__queueResults(
      [{ creditAmount: "9500.00" }], //                 accrual Salary Payable credit
      [{ id: 7, employeeId: 501, month: 7, year: 2026, projectId: null }],
      [{ id: 501, firstName: "Perm", lastName: "Staff" }],
    );
    await storage.postPayrollPayment(7, 1);
    const ls = lines(gl);
    expect(ls.find((l: any) => l.accountName === "Salary Payable").debitAmount).toBe("9500.00");
    expect(ls.find((l: any) => l.accountName === "Cash/Bank").creditAmount).toBe("9500.00");
    gl.mockRestore();
  });

  it("T4.9 — clearing reverses each payroll GL row (debit↔credit), keeping the audit trail", async () => {
    const gl = jest
      .spyOn(storage, "createGeneralLedgerEntry")
      .mockResolvedValue({} as any);
    (db as any).__queueResults([
      // the accrual + payment rows for one entry
      { entryType: "payable", referenceType: "payroll", accountName: "Salary Expense", description: "Salary for X", debitAmount: "10000.00", creditAmount: "0.00", entityId: 1, entityName: "X", projectId: null, status: "pending" },
      { entryType: "payable", referenceType: "payroll", accountName: "Provident Fund Contribution", description: "Provident Fund for X", debitAmount: "0.00", creditAmount: "500.00", entityId: 1, entityName: "X", projectId: null, status: "pending" },
      { entryType: "payable", referenceType: "payroll", accountName: "Salary Payable", description: "Salary payable to X", debitAmount: "0.00", creditAmount: "9500.00", entityId: 1, entityName: "X", projectId: null, status: "pending" },
      { entryType: "payable", referenceType: "payroll_payment", accountName: "Salary Payable", description: "Paid salary to X", debitAmount: "9500.00", creditAmount: "0.00", entityId: 1, entityName: "X", projectId: null, status: "paid" },
      { entryType: "payable", referenceType: "payroll_payment", accountName: "Cash/Bank", description: "Paid salary to X", debitAmount: "0.00", creditAmount: "9500.00", entityId: 1, entityName: "X", projectId: null, status: "paid" },
    ]);

    const n = await storage.reversePayrollGLForEntry(7, 1);
    expect(n).toBe(5);

    const revs = lines(gl);
    // every reversal is tagged and mirrors its original
    expect(revs.every((r: any) => r.referenceType === "payroll_reversal")).toBe(true);
    const se = revs.find(
      (r: any) => r.accountName === "Salary Expense",
    );
    expect(se.creditAmount).toBe("10000.00"); // was a 10,000 debit
    expect(se.debitAmount).toBe("0.00");
    // originals + reversals net to zero across the board
    expect(sum(revs, "debitAmount")).toBeCloseTo(sum(revs, "creditAmount"), 2);
    gl.mockRestore();
  });
});

describe("PF applicable flag (employees.pf_applicable)", () => {
  let storage: any;

  beforeEach(() => {
    storage = new Storage();
    jest.clearAllMocks();
    (db as any).__resetQueue();
  });

  const valuesCalls = () => (db.values as jest.Mock).mock.calls.map((c: any[]) => c[0]);
  const setCalls = () => (db.set as jest.Mock).mock.calls.map((c: any[]) => c[0]);

  const generate = async (extra: Record<string, unknown>) => {
    (db as any).__queueResults(
      [], //                                    no existing payroll for the period
      [
        {
          id: 601,
          firstName: "Perm",
          lastName: "Staff",
          employeeCode: "EMP-601",
          category: "permanent",
          salary: "10000.00",
          hireDate: new Date(2025, 2, 10),
          grade: null,
          contractCurrency: null,
          contractSalary: null,
          isActive: true,
          ...extra,
        },
      ], //                                    active employees
      [], //                                    active projects
      [{ id: 7100, employeeId: 601, month: 7, year: 2026, status: "generated" }],
    );
    await storage.generateMonthlyPayroll(7, 2026, 1);
    return {
      entry: valuesCalls().find((v: any) => v && v.month === 7 && "totalAmount" in v),
      pfRow: valuesCalls().find((v: any) => v && v.type === "provident_fund"),
    };
  };

  it("generation: pfApplicable false -> no PF row, no deductions, net = gross", async () => {
    const { entry, pfRow } = await generate({ pfApplicable: false });
    expect(entry).toBeDefined();
    expect(pfRow).toBeUndefined();
    expect(entry.totalDeductions).toBe("0.00");
    expect(entry.totalAmount).toBe("10000.00");
  });

  it("generation: pfApplicable true -> PF 500.00 as before", async () => {
    const { entry, pfRow } = await generate({ pfApplicable: true });
    expect(pfRow).toEqual(expect.objectContaining({ amount: "500.00" }));
    expect(entry.totalDeductions).toBe("500.00");
    expect(entry.totalAmount).toBe("9500.00");
  });

  it("updatePayrollEntryTotals: pfApplicable false keeps an existing PF row and recomputes it", async () => {
    (db as any).__queueResults(
      [{ id: 1, type: "project_fee", amount: "0" }], //              getPayrollAdditions
      [{ id: 99, type: "provident_fund", amount: "500.00" }], //     getPayrollDeductions
      [{ id: 7, basicSalary: "10000", employeeId: 501, month: 7, year: 2026 }], // entry
      [], //                                                         entry UPDATE (PF-row UPDATE skipped: amount unchanged)
    );

    await storage.updatePayrollEntryTotals(7);

    expect(db.delete).not.toHaveBeenCalled();
    expect(valuesCalls().find((v: any) => v && v.type === "provident_fund")).toBeUndefined();
    expect(setCalls()).toContainEqual(
      expect.objectContaining({ totalDeductions: "500.00", totalAmount: "9500.00" }),
    );
  });

  it("updatePayrollEntryTotals: no PF row -> no PF row inserted, whatever the flag", async () => {
    (db as any).__queueResults(
      [{ id: 1, type: "project_fee", amount: "2000" }], //           additions would attract PF
      [], //                                                         no PF row
      [{ id: 7, basicSalary: "10000", employeeId: 501, month: 7, year: 2026 }], // entry
      [], //                                                         entry UPDATE
    );

    await storage.updatePayrollEntryTotals(7);

    expect(valuesCalls().find((v: any) => v && v.type === "provident_fund")).toBeUndefined();
    expect(db.delete).not.toHaveBeenCalled();
    expect(setCalls()).toContainEqual(
      expect.objectContaining({ totalDeductions: "0.00", totalAmount: "12000.00" }),
    );
  });

  it("updatePayrollEntry: approving a pf-not-applicable entry keeps its existing PF row", async () => {
    jest.spyOn(storage, "getPayrollEntry").mockResolvedValue({ id: 7, status: "generated" });
    jest.spyOn(storage, "assertPayrollPostingAccounts").mockResolvedValue(undefined);
    jest.spyOn(storage, "postPayrollAccrual").mockResolvedValue(undefined);
    (db as any).__queueResults(
      [{ id: 7, status: "approved" }], //                            entry UPDATE ... returning
      [{ id: 1, type: "project_fee", amount: "0" }], //              getPayrollAdditions
      [{ id: 99, type: "provident_fund", amount: "500.00" }], //     getPayrollDeductions
      [{ id: 7, basicSalary: "10000", employeeId: 501, month: 7, year: 2026 }], // entry
      [], //                                                         totals UPDATE (PF-row UPDATE skipped: amount unchanged)
    );

    await storage.updatePayrollEntry(7, { status: "approved" } as any, 1);

    expect(db.delete).not.toHaveBeenCalled();
    expect(setCalls()).toContainEqual(
      expect.objectContaining({ totalDeductions: "500.00", totalAmount: "9500.00" }),
    );
  });

  it.each(["approved", "paid"])(
    "updatePayrollEntry: marking an entry with no PF row %s creates no PF row",
    async (status) => {
      jest.spyOn(storage, "getPayrollEntry").mockResolvedValue({ id: 7, status: "generated" });
      jest.spyOn(storage, "assertPayrollPostingAccounts").mockResolvedValue(undefined);
      jest.spyOn(storage, "postPayrollAccrual").mockResolvedValue(undefined);
      jest.spyOn(storage, "postPayrollPayment").mockResolvedValue(undefined);
      (db as any).__queueResults(
        [{ id: 7, status }], //                                        entry UPDATE ... returning
        [{ id: 1, type: "project_fee", amount: "2000" }], //           getPayrollAdditions
        [], //                                                         no PF row
        [{ id: 7, basicSalary: "10000", employeeId: 501, month: 7, year: 2026 }], // entry
        [], //                                                         totals UPDATE
      );

      await storage.updatePayrollEntry(7, { status } as any, 1);

      expect(valuesCalls().find((v: any) => v && v.type === "provident_fund")).toBeUndefined();
      expect(db.delete).not.toHaveBeenCalled();
    },
  );

  describe("assertPayrollPostingAccounts", () => {
    const chart = (withPf: boolean) =>
      ["Salary Expense", "Salary Payable", "Employee Advances", "Cash/Bank"]
        .concat(withPf ? ["Provident Fund Contribution"] : [])
        .map((name, i) => ({ code: String(1000 + i), name }));

    const run = (withPf: boolean, deductions: unknown[]) => {
      (db as any).__queueResults(
        chart(withPf), //                                              chart of accounts
        deductions, //                                                 entry deductions
        [{ id: 7, employeeId: 501, month: 7, year: 2026 }], //         entry
        [], //                                                         approved reimbursements
      );
      return storage.assertPayrollPostingAccounts(7, { accrual: true, payment: false });
    };

    it("entry with no PF and a chart lacking the PF account -> no error", async () => {
      await expect(run(false, [])).resolves.toBeUndefined();
    });

    it("entry with PF > 0 and a chart lacking the PF account -> error naming it", async () => {
      await expect(
        run(false, [{ id: 99, type: "provident_fund", amount: "500.00" }]),
      ).rejects.toThrow(/"Provident Fund Contribution"/);
    });

    it("entry with PF > 0 and the PF account present -> no error", async () => {
      await expect(
        run(true, [{ id: 99, type: "provident_fund", amount: "500.00" }]),
      ).resolves.toBeUndefined();
    });
  });
});
