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
import { Plus, FileText, DollarSign, Calendar, TrendingUp, X, Search } from "lucide-react";

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

  const { data: entriesResponse, isLoading } = useQuery<{
    data: GeneralLedgerEntry[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: ["/api/general-ledger", "receivable", filters],
    queryFn: async () => {
      const params = new URLSearchParams({ entryType: "receivable" });
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.entityId) params.append("entityId", filters.entityId.toString());
      if (filters.search) params.append("search", filters.search);
      params.append("page", filters.page.toString());
      params.append("limit", filters.limit.toString());

      const response = await apiRequest(`/api/general-ledger?${params}`);
      if (!response.ok) throw new Error("Failed to fetch receivable entries");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const entries = entriesResponse?.data || [];
  const pagination = entriesResponse?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 };

  const { data: customersResponse } = useQuery<{ data: any[] }>({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const response = await fetch("/api/customers?limit=1000");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const { data: projectsResponse } = useQuery<{ data: any[] }>({
    queryKey: ["/api/projects"],
    enabled: isAuthenticated,
  });

  const customers = Array.isArray(customersResponse?.data) ? customersResponse.data : [];
  const projects = Array.isArray(projectsResponse?.data) ? projectsResponse.data : [];

  const createEntryMutation = useMutation({
    mutationFn: async (data: any) => {
      // Create a balanced journal entry for double-entry accounting
      const journalEntryData = {
        referenceType: "manual",
        description: data.description,
        transactionDate: data.transactionDate,
        entryType: "receivable",
        dueDate: data.dueDate,
        status: "pending",
        createdBy: user?.id,
        entries: [
          // Debit: Accounts Receivable (Asset increases)
          {
            accountName: "Accounts Receivable",
            debitAmount: data.debitAmount,
            creditAmount: "0",
            entityId: data.selectedAccountType === "customer" ? parseInt(data.selectedCustomerId) : undefined,
            entityName: data.entityName,
            projectId: data.selectedAccountType === "project" ? data.projectId : undefined,
            invoiceNumber: data.invoiceNumber,
            notes: data.notes,
          },
          // Credit: Revenue Account (Revenue increases)
          {
            accountName: data.selectedAccountType === "account" ? data.entityName : "Revenue",
            debitAmount: "0",
            creditAmount: data.debitAmount,
            entityId: data.selectedAccountType === "customer" ? parseInt(data.selectedCustomerId) : undefined,
            entityName: data.entityName,
            projectId: data.selectedAccountType === "project" ? data.projectId : undefined,
            invoiceNumber: data.invoiceNumber,
            notes: data.notes,
          },
        ],
      };

      const response = await apiRequest("/api/general-ledger/journal", { method: "POST", body: journalEntryData });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create receivable journal entry");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/general-ledger"] });
      toast({
        title: "Entry Created",
        description: "Receivable entry has been created successfully.",
      });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create receivable entry",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
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
      projectId: undefined,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description || !formData.debitAmount || !formData.selectedAccountType) {
      toast({
        title: "Error",
        description: "Please fill in description, amount, and select an account type",
        variant: "destructive",
      });
      return;
    }

    const submitData = {
      ...formData,
      projectId: formData.selectedAccountType === "project" ? formData.projectId : undefined,
    };

    createEntryMutation.mutate(submitData);
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: "AED",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(parseFloat(amount || "0"));
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Total debits (invoices) minus total credits (payments) = net receivable
  const totalDebits = entries?.reduce((sum, entry) => {
    return sum + parseFloat(entry.debitAmount || "0");
  }, 0) || 0;

  const totalCredits = entries?.reduce((sum, entry) => {
    return sum + parseFloat(entry.creditAmount || "0");
  }, 0) || 0;

  const totalReceivable = totalDebits - totalCredits;

  // Overdue: invoice entries (debitAmount > 0) that are past due and not fully paid
  const overdueReceivable = entries?.filter(e => {
    if (!e.dueDate) return false;
    if (parseFloat(e.debitAmount || "0") <= 0) return false; // Only invoice entries, not payments
    const dueDate = new Date(e.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const isPastDue = dueDate < today;
    const isNotPaid = e.status !== "paid";
    return isPastDue && isNotPaid;
  }).reduce((sum, entry) => {
    return sum + parseFloat(entry.debitAmount || "0");
  }, 0) || 0;

  const pendingReceivable = totalReceivable - overdueReceivable;

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
        <div className="flex justify-center items-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading receivable entries...</p>
          </div>
        </div>
      ) : !entries || entries.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No receivable entries found</h3>
            <p className="text-gray-500 mb-4">Entries will appear here when sales invoices are created or manual entries are added.</p>
            {/* <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Manual Entry
            </Button> */}
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
                      <td className="p-2">{new Date(entry.transactionDate).toLocaleDateString()}</td>
                      <td className="p-2">{entry.description}</td>
                      <td className="p-2">{entry.entityName || "-"}</td>
                      <td className="p-2">{entry.invoiceNumber || "-"}</td>
                      <td className="p-2 text-right font-medium">{formatCurrency(entry.debitAmount)}</td>
                      <td className="p-2">{entry.dueDate ? new Date(entry.dueDate).toLocaleDateString() : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Manual Entry Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Manual Receivable Entry</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accountType">Account Type *</Label>
              <Select
                value={formData.selectedAccountType || "no-type"}
                onValueChange={(value) => {
                  setFormData(prev => ({ 
                    ...prev, 
                    selectedAccountType: value === "no-type" ? "" : value,
                    selectedAccount: "",
                    selectedCustomerId: "",
                    entityName: "",
                    projectId: undefined
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-type">Select Account Type</SelectItem>
                  <SelectItem value="account">General Account</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.selectedAccountType === "customer" && (
              <div className="space-y-2">
                <Label htmlFor="customer">Customer *</Label>
                <Select
                  value={formData.selectedAccount || "default-customer"}
                  onValueChange={(value) => {
                    const customer = customers.find(c => c.id.toString() === value);
                    setFormData(prev => ({ 
                      ...prev, 
                      selectedAccount: value === "default-customer" ? "" : value,
                      selectedCustomerId: value === "default-customer" ? "" : value,
                      entityName: customer ? customer.name : ""
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default-customer">Select Customer</SelectItem>
                    {customers
                      .filter(customer => customer.id && customer.name)
                      .map((customer) => (
                        <SelectItem key={customer.id} value={customer.id.toString()}>
                          {customer.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.selectedAccountType === "project" && (
              <div className="space-y-2">
                <Label htmlFor="project">Project *</Label>
                <Select
                  value={formData.projectId?.toString() || "default-project"}
                  onValueChange={(value) => {
                    const project = projects.find(p => p.id.toString() === value);
                    setFormData(prev => ({ 
                      ...prev, 
                      projectId: value === "default-project" ? undefined : parseInt(value),
                      entityName: project ? project.title : ""
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default-project">Select Project</SelectItem>
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
            )}

            {formData.selectedAccountType === "account" && (
              <div className="space-y-2">
                <Label htmlFor="generalAccount">Account Name *</Label>
                <Select
                  value={formData.selectedAccount || "default-account"}
                  onValueChange={(value) => {
                    setFormData(prev => ({ 
                      ...prev, 
                      selectedAccount: value === "default-account" ? "" : value,
                      entityName: value === "default-account" ? "" : value
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default-account">Select Account</SelectItem>
                    <SelectItem value="Service Revenue">Service Revenue</SelectItem>
                    <SelectItem value="Rental Income">Rental Income</SelectItem>
                    <SelectItem value="Commission Income">Commission Income</SelectItem>
                    <SelectItem value="Interest Income">Interest Income</SelectItem>
                    <SelectItem value="Other Income">Other Income</SelectItem>
                    <SelectItem value="Consulting Fees">Consulting Fees</SelectItem>
                    <SelectItem value="Training Revenue">Training Revenue</SelectItem>
                    <SelectItem value="Maintenance Revenue">Maintenance Revenue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter description"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="debitAmount">Amount *</Label>
              <Input
                id="debitAmount"
                type="number"
                step="0.01"
                min="0"
                value={formData.debitAmount}
                onChange={(e) => setFormData(prev => ({ ...prev, debitAmount: e.target.value }))}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoiceNumber">Invoice Number</Label>
              <Input
                id="invoiceNumber"
                value={formData.invoiceNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                placeholder="Invoice number"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="transactionDate">Transaction Date *</Label>
                <Input
                  id="transactionDate"
                  type="date"
                  value={formData.transactionDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, transactionDate: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createEntryMutation.isPending}>
                {createEntryMutation.isPending ? "Creating..." : "Create Entry"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}