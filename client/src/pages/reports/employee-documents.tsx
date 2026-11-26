import { formatDisplayDate } from "@/lib/utils";

import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Download, FileText, Filter } from "lucide-react";

interface DocumentRow {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  employeeIsActive: boolean;
  category: "document" | "visa";
  documentType: string;
  title: string;
  documentNumber: string | null;
  expiryDate: string | null;
  status: string;
}

interface DocumentsResponse {
  includeInactive: boolean;
  documents: DocumentRow[];
}

/** Local calendar date as YYYY-MM-DD, to compare with the stored plain dates. */
const todayISO = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const addDaysISO = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const CATEGORY_LABEL: Record<DocumentRow["category"], string> = {
  document: "Document",
  visa: "Visa / Permit",
};

const DEFAULT_FILTERS = {
  employeeId: "all",
  category: "all",
  expiringBy: "",
  includeInactive: false,
};

export default function EmployeeDocumentsReport() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

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

  const { data, isLoading, isError, error } = useQuery<DocumentsResponse>({
    queryKey: ["/api/reports/employee-documents", filters.includeInactive],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.includeInactive) params.append("includeInactive", "true");
      const response = await apiRequest(
        `/api/reports/employee-documents?${params}`,
      );
      if (!response.ok) throw new Error("Failed to fetch employee documents");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const allRows = data?.documents ?? [];

  // Employees that have at least one document, for the employee filter.
  const employeeOptions = useMemo(() => {
    const seen = new Map<number, string>();
    for (const r of allRows) {
      if (!seen.has(r.employeeId)) {
        seen.set(r.employeeId, `${r.employeeName} (${r.employeeCode})`);
      }
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allRows]);

  // The API returns rows sorted by expiry (undated last), then employee, so
  // filtering keeps that order without re-sorting.
  const rows = allRows.filter((r) => {
    if (filters.employeeId !== "all" && String(r.employeeId) !== filters.employeeId)
      return false;
    if (filters.category !== "all" && r.category !== filters.category)
      return false;
    if (filters.expiringBy && (!r.expiryDate || r.expiryDate > filters.expiringBy))
      return false;
    return true;
  });

  const today = todayISO();
  const soon = addDaysISO(today, 30);
  const expiryState = (expiry: string | null) =>
    !expiry ? "none" : expiry < today ? "expired" : expiry <= soon ? "soon" : "ok";

  const expiredCount = rows.filter((r) => expiryState(r.expiryDate) === "expired").length;
  const soonCount = rows.filter((r) => expiryState(r.expiryDate) === "soon").length;

  const hasActiveFilters =
    filters.employeeId !== "all" ||
    filters.category !== "all" ||
    filters.expiringBy !== "" ||
    filters.includeInactive;

  const exportToCSV = () => {
    const headers = [
      "Employee Code",
      "Employee Name",
      "Category",
      "Document / Visa",
      "Document Number",
      "Expiry Date",
      "Status",
    ];
    const body = rows.map((r) => [
      r.employeeCode,
      r.employeeName,
      CATEGORY_LABEL[r.category],
      r.title,
      r.documentNumber || "",
      r.expiryDate || "",
      r.status,
    ]);
    const statement = filters.expiringBy
      ? `Documents and visas expiring on or before ${filters.expiringBy}`
      : "All documents and visas on file";
    const csvContent = [[statement], [], headers, ...body]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `employee-documents-${today}.csv`;
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
            <h1 className="text-xl sm:text-2xl font-bold">
              Employee Documents &amp; Visas
            </h1>
            <p className="text-sm text-muted-foreground">
              Every document and visa on file for each employee, with its
              expiry date
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
            data-testid="button-toggle-documents-filters"
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
            disabled={rows.length === 0}
            className="gap-2"
            data-testid="button-export-documents"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select
                  value={filters.employeeId}
                  onValueChange={(v) => setFilters((p) => ({ ...p, employeeId: v }))}
                >
                  <SelectTrigger data-testid="select-documents-employee">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All employees</SelectItem>
                    {employeeOptions.map(([id, label]) => (
                      <SelectItem key={id} value={String(id)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={filters.category}
                  onValueChange={(v) => setFilters((p) => ({ ...p, category: v }))}
                >
                  <SelectTrigger data-testid="select-documents-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Documents and visas</SelectItem>
                    <SelectItem value="document">Documents only</SelectItem>
                    <SelectItem value="visa">Visas / permits only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="documents-expiring-by">Expiring On or Before</Label>
                <Input
                  id="documents-expiring-by"
                  type="date"
                  value={filters.expiringBy}
                  onChange={(e) =>
                    setFilters((p) => ({ ...p, expiringBy: e.target.value }))
                  }
                  data-testid="input-documents-expiring-by"
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to include documents with no expiry
                </p>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 cursor-pointer pt-7">
                  <input
                    type="checkbox"
                    checked={filters.includeInactive}
                    onChange={(e) =>
                      setFilters((p) => ({ ...p, includeInactive: e.target.checked }))
                    }
                    data-testid="checkbox-documents-include-inactive"
                  />
                  Include inactive employees
                </Label>
                <Button
                  variant="outline"
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                  className="w-full"
                >
                  Reset filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <Card className="mb-4">
        <CardContent className="p-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <span>
              <span className="font-semibold">{rows.length}</span>{" "}
              {rows.length === 1 ? "record" : "records"}
            </span>
          </div>
          <span className="text-red-600">
            <span className="font-semibold">{expiredCount}</span> expired
          </span>
          <span className="text-orange-600">
            <span className="font-semibold">{soonCount}</span> expiring within 30 days
          </span>
        </CardContent>
      </Card>

      {/* Body */}
      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Loading documents…
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="p-8 text-center text-destructive">
            {(error as Error)?.message || "Failed to load employee documents"}
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-3 opacity-50" />
            No documents or visas match these filters.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]" data-testid="table-employee-documents">
                <thead>
                  <tr className="border-b bg-gray-50 dark:bg-gray-900">
                    {[
                      "Employee",
                      "Category",
                      "Document / Visa",
                      "Number",
                      "Expiry Date",
                      "Status",
                    ].map((h) => (
                      <th
                        key={h}
                        className={`px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider ${
                          h === "Expiry Date" ? "text-right" : "text-left"
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {rows.map((r) => {
                    const state = expiryState(r.expiryDate);
                    return (
                      <tr key={r.id}>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium">{r.employeeName}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.employeeCode}
                            {!r.employeeIsActive && " · inactive"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {CATEGORY_LABEL[r.category]}
                        </td>
                        <td className="px-4 py-3 text-sm">{r.title}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {r.documentNumber || "—"}
                        </td>
                        <td
                          className={`px-4 py-3 text-sm text-right whitespace-nowrap ${
                            state === "expired"
                              ? "text-red-600 font-medium"
                              : state === "soon"
                                ? "text-orange-600 font-medium"
                                : ""
                          }`}
                        >
                          {r.expiryDate ? formatDisplayDate(r.expiryDate) : "—"}
                          {state === "expired" && (
                            <span className="ml-2 text-xs">(expired)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm capitalize text-muted-foreground">
                          {r.status.replace(/_/g, " ")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
