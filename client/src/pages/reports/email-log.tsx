import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { sanitize } from "@/lib/sanitize";
import { ArrowLeft, Download, Filter, Mail } from "lucide-react";

interface EmailLogRow {
  id: number;
  toEmail: string;
  recipientName: string | null;
  subject: string | null;
  bodyHtml: string | null;
  template: string | null;
  status: string;
  error: string | null;
  relatedType: string | null;
  relatedId: number | null;
  sentAt: string;
}

interface EmailLogResponse {
  rows: EmailLogRow[];
  counts: { total: number; sent: number; failed: number };
}

const toISODate = (date: Date) => date.toISOString().split("T")[0];

/** Timestamps are stored without a zone; render them in the client's. */
const formatSentAt = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export default function EmailLogReport() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [showFilters, setShowFilters] = useState(false);
  const [viewing, setViewing] = useState<EmailLogRow | null>(null);

  // Last 30 days by default — the log grows steadily and the useful question is
  // almost always "what happened recently".
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [filters, setFilters] = useState({
    startDate: toISODate(thirtyDaysAgo),
    endDate: "",
    status: "all",
    search: "",
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    } else if (user?.role !== "admin") {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user, setLocation]);

  const { data, isLoading, isError, error } = useQuery<EmailLogResponse>({
    queryKey: ["/api/reports/email-log", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.status !== "all") params.append("status", filters.status);
      if (filters.search.trim()) params.append("search", filters.search.trim());

      const response = await apiRequest(`/api/reports/email-log?${params}`);
      if (!response.ok) throw new Error("Failed to fetch email log");
      return response.json();
    },
    enabled: isAuthenticated && user?.role === "admin",
  });

  const rows = data?.rows ?? [];

  const exportToCSV = () => {
    const headers = ["Date", "Recipient", "Email", "Subject", "Status", "Error"];
    const csvRows = rows.map((row) => [
      formatSentAt(row.sentAt),
      row.recipientName || "",
      row.toEmail,
      row.subject || "",
      row.status,
      row.error || "",
    ]);

    const csvContent = [headers, ...csvRows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `email-log-${filters.startDate || "all"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isAuthenticated) return null;

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6">
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
            <h1 className="text-xl sm:text-2xl font-bold">Email Log</h1>
            <p className="text-sm text-muted-foreground">
              Every notification Aquanav attempted to send, and what happened
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
            data-testid="button-toggle-email-log-filters"
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
          <Button
            variant="outline"
            onClick={exportToCSV}
            disabled={rows.length === 0}
            className="gap-2"
            data-testid="button-export-email-log"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="log-start">From</Label>
                <Input
                  id="log-start"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, startDate: e.target.value }))
                  }
                  data-testid="input-email-log-start"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="log-end">To</Label>
                <Input
                  id="log-end"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, endDate: e.target.value }))
                  }
                  data-testid="input-email-log-end"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={filters.status}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger data-testid="select-email-log-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="log-search">Search</Label>
                <Input
                  id="log-search"
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, search: e.target.value }))
                  }
                  placeholder="Name, email or subject"
                  data-testid="input-email-log-search"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardContent className="p-4 flex flex-wrap items-center gap-4 text-sm">
          <span className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{data?.counts.total ?? 0}</span> total
          </span>
          <span className="text-green-700 dark:text-green-400">
            <span className="font-semibold">{data?.counts.sent ?? 0}</span> sent
          </span>
          <span className="text-destructive">
            <span className="font-semibold">{data?.counts.failed ?? 0}</span> failed
          </span>
          {rows.length === 500 && (
            <span className="text-xs text-muted-foreground">
              showing the 500 most recent — narrow the dates to see more
            </span>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Loading email log…
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="p-8 text-center text-destructive">
            {(error as Error)?.message || "Failed to load email log"}
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Mail className="h-8 w-8 mx-auto mb-3 opacity-50" />
            No emails match these filters. Nothing is sent until Microsoft 365 is
            configured under Settings → Email.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receiver</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Body</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {formatSentAt(row.sentAt)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium">
                          {row.recipientName || "—"}
                        </div>
                        <div className="text-xs text-muted-foreground break-all">
                          {row.toEmail}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {row.subject || "—"}
                        {row.template && (
                          <div className="text-xs text-muted-foreground">
                            {row.template}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewing(row)}
                          disabled={!row.bodyHtml}
                          data-testid={`button-view-email-body-${row.id}`}
                        >
                          View
                        </Button>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {row.status === "sent" ? (
                          <Badge variant="secondary" className="text-xs">Sent</Badge>
                        ) : (
                          <div>
                            <Badge variant="destructive" className="text-xs">Failed</Badge>
                            {row.error && (
                              <div
                                className="text-xs text-muted-foreground mt-1 max-w-[280px] break-words"
                                title={row.error}
                              >
                                {row.error.slice(0, 120)}
                                {row.error.length > 120 ? "…" : ""}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.subject || "Email"}</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground mb-3">
            To {viewing?.recipientName ? `${viewing.recipientName} · ` : ""}
            {viewing?.toEmail} · {viewing ? formatSentAt(viewing.sentAt) : ""}
          </div>
          {/* Sanitised on the way in even though these bodies are generated by
              our own templates, which escape every interpolated value. The log
              is the one place stored HTML is re-rendered in the app, so it
              should not be the one place that trusts it. */}
          <div
            className="border rounded-md p-4 bg-white dark:bg-gray-950 overflow-x-auto"
            dangerouslySetInnerHTML={{
              __html: sanitize(viewing?.bodyHtml || ""),
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
