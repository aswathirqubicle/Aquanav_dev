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
  invoiceNumber: string | null;
  transactionDate: string;
  dueDate: string | null;
  status: string;
  createdAt: string;
  notes: string | null;
}

export default function GeneralLedgerReceivable() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    entityId: undefined as number | undefined,
    search: "",
    financialYear: "",
    page: 1,
    limit: 20,
  });

  const [pendingFilters, setPendingFilters] = useState({
    startDate: "",
    endDate: "",
    search: "",
    financialYear: "",
  });

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: "AED",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(parseFloat(amount || "0"));
  };

  const clearFilters = () => {
    setPendingFilters({
      startDate: "",
      endDate: "",
      search: "",
      financialYear: "",
    });
    setFilters({
      startDate: "",
      endDate: "",
      entityId: undefined,
      search: "",
      financialYear: "",
      page: 1,
      limit: 20,
    });
  };

  const applyFilters = () => {
    setFilters(prev => ({
      ...prev,
      ...pendingFilters,
      page: 1,
    }));
  };

  const hasActiveFilters = filters.startDate || filters.endDate || filters.search || filters.financialYear;

  const currentYear = new Date().getFullYear();
  const financialYears = [
    { value: `${currentYear - 2}-${currentYear - 1}`, label: `FY ${currentYear - 2}-${currentYear - 1}` },
    { value: `${currentYear - 1}-${currentYear}`, label: `FY ${currentYear - 1}-${currentYear}` },
    { value: `${currentYear}-${currentYear + 1}`, label: `FY ${currentYear}-${currentYear + 1}` },
    { value: `${currentYear + 1}-${currentYear + 2}`, label: `FY ${currentYear + 1}-${currentYear + 2}` },
  ];

  const handleFinancialYearChange = (value: string) => {
    if (value === "all") {
      setPendingFilters(prev => ({ ...prev, financialYear: "", startDate: "", endDate: "" }));
    } else {
      const [startYear] = value.split("-").map(Number);
      const startDate = `${startYear}-01-01`;
      const endDate = `${startYear}-12-31`;
      setPendingFilters(prev => ({ ...prev, financialYear: value, startDate, endDate }));
    }
  };

  const [formData, setFormData] = useState({
    accountName: "Accounts Receivable",
    description: "",
    debitAmount: "",
    entityName: "",
    invoiceNumber: "",
    transactionDate: new Date().toISOString().split('T')[0],
    dueDate: "",
    notes: "",
    selectedAccountType: "",
    selectedCustomerId: "",
    selectedAccount: "",
    projectId: undefined as number | undefined,
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
      totalReceivable: string;
      pendingReceivable: string;
      overdueReceivable: string;
    };
  }>({
    queryKey: ["/api/general-ledger", "receivable", filters],
    queryFn: async () => {
      const params = new URLSearchParams({ entryType: "receivable" });
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== "" && value !== undefined && value !== "all") {
          params.append(key, value.toString());
        }
      });

      const response = await apiRequest(`/api/general-ledger?${params}`);
      if (!response.ok) throw new Error("Failed to fetch receivable entries");
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

  const totalReceivable = parseFloat(summary?.totalReceivable || "0");
  const pendingReceivable = parseFloat(summary?.pendingReceivable || "0");
  const overdueReceivable = parseFloat(summary?.overdueReceivable || "0");

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">General Ledger - Accounts Receivable</h1>
          <p className="text-muted-foreground">Track all amounts owed by customers</p>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  placeholder="Search description, customer..."
                  value={pendingFilters.search}
                  onChange={(e) => setPendingFilters(prev => ({ ...prev, search: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="financialYear">Financial Year</Label>
                <Select
                  value={pendingFilters.financialYear || "all"}
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
                  value={pendingFilters.startDate}
                  onChange={(e) => setPendingFilters(prev => ({ ...prev, startDate: e.target.value, financialYear: "" }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={pendingFilters.endDate}
                  onChange={(e) => setPendingFilters(prev => ({ ...prev, endDate: e.target.value, financialYear: "" }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="invisible">Actions</Label>
                <Button 
                  onClick={applyFilters}
                  className="w-full"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
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
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Receivable</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalReceivable.toString())}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Collections</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(pendingReceivable.toString())}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(overdueReceivable.toString())}</div>
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
          <p className="text-muted-foreground animate-pulse">Loading receivable entries...</p>
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No receivable entries found</h3>
            <p className="text-gray-500 mb-4">Entries will appear here when sales invoices are created or manual entries are added.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Receivable Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Description</th>
                    <th className="text-left p-2">Customer</th>
                    <th className="text-left p-2">Invoice #</th>
                    <th className="text-right p-2">Amount</th>
                    <th className="text-left p-2">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b hover:bg-gray-50">
                      <td className="p-2">{formatDisplayDate(entry.transactionDate)}</td>
                      <td className="p-2">{entry.description}</td>
                      <td className="p-2">{entry.entityName || "-"}</td>
                      <td className="p-2">{entry.invoiceNumber || "-"}</td>
                      <td className="p-2 text-right font-medium">{formatCurrency(entry.debitAmount)}</td>
                      <td className="p-2">{entry.dueDate ? formatDisplayDate(entry.dueDate) : "-"}</td>
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