import { useEffect, useRef } from "react";
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
  const formRef = useRef<HTMLFormElement>(null);

  /* ---------- Redirect if not logged in ---------- */
  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, setLocation]);

  /* ---------- Fetch Projects ---------- */
  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return null;

  return (
    <div className="p-6 flex justify-center">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">
            Weekly Report
          </CardTitle>
        </CardHeader>

        <CardContent>
          {/* 
            IMPORTANT:
            enctype required for file upload
            target="_blank" opens print page
          */}
          <form
            ref={formRef}
            method="POST"
            action="/api/print/project"
            target="_blank"
            encType="multipart/form-data"
            className="space-y-4"
          >
            {/* Project Select */}
            <div className="space-y-2">
              <Label>Select Project</Label>
              <Select
                onValueChange={(value) => {
                  const hiddenInput = document.getElementById(
                    "projectId"
                  ) as HTMLInputElement;
                  if (hiddenInput) hiddenInput.value = value;
                }}
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

              {/* Hidden input to actually submit project ID */}
              <input
                type="hidden"
                name="id"
                id="projectId"
              />
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Image</Label>
              <input
                type="file"
                name="reportImage"
                className="w-full border rounded-md p-2"
              />
            </div>

            {/* From Date */}
            <div className="space-y-2">
              <Label>From Date</Label>
              <input
                type="date"
                name="fromDate"
                className="w-full border rounded-md p-2"
                required
              />
            </div>

            {/* To Date */}
            <div className="space-y-2">
              <Label>To Date</Label>
              <input
                type="date"
                name="toDate"
                className="w-full border rounded-md p-2"
                required
              />
            </div>

            {/* Report Date */}
            <div className="space-y-2">
              <Label>Report Date</Label>
              <input
                type="date"
                name="reportDate"
                className="w-full border rounded-md p-2"
                required
              />
            </div>

            {/* Checkboxes */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="includeRemainingDays"
                value="true"
              />
              <Label>Include Remaining Work Days</Label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="includeHBMHours"
                value="true"
              />
              <Label>Include HBM Running Hrs</Label>
            </div>

            {/* Submit Button */}
            <Button type="submit" className="w-full mt-4">
              Generate Report
            </Button>

            {isLoading && (
              <p className="text-sm text-slate-500">
                Loading projects...
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
