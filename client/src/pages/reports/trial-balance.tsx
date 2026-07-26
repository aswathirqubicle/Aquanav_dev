import { formatDisplayDate } from "@/lib/utils";

import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Calendar,
  Filter,
  Download,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Scale,
  FileText,
} from "lucide-react";

interface TrialBalanceAccount {
  accountCode: string | null;
  accountName: string;
  accountType: string | null;
  accountCategory: string | null;
  inChart: boolean;
  totalDebit: string;
  totalCredit: string;
  debitBalance: string;
  creditBalance: string;
}

interface TrialBalanceTotals {
  totalDebit: string;
  totalCredit: string;
  debitBalance: string;
  creditBalance: string;
  difference: string;
  balanced: boolean;
}

interface TrialBalanceResponse {
  mode: "as_at" | "movement";
  asOfDate: string;
  startDate: string | null;
  accounts: TrialBalanceAccount[];
  totals: TrialBalanceTotals;
  // Names of ledger accounts with no chart_of_accounts match.
  unmatchedAccounts: string[];
}

interface CompanyInfo {
  id: number;
  name: string;
  financialYearStartDay: number;
  financialYearStartMonth: number;
  financialYearEndDay: number;
  financialYearEndMonth: number;
}

const toISODate = (date: Date) => date.toISOString().split("T")[0];

export default function TrialBalanceReport() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const [showFilters, setShowFilters] = useState(false);

  // A trial balance is cumulative by default — that is what the term means.
  // Period movement is the opt-in, and the heading below always states which of
  // the two is on screen.
  const [filters, setFilters] = useState({
    mode: "as_at" as "as_at" | "movement",
    period: "current_fy" as string,
    startDate: "",
    asOfDate: toISODate(new Date()),
    includeZero: false,
  });

  const { data: companyInfo } = useQuery<CompanyInfo>({
    queryKey: ["/api/company"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    } else if (user?.role !== "admin" && user?.role !== "finance") {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user, setLocation]);

  const getFYDates = (fyStartMonth: number, fyStartDay: number, fyEndMonth: number, fyEndDay: number) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-indexed
    const currentDay = now.getDate();

    let fyStartYear = currentYear;
    if (currentMonth < fyStartMonth || (currentMonth === fyStartMonth && currentDay < fyStartDay)) {
      fyStartYear = currentYear - 1;
    }

    let fyEndYear = fyStartYear;
    if (fyEndMonth < fyStartMonth) {
      fyEndYear = fyStartYear + 1;
    }

    return {
      startDate: `${fyStartYear}-${String(fyStartMonth).padStart(2, "0")}-${String(fyStartDay).padStart(2, "0")}`,
      endDate: `${fyEndYear}-${String(fyEndMonth).padStart(2, "0")}-${String(fyEndDay).padStart(2, "0")}`,
    };
  };

  // Period presets only drive movement mode — in as-at mode there is no start
  // date to derive, and overwriting the as-at date from a preset would silently
  // move the balance date the user picked.
  useEffect(() => {
    if (filters.mode !== "movement" || filters.period === "custom") return;

    const fyStartMonth = companyInfo?.financialYearStartMonth || 1;
    const fyStartDay = companyInfo?.financialYearStartDay || 1;
    const fyEndMonth = companyInfo?.financialYearEndMonth || 12;
    const fyEndDay = companyInfo?.financialYearEndDay || 31;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    let startDate = "";
    let endDate = "";

    switch (filters.period) {
      case "current_fy": {
        const fyDates = getFYDates(fyStartMonth, fyStartDay, fyEndMonth, fyEndDay);
        startDate = fyDates.startDate;
        endDate = fyDates.endDate;
        break;
      }
      case "previous_fy": {
        const currentFY = getFYDates(fyStartMonth, fyStartDay, fyEndMonth, fyEndDay);
        const prevFyStartYear = parseInt(currentFY.startDate.substring(0, 4)) - 1;
        const prevFyEndYear = parseInt(currentFY.endDate.substring(0, 4)) - 1;
        startDate = `${prevFyStartYear}-${String(fyStartMonth).padStart(2, "0")}-${String(fyStartDay).padStart(2, "0")}`;
        endDate = `${prevFyEndYear}-${String(fyEndMonth).padStart(2, "0")}-${String(fyEndDay).padStart(2, "0")}`;
        break;
      }
      case "current_month": {
        startDate = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
        const lastDay = new Date(currentYear, currentMonth, 0).getDate();
        endDate = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${lastDay}`;
        break;
      }
      case "current_quarter": {
        const quarterStart = Math.floor((currentMonth - 1) / 3) * 3 + 1;
        const quarterEnd = quarterStart + 2;
        startDate = `${currentYear}-${String(quarterStart).padStart(2, "0")}-01`;
        const lastDayOfQuarter = new Date(currentYear, quarterEnd, 0).getDate();
        endDate = `${currentYear}-${String(quarterEnd).padStart(2, "0")}-${lastDayOfQuarter}`;
        break;
      }
      default:
        return;
    }

    if (startDate && endDate) {
      setFilters(prev => ({ ...prev, startDate, asOfDate: endDate }));
    }
  }, [filters.mode, filters.period, companyInfo]);

  const hasActiveFilters =
    filters.mode !== "as_at" || filters.includeZero || filters.asOfDate !== toISODate(new Date());

  const { data, isLoading, isError, error } = useQuery<TrialBalanceResponse>({
    queryKey: ["/api/reports/trial-balance", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("asOfDate", filters.asOfDate);
      // Sending startDate at all is what switches the server to movement mode,
      // so it must be withheld entirely in as-at mode.
      if (filters.mode === "movement" && filters.startDate) {
        params.append("startDate", filters.startDate);
      }
      params.append("includeZero", filters.includeZero ? "true" : "false");

      const response = await apiRequest(`/api/reports/trial-balance?${params}`);
      if (!response.ok) throw new Error("Failed to fetch trial balance");
      return response.json();
    },
    enabled:
      isAuthenticated &&
      !!filters.asOfDate &&
      (filters.mode === "as_at" || !!filters.startDate),
  });

  const accounts = Array.isArray(data?.accounts) ? data.accounts : [];
  const totals = data?.totals;
  const unmatchedAccounts = Array.isArray(data?.unmatchedAccounts) ? data.unmatchedAccounts : [];
  const rowsNotInChart = accounts.filter(a => a.inChart === false);

  // The mode the figures on screen were actually computed under. Reading it off
  // the response rather than off local state is deliberate: while a mode change
  // is in flight the previous response is still rendered, and a heading that
  // ran ahead of the data would label a period movement as a balance.
  const activeMode = data?.mode ?? filters.mode;
  const activeAsOfDate = data?.asOfDate ?? filters.asOfDate;
  const activeStartDate = data?.startDate ?? filters.startDate;

  const periodStatement =
    activeMode === "movement"
      ? `Movement from ${formatDisplayDate(activeStartDate)} to ${formatDisplayDate(activeAsOfDate)}`
      : `Balances as at ${formatDisplayDate(activeAsOfDate)}`;

  const periodExplanation =
    activeMode === "movement"
      ? "Debits and credits posted within this range only — these are period movements, not account balances."
      : "Every posting up to and including this date — the cumulative balance of each account.";

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "AED",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(parseFloat(amount?.toString() || "0"));
  };

  const handleAsOfDateChange = (value: string) => {
    if (!value) return;
    if (filters.mode === "movement" && filters.startDate && value < filters.startDate) {
      toast({
        variant: "destructive",
        title: "Invalid date range",
        description: "The end date cannot be earlier than the start date.",
      });
      return;
    }
    setFilters(prev => ({ ...prev, asOfDate: value, period: prev.mode === "movement" ? "custom" : prev.period }));
  };

  const handleStartDateChange = (value: string) => {
    if (!value) return;
    if (filters.asOfDate && value > filters.asOfDate) {
      toast({
        variant: "destructive",
        title: "Invalid date range",
        description: "The start date cannot be later than the end date.",
      });
      return;
    }
    setFilters(prev => ({ ...prev, startDate: value, period: "custom" }));
  };

  const exportToCSV = () => {
    const headers = [
      "Account Code",
      "Account Name",
      "Type",
      "Category",
      "In Chart of Accounts",
      "Total Debit",
      "Total Credit",
      "Debit Balance",
      "Credit Balance",
    ];

    const rows = accounts.map(account => [
      account.accountCode || "-",
      account.accountName,
      account.accountType || "-",
      account.accountCategory || "-",
      account.inChart ? "Yes" : "No",
      account.totalDebit,
      account.totalCredit,
      account.debitBalance,
      account.creditBalance,
    ]);

    if (totals) {
      rows.push([
        "",
        "TOTAL",
        "",
        "",
        "",
        totals.totalDebit,
        totals.totalCredit,
        totals.debitBalance,
        totals.creditBalance,
      ]);
      rows.push([
        "",
        totals.balanced ? "BALANCED" : "OUT OF BALANCE",
        "",
        "",
        "",
        "",
        "",
        "Difference",
        totals.difference,
      ]);
    }

    const csvContent = [[periodStatement], [], headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trial-balance-${activeAsOfDate}.csv`;
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
          <Button variant="ghost" size="icon" onClick={() => setLocation("/reports")} className="mt-1">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Trial Balance</h1>
            <p className="text-sm text-muted-foreground">
              Every ledger account with its debit and credit totals, proving the books balance
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-2" />
            {showFilters ? "Hide Filters" : "Show Filters"}
            {hasActiveFilters && <span className="ml-2 bg-primary-foreground text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs">!</span>}
          </Button>
          <Button onClick={exportToCSV} variant="outline" size="sm" disabled={accounts.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Inline Filters */}
      {showFilters && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Basis</Label>
                <Select
                  value={filters.mode}
                  onValueChange={(value) =>
                    setFilters(prev => ({ ...prev, mode: value as "as_at" | "movement" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Basis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="as_at">Balances as at a date</SelectItem>
                    <SelectItem value="movement">Movement over a period</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filters.mode === "movement" && (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Period</Label>
                    <Select
                      value={filters.period}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, period: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Period" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="current_fy">Current Financial Year</SelectItem>
                        <SelectItem value="previous_fy">Previous Financial Year</SelectItem>
                        <SelectItem value="current_month">Current Month</SelectItem>
                        <SelectItem value="current_quarter">Current Quarter</SelectItem>
                        <SelectItem value="custom">Custom Date Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">From</Label>
                    <Input
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  {filters.mode === "movement" ? "To" : "As at"}
                </Label>
                <Input
                  type="date"
                  value={filters.asOfDate}
                  onChange={(e) => handleAsOfDateChange(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 pb-1">
                <Switch
                  id="include-zero"
                  checked={filters.includeZero}
                  onCheckedChange={(checked) => setFilters(prev => ({ ...prev, includeZero: checked }))}
                />
                <Label htmlFor="include-zero" className="text-sm cursor-pointer">
                  Show zero-balance accounts
                </Label>
              </div>
            </div>

            <div className="flex justify-between items-center mt-4 pt-3 border-t">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{periodStatement}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setFilters({
                    mode: "as_at",
                    period: "current_fy",
                    startDate: "",
                    asOfDate: toISODate(new Date()),
                    includeZero: false,
                  })
                }
                className="text-muted-foreground"
              >
                Reset Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* What is on screen, in plain words — a movement must never sit under a
          heading that reads like a balance. */}
      <Card className="mb-6">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <span className="text-base sm:text-lg font-semibold">{periodStatement}</span>
          </div>
          <span className="text-xs sm:text-sm text-muted-foreground">{periodExplanation}</span>
        </CardContent>
      </Card>

      {/* Unmatched accounts — ledger rows whose account is not in the chart of
          accounts. Every other report inner-joins the chart and drops these
          silently, so a non-empty list here means figures elsewhere are short. */}
      {(unmatchedAccounts.length > 0 || rowsNotInChart.length > 0) && (
        <Card className="mb-6 border-amber-500 bg-amber-50 dark:bg-amber-900/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-5 w-5" />
              Accounts missing from the chart of accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-800 dark:text-amber-300 mb-2">
              These ledger accounts have postings but no matching chart-of-accounts entry. Other
              reports drop them without warning, so their totals will not agree with this one until
              the accounts are added.
            </p>
            <ul className="list-disc list-inside text-sm text-amber-900 dark:text-amber-200">
              {unmatchedAccounts.map((accountName, index) => (
                <li key={`unmatched-${index}`}>{accountName}</li>
              ))}
              {unmatchedAccounts.length === 0 &&
                rowsNotInChart.map((account) => (
                  <li key={`notinchart-${account.accountName}`}>{account.accountName}</li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {isError && (
        <Card className="mb-6 border-red-500 bg-red-50 dark:bg-red-900/20">
          <CardContent className="p-4 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                Could not load the trial balance
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">
                {(error as Error)?.message || "Please try again."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading trial balance...</p>
          </div>
        </div>
      ) : (
        <>
          {/* The balanced indicator is the whole point of the report. */}
          {totals && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Debit</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold break-all">{formatCurrency(totals.totalDebit)}</div>
                  <p className="text-xs text-muted-foreground">{accounts.length} accounts</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Credit</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold break-all">{formatCurrency(totals.totalCredit)}</div>
                  <p className="text-xs text-muted-foreground">{accounts.length} accounts</p>
                </CardContent>
              </Card>

              <Card className={totals.balanced ? "border-green-500" : "border-red-500 bg-red-50 dark:bg-red-900/20"}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Difference</CardTitle>
                  {totals.balanced ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  )}
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold break-all ${totals.balanced ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(totals.difference)}
                  </div>
                  <p className={`text-xs font-semibold ${totals.balanced ? "text-green-600" : "text-red-600"}`}>
                    {totals.balanced
                      ? "Balanced — debits equal credits"
                      : "OUT OF BALANCE — the ledger does not reconcile"}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {totals && !totals.balanced && (
            <Card className="mb-6 border-red-500 bg-red-50 dark:bg-red-900/20">
              <CardContent className="p-4 flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                    The trial balance does not balance
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    Total debits {formatCurrency(totals.totalDebit)} against total credits{" "}
                    {formatCurrency(totals.totalCredit)}, a difference of{" "}
                    {formatCurrency(totals.difference)}. Every figure derived from the ledger —
                    profit &amp; loss, payables and receivables, the balance sheet — should be
                    treated as unreliable until this is resolved.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Account Balances
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {periodStatement}
                {!filters.includeZero && " · zero-balance accounts hidden"}
              </p>
            </CardHeader>
            <CardContent>
              {accounts.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No ledger accounts found for this selection</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Account Code</th>
                        <th className="text-left p-2">Account Name</th>
                        <th className="text-left p-2">Type</th>
                        <th className="text-left p-2">Category</th>
                        <th className="text-right p-2">Total Debit</th>
                        <th className="text-right p-2">Total Credit</th>
                        <th className="text-right p-2">Debit Balance</th>
                        <th className="text-right p-2">Credit Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((account, index) => (
                        <tr
                          key={`${account.accountCode || "no-code"}-${account.accountName}-${index}`}
                          className={
                            account.inChart
                              ? "border-b hover:bg-gray-50 dark:hover:bg-gray-800"
                              : "border-b bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                          }
                        >
                          <td className="p-2">{account.accountCode || "-"}</td>
                          <td className="p-2 font-medium">
                            {account.accountName}
                            {!account.inChart && (
                              <span className="ml-2 text-xs text-amber-700 dark:text-amber-300">
                                not in chart of accounts
                              </span>
                            )}
                          </td>
                          <td className="p-2 capitalize">{account.accountType?.replace(/_/g, " ") || "-"}</td>
                          <td className="p-2 capitalize">{account.accountCategory?.replace(/_/g, " ") || "-"}</td>
                          <td className="p-2 text-right">{formatCurrency(account.totalDebit)}</td>
                          <td className="p-2 text-right">{formatCurrency(account.totalCredit)}</td>
                          <td className="p-2 text-right font-medium">{formatCurrency(account.debitBalance)}</td>
                          <td className="p-2 text-right font-medium">{formatCurrency(account.creditBalance)}</td>
                        </tr>
                      ))}
                      {totals && (
                        <tr className="border-t-2 bg-gray-50 dark:bg-gray-800 font-bold">
                          <td className="p-2"></td>
                          <td className="p-2">Total</td>
                          <td className="p-2"></td>
                          <td className="p-2"></td>
                          <td className="p-2 text-right">{formatCurrency(totals.totalDebit)}</td>
                          <td className="p-2 text-right">{formatCurrency(totals.totalCredit)}</td>
                          <td className="p-2 text-right">{formatCurrency(totals.debitBalance)}</td>
                          <td className="p-2 text-right">{formatCurrency(totals.creditBalance)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
