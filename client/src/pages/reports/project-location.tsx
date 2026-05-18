import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { generateCommonHeader, generateCommonFooter, getReportStyles, formatDisplayDate } from "@/lib/utils";
import { ArrowLeft, MapPin, Calendar, ChevronDown, ChevronRight, Download, BarChart3, FileText } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface LocationActivity {
  date: string;
  completedTasks: string | null;
  remarks: string | null;
  hbmDailyRunningHours: string | null;
}

interface LocationData {
  location: string;
  totalDays: number;
  activities: LocationActivity[];
}

interface ProjectLocationReport {
  project: {
    id: number;
    title: string;
    locations: string[];
  };
  locationReport: LocationData[];
  totalActivities: number;
}

const CHART_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1",
  "#84cc16", "#d946ef", "#0ea5e9", "#22c55e", "#e11d48",
];

export default function ProjectLocationReport() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: company } = useQuery<any>({
    queryKey: ["/api/company"],
    enabled: isAuthenticated,
  });

  const { data: projects } = useQuery<any[]>({
    queryKey: ["/api/projects"],
    enabled: isAuthenticated,
  });

  const { data: reportData, isLoading: isReportLoading } = useQuery<ProjectLocationReport>({
    queryKey: ["/api/reports/project-location", selectedProjectId],
    queryFn: async () => {
      const response = await apiRequest(`/api/reports/project-location/${selectedProjectId}`, { method: "GET" });
      if (!response.ok) throw new Error("Failed to load report");
      return response.json();
    },
    enabled: isAuthenticated && !!selectedProjectId,
  });

  const toggleLocation = (location: string) => {
    setExpandedLocations(prev => {
      const next = new Set(prev);
      if (next.has(location)) {
        next.delete(location);
      } else {
        next.add(location);
      }
      return next;
    });
  };

  const handleDownloadPDF = () => {
    if (!reportRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const chartSvg = reportRef.current.querySelector(".recharts-wrapper svg");
    let chartHtml = "";
    if (chartSvg) {
      const svgClone = chartSvg.cloneNode(true) as SVGElement;
      svgClone.setAttribute("width", "700");
      svgClone.setAttribute("height", "350");
      chartHtml = `<div style="margin: 20px 0; text-align: center;">${svgClone.outerHTML}</div>`;
    }

    let tableRows = "";
    if (reportData) {
      for (const loc of reportData.locationReport) {
        tableRows += `<tr>
          <td style="padding: 8px 12px; border: 1px solid #ddd; font-weight: 500;">${loc.location}</td>
          <td style="padding: 8px 12px; border: 1px solid #ddd; text-align: center;">${loc.totalDays}</td>
          <td style="padding: 8px 12px; border: 1px solid #ddd; text-align: center;">${loc.activities.length}</td>
        </tr>`;

        for (const act of loc.activities) {
          tableRows += `<tr style="background: #f9fafb;">
            <td style="padding: 6px 12px 6px 30px; border: 1px solid #ddd; font-size: 12px; color: #6b7280;">${act.date}</td>
            <td colspan="2" style="padding: 6px 12px; border: 1px solid #ddd; font-size: 12px; color: #374151;">${act.completedTasks || "No description"}</td>
          </tr>`;
        }
      }
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Project Location Report - ${reportData?.project.title || ""}</title>
        ${getReportStyles()}
        <style>
          .summary { display: flex; gap: 30px; margin-bottom: 20px; justify-content: center; }
          .summary-item { padding: 10px 15px; background: #f3f4f6; border-radius: 6px; min-width: 120px; text-align: center; }
          .summary-label { font-size: 12px; color: #6b7280; }
          .summary-value { font-size: 20px; font-weight: 700; }
          /* Hide redundant company name from header in this specific report as it's in the document-info */
          .company-name { display: none; }
          .table, .table th, .table td { border: 1px solid #ddd !important; border-collapse: collapse; }
        </style>
      </head>
      <body>
        ${generateCommonHeader({ company })}

        <table class="report-wrapper">
          <thead>
            <tr><td><div class="report-header-space"></div></td></tr>
          </thead>
          <tbody>
            <tr>
              <td class="report-content-cell">
                <div class="document-info">
                  <h1>Project Location Report</h1>
                  <p><strong>Company:</strong> ${company?.name || ""}</p>
                  <p><strong>Project:</strong> ${reportData?.project.title || ""}</p>
                </div>

                <div class="summary">
                  <div class="summary-item">
                    <div class="summary-label">Active Locations</div>
                    <div class="summary-value">${reportData?.locationReport.length || 0}</div>
                  </div>
                  <div class="summary-item">
                    <div class="summary-label">Total Activities</div>
                    <div class="summary-value">${reportData?.totalActivities || 0}</div>
                  </div>
                </div>
                ${chartHtml}
                <table class="table">
                  <thead>
                    <tr>
                      <th>Location</th>
                      <th style="text-align: center;">Days with Activity</th>
                      <th style="text-align: center;">Total Entries</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${tableRows}
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr><td><div class="report-footer-space"></div></td></tr>
          </tfoot>
        </table>

        ${generateCommonFooter({ company })}
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const chartData = reportData?.locationReport.map(loc => ({
    name: loc.location.length > 20 ? loc.location.substring(0, 18) + "..." : loc.location,
    fullName: loc.location,
    days: loc.totalDays,
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setLocation("/reports")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Project Location Report</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Daily activity summary by project location</p>
          </div>
        </div>
        {reportData && reportData.locationReport.length > 0 && (
          <Button onClick={handleDownloadPDF} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Project</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-full sm:w-96">
              <SelectValue placeholder="Choose a project..." />
            </SelectTrigger>
            <SelectContent>
              {projects?.map((project: any) => (
                <SelectItem key={project.id} value={project.id.toString()}>
                  {project.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isReportLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {reportData && (
        <div ref={reportRef} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Active Locations</p>
                    <p className="text-2xl font-bold">{reportData.locationReport.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                    <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Activity Days</p>
                    <p className="text-2xl font-bold">
                      {reportData.locationReport.reduce((sum, loc) => sum + loc.totalDays, 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                    <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Entries</p>
                    <p className="text-2xl font-bold">{reportData.totalActivities}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {reportData.locationReport.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Days at Each Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full" style={{ height: Math.max(300, reportData.locationReport.length * 40) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={150}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        formatter={(value: number) => [`${value} day${value !== 1 ? "s" : ""}`, "Activity Days"]}
                        labelFormatter={(label: string) => {
                          const item = chartData.find(d => d.name === label);
                          return item?.fullName || label;
                        }}
                      />
                      <Bar dataKey="days" radius={[0, 4, 4, 0]}>
                        {chartData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {reportData.locationReport.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Location Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {reportData.locationReport.map((loc, index) => (
                  <div key={loc.location} className="border rounded-lg overflow-hidden">
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      onClick={() => toggleLocation(loc.location)}
                    >
                      <div className="flex items-center gap-3">
                        {expandedLocations.has(loc.location) ? (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        )}
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                        <span className="font-medium">{loc.location}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {loc.totalDays} day{loc.totalDays !== 1 ? "s" : ""}
                        </span>
                        <span>{loc.activities.length} {loc.activities.length === 1 ? "entry" : "entries"}</span>
                      </div>
                    </div>

                    {expandedLocations.has(loc.location) && (
                      <div className="border-t bg-gray-50 dark:bg-gray-800/50">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-400 w-28">Date</th>
                                <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-400">Completed Tasks</th>
                                <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-400 w-24">HBM Hours</th>
                                <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-400">Remarks</th>
                              </tr>
                            </thead>
                            <tbody>
                              {loc.activities.map((act, actIndex) => (
                                <tr key={actIndex} className="border-b last:border-b-0 hover:bg-gray-100 dark:hover:bg-gray-700/50">
                                  <td className="p-3 whitespace-nowrap text-gray-700 dark:text-gray-300">
                                    {act.date ? formatDisplayDate(act.date + "T00:00:00") : "—"}
                                  </td>
                                  <td className="p-3 text-gray-700 dark:text-gray-300 max-w-xs">
                                    <div className="whitespace-pre-wrap break-words">{act.completedTasks || "—"}</div>
                                  </td>
                                  <td className="p-3 text-gray-700 dark:text-gray-300 text-center">
                                    {act.hbmDailyRunningHours || "—"}
                                  </td>
                                  <td className="p-3 text-gray-700 dark:text-gray-300 max-w-xs">
                                    <div className="whitespace-pre-wrap break-words">{act.remarks || "—"}</div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <MapPin className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 text-lg">No daily activities recorded for this project</p>
                <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Activities with location data will appear here</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!selectedProjectId && !isReportLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 text-lg">Select a project to generate the report</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
