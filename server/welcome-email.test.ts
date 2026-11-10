/**
 * Welcome email for a new employee login: random temporary password, the
 * email's content, and the masked copy kept in the Email Log.
 */
import { describe, it, expect, beforeEach, jest } from "@jest/globals";

const inserted: any[] = [];
jest.mock("./db", () => ({
  db: {
    insert: jest.fn(() => ({ values: jest.fn(async (rows: any) => { inserted.push(...rows); }) })),
    select: jest.fn(() => ({ from: () => ({ limit: async () => [{ name: "Aquanav Maritime Services LLC" }] }) })),
  },
}));
jest.mock("./lib/email-settings", () => ({ getEmailConfig: jest.fn() }));

import { generateTemporaryPassword } from "./lib/temp-password";
import { renderWelcomeEmail } from "./notifications/templates";
import { sendWelcomeEmail, MASKED_PASSWORD } from "./notifications/welcome";
import { getEmailConfig } from "./lib/email-settings";

describe("generateTemporaryPassword", () => {
  it("is three groups of four unambiguous characters", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateTemporaryPassword()).toMatch(
        /^[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}$/,
      );
    }
  });

  it("does not repeat", () => {
    const seen = new Set(Array.from({ length: 500 }, generateTemporaryPassword));
    expect(seen.size).toBe(500);
  });
});

describe("renderWelcomeEmail", () => {
  it("carries the login page, username, password and first steps", () => {
    const { subject, html } = renderWelcomeEmail({
      employeeName: "Rahul Menon",
      companyName: "Aquanav Maritime Services LLC",
      loginUrl: "https://uae-staging.aquanavms.net",
      username: "rahul.menon",
      temporaryPassword: "Xq7m-K29p-Tv4d",
    });
    expect(subject).toBe("Welcome to Aquanav — your login details");
    expect(html).toContain('href="https://uae-staging.aquanavms.net"');
    expect(html).toContain("rahul.menon");
    expect(html).toContain("Xq7m-K29p-Tv4d");
    expect(html).toContain("Change Password");
    expect(html).toContain("cid:aquanav-logo");
  });

  it("asks the employee to contact HR when the login page is unknown", () => {
    const { html } = renderWelcomeEmail({
      employeeName: "A B",
      username: "a.b",
      temporaryPassword: "x",
    });
    expect(html).not.toContain("Log in to Aquanav</a>");
    expect(html).toContain("Ask HR for the address");
  });
});

describe("sendWelcomeEmail", () => {
  const fetchMock = jest.fn<any>();

  beforeEach(() => {
    inserted.length = 0;
    (global as any).fetch = fetchMock;
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ access_token: "t", expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, text: async () => "" });
    (getEmailConfig as jest.Mock<any>).mockResolvedValue({
      tenantId: "t", clientId: "c", clientSecret: "s", senderEmail: "hr@example.test",
    });
  });

  it("sends the real password but logs a masked copy", async () => {
    await sendWelcomeEmail({
      employee: { id: 7, firstName: "Rahul", lastName: "Menon", email: "rahul@example.test" },
      username: "rahul.menon",
      temporaryPassword: "Xq7m-K29p-Tv4d",
      appOrigin: "https://uae-staging.aquanavms.net",
    });
    const sendCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/sendMail"))!;
    const message = JSON.parse(sendCall[1].body).message;
    expect(message.toRecipients).toEqual([{ emailAddress: { address: "rahul@example.test" } }]);
    expect(message.body.content).toContain("Xq7m-K29p-Tv4d");

    expect(inserted).toHaveLength(1);
    expect(inserted[0].template).toBe("welcome");
    expect(inserted[0].bodyHtml).not.toContain("Xq7m-K29p-Tv4d");
    expect(inserted[0].bodyHtml).toContain(MASKED_PASSWORD);
  });

  it("does nothing when the employee has no email", async () => {
    await sendWelcomeEmail({
      employee: { id: 7, firstName: "R", lastName: "M", email: " " },
      username: "r.m",
      temporaryPassword: "x",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
