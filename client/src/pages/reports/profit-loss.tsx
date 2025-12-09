
import React, { useState } from "react";
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
  Filter, 
  Download, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  FileText,
  BarChart3,
  PieChart
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
}

export default function ProfitLossReport() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    projectId: undefined as number | undefined,
    accountType: "" as "revenue" | "expense" | "cogs" | "",
    periodType: "custom" as "monthly" | "quarterly" | "yearly" | "custom",
  });

  React.useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    } else if (user?.role !== "admin" && user?.role !== "finance") {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user, setLocation]);

  // Set default dates based on period type
  React.useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    if (filters.periodType === "monthly") {
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
  }, [filters.periodType]);

  const { data: revenueEntries, isLoading: revenueLoading } = useQuery<GeneralLedgerEntry[]>({
    queryKey: ["/api/general-ledger", "receivable", filters],
    queryFn: async () => {
      const params = new URLSearchParams({ entryType: "receivable" });
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.projectId) params.append("projectId", filters.projectId.toString());

      const response = await apiRequest("GET", `/api/general-ledger?${params}`);
      if (!response.ok) throw new Error("Failed to fetch revenue entries");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const { data: expenseEntries, isLoading: expenseLoading } = useQuery<GeneralLedgerEntry[]>({
    queryKey: ["/api/general-ledger", "payable", filters],
    queryFn: async () => {
      const params = new URLSearchParams({ entryType: "payable" });
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.projectId) params.append("projectId", filters.projectId.toString());

      const response = await apiRequest("GET", `/api/general-ledger?${params}`);
      if (!response.ok) throw new Error("Failed to fetch expense entries");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/projects");
      if (!response.ok) throw new Error("Failed to fetch projects");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  // Fetch project revenue data for project-based profit/loss
  const { data: projectRevenues, isLoading: projectRevenuesLoading } = useQuery<any[]>({
    queryKey: ["/api/projects/revenues", filters],
    queryFn: async () => {
      if (!projects.length) return [];
      
      const revenuePromises = projects.map(async (project) => {
        try {
          const response = await apiRequest("GET", `/api/projects/${project.id}/revenue`);
          if (!response.ok) return null;
          const revenue = await response.json();
          return {
            ...project,
            revenue: revenue
          };
        } catch (error) {
          console.error(`Failed to fetch revenue for project ${project.id}:`, error);
          return null;
        }
      });
      
      const results = await Promise.all(revenuePromises);
      return results.filter(result => result !== null);
    },
    enabled: isAuthenticated && projects.length > 0,
  });

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(parseFloat(amount?.toString() || "0"));
  };

  // Calculate financial metrics
  const totalRevenue = revenueEntries?.reduce((sum, entry) => 
    sum + parseFloat(entry.debitAmount || "0"), 0) || 0;

  const totalExpenses = expenseEntries?.reduce((sum, entry) => 
    sum + parseFloat(entry.creditAmount || "0"), 0) || 0;

  const grossProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  // Group revenue by account/project
  const revenueByAccount = revenueEntries?.reduce((acc, entry) => {
    const key = entry.accountName || "Other Revenue";
    if (!acc[key]) acc[key] = 0;
    acc[key] += parseFloat(entry.debitAmount || "0");
    return acc;
  }, {} as Record<string, number>) || {};

  // Group expenses by account/project
  const expensesByAccount = expenseEntries?.reduce((acc, entry) => {
    const key = entry.accountName || "Other Expenses";
    if (!acc[key]) acc[key] = 0;
    acc[key] += parseFloat(entry.creditAmount || "0");
    return acc;
  }, {} as Record<string, number>) || {};

  // Group by project
  const revenueByProject = revenueEntries?.reduce((acc, entry) => {
    const key = entry.projectTitle || "General";
    if (!acc[key]) acc[key] = 0;
    acc[key] += parseFloat(entry.debitAmount || "0");
    return acc;
  }, {} as Record<string, number>) || {};

  const expensesByProject = expenseEntries?.reduce((acc, entry) => {
    const key = entry.projectTitle || "General";
    if (!acc[key]) acc[key] = 0;
    acc[key] += parseFloat(entry.creditAmount || "0");
    return acc;
  }, {} as Record<string, number>) || {};

  const exportToCSV = () => {
    const headers = [
      "Account Type",
      "Account Name",
      "Project",
      "Amount",
      "Date",
      "Description"
    ];

    const revenueData = revenueEntries?.map(entry => [
      "Revenue",
      entry.accountName || "-",
      entry.projectTitle || "General",
      entry.debitAmount,
      new Date(entry.transactionDate).toLocaleDateString(),
      entry.description
    ]) || [];

    const expenseData = expenseEntries?.map(entry => [
      "Expense",
      entry.accountName || "-",
      entry.projectTitle || "General",
      entry.creditAmount,
      new Date(entry.transactionDate).toLocaleDateString(),
      entry.description
    ]) || [];

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
    <div className="container mx-auto py-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Profit & Loss Report</h1>
          <p className="text-muted-foreground">Comprehensive financial performance analysis</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                Advanced Filters
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <h4 className="font-medium">Filter Options</h4>
                
                <div>
                  <Label htmlFor="periodType">Period Type</Label>
                  <Select
                    value={filters.periodType}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, periodType: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">This Month</SelectItem>
                      <SelectItem value="quarterly">This Quarter</SelectItem>
                      <SelectItem value="yearly">This Year</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {filters.periodType === "custom" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="startDate">Start Date</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={filters.startDate}
                        onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="endDate">End Date</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={filters.endDate}
                        onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="projectFilter">Project</Label>
                  <Select
                    value={filters.projectId?.toString() || ""}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, projectId: value === "all" ? undefined : parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Projects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Projects</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          {project.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => setIsFilterOpen(false)} className="flex-1">Apply</Button>
                  <Button 
                    onClick={() => {
                      setFilters({ 
                        startDate: "", 
                        endDate: "", 
                        projectId: undefined,
                        accountType: "",
                        periodType: "custom"
                      });
                      setIsFilterOpen(false);
                    }} 
                    variant="outline" 
                    className="flex-1"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button onClick={exportToCSV} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">{revenueEntries?.length || 0} transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</div>
            <p className="text-xs text-muted-foreground">{expenseEntries?.length || 0} transactions</p>
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Project-Based Profit & Loss Analysis
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Shows actual project costs vs revenue generated from invoice payments
              </p>
            </CardHeader>
            <CardContent>
              {projectRevenuesLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : !projectRevenues || projectRevenues.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No project data available</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-sm font-medium text-muted-foreground">Total Project Revenue</div>
                        <div className="text-2xl font-bold text-green-600">
                          {formatCurrency(
                            projectRevenues.reduce((sum, project) => 
                              sum + parseFloat(project.revenue?.totalRevenue || "0"), 0
                            )
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-sm font-medium text-muted-foreground">Total Project Costs</div>
                        <div className="text-2xl font-bold text-red-600">
                          {formatCurrency(
                            projectRevenues.reduce((sum, project) => 
                              sum + parseFloat(project.actualCost || "0"), 0
                            )
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-sm font-medium text-muted-foreground">Net Project Profit</div>
                        <div className={`text-2xl font-bold ${
                          projectRevenues.reduce((sum, project) => 
                            sum + (parseFloat(project.revenue?.totalRevenue || "0") - parseFloat(project.actualCost || "0")), 0
                          ) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(
                            projectRevenues.reduce((sum, project) => 
                              sum + (parseFloat(project.revenue?.totalRevenue || "0") - parseFloat(project.actualCost || "0")), 0
                            )
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Project Details Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3 font-medium">Project</th>
                          <th className="text-right p-3 font-medium">Status</th>
                          <th className="text-right p-3 font-medium">Actual Cost</th>
                          <th className="text-right p-3 font-medium">Revenue Generated</th>
                          <th className="text-right p-3 font-medium">Profit/Loss</th>
                          <th className="text-right p-3 font-medium">Margin %</th>
                          <th className="text-right p-3 font-medium">Payments</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectRevenues
                          .sort((a, b) => 
                            (parseFloat(b.revenue?.totalRevenue || "0") - parseFloat(b.actualCost || "0")) -
                            (parseFloat(a.revenue?.totalRevenue || "0") - parseFloat(a.actualCost || "0"))
                          )
                          .map((project) => {
                            const revenue = parseFloat(project.revenue?.totalRevenue || "0");
                            const cost = parseFloat(project.actualCost || "0");
                            const profit = revenue - cost;
                            const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
                            const paymentsCount = project.revenue?.invoicePayments?.length || 0;

                            return (
                              <tr key={project.id} className="border-b hover:bg-gray-50">
                                <td className="p-3">
                                  <div>
                                    <div className="font-medium">{project.title}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {project.startDate && new Date(project.startDate).toLocaleDateString()} - 
                                      {project.actualEndDate ? new Date(project.actualEndDate).toLocaleDateString() : 'Ongoing'}
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3 text-right">
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
                                  {formatCurrency(cost)}
                                </td>
                                <td className="p-3 text-right text-green-600 font-medium">
                                  {formatCurrency(revenue)}
                                </td>
                                <td className={`p-3 text-right font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {formatCurrency(profit)}
                                </td>
                                <td className={`p-3 text-right ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {margin.toFixed(1)}%
                                </td>
                                <td className="p-3 text-right">
                                  <span className="text-sm text-muted-foreground">
                                    {paymentsCount} payment{paymentsCount !== 1 ? 's' : ''}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  {/* Performance Insights */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Most Profitable Projects</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {projectRevenues
                            .filter(p => parseFloat(p.revenue?.totalRevenue || "0") - parseFloat(p.actualCost || "0") > 0)
                            .sort((a, b) => 
                              (parseFloat(b.revenue?.totalRevenue || "0") - parseFloat(b.actualCost || "0")) -
                              (parseFloat(a.revenue?.totalRevenue || "0") - parseFloat(a.actualCost || "0"))
                            )
                            .slice(0, 5)
                            .map((project) => {
                              const profit = parseFloat(project.revenue?.totalRevenue || "0") - parseFloat(project.actualCost || "0");
                              return (
                                <div key={project.id} className="flex justify-between items-center">
                                  <span className="text-sm font-medium truncate">{project.title}</span>
                                  <span className="text-sm font-bold text-green-600">
                                    {formatCurrency(profit)}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Projects at Loss</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {projectRevenues
                            .filter(p => parseFloat(p.revenue?.totalRevenue || "0") - parseFloat(p.actualCost || "0") < 0)
                            .sort((a, b) => 
                              (parseFloat(a.revenue?.totalRevenue || "0") - parseFloat(a.actualCost || "0")) -
                              (parseFloat(b.revenue?.totalRevenue || "0") - parseFloat(b.actualCost || "0"))
                            )
                            .slice(0, 5)
                            .map((project) => {
                              const loss = parseFloat(project.revenue?.totalRevenue || "0") - parseFloat(project.actualCost || "0");
                              return (
                                <div key={project.id} className="flex justify-between items-center">
                                  <span className="text-sm font-medium truncate">{project.title}</span>
                                  <span className="text-sm font-bold text-red-600">
                                    {formatCurrency(loss)}
                                  </span>
                                </div>
                              );
                            })}
                          {projectRevenues.filter(p => parseFloat(p.revenue?.totalRevenue || "0") - parseFloat(p.actualCost || "0") < 0).length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No projects at loss
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
                ) : !revenueEntries || revenueEntries.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No revenue transactions found</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {revenueEntries.map((entry) => (
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
                            {formatCurrency(entry.debitAmount)}
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
                ) : !expenseEntries || expenseEntries.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No expense transactions found</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {expenseEntries.map((entry) => (
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
                            {formatCurrency(entry.creditAmount)}
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
    </div>
  );
}
