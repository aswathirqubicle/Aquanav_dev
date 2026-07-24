// ─── PROJECT COMPLETION REPORT HTML GENERATOR ───────────────────────────

export function generateCompletionReportHTML(data: any): string {
  const val = (v: any) =>
    v === "null" || v === null || v === undefined ? "" : v;

  const fmt = (date: string | Date | null | undefined) => {
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
    return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
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

  const sections = data.sections || {};
  const project = data.project || {};
  const stats = data.stats || {};
  const photosByLocation: any[] = data.photosByLocation || [];
  const consumables: any[] = data.consumables || [];
  const company = data.company || {};
  const reportTitle: string =
    data.reportTitle || val(project.title) || "Project Completion Report";

  // ── Chart palette ───────────────────────────────────────────────────────────
  const barColors = [
    "#0019A5",
    "#1a56db",
    "#e02424",
    "#057a55",
    "#9f580a",
    "#5850ec",
    "#7e3af2",
  ];

  // ── Horizontal bar chart helper ─────────────────────────────────────────────
  // Adapts sizing and layout to the number of bars:
  //   ≤ 9  bars → single column, 28px bars
  //   10-20 bars → two columns (bars split L/R), 20px bars
  //   21+  bars → two columns, 16px bars
  function makeBarChart(
    bars: { label: string; value: number; color?: string }[],
    title: string,
    _subtitle: string,
  ): string {
    if (!bars.length) return "";
    const n = bars.length;
    const maxVal = Math.max(...bars.map((b) => b.value), 1);
    const totalVal = bars.reduce((s, b) => s + b.value, 0);

    // Sizing tiers
    const twoCol = n >= 10;
    const barH = n >= 21 ? 16 : n >= 10 ? 20 : 28;
    const barMb = n >= 21 ? 5 : n >= 10 ? 7 : 10;
    const labelW = twoCol ? 100 : 140; // px — label column width
    const valW = twoCol ? 36 : 48; // px — value column width
    const labelFs = twoCol ? 8 : 9; // px — label font size
    const valFs = twoCol ? 11 : 13; // px — value font size

    const renderBar = (
      b: { label: string; value: number; color?: string },
      i: number,
    ) => {
      const color = b.color || barColors[i % barColors.length];
      const pct = Math.round((b.value / maxVal) * 100);
      const sharePct =
        totalVal > 0 ? Math.round((b.value / totalVal) * 100) : 0;
      return `
<div style="display:flex;align-items:center;gap:8px;margin-bottom:${barMb}px;">
  <div style="width:${labelW}px;flex-shrink:0;font-size:${labelFs}px;font-weight:700;color:#1a1a2e;text-transform:uppercase;letter-spacing:0.3px;line-height:1.2;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${b.label}">${b.label}</div>
  <div style="flex:1;position:relative;height:${barH}px;background:#f0f2f8;border-radius:3px;overflow:hidden;">
    <div style="position:absolute;left:0;top:0;height:100%;width:${pct}%;background:${color};border-radius:3px;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>
    ${pct >= 25 ? `<div style="position:absolute;left:7px;top:0;height:100%;display:flex;align-items:center;font-size:${barH >= 24 ? 10 : 8}px;font-weight:700;color:#fff;">${sharePct}%</div>` : ""}
  </div>
  <div style="width:${valW}px;flex-shrink:0;text-align:right;font-size:${valFs}px;font-weight:800;color:${color};">${b.value}</div>
</div>`;
    };

    let barsHTML: string;
    if (twoCol) {
      // Split bars into two equal columns side by side
      const half = Math.ceil(n / 2);
      const left = bars.slice(0, half);
      const right = bars.slice(half);
      const leftHTML = left.map((b, i) => renderBar(b, i)).join("");
      const rightHTML = right.map((b, i) => renderBar(b, half + i)).join("");
      barsHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 20px;">${`<div>${leftHTML}</div><div>${rightHTML}</div>`}</div>`;
    } else {
      barsHTML = bars.map((b, i) => renderBar(b, i)).join("");
    }

    return `
<div style="page-break-inside:avoid;margin-bottom:4px;">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:${twoCol ? 12 : 14}px;">
    <div style="width:4px;height:24px;background:#0019A5;border-radius:2px;flex-shrink:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>
    <div style="font-size:${twoCol ? 12 : 13}px;font-weight:800;color:#1a1a2e;letter-spacing:0.5px;text-transform:uppercase;">${title}</div>
  </div>
  ${barsHTML}
</div>`;
  }

  // ── Section: Common Table Header & Footer ──────────────────────────────────
  // These spaces remain in the thead/tfoot to push content down/up natively
  const tableHeaderSpace = `<div class="report-header-space" style="height: 160px;"></div>`;
  const tableFooterSpace = `<div class="report-footer-space" style="height: 60px;"></div>`;

  // The actual fixed content overlay
  const fixedHeaderFooterOverlay = `
    <div class="print-header">
      <div class="top-header">
        <img src="${company.logo || ""}" />
        <div style="font-size: 14px; font-weight: 600; text-align: right;">${company.address || ""}</div>
      </div>
    </div>
    <div class="footer">
      <div class="footer-content">
        <span>🌐 ${company.website || ""}</span>
        <span>✉ ${company.email || ""}</span>
        <span>☎ ${company.phone || ""}</span>
      </div>
    </div>
  `;

  // ── Section: Cover page ─────────────────────────────────────────────────────
  const endDate = project.actualEndDate || project.plannedEndDate;
  const vesselImgUrl = val(project.vesselImageUrl); // absolute URL pre-computed by endpoint

  const coverHTML = `
<div class="cover-page" style="width:100%;min-height:240mm;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;box-sizing:border-box;text-align:center;page-break-after:always;position:relative;z-index:20;">
  ${company.logo ? `<img src="${company.logo}" style="height:70px;margin-bottom:30px;filter:brightness(10);" onerror="this.style.display='none'" />` : ""}
  <div style="color:#aabbee;font-size:18px;letter-spacing:4px;text-transform:uppercase;margin-bottom:10px;">VESSEL –</div>
  <div style="color:#ffffff;font-size:42px;font-weight:900;letter-spacing:3px;text-transform:uppercase;line-height:1.1;margin-bottom:24px;">${val(project.vesselName) || val(project.title)}</div>
  <div style="width:60px;height:3px;background:#0019A5;margin:0 auto 24px;"></div>
  <div style="color:#ffffff;font-size:18px;font-weight:600;text-transform:uppercase;letter-spacing:2px;line-height:1.4;max-width:500px;margin-bottom:40px;">${reportTitle}</div>
  <div style="color:#aabbee;font-size:14px;letter-spacing:3px;text-transform:uppercase;margin-bottom:30px;">PROJECT HIGHLIGHTS</div>
  ${
    vesselImgUrl
      ? `
  <div style="width:100%;height:90mm;overflow:hidden;margin-bottom:0;">
    <img src="${vesselImgUrl}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.parentElement.style.display='none'" />
  </div>`
      : ""
  }
  <div style="display:flex;justify-content:space-between;width:100%;max-width:500px;margin-top:auto;padding-top:30px;border-top:1px solid rgba(255,255,255,0.2);">
    <div style="color:#ffffff;font-size:13px;font-weight:600;">${fmtUpper(project.startDate)}</div>
    <div style="color:#ffffff;font-size:13px;font-weight:600;">${fmtUpper(endDate)}</div>
  </div>
</div>`;

  // ── Section: Project Details page (page 2) ──────────────────────────────────
  const additionalFields: { title: string; description: string }[] = [
    {
      title: val(project.additionalField1Title),
      description: val(project.additionalField1Description),
    },
    {
      title: val(project.additionalField2Title),
      description: val(project.additionalField2Description),
    },
    {
      title: val(project.additionalField3Title),
      description: val(project.additionalField3Description),
    },
    {
      title: val(project.additionalField4Title),
      description: val(project.additionalField4Description),
    },
    {
      title: val(project.additionalField5Title),
      description: val(project.additionalField5Description),
    },
    {
      title: val(project.additionalField6Title),
      description: val(project.additionalField6Description),
    },
  ].filter((f) => f.title || f.description);

  const detailRows = [
    { label: "Vessel Name", value: val(project.vesselName) },
    { label: "IMO Number", value: val(project.vesselImoNumber) },
    { label: "Project Title", value: val(project.title) },
    { label: "Customer", value: val(project.customerName) },
    { label: "Start Date", value: fmt(project.startDate) },
    { label: "End Date", value: fmt(endDate) },
    {
      label: "Status",
      value: val(project.status)
        ? val(project.status)
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c: string) => c.toUpperCase())
        : "",
    },
    { label: "Mode of Contract", value: val(project.modeOfContract) },
    { label: "Working Hours", value: val(project.workingHours) },
    { label: "Crew Nos", value: val(project.ridgingCrewNos) },
    { label: "PPE Required", value: val(project.ppe) },
    { label: "Description", value: val(project.description) },
  ].filter((r) => r.value);

  const projectDetailsHTML = `
<div style="padding:0;box-sizing:border-box;">
  <div style="background:#1a1a2e;padding:18px 30px 14px;display:flex;align-items:center;justify-content:space-between;">
    <div>
      <div style="color:#aabbee;font-size:10px;letter-spacing:3px;text-transform:uppercase;">Project Details</div>
      <div style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">${val(project.vesselName) || reportTitle}</div>
    </div>
    <div style="text-align:right;">
      <div style="color:#aabbee;font-size:10px;">${fmt(project.startDate)} – ${fmt(endDate)}</div>
      <div style="color:#ffffff;font-size:11px;font-weight:600;margin-top:2px;">${reportTitle}</div>
    </div>
  </div>

  <div style="padding:20px 30px;display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid #e5e7eb;">
    ${detailRows
      .map(
        (r, i) => `
    <div style="padding:8px 12px;${i % 2 === 0 ? "background:#f8faff;" : "background:#ffffff;"}border-bottom:1px solid #f0f0f0;">
      <div style="font-size:8px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:600;">${r.label}</div>
      <div style="font-size:11px;color:#111827;font-weight:500;margin-top:2px;line-height:1.4;">${r.value}</div>
    </div>`,
      )
      .join("")}
  </div>

  ${
    additionalFields.length
      ? `
  <div style="padding:16px 30px 0;">
    <div style="font-size:10px;font-weight:700;color:#1a1a2e;text-transform:uppercase;letter-spacing:2px;margin-bottom:12px;border-bottom:2px solid #0019A5;padding-bottom:6px;">Additional Project Details</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      ${additionalFields
        .map(
          (f) => `
      <div style="background:#f8faff;border:1px solid #e5e7eb;border-radius:4px;padding:10px 12px;">
        ${f.title ? `<div style="font-size:8px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:4px;">${f.title}</div>` : ""}
        <div style="font-size:11px;color:#111827;line-height:1.5;">${f.description}</div>
      </div>`,
        )
        .join("")}
    </div>
  </div>`
      : ""
  }
</div>`;

  // ── Sections: Both charts on one page (stacked) ────────────────────────────
  let totalDaysHTML = "";
  let locationBreakdownHTML = ""; // kept empty — charts combined below
  const showTotalDays = sections.totalDays !== false;
  const showLocationBreakdown =
    sections.locationBreakdown !== false && stats.locationDays?.length;

  if (showTotalDays || showLocationBreakdown) {
    const totalDays = stats.totalDays || 0;
    const activeDays = stats.activeDays || 0;
    const stopDays = stats.stopDays || 0;

    let totalDaysChartHTML = "";
    if (showTotalDays) {
      const bars = [
        { label: "TOTAL DAYS", value: totalDays, color: "#0019A5" },
        { label: "ACTIVE WORK DAYS", value: activeDays, color: "#057a55" },
      ];
      if (stopDays > 0) {
        const reason = stats.topStoppageReason || "STOPPAGE DAYS";
        bars.push({
          label: `STOPPAGE DAYS DUE TO ${reason.toUpperCase()}`,
          value: stopDays,
          color: "#e02424",
        });
      }
      totalDaysChartHTML = makeBarChart(
        bars,
        "TOTAL DAYS – BREAKDOWN",
        `TOTAL PROJECT DAYS – ${totalDays}`,
      );
    }

    let locationChartHTML = "";
    if (showLocationBreakdown) {
      const locationBars = (stats.locationDays as any[]).map(
        (ld: any, i: number) => ({
          label: (ld.location || "UNKNOWN").toUpperCase(),
          value: ld.days,
          color: barColors[i % barColors.length],
        }),
      );
      if (stopDays > 0) {
        locationBars.push({
          label: "STOPPAGE",
          value: stopDays,
          color: "#e02424",
        });
      }
      locationChartHTML = makeBarChart(
        locationBars,
        "BREAKDOWN DAYS – WORK LOCATION WISE",
        `TOTAL PROJECT DAYS – ${totalDays}`,
      );
    }

    // ── KPI summary cards ──────────────────────────────────────────────────────
    const kpiCards = [
      {
        label: "Total Project Days",
        value: totalDays,
        color: "#0019A5",
        bg: "#eef2ff",
        icon: "📅",
      },
      {
        label: "Active Work Days",
        value: activeDays,
        color: "#057a55",
        bg: "#ecfdf5",
        icon: "✅",
      },
      ...(stopDays > 0
        ? [
            {
              label: "Stoppage Days",
              value: stopDays,
              color: "#e02424",
              bg: "#fff1f2",
              icon: "⏸",
            },
          ]
        : []),
    ];

    const kpiHTML = kpiCards
      .map(
        (k) => `
<div style="flex:1;background:${k.bg};border-top:4px solid ${k.color};border-radius:8px;padding:16px 18px;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
  <div style="font-size:32px;font-weight:900;color:${k.color};line-height:1;">${k.value}</div>
  <div style="font-size:8px;color:#555;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-top:6px;line-height:1.3;">${k.label}</div>
</div>`,
      )
      .join("");

    totalDaysHTML = `
<div class="page-break" style="padding:0;background:#fff;">

  <!-- Dark header band -->
  <div style="background:#1a1a2e;padding:18px 30px 14px;display:flex;align-items:center;justify-content:space-between;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
    <div>
      <div style="color:#aabbee;font-size:10px;letter-spacing:3px;text-transform:uppercase;">Project Analytics</div>
      <div style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">${val(project.vesselName) || reportTitle}</div>
    </div>
    <div style="text-align:right;">
      <div style="color:#aabbee;font-size:10px;">${fmt(project.startDate)} – ${fmt(endDate)}</div>
      <div style="color:#ffffff;font-size:11px;font-weight:600;margin-top:2px;">${reportTitle}</div>
    </div>
  </div>

  <div style="padding:24px 30px 30px;">

    <!-- KPI summary row -->
    <div style="display:flex;gap:14px;margin-bottom:28px;">
      ${kpiHTML}
    </div>

    <!-- Divider line with label -->
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
      <div style="height:1px;flex:1;background:#e5e7eb;"></div>
      <div style="font-size:8px;color:#9ca3af;text-transform:uppercase;letter-spacing:2px;font-weight:600;">Days Analysis</div>
      <div style="height:1px;flex:1;background:#e5e7eb;"></div>
    </div>

    <!-- Charts stacked vertically -->
    <div style="display:flex;flex-direction:column;gap:20px;">
      ${
        totalDaysChartHTML
          ? `
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:22px 26px;">
        ${totalDaysChartHTML}
      </div>`
          : ""
      }
      ${
        locationChartHTML
          ? `
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:22px 26px;">
        ${locationChartHTML}
      </div>`
          : ""
      }
    </div>

  </div>
</div>`;
  }

  // ── Section: Photo gallery ─────────────────────────────────────────────────
  let galleryHTML = "";
  if (sections.photoGallery !== false && photosByLocation.length) {
    const sortedLocations = [...photosByLocation].sort((a: any, b: any) => {
      const nameA = (a.location || "GENERAL").toUpperCase();
      const nameB = (b.location || "GENERAL").toUpperCase();
      return nameA.localeCompare(nameB);
    });

    galleryHTML = sortedLocations
      .map((loc: any) => {
        const locationName = (loc.location || "GENERAL").toUpperCase();

        // Pool all photos from all groups in this location to get the total count
        const allPhotosCount = (loc.groups || []).reduce(
          (sum: number, group: any) => sum + (group.photos || []).length,
          0,
        );

        const dividerPage = `
        </td>
      </tr>
    </tbody>
    <tfoot>
      <tr><td style="border: none !important; padding: 0 !important;">
        ${tableFooterSpace}
      </td></tr>
    </tfoot>
  </table>
<div class="divider-page" style="width:100%;min-height:240mm;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;box-sizing:border-box;text-align:center;page-break-before:always;page-break-after:always;position:relative;z-index:20;">
  <div style="color:#ffffff;font-size:36px;font-weight:900;letter-spacing:3px;text-transform:uppercase;line-height:1.2;margin-bottom:16px;">${locationName}</div>
  <div style="width:60px;height:3px;background:#0019A5;margin:0 auto 16px;"></div>
  <div style="color:#aabbee;font-size:14px;letter-spacing:2px;text-transform:uppercase;">${reportTitle}</div>
  <div style="color:#aabbee;font-size:12px;margin-top:12px;">${allPhotosCount} photo${allPhotosCount !== 1 ? "s" : ""}</div>
</div>
  <table class="report-wrapper" style="width: 100%; border-collapse: collapse; border: none !important;">
    <thead>
      <tr><td style="border: none !important; padding: 0 !important;">
        ${tableHeaderSpace}
      </td></tr>
    </thead>
    <tbody>
      <tr>
        <td class="report-content-cell">
<div style="padding:10px 30px;background:#fff;page-break-before:avoid;">`;

        // 1. Collect all photos from all groups into a single array, preserving their group title
        const allPhotosInLocation: { photo: any; title: string }[] = [];
        const sortedGroups = [...(loc.groups || [])].sort((a: any, b: any) => {
          const titleA = (a.title || "").toUpperCase();
          const titleB = (b.title || "").toUpperCase();
          return titleA.localeCompare(titleB);
        });

        sortedGroups.forEach((group: any) => {
          const groupTitle = (group.title || "").toUpperCase();
          (group.photos || []).forEach((photo: any) => {
            allPhotosInLocation.push({ photo, title: groupTitle });
          });
        });

        if (allPhotosInLocation.length === 0) {
          return dividerPage + `</div>`;
        }

        // 2. Chunk them into pages based on strictly 5 PHOTO ROWS per page (15 photos)
        const MAX_PHOTO_ROWS = 5;
        const chunks: { title: string; photos: any[] }[][] = [];
        let currentChunk: { title: string; photos: any[] }[] = [];
        let currentPhotoRows = 0;

        // First, group everything by title logically
        const allGroups: { title: string; photos: any[] }[] = [];
        let currentTitle = "";
        let currentGroupPhotos: any[] = [];

        allPhotosInLocation.forEach((item) => {
          if (item.title !== currentTitle) {
            if (currentGroupPhotos.length > 0) {
              allGroups.push({
                title: currentTitle,
                photos: currentGroupPhotos,
              });
            }
            currentTitle = item.title;
            currentGroupPhotos = [];
          }
          currentGroupPhotos.push(item.photo);
        });
        if (currentGroupPhotos.length > 0) {
          allGroups.push({ title: currentTitle, photos: currentGroupPhotos });
        }

        // Now pack groups into chunks until we hit the 5-row limit
        for (const group of allGroups) {
          let remainingPhotos = [...group.photos];

          while (remainingPhotos.length > 0) {
            const availableRows = MAX_PHOTO_ROWS - currentPhotoRows;

            if (availableRows <= 0) {
              chunks.push(currentChunk);
              currentChunk = [];
              currentPhotoRows = 0;
              continue;
            }

            // Calculate how many photos we can fit in the available rows
            const maxPhotosToFit = availableRows * 3;
            const photosToTake = remainingPhotos.splice(0, maxPhotosToFit);

            const rowsUsed = Math.ceil(photosToTake.length / 3);
            currentPhotoRows += rowsUsed;

            // Add to current chunk
            if (
              currentChunk.length > 0 &&
              currentChunk[currentChunk.length - 1].title === group.title
            ) {
              currentChunk[currentChunk.length - 1].photos.push(
                ...photosToTake,
              );
            } else {
              currentChunk.push({ title: group.title, photos: photosToTake });
            }

            // If we hit or exceed the row limit, seal the chunk
            if (currentPhotoRows >= MAX_PHOTO_ROWS) {
              chunks.push(currentChunk);
              currentChunk = [];
              currentPhotoRows = 0;
            }
          }
        }

        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
        }

        // 3. Render chunks
        const pagesHTML = chunks
          .map((chunk, chunkIndex) => {
            // Calculate total rows and total titles in this chunk to determine dynamic image height
            let totalRowsInChunk = 0;
            let totalTitlesInChunk = chunk.length;
            chunk.forEach(({ photos }) => {
              totalRowsInChunk += Math.ceil(photos.length / 3);
            });

            // The usable vertical space on an A4 page is roughly 850px.
            // We subtract space for the location title, margins, and the group titles to find available space.
            const usableHeight = 820;
            const estimatedTitleSpace = totalTitlesInChunk * 35; // ~35px per title + margins
            const gapSpace = totalRowsInChunk * 8; // 8px gap between grid rows
            const availableSpaceForImages = Math.max(
              100,
              usableHeight - estimatedTitleSpace - gapSpace,
            );

            // Calculate target height per row, bounded to a reasonable range so images don't become massive
            const calculatedRowHeight = Math.floor(
              availableSpaceForImages / (totalRowsInChunk || 1),
            );
            const rowHeight = Math.min(Math.max(calculatedRowHeight, 100), 400);

            const chunkHTML = chunk
              .map(({ title, photos }) => {
                const gridItems = photos
                  .map(
                    (p) => `
            <div style="background:#fff;border-radius:6px;padding:3px;box-shadow:0 4px 10px rgba(0,0,0,0.15);height:${rowHeight}px;overflow:hidden;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
              <img src="${val(p.filePath)}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:4px;" onerror="this.closest('div').style.background='#e5e7eb'" />
            </div>
          `,
                  )
                  .join("");

                return `
            <div style="margin-bottom: 16px; page-break-inside: avoid;">
              <div style="font-size:14px;font-weight:900;color:#1a1a2e;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;text-align:center;page-break-after:avoid;">${title}</div>
              <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;width:100%;">
                ${gridItems}
                ${photos.length % 3 === 1 ? '<div style="background:transparent;"></div><div style="background:transparent;"></div>' : photos.length % 3 === 2 ? '<div style="background:transparent;"></div>' : ""}
              </div>
            </div>
          `;
              })
              .join("");

            // Only the first chunk gets the black divider page before it.
            // Subsequent chunks break to a new page naturally.
            // We use width: 100% so that the images always take the full available width, respecting the 30px side margins set on the parent.
            const pageContent = `
          <div style="background:#fff;page-break-before:${chunkIndex > 0 ? "always" : "avoid"};width:100%;">
            ${chunkHTML}
          </div>
        `;

            if (chunkIndex === 0) {
              return dividerPage + pageContent;
            }
            return pageContent;
          })
          .join("");

        return pagesHTML + `</div>`; // Close the padding wrapper opened before mapping chunks
      })
      .join("");
  }

  // ── Section: Consumables ───────────────────────────────────────────────────
  let consumablesHTML = "";
  if (sections.consumables !== false && consumables.length) {
    const cardColors = [
      { bg: "#eef2ff", border: "#0019A5", num: "#0019A5" },
      { bg: "#ecfdf5", border: "#057a55", num: "#057a55" },
      { bg: "#fff7ed", border: "#9f580a", num: "#9f580a" },
      { bg: "#fdf4ff", border: "#7e3af2", num: "#7e3af2" },
      { bg: "#fff1f2", border: "#e02424", num: "#e02424" },
      { bg: "#f0f9ff", border: "#0369a1", num: "#0369a1" },
    ];

    const cards = consumables
      .map((item: any, i: number) => {
        const c = cardColors[i % cardColors.length];
        return `
<div style="background:${c.bg};border:1.5px solid ${c.border};border-radius:8px;padding:14px 16px;display:flex;flex-direction:column;gap:6px;page-break-inside:avoid;">
  <div style="display:flex;align-items:flex-start;gap:10px;">
    <div style="min-width:26px;height:26px;background:${c.num};border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
      <span style="color:#fff;font-size:10px;font-weight:700;">${i + 1}</span>
    </div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:11px;font-weight:700;color:#111827;line-height:1.3;">${val(item.itemName)}</div>
    </div>
  </div>
  <div style="display:flex;align-items:center;justify-content:flex-end;gap:4px;border-top:1px solid ${c.border}33;padding-top:8px;margin-top:2px;">
    <span style="font-size:18px;font-weight:900;color:${c.num};">${val(item.totalQty)}</span>
    <span style="font-size:10px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">${val(item.itemUnit)}</span>
  </div>
</div>`;
      })
      .join("");

    consumablesHTML = `
<div class="page-break">
  <div style="background:#1a1a2e;padding:18px 30px 14px;margin:-10mm -12mm 20px;display:flex;align-items:center;justify-content:space-between;">
    <div>
      <div style="color:#aabbee;font-size:9px;letter-spacing:3px;text-transform:uppercase;margin-bottom:4px;">Project Report</div>
      <div style="color:#ffffff;font-size:18px;font-weight:900;letter-spacing:2px;text-transform:uppercase;">${val(project.vesselName) || reportTitle}</div>
    </div>
    <div style="text-align:right;">
      <div style="color:#ffffff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Consumables Used</div>
      <div style="color:#aabbee;font-size:10px;margin-top:2px;">${consumables.length} item${consumables.length !== 1 ? "s" : ""}</div>
    </div>
  </div>
  <div style="margin-bottom:6px;">
    <div style="width:40px;height:3px;background:#0019A5;margin-bottom:16px;"></div>
    <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;margin-bottom:16px;">USED PAINT, THINNER &amp; CONSUMABLES</div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
    ${cards}
  </div>
</div>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Project Completion Report – ${val(project.title)}</title>
<style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
body {
  font-family: Inter, Arial, sans-serif;
  margin: 0;
  background: #f4f4f4;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.page-break { page-break-before: always; padding: 10mm 12mm; background: #fff; }
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

.report-content-cell {
  vertical-align: top;
}

/* ===== HEADER ===== */
.print-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 160px;
  background: #ffffff;
  padding: 10px 20px;
  width: 100%;
  z-index: 10;
}

.top-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.top-header img {
  height: 120px;
}

/* ===== FOOTER ===== */
.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  z-index: 10;
}

.footer-content {
  display: flex;
  gap: 20px;
  font-weight: bold;
  color: #0019A5;
}

@media print {
  body { margin: 0; background: #fff; }
  .page-break { page-break-before: always; }

  @page:first {
    margin: 0;
  }
}
</style>
</head>
<body onload="window.print()">
  ${fixedHeaderFooterOverlay}
  ${coverHTML}
  <table class="report-wrapper" style="width: 100%; border-collapse: collapse; border: none !important;">
    <thead>
      <tr><td style="border: none !important; padding: 0 !important;">
        ${tableHeaderSpace}
      </td></tr>
    </thead>
    <tbody>
      <tr>
        <td class="report-content-cell">
          ${projectDetailsHTML}
          ${totalDaysHTML}
          ${locationBreakdownHTML}
          ${galleryHTML}
          ${consumablesHTML}
        </td>
      </tr>
    </tbody>
    <tfoot>
      <tr><td style="border: none !important; padding: 0 !important;">
        ${tableFooterSpace}
      </td></tr>
    </tfoot>
  </table>
</body>
</html>`;
}
