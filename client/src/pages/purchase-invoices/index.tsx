import { formatDisplayDate } from "@/lib/utils";
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
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useAuth } from "@/hooks/use-auth";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { printByUrl } from "@/lib/print-utils";
import { sanitize } from "@/lib/sanitize";
import { Plus, FileText, DollarSign, Filter, Upload, Download, Trash2, Eye, Calendar, TrendingUp, CreditCard, AlertCircle, CheckCircle2, Printer, Package, Briefcase, XCircle, CheckCircle, Ban, History, Copy, Paperclip } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CustomPagination } from "@/components/ui/pagination";

interface SupplierBankDetails {
  id: number;
  accountDetails: string;
}
interface Supplier {
  id: number;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  vatTreatment?: "standard" | "zero_rated" | "exempt";
  currency?: string;
  bankAccountDetails?: SupplierBankDetails[];
}
interface PurchaseInvoice {
  id: number;
  invoiceNumber: string;
  supplierInvoiceNumber?: string;
  supplierId: number;
  supplierName: string;
  supplierCurrency?: string;
  currency?: string;
  exchangeRate?: string;
  poId?: number;
  poNumber?: string;
  status: "draft" | "pending_approval" | "approved" | "rejected" | "cancelled";
  paymentStatus: "unpaid" | "partial" | "paid";
  invoiceDate: string;
  dueDate: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  paidAmount: string;
  paymentTerms?: string;
  bankAccount?: string;
  discountPercentage?: string;
  discountAmount?: string;
  notes?: string;
  items?: PurchaseInvoiceItem[];
  files?: any[];
  payments?: Payment[];
  submittedById?: number;
  submittedAt?: string;
  approvedById?: number;
  approvedAt?: string;
  rejectionReason?: string;
  createdBy?: number;
  createdAt?: string;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
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
  projectId?: number;
  projectTitle?: string;
  assetInstanceId?: number;
  assetTag?: string;
  assetTypeName?: string;
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
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [editingInvoice, setEditingInvoice] = useState<PurchaseInvoice | null>(null);
  const [editNote, setEditNote] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [selectedBankId, setSelectedBankId] = useState<string>("");

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    supplierId: undefined as number | undefined,
    status: undefined as string | undefined,
    search: "",
    projectId: undefined as number | undefined,
  });
  
  const debouncedSearch = useDebounce(filters.search, 500);
  const [search, setSearch] = useState("");
  const [expandedPayment, setExpandedPayment] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    supplierId: "",
    supplierInvoiceNumber: "",
    currency: "AED",
    exchangeRate: "1",
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: "",
    paymentTerms: "Net 30 days",
    bankAccount: "",
    notes: "",
    discountPercentage: "0",
    discountAmount: "0",
  });

  const [invoiceItems, setInvoiceItems] = useState<{
    itemType: "product" | "service";
    inventoryItemId?: string;
    description?: string;
    quantity: string;
    unitPrice: string;
    taxRate: string;
    projectId?: string;
    assetInstanceId?: string;
  }[]>([]);

  const [newItem, setNewItem] = useState({
    itemType: "product" as "product" | "service",
    inventoryItemId: "",
    description: "",
    quantity: "1" as string,
    unitPrice: "0" as string,
    taxRate: "0" as string,
    projectId: "",
    assetInstanceId: "",
  });

  const [paymentData, setPaymentData] = useState({
    amount: "",
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: "bank_transfer",
    referenceNumber: "",
    notes: "",
  });

  const [paymentFiles, setPaymentFiles] = useState<FileList | null>(null);
  const [selectedInvoiceFiles, setSelectedInvoiceFiles] = useState<FileList | null>(null);
  const [existingInvoiceFiles, setExistingInvoiceFiles] = useState<any[]>([]);

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

  useEffect(() => {
    setPage(1);
  }, [filters]);

  // Fetch purchase invoices
  const { data: purchaseStats } = useQuery<PurchaseInvoiceStats>({
    queryKey: ["/api/purchase-invoices/stats"],
    enabled: isAuthenticated,
  });

  const { data: paginatedData, isLoading } = useQuery<PaginatedResponse<PurchaseInvoice>>({
    queryKey: ["/api/purchase-invoices", filters.startDate, filters.endDate, filters.supplierId, filters.status, filters.projectId, debouncedSearch, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", limit.toString());
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.supplierId) params.append("supplierId", filters.supplierId.toString());
      if (filters.status) params.append("status", filters.status);
      if (filters.projectId) params.append("projectId", filters.projectId.toString());
      if (debouncedSearch) params.append("search", debouncedSearch);

      const response = await apiRequest(`/api/purchase-invoices?${params}`, { method: "GET" });
      if (!response.ok) throw new Error("Failed to fetch purchase invoices");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const invoices = paginatedData?.data || [];
  const pagination = paginatedData?.pagination;

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

  const bankAccountOptions = React.useMemo(() => {
    const supplier = suppliers.find(
      s => s.id.toString() === formData.supplierId
    );

    return (
      supplier?.bankAccountDetails?.map(detail => ({
        id: detail.id,
        accountDetails: detail.accountDetails,
      })) || []
    );
  }, [formData.supplierId, suppliers]);
  const inventoryItems = Array.isArray(inventoryResponse?.data) ? inventoryResponse.data : [];

  // Calculate statistics
  const stats: PurchaseInvoiceStats = purchaseStats || {
    totalInvoices: 0,
    totalAmount: "0",
    paidAmount: "0",
    pendingAmount: "0",
    overdueCount: 0,
    overdueAmount: "0",
    pendingApprovalCount: 0,
  };

  const createInvoiceMutation = useMutation({
    mutationFn: async (formDataInstance: FormData) => {
      const response = await fetch("/api/purchase-invoices", {
        method: "POST",
        body: formDataInstance,
      });
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

  const updateInvoiceMutation = useMutation({
    mutationFn: async ({ invoiceId, formDataInstance }: { invoiceId: number; formDataInstance: FormData }) => {
      const response = await fetch(`/api/purchase-invoices/${invoiceId}`, {
        method: "PUT",
        body: formDataInstance,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update purchase invoice");
      }
      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-invoices"] });
      toast({ title: "Invoice Updated", description: "Purchase invoice has been updated successfully." });
      setIsDialogOpen(false);
      setEditNote("");
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update invoice", variant: "destructive" });
    },
  });

  const handleEditInvoice = async (invoice: PurchaseInvoice) => {
    try {
      const response = await apiRequest(`/api/purchase-invoices/${invoice.id}`, { method: "GET" });
      if (!response.ok) throw new Error("Failed to load invoice");
      const full = await response.json();

      setEditingInvoice(full);
      setFormData({
        supplierId: full.supplierId.toString(),
        supplierInvoiceNumber: full.supplierInvoiceNumber || "",
        currency: full.currency || "AED",
        exchangeRate: full.exchangeRate || "1",
        invoiceDate: full.invoiceDate ? full.invoiceDate.split('T')[0] : new Date().toISOString().split('T')[0],
        dueDate: full.dueDate ? full.dueDate.split('T')[0] : "",
        paymentTerms: full.paymentTerms || "",
        bankAccount: full.bankAccount || "",
        notes: full.notes || "",
        discountPercentage: full.discountPercentage || "0",
        discountAmount: full.discountAmount || "0",
      });

      if (full.items && full.items.length > 0) {
        setInvoiceItems(full.items.map((item: any) => ({
          itemType: item.itemType || "product",
          inventoryItemId: item.inventoryItemId ? item.inventoryItemId.toString() : "",
          description: item.description || "",
          quantity: item.quantity.toString(),
          unitPrice: parseFloat(item.unitPrice).toString(),
          taxRate: parseFloat(item.taxRate || "0").toString(),
          projectId: item.projectId ? item.projectId.toString() : "",
          assetInstanceId: item.assetInstanceId ? item.assetInstanceId.toString() : "",
        })));
      } else {
        setInvoiceItems([]);
      }

      setExistingInvoiceFiles(full.files || []);
      setEditNote("");
      setIsViewDialogOpen(false);
      setIsDialogOpen(true);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to load invoice for editing", variant: "destructive" });
    }
  };

  const handleDuplicateInvoice = async (invoice: any) => {
    let source = invoice;
    if (!invoice.items || invoice.items.length === 0) {
      try {
        const response = await apiRequest(`/api/purchase-invoices/${invoice.id}`, { method: "GET" });
        if (response.ok) {
          source = await response.json();
        }
      } catch {}
    }
    setEditingInvoice(null);
    setFormData({
      supplierId: source.supplierId?.toString() || "",
      supplierInvoiceNumber: source.supplierInvoiceNumber || "",
      currency: source.currency || "AED",
      exchangeRate: source.exchangeRate || "1",
      invoiceDate: new Date().toISOString().split("T")[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      paymentTerms: source.paymentTerms || "Net 30 days",
      bankAccount: source.bankAccount || "",
      notes: source.notes || "",
      discountPercentage: source.discountPercentage || "0",
      discountAmount: source.discountAmount || "0",
    });
    if (source.items && source.items.length > 0) {
      setInvoiceItems(source.items.map((item: any) => ({
        itemType: item.itemType || "product",
        inventoryItemId: item.inventoryItemId ? item.inventoryItemId.toString() : "",
        description: item.description || "",
        quantity: item.quantity.toString(),
        unitPrice: parseFloat(item.unitPrice).toString(),
        taxRate: parseFloat(item.taxRate || "0").toString(),
        projectId: item.projectId ? item.projectId.toString() : "",
        assetInstanceId: item.assetInstanceId ? item.assetInstanceId.toString() : "",
      })));
    } else {
      setInvoiceItems([]);
    }
    setEditNote("");
    setIsViewDialogOpen(false);
    setIsDialogOpen(true);
    toast({
      title: "Invoice Duplicated",
      description: "A new draft purchase invoice has been pre-filled. Review and save to create it.",
    });
  };

  const submitInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      const response = await apiRequest(`/api/purchase-invoices/${invoiceId}/submit`, {
        method: "PATCH",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-invoices"] });
      setIsViewDialogOpen(false);
      toast({
        title: "Invoice Submitted",
        description: "Purchase invoice has been submitted for approval.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit invoice",
        variant: "destructive",
      });
    },
  });

  const approveInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      const response = await apiRequest(`/api/purchase-invoices/${invoiceId}/approve`, {
        method: "PATCH",
      });
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

  const rejectInvoiceMutation = useMutation({
    mutationFn: async ({ invoiceId, reason }: { invoiceId: number; reason: string }) => {
      const response = await apiRequest(`/api/purchase-invoices/${invoiceId}/reject`, {
        method: "PATCH",
        body: { reason },
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-invoices"] });
      toast({
        title: "Invoice Rejected",
        description: "Purchase invoice has been rejected.",
        variant: "destructive",
      });
      setIsRejectDialogOpen(false);
      setRejectionReason("");
      setViewingInvoice(null);
      setIsViewDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject invoice",
        variant: "destructive",
      });
    },
  });

  const cancelInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      const response = await apiRequest(`/api/purchase-invoices/${invoiceId}/cancel`, {
        method: "POST",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-invoices"] });
      toast({
        title: "Invoice Cancelled",
        description: "Purchase invoice has been cancelled and reverse ledger entries created.",
      });
      setViewingInvoice(null);
      setIsViewDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel invoice",
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
      supplierInvoiceNumber: "",
      currency: "AED",
      exchangeRate: "1",
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: "",
      paymentTerms: "Net 30 days",
      bankAccount: "",
      notes: "",
      discountPercentage: "0",
      discountAmount: "0",
    });
    setSelectedBankId("");
    setInvoiceItems([]);
    setNewItem({
      itemType: "product",
      inventoryItemId: "",
      description: "",
      quantity: "1",
      unitPrice: "0",
      taxRate: "0",
      projectId: "",
      assetInstanceId: "",
    });
    setEditingInvoice(null);
    setSelectedInvoiceFiles(null);
    setExistingInvoiceFiles([]);
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
      projectId: "",
      assetInstanceId: "",
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

    if (!formData.dueDate) {
      toast({
        title: "Error",
        description: "Please select a due date",
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
        projectId: item.projectId ? parseInt(item.projectId) : null,
        assetInstanceId: item.assetInstanceId ? parseInt(item.assetInstanceId) : null,
      };
    });

    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const calculatedTaxAmount = items.reduce((sum, item) => sum + item.taxAmount, 0);
    const discountPct = parseFloat(formData.discountPercentage) || 0;
    const discountAmt = parseFloat(formData.discountAmount) || 0;
    const totalAmount = subtotal + calculatedTaxAmount - discountAmt;

    const formDataInstance = new FormData();
    formDataInstance.append("supplierId", formData.supplierId);
    formDataInstance.append("supplierInvoiceNumber", formData.supplierInvoiceNumber);
    formDataInstance.append("currency", formData.currency);
    formDataInstance.append("exchangeRate", formData.exchangeRate);
    formDataInstance.append("invoiceDate", formData.invoiceDate);
    formDataInstance.append("dueDate", formData.dueDate);
    formDataInstance.append("paymentTerms", formData.paymentTerms);
    formDataInstance.append("bankAccount", formData.bankAccount);
    formDataInstance.append("notes", formData.notes);
    formDataInstance.append("subtotal", subtotal.toFixed(2));
    formDataInstance.append("taxAmount", calculatedTaxAmount.toFixed(2));
    formDataInstance.append("discountPercentage", discountPct.toString());
    formDataInstance.append("discountAmount", discountAmt.toString());
    formDataInstance.append("totalAmount", totalAmount.toFixed(2));
    formDataInstance.append("items", JSON.stringify(items));

    if (selectedInvoiceFiles) {
      for (let i = 0; i < selectedInvoiceFiles.length; i++) {
        formDataInstance.append("files", selectedInvoiceFiles[i]);
      }
    }

    if (editingInvoice) {
      if (!editNote.trim()) {
        toast({
          title: "Error",
          description: "Please provide an edit note explaining the changes",
          variant: "destructive",
        });
        return;
      }
      formDataInstance.append("editNote", editNote.trim());
      const keptFileIds = existingInvoiceFiles.map((file) => file.id);
      formDataInstance.append("existingFiles", JSON.stringify(keptFileIds));

      updateInvoiceMutation.mutate({
        invoiceId: editingInvoice.id,
        formDataInstance,
      });
    } else {
      createInvoiceMutation.mutate(formDataInstance);
    }
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

      if (user?.role === "admin" || user?.role === "finance") {
        const editHistoryResponse = await apiRequest(`/api/purchase-invoices/${invoice.id}/edit-history`, { method: "GET" });
        if (editHistoryResponse.ok) {
          fullInvoice.editHistory = await editHistoryResponse.json();
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
      search: "",
      projectId: undefined,
    });
    queryClient.invalidateQueries({ queryKey: ["/api/purchase-invoices"] });
    setIsFilterOpen(false);
  };

  const getItemName = (itemId: string) => {
    const item = inventoryItems.find(item => item.id === parseInt(itemId));
    return item ? item.name : "Unknown Item";
  };

  const getItemDescription = (itemId: string | number) => {
    const id = typeof itemId === "string" ? parseInt(itemId) : itemId;
    const item = inventoryItems?.find(item => item.id === id);
    return item ? item.description : "";
  };

  const getItemUnit = (itemId: string) => {
    const item = inventoryItems.find(item => item.id === parseInt(itemId));
    return item ? item.unit : "";
  };

  const getProjectTitle = (projectId: string) => {
    const project = projects.find((p: any) => p.id === parseInt(projectId));
    return project ? project.title : "Unknown Project";
  };

  const getAssetInfo = (assetId: string) => {
    const asset = assetInstances.find((a: any) => a.id === parseInt(assetId));
    return asset ? { tag: asset.assetTag, type: asset.assetTypeName || 'Asset' } : { tag: "Unknown", type: "Asset" };
  };

  const getApprovalStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="outline" className="bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400">Draft</Badge>;
      case "pending_approval":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">Pending Approval</Badge>;
      case "approved":
        return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">Rejected</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (paymentStatus: string) => {

    switch (paymentStatus) {
      case "paid":
        return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Paid
        </Badge>;
      case "partial":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          <CreditCard className="w-3 h-3 mr-1" />
          Partially Paid
        </Badge>;
      case "unpaid":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300">
          <Calendar className="w-3 h-3 mr-1" />
          Unpaid
        </Badge>;
      default:
        return null;
    }
  };

  const canEdit = user?.role === "admin" || user?.role === "finance";

  if (!isAuthenticated) {
    return null;
  }

  const formatCurrency = (amount: number | string, currency: string = "AED") => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return `${currency} ${num.toFixed(2)}`;
  };

  const getTaxRateFromVatTreatment = (
    vatTreatment?: string
  ): number => {
    return vatTreatment === "standard" ? 5 : 0;
  };

  const handlePrintPDF = async (invoice: PurchaseInvoice) => {
    try {
      await printByUrl(`/api/purchase-invoices/${invoice.id}/pdf`);
      toast({
        title: "Success",
        description: "Print dialog opened successfully.",
      });
    } catch (error) {
      console.error("PDF Error:", error);
      toast({
        title: "Error",
        description: "Failed to generate invoice PDF",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Purchase Invoices</h1>
            <p className="text-muted-foreground">Manage your supplier invoices and payments</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {canEdit && (
              <Button onClick={() => setIsDialogOpen(true)} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                New Invoice
              </Button>
            )}
          </div>
        </div>

        {/* Statistics Cards */}
        {/* <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4"> */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">{formatCurrency(stats.totalAmount)}</div>
              <p className="text-xs text-green-600 dark:text-green-400">Approved invoices</p>
            </CardContent>
          </Card>

          {/* <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 border-yellow-200 dark:border-yellow-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Pending Amount</CardTitle>
              <TrendingUp className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{formatCurrency(stats.pendingAmount)}</div>
              <p className="text-xs text-yellow-600 dark:text-yellow-400">Outstanding payments</p>
            </CardContent>
          </Card> */}

          <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">Overdue</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-900 dark:text-red-100">{stats.overdueCount}</div>
              <p className="text-xs text-red-600 dark:text-red-400">{formatCurrency(stats.overdueAmount)} overdue</p>
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

        {/* Filters Section */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="search">Search</Label>
                  <Input
                    id="search"
                    placeholder="Invoice # or Supplier..."
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
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
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="pending_approval">Pending Approval</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="supplierFilter">Supplier</Label>
                  <Autocomplete
                    options={[
                      { value: "all", label: "All Suppliers" },
                      ...suppliers.map((supplier) => ({
                        value: supplier.id.toString(),
                        label: supplier.name,
                        searchText: supplier.name
                      }))
                    ]}
                    value={filters.supplierId?.toString() || "all"}
                    onValueChange={(value) => {
                      setFilters(prev => ({
                        ...prev,
                        supplierId: value === "all" ? undefined : parseInt(value)
                      }));
                    }}
                    placeholder="Select supplier..."
                  />
                </div>
                <div>
                  <Label htmlFor="projectFilter">Project</Label>
                  <Autocomplete
                    options={[
                      { value: "all", label: "All Projects" },
                      ...projects.map((project: any) => ({
                        value: project.id.toString(),
                        label: project.title,
                        searchText: project.title
                      }))
                    ]}
                    value={filters.projectId?.toString() || "all"}
                    onValueChange={(value) => {
                      setFilters(prev => ({
                        ...prev,
                        projectId: value === "all" ? undefined : parseInt(value)
                      }));
                    }}
                    placeholder="Select project..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="startDate">Invoice Date From</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">Invoice Date To</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={clearFilters} variant="outline" className="w-full">
                    Clear All Filters
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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
                              <div className="text-sm">{formatDisplayDate(invoice.invoiceDate)}</div>
                            </td>
                            <td className="p-4">
                              <div className="text-sm">{formatDisplayDate(invoice.dueDate)}</div>
                            </td>
                            <td className="p-4 text-right">
                              <div className="font-semibold">{formatCurrency(invoice.totalAmount, invoice.supplierCurrency)}</div>
                            </td>
                            <td className="p-4 text-right">
                              <div className="font-medium text-green-600">{formatCurrency(invoice.paidAmount, invoice.supplierCurrency)}</div>
                            </td>
                            <td className="p-4 text-center">
                              {getApprovalStatusBadge(invoice.status)}{" "}
                              {getPaymentStatusBadge(invoice.paymentStatus)}
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => viewInvoice(invoice)}
                                  className="h-8 w-8 p-0"
                                  data-testid={`button-view-invoice-${invoice.id}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {invoice.status === "draft" && canEdit && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditInvoice(invoice)}
                                    className="h-8 px-2"
                                    data-testid={`button-edit-invoice-${invoice.id}`}
                                  >
                                    Edit
                                  </Button>
                                )}
                                {invoice.status === "approved" && user?.role === "admin" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditInvoice(invoice)}
                                    className="h-8 px-2"
                                  >
                                    Edit
                                  </Button>
                                )}
                                {invoice.status === "draft" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => viewInvoice(invoice)}
                                    className="h-8 px-2"
                                    data-testid={`button-submit-invoice-${invoice.id}`}
                                  >
                                    Submit
                                  </Button>
                                )}
                                {invoice.status === "pending_approval" && user?.role === "admin" && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => approveInvoiceMutation.mutate(invoice.id)}
                                      disabled={approveInvoiceMutation.isPending}
                                      className="h-8 px-2 text-green-600 hover:text-green-700"
                                      data-testid={`button-approve-invoice-${invoice.id}`}
                                    >
                                      Approve
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setViewingInvoice(invoice);
                                        setIsRejectDialogOpen(true);
                                      }}
                                      className="h-8 px-2 text-red-600 hover:text-red-700"
                                      data-testid={`button-reject-invoice-${invoice.id}`}
                                    >
                                      Reject
                                    </Button>
                                  </>
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
                    {getApprovalStatusBadge(invoice.status)}{" "}
                    {getPaymentStatusBadge(invoice.paymentStatus)}
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
                          <p>{formatDisplayDate(invoice.invoiceDate)}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">Due Date:</span>
                          <p>{formatDisplayDate(invoice.dueDate)}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">Amount:</span>
                          <p className="font-semibold text-lg">{formatCurrency(invoice.totalAmount, invoice.supplierCurrency)}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">Paid:</span>
                          <p className="font-semibold text-green-600">{formatCurrency(invoice.paidAmount, invoice.supplierCurrency)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewInvoice(invoice)}
                          className="flex-1"
                          data-testid={`button-view-invoice-${invoice.id}`}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        {invoice.status === "draft" && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => viewInvoice(invoice)}
                            className="flex-1"
                            data-testid={`button-submit-invoice-${invoice.id}`}
                          >
                            Submit
                          </Button>
                        )}
                        {invoice.status === "pending_approval" && user?.role === "admin" && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => approveInvoiceMutation.mutate(invoice.id)}
                              disabled={approveInvoiceMutation.isPending}
                              className="flex-1 bg-green-600 hover:bg-green-700"
                              data-testid={`button-approve-invoice-${invoice.id}`}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setViewingInvoice(invoice);
                                setIsRejectDialogOpen(true);
                              }}
                              className="flex-1"
                              data-testid={`button-reject-invoice-${invoice.id}`}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {pagination && pagination.totalPages > 1 && (
              <div className="p-4 border-t bg-white dark:bg-gray-900 rounded-b-lg">
                <CustomPagination
                  currentPage={page}
                  totalPages={pagination.totalPages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </div>
        )}

        {/* Create / Edit Invoice Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0 border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-semibold">{editingInvoice ? `Edit Invoice — ${editingInvoice.invoiceNumber}` : "Create Purchase Invoice"}</DialogTitle>
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
                        <Autocomplete
                          options={suppliers.map((supplier) => ({
                            value: supplier.id.toString(),
                            label: supplier.name,
                            searchText: `${supplier.name} ${supplier.email || ""}`
                          }))}
                          value={formData.supplierId}
                          onValueChange={async (value) => {
                            const supplier = suppliers.find(s => s.id.toString() === value);
                            const taxRate = getTaxRateFromVatTreatment(supplier?.vatTreatment);
                            const currency = supplier?.currency || "AED";
                            let exchangeRate = "1";

                            if (currency !== "AED") {
                              try {
                                const response = await apiRequest(`/api/exchange-rates/lookup?from=${currency}`);
                                if (response.ok) {
                                  const data = await response.json();
                                  exchangeRate = data.rate || "1";
                                }
                              } catch (error) {
                                console.error("Failed to lookup exchange rate:", error);
                              }
                            }

                            setFormData(prev => ({
                              ...prev,
                              supplierId: value,
                              currency,
                              exchangeRate,
                              bankAccount: "", // ✅ REQUIRED
                            }));

                            // Update existing items (only if still 0)
                            setInvoiceItems(items =>
                              items.map(item =>
                                item.taxRate === "0"
                                  ? { ...item, taxRate: String(taxRate) }
                                  : item
                              )
                            );

                            // Default tax for new items
                            setNewItem(prev => ({
                              ...prev,
                              taxRate: String(taxRate),
                            }));
                          }}
                          placeholder="Search supplier..."
                          emptyMessage="No suppliers found"
                          className="h-10"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="supplierInvoiceNumber" className="text-sm font-medium">
                          Supplier Invoice Number
                        </Label>
                        <Input
                          id="supplierInvoiceNumber"
                          value={formData.supplierInvoiceNumber}
                          onChange={(e) => setFormData(prev => ({ ...prev, supplierInvoiceNumber: e.target.value }))}
                          placeholder="e.g. INV-12345"
                          className="h-10"
                        />
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
                            min={formData.invoiceDate} // ✅ important
                            onChange={(e) =>
                              setFormData(prev => ({ ...prev, dueDate: e.target.value }))
                            }
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
                        <Select
                          value={selectedBankId}
                          onValueChange={(value) => {
                            setSelectedBankId(value);
                            const selected = bankAccountOptions.find(opt => opt.id.toString() === value);
                            if (selected) {
                              const htmlValue = selected.accountDetails.split('\n').filter(line => line.trim()).map(line => `<p>${line}</p>`).join('');
                              setFormData(prev => ({ ...prev, bankAccount: htmlValue }));
                            }
                          }}
                          disabled={!formData.supplierId || bankAccountOptions.length === 0}
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue
                              placeholder={
                                !formData.supplierId
                                  ? "Select supplier first"
                                  : "Select bank account"
                              }
                            />
                          </SelectTrigger>

                          <SelectContent>
                            {bankAccountOptions.map((bank, index) => (
                              <SelectItem key={bank.id} value={bank.id.toString()}>
                                <div className="whitespace-pre-wrap text-sm leading-snug">
                                  {bank.accountDetails}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="mt-2 border border-input rounded-md overflow-hidden">
                          <ReactQuill
                            theme="snow"
                            value={formData.bankAccount}
                            onChange={(value) => setFormData(prev => ({ ...prev, bankAccount: value }))}
                            placeholder="Enter or customize bank account details..."
                            modules={{
                              toolbar: [
                                ['bold', 'italic', 'underline', 'strike'],
                                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                ['clean']
                              ],
                            }}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
                        <div className="mt-1 border border-input rounded-md overflow-hidden">
                          <ReactQuill
                            theme="snow"
                            value={formData.notes}
                            onChange={(value) => setFormData(prev => ({ ...prev, notes: value }))}
                            placeholder="Additional notes or comments..."
                            modules={{
                              toolbar: [
                                [{ 'header': [1, 2, 3, false] }],
                                ['bold', 'italic', 'underline', 'strike'],
                                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                [{ 'color': [] }, { 'background': [] }],
                                ['link'],
                                ['clean']
                              ],
                            }}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="attachments">Attach Files (Optional)</Label>
                        <Input
                          id="attachments"
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.txt,.csv,.xlsx,.xls"
                          onChange={(e) => setSelectedInvoiceFiles(e.target.files)}
                          className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        <p className="text-sm text-gray-500">
                          You can attach multiple files (PDF, DOC, images, etc.). Max 25MB per file.
                        </p>
                        {selectedInvoiceFiles && selectedInvoiceFiles.length > 0 && (
                          <div className="mt-2">
                            <p className="text-sm font-medium">Selected files:</p>
                            <ul className="text-sm text-gray-600 mt-1">
                              {Array.from(selectedInvoiceFiles).map((file, index) => (
                                <li key={index} className="flex items-center gap-2">
                                  <span>• {file.name}</span>
                                  <span className="text-xs text-gray-400">
                                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {editingInvoice && existingInvoiceFiles.length > 0 && (
                          <div className="mt-4">
                            <p className="text-sm font-medium mb-2">
                              Currently Attached Files:
                            </p>
                            <ul className="space-y-2">
                              {existingInvoiceFiles.map((file) => (
                                <li
                                  key={file.id}
                                  className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                                >
                                  <a
                                    href={`/${file.filePath}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 hover:underline truncate"
                                  >
                                    {file.originalName}
                                  </a>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setExistingInvoiceFiles(
                                        existingInvoiceFiles.filter((f) => f.id !== file.id)
                                      )
                                    }
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
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
                            <div className="lg:col-span-3">
                              <Label className="text-xs font-medium text-muted-foreground">INVENTORY ITEM</Label>
                              <Autocomplete
                                options={(inventoryItems || []).map((item) => ({
                                  value: item.id.toString(),
                                  label: item.name,
                                  description: item.description,
                                  searchText: `${item.name} ${item.description || ""} ${item.unit}`
                                }))}
                                value={newItem.inventoryItemId || ""}
                                onValueChange={(value) => setNewItem(prev => ({ ...prev, inventoryItemId: value }))}
                                placeholder="Search inventory items..."
                              />
                            </div>
                          ) : (
                            <div className="lg:col-span-3">
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
                              step="any"
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
                              step="any"
                              min="0"
                              max="100"
                              value={newItem.taxRate}
                              onChange={(e) => setNewItem(prev => ({ ...prev, taxRate: e.target.value }))}
                              placeholder="0"
                              className="h-9"
                            />
                          </div>

                        </div>

                        {/* Project and Asset Allocation Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <div>
                            <Label className="text-xs font-medium text-muted-foreground">ALLOCATE TO PROJECT (OPTIONAL)</Label>
                            <Autocomplete
                              options={projects.map((project: any) => ({
                                value: project.id.toString(),
                                label: project.title,
                                searchText: project.title
                              }))}
                              value={newItem.projectId || ""}
                              onValueChange={(value) => setNewItem(prev => ({ ...prev, projectId: value, assetInstanceId: "" }))}
                              placeholder="Search projects..."
                              emptyMessage="No projects found"
                            />
                            <p className="text-xs text-muted-foreground mt-1">Line cost will be added to project cost upon approval</p>
                          </div>

                          <div>
                            <Label className="text-xs font-medium text-muted-foreground">ALLOCATE TO ASSET (OPTIONAL)</Label>
                            <Autocomplete
                              options={assetInstances.filter((asset: any) => asset.status !== 'retired').map((asset: any) => ({
                                value: asset.id.toString(),
                                label: `${asset.assetTag} - ${asset.assetTypeName || 'Asset'}`,
                                searchText: `${asset.assetTag} ${asset.assetTypeName || ''} ${asset.serialNumber || ''}`
                              }))}
                              value={newItem.assetInstanceId || ""}
                              onValueChange={(value) => setNewItem(prev => ({ ...prev, assetInstanceId: value, projectId: "" }))}
                              placeholder="Search assets..."
                              emptyMessage="No assets found"
                            />
                            <p className="text-xs text-muted-foreground mt-1">Maintenance record will be created upon approval</p>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-end gap-3">
                          <Button type="button" onClick={addItem} className=" h-9" size="sm">
                            <Plus className="w-4 h-4 mr-1" />
                            Add
                          </Button>
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
                                <div className="flex flex-col">
                                  <div className="font-medium text-sm">
                                    {item.itemType === "product" ? getItemName(item.inventoryItemId || "") : item.description}
                                  </div>
                                  {item.itemType === "product" && item.inventoryItemId && (() => {
                                    const description = getItemDescription(item.inventoryItemId);
                                    return description && (
                                      <div className="text-xs text-muted-foreground">{description}</div>
                                    );
                                  })()}
                                </div>
                                {item.itemType === "product" && (
                                  <div className="text-xs text-muted-foreground">{getItemUnit(item.inventoryItemId || "")}</div>
                                )}
                                {item.projectId && (
                                  <Badge variant="outline" className="text-xs mt-1 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300">
                                    <Briefcase className="w-3 h-3 mr-1" />
                                    {getProjectTitle(item.projectId)}
                                  </Badge>
                                )}
                                {item.assetInstanceId && (
                                  <Badge variant="outline" className="text-xs mt-1 bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300">
                                    <Package className="w-3 h-3 mr-1" />
                                    {getAssetInfo(item.assetInstanceId).tag}
                                  </Badge>
                                )}
                              </div>
                              <div className="col-span-2 text-center">
                                <span className="font-medium">{item.quantity}</span>
                              </div>
                              <div className="col-span-2 text-right">
                                <span className="font-medium">{formatCurrency(item.unitPrice, formData.currency)}</span>
                              </div>
                              <div className="col-span-1 text-center">
                                <Badge variant="outline" className="text-xs">{item.taxRate}%</Badge>
                              </div>
                              <div className="col-span-2 text-right">
                                <span className="font-semibold text-green-600">{formatCurrency(lineTotal, formData.currency)}</span>
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

                    {/* Discount and Summary Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                      <div className="space-y-4">
                        <h4 className="font-semibold text-sm">Discounts</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="discountPercentage">Discount (%)</Label>
                            <Input
                              id="discountPercentage"
                              type="number"
                              min="0"
                              max="100"
                              step="any"
                              value={formData.discountPercentage}
                              onChange={(e) => {
                                const val = e.target.value;
                                const pct = parseFloat(val) || 0;
                                const subtotal = invoiceItems.reduce((sum, item) => sum + (parseInt(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0), 0);
                                const calcDiscount = (subtotal * pct / 100);
                                setFormData(prev => ({ 
                                  ...prev, 
                                  discountPercentage: val, 
                                  discountAmount: val === "" ? "" : calcDiscount.toString() 
                                }));
                              }}
                              placeholder="0.00"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="discountAmount">Discount Value ({formData.currency})</Label>
                            <Input
                              id="discountAmount"
                              type="number"
                              min="0"
                              step="any"
                              value={formData.discountAmount}
                              onChange={(e) => {
                                const val = e.target.value;
                                const amount = parseFloat(val) || 0;
                                const subtotal = invoiceItems.reduce((sum, item) => sum + (parseInt(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0), 0);
                                const calcPct = subtotal > 0 ? ((amount / subtotal) * 100) : 0;
                                setFormData(prev => ({ 
                                  ...prev, 
                                  discountAmount: val, 
                                  discountPercentage: val === "" ? "" : calcPct.toString() 
                                }));
                              }}
                              placeholder="0.00"
                              className="mt-1"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg p-4 border">
                        <h4 className="font-semibold mb-3 text-sm">Invoice Summary</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Subtotal:</span>
                            <span className="font-medium">{formatCurrency(invoiceItems.reduce((sum, item) => {
                              const quantity = parseInt(item.quantity) || 0;
                              const unitPrice = parseFloat(item.unitPrice) || 0;
                              return sum + (quantity * unitPrice);
                            }, 0), formData.currency)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Tax Amount:</span>
                            <span className="font-medium">{formatCurrency(invoiceItems.reduce((sum, item) => {
                              const quantity = parseInt(item.quantity) || 0;
                              const unitPrice = parseFloat(item.unitPrice) || 0;
                              const taxRate = parseFloat(item.taxRate) || 0;
                              const lineSubtotal = quantity * unitPrice;
                              return sum + (lineSubtotal * taxRate / 100);
                            }, 0), formData.currency)}</span>
                          </div>
                          {parseFloat(formData.discountAmount) > 0 && (
                            <div className="flex justify-between text-sm text-red-600">
                              <span>Discount ({formData.discountPercentage}%):</span>
                              <span className="font-medium">- {formatCurrency(formData.discountAmount, formData.currency)}</span>
                            </div>
                          )}
                          <div className="border-t pt-2">
                            <div className="flex justify-between text-lg font-bold">
                              <span>Total Amount:</span>
                              <span className="text-green-600">{formatCurrency((invoiceItems.reduce((sum, item) => {
                                const quantity = parseInt(item.quantity) || 0;
                                const unitPrice = parseFloat(item.unitPrice) || 0;
                                const taxRate = parseFloat(item.taxRate) || 0;
                                const lineSubtotal = quantity * unitPrice;
                                const lineTax = lineSubtotal * taxRate / 100;
                                return sum + lineSubtotal + lineTax;
                              }, 0) - (parseFloat(formData.discountAmount) || 0)), formData.currency)}</span>
                            </div>
                            {formData.currency !== "AED" && (
                              <div className="text-xs text-muted-foreground mt-2 text-right">
                                Exchange Rate: 1 {formData.currency} = {formData.exchangeRate} AED
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Edit Note - INSIDE SCROLL */}
                {editingInvoice && (
                  <div className="space-y-2 border-t pt-4 mt-4">
                    <Label className="text-sm font-medium text-red-600">
                      Edit Note (Required) *
                    </Label>

                    <Textarea
                      value={editNote}
                      onChange={(e: any) => setEditNote(e.target.value)}
                      placeholder="Explain the reason for this edit..."
                      className="min-h-[80px]"
                      required
                    />
                  </div>
                )}

                 <div className="flex justify-end gap-3 pt-4 border-t">
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setIsDialogOpen(false);
          resetForm();
        }}
      >
        Cancel
      </Button>

      <Button
        type="submit"
        disabled={
          (editingInvoice
            ? updateInvoiceMutation.isPending
            : createInvoiceMutation.isPending) ||
          !formData.supplierId ||
          !formData.dueDate ||
          invoiceItems.length === 0 ||
          (editingInvoice && !editNote.trim())
        }
      >
        {editingInvoice ? "Save Changes" : "Create Invoice"}
      </Button>
    </div>

                </form>
                </div>

            {/* Footer Actions */}
            {/* <div className="flex-shrink-0 border-t pt-4 mt-6">
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
                  disabled={(editingInvoice ? updateInvoiceMutation.isPending : createInvoiceMutation.isPending) || !formData.supplierId || !formData.dueDate || invoiceItems.length === 0}
                  className="sm:w-auto order-1 sm:order-2"
                >
                  {(editingInvoice ? updateInvoiceMutation.isPending : createInvoiceMutation.isPending) ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      {editingInvoice ? "Saving..." : "Creating Invoice..."}
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      {editingInvoice ? "Save Changes" : "Create Invoice"}
                    </>
                  )}
                </Button>
              </div>
            </div> */}
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
                  <div className="flex items-center gap-3 print:hidden">
                    <div className="flex items-center gap-2">
                      {getApprovalStatusBadge(viewingInvoice.status)}
                      {getPaymentStatusBadge(viewingInvoice.paymentStatus)}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePrintPDF(viewingInvoice)}
                      data-testid="button-print-invoice"
                      className="flex items-center gap-2"
                    >
                      <Printer className="w-4 h-4" />
                      Print
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
                    {viewingInvoice.supplierInvoiceNumber && (
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 print:text-gray-700 mb-1">Supplier Invoice Number</p>
                        <p className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white print:text-black break-words">{viewingInvoice.supplierInvoiceNumber}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 print:text-gray-700 mb-1">Invoice Date</p>
                      <p className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white print:text-black">
                        {formatDisplayDate(viewingInvoice.invoiceDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 print:text-gray-700 mb-1">Due Date</p>
                      <p className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white print:text-black">
                        {formatDisplayDate(viewingInvoice.dueDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 print:text-gray-700 mb-1">Payment Status</p>
                      <div className="print:inline-block">
                        {getApprovalStatusBadge(viewingInvoice.status)}{" "}
                        {getPaymentStatusBadge(viewingInvoice.paymentStatus)}
                      </div>
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
                    <div 
                      className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 print:text-black rich-text-content"
                      dangerouslySetInnerHTML={{ __html: sanitize(viewingInvoice.bankAccount || "") }}
                    />
                  </div>
                )}

                {/* Notes Card */}
                {viewingInvoice.notes && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 sm:p-6 print:bg-white print:border print:border-gray-300">
                    <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-white print:text-black flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                      Notes
                    </h3>
                    <div 
                      className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 print:text-black rich-text-content"
                      dangerouslySetInnerHTML={{ __html: sanitize(viewingInvoice.notes || "") }}
                    />
                  </div>
                )}

                {/* Attachments Card */}
                {(viewingInvoice as any).files && (viewingInvoice as any).files.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 sm:p-6 print:bg-white print:border print:border-gray-300">
                    <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-white print:text-black flex items-center gap-2">
                      <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
                      Attachments
                    </h3>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(viewingInvoice as any).files.map((file: any) => (
                        <li
                          key={file.id}
                          className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded border"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <Download className="h-4 w-4 flex-shrink-0 text-blue-600" />
                            <span className="text-sm truncate" title={file.originalName}>
                              {file.originalName}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="h-8 ml-2"
                          >
                            <a
                              href={`/${file.filePath}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Download
                            </a>
                          </Button>
                        </li>
                      ))}
                    </ul>
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
                                    <div className="flex flex-col">
                                      <span className="font-medium text-gray-900 dark:text-white print:text-black">
                                        {item.itemType === "product" ? item.inventoryItemName : item.description}
                                      </span>
                                      {item.itemType === "product" && item.inventoryItemId && (() => {
                                        const description = getItemDescription(item.inventoryItemId);
                                        return description && (
                                          <span className="text-xs text-muted-foreground print:text-gray-600">
                                            {description}
                                          </span>
                                        );
                                      })()}
                                    </div>
                                    {item.projectId && (
                                      <Badge variant="outline" className="text-xs w-fit bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 print:border print:border-blue-500 print:bg-blue-50">
                                        <Briefcase className="w-3 h-3 mr-1" />
                                        {getProjectTitle(item.projectId.toString())}
                                      </Badge>
                                    )}
                                    {item.assetInstanceId && (
                                      <Badge variant="outline" className="text-xs w-fit bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 print:border print:border-purple-500 print:bg-purple-50">
                                        <Package className="w-3 h-3 mr-1" />
                                        {getAssetInfo(item.assetInstanceId.toString()).tag}
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-right text-gray-900 dark:text-white print:text-black">
                                  {item.quantity} {item.itemType === "product" ? item.inventoryItemUnit : ""}
                                </td>
                                <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-right text-gray-900 dark:text-white print:text-black">{formatCurrency(item.unitPrice, viewingInvoice.supplierCurrency)}</td>
                                <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-right text-gray-900 dark:text-white print:text-black">{formatCurrency(item.taxAmount || "0.00", viewingInvoice.supplierCurrency)}</td>
                                <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-right font-semibold text-gray-900 dark:text-white print:text-black">{formatCurrency(item.lineTotal, viewingInvoice.supplierCurrency)}</td>
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
                      <span className="text-lg font-semibold">{formatCurrency(viewingInvoice.subtotal, viewingInvoice.supplierCurrency)}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-700 dark:text-gray-300 print:text-black">
                      <span className="font-medium">Tax:</span>
                      <span className="text-lg font-semibold">{formatCurrency(viewingInvoice.taxAmount, viewingInvoice.supplierCurrency)}</span>
                    </div>
                    {parseFloat(viewingInvoice.discountAmount || "0") > 0 && (
                      <div className="flex justify-between items-center text-gray-700 dark:text-gray-300 print:text-black">
                        <span className="font-medium">Discount ({viewingInvoice.discountPercentage || "0"}%):</span>
                        <span className="text-lg font-semibold text-red-600">- {formatCurrency(viewingInvoice.discountAmount || "0", viewingInvoice.supplierCurrency)}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-300 dark:border-gray-600 print:border-gray-400 pt-3 flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-900 dark:text-white print:text-black">Total Amount:</span>
                      <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 print:text-blue-600">{formatCurrency(viewingInvoice.totalAmount, viewingInvoice.supplierCurrency)}</span>
                    </div>
                    {(viewingInvoice.currency || viewingInvoice.supplierCurrency) !== "AED" && viewingInvoice.exchangeRate && (
                      <div className="text-xs text-muted-foreground mt-2 text-right">
                        Exchange Rate: 1 {viewingInvoice.currency || viewingInvoice.supplierCurrency} = {viewingInvoice.exchangeRate} AED
                      </div>
                    )}
                    <div className="flex justify-between items-center text-green-700 dark:text-green-400 print:text-green-700">
                      <span className="font-medium">Paid Amount:</span>
                      <span className="text-lg font-semibold">{formatCurrency(viewingInvoice.paidAmount, viewingInvoice.supplierCurrency)}</span>
                    </div>
                    <div className="border-t border-gray-300 dark:border-gray-600 print:border-gray-400 pt-3 flex justify-between items-center">
                      <span className="text-lg font-bold text-red-700 dark:text-red-400 print:text-red-700">Balance Due:</span>
                      <span className="text-2xl font-bold text-red-700 dark:text-red-400 print:text-red-700">
                        {formatCurrency((parseFloat(viewingInvoice.totalAmount) - parseFloat(viewingInvoice.paidAmount)), viewingInvoice.supplierCurrency)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Edit History */}
                {viewingInvoice.editHistory && viewingInvoice.editHistory.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Edit History ({viewingInvoice.editHistory.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {viewingInvoice.editHistory.map((entry: any) => (
                          <div key={entry.id} className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-800/50">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
                              <span className="font-medium text-sm">{entry.editedByName || "Unknown"}</span>
                              <span className="text-xs text-gray-500">{new Date(entry.editedAt).toLocaleString()}</span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{entry.editNote}</p>
                            {entry.changes && Object.keys(entry.changes).length > 0 && (
                              <div className="text-xs space-y-1">
                                {Object.entries(entry.changes).map(([field, change]: [string, any]) => (
                                  field !== "items" ? (
                                    <div key={field} className="flex gap-2">
                                      <span className="font-medium capitalize">{field.replace(/([A-Z])/g, " $1")}:</span>
                                      <span className="text-red-500 line-through">{String(change.old || "—")}</span>
                                      <span className="text-green-600">{String(change.new || "—")}</span>
                                    </div>
                                  ) : (
                                    <div key={field} className="text-gray-500 italic">Line items were modified</div>
                                  )
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t print:hidden">
                  {viewingInvoice.status === "draft" && canEdit && (
                    <Button
                      onClick={() => handleEditInvoice(viewingInvoice)}
                      variant="outline"
                      size="lg"
                      className="w-full sm:w-auto"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Edit Invoice
                    </Button>
                  )}
                  {viewingInvoice.status === "approved" && user?.role === "admin" && (
                    <Button
                      onClick={() => handleEditInvoice(viewingInvoice)}
                      variant="outline"
                      size="lg"
                      className="w-full sm:w-auto"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Edit Invoice
                    </Button>
                  )}
                  <Button
                    onClick={() => handleDuplicateInvoice(viewingInvoice)}
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Duplicate
                  </Button>
                  {viewingInvoice.status === "draft" && (
                    <Button
                      onClick={() => {
                        submitInvoiceMutation.mutate(viewingInvoice.id);
                      }}
                      disabled={submitInvoiceMutation.isPending}
                      variant="default"
                      size="lg"
                      className="w-full sm:w-auto"
                      data-testid={`button-submit-invoice-${viewingInvoice.id}`}
                    >
                      {submitInvoiceMutation.isPending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Submit for Approval
                        </>
                      )}
                    </Button>
                  )}
                  {viewingInvoice.status === "pending_approval" && user?.role === "admin" && (
                    <>
                      <Button
                        onClick={() => {
                          approveInvoiceMutation.mutate(viewingInvoice.id);
                        }}
                        disabled={approveInvoiceMutation.isPending}
                        variant="default"
                        size="lg"
                        className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                        data-testid={`button-approve-invoice-${viewingInvoice.id}`}
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
                      <Button
                        onClick={() => setIsRejectDialogOpen(true)}
                        variant="destructive"
                        size="lg"
                        className="w-full sm:w-auto"
                        data-testid={`button-reject-invoice-${viewingInvoice.id}`}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject Invoice
                      </Button>
                    </>
                  )}
                  {canEdit && viewingInvoice.status === "approved" && parseFloat(viewingInvoice.paidAmount) < parseFloat(viewingInvoice.totalAmount) && (
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
                  {viewingInvoice.status === "approved" && user?.role === "admin" && parseFloat(viewingInvoice.paidAmount || "0") <= 0 && (
                    <Button
                      onClick={() => {
                        if (window.confirm("Are you sure you want to cancel this invoice? This will create reverse ledger entries.")) {
                          cancelInvoiceMutation.mutate(viewingInvoice.id);
                        }
                      }}
                      disabled={cancelInvoiceMutation.isPending}
                      variant="destructive"
                      size="lg"
                      className="w-full sm:w-auto"
                    >
                      {cancelInvoiceMutation.isPending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          Cancelling...
                        </>
                      ) : (
                        <>
                          <Ban className="w-4 h-4 mr-2" />
                          Cancel Invoice
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}
            {/* Payment History */}
            {viewingInvoice?.payments && viewingInvoice.payments.length > 0 && (
              <div className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DollarSign className="w-5 h-5" />
                      Payment History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {viewingInvoice.payments.map((payment: any) => (
                        <div key={payment.id} className="border rounded-lg overflow-hidden">
                          <div
                            className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            onClick={() => setExpandedPayment(expandedPayment === payment.id ? null : payment.id)}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                <span className="font-medium text-green-600">
                                  {formatCurrency(payment.amount, viewingInvoice.currency || "AED")}
                                </span>
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  {formatDisplayDate(payment.paymentDate)}
                                </span>
                                <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                                  {payment.paymentMethod?.replace("_", " ") || "N/A"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">
                                  Recorded: {formatDisplayDate(payment.recordedAt)}
                                </span>
                                <svg
                                  className={`h-4 w-4 transition-transform ${expandedPayment === payment.id ? "rotate-180" : ""}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 9l-7 7-7-7"
                                  />
                                </svg>
                              </div>
                            </div>
                          </div>

                          {expandedPayment === payment.id && (
                            <div className="px-4 pb-4 border-t bg-gray-50 dark:bg-gray-800/50">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
                                <div>
                                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Reference Number:
                                  </label>
                                  <p className="text-sm mt-1 p-2 bg-white dark:bg-gray-700 rounded border">
                                    {payment.referenceNumber || "No reference provided"}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Payment ID:
                                  </label>
                                  <p className="text-sm mt-1 p-2 bg-white dark:bg-gray-700 rounded border">
                                    #{payment.id}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-4">
                                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                  Notes:
                                </label>
                                <p className="text-sm mt-1 p-3 bg-white dark:bg-gray-700 rounded border min-h-[60px]">
                                  {payment.notes || "No notes provided"}
                                </p>
                              </div>

                              <div className="mt-4">
                                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                  Attachments:
                                </label>
                                <div className="mt-2">
                                  {payment.files && payment.files.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {payment.files.map((file: any) => (
                                        <div
                                          key={file.id}
                                          className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded border"
                                        >
                                          <div className="flex items-center gap-2 overflow-hidden">
                                            <Download className="h-4 w-4 flex-shrink-0 text-blue-600" />
                                            <span className="text-sm truncate" title={file.originalName}>
                                              {file.originalName}
                                            </span>
                                          </div>
                                          <Button variant="ghost" size="sm" asChild className="h-8 ml-2">
                                            <a
                                              href={`/api/purchase-payment-files/${file.id}/download`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                            >
                                              Download
                                            </a>
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-500 italic">No attachments</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Record Payment Dialog */}
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent className="max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Payment {viewingInvoice?.currency && viewingInvoice.currency !== "AED" ? `(${viewingInvoice.currency})` : ""}</DialogTitle>
            </DialogHeader>
            {viewingInvoice && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-blue-700 dark:text-blue-300">Invoice Total:</span>
                  <span className="font-semibold text-blue-900 dark:text-blue-100">{formatCurrency(viewingInvoice.totalAmount, viewingInvoice.currency || "AED")}</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-blue-700 dark:text-blue-300">Paid:</span>
                  <span className="font-semibold text-green-700 dark:text-green-400">{formatCurrency(viewingInvoice.paidAmount || "0", viewingInvoice.currency || "AED")}</span>
                </div>
                <div className="flex justify-between items-center mt-1 border-t border-blue-200 dark:border-blue-700 pt-1">
                  <span className="text-blue-700 dark:text-blue-300 font-medium">Balance Due:</span>
                  <span className="font-bold text-blue-900 dark:text-blue-100">{formatCurrency((parseFloat(viewingInvoice.totalAmount) - parseFloat(viewingInvoice.paidAmount || "0")).toFixed(2), viewingInvoice.currency || "AED")}</span>
                </div>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <Label htmlFor="amount">Payment Amount ({viewingInvoice?.currency || "AED"})</Label>
                <Input
                  id="amount"
                  type="number"
                  step="any"
                  min="0"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder={`Enter amount in ${viewingInvoice?.currency || "AED"}`}
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


        {/* Reject Invoice Dialog */}
        <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Reject Invoice</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Please provide a reason for rejecting this invoice. This will be recorded and visible to the creator.
              </p>
              <div>
                <Label htmlFor="rejectionReason">Rejection Reason <span className="text-red-500">*</span></Label>
                <Textarea
                  id="rejectionReason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter the reason for rejection..."
                  rows={4}
                  data-testid="input-rejection-reason"
                />
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsRejectDialogOpen(false);
                    setRejectionReason("");
                  }}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (!rejectionReason.trim()) {
                      toast({
                        title: "Error",
                        description: "Please provide a reason for rejection",
                        variant: "destructive",
                      });
                      return;
                    }
                    if (viewingInvoice) {
                      rejectInvoiceMutation.mutate({
                        invoiceId: viewingInvoice.id,
                        reason: rejectionReason,
                      });
                    }
                  }}
                  disabled={rejectInvoiceMutation.isPending}
                  className="w-full sm:w-auto"
                  data-testid="button-confirm-reject"
                >
                  {rejectInvoiceMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject Invoice
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
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