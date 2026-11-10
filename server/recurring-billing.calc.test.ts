/**
 * Recurring invoice billing — periods, generation-day fallback and line amounts.
 * Tests the shared engine used by the convert dialog and the generation job.
 */
import { describe, it, expect } from "@jest/globals";
import {
  activeDays,
  activeWindowFor,
  buildRecurringLines,
  defaultBillFrom,
  dueDateFor,
  firstRunOnOrAfter,
  periodEnding,
  periodFrom,
  rangeLabel,
  runDateFor,
  windowEndsBy,
  hasRecurringLine,
  ScheduleTiming,
  RecurringSourceLine,
} from "../shared/recurring-billing";

const LAST: ScheduleTiming = { generationDay: null, lastDayOfMonth: true };
const day = (n: number): ScheduleTiming => ({
  generationDay: n,
  lastDayOfMonth: false,
});

// The Front Antares job (QT-2026-82 → INV-AQNV-2026-163).
const fitters: RecurringSourceLine = {
  description: "2 Indian fitters (Class approved)",
  quantity: 2,
  unitPrice: 1500,
  billingType: "monthly_prorata",
};
const mobilisation: RecurringSourceLine = {
  description: "One-time mobilisation expenses",
  quantity: 2,
  unitPrice: 600,
  billingType: "one_time",
};
const rental: RecurringSourceLine = {
  description: "Equipment rental",
  quantity: 1,
  unitPrice: 900,
  billingType: "monthly_fixed",
};

describe("generation day", () => {
  it("falls back to the last day of February for 29, 30 and last day", () => {
    expect(runDateFor(2026, 2, day(29))).toBe("2026-02-28");
    expect(runDateFor(2026, 2, day(30))).toBe("2026-02-28");
    expect(runDateFor(2026, 2, LAST)).toBe("2026-02-28");
    expect(runDateFor(2028, 2, day(29))).toBe("2028-02-29");
    expect(runDateFor(2028, 2, day(30))).toBe("2028-02-29");
    expect(runDateFor(2028, 2, LAST)).toBe("2028-02-29");
  });

  it("uses the calendar last day, never a working day", () => {
    // 31 Oct 2026 is a Saturday.
    expect(runDateFor(2026, 10, LAST)).toBe("2026-10-31");
    expect(runDateFor(2026, 11, LAST)).toBe("2026-11-30");
    expect(runDateFor(2026, 3, day(30))).toBe("2026-03-30");
  });

  it("finds the first run on or after a date", () => {
    expect(firstRunOnOrAfter("2026-11-10", day(10))).toBe("2026-11-10");
    expect(firstRunOnOrAfter("2026-11-11", day(10))).toBe("2026-12-10");
    expect(firstRunOnOrAfter("2026-12-31", day(10))).toBe("2027-01-10");
    expect(firstRunOnOrAfter("2026-09-29", LAST)).toBe("2026-09-30");
  });
});

describe("periods", () => {
  it("runs from the day after the previous run up to the run date", () => {
    expect(periodEnding("2026-11-10", day(10))).toEqual({
      start: "2026-10-11",
      end: "2026-11-10",
    });
    expect(periodEnding("2026-11-30", LAST)).toEqual({
      start: "2026-11-01",
      end: "2026-11-30",
    });
    // Day 30 around February: contiguous, no gap and no overlap.
    expect(periodEnding("2026-02-28", day(30))).toEqual({
      start: "2026-01-31",
      end: "2026-02-28",
    });
    expect(periodEnding("2026-03-30", day(30))).toEqual({
      start: "2026-03-01",
      end: "2026-03-30",
    });
  });

  it("starts the first period at Bill from", () => {
    expect(periodFrom("2026-09-29", LAST)).toEqual({
      start: "2026-09-29",
      end: "2026-09-30",
    });
  });

  it("defaults Bill from to the current period, or a later project start", () => {
    expect(defaultBillFrom("2026-11-10", LAST)).toBe("2026-11-01");
    expect(defaultBillFrom("2026-11-10", day(10))).toBe("2026-10-11");
    expect(defaultBillFrom("2026-11-12", day(10))).toBe("2026-11-11");
    expect(defaultBillFrom("2026-11-10", LAST, "2026-08-29")).toBe("2026-11-01");
    expect(defaultBillFrom("2026-11-10", LAST, "2026-11-05")).toBe("2026-11-05");
  });
});

describe("active window", () => {
  it("uses the project's start and actual end, never its planned end", () => {
    const w = activeWindowFor("2026-09-01", null, {
      startDate: "2026-09-29",
      actualEndDate: null,
    });
    expect(w).toEqual({ from: "2026-09-29", to: null });
    expect(
      activeWindowFor("2026-11-01", null, {
        startDate: "2026-09-29",
        actualEndDate: "2026-11-15",
      }),
    ).toEqual({ from: "2026-11-01", to: "2026-11-15" });
  });

  it("counts calendar days inside the period", () => {
    const nov = { start: "2026-11-01", end: "2026-11-30" };
    expect(activeDays(nov, { from: "2026-11-01", to: null })).toBe(30);
    expect(activeDays(nov, { from: "2026-11-01", to: "2026-11-15" })).toBe(15);
    expect(activeDays(nov, { from: "2026-12-05", to: null })).toBe(0);
    expect(activeDays(nov, { from: "2026-09-01", to: "2026-10-20" })).toBe(0);
  });

  it("knows when nothing is left to bill", () => {
    const nov = { start: "2026-11-01", end: "2026-11-30" };
    expect(windowEndsBy(nov, { from: "2026-11-01", to: null })).toBe(false);
    expect(windowEndsBy(nov, { from: "2026-11-01", to: "2026-11-15" })).toBe(true);
    expect(windowEndsBy(nov, { from: "2026-11-01", to: "2026-12-02" })).toBe(false);
  });
});

describe("line amounts", () => {
  it("reproduces INV-AQNV-2026-163: 2 fitters, 29–30 Sep, plus mobilisation", () => {
    const lines = buildRecurringLines(
      [fitters, mobilisation],
      periodFrom("2026-09-29", LAST),
      { from: "2026-09-29", to: null },
      true,
      "USD",
      LAST,
    );
    expect(lines).toHaveLength(2);
    expect(lines[0].quantity).toBe(2);
    expect(lines[0].unitPrice).toBe(100);
    expect(lines[0].description).toContain(
      "1,500.00 USD per month. Pro-rata for 02 days (29 Sep – 30 Sep 2026) = 100.00 USD",
    );
    expect(lines[1]).toMatchObject({ quantity: 2, unitPrice: 600 });
  });

  it("bills exactly the rate for a full 31-day month and a full February", () => {
    for (const end of ["2026-10-31", "2026-02-28"]) {
      const period = periodEnding(end, LAST);
      const [line] = buildRecurringLines(
        [fitters],
        period,
        { from: "2026-01-01", to: null },
        false,
        "USD",
        LAST,
      );
      expect(line.unitPrice).toBe(1500);
      expect(line.description).toBe(fitters.description);
    }
  });

  it("bills 15/30 when the project ends on the 15th", () => {
    const [line] = buildRecurringLines(
      [fitters],
      periodEnding("2026-11-30", LAST),
      { from: "2026-09-29", to: "2026-11-15" },
      false,
      "USD",
      LAST,
    );
    expect(line.unitPrice).toBe(750);
    expect(line.description).toContain("Pro-rata for 15 days (01 Nov – 15 Nov 2026)");
  });

  it("bills a fixed line in full in a part month", () => {
    const [line] = buildRecurringLines(
      [rental],
      periodEnding("2026-11-30", LAST),
      { from: "2026-09-29", to: "2026-11-03" },
      false,
      "AED",
      LAST,
    );
    expect(line.unitPrice).toBe(900);
  });

  it("bills one-time lines on the first invoice only", () => {
    const period = periodEnding("2026-11-30", LAST);
    const w = { from: "2026-09-01", to: null };
    const first = buildRecurringLines([fitters, mobilisation], period, w, true, "USD", LAST);
    const later = buildRecurringLines([fitters, mobilisation], period, w, false, "USD", LAST);
    expect(first).toHaveLength(2);
    expect(later).toHaveLength(1);
    expect(later[0].description).toBe(fitters.description);
  });

  it("returns nothing for a period with no active day", () => {
    expect(
      buildRecurringLines(
        [fitters, mobilisation],
        periodEnding("2026-11-30", LAST),
        { from: "2026-12-05", to: null },
        true,
        "USD",
        LAST,
      ),
    ).toEqual([]);
  });

  it("scales a fixed-amount line discount with the pro rata factor", () => {
    const [line] = buildRecurringLines(
      [{ ...fitters, discount: 300, discountType: "amount" }],
      periodEnding("2026-11-30", LAST),
      { from: "2026-11-21", to: null },
      false,
      "USD",
      LAST,
    );
    expect(line.unitPrice).toBe(500); // 1500 / 30 × 10
    expect(line.discount).toBe(100); // 300 / 30 × 10
  });

  it("treats lines without a billing type as one-time", () => {
    expect(hasRecurringLine([{ description: "x", quantity: 1, unitPrice: 1 }])).toBe(false);
    expect(hasRecurringLine([fitters])).toBe(true);
  });
});

describe("labels and due dates", () => {
  it("formats period ranges", () => {
    expect(rangeLabel("2026-11-01", "2026-11-30")).toBe("01 Nov – 30 Nov 2026");
    expect(rangeLabel("2026-12-11", "2027-01-10")).toBe("11 Dec 2026 – 10 Jan 2027");
  });

  it("reads payment terms", () => {
    expect(dueDateFor("2026-09-30", "Net 15")).toBe("2026-10-15");
    expect(dueDateFor("2026-11-30", "Net 30")).toBe("2026-12-30");
    expect(dueDateFor("2026-11-30", "30_days")).toBe("2026-12-30");
    expect(dueDateFor("2026-11-30", "Due on receipt")).toBe("2026-11-30");
    expect(dueDateFor("2026-11-30", null)).toBe("2026-11-30");
  });
});
