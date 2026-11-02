import fs from "fs";
import path from "path";
import { format } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * The payslip as a PDF, for emailing to the employee.
 *
 * The printed payslip is built in the browser (client/src/pages/payroll/index.tsx,
 * GeneratePayslipButton) and printed through the browser's own print dialog, so
 * the server has nothing it can attach. This draws the same content — header,
 * employee and pay-period details, earnings, deductions, net pay, footer — with
 * jspdf. It is a second layout: change one and check the other.
 *
 * Pure apart from loadPayslipLogo, so it renders in tests with no DB or browser.
 */

export interface PayslipPdfInput {
  entry: {
    month: number;
    year: number;
    workingDays: number;
    basicSalary: string | null;
    totalAdditions: string | null;
    totalAmount: string | null;
    status: string;
    generatedDate: Date | string;
  };
  employee: {
    firstName: string;
    lastName: string;
    employeeCode: string;
    position: string | null;
    department: string | null;
    category: string;
  };
  additions: Array<{ description: string; amount: string }>;
  deductions: Array<{ description: string; amount: string }>;
  company?: {
    name?: string | null;
    address?: string | null;
    website?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  logo?: PayslipLogo | null;
}

export interface PayslipLogo {
  dataUri: string;
  format: "PNG" | "JPEG";
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const payslipMonthName = (month: number): string =>
  MONTHS[month - 1] ?? String(month);

// Same as the printed payslip: amounts are shown in AED.
const formatCurrency = (amount: string | number | null | undefined) => {
  const num = typeof amount === "string" ? parseFloat(amount) : amount ?? 0;
  return `AED ${(isNaN(num) ? 0 : num).toFixed(2)}`;
};

const formatDisplayDate = (date: Date | string) => {
  const d = new Date(date);
  return isNaN(d.getTime()) ? "" : format(d, "dd-MMM-yyyy");
};

// The stored "null" string appears in company fields; treat it as empty, as
// server/document-utils.ts does.
const val = (v: any): string =>
  v === "null" || v === null || v === undefined ? "" : String(v);

/**
 * The company logo as jspdf can embed it, or null. jspdf only takes PNG and
 * JPEG here; any other logo format is left off rather than failing the send.
 */
export function loadPayslipLogo(relativePath: string | null | undefined): PayslipLogo | null {
  if (!val(relativePath)) return null;
  const absPath = path.join(process.cwd(), relativePath as string);
  const ext = path.extname(absPath).toLowerCase();
  const fmt = ext === ".png" ? "PNG" : ext === ".jpg" || ext === ".jpeg" ? "JPEG" : null;
  if (!fmt || !fs.existsSync(absPath)) return null;
  const mime = fmt === "PNG" ? "image/png" : "image/jpeg";
  return {
    dataUri: `data:${mime};base64,${fs.readFileSync(absPath).toString("base64")}`,
    format: fmt,
  };
}

export function generatePayslipPdf(input: PayslipPdfInput): Buffer {
  const { entry, employee, additions, deductions, company, logo } = input;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = margin;

  // Header: logo (or the company name when there is none), then the address.
  if (logo) {
    try {
      const props = doc.getImageProperties(logo.dataUri);
      const height = 20;
      const width = Math.min((props.width / props.height) * height, 70);
      doc.addImage(logo.dataUri, logo.format, margin, y, width, height);
      y += height + 3;
    } catch {
      // An unreadable logo must not stop the payslip going out.
    }
  } else if (val(company?.name)) {
    doc.setFont("helvetica", "bold").setFontSize(14);
    doc.text(val(company?.name), margin, y + 5);
    y += 9;
  }
  if (val(company?.address)) {
    doc.setFont("helvetica", "normal").setFontSize(9);
    const lines = doc.splitTextToSize(val(company?.address), pageWidth - margin * 2);
    doc.text(lines, margin, y + 3);
    y += lines.length * 4 + 2;
  }

  // Title
  y += 4;
  doc.setFont("helvetica", "bold").setFontSize(16);
  doc.text("Payroll Slip", pageWidth / 2, y + 5, { align: "center" });
  y += 12;

  // Employee information and pay period, side by side.
  const employeeRows = [
    ["Name:", `${employee.firstName || "N/A"} ${employee.lastName || ""}`.trim()],
    ["Employee Code:", employee.employeeCode || "N/A"],
    ["Position:", employee.position || "N/A"],
    ["Department:", employee.department || "N/A"],
  ];
  const periodRows = [
    ["Month:", `${payslipMonthName(entry.month)} ${entry.year}`],
    ["Calendar Days:", String(new Date(entry.year, entry.month, 0).getDate())],
    ...(["contract", "consultant"].includes(employee.category || "")
      ? [["Working Days:", String(entry.workingDays)]]
      : []),
    ["Generated Date:", formatDisplayDate(entry.generatedDate)],
    [
      "Status:",
      entry.status ? entry.status.charAt(0).toUpperCase() + entry.status.slice(1) : "",
    ],
  ];
  const columnWidth = (pageWidth - margin * 2 - 6) / 2;
  const infoTable = (title: string, rows: string[][], left: number) => {
    autoTable(doc, {
      startY: y,
      margin: { left },
      tableWidth: columnWidth,
      head: [[{ content: title, colSpan: 2 }]],
      body: rows,
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 1.5 },
      headStyles: { fontStyle: "bold", fontSize: 10, textColor: [30, 64, 175] },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 32 } },
    });
    return (doc as any).lastAutoTable.finalY as number;
  };
  y = Math.max(
    infoTable("Employee Information", employeeRows, margin),
    infoTable("Pay Period", periodRows, margin + columnWidth + 6),
  ) + 6;

  const amountTable = (
    title: string,
    color: [number, number, number],
    rows: string[][],
    total: string[] | null,
  ) => {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [[title, ""]],
      body: rows,
      foot: total ? [total] : undefined,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: color, textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: [243, 244, 246], textColor: 20, fontStyle: "bold" },
      columnStyles: { 1: { halign: "right", cellWidth: 45 } },
      didParseCell: (data) => {
        if (data.column.index === 1 && data.section !== "body") {
          data.cell.styles.halign = "right";
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  };

  const basicSalary = parseFloat(entry.basicSalary || "0");
  const totalEarnings = basicSalary + parseFloat(entry.totalAdditions || "0");
  amountTable(
    "Earnings",
    [22, 163, 74],
    [
      ...(basicSalary > 0 ? [["Basic Salary", formatCurrency(entry.basicSalary)]] : []),
      ...additions.map((a) => [a.description, formatCurrency(a.amount)]),
    ],
    ["Total Earnings", formatCurrency(totalEarnings)],
  );

  const totalDeductions = deductions.reduce(
    (sum, d) => sum + parseFloat(d.amount),
    0,
  );
  amountTable(
    "Deductions",
    [220, 38, 38],
    deductions.length === 0
      ? [["No deductions for this period", ""]]
      : deductions.map((d) => [d.description, formatCurrency(d.amount)]),
    deductions.length === 0 ? null : ["Total Deductions", formatCurrency(totalDeductions)],
  );

  // Net pay
  if (y + 20 > pageHeight - 25) {
    doc.addPage();
    y = margin;
  }
  doc.setFillColor(239, 246, 255).setDrawColor(30, 64, 175);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 16, 2, 2, "FD");
  doc.setTextColor(30, 64, 175).setFont("helvetica", "bold").setFontSize(12);
  doc.text("Net Pay", margin + 5, y + 10);
  doc.setFontSize(14);
  doc.text(formatCurrency(entry.totalAmount), pageWidth - margin - 5, y + 10, {
    align: "right",
  });
  doc.setTextColor(0, 0, 0);

  // Footer on every page: website, email, phone.
  const footer = [val(company?.website), val(company?.email), val(company?.phone)]
    .filter(Boolean)
    .join("   |   ");
  if (footer) {
    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
      doc.setPage(page);
      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(100);
      doc.text(footer, pageWidth / 2, pageHeight - 10, { align: "center" });
    }
    doc.setTextColor(0, 0, 0);
  }

  return Buffer.from(doc.output("arraybuffer"));
}
