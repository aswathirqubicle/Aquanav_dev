import { formatDisplayDate } from "@/lib/utils";

import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { 
  Calendar, 
  Download, 
  DollarSign,
  TrendingUp, 
  TrendingDown,
  BarChart3,
  PieChart,
  ArrowLeft,
  FileText,
  Filter
} from "lucide-react";
import { Company } from "@shared/schema";

interface PLEntry {
  id: number;
  entryType: string;
  referenceType: string;
  referenceId: number | null;
  accountName: string;
  accountType: string;
  accountCategory: string;
  description: string;
  debitAmount: string;
  creditAmount: string;
  entityId: number | null;
  entityName: string | null;
  projectId: number | null;
  projectTitle: string | null;
  invoiceNumber: string | null;
  transactionDate: string;
  status: string;
  notes: string | null;
}

interface Project {
  id: number;
  title: string;
  startDate?: string | null;
  actualEndDate?: string | null;
  status?: string | null;
}

export default function ProfitLossReport() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    projectId: undefined as number | undefined,
    periodType: "financial_year" as "monthly" | "quarterly" | "yearly" | "financial_year" | "previous_fy" | "custom",
  });

  const hasActiveFilters = filters.projectId !== undefined || filters.periodType !== "financial_year";

  const { data: company } = useQuery<Company>({
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

  const getFinancialYearDates = () => {
    const now = new Date();
    const fyStartMonth = (company?.financialYearStartMonth || 1) - 1;
    const fyStartDay = company?.financialYearStartDay || 1;
    const fyEndMonth = (company?.financialYearEndMonth || 12) - 1;
    const fyEndDay = company?.financialYearEndDay || 31;

    let fyStartYear = now.getFullYear();
    if (now.getMonth() < fyStartMonth || (now.getMonth() === fyStartMonth && now.getDate() < fyStartDay)) {
      fyStartYear -= 1;
    }

    const fyStart = new Date(fyStartYear, fyStartMonth, fyStartDay);
    const fyEnd = new Date(fyStartMonth > fyEndMonth ? fyStartYear + 1 : fyStartYear, fyEndMonth, fyEndDay);
    return { fyStart, fyEnd };
  };

  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    if (filters.periodType === "financial_year") {
      const { fyStart, fyEnd } = getFinancialYearDates();
      setFilters(prev => ({
        ...prev,
        startDate: fyStart.toISOString().split('T')[0],
        endDate: fyEnd.toISOString().split('T')[0]
      }));
    } else if (filters.periodType === "previous_fy") {
      const fyStartMonth = (company?.financialYearStartMonth || 1) - 1;
      const fyStartDay = company?.financialYearStartDay || 1;
      const fyEndMonth = (company?.financialYearEndMonth || 12) - 1;
      const fyEndDay = company?.financialYearEndDay || 31;

      let fyStartYear = now.getFullYear();
      if (now.getMonth() < fyStartMonth || (now.getMonth() === fyStartMonth && now.getDate() < fyStartDay)) {
        fyStartYear -= 1;
      }
      fyStartYear -= 1;

      const prevFyStart = new Date(fyStartYear, fyStartMonth, fyStartDay);
      const prevFyEnd = new Date(fyStartMonth > fyEndMonth ? fyStartYear + 1 : fyStartYear, fyEndMonth, fyEndDay);

      setFilters(prev => ({
        ...prev,
        startDate: prevFyStart.toISOString().split('T')[0],
        endDate: prevFyEnd.toISOString().split('T')[0]
      }));
    } else if (filters.periodType === "monthly") {
      const startOfMonth = new Date(currentYear, currentMonth, 1);
      const endOfMonth = new Date(currentYear, currentMonth + 1, 0);
      setFilters(prev => ({
        ...prev,
        startDate: startOfMonth.toISOString().split('T')[0],
        endDate: endOfMonth.toISOString().split('T')[0]
      }));
    } else if (filters.periodType === "quarterly") {
      const quarter = Math.floor(currentMonth / 3);
      const startOfQuarter = new Date(currentYear, quarter * 3, 1);
      const endOfQuarter = new Date(currentYear, quarter * 3 + 3, 0);
      setFilters(prev => ({
        ...prev,
        startDate: startOfQuarter.toISOString().split('T')[0],
        endDate: endOfQuarter.toISOString().split('T')[0]
      }));
    } else if (filters.periodType === "yearly") {
      const startOfYear = new Date(currentYear, 0, 1);
      const endOfYear = new Date(currentYear, 11, 31);
      setFilters(prev => ({
        ...prev,
        startDate: startOfYear.toISOString().split('T')[0],
        endDate: endOfYear.toISOString().split('T')[0]
      }));
    }
  }, [filters.periodType, company]);

  // Single unified query — backend joins GL with chart_of_accounts to get only revenue/expense entries
  const { data: plData, isLoading: plLoading } = useQuery<{ entries: PLEntry[] }>({
    queryKey: ["/api/reports/profit-loss-entries", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.projectId) params.append("projectId", filters.projectId.toString());

      const res = await fetch(`/api/reports/profit-loss-entries?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch P&L data");
      return res.json();
    },
    enabled: isAuthenticated && !!filters.startDate && !!filters.endDate,
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: isAuthenticated,
  });

  // Fetch project revenue data from the same source as project details page
  // (invoice payments for revenue, actualCost for expenses — includes payroll, consumables, asset rentals, purchases, reimbursements)
  const projectIds = projects?.map(p => p.id).join(",") || "";
  const { data: projectRevenueData, isLoading: projectRevenueLoading } = useQuery<{
    projectId: number;
    totalRevenue: string;
    totalCost: string;
    profit: string;
  }[]>({
    queryKey: ["/api/projects/revenues", projectIds],
    queryFn: async () => {
      if (!projectIds) return [];
      const res = await fetch(`/api/projects/revenues?projectIds=${projectIds}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch project revenues");
      return res.json();
    },
    enabled: isAuthenticated && !!projectIds,
  });

  const allEntries: PLEntry[] = plData?.entries || [];

  // Split by accountType — backend has already verified these against chart_of_accounts
  const revenueEntries = allEntries.filter(e => e.accountType === "revenue");
  const expenseEntries = allEntries.filter(e => e.accountType === "expense");

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "AED",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(parseFloat(amount?.toString() || "0"));
  };

  // Revenue = sum of (credit - debit) — debits are reversals/credit notes
  // Expense = sum of (debit - credit) — credits are reversals/cancellations
  const totalRevenue = revenueEntries.reduce(
    (sum, e) => sum + parseFloat(e.creditAmount || "0") - parseFloat(e.debitAmount || "0"), 0
  );
  const totalExpenses = expenseEntries.reduce(
    (sum, e) => sum + parseFloat(e.debitAmount || "0") - parseFloat(e.creditAmount || "0"), 0
  );
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0
    ? (netProfit / totalRevenue) * 100
    : totalExpenses > 0 ? -100 : 0;

  // By Account groupings
  const revenueByAccount = revenueEntries.reduce((acc, e) => {
    const key = e.accountName || "Other Revenue";
    acc[key] = (acc[key] || 0) + parseFloat(e.creditAmount || "0") - parseFloat(e.debitAmount || "0");
    return acc;
  }, {} as Record<string, number>);

  const expensesByAccount = expenseEntries.reduce((acc, e) => {
    const key = e.accountName || "Other Expenses";
    acc[key] = (acc[key] || 0) + parseFloat(e.debitAmount || "0") - parseFloat(e.creditAmount || "0");
    return acc;
  }, {} as Record<string, number>);

  // By Project groupings — use the same data source as project details page
  // Revenue = payments received on invoices, Expenses = actualCost (payroll + consumables + asset rentals + purchases + reimbursements)
  const revenueByProject: Record<string, number> = {};
  const expensesByProject: Record<string, number> = {};

  projects?.forEach(project => {
    const projectData = projectRevenueData?.find(d => d.projectId === project.id);
    const revenue = parseFloat(projectData?.totalRevenue || "0");
    const expenses = parseFloat(projectData?.totalCost || "0");
    if (revenue !== 0 || expenses !== 0) {
      revenueByProject[project.title] = revenue;
      expensesByProject[project.title] = expenses;
    }
  });

  // Project P&L — use same data source as project details for consistency
  const filteredProjectPL = projects?.map(project => {
    const projectData = projectRevenueData?.find(d => d.projectId === project.id);
    const revenue = parseFloat(projectData?.totalRevenue || "0");
    const expenses = parseFloat(projectData?.totalCost || "0");
    const profit = revenue - expenses;
    const margin = revenue > 0
      ? (profit / revenue) * 100
      : expenses > 0 ? -100 : 0;

    return {
      ...project,
      revenue,
      expenses,
      profit,
      margin,
    };
  }).filter(p => p.revenue !== 0 || p.expenses !== 0) || [];

  const exportToCSV = () => {
    const headers = ["Account Type", "Account Name", "Category", "Project", "Reference", "Date", "Description", "Debit", "Credit", "Net Amount"];

    const rows = allEntries.map(entry => {
      const netAmount = entry.accountType === "revenue"
        ? parseFloat(entry.creditAmount || "0") - parseFloat(entry.debitAmount || "0")
        : parseFloat(entry.debitAmount || "0") - parseFloat(entry.creditAmount || "0");
      return [
        entry.accountType,
        entry.accountName,
        entry.accountCategory,
        entry.projectTitle || "General",
        entry.invoiceNumber || entry.referenceType || "-",
        formatDisplayDate(entry.transactionDate),
        entry.description,
        entry.debitAmount,
        entry.creditAmount,
        netAmount.toFixed(2),
      ];
    });

    const csvData = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvData], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `profit-loss-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatMargin = (margin: number, revenue: number, expenses: number) => {
    if (revenue === 0 && expenses === 0) return "N/A";
    if (revenue === 0 && expenses > 0) return "Loss";
    return `${margin.toFixed(1)}%`;
  };

  if (!isAuthenticated) return null;

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/reports")} className="mt-1">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Profit & Loss Report</h1>
            <p className="text-sm text-muted-foreground">Financial performance analysis</p>
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
          <Button onClick={exportToCSV} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Inline Filters */}
      {showFilters && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end">
              <div className="flex-1 min-w-0">
                <Label className="text-xs text-muted-foreground mb-1.5 block">Period</Label>
                <Select
                  value={filters.periodType}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, periodType: value as any }))}
                >
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Select Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="financial_year">Current Financial Year</SelectItem>
                    <SelectItem value="previous_fy">Previous Financial Year</SelectItem>
                    <SelectItem value="monthly">This Month</SelectItem>
                    <SelectItem value="quarterly">This Quarter</SelectItem>
                    <SelectItem value="yearly">Calendar Year</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 flex-1">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1.5 block">From</Label>
                  <Input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value, periodType: "custom" }))}
                    className="w-full"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1.5 block">To</Label>
                  <Input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value, periodType: "custom" }))}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <Label className="text-xs text-muted-foreground mb-1.5 block">Project</Label>
                <Select
                  value={filters.projectId?.toString() || "all"}
                  onValueChange={(value) => setFilters(prev => ({ 
                    ...prev, 
                    projectId: value === "all" ? undefined : parseInt(value) 
                  }))}
                >
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projects?.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setFilters({ startDate: "", endDate: "", projectId: undefined, periodType: "financial_year" })}
                className="text-muted-foreground"
              >
                Reset
              </Button>
            </div>

            <div className="mt-3 pt-3 border-t flex flex-wrap gap-2 items-center text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Showing:</span>
              <span className="font-medium">
                {filters.startDate && filters.endDate 
                  ? `${formatDisplayDate(filters.startDate)} - ${formatDisplayDate(filters.endDate)}`
                  : "Select a period"}
              </span>
              {filters.projectId && projects && (
                <>
                  <span className="text-muted-foreground">|</span>
                  <span className="font-medium text-blue-600">
                    {projects.find(p => p.id === filters.projectId)?.title || "Unknown Project"}
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {(plLoading || projectRevenueLoading) && (
        <div className="flex justify-center items-center py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading financial data...</p>
          </div>
        </div>
      )}

      {!plLoading && !projectRevenueLoading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</div>
                <p className="text-xs text-muted-foreground">{revenueEntries.length} transactions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</div>
                <p className="text-xs text-muted-foreground">{expenseEntries.length} transactions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(netProfit)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {netProfit >= 0 ? 'Profit' : 'Loss'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totalRevenue === 0 && totalExpenses === 0 ? "N/A" : `${profitMargin.toFixed(1)}%`}
                </div>
                <p className="text-xs text-muted-foreground">
                  {profitMargin >= 20 ? 'Excellent' : profitMargin >= 10 ? 'Good' : profitMargin >= 0 ? 'Break-even' : 'Loss'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="accounts" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="accounts">By Account</TabsTrigger>
              <TabsTrigger value="projects">By Project</TabsTrigger>
              <TabsTrigger value="project-analysis">Project P&L</TabsTrigger>
              <TabsTrigger value="detailed">Detailed View</TabsTrigger>
            </TabsList>

            {/* By Account */}
            <TabsContent value="accounts" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-500" />
                      Revenue by Account
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(revenueByAccount)
                        .sort(([, a], [, b]) => b - a)
                        .map(([account, amount]) => (
                          <div key={account} className="flex justify-between items-center">
                            <span className="text-sm font-medium">{account}</span>
                            <span className={`text-sm font-bold ${amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {amount < 0 ? `(${formatCurrency(Math.abs(amount))})` : formatCurrency(amount)}
                            </span>
                          </div>
                        ))}
                      {Object.keys(revenueByAccount).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">No revenue data available</p>
                      )}
                      {Object.keys(revenueByAccount).length > 0 && (
                        <div className="flex justify-between items-center pt-3 border-t font-bold">
                          <span className="text-sm">Total Revenue</span>
                          <span className="text-sm text-green-600">{formatCurrency(totalRevenue)}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-red-500" />
                      Expenses by Account
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(expensesByAccount)
                        .sort(([, a], [, b]) => b - a)
                        .map(([account, amount]) => (
                          <div key={account} className="flex justify-between items-center">
                            <span className="text-sm font-medium">{account}</span>
                            <span className={`text-sm font-bold ${amount < 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {amount < 0 ? `(${formatCurrency(Math.abs(amount))})` : formatCurrency(amount)}
                            </span>
                          </div>
                        ))}
                      {Object.keys(expensesByAccount).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">No expense data available</p>
                      )}
                      {Object.keys(expensesByAccount).length > 0 && (
                        <div className="flex justify-between items-center pt-3 border-t font-bold">
                          <span className="text-sm">Total Expenses</span>
                          <span className="text-sm text-red-600">{formatCurrency(totalExpenses)}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Net Profit Summary for By Account view */}
              {(Object.keys(revenueByAccount).length > 0 || Object.keys(expensesByAccount).length > 0) && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-base">Net Profit / (Loss)</span>
                      <span className={`font-bold text-lg ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {netProfit < 0 ? `(${formatCurrency(Math.abs(netProfit))})` : formatCurrency(netProfit)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* By Project */}
            <TabsContent value="projects" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Project Profitability Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3">Project</th>
                          <th className="text-right p-3">Revenue</th>
                          <th className="text-right p-3">Expenses</th>
                          <th className="text-right p-3">Profit / (Loss)</th>
                          <th className="text-right p-3">Margin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from(new Set([
                          ...Object.keys(revenueByProject),
                          ...Object.keys(expensesByProject)
                        ])).map((project) => {
                          const revenue = revenueByProject[project] || 0;
                          const expenses = expensesByProject[project] || 0;
                          const profit = revenue - expenses;
                          const margin = revenue > 0 ? (profit / revenue) * 100 : expenses > 0 ? -100 : 0;

                          return (
                            <tr key={project} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                              <td className="p-3 font-medium">{project}</td>
                              <td className="p-3 text-right text-green-600">{formatCurrency(revenue)}</td>
                              <td className="p-3 text-right text-red-600">{formatCurrency(expenses)}</td>
                              <td className={`p-3 text-right font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {profit < 0 ? `(${formatCurrency(Math.abs(profit))})` : formatCurrency(profit)}
                              </td>
                              <td className={`p-3 text-right ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatMargin(margin, revenue, expenses)}
                              </td>
                            </tr>
                          );
                        })}
                        {/* Totals row */}
                        {(Object.keys(revenueByProject).length > 0 || Object.keys(expensesByProject).length > 0) && (
                          <tr className="border-t-2 bg-gray-50 dark:bg-gray-800 font-bold">
                            <td className="p-3">Total</td>
                            <td className="p-3 text-right text-green-600">{formatCurrency(totalRevenue)}</td>
                            <td className="p-3 text-right text-red-600">{formatCurrency(totalExpenses)}</td>
                            <td className={`p-3 text-right ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {netProfit < 0 ? `(${formatCurrency(Math.abs(netProfit))})` : formatCurrency(netProfit)}
                            </td>
                            <td className={`p-3 text-right ${profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {totalRevenue === 0 && totalExpenses === 0 ? "N/A" : `${profitMargin.toFixed(1)}%`}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    {Object.keys(revenueByProject).length === 0 && Object.keys(expensesByProject).length === 0 && (
                      <div className="text-center py-8">
                        <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No project data available</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Project P&L */}
            <TabsContent value="project-analysis" className="space-y-4">
              <Card>
                <CardHeader className="pb-2 sm:pb-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
                    Project-Based Profit & Loss Analysis
                  </CardTitle>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Shows project revenue and expenses within the selected period
                  </p>
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                  {plLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : filteredProjectPL.length === 0 ? (
                    <div className="text-center py-8">
                      <BarChart3 className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 text-sm sm:text-base">No project data for selected period</p>
                    </div>
                  ) : (
                    <div className="space-y-4 sm:space-y-6">
                      {/* Summary Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                        <Card className="border shadow-sm">
                          <CardContent className="p-3 sm:p-4">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2 mb-1">
                                <TrendingUp className="h-4 w-4 text-green-500 flex-shrink-0" />
                                <span className="text-xs sm:text-sm font-medium text-muted-foreground">Total Revenue</span>
                              </div>
                              <div className="text-base sm:text-xl lg:text-2xl font-bold text-green-600 break-all">
                                {formatCurrency(filteredProjectPL.reduce((sum, p) => sum + p.revenue, 0))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="border shadow-sm">
                          <CardContent className="p-3 sm:p-4">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2 mb-1">
                                <TrendingDown className="h-4 w-4 text-red-500 flex-shrink-0" />
                                <span className="text-xs sm:text-sm font-medium text-muted-foreground">Total Expenses</span>
                              </div>
                              <div className="text-base sm:text-xl lg:text-2xl font-bold text-red-600 break-all">
                                {formatCurrency(filteredProjectPL.reduce((sum, p) => sum + p.expenses, 0))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="border shadow-sm">
                          <CardContent className="p-3 sm:p-4">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2 mb-1">
                                <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs sm:text-sm font-medium text-muted-foreground">Net Profit</span>
                              </div>
                              <div className={`text-base sm:text-xl lg:text-2xl font-bold break-all ${
                                filteredProjectPL.reduce((sum, p) => sum + p.profit, 0) >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {formatCurrency(filteredProjectPL.reduce((sum, p) => sum + p.profit, 0))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Mobile: Card-based layout */}
                      <div className="block lg:hidden space-y-3">
                        {filteredProjectPL
                          .sort((a, b) => b.profit - a.profit)
                          .map((project) => (
                            <Card key={project.id} className="border shadow-sm">
                              <CardContent className="p-3 sm:p-4">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1 min-w-0 pr-2">
                                    <h4 className="font-semibold text-sm sm:text-base truncate">{project.title}</h4>
                                    <p className="text-xs text-muted-foreground">
                                      {project.startDate && formatDisplayDate(project.startDate)} - 
                                      {project.actualEndDate ? formatDisplayDate(project.actualEndDate) : 'Ongoing'}
                                    </p>
                                  </div>
                                  <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                                    project.status === 'completed' ? 'bg-green-100 text-green-800' :
                                    project.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                    project.status === 'on_hold' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {project.status?.replace('_', ' ').toUpperCase()}
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div className="bg-gray-50 dark:bg-gray-800 rounded p-2">
                                    <div className="text-xs text-muted-foreground">Expenses</div>
                                    <div className="font-medium text-red-600">{formatCurrency(project.expenses)}</div>
                                  </div>
                                  <div className="bg-gray-50 dark:bg-gray-800 rounded p-2">
                                    <div className="text-xs text-muted-foreground">Revenue</div>
                                    <div className="font-medium text-green-600">{formatCurrency(project.revenue)}</div>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                                  <div>
                                    <span className="text-xs text-muted-foreground">Profit/Loss: </span>
                                    <span className={`font-bold ${project.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {project.profit < 0 ? `(${formatCurrency(Math.abs(project.profit))})` : formatCurrency(project.profit)}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className={`text-sm font-medium ${project.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {formatMargin(project.margin, project.revenue, project.expenses)}
                                    </span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                      </div>

                      {/* Desktop: Table layout */}
                      <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b bg-gray-50 dark:bg-gray-800">
                              <th className="text-left p-3 font-medium">Project</th>
                              <th className="text-center p-3 font-medium">Status</th>
                              <th className="text-right p-3 font-medium">Revenue</th>
                              <th className="text-right p-3 font-medium">Expenses</th>
                              <th className="text-right p-3 font-medium">Profit / (Loss)</th>
                              <th className="text-right p-3 font-medium">Margin</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredProjectPL
                              .sort((a, b) => b.profit - a.profit)
                              .map((project) => (
                                <tr key={project.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                                  <td className="p-3">
                                    <div>
                                      <div className="font-medium">{project.title}</div>
                                      <div className="text-sm text-muted-foreground">
                                        {project.startDate && formatDisplayDate(project.startDate)} - 
                                        {project.actualEndDate ? formatDisplayDate(project.actualEndDate) : 'Ongoing'}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-3 text-center">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      project.status === 'completed' ? 'bg-green-100 text-green-800' :
                                      project.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                      project.status === 'on_hold' ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {project.status?.replace('_', ' ').toUpperCase()}
                                    </span>
                                  </td>
                                  <td className="p-3 text-right text-green-600 font-medium">
                                    {formatCurrency(project.revenue)}
                                  </td>
                                  <td className="p-3 text-right text-red-600 font-medium">
                                    {formatCurrency(project.expenses)}
                                  </td>
                                  <td className={`p-3 text-right font-bold ${project.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {project.profit < 0 ? `(${formatCurrency(Math.abs(project.profit))})` : formatCurrency(project.profit)}
                                  </td>
                                  <td className={`p-3 text-right ${project.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatMargin(project.margin, project.revenue, project.expenses)}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Performance Insights */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 mt-4 sm:mt-6">
                        <Card className="border shadow-sm">
                          <CardHeader className="pb-2 sm:pb-4">
                            <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-green-500" />
                              Most Profitable Projects
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="space-y-2">
                              {filteredProjectPL
                                .filter(p => p.profit > 0)
                                .sort((a, b) => b.profit - a.profit)
                                .slice(0, 5)
                                .map((project, index) => (
                                  <div key={project.id} className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <span className="text-xs text-muted-foreground w-4">#{index + 1}</span>
                                      <span className="text-xs sm:text-sm font-medium truncate">{project.title}</span>
                                    </div>
                                    <span className="text-xs sm:text-sm font-bold text-green-600 flex-shrink-0 ml-2">
                                      {formatCurrency(project.profit)}
                                    </span>
                                  </div>
                                ))}
                              {filteredProjectPL.filter(p => p.profit > 0).length === 0 && (
                                <p className="text-xs sm:text-sm text-muted-foreground text-center py-4">
                                  No profitable projects in this period
                                </p>
                              )}
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border shadow-sm">
                          <CardHeader className="pb-2 sm:pb-4">
                            <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
                              <TrendingDown className="h-4 w-4 text-red-500" />
                              Projects at Loss
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="space-y-2">
                              {filteredProjectPL
                                .filter(p => p.profit < 0)
                                .sort((a, b) => a.profit - b.profit)
                                .slice(0, 5)
                                .map((project, index) => (
                                  <div key={project.id} className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <span className="text-xs text-muted-foreground w-4">#{index + 1}</span>
                                      <span className="text-xs sm:text-sm font-medium truncate">{project.title}</span>
                                    </div>
                                    <span className="text-xs sm:text-sm font-bold text-red-600 flex-shrink-0 ml-2">
                                      ({formatCurrency(Math.abs(project.profit))})
                                    </span>
                                  </div>
                                ))}
                              {filteredProjectPL.filter(p => p.profit < 0).length === 0 && (
                                <p className="text-xs sm:text-sm text-muted-foreground text-center py-4">
                                  No projects at loss in this period
                                </p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Detailed View */}
            <TabsContent value="detailed" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Revenue Transactions</CardTitle>
                    <p className="text-sm text-muted-foreground">{revenueEntries.length} entries · Total: {formatCurrency(totalRevenue)}</p>
                  </CardHeader>
                  <CardContent>
                    {revenueEntries.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No revenue transactions found</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[500px] overflow-y-auto">
                        {revenueEntries.map((entry) => {
                          const netAmount = parseFloat(entry.creditAmount || "0") - parseFloat(entry.debitAmount || "0");
                          return (
                            <div key={entry.id} className="p-3 border rounded-lg">
                              <div className="flex justify-between items-start gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-sm">{entry.accountName}</p>
                                  <p className="text-xs text-muted-foreground truncate">{entry.description}</p>
                                  <div className="flex gap-2 mt-1 flex-wrap">
                                    <p className="text-xs text-muted-foreground">
                                      {formatDisplayDate(entry.transactionDate)}
                                    </p>
                                    {entry.invoiceNumber && (
                                      <span className="text-xs text-blue-600">{entry.invoiceNumber}</span>
                                    )}
                                    {entry.projectTitle && (
                                      <span className="text-xs bg-blue-50 text-blue-700 px-1.5 rounded">{entry.projectTitle}</span>
                                    )}
                                  </div>
                                </div>
                                <span className={`font-bold text-sm flex-shrink-0 ${netAmount < 0 ? "text-red-600" : "text-green-600"}`}>
                                  {netAmount < 0 ? `(${formatCurrency(Math.abs(netAmount))})` : formatCurrency(netAmount)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Expense Transactions</CardTitle>
                    <p className="text-sm text-muted-foreground">{expenseEntries.length} entries · Total: {formatCurrency(totalExpenses)}</p>
                  </CardHeader>
                  <CardContent>
                    {expenseEntries.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No expense transactions found</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[500px] overflow-y-auto">
                        {expenseEntries.map((entry) => {
                          const netAmount = parseFloat(entry.debitAmount || "0") - parseFloat(entry.creditAmount || "0");
                          return (
                            <div key={entry.id} className="p-3 border rounded-lg">
                              <div className="flex justify-between items-start gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-sm">{entry.accountName}</p>
                                  <p className="text-xs text-muted-foreground truncate">{entry.description}</p>
                                  <div className="flex gap-2 mt-1 flex-wrap">
                                    <p className="text-xs text-muted-foreground">
                                      {formatDisplayDate(entry.transactionDate)}
                                    </p>
                                    {entry.invoiceNumber && (
                                      <span className="text-xs text-blue-600">{entry.invoiceNumber}</span>
                                    )}
                                    {entry.projectTitle && (
                                      <span className="text-xs bg-purple-50 text-purple-700 px-1.5 rounded">{entry.projectTitle}</span>
                                    )}
                                    {entry.entityName && (
                                      <span className="text-xs text-muted-foreground">{entry.entityName}</span>
                                    )}
                                  </div>
                                </div>
                                <span className={`font-bold text-sm flex-shrink-0 ${netAmount < 0 ? "text-green-600" : "text-red-600"}`}>
                                  {netAmount < 0 ? `(${formatCurrency(Math.abs(netAmount))})` : formatCurrency(netAmount)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
