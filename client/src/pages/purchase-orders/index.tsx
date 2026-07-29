import { formatDisplayDate } from "@/lib/utils";

import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Autocomplete } from "@/components/ui/autocomplete";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CustomPagination } from "@/components/ui/pagination";
import { useAuth } from "@/hooks/use-auth";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { printByUrl } from "@/lib/print-utils";
import { sanitize } from "@/lib/sanitize";
import { Plus, FileText, Package, Truck, CheckCircle, XCircle, Clock, Eye, Trash2, Search, Filter, DollarSign, TrendingUp, CreditCard, Printer, Paperclip, Download, History, Pencil, X } from "lucide-react";
import { InventoryItem, type SupplierBankDetails } from "@shared/schema";
import { computeDocumentTotals } from "@shared/document-totals";

interface Supplier {
  id: number;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  currency?: string;
  vatTreatment?: string;
  bankAccountDetails?: SupplierBankDetails[];
}

interface PurchaseOrder {
  id: number;
  poNumber: string;
  supplierId: number;
  supplierName: string;
  supplierCurrency?: string;
  currency?: string;
  exchangeRate?: string;
  status: "draft" | "pending_approval" | "approved" | "rejected" | "converted";
  orderDate: string;
  expectedDeliveryDate?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  bankAccount?: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  discountPercentage?: string;
  discountAmount?: string;
  notes?: string;
  items?: PurchaseOrderItem[];
  files?: PurchaseOrderFile[];
  submittedById?: number;
  submittedAt?: string;
  approvedById?: number;
  approvedAt?: string;
  rejectionReason?: string;
  convertedInvoiceId?: number;
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

interface PurchaseOrderItem {
  id: number;
  poId: number;
  itemType: "product" | "service";
  inventoryItemId?: number;
  inventoryItemName?: string;
  inventoryItemUnit?: string;
  description?: string;
  quantity: number;
  unitPrice: string;
  taxRate?: string;
  taxAmount?: string;
  discount?: number | string;
  discountType?: "amount" | "percentage";
  lineTotal: string;
}

interface PurchaseOrderFile {
  id: number;
  poId: number;
  fileName: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
}

export default function PurchaseOrdersIndex() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [viewingOrder, setViewingOrder] = useState<PurchaseOrder | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [editNote, setEditNote] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const debouncedSearch = useDebounce(searchQuery, 500);
  const [selectedBankId, setSelectedBankId] = useState<string>("");

  const [formData, setFormData] = useState({
    supplierId: "",
    currency: "AED",
    exchangeRate: "1",
    orderDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: "",
    paymentTerms: "",
    deliveryTerms: "",
    bankAccount: "",
    notes: "",
    discountPercentage: "0",
    discountAmount: "0",
  });

  const [orderItems, setOrderItems] = useState<{
    itemType: "product" | "service";
    inventoryItemId?: string;
    description?: string;
    quantity: string;
    unitPrice: string;
    taxRate: string;
    discount?: string;
    discountType?: "amount" | "percentage";
  }[]>([]);

  const [newItem, setNewItem] = useState({
    itemType: "product" as "product" | "service",
    inventoryItemId: "",
    description: "",
    quantity: "1",
    unitPrice: "0",
    taxRate: "0",
    discount: "0" as string,
    discountType: "amount" as "amount" | "percentage",
  });

  // Index of the order line being edited, or null when the form is adding a
  // new one. Not to be confused with editingOrder, which is the whole PO.
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const itemFormRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // Bring the staging form into view and put the cursor in Description, so
  // clicking Edit on a row far down the table doesn't leave the form off-screen.
  // Description only exists for service lines; the focus is a no-op otherwise.
  const focusItemForm = () => {
    itemFormRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    window.setTimeout(() => descriptionRef.current?.focus(), 0);
  };

  // Never carry a half-finished line edit across a dialog open or close. This
  // keys off the open state rather than the dialog's onOpenChange because Radix
  // only fires that for its own triggers (Escape, overlay, close button) — the
  // programmatic setIsDialogOpen calls in the new, edit and post-submit paths
  // would otherwise leave the index pointing at a stale row.
  useEffect(() => {
    // Only when an edit was actually abandoned: clearing the index alone would
    // leave that row's values sitting in the staging form, so the next "Add"
    // would append a duplicate of it. A half-typed NEW item is left untouched.
    if (editingItemIndex !== null) {
      cancelEditItem();
    }
  }, [isDialogOpen]);

  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [existingFiles, setExistingFiles] = useState<PurchaseOrderFile[]>([]);

  const [invoiceData, setInvoiceData] = useState({
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: "",
    supplierInvoiceNumber: "",
    partial: false,
    discountPercentage: "0",
    discountAmount: "0",
  });

  const [invoiceFormItems, setInvoiceFormItems] = useState<Array<{
    itemType: "product" | "service";
    inventoryItemId?: number | null;
    inventoryItemName?: string;
    inventoryItemUnit?: string;
    description?: string;
    quantity: string;
    unitPrice: string;
    taxRate: string;
    taxAmount: string;
    discount?: string;
    discountType?: "amount" | "percentage";
    lineTotal: string;
  }>>([]);
  const [invoiceNotes, setInvoiceNotes] = useState("");

  // Authoritative totals via the shared engine (VAT on the discounted base;
  // line discount first, then header apportioned). Mirrors the server.
  const purchaseOrderTotals = computeDocumentTotals(
    orderItems.map((it) => ({
      quantity: parseFloat(it.quantity) || 0,
      unitPrice: parseFloat(it.unitPrice) || 0,
      taxRate: parseFloat(it.taxRate) || 0,
      discount: parseFloat(it.discount || "0") || 0,
      discountType: it.discountType === "percentage" ? "percentage" : "amount",
    })),
    parseFloat(formData.discountPercentage || "0") > 0
      ? { discount: parseFloat(formData.discountPercentage || "0"), discountType: "percentage" as const }
      : { discount: parseFloat(formData.discountAmount || "0"), discountType: "amount" as const },
  );
  const [invoicePaymentTerms, setInvoicePaymentTerms] = useState("");
  const [selectedInvoiceFiles, setSelectedInvoiceFiles] = useState<FileList | null>(null);

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
  }, [searchQuery, statusFilter, supplierFilter, startDateFilter, endDateFilter]);

  const { data: poStats } = useQuery<{ totalOrders: number; approved: number; pendingApproval: number; totalValue: string; }>({
    queryKey: ["/api/purchase-orders/stats"],
    enabled: isAuthenticated,
  });

  const { data: paginatedData, isLoading } = useQuery<PaginatedResponse<PurchaseOrder>>({
    queryKey: ["/api/purchase-orders", page, limit, debouncedSearch, statusFilter, supplierFilter, startDateFilter, endDateFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search: debouncedSearch,
        status: statusFilter,
      });
      if (supplierFilter !== "all") params.append("supplierId", supplierFilter);
      if (startDateFilter) params.append("startDate", startDateFilter);
      if (endDateFilter) params.append("endDate", endDateFilter);
      const response = await apiRequest(`/api/purchase-orders?${params.toString()}`);
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const orders = paginatedData?.data || [];
  const pagination = paginatedData?.pagination;

  const { data: suppliersResponse } = useQuery<{ data: Supplier[] }>({
    queryKey: ["/api/suppliers/all"],
    enabled: isAuthenticated,
  });

  const { data: inventoryResponse } = useQuery<{ data: InventoryItem[] }>({
    queryKey: ["/api/inventory"],
    enabled: isAuthenticated,
  });

  const { data: poEditHistory } = useQuery<any[]>({
    queryKey: ["/api/purchase-orders", viewingOrder?.id, "edit-history"],
    queryFn: async () => {
      const response = await apiRequest(`/api/purchase-orders/${viewingOrder?.id}/edit-history`);
      return response.json();
    },
    enabled: isAuthenticated && !!viewingOrder && (user?.role === "admin" || user?.role === "finance"),
  });


  const suppliers = Array.isArray(suppliersResponse?.data) ? suppliersResponse.data : [];
  const inventoryItems = Array.isArray(inventoryResponse?.data) ? inventoryResponse.data : [];

  const bankAccountOptions = React.useMemo(() => {
    const supplier = suppliers.find(s => s.id === parseInt(formData.supplierId));
    let options = supplier?.bankAccountDetails?.map(detail => ({
      id: detail.id,
      accountDetails: detail.accountDetails
    })) || [];

    if (editingOrder?.bankAccount) {
      const isBankAccountInOptions = options.some(option => option.accountDetails === editingOrder.bankAccount);
      if (!isBankAccountInOptions) {
        options.unshift({ id: 0, accountDetails: editingOrder.bankAccount });
      }
    }
    return options;
  }, [formData.supplierId, suppliers, editingOrder]);

  useEffect(() => {
    if (editingOrder) {
      setFormData(prev => ({
        ...prev,
        bankAccount: editingOrder.bankAccount || "",
      }));
    }
  }, [editingOrder]);

  // Auto-calculate total tax amount based on line items
  const calculateTotalTax = () => {
    return orderItems.reduce((total, item) => {
      const quantity = parseInt(item.quantity) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      const taxRate = parseFloat(item.taxRate) || 0;
      const lineSubtotal = quantity * unitPrice;
      const lineTax = (lineSubtotal * taxRate) / 100;
      return total + lineTax;
    }, 0);
  };



  const createOrderMutation = useMutation({
    mutationFn: async (formDataInstance: FormData) => {
      // The body is already FormData, so we pass it directly
      const response = await fetch("/api/purchase-orders", {
        method: "POST",
        body: formDataInstance,
        credentials: 'same-origin',
        // No 'Content-Type' header, browser sets it for FormData
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create purchase order");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({
        title: "Order Created",
        description: "Purchase order has been created successfully.",
      });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create purchase order",
        variant: "destructive",
      });
    },
  });

  const submitOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const response = await apiRequest(`/api/purchase-orders/${orderId}/submit`, { method: "POST" });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to submit order");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({
        title: "Order Submitted",
        description: "Purchase order has been submitted for approval.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit order",
        variant: "destructive",
      });
    },
  });

  const approveOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const response = await apiRequest(`/api/purchase-orders/${orderId}/approve`, { method: "PATCH" });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to approve order");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({
        title: "Order Approved",
        description: "Purchase order has been approved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve order",
        variant: "destructive",
      });
    },
  });

  const rejectOrderMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: number; reason: string }) => {
      const response = await apiRequest(`/api/purchase-orders/${orderId}/reject`, { method: "PATCH", body: { reason } });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to reject order");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({
        title: "Order Rejected",
        description: "Purchase order has been rejected.",
        // variant: "destructive",
      });
      setIsRejectDialogOpen(false);
      setRejectionReason("");
      setViewingOrder(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject order",
        variant: "destructive",
      });
    },
  });

  const convertToInvoiceMutation = useMutation({
    mutationFn: async ({ orderId, formData }: { orderId: number; formData: FormData }) => {
      const response = await fetch(`/api/purchase-orders/${orderId}/convert-to-invoice`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to convert to invoice");
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      const submitted = data?.invoice?.status === "pending_approval";
      toast({
        title: submitted ? "Invoice Submitted for Approval" : "Invoice Created as Draft",
        description: submitted
          ? "The purchase invoice has been created and submitted for approval."
          : "The purchase invoice has been saved as a draft. You can submit it for approval from the Purchase Invoices page.",
      });
      setIsInvoiceDialogOpen(false);
      setIsViewDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to convert to invoice",
        variant: "destructive",
      });
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, formDataInstance }: { orderId: number; formDataInstance: FormData }) => {
      const response = await fetch(`/api/purchase-orders/${orderId}`, {
        method: "PUT",
        body: formDataInstance,
        credentials: 'same-origin',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update purchase order");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({
        title: "Order Updated",
        description: "Purchase order has been updated successfully.",
      });
      setIsDialogOpen(false);
      resetForm();
      setEditingOrder(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update purchase order",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      supplierId: "",
      orderDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate: "",
      paymentTerms: "",
      deliveryTerms: "",
      bankAccount: "",
      notes: "",
      discountPercentage: "0",
      discountAmount: "0",
    });
    setSelectedBankId("");
    setOrderItems([]);
    setNewItem({
      itemType: "product",
      inventoryItemId: "",
      description: "",
      quantity: "1",
      unitPrice: "0",
      taxRate: "0",
      discount: "0",
      discountType: "amount",
    });
    setEditingItemIndex(null);
    setSelectedFiles(null);
    setEditingOrder(null);
    setEditNote("");
  };

  const handleEditOrder = (order: PurchaseOrder) => {
    setEditingOrder(order);
    setFormData({
      supplierId: order.supplierId.toString(),
      orderDate: order.orderDate.split('T')[0],
      expectedDeliveryDate: order.expectedDeliveryDate ? order.expectedDeliveryDate.split('T')[0] : "",
      paymentTerms: order.paymentTerms || "",
      deliveryTerms: order.deliveryTerms || "",
      bankAccount: order.bankAccount || "",
      notes: order.notes || "",
      currency: order.currency || order.supplierCurrency || "AED",
      exchangeRate: order.exchangeRate || "1",
      discountPercentage: order.discountPercentage || "0",
      discountAmount: order.discountAmount || "0",
    });

    if (order.items && order.items.length > 0) {
      setOrderItems(order.items.map(item => ({
        itemType: item.itemType,
        inventoryItemId: item.inventoryItemId?.toString() || "",
        description: item.description || "",
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice,
        taxRate: item.taxRate != null ? item.taxRate.toString() : "0",
        discount: item.discount != null ? item.discount.toString() : "0",
        discountType: item.discountType || "amount",
      })));
    } else {
      setOrderItems([]);
    }

    setExistingFiles(order.files || []);
    setEditNote("");

    setIsDialogOpen(true);
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

      // The row being edited is skipped, otherwise re-saving an unchanged
      // product line would collide with itself.
      if (orderItems.some((item, i) => i !== editingItemIndex && item.itemType === "product" && item.inventoryItemId === newItem.inventoryItemId)) {
        toast({
          title: "Error",
          description: "This item is already in the order",
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

    const quantity = parseInt(newItem.quantity);
    const unitPrice = parseFloat(newItem.unitPrice);
    const taxRate = parseFloat(newItem.taxRate);

    if (quantity <= 0 || unitPrice < 0) {
      toast({
        title: "Error",
        description: "Quantity must be greater than 0 and unit price cannot be negative",
        variant: "destructive",
      });
      return;
    }

    if (taxRate < 0 || taxRate > 100) {
      toast({
        title: "Error",
        description: "Tax rate must be between 0 and 100",
        variant: "destructive",
      });
      return;
    }

    setOrderItems(prev =>
      editingItemIndex === null
        ? [...prev, { ...newItem }]
        : prev.map((existing, i) => (i === editingItemIndex ? { ...newItem } : existing))
    );
    setNewItem({
      itemType: "product",
      inventoryItemId: "",
      description: "",
      quantity: "1",
      unitPrice: "0",
      taxRate: "0",
      discount: "0",
      discountType: "amount",
    });
    setEditingItemIndex(null);
  };

  // Load an existing line back into the staging form above the table. Saving
  // then replaces that row instead of appending a new one.
  const startEditItem = (index: number) => {
    const item = orderItems[index];
    if (!item) return;

    setNewItem({
      itemType: item.itemType,
      inventoryItemId: item.inventoryItemId || "",
      description: item.description || "",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      discount: item.discount || "0",
      discountType: item.discountType || "amount",
    });
    setEditingItemIndex(index);
    focusItemForm();
  };

  const cancelEditItem = () => {
    setNewItem({
      itemType: "product",
      inventoryItemId: "",
      description: "",
      quantity: "1",
      unitPrice: "0",
      taxRate: "0",
      discount: "0",
      discountType: "amount",
    });
    setEditingItemIndex(null);
  };

  const removeItem = (index: number) => {
    setOrderItems(prev => prev.filter((_, i) => i !== index));
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

    if (orderItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item",
        variant: "destructive",
      });
      return;
    }

    const formDataInstance = new FormData();

    // Append main form data
    formDataInstance.append("supplierId", formData.supplierId);
    formDataInstance.append("currency", formData.currency);
    formDataInstance.append("exchangeRate", formData.exchangeRate);
    formDataInstance.append("orderDate", formData.orderDate);
    formDataInstance.append("expectedDeliveryDate", formData.expectedDeliveryDate || "");
    formDataInstance.append("paymentTerms", formData.paymentTerms || "");
    formDataInstance.append("deliveryTerms", formData.deliveryTerms || "");
    formDataInstance.append("bankAccount", formData.bankAccount || "");
    formDataInstance.append("notes", formData.notes || "");

    // Process and append items as a JSON string
    const items = orderItems.map(item => {
      const quantity = parseInt(item.quantity);
      const unitPrice = parseFloat(item.unitPrice);
      const taxRate = parseFloat(item.taxRate);
      const lineSubtotal = quantity * unitPrice;
      const lineDiscountVal = parseFloat(item.discount || "0") || 0;
      const lineDiscount = item.discountType === "percentage"
        ? lineSubtotal * (lineDiscountVal / 100)
        : Math.min(lineDiscountVal, lineSubtotal);
      const taxAmount = ((lineSubtotal - lineDiscount) * taxRate) / 100;

      return {
        itemType: item.itemType,
        inventoryItemId: item.inventoryItemId ? parseInt(item.inventoryItemId) : null,
        description: item.description || null,
        quantity,
        unitPrice,
        taxRate,
        taxAmount,
        discount: lineDiscountVal,
        discountType: item.discountType || "amount",
      };
    });
    formDataInstance.append("items", JSON.stringify(items));

    // Calculate and append totals
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const taxAmount = calculateTotalTax();
    const discountPct = parseFloat(formData.discountPercentage) || 0;
    const discountAmt = parseFloat(formData.discountAmount) || 0;
    const totalAmount = subtotal + taxAmount - discountAmt;
    formDataInstance.append("subtotal", subtotal.toFixed(2));
    formDataInstance.append("taxAmount", taxAmount.toFixed(2));
    formDataInstance.append("totalAmount", totalAmount.toFixed(2));
    formDataInstance.append("discountPercentage", discountPct.toFixed(2));
    formDataInstance.append("discountAmount", discountAmt.toFixed(2));

    // Append files
    if (selectedFiles) {
      for (let i = 0; i < selectedFiles.length; i++) {
        formDataInstance.append("files", selectedFiles[i]);
      }
    }

    if (editingOrder) {
      if (!editNote.trim()) {
        toast({
          title: "Error",
          description: "Please provide an edit note",
          variant: "destructive",
        });
        return;
      }
      formDataInstance.append("editNote", editNote.trim());
      const keptFileIds = existingFiles.map((file) => file.id);
      formDataInstance.append("existingFiles", JSON.stringify(keptFileIds));
      updateOrderMutation.mutate({ orderId: editingOrder.id, formDataInstance });
    } else {
      createOrderMutation.mutate(formDataInstance);
    }
  };

  const viewOrder = (order: PurchaseOrder) => {
    setViewingOrder(order);
    setIsViewDialogOpen(true);
  };

  const handlePrintPDF = async (order: PurchaseOrder) => {
    try {
      await printByUrl(`/api/purchase-orders/${order.id}/pdf`);

      toast({
        title: "Success",
        description: "Print window opened successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to open print preview.",
        variant: "destructive",
      });
    }
  };

  const openConvertDialog = (order?: PurchaseOrder) => {
    const target = order || viewingOrder;
    if (!target) return;
    if (order) setViewingOrder(order);
    setInvoiceData({
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: target.expectedDeliveryDate ? target.expectedDeliveryDate.split('T')[0] : "",
      supplierInvoiceNumber: "",
      partial: false,
      discountPercentage: target.discountPercentage || "0",
      discountAmount: target.discountAmount || "0",
    });
    setInvoicePaymentTerms(target.paymentTerms || "");
    setInvoiceNotes(target.notes || "");
    if (target.items && target.items.length > 0) {
      setInvoiceFormItems(target.items.map(item => {
        const qty = parseFloat(item.quantity.toString());
        const price = parseFloat(item.unitPrice);
        const taxRate = parseFloat(item.taxRate || "0");
        const discountVal = item.discount != null ? Number(item.discount) : 0;
        const discountType = item.discountType === "percentage" ? "percentage" : "amount";
        const lineSubtotal = qty * price;
        const lineDiscount = discountType === "percentage"
          ? lineSubtotal * (discountVal / 100)
          : Math.min(discountVal, lineSubtotal);
        const taxable = lineSubtotal - lineDiscount;
        const taxAmount = taxable * (taxRate / 100);
        return {
          itemType: item.itemType,
          inventoryItemId: item.inventoryItemId ?? null,
          inventoryItemName: item.inventoryItemName,
          inventoryItemUnit: item.inventoryItemUnit,
          description: item.description,
          quantity: qty.toString(),
          unitPrice: price.toFixed(2),
          taxRate: taxRate.toString(),
          discount: discountVal.toString(),
          discountType,
          taxAmount: taxAmount.toFixed(2),
          lineTotal: taxable.toFixed(2), // pre-tax line net of discount
        };
      }));
    } else {
      setInvoiceFormItems([]);
    }
    setIsInvoiceDialogOpen(true);
  };

  const recalcInvoiceItem = (
    idx: number,
    field: "quantity" | "unitPrice" | "taxRate" | "discount" | "discountType",
    value: string,
  ) => {
    setInvoiceFormItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      const qty = parseFloat(updated.quantity) || 0;
      const price = parseFloat(updated.unitPrice) || 0;
      const rate = parseFloat(updated.taxRate) || 0;
      const discVal = parseFloat(updated.discount || "0") || 0;
      const subtotal = qty * price;
      const disc = updated.discountType === "percentage" ? subtotal * (discVal / 100) : Math.min(discVal, subtotal);
      const taxable = subtotal - disc;
      const taxAmt = taxable * (rate / 100);
      return {
        ...updated,
        taxAmount: taxAmt.toFixed(2),
        lineTotal: taxable.toFixed(2),
      };
    }));
  };

  // Authoritative convert totals via the shared engine (VAT on the discounted
  // base; line discount first, then header apportioned). Mirrors the server.
  const convertTotals = computeDocumentTotals(
    invoiceFormItems.map((it) => ({
      quantity: parseFloat(it.quantity) || 0,
      unitPrice: parseFloat(it.unitPrice) || 0,
      taxRate: parseFloat(it.taxRate) || 0,
      discount: parseFloat(it.discount || "0") || 0,
      discountType: it.discountType === "percentage" ? "percentage" : "amount",
    })),
    parseFloat(invoiceData.discountPercentage || "0") > 0
      ? { discount: parseFloat(invoiceData.discountPercentage || "0"), discountType: "percentage" as const }
      : { discount: parseFloat(invoiceData.discountAmount || "0"), discountType: "amount" as const },
  );
  const invoiceSubtotal = convertTotals.gross;
  const invoiceTaxTotal = convertTotals.taxTotal;
  const invoiceDiscountAmount = convertTotals.discountTotal;
  const invoiceTotal = convertTotals.total;

  const handleConvertToInvoice = (submitForApproval = false) => {
    if (!viewingOrder) return;

    const formData = new FormData();
    formData.append("invoiceDate", invoiceData.invoiceDate);
    if (invoiceData.dueDate) formData.append("dueDate", invoiceData.dueDate);
    if (invoiceData.supplierInvoiceNumber) formData.append("supplierInvoiceNumber", invoiceData.supplierInvoiceNumber);
    if (invoiceNotes) formData.append("notes", invoiceNotes);
    if (invoicePaymentTerms) formData.append("paymentTerms", invoicePaymentTerms);
    formData.append("currency", viewingOrder.currency || viewingOrder.supplierCurrency || "AED");
    formData.append("exchangeRate", viewingOrder.exchangeRate || "1");
    formData.append("discountPercentage", invoiceData.discountPercentage);
    formData.append("discountAmount", invoiceData.discountAmount);
    formData.append("submitForApproval", submitForApproval.toString());

    const items = invoiceFormItems.map(item => ({
      itemType: item.itemType,
      inventoryItemId: item.inventoryItemId ?? null,
      description: item.description,
      quantity: parseFloat(item.quantity) || 1,
      unitPrice: parseFloat(item.unitPrice) || 0,
      taxRate: parseFloat(item.taxRate) || 0,
      taxAmount: parseFloat(item.taxAmount) || 0,
      discount: parseFloat(item.discount || "0") || 0,
      discountType: item.discountType || "amount",
      lineTotal: parseFloat(item.lineTotal) || 0,
    }));
    formData.append("items", JSON.stringify(items));

    if (selectedInvoiceFiles) {
      for (let i = 0; i < selectedInvoiceFiles.length; i++) {
        formData.append("files", selectedInvoiceFiles[i]);
      }
    }

    convertToInvoiceMutation.mutate({
      orderId: viewingOrder.id,
      formData,
    });
  };

  const getItemName = (itemId: string) => {
    const item = inventoryItems.find(item => item.id === parseInt(itemId));
    return item ? item.name : "Unknown Item";
  };

  const getItemDescription = (itemId: string | number) => {
    const id = typeof itemId === "string" ? parseInt(itemId) : itemId;
    const item = inventoryItems.find(item => item.id === id);
    return item ? item.description : "";
  };

  const getItemUnit = (itemId: string) => {
    const item = inventoryItems.find(item => item.id === parseInt(itemId));
    return item ? item.unit : "";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="outline" className="bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400">Draft</Badge>;
      case "pending_approval":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">Pending Approval</Badge>;
      case "approved":
        return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">Rejected</Badge>;
      case "converted":
        return <Badge variant="default" className="bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400">Converted</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const canCreateInvoice = (order: PurchaseOrder) => {
    return order.status === "approved";
  };

  const canEdit = user?.role === "admin" || user?.role === "finance";

  const filteredOrders = orders;

  const applyFilters = () => {
    // Filters are applied automatically through filteredOrders
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setSupplierFilter("all");
    setStartDateFilter("");
    setEndDateFilter("");
  };

  // Calculate statistics
  const totalOrderValue = orders?.length
    ? orders.reduce((sum, order) => sum + parseFloat(order.totalAmount || "0"), 0)
    : 0;

  const statusCounts = orders?.reduce((counts, order) => {
    counts[order.status] = (counts[order.status] || 0) + 1;
    return counts;
  }, {} as Record<string, number>) || {};

  const formatCurrency = (amount: string | number, currency: string = "AED") => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return `${currency} ${num.toFixed(2)}`;
  };

  const getTaxRateFromVatTreatment = (
    vatTreatment?: string
  ): number => {
    return vatTreatment === "standard" ? 5 : 0;
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Purchase Orders
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Create and manage purchase orders for your suppliers
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          {canEdit && (
            <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              New Purchase Order
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <FileText className="h-5 w-5 md:h-6 md:w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-3 md:ml-4">
                <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400">
                  Purchase Orders
                </p>
                <p className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {poStats?.totalOrders || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="h-5 w-5 md:h-6 md:w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-3 md:ml-4">
                <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400">
                  Approved
                </p>
                <p className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {poStats?.approved || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                <Clock className="h-5 w-5 md:h-6 md:w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="ml-3 md:ml-4">
                <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400">
                  Pending Approval
                </p>
                <p className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {poStats?.pendingApproval || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <DollarSign className="h-5 w-5 md:h-6 md:w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="ml-3 md:ml-4">
                <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400">
                  Total Value
                </p>
                <p className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency(poStats?.totalValue || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="searchFilter" className="text-sm font-medium">
                  Search
                </Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    id="searchFilter"
                    placeholder="Search orders..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending_approval">Pending Approval</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="converted">Converted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Supplier</Label>
                <Autocomplete
                  options={[
                    { value: "all", label: "All Suppliers" },
                    ...suppliers.map((supplier) => ({
                      value: supplier.id.toString(),
                      label: supplier.name,
                      searchText: supplier.name
                    }))
                  ]}
                  value={supplierFilter}
                  onValueChange={setSupplierFilter}
                  placeholder="Search supplier..."
                  emptyMessage="No suppliers found"
                  className="mt-1"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={clearFilters} variant="outline" className="w-full">
                  Clear All Filters
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="startDate" className="text-sm font-medium">
                  Order Date From
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="endDate" className="text-sm font-medium">
                  Order Date To
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Purchase Orders
            <Badge variant="secondary" className="ml-auto">
              {filteredOrders.length} orders
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Loading orders...
              </div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery || statusFilter !== "all" || supplierFilter !== "all"
                  ? "No orders found"
                  : "No purchase orders yet"
                }
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || statusFilter !== "all" || supplierFilter !== "all"
                  ? "Try adjusting your search or filters to find what you're looking for."
                  : "Get started by creating your first purchase order."
                }
              </p>
              {(!searchQuery && statusFilter === "all" && supplierFilter === "all" && canEdit) && (
                <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Create Purchase Order
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">PO Number</TableHead>
                    <TableHead className="min-w-[150px]">Supplier</TableHead>
                    <TableHead className="min-w-[100px]">Order Date</TableHead>
                    <TableHead className="min-w-[100px]">Status</TableHead>
                    <TableHead className="min-w-[120px]">Total Amount</TableHead>
                    <TableHead className="min-w-[120px]">Expected Delivery</TableHead>
                    <TableHead className="text-right min-w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        {order.poNumber}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <span className="truncate">{order.supplierName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatDisplayDate(order.orderDate)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(order.status)}
                      </TableCell>
                      <TableCell className="font-semibold text-green-600">
                        {formatCurrency(order.totalAmount, order.currency || order.supplierCurrency)}
                      </TableCell>
                      <TableCell>
                        {order.expectedDeliveryDate
                          ? formatDisplayDate(order.expectedDeliveryDate)
                          : "-"
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => viewOrder(order)} className="gap-1" data-testid={`button-view-order-${order.id}`}>
                            <Eye className="w-4 h-4" />
                            <span className="hidden sm:inline">View</span>
                          </Button>

                          {/* Edit - Draft and Approved/Pending orders for admin/finance */}
                          {(order.status === "draft" || (["approved", "pending_approval", "rejected"].includes(order.status) && (user?.role === "admin" || user?.role === "finance"))) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditOrder(order)}
                              data-testid={`button-edit-order-${order.id}`}
                            >
                              Edit
                            </Button>
                          )}

                          {/* Submit for Approval - Draft orders, all roles */}
                          {order.status === "draft" && (
                            <Button
                              size="sm"
                              onClick={() => submitOrderMutation.mutate(order.id)}
                              disabled={submitOrderMutation.isPending}
                              data-testid={`button-submit-order-${order.id}`}
                            >
                              {submitOrderMutation.isPending ? "Submitting..." : "Submit"}
                            </Button>
                          )}

                          {/* Approve - Pending orders, admin only */}
                          {order.status === "pending_approval" && user?.role === "admin" && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => approveOrderMutation.mutate(order.id)}
                              disabled={approveOrderMutation.isPending}
                              data-testid={`button-approve-order-${order.id}`}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              {approveOrderMutation.isPending ? "Approving..." : "Approve"}
                            </Button>
                          )}

                          {/* Reject - Pending orders, admin only */}
                          {order.status === "pending_approval" && user?.role === "admin" && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setViewingOrder(order);
                                setIsRejectDialogOpen(true);
                              }}
                              data-testid={`button-reject-order-${order.id}`}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          )}

                          {/* Convert to Invoice - Approved orders, admin/finance */}
                          {order.status === "approved" && (user?.role === "admin" || user?.role === "finance") && (
                            <Button
                              size="sm"
                              onClick={() => openConvertDialog(order)}
                              data-testid={`button-convert-order-${order.id}`}
                            >
                              <FileText className="w-4 h-4 mr-1" />
                              Convert
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {pagination && pagination.totalPages > 1 && (
          <div className="p-4 border-t">
            <CustomPagination
              currentPage={page}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>

      {/* Create Order Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0 border-b pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold">
                  {editingOrder ? "Edit Purchase Order" : "Create Purchase Order"}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {editingOrder ? `Editing ${editingOrder.poNumber}` : "Create a new purchase order for your supplier"}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <Label htmlFor="supplierId">Supplier *</Label>
                  <Autocomplete
                    options={suppliers.map((supplier) => ({
                      value: supplier.id.toString(),
                      label: supplier.name,
                      searchText: supplier.name
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
                        bankAccount: ""
                      }));

                      // Update existing items (only if still 0)
                      setOrderItems(items =>
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
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="orderDate">Order Date *</Label>
                  <Input
                    id="orderDate"
                    type="date"
                    value={formData.orderDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, orderDate: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="expectedDeliveryDate">Expected Delivery Date</Label>
                  <Input
                    id="expectedDeliveryDate"
                    type="date"
                    value={formData.expectedDeliveryDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, expectedDeliveryDate: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="paymentTerms">Payment Terms</Label>
                  <Input
                    id="paymentTerms"
                    value={formData.paymentTerms}
                    onChange={(e) => setFormData(prev => ({ ...prev, paymentTerms: e.target.value }))}
                    placeholder="e.g., Net 30, Due on Receipt, 50% Advance"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="deliveryTerms">Delivery Terms</Label>
                  <Input
                    id="deliveryTerms"
                    value={formData.deliveryTerms}
                    onChange={(e) => setFormData(prev => ({ ...prev, deliveryTerms: e.target.value }))}
                    placeholder="e.g., FOB, CIF, Ex Works"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="bankAccount">Bank Account Details (Optional)</Label>
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
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccountOptions.map((detail, index) => (
                      <React.Fragment key={detail.id}>
                        <SelectItem value={detail.id.toString()}>
                          <div className="whitespace-pre-wrap">{detail.accountDetails}</div>
                        </SelectItem>
                        {index < bankAccountOptions.length - 1 && (
                          <hr className="my-1" />
                        )}
                      </React.Fragment>
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

              <div>
                <Label htmlFor="notes">Notes</Label>
                <div className="mt-1 border border-input rounded-md overflow-hidden">
                  <ReactQuill
                    theme="snow"
                    value={formData.notes}
                    onChange={(value) => setFormData(prev => ({ ...prev, notes: value }))}
                    placeholder="Optional notes"
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
                  onChange={(e) => setSelectedFiles(e.target.files)}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="text-sm text-gray-500">
                  You can attach multiple files (PDF, DOC, images, etc.). Max 25MB per file.
                </p>
                {selectedFiles && selectedFiles.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium">Selected files:</p>
                    <ul className="text-sm text-gray-600 mt-1">
                      {Array.from(selectedFiles).map((file, index) => (
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
                {editingOrder && existingFiles.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">
                      Currently Attached Files:
                    </p>
                    <ul className="space-y-2">
                      {existingFiles.map((file) => (
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
                              setExistingFiles(
                                existingFiles.filter((f) => f.id !== file.id)
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

              <div className="space-y-4">
                <Label className="text-lg font-semibold">Order Items *</Label>

                {/* Add Item Form */}
                <Card ref={itemFormRef} className="p-4 bg-muted/30">
                  <div className="space-y-4">
                    {/* Item Type Selector */}
                    <div>
                      <Label>Item Type *</Label>
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
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="product">Product (from Inventory)</SelectItem>
                          <SelectItem value="service">Service (Manual Entry)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Conditional Fields Based on Item Type */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                      {newItem.itemType === "product" ? (
                        <div className="sm:col-span-2 lg:col-span-1">
                          <Label>Inventory Item *</Label>
                          <Autocomplete
                            options={(inventoryItems || []).map((item) => ({
                              value: item.id.toString(),
                              label: item.name,
                              description: item.description,
                              searchText: `${item.name} ${item.description || ""} ${item.unit}`
                            }))}
                            value={newItem.inventoryItemId || ""}
                            onValueChange={(value) => setNewItem(prev => ({ ...prev, inventoryItemId: value }))}
                            placeholder="Type to search items..."
                            className="mt-1"
                          />
                        </div>
                      ) : (
                        <div className="sm:col-span-2 lg:col-span-5">
                          <Label>Description *</Label>
                          <Textarea
                            ref={descriptionRef}
                            rows={3}
                            value={newItem.description || ""}
                            onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Enter service description"
                            className="mt-1"
                          />
                        </div>
                      )}
                      <div>
                        <Label>Quantity *</Label>
                        <Input
                          type="number"
                          min="1"
                          value={newItem.quantity}
                          onChange={(e) => setNewItem(prev => ({ ...prev, quantity: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Unit Price ({formData.currency}) *</Label>
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          value={newItem.unitPrice}
                          onChange={(e) => setNewItem(prev => ({ ...prev, unitPrice: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Tax Rate (%)</Label>
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          max="100"
                          value={newItem.taxRate}
                          onChange={(e) => setNewItem(prev => ({ ...prev, taxRate: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Discount</Label>
                        <div className="flex gap-1 mt-1">
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            value={newItem.discount}
                            onChange={(e) => setNewItem(prev => ({ ...prev, discount: e.target.value }))}
                          />
                          <select
                            className="border rounded px-2 text-sm bg-background"
                            value={newItem.discountType}
                            onChange={(e) => setNewItem(prev => ({ ...prev, discountType: e.target.value as "amount" | "percentage" }))}
                          >
                            <option value="amount">{formData.currency || "AED"}</option>
                            <option value="percentage">%</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex items-end sm:col-span-2 lg:col-span-1">
                        {/* wraps so the Cancel button that appears in edit mode
                            drops to its own line instead of overflowing the card */}
                        <div className="flex w-full gap-2 flex-wrap">
                          <Button type="button" onClick={addItem} className="w-full lg:w-auto gap-1">
                            {editingItemIndex === null ? (
                              <>
                                <Plus className="w-4 h-4" />
                                Add
                              </>
                            ) : (
                              <>
                                <Pencil className="w-4 h-4" />
                                Update Item
                              </>
                            )}
                          </Button>
                          {editingItemIndex !== null && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={cancelEditItem}
                              className="w-full lg:w-auto gap-1"
                            >
                              <X className="w-4 h-4" />
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                {orderItems.length === 0 ? (
                  <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">No items added yet</p>
                    <p className="text-sm text-gray-400">Use the form above to add items to your order</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <Table className="min-w-[760px] table-fixed">
                          {/* Item/Description takes whatever the fixed numeric
                              columns leave, so long multi-line text has room. */}
                          <colgroup>
                            <col className="w-[100px]" />
                            <col />
                            <col className="w-[80px]" />
                            <col className="w-[110px]" />
                            <col className="w-[80px]" />
                            <col className="w-[100px]" />
                            <col className="w-[120px]" />
                            <col className="w-[90px]" />
                          </colgroup>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-[100px]">Type</TableHead>
                              <TableHead className="min-w-[200px]">Item/Description</TableHead>
                              <TableHead className="min-w-[80px]">Quantity</TableHead>
                              <TableHead className="min-w-[100px]">Unit Price ({formData.currency})</TableHead>
                              <TableHead className="min-w-[80px]">Tax Rate</TableHead>
                              <TableHead className="min-w-[90px]">Discount</TableHead>
                              <TableHead className="min-w-[100px]">Line Total ({formData.currency})</TableHead>
                              <TableHead className="w-16"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {orderItems.map((item, index) => {
                              const quantity = parseInt(item.quantity) || 0;
                              const unitPrice = parseFloat(item.unitPrice) || 0;
                              const taxRate = parseFloat(item.taxRate) || 0;
                              const lineSubtotal = quantity * unitPrice;
                              const lineDiscVal = parseFloat(item.discount || "0") || 0;
                              const lineDiscount = item.discountType === "percentage"
                                ? lineSubtotal * (lineDiscVal / 100)
                                : Math.min(lineDiscVal, lineSubtotal);
                              const taxable = lineSubtotal - lineDiscount;
                              const lineTax = (taxable * taxRate) / 100;
                              const lineTotal = taxable + lineTax;

                              return (
                                <TableRow
                                  key={index}
                                  className={editingItemIndex === index ? "bg-blue-50 dark:bg-blue-950" : undefined}
                                >
                                  <TableCell>
                                    <Badge variant={item.itemType === "product" ? "default" : "secondary"}>
                                      {item.itemType === "product" ? "Product" : "Service"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="font-medium whitespace-pre-wrap break-words">
                                    <div className="flex flex-col">
                                      <span>
                                        {item.itemType === "product"
                                          ? getItemName(item.inventoryItemId || "")
                                          : item.description}
                                      </span>
                                      {item.itemType === "product" && item.inventoryItemId && (() => {
                                        const description = getItemDescription(item.inventoryItemId);
                                        return description && (
                                          <span className="text-xs text-muted-foreground">
                                            {description}
                                          </span>
                                        );
                                      })()}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {item.quantity} {item.itemType === "product" ? getItemUnit(item.inventoryItemId || "") : ""}
                                  </TableCell>
                                  <TableCell>{formatCurrency(item.unitPrice, formData.currency)}</TableCell>
                                  <TableCell>{item.taxRate}%</TableCell>
                                  <TableCell>
                                    {lineDiscVal > 0
                                      ? (item.discountType === "percentage" ? `${lineDiscVal}%` : formatCurrency(lineDiscVal, formData.currency))
                                      : "-"}
                                  </TableCell>
                                  <TableCell className="font-semibold">{formatCurrency(lineTotal, formData.currency)}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        title="Edit item"
                                        aria-label="Edit item"
                                        data-testid={`button-edit-po-item-${index}`}
                                        onClick={() => startEditItem(index)}
                                      >
                                        <Pencil className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-red-600 hover:text-red-700"
                                        title={editingItemIndex !== null ? "Finish or cancel the current edit first" : "Remove item"}
                                        aria-label="Remove item"
                                        data-testid={`button-remove-po-item-${index}`}
                                        disabled={editingItemIndex !== null}
                                        onClick={() => removeItem(index)}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    {/* Order Summary */}
                    <div className="bg-muted/30 rounded-lg p-4">
                      <div className="space-y-4 text-sm">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>{formatCurrency(purchaseOrderTotals.gross, formData.currency)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Tax:</span>
                          <span>{formatCurrency(purchaseOrderTotals.taxTotal, formData.currency)}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 py-4 border-y">
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
                                const subtotal = orderItems.reduce((sum, item) => sum + (parseInt(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0), 0);
                              const calcDiscount = (subtotal * pct / 100);
                              setFormData(prev => ({ 
                                ...prev, 
                                discountPercentage: val, 
                                discountAmount: val === "" ? "" : calcDiscount.toString() 
                              }));
                              }}
                              placeholder="0.00"
                              className="mt-1 h-8"
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
                                const subtotal = orderItems.reduce((sum, item) => sum + (parseInt(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0), 0);
                              const amount = parseFloat(val) || 0;
                              const calcPct = subtotal > 0 ? ((amount / subtotal) * 100) : 0;
                              setFormData(prev => ({ 
                                ...prev, 
                                discountAmount: val, 
                                discountPercentage: val === "" ? "" : calcPct.toString() 
                              }));
                              }}
                              placeholder="0.00"
                              className="mt-1 h-8"
                            />
                          </div>
                        </div>

                        {purchaseOrderTotals.discountTotal > 0 && (
                          <div className="flex justify-between text-red-600">
                            <span>Total Discount:</span>
                            <span>- {formatCurrency(purchaseOrderTotals.discountTotal, formData.currency)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold border-t pt-2 text-base">
                          <span>Total Amount:</span>
                          <span>{formatCurrency(purchaseOrderTotals.total, formData.currency)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {editingOrder && (
                <div className="space-y-2 border-t pt-4">
                  <Label htmlFor="editNote" className="text-sm font-medium text-red-600">Edit Note (Required) *</Label>
                  <Textarea
                    id="editNote"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="Explain the reason for this edit..."
                    className="min-h-[80px]"
                    required
                  />
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createOrderMutation.isPending || updateOrderMutation.isPending}
                  className="w-full sm:w-auto gap-2"
                >
                  {(createOrderMutation.isPending || updateOrderMutation.isPending) ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {editingOrder ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      {editingOrder ? "Update Order" : "Create Order"}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Order Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0 border-b pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-semibold">Purchase Order</DialogTitle>
                  <p className="text-sm text-muted-foreground">{viewingOrder?.poNumber}</p>
                </div>
              </div>
              {viewingOrder && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePrintPDF(viewingOrder)}
                    className="gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </Button>
                  {getStatusBadge(viewingOrder.status)}
                </div>
              )}
            </div>
          </DialogHeader>

          {viewingOrder && (
            <div className="flex-1 overflow-y-auto space-y-6 py-4">
              {/* Supplier & Order Information */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Order Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Supplier</label>
                        <p className="text-sm font-semibold mt-1">{viewingOrder.supplierName}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Order Date</label>
                        <p className="text-sm font-medium mt-1">{formatDisplayDate(viewingOrder.orderDate)}</p>
                      </div>
                      {viewingOrder.paymentTerms && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Payment Terms</label>
                          <p className="text-sm font-medium mt-1">{viewingOrder.paymentTerms}</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      {viewingOrder.expectedDeliveryDate && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Expected Delivery</label>
                          <p className="text-sm font-medium mt-1">{formatDisplayDate(viewingOrder.expectedDeliveryDate)}</p>
                        </div>
                      )}
                      {viewingOrder.deliveryTerms && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Delivery Terms</label>
                          <p className="text-sm font-medium mt-1">{viewingOrder.deliveryTerms}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Approval Information */}
              {(viewingOrder.submittedAt || viewingOrder.approvedAt || viewingOrder.rejectionReason) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Approval Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {viewingOrder.submittedAt && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-3 border-b">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Submitted By</label>
                            <p className="text-sm font-medium mt-1">User ID: {viewingOrder.submittedById}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Submitted Date</label>
                            <p className="text-sm font-medium mt-1">
                              {new Date(viewingOrder.submittedAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      )}

                      {viewingOrder.approvedAt && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-3">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Approved By</label>
                            <p className="text-sm font-medium mt-1">User ID: {viewingOrder.approvedById}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Approved Date</label>
                            <p className="text-sm font-medium mt-1">
                              {new Date(viewingOrder.approvedAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      )}

                      {viewingOrder.rejectionReason && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-3">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rejection Reason</label>
                            <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
                              <p className="text-sm text-red-900 dark:text-red-100 whitespace-pre-wrap">
                                {viewingOrder.rejectionReason}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Bank Account Details */}
              {viewingOrder.bankAccount && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Bank Account Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div 
                      className="text-sm bg-muted/50 p-3 rounded-lg rich-text-content"
                      dangerouslySetInnerHTML={{ __html: sanitize(viewingOrder.bankAccount || "") }}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Notes */}
              {viewingOrder.notes && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div 
                      className="text-sm text-muted-foreground rich-text-content"
                      dangerouslySetInnerHTML={{ __html: sanitize(viewingOrder.notes || "") }}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Attachments */}
              {viewingOrder.files && viewingOrder.files.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Paperclip className="w-4 h-4" />
                      Attachments
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {viewingOrder.files.map((file) => (
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
                              <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                                ({(file.fileSize / 1024).toFixed(2)} KB)
                              </span>
                            </a>
                          </Button>

                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Edit History */}
              {poEditHistory && poEditHistory.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <History className="w-4 h-4" />
                      Edit History ({poEditHistory.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {poEditHistory.map((entry: any) => (
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

              {/* Line Items */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Order Items
                    <Badge variant="secondary" className="ml-2">
                      {viewingOrder.items?.length || 0} items
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Item Description</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Unit Price ({viewingOrder.currency || viewingOrder.supplierCurrency})</TableHead>
                          <TableHead className="text-right">Tax Rate</TableHead>
                          <TableHead className="text-right">Discount</TableHead>
                          <TableHead className="text-right">Line Total ({viewingOrder.currency || viewingOrder.supplierCurrency})</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewingOrder.items?.map((item, index) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{index + 1}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {item.itemType === "product" && (
                                  <Badge variant="default" className="text-xs">
                                    Product
                                  </Badge>
                                )}
                                <div className="flex flex-col">
                                  <span className="font-medium whitespace-pre-wrap break-words">
                                    {item.itemType === "product" ? item.inventoryItemName : item.description}
                                  </span>
                                  {item.itemType === "product" && item.inventoryItemId && (() => {
                                    const description = getItemDescription(item.inventoryItemId);
                                    return description && (
                                      <span className="text-xs text-muted-foreground">
                                        {description}
                                      </span>
                                    );
                                  })()}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {item.quantity} {item.itemType === "product" ? item.inventoryItemUnit : ""}
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(item.unitPrice, viewingOrder.currency || viewingOrder.supplierCurrency)}</TableCell>
                            <TableCell className="text-right">{item.taxRate || "0"}%</TableCell>
                            <TableCell className="text-right">
                              {Number(item.discount) > 0
                                ? (item.discountType === "percentage" ? `${item.discount}%` : formatCurrency(item.discount as any, viewingOrder.currency || viewingOrder.supplierCurrency))
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(item.lineTotal, viewingOrder.currency || viewingOrder.supplierCurrency)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Financial Summary */}
                  <div className="mt-6 space-y-3">
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Subtotal ({viewingOrder.currency || viewingOrder.supplierCurrency})</span>
                        <span className="font-medium">{formatCurrency(viewingOrder.subtotal, viewingOrder.currency || viewingOrder.supplierCurrency)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm mt-2">
                        <span className="text-muted-foreground">Tax ({viewingOrder.currency || viewingOrder.supplierCurrency})</span>
                        <span className="font-medium">{formatCurrency(viewingOrder.taxAmount, viewingOrder.currency || viewingOrder.supplierCurrency)}</span>
                      </div>
                      {(() => {
                        // Total discount (header + line) derived from stored fields;
                        // the discountAmount column holds only the header portion.
                        const totalDiscount =
                          parseFloat(viewingOrder.subtotal || "0") +
                          parseFloat(viewingOrder.taxAmount || "0") -
                          parseFloat(viewingOrder.totalAmount || "0");
                        return totalDiscount > 0.005 ? (
                          <div className="flex justify-between items-center text-sm mt-2">
                            <span className="text-muted-foreground">Total Discount ({viewingOrder.currency || viewingOrder.supplierCurrency})</span>
                            <span className="font-medium text-red-600">- {formatCurrency(totalDiscount.toFixed(2), viewingOrder.currency || viewingOrder.supplierCurrency)}</span>
                          </div>
                        ) : null;
                      })()}
                    </div>
                    <div className="border-t pt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-base font-semibold">Total Amount ({viewingOrder.currency || viewingOrder.supplierCurrency})</span>
                        <span className="text-xl font-bold text-primary">{formatCurrency(viewingOrder.totalAmount, viewingOrder.currency || viewingOrder.supplierCurrency)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              {canEdit && canCreateInvoice(viewingOrder) && (
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    onClick={() => openConvertDialog()}
                    className="gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Convert to Invoice
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Convert to Invoice Dialog */}
      <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Review &amp; Edit Invoice — from {viewingOrder?.poNumber}
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Review the invoice details below. You may edit any field before creating.
            </p>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="supplierInvoiceNumber">Supplier Invoice Number</Label>
                <Input
                  id="supplierInvoiceNumber"
                  value={invoiceData.supplierInvoiceNumber}
                  onChange={(e) => setInvoiceData(prev => ({ ...prev, supplierInvoiceNumber: e.target.value }))}
                  placeholder="e.g. INV-12345"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="invoiceDate">Invoice Date *</Label>
                <Input
                  id="invoiceDate"
                  type="date"
                  value={invoiceData.invoiceDate}
                  onChange={(e) => setInvoiceData(prev => ({ ...prev, invoiceDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={invoiceData.dueDate}
                  onChange={(e) => setInvoiceData(prev => ({ ...prev, dueDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Payment Terms */}
            <div>
              <Label htmlFor="invoicePaymentTerms">Payment Terms</Label>
              <Input
                id="invoicePaymentTerms"
                value={invoicePaymentTerms}
                onChange={(e) => setInvoicePaymentTerms(e.target.value)}
                placeholder="e.g. Net 30"
                className="mt-1"
              />
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="invoiceNotes">Notes</Label>
              <div className="mt-1 border border-input rounded-md overflow-hidden">
                <ReactQuill
                  theme="snow"
                  value={invoiceNotes}
                  onChange={(value) => setInvoiceNotes(value)}
                  placeholder="Any notes for this invoice..."
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

            {/* Attachments */}
            <div>
              <Label htmlFor="invoiceAttachments">Attach Files (Optional)</Label>
              <Input
                id="invoiceAttachments"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.txt,.csv,.xlsx,.xls"
                onChange={(e) => setSelectedInvoiceFiles(e.target.files)}
                className="mt-1 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="text-xs text-muted-foreground mt-1">
                You can attach vendor tax invoices or other relevant documents.
              </p>
              {selectedInvoiceFiles && selectedInvoiceFiles.length > 0 && (
                <div className="mt-2 bg-muted/30 p-2 rounded-md">
                  <p className="text-xs font-medium">Selected files:</p>
                  <ul className="text-xs text-muted-foreground mt-1 list-disc list-inside">
                    {Array.from(selectedInvoiceFiles).map((file, index) => (
                      <li key={index} className="truncate">
                        {file.name} ({(file.size / 1024).toFixed(1)} KB)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Line Items */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Line Items</h3>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%]">Item / Description</TableHead>
                      <TableHead className="text-right w-[14%]">Qty</TableHead>
                      <TableHead className="text-right w-[18%]">Unit Price ({viewingOrder?.currency || viewingOrder?.supplierCurrency})</TableHead>
                      <TableHead className="text-right w-[14%]">Tax %</TableHead>
                      <TableHead className="text-right w-[16%]">Discount</TableHead>
                      <TableHead className="text-right w-[18%]">Tax Amt ({viewingOrder?.currency || viewingOrder?.supplierCurrency})</TableHead>
                      <TableHead className="text-right w-[18%]">Line Total ({viewingOrder?.currency || viewingOrder?.supplierCurrency})</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoiceFormItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                          No items
                        </TableCell>
                      </TableRow>
                    ) : invoiceFormItems.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <div className="flex flex-col">
                            <div className="text-sm font-medium">
                              {item.itemType === "product"
                                ? (item.inventoryItemName || `Item #${item.inventoryItemId}`)
                                : "Service"}
                            </div>
                            {item.itemType === "product" && item.inventoryItemId && (() => {
                              const description = getItemDescription(item.inventoryItemId);
                              return description && (
                                <div className="text-xs text-muted-foreground">
                                  {description}
                                </div>
                              );
                            })()}
                          </div>
                          {item.description && (
                            <div className="text-xs text-muted-foreground whitespace-pre-wrap break-words">{item.description}</div>
                          )}
                          {item.inventoryItemUnit && (
                            <div className="text-xs text-muted-foreground">{item.inventoryItemUnit}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0.001"
                            step="any"
                            value={item.quantity}
                            onChange={(e) => recalcInvoiceItem(idx, "quantity", e.target.value)}
                            className="w-20 text-right ml-auto h-8 text-sm"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={item.unitPrice}
                            onChange={(e) => recalcInvoiceItem(idx, "unitPrice", e.target.value)}
                            className="w-28 text-right ml-auto h-8 text-sm"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="any"
                            value={item.taxRate}
                            onChange={(e) => recalcInvoiceItem(idx, "taxRate", e.target.value)}
                            className="w-20 text-right ml-auto h-8 text-sm"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              value={item.discount ?? "0"}
                              onChange={(e) => recalcInvoiceItem(idx, "discount", e.target.value)}
                              className="w-16 text-right h-8 text-sm"
                            />
                            <select
                              className="border rounded px-1 text-xs bg-background h-8"
                              value={item.discountType || "amount"}
                              onChange={(e) => recalcInvoiceItem(idx, "discountType", e.target.value)}
                            >
                              <option value="amount">{viewingOrder?.currency || viewingOrder?.supplierCurrency || "AED"}</option>
                              <option value="percentage">%</option>
                            </select>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatCurrency(item.taxAmount, viewingOrder?.currency || viewingOrder?.supplierCurrency)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {formatCurrency(item.lineTotal, viewingOrder?.currency || viewingOrder?.supplierCurrency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Totals */}
            <div className="bg-muted/40 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal ({viewingOrder?.currency || viewingOrder?.supplierCurrency})</span>
                <span>{formatCurrency(invoiceSubtotal, viewingOrder?.currency || viewingOrder?.supplierCurrency)}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 py-4 border-y">
                <div>
                  <Label htmlFor="invoiceDiscountPercentage">Discount (%)</Label>
                  <Input
                    id="invoiceDiscountPercentage"
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    value={invoiceData.discountPercentage}
                    onChange={(e) => {
                      const val = e.target.value;
                      const pct = parseFloat(val) || 0;
                      const calcDiscount = (invoiceSubtotal * pct / 100);
                      setInvoiceData(prev => ({ 
                        ...prev, 
                        discountPercentage: val, 
                        discountAmount: val === "" ? "" : calcDiscount.toString() 
                      }));
                    }}
                    placeholder="0.00"
                    className="mt-1 h-8"
                  />
                </div>
                <div>
                  <Label htmlFor="invoiceDiscountAmount">Discount Value ({viewingOrder?.currency || viewingOrder?.supplierCurrency})</Label>
                  <Input
                    id="invoiceDiscountAmount"
                    type="number"
                    min="0"
                    step="any"
                    value={invoiceData.discountAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      const amount = parseFloat(val) || 0;
                      const calcPct = invoiceSubtotal > 0 ? ((amount / invoiceSubtotal) * 100) : 0;
                      setInvoiceData(prev => ({ 
                        ...prev, 
                        discountAmount: val, 
                        discountPercentage: val === "" ? "" : calcPct.toString() 
                      }));
                    }}
                    placeholder="0.00"
                    className="mt-1 h-8"
                  />
                </div>
              </div>


              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax ({viewingOrder?.currency || viewingOrder?.supplierCurrency})</span>
                <span>{formatCurrency(invoiceTaxTotal, viewingOrder?.currency || viewingOrder?.supplierCurrency)}</span>
              </div>

              {invoiceDiscountAmount > 0.005 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Total Discount ({viewingOrder?.currency || viewingOrder?.supplierCurrency}):</span>
                  <span>- {formatCurrency(invoiceDiscountAmount, viewingOrder?.currency || viewingOrder?.supplierCurrency)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-base border-t pt-2 mt-2">
                <span>Total ({viewingOrder?.currency || viewingOrder?.supplierCurrency})</span>
                <span>{formatCurrency(invoiceTotal, viewingOrder?.currency || viewingOrder?.supplierCurrency)}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t">
              <Button
                variant="outline"
                onClick={() => setIsInvoiceDialogOpen(false)}
                disabled={convertToInvoiceMutation.isPending}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => handleConvertToInvoice(false)}
                disabled={convertToInvoiceMutation.isPending}
                className="w-full sm:w-auto"
              >
                {convertToInvoiceMutation.isPending ? "Saving..." : "Save as Draft"}
              </Button>
              <Button
                onClick={() => handleConvertToInvoice(true)}
                disabled={convertToInvoiceMutation.isPending}
                className="w-full sm:w-auto"
              >
                {convertToInvoiceMutation.isPending ? "Submitting..." : "Save & Submit for Approval"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Order Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Purchase Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rejectionReason">Rejection Reason *</Label>
              <Textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please provide a reason for rejecting this purchase order..."
                className="mt-1"
                rows={4}
                data-testid="input-rejection-reason"
              />
              <p className="text-sm text-muted-foreground mt-1">
                This reason will be visible to the person who submitted the order.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsRejectDialogOpen(false);
                  setRejectionReason("");
                }}
                className="w-full sm:w-auto"
                data-testid="button-cancel-reject"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (!rejectionReason.trim()) {
                    toast({
                      title: "Rejection Reason Required",
                      description: "Please provide a reason for rejecting this order.",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (viewingOrder) {
                    rejectOrderMutation.mutate({ orderId: viewingOrder.id, reason: rejectionReason });
                  }
                }}
                disabled={rejectOrderMutation.isPending || !rejectionReason.trim()}
                className="w-full sm:w-auto"
                data-testid="button-confirm-reject"
              >
                {rejectOrderMutation.isPending ? "Rejecting..." : "Reject Order"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
