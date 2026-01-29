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
import { Plus, FileText, DollarSign, Calendar, X, Search } from "lucide-react";
import { Autocomplete } from "@/components/ui/autocomplete";

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

  const { data: entriesResponse, isLoading } = useQuery<{
    data: GeneralLedgerEntry[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: ["/api/general-ledger", "payable", filters],
    queryFn: async () => {
      const params = new URLSearchParams({ entryType: "payable" });
      if (filters.status) params.append("status", filters.status);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.entityId) params.append("entityId", filters.entityId.toString());
      if (filters.projectId) params.append("projectId", filters.projectId.toString());
      if (filters.search) params.append("search", filters.search);
      params.append("page", filters.page.toString());
      params.append("limit", filters.limit.toString());

      const response = await apiRequest(`/api/general-ledger?${params}`);
      if (!response.ok) throw new Error("Failed to fetch payable entries");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const entries = entriesResponse?.data || [];
  const pagination = entriesResponse?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 };

  const { data: suppliersResponse } = useQuery<{ data: any[] }>({
    queryKey: ["/api/suppliers"],
    enabled: isAuthenticated,
  });

  const suppliers = Array.isArray(suppliersResponse?.data) ? suppliersResponse.data : [];

  const { data: projectsResponse } = useQuery<any[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const response = await apiRequest("/api/projects");
      if (!response.ok) throw new Error("Failed to fetch projects");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const projects = Array.isArray(projectsResponse) ? projectsResponse : [];

  const createEntryMutation = useMutation({
    mutationFn: async (data: any) => {
      // Create a balanced journal entry for double-entry accounting
      const journalEntryData = {
        referenceType: "manual",
        description: data.description,
        transactionDate: data.transactionDate,
        entryType: "payable",
        dueDate: data.dueDate,
        status: "pending",
        createdBy: user?.id,
        entries: [
          // Debit: Expense Account (Expense increases)
          {
            accountName: data.selectedAccountType === "account" ? data.entityName : "Operating Expenses",
            debitAmount: data.creditAmount,
            creditAmount: "0",
            entityId: data.selectedAccountType === "supplier" ? parseInt(data.selectedSupplierId) : undefined,
            entityName: data.entityName,
            projectId: data.selectedAccountType === "project" ? data.projectId : undefined,
            invoiceNumber: data.invoiceNumber,
            notes: data.notes,
          },
          // Credit: Accounts Payable (Liability increases)
          {
            accountName: "Accounts Payable",
            debitAmount: "0",
            creditAmount: data.creditAmount,
            entityId: data.selectedAccountType === "supplier" ? parseInt(data.selectedSupplierId) : undefined,
            entityName: data.entityName,
            projectId: data.selectedAccountType === "project" ? data.projectId : undefined,
            invoiceNumber: data.invoiceNumber,
            notes: data.notes,
          },
        ],
      };

      const response = await apiRequest("POST", "/api/general-ledger/journal", journalEntryData);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create payable journal entry");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/general-ledger"] });
      toast({
        title: "Entry Created",
        description: "Payable entry has been created successfully.",
      });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create payable entry",
        variant: "destructive",
      });
    },
  });

  const updateEntryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest("PUT", `/api/general-ledger/${id}`, data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update entry");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/general-ledger"] });
      toast({
        title: "Entry Updated",
        description: "Entry has been updated successfully.",
      });
      setEditingEntry(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update entry",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      accountName: "Accounts Payable",
      description: "",
      creditAmount: "",
      entityName: "",
      selectedSupplierId: "",
      invoiceNumber: "",
      transactionDate: new Date().toISOString().split('T')[0],
      dueDate: "",
      notes: "",
      projectId: undefined,
      selectedAccountType: "account",
      selectedAccount: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description || !formData.creditAmount) {
      toast({
        title: "Error",
        description: "Please fill in description and amount",
        variant: "destructive",
      });
      return;
    }

    // Validate account selection based on type
    if (formData.selectedAccountType === "supplier" && !formData.selectedSupplierId) {
      toast({
        title: "Error",
        description: "Please select a supplier",
        variant: "destructive",
      });
      return;
    }

    if (formData.selectedAccountType === "project" && !formData.projectId) {
      toast({
        title: "Error", 
        description: "Please select a project",
        variant: "destructive",
      });
      return;
    }

    if (formData.selectedAccountType === "account" && !formData.selectedAccount) {
      toast({
        title: "Error",
        description: "Please select an account",
        variant: "destructive",
      });
      return;
    }

    createEntryMutation.mutate(formData);
  };

  const handleStatusUpdate = (entry: GeneralLedgerEntry, newStatus: string) => {
    updateEntryMutation.mutate({
      id: entry.id,
      data: { status: newStatus },
    });
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: "AED",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(parseFloat(amount || "0"));
  };

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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Total credits (invoices) minus total debits (payments) = net payable
  const totalCredits = entries?.reduce((sum, entry) => {
    return sum + parseFloat(entry.creditAmount || "0");
  }, 0) || 0;

  const totalDebits = entries?.reduce((sum, entry) => {
    return sum + parseFloat(entry.debitAmount || "0");
  }, 0) || 0;

  const totalPayable = totalCredits - totalDebits;

  // Overdue: invoice entries (creditAmount > 0) that are past due and not fully paid
  const totalOverdue = entries?.filter(e => {
    if (!e.dueDate) return false;
    if (parseFloat(e.creditAmount || "0") <= 0) return false; // Only invoice entries, not payments
    const dueDate = new Date(e.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const isPastDue = dueDate < today;
    const isNotPaid = e.status !== "paid";
    return isPastDue && isNotPaid;
  }).reduce((sum, entry) => {
    return sum + parseFloat(entry.creditAmount || "0");
  }, 0) || 0;

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container mx-auto py-6">
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
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Manual Entry
          </Button>
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
        <div className="flex justify-center items-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading payable entries...</p>
          </div>
        </div>
      ) : !entries || entries.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No payable entries found</h3>
            <p className="text-gray-500 mb-4">Entries will appear here when purchase invoices are created or manual entries are added.</p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Manual Entry
            </Button>
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
                      <td className="p-2 text-sm">{new Date(entry.transactionDate).toLocaleDateString()}</td>
                      <td className="p-2 text-sm">{entry.description}</td>
                      <td className="p-2 text-sm">{entry.entityName || "-"}</td>
                      <td className="p-2 text-sm">{entry.projectTitle || "-"}</td>
                      <td className="p-2 text-sm">{entry.invoiceNumber || "-"}</td>
                      <td className="p-2 text-right font-medium text-sm">{formatCurrency(entry.creditAmount)}</td>
                      <td className="p-2 text-sm">{entry.dueDate ? new Date(entry.dueDate).toLocaleDateString() : "-"}</td>
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
          </CardContent>
        </Card>
      )}

      {/* Add Manual Entry Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Manual Payable Entry</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <Label htmlFor="creditAmount">Amount *</Label>
              <Input
                id="creditAmount"
                type="number"
                step="0.01"
                min="0"
                value={formData.creditAmount}
                onChange={(e) => setFormData(prev => ({ ...prev, creditAmount: e.target.value }))}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountType">Account Type *</Label>
              <Select
                value={formData.selectedAccountType}
                onValueChange={(value: "supplier" | "project" | "account") => {
                  setFormData(prev => ({ 
                    ...prev, 
                    selectedAccountType: value,
                    selectedAccount: "",
                    selectedSupplierId: "",
                    entityName: "",
                    projectId: undefined
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="account">General Account</SelectItem>
                  <SelectItem value="supplier">Supplier</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.selectedAccountType === "supplier" && (
              <div className="space-y-2">
                <Label htmlFor="supplier">Supplier *</Label>
                <Select
                  value={formData.selectedAccount || "default-supplier"}
                  onValueChange={(value) => {
                    const supplier = suppliers.find(s => s.id.toString() === value);
                    setFormData(prev => ({ 
                      ...prev, 
                      selectedAccount: value === "default-supplier" ? "" : value,
                      selectedSupplierId: value === "default-supplier" ? "" : value,
                      entityName: supplier ? supplier.name : ""
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default-supplier">Select Supplier</SelectItem>
                    {suppliers
                      .filter(supplier => supplier.id && supplier.name)
                      .map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id.toString()}>
                          {supplier.name}
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
                  value={formData.selectedAccount || "default-project"}
                  onValueChange={(value) => {
                    const project = projects.find(p => p.id.toString() === value);
                    setFormData(prev => ({ 
                      ...prev, 
                      selectedAccount: value === "default-project" ? "" : value,
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
                    <SelectItem value="Office Expenses">Office Expenses</SelectItem>
                    <SelectItem value="Utilities">Utilities</SelectItem>
                    <SelectItem value="Equipment Rental">Equipment Rental</SelectItem>
                    <SelectItem value="Professional Services">Professional Services</SelectItem>
                    <SelectItem value="Insurance">Insurance</SelectItem>
                    <SelectItem value="Maintenance & Repairs">Maintenance & Repairs</SelectItem>
                    <SelectItem value="Travel Expenses">Travel Expenses</SelectItem>
                    <SelectItem value="Marketing & Advertising">Marketing & Advertising</SelectItem>
                    <SelectItem value="Legal & Professional Fees">Legal & Professional Fees</SelectItem>
                    <SelectItem value="Other Expenses">Other Expenses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
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
                rows={3}
              />
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="submit" disabled={createEntryMutation.isPending} className="w-full sm:w-auto">
                {createEntryMutation.isPending ? "Creating..." : "Create Entry"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}