import { formatDisplayDate } from "@/lib/utils";

import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Calendar,
  Download,
  ArrowLeft,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Scale,
  Wallet,
  Landmark,
  PiggyBank,
} from "lucide-react";

interface BalanceSheetAccount {
  // Nullable server-side: an account row can exist in the chart of accounts
  // without a code, so nothing may key or print off this field unguarded.
  accountCode: string | null;
  accountName: string;
  balance: string;
}

interface BalanceSheetGroup {
  category: string;
  accounts: BalanceSheetAccount[];
  subtotal: string;
}

interface BalanceSheetSection {
  groups: BalanceSheetGroup[];
  total: string;
}

interface CurrentYearEarnings {
  amount: string;
  revenue: string;
  expenses: string;
  derived: boolean;
}

interface BalanceSheetData {
  asOfDate: string;
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection & { currentYearEarnings?: CurrentYearEarnings | null };
  equation: {
    assets: string;
    liabilitiesPlusEquity: string;
    difference: string;
    balanced: boolean;
  };
  unmatchedAccounts?: string[];
}

interface CompanyInfo {
  id: number;
  name: string;
  financialYearStartDay: number;
  financialYearStartMonth: number;
  financialYearEndDay: number;
  financialYearEndMonth: number;
}

// The chart of accounts stores categories as snake_case keys. Anything not
// listed here still has to render — a new category added to the chart must show
// up as a readable heading rather than silently dropping the group or printing
// a raw key, so unknown values fall through to a title-cased label.
const CATEGORY_LABELS: Record<string, string> = {
  current_assets: "Current Assets",
  fixed_assets: "Fixed Assets",
  current_liabilities: "Current Liabilities",
  long_term_liabilities: "Long-Term Liabilities",
  shareholders_equity: "Shareholders' Equity",
};

const categoryLabel = (category: string) => {
  if (CATEGORY_LABELS[category]) return CATEGORY_LABELS[category];
  if (!category) return "Uncategorised";
  return category
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const todayISO = () => new Date().toISOString().split("T")[0];

export default function BalanceSheetReport() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();

  // A balance sheet is cumulative to a single point in time — there is no
  // period, only an as-at date, so this page carries one date instead of the
  // start/end pair the other financial reports use.
  const [periodType, setPeriodType] = useState<"today" | "fy_end" | "previous_fy_end" | "month_end" | "custom">("today");
  const [asOfDate, setAsOfDate] = useState<string>(todayISO());

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

  useEffect(() => {
    if (periodType === "custom") return;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    const fyStartMonth = companyInfo?.financialYearStartMonth || 1;
    const fyStartDay = companyInfo?.financialYearStartDay || 1;
    const fyEndMonth = companyInfo?.financialYearEndMonth || 12;
    const fyEndDay = companyInfo?.financialYearEndDay || 31;

    // Which calendar year the current financial year began in
    let fyStartYear = currentYear;
    if (currentMonth < fyStartMonth || (currentMonth === fyStartMonth && currentDay < fyStartDay)) {
      fyStartYear = currentYear - 1;
    }
    const fyEndYear = fyEndMonth < fyStartMonth ? fyStartYear + 1 : fyStartYear;
    const pad = (value: number) => String(value).padStart(2, "0");

    if (periodType === "today") {
      setAsOfDate(todayISO());
    } else if (periodType === "fy_end") {
      setAsOfDate(`${fyEndYear}-${pad(fyEndMonth)}-${pad(fyEndDay)}`);
    } else if (periodType === "previous_fy_end") {
      setAsOfDate(`${fyEndYear - 1}-${pad(fyEndMonth)}-${pad(fyEndDay)}`);
    } else if (periodType === "month_end") {
      const lastDay = new Date(currentYear, currentMonth, 0).getDate();
      setAsOfDate(`${currentYear}-${pad(currentMonth)}-${pad(lastDay)}`);
    }
  }, [periodType, companyInfo]);

  const { data: balanceSheet, isLoading, isError, error } = useQuery<BalanceSheetData>({
    queryKey: ["/api/reports/balance-sheet", asOfDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (asOfDate) params.append("asOfDate", asOfDate);

      const response = await apiRequest(`/api/reports/balance-sheet?${params}`);
      if (!response.ok) throw new Error("Failed to fetch balance sheet");
      return response.json();
    },
    enabled: isAuthenticated && !!asOfDate,
  });

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "AED",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(parseFloat(amount?.toString() || "0"));
  };

  // Accounting convention: negatives read as parentheses, not a stray minus
  // sign that is easy to miss at the end of a column of figures.
  const formatSigned = (amount: string | number) => {
    const value = parseFloat(amount?.toString() || "0");
    return value < 0 ? `(${formatCurrency(Math.abs(value))})` : formatCurrency(value);
  };

  const signedClass = (amount: string | number) =>
    parseFloat(amount?.toString() || "0") < 0 ? "text-red-600" : "";

  const handleDateChange = (value: string) => {
    if (!value) {
      toast({
        variant: "destructive",
        title: "As-at date required",
        description: "A balance sheet is always drawn up to a specific date.",
      });
      return;
    }
    setPeriodType("custom");
    setAsOfDate(value);
  };

  const currentYearEarnings = balanceSheet?.equity?.currentYearEarnings || null;
  const unmatchedAccounts = balanceSheet?.unmatchedAccounts || [];
  const isBalanced = balanceSheet?.equation?.balanced === true;

  const sections: { key: "assets" | "liabilities" | "equity"; title: string; section?: BalanceSheetSection }[] = [
    { key: "assets", title: "Assets", section: balanceSheet?.assets },
    { key: "liabilities", title: "Liabilities", section: balanceSheet?.liabilities },
    { key: "equity", title: "Equity", section: balanceSheet?.equity },
  ];

  const exportToCSV = () => {
    if (!balanceSheet) {
      toast({
        variant: "destructive",
        title: "Nothing to export",
        description: "Load the balance sheet before exporting.",
      });
      return;
    }

    const headers = ["Section", "Category", "Account Code", "Account Name", "Balance (AED)"];
    const rows: string[][] = [];

    sections.forEach(({ key, title, section }) => {
      (section?.groups || []).forEach(group => {
        group.accounts.forEach(account => {
          rows.push([title, categoryLabel(group.category), account.accountCode || "", account.accountName, parseFloat(account.balance || "0").toFixed(2)]);
        });
        rows.push([title, categoryLabel(group.category), "", "Subtotal", parseFloat(group.subtotal || "0").toFixed(2)]);
      });

      // The derived earnings line belongs to Equity but is not a posted
      // account, so it is exported with that stated rather than as an account.
      if (key === "equity" && currentYearEarnings) {
        rows.push([
          title,
          "Current Year Earnings",
          "",
          "Current Year Earnings (derived - not a posted balance)",
          parseFloat(currentYearEarnings.amount || "0").toFixed(2),
        ]);
      }

      rows.push([title, "", "", `Total ${title}`, parseFloat(section?.total || "0").toFixed(2)]);
    });

    rows.push(["Equation", "", "", "Assets", parseFloat(balanceSheet.equation.assets || "0").toFixed(2)]);
    rows.push(["Equation", "", "", "Liabilities + Equity", parseFloat(balanceSheet.equation.liabilitiesPlusEquity || "0").toFixed(2)]);
    rows.push(["Equation", "", "", "Difference", parseFloat(balanceSheet.equation.difference || "0").toFixed(2)]);
    rows.push(["Equation", "", "", "Balanced", balanceSheet.equation.balanced ? "Yes" : "No"]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `balance-sheet-${balanceSheet.asOfDate || asOfDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const sectionIcon = (key: string) => {
    if (key === "assets") return <Wallet className="h-5 w-5 text-blue-500" />;
    if (key === "liabilities") return <Landmark className="h-5 w-5 text-orange-500" />;
    return <PiggyBank className="h-5 w-5 text-purple-500" />;
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
            <h1 className="text-xl sm:text-2xl font-bold">Balance Sheet</h1>
            <p className="text-sm text-muted-foreground">
              Cumulative statement of what the company owns, owes and retains
            </p>
            <p className="text-sm font-medium mt-1 flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              As at {asOfDate ? formatDisplayDate(balanceSheet?.asOfDate || asOfDate) : "-"}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button onClick={exportToCSV} variant="outline" size="sm" disabled={!balanceSheet}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* As-at date controls — kept visible rather than behind a filter toggle,
          because the date is what the whole statement means. */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="w-full sm:w-[220px]">
              <Label className="text-xs text-muted-foreground mb-1.5 block">As At</Label>
              <Select value={periodType} onValueChange={(value) => setPeriodType(value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="month_end">End of Current Month</SelectItem>
                  <SelectItem value="fy_end">End of Current Financial Year</SelectItem>
                  <SelectItem value="previous_fy_end">End of Previous Financial Year</SelectItem>
                  <SelectItem value="custom">Custom Date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-[220px]">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Date</Label>
              <Input
                type="date"
                value={asOfDate}
                onChange={(e) => handleDateChange(e.target.value)}
              />
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPeriodType("today")}
              className="text-muted-foreground"
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Unmatched accounts guard — ledger rows whose account is missing from
          the chart of accounts are excluded from every section above, so the
          statement would quietly under-report without this warning. */}
      {unmatchedAccounts.length > 0 && (
        <Card className="mb-6 border-red-300 bg-red-50 dark:bg-red-900/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-700 dark:text-red-400">
                  {unmatchedAccounts.length} ledger account{unmatchedAccounts.length === 1 ? "" : "s"} not in the chart of accounts
                </p>
                <p className="text-sm text-red-700/80 dark:text-red-400/80 mt-1">
                  These entries are excluded from the figures below. They must be mapped before this statement can be relied on.
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {unmatchedAccounts.map((account) => (
                    <Badge key={account} variant="destructive">{account}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading balance sheet...</p>
          </div>
        </div>
      )}

      {isError && !isLoading && (
        <Card className="mb-6">
          <CardContent className="text-center py-12">
            <AlertCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {error instanceof Error ? error.message : "Failed to load the balance sheet"}
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && balanceSheet && (
        <>
          {/* The accounting equation, stated outright */}
          <Card className={`mb-6 ${isBalanced ? "border-green-300 bg-green-50 dark:bg-green-900/20" : "border-red-400 bg-red-50 dark:bg-red-900/20"}`}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Scale className={`h-5 w-5 ${isBalanced ? "text-green-600" : "text-red-600"}`} />
                Assets = Liabilities + Equity
                {isBalanced ? (
                  <Badge className="bg-green-600 hover:bg-green-700 ml-2">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Balanced
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="ml-2">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Out of balance
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Assets</p>
                  <p className="text-xl font-bold break-all">{formatSigned(balanceSheet.equation.assets)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Liabilities + Equity</p>
                  <p className="text-xl font-bold break-all">{formatSigned(balanceSheet.equation.liabilitiesPlusEquity)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Difference</p>
                  <p className={`text-xl font-bold break-all ${isBalanced ? "text-green-600" : "text-red-600"}`}>
                    {formatSigned(balanceSheet.equation.difference)}
                  </p>
                </div>
              </div>
              {!isBalanced && (
                <p className="text-sm font-medium text-red-700 dark:text-red-400 mt-4 text-center">
                  The two sides do not agree. Do not rely on this statement until the difference is explained.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Section totals */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            {sections.map(({ key, title, section }) => (
              <Card key={key}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total {title}</CardTitle>
                  {sectionIcon(key)}
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold break-all ${signedClass(section?.total || "0")}`}>
                    {formatSigned(section?.total || "0")}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {(section?.groups || []).length} group{(section?.groups || []).length === 1 ? "" : "s"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Statement */}
          <div className="space-y-6">
            {sections.map(({ key, title, section }) => (
              <Card key={key}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {sectionIcon(key)}
                    {title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(section?.groups || []).length === 0 && !(key === "equity" && currentYearEarnings) ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No {title.toLowerCase()} balances as at this date
                    </p>
                  ) : (
                    <div className="space-y-6">
                      {(section?.groups || []).map((group) => (
                        <div key={`${key}-${group.category}`}>
                          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                            {categoryLabel(group.category)}
                          </h3>
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                              <tbody>
                                {group.accounts.map((account) => (
                                  <tr key={`${group.category}-${account.accountCode || ""}-${account.accountName}`} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <td className="p-2 text-xs text-muted-foreground w-24">{account.accountCode || "-"}</td>
                                    <td className="p-2">{account.accountName}</td>
                                    <td className={`p-2 text-right font-medium whitespace-nowrap ${signedClass(account.balance)}`}>
                                      {formatSigned(account.balance)}
                                    </td>
                                  </tr>
                                ))}
                                {group.accounts.length === 0 && (
                                  <tr className="border-b">
                                    <td className="p-2 text-sm text-muted-foreground" colSpan={3}>No accounts in this group</td>
                                  </tr>
                                )}
                                <tr className="border-b-2 font-semibold">
                                  <td className="p-2"></td>
                                  <td className="p-2">Total {categoryLabel(group.category)}</td>
                                  <td className={`p-2 text-right whitespace-nowrap ${signedClass(group.subtotal)}`}>
                                    {formatSigned(group.subtotal)}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}

                      {/* Current year earnings. This system has no period close,
                          so retained earnings are never posted and ledger equity
                          is genuinely nil — the figure below is computed on the
                          fly from revenue less expenses purely so the equation
                          balances. It must never be read as a posted balance. */}
                      {key === "equity" && currentYearEarnings && (
                        <div className="rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold">Current Year Earnings</span>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400 cursor-help">
                                      <Info className="h-3 w-3 mr-1" />
                                      Derived — not a posted balance
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p>
                                      There is no period close in this system, so profit is never posted to a
                                      retained earnings account. This line is calculated for the statement only,
                                      as total revenue less total expenses up to the as-at date.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-1">
                                Calculated as revenue {formatSigned(currentYearEarnings.revenue)} less expenses{" "}
                                {formatSigned(currentYearEarnings.expenses)}. No journal entry exists for this amount.
                              </p>
                            </div>
                            <div className={`text-lg font-bold whitespace-nowrap ${parseFloat(currentYearEarnings.amount || "0") < 0 ? "text-red-600" : "text-green-600"}`}>
                              {formatSigned(currentYearEarnings.amount)}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-3 border-t-2 font-bold">
                        <span>Total {title}</span>
                        <span className={`whitespace-nowrap ${signedClass(section?.total || "0")}`}>
                          {formatSigned(section?.total || "0")}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Scope note — the missing inventory line is a deliberate decision
              (D6, inventory on the ledger deferred), not a gap in the report. */}
          <Card className="mt-6">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    <span className="font-medium">Inventory is not shown.</span> Stock movements are tracked in the
                    inventory module but are not yet posted to the general ledger, so no inventory asset balance
                    appears here. This is a deliberate scope decision, not a missing figure.
                  </p>
                  <p>
                    Current Year Earnings is derived for presentation only. All figures are in AED and are cumulative
                    to {formatDisplayDate(balanceSheet.asOfDate || asOfDate)}.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
