/**
 * Emailing the payslip when Generate Payslip marks an entry paid.
 *
 * The PDF is rendered for real; the database, the mailer's config and Graph are
 * mocked, so nothing here opens a connection or sends mail.
 */
import { describe, it, expect, beforeEach, jest } from "@jest/globals";

jest.mock("./db", () => ({
  db: { insert: jest.fn(() => ({ values: jest.fn(async () => undefined) })) },
}));
jest.mock("./lib/email-settings", () => ({ getEmailConfig: jest.fn() }));
jest.mock("./storage", () => ({
  storage: {
    getPayrollEntry: jest.fn(),
    getEmployee: jest.fn(),
    getUser: jest.fn(),
    getPayrollAdditions: jest.fn(),
    getPayrollDeductions: jest.fn(),
    getCompany: jest.fn(),
  },
}));
jest.mock("./middleware/auth", () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

import { generatePayslipPdf } from "./documents/payslip-pdf";
import { sendMail } from "./lib/graph-mail";
import { getEmailConfig } from "./lib/email-settings";
import { storage } from "./storage";
import { payrollRoutes } from "./routes/payroll.routes";

const mockStorage = storage as unknown as Record<string, jest.Mock<any>>;
const mockGetEmailConfig = getEmailConfig as unknown as jest.Mock<any>;

const entry = {
  id: 7,
  employeeId: 3,
  month: 10,
  year: 2026,
  workingDays: 30,
  basicSalary: "3000.00",
  totalAdditions: "500.00",
  totalDeductions: "150.00",
  totalAmount: "3350.00",
  status: "paid",
  generatedDate: new Date("2026-10-31T08:00:00Z"),
};

const employee = {
  id: 3,
  firstName: "Ravi",
  lastName: "Kumar",
  employeeCode: "EMP-003",
  position: "Diver",
  department: "Operations",
  category: "permanent",
  email: "ravi@example.test",
  userId: null as number | null,
};

const additions = [{ description: "Overtime", amount: "500.00" }];
const deductions = [{ description: "Provident Fund", amount: "150.00" }];
const company = { name: "Aquanav Test", address: "Dubai, UAE", logo: null };

// jspdf writes text streams uncompressed by default, so the content is
// readable straight out of the bytes.
const pdfText = (buffer: Buffer) => buffer.toString("latin1");

describe("generatePayslipPdf", () => {
  it("renders a PDF carrying the payslip's figures", () => {
    const pdf = generatePayslipPdf({ entry, employee, additions, deductions, company });
    const text = pdfText(pdf);

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(text).toContain("Payroll Slip");
    expect(text).toContain("Ravi Kumar");
    expect(text).toContain("October 2026");
    expect(text).toContain("AED 3500.00"); // total earnings
    expect(text).toContain("AED 150.00"); // total deductions
    expect(text).toContain("AED 3350.00"); // net pay
  });

  it("says so when there are no deductions", () => {
    const pdf = generatePayslipPdf({ entry, employee, additions, deductions: [], company });
    expect(pdfText(pdf)).toContain("No deductions for this period");
    expect(pdfText(pdf)).not.toContain("Total Deductions");
  });

  it("shows working days only for contract and consultant staff", () => {
    const permanent = pdfText(
      generatePayslipPdf({ entry, employee, additions, deductions, company }),
    );
    const contract = pdfText(
      generatePayslipPdf({
        entry,
        employee: { ...employee, category: "contract" },
        additions,
        deductions,
        company,
      }),
    );
    expect(permanent).not.toContain("Working Days:");
    expect(contract).toContain("Working Days:");
  });
});

describe("sendMail attachments", () => {
  const fetchMock = jest.fn<any>();

  beforeEach(() => {
    (global as any).fetch = fetchMock;
    fetchMock.mockReset();
    // Token, then sendMail.
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ access_token: "t", expires_in: 3600 }),
      })
      .mockResolvedValueOnce({ ok: true, text: async () => "" });
    mockGetEmailConfig.mockResolvedValue({
      tenantId: "tenant",
      clientId: "client",
      clientSecret: "secret",
      senderEmail: "hr@example.test",
    });
  });

  const sentMessage = () => {
    const sendCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/sendMail"),
    )!;
    return JSON.parse(sendCall[1].body).message;
  };

  it("sends attachments as Graph file attachments", async () => {
    const result = await sendMail({
      to: ["ravi@example.test"],
      subject: "s",
      html: "<p>h</p>",
      attachments: [
        { name: "p.pdf", contentType: "application/pdf", content: Buffer.from("PDF") },
      ],
    });

    expect(result).toEqual({ sent: true });
    expect(sentMessage().attachments).toEqual([
      {
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: "p.pdf",
        contentType: "application/pdf",
        contentBytes: Buffer.from("PDF").toString("base64"),
      },
    ]);
  });

  it("leaves the message unchanged when there are none", async () => {
    await sendMail({ to: ["ravi@example.test"], subject: "s", html: "<p>h</p>" });
    expect(sentMessage()).not.toHaveProperty("attachments");
  });
});

describe("POST /api/payroll/:id/email-payslip", () => {
  const handler = (() => {
    const layer = (payrollRoutes as any).stack.find(
      (l: any) =>
        l.route?.path === "/api/payroll/:id/email-payslip" && l.route.methods.post,
    );
    const stack = layer.route.stack;
    return stack[stack.length - 1].handle;
  })();

  const call = async () => {
    const res: any = { statusCode: 200, body: undefined };
    res.status = (code: number) => ((res.statusCode = code), res);
    res.json = (body: any) => ((res.body = body), res);
    await handler({ params: { id: "7" }, session: { userId: 1 } }, res);
    return res;
  };

  const fetchMock = jest.fn<any>();

  beforeEach(() => {
    (global as any).fetch = fetchMock;
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: any) =>
      String(url).includes("oauth2")
        ? { ok: true, text: async () => JSON.stringify({ access_token: "t", expires_in: 3600 }) }
        : { ok: true, text: async () => "" },
    );
    mockStorage.getPayrollEntry.mockResolvedValue(entry);
    mockStorage.getEmployee.mockResolvedValue(employee);
    mockStorage.getUser.mockResolvedValue(undefined);
    mockStorage.getPayrollAdditions.mockResolvedValue(additions);
    mockStorage.getPayrollDeductions.mockResolvedValue(deductions);
    mockStorage.getCompany.mockResolvedValue(company);
    mockGetEmailConfig.mockResolvedValue({
      tenantId: "tenant",
      clientId: "client",
      clientSecret: "secret",
      senderEmail: "hr@example.test",
    });
  });

  it("404s for a missing entry", async () => {
    mockStorage.getPayrollEntry.mockResolvedValue(undefined);
    expect((await call()).statusCode).toBe(404);
  });

  it("refuses an entry that is not paid", async () => {
    mockStorage.getPayrollEntry.mockResolvedValue({ ...entry, status: "approved" });
    const res = await call();
    expect(res.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("emails the PDF to the employee", async () => {
    const res = await call();
    expect(res.body).toEqual({ sent: true, toEmail: "ravi@example.test" });

    const sendCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/sendMail"))!;
    const message = JSON.parse(sendCall[1].body).message;
    expect(message.subject).toBe("Payslip for October 2026");
    expect(message.toRecipients).toEqual([{ emailAddress: { address: "ravi@example.test" } }]);
    expect(message.attachments[0].name).toBe("Payslip-EMP-003-2026-10.pdf");
    expect(
      Buffer.from(message.attachments[0].contentBytes, "base64").subarray(0, 5).toString(),
    ).toBe("%PDF-");
    // No salary figures in the body, which is what email_send_log keeps.
    expect(message.body.content).not.toContain("3350");
  });

  it("falls back to the linked user's email", async () => {
    mockStorage.getEmployee.mockResolvedValue({ ...employee, email: null, userId: 9 });
    mockStorage.getUser.mockResolvedValue({ id: 9, email: "ravi.login@example.test" });
    expect((await call()).body).toEqual({ sent: true, toEmail: "ravi.login@example.test" });
  });

  it("reports no_email when there is no address at all", async () => {
    mockStorage.getEmployee.mockResolvedValue({ ...employee, email: "  ", userId: null });
    expect((await call()).body).toEqual({ sent: false, reason: "no_email" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports not_configured when email is not set up", async () => {
    mockGetEmailConfig.mockResolvedValue(null);
    expect((await call()).body).toEqual({ sent: false, reason: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports failed when Graph refuses the message", async () => {
    fetchMock.mockImplementation(async (url: any) =>
      String(url).includes("oauth2")
        ? { ok: true, text: async () => JSON.stringify({ access_token: "t", expires_in: 3600 }) }
        : { ok: false, status: 403, text: async () => "Access denied" },
    );
    const res = await call();
    expect(res.body.sent).toBe(false);
    expect(res.body.reason).toBe("failed");
    expect(res.body.error).toContain("403");
  });
});
