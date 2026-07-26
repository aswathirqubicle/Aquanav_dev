import { formatDisplayDate } from "@/lib/utils";
import React, { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Autocomplete } from "@/components/ui/autocomplete";
import { Plus, FileText, DollarSign, Calendar, TrendingUp, X, Search, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight } from "lucide-react";
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

export default function GeneralLedgerPayable() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingEntry, setEditingEntry] = useState<GeneralLedgerEntry | null>(null);

  const [filters, setFilters] = useState({
    status: "",
    startDate: "",
    endDate: "",
    entityId: undefined as number | undefined,
    projectId: undefined as number | undefined,
    search: "",
    financialYear: "",
    page: 1,
    limit: 20,
  });

  const clearFilters = () => {
    setFilters({
      status: "",
      startDate: "",
      endDate: "",
      entityId: undefined,
      projectId: undefined,
      search: "",
      financialYear: "",
      page: 1,
      limit: 20,
    });
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: "AED",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(typeof amount === "number" ? amount : parseFloat(amount || "0"));
  };

  // What the row moved the balance by. Payables are credit-normal: a bill raises the balance, a payment
  // or debit note reduces it.
  // Rendering only the creditAmount printed AED 0.00 against every row on the other
  // side, so entries that plainly moved the balance looked inert.
  const rowMovement = (entry: GeneralLedgerEntry) =>
    parseFloat(entry.creditAmount || "0") - parseFloat(entry.debitAmount || "0");

  

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge variant="success">Paid</Badge>;
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

  const hasActiveFilters = filters.status || filters.startDate || filters.endDate || filters.search || filters.projectId || filters.financialYear;

  const currentYear = new Date().getFullYear();
  const financialYears = [
    { value: `${currentYear - 2}-${currentYear - 1}`, label: `FY ${currentYear - 2}-${currentYear - 1}` },
    { value: `${currentYear - 1}-${currentYear}`, label: `FY ${currentYear - 1}-${currentYear}` },
    { value: `${currentYear}-${currentYear + 1}`, label: `FY ${currentYear}-${currentYear + 1}` },
    { value: `${currentYear + 1}-${currentYear + 2}`, label: `FY ${currentYear + 1}-${currentYear + 2}` },
  ];

  const handleFinancialYearChange = (value: string) => {
    if (value === "all") {
      setFilters(prev => ({ ...prev, financialYear: "", startDate: "", endDate: "", page: 1 }));
    } else {
      const [startYear] = value.split("-").map(Number);
      const startDate = `${startYear}-01-01`;
      const endDate = `${startYear}-12-31`;
      setFilters(prev => ({ ...prev, financialYear: value, startDate, endDate, page: 1 }));
    }
  };

  const [formData, setFormData] = useState({
    accountName: "Accounts Payable",
    description: "",
    creditAmount: "",
    entityName: "",
    selectedSupplierId: "" as string,
    invoiceNumber: "",
    transactionDate: new Date().toISOString().split('T')[0],
    dueDate: "",
    notes: "",
    projectId: undefined as number | undefined,
    selectedAccountType: "account" as "supplier" | "project" | "account",
    selectedAccount: "" as string,
  });

  React.useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    } else if (user?.role !== "admin" && user?.role !== "finance") {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user, setLocation]);

  const { data: entriesResponse, isLoading, refetch } = useQuery<{
    data: GeneralLedgerEntry[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    summary?: {
      totalPayable: string;
      pendingPayable: string;
      overduePayable: string;
    };
  }>({
    queryKey: ["/api/general-ledger", "payable", filters],
    queryFn: async () => {
      // Scope to the control account. What we owe suppliers is the balance of
      // Accounts Payable alone; without this the list also carried the
      // Purchase Expense and VAT debits from the same postings, which show as
      // separate lines against one document and net the summary to 0.00.
      const params = new URLSearchParams({
        entryType: "payable",
        accountName: "Accounts Payable",
      });
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== "" && value !== undefined && value !== "all") {
          params.append(key, value.toString());
        }
      });

      const response = await apiRequest(`/api/general-ledger?${params}`);
      if (!response.ok) throw new Error("Failed to fetch payable entries");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  React.useEffect(() => {
    if (isAuthenticated) {
      refetch();
    }
  }, [isAuthenticated, refetch]);

  const entries = entriesResponse?.data || [];
  const pagination = entriesResponse?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 };
  const summary = entriesResponse?.summary;

  const totalPayable = parseFloat(summary?.totalPayable || "0");
  const totalOverdue = parseFloat(summary?.overduePayable || "0");

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">General Ledger - Accounts Payable</h1>
          <p className="text-muted-foreground">Track all amounts owed to suppliers</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Search className="w-4 h-4 mr-2" />
            {showFilters ? "Hide Filters" : "Show Filters"}
            {hasActiveFilters && <span className="ml-2 bg-primary-foreground text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs">!</span>}
          </Button>
          {/* <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Manual Entry
          </Button> */}
        </div>
      </div>

      {showFilters && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  placeholder="Search description, supplier..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="financialYear">Financial Year</Label>
                <Select
                  value={filters.financialYear || "all"}
                  onValueChange={handleFinancialYearChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {financialYears.map((fy) => (
                      <SelectItem key={fy.value} value={fy.value}>
                        {fy.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value, financialYear: "", page: 1 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value, financialYear: "", page: 1 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="statusFilter">Status</Label>
                <Select
                  value={filters.status || "all"}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, status: value === "all" ? "" : value, page: 1 }))}
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
              <div className="space-y-2">
                <Label htmlFor="projectFilter">Project</Label>
                <Select
                  value={filters.projectId?.toString() || "all"}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, projectId: value === "all" ? undefined : parseInt(value), page: 1 }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projects
                      .filter(project => project.id && project.title)
                      .map((project) => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          {project.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="invisible">Actions</Label>
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="w-full"
                  disabled={!hasActiveFilters}
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payable</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalPayable.toString())}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Overdue</CardTitle>
            <Calendar className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalOverdue.toString())}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{entries?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground animate-pulse">Loading payable entries...</p>
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No payable entries found</h3>
            <p className="text-gray-500 mb-4">Entries will appear here when purchase invoices are created or manual entries are added.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Payable Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 min-w-[80px]">Date</th>
                    <th className="text-left p-2 min-w-[150px]">Description</th>
                    <th className="text-left p-2 min-w-[120px]">Supplier</th>
                    <th className="text-left p-2 min-w-[120px]">Project</th>
                    <th className="text-left p-2 min-w-[100px]">Invoice #</th>
                    <th className="text-right p-2 min-w-[100px]">Amount</th>
                    <th className="text-left p-2 min-w-[80px]">Due Date</th>
                    <th className="text-left p-2 min-w-[80px]">Status</th>
                    <th className="text-left p-2 min-w-[120px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 text-sm">{formatDisplayDate(entry.transactionDate)}</td>
                      <td className="p-2 text-sm">{entry.description}</td>
                      <td className="p-2 text-sm">{entry.entityName || "-"}</td>
                      <td className="p-2 text-sm">{entry.projectTitle || "-"}</td>
                      <td className="p-2 text-sm">{entry.invoiceNumber || "-"}</td>
                      <td className="p-2 text-right font-medium text-sm">{formatCurrency(rowMovement(entry))}</td>
                      <td className="p-2 text-sm">{entry.dueDate ? formatDisplayDate(entry.dueDate) : "-"}</td>
                      <td className="p-2">{getStatusBadge(entry.status)}</td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          {entry.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusUpdate(entry, "paid")}
                              className="text-xs px-2 py-1"
                            >
                              Mark Paid
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                  {pagination.total} entries
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(1)}
                    disabled={pagination.page === 1}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm px-2">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.totalPages)}
                    disabled={pagination.page === pagination.totalPages}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}      
    </div>
  );
}