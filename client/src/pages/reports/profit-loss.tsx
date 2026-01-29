
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
import { apiRequest } from "@/lib/queryClient";
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

interface GeneralLedgerEntry {
  id: number;
  entryType: string;
  referenceType: string;
  referenceId: number | null;
  accountName: string;
  description: string;
  debitAmount: string;
  creditAmount: string;
  entityId: number | null;
  entityName: string | null;
  projectId: number | null;
  projectTitle: string | null;
  invoiceNumber: string | null;
  transactionDate: string;
  dueDate: string | null;
  status: string;
  createdAt: string;
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
    accountType: "" as "revenue" | "expense" | "cogs" | "",
    periodType: "financial_year" as "monthly" | "quarterly" | "yearly" | "financial_year" | "previous_fy" | "custom",
  });

  // Check if any filters are active (non-default)
  const hasActiveFilters = filters.projectId !== undefined || filters.periodType !== "financial_year";

  // Fetch company settings for financial year
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

  // Calculate financial year dates
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

  // Set default dates based on period type
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
      // Calculate previous financial year dates
      const fyStartMonth = (company?.financialYearStartMonth || 1) - 1;
      const fyStartDay = company?.financialYearStartDay || 1;
      const fyEndMonth = (company?.financialYearEndMonth || 12) - 1;
      const fyEndDay = company?.financialYearEndDay || 31;
      
      // Get current FY start year and subtract 1 for previous year
      let fyStartYear = now.getFullYear();
      if (now.getMonth() < fyStartMonth || (now.getMonth() === fyStartMonth && now.getDate() < fyStartDay)) {
        fyStartYear -= 1;
      }
      fyStartYear -= 1; // Previous year
      
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

  const { data: revenueEntries, isLoading: revenueLoading } = useQuery<GeneralLedgerEntry[]>({
    queryKey: ["/api/general-ledger", "receivable", filters],
    queryFn: async () => {
      const params = new URLSearchParams({ entryType: "receivable", limit: "1000" });
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.projectId) params.append("projectId", filters.projectId.toString());

      const response = await apiRequest(`/api/general-ledger?${params}`);
      if (!response.ok) throw new Error("Failed to fetch revenue entries");
      const result = await response.json();
      return result.data || [];
    },
    enabled: isAuthenticated && !!filters.startDate && !!filters.endDate,
  });

  const { data: expenseEntries, isLoading: expenseLoading } = useQuery<GeneralLedgerEntry[]>({
    queryKey: ["/api/general-ledger", "payable", filters],
    queryFn: async () => {
      const params = new URLSearchParams({ entryType: "payable", limit: "1000" });
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.projectId) params.append("projectId", filters.projectId.toString());

      const response = await apiRequest(`/api/general-ledger?${params}`);
      if (!response.ok) throw new Error("Failed to fetch expense entries");
      const result = await response.json();
      return result.data || [];
    },
    enabled: isAuthenticated && !!filters.startDate && !!filters.endDate,
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: isAuthenticated,
  });

  // Fetch chart of accounts to get account types - this is the source of truth for P&L categorization
  const { data: chartOfAccountsData, isLoading: chartOfAccountsLoading } = useQuery<{
    id: number;
    accountCode: string;
    accountName: string;
    accountType: string;
    accountCategory: string;
  }[]>({
    queryKey: ["/api/chart-of-accounts"],
    enabled: isAuthenticated,
  });

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "AED",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(parseFloat(amount?.toString() || "0"));
  };

  // Get account names by type from chart of accounts (source of truth)
  // Revenue accounts (4xxx codes) for Revenue section
  // Expense accounts (5xxx-6xxx codes) for Expense section
  const revenueAccountNames = chartOfAccountsData
    ?.filter(account => account.accountType?.toLowerCase() === "revenue")
    .map(account => account.accountName) || [];
  
  const expenseAccountNames = chartOfAccountsData
    ?.filter(account => account.accountType?.toLowerCase() === "expense")
    .map(account => account.accountName) || [];

  // Filter revenue entries to only include actual revenue accounts (not asset accounts like Cash/Bank, Accounts Receivable)
  const revenueOnlyEntries = revenueEntries?.filter(entry => 
    revenueAccountNames.includes(entry.accountName)
  ) || [];

  // Filter expense entries to only include actual expense accounts (not liability accounts like Accounts Payable)
  const expenseOnlyEntries = expenseEntries?.filter(entry => 
    expenseAccountNames.includes(entry.accountName)
  ) || [];

  // Calculate financial metrics - Revenue uses credit amounts, Expenses use debit amounts
  const totalRevenue = revenueOnlyEntries.reduce((sum, entry) => 
    sum + parseFloat(entry.creditAmount || "0"), 0) || 0;

  const totalExpenses = expenseOnlyEntries.reduce((sum, entry) => 
    sum + parseFloat(entry.debitAmount || "0"), 0) || 0;

  const grossProfit = totalRevenue - totalExpenses;
  // Calculate profit margin - show negative percentage when in loss
  const profitMargin = totalRevenue > 0 
    ? (grossProfit / totalRevenue) * 100 
    : (totalExpenses > 0 ? -100 : 0); // If no revenue but has expenses, show -100% (full loss)

  // Group revenue by account/project (only actual revenue accounts)
  const revenueByAccount = revenueOnlyEntries.reduce((acc, entry) => {
    const key = entry.accountName || "Other Revenue";
    if (!acc[key]) acc[key] = 0;
    acc[key] += parseFloat(entry.creditAmount || "0");
    return acc;
  }, {} as Record<string, number>);

  // Group expenses by account/project (excluding liability accounts)
  const expensesByAccount = expenseOnlyEntries.reduce((acc, entry) => {
    const key = entry.accountName || "Other Expenses";
    if (!acc[key]) acc[key] = 0;
    acc[key] += parseFloat(entry.debitAmount || "0");
    return acc;
  }, {} as Record<string, number>) || {};

  // Group by project (only actual revenue accounts)
  const revenueByProject = revenueOnlyEntries.reduce((acc, entry) => {
    const key = entry.projectTitle || "General";
    if (!acc[key]) acc[key] = 0;
    acc[key] += parseFloat(entry.creditAmount || "0");
    return acc;
  }, {} as Record<string, number>);

  const expensesByProject = expenseOnlyEntries.reduce((acc, entry) => {
    const key = entry.projectTitle || "General";
    if (!acc[key]) acc[key] = 0;
    acc[key] += parseFloat(entry.debitAmount || "0");
    return acc;
  }, {} as Record<string, number>) || {};

  // Calculate project P&L from filtered GL entries (respects all date/project filters)
  const filteredProjectPL = projects?.map(project => {
    const projectRevenue = revenueOnlyEntries
      .filter(entry => entry.projectId === project.id)
      .reduce((sum, entry) => sum + parseFloat(entry.creditAmount || "0"), 0);
    
    const projectExpenses = expenseOnlyEntries
      .filter(entry => entry.projectId === project.id)
      .reduce((sum, entry) => sum + parseFloat(entry.debitAmount || "0"), 0);
    
    const revenueTransactions = revenueOnlyEntries.filter(entry => entry.projectId === project.id).length;
    
    return {
      ...project,
      revenue: projectRevenue,
      expenses: projectExpenses,
      profit: projectRevenue - projectExpenses,
      margin: projectRevenue > 0 ? ((projectRevenue - projectExpenses) / projectRevenue) * 100 : 0,
      transactionCount: revenueTransactions
    };
  }).filter(p => p.revenue > 0 || p.expenses > 0) || [];

  const exportToCSV = () => {
    const headers = [
      "Account Type",
      "Account Name",
      "Project",
      "Amount",
      "Date",
      "Description"
    ];

    const revenueData = revenueOnlyEntries.map(entry => [
      "Revenue",
      entry.accountName || "-",
      entry.projectTitle || "General",
      entry.creditAmount,
      new Date(entry.transactionDate).toLocaleDateString(),
      entry.description
    ]);

    const expenseData = expenseOnlyEntries.map(entry => [
      "Expense",
      entry.accountName || "-",
      entry.projectTitle || "General",
      entry.debitAmount,
      new Date(entry.transactionDate).toLocaleDateString(),
      entry.description
    ]);

    const csvData = [headers, ...revenueData, ...expenseData]
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
            {/* Period Selector */}
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

            {/* Date Range */}
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

            {/* Project Filter */}
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

            {/* Clear Button */}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setFilters({ 
                startDate: "", 
                endDate: "", 
                projectId: undefined,
                accountType: "",
                periodType: "financial_year"
              })}
              className="text-muted-foreground"
            >
              Reset
            </Button>
          </div>
          
          {/* Active Filter Summary */}
          <div className="mt-3 pt-3 border-t flex flex-wrap gap-2 items-center text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Showing:</span>
            <span className="font-medium">
              {filters.startDate && filters.endDate 
                ? `${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()}`
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
      {(revenueLoading || expenseLoading || chartOfAccountsLoading) && (
        <div className="flex justify-center items-center py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading financial data...</p>
          </div>
        </div>
      )}

      {!revenueLoading && !expenseLoading && !chartOfAccountsLoading && (
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
            <p className="text-xs text-muted-foreground">{revenueOnlyEntries.length} transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</div>
            <p className="text-xs text-muted-foreground">{expenseOnlyEntries.length} transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(grossProfit)}
            </div>
            <p className="text-xs text-muted-foreground">
              {grossProfit >= 0 ? 'Profit' : 'Loss'}
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
              {profitMargin.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {profitMargin >= 20 ? 'Excellent' : profitMargin >= 10 ? 'Good' : profitMargin >= 0 ? 'Break-even' : 'Loss'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analysis */}
      <Tabs defaultValue="accounts" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="accounts">By Account</TabsTrigger>
          <TabsTrigger value="projects">By Project</TabsTrigger>
          <TabsTrigger value="project-analysis">Project P&L</TabsTrigger>
          <TabsTrigger value="detailed">Detailed View</TabsTrigger>
        </TabsList>

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
                    .sort(([,a], [,b]) => b - a)
                    .map(([account, amount]) => (
                      <div key={account} className="flex justify-between items-center">
                        <span className="text-sm font-medium">{account}</span>
                        <span className="text-sm font-bold text-green-600">
                          {formatCurrency(amount)}
                        </span>
                      </div>
                    ))}
                  {Object.keys(revenueByAccount).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No revenue data available
                    </p>
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
                    .sort(([,a], [,b]) => b - a)
                    .map(([account, amount]) => (
                      <div key={account} className="flex justify-between items-center">
                        <span className="text-sm font-medium">{account}</span>
                        <span className="text-sm font-bold text-red-600">
                          {formatCurrency(amount)}
                        </span>
                      </div>
                    ))}
                  {Object.keys(expensesByAccount).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No expense data available
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

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
                      <th className="text-right p-3">Profit/Loss</th>
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
                      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

                      return (
                        <tr key={project} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-medium">{project}</td>
                          <td className="p-3 text-right text-green-600">
                            {formatCurrency(revenue)}
                          </td>
                          <td className="p-3 text-right text-red-600">
                            {formatCurrency(expenses)}
                          </td>
                          <td className={`p-3 text-right font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(profit)}
                          </td>
                          <td className={`p-3 text-right ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {margin.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
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
              {(revenueLoading || expenseLoading) ? (
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
                  {/* Summary Cards - Stacked on mobile, row on larger screens */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <Card className="border shadow-sm">
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="h-4 w-4 text-green-500 flex-shrink-0" />
                            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Total Revenue</span>
                          </div>
                          <div className="text-base sm:text-xl lg:text-2xl font-bold text-green-600 break-all">
                            {formatCurrency(
                              filteredProjectPL.reduce((sum, p) => sum + p.revenue, 0)
                            )}
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
                            {formatCurrency(
                              filteredProjectPL.reduce((sum, p) => sum + p.expenses, 0)
                            )}
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
                            {formatCurrency(
                              filteredProjectPL.reduce((sum, p) => sum + p.profit, 0)
                            )}
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
                            {/* Project Header */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 min-w-0 pr-2">
                                <h4 className="font-semibold text-sm sm:text-base truncate">{project.title}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {project.startDate && new Date(project.startDate).toLocaleDateString()} - 
                                  {project.actualEndDate ? new Date(project.actualEndDate).toLocaleDateString() : 'Ongoing'}
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
                            
                            {/* Financial Details Grid */}
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
                            
                            {/* Profit/Loss and Margin */}
                            <div className="flex items-center justify-between mt-3 pt-3 border-t">
                              <div>
                                <span className="text-xs text-muted-foreground">Profit/Loss: </span>
                                <span className={`font-bold ${project.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {formatCurrency(project.profit)}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className={`text-sm font-medium ${project.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {project.margin.toFixed(1)}%
                                </span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({project.transactionCount} txn{project.transactionCount !== 1 ? 's' : ''})
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
                          <th className="text-right p-3 font-medium">Expenses</th>
                          <th className="text-right p-3 font-medium">Revenue</th>
                          <th className="text-right p-3 font-medium">Profit/Loss</th>
                          <th className="text-right p-3 font-medium">Margin</th>
                          <th className="text-right p-3 font-medium">Transactions</th>
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
                                    {project.startDate && new Date(project.startDate).toLocaleDateString()} - 
                                    {project.actualEndDate ? new Date(project.actualEndDate).toLocaleDateString() : 'Ongoing'}
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
                              <td className="p-3 text-right text-red-600 font-medium">
                                {formatCurrency(project.expenses)}
                              </td>
                              <td className="p-3 text-right text-green-600 font-medium">
                                {formatCurrency(project.revenue)}
                              </td>
                              <td className={`p-3 text-right font-bold ${project.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(project.profit)}
                              </td>
                              <td className={`p-3 text-right ${project.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {project.margin.toFixed(1)}%
                              </td>
                              <td className="p-3 text-right">
                                <span className="text-sm text-muted-foreground">
                                  {project.transactionCount} txn{project.transactionCount !== 1 ? 's' : ''}
                                </span>
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
                                  {formatCurrency(project.profit)}
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

        <TabsContent value="detailed" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                {revenueLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : revenueOnlyEntries.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No revenue transactions found</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {revenueOnlyEntries.map((entry) => (
                      <div key={entry.id} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{entry.accountName}</p>
                            <p className="text-sm text-muted-foreground">{entry.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(entry.transactionDate).toLocaleDateString()}
                            </p>
                          </div>
                          <span className="font-bold text-green-600">
                            {formatCurrency(entry.creditAmount)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expense Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                {expenseLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : expenseOnlyEntries.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No expense transactions found</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {expenseOnlyEntries.map((entry) => (
                      <div key={entry.id} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{entry.accountName}</p>
                            <p className="text-sm text-muted-foreground">{entry.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(entry.transactionDate).toLocaleDateString()}
                            </p>
                          </div>
                          <span className="font-bold text-red-600">
                            {formatCurrency(entry.debitAmount)}
                          </span>
                        </div>
                      </div>
                    ))}
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
