import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { logApiError } from "./error-logger";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function apiRequest(
  method: string,
  endpoint: string,
  data?: any
): Promise<any> {
  const url = endpoint;

  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  };

  if (data && method !== "GET") {
    options.body = JSON.stringify(data);
  }

  console.log(`[apiRequest] Making ${method} request to ${url}`);
  if (data) {
    console.log(`[apiRequest] Request data:`, data);
  }

  try {
    const response = await fetch(url, options);

    console.log(`[apiRequest] Response status: ${response.status}`);
    console.log(`[apiRequest] Response headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[apiRequest] Error response:`, errorText);
      console.error(`[apiRequest] Response status: ${response.status}`);
      console.error(`[apiRequest] Response URL: ${response.url}`);

      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        // If it's HTML (likely an error page), extract useful info
        if (errorText.startsWith('<!DOCTYPE html>')) {
          console.error(`[apiRequest] Server returned HTML instead of JSON - this indicates a server-side routing or error issue`);
          errorData = { message: `Server error: received HTML response instead of JSON (${response.status})` };
        } else {
          errorData = { message: errorText || `HTTP ${response.status}` };
        }
      }

      const error = new Error(errorData.message || `HTTP ${response.status}`);

      // Log API errors
      logApiError(error, `API Request: ${method} ${endpoint}`);

      throw error;
    }

    const contentType = response.headers.get("content-type");
    console.log(`[apiRequest] Info: Success response for ${method} ${endpoint}. Status: ${response.status}, Content-Type: ${contentType}`);

    if (contentType && contentType.includes("application/json")) {
      const responseData = await response.json();
      console.log(`[apiRequest] Info: Response object:`, responseData);
      return responseData;
    } else {
      const responseText = await response.text();
      console.log(`[apiRequest] Info: Response text:`, responseText);
      return responseText;
    }
  } catch (error) {
    console.error(`[apiRequest] Request failed:`, error);

    // Log the error if it's not already logged
    if (error instanceof Error && !error.message.includes('HTTP')) {
      logApiError(error, `API Request: ${method} ${endpoint}`);
    }

    throw error;
  }
}

export function generateCommonHeader(options?: { company?: any }) {
  const company = options?.company;

  return `
    <div class="report-header-container">
      <div class="print-header">
        <div class="header-row">
          <div class="header-left">
            ${company?.logo ? `<img src="${company.logo}" class="company-logo" />` : ""}
          </div>
          <div class="header-right">
            <div class="company-name">${company?.name || ""}</div>
            <div class="address">${company?.address || ""}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function getCommonPrintStyles(): string {
  return `
    .report-header-container {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      width: 100%;
      background: white;
      z-index: 1000;
    }
    .report-footer-container {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      width: 100%;
      background: white;
      z-index: 1000;
    }
    .print-header {
      padding: 10px 20px;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header-left {
      flex: 0 0 auto;
    }
    .header-right {
      text-align: right;
      flex: 1;
    }
    .company-logo {
      max-height: 120px;
    }
    .company-name {
      font-size: 16px;
      font-weight: bold;
      color: #0b4d78;
      margin-bottom: 2px;
    }
    .address {
      font-size: 10px;
      color: #555;
      white-space: pre-wrap;
      line-height: 1.2;
    }
    .print-footer {
      padding: 10px 40px;
    }
    .footer-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: #666;
    }
    .footer-item {
      flex: 1;
    }
    .footer-item:nth-child(1) { text-align: left; }
    .footer-item:nth-child(2) { text-align: center; }
    .footer-item:nth-child(3) { text-align: right; }
    .footer-item a {
      text-decoration: none;
      color: #666;
    }
  `;
}

export function getPayslipStyles(): string {
  return `
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 0;
        font-size: 12px;
        color: #333;
        line-height: 1.4;
      }
      @page {
        size: A4;
        margin: 10mm;
      }
      ${getCommonPrintStyles()}

      /* Layout table for repeating headers/footers */
      .report-wrapper {
        width: 100%;
        border-collapse: collapse;
        border: none !important;
      }
      .report-wrapper td {
        border: none !important;
        padding: 0 !important;
      }
      .report-header-space {
        height: 160px;
      }
      .report-footer-space {
        height: 60px;
      }
      .report-content-cell {
        padding: 0 20px;
        vertical-align: top;
      }

      .payslip-container {
        page-break-after: always;
        min-height: 275mm;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
      }
      .payslip-container:last-child {
        page-break-after: avoid;
      }
      .payslip-content {
        flex: 1;
      }
      .payslip-title-section {
        text-align: center;
        margin-bottom: 20px;
      }
      .payslip-title {
        font-size: 16px;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin-bottom: 25px;
      }
      .info-section h3 {
        font-size: 13px;
        margin-top: 0;
        margin-bottom: 10px;
        border-bottom: 1px solid #ddd;
        padding-bottom: 5px;
        color: #555;
        text-transform: uppercase;
      }
      .info-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 5px;
        font-size: 11px;
      }
      .info-label { color: #666; }
      .info-value { font-weight: bold; }

      .earnings-section, .deductions-section {
        margin-bottom: 20px;
        padding: 15px;
        border-radius: 5px;
        border: 1px solid #ddd;
      }
      .earnings-section {
        background-color: #f0f9ff;
        border-color: #bae6fd;
      }
      .deductions-section {
        background-color: #fef2f2;
        border-color: #fecaca;
      }
      .section-title {
        font-weight: bold;
        margin-bottom: 10px;
        font-size: 13px;
        text-transform: uppercase;
      }
      .earnings-title { color: #0369a1; }
      .deductions-title { color: #b91c1c; }

      .amount-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        font-size: 12px;
      }
      .total-row {
        border-top: 1px solid #ccc;
        padding-top: 8px;
        margin-top: 8px;
        font-weight: bold;
      }
      .net-pay {
        background-color: #f8fafc;
        border: 2px solid #e2e8f0;
        padding: 20px;
        text-align: center;
        margin-bottom: 30px;
        border-radius: 8px;
      }
      .net-pay-label {
        font-size: 14px;
        font-weight: bold;
        margin-bottom: 10px;
        color: #475569;
      }
      .net-pay-amount {
        font-size: 28px;
        font-weight: bold;
        color: #059669;
      }
      @media print {
        body { background: none; }
        .payslip-container { border: none; }
      }
    </style>
  `;
}

export function getReportStyles(): string {
  return `
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 0;
        font-size: 12px;
        color: #333;
        line-height: 1.4;
      }
      @page {
        size: A4;
        margin: 10mm;
      }
      ${getCommonPrintStyles()}

      /* Layout table for repeating headers/footers */
      .report-wrapper {
        width: 100%;
        border-collapse: collapse;
        border: none !important;
      }
      .report-wrapper td {
        border: none !important;
        padding: 0 !important;
      }
      .report-header-container {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        width: 100%;
        background: white;
      }
      .report-footer-container {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        width: 100%;
        background: white;
      }
      .report-header-space {
        height: 160px;
      }
      .report-footer-space {
        height: 60px;
      }
      .report-content-cell {
        padding: 0 20px;
      }

      .report-title-section {
        text-align: center;
        margin-bottom: 25px;
      }
      .report-title {
        font-size: 20px;
        font-weight: bold;
        color: #1e40af;
        margin-bottom: 5px;
      }
      .report-period {
        font-size: 16px;
        color: #666;
      }
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 15px;
        margin-bottom: 30px;
      }
      .summary-card {
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 15px;
        text-align: center;
        background-color: #f9f9f9;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      }
      .summary-label {
        font-size: 11px;
        color: #666;
        margin-bottom: 5px;
        font-weight: 500;
        text-transform: uppercase;
      }
      .summary-value {
        font-size: 18px;
        font-weight: bold;
        color: #333;
      }
      .currency { color: #059669; }
      .count { color: #3b82f6; }
      .percentage { color: #dc2626; }

      .section-title {
        font-size: 16px;
        font-weight: bold;
        margin: 25px 0 15px 0;
        border-bottom: 2px solid #e2e8f0;
        padding-bottom: 5px;
        color: #1e293b;
      }
      .table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
        background: white;
      }
      .table th, .table td {
        border: 1px solid #ddd;
        padding: 10px 8px;
        text-align: left;
      }
      .table th {
        background-color: #f8fafc;
        font-weight: bold;
        color: #1e293b;
        font-size: 11px;
        text-transform: uppercase;
      }
      .table .number { text-align: right; }
      .table tr:nth-child(even) { background-color: #f9fafb; }
      .total-row {
        font-weight: bold;
        background-color: #f0fdf4 !important;
      }

      .executive-summary {
        background: #f0f9ff;
        border: 1px solid #0ea5e9;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 30px;
      }
      .summary-title {
        font-size: 16px;
        font-weight: bold;
        color: #0c4a6e;
        margin-bottom: 15px;
        text-align: center;
      }
      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 15px;
        margin: 15px 0;
      }
      .metric-item {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 12px;
      }
      .metric-label {
        font-size: 10px;
        color: #64748b;
        margin-bottom: 3px;
        text-transform: uppercase;
      }
      .metric-value {
        font-size: 14px;
        font-weight: bold;
        color: #1e293b;
      }
      .cost-efficiency {
        background: #fef3c7;
        border: 1px solid #f59e0b;
        border-radius: 8px;
        padding: 15px;
        margin: 20px 0;
      }
      .highlight-box {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 15px;
        margin: 20px 0;
      }
      .page-break {
        page-break-before: always;
      }
      @media print {
        body { padding: 0; }
        .no-print { display: none; }
      }
    </style>
  `;
}

export function generateCommonFooter(options?: { company?: any }) {
  const company = options?.company;

  return `
    <div class="report-footer-container">
      <div class="print-footer">
        <div class="footer-content">
          ${company?.website ? `
            <div class="footer-item">
              🌐 <a href="${company.website}" target="_blank">${company.website}</a>
            </div>
          ` : ""}

          ${company?.email ? `
            <div class="footer-item">
              ✉ <a href="mailto:${company.email}">${company.email}</a>
            </div>
          ` : ""}

          ${company?.phone ? `
            <div class="footer-item">
              ☎ <a href="tel:${company.phone}">${company.phone}</a>
            </div>
          ` : ""}
        </div>
      </div>
    </div>
  `;
}

