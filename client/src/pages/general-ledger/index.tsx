import { formatDisplayDate } from "@/lib/utils";

import React, { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

  // Journal entry form (8.2). Starts with the two lines every journal needs.
  const emptyJournalLine = () => ({
    accountName: "",
    direction: "debit" as "debit" | "credit",
    amount: "",
    notes: "",
  });
  const [isJournalOpen, setIsJournalOpen] = useState(false);
  const [journalForm, setJournalForm] = useState({
    description: "",
    transactionDate: new Date().toISOString().split("T")[0],
    projectId: undefined as number | undefined,
    lines: [emptyJournalLine(), emptyJournalLine()],
  });

  const resetJournalForm = () =>
    setJournalForm({
      description: "",
      transactionDate: new Date().toISOString().split("T")[0],
      projectId: undefined,
      lines: [emptyJournalLine(), emptyJournalLine()],
    });

  const updateJournalLine = (index: number, field: string, value: any) =>
    setJournalForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l, i) => (i === index ? { ...l, [field]: value } : l)),
    }));

  const addJournalLine = () =>
    setJournalForm((prev) => ({ ...prev, lines: [...prev.lines, emptyJournalLine()] }));

  const removeJournalLine = (index: number) =>
    setJournalForm((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }));

  // Running totals — the whole point of the form. Debits must equal credits
  // before the ledger will accept the set.
  const journalTotals = (() => {
    let debit = 0;
    let credit = 0;
    for (const l of journalForm.lines) {
      const amt = parseFloat(l.amount || "0") || 0;
      if (l.direction === "debit") debit += amt;
      else credit += amt;
    }
    debit = Math.round(debit * 100) / 100;
    credit = Math.round(credit * 100) / 100;
    return { debit, credit, difference: Math.round((debit - credit) * 100) / 100 };
  })();

  const journalBlockers = (() => {
    const reasons: string[] = [];
    if (journalForm.lines.length < 2) reasons.push("At least 2 lines are required");
    if (journalForm.lines.some((l) => !l.accountName.trim()))
      reasons.push("Every line needs an account");
    if (journalForm.lines.some((l) => !(parseFloat(l.amount || "0") > 0)))
      reasons.push("Every line needs an amount greater than zero");
    if (!journalForm.description.trim()) reasons.push("A description is required");
    if (!journalForm.transactionDate) reasons.push("A date is required");
    if (journalTotals.difference !== 0) reasons.push("Debits must equal credits");
    return reasons;
  })();

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

  const { data: entriesResponse, isLoading, refetch } = useQuery<{
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

      const response = await apiRequest(`/api/general-ledger?${params}`);
      if (!response.ok) throw new Error("Failed to fetch general ledger entries");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  React.useEffect(() => {
    if (isAuthenticated) {
      refetch();
    }
  }, [isAuthenticated, refetch]);

  const entries = entriesResponse?.data || [];
  const pagination = entriesResponse?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 };

  const { data: customersResponse } = useQuery<{ data: Customer[] }>({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const response = await fetch("/api/customers?limit=1000");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const { data: suppliersResponse } = useQuery<{ data: Supplier[] }>({
    queryKey: ["/api/suppliers"],
    queryFn: async () => {
      const response = await fetch("/api/suppliers?limit=1000");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const { data: projectsResponse } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const response = await apiRequest("/api/projects");
      if (!response.ok) throw new Error("Failed to fetch projects");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const customers = Array.isArray(customersResponse?.data) ? customersResponse.data : [];
  const suppliers = Array.isArray(suppliersResponse?.data) ? suppliersResponse.data : [];
  const projects = Array.isArray(projectsResponse) ? projectsResponse : [];

  // Fetch chart of accounts from database
  const { data: chartOfAccountsData } = useQuery<{
    id: number;
    accountCode: string;
    accountName: string;
    accountType: string;
    accountCategory: string;
    description: string | null;
  }[]>({
    queryKey: ["/api/chart-of-accounts"],
    enabled: isAuthenticated,
  });

  // Convert chart of accounts to autocomplete options
  const accountOptions = (chartOfAccountsData || []).map(account => ({
    value: account.accountName,
    label: `${account.accountCode} - ${account.accountName}`,
    searchText: `${account.accountCode} ${account.accountName} ${account.accountType} ${account.accountCategory} ${account.description || ""}`,
  }));

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

      const response = await apiRequest("/api/general-ledger", { method: "POST", body: entryData });
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

  // ---- Journal entry (8.2): a balanced multi-line posting ------------------
  // Unlike the single-entry form above, this posts every line together through
  // /journal, which rejects the set unless debits equal credits. The old form
  // asks the user to remember to create the opposite side by hand; nothing
  // enforced it, so the ledger could be left permanently one-sided.
  const createJournalMutation = useMutation({
    mutationFn: async (data: typeof journalForm) => {
      const payload = {
        referenceType: "manual",
        description: data.description,
        transactionDate: data.transactionDate,
        entries: data.lines.map((l) => ({
          accountName: l.accountName,
          debitAmount: l.direction === "debit" ? l.amount : "0",
          creditAmount: l.direction === "credit" ? l.amount : "0",
          projectId: data.projectId,
          notes: l.notes || undefined,
        })),
      };
      const response = await apiRequest("/api/general-ledger/journal", {
        method: "POST",
        body: payload,
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to post journal entry");
      }
      return response.json();
    },
    onSuccess: (rows: any[]) => {
      queryClient.invalidateQueries({ queryKey: ["/api/general-ledger"] });
      toast({
        title: "Journal posted",
        description: `${rows?.length ?? 0} balanced lines posted to the ledger.`,
      });
      setIsJournalOpen(false);
      resetJournalForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateEntryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest(`/api/general-ledger/${id}`, { method: "PUT", body: data });
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
      "Created",
      "Value Date",
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
      formatDisplayDate(entry.createdAt),
      formatDisplayDate(entry.transactionDate),
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

          <Dialog
            open={isJournalOpen}
            onOpenChange={(open) => {
              setIsJournalOpen(open);
              if (!open) resetJournalForm();
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Journal Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>New Journal Entry</DialogTitle>
                <div className="text-sm text-muted-foreground">
                  <p>
                    A balanced double-entry posting. All lines are posted together —
                    the ledger will reject the entry unless debits equal credits.
                  </p>
                </div>
              </DialogHeader>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (journalBlockers.length > 0) {
                    toast({
                      title: "Cannot post this entry",
                      description: journalBlockers[0],
                      variant: "destructive",
                    });
                    return;
                  }
                  createJournalMutation.mutate(journalForm);
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="journalDescription">Description *</Label>
                    <Input
                      id="journalDescription"
                      value={journalForm.description}
                      onChange={(e) =>
                        setJournalForm((prev) => ({ ...prev, description: e.target.value }))
                      }
                      placeholder="e.g. Provident fund payout"
                    />
                  </div>
                  <div>
                    <Label htmlFor="journalDate">Transaction Date *</Label>
                    <Input
                      id="journalDate"
                      type="date"
                      value={journalForm.transactionDate}
                      onChange={(e) =>
                        setJournalForm((prev) => ({
                          ...prev,
                          transactionDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Lines</Label>
                  {journalForm.lines.map((line, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-12 gap-2 items-center border rounded-md p-2"
                    >
                      <div className="col-span-5">
                        <Autocomplete
                          options={accountOptions}
                          value={line.accountName}
                          onValueChange={(v) => updateJournalLine(index, "accountName", v)}
                          placeholder="Account..."
                          className="w-full"
                        />
                      </div>
                      <div className="col-span-3">
                        <Select
                          value={line.direction}
                          onValueChange={(v) => updateJournalLine(index, "direction", v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="debit">Debit</SelectItem>
                            <SelectItem value="credit">Credit</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-3">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.amount}
                          onChange={(e) => updateJournalLine(index, "amount", e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={journalForm.lines.length <= 2}
                          onClick={() => removeJournalLine(index)}
                          title={
                            journalForm.lines.length <= 2
                              ? "A journal needs at least 2 lines"
                              : "Remove line"
                          }
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addJournalLine}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Line
                  </Button>
                </div>

                {/* Running totals — the balance check, always visible */}
                <div className="rounded-md border p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Total Debits</span>
                    <span className="font-mono">{journalTotals.debit.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Credits</span>
                    <span className="font-mono">{journalTotals.credit.toFixed(2)}</span>
                  </div>
                  <div
                    className={`flex justify-between font-medium ${
                      journalTotals.difference === 0 ? "text-green-600" : "text-destructive"
                    }`}
                  >
                    <span>
                      {journalTotals.difference === 0 ? "Balanced" : "Out of balance by"}
                    </span>
                    <span className="font-mono">
                      {journalTotals.difference === 0
                        ? "0.00"
                        : Math.abs(journalTotals.difference).toFixed(2)}
                    </span>
                  </div>
                </div>

                {journalBlockers.length > 0 && (
                  <p className="text-sm text-muted-foreground">{journalBlockers[0]}</p>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsJournalOpen(false);
                      resetJournalForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      journalBlockers.length > 0 || createJournalMutation.isPending
                    }
                  >
                    {createJournalMutation.isPending ? "Posting..." : "Post Journal Entry"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                      step="any"
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
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="text-muted-foreground">Loading entries...</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Created</TableHead>
                      <TableHead>Value Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                          No entries found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      entries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="whitespace-nowrap">
                            {formatDisplayDate(entry.createdAt)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {formatDisplayDate(entry.transactionDate)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getEntryTypeBadgeVariant(entry.entryType)}>
                              {entry.entryType}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{entry.accountName}</TableCell>
                          <TableCell className="max-w-[200px]">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="truncate cursor-help">
                                    {entry.description}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[400px] break-words">
                                  <p>{entry.description}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell>{entry.entityName || "-"}</TableCell>
                          <TableCell>{entry.projectTitle || "-"}</TableCell>
                          <TableCell>{entry.invoiceNumber || "-"}</TableCell>
                          <TableCell className="text-right">
                            {parseFloat(entry.debitAmount) > 0 ? `AED ${parseFloat(entry.debitAmount).toFixed(2)}` : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {parseFloat(entry.creditAmount) > 0 ? `AED ${parseFloat(entry.creditAmount).toFixed(2)}` : "-"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {pagination.totalPages > 1 && (
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
