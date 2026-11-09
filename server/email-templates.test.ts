/**
 * The Aquanav logo in the email layout.
 */
import { describe, it, expect } from "@jest/globals";
import {
  renderExpiryReminder,
  renderMonthlyDigest,
  renderTestEmail,
} from "./notifications/templates";

describe("email logo", () => {
  it("every template shows the inline logo above the title", () => {
    const htmls = [
      renderExpiryReminder({
        employeeName: "Rahul Menon",
        employeeCode: "AQ-0142",
        documentLabel: "Passport",
        expiryDate: "2026-12-25",
        daysRemaining: 45,
        milestoneLabel: "3 months",
        forEmployee: true,
      }).html,
      renderMonthlyDigest({ monthLabel: "December 2026", rows: [] }).html,
      renderTestEmail().html,
    ];
    for (const html of htmls) {
      expect(html).toContain('src="cid:aquanav-logo"');
      expect(html.indexOf("cid:aquanav-logo")).toBeLessThan(html.indexOf("<h1"));
    }
  });
});
