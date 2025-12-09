import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Autocomplete } from "@/components/ui/autocomplete";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, FileText, DollarSign, Filter, Upload, Download, Trash2, Eye, Calendar, TrendingUp, CreditCard, AlertCircle, CheckCircle2, Printer, Package, Briefcase } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Supplier {
  id: number;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
}

interface PurchaseInvoice {
  id: number;
  invoiceNumber: string;
  supplierId: number;
  supplierName: string;
  poId?: number;
  poNumber?: string;
  status: "pending" | "paid" | "partially_paid" | "overdue";
  approvalStatus?: "pending" | "approved" | "rejected";
  invoiceDate: string;
  dueDate: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  paidAmount: string;
  paymentTerms?: string;
  bankAccount?: string;
  notes?: string;
  items?: PurchaseInvoiceItem[];
  payments?: Payment[];
  approvedBy?: number;
  approvedAt?: string;
}

interface PurchaseInvoiceItem {
  id: number;
  itemType: "product" | "service";
  inventoryItemId?: number;
  inventoryItemName?: string;
  inventoryItemUnit?: string;
  description?: string;
  quantity: number;
  unitPrice: string;
  taxAmount?: string;
  lineTotal: string;
}

interface Payment {
  id: number;
  amount: string;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber?: string;
  notes?: string;
  recordedBy: number;
  recordedAt: string;
  files?: PaymentFile[];
  paymentType?: string;
  creditNoteNumber?: string;
}

interface PaymentFile {
  id: number;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

interface PurchaseInvoiceStats {
  totalInvoices: number;
  totalAmount: string;
  paidAmount: string;
  pendingAmount: string;
  overdueCount: number;
  overdueAmount: string;
  pendingApprovalCount: number;
}

export default function PurchaseInvoicesIndex() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<PurchaseInvoice | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedInvoiceForCreditNote, setSelectedInvoiceForCreditNote] = useState<any>(null);
  const [isCreateCreditNoteOpen, setIsCreateCreditNoteOpen] = useState(false);

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    supplierId: undefined as number | undefined,
    status: undefined as string | undefined,
  });

  const [formData, setFormData] = useState({
    supplierId: "",
    projectId: "",
    assetInventoryInstanceId: "",
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: "",
    paymentTerms: "Net 30 days",
    bankAccount: "",
    notes: "",
  });

  const [invoiceItems, setInvoiceItems] = useState<{
    itemType: "product" | "service";
    inventoryItemId?: string;
    description?: string;
    quantity: string;
    unitPrice: string;
    taxRate: string;
  }[]>([]);

  const [newItem, setNewItem] = useState({
    itemType: "product" as "product" | "service",
    inventoryItemId: "",
    description: "",
    quantity: "1",
    unitPrice: "0",
    taxRate: "0",
  });

  const [paymentData, setPaymentData] = useState({
    amount: "",
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: "bank_transfer",
    referenceNumber: "",
    notes: "",
  });

  const [paymentFiles, setPaymentFiles] = useState<FileList | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    } else if (
      user?.role !== "admin" &&
      user?.role !== "finance" &&
      user?.role !== "project_manager"
    ) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user, setLocation]);

  // Fetch purchase invoices
  const { data: invoices, isLoading } = useQuery<PurchaseInvoice[]>({
    queryKey: ["/api/purchase-invoices", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.supplierId) params.append("supplierId", filters.supplierId.toString());
      if (filters.status) params.append("status", filters.status);

      const response = await apiRequest(`/api/purchase-invoices?${params}`, { method: "GET" });
      if (!response.ok) throw new Error("Failed to fetch purchase invoices");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  // Fetch suppliers
  const { data: suppliersResponse } = useQuery<{ data: Supplier[] }>({
    queryKey: ["/api/suppliers"],
    enabled: isAuthenticated,
  });

  // Fetch inventory items
  const { data: inventoryResponse } = useQuery<{ data: any[] }>({
    queryKey: ["/api/inventory"],
    enabled: isAuthenticated,
  });

  // Fetch projects
  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ["/api/projects"],
    enabled: isAuthenticated,
  });

  // Fetch asset instances
  const { data: assetInstances = [] } = useQuery<any[]>({
    queryKey: ["/api/asset-inventory/instances"],
    enabled: isAuthenticated,
  });

  const suppliers = Array.isArray(suppliersResponse?.data) ? suppliersResponse.data : [];
  const inventoryItems = Array.isArray(inventoryResponse?.data) ? inventoryResponse.data : [];

  // Calculate statistics
  const stats: PurchaseInvoiceStats = React.useMemo(() => {
    if (!invoices || invoices.length === 0) {
      return {
        totalInvoices: 0,
        totalAmount: "0",
        paidAmount: "0",
        pendingAmount: "0",
        overdueCount: 0,
        overdueAmount: "0",
        pendingApprovalCount: 0,
      };
    }

    // Only count approved invoices for financial metrics
    const approvedInvoices = invoices.filter(inv => inv.approvalStatus === "approved");
    const pendingApprovalInvoices = invoices.filter(inv => inv.approvalStatus === "pending");

    const totalInvoices = approvedInvoices.length;
    const totalAmount = approvedInvoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount || "0"), 0);
    const paidAmount = approvedInvoices.reduce((sum, inv) => sum + parseFloat(inv.paidAmount || "0"), 0);
    const pendingAmount = totalAmount - paidAmount;

    const overdueInvoices = approvedInvoices.filter(inv => {
      const dueDate = new Date(inv.dueDate);
      const today = new Date();
      return inv.status !== "paid" && dueDate < today;
    });

    const overdueCount = overdueInvoices.length;
    const overdueAmount = overdueInvoices.reduce((sum, inv) =>
      sum + (parseFloat(inv.totalAmount || "0") - parseFloat(inv.paidAmount || "0")), 0
    );

    return {
      totalInvoices,
      totalAmount: totalAmount.toFixed(2),
      paidAmount: paidAmount.toFixed(2),
      pendingAmount: pendingAmount.toFixed(2),
      overdueCount,
      overdueAmount: overdueAmount.toFixed(2),
      pendingApprovalCount: pendingApprovalInvoices.length,
    };
  }, [invoices]);

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: any) => {
      const items = invoiceItems.map(item => {
        const lineSubtotal = parseInt(item.quantity) * parseFloat(item.unitPrice);
        const lineTaxAmount = lineSubtotal * (parseFloat(item.taxRate) / 100);
        return {
          itemType: item.itemType,
          inventoryItemId: item.inventoryItemId ? parseInt(item.inventoryItemId) : null,
          description: item.description || null,
          quantity: parseInt(item.quantity),
          unitPrice: parseFloat(item.unitPrice),
          taxRate: parseFloat(item.taxRate),
          taxAmount: lineTaxAmount,
          lineTotal: (lineSubtotal + lineTaxAmount).toFixed(2),
        };
      });

      const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      const calculatedTaxAmount = items.reduce((sum, item) => sum + item.taxAmount, 0);
      const totalAmount = subtotal + calculatedTaxAmount;

      const invoiceData = {
        supplierId: parseInt(formData.supplierId),
        projectId: formData.projectId ? parseInt(formData.projectId) : null,
        assetInventoryInstanceId: formData.assetInventoryInstanceId ? parseInt(formData.assetInventoryInstanceId) : null,
        invoiceDate: formData.invoiceDate,
        dueDate: formData.dueDate,
        paymentTerms: formData.paymentTerms,
        bankAccount: formData.bankAccount,
        notes: formData.notes,
        subtotal: subtotal.toFixed(2),
        taxAmount: calculatedTaxAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        items,
      };

      const response = await apiRequest("/api/purchase-invoices", { method: "POST", body: invoiceData });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create purchase invoice");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-invoices"] });
      toast({
        title: "Invoice Created",
        description: "Purchase invoice has been created successfully.",
      });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create purchase invoice",
        variant: "destructive",
      });
    },
  });

  const approveInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      const response = await apiRequest(`/api/purchase-invoices/${invoiceId}/approve`, {
        method: "PATCH",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to approve invoice");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-invoices"] });
      toast({
        title: "Invoice Approved",
        description: "Purchase invoice has been approved successfully.",
      });
      setIsViewDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve invoice",
        variant: "destructive",
      });
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!viewingInvoice) throw new Error("No invoice selected");

      const formDataObj = new FormData();
      formDataObj.append("amount", paymentData.amount);
      formDataObj.append("paymentDate", paymentData.paymentDate);
      formDataObj.append("paymentMethod", paymentData.paymentMethod);
      formDataObj.append("referenceNumber", paymentData.referenceNumber);
      formDataObj.append("notes", paymentData.notes);

      if (paymentFiles) {
        for (let i = 0; i < paymentFiles.length; i++) {
          formDataObj.append("paymentFiles", paymentFiles[i]);
        }
      }

      const response = await fetch(`/api/purchase-invoices/${viewingInvoice.id}/payments`, {
        method: "POST",
        body: formDataObj,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to record payment");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-invoices"] });
      toast({
        title: "Payment Recorded",
        description: "Payment has been recorded successfully.",
      });
      setIsPaymentDialogOpen(false);
      setIsViewDialogOpen(false);
      resetPaymentForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record payment",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      supplierId: "",
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: "",
      paymentTerms: "Net 30 days",
      bankAccount: "",
      notes: "",
    });
    setInvoiceItems([]);
    setNewItem({
      itemType: "product",
      inventoryItemId: "",
      description: "",
      quantity: "1",
      unitPrice: "0",
      taxRate: "0",
    });
  };

  const resetPaymentForm = () => {
    setPaymentData({
      amount: "",
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: "bank_transfer",
      referenceNumber: "",
      notes: "",
    });
    setPaymentFiles(null);
  };

  const addItem = () => {
    // Validate based on item type
    if (newItem.itemType === "product") {
      if (!newItem.inventoryItemId || !newItem.quantity || !newItem.unitPrice) {
        toast({
          title: "Error",
          description: "Please fill in all item fields",
          variant: "destructive",
        });
        return;
      }

      if (invoiceItems.some(item => item.itemType === "product" && item.inventoryItemId === newItem.inventoryItemId)) {
        toast({
          title: "Error",
          description: "This item is already in the invoice",
          variant: "destructive",
        });
        return;
      }
    } else {
      // Service item validation
      if (!newItem.description || !newItem.quantity || !newItem.unitPrice) {
        toast({
          title: "Error",
          description: "Please enter description, quantity, and unit price for service",
          variant: "destructive",
        });
        return;
      }
    }

    setInvoiceItems(prev => [...prev, { ...newItem }]);
    setNewItem({
      itemType: "product",
      inventoryItemId: "",
      description: "",
      quantity: "1",
      unitPrice: "0",
      taxRate: "0",
    });
  };

  const removeItem = (index: number) => {
    setInvoiceItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.supplierId) {
      toast({
        title: "Error",
        description: "Please select a supplier",
        variant: "destructive",
      });
      return;
    }

    if (invoiceItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item",
        variant: "destructive",
      });
      return;
    }

    createInvoiceMutation.mutate(formData);
  };

  const viewInvoice = async (invoice: PurchaseInvoice) => {
    try {
      // Fetch full invoice details including items
      const invoiceResponse = await apiRequest(`/api/purchase-invoices/${invoice.id}`, { method: "GET" });
      if (!invoiceResponse.ok) {
        throw new Error("Failed to load invoice details");
      }
      const fullInvoice = await invoiceResponse.json();

      // Fetch payment history
      const paymentsResponse = await apiRequest(`/api/purchase-invoices/${invoice.id}/payments`, { method: "GET" });
      if (paymentsResponse.ok) {
        const payments = await paymentsResponse.json();
        fullInvoice.payments = payments;
      }

      // Fetch linked project details if projectId exists
      if (fullInvoice.projectId) {
        const projectResponse = await apiRequest(`/api/projects/${fullInvoice.projectId}`, { method: "GET" });
        if (projectResponse.ok) {
          const project = await projectResponse.json();
          fullInvoice.projectTitle = project.title;
        }
      }

      // Fetch linked asset instance details if assetInventoryInstanceId exists
      if (fullInvoice.assetInventoryInstanceId) {
        const assetResponse = await apiRequest(`/api/asset-inventory/instances/${fullInvoice.assetInventoryInstanceId}`, { method: "GET" });
        if (assetResponse.ok) {
          const asset = await assetResponse.json();
          fullInvoice.assetTag = asset.assetTag;
          fullInvoice.assetTypeName = asset.assetTypeName;
        }
      }

      setViewingInvoice(fullInvoice);
      setIsViewDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load invoice details",
        variant: "destructive",
      });
    }
  };

  const handleRecordPayment = () => {
    if (!paymentData.amount || parseFloat(paymentData.amount) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      });
      return;
    }

    recordPaymentMutation.mutate();
  };

  const applyFilters = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/purchase-invoices"] });
    setIsFilterOpen(false);
  };

  const clearFilters = () => {
    setFilters({
      startDate: "",
      endDate: "",
      supplierId: undefined,
      status: undefined,
    });
    queryClient.invalidateQueries({ queryKey: ["/api/purchase-invoices"] });
    setIsFilterOpen(false);
  };

  const getItemName = (itemId: string) => {
    const item = inventoryItems.find(item => item.id === parseInt(itemId));
    return item ? item.name : "Unknown Item";
  };

  const getItemUnit = (itemId: string) => {
    const item = inventoryItems.find(item => item.id === parseInt(itemId));
    return item ? item.unit : "";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Paid
        </Badge>;
      case "partially_paid":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          <CreditCard className="w-3 h-3 mr-1" />
          Partially Paid
        </Badge>;
      case "pending":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300">
          <Calendar className="w-3 h-3 mr-1" />
          Pending
        </Badge>;
      case "overdue":
        return <Badge variant="destructive" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          <AlertCircle className="w-3 h-3 mr-1" />
          Overdue
        </Badge>;
      default:
        return null;
    }
  };

  const canEdit = user?.role === "admin" || user?.role === "finance";

  if (!isAuthenticated) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Purchase Invoices</h1>
          <p className="text-muted-foreground">Manage your supplier invoices and payments</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 sm:w-96" align="end">
              <div className="space-y-4">
                <h4 className="font-medium">Filter Purchase Invoices</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                  <Label htmlFor="supplierFilter">Supplier</Label>
                  <Autocomplete
                    options={suppliers.map((supplier) => ({
                      value: supplier.id.toString(),
                      label: supplier.name,
                      searchText: supplier.name
                    }))}
                    value={filters.supplierId?.toString() || ""}
                    onValueChange={(value) => setFilters(prev => ({
                      ...prev,
                      supplierId: value ? parseInt(value) : undefined
                    }))}
                    placeholder="Select supplier..."
                  />
                </div>
                <div>
                  <Label htmlFor="statusFilter">Status</Label>
                  <Select
                    value={filters.status || "all"}
                    onValueChange={(value) =>
                      setFilters(prev => ({
                        ...prev,
                        status: value === "all" ? undefined : value
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="partially_paid">Partially Paid</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button onClick={applyFilters} className="flex-1">Apply</Button>
                  <Button onClick={clearFilters} variant="outline" className="flex-1">Clear</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          {canEdit && (
            <Button onClick={() => setIsDialogOpen(true)} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              New Invoice
            </Button>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">Approved Invoices</CardTitle>
            <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.totalInvoices}</div>
            <p className="text-xs text-blue-600 dark:text-blue-400">Approved invoices</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">Total Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">${stats.totalAmount}</div>
            <p className="text-xs text-green-600 dark:text-green-400">Approved invoices</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 border-yellow-200 dark:border-yellow-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Pending Amount</CardTitle>
            <TrendingUp className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">${stats.pendingAmount}</div>
            <p className="text-xs text-yellow-600 dark:text-yellow-400">Outstanding payments</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-900 dark:text-red-100">{stats.overdueCount}</div>
            <p className="text-xs text-red-600 dark:text-red-400">${stats.overdueAmount} overdue</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">Pending Approval</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{stats.pendingApprovalCount}</div>
            <p className="text-xs text-purple-600 dark:text-purple-400">Awaiting approval</p>
          </CardContent>
        </Card>
      </div>

      {/* Invoice List */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading purchase invoices...</p>
          </div>
        </div>
      ) : !invoices || invoices.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No purchase invoices found</h3>
            <p className="text-gray-500 mb-4">Get started by creating your first purchase invoice.</p>
            {canEdit && (
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Purchase Invoice
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left p-4 font-medium text-gray-600 dark:text-gray-400">Invoice #</th>
                        <th className="text-left p-4 font-medium text-gray-600 dark:text-gray-400">Supplier</th>
                        <th className="text-left p-4 font-medium text-gray-600 dark:text-gray-400">Date</th>
                        <th className="text-left p-4 font-medium text-gray-600 dark:text-gray-400">Due Date</th>
                        <th className="text-right p-4 font-medium text-gray-600 dark:text-gray-400">Amount</th>
                        <th className="text-right p-4 font-medium text-gray-600 dark:text-gray-400">Paid</th>
                        <th className="text-center p-4 font-medium text-gray-600 dark:text-gray-400">Status</th>
                        <th className="text-right p-4 font-medium text-gray-600 dark:text-gray-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <tr
                          key={invoice.id}
                          className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                        >
                          <td className="p-4">
                            <div className="font-medium">{invoice.invoiceNumber}</div>
                            {invoice.poNumber && (
                              <div className="text-sm text-gray-500">PO: {invoice.poNumber}</div>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="font-medium">{invoice.supplierName}</div>
                          </td>
                          <td className="p-4">
                            <div className="text-sm">{new Date(invoice.invoiceDate).toLocaleDateString()}</div>
                          </td>
                          <td className="p-4">
                            <div className="text-sm">{new Date(invoice.dueDate).toLocaleDateString()}</div>
                          </td>
                          <td className="p-4 text-right">
                            <div className="font-semibold">${invoice.totalAmount}</div>
                          </td>
                          <td className="p-4 text-right">
                            <div className="font-medium text-green-600">${invoice.paidAmount}</div>
                          </td>
                          <td className="p-4 text-center">
                            {getStatusBadge(invoice.status)}
                          </td>
                          <td className="p-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => viewInvoice(invoice)}
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => {
                                setSelectedInvoiceForCreditNote(invoice);
                                setIsCreateCreditNoteOpen(true);
                              }}
                              variant="ghost"
                              size="sm"
                              title="Create Credit Note"
                            >
                              <CreditCard className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mobile Cards */}
          <div className="grid gap-4 md:hidden">
            {invoices.map((invoice) => (
              <Card
                key={invoice.id}
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                onClick={() => viewInvoice(invoice)}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium truncate">
                    {invoice.invoiceNumber}
                  </CardTitle>
                  {getStatusBadge(invoice.status)}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Supplier:</span>
                      <p className="font-medium">{invoice.supplierName}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="font-medium text-gray-600 dark:text-gray-400">Invoice Date:</span>
                        <p>{new Date(invoice.invoiceDate).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600 dark:text-gray-400">Due Date:</span>
                        <p>{new Date(invoice.dueDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="font-medium text-gray-600 dark:text-gray-400">Amount:</span>
                        <p className="font-semibold text-lg">${invoice.totalAmount}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600 dark:text-gray-400">Paid:</span>
                        <p className="font-semibold text-green-600">${invoice.paidAmount}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Create Invoice Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0 border-b pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold">Create Purchase Invoice</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">Enter invoice details and add line items</p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <form onSubmit={handleSubmit} className="space-y-6 p-1">
              {/* Invoice Header Section */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    InvoiceDetails
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="supplierId" className="text-sm font-medium">
                        Supplier <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={formData.supplierId}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, supplierId: value }))}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Choose supplier..." />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id.toString()}>
                              <div className="flex flex-col">
                                <span className="font-medium">{supplier.name}</span>
                                {supplier.email && (
                                  <span className="text-xs text-muted-foreground">{supplier.email}</span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="project" className="text-sm font-medium">
                        Link to Project (Optional)
                      </Label>
                      <Autocomplete
                        options={projects.map((project: any) => ({
                          value: project.id.toString(),
                          label: project.title,
                          searchText: project.title
                        }))}
                        value={formData.projectId}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, projectId: value, assetInventoryInstanceId: "" }))}
                        placeholder="Search projects..."
                        emptyMessage="No projects found"
                      />
                      <p className="text-xs text-muted-foreground">
                        Cost will be added to project's actual cost upon approval
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="asset" className="text-sm font-medium">
                        Link to Asset Instance (Optional)
                      </Label>
                      <Autocomplete
                        options={assetInstances.map((asset: any) => ({
                          value: asset.id.toString(),
                          label: `${asset.assetTag} - ${asset.assetTypeName || 'Asset'}`,
                          searchText: `${asset.assetTag} ${asset.assetTypeName || ''} ${asset.serialNumber || ''}`
                        }))}
                        value={formData.assetInventoryInstanceId}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, assetInventoryInstanceId: value, projectId: "" }))}
                        placeholder="Search assets..."
                        emptyMessage="No assets found"
                      />
                      <p className="text-xs text-muted-foreground">
                        A maintenance record will be created upon approval
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="invoiceDate" className="text-sm font-medium">
                        Invoice Date <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="invoiceDate"
                          type="date"
                          value={formData.invoiceDate}
                          onChange={(e) => setFormData(prev => ({ ...prev, invoiceDate: e.target.value }))}
                          className="h-10"
                        />
                        <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dueDate" className="text-sm font-medium">
                        Due Date <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="dueDate"
                          type="date"
                          value={formData.dueDate}
                          onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                          className="h-10"
                        />
                        <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="paymentTerms" className="text-sm font-medium">Payment Terms</Label>
                      <Input
                        id="paymentTerms"
                        value={formData.paymentTerms}
                        onChange={(e) => setFormData(prev => ({ ...prev, paymentTerms: e.target.value }))}
                        placeholder="e.g., Net 30 days"
                        className="h-10"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bankAccount" className="text-sm font-medium">Bank Account Details (Optional)</Label>
                      <Textarea
                        id="bankAccount"
                        value={formData.bankAccount}
                        onChange={(e) => setFormData(prev => ({ ...prev, bankAccount: e.target.value }))}
                        placeholder="Bank name, account number, SWIFT/IBAN, etc."
                        className="min-h-[80px] resize-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Additional notes or comments..."
                        className="min-h-[80px] resize-none"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Line Items Section */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      Line Items
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {invoiceItems.length} item{invoiceItems.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add Item Form */}
                  <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50/50 dark:bg-gray-800/50">
                    <h4 className="font-medium mb-3 text-sm">Add New Item</h4>
                    <div className="space-y-3">
                      {/* Item Type Selector */}
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">ITEM TYPE</Label>
                        <Select
                          value={newItem.itemType}
                          onValueChange={(value: "product" | "service") => setNewItem(prev => ({ 
                            ...prev, 
                            itemType: value,
                            inventoryItemId: "",
                            description: "",
                            unitPrice: "0"
                          }))}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="product">Product (from Inventory)</SelectItem>
                            <SelectItem value="service">Service (Manual Entry)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Conditional Fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                        {newItem.itemType === "product" ? (
                          <div className="lg:col-span-2">
                            <Label className="text-xs font-medium text-muted-foreground">INVENTORY ITEM</Label>
                            <Autocomplete
                              options={(inventoryItems || []).map((item) => ({
                                value: item.id.toString(),
                                label: `${item.name}`,
                                searchText: `${item.name} ${item.unit}`
                              }))}
                              value={newItem.inventoryItemId || ""}
                              onValueChange={(value) => setNewItem(prev => ({ ...prev, inventoryItemId: value }))}
                              placeholder="Search inventory items..."
                            />
                          </div>
                        ) : (
                          <div className="lg:col-span-2">
                            <Label className="text-xs font-medium text-muted-foreground">DESCRIPTION</Label>
                            <Input
                              value={newItem.description || ""}
                              onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                              placeholder="Enter service description"
                              className="h-9"
                            />
                          </div>
                        )}

                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">QUANTITY</Label>
                          <Input
                            type="number"
                            min="1"
                            value={newItem.quantity}
                            onChange={(e) => setNewItem(prev => ({ ...prev, quantity: e.target.value }))}
                            placeholder="0"
                            className="h-9"
                          />
                        </div>

                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">UNIT PRICE</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={newItem.unitPrice}
                            onChange={(e) => setNewItem(prev => ({ ...prev, unitPrice: e.target.value }))}
                            placeholder="0.00"
                            className="h-9"
                          />
                        </div>

                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">TAX (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={newItem.taxRate}
                            onChange={(e) => setNewItem(prev => ({ ...prev, taxRate: e.target.value }))}
                            placeholder="0"
                            className="h-9"
                          />
                        </div>

                        <div className="flex items-end">
                          <Button type="button" onClick={addItem} className="w-full h-9" size="sm">
                            <Plus className="w-4 h-4 mr-1" />
                            Add
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Items List */}
                  {invoiceItems.length > 0 ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
                        <div className="col-span-1">TYPE</div>
                        <div className="col-span-3">ITEM</div>
                        <div className="col-span-2 text-center">QUANTITY</div>
                        <div className="col-span-2 text-right">UNIT PRICE</div>
                        <div className="col-span-1 text-center">TAX</div>
                        <div className="col-span-2 text-right">TOTAL</div>
                        <div className="col-span-1"></div>
                      </div>

                      {invoiceItems.map((item, index) => {
                        const lineSubtotal = parseInt(item.quantity) * parseFloat(item.unitPrice);
                        const lineTax = lineSubtotal * (parseFloat(item.taxRate) / 100);
                        const lineTotal = lineSubtotal + lineTax;

                        return (
                          <div key={index} className="grid grid-cols-12 gap-2 items-center py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 rounded-lg px-2">
                            <div className="col-span-1">
                              <Badge variant={item.itemType === "product" ? "default" : "secondary"} className="text-xs">
                                {item.itemType === "product" ? "Product" : "Service"}
                              </Badge>
                            </div>
                            <div className="col-span-3">
                              <div className="font-medium text-sm">
                                {item.itemType === "product" ? getItemName(item.inventoryItemId || "") : item.description}
                              </div>
                              {item.itemType === "product" && (
                                <div className="text-xs text-muted-foreground">{getItemUnit(item.inventoryItemId || "")}</div>
                              )}
                            </div>
                            <div className="col-span-2 text-center">
                              <span className="font-medium">{item.quantity}</span>
                            </div>
                            <div className="col-span-2 text-right">
                              <span className="font-medium">${parseFloat(item.unitPrice).toFixed(2)}</span>
                            </div>
                            <div className="col-span-1 text-center">
                              <Badge variant="outline" className="text-xs">{item.taxRate}%</Badge>
                            </div>
                            <div className="col-span-2 text-right">
                              <span className="font-semibold text-green-600">${lineTotal.toFixed(2)}</span>
                            </div>
                            <div className="col-span-1 flex justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeItem(index)}
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No items added yet</p>
                      <p className="text-xs">Use the form above to add invoice items</p>
                    </div>
                  )}

                  {/* Invoice Summary */}
                  {invoiceItems.length > 0 && (
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg p-4 border">
                      <h4 className="font-semibold mb-3 text-sm">Invoice Summary</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span className="font-medium">${invoiceItems.reduce((sum, item) => {
                            const quantity = parseInt(item.quantity) || 0;
                            const unitPrice = parseFloat(item.unitPrice) || 0;
                            return sum + (quantity * unitPrice);
                          }, 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Tax Amount:</span>
                          <span className="font-medium">${invoiceItems.reduce((sum, item) => {
                            const quantity = parseInt(item.quantity) || 0;
                            const unitPrice = parseFloat(item.unitPrice) || 0;
                            const taxRate = parseFloat(item.taxRate) || 0;
                            const lineSubtotal = quantity * unitPrice;
                            return sum + (lineSubtotal * taxRate / 100);
                          }, 0).toFixed(2)}</span>
                        </div>
                        <div className="border-t pt-2">
                          <div className="flex justify-between text-lg font-bold">
                            <span>Total Amount:</span>
                            <span className="text-green-600">${invoiceItems.reduce((sum, item) => {
                              const quantity = parseInt(item.quantity) || 0;
                              const unitPrice = parseFloat(item.unitPrice) || 0;
                              const taxRate = parseFloat(item.taxRate) || 0;
                              const lineSubtotal = quantity * unitPrice;
                              const lineTax = lineSubtotal * taxRate / 100;
                              return sum + lineSubtotal + lineTax;
                            }, 0).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </form>
          </div>

          {/* Footer Actions */}
          <div className="flex-shrink-0 border-t pt-4 mt-6">
            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="sm:w-auto order-2 sm:order-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createInvoiceMutation.isPending || !formData.supplierId || invoiceItems.length === 0}
                className="sm:w-auto order-1 sm:order-2"
              >
                {createInvoiceMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Creating Invoice...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Create Invoice
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Invoice Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          {viewingInvoice && (
            <div className="space-y-6 print:space-y-4">
              {/* Header with Icon Badge and Print Button */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4 print:border-b-2 print:border-black">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900 rounded-lg print:bg-blue-100">
                    <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400 print:text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white print:text-black">
                      {viewingInvoice.invoiceNumber}
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 print:text-gray-700">
                      Purchase Invoice
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 print:hidden w-full sm:w-auto">
                  <Badge 
                    variant={
                      viewingInvoice.approvalStatus === "approved" ? "default" :
                      viewingInvoice.approvalStatus === "rejected" ? "destructive" :
                      "secondary"
                    }
                    className="text-xs sm:text-sm flex-1 sm:flex-none justify-center"
                  >
                    {viewingInvoice.approvalStatus === "approved" ? "✓ Approved" :
                     viewingInvoice.approvalStatus === "rejected" ? "✗ Rejected" :
                     "⏳ Pending"}
                  </Badge>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => window.print()}
                    data-testid="button-print-invoice"
                    className="h-9 w-9"
                  >
                    <Printer className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Invoice Information Card */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 sm:p-6 print:bg-white print:border print:border-gray-300">
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-white print:text-black flex items-center gap-2">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                  Invoice Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 print:text-gray-700 mb-1">Supplier</p>
                    <p className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white print:text-black break-words">{viewingInvoice.supplierName}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 print:text-gray-700 mb-1">Invoice Date</p>
                    <p className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white print:text-black">
                      {new Date(viewingInvoice.invoiceDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 print:text-gray-700 mb-1">Due Date</p>
                    <p className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white print:text-black">
                      {new Date(viewingInvoice.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 print:text-gray-700 mb-1">Payment Status</p>
                    <div className="print:inline-block">{getStatusBadge(viewingInvoice.status)}</div>
                  </div>
                  {viewingInvoice.paymentTerms && (
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 print:text-gray-700 mb-1">Payment Terms</p>
                      <p className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white print:text-black break-words">{viewingInvoice.paymentTerms}</p>
                    </div>
                  )}
                  {viewingInvoice.poId && (
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 print:text-gray-700 mb-1">Purchase Order</p>
                      <p className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white print:text-black">PO-{viewingInvoice.poId}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Bank Account Details Card */}
              {viewingInvoice.bankAccount && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 sm:p-6 print:bg-white print:border print:border-gray-300">
                  <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-white print:text-black flex items-center gap-2">
                    <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
                    Bank Account Details
                  </h3>
                  <pre className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 print:text-black whitespace-pre-wrap font-sans break-words">
                    {viewingInvoice.bankAccount}
                  </pre>
                </div>
              )}

              {/* Notes Card */}
              {viewingInvoice.notes && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 sm:p-6 print:bg-white print:border print:border-gray-300">
                  <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-white print:text-black flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                    Notes
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 print:text-black break-words">{viewingInvoice.notes}</p>
                </div>
              )}

              {/* Linked Project Card */}
              {viewingInvoice.projectId && viewingInvoice.projectTitle && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 sm:p-6 print:bg-green-50 print:border print:border-green-300">
                  <h3 className="text-base sm:text-lg font-semibold mb-3 text-green-900 dark:text-green-100 print:text-green-900 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 sm:w-5 sm:h-5" />
                    Linked to Project
                  </h3>
                  <div className="flex items-center gap-3">
                    <Badge variant="default" className="bg-green-600 text-white print:bg-green-600">
                      Project
                    </Badge>
                    <p className="text-sm sm:text-base font-semibold text-green-900 dark:text-green-100 print:text-green-900 break-words">
                      {viewingInvoice.projectTitle}
                    </p>
                  </div>
                  <p className="text-xs text-green-700 dark:text-green-300 print:text-green-700 mt-2">
                    Upon approval, the invoice amount will be added to this project's actual cost
                  </p>
                </div>
              )}

              {/* Linked Asset Instance Card */}
              {viewingInvoice.assetInventoryInstanceId && viewingInvoice.assetTag && (
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 sm:p-6 print:bg-purple-50 print:border print:border-purple-300">
                  <h3 className="text-base sm:text-lg font-semibold mb-3 text-purple-900 dark:text-purple-100 print:text-purple-900 flex items-center gap-2">
                    <Package className="w-4 h-4 sm:w-5 sm:h-5" />
                    Linked to Asset Instance
                  </h3>
                  <div className="flex items-center gap-3">
                    <Badge variant="default" className="bg-purple-600 text-white print:bg-purple-600">
                      Asset
                    </Badge>
                    <p className="text-sm sm:text-base font-semibold text-purple-900 dark:text-purple-100 print:text-purple-900 break-words">
                      {viewingInvoice.assetTag}
                      {viewingInvoice.assetTypeName && ` - ${viewingInvoice.assetTypeName}`}
                    </p>
                  </div>
                  <p className="text-xs text-purple-700 dark:text-purple-300 print:text-purple-700 mt-2">
                    Upon approval, a maintenance record will be created for this asset with the invoice cost
                  </p>
                </div>
              )}

              {/* Invoice Items Table */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 sm:p-6 print:bg-white print:border print:border-gray-300">
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-white print:text-black flex items-center gap-2">
                  <Package className="w-4 h-4 sm:w-5 sm:h-5" />
                  Invoice Items
                </h3>
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <div className="border rounded-lg overflow-hidden print:border-gray-300">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 print:divide-gray-300">
                        <thead className="bg-gray-100 dark:bg-gray-700 print:bg-gray-100">
                          <tr>
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 print:text-black uppercase tracking-wider">#</th>
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 print:text-black uppercase tracking-wider">Item</th>
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 print:text-black uppercase tracking-wider">Qty</th>
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 print:text-black uppercase tracking-wider">Price</th>
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 print:text-black uppercase tracking-wider">Tax</th>
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 print:text-black uppercase tracking-wider">Total</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700 print:bg-white print:divide-gray-200">
                          {viewingInvoice.items?.map((item, index) => (
                            <tr key={item.id}>
                              <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900 dark:text-white print:text-black">{index + 1}</td>
                              <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">
                                <div className="flex flex-col gap-1">
                                  {item.itemType === "product" && (
                                    <Badge variant="default" className="text-xs w-fit print:border print:border-blue-500 print:bg-blue-50">
                                      Product
                                    </Badge>
                                  )}
                                  <span className="font-medium text-gray-900 dark:text-white print:text-black">
                                    {item.itemType === "product" ? item.inventoryItemName : item.description}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-right text-gray-900 dark:text-white print:text-black">
                                {item.quantity} {item.itemType === "product" ? item.inventoryItemUnit : ""}
                              </td>
                              <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-right text-gray-900 dark:text-white print:text-black">${item.unitPrice}</td>
                              <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-right text-gray-900 dark:text-white print:text-black">${item.taxAmount || "0.00"}</td>
                              <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-right font-semibold text-gray-900 dark:text-white print:text-black">${item.lineTotal}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 sm:p-6 print:bg-blue-50 print:border print:border-blue-300">
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-white print:text-black flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                  Financial Summary
                </h3>
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex justify-between items-center text-gray-700 dark:text-gray-300 print:text-black">
                    <span className="font-medium">Subtotal:</span>
                    <span className="text-lg font-semibold">${viewingInvoice.subtotal}</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-700 dark:text-gray-300 print:text-black">
                    <span className="font-medium">Tax:</span>
                    <span className="text-lg font-semibold">${viewingInvoice.taxAmount}</span>
                  </div>
                  <div className="border-t border-gray-300 dark:border-gray-600 print:border-gray-400 pt-3 flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900 dark:text-white print:text-black">Total Amount:</span>
                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 print:text-blue-600">${viewingInvoice.totalAmount}</span>
                  </div>
                  <div className="flex justify-between items-center text-green-700 dark:text-green-400 print:text-green-700">
                    <span className="font-medium">Paid Amount:</span>
                    <span className="text-lg font-semibold">${viewingInvoice.paidAmount}</span>
                  </div>
                  <div className="border-t border-gray-300 dark:border-gray-600 print:border-gray-400 pt-3 flex justify-between items-center">
                    <span className="text-lg font-bold text-red-700 dark:text-red-400 print:text-red-700">Balance Due:</span>
                    <span className="text-2xl font-bold text-red-700 dark:text-red-400 print:text-red-700">
                      ${(parseFloat(viewingInvoice.totalAmount) - parseFloat(viewingInvoice.paidAmount)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t print:hidden">
                {user?.role === "admin" && viewingInvoice.approvalStatus === "pending" && (
                  <Button
                    onClick={() => approveInvoiceMutation.mutate(viewingInvoice.id)}
                    disabled={approveInvoiceMutation.isPending}
                    variant="default"
                    size="lg"
                    className="w-full sm:w-auto"
                    data-testid="button-approve-invoice"
                  >
                    {approveInvoiceMutation.isPending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Approving...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Approve Invoice
                      </>
                    )}
                  </Button>
                )}
                {canEdit && viewingInvoice.approvalStatus === "approved" && parseFloat(viewingInvoice.paidAmount) < parseFloat(viewingInvoice.totalAmount) && (
                  <Button
                    onClick={() => setIsPaymentDialogOpen(true)}
                    size="lg"
                    className="w-full sm:w-auto"
                    data-testid="button-record-payment"
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    Record Payment
                  </Button>
                )}
              </div>
            </div>
          )}
          {/* Payment History */}
          {viewingInvoice?.payments && viewingInvoice.payments.length > 0 && (
            <div className="mt-4 sm:mt-6 bg-gray-50 dark:bg-gray-800 rounded-lg p-4 sm:p-6 print:bg-white print:border print:border-gray-300">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-white print:text-black flex items-center gap-2">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
                Payment History
              </h3>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <div className="border rounded-lg overflow-hidden print:border-gray-300">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 print:divide-gray-300">
                      <thead className="bg-gray-100 dark:bg-gray-700 print:bg-gray-100">
                        <tr>
                          <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 print:text-black uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 print:text-black uppercase tracking-wider">
                            Method
                          </th>
                          <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 print:text-black uppercase tracking-wider">
                            Reference
                          </th>
                          <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 print:text-black uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 print:text-black uppercase tracking-wider">
                            Notes
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700 print:bg-white print:divide-gray-200">
                        {viewingInvoice.payments.map((payment: any) => (
                          <tr key={payment.id}>
                            <td className="px-3 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white print:text-black">
                              {new Date(payment.paymentDate).toLocaleDateString()}
                            </td>
                            <td className="px-3 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white print:text-black">
                              {payment.paymentMethod || 'N/A'}
                            </td>
                            <td className="px-3 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white print:text-black">
                              {payment.referenceNumber || 'N/A'}
                            </td>
                            <td className="px-3 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-right font-semibold text-gray-900 dark:text-white print:text-black">
                              ${parseFloat(payment.amount).toFixed(2)}
                            </td>
                            <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 dark:text-white print:text-black">
                              <span className="line-clamp-2">{payment.notes || 'N/A'}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Payment Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={paymentData.amount}
                onChange={(e) => setPaymentData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="Enter payment amount"
              />
            </div>
            <div>
              <Label htmlFor="paymentDate">Payment Date</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentData.paymentDate}
                onChange={(e) => setPaymentData(prev => ({ ...prev, paymentDate: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select
                value={paymentData.paymentMethod}
                onValueChange={(value) => setPaymentData(prev => ({ ...prev, paymentMethod: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="referenceNumber">Reference Number</Label>
              <Input
                id="referenceNumber"
                value={paymentData.referenceNumber}
                onChange={(e) => setPaymentData(prev => ({ ...prev, referenceNumber: e.target.value }))}
                placeholder="Transaction reference, check number, etc."
              />
            </div>
            <div>
              <Label htmlFor="paymentNotes">Notes</Label>
              <Textarea
                id="paymentNotes"
                value={paymentData.notes}
                onChange={(e) => setPaymentData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional payment notes"
              />
            </div>
            <div>
              <Label htmlFor="paymentFiles">Attach Files</Label>
              <Input
                id="paymentFiles"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.txt,.csv,.xlsx,.xls"
                onChange={(e) => setPaymentFiles(e.target.files)}
              />
              <p className="text-sm text-gray-500 mt-1">
                Upload receipts, confirmations, or other payment documents
              </p>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsPaymentDialogOpen(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRecordPayment}
                disabled={recordPaymentMutation.isPending}
                className="w-full sm:w-auto"
              >
                {recordPaymentMutation.isPending ? "Recording..." : "Record Payment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const TableBody = ({ children }: { children: React.ReactNode }) => (
  <tbody className="bg-white divide-y divide-gray-200 dark:divide-gray-700">
    {children}
  </tbody>
);

const TableRow = ({ children }: { children: React.ReactNode }) => (
  <tr>{children}</tr>
);

const TableCell = ({ children }: { children: React.ReactNode }) => (
  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{children}</td>
);