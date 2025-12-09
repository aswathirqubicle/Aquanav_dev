
import React, { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Users,
  AlertCircle
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

interface Customer {
  id: number;
  name: string;
}

interface Supplier {
  id: number;
  name: string;
}

interface Project {
  id: number;
  title: string;
}

export default function PayablesReceivablesReport() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    status: "",
    entityId: undefined as number | undefined,
    projectId: undefined as number | undefined,
    entryType: "" as "receivable" | "payable" | "",
  });

  React.useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    } else if (user?.role !== "admin" && user?.role !== "finance") {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user, setLocation]);

  const { data: receivableEntries, isLoading: receivablesLoading } = useQuery<GeneralLedgerEntry[]>({
    queryKey: ["/api/general-ledger", "receivable", filters],
    queryFn: async () => {
      const params = new URLSearchParams({ entryType: "receivable" });
      if (filters.status) params.append("status", filters.status);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.entityId) params.append("entityId", filters.entityId.toString());
      if (filters.projectId) params.append("projectId", filters.projectId.toString());

      const response = await apiRequest("GET", `/api/general-ledger?${params}`);
      if (!response.ok) throw new Error("Failed to fetch receivable entries");
      return response.json();
    },
    enabled: isAuthenticated && (!filters.entryType || filters.entryType === "receivable"),
  });

  const { data: payableEntries, isLoading: payablesLoading } = useQuery<GeneralLedgerEntry[]>({
    queryKey: ["/api/general-ledger", "payable", filters],
    queryFn: async () => {
      const params = new URLSearchParams({ entryType: "payable" });
      if (filters.status) params.append("status", filters.status);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.entityId) params.append("entityId", filters.entityId.toString());
      if (filters.projectId) params.append("projectId", filters.projectId.toString());

      const response = await apiRequest("GET", `/api/general-ledger?${params}`);
      if (!response.ok) throw new Error("Failed to fetch payable entries");
      return response.json();
    },
    enabled: isAuthenticated && (!filters.entryType || filters.entryType === "payable"),
  });

  const { data: customersResponse } = useQuery<{ data: Customer[] }>({
    queryKey: ["/api/customers"],
    enabled: isAuthenticated,
  });

  const customers = Array.isArray(customersResponse?.data) ? customersResponse.data : [];

  const { data: suppliersResponse } = useQuery<{ data: Supplier[] }>({
    queryKey: ["/api/suppliers"],
    enabled: isAuthenticated,
  });

  const suppliers = Array.isArray(suppliersResponse?.data) ? suppliersResponse.data : [];

  const { data: projectsResponse } = useQuery<{ data: Project[] }>({
    queryKey: ["/api/projects"],
    enabled: isAuthenticated,
  });

  const projects = Array.isArray(projectsResponse?.data) ? projectsResponse.data : [];

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(parseFloat(amount?.toString() || "0"));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Paid</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "overdue":
        return <Badge variant="destructive">Overdue</Badge>;
      case "cancelled":
        return <Badge variant="outline">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Calculate summary statistics
  const receivableSummary = {
    total: receivableEntries?.reduce((sum, entry) => sum + parseFloat(entry.debitAmount || "0"), 0) || 0,
    pending: receivableEntries?.filter(e => e.status === "pending").reduce((sum, entry) => sum + parseFloat(entry.debitAmount || "0"), 0) || 0,
    overdue: receivableEntries?.filter(e => e.status === "overdue").reduce((sum, entry) => sum + parseFloat(entry.debitAmount || "0"), 0) || 0,
    paid: receivableEntries?.filter(e => e.status === "paid").reduce((sum, entry) => sum + parseFloat(entry.debitAmount || "0"), 0) || 0,
    count: receivableEntries?.length || 0,
  };

  const payableSummary = {
    total: payableEntries?.reduce((sum, entry) => sum + parseFloat(entry.creditAmount || "0"), 0) || 0,
    pending: payableEntries?.filter(e => e.status === "pending").reduce((sum, entry) => sum + parseFloat(entry.creditAmount || "0"), 0) || 0,
    overdue: payableEntries?.filter(e => e.status === "overdue").reduce((sum, entry) => sum + parseFloat(entry.creditAmount || "0"), 0) || 0,
    paid: payableEntries?.filter(e => e.status === "paid").reduce((sum, entry) => sum + parseFloat(entry.creditAmount || "0"), 0) || 0,
    count: payableEntries?.length || 0,
  };

  const exportToCSV = (data: GeneralLedgerEntry[], type: "receivables" | "payables") => {
    const headers = [
      "Date",
      "Description",
      type === "receivables" ? "Customer" : "Supplier",
      "Project",
      "Invoice #",
      "Amount",
      "Due Date",
      "Status",
      "Notes"
    ];

    const csvData = data.map(entry => [
      new Date(entry.transactionDate).toLocaleDateString(),
      entry.description,
      entry.entityName || "-",
      entry.projectTitle || "-",
      entry.invoiceNumber || "-",
      type === "receivables" ? entry.debitAmount : entry.creditAmount,
      entry.dueDate ? new Date(entry.dueDate).toLocaleDateString() : "-",
      entry.status,
      entry.notes || "-"
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}-report-${new Date().toISOString().split('T')[0]}.csv`;
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
          <h1 className="text-2xl font-bold">Payables & Receivables Report</h1>
          <p className="text-muted-foreground">Comprehensive analysis of amounts owed and due</p>
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
                  <Label htmlFor="entryType">Report Type</Label>
                  <Select
                    value={filters.entryType}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, entryType: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Types</SelectItem>
                      <SelectItem value="receivable">Receivables Only</SelectItem>
                      <SelectItem value="payable">Payables Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

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

                <div>
                  <Label htmlFor="statusFilter">Status</Label>
                  <Select
                    value={filters.status}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, status: value === "all" ? "" : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

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
                        status: "", 
                        entityId: undefined, 
                        projectId: undefined,
                        entryType: ""
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
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Receivables</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(receivableSummary.total)}</div>
            <p className="text-xs text-muted-foreground">{receivableSummary.count} entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payables</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(payableSummary.total)}</div>
            <p className="text-xs text-muted-foreground">{payableSummary.count} entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Position</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${receivableSummary.total - payableSummary.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(receivableSummary.total - payableSummary.total)}
            </div>
            <p className="text-xs text-muted-foreground">
              {receivableSummary.total - payableSummary.total >= 0 ? 'Positive' : 'Negative'} position
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Items</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(receivableSummary.overdue + payableSummary.overdue)}
            </div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Reports */}
      <Tabs defaultValue="receivables" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="receivables">Accounts Receivable</TabsTrigger>
          <TabsTrigger value="payables">Accounts Payable</TabsTrigger>
        </TabsList>

        <TabsContent value="receivables" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Accounts Receivable Details</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Outstanding amounts from customers
                </p>
              </div>
              <Button 
                onClick={() => receivableEntries && exportToCSV(receivableEntries, "receivables")}
                variant="outline"
                size="sm"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {/* Summary Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-lg font-semibold text-orange-600">{formatCurrency(receivableSummary.pending)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Overdue</p>
                  <p className="text-lg font-semibold text-red-600">{formatCurrency(receivableSummary.overdue)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Paid</p>
                  <p className="text-lg font-semibold text-green-600">{formatCurrency(receivableSummary.paid)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-lg font-semibold">{formatCurrency(receivableSummary.total)}</p>
                </div>
              </div>

              {receivablesLoading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : !receivableEntries || receivableEntries.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No receivable entries found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Date</th>
                        <th className="text-left p-2">Description</th>
                        <th className="text-left p-2">Customer</th>
                        <th className="text-left p-2">Project</th>
                        <th className="text-left p-2">Invoice #</th>
                        <th className="text-right p-2">Amount</th>
                        <th className="text-left p-2">Due Date</th>
                        <th className="text-left p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receivableEntries.map((entry) => (
                        <tr key={entry.id} className="border-b hover:bg-gray-50">
                          <td className="p-2">{new Date(entry.transactionDate).toLocaleDateString()}</td>
                          <td className="p-2">{entry.description}</td>
                          <td className="p-2">{entry.entityName || "-"}</td>
                          <td className="p-2">{entry.projectTitle || "-"}</td>
                          <td className="p-2">{entry.invoiceNumber || "-"}</td>
                          <td className="p-2 text-right font-medium">{formatCurrency(entry.debitAmount)}</td>
                          <td className="p-2">{entry.dueDate ? new Date(entry.dueDate).toLocaleDateString() : "-"}</td>
                          <td className="p-2">{getStatusBadge(entry.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payables" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Accounts Payable Details</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Outstanding amounts to suppliers
                </p>
              </div>
              <Button 
                onClick={() => payableEntries && exportToCSV(payableEntries, "payables")}
                variant="outline"
                size="sm"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {/* Summary Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-lg font-semibold text-orange-600">{formatCurrency(payableSummary.pending)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Overdue</p>
                  <p className="text-lg font-semibold text-red-600">{formatCurrency(payableSummary.overdue)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Paid</p>
                  <p className="text-lg font-semibold text-green-600">{formatCurrency(payableSummary.paid)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-lg font-semibold">{formatCurrency(payableSummary.total)}</p>
                </div>
              </div>

              {payablesLoading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : !payableEntries || payableEntries.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No payable entries found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Date</th>
                        <th className="text-left p-2">Description</th>
                        <th className="text-left p-2">Supplier</th>
                        <th className="text-left p-2">Project</th>
                        <th className="text-left p-2">Invoice #</th>
                        <th className="text-right p-2">Amount</th>
                        <th className="text-left p-2">Due Date</th>
                        <th className="text-left p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payableEntries.map((entry) => (
                        <tr key={entry.id} className="border-b hover:bg-gray-50">
                          <td className="p-2">{new Date(entry.transactionDate).toLocaleDateString()}</td>
                          <td className="p-2">{entry.description}</td>
                          <td className="p-2">{entry.entityName || "-"}</td>
                          <td className="p-2">{entry.projectTitle || "-"}</td>
                          <td className="p-2">{entry.invoiceNumber || "-"}</td>
                          <td className="p-2 text-right font-medium">{formatCurrency(entry.creditAmount)}</td>
                          <td className="p-2">{entry.dueDate ? new Date(entry.dueDate).toLocaleDateString() : "-"}</td>
                          <td className="p-2">{getStatusBadge(entry.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
