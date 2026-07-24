import { sanitizeHtml } from "./sanitize";

export function generateProjectPrintHTML(data: any): string {
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

  const fmtUpper = (date: string | Date | null | undefined) => {
    if (!date) return "";
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const months = [
      "JANUARY",
      "FEBRUARY",
      "MARCH",
      "APRIL",
      "MAY",
      "JUNE",
      "JULY",
      "AUGUST",
      "SEPTEMBER",
      "OCTOBER",
      "NOVEMBER",
      "DECEMBER",
    ];
    return `${day} ${months[d.getMonth()]} - ${d.getFullYear()}`;
  };

  const gallery = data.gallery || [];
  // Helper to get week label (example: 10 Feb 2026 - 16 Feb 2026)
  function getWeekRange(date: Date) {
    const d = new Date(date);
    const first = new Date(d);
    first.setDate(d.getDate() - d.getDay()); // Sunday start

    const last = new Date(first);
    last.setDate(first.getDate() + 6);

    return `${formatDateDDMMMYYYY(first)} - ${formatDateDDMMMYYYY(last)}`;
  }

  // Calculate relative day
  const getRelativeDay = (activityDate: string | Date) => {
    if (!data.startDate) return "-";
    const start = new Date(data.startDate);
    start.setHours(0, 0, 0, 0);
    const current = new Date(activityDate);
    current.setHours(0, 0, 0, 0);
    const diffTime = current.getTime() - start.getTime();
    // Use Math.round to avoid Daylight Saving Time (DST) shift bugs
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1; // +1 because start date itself is Day 1
  };

  // Group by week
  const weeklyReports = data.dailyActivities.reduce(
    (acc: any, activity: any) => {
      const weekKey = getWeekRange(activity.date);

      if (!acc[weekKey]) {
        acc[weekKey] = [];
      }

      acc[weekKey].push({
        day_num: getRelativeDay(activity.date),
        date: formatDateDDMMMYYYY(activity.date),
        location: activity.location,
        activities: activity.tasks,
        remarks: activity.remarks,
        hbmHours: activity.hbmDailyRunningHours,
      });

      return acc;
    },
    {},
  );

  const plannedReports = data.plannedActivities.reduce(
    (acc: any, activity: any) => {
      const weekKey = getWeekRange(activity.date);

      if (!acc[weekKey]) {
        acc[weekKey] = [];
      }

      acc[weekKey].push({
        day_num: getRelativeDay(activity.date),
        date: formatDateDDMMMYYYY(activity.date),
        location: activity.location,
        activities: activity.tasks,
      });

      return acc;
    },
    {},
  );

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

  const vesselImgUrl = val(data.vesselImageUrl) || val(data.vesselImage);
  const company = data.company || {};
  const reportTitleStr =
    data.reportTitle === "null"
      ? "WEEKLY REPORT"
      : data.reportTitle || "WEEKLY REPORT";

  const coverHTML = `
<div class="cover-page" style="width:100%;min-height:240mm;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;box-sizing:border-box;text-align:center;page-break-after:always;position:relative;z-index:20;">
  ${company.logo ? `<img src="${company.logo}" style="height:70px;margin-bottom:30px;filter:brightness(10);" onerror="this.style.display='none'" />` : ""}
  <div style="color:#ffffff;font-size:36px;font-weight:900;letter-spacing:2px;text-transform:uppercase;line-height:1.2;margin-bottom:12px;">${val(data.title)}</div>
  <div style="color:#ff4444;font-size:24px;font-weight:700;letter-spacing:1px;line-height:1.3;margin-bottom:24px;">${sanitize(data.description)}</div>
  <div style="width:60px;height:3px;background:#0019A5;margin:0 auto 24px;"></div>
  <div style="color:#aabbee;font-size:22px;font-weight:700;text-transform:uppercase;letter-spacing:2px;line-height:1.4;max-width:500px;margin-bottom:40px;">${reportTitleStr}</div>
  ${
    vesselImgUrl
      ? `
  <div style="width:100%;height:90mm;overflow:hidden;margin-bottom:0;">
    <img src="${vesselImgUrl}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.parentElement.style.display='none'" />
  </div>`
      : ""
  }
  <div style="display:flex;justify-content:center;width:100%;max-width:500px;margin-top:auto;padding-top:30px;border-top:1px solid rgba(255,255,255,0.2);">
    <div style="color:#ffffff;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">REPORT DATE: ${fmtUpper(data.reportDate)}</div>
  </div>
</div>`;

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
html, body {
  height: 100%;
  margin: 0;
}
body {
  font-family: Inter, sans-serif;
  margin: 0;
  background: #f4f4f4;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* Layout table for repeating headers/footers */
.report-wrapper {
  height: 100%;
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
.report-wrapper > thead > tr > td {
  background: #ffffff;
}

.report-content-cell {
  vertical-align: top;
  background: #ffffff;
  height: 250mm;
}

/* ===== FIXED HEADER ===== */
.print-header {
  background: #ffffff;
  padding: 5px 20px 10px 20px;
  margin-bottom: 20px; /* <--- This creates the gap between the header line and content on ALL pages */
  box-sizing: border-box;
  border-bottom: 2px solid #0019A5;
  width: 100%;
}

.top-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
}

.top-header img {
  max-height: 80px;
}

/* ===== FIXED FOOTER ===== */
.footer {
  background: #ffffff;
  display: flex;
  align-items: center;

  box-sizing: border-box;
  border-top: 2px solid #0019A5;
  border-bottom: 2px solid #0019A5;
  padding: 10px 20px;
  margin-top: 10px;
  width: 100%;
}

.footer-content {
  display: flex;
  gap: 20px;
  font-weight: bold;
  color: #0019A5;
  width: 100%;
  justify-content: space-between;
}

/* ===== MAIN CONTAINER ===== */
.container {
  background: #ffffff;
  max-width: 900px;
  margin: auto;
  padding-left: 10px;
  padding-right: 10px;
  padding-bottom: 20px;
}

/* ===== TITLES ===== */
.main-title {
  text-align: center;
  margin: 20px 0;
  font-size: 20px;
  font-weight: bold;
  line-height: 1.1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.main-title p {
  margin: 0;
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
  padding: 4px;
  margin: 0;
  font-size: 13px;
  line-height: 1.1;
}

/* ===== AMBIENT CONDITIONS BOX ===== */
.ambient-box {
  display: block;
  width: 100%;
  box-sizing: border-box;
  background-color: #FAFAC8;
  padding: 15px;
  /* margin-top: 30px; */
  margin-top: 10px;
  margin-bottom: 30px;
  border: 1px solid #A9A9A9;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 11.2pt;
  line-height: 1.4;
  page-break-inside: auto;
}
.ambient-box p.ambient-title {
  font-weight: bold;
  margin-top: 0;
  margin-bottom: 8px;
}
.ambient-box p.ambient-subtitle {
  color: #0070C0;
  font-weight: bold;
  margin-bottom: 8px;
  margin-top: 0;
}
.ambient-box ol {
  margin-top: 0;
  margin-bottom: 0;
  padding-left: 25px;
}
.ambient-box li {
  margin-bottom: 3px;
}
.ambient-box li:last-child {
  margin-bottom: 0;
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
  padding: 10px;
}

.image-table img {
  width: 100%;
  height: 230px;
  object-fit: contain;
}

/* ===== PAGE BREAK ===== */
.page-break {
  page-break-before: always;
}

.highlights-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 15px;
  padding: 6px 0;
  font-weight: bold;
  font-size: 14.4pt;
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

  .page-break {
    page-break-before: always;
  }

}

</style>
</head>

<body onload="window.print()">
${coverHTML}
<table class="report-wrapper" style="width: 100%; border-collapse: collapse; border: none !important;">
  <thead>
    <tr><td style="border: none !important; padding: 0 !important;"><div class="report-header-space"><div class="print-header">
            <div class="top-header">
              <img src="${data.company?.logo || ""}" />
              <div style="font-size: 14px; font-weight: 600; text-align: right; white-space: pre-wrap;">${data.company?.address || ""}</div>
            </div>
          </div></div></td></tr>
  </thead>
  <tbody>
    <tr>
      <td class="report-content-cell">
        <div class="container">
          <!-- PROJECT HIGHLIGHTS HEADER -->
          <div class="highlights-header" style="margin-top: 0;">
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
              ${(() => {
                const validFields = [1, 2, 3, 4, 5, 6]
                  .map((i) => ({
                    title: data[`additionalField${i}Title`],
                    desc: data[`additionalField${i}Description`],
                  }))
                  .filter((f) => f.title?.trim() && f.desc?.trim());

                const rows = [];
                for (let i = 0; i < validFields.length; i += 2) {
                  rows.push([validFields[i], validFields[i + 1]]);
                }

                return rows
                  .map(([first, second]) => {
                    if (first && second) {
                      return `
        <tr>
          <th style="width:10%;">${first.title?.trim() ? first.title : ""}</th>
          <td style="width:40%;">
            ${first.desc?.trim() ? sanitize(first.desc) : ""}
          </td>
          <th style="width:10%;">${second.title?.trim() ? second.title : ""}</th>
          <td style="width:40%;">
            ${second.desc?.trim() ? sanitize(second.desc) : ""}
          </td>
        </tr>`;
                    }

                    if (first && !second) {
                      return `
        <tr>
          <th style="width:10%;">
            ${first.title?.trim() ? first.title : ""}
          </th>
          <td colspan="3">
            ${first.desc?.trim() ? sanitize(first.desc) : ""}
          </td>
        </tr>`;
                    }

                    return "";
                  })
                  .join("");
              })()}
            </tbody>
          </table>
          `
              : ""
          }

          ${
            data.surfaceTemperature ||
            data.airTemperature ||
            data.relativeHumidity ||
            data.dewPointTemperature ||
            data.dewPointSurfaceDiff
              ? `
          <div class="ambient-box">
            <p class="ambient-title">The surface preparation and the coating process should be carried out within the range of ambient conditions recommended by the paint manufacturer.</p>
            <p class="ambient-subtitle">The five main ambient conditions that should be determined include:</p>
            <ol>
              ${data.surfaceTemperature ? `<li><strong>Surface temperature</strong> – ${sanitize(data.surfaceTemperature)}</li>` : ""}
              ${data.airTemperature ? `<li><strong>Air temperature</strong> – ${sanitize(data.airTemperature)}</li>` : ""}
              ${data.relativeHumidity ? `<li><strong>Relative humidity (RH)</strong> ${sanitize(data.relativeHumidity)}</li>` : ""}
              ${data.dewPointTemperature ? `<li><strong>Dew point temperature</strong> – ${sanitize(data.dewPointTemperature)}</li>` : ""}
              ${data.dewPointSurfaceDiff ? `<li><strong>Difference between the dew point and surface temperatures</strong> – ${sanitize(data.dewPointSurfaceDiff)}</li>` : ""}
            </ol>
          </div>
          `
              : ""
          }

          ${
            data.reportImage || Object.keys(plannedReports).length > 0
              ? `
            <div class="page-break">
              ${Object.keys(plannedReports).length > 0 ? `<h2 style="text-align:center;color:red;">WORK PLAN</h2>` : ""}
              ${
                data.reportImage
                  ? `
              <div class="ship-image">
                <img src="${data.reportImage}" />
              </div>`
                  : ""
              }
            </div>`
              : ""
          }

          ${Object.entries(weeklyReports)
            .filter(([_, reports]: any) => reports.length > 0)
            .map(([week, reports]: any, index: number) => {
              const isUnderWorkPlan =
                index === 0 &&
                (data.reportImage || Object.keys(plannedReports).length > 0);
              const isFirstWithoutWorkPlan = index === 0 && !isUnderWorkPlan;
              return `
            <div class="${isFirstWithoutWorkPlan ? "page-break" : ""}">
              <h2 style="text-align:center;color:red; margin-top: ${isFirstWithoutWorkPlan ? "0" : "20px"};">Work done for the Week - ${week}</h2>
              <table class="project-table">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Date</th>
                    <th>Location</th>
                    <th>Activities</th>
                    <th>Remarks</th>
                    ${data?.includeHBMHours ? `<th>HBM Hours</th>` : ``}
                  </tr>
                </thead>
                <tbody>
                  ${reports
                    .map(
                      (r: any) => `
                    <tr>
                      <td>Day ${r.day_num}</td>
                      <td>${val(r.date)}</td>
                      <td>${val(r.location)}</td>
                      <td>${val(r.activities)}</td>
                      <td>${val(r.remarks)}</td>
                      ${data?.includeHBMHours ? `<td>${val(r.hbmHours)}</td>` : ``}
                    </tr>`,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>`;
            })
            .join("")}

          ${gallery
            .filter((g: any) => g.photos && g.photos.length > 0)
            .map(
              (g: any) => `
            <div class="page-break">
              <h2 style="text-align:center;color:red;text-transform: capitalize;">${val(g.title)}</h2>
              <h2 style="text-align:center;">${val(g.description)}</h2>
              <table class="image-table">
                <tbody>
                  ${g.photos
                    .reduce((rows: any[], img: any, idx: number) => {
                      const columns = 2; // 2 columns for symmetry
                      if (idx % columns === 0) rows.push([img]);
                      else rows[rows.length - 1].push(img);
                      return rows;
                    }, [])
                    .map(
                      (row: any[]) => `
                    <tr>
                      ${row.map((img) => `<td style="width: 50%;"><img src="${val(img.filePath)}" class="image-table img" /></td>`).join("")}
                      ${row.length === 1 ? '<td style="width: 50%; border: none;"></td>' : ""}
                    </tr>`,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>`,
            )
            .join("")}

          ${Object.entries(weeklyConsumables)
            .filter(([_, items]: any) => items.length > 0)
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

          ${Object.entries(plannedReports)
            .filter(([_, reports]: any) => reports.length > 0)
            .map(
              ([week, reports]: any) => `
            <div class="page-break">
              <h2 style="text-align:center;color:red;">Work Planned for the Week - ${week}</h2>
              <table class="project-table">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Date</th>
                    <th>Location</th>
                    <th>Activities</th>
                  </tr>
                </thead>
                <tbody>
                  ${reports
                    .map(
                      (r: any) => `
                    <tr>
                      <td>Day ${r.day_num}</td>
                      <td>${val(r.date)}</td>
                      <td>${val(r.location)}</td>
                      <td>${val(r.activities)}</td>
                    </tr>`,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>`,
            )
            .join("")}

          ${
            data.workRemainingDays && data.workRemainingDays.length > 0
              ? `
            <div class="page-break">
              <h2 style="text-align:center;color:red;">Work Remaining Days</h2>
              <table style="width:100%; border-collapse:collapse;" border="1">
                <thead>
                  <tr>
                    <th style="padding:8px; text-align:left;">Location</th>
                    <th style="padding:8px; text-align:left;">Remaining Days</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.workRemainingDays
                    .map(
                      (item: any) => `
                    <tr>
                      <td style="padding:8px;">${val(item.location) || "-"}</td>
                      <td style="padding:8px;">${val(item.days) || "-"}</td>
                    </tr>`,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>`
              : ""
          }

          ${
            data.latestRemark
              ? `
            <div style="margin-top:20px; page-break-inside:avoid; break-inside:avoid;">
              <h3 style="color:red;margin-bottom:10px;">Remarks</h3>
              <div style="white-space:pre-wrap;">${val(data.latestRemark)}</div>
            </div>`
              : ""
          }
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
