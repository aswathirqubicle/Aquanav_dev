import { formatDisplayDate } from "@/lib/utils";
import { useEffect, useRef, useState, startTransition } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { printByUrl } from "@/lib/print-utils";
import { sanitize } from "@/lib/sanitize";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import {
  FileText,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowRightLeft,
  Printer,
  Copy,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { Customer, Project } from "@shared/schema";
import { z } from "zod";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Autocomplete } from "@/components/ui/autocomplete";
import { computeDocumentTotals } from "@shared/document-totals";
// Proforma Invoice Schema
const createProformaInvoiceSchema = z.object({
  customerId: z.number(),
  projectId: z.number().optional(),
  quotationId: z.number().optional(),
  invoiceDate: z.string().optional(),
  validUntil: z.string().optional(),
  subject: z.string().optional(),
  paymentTerms: z.string().optional(),
  workOrderNumber: z.string().optional(),
  deliveryTerms: z.string().optional(),
  bankAccount: z.string().optional(),
  billingAddress: z.string().optional(),
  termsAndConditions: z.string().optional(),
  remarks: z.string().optional(),
  items: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
        taxRate: z.number().optional(),
        discount: z.number().optional(),
        discountType: z.enum(["amount", "percentage"]).optional(),
      }),
    )
    .default([]),
  subtotal: z.string().optional(),
  taxAmount: z.string().optional(),
  discountPercentage: z.string().optional(),
  discount: z.string().optional(),
  totalAmount: z.string().optional(),
});

type CreateProformaInvoiceData = z.infer<typeof createProformaInvoiceSchema>;

interface ProformaInvoice {
  id: number;
  proformaNumber: string;
  subject?: string;
  rejectionReason?: string | null;
  customerId: number;
  customerName?: string;
  projectId?: number;
  quotationId?: number;
  status: string;
  createdDate: string;
  invoiceDate?: string;
  validUntil?: string;
  paymentTerms?: string;
  workOrderNumber?: string;
  deliveryTerms?: string;
  bankAccount?: string;
  billingAddress?: string;
  termsAndConditions?: string;
  remarks?: string;
  items?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
    discount?: number;
    discountType?: "amount" | "percentage";
    taxAmount?: number | string;
  }>;
  subtotal?: string;
  taxAmount?: string;
  discount?: string;
  discountPercentage?: string;
  totalAmount?: string;
  isArchived?: boolean;
  currency?: string;
  exchangeRate?: string;
}

interface ProformaItem {
  description: string;
  quantity: number | "";
  unitPrice: number | "";
  taxRate?: number | "";
  discount?: number | "";
  discountType?: "amount" | "percentage";
}

export default function ProformaInvoicesIndex() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProforma, setSelectedProforma] = useState<ProformaInvoice | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditingProforma, setIsEditingProforma] = useState(false);
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [convertingProforma, setConvertingProforma] = useState<ProformaInvoice | null>(null);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectingProforma, setRejectingProforma] = useState<ProformaInvoice | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [archivedFilter, setArchivedFilter] = useState<string>("active");
  const [customerVatTreatment, setCustomerVatTreatment] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateProformaInvoiceData & { currency?: string; exchangeRate?: string }>({
    customerId: 0,
    invoiceDate: new Date().toISOString().split('T')[0],
    items: [],
    discountPercentage: "0",
    discount: "0",
    currency: "AED",
    subject: "",
    workOrderNumber: "",
    exchangeRate: "1",
    paymentTerms: "",
    deliveryTerms: "",
    bankAccount: "",
    billingAddress: "",
    termsAndConditions: "",
    remarks: "",
    validUntil: new Date().toISOString().split('T')[0],
  });

  // The staged line starts blank so nothing is pre-filled for the user to
  // overwrite; the placeholders carry the guidance instead. Tax rate is the
  // exception — it is derived from the customer's VAT treatment, not typed.
  const [newItem, setNewItem] = useState<ProformaItem>({
    description: "",
    quantity: "",
    unitPrice: "",
    taxRate: 0,
    discount: "",
    discountType: "amount",
  });

  // Index of the line being edited, or null when the form is adding a new one.
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const itemFormRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // Bring the staging form into view and put the cursor in Description, so
  // clicking Edit on a row far down the table doesn't leave the form off-screen.
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

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    } else if (
      user?.role !== "admin" &&
      user?.role !== "finance"
    ) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user, setLocation]);

  const { data: proformaInvoices, isLoading: proformaLoading } = useQuery<ProformaInvoice[]>({
    queryKey: ["/api/proforma-invoices"],
    queryFn: async () => {
      const response = await apiRequest("/api/proforma-invoices", {
        method: "GET",
      });
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const toInputDate = (date?: string) => {
    if (!date) return "";
    return date.split(" ")[0]; // handles "YYYY-MM-DD HH:mm:ss"
  };

  const { data: company } = useQuery({
    queryKey: ["/api/company"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isDialogOpen || !company?.bankAccount) return;

    setFormData(prev => ({
      ...prev,
      bankAccount: prev.bankAccount || company.bankAccount, // ✅ default only
    }));
  }, [isDialogOpen, company]);

  // Recalculate proforma discount when items or percentage changes
  const proformaSubtotal = formData.items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);

  // Authoritative totals via the shared engine (VAT on the discounted base;
  // line discount first, then header apportioned). Mirrors the server.
  const proformaTotals = computeDocumentTotals(
    (formData.items || []).map((it: any) => ({
      quantity: Number(it.quantity) || 0,
      unitPrice: Number(it.unitPrice) || 0,
      taxRate: Number(it.taxRate) || 0,
      discount: Number(it.discount) || 0,
      discountType: it.discountType === "percentage" ? "percentage" : "amount",
    })),
    parseFloat(formData.discountPercentage || "0") > 0
      ? { discount: parseFloat(formData.discountPercentage || "0"), discountType: "percentage" as const }
      : { discount: parseFloat(formData.discount || "0"), discountType: "amount" as const },
  );

  // Recalculate proforma discount when items or percentage changes
  useEffect(() => {
    const pct = parseFloat(formData.discountPercentage || "0") || 0;
    const calcDiscountValue = proformaSubtotal * pct / 100;
    const currentDiscountValue = parseFloat(formData.discount || "0");

    if (Math.abs(currentDiscountValue - calcDiscountValue) > 0.001) {
      setFormData(prev => ({ ...prev, discount: calcDiscountValue.toFixed(2) }));
    }
  }, [proformaSubtotal, formData.discountPercentage]);

  useEffect(() => {
    if (!formData.paymentTerms || !formData.invoiceDate) return;

    const baseDate = new Date(formData.invoiceDate);
    if (isNaN(baseDate.getTime())) return;

    let daysToAdd = 0;
    switch (formData.paymentTerms) {
      case "Net 10": daysToAdd = 10; break;
      case "Net 15": daysToAdd = 15; break;
      case "Net 30": daysToAdd = 30; break;
      case "Due on receipt": daysToAdd = 0; break;
      default: return;
    }

    const validUntilDate = new Date(baseDate);
    validUntilDate.setUTCDate(baseDate.getUTCDate() + daysToAdd);
    const validUntilDateString = validUntilDate.toISOString().split('T')[0];

    if (formData.validUntil !== validUntilDateString) {
      setFormData(prev => ({
        ...prev,
        validUntil: validUntilDateString
      }));
    }
  }, [formData.paymentTerms, formData.invoiceDate]);

  const { data: customersResponse } = useQuery<{
    data: Customer[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const response = await apiRequest("/api/customers?limit=1000", {
        method: "GET",
      });
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const openNewProformaDialog = () => {
    resetForm();              // clear old data
    setIsEditingProforma(false);
    setSelectedProforma(null);
    setIsDialogOpen(true);
  };

  const customers = customersResponse?.data;

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: isAuthenticated,
  });

  const createProformaMutation = useMutation({
    mutationFn: async (data: CreateProformaInvoiceData) => {
      const subtotal = data.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      );

      const discountAmount = parseFloat(data.discount || "0");

      const taxAmount = data.items.reduce((sum, item) => {
        const itemTotal = item.quantity * item.unitPrice;
        const itemTax = (itemTotal * (item.taxRate || 0)) / 100;
        return sum + itemTax;
      }, 0);
      const totalAmount = subtotal - discountAmount + taxAmount;
      // 🚨 VALIDATION
      if (totalAmount <= 0) {
        throw new Error("Total amount must be greater than zero");
      }
      const processedData = {
        ...data,
        validUntil: data.validUntil && data.validUntil !== "" ? new Date(data.validUntil).toISOString() : null,
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        discount: discountAmount.toFixed(2),
        discountPercentage: data.discountPercentage || "0",
        currency: (data as any).currency || "AED",
        exchangeRate: (data as any).exchangeRate || "1",
      };

      const url = isEditingProforma && selectedProforma
        ? `/api/proforma-invoices/${selectedProforma.id}`
        : "/api/proforma-invoices";
      const method = isEditingProforma ? "PUT" : "POST";

      const response = await apiRequest(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(processedData),
      });

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proforma-invoices"] });
      toast({
        title: isEditingProforma ? "Proforma Updated" : "Proforma Created",
        description: `The proforma invoice has been ${isEditingProforma ? "updated" : "created"} successfully.`,
      });
      setIsDialogOpen(false);
      setIsEditingProforma(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description:
          error.message ||
          `Failed to ${isEditingProforma ? "update" : "create"} proforma invoice`,
        variant: "destructive",
      });
    },
  });

  const convertToInvoiceMutation = useMutation({
    mutationFn: async (proformaId: number) => {
      const response = await apiRequest(`/api/proforma-invoices/${proformaId}/convert-to-invoice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proforma-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales-invoices"] });
      toast({
        title: "Success",
        description: "Proforma invoice has been converted to sales invoice successfully.",
      });
      setIsConvertDialogOpen(false);
      setConvertingProforma(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to convert proforma invoice to sales invoice",
        variant: "destructive",
      });
    },
  });

  const approveProformaMutation = useMutation({
    mutationFn: async (proformaId: number) => {
      const response = await apiRequest(`/api/proforma-invoices/${proformaId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "approved" }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proforma-invoices"] });
      toast({
        title: "Success",
        description: "Proforma invoice has been approved successfully.",
      });
      setIsDetailsOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve proforma invoice",
        variant: "destructive",
      });
    },
  });

  const rejectProformaMutation = useMutation({
    mutationFn: async ({ proformaId, reason }: { proformaId: number; reason: string }) => {
      const response = await apiRequest(`/api/proforma-invoices/${proformaId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "rejected", rejectionReason: reason }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proforma-invoices"] });
      toast({
        title: "Success",
        description: "Proforma invoice has been rejected.",
      });
      setIsRejectDialogOpen(false);
      setRejectingProforma(null);
      setRejectionReason("");
      setIsDetailsOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject proforma invoice",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      subject: "",
      customerId: 0,
      invoiceDate: new Date().toISOString().split('T')[0],
      items: [],
      discountPercentage: "0",
      discount: "0",
      currency: "AED",
      exchangeRate: "1",
    workOrderNumber: "",
      paymentTerms: "",
      deliveryTerms: "",
      bankAccount: "",
      billingAddress: "",
      termsAndConditions: "",
      remarks: "",
      validUntil: new Date().toISOString().split('T')[0],
    });
    setNewItem({
      description: "",
      quantity: "",
      unitPrice: "",
      taxRate: customerVatTreatment === "standard" ? 5 : 0,
      discount: "",
      discountType: "amount",
    });
    // Clearing the index here makes resetForm self-sufficient: the effect on
    // isDialogOpen below then finds nothing left to cancel.
    setEditingItemIndex(null);
    setIsEditingProforma(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.items.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item to the proforma invoice",
        variant: "destructive",
      });
      return;
    }
    if (!formData.customerId) {
      toast({
        title: "Error",
        description: "Please select a customer",
        variant: "destructive",
      });
      return;
    }
    createProformaMutation.mutate(formData);
  };

  const addItem = () => {
    if (!newItem.description.trim()) {
      toast({
        title: "Error",
        description: "Please enter an item description",
        variant: "destructive",
      });
      return;
    }

    // Quantity and unit price start blank, so they have to be entered rather
    // than defaulted. Number.isFinite also catches a NaN that slipped past the
    // number input, which would otherwise become a silently zero line.
    const enteredQuantity = Number(newItem.quantity);
    if (newItem.quantity === "" || !Number.isFinite(enteredQuantity) || enteredQuantity <= 0) {
      toast({
        title: "Error",
        description: "Please enter a quantity greater than zero",
        variant: "destructive",
      });
      return;
    }

    const enteredUnitPrice = Number(newItem.unitPrice);
    if (newItem.unitPrice === "" || !Number.isFinite(enteredUnitPrice)) {
      toast({
        title: "Error",
        description: "Please enter a unit price",
        variant: "destructive",
      });
      return;
    }

    const quantity = enteredQuantity;
    const unitPrice = enteredUnitPrice;
    const taxRate = newItem.taxRate === "" ? 0 : Number(newItem.taxRate) || 0;
    const discount = newItem.discount === "" ? 0 : (newItem.discount || 0);
    const discountType = newItem.discountType || "amount";

    const item = {
      ...newItem,
      quantity,
      unitPrice,
      taxRate,
      discount,
      discountType
    };

    setFormData((prev) => ({
      ...prev,
      items:
        editingItemIndex === null
          ? [...prev.items, item]
          : prev.items.map((existing, i) =>
              i === editingItemIndex ? item : existing,
            ),
    }));

    setNewItem({
      description: "",
      quantity: "",
      unitPrice: "",
      taxRate: customerVatTreatment === "standard" ? 5 : 0,
      // Reset these too. Leaving them undefined flips the Discount inputs from
      // controlled to uncontrolled, so they keep displaying the previous line's
      // value while the staged item is actually blank.
      discount: "",
      discountType: "amount",
    });
    setEditingItemIndex(null);
  };

  // Load an existing line back into the staging form above the table. Saving
  // then replaces that row instead of appending a new one.
  const startEditItem = (index: number) => {
    const item = formData.items[index];
    if (!item) return;

    setNewItem({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: Number(item.taxRate) || 0,
      discount: Number(item.discount) || 0,
      discountType: item.discountType === "percentage" ? "percentage" : "amount",
    });
    setEditingItemIndex(index);
    focusItemForm();
  };

  const cancelEditItem = () => {
    setNewItem({
      description: "",
      quantity: "",
      unitPrice: "",
      taxRate: customerVatTreatment === "standard" ? 5 : 0,
      // Reset these too. Leaving them undefined flips the Discount inputs from
      // controlled to uncontrolled, so they keep displaying the previous line's
      // value while the staged item is actually blank.
      discount: "",
      discountType: "amount",
    });
    setEditingItemIndex(null);
  };

  const removeItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: {
        icon: Clock,
        class: "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400",
        label: "Draft",
      },
      sent: {
        icon: AlertTriangle,
        class: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
        label: "Sent",
      },
      approved: {
        icon: CheckCircle,
        class: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
        label: "Approved",
      },
      rejected: {
        icon: XCircle,
        class: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
        label: "Rejected",
      },
      converted: {
        icon: CheckCircle,
        class: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400",
        label: "Converted",
      },
      expired: {
        icon: XCircle,
        class: "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400",
        label: "Expired",
      },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    const Icon = config.icon;

    return (
      <Badge className={config.class}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const formatCurrency = (amount: string | number, currency?: string) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return `${currency || "AED"} ${num.toFixed(2)}`;
  };

  const formatDate = (date: string | Date) => {
    return formatDisplayDate(date);
  };

  const getCustomerName = (customerId: number, customerName?: string) => {
    if (customerName) {
      return customerName;
    }
    const customer = customers?.find((c) => c.id === customerId);
    return customer?.name || "Unknown Customer";
  };

  const filteredProformas = (proformaInvoices || []).filter((proforma) => {
    const statusMatch = statusFilter === "all" || proforma.status === statusFilter;
    const archivedMatch =
      archivedFilter === "all" ||
      (archivedFilter === "archived" && proforma.isArchived) ||
      (archivedFilter === "active" && !proforma.isArchived);
    return statusMatch && archivedMatch;
  });

  const totalPages = Math.ceil(filteredProformas.length / itemsPerPage);
  const paginatedProformas = filteredProformas.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const openDetails = (proforma: ProformaInvoice) => {
    setSelectedProforma(proforma);
    setIsDetailsOpen(true);
  };

  const handleConvertToInvoice = (proforma: ProformaInvoice) => {
    setConvertingProforma(proforma);
    setIsConvertDialogOpen(true);
  };

  const confirmConvertToInvoice = () => {
    if (convertingProforma) {
      convertToInvoiceMutation.mutate(convertingProforma.id);
    }
  };

  const handleApproveProforma = (proforma: ProformaInvoice) => {
    if (proforma.status === "draft" || proforma.status === "sent") {
      approveProformaMutation.mutate(proforma.id);
    }
  };

  // Rejection needs a reason, so it goes through its own confirm dialog rather
  // than firing straight away like approve does.
  const handleRejectProforma = (proforma: ProformaInvoice) => {
    if (proforma.status === "draft" || proforma.status === "sent") {
      setRejectingProforma(proforma);
      setRejectionReason("");
      setIsRejectDialogOpen(true);
    }
  };

  const confirmRejectProforma = () => {
    if (!rejectingProforma) {
      return;
    }
    if (!rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Please enter a reason for rejecting this proforma invoice",
        variant: "destructive",
      });
      return;
    }
    rejectProformaMutation.mutate({
      proformaId: rejectingProforma.id,
      reason: rejectionReason.trim(),
    });
  };

  if (
    !isAuthenticated ||
    (user?.role !== "admin" &&
      user?.role !== "finance")
  ) {
    return null;
  }

  const handlePrintPDF = async (proforma: ProformaInvoice) => {
    try {
      await printByUrl(`/api/proforma-invoices/${proforma.id}/pdf`);

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

  const handleDuplicateProforma = (proforma: ProformaInvoice) => {
    const selectedCustomer = customers?.find(
      (c) => c.id === proforma.customerId
    );

    const vatTreatment = selectedCustomer?.vatTreatment || null;
    const defaultTaxRate = vatTreatment === "standard" ? 5 : 0;

    setCustomerVatTreatment(vatTreatment);
    // Populate form with existing data
    setFormData({
      customerId: proforma.customerId,
      subject: proforma.subject || "",
      projectId: proforma.projectId,
      quotationId: proforma.quotationId,
      invoiceDate: new Date().toISOString().split('T')[0],
      validUntil: toInputDate(proforma.validUntil),
      paymentTerms: proforma.paymentTerms || '',
      deliveryTerms: proforma.deliveryTerms || '',
      bankAccount: proforma.bankAccount || '',
      billingAddress: proforma.billingAddress || '',
      termsAndConditions: proforma.termsAndConditions || '',
      remarks: proforma.remarks || '',
      items: proforma.items || [],
      discountPercentage: proforma.discountPercentage || '0',
      discount: proforma.discount || '0',
        currency: proforma.currency || 'AED',
        exchangeRate: proforma.exchangeRate || '1',
      workOrderNumber: proforma.workOrderNumber || '',
    });
    // 🔹 ensure new item uses correct tax
    setNewItem({
      description: "",
      quantity: "",
      unitPrice: "",
      taxRate: defaultTaxRate,
      discount: "",
      discountType: "amount",
    });

    setIsEditingProforma(false);
    setIsDetailsOpen(false);
    setIsDialogOpen(true);
  };


  return (
    <div className="container mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
              Proforma Invoices
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Manage proforma invoices and estimates
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Dismissing the dialog by any route — the X, Escape, a click on
                the overlay or the Cancel button below — leaves nothing behind.
                Radix only reports its own close triggers here, so the Cancel
                button and the post-submit path call resetForm themselves. */}
            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button onClick={openNewProformaDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Proforma Invoice
                </Button>
              </DialogTrigger>
              {/* No remount key here. It used to force a fresh mount per
                  proforma, but resetForm now runs on every dismiss and clears
                  the form, staged line, line-edit index and editing flag — so
                  the remount is redundant. It was also actively harmful:
                  resetForm flips isEditingProforma, which changed the key
                  mid-close and snapped the dialog shut instead of fading. */}
              <DialogContent
                className="sm:max-w-4xl max-h-[90vh] overflow-y-auto"
              >

                <DialogHeader>
                  <DialogTitle>
                    {isEditingProforma ? `Edit Proforma Invoice — ${selectedProforma?.proformaNumber || ""}` : "Create Proforma Invoice"}
                  </DialogTitle>
                  <DialogDescription>
                    {isEditingProforma
                      ? "Update the proforma invoice details below."
                      : "Fill in the details to create a new proforma invoice."}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customerId">Customer *</Label>
                      <Autocomplete
                        options={(customers || []).filter(customer => customer.id).map((customer) => ({
                          value: customer.id.toString(),
                          label: customer.name,
                          searchText: customer.name
                        }))}
                        value={formData.customerId?.toString() || ""}
                        onValueChange={(value) => {
                          const selectedCustomer = customers?.find(
                            (c) => c.id === parseInt(value)
                          );

                          const customerCurrency = selectedCustomer?.currency || "AED";
                          const vatTreatment = selectedCustomer?.vatTreatment || null;
                          const defaultTaxRate = vatTreatment === "standard" ? 5 : 0;

                          startTransition(() => {
                            setCustomerVatTreatment(vatTreatment);

                            setFormData((prev) => ({
                              ...prev,
                              customerId: parseInt(value),
                              billingAddress: selectedCustomer?.address || "",
                              currency: customerCurrency,
                              exchangeRate: customerCurrency === "AED" ? "1" : prev.exchangeRate,
                              // 🔹 optional: update existing items taxRate
                              items: prev.items.map(item => ({
                                ...item,
                                taxRate: defaultTaxRate,
                              })),
                            }));

                            // 🔹 update newItem default tax
                            setNewItem(prev => ({
                              ...prev,
                              taxRate: defaultTaxRate,
                            }));
                          });
                          if (customerCurrency && customerCurrency !== "AED") {
                            fetch('/api/exchange-rates/lookup?from=' + customerCurrency + '&to=AED')
                              .then(r => r.json())
                              .then(data => {
                                if (data.rate) {
                                  setFormData((prev) => ({
                                    ...prev,
                                    exchangeRate: String(data.rate),
                                  }));
                                }
                              })
                              .catch(() => { });
                          }
                        }}
                        placeholder="Search customer..."
                        emptyMessage="No customers found"
                      />
                      {formData.currency && formData.currency !== "AED" && (
                        <div className="text-sm text-muted-foreground mt-1">
                          Currency: {formData.currency} | Exchange Rate: {formData.exchangeRate} (to AED)
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="projectId">Project (Optional)</Label>
                      <Select
                        value={formData.projectId?.toString() || ""}
                        onValueChange={(value) =>
                          startTransition(() =>
                            setFormData((prev) => ({
                              ...prev,
                              projectId: value === "no-project" ? undefined : parseInt(value),
                            })),
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no-project">No Project</SelectItem>
                          {projects?.filter(project => project.id).map((project) => (
                            <SelectItem
                              key={project.id}
                              value={project.id.toString()}
                            >
                              {project.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="invoiceDate">Invoice Date *</Label>
                      <Input
                        id="invoiceDate"
                        type="date"
                        value={formData.invoiceDate || ""}
                        onChange={(e) =>
                          startTransition(() =>
                            setFormData((prev) => ({
                              ...prev,
                              invoiceDate: e.target.value,
                            })),
                          )
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="validUntil">Valid Until</Label>
                      <Input
                        id="validUntil"
                        type="date"
                        value={formData.validUntil || ""}
                        onChange={(e) =>
                          startTransition(() =>
                            setFormData((prev) => ({
                              ...prev,
                              validUntil: e.target.value,
                            })),
                          )
                        }
                        disabled
                      />
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    <Label htmlFor="subject">Subject Line</Label>
                    <Input
                      id="subject"
                      value={formData.subject || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          subject: e.target.value,
                        }))
                      }
                      placeholder="e.g., Quotation for Web Development"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="paymentTerms">Payment Terms</Label>
                      <Select
                        value={formData.paymentTerms || ""}
                        onValueChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            paymentTerms: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment terms" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Due on receipt">Due on receipt</SelectItem>
                          <SelectItem value="Net 10">Net 10</SelectItem>
                          <SelectItem value="Net 15">Net 15</SelectItem>
                          <SelectItem value="Net 30">Net 30</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="workOrderNumber">Work Order Number</Label>
                      <Input
                        id="workOrderNumber"
                        value={formData.workOrderNumber || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            workOrderNumber: e.target.value,
                          }))
                        }
                        placeholder="Enter work order number"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="deliveryTerms">Delivery Terms</Label>
                      <Input
                        id="deliveryTerms"
                        value={formData.deliveryTerms || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            deliveryTerms: e.target.value,
                          }))
                        }
                        placeholder="e.g., FOB, CIF"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="bankAccount">Bank Account</Label>
                        {company && (company.bankAccount || company.bankAccount2) && (
                          <div className="flex gap-2">
                            {company.bankAccount && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px] px-2"
                                onClick={() => setFormData(prev => ({ ...prev, bankAccount: company.bankAccount }))}
                              >
                                Use A/C 1
                              </Button>
                            )}
                            {company.bankAccount2 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px] px-2"
                                onClick={() => setFormData(prev => ({ ...prev, bankAccount: company.bankAccount2 }))}
                              >
                                Use A/C 2
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="mt-1 border border-input rounded-md overflow-hidden">
                        <ReactQuill
                          theme="snow"
                          value={formData.bankAccount || ""}
                          onChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              bankAccount: value,
                            }))
                          }
                          placeholder="Bank account for payment"
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
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="billingAddress">Billing Address</Label>
                    <textarea
                      id="billingAddress"
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={formData.billingAddress || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          billingAddress: e.target.value,
                        }))
                      }
                      placeholder="Billing address (auto-populated from customer)"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="termsAndConditions">Terms and Conditions</Label>
                    <textarea
                      id="termsAndConditions"
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={formData.termsAndConditions || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          termsAndConditions: e.target.value,
                        }))
                      }
                      placeholder="Terms and conditions for this proforma invoice"
                      rows={3}
                    />
                  </div>

                  {/* Items Section */}
                  <div className="space-y-4">
                    <Label className="text-base font-medium">Items</Label>
                    {/* Add Item Form */}
                    <Card ref={itemFormRef}>
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
                          <div className="md:col-span-2 lg:col-span-5">
                            <Label className="text-xs text-gray-600">Description</Label>
                            <Textarea
                              ref={descriptionRef}
                              rows={3}
                              placeholder="Item description"
                              value={newItem.description}
                              onChange={(e) =>
                                setNewItem((prev) => ({
                                  ...prev,
                                  description: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-600">Quantity</Label>
                            <Input
                              type="number"
                              placeholder="e.g. 1"
                              value={newItem.quantity}
                              onChange={(e) =>
                                setNewItem((prev) => ({
                                  ...prev,
                                  quantity: e.target.value === "" ? "" : parseInt(e.target.value),
                                }))
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-600">Unit Price</Label>
                            <Input
                              type="number"
                              step="any"
                              placeholder="0.00"
                              value={newItem.unitPrice}
                              onChange={(e) =>
                                setNewItem((prev) => ({
                                  ...prev,
                                  unitPrice: e.target.value === "" ? "" : parseFloat(e.target.value),
                                }))
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-600">Tax Rate (%)</Label>
                            <Input
                              type="number"
                              step="any"
                              placeholder="Tax %"
                              value={newItem.taxRate}
                              onChange={(e) =>
                                setNewItem((prev) => ({
                                  ...prev,
                                  taxRate: e.target.value === "" ? "" : parseFloat(e.target.value),
                                }))
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-600">Discount</Label>
                            <div className="flex gap-1">
                              <Input
                                type="number"
                                step="any"
                                placeholder="0.00"
                                value={newItem.discount}
                                onChange={(e) =>
                                  setNewItem((prev) => ({
                                    ...prev,
                                    discount: e.target.value === "" ? "" : parseFloat(e.target.value),
                                  }))
                                }
                              />
                              <select
                                className="border rounded px-2 text-sm bg-background"
                                value={newItem.discountType}
                                onChange={(e) =>
                                  setNewItem((prev) => ({
                                    ...prev,
                                    discountType: e.target.value as "amount" | "percentage",
                                  }))
                                }
                              >
                                <option value="amount">{formData.currency || "AED"}</option>
                                <option value="percentage">%</option>
                              </select>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col md:flex-row gap-2">
                          <Button
                            type="button"
                            onClick={addItem}
                            size="sm"
                            className="w-full md:w-auto"
                          >
                            {editingItemIndex === null ? (
                              <>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Item
                              </>
                            ) : (
                              <>
                                <Pencil className="h-4 w-4 mr-2" />
                                Update Item
                              </>
                            )}
                          </Button>
                          {editingItemIndex !== null && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={cancelEditItem}
                              className="w-full md:w-auto"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Cancel
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Items List */}
                    {formData.items.length > 0 && (
                      <Card>
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] table-fixed">
                              {/* Description takes whatever the fixed numeric
                                  columns leave, so long multi-line text has room. */}
                              <colgroup>
                                <col />
                                <col className="w-[70px]" />
                                <col className="w-[110px]" />
                                <col className="w-[90px]" />
                                <col className="w-[100px]" />
                                <col className="w-[120px]" />
                                <col className="w-[90px]" />
                              </colgroup>
                              <thead className="bg-gray-50 dark:bg-gray-900">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Description
                                  </th>
                                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Qty
                                  </th>
                                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Unit Price
                                  </th>
                                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Tax Rate
                                  </th>
                                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Discount
                                  </th>
                                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Total
                                  </th>
                                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Action
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {formData.items.map((item, index) => {
                                  const lineSubtotal = item.quantity * item.unitPrice;
                                  const lineDiscount = item.discountType === "percentage"
                                    ? lineSubtotal * ((Number(item.discount) || 0) / 100)
                                    : Math.min(Number(item.discount) || 0, lineSubtotal);
                                  const taxable = lineSubtotal - lineDiscount;
                                  const taxAmount = taxable * ((item.taxRate || 0) / 100);
                                  const lineTotal = taxable + taxAmount;

                                  return (
                                    <tr
                                      key={index}
                                      className={
                                        editingItemIndex === index
                                          ? "bg-blue-50 dark:bg-blue-950"
                                          : undefined
                                      }
                                    >
                                      <td className="px-4 py-3 text-sm whitespace-pre-wrap break-words">{item.description}</td>
                                      <td className="px-4 py-3 text-sm text-right">{item.quantity}</td>
                                      <td className="px-4 py-3 text-sm text-right">
                                        {formatCurrency(item.unitPrice, formData.currency)}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-right">
                                        {item.taxRate || 0}%
                                      </td>
                                      <td className="px-4 py-3 text-sm text-right">
                                        {Number(item.discount) > 0
                                          ? (item.discountType === "percentage"
                                              ? `${item.discount}%`
                                              : `${formData.currency || "AED"} ${(Number(item.discount)).toFixed(2)}`)
                                          : "-"}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-right font-medium">
                                        {formatCurrency(lineTotal, formData.currency)}
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            title="Edit item"
                                            aria-label="Edit item"
                                            data-testid={`button-edit-proforma-item-${index}`}
                                            onClick={() => startEditItem(index)}
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                            title={
                                              editingItemIndex !== null
                                                ? "Finish or cancel the current edit first"
                                                : "Remove item"
                                            }
                                            aria-label="Remove item"
                                            data-testid={`button-remove-proforma-item-${index}`}
                                            disabled={editingItemIndex !== null}
                                            onClick={() => removeItem(index)}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* Remarks */}
                  <div className="space-y-2">
                    <Label htmlFor="remarks">Remarks</Label>
                    <div className="mt-1 border border-input rounded-md overflow-hidden text-sm">
                      <ReactQuill
                        theme="snow"
                        value={formData.remarks || ""}
                        onChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            remarks: value,
                          }))
                        }
                        placeholder="Additional remarks or notes"
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

                  {/* Financial Summary */}
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
                              const calcDiscount = (proformaSubtotal * pct / 100);
                              setFormData(prev => ({ 
                                ...prev, 
                                discountPercentage: val, 
                                discount: val === "" ? "" : calcDiscount.toFixed(2)
                              }));
                            }}
                            placeholder="0.00"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="discountAmount">Discount Amount ({formData.currency})</Label>
                          <Input
                            id="discountAmount"
                            type="number"
                            min="0"
                            step="any"
                            value={formData.discount}
                            onChange={(e) => {
                              const val = e.target.value;
                              const amount = parseFloat(val) || 0;
                              const calcPct = proformaSubtotal > 0 ? ((amount / proformaSubtotal) * 100) : 0;
                              setFormData(prev => ({ 
                                ...prev, 
                                discount: val, 
                                discountPercentage: val === "" ? "" : calcPct.toFixed(2)
                              }));
                            }}
                            placeholder="0.00"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg p-4 border">
                      <h4 className="font-semibold mb-3 text-sm">Proforma Summary</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span className="font-medium">{formatCurrency(proformaTotals.gross, formData.currency)}</span>
                        </div>
                        {proformaTotals.discountTotal > 0 && (
                          <div className="flex justify-between text-sm text-red-600">
                            <span>Total Discount:</span>
                            <span className="font-medium">- {formatCurrency(proformaTotals.discountTotal, formData.currency)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Tax Amount:</span>
                          <span className="font-medium">{formatCurrency(proformaTotals.taxTotal, formData.currency)}</span>
                        </div>
                        <div className="border-t pt-2">
                          <div className="flex justify-between text-lg font-bold">
                            <span>Total Amount:</span>
                            <span className="text-blue-600">{formatCurrency(proformaTotals.total, formData.currency)}</span>
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

                  {/* Form Actions */}
                  <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsDialogOpen(false);
                        resetForm();
                      }}
                      className="w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createProformaMutation.isPending}
                      className="w-full sm:w-auto"
                    >
                      {createProformaMutation.isPending
                        ? isEditingProforma
                          ? "Updating..."
                          : "Creating..."
                        : isEditingProforma
                          ? "Update Proforma"
                          : "Create Proforma"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Total Proformas
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {proformaInvoices?.length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Approved
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {proformaInvoices?.filter(p => p.status === "approved").length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Pending
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {proformaInvoices?.filter(p => p.status === "draft" || p.status === "sent").length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <FileText className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Total Value
                </p>
                <div className="flex flex-col">
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {formatCurrency(
                      proformaInvoices?.reduce(
                        (sum, p) => sum + (parseFloat(p.totalAmount || "0") * parseFloat(p.exchangeRate || "1")),
                        0,
                      ) || 0,
                      "AED"
                    )}
                  </p>
                  <p className="text-xs text-slate-500 italic">AED Equivalent</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="statusFilter" className="text-sm font-medium">
                Filter by Status
              </Label>
              <Select
                value={statusFilter}
                onValueChange={(value) => startTransition(() => setStatusFilter(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              {/* <Label htmlFor="archivedFilter" className="text-sm font-medium">
                Archive Status
              </Label>
              <Select
                value={archivedFilter}
                onValueChange={(value) => startTransition(() => setArchivedFilter(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Proformas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Proformas</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="archived">Archived Only</SelectItem>
                </SelectContent>
              </Select> */}
            </div>
            {(statusFilter !== "all" || archivedFilter !== "active") && (
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    startTransition(() => {
                      setStatusFilter("all");
                      setArchivedFilter("active");
                    });
                  }}
                  className="w-full"
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Proforma Invoices List */}
      {proformaLoading ? (
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-400">Loading proforma invoices...</p>
        </div>
      ) : !proformaInvoices || proformaInvoices.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-16 w-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              No proforma invoices found
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              Create your first proforma invoice to get started
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Proforma
            </Button>
          </CardContent>
        </Card>
      ) : filteredProformas.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-16 w-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              No proforma invoices match your filters
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              Try adjusting your filters to see more results
            </p>
            <Button
              onClick={() => {
                startTransition(() => {
                  setStatusFilter("all");
                  setArchivedFilter("active");
                });
              }}
              variant="outline"
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {paginatedProformas.map((proforma) => (
            /* The whole card opens the detail dialog. role/tabIndex/onKeyDown
               keep it reachable without a mouse; every button inside stops
               propagation so acting on it does not also open the dialog. */
            <Card
              key={proforma.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              role="button"
              tabIndex={0}
              onClick={() => openDetails(proforma)}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) {
                  return;
                }
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openDetails(proforma);
                }
              }}
              data-testid={`row-proforma-${proforma.id}`}
            >
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-lg">{proforma.proformaNumber}</span>
                      {getStatusBadge(proforma.status)}
                      {proforma.isArchived && (
                        <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400">
                          <Archive className="h-3 w-3 mr-1" />
                          Archived
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Customer: {getCustomerName(proforma.customerId, proforma.customerName)}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-500">
                      Invoice Date: {formatDate(proforma.invoiceDate || proforma.createdDate)}
                      {proforma.validUntil && (
                        <> • Valid until: {formatDate(proforma.validUntil)}</>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="text-right">
                      <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(proforma.totalAmount || "0", proforma.currency)}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-500">
                        {proforma.items?.length || 0} item{(proforma.items?.length || 0) !== 1 ? "s" : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {proforma.status === "approved" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600 hover:text-green-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConvertToInvoice(proforma);
                          }}
                        >
                          <ArrowRightLeft className="h-4 w-4 mr-1" />
                          Convert to Invoice
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {filteredProformas.length > itemsPerPage && (
        <div className="flex justify-center mt-6">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage > 1) {
                      startTransition(() => setCurrentPage(currentPage - 1));
                    }
                  }}
                  className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <PaginationItem key={page}>
                  <PaginationLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      startTransition(() => setCurrentPage(page));
                    }}
                    isActive={page === currentPage}
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage < totalPages) {
                      startTransition(() => setCurrentPage(currentPage + 1));
                    }
                  }}
                  className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            {/* pr-8 keeps the buttons clear of the dialog's own X. Document
                actions (edit, duplicate, print) live up here; status-flow
                actions (approve, convert) stay in the footer. */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pr-8">
              <div>
                <DialogTitle>Proforma Invoice Details — {selectedProforma?.proformaNumber || ""}</DialogTitle>
                <DialogDescription>
                  View detailed information about this proforma invoice.
                </DialogDescription>
              </div>
              {selectedProforma && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (selectedProforma) {
                        const selectedCustomer = customers?.find(
                          (c) => c.id === selectedProforma.customerId
                        );

                        const vatTreatment = selectedCustomer?.vatTreatment || null;
                        const defaultTaxRate = vatTreatment === "standard" ? 5 : 0;

                        setCustomerVatTreatment(vatTreatment);
                        // Populate form with existing data
                        setSelectedProforma(selectedProforma);
                        setFormData({
                          customerId: selectedProforma.customerId,
                          subject: selectedProforma.subject || "",
                          projectId: selectedProforma.projectId,
                          quotationId: selectedProforma.quotationId,
                          invoiceDate: toInputDate(selectedProforma.invoiceDate),
                          validUntil: toInputDate(selectedProforma.validUntil),
                          paymentTerms: selectedProforma.paymentTerms || '',
                          deliveryTerms: selectedProforma.deliveryTerms || '',
                          bankAccount: selectedProforma.bankAccount || '',
                          billingAddress: selectedProforma.billingAddress || '',
                          termsAndConditions: selectedProforma.termsAndConditions || '',
                          remarks: selectedProforma.remarks || '',
                          items: selectedProforma.items || [],
                          discountPercentage: selectedProforma.discountPercentage || '0',
                          discount: selectedProforma.discount || '0',
                          currency: selectedProforma.currency || 'AED',
                          exchangeRate: selectedProforma.exchangeRate || '1',
                          workOrderNumber: selectedProforma.workOrderNumber || '',
                        });
                        // 🔹 ensure new item uses correct tax
                        setNewItem({
                          description: "",
                          quantity: "",
                          unitPrice: "",
                          taxRate: defaultTaxRate,
                          // Without these the Discount inputs would flip from
                          // controlled to uncontrolled and keep showing the
                          // previous line's value.
                          discount: "",
                          discountType: "amount",
                        });

                        setIsEditingProforma(true);
                        setIsDetailsOpen(false);
                        setIsDialogOpen(true);
                      }
                    }}
                    data-testid="button-edit-proforma-header"
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDuplicateProforma(selectedProforma)}
                    data-testid="button-duplicate-proforma-header"
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Duplicate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePrintPDF(selectedProforma)}
                    data-testid="button-print-proforma-header"
                  >
                    <Printer className="h-4 w-4 mr-1" />
                    Print
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>
          {selectedProforma ? (
            <div className="space-y-6">
              {/* Header Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Proforma Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="font-medium">Proforma Number:</span>
                      <span>{selectedProforma.proformaNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Work Order Number:</span>
                      <span>{selectedProforma.workOrderNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Status:</span>
                      <span>{getStatusBadge(selectedProforma.status)}</span>
                    </div>
                    {selectedProforma.rejectionReason && (
                      <div className="flex justify-between gap-4">
                        <span className="font-medium whitespace-nowrap">Rejection Reason:</span>
                        <span className="text-red-600 text-right whitespace-pre-wrap">{selectedProforma.rejectionReason}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="font-medium">Invoice Date:</span>
                      <span>{formatDate(selectedProforma.invoiceDate || selectedProforma.createdDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Created Date:</span>
                      <span>{formatDate(selectedProforma.createdDate)}</span>
                    </div>
                    {selectedProforma.validUntil && (
                      <div className="flex justify-between">
                        <span className="font-medium">Valid Until:</span>
                        <span>{formatDate(selectedProforma.validUntil)}</span>
                      </div>
                    )}
                    {selectedProforma.subject && (
                      <div>
                        <span className="font-medium">Subject Line:</span>
                        <p className="mt-1 text-slate-600 dark:text-slate-400">
                          {selectedProforma.subject}
                        </p>
                      </div>
                    )}
                    {selectedProforma.paymentTerms && (
                      <div className="flex justify-between">
                        <span className="font-medium">Payment Terms:</span>
                        <span>{selectedProforma.paymentTerms}</span>
                      </div>
                    )}
                    {selectedProforma.deliveryTerms && (
                      <div className="flex justify-between">
                        <span className="font-medium">Delivery Terms:</span>
                        <span>{selectedProforma.deliveryTerms}</span>
                      </div>
                    )}
                    {selectedProforma.workOrderNumber && (
                      <div className="flex justify-between">
                        <span className="font-medium">Work Order Number:</span>
                        <span>{selectedProforma.workOrderNumber}</span>
                      </div>
                    )}
                    {selectedProforma.bankAccount && (
                      <div>
                        <span className="font-medium">Bank Account:</span>
                        <div 
                          className="mt-1 text-slate-600 dark:text-slate-400 rich-text-content"
                          dangerouslySetInnerHTML={{ __html: sanitize(selectedProforma.bankAccount) }}
                        />
                      </div>
                    )}
                    {selectedProforma.billingAddress && (
                      <div>
                        <span className="font-medium">Billing Address:</span>
                        <p className="mt-1 text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                          {selectedProforma.billingAddress}
                        </p>
                      </div>
                    )}
                    {selectedProforma.termsAndConditions && (
                      <div>
                        <span className="font-medium">Terms and Conditions:</span>
                        <p className="mt-1 text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                          {selectedProforma.termsAndConditions}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Customer Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="font-medium">Customer:</span>
                      <span>{getCustomerName(selectedProforma.customerId, selectedProforma.customerName)}</span>
                    </div>
                    {(() => {
                      const customer = customers?.find((c) => c.id === selectedProforma.customerId);
                      return customer ? (
                        <>
                          {customer.email && (
                            <div className="flex justify-between">
                              <span className="font-medium">Email:</span>
                              <span>{customer.email}</span>
                            </div>
                          )}
                          {customer.phone && (
                            <div className="flex justify-between">
                              <span className="font-medium">Phone:</span>
                              <span>{customer.phone}</span>
                            </div>
                          )}
                          {customer.address && (
                            <div className="flex justify-between">
                              <span className="font-medium">Address:</span>
                              <span className="text-right">{customer.address}</span>
                            </div>
                          )}
                        </>
                      ) : null;
                    })()}
                    {selectedProforma.projectId && (
                      <div className="flex justify-between">
                        <span className="font-medium">Project:</span>
                        <span>
                          {projects?.find((p) => p.id === selectedProforma.projectId)?.title || "N/A"}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Items Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Items</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedProforma.items && selectedProforma.items.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-3 font-medium">Description</th>
                            <th className="text-right p-3 font-medium">Qty</th>
                            <th className="text-right p-3 font-medium">Unit Price</th>
                            <th className="text-right p-3 font-medium">Tax Rate</th>
                            <th className="text-right p-3 font-medium">Discount</th>
                            <th className="text-right p-3 font-medium">Line Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedProforma.items.map((item, index) => {
                            const lineSubtotal = item.quantity * item.unitPrice;
                            const lineDiscount = item.discountType === "percentage"
                              ? lineSubtotal * ((Number(item.discount) || 0) / 100)
                              : Math.min(Number(item.discount) || 0, lineSubtotal);
                            const taxable = lineSubtotal - lineDiscount;
                            const taxAmount = item.taxAmount !== undefined
                              ? parseFloat(item.taxAmount.toString())
                              : taxable * ((item.taxRate || 0) / 100);
                            const lineTotal = taxable + taxAmount;

                            return (
                              <tr key={index} className="border-b">
                                <td className="p-3 whitespace-pre-wrap break-words">{item.description}</td>
                                <td className="text-right p-3">{item.quantity}</td>
                                <td className="text-right p-3">{formatCurrency(item.unitPrice, selectedProforma.currency)}</td>
                                <td className="text-right p-3">{item.taxRate || 0}%</td>
                                <td className="text-right p-3">
                                  {Number(item.discount) > 0
                                    ? (item.discountType === "percentage"
                                        ? `${item.discount}%`
                                        : `${selectedProforma.currency || "AED"} ${(Number(item.discount)).toFixed(2)}`)
                                    : "-"}
                                </td>
                                <td className="text-right p-3 font-medium">{formatCurrency(lineTotal, selectedProforma.currency)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">No items found</p>
                  )}
                </CardContent>
              </Card>

              {/* Financial Summary */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 sm:p-6 print:bg-blue-50 print:border print:border-blue-300">
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-white print:text-black flex items-center gap-2">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  Financial Summary
                </h3>
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex justify-between items-center text-gray-700 dark:text-gray-300 print:text-black">
                    <span className="font-medium">Subtotal:</span>
                    <span className="text-lg font-semibold">{formatCurrency(selectedProforma.subtotal || "0", selectedProforma.currency)}</span>
                  </div>
                  {(() => {
                    // Total discount (header + line) derived from stored fields;
                    // equals discountTotal to the cent. The discount column
                    // itself holds only the header portion.
                    const totalDiscount =
                      parseFloat(selectedProforma.subtotal || "0") +
                      parseFloat(selectedProforma.taxAmount || "0") -
                      parseFloat(selectedProforma.totalAmount || "0");
                    return totalDiscount > 0.005 ? (
                      <div className="flex justify-between items-center text-gray-700 dark:text-gray-300 print:text-black">
                        <span className="font-medium">Total Discount:</span>
                        <span className="text-lg font-semibold text-red-600">- {formatCurrency(totalDiscount.toFixed(2), selectedProforma.currency)}</span>
                      </div>
                    ) : null;
                  })()}
                  <div className="flex justify-between items-center text-gray-700 dark:text-gray-300 print:text-black">
                    <span className="font-medium">Tax Amount:</span>
                    <span className="text-lg font-semibold">{formatCurrency(selectedProforma.taxAmount || "0", selectedProforma.currency)}</span>
                  </div>
                  <div className="border-t border-gray-300 dark:border-gray-600 print:border-gray-400 pt-3 flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900 dark:text-white print:text-black">Total Amount:</span>
                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 print:text-blue-600">{formatCurrency(selectedProforma.totalAmount || "0", selectedProforma.currency)}</span>
                  </div>
                  {selectedProforma.currency && selectedProforma.currency !== "AED" && (
                    <div className="text-xs text-muted-foreground mt-2 text-right">
                      Exchange Rate: 1 {selectedProforma.currency} = {selectedProforma.exchangeRate} AED
                      <br />
                      AED Equivalent: AED {(parseFloat(selectedProforma.totalAmount || "0") * parseFloat(selectedProforma.exchangeRate || "1")).toFixed(2)}
                    </div>
                  )}
                </div>
              </div>

              {/* Remarks */}
              {selectedProforma.remarks && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Remarks</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div 
                      className="text-sm rich-text-content"
                      dangerouslySetInnerHTML={{ __html: sanitize(selectedProforma.remarks) }}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons — status-flow only; document actions
                  (edit, duplicate, print) live in the header. */}
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                {selectedProforma && (selectedProforma.status === "draft" || selectedProforma.status === "sent") && (
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleApproveProforma(selectedProforma)}
                    disabled={approveProformaMutation.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {approveProformaMutation.isPending ? "Approving..." : "Approve"}
                  </Button>
                )}
                {selectedProforma && (selectedProforma.status === "draft" || selectedProforma.status === "sent") && (
                  <Button
                    variant="destructive"
                    onClick={() => handleRejectProforma(selectedProforma)}
                    disabled={rejectProformaMutation.isPending}
                    data-testid="button-reject-proforma"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                )}
                {selectedProforma && selectedProforma.status === "approved" && (
                  <Button
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => handleConvertToInvoice(selectedProforma)}
                    disabled={convertToInvoiceMutation.isPending}
                  >
                    <ArrowRightLeft className="h-4 w-4 mr-1" />
                    {convertToInvoiceMutation.isPending ? "Converting..." : "Convert to Invoice"}
                  </Button>
                )}
                <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <p>No proforma invoice selected.</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Convert to Invoice Dialog */}
      <Dialog open={isConvertDialogOpen} onOpenChange={setIsConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to Sales Invoice</DialogTitle>
            <DialogDescription>
              Are you sure you want to convert this proforma invoice to a sales invoice? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {convertingProforma && (
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <h4 className="font-medium">Proforma Invoice Details:</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Number: {convertingProforma.proformaNumber}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Customer: {getCustomerName(convertingProforma.customerId, convertingProforma.customerName)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Amount: {formatCurrency(convertingProforma.totalAmount || "0", convertingProforma.currency)}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsConvertDialogOpen(false)}
                  disabled={convertToInvoiceMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmConvertToInvoice}
                  disabled={convertToInvoiceMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {convertToInvoiceMutation.isPending ? "Converting..." : "Convert to Invoice"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Proforma Invoice</DialogTitle>
            <DialogDescription>
              {rejectingProforma
                ? `${rejectingProforma.proformaNumber} will be marked as rejected.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rejectionReason">Reason for Rejection</Label>
              <Textarea
                id="rejectionReason"
                placeholder="Please provide a reason for rejecting this proforma invoice..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                data-testid="input-rejection-reason"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsRejectDialogOpen(false)}
                disabled={rejectProformaMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmRejectProforma}
                disabled={rejectProformaMutation.isPending}
                data-testid="button-confirm-reject-proforma"
              >
                <XCircle className="h-4 w-4 mr-1" />
                {rejectProformaMutation.isPending ? "Rejecting..." : "Reject"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}