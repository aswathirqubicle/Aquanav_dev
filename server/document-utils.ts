import path from "path";
import fs from "fs";

export function getCommonStyles(): string {
  return `
    <link
      rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
    />
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 0;
        color: #333;
        line-height: 1.4;
      }

      @media print {
        @page {
          size: A4;
          margin: 10mm;
        }
      }

      /* Layout table for repeating headers/footers */
      .report-wrapper {
        width: 100%;
        border-collapse: collapse;
        border: none !important;
      }
      .report-wrapper > thead > tr > td,
      .report-wrapper > tbody > tr > td,
      .report-wrapper > tfoot > tr > td {
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
      .report-header-space {
        height: 160px;
      }
      .report-footer-space {
        height: 60px;
      }
      .report-content-cell {
        padding: 20px;
        vertical-align: top;
      }

      /* ===== COMMON HEADER ===== */
      .header-content {
        padding: 10px 20px;
        margin-bottom: 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .top-info {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 12px;
      }

      .top-info img {
        height: 120px;
      }

      .address {
        line-height: 1.4;
      }

      .title {
        text-align: right;
        font-size: 12px;
        color: #0b4d78;
        line-height: 1.4;
      }

      /* ===== TABLE STYLES ===== */
      table:not(.report-wrapper) {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
      }

      th, td {
        border: 1px solid #ddd;
        padding: 8px;
        font-size: 13px;
      }

      th {
        background-color: #f8f9fa;
        color: #333;
        font-weight: 700;
        text-transform: uppercase;
        font-size: 11px;
        letter-spacing: 0.5px;
      }

      .text-right {
        text-align: right;
      }

      .total-row {
        font-weight: bold;
        background-color: #f8f9fa;
      }
      .terms {
        page-break-inside: avoid;
        margin-top: 20px;
      }

      /* Footer */
      .footer-content {
        display: flex;
        justify-content: space-between;
        padding: 15px 40px;
        font-size: 11px;
      }

      .footer-item i {
        margin-right: 5px;
        color: #0b4d78;
      }

      .footer-item a {
        text-decoration: none;
        color: #333;
      }

      .info-grid {
        display: flex;
        justify-content: space-between;
        margin-bottom: 30px;
        gap: 40px;
      }

      .info-box {
        flex: 1;
      }

      .info-box h3 {
        color: #0b4d78;
        padding-bottom: 5px;
        margin-top: 0;
        margin-bottom: 12px;
        font-size: 13px;
        text-transform: uppercase;
        font-weight: 700;
        letter-spacing: 0.5px;
      }

      .info-box p {
        margin: 3px 0;
        font-size: 12px;
        line-height: 1.5;
        color: #444;
      }

      .document-info {
        margin-bottom: 30px;
      }

      .document-info h1 {
        color: #0b4d78;
        margin-bottom: 15px;
        font-size: 24px;
        margin-top: 0;
        display: inline-block;
        padding-right: 20px;
        font-weight: 800;
        letter-spacing: 1px;
      }

      .document-info p {
        margin: 4px 0;
        font-size: 13px;
      }

      .document-info p strong {
        color: #555;
        width: 140px;
        display: inline-block;
      }

      /* Rich Text Content */
      .rich-text-content {
        line-height: 1.4;
      }
      .rich-text-content p {
        margin: 0 0 8px 0;
      }
      .rich-text-content p:last-child {
        margin-bottom: 0;
      }
      .rich-text-content ul, .rich-text-content ol {
        margin: 0 0 8px 20px;
        padding: 0;
      }
      .rich-text-content ul {
        list-style-type: disc;
      }
      .rich-text-content ol {
        list-style-type: decimal;
      }
      .rich-text-content h1, .rich-text-content h2 {
        margin: 12px 0 8px 0;
        color: #0b4d78;
      }
      .rich-text-content h1 { font-size: 18px; }
      .rich-text-content h2 { font-size: 16px; }
    </style>
  `;
}

export function imageToBase64(relativePath: string): string {
  const absPath = path.join(process.cwd(), relativePath);
  if (!fs.existsSync(absPath)) {
      return "";
  }
  const ext = path.extname(absPath).replace(".", "");
  const buffer = fs.readFileSync(absPath);
  return `data:image/${ext};base64,${buffer.toString("base64")}`;
}

export function generateCommonHeader(options?: { company?: any }): string {
  const val = (v: any) => (v === "null" || v === null || v === undefined ? "" : v);
  const company = options?.company;
  let logoHtml = "";
  
  if (company && val(company.logo)) {
    const base64Logo = imageToBase64(company.logo);
    if (base64Logo) {
      logoHtml = `<img src="${base64Logo}" alt="${company.name}" class="company-logo" />`;
    }
  }

  return `
  <div class="report-header-container">
    <div class="header-content">
      <div class="top-info">
        ${logoHtml}
      </div>
      <div class="title">
        <div class="address">
          ${val(company?.address)}
        </div>
      </div>
    </div>
  </div>
  `;
}

export function generateCommonFooter(options?: { company?: any }): string {
  const val = (v: any) => (v === "null" || v === null || v === undefined ? "" : v);
  const company = options?.company;

  return `
    <div class="report-footer-container">
      <div class="footer-content">
        <div class="footer-item">
          <i class="fas fa-globe"></i>
          <a href="${val(company?.website) || '#'}">${val(company?.website)}</a>
        </div>
        <div class="footer-item">
          <i class="fas fa-envelope"></i>
          <a href="mailto:${val(company?.email)}">${val(company?.email)}</a>
        </div>
        <div class="footer-item">
          <i class="fas fa-phone"></i>
          <a href="tel:${val(company?.phone)}">${val(company?.phone)}</a>
        </div>
      </div>
    </div>
  `;
}
