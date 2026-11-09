/**
 * The branded email layout: logo, company footer, disclaimer, and escaping of
 * company details that come from the database.
 */
import { describe, it, expect } from "@jest/globals";
import {
  EMAIL_DISCLAIMER,
  brandFromCompany,
  renderExpiryReminder,
  renderMonthlyDigest,
  renderTestEmail,
} from "./notifications/templates";

const reminder = {
  employeeName: "Rahul Menon",
  employeeCode: "AQ-0142",
  documentLabel: "Passport",
  expiryDate: "2026-12-25",
  daysRemaining: 45,
  milestoneLabel: "3 months",
  forEmployee: true,
};

describe("branded email layout", () => {
  it("shows the inline logo, the disclaimer and the company footer", () => {
    const { html } = renderExpiryReminder({
      ...reminder,
      brand: {
        name: "Aquanav Maritime Services L.L.C",
        address: "Dubai, UAE",
        phone: "+971 4 000 0000",
        email: "info@aquanavms.net",
        website: "aquanavms.net",
      },
    });
    expect(html).toContain('src="cid:aquanav-logo"');
    expect(html).toContain("Dubai, UAE");
    expect(html).toContain("info@aquanavms.net");
    expect(html).toContain('href="https://aquanavms.net"');
    expect(html).toContain("Regards,");
    expect(html).toContain(EMAIL_DISCLAIMER.slice(0, 40));
  });

  it("falls back to the company name only when no details are given", () => {
    const { html } = renderTestEmail(null);
    expect(html).toContain("Aquanav Maritime Services L.L.C");
    expect(html).not.toContain("&nbsp;·&nbsp;");
  });

  it("escapes company details from the database", () => {
    const { html } = renderMonthlyDigest({
      monthLabel: "November 2026",
      rows: [],
      brand: { name: "A & B <Co>", address: "<script>x</script>" },
    });
    expect(html).toContain("A &amp; B &lt;Co&gt;");
    expect(html).not.toContain("<script>x</script>");
  });

  it("picks only the footer fields from a company row", () => {
    expect(
      brandFromCompany({ name: "N", phone: "1", vatNumber: "secret" } as any),
    ).toEqual({ name: "N", address: undefined, phone: "1", email: undefined, website: undefined });
    expect(brandFromCompany(null)).toBeNull();
  });
});
