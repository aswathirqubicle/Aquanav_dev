import { sanitizeHtml } from "./sanitize";

export function generateConsumablePrintHTML(data: any): string {
  const sanitize = (html: string) => {
    if (html === "null" || !html) return "";
    return sanitizeHtml(html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        "*": ["style"],
      },
    });
  };

  const val = (v: any) =>
    v === "null" || v === null || v === undefined ? "" : v;

  const formatDateDDMMMYYYY = (date: string | Date) => {
    if (!date) return "";
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Helper to get week label (example: 10 Feb 2026 - 16 Feb 2026)
  function getWeekRange(date: Date) {
    const d = new Date(date);
    const first = new Date(d);
    first.setDate(d.getDate() - d.getDay()); // Sunday start

    const last = new Date(first);
    last.setDate(first.getDate() + 6);

    return `${formatDateDDMMMYYYY(first)} - ${formatDateDDMMMYYYY(last)}`;
  }

  const weeklyConsumables = (data.consumables || []).reduce(
    (acc: any, entry: any) => {
      const weekKey = getWeekRange(entry.date);

      if (!acc[weekKey]) {
        acc[weekKey] = [];
      }

      // Only include manual entry items (no inventoryItemId) in reports
      entry.items
        .filter((item: any) => !item.inventoryItemId)
        .forEach((item: any) => {
          acc[weekKey].push({
            date: formatDateDDMMMYYYY(entry.date),
            createdBy: entry.createdByName,
            itemName: item.itemName,
            quantity: item.quantity,
            unit: item.itemUnit,
            unitCost: item.unitCost,
            total: (item.quantity * parseFloat(item.unitCost)).toFixed(2),
          });
        });

      return acc;
    },
    {},
  );

  const hasAdditionalFields = [1, 2, 3, 4, 5, 6].some((i) =>
    data[`additionalField${i}Title`]?.trim(),
  );

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Weekly Report</title>

<style>
@page {
  size: A4;
  margin: 0;
}

/* ===== BODY ===== */
body {
  font-family: Inter, sans-serif;
  margin: 0;
  background: #f4f4f4;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
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

/* ===== FIXED HEADER ===== */
.print-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 160px;               /* MUST MATCH CONTAINER PADDING */
  background: #ffffff;
  z-index: 1000;
  padding: 10px 20px;
}

.top-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.top-header img {
  height: 120px;
}

/* ===== FIXED FOOTER ===== */
.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;                /* MUST MATCH CONTAINER PADDING */
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.footer-content {
  display: flex;
  gap: 20px;
  font-weight: bold;
  color: #0019A5;
}

/* ===== MAIN CONTAINER ===== */
.container {
  background: #fff;
  max-width: 900px;
  margin: auto;

  padding-left: 10px;
  padding-right: 10px;
}

/* ===== TITLES ===== */
.main-title {
  text-align: center;
  margin: 20px 0;
  font-size: 20px;
  font-weight: bold;
}

.highlight { color: red; }
.vessel { color: #0019A5; }

/* ===== SHIP IMAGE ===== */
.ship-image img {
  width: 100%;
  max-height: 160px;
  object-fit: cover;
  border-radius: 15px;
}

/* ===== TABLES ===== */
.project-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10px;
}

.project-table th,
.project-table td {
  border: 1px solid #ccc;
  padding: 6px;
}

.project-table th {
  background: #0019A5;
  color: white;
  text-align: center;
}

/* ===== SECTION TITLE ===== */
.section-title {
  background: #c00000;
  color: white;
  text-align: center;
  padding: 6px;
  margin-top: 20px;
}

/* ===== STEPS TABLE ===== */
.steps-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.steps-table th {
  background: #f4b183;
  border: 1px solid #ccc;
  font-size: 12px;
}

.steps-table td {
  background: #fff2cc;
  border: 1px solid #ccc;
  font-size: 10px;
  padding: 6px;
  vertical-align: top;
}

/* ===== IMAGE GALLERY ===== */
.image-table {
  width: 100%;
  border-collapse: collapse;
}

.image-table td {
  border: 1px solid #000;
  padding: 5px;
}

.image-table img {
  width: 100%;
  height: 230px;
  object-fit: contain;
}

/* ===== PAGE BREAK ===== */
.page-break {
  page-break-before: always;
  margin-top: 140px;
}

.highlights-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 15px;
  padding: 6px 0;
  font-weight: bold;
  font-size: 14px;
  border-bottom: 2px solid #0019A5;
}

.left-title {
  text-transform: uppercase;
}

.right-date {
  font-size: 12px;
  color: #0019A5;
}

/* ===== PRINT MODE ===== */
@media print {
  body {
    margin: 0;
  }

  .print-header {
    position: fixed;
    top: 0;
  }

  .footer {
    position: fixed;
    bottom: 0;
  }

  .page-break {
    page-break-before: always;
    margin-top: 140px;
  }

}

</style>
</head>

<body onload="window.print()">
<table class="report-wrapper" style="width: 100%; border-collapse: collapse; border: none !important;">
  <thead>
    <tr><td style="border: none !important; padding: 0 !important;"><div class="report-header-space" style="height: 160px;"><div class="print-header">
            <div class="top-header">
              <img src="${data.company?.logo || ""}" />
              <div>${data.company?.address || ""}</div>
            </div>
          </div></div></td></tr>
  </thead>
  <tbody>
    <tr>
      <td class="report-content-cell">
        <div class="container">
          <!-- TITLE -->
          <div class="main-title">
            ${val(data.title)}<br/>
            <span class="highlight">${sanitize(data.description)}</span><br/>
            <span class="vessel">${val(data.vesselName)}</span>
          </div>

          <!-- IMAGE -->
          <div class="ship-image">
            <img src="${val(data.vesselImage)}" />
          </div>

          <!-- PROJECT HIGHLIGHTS HEADER -->
          <div class="highlights-header">
            <div class="left-title">PROJECT HIGHLIGHTS</div>
            <div class="right-date">
              Report Date: ${formatDateDDMMMYYYY(data.reportDate)}
            </div>
          </div>

          <!-- PROJECT TABLE -->
          <table class="project-table">
            <tbody>
              <tr>
                <th>Project Start Date</th>
                <td>${formatDateDDMMMYYYY(data.startDate)}</td>
                <th>Vessel Name</th>
                <td>${val(data.vesselName)}</td>
              </tr>
              <tr>
                <th>Project Details</th>
                <td>${sanitize(data.description)}</td>
                <th>Client</th>
                <td>${val(data.customerName)}</td>
              </tr>
              <tr>
                <th>Mode of Contract</th>
                <td>${val(data.modeOfContract)}</td>
                <th>Riding crew Nos.</th>
                <td>${val(data.ridgingCrewNos)}</td>
              </tr>
              <tr>
                <th>PPE</th>
                <td>${val(data.ppe)}</td>
                <th>Working Hours</th>
                <td>${val(data.workingHours)}</td>
              </tr>
            </tbody>
          </table>

          ${
            hasAdditionalFields
              ? `
          <h3 class="section-title">
            COATING REPAIR PROCEDURE FOR MAIN DECK
          </h3>

          <table class="steps-table">
            <tbody>
              ${[1, 3, 5]
                .map((start) => {
                  const firstTitle = data[`additionalField${start}Title`];
                  const firstDesc = data[`additionalField${start}Description`];
                  const secondTitle = data[`additionalField${start + 1}Title`];
                  const secondDesc =
                    data[`additionalField${start + 1}Description`];
                  if (!firstTitle?.trim() && !secondTitle?.trim()) return "";
                  return `
                    <tr>
                      <th style="width:10%;">Step-${start}</th>
                      <td style="width:40%;">
                        ${firstTitle?.trim() ? `<strong>${firstTitle}</strong><br/>${sanitize(firstDesc)}` : ""}
                      </td>
                      <th style="width:10%;">Step-${start + 1}</th>
                      <td style="width:40%;">
                        ${secondTitle?.trim() ? `<strong>${secondTitle}</strong><br/>${sanitize(secondDesc)}` : ""}
                      </td>
                    </tr>`;
                })
                .join("")}
            </tbody>
          </table>
          `
              : ""
          }

          ${Object.entries(weeklyConsumables)
            .map(
              ([week, items]: any) => `
            <div class="page-break">
              <h2 style="text-align:center;color:red;">Consumables Used - ${week}</h2>
              <table class="project-table">
                <thead>
                  <tr><th>Date</th><th>Item</th><th>Qty</th></tr>
                </thead>
                <tbody>
                  ${items.map((i: any) => `<tr><td>${val(i.date)}</td><td>${val(i.itemName)}</td><td>${val(i.quantity)}</td></tr>`).join("")}
                </tbody>
              </table>
            </div>`,
            )
            .join("")}
        </div>
      </td>
    </tr>
  </tbody>
  <tfoot>
    <tr><td style="border: none !important; padding: 0 !important;"><div class="report-footer-space">
          <div class="footer">
            <div class="footer-content">
              <span>🌐 ${data.company?.website || ""}</span>
              <span>✉ ${data.company?.email || ""}</span>
              <span>☎ ${data.company?.phone || ""}</span>
            </div>
          </div>
        </div>
      </td>
    </tr>
  </tfoot>
</table>
</body>
</html>
`;
}
