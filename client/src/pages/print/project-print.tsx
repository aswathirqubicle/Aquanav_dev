import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";

/* ---------------- TYPES ---------------- */

interface Report {
  day_num: number;
  date: string;
  location?: string;
  activities?: string;
  consumables?: string;
  remarks?: string;
}

interface GalleryItem {
  title: string;
  description: string;
  images: string[];
}

interface ProjectPrintResponse {
  title: string;
  report_date: string;
  vessel_name: string;
  project_start_date: string;
  client: string;
  reports: Record<string, Report[]>;
  gallery: GalleryItem[];
  remarks?: string;
}

export default function ProjectPrintDummy() {
  const [data, setData] = useState("");
  useEffect(() => {
    setTimeout(() => window.print(), 800);
  }, []);

  /* ---------------- REAL DATA ---------------- */

  useEffect(() => {
  const project = sessionStorage.getItem("printProjectData");
  if (project) {
    const parsed = JSON.parse(project);
    setData(parsed);
  }
}, []);
  /* ---------------- DUMMY DATA ---------------- */

  const title = "LILA ACE";
  const reportDate = "31.01.2026";

  const weeklyReports = {
    1: [
      {
        day_num: 1,
        date: "31.01.2026",
        location: "Main Deck",
        activities: "Surface preparation and hydro blasting",
      },
      {
        day_num: 2,
        date: "01.02.2026",
        location: "Main Deck",
        activities: "Spot repair and epoxy primer coating",
      },
    ],
  };

  const gallery = [
    {
      title: "Hydro Blasting Progress",
      description: "Surface preparation images",
      images: [
        "/images/sample1.jpg",
        "/images/sample2.jpg",
        "/images/sample3.jpg",
        "/images/sample4.jpg",
      ],
    },
  ];

  return (
    <>
      {/* ================= STYLE (COPIED AS-IS) ================= */}
      <style>{`
@page { size: A4; margin: 0; }

body {
  font-family: Inter, sans-serif;
  margin: 0;
  background: #f4f4f4;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.container {
  background: #fff;
  max-width: 900px;
  margin: auto;
  padding: 10px;
}

.top-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 3px solid #0019A5;
  padding-bottom: 10px;
}

.top-header img { height: 60px; }

.main-title {
  text-align: center;
  margin: 20px 0;
  font-size: 20px;
  font-weight: bold;
}

.highlight { color: red; }
.vessel { color: #0019A5; }

.ship-image img {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  border-radius: 15px;
}

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

.section-title {
  background: #c00000;
  color: white;
  text-align: center;
  padding: 6px;
  margin-top: 20px;
}

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
}

.footer {
  border-top: 1px solid #0019A5;
  border-bottom: 1px solid #0019A5;
  text-align: center;
  padding: 10px 0;
  margin-top: 20px;
}

.footer-content {
  display: flex;
  justify-content: center;
  gap: 20px;
  font-weight: bold;
  color: #0019A5;
}

.page-break {
  page-break-before: always;
}

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

@media print {
  .footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
  }
}
      `}</style>

      {/* ================= CONTENT ================= */}
      <div className="container" id="report">

        {/* ---------- HEADER ---------- */}
        <div className="top-header">
          <img src={data?.company?.logo} alt="Logo" />
          <div>{data?.company?.address}</div>
        </div>

        {/* ---------- TITLE ---------- */}
        <div className="main-title">
          {data?.title} <br />
          <span className="highlight">
            <span
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    data?.description || ""
                  ),
                }}
              />
          </span>
          <br />
          <span className="vessel">{data?.vesselName}</span>
        </div>

        {/* ---------- IMAGE ---------- */}
        <div className="ship-image">
          <img src={data?.vesselImage} alt="Ship" />
        </div>

        {/* ---------- PROJECT TABLE ---------- */}
        <table className="project-table">
          <tbody>
            <tr>
              <th>Project Start Date</th>
              <td>{data?.startDate}</td>
              <th>Vessel Name</th>
              <td>{data?.vesselName}</td>
            </tr>
            <tr>
              <th>Project Details</th>
              <td><span
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    data?.description || ""
                  ),
                }}
              /></td>
              <th>Client</th>
              <td>{data?.customerName}</td>
            </tr>
            <tr>
              <th>Mode of Contract</th>
              <td>{data?.modeOfContract}</td>
              <th>Riding crew Nos.</th>
              <td>{data?.ridgingCrewNos}</td>
            </tr>
            <tr>
              <th>PPE</th>
              <td>{data?.ppe}</td>
              <th>Working Hours</th>
              <td>{data?.workingHours}</td>
            </tr>
          </tbody>
        </table>

        {/* ---------- STEPS ---------- */}
        <h3 className="section-title">
          COATING REPAIR PROCEDURE FOR MAIN DECK
        </h3>

        <table className="steps-table">
  <tbody>
    {(data?.additionalField1Title?.trim() ||
      data?.additionalField2Title?.trim()) && (
      <tr>
        <th>Step-1</th>
        <td>
          {data?.additionalField1Title?.trim() && (
            <>
              <b>{data.additionalField1Title}</b>{" "}
              <span
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    data?.additionalField1Description || ""
                  ),
                }}
              />
            </>
          )}
        </td>

        <th>Step-2</th>
        <td>
          {data?.additionalField2Title?.trim() && (
            <>
              <b>{data.additionalField2Title}</b>{" "}
              <span
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    data?.additionalField2Description || ""
                  ),
                }}
              />
            </>
          )}
        </td>
      </tr>
    )}

    {(data?.additionalField3Title?.trim() ||
      data?.additionalField4Title?.trim()) && (
      <tr>
        <th>Step-3</th>
        <td>
          {data?.additionalField3Title?.trim() && (
            <>
              <b>{data.additionalField3Title}</b>{" "}
              <span
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    data?.additionalField3Description || ""
                  ),
                }}
              />
            </>
          )}
        </td>

        <th>Step-4</th>
        <td>
          {data?.additionalField4Title?.trim() && (
            <>
              <b>{data.additionalField4Title}</b>{" "}
              <span
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    data?.additionalField4Description || ""
                  ),
                }}
              />
            </>
          )}
        </td>
      </tr>
    )}

    {(data?.additionalField5Title?.trim() ||
      data?.additionalField6Title?.trim()) && (
      <tr>
        <th>Step-5</th>
        <td>
          {data?.additionalField5Title?.trim() && (
            <>
              <b>{data.additionalField5Title}</b>{" "}
              <span
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    data?.additionalField5Description || ""
                  ),
                }}
              />
            </>
          )}
        </td>

        <th>Step-6</th>
        <td>
          {data?.additionalField6Title?.trim() && (
            <>
              <b>{data.additionalField6Title}</b>{" "}
              <span
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    data?.additionalField6Description || ""
                  ),
                }}
              />
            </>
          )}
        </td>
      </tr>
    )}
  </tbody>
</table>
{data?.reportImage && (
  <>
    <br/><h2 style={{ textAlign: "center", color: "red" }}>
      WORK PLAN
    </h2>

    <div className="wbt-image">
      <img src={data.reportImage} alt="Ship Image" />
    </div>
  </>
)}


        {/* ---------- WEEKLY REPORT ---------- */}
        {Object.entries(weeklyReports).map(([week, reports]) => (
          <div className="page-break" key={week}>
            <h2 style={{ textAlign: "center", color: "red" }}>
              Work done for the Week - {week}
            </h2>

            <table className="project-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Date</th>
                  <th>Location</th>
                  <th>Activities</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r, i) => (
                  <tr key={i}>
                    <td>Day {r.day_num}</td>
                    <td>{r.date}</td>
                    <td>{r.location}</td>
                    <td>{r.activities}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* ---------- GALLERY ---------- */}
        {gallery.map((g, i) => (
          <div className="page-break" key={i}>
            <h2 style={{ textAlign: "center", color: "red" }}>{g.title}</h2>
            <p style={{ textAlign: "center" }}>{g.description}</p>

            <table className="image-table">
              <tbody>
                {g.images.reduce<string[][]>((rows, img, idx) => {
                  if (idx % 2 === 0) rows.push([img]);
                  else rows[rows.length - 1].push(img);
                  return rows;
                }, []).map((row, r) => (
                  <tr key={r}>
                    {row.map((img, c) => (
                      <td key={c}>
                        <img src={img} />
                      </td>
                    ))}
                    {row.length === 1 && <td />}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* ---------- FOOTER ---------- */}
        <div className="footer">
          <div className="footer-content">
            <span>🌐 {data?.company?.website}</span>
            <span>✉ {data?.company?.email}</span>
            <span>☎ {data?.company?.phone}</span>
          </div>
        </div>
      </div>
    </>
  );
}
