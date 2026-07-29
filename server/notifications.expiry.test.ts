/**
 * Expiry reminder scheduling. The failure modes that matter are sending a
 * client three emails at once, sending the same reminder twice, and computing
 * "today" in the wrong timezone so a reminder lands a day early or late.
 */
import { describe, it, expect } from "@jest/globals";
import {
  daysBetween,
  expiresInSameMonth,
  milestonesDue,
  monthKeyInClientTz,
  todayInClientTz,
} from "./notifications/expiry";

describe("todayInClientTz — Asia/Dubai, not server-local", () => {
  it("uses the Dubai calendar date, not UTC's", () => {
    // 21:00 UTC is already 01:00 the NEXT day in Dubai (UTC+4). A server on UTC
    // would say the 29th; the client's calendar says the 30th.
    const evening = new Date("2026-07-29T21:00:00Z");
    expect(todayInClientTz(evening)).toBe("2026-07-30");
  });

  it("still reads as the same day earlier in the UTC day", () => {
    const morning = new Date("2026-07-29T06:00:00Z");
    expect(todayInClientTz(morning)).toBe("2026-07-29");
  });

  it("rolls the month over on the client's clock", () => {
    // 20:30 UTC on the 31st is 00:30 on the 1st in Dubai, so the monthly digest
    // must file under August rather than July.
    const turnOfMonth = new Date("2026-07-31T20:30:00Z");
    expect(todayInClientTz(turnOfMonth)).toBe("2026-08-01");
    expect(monthKeyInClientTz(turnOfMonth)).toBe("2026-08");
  });
});

describe("daysBetween", () => {
  it("counts whole days", () => {
    expect(daysBetween("2026-07-29", "2026-08-28")).toBe(30);
  });

  it("handles a leap day", () => {
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
  });

  it("is negative once the target is in the past", () => {
    expect(daysBetween("2026-07-29", "2026-07-28")).toBe(-1);
  });
});

describe("milestonesDue", () => {
  const today = "2026-07-29";

  it("says nothing is due while expiry is far off", () => {
    // 200 days out — beyond even the 6-month milestone.
    const result = milestonesDue("2027-02-14", today);
    expect(result.send).toBeNull();
    expect(result.suppress).toEqual([]);
  });

  it("fires the 6-month reminder once expiry is within 180 days", () => {
    const result = milestonesDue("2027-01-25", today); // 180 days
    expect(result.send?.key).toBe("6_months");
    expect(result.suppress).toEqual(["6_months"]);
  });

  it("fires the 3-month reminder when 6-month is already sent", () => {
    const result = milestonesDue("2026-10-27", today, ["6_months"]); // 90 days
    expect(result.send?.key).toBe("3_months");
    expect(result.suppress).toEqual(["3_months"]);
  });

  it("fires the 1-month reminder when the earlier two are sent", () => {
    const result = milestonesDue("2026-08-28", today, [
      "6_months",
      "3_months",
    ]);
    expect(result.send?.key).toBe("1_month");
  });

  it("never repeats a reminder already sent", () => {
    const result = milestonesDue("2027-01-25", today, ["6_months"]);
    expect(result.send).toBeNull();
  });

  it("SENDS ONE EMAIL, NOT THREE, for a document already close to expiry", () => {
    // The spam case: a document added with 10 days left is simultaneously past
    // all three thresholds. It must produce a single, honest "1 month" email —
    // and record the other two so they can never fire later.
    const result = milestonesDue("2026-08-08", today);
    expect(result.send?.key).toBe("1_month");
    expect(result.suppress).toEqual(["6_months", "3_months", "1_month"]);
  });

  it("stays silent once the document has expired", () => {
    const result = milestonesDue("2026-07-28", today);
    expect(result.send).toBeNull();
    expect(result.daysRemaining).toBe(-1);
  });

  it("still reminds on the expiry day itself", () => {
    const result = milestonesDue(today, today);
    expect(result.send?.key).toBe("1_month");
    expect(result.daysRemaining).toBe(0);
  });

  it("tolerates an unusable date rather than throwing", () => {
    const result = milestonesDue("not-a-date", today);
    expect(result.send).toBeNull();
  });

  it("catches up rather than losing a reminder when a run is missed", () => {
    // The job was down over the exact 90-day boundary. Two days later the 3-month
    // milestone is still due, because a milestone means "within N days" rather
    // than "exactly N days today".
    const result = milestonesDue("2026-10-25", today, ["6_months"]); // 88 days
    expect(result.send?.key).toBe("3_months");
  });
});

describe("expiresInSameMonth — drives the monthly digest", () => {
  it("matches within the month", () => {
    expect(expiresInSameMonth("2026-07-31", "2026-07-01")).toBe(true);
  });

  it("excludes the next month", () => {
    expect(expiresInSameMonth("2026-08-01", "2026-07-31")).toBe(false);
  });
});
