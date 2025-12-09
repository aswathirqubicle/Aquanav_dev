
import React, { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Autocomplete } from "@/components/ui/autocomplete";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Plus, 
  Filter, 
  Download, 
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  Banknote,
  ArrowUpDown
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

export default function GeneralLedger() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<GeneralLedgerEntry | null>(null);

  const [filters, setFilters] = useState({
    entryType: "all",
    referenceType: "",
    status: "all",
    startDate: "",
    endDate: "",
    entityId: undefined as number | undefined,
    projectId: undefined as number | undefined,
    accountName: "",
    search: "",
    page: 1,
    limit: 20,
  });

  const [formData, setFormData] = useState({
    entryType: "manual" as string,
    accountName: "",
    description: "",
    entryDirection: "debit" as "debit" | "credit",
    amount: "",
    entityName: "",
    invoiceNumber: "",
    transactionDate: new Date().toISOString().split('T')[0],
    dueDate: "",
    notes: "",
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
    queryKey: ["/api/general-ledger", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== "" && value !== undefined && value !== "all" && value !== "none") {
          params.append(key, value.toString());
        }
      });

      const response = await apiRequest("GET", `/api/general-ledger?${params}`);
      if (!response.ok) throw new Error("Failed to fetch general ledger entries");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const entries = entriesResponse?.data || [];
  const pagination = entriesResponse?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 };

  const { data: customersResponse } = useQuery<{ data: Customer[] }>({
    queryKey: ["/api/customers"],
    enabled: isAuthenticated,
  });

  const { data: suppliersResponse } = useQuery<{ data: Supplier[] }>({
    queryKey: ["/api/suppliers"],
    enabled: isAuthenticated,
  });

  const { data: projectsResponse } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/projects");
      if (!response.ok) throw new Error("Failed to fetch projects");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const customers = Array.isArray(customersResponse?.data) ? customersResponse.data : [];
  const suppliers = Array.isArray(suppliersResponse?.data) ? suppliersResponse.data : [];
  const projects = Array.isArray(projectsResponse) ? projectsResponse : [];

  // Common chart of accounts for autocomplete
  const accountOptions = [
    // Assets
    { value: "Cash", label: "Cash", searchText: "cash money bank" },
    { value: "Accounts Receivable", label: "Accounts Receivable", searchText: "receivable ar customer debt" },
    { value: "Inventory", label: "Inventory", searchText: "inventory stock goods" },
    { value: "Prepaid Expenses", label: "Prepaid Expenses", searchText: "prepaid advance payment" },
    { value: "Equipment", label: "Equipment", searchText: "equipment machinery tools" },
    { value: "Vehicles", label: "Vehicles", searchText: "vehicles cars trucks" },
    
    // Liabilities
    { value: "Accounts Payable", label: "Accounts Payable", searchText: "payable ap supplier debt" },
    { value: "Accrued Expenses", label: "Accrued Expenses", searchText: "accrued expenses liability" },
    { value: "Short-term Debt", label: "Short-term Debt", searchText: "debt loan liability" },
    { value: "Long-term Debt", label: "Long-term Debt", searchText: "debt loan liability mortgage" },
    
    // Equity
    { value: "Owner's Equity", label: "Owner's Equity", searchText: "equity capital ownership" },
    { value: "Retained Earnings", label: "Retained Earnings", searchText: "retained earnings profit" },
    
    // Revenue
    { value: "Service Revenue", label: "Service Revenue", searchText: "revenue income service" },
    { value: "Sales Revenue", label: "Sales Revenue", searchText: "sales revenue income" },
    { value: "Rental Income", label: "Rental Income", searchText: "rental income revenue" },
    { value: "Interest Income", label: "Interest Income", searchText: "interest income revenue" },
    { value: "Commission Income", label: "Commission Income", searchText: "commission income revenue" },
    { value: "Consulting Fees", label: "Consulting Fees", searchText: "consulting fees revenue" },
    
    // Expenses
    { value: "Office Expenses", label: "Office Expenses", searchText: "office expenses supplies" },
    { value: "Utilities", label: "Utilities", searchText: "utilities electricity water" },
    { value: "Professional Services", label: "Professional Services", searchText: "professional services legal accounting" },
    { value: "Insurance", label: "Insurance", searchText: "insurance coverage premium" },
    { value: "Maintenance & Repairs", label: "Maintenance & Repairs", searchText: "maintenance repairs upkeep" },
    { value: "Travel Expenses", label: "Travel Expenses", searchText: "travel expenses transportation" },
    { value: "Equipment Rental", label: "Equipment Rental", searchText: "equipment rental lease" },
    { value: "Fuel Expenses", label: "Fuel Expenses", searchText: "fuel gas diesel expenses" },
    { value: "Employee Benefits", label: "Employee Benefits", searchText: "benefits health insurance" },
    { value: "Training Expenses", label: "Training Expenses", searchText: "training education development" },
    { value: "Marketing Expenses", label: "Marketing Expenses", searchText: "marketing advertising promotion" },
    { value: "Depreciation Expense", label: "Depreciation Expense", searchText: "depreciation expense asset" },
  ];

  const createEntryMutation = useMutation({
    mutationFn: async (data: any) => {
      const entryData = {
        entryType: "manual",
        referenceType: "manual",
        accountName: data.accountName,
        description: data.description,
        debitAmount: data.entryDirection === "debit" ? data.amount : "0",
        creditAmount: data.entryDirection === "credit" ? data.amount : "0",
        entityName: data.entityName,
        invoiceNumber: data.invoiceNumber,
        transactionDate: data.transactionDate,
        dueDate: data.dueDate,
        status: "pending",
        notes: data.notes,
        projectId: data.projectId,
      };

      const response = await apiRequest("POST", "/api/general-ledger", entryData);
      if (!response.ok) throw new Error("Failed to create entry");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/general-ledger"] });
      toast({ title: "Success", description: "General ledger entry created successfully" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
      toast({ title: "Success", description: "General ledger entry updated successfully" });
      setIsDialogOpen(false);
      setEditingEntry(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      entryType: "manual",
      accountName: "",
      description: "",
      entryDirection: "debit",
      amount: "",
      entityName: "",
      invoiceNumber: "",
      transactionDate: new Date().toISOString().split('T')[0],
      dueDate: "",
      notes: "",
      projectId: undefined,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const amount = parseFloat(formData.amount || "0");
    
    if (amount === 0) {
      toast({ title: "Error", description: "Amount must be greater than 0", variant: "destructive" });
      return;
    }

    if (!formData.accountName || !formData.description || !formData.transactionDate) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    // Prepare the data for submission
    const submitData = {
      entryType: formData.entryType,
      referenceType: "manual",
      accountName: formData.accountName,
      description: formData.description,
      debitAmount: formData.entryDirection === "debit" ? amount.toString() : "0",
      creditAmount: formData.entryDirection === "credit" ? amount.toString() : "0",
      entityName: formData.entityName || null,
      invoiceNumber: formData.invoiceNumber || null,
      transactionDate: formData.transactionDate,
      dueDate: formData.dueDate || null,
      status: "pending",
      notes: formData.notes || null,
      projectId: formData.projectId || null,
    };

    if (editingEntry) {
      updateEntryMutation.mutate({ id: editingEntry.id, data: submitData });
    } else {
      createEntryMutation.mutate(submitData);
    }
  };

  const handleEdit = (entry: GeneralLedgerEntry) => {
    setEditingEntry(entry);
    const isDebit = parseFloat(entry.debitAmount) > 0;
    setFormData({
      entryType: entry.referenceType,
      accountName: entry.accountName,
      description: entry.description,
      entryDirection: isDebit ? "debit" : "credit",
      amount: isDebit ? entry.debitAmount : entry.creditAmount,
      entityName: entry.entityName || "",
      invoiceNumber: entry.invoiceNumber || "",
      transactionDate: entry.transactionDate,
      dueDate: entry.dueDate || "",
      notes: entry.notes || "",
      projectId: entry.projectId || undefined,
    });
    setIsDialogOpen(true);
  };

  const clearFilters = () => {
    setFilters({
      entryType: "all",
      referenceType: "",
      status: "all",
      startDate: "",
      endDate: "",
      entityId: undefined,
      projectId: undefined,
      accountName: "",
      search: "",
      page: 1,
      limit: 20,
    });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "paid": return "default";
      case "pending": return "secondary";
      case "overdue": return "destructive";
      case "cancelled": return "outline";
      default: return "secondary";
    }
  };

  const getEntryTypeBadgeVariant = (entryType: string) => {
    switch (entryType) {
      case "receivable": return "default";
      case "payable": return "secondary";
      case "manual": return "outline";
      default: return "secondary";
    }
  };

  const exportToCSV = () => {
    const headers = [
      "Date",
      "Type",
      "Account",
      "Description",
      "Entity",
      "Project",
      "Invoice #",
      "Debit",
      "Credit",
      "Status",
      "Notes"
    ];

    const csvData = entries.map(entry => [
      new Date(entry.transactionDate).toLocaleDateString(),
      entry.entryType,
      entry.accountName,
      entry.description,
      entry.entityName || "-",
      entry.projectTitle || "-",
      entry.invoiceNumber || "-",
      entry.debitAmount,
      entry.creditAmount,
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
    a.download = `general-ledger-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">General Ledger</h1>
          <p className="text-muted-foreground">
            View and manage all accounting entries
          </p>
        </div>
        <div className="flex gap-2">
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Filters</h4>
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="search">Search</Label>
                    <Input
                      id="search"
                      placeholder="Description, entity, invoice..."
                      value={filters.search}
                      onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="accountName">Account Name</Label>
                    <Input
                      id="accountName"
                      placeholder="Account name..."
                      value={filters.accountName}
                      onChange={(e) => setFilters(prev => ({ ...prev, accountName: e.target.value, page: 1 }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="entryType">Entry Type</Label>
                    <Select value={filters.entryType} onValueChange={(value) => setFilters(prev => ({ ...prev, entryType: value, page: 1 }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        <SelectItem value="receivable">Receivable</SelectItem>
                        <SelectItem value="payable">Payable</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value, page: 1 }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value, page: 1 }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value, page: 1 }))}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="projectId">Project</Label>
                  <Select value={filters.projectId?.toString() || "all"} onValueChange={(value) => setFilters(prev => ({ ...prev, projectId: value === "all" ? undefined : parseInt(value), page: 1 }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="All projects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All projects</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          {project.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingEntry(null); resetForm(); }}>
                <Plus className="h-4 w-4 mr-2" />
                New Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingEntry ? "Edit" : "Create"} General Ledger Entry
                </DialogTitle>
                <div className="text-sm text-muted-foreground">
                  <p>This creates a single journal entry. For complete double-entry accounting, create both debit and credit entries.</p>
                </div>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="accountName">Account Name</Label>
                    <Autocomplete
                      options={accountOptions}
                      value={formData.accountName}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, accountName: value }))}
                      placeholder="Search or type account name..."
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Label htmlFor="transactionDate">Transaction Date</Label>
                    <Input
                      id="transactionDate"
                      type="date"
                      value={formData.transactionDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, transactionDate: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="entryDirection">Entry Type</Label>
                    <Select value={formData.entryDirection} onValueChange={(value: "debit" | "credit") => setFormData(prev => ({ ...prev, entryDirection: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select entry type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="debit">Debit</SelectItem>
                        <SelectItem value="credit">Credit</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formData.entryDirection === "debit" ? "Increases assets/expenses, decreases liabilities/equity/revenue" : "Increases liabilities/equity/revenue, decreases assets/expenses"}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="entityName">Entity Name</Label>
                    <Input
                      id="entityName"
                      value={formData.entityName}
                      onChange={(e) => setFormData(prev => ({ ...prev, entityName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="invoiceNumber">Invoice Number</Label>
                    <Input
                      id="invoiceNumber"
                      value={formData.invoiceNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="projectId">Project</Label>
                    <Select value={formData.projectId?.toString() || "none"} onValueChange={(value) => setFormData(prev => ({ ...prev, projectId: value === "none" ? undefined : parseInt(value) }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No project</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id.toString()}>
                            {project.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                  />
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createEntryMutation.isPending || updateEntryMutation.isPending} className="w-full sm:w-auto">
                    {createEntryMutation.isPending || updateEntryMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>General Ledger Entries</span>
            <span className="text-sm font-normal text-muted-foreground">
              {pagination.total} total entries
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No entries found. Try adjusting your filters.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          {new Date(entry.transactionDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getEntryTypeBadgeVariant(entry.entryType)}>
                            {entry.entryType}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{entry.accountName}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {entry.description}
                        </TableCell>
                        <TableCell>{entry.entityName || "-"}</TableCell>
                        <TableCell>{entry.projectTitle || "-"}</TableCell>
                        <TableCell>{entry.invoiceNumber || "-"}</TableCell>
                        <TableCell className="text-right">
                          {parseFloat(entry.debitAmount) > 0 ? `$${parseFloat(entry.debitAmount).toFixed(2)}` : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {parseFloat(entry.creditAmount) > 0 ? `$${parseFloat(entry.creditAmount).toFixed(2)}` : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(entry.status)}>
                            {entry.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(entry)}
                          >
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
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
                  <span className="text-sm">
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
