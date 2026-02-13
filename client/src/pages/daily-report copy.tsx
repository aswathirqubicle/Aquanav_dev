import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Project } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [includeRemainingDays, setIncludeRemainingDays] = useState(false);
  const [includeHBMHours, setIncludeHBMHours] = useState(false);
  const [loading, setLoading] = useState(false);

  /* ---------- Redirect ---------- */
  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, setLocation]);

  /* ---------- Fetch Projects ---------- */
  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return null;

  /* ---------- Generate Report ---------- */
  const handleGenerateReport = async () => {
    if (!selectedProjectId) {
      alert("Please select a project");
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("id", selectedProjectId);
      formData.append("fromDate", fromDate);
      formData.append("toDate", toDate);
      formData.append("reportDate", reportDate);
      formData.append(
        "includeRemainingDays",
        String(includeRemainingDays)
      );
      formData.append(
        "includeHBMHours",
        String(includeHBMHours)
      );

      if (image) {
        formData.append("reportImage", image);
      }

      const response = await fetch("/api/print/project", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to generate report");
      }

      const data = await response.json();

      // Store response in sessionStorage
      sessionStorage.setItem(
        "printProjectData",
        JSON.stringify(data)
      );

      // Open print page
      window.open("/print/project", "_blank");
    } catch (error) {
      console.error(error);
      alert("Error generating report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 flex justify-center">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">
            Weekly Report
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Project */}
          <div className="space-y-2">
            <Label>Select Project</Label>
            <Select
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects?.map((project) => (
                  <SelectItem
                    key={project.id}
                    value={project.id.toString()}
                  >
                    {project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Image */}
          <div className="space-y-2">
            <Label>Image</Label>
            <input
              type="file"
              onChange={(e) =>
                setImage(e.target.files?.[0] ?? null)
              }
              className="w-full border rounded-md p-2"
            />
          </div>

          {/* From Date */}
          <div className="space-y-2">
            <Label>From Date</Label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full border rounded-md p-2"
            />
          </div>

          {/* To Date */}
          <div className="space-y-2">
            <Label>To Date</Label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full border rounded-md p-2"
            />
          </div>

          {/* Report Date */}
          <div className="space-y-2">
            <Label>Report Date</Label>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="w-full border rounded-md p-2"
            />
          </div>

          {/* Checkboxes */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeRemainingDays}
              onChange={(e) =>
                setIncludeRemainingDays(e.target.checked)
              }
            />
            <Label>Include Remaining Work Days</Label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeHBMHours}
              onChange={(e) =>
                setIncludeHBMHours(e.target.checked)
              }
            />
            <Label>Include HBM Running Hrs</Label>
          </div>

          {/* Button */}
          <Button
            className="w-full mt-4"
            onClick={handleGenerateReport}
            disabled={loading}
          >
            {loading ? "Generating..." : "Generate Report"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
