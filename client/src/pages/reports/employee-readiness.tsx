import { formatDisplayDate } from "@/lib/utils";

import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  CalendarCheck,
  Download,
  Filter,
  Users,
} from "lucide-react";

interface ReadinessEmployee {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  department: string | null;
  position: string | null;
  joiningReadinessDate: string;
}

interface ReadinessResponse {
  startDate: string;
  endDate: string | null;
  employees: ReadinessEmployee[];
}

const toISODate = (date: Date) => date.toISOString().split("T")[0];

/** "2026-08-04" -> "AUGUST 2026". Parsed by hand rather than via Date so a
 *  plain date string is never shifted a day by the local timezone. */
const monthKey = (isoDate: string) => isoDate.slice(0, 7);
const monthLabel = (isoDate: string) => {
  const [year, month] = isoDate.split("-");
  const names = [
    "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
    "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
  ];
  return `${names[parseInt(month, 10) - 1] ?? month} ${year}`;
};

export default function EmployeeReadinessReport() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [showFilters, setShowFilters] = useState(false);

  // Today onward, open-ended. That is the question this report answers — who is
  // becoming available — so an end date is opt-in rather than defaulted to some
  // far-future value that would quietly hide long-dated readiness.
  const [filters, setFilters] = useState({
    startDate: toISODate(new Date()),
    endDate: "",
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    } else if (
      user?.role !== "admin" &&
      user?.role !== "project_manager" &&
      user?.role !== "finance"
    ) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user, setLocation]);

  const { data, isLoading, isError, error } = useQuery<ReadinessResponse>({
    queryKey: ["/api/reports/employee-readiness", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.startDate) params.append("startDate", filters.startDate);
      // Withheld entirely when blank: an empty end date means no upper bound.
      if (filters.endDate) params.append("endDate", filters.endDate);

      const response = await apiRequest(
        `/api/reports/employee-readiness?${params}`,
      );
      if (!response.ok) throw new Error("Failed to fetch employee readiness");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const employees = data?.employees ?? [];

  // The API returns rows already sorted ascending by readiness date, so walking
  // them in order produces the month groups without re-sorting.
  const months: Array<{ key: string; label: string; rows: ReadinessEmployee[] }> =
    [];
  for (const row of employees) {
    if (!row.joiningReadinessDate) continue;
    const key = monthKey(row.joiningReadinessDate);
    const last = months[months.length - 1];
    if (last && last.key === key) {
      last.rows.push(row);
    } else {
      months.push({
        key,
        label: monthLabel(row.joiningReadinessDate),
        rows: [row],
      });
    }
  }

  const hasActiveFilters =
    filters.startDate !== toISODate(new Date()) || filters.endDate !== "";

  const exportToCSV = () => {
    const headers = [
      "Month",
      "Employee Code",
      "Employee Name",
      "Department",
      "Position",
      "Readiness Date",
    ];
    const rows: string[][] = [];
    for (const month of months) {
      for (const row of month.rows) {
        rows.push([
          month.label,
          row.employeeCode,
          `${row.firstName} ${row.lastName}`,
          row.department || "",
          row.position || "",
          row.joiningReadinessDate,
        ]);
      }
    }

    const rangeStatement = filters.endDate
      ? `Readiness from ${filters.startDate} to ${filters.endDate}`
      : `Readiness from ${filters.startDate} onward`;

    const csvContent = [[rangeStatement], [], headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `employee-readiness-${filters.startDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/reports")}
            className="mt-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Employee Readiness</h1>
            <p className="text-sm text-muted-foreground">
              When each employee expects to be available to deploy, grouped by
              month
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
            data-testid="button-toggle-readiness-filters"
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 rounded-full bg-primary-foreground/20 px-2 text-xs">
                on
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={exportToCSV}
            disabled={employees.length === 0}
            className="gap-2"
            data-testid="button-export-readiness"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="readiness-start">Readiness From</Label>
                <Input
                  id="readiness-start"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      startDate: e.target.value,
                    }))
                  }
                  data-testid="input-readiness-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="readiness-end">Readiness To</Label>
                <Input
                  id="readiness-end"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, endDate: e.target.value }))
                  }
                  data-testid="input-readiness-end-date"
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank for everything from the start date onward
                </p>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() =>
                    setFilters({
                      startDate: toISODate(new Date()),
                      endDate: "",
                    })
                  }
                  className="w-full"
                >
                  Reset to today onward
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <Card className="mb-4">
        <CardContent className="p-4 flex items-center gap-3">
          <Users className="h-5 w-5 text-muted-foreground" />
          <div className="text-sm">
            <span className="font-semibold">{employees.length}</span>{" "}
            {employees.length === 1 ? "employee" : "employees"} with readiness{" "}
            {filters.endDate
              ? `between ${formatDisplayDate(filters.startDate)} and ${formatDisplayDate(filters.endDate)}`
              : `from ${formatDisplayDate(filters.startDate)} onward`}
          </div>
        </CardContent>
      </Card>

      {/* Body */}
      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Loading readiness…
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="p-8 text-center text-destructive">
            {(error as Error)?.message || "Failed to load employee readiness"}
          </CardContent>
        </Card>
      ) : months.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <CalendarCheck className="h-8 w-8 mx-auto mb-3 opacity-50" />
            No employee has a readiness date in this range.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {months.map((month) => (
            <Card key={month.key} data-testid={`readiness-month-${month.key}`}>
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 dark:bg-gray-900">
                  <h2 className="text-sm font-semibold tracking-wider">
                    {month.label}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {month.rows.length}{" "}
                    {month.rows.length === 1 ? "employee" : "employees"}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Employee Code
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Employee Name
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Department
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Position
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Readiness Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {month.rows.map((row) => (
                        <tr key={row.id}>
                          <td className="px-4 py-3 text-sm font-medium">
                            {row.employeeCode}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {row.firstName} {row.lastName}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {row.department || "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {row.position || "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            {formatDisplayDate(row.joiningReadinessDate)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
