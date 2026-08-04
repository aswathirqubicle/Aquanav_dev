import { formatDisplayDate } from "@/lib/utils";
import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Autocomplete } from "@/components/ui/autocomplete";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { useAuth } from "@/hooks/use-auth";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { computeDocumentTotals } from "@shared/document-totals";
import { printByUrl } from "@/lib/print-utils";
import { sanitize } from "@/lib/sanitize";
import { Plus, FileText, DollarSign, Filter, Upload, Download, Trash2, Calendar, TrendingUp, CreditCard, AlertCircle, CheckCircle2, Printer, Package, Briefcase, XCircle, CheckCircle, Ban, History, Copy, Paperclip, Pencil, X, Send, ChevronDown, ChevronUp, Building2, AlignLeft } from "lucide-react";
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
  // The supplier's own address. It is not copied onto the invoice, so the view
  // dialog reads it off the already-loaded supplier list.
  address?: string;
  bankAccountDetails?: SupplierBankDetails[];
}
interface PurchaseInvoice {
  id: number;
  invoiceNumber: string;
  subject?: string;
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
  termsAndConditions?: string;
  supplierVatTreatment?: "standard" | "zero_rated" | "exempt";
  items?: PurchaseInvoiceItem[];
  files?: any[];
  payments?: Payment[];
  submittedById?: number;
  submittedByName?: string;
  submittedAt?: string;
  approvedById?: number;
  approvedByName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdBy?: number;
  createdByName?: string;
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
  taxRate?: string;
  taxAmount?: string;
  discount?: number | string;
  discountType?: "amount" | "percentage";
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
  recordedByName?: string;
  recordedAt: string;
  files?: PaymentFile[];
  paymentType?: string;
  creditNoteId?: number;
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
  // Which Activity tab is open. Drives the lazy payment / edit-history
  // queries below, so neither is fetched until its tab is actually selected.
  const [activityTab, setActivityTab] = useState("approval");
  // One expanded edit-history entry at a time, same as expandedPayment. A
  // single entry's changes can run to hundreds of lines (notes and terms are
  // long rich text), which buried the rest of the list.
  const [expandedEditEntry, setExpandedEditEntry] = useState<number | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedInvoiceForCreditNote, setSelectedInvoiceForCreditNote] = useState<any>(null);
  const [isCreateCreditNoteOpen, setIsCreateCreditNoteOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [editingInvoice, setEditingInvoice] = useState<PurchaseInvoice | null>(null);
  // An edit note is only required once the invoice is approved and its ledger
  // entries exist; draft and pending_approval are pre-ledger. Mirrors the server
  // gate in purchase-invoices.routes.ts — the server is the boundary, this just
  // avoids showing a mandatory field that isn't.
  const editRequiresNote = editingInvoice?.status === "approved";
  const [editNote, setEditNote] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [selectedBankId, setSelectedBankId] = useState<string>("");

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    supplierId: undefined as number | undefined,
    status: undefined as string | undefined,
    // Settlement, not approval. An invoice can be approved and still unpaid, so
    // this is a separate axis from `status` rather than more values on it.
    paymentStatus: undefined as string | undefined,
    search: "",
    projectId: undefined as number | undefined,
  });
  
  const debouncedSearch = useDebounce(filters.search, 500);
  const [search, setSearch] = useState("");
  const [expandedPayment, setExpandedPayment] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    supplierId: "",
    subject: "",
    supplierInvoiceNumber: "",
    currency: "AED",
    exchangeRate: "1",
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: "",
    paymentTerms: "Net 30 days",
    bankAccount: "",
    notes: "",
    termsAndConditions: "",
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
    discount?: string;
    discountType?: "amount" | "percentage";
    projectId?: string;
    assetInstanceId?: string;
  }[]>([]);

  // The staging form starts blank — quantity, unit price and discount carry
  // their guidance in placeholders rather than as pre-filled values, so nothing
  // can be saved by accident. taxRate keeps its default.
  const [newItem, setNewItem] = useState({
    itemType: "service" as "product" | "service",
    inventoryItemId: "",
    description: "",
    quantity: "" as string,
    unitPrice: "" as string,
    taxRate: "0" as string,
    discount: "" as string,
    discountType: "amount" as "amount" | "percentage",
    projectId: "",
    assetInstanceId: "",
  });

  // Index of the line being edited, or null when the form is adding a new one.
  // Distinct from editingInvoice above, which is the whole document being edited.
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const itemFormRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // Bring the staging form into view and put the cursor in Description, so
  // clicking Edit on a row far down the list doesn't leave the form off-screen.
  // Description only exists for service lines; for products the focus is a no-op.
  const focusItemForm = () => {
    itemFormRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    window.setTimeout(() => descriptionRef.current?.focus(), 0);
  };

  // Never carry a half-finished line edit across a dialog open or close. This
  // keys off the open state rather than the dialog's onOpenChange because Radix
  // only fires that for its own triggers (Escape, overlay, close button) — the
  // programmatic setIsDialogOpen calls in the new, edit, duplicate and
  // post-submit paths would otherwise leave the index pointing at a stale row.
  useEffect(() => {
    // Only when an edit was actually abandoned: clearing the index alone would
    // leave that row's values sitting in the staging form, so the next "Add"
    // would append a duplicate of it. A half-typed NEW item is left untouched.
    if (editingItemIndex !== null) {
      cancelEditItem();
    }
  }, [isDialogOpen]);

  // Authoritative totals via the shared engine (VAT on the discounted base;
  // line discount first, then header apportioned). Mirrors the server.
  const purchaseInvoiceTotals = computeDocumentTotals(
    invoiceItems.map((it) => ({
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
    queryKey: ["/api/purchase-invoices", filters.startDate, filters.endDate, filters.supplierId, filters.status, filters.paymentStatus, filters.projectId, debouncedSearch, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", limit.toString());
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.supplierId) params.append("supplierId", filters.supplierId.toString());
      if (filters.status) params.append("status", filters.status);
      if (filters.paymentStatus) params.append("paymentStatus", filters.paymentStatus);
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

  // The purchase_invoice row of document_defaults seeds Notes and Terms on a
  // new invoice. Seeds only — both fields stay editable and validly empty on
  // the invoice itself.
  const { data: documentDefaults } = useQuery<
    Array<{ documentType: string; notes: string | null; termsAndConditions: string | null }>
  >({
    queryKey: ["/api/document-defaults"],
    enabled: isAuthenticated,
  });
  const invoiceDefaults = documentDefaults?.find(
    (d) => d.documentType === "purchase_invoice",
  );

  // Both endpoints are admin/finance only, while project_manager can open the
  // invoice itself — so the tabs these feed are hidden for anyone else and the
  // queries stay disabled rather than firing a request that would 403.
  const canSeeActivityDetail = user?.role === "admin" || user?.role === "finance";
  // Payments can only exist once the invoice is approved; the earlier guard
  // here tested `status` against unpaid / partially_paid / overdue / paid,
  // which are paymentStatus values that never appear in `status`.
  const canHavePayments = viewingInvoice?.status === "approved";

  const { data: invoicePayments, isLoading: isLoadingPayments } = useQuery<Payment[]>({
    queryKey: ["/api/purchase-invoices", viewingInvoice?.id, "payments"],
    queryFn: async () => {
      const response = await apiRequest(`/api/purchase-invoices/${viewingInvoice?.id}/payments`);
      return response.json();
    },
    enabled:
      isAuthenticated &&
      isViewDialogOpen &&
      !!viewingInvoice &&
      canSeeActivityDetail &&
      canHavePayments &&
      activityTab === "payments",
  });

  const { data: invoiceEditHistory, isLoading: isLoadingEditHistory } = useQuery<any[]>({
    queryKey: ["/api/purchase-invoices", viewingInvoice?.id, "edit-history"],
    queryFn: async () => {
      const response = await apiRequest(`/api/purchase-invoices/${viewingInvoice?.id}/edit-history`);
      return response.json();
    },
    enabled:
      isAuthenticated &&
      isViewDialogOpen &&
      !!viewingInvoice &&
      canSeeActivityDetail &&
      activityTab === "history",
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

      // The supplier's currency is authoritative — an invoice must always be
      // denominated in the currency of the supplier it is owed to. Historic rows
      // can disagree (they were created before that was enforced, or the
      // supplier was switched afterwards), so derive it here instead of trusting
      // what was stored. Only look the rate up when the currency actually
      // changes; an invoice that already agrees keeps the rate it was issued at.
      const editSupplier = suppliers.find((s) => s.id === full.supplierId);
      const derivedCurrency = editSupplier?.currency || full.currency || "AED";
      let derivedExchangeRate = full.exchangeRate || "1";

      if (derivedCurrency !== (full.currency || "AED")) {
        derivedExchangeRate = "1";
        if (derivedCurrency !== "AED") {
          try {
            const rateResponse = await apiRequest(
              `/api/exchange-rates/lookup?from=${derivedCurrency}`,
            );
            if (rateResponse.ok) {
              const rateData = await rateResponse.json();
              derivedExchangeRate = rateData.rate || "1";
            }
          } catch (error) {
            console.error("Failed to lookup exchange rate:", error);
          }
        }
      }

      setEditingInvoice(full);
      setFormData({
        supplierId: full.supplierId.toString(),
        subject: full.subject || "",
        supplierInvoiceNumber: full.supplierInvoiceNumber || "",
        currency: derivedCurrency,
        exchangeRate: derivedExchangeRate,
        invoiceDate: full.invoiceDate ? full.invoiceDate.split('T')[0] : new Date().toISOString().split('T')[0],
        dueDate: full.dueDate ? full.dueDate.split('T')[0] : "",
        paymentTerms: full.paymentTerms || "",
        bankAccount: full.bankAccount || "",
        notes: full.notes || "",
        termsAndConditions: full.termsAndConditions || "",
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
          discount: item.discount != null ? item.discount.toString() : "0",
          discountType: item.discountType || "amount",
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
      // This object REPLACES the form state rather than merging into it,
      // so any field left out silently becomes undefined — which is how
      // the subject went missing from every duplicated invoice.
      subject: source.subject || "",
      currency: source.currency || "AED",
      exchangeRate: source.exchangeRate || "1",
      invoiceDate: new Date().toISOString().split("T")[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      paymentTerms: source.paymentTerms || "Net 30 days",
      bankAccount: source.bankAccount || "",
      notes: source.notes || "",
      termsAndConditions: source.termsAndConditions || "",
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
        discount: item.discount != null ? item.discount.toString() : "0",
        discountType: item.discountType || "amount",
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
    subject: "",
      supplierInvoiceNumber: "",
      currency: "AED",
      exchangeRate: "1",
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: "",
      paymentTerms: "Net 30 days",
      bankAccount: "",
      notes: "",
      termsAndConditions: "",
      discountPercentage: "0",
      discountAmount: "0",
    });
    setSelectedBankId("");
    setInvoiceItems([]);
    setNewItem({
      itemType: "service",
      inventoryItemId: "",
      description: "",
      quantity: "",
      unitPrice: "",
      taxRate: "0",
      discount: "",
      discountType: "amount",
      projectId: "",
      assetInstanceId: "",
    });
    setEditingItemIndex(null);
    setEditingInvoice(null);
    setSelectedInvoiceFiles(null);
    setExistingInvoiceFiles([]);
    setEditNote("");
  };

  // Open the dialog for a NEW invoice. Defaults are seeded into fields that are
  // still EMPTY only, so a seed can never overwrite what someone already wrote.
  // Editing an existing invoice never seeds — its stored values are the record.
  // Every dismissal already runs resetForm, so the editingInvoice branch is a
  // belt-and-braces guard: should an abandoned edit ever survive, "New" must
  // not reopen it.
  const openNewInvoiceDialog = () => {
    if (editingInvoice) {
      resetForm();
      setFormData(prev => ({
        ...prev,
        notes: invoiceDefaults?.notes || "",
        termsAndConditions: invoiceDefaults?.termsAndConditions || "",
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        notes: prev.notes || invoiceDefaults?.notes || "",
        termsAndConditions:
          prev.termsAndConditions || invoiceDefaults?.termsAndConditions || "",
      }));
    }
    setIsDialogOpen(true);
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

      // The row being edited must be excluded, otherwise re-saving it unchanged
      // trips the duplicate guard against itself.
      if (invoiceItems.some((item, i) => i !== editingItemIndex && item.itemType === "product" && item.inventoryItemId === newItem.inventoryItemId)) {
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

    const quantity = parseInt(newItem.quantity);
    const unitPrice = parseFloat(newItem.unitPrice);

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

    setInvoiceItems(prev =>
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
      projectId: "",
      assetInstanceId: "",
    });
    setEditingItemIndex(null);
  };

  // Load an existing line back into the staging form above the list. Saving
  // then replaces that row instead of appending a new one.
  const startEditItem = (index: number) => {
    const item = invoiceItems[index];
    if (!item) return;

    setNewItem({
      itemType: item.itemType,
      inventoryItemId: item.inventoryItemId || "",
      description: item.description || "",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      discount: item.discount || "0",
      discountType: item.discountType === "percentage" ? "percentage" : "amount",
      projectId: item.projectId || "",
      assetInstanceId: item.assetInstanceId || "",
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
      projectId: "",
      assetInstanceId: "",
    });
    setEditingItemIndex(null);
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
      const lineDiscountVal = parseFloat(item.discount || "0") || 0;
      const lineDiscount = item.discountType === "percentage"
        ? lineSubtotal * (lineDiscountVal / 100)
        : Math.min(lineDiscountVal, lineSubtotal);
      // A blank or non-numeric tax rate means zero, the same as discount.
      const lineTaxRate = parseFloat(item.taxRate || "0") || 0;
      const lineTaxAmount = (lineSubtotal - lineDiscount) * (lineTaxRate / 100);
      return {
        itemType: item.itemType,
        inventoryItemId: item.inventoryItemId ? parseInt(item.inventoryItemId) : null,
        description: item.description || null,
        quantity: parseInt(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
        taxRate: lineTaxRate,
        taxAmount: lineTaxAmount,
        discount: lineDiscountVal,
        discountType: item.discountType || "amount",
        lineTotal: (lineSubtotal - lineDiscount + lineTaxAmount).toFixed(2),
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
    formDataInstance.append("subject", formData.subject || "");
    formDataInstance.append("bankAccount", formData.bankAccount);
    formDataInstance.append("notes", formData.notes);
    formDataInstance.append("termsAndConditions", formData.termsAndConditions || "");
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
      if (editRequiresNote && !editNote.trim()) {
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

  // Only the document itself blocks the dialog opening. Payments and edit
  // history load from their own queries when their Activity tab is first
  // opened, so this is one request rather than the three chained ones it used
  // to be. The project and asset instance fetches that used to sit here were
  // removed with the header cards they fed: purchase_invoices.project_id and
  // asset_inventory_instance_id were dropped from the table (migration 0002),
  // so both conditions were permanently false. Line items still carry their
  // own projectId / assetInstanceId, shown as badges in the items table.
  const viewInvoice = async (invoice: PurchaseInvoice) => {
    try {
      const invoiceResponse = await apiRequest(`/api/purchase-invoices/${invoice.id}`, { method: "GET" });
      if (!invoiceResponse.ok) {
        throw new Error("Failed to load invoice details");
      }
      const fullInvoice = await invoiceResponse.json();

      setActivityTab("approval");
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

  // Collapsed by default, as on the sales page: filters are occasional, and a
  // permanently open panel pushes the invoice list below the fold.
  const [filterOpen, setFilterOpen] = useState(false);

  const clearFilters = () => {
    setFilters({
      startDate: "",
      endDate: "",
      supplierId: undefined,
      status: undefined,
      paymentStatus: undefined,
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

  // Line items are all in the document's one currency, so repeating the code on
  // every cell just adds noise. The Financial Summary below the table carries
  // the currency for the document.
  const formatAmount = (amount: number | string) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return num.toFixed(2);
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
              <Button onClick={openNewInvoiceDialog} className="w-full sm:w-auto">
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
                  filters.search,
                  filters.status,
                  filters.paymentStatus,
                  filters.supplierId,
                  filters.projectId,
                  filters.startDate,
                  filters.endDate,
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
              {/* One grid rather than two: seven fields and the clear action
                  fill four columns exactly, so the dates no longer sit alone
                  on a second row of different width. */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
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
                  <Label htmlFor="paymentStatusFilter">Payment Status</Label>
                  <Select
                    value={filters.paymentStatus || "all"}
                    onValueChange={(value) =>
                      setFilters(prev => ({
                        ...prev,
                        paymentStatus: value === "all" ? undefined : value
                      }))
                    }
                  >
                    <SelectTrigger id="paymentStatusFilter">
                      <SelectValue placeholder="All Payment Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Payment Statuses</SelectItem>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                      {/* Stored as "partial" — the sales side spells the same
                          state "partially_paid", so this value is not shared. */}
                      <SelectItem value="partial">Partially Paid</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
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
            </CardContent>
          )}
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
                <Button onClick={openNewInvoiceDialog}>
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
                          /* The whole row opens the detail dialog. role/
                             tabIndex/onKeyDown keep it reachable without a
                             mouse; every button inside stops propagation so
                             acting on it does not also open the dialog. */
                          <tr
                            key={invoice.id}
                            className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                            role="button"
                            tabIndex={0}
                            onClick={() => viewInvoice(invoice)}
                            onKeyDown={(e) => {
                              // A keypress on an inline button bubbles to the row, so without
                              // this an Enter on Approve would both approve and open the dialog.
                              if (e.target !== e.currentTarget) {
                                return;
                              }
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                viewInvoice(invoice);
                              }
                            }}
                            data-testid={`row-invoice-${invoice.id}`}
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
                              {/* Payment status sits under the approval status,
                                  and only once approved: a draft or rejected
                                  invoice has nothing to pay, so "unpaid" there
                                  states a balance that does not exist yet. */}
                              <div className="flex flex-col items-center gap-1">
                                <span>{getApprovalStatusBadge(invoice.status)}</span>
                                {invoice.status === "approved" && (
                                  <span>{getPaymentStatusBadge(invoice.paymentStatus)}</span>
                                )}
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {invoice.status === "draft" && canEdit && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditInvoice(invoice);
                                    }}
                                    className="h-8 px-2 gap-1"
                                    data-testid={`button-edit-invoice-${invoice.id}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                    Edit
                                  </Button>
                                )}
                                {invoice.status === "approved" &&
                                  user?.role === "admin" &&
                                  parseFloat(invoice.paidAmount || "0") === 0 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditInvoice(invoice);
                                    }}
                                    className="h-8 px-2 gap-1"
                                  >
                                    <Pencil className="h-4 w-4" />
                                    Edit
                                  </Button>
                                )}
                                {invoice.status === "draft" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      viewInvoice(invoice);
                                    }}
                                    className="h-8 px-2 gap-1"
                                    data-testid={`button-submit-invoice-${invoice.id}`}
                                  >
                                    <Send className="h-4 w-4" />
                                    Submit
                                  </Button>
                                )}
                                {invoice.status === "pending_approval" && user?.role === "admin" && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        approveInvoiceMutation.mutate(invoice.id);
                                      }}
                                      disabled={approveInvoiceMutation.isPending}
                                      className="h-8 px-2 gap-1 text-green-600 hover:text-green-700"
                                      data-testid={`button-approve-invoice-${invoice.id}`}
                                    >
                                      <CheckCircle className="h-4 w-4" />
                                      Approve
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setViewingInvoice(invoice);
                                        setIsRejectDialogOpen(true);
                                      }}
                                      className="h-8 px-2 gap-1 text-red-600 hover:text-red-700"
                                      data-testid={`button-reject-invoice-${invoice.id}`}
                                    >
                                      <XCircle className="h-4 w-4" />
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
                /* Mobile twin of the desktop row: the whole card opens the
                   detail dialog, with the same keyboard affordance. */
                <Card
                  key={invoice.id}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  role="button"
                  tabIndex={0}
                  onClick={() => viewInvoice(invoice)}
                  onKeyDown={(e) => {
                    // A keypress on an inline button bubbles to the row, so without
                    // this an Enter on Approve would both approve and open the dialog.
                    if (e.target !== e.currentTarget) {
                      return;
                    }
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      viewInvoice(invoice);
                    }
                  }}
                  data-testid={`card-invoice-${invoice.id}`}
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
                        {invoice.status === "draft" && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              viewInvoice(invoice);
                            }}
                            className="flex-1 gap-1"
                            data-testid={`button-submit-invoice-${invoice.id}`}
                          >
                            <Send className="h-4 w-4" />
                            Submit
                          </Button>
                        )}
                        {invoice.status === "pending_approval" && user?.role === "admin" && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                approveInvoiceMutation.mutate(invoice.id);
                              }}
                              disabled={approveInvoiceMutation.isPending}
                              className="flex-1 gap-1 bg-green-600 hover:bg-green-700"
                              data-testid={`button-approve-invoice-${invoice.id}`}
                            >
                              <CheckCircle className="h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingInvoice(invoice);
                                setIsRejectDialogOpen(true);
                              }}
                              className="flex-1 gap-1"
                              data-testid={`button-reject-invoice-${invoice.id}`}
                            >
                              <XCircle className="h-4 w-4" />
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
                      <div className="space-y-2 mb-4">
                        <Label htmlFor="subject" className="text-sm font-medium">Subject Line</Label>
                        <Input
                          id="subject"
                          value={formData.subject || ""}
                          onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                          placeholder="e.g., Software Subscriptions"
                          className="h-10"
                        />
                      </div>
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
                    <div ref={itemFormRef} className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50/50 dark:bg-gray-800/50">
                      <h4 className="font-medium mb-3 text-sm">{editingItemIndex === null ? "Add New Item" : `Edit Item ${editingItemIndex + 1}`}</h4>
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
                              unitPrice: ""
                            }))}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="product">Product (from Inventory)</SelectItem>
                              <SelectItem value="service">Service</SelectItem>
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
                            <div className="sm:col-span-2 lg:col-span-6">
                              <Label className="text-xs font-medium text-muted-foreground">DESCRIPTION</Label>
                              <Textarea
                                ref={descriptionRef}
                                rows={3}
                                value={newItem.description || ""}
                                onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Enter service description"
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
                              placeholder="e.g. 1"
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

                          <div>
                            <Label className="text-xs font-medium text-muted-foreground">DISCOUNT</Label>
                            <div className="flex gap-1">
                              <Input
                                type="number"
                                step="any"
                                min="0"
                                value={newItem.discount}
                                onChange={(e) => setNewItem(prev => ({ ...prev, discount: e.target.value }))}
                                placeholder="0.00"
                                className="h-9"
                              />
                              <select
                                className="border rounded px-2 text-sm bg-background h-9"
                                value={newItem.discountType}
                                onChange={(e) => setNewItem(prev => ({ ...prev, discountType: e.target.value as "amount" | "percentage" }))}
                              >
                                <option value="amount">{formData.currency || "AED"}</option>
                                <option value="percentage">%</option>
                              </select>
                            </div>
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
                          {editingItemIndex !== null && (
                            <Button type="button" variant="outline" onClick={cancelEditItem} className=" h-9" size="sm">
                              <X className="w-4 h-4 mr-1" />
                              Cancel
                            </Button>
                          )}
                          <Button type="button" onClick={addItem} className=" h-9" size="sm">
                            {editingItemIndex === null ? (
                              <>
                                <Plus className="w-4 h-4 mr-1" />
                                Add
                              </>
                            ) : (
                              <>
                                <Pencil className="w-4 h-4 mr-1" />
                                Update Item
                              </>
                            )}
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
                          <div className="col-span-1 text-center">QTY</div>
                          <div className="col-span-2 text-right">UNIT PRICE</div>
                          <div className="col-span-1 text-center">TAX</div>
                          <div className="col-span-1 text-center">DISC</div>
                          <div className="col-span-2 text-right">TOTAL</div>
                          <div className="col-span-1"></div>
                        </div>

                        {invoiceItems.map((item, index) => {
                          const lineSubtotal = parseInt(item.quantity) * parseFloat(item.unitPrice);
                          const lineDiscVal = parseFloat(item.discount || "0") || 0;
                          const lineDiscount = item.discountType === "percentage"
                            ? lineSubtotal * (lineDiscVal / 100)
                            : Math.min(lineDiscVal, lineSubtotal);
                          const taxable = lineSubtotal - lineDiscount;
                          const lineTax = taxable * ((parseFloat(item.taxRate || "0") || 0) / 100);
                          const lineTotal = taxable + lineTax;

                          return (
                            <div key={index} className={`grid grid-cols-12 gap-2 items-center py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 rounded-lg px-2 ${editingItemIndex === index ? "bg-blue-50 dark:bg-blue-950" : ""}`}>
                              <div className="col-span-1">
                                <Badge variant={item.itemType === "product" ? "default" : "secondary"} className="text-xs">
                                  {item.itemType === "product" ? "Product" : "Service"}
                                </Badge>
                              </div>
                              <div className="col-span-3">
                                <div className="flex flex-col">
                                  <div className="font-medium text-sm whitespace-pre-wrap break-words">
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
                              <div className="col-span-1 text-center">
                                <span className="font-medium">{item.quantity}</span>
                              </div>
                              <div className="col-span-2 text-right">
                                <span className="font-medium">{formatCurrency(item.unitPrice, formData.currency)}</span>
                              </div>
                              <div className="col-span-1 text-center">
                                <Badge variant="outline" className="text-xs">{item.taxRate || "0"}%</Badge>
                              </div>
                              <div className="col-span-1 text-center">
                                <span className="text-xs">
                                  {lineDiscVal > 0
                                    ? (item.discountType === "percentage" ? `${lineDiscVal}%` : formatCurrency(lineDiscVal, formData.currency))
                                    : "-"}
                                </span>
                              </div>
                              <div className="col-span-2 text-right">
                                <span className="font-semibold text-green-600">{formatCurrency(lineTotal, formData.currency)}</span>
                              </div>
                              <div className="col-span-1 flex justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  title="Edit item"
                                  aria-label="Edit item"
                                  data-testid={`button-edit-pi-item-${index}`}
                                  onClick={() => startEditItem(index)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  title={editingItemIndex !== null ? "Finish or cancel the current edit first" : "Remove item"}
                                  aria-label="Remove item"
                                  data-testid={`button-remove-pi-item-${index}`}
                                  disabled={editingItemIndex !== null}
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
                            <span className="font-medium">{formatCurrency(purchaseInvoiceTotals.gross, formData.currency)}</span>
                          </div>
                          {purchaseInvoiceTotals.discountTotal > 0 && (
                            <div className="flex justify-between text-sm text-red-600">
                              <span>Total Discount:</span>
                              <span className="font-medium">- {formatCurrency(purchaseInvoiceTotals.discountTotal, formData.currency)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Tax Amount:</span>
                            <span className="font-medium">{formatCurrency(purchaseInvoiceTotals.taxTotal, formData.currency)}</span>
                          </div>
                          <div className="border-t pt-2">
                            <div className="flex justify-between text-lg font-bold">
                              <span>Total Amount:</span>
                              <span className="text-green-600">{formatCurrency(purchaseInvoiceTotals.total, formData.currency)}</span>
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

                <div className="border-t pt-4">
                  <Label className="text-lg font-semibold">Terms &amp; Notes</Label>
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
                  <Label htmlFor="invoiceTermsAndConditions" className="text-sm font-medium">Terms &amp; Conditions</Label>
                  <Textarea
                    id="invoiceTermsAndConditions"
                    rows={6}
                    value={formData.termsAndConditions}
                    onChange={(e) => setFormData(prev => ({ ...prev, termsAndConditions: e.target.value }))}
                    placeholder="Standing terms for this invoice. Pre-filled from Settings → Documents Default; edit or clear per invoice."
                    data-testid="textarea-invoice-terms"
                  />
                </div>

                {/* Edit Note - INSIDE SCROLL */}
                {editRequiresNote && (
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
          (editRequiresNote && !editNote.trim())
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
          <DialogContent className="max-w-6xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
            {viewingInvoice && (() => {
              // Design tokens for this dialog only. Literal hex rather than the
              // app's semantic tokens because the approved design fixes the
              // palette; nothing in here follows a theme.
              const CARD = "bg-white border border-[#E3E7EE] rounded-[10px] overflow-hidden print:bg-white print:border print:border-gray-300";
              const CARD_HEAD = "flex items-center gap-2.5 px-[18px] py-3 border-b border-[#EDF0F5]";
              const CARD_TITLE = "text-sm font-semibold text-[#171B23] print:text-black";
              const CARD_ICON = "w-[15px] h-[15px] shrink-0 text-[#8A93A3]";
              const CARD_BODY = "px-[18px] py-4";
              const ACC_TRIGGER = "px-[18px] py-3 hover:no-underline data-[state=open]:border-b data-[state=open]:border-[#EDF0F5]";
              const ACC_BODY = "px-[18px] pt-3.5 pb-4";
              const KV_ROW = "flex justify-between gap-3.5 py-2 text-[13.5px] border-b border-dashed border-[#EDF0F5] last:border-b-0 first:pt-0 last:pb-0";
              const KV_LABEL = "shrink-0 text-[#5B6472] print:text-gray-700";
              const KV_VAL = "min-w-0 text-right font-medium break-words print:text-black";
              const META_LABEL = "text-[10.5px] font-semibold tracking-[0.08em] uppercase text-[#8A93A3] mb-[3px] print:text-gray-700";
              const META_VALUE = "text-[14.5px] font-semibold text-[#171B23] print:text-black";
              const META_CELL = "flex-1 min-w-[150px] px-5 sm:px-6 py-3.5 border-r border-[#E3E7EE] last:border-r-0";
              const TH = "h-auto px-3.5 py-2.5 bg-[#F7F9FC] text-[10.5px] font-semibold tracking-[0.07em] uppercase text-[#8A93A3] whitespace-nowrap text-left align-middle print:bg-gray-100 print:text-black";
              const TD = "px-3.5 py-3 align-top print:text-black";
              const TDN = "px-3.5 py-3 align-top text-right text-[13px] print:text-black";
              const TROW = "flex justify-between items-baseline gap-4 py-[5px] print:text-black";
              const BTN = "inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors border bg-background h-auto gap-[7px] rounded-lg border-[#E3E7EE] px-[13px] py-[7px] text-[13.5px] text-[#171B23] hover:bg-[#F7F9FC] hover:border-[#D4DAE3] cursor-pointer";
              const BTN_PRIMARY = "inline-flex items-center justify-center whitespace-nowrap transition-colors h-auto gap-[7px] rounded-lg px-[13px] py-[7px] text-[13.5px] font-semibold bg-[#2B4ACB] hover:bg-[#20389B] text-white cursor-pointer";
              const BTN_DANGER = BTN + " text-[#B42318] border-[#F0C5C1] hover:bg-[#FEF3F2]";
              const COUNT = "text-[11.5px] font-semibold text-[#5B6472] bg-[#EDF0F5] rounded-full px-2.5 py-0.5";
              const PROSE = "text-[13.5px] leading-[1.65] text-[#333B47] print:text-black";
              const TYPE_TAG = "text-[10.5px] font-medium uppercase tracking-[0.06em] text-[#8A93A3] border border-[#E3E7EE] rounded px-1.5 py-px whitespace-nowrap print:border print:border-gray-400";
              const PROJ_TAG = "inline-flex items-center gap-1 text-[10.5px] font-medium text-[#2B4ACB] bg-[#EEF2FE] border border-[#DCE4FB] rounded px-1.5 py-px whitespace-nowrap print:border print:border-blue-500 print:bg-blue-50";
              const ASSET_TAG = "inline-flex items-center gap-1 text-[10.5px] font-medium text-[#6941C6] bg-[#F4F3FF] border border-[#D9D6FE] rounded px-1.5 py-px whitespace-nowrap print:border print:border-purple-500 print:bg-purple-50";
              const SUBLBL = "text-[11px] font-semibold tracking-[0.07em] uppercase text-[#8A93A3]";
              const STAMP = "text-[11px] font-semibold tracking-[0.09em] uppercase px-[9px] py-[3px] rounded-[5px] border";

              // Chip tones for the header stamps. Local on purpose — the list
              // rows and the other dialogs keep using the shared
              // getApprovalStatusBadge / getPaymentStatusBadge, which must not
              // change shape.
              const statusStampTone = (status: string) => {
                switch (status) {
                  case "draft": return "text-[#5B6472] bg-[#F7F9FC] border-[#E3E7EE]";
                  case "pending_approval": return "text-[#B54708] bg-[#FFFAEB] border-[#FEDF89]";
                  case "approved": return "text-[#027A48] bg-[#ECFDF3] border-[#A6F4C5]";
                  case "rejected": return "text-[#B42318] bg-[#FEF3F2] border-[#F0C5C1]";
                  case "cancelled": return "text-[#B42318] bg-[#F7F9FC] border-[#F0C5C1]";
                  default: return "text-[#5B6472] bg-[#F7F9FC] border-[#E3E7EE]";
                }
              };
              const paymentStampTone = (paymentStatus: string) => {
                switch (paymentStatus) {
                  case "paid": return "text-[#027A48] bg-[#ECFDF3] border-[#A6F4C5]";
                  case "partial": return "text-[#B54708] bg-[#FFFAEB] border-[#FEDF89]";
                  case "unpaid": return "text-[#2B4ACB] bg-[#EEF2FE] border-[#DCE4FB]";
                  default: return null;
                }
              };

              // Currency used for the parenthetical labels on the ledger, kept
              // in step with the argument the values are formatted with so the
              // label can never disagree with the number beside it.
              const totalsCurrency = viewingInvoice.supplierCurrency || "AED";
              const invoiceCurrency = viewingInvoice.currency || viewingInvoice.supplierCurrency;
              const showExchangeRate = invoiceCurrency !== "AED" && !!viewingInvoice.exchangeRate;
              // Total discount (header + line) derived from stored fields; the
              // discountAmount column holds only the header portion.
              const totalDiscount =
                parseFloat(viewingInvoice.subtotal || "0") +
                parseFloat(viewingInvoice.taxAmount || "0") -
                parseFloat(viewingInvoice.totalAmount || "0");
              const invoiceFiles: any[] = (viewingInvoice as any).files || [];
              // The supplier's address is not stored on the invoice, so it is
              // read off the already-loaded supplier list.
              const supplierAddress = suppliers.find((s) => s.id === viewingInvoice.supplierId)?.address;
              const hasCommercialTerms = !!(
                viewingInvoice.supplierInvoiceNumber ||
                viewingInvoice.paymentTerms ||
                viewingInvoice.supplierVatTreatment ||
                showExchangeRate
              );

              return (
                <>
                  {/* Header band. Document actions (edit, duplicate, print)
                      live up here; status-flow actions (submit, approve, pay,
                      cancel) stay in the footer. pr-5 sm:pr-14 keeps the
                      buttons clear of the dialog's own X. */}
                  <header className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0 border-b border-[#E3E7EE] py-4 pl-5 sm:pl-6 pr-5 sm:pr-14 print:border-b-2 print:border-black">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                      <div className="grid place-items-center w-[42px] h-[42px] shrink-0 rounded-[10px] bg-[#EEF2FE] border border-[#DCE4FB] print:bg-blue-100">
                        <FileText className="w-5 h-5 text-[#2B4ACB] print:text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#8A93A3] print:text-gray-700">
                          Purchase invoice
                        </div>
                        <div className="flex items-center flex-wrap gap-2.5 mt-px">
                          {/* DialogTitle rather than a plain h2 so the dialog has
                              an accessible name; Radix warned on every open. */}
                          <DialogTitle className="text-[19px] font-semibold tracking-[-0.01em] text-[#171B23] print:text-black">
                            {viewingInvoice.invoiceNumber}
                          </DialogTitle>
                          <span className={`${STAMP} ${statusStampTone(viewingInvoice.status)}`}>
                            {viewingInvoice.status.replace(/_/g, " ")}
                          </span>
                          {paymentStampTone(viewingInvoice.paymentStatus) && (
                            <span className={`${STAMP} ${paymentStampTone(viewingInvoice.paymentStatus)}`}>
                              {viewingInvoice.paymentStatus.replace(/_/g, " ")}
                            </span>
                          )}
                          {viewingInvoice.poId && (
                            <span className="text-[11px] font-semibold tracking-[0.06em] px-[9px] py-[3px] rounded-[5px] border text-[#5B6472] bg-[#F7F9FC] border-[#E3E7EE]">
                              &larr; {viewingInvoice.poNumber || `PO-${viewingInvoice.poId}`}
                            </span>
                          )}
                        </div>
                        <div className="text-[13px] text-[#5B6472] mt-0.5 break-words print:text-gray-700">
                          <strong className="font-semibold text-[#171B23] print:text-black">{viewingInvoice.supplierName}</strong>
                          {viewingInvoice.createdAt && <>&nbsp;·&nbsp;Created {formatDisplayDate(viewingInvoice.createdAt)}</>}
                          {(viewingInvoice.createdByName || viewingInvoice.createdBy) && <> by {viewingInvoice.createdByName || "—"}</>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0 print:hidden">
                      {/* Same gates as the list's Edit buttons: drafts for
                          admin/finance, approved invoices for admin only. */}
                      {((viewingInvoice.status === "draft" && canEdit) ||
                        (viewingInvoice.status === "approved" &&
                          user?.role === "admin" &&
                          // Once any payment or credit note is recorded the
                          // server refuses the edit outright, so offering the
                          // button here only produces a 400. Mirrors sales.
                          parseFloat(viewingInvoice.paidAmount || "0") === 0)) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditInvoice(viewingInvoice)}
                          data-testid="button-edit-invoice-header"
                          className={BTN}
                        >
                          <Pencil className="w-[15px] h-[15px] text-[#5B6472]" />
                          Edit
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDuplicateInvoice(viewingInvoice)}
                        data-testid="button-duplicate-invoice-header"
                        className={BTN}
                      >
                        <Copy className="w-[15px] h-[15px] text-[#5B6472]" />
                        Duplicate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePrintPDF(viewingInvoice)}
                        data-testid="button-print-invoice"
                        className={BTN}
                      >
                        <Printer className="w-[15px] h-[15px] text-[#5B6472]" />
                        Print
                      </Button>
                    </div>
                  </header>

                  {/* Key facts. flex rather than a fixed grid so the cells
                      spread evenly when one of them is absent. */}
                  <div className="flex flex-wrap shrink-0 border-b border-[#E3E7EE] bg-[#F7F9FC] print:bg-white">
                    <div className={META_CELL}>
                      <div className={META_LABEL}>Invoice date</div>
                      <div className={META_VALUE}>{formatDisplayDate(viewingInvoice.invoiceDate)}</div>
                    </div>
                    <div className={META_CELL}>
                      <div className={META_LABEL}>Due date</div>
                      <div className={META_VALUE}>{formatDisplayDate(viewingInvoice.dueDate)}</div>
                    </div>
                    <div className={META_CELL}>
                      <div className={META_LABEL}>Currency</div>
                      <div className={META_VALUE}>
                        {viewingInvoice.currency || viewingInvoice.supplierCurrency || "AED"}
                        {viewingInvoice.supplierVatTreatment && (
                          <span className="text-[13px] font-medium text-[#5B6472] capitalize print:text-gray-700">
                            {" "}· {viewingInvoice.supplierVatTreatment.replace(/_/g, " ")} VAT
                          </span>
                        )}
                      </div>
                      {showExchangeRate && (
                        <div className="text-[12px] text-[#8A93A3] mt-px print:text-gray-700">
                          1 {viewingInvoice.currency || viewingInvoice.supplierCurrency} = {viewingInvoice.exchangeRate} AED
                        </div>
                      )}
                    </div>
                    <div className={META_CELL}>
                      <div className={META_LABEL}>Total amount</div>
                      <div className={META_VALUE}>{formatCurrency(viewingInvoice.totalAmount, viewingInvoice.supplierCurrency)}</div>
                    </div>
                    <div className={META_CELL}>
                      <div className={META_LABEL}>Balance due</div>
                      <div className={`${META_VALUE} text-[#B42318] print:text-red-700`}>
                        {formatCurrency((parseFloat(viewingInvoice.totalAmount) - parseFloat(viewingInvoice.paidAmount)), viewingInvoice.supplierCurrency)}
                      </div>
                      <div className="text-[12px] text-[#8A93A3] mt-px print:text-gray-700">
                        {formatCurrency(viewingInvoice.paidAmount, viewingInvoice.supplierCurrency)} paid
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto bg-[#FBFCFE] print:overflow-visible print:bg-white">
                    <div className="flex flex-col gap-4 p-5 sm:p-6 print:gap-3 print:p-0">

                      {/* Supplier and commercial terms. flex-wrap rather than a
                          two-column grid so the supplier card still fills the
                          row when the terms card is dropped entirely. */}
                      <div className="flex flex-wrap gap-4 items-start">
                        <div className={`${CARD} flex-1 min-w-[260px]`}>
                          <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="supplier" className="border-b-0">
                              <AccordionTrigger className={ACC_TRIGGER}>
                                <span className="flex items-center gap-2.5">
                                  <Building2 className={CARD_ICON} />
                                  <span className={CARD_TITLE}>Supplier</span>
                                </span>
                              </AccordionTrigger>
                              <AccordionContent className={ACC_BODY}>
                                <div className="text-[15px] font-semibold mb-0.5 break-words print:text-black">
                                  {viewingInvoice.supplierName}
                                </div>
                                {supplierAddress && (
                                  <div className="text-[13.5px] leading-[1.55] text-[#333B47] whitespace-pre-wrap break-words print:text-black">
                                    {supplierAddress}
                                  </div>
                                )}
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </div>
                        {hasCommercialTerms && (
                          <div className={`${CARD} flex-1 min-w-[260px]`}>
                            <Accordion type="single" collapsible className="w-full">
                              <AccordionItem value="terms" className="border-b-0">
                                <AccordionTrigger className={ACC_TRIGGER}>
                                  <span className="flex items-center gap-2.5">
                                    <DollarSign className={CARD_ICON} />
                                    <span className={CARD_TITLE}>Commercial terms</span>
                                  </span>
                                </AccordionTrigger>
                                <AccordionContent className={ACC_BODY}>
                                  <div className="flex flex-col">
                                    {viewingInvoice.supplierInvoiceNumber && (
                                      <div className={KV_ROW}>
                                        <span className={KV_LABEL}>Supplier invoice no.</span>
                                        <span className={KV_VAL}>{viewingInvoice.supplierInvoiceNumber}</span>
                                      </div>
                                    )}
                                    {viewingInvoice.paymentTerms && (
                                      <div className={KV_ROW}>
                                        <span className={KV_LABEL}>Payment terms</span>
                                        <span className={KV_VAL}>{viewingInvoice.paymentTerms}</span>
                                      </div>
                                    )}
                                    {viewingInvoice.supplierVatTreatment && (
                                      <div className={KV_ROW}>
                                        <span className={KV_LABEL}>VAT treatment</span>
                                        <span className={`${KV_VAL} capitalize`}>
                                          {viewingInvoice.supplierVatTreatment.replace(/_/g, " ")}
                                        </span>
                                      </div>
                                    )}
                                    {showExchangeRate && (
                                      <div className={KV_ROW}>
                                        <span className={KV_LABEL}>Exchange rate</span>
                                        <span className={`${KV_VAL} text-[12.5px]`}>
                                          1 {viewingInvoice.currency || viewingInvoice.supplierCurrency} = {viewingInvoice.exchangeRate} AED
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          </div>
                        )}
                      </div>

                      {/* Bank account and attachments. Either can be absent, so
                          the row is flex-wrap and each card grows to fill. */}
                      {(viewingInvoice.bankAccount || invoiceFiles.length > 0) && (
                        <div className="flex flex-wrap gap-4 items-start">
                          {viewingInvoice.bankAccount && (
                            <div className={`${CARD} flex-1 min-w-[260px]`}>
                              <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="bank" className="border-b-0">
                                  <AccordionTrigger className={ACC_TRIGGER}>
                                    <span className="flex items-center gap-2.5">
                                      <CreditCard className={CARD_ICON} />
                                      <span className={CARD_TITLE}>Bank account</span>
                                    </span>
                                  </AccordionTrigger>
                                  <AccordionContent className={ACC_BODY}>
                                    <div
                                      className="text-[13px] leading-[1.6] text-[#333B47] break-words rich-text-content print:text-black"
                                      dangerouslySetInnerHTML={{ __html: sanitize(viewingInvoice.bankAccount || "") }}
                                    />
                                  </AccordionContent>
                                </AccordionItem>
                              </Accordion>
                            </div>
                          )}
                          {invoiceFiles.length > 0 && (
                            <div className={`${CARD} flex-1 min-w-[260px]`}>
                              <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="attachments" className="border-b-0">
                                  <AccordionTrigger className={ACC_TRIGGER}>
                                    <span className="flex items-center gap-2.5">
                                      <Paperclip className={CARD_ICON} />
                                      <span className={CARD_TITLE}>Attachments</span>
                                      <span className={COUNT}>{invoiceFiles.length}</span>
                                    </span>
                                  </AccordionTrigger>
                                  <AccordionContent className={ACC_BODY}>
                                    <ul className="flex flex-col gap-2">
                                      {invoiceFiles.map((file: any) => (
                                        <li
                                          key={file.id}
                                          className="flex items-center justify-between p-2 rounded-lg border border-[#E3E7EE] bg-white"
                                        >
                                          <div className="flex items-center gap-2 overflow-hidden">
                                            {getFileIcon(file.mimeType)}
                                            <div className="flex flex-col overflow-hidden">
                                              <span className="text-[13px] truncate" title={file.originalName}>
                                                {file.originalName}
                                              </span>
                                              <span className="text-[11.5px] text-[#8A93A3]">
                                                {formatFileSize(file.fileSize)}
                                                {file.uploadedAt && ` · ${formatDisplayDate(file.uploadedAt)}`}
                                              </span>
                                            </div>
                                          </div>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            asChild
                                            className="h-8 ml-2 text-[13px]"
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
                                  </AccordionContent>
                                </AccordionItem>
                              </Accordion>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Subject sits directly above the items and opens by
                          default — it is what the invoice is for. */}
                      {viewingInvoice.subject && (
                        <div className={CARD}>
                          <Accordion type="single" collapsible defaultValue="subject" className="w-full">
                            <AccordionItem value="subject" className="border-b-0">
                              <AccordionTrigger className={ACC_TRIGGER}>
                                <span className="flex items-center gap-2.5">
                                  <AlignLeft className={CARD_ICON} />
                                  <span className={CARD_TITLE}>Subject</span>
                                </span>
                              </AccordionTrigger>
                              <AccordionContent className={ACC_BODY}>
                                <div className={`${PROSE} whitespace-pre-wrap break-words`}>
                                  {viewingInvoice.subject}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </div>
                      )}

                      {/* Invoice items, with the ledger totals at the foot of
                          the same card so the numbers sit under the lines they
                          come from. */}
                      <div className={CARD}>
                        <div className={CARD_HEAD}>
                          <Package className={CARD_ICON} />
                          <span className={CARD_TITLE}>Invoice items</span>
                          <span className={COUNT}>{viewingInvoice.items?.length || 0} items</span>
                        </div>
                        <div className="relative w-full overflow-auto">
                          <table className="w-full caption-bottom text-sm">
                            <thead>
                              <tr className="border-b border-[#E3E7EE]">
                                <th className={`${TH} w-9`}>#</th>
                                <th className={TH}>Item</th>
                                <th className={`${TH} text-right`}>Qty</th>
                                <th className={`${TH} text-right`}>Unit price</th>
                                <th className={`${TH} text-right`}>Tax rate</th>
                                <th className={`${TH} text-right`}>Tax</th>
                                <th className={`${TH} text-right`}>Discount</th>
                                <th className={`${TH} text-right`}>Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {viewingInvoice.items?.map((item, index) => (
                                <tr key={item.id} className="border-b border-[#EDF0F5] last:border-b-0 hover:bg-[#F7F9FC]">
                                  <td className={`${TD} text-[12.5px] text-[#8A93A3] print:text-black`}>{index + 1}</td>
                                  <td className={TD}>
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-[13.5px] font-semibold whitespace-pre-wrap break-words print:text-black">
                                        {item.itemType === "product" ? item.inventoryItemName : item.description}
                                      </span>
                                      <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-0.5">
                                        {item.itemType === "product" && item.inventoryItemId && (() => {
                                          const description = getItemDescription(item.inventoryItemId);
                                          return description && (
                                            <span className="text-[12.5px] text-[#5B6472] break-words print:text-gray-600">
                                              {description}
                                            </span>
                                          );
                                        })()}
                                        {item.itemType === "product" && (
                                          <span className={TYPE_TAG}>Product</span>
                                        )}
                                        {item.projectId && (
                                          <span className={PROJ_TAG}>
                                            <Briefcase className="w-3 h-3" />
                                            {getProjectTitle(item.projectId.toString())}
                                          </span>
                                        )}
                                        {item.assetInstanceId && (
                                          <span className={ASSET_TAG}>
                                            <Package className="w-3 h-3" />
                                            {getAssetInfo(item.assetInstanceId.toString()).tag}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className={TDN}>
                                    {item.quantity} {item.itemType === "product" ? item.inventoryItemUnit : ""}
                                  </td>
                                  <td className={TDN}>{formatAmount(item.unitPrice)}</td>
                                  <td className={TDN}>{item.taxRate || "0"}%</td>
                                  <td className={TDN}>{formatAmount(item.taxAmount || "0.00")}</td>
                                  <td className={Number(item.discount) > 0 ? `${TDN} text-[#B42318] print:text-red-700` : TDN}>
                                    {Number(item.discount) > 0
                                      ? (item.discountType === "percentage" ? `−${item.discount}%` : `−${formatAmount(item.discount as any)}`)
                                      : "—"}
                                  </td>
                                  <td className={`${TDN} font-semibold`}>{formatAmount(item.lineTotal)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex justify-end px-[18px] pt-3.5 pb-4 bg-[#F7F9FC] border-t border-[#EDF0F5] print:bg-white">
                          <div className="w-full sm:w-[320px] text-[13.5px]">
                            <div className={TROW}>
                              <span className="text-[#5B6472] print:text-gray-700">Subtotal</span>
                              <span className="font-medium">{formatAmount(viewingInvoice.subtotal)}</span>
                            </div>
                            {/* The header discount as stored, shown alongside the
                                derived total so a reader can tell the header
                                portion from the line-level one. discountPercentage
                                and discountAmount are mutually exclusive on save: a
                                percentage is used when non-zero, else the fixed
                                amount. */}
                            {parseFloat(viewingInvoice.discountPercentage || "0") > 0 && (
                              <div className={TROW}>
                                <span className="text-[#5B6472] print:text-gray-700">Header discount</span>
                                <span className="font-medium">{viewingInvoice.discountPercentage}%</span>
                              </div>
                            )}
                            {parseFloat(viewingInvoice.discountAmount || "0") > 0 && (
                              <div className={TROW}>
                                <span className="text-[#5B6472] print:text-gray-700">Discount amount</span>
                                <span className="font-medium text-[#B42318] print:text-red-700">−{formatAmount(viewingInvoice.discountAmount || "0")}</span>
                              </div>
                            )}
                            {totalDiscount > 0.005 && (
                              <div className={TROW}>
                                <span className="text-[#5B6472] print:text-gray-700">Total discount</span>
                                <span className="font-medium text-[#B42318] print:text-red-700">−{formatAmount(totalDiscount.toFixed(2))}</span>
                              </div>
                            )}
                            <div className={TROW}>
                              <span className="text-[#5B6472] print:text-gray-700">Tax</span>
                              <span className="font-medium">{formatAmount(viewingInvoice.taxAmount)}</span>
                            </div>
                            <div className={`${TROW} mt-[7px] pt-[9px] border-t-[3px] border-double border-[#171B23]`}>
                              <span className="text-sm font-semibold text-[#171B23] print:text-black">Total ({totalsCurrency})</span>
                              <span className="text-[17px] font-semibold text-[#2B4ACB] print:text-blue-600">
                                {formatCurrency(viewingInvoice.totalAmount, viewingInvoice.supplierCurrency)}
                              </span>
                            </div>
                            <div className={`${TROW} mt-1`}>
                              <span className="text-[#5B6472] print:text-gray-700">Paid amount</span>
                              <span className="font-medium text-[#027A48] print:text-green-700">− {formatAmount(viewingInvoice.paidAmount)}</span>
                            </div>
                            <div className={`${TROW} pt-2 border-t border-[#E3E7EE]`}>
                              <span className="text-sm font-semibold text-[#171B23] print:text-black">Balance due ({totalsCurrency})</span>
                              <span className="text-[17px] font-semibold text-[#B42318] print:text-red-700">
                                {formatCurrency((parseFloat(viewingInvoice.totalAmount) - parseFloat(viewingInvoice.paidAmount)), viewingInvoice.supplierCurrency)}
                              </span>
                            </div>
                            {showExchangeRate && (
                              <div className="text-right text-[11.5px] text-[#8A93A3] mt-2.5 print:text-gray-700">
                                Exchange rate 1 {viewingInvoice.currency || viewingInvoice.supplierCurrency} = {viewingInvoice.exchangeRate} AED
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Notes and terms are reference text, not something a
                          reader needs on opening the document, so both stay
                          collapsed. */}
                      {viewingInvoice.notes && (
                        <div className={CARD}>
                          <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="notes" className="border-b-0">
                              <AccordionTrigger className={ACC_TRIGGER}>
                                <span className="flex items-center gap-2.5">
                                  <Pencil className={CARD_ICON} />
                                  <span className={CARD_TITLE}>Notes</span>
                                </span>
                              </AccordionTrigger>
                              <AccordionContent className={ACC_BODY}>
                                <div
                                  className={`${PROSE} break-words rich-text-content`}
                                  dangerouslySetInnerHTML={{ __html: sanitize(viewingInvoice.notes || "") }}
                                />
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </div>
                      )}
                      {viewingInvoice.termsAndConditions && (
                        <div className={CARD}>
                          <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="terms-and-conditions" className="border-b-0">
                              <AccordionTrigger className={ACC_TRIGGER}>
                                <span className="flex items-center gap-2.5">
                                  <FileText className={CARD_ICON} />
                                  <span className={CARD_TITLE}>Terms &amp; conditions</span>
                                </span>
                              </AccordionTrigger>
                              <AccordionContent className={ACC_BODY}>
                                <p className={`${PROSE} whitespace-pre-wrap break-words`}>
                                  {viewingInvoice.termsAndConditions}
                                </p>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </div>
                      )}

                      {/* Activity — approval trail, payments and edit history in
                          one tabbed block rather than three stacked cards.
                          Approval opens first because its data is already on the
                          invoice row; the other two fetch on first click, so
                          opening the dialog is a single request. Both of those
                          endpoints are admin/finance only, so their tabs are
                          hidden for project_manager rather than firing a request
                          that would 403. */}
                      <div className={`${CARD} print:hidden`}>
                        <div className={CARD_HEAD}>
                          <History className={CARD_ICON} />
                          <span className={CARD_TITLE}>Activity</span>
                        </div>
                        <div className={CARD_BODY}>
                          <Tabs value={activityTab} onValueChange={setActivityTab}>
                            <TabsList>
                              <TabsTrigger value="approval" data-testid="tab-approval">
                                Approval
                              </TabsTrigger>
                              {canSeeActivityDetail && canHavePayments && (
                                <TabsTrigger value="payments" data-testid="tab-payments">
                                  Payments
                                  {invoicePayments ? ` (${invoicePayments.length})` : ""}
                                </TabsTrigger>
                              )}
                              {canSeeActivityDetail && (
                                <TabsTrigger value="history" data-testid="tab-edit-history">
                                  Edit History
                                  {invoiceEditHistory ? ` (${invoiceEditHistory.length})` : ""}
                                </TabsTrigger>
                              )}
                            </TabsList>

                            <TabsContent value="approval" className="mt-4">
                              {viewingInvoice.submittedAt || viewingInvoice.approvedAt || viewingInvoice.rejectionReason ? (
                                <ul className="relative list-none pl-5 before:content-[''] before:absolute before:left-[5px] before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-[#EDF0F5]">
                                  {viewingInvoice.submittedAt && (
                                    <li className="relative pb-4 last:pb-0">
                                      <span className="absolute -left-5 top-[5px] w-3 h-3 rounded-full bg-white border-[3px] border-[#8A93A3]" />
                                      <div className="text-[13.5px] font-semibold">Submitted for approval</div>
                                      <div className="text-[12.5px] text-[#8A93A3] mt-px">
                                        {viewingInvoice.submittedByName || "—"} · {new Date(viewingInvoice.submittedAt).toLocaleString()}
                                      </div>
                                    </li>
                                  )}
                                  {viewingInvoice.approvedAt && (
                                    <li className="relative pb-4 last:pb-0">
                                      <span className="absolute -left-5 top-[5px] w-3 h-3 rounded-full bg-white border-[3px] border-[#12B76A]" />
                                      <div className="text-[13.5px] font-semibold">Approved</div>
                                      <div className="text-[12.5px] text-[#8A93A3] mt-px">
                                        {viewingInvoice.approvedByName || "—"} · {new Date(viewingInvoice.approvedAt).toLocaleString()}
                                      </div>
                                    </li>
                                  )}
                                  {viewingInvoice.rejectionReason && (
                                    <li className="relative pb-4 last:pb-0">
                                      <span className="absolute -left-5 top-[5px] w-3 h-3 rounded-full bg-white border-[3px] border-[#B42318]" />
                                      <div className="text-[13.5px] font-semibold">Rejected</div>
                                      <div className="mt-2 text-[13px] text-[#912018] bg-[#FEF3F2] border border-[#F0C5C1] rounded-[7px] px-[11px] py-2 whitespace-pre-wrap break-words">
                                        {viewingInvoice.rejectionReason}
                                      </div>
                                    </li>
                                  )}
                                  {viewingInvoice.status === "pending_approval" && (
                                    <li className="relative pb-4 last:pb-0">
                                      <span className="absolute -left-5 top-[5px] w-3 h-3 rounded-full bg-white border-[3px] border-[#E3E7EE]" />
                                      <div className="text-[13.5px] font-semibold text-[#5B6472]">Awaiting approval</div>
                                      <div className="text-[12.5px] text-[#8A93A3] mt-px">Pending review</div>
                                    </li>
                                  )}
                                </ul>
                              ) : (
                                <p className="text-sm text-muted-foreground italic">
                                  This invoice has not been submitted for approval yet.
                                </p>
                              )}
                            </TabsContent>

                            {canSeeActivityDetail && canHavePayments && (
                              <TabsContent value="payments" className="mt-4">
                                {isLoadingPayments ? (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                    Loading payments…
                                  </div>
                                ) : invoicePayments && invoicePayments.length > 0 ? (
                                  <>
                                    <div className="space-y-2">
                                      {invoicePayments.map((payment: any) => (
                                        <div key={payment.id} className="border border-[#E3E7EE] rounded-lg overflow-hidden">
                                          <div
                                            className="p-3 cursor-pointer hover:bg-[#F7F9FC] transition-colors"
                                            onClick={() => setExpandedPayment(expandedPayment === payment.id ? null : payment.id)}
                                          >
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                                <span className="font-semibold text-[#027A48]">
                                                  {formatCurrency(payment.amount, viewingInvoice.currency || "AED")}
                                                </span>
                                                {/* A credit note applied to the invoice is
                                                    stored as a payment row; without this it
                                                    was indistinguishable from cash. */}
                                                {payment.paymentType === "credit_note" ? (
                                                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-[#6941C6] bg-[#F4F3FF] border-[#D9D6FE]">
                                                    Credit Note
                                                    {payment.creditNoteId ? ` #${payment.creditNoteId}` : ""}
                                                  </span>
                                                ) : (
                                                  <span className="text-[13px] text-[#5B6472] capitalize">
                                                    {payment.paymentMethod?.replace("_", " ") || "N/A"}
                                                  </span>
                                                )}
                                                <span className="text-[13px] text-[#5B6472]">
                                                  {formatDisplayDate(payment.paymentDate)}
                                                </span>
                                              </div>
                                              <ChevronDown
                                                className={`h-4 w-4 flex-shrink-0 transition-transform ${expandedPayment === payment.id ? "rotate-180" : ""}`}
                                              />
                                            </div>
                                          </div>

                                          {expandedPayment === payment.id && (
                                            <div className="px-3 pb-3 border-t border-[#EDF0F5] bg-[#F7F9FC]">
                                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3">
                                                <div>
                                                  <span className={SUBLBL}>Reference</span>
                                                  <p className="text-[13.5px] mt-1">{payment.referenceNumber || "—"}</p>
                                                </div>
                                                <div>
                                                  <span className={SUBLBL}>Recorded by</span>
                                                  <p className="text-[13.5px] mt-1">{payment.recordedByName || "—"}</p>
                                                </div>
                                                <div>
                                                  <span className={SUBLBL}>Recorded on</span>
                                                  <p className="text-[13.5px] mt-1">{formatDisplayDate(payment.recordedAt)}</p>
                                                </div>
                                              </div>
                                              <div className="mt-3">
                                                <span className={SUBLBL}>Notes</span>
                                                <p className="text-[13.5px] mt-1 whitespace-pre-wrap">{payment.notes || "—"}</p>
                                              </div>
                                              <div className="mt-3">
                                                <span className={SUBLBL}>Attachments</span>
                                                {payment.files && payment.files.length > 0 ? (
                                                  <ul className="flex flex-col gap-2 mt-2">
                                                    {payment.files.map((file: any) => (
                                                      <li
                                                        key={file.id}
                                                        className="flex items-center justify-between p-2 rounded-lg border border-[#E3E7EE] bg-white"
                                                      >
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                          {getFileIcon(file.mimeType)}
                                                          <div className="flex flex-col overflow-hidden">
                                                            <span className="text-[13px] truncate" title={file.originalName}>
                                                              {file.originalName}
                                                            </span>
                                                            <span className="text-[11.5px] text-[#8A93A3]">
                                                              {formatFileSize(file.fileSize)}
                                                              {file.uploadedAt && ` · ${formatDisplayDate(file.uploadedAt)}`}
                                                            </span>
                                                          </div>
                                                        </div>
                                                        <Button variant="ghost" size="sm" asChild className="h-8 ml-2 text-[13px]">
                                                          <a
                                                            href={`/api/purchase-payment-files/${file.id}/download`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                          >
                                                            Download
                                                          </a>
                                                        </Button>
                                                      </li>
                                                    ))}
                                                  </ul>
                                                ) : (
                                                  <p className="text-[13px] text-[#8A93A3] italic mt-1">No attachments</p>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                    <div className="flex justify-between items-baseline mt-4 pt-3 border-t border-[#EDF0F5] text-[13.5px]">
                                      <span className="text-[#5B6472]">Total recorded against this invoice</span>
                                      <span className="font-semibold text-[#027A48]">
                                        {formatCurrency(
                                          invoicePayments.reduce((sum: number, p: any) => sum + parseFloat(p.amount || "0"), 0),
                                          viewingInvoice.currency || "AED",
                                        )}
                                      </span>
                                    </div>
                                  </>
                                ) : (
                                  <p className="text-sm text-muted-foreground italic">No payments recorded.</p>
                                )}
                              </TabsContent>
                            )}

                            {canSeeActivityDetail && (
                              <TabsContent value="history" className="mt-4">
                                {isLoadingEditHistory ? (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                    Loading edit history…
                                  </div>
                                ) : invoiceEditHistory && invoiceEditHistory.length > 0 ? (
                                  <div className="space-y-3">
                                    {invoiceEditHistory.map((entry: any) => {
                                      const changedFields = entry.changes ? Object.keys(entry.changes) : [];
                                      return (
                                        <div key={entry.id} className="border border-[#E3E7EE] rounded-lg overflow-hidden">
                                          <div
                                            className="p-3 cursor-pointer hover:bg-[#F7F9FC] transition-colors"
                                            onClick={() => setExpandedEditEntry(expandedEditEntry === entry.id ? null : entry.id)}
                                          >
                                            <div className="flex items-start justify-between gap-2">
                                              <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                  <span className="font-medium text-sm">{entry.editedByName || "Unknown"}</span>
                                                  <span className="text-xs text-[#8A93A3]">{new Date(entry.editedAt).toLocaleString()}</span>
                                                </div>
                                                <p className="text-sm text-[#333B47] mt-1 break-words">{entry.editNote}</p>
                                                {changedFields.length > 0 && (
                                                  <p className="text-xs text-[#8A93A3] mt-1">
                                                    {changedFields.length} field{changedFields.length === 1 ? "" : "s"} changed
                                                  </p>
                                                )}
                                              </div>
                                              {changedFields.length > 0 && (
                                                <ChevronDown
                                                  className={`h-4 w-4 flex-shrink-0 mt-1 transition-transform ${expandedEditEntry === entry.id ? "rotate-180" : ""}`}
                                                />
                                              )}
                                            </div>
                                          </div>
                                          {expandedEditEntry === entry.id && changedFields.length > 0 && (
                                            <div className="px-3 pb-3 pt-3 border-t border-[#EDF0F5] bg-[#F7F9FC]">
                                              <div className="text-xs space-y-2">
                                                {Object.entries(entry.changes).map(([field, change]: [string, any]) => (
                                                  field !== "items" ? (
                                                    <div key={field} className="flex flex-col gap-1">
                                                      <span className="font-medium capitalize">{field.replace(/([A-Z])/g, " $1")}:</span>
                                                      {/* notes and bankAccount are ReactQuill fields, so their
                                                          stored value is HTML and printing it raw showed markup
                                                          to the reader. Every other tracked field is plain text
                                                          and stays escaped. */}
                                                      {isRichTextField(field) ? (
                                                        <>
                                                          <div
                                                            className="text-red-500 line-through break-words rich-text-content"
                                                            dangerouslySetInnerHTML={{ __html: sanitize(String(change.old || "—")) }}
                                                          />
                                                          <div
                                                            className="text-green-600 break-words rich-text-content"
                                                            dangerouslySetInnerHTML={{ __html: sanitize(String(change.new || "—")) }}
                                                          />
                                                        </>
                                                      ) : (
                                                        <>
                                                          <span className="text-red-500 line-through break-words whitespace-pre-wrap">{String(change.old || "—")}</span>
                                                          <span className="text-green-600 break-words whitespace-pre-wrap">{String(change.new || "—")}</span>
                                                        </>
                                                      )}
                                                    </div>
                                                  ) : (
                                                    <div key={field} className="text-[#8A93A3] italic">Line items were modified</div>
                                                  )
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground italic">No edits recorded.</p>
                                )}
                              </TabsContent>
                            )}
                          </Tabs>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer band — status-flow actions only; document actions
                      (edit, duplicate, print) live in the header. */}
                  <footer className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 px-5 sm:px-6 py-3.5 border-t border-[#E3E7EE] bg-white print:hidden">
                    <div className="text-[12.5px] text-[#8A93A3]">
                      <span className="font-medium">{viewingInvoice.invoiceNumber}</span>
                      {viewingInvoice.createdAt && <> · Created {formatDisplayDate(viewingInvoice.createdAt)}</>}
                      {(viewingInvoice.createdByName || viewingInvoice.createdBy) && <> by {viewingInvoice.createdByName || "—"}</>}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2.5">
                      <Button
                        variant="outline"
                        onClick={() => setIsViewDialogOpen(false)}
                        className={BTN}
                      >
                        Close
                      </Button>
                      {viewingInvoice.status === "approved" && user?.role === "admin" && parseFloat(viewingInvoice.paidAmount || "0") <= 0 && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              disabled={cancelInvoiceMutation.isPending}
                              variant="outline"
                              className={BTN_DANGER}
                            >
                              {cancelInvoiceMutation.isPending ? (
                                <>
                                  <div className="w-[14px] h-[14px] border-2 border-[#B42318] border-t-transparent rounded-full animate-spin" />
                                  Cancelling...
                                </>
                              ) : (
                                <>
                                  <Ban className="w-[14px] h-[14px]" />
                                  Cancel invoice
                                </>
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel Invoice</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to cancel invoice{" "}
                                {viewingInvoice.invoiceNumber}? This will create
                                reverse ledger entries. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep Invoice</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  cancelInvoiceMutation.mutate(viewingInvoice.id)
                                }
                                disabled={cancelInvoiceMutation.isPending}
                              >
                                {cancelInvoiceMutation.isPending
                                  ? "Cancelling..."
                                  : "Cancel Invoice"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      {viewingInvoice.status === "pending_approval" && user?.role === "admin" && (
                        <Button
                          onClick={() => setIsRejectDialogOpen(true)}
                          variant="outline"
                          className={BTN_DANGER}
                          data-testid={`button-reject-invoice-${viewingInvoice.id}`}
                        >
                          <XCircle className="w-[14px] h-[14px]" />
                          Reject
                        </Button>
                      )}
                      {viewingInvoice.status === "draft" && (
                        <Button
                          onClick={() => {
                            submitInvoiceMutation.mutate(viewingInvoice.id);
                          }}
                          disabled={submitInvoiceMutation.isPending}
                          className={BTN_PRIMARY}
                          data-testid={`button-submit-invoice-${viewingInvoice.id}`}
                        >
                          {submitInvoiceMutation.isPending ? (
                            <>
                              <div className="w-[14px] h-[14px] border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            <>
                              <Send className="w-[14px] h-[14px]" />
                              Submit
                            </>
                          )}
                        </Button>
                      )}
                      {viewingInvoice.status === "pending_approval" && user?.role === "admin" && (
                        <Button
                          onClick={() => {
                            approveInvoiceMutation.mutate(viewingInvoice.id);
                          }}
                          disabled={approveInvoiceMutation.isPending}
                          className={BTN_PRIMARY}
                          data-testid={`button-approve-invoice-${viewingInvoice.id}`}
                        >
                          {approveInvoiceMutation.isPending ? (
                            <>
                              <div className="w-[14px] h-[14px] border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Approving...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-[14px] h-[14px]" />
                              Approve
                            </>
                          )}
                        </Button>
                      )}
                      {canEdit && viewingInvoice.status === "approved" && parseFloat(viewingInvoice.paidAmount) < parseFloat(viewingInvoice.totalAmount) && (
                        <Button
                          onClick={() => setIsPaymentDialogOpen(true)}
                          className={BTN_PRIMARY}
                          data-testid="button-record-payment"
                        >
                          <DollarSign className="w-[14px] h-[14px]" />
                          Record payment
                        </Button>
                      )}
                    </div>
                  </footer>
                </>
              );
            })()}
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
                {/* The amount is taken to be in the invoice's currency and is
                    posted to the ledger at the invoice's rate. Showing what that
                    comes to in AED is the only confirmation the person entering
                    it gets that they typed the currency the field is asking for.
                    Matches the sales payment dialog. */}
                {viewingInvoice?.currency && viewingInvoice.currency !== "AED" && viewingInvoice.exchangeRate && (
                  <p className="text-xs text-slate-500 mt-1">
                    AED Equivalent: {formatCurrency((parseFloat(paymentData.amount || "0") * parseFloat(viewingInvoice.exchangeRate || "1")).toFixed(2), "AED")}
                  </p>
                )}
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