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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { EditHistoryTab } from "@/components/documents/EditHistoryTab";
import { Plus, FileText, Package, Truck, CheckCircle, XCircle, Clock, Trash2, Search, Filter, DollarSign, TrendingUp, CreditCard, Printer, Paperclip, Download, History, Pencil, X, Send, ArrowRightLeft, ChevronDown, ChevronUp, Copy, Building2, AlignLeft } from "lucide-react";
import { InventoryItem, type SupplierBankDetails } from "@shared/schema";
import { computeDocumentTotals } from "@shared/document-totals";

interface Supplier {
  id: number;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  // The supplier's own address. /api/suppliers/all selects every supplier
  // column, so this already arrives with the list the page loads — the order
  // itself does not carry it, deliverTo is the delivery address, not this.
  address?: string;
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
  deliverTo?: string;
  termsAndConditions?: string;
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
  submittedByName?: string;
  submittedAt?: string;
  approvedById?: number;
  approvedByName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  convertedInvoiceId?: number;
  convertedInvoiceNumber?: string;
  subject?: string;
  createdAt?: string;
  supplierVatTreatment?: "standard" | "zero_rated" | "exempt";
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
  // An edit note is required once the order has been through approval, either
  // way. draft and pending_approval are still being drafted, so they edit
  // freely. This same set is what the server sends back to pending_approval on
  // save. Mirrors the gate in purchase-orders.routes.ts — the server is the
  // boundary, this just avoids showing a mandatory field that isn't.
  const editRequiresNote =
    editingOrder?.status === "approved" || editingOrder?.status === "rejected";
  const [viewingOrder, setViewingOrder] = useState<PurchaseOrder | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  // Which Activity tab is open. Drives the lazy edit-history query below, so
  // it is not fetched until its tab is actually selected.
  const [activityTab, setActivityTab] = useState("approval");
  // One expanded edit-history entry at a time: a single entry's changes can
  // run to hundreds of lines, which buried the rest of the list.
  const [expandedEditEntry, setExpandedEditEntry] = useState<number | null>(null);
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
    subject: "",
    currency: "AED",
    exchangeRate: "1",
    orderDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: "",
    paymentTerms: "",
    deliveryTerms: "",
    deliverTo: "",
    bankAccount: "",
    notes: "",
    termsAndConditions: "",
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

  // The staging form starts blank — quantity, unit price and discount carry
  // their guidance in placeholders rather than as pre-filled values, so nothing
  // can be saved by accident. taxRate is the exception: it is filled from the
  // supplier's VAT treatment when a supplier is picked.
  const [newItem, setNewItem] = useState({
    itemType: "service" as "product" | "service",
    inventoryItemId: "",
    description: "",
    quantity: "",
    unitPrice: "",
    taxRate: "0",
    discount: "" as string,
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

  // Backstop against a half-finished line edit crossing a dialog open or close.
  // resetForm already clears the staging form on every dismissal and on every
  // "New", but this keys off the open state rather than the dialog's
  // onOpenChange because Radix only fires that for its own triggers (Escape,
  // overlay, close button), so it also covers any programmatic open.
  useEffect(() => {
    // Clearing the index alone would leave that row's values sitting in the
    // staging form, so the next "Add" would append a duplicate of it.
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

  // Company address seeds Deliver To on a new order; the purchase_order row of
  // document_defaults seeds Notes and Terms. Seeds only — every field stays
  // editable and validly empty on the order itself.
  const { data: company } = useQuery<{ address?: string | null }>({
    queryKey: ["/api/company"],
    enabled: isAuthenticated,
  });

  const { data: documentDefaults } = useQuery<
    Array<{ documentType: string; notes: string | null; termsAndConditions: string | null }>
  >({
    queryKey: ["/api/document-defaults"],
    enabled: isAuthenticated,
  });
  const poDefaults = documentDefaults?.find(
    (d) => d.documentType === "purchase_order",
  );

  // The edit-history endpoint is admin/finance only, while project_manager can
  // open the order itself — so the tab this feeds is hidden for anyone else and
  // the query stays disabled rather than firing a request that would 403.
  const canSeeEditHistory = user?.role === "admin" || user?.role === "finance";

  const { data: poEditHistory, isLoading: isLoadingEditHistory } = useQuery<any[]>({
    queryKey: ["/api/purchase-orders", viewingOrder?.id, "edit-history"],
    queryFn: async () => {
      const response = await apiRequest(`/api/purchase-orders/${viewingOrder?.id}/edit-history`);
      return response.json();
    },
    enabled:
      isAuthenticated &&
      isViewDialogOpen &&
      !!viewingOrder &&
      canSeeEditHistory &&
      activityTab === "history",
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
      const response = await apiRequest(`/api/purchase-orders/${orderId}/approve`, { method: "PATCH", body: {} });
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
      subject: "",
      // This object REPLACES the form state, so every field has to be listed:
      // omitting these left formData.currency undefined and the labels reading
      // "Unit Price ()". Both are overwritten as soon as a supplier is picked.
      currency: "AED",
      exchangeRate: "1",
      orderDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate: "",
      paymentTerms: "",
      deliveryTerms: "",
      deliverTo: "",
      bankAccount: "",
      notes: "",
      termsAndConditions: "",
      discountPercentage: "0",
      discountAmount: "0",
    });
    setSelectedBankId("");
    setOrderItems([]);
    setNewItem({
      itemType: "service",
      inventoryItemId: "",
      description: "",
      quantity: "",
      unitPrice: "",
      taxRate: "0",
      discount: "",
      discountType: "amount",
    });
    setEditingItemIndex(null);
    setSelectedFiles(null);
    setExistingFiles([]);
    setEditingOrder(null);
    setEditNote("");
  };

  // Copies an existing order into a fresh draft. Mirrors handleDuplicateInvoice:
  // editingOrder is cleared so submit creates rather than updates, the order
  // date restarts at today, and attachments are deliberately not carried over —
  // they belong to the original document.
  const handleDuplicateOrder = async (order: PurchaseOrder) => {
    let source: any = order;
    if (!order.items || order.items.length === 0) {
      try {
        const response = await apiRequest(`/api/purchase-orders/${order.id}`, { method: "GET" });
        if (response.ok) {
          source = await response.json();
        }
      } catch {}
    }
    setEditingOrder(null);
    setFormData({
      supplierId: source.supplierId?.toString() || "",
      subject: source.subject || "",
      orderDate: new Date().toISOString().split("T")[0],
      expectedDeliveryDate: "",
      paymentTerms: source.paymentTerms || "",
      deliveryTerms: source.deliveryTerms || "",
      deliverTo: source.deliverTo || "",
      bankAccount: source.bankAccount || "",
      notes: source.notes || "",
      termsAndConditions: source.termsAndConditions || "",
      currency: source.currency || source.supplierCurrency || "AED",
      exchangeRate: source.exchangeRate || "1",
      discountPercentage: source.discountPercentage || "0",
      discountAmount: source.discountAmount || "0",
    });
    if (source.items && source.items.length > 0) {
      setOrderItems(source.items.map((item: any) => ({
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
    setSelectedFiles(null);
    setExistingFiles([]);
    setEditNote("");
    setIsViewDialogOpen(false);
    setIsDialogOpen(true);
  };

  // Fetches the order by id: the paginated list no longer carries items and
  // files, since loading them per row cost two extra queries for every row on
  // every page and nothing in the list table displayed them.
  const handleEditOrder = async (listOrder: PurchaseOrder) => {
    let order = listOrder;
    if (!listOrder.items || listOrder.items.length === 0) {
      try {
        const response = await apiRequest(`/api/purchase-orders/${listOrder.id}`, { method: "GET" });
        if (!response.ok) {
          throw new Error("Failed to load purchase order details");
        }
        order = await response.json();
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to load purchase order details",
          variant: "destructive",
        });
        return;
      }
    }

    setEditingOrder(order);
    setFormData({
      supplierId: order.supplierId.toString(),
      subject: order.subject || "",
      orderDate: order.orderDate.split('T')[0],
      expectedDeliveryDate: order.expectedDeliveryDate ? order.expectedDeliveryDate.split('T')[0] : "",
      paymentTerms: order.paymentTerms || "",
      deliveryTerms: order.deliveryTerms || "",
      deliverTo: order.deliverTo || "",
      bankAccount: order.bankAccount || "",
      notes: order.notes || "",
      termsAndConditions: order.termsAndConditions || "",
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

  // Open the dialog for a NEW order. Every dismissal runs resetForm, so the
  // form is always clean here and the defaults can simply be seeded on top of
  // it. Editing an existing order never comes through here — handleEditOrder
  // loads the stored values, which are the record.
  const openNewOrderDialog = () => {
    resetForm();
    setFormData(prev => ({
      ...prev,
      deliverTo: company?.address || "",
      notes: poDefaults?.notes || "",
      termsAndConditions: poDefaults?.termsAndConditions || "",
    }));
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
    // A blank or non-numeric tax rate means zero, the same as discount.
    const taxRate = parseFloat(newItem.taxRate || "0") || 0;

    // Both fields start blank, so a non-number has to be rejected here rather
    // than reaching the totals as NaN.
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      toast({
        title: "Error",
        description: "Quantity must be a number greater than 0 and unit price a number that is not negative",
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
      itemType: "service",
      inventoryItemId: "",
      description: "",
      quantity: "",
      unitPrice: "",
      taxRate: "0",
      discount: "",
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
      itemType: "service",
      inventoryItemId: "",
      description: "",
      quantity: "",
      unitPrice: "",
      taxRate: "0",
      discount: "",
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
    formDataInstance.append("subject", formData.subject || "");
    formDataInstance.append("deliveryTerms", formData.deliveryTerms || "");
    formDataInstance.append("deliverTo", formData.deliverTo || "");
    formDataInstance.append("termsAndConditions", formData.termsAndConditions || "");
    formDataInstance.append("bankAccount", formData.bankAccount || "");
    formDataInstance.append("notes", formData.notes || "");

    // Process and append items as a JSON string
    const items = orderItems.map(item => {
      const quantity = parseInt(item.quantity);
      const unitPrice = parseFloat(item.unitPrice);
      const taxRate = parseFloat(item.taxRate || "0") || 0;
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
      if (editRequiresNote && !editNote.trim()) {
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

  // Fetch the order by id rather than reusing the list row. The paginated list
  // does not select submittedById/At, approvedById/At, rejectionReason or
  // convertedInvoiceId, so the Approval section below could never render from a
  // list row. Fetching here keeps those columns off every list row — the list
  // already carries items and files per row — and mirrors the purchase invoice
  // dialog. Edit history still loads separately, on first click of its tab.
  const viewOrder = async (order: PurchaseOrder) => {
    try {
      const response = await apiRequest(`/api/purchase-orders/${order.id}`, { method: "GET" });
      if (!response.ok) {
        throw new Error("Failed to load purchase order details");
      }
      const fullOrder = await response.json();
      setActivityTab("approval");
      setExpandedEditEntry(null);
      setViewingOrder(fullOrder);
      setIsViewDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load purchase order details",
        variant: "destructive",
      });
    }
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
        const taxRate = parseFloat(item.taxRate || "0") || 0;
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
    formData.append("subject", viewingOrder.subject || "");
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

  // Line items are all in the document's one currency, so repeating the code on
  // every cell just adds noise. The Financial Summary below the table carries
  // the currency for the document.
  const formatAmount = (amount: number | string) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return num.toFixed(2);
  };

  // Same implementation as DocumentManager's local helper — it isn't exported.
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "N/A";
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + " " + sizes[i];
  };

  // Which edit-history fields hold rich text. notes and bankAccount are edited
  // through ReactQuill, so their stored value is HTML; everything else tracked
  // is plain text and must stay escaped.
  const isRichTextField = (field: string) =>
    field === "notes" || field === "bankAccount";

  const getFileIcon = (mimeType?: string) => {
    if (mimeType?.startsWith("image/")) {
      return <Paperclip className="h-4 w-4 flex-shrink-0 text-purple-600" />;
    }
    if (mimeType === "application/pdf") {
      return <FileText className="h-4 w-4 flex-shrink-0 text-red-600" />;
    }
    return <Download className="h-4 w-4 flex-shrink-0 text-blue-600" />;
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

  // The status chip that sits beside the PO number in the view dialog's header.
  // Deliberately a second helper rather than a change to getStatusBadge above:
  // that one is shared with the list rows and the other dialogs, and the stamp
  // treatment here (mono, letter-spaced, uppercase) is specific to this header.
  const getStatusStamp = (status: string) => {
    const tones: Record<string, string> = {
      draft: "text-[#5B6472] bg-[#F1F3F7] border-[#E3E7EE]",
      pending_approval: "text-[#B54708] bg-[#FFFAEB] border-[#FEDF89]",
      approved: "text-[#027A48] bg-[#ECFDF3] border-[#A6F4C5]",
      rejected: "text-[#B42318] bg-[#FEF3F2] border-[#F0C5C1]",
      converted: "text-[#6941C6] bg-[#F4F3FF] border-[#D9D6FE]",
    };
    return (
      <span
        className={`text-[11px] font-semibold tracking-[0.09em] uppercase px-[9px] py-[3px] rounded-[5px] border ${tones[status] || tones.draft}`}
        data-testid="stamp-order-status"
      >
        {status.replace(/_/g, " ")}
      </span>
    );
  };

  const canCreateInvoice = (order: PurchaseOrder) => {
    return order.status === "approved";
  };

  const canEdit = user?.role === "admin" || user?.role === "finance";

  const filteredOrders = orders;

  const applyFilters = () => {
    // Filters are applied automatically through filteredOrders
  };

  // Collapsed by default, as on the sales page: the filters are occasional,
  // and a permanently open panel pushes the list itself below the fold.
  const [filterOpen, setFilterOpen] = useState(false);

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
            <Button onClick={openNewOrderDialog} className="gap-2">
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

      {/* Collapsible Filters */}
      <Card>
        <div
          className="flex items-center justify-between p-4 cursor-pointer select-none"
          onClick={() => setFilterOpen((o) => !o)}
        >
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <span className="font-medium text-sm">Filters</span>
            {(() => {
              const active = [
                searchQuery,
                statusFilter !== "all" ? statusFilter : "",
                supplierFilter !== "all" ? supplierFilter : "",
                startDateFilter,
                endDateFilter,
              ].filter(Boolean).length;
              return active > 0 ? (
                <Badge className="bg-primary text-primary-foreground text-xs px-1.5 py-0">{active}</Badge>
              ) : null;
            })()}
          </div>
          {filterOpen
            ? <ChevronUp className="h-4 w-4 text-slate-400" />
            : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>

        {filterOpen && (
          <CardContent className="pt-0 pb-4 px-4 border-t">
            {/* One grid rather than two: five fields and the clear action fill
                three columns exactly, so nothing is left stranded on its own
                row the way the old 4-then-3 split left the dates. */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
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
              <div className="flex items-end">
                <Button onClick={clearFilters} variant="outline" className="w-full">
                  Clear All Filters
                </Button>
              </div>
            </div>
          </CardContent>
        )}
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
                <Button onClick={openNewOrderDialog} className="gap-2">
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
                    /* The whole row opens the detail dialog. role/tabIndex/
                       onKeyDown keep it reachable without a mouse; every
                       button inside stops propagation so acting on it does
                       not also open the dialog. */
                    <TableRow
                      key={order.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() => viewOrder(order)}
                      onKeyDown={(e) => {
                        // A keypress on an inline button bubbles to the row, so without
                        // this an Enter on Approve would both approve and open the dialog.
                        if (e.target !== e.currentTarget) {
                          return;
                        }
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          viewOrder(order);
                        }
                      }}
                      data-testid={`row-order-${order.id}`}
                    >
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
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit - Draft and Approved/Pending orders for admin/finance */}
                          {(order.status === "draft" || (["approved", "pending_approval", "rejected"].includes(order.status) && (user?.role === "admin" || user?.role === "finance"))) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditOrder(order);
                              }}
                              data-testid={`button-edit-order-${order.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </Button>
                          )}

                          {/* Submit for Approval - Draft orders, all roles */}
                          {order.status === "draft" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                submitOrderMutation.mutate(order.id);
                              }}
                              disabled={submitOrderMutation.isPending}
                              data-testid={`button-submit-order-${order.id}`}
                            >
                              <Send className="h-4 w-4" />
                              {submitOrderMutation.isPending ? "Submitting..." : "Submit"}
                            </Button>
                          )}

                          {/* Approve - Pending orders, admin only */}
                          {order.status === "pending_approval" && user?.role === "admin" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 gap-1 text-green-600 hover:text-green-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                approveOrderMutation.mutate(order.id);
                              }}
                              disabled={approveOrderMutation.isPending}
                              data-testid={`button-approve-order-${order.id}`}
                            >
                              <CheckCircle className="h-4 w-4" />
                              {approveOrderMutation.isPending ? "Approving..." : "Approve"}
                            </Button>
                          )}

                          {/* Reject - Pending orders, admin only */}
                          {order.status === "pending_approval" && user?.role === "admin" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 gap-1 text-red-600 hover:text-red-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingOrder(order);
                                setIsRejectDialogOpen(true);
                              }}
                              data-testid={`button-reject-order-${order.id}`}
                            >
                              <XCircle className="h-4 w-4" />
                              Reject
                            </Button>
                          )}

                          {/* Convert to Invoice - Approved orders, admin/finance */}
                          {order.status === "approved" && (user?.role === "admin" || user?.role === "finance") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                openConvertDialog(order);
                              }}
                              data-testid={`button-convert-order-${order.id}`}
                            >
                              <ArrowRightLeft className="h-4 w-4" />
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
      {/* Dismissing by any route — X, Escape, overlay click — clears the form.
          Radix only fires onOpenChange for its own triggers, so the Cancel
          button and the post-submit paths call resetForm themselves. */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
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

              <div>
                <Label htmlFor="subject">Subject Line</Label>
                <Input
                  id="subject"
                  value={formData.subject || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="e.g., Office Supplies Order"
                  className="mt-1"
                />
              </div>

              {/* Delivery — where and on what terms the goods arrive */}
              <div className="border-t pt-4">
                <Label className="text-lg font-semibold">Delivery</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                  <div>
                    <Label htmlFor="deliverTo">Deliver To</Label>
                    <Textarea
                      id="deliverTo"
                      rows={4}
                      value={formData.deliverTo}
                      onChange={(e) => setFormData(prev => ({ ...prev, deliverTo: e.target.value }))}
                      placeholder="Delivery address — office, vessel or work site. Leave blank if not applicable."
                      className="mt-1"
                      data-testid="textarea-deliver-to"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Pre-filled from the company address in Settings. Edit or clear it per order.
                    </p>
                  </div>
                  <div className="space-y-4">
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
                  </div>
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
                          unitPrice: ""
                        }))}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="product">Product (from Inventory)</SelectItem>
                          <SelectItem value="service">Service</SelectItem>
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
                          placeholder="e.g. 1"
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
                          placeholder="0.00"
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
                            placeholder="0.00"
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
                                <Pencil className="h-4 w-4" />
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
                                  <TableCell>{item.taxRate || "0"}%</TableCell>
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
                                        <Pencil className="h-4 w-4" />
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

              <div className="border-t pt-4">
                <Label className="text-lg font-semibold">Terms &amp; Notes</Label>
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

              <div>
                <Label htmlFor="poTermsAndConditions">Terms &amp; Conditions</Label>
                <Textarea
                  id="poTermsAndConditions"
                  rows={6}
                  value={formData.termsAndConditions}
                  onChange={(e) => setFormData(prev => ({ ...prev, termsAndConditions: e.target.value }))}
                  placeholder="Standing terms for this order. Pre-filled from Settings → Documents Default; edit or clear per order."
                  className="mt-1"
                  data-testid="textarea-po-terms"
                />
              </div>

              {editRequiresNote && (
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
                <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }} className="w-full sm:w-auto">
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

      {/* View Order Dialog — laid out to the approved redesign reference:
          a full-bleed header band, a key-facts strip, a single-column body and
          a fixed action footer. The dialog's own padding is removed (p-0 gap-0)
          so each band can carry its own padding and edge-to-edge rule, and the
          body scrolls on its own while the header and footer stay put.
          Colours are the reference's literal palette rather than the app's
          semantic tokens, so this dialog can be lifted wholesale onto the
          purchase invoice and sales documents later without dragging theme
          changes along with it. Dark-mode variants are deliberately absent —
          nothing in the app ever sets the `dark` class. */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
          {viewingOrder && (() => {
            // Every amount on the document is in this one currency. currency is
            // NOT NULL with an "AED" default in the schema, so the supplier
            // fallback only matters for rows written before that default landed.
            const orderCurrency =
              viewingOrder.currency || viewingOrder.supplierCurrency || "AED";
            const showExchangeRate =
              orderCurrency !== "AED" && !!viewingOrder.exchangeRate;

            // The supplier's own address, which the order does not carry —
            // /api/suppliers/all is already loaded for the create form and
            // selects every supplier column, so this is a local lookup rather
            // than another request. Distinct from deliverTo, which is where the
            // goods go and lives with the delivery terms below.
            const supplierAddress = suppliers.find(
              (s) => s.id === viewingOrder.supplierId
            )?.address;

            // Commercial terms is dropped entirely when every one of its rows is
            // empty, and the supplier card then takes the whole row. Empty
            // optional fields stay hidden throughout, as they do today.
            const hasCommercialTerms = !!(
              viewingOrder.paymentTerms ||
              viewingOrder.deliveryTerms ||
              viewingOrder.supplierVatTreatment ||
              showExchangeRate
            );

            // Bank account, Deliver to and Attachments share the second row.
            // Each card is rendered only when it holds something and they flex
            // to fill the width rather than sitting in fixed thirds, so the row
            // still reads correctly with one or two of them. The row itself is
            // dropped when none of the three has data.
            const hasDetailRow = !!(
              viewingOrder.bankAccount ||
              viewingOrder.deliverTo ||
              (viewingOrder.files && viewingOrder.files.length > 0)
            );

            // Shared chrome. Kept as constants rather than repeated inline so
            // the card/table/ledger treatment stays identical across every
            // block and is easy to lift into a shared component later.
            const cardCls =
              "bg-white border border-[#E3E7EE] rounded-[10px] overflow-hidden print:border-gray-300";
            const cardHeadCls =
              "flex items-center gap-2.5 px-[18px] py-3 border-b border-[#EDF0F5]";
            const cardTitleCls = "text-sm font-semibold text-[#171B23] print:text-black";
            const cardIconCls = "w-[15px] h-[15px] shrink-0 text-[#8A93A3]";
            const cardBodyCls = "px-[18px] py-4";
            const kvRowCls =
              "flex justify-between gap-3.5 py-2 text-[13.5px] border-b border-dashed border-[#EDF0F5] last:border-b-0 first:pt-0 last:pb-0";
            const kvLabelCls = "shrink-0 text-[#5B6472]";
            const kvValCls = "min-w-0 text-right font-medium break-words print:text-black";
            const metaLabelCls =
              "text-[10.5px] font-semibold tracking-[0.08em] uppercase text-[#8A93A3] mb-[3px]";
            const metaValueCls = "text-[14.5px] font-semibold text-[#171B23] print:text-black";
            const metaCellCls =
              "flex-1 min-w-[160px] px-5 sm:px-6 py-3.5 border-r border-[#E3E7EE] last:border-r-0";
            const thCls =
              "h-auto px-3.5 py-2.5 bg-[#F7F9FC] text-[10.5px] font-semibold tracking-[0.07em] uppercase text-[#8A93A3] whitespace-nowrap print:bg-white";
            const tdCls = "px-3.5 py-3 align-top print:text-black";
            const tdNumCls =
              "px-3.5 py-3 align-top text-right text-[13px] print:text-black";
            const tRowCls = "flex justify-between items-baseline gap-4 py-[5px]";
            const tLabelCls = "text-[#5B6472]";
            const tValCls = "font-medium print:text-black";
            const headBtnCls =
              "h-auto gap-[7px] rounded-lg border-[#E3E7EE] px-[13px] py-[7px] text-[13.5px] font-medium text-[#171B23] hover:bg-[#F7F9FC] hover:border-[#D4DAE3]";
            const emptyCls = "text-[13px] text-[#8A93A3]";

            return (
              <>
                {/* ===== HEADER ===== */}
                <header className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0 border-b border-[#E3E7EE] py-4 pl-5 sm:pl-6 pr-5 sm:pr-14 print:border-b-2 print:border-black">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <div className="grid place-items-center w-[42px] h-[42px] shrink-0 rounded-[10px] bg-[#EEF2FE] border border-[#DCE4FB] print:bg-blue-100">
                      <FileText className="w-5 h-5 text-[#2B4ACB] print:text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#8A93A3]">
                        Purchase order
                      </div>
                      <div className="flex items-center flex-wrap gap-2.5 mt-px">
                        <DialogTitle className="text-[19px] font-semibold tracking-[-0.01em] text-[#171B23] print:text-black">
                          {viewingOrder.poNumber}
                        </DialogTitle>
                        {getStatusStamp(viewingOrder.status)}
                        {/* Document lineage reads best next to the status it
                            explains, so the converted invoice is a second chip
                            rather than a field further down. */}
                        {viewingOrder.convertedInvoiceId && (
                          <span
                            className="text-[11px] font-semibold tracking-[0.06em] px-[9px] py-[3px] rounded-[5px] border text-[#5B6472] bg-[#F7F9FC] border-[#E3E7EE]"
                            data-testid="chip-converted-invoice"
                          >
                            →{" "}
                            {viewingOrder.convertedInvoiceNumber ||
                              `Invoice #${viewingOrder.convertedInvoiceId}`}
                          </span>
                        )}
                      </div>
                      <div className="text-[13px] text-[#5B6472] mt-0.5 break-words print:text-gray-700">
                        <strong className="font-semibold text-[#171B23] print:text-black">
                          {viewingOrder.supplierName}
                        </strong>
                        {viewingOrder.createdAt && (
                          <> &nbsp;·&nbsp; Created {formatDisplayDate(viewingOrder.createdAt)}</>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Document actions. Status-flow actions (submit, approve,
                      reject, convert) stay in the footer, as before. */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 print:hidden">
                    {/* Same gate as the list's Edit button: drafts for anyone who
                        can edit, post-approval statuses for admin/finance only.
                        Converted orders show no Edit, matching the list. */}
                    {(viewingOrder.status === "draft" ||
                      (["approved", "pending_approval", "rejected"].includes(viewingOrder.status) &&
                        (user?.role === "admin" || user?.role === "finance"))) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const order = viewingOrder;
                          setIsViewDialogOpen(false);
                          handleEditOrder(order);
                        }}
                        className={headBtnCls}
                        data-testid="button-edit-from-view"
                      >
                        <Pencil className="w-[15px] h-[15px] text-[#5B6472]" />
                        Edit
                      </Button>
                    )}
                    {/* Duplicate is offered once an order is past drafting —
                        approved, rejected and converted orders are the ones worth
                        reissuing, and none of them can be edited in place. */}
                    {["approved", "rejected", "converted"].includes(viewingOrder.status) && canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDuplicateOrder(viewingOrder)}
                        className={headBtnCls}
                        data-testid="button-duplicate-order-header"
                      >
                        <Copy className="w-[15px] h-[15px] text-[#5B6472]" />
                        Duplicate
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePrintPDF(viewingOrder)}
                      className={headBtnCls}
                      data-testid="button-print-order"
                    >
                      <Printer className="w-[15px] h-[15px] text-[#5B6472]" />
                      Print
                    </Button>
                  </div>
                </header>

                {/* No rejection banner: the reason for a rejected order is
                    carried by the Rejected node in Activity → Approval, which
                    is where the rest of the approval trail already reads. */}

                {/* ===== KEY FACTS STRIP =====
                    flex rather than a fixed 4-column grid so the remaining cells
                    still spread evenly when Expected delivery is absent. */}
                <div className="flex flex-wrap shrink-0 border-b border-[#E3E7EE] bg-[#F7F9FC] print:bg-white">
                  <div className={metaCellCls}>
                    <div className={metaLabelCls}>Order date</div>
                    <div className={metaValueCls}>{formatDisplayDate(viewingOrder.orderDate)}</div>
                  </div>
                  {viewingOrder.expectedDeliveryDate && (
                    <div className={metaCellCls}>
                      <div className={metaLabelCls}>Expected delivery</div>
                      <div className={metaValueCls}>
                        {formatDisplayDate(viewingOrder.expectedDeliveryDate)}
                      </div>
                    </div>
                  )}
                  <div className={metaCellCls}>
                    <div className={metaLabelCls}>Currency</div>
                    <div className={metaValueCls}>
                      {orderCurrency}
                      {viewingOrder.supplierVatTreatment && (
                        <span className="text-[13px] font-medium text-[#5B6472] capitalize">
                          {" "}
                          · {viewingOrder.supplierVatTreatment.replace(/_/g, " ")} VAT
                        </span>
                      )}
                    </div>
                    {showExchangeRate && (
                      <div className="text-[12px] text-[#8A93A3] mt-px">
                        1 {orderCurrency} = {viewingOrder.exchangeRate} AED
                      </div>
                    )}
                  </div>
                  <div className={metaCellCls}>
                    <div className={metaLabelCls}>Total amount</div>
                    <div className={metaValueCls}>
                      {formatCurrency(viewingOrder.totalAmount, orderCurrency)}
                    </div>
                  </div>
                </div>

                {/* ===== BODY ===== */}
                <div className="flex-1 min-h-0 overflow-y-auto bg-[#FBFCFE] print:bg-white">
                  {/* One vertical stack — every block runs the full width of the
                      dialog. The reference cards below are collapsed on opening
                      so the order items stay near the top of the scroll. */}
                  <div className="flex flex-col gap-4 p-5 sm:p-6">

                    {/* --- Row 1: Supplier & Commercial terms --- */}
                    <div
                      className={`grid grid-cols-1 ${hasCommercialTerms ? "md:grid-cols-2" : ""} gap-4 items-start`}
                    >
                      <section className={cardCls}>
                        <Accordion type="single" collapsible className="w-full">
                          <AccordionItem value="supplier" className="border-b-0">
                            <AccordionTrigger className="px-[18px] py-3 hover:no-underline data-[state=open]:border-b data-[state=open]:border-[#EDF0F5]">
                              <span className="flex items-center gap-2.5">
                                <Building2 className={cardIconCls} />
                                <span className={cardTitleCls}>Supplier</span>
                              </span>
                            </AccordionTrigger>
                            <AccordionContent className="px-[18px] pt-3.5 pb-4">
                              <div className="text-[15px] font-semibold mb-0.5 break-words print:text-black">
                                {viewingOrder.supplierName}
                              </div>
                              {supplierAddress && (
                                <div className="text-[13.5px] leading-[1.55] text-[#333B47] whitespace-pre-wrap break-words print:text-black">
                                  {supplierAddress}
                                </div>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </section>

                      {hasCommercialTerms && (
                        <section className={cardCls}>
                          <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="commercial" className="border-b-0">
                              <AccordionTrigger className="px-[18px] py-3 hover:no-underline data-[state=open]:border-b data-[state=open]:border-[#EDF0F5]">
                                <span className="flex items-center gap-2.5">
                                  <DollarSign className={cardIconCls} />
                                  <span className={cardTitleCls}>Commercial terms</span>
                                </span>
                              </AccordionTrigger>
                              <AccordionContent className="px-[18px] pt-3.5 pb-4">
                                <div className="flex flex-col">
                                  {viewingOrder.paymentTerms && (
                                    <div className={kvRowCls}>
                                      <span className={kvLabelCls}>Payment terms</span>
                                      <span className={kvValCls}>{viewingOrder.paymentTerms}</span>
                                    </div>
                                  )}
                                  {viewingOrder.deliveryTerms && (
                                    <div className={kvRowCls}>
                                      <span className={kvLabelCls}>Delivery terms</span>
                                      <span className={kvValCls}>{viewingOrder.deliveryTerms}</span>
                                    </div>
                                  )}
                                  {viewingOrder.supplierVatTreatment && (
                                    <div className={kvRowCls}>
                                      <span className={kvLabelCls}>VAT treatment</span>
                                      <span className={`${kvValCls} capitalize`}>
                                        {viewingOrder.supplierVatTreatment.replace(/_/g, " ")}
                                      </span>
                                    </div>
                                  )}
                                  {showExchangeRate && (
                                    <div className={kvRowCls}>
                                      <span className={kvLabelCls}>Exchange rate</span>
                                      <span className={`${kvValCls} text-[12.5px]`}>
                                        1 {orderCurrency} = {viewingOrder.exchangeRate} AED
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </section>
                      )}
                    </div>

                    {/* --- Row 2: Bank account, Deliver to and Attachments.
                        Wrapping flex rather than a fixed three-column grid, so
                        one or two cards still fill the row instead of leaving a
                        gap where the missing ones would sit. --- */}
                    {hasDetailRow && (
                      <div className="flex flex-wrap gap-4 items-start">
                        {viewingOrder.bankAccount && (
                          <section className={`${cardCls} flex-1 min-w-[260px]`}>
                            <Accordion type="single" collapsible className="w-full">
                              <AccordionItem value="bank" className="border-b-0">
                                <AccordionTrigger className="px-[18px] py-3 hover:no-underline data-[state=open]:border-b data-[state=open]:border-[#EDF0F5]">
                                  <span className="flex items-center gap-2.5">
                                    <CreditCard className={cardIconCls} />
                                    <span className={cardTitleCls}>Bank account</span>
                                  </span>
                                </AccordionTrigger>
                                <AccordionContent className="px-[18px] pt-3.5 pb-4">
                                  {/* Stored as one rich-text field rather than discrete
                                      beneficiary/IBAN/SWIFT columns, so it renders as
                                      prose here. */}
                                  <div
                                    className="rich-text-content text-[13px] leading-[1.6] text-[#333B47] break-words print:text-black"
                                    dangerouslySetInnerHTML={{ __html: sanitize(viewingOrder.bankAccount || "") }}
                                  />
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          </section>
                        )}

                        {/* Where the goods go — its own card rather than a block
                            inside the commercial terms, and kept clear of the
                            supplier card where it read as the supplier's own
                            address. Given as a block because it is a multi-line
                            address. */}
                        {viewingOrder.deliverTo && (
                          <section className={`${cardCls} flex-1 min-w-[260px]`}>
                            <Accordion type="single" collapsible className="w-full">
                              <AccordionItem value="deliver-to" className="border-b-0">
                                <AccordionTrigger className="px-[18px] py-3 hover:no-underline data-[state=open]:border-b data-[state=open]:border-[#EDF0F5]">
                                  <span className="flex items-center gap-2.5">
                                    <Truck className={cardIconCls} />
                                    <span className={cardTitleCls}>Deliver to</span>
                                  </span>
                                </AccordionTrigger>
                                <AccordionContent className="px-[18px] pt-3.5 pb-4">
                                  <div className="text-[13.5px] leading-[1.55] text-[#333B47] whitespace-pre-wrap break-words print:text-black">
                                    {viewingOrder.deliverTo}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          </section>
                        )}

                        {/* Attachments — same treatment as the payment-history
                            attachments on the purchase invoice: icon by type,
                            name, size · upload date, and a Download action. The
                            link target is unchanged from before this redesign.
                            One column, since the card is a third of the row. */}
                        {viewingOrder.files && viewingOrder.files.length > 0 && (
                          <section className={`${cardCls} flex-1 min-w-[260px]`}>
                            <Accordion type="single" collapsible className="w-full">
                              <AccordionItem value="attachments" className="border-b-0">
                                <AccordionTrigger className="px-[18px] py-3 hover:no-underline data-[state=open]:border-b data-[state=open]:border-[#EDF0F5]">
                                  <span className="flex items-center gap-2.5">
                                    <Paperclip className={cardIconCls} />
                                    <span className={cardTitleCls}>Attachments</span>
                                    <span className="text-[11.5px] font-semibold text-[#5B6472] bg-[#EDF0F5] rounded-full px-2.5 py-0.5">
                                      {viewingOrder.files.length}
                                    </span>
                                  </span>
                                </AccordionTrigger>
                                <AccordionContent className="px-[18px] pt-3.5 pb-4">
                                  <ul className="flex flex-col gap-2">
                                    {viewingOrder.files.map((file) => (
                                      <li
                                        key={file.id}
                                        className="flex items-center justify-between p-2 rounded-lg border border-[#E3E7EE] bg-white"
                                      >
                                        <div className="flex items-center gap-2 overflow-hidden">
                                          {getFileIcon((file as any).mimeType)}
                                          <div className="flex flex-col overflow-hidden">
                                            <span className="text-[13px] truncate" title={file.originalName}>
                                              {file.originalName}
                                            </span>
                                            <span className="text-[11.5px] text-[#8A93A3]">
                                              {formatFileSize(file.fileSize)}
                                              {(file as any).uploadedAt &&
                                                ` · ${formatDisplayDate((file as any).uploadedAt)}`}
                                            </span>
                                          </div>
                                        </div>
                                        <Button variant="ghost" size="sm" asChild className="h-8 ml-2 text-[13px]">
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
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          </section>
                        )}
                      </div>
                    )}

                    {/* --- Subject, items and the reference text --- */}
                    <div className="flex flex-col gap-4 min-w-0">

                      {/* Subject — above the items, and collapsible like Notes
                          and Terms. Open by default: unlike those two it is a
                          one-line description of what the order is for, so it
                          is worth seeing on opening. */}
                      {viewingOrder.subject && (
                        <section className={cardCls}>
                          <Accordion type="single" collapsible defaultValue="subject" className="w-full">
                            <AccordionItem value="subject" className="border-b-0">
                              <AccordionTrigger className="px-[18px] py-3 hover:no-underline data-[state=open]:border-b data-[state=open]:border-[#EDF0F5]">
                                <span className="flex items-center gap-2.5">
                                  <AlignLeft className={cardIconCls} />
                                  <span className={cardTitleCls}>Subject</span>
                                </span>
                              </AccordionTrigger>
                              <AccordionContent className="px-[18px] pt-3.5 pb-4">
                                <div className="text-[13.5px] leading-[1.65] text-[#333B47] whitespace-pre-wrap break-words print:text-black">
                                  {viewingOrder.subject}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </section>
                      )}

                      {/* Order items + ledger totals */}
                      <section className={cardCls}>
                        <div className={cardHeadCls}>
                          <Package className={cardIconCls} />
                          <span className={cardTitleCls}>Order items</span>
                          <span className="text-[11.5px] font-semibold text-[#5B6472] bg-[#EDF0F5] rounded-full px-2.5 py-0.5">
                            {viewingOrder.items?.length || 0}{" "}
                            {viewingOrder.items?.length === 1 ? "item" : "items"}
                          </span>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow className="border-b border-[#E3E7EE] hover:bg-transparent">
                              <TableHead className={`${thCls} w-9`}>#</TableHead>
                              <TableHead className={thCls}>Item</TableHead>
                              <TableHead className={`${thCls} text-right`}>Qty</TableHead>
                              {/* No currency in the headers or the cells — every
                                  line is in the document's one currency, which the
                                  ledger below and the facts strip above state. */}
                              <TableHead className={`${thCls} text-right`}>Unit price</TableHead>
                              <TableHead className={`${thCls} text-right`}>Tax rate</TableHead>
                              <TableHead className={`${thCls} text-right`}>Tax</TableHead>
                              <TableHead className={`${thCls} text-right`}>Discount</TableHead>
                              <TableHead className={`${thCls} text-right`}>Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {viewingOrder.items?.map((item, index) => (
                              <TableRow
                                key={item.id}
                                className="border-b border-[#EDF0F5] last:border-b-0 hover:bg-[#F7F9FC]"
                              >
                                <TableCell className={`${tdCls} text-[12.5px] text-[#8A93A3]`}>
                                  {index + 1}
                                </TableCell>
                                <TableCell className={tdCls}>
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-[13.5px] font-semibold whitespace-pre-wrap break-words">
                                      {item.itemType === "product"
                                        ? item.inventoryItemName
                                        : item.description}
                                    </span>
                                    {/* The inventory description and the item-type
                                        marker share one wrapped line under the name.
                                        The marker is a quiet outlined tag rather than
                                        a filled badge ahead of the name: with most
                                        lines being products it was carrying no
                                        information at the loudest point in the row.
                                        The line is dropped when it would be empty. */}
                                    {(() => {
                                      const isProduct = item.itemType === "product";
                                      const description =
                                        isProduct && item.inventoryItemId
                                          ? getItemDescription(item.inventoryItemId)
                                          : "";
                                      if (!isProduct && !description) return null;
                                      return (
                                        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-0.5">
                                          {description && (
                                            <span className="text-[12.5px] text-[#5B6472] break-words">
                                              {description}
                                            </span>
                                          )}
                                          {isProduct && (
                                            <span className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-[#8A93A3] border border-[#E3E7EE] rounded px-1.5 py-px whitespace-nowrap">
                                              Product
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </TableCell>
                                <TableCell className={tdNumCls}>
                                  {item.quantity}{" "}
                                  {item.itemType === "product" ? item.inventoryItemUnit : ""}
                                </TableCell>
                                <TableCell className={tdNumCls}>{formatAmount(item.unitPrice)}</TableCell>
                                <TableCell className={tdNumCls}>{item.taxRate || "0"}%</TableCell>
                                <TableCell className={tdNumCls}>
                                  {formatAmount(item.taxAmount || "0.00")}
                                </TableCell>
                                <TableCell className={`${tdNumCls} ${Number(item.discount) > 0 ? "text-[#B42318]" : ""}`}>
                                  {Number(item.discount) > 0
                                    ? (item.discountType === "percentage"
                                        ? `−${item.discount}%`
                                        : `−${formatAmount(item.discount as any)}`)
                                    : "—"}
                                </TableCell>
                                <TableCell className={`${tdNumCls} font-semibold`}>
                                  {formatAmount(item.lineTotal)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>

                        {/* Ledger totals, at the foot of the items card rather
                            than in a panel of their own. Every row the previous
                            Financial Summary carried is here, under the same
                            conditions; discounts sit above tax as the reference
                            orders them. */}
                        <div className="flex justify-end px-[18px] pt-3.5 pb-4 bg-[#F7F9FC] border-t border-[#EDF0F5] print:bg-white">
                          <div className="w-full sm:w-[300px] text-[13.5px]">
                            <div className={tRowCls}>
                              <span className={tLabelCls}>Subtotal</span>
                              <span className={tValCls}>{formatAmount(viewingOrder.subtotal || "0")}</span>
                            </div>
                            {/* The header discount as stored, shown alongside the
                                derived total so a reader can tell the header portion
                                from the line-level one. discountPercentage and
                                discountAmount are mutually exclusive on save: a
                                percentage is used when non-zero, else the fixed
                                amount. */}
                            {parseFloat(viewingOrder.discountPercentage || "0") > 0 && (
                              <div className={tRowCls}>
                                <span className={tLabelCls}>Header discount</span>
                                <span className={tValCls}>{viewingOrder.discountPercentage}%</span>
                              </div>
                            )}
                            {parseFloat(viewingOrder.discountAmount || "0") > 0 && (
                              <div className={tRowCls}>
                                <span className={tLabelCls}>Discount amount</span>
                                <span className={`${tValCls} text-[#B42318]`}>
                                  −{formatAmount(viewingOrder.discountAmount || "0")}
                                </span>
                              </div>
                            )}
                            {(() => {
                              // Total discount (header + line) derived from stored fields;
                              // the discountAmount column holds only the header portion.
                              const totalDiscount =
                                parseFloat(viewingOrder.subtotal || "0") +
                                parseFloat(viewingOrder.taxAmount || "0") -
                                parseFloat(viewingOrder.totalAmount || "0");
                              return totalDiscount > 0.005 ? (
                                <div className={tRowCls}>
                                  <span className={tLabelCls}>Total discount</span>
                                  <span className={`${tValCls} text-[#B42318]`}>
                                    −{formatAmount(totalDiscount.toFixed(2))}
                                  </span>
                                </div>
                              ) : null;
                            })()}
                            <div className={tRowCls}>
                              <span className={tLabelCls}>Tax</span>
                              <span className={tValCls}>{formatAmount(viewingOrder.taxAmount || "0")}</span>
                            </div>
                            <div className={`${tRowCls} mt-[7px] pt-[9px] border-t-[3px] border-double border-[#171B23]`}>
                              <span className="text-sm font-semibold text-[#171B23] print:text-black">
                                Total ({orderCurrency})
                              </span>
                              <span className="text-[17px] font-semibold text-[#2B4ACB] print:text-black">
                                {formatCurrency(viewingOrder.totalAmount, orderCurrency)}
                              </span>
                            </div>
                            {showExchangeRate && (
                              <div className="text-right text-[11.5px] text-[#8A93A3] mt-2.5">
                                Exchange rate 1 {orderCurrency} = {viewingOrder.exchangeRate} AED
                              </div>
                            )}
                          </div>
                        </div>
                      </section>

                      {/* Notes and Terms & Conditions stay collapsed by default —
                          they are reference text, not something a reader needs on
                          opening the document. One accordion each, so they read as
                          the two separate collapsible cards the reference shows. */}
                      {viewingOrder.notes && (
                        <section className={cardCls}>
                          <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="notes" className="border-b-0">
                              <AccordionTrigger className="px-[18px] py-3 hover:no-underline data-[state=open]:border-b data-[state=open]:border-[#EDF0F5]">
                                <span className="flex items-center gap-2.5">
                                  <Pencil className={cardIconCls} />
                                  <span className={cardTitleCls}>Notes</span>
                                </span>
                              </AccordionTrigger>
                              <AccordionContent className="px-[18px] pt-3.5 pb-4">
                                <div
                                  className="rich-text-content text-[13.5px] leading-[1.65] text-[#333B47] break-words print:text-black"
                                  dangerouslySetInnerHTML={{ __html: sanitize(viewingOrder.notes || "") }}
                                />
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </section>
                      )}

                      {viewingOrder.termsAndConditions && (
                        <section className={cardCls}>
                          <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="terms" className="border-b-0">
                              <AccordionTrigger className="px-[18px] py-3 hover:no-underline data-[state=open]:border-b data-[state=open]:border-[#EDF0F5]">
                                <span className="flex items-center gap-2.5">
                                  <FileText className={cardIconCls} />
                                  <span className={cardTitleCls}>Terms &amp; conditions</span>
                                </span>
                              </AccordionTrigger>
                              <AccordionContent className="px-[18px] pt-3.5 pb-4">
                                <p className="text-[13.5px] leading-[1.65] text-[#333B47] whitespace-pre-wrap break-words print:text-black">
                                  {viewingOrder.termsAndConditions}
                                </p>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </section>
                      )}

                    </div>

                    {/* --- Activity: approval trail and edit history in one tabbed
                        block. A purchase order has no payments, so there are two
                        tabs. Approval opens first because its data is already on
                        the order; edit history fetches on first click. That
                        endpoint is admin/finance only, so its tab is hidden for
                        project_manager rather than firing a 403. --- */}
                    <section className={`${cardCls} print:hidden`}>
                      <div className={cardHeadCls}>
                        <History className={cardIconCls} />
                        <span className={cardTitleCls}>Activity</span>
                      </div>
                      <div className={cardBodyCls}>
                        <Tabs value={activityTab} onValueChange={setActivityTab}>
                          <TabsList>
                            <TabsTrigger value="approval" data-testid="tab-approval">
                              Approval
                            </TabsTrigger>
                            {canSeeEditHistory && (
                              <TabsTrigger value="history" data-testid="tab-edit-history">
                                Edit History
                                {poEditHistory ? ` (${poEditHistory.length})` : ""}
                              </TabsTrigger>
                            )}
                          </TabsList>

                          <TabsContent value="approval" className="mt-4">
                            {viewingOrder.submittedAt || viewingOrder.approvedAt || viewingOrder.rejectionReason ? (
                              <ul className="relative list-none pl-5 before:content-[''] before:absolute before:left-[5px] before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-[#EDF0F5]">
                                {viewingOrder.submittedAt && (
                                  <li className="relative pb-4 last:pb-0">
                                    <span className="absolute -left-5 top-[5px] w-3 h-3 rounded-full bg-white border-[3px] border-[#8A93A3]" />
                                    <div className="text-[13.5px] font-semibold">Submitted for approval</div>
                                    <div className="text-[12.5px] text-[#8A93A3] mt-px">
                                      {viewingOrder.submittedByName || "—"} ·{" "}
                                      {new Date(viewingOrder.submittedAt).toLocaleString()}
                                    </div>
                                  </li>
                                )}
                                {viewingOrder.approvedAt && (
                                  <li className="relative pb-4 last:pb-0">
                                    <span className="absolute -left-5 top-[5px] w-3 h-3 rounded-full bg-white border-[3px] border-[#12B76A]" />
                                    <div className="text-[13.5px] font-semibold">Approved</div>
                                    <div className="text-[12.5px] text-[#8A93A3] mt-px">
                                      {viewingOrder.approvedByName || "—"} ·{" "}
                                      {new Date(viewingOrder.approvedAt).toLocaleString()}
                                    </div>
                                  </li>
                                )}
                                {viewingOrder.rejectionReason && (
                                  <li className="relative pb-4 last:pb-0">
                                    <span className="absolute -left-5 top-[5px] w-3 h-3 rounded-full bg-white border-[3px] border-[#B42318]" />
                                    <div className="text-[13.5px] font-semibold">Rejected</div>
                                    <div className="mt-2 text-[13px] text-[#912018] bg-[#FEF3F2] border border-[#F0C5C1] rounded-[7px] px-[11px] py-2 whitespace-pre-wrap break-words">
                                      {viewingOrder.rejectionReason}
                                    </div>
                                  </li>
                                )}
                                {viewingOrder.submittedAt &&
                                  !viewingOrder.approvedAt &&
                                  !viewingOrder.rejectionReason && (
                                    <li className="relative pb-4 last:pb-0">
                                      <span className="absolute -left-5 top-[5px] w-3 h-3 rounded-full bg-white border-[3px] border-[#E3E7EE]" />
                                      <div className="text-[13.5px] font-semibold text-[#5B6472]">
                                        Awaiting approval
                                      </div>
                                      <div className="text-[12.5px] text-[#8A93A3] mt-px">Pending review</div>
                                    </li>
                                  )}
                              </ul>
                            ) : (
                              <p className={emptyCls}>This order has not been submitted for approval yet.</p>
                            )}
                          </TabsContent>

                          {canSeeEditHistory && (
                            <TabsContent value="history" className="mt-4">
                              <EditHistoryTab
                                entries={poEditHistory}
                                isLoading={isLoadingEditHistory}
                                currency={viewingOrder.currency}
                                emptyMessage="No edits recorded."
                              />
                            </TabsContent>
                          )}
                        </Tabs>
                      </div>
                    </section>
                  </div>
                </div>

                {/* ===== FOOTER =====
                    Status-flow actions, mirroring the list row gates exactly.
                    viewingOrder is plain state and goes stale after a mutation
                    invalidates the list, so every action closes the view dialog
                    first. Submit, Approve and Convert are mutually exclusive by
                    status, so at most one primary button shows at a time. */}
                <footer className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 px-5 sm:px-6 py-3.5 border-t border-[#E3E7EE] bg-white print:hidden">
                  <div className="text-[12.5px] text-[#8A93A3]">
                    <span className="font-medium">{viewingOrder.poNumber}</span>
                    {viewingOrder.createdAt && <> · Created {formatDisplayDate(viewingOrder.createdAt)}</>}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsViewDialogOpen(false)}
                      className={headBtnCls}
                    >
                      Close
                    </Button>
                    {viewingOrder.status === "pending_approval" && user?.role === "admin" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsViewDialogOpen(false);
                          setIsRejectDialogOpen(true);
                        }}
                        disabled={rejectOrderMutation.isPending}
                        className={`${headBtnCls} text-[#B42318] border-[#F0C5C1] hover:bg-[#FEF3F2] hover:border-[#F0C5C1] hover:text-[#B42318]`}
                        data-testid="button-reject-order-dialog"
                      >
                        <XCircle className="w-[14px] h-[14px]" />
                        Reject
                      </Button>
                    )}
                    {viewingOrder.status === "draft" && (
                      <Button
                        onClick={() => {
                          setIsViewDialogOpen(false);
                          submitOrderMutation.mutate(viewingOrder.id);
                        }}
                        disabled={submitOrderMutation.isPending}
                        size="sm"
                        className="h-auto gap-[7px] rounded-lg px-[13px] py-[7px] text-[13.5px] font-semibold bg-[#2B4ACB] hover:bg-[#20389B] text-white"
                        data-testid="button-submit-order-dialog"
                      >
                        <Send className="w-[14px] h-[14px]" />
                        {submitOrderMutation.isPending ? "Submitting..." : "Submit"}
                      </Button>
                    )}
                    {viewingOrder.status === "pending_approval" && user?.role === "admin" && (
                      <Button
                        onClick={() => {
                          setIsViewDialogOpen(false);
                          approveOrderMutation.mutate(viewingOrder.id);
                        }}
                        disabled={approveOrderMutation.isPending}
                        size="sm"
                        className="h-auto gap-[7px] rounded-lg px-[13px] py-[7px] text-[13.5px] font-semibold bg-[#2B4ACB] hover:bg-[#20389B] text-white"
                        data-testid="button-approve-order-dialog"
                      >
                        <CheckCircle className="w-[14px] h-[14px]" />
                        {approveOrderMutation.isPending ? "Approving..." : "Approve"}
                      </Button>
                    )}
                    {canEdit && canCreateInvoice(viewingOrder) && (
                      <Button
                        onClick={() => {
                          setIsViewDialogOpen(false);
                          openConvertDialog();
                        }}
                        size="sm"
                        className="h-auto gap-[7px] rounded-lg px-[13px] py-[7px] text-[13.5px] font-semibold bg-[#2B4ACB] hover:bg-[#20389B] text-white"
                        data-testid="button-convert-order-dialog"
                      >
                        <ArrowRightLeft className="w-[14px] h-[14px]" />
                        Convert
                      </Button>
                    )}
                  </div>
                </footer>
              </>
            );
          })()}
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
