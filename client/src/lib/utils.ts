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
      }
      @page {
        size: A4;
        margin: 15mm;
      }
      .payslip-container {
        page-break-after: always;
        padding: 20px;
        min-height: 250mm;
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
      .print-header {
        border-bottom: 2px solid #333;
        padding-bottom: 10px;
        margin-bottom: 20px;
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
        max-height: 60px;
      }
      .company-name {
        font-size: 18px;
        font-weight: bold;
        margin-bottom: 5px;
      }
      .address {
        font-size: 11px;
        color: #555;
        white-space: pre-wrap;
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
      .print-footer {
        border-top: 1px solid #ccc;
        padding-top: 15px;
        font-size: 10px;
        color: #666;
      }
      .footer-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
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
      @media print {
        body { background: none; }
        .payslip-container { border: none; }
      }
    </style>
  `;
}

export function generateCommonFooter(options?: { company?: any }) {
  const company = options?.company;

  return `
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
  `;
}

