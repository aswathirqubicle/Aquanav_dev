import { useEffect, useRef, useState, startTransition } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Autocomplete } from "@/components/ui/autocomplete";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { apiRequest } from "@/lib/queryClient";
import { printByUrl } from "@/lib/print-utils";
import { formatDateForInput } from "@/lib/utils";
import { sanitize } from "@/lib/sanitize";
import { EditHistoryTab } from "@/components/documents/EditHistoryTab";
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
  Printer,
  Copy,
  Pencil,
  Trash2,
  X,
  History,
  ChevronDown,
  ChevronUp,
  Filter,
  Send,
  ArrowRightLeft,
  CreditCard,
  Building2,
  DollarSign,
  AlignLeft,
  Package,
} from "lucide-react";
import {
  SalesQuotation,
  Customer,
  Company,
  insertSalesQuotationSchema,
} from "@shared/schema";
import { z } from "zod";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  DOC_CARD,
  DOC_CARD_HEAD,
  DOC_CARD_TITLE,
  DOC_CARD_ICON,
  DOC_CARD_BODY,
  DOC_ACC_TRIGGER,
  DOC_ACC_BODY,
  DOC_KV_ROW,
  DOC_KV_LABEL,
  DOC_KV_VAL,
  DOC_META_LABEL,
  DOC_META_VALUE,
  DOC_META_CELL,
  DOC_TH,
  DOC_TD,
  DOC_TDN,
  DOC_TROW,
  DOC_BTN,
  DOC_COUNT,
  DOC_PROSE,
  DOC_STAMP,
  DOC_TIMELINE,
  DOC_DOT,
  docStatusTone,
  docTotals,
  formatCurrency,
  formatAmount,
  formatDate,
} from "./shared";

const createSalesQuotationSchema = insertSalesQuotationSchema.extend({
  validUntil: z.string().optional(),
  items: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
        taxRate: z.number().optional(),
        taxAmount: z.number().optional(),
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

type CreateSalesQuotationData = z.infer<typeof createSalesQuotationSchema>;


interface QuotationItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  taxAmount?: number;
  discount?: number;
  discountType?: "amount" | "percentage";
}

export default function SalesQuotationsPage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] =
    useState<SalesQuotation | null>(null);
  const [isQuotationDetailsOpen, setIsQuotationDetailsOpen] = useState(false);
  const [isEditingQuotation, setIsEditingQuotation] = useState(false);
  const [quotationEditNote, setQuotationEditNote] = useState("");
  // An edit note is only required once the quotation has been through approval;
  // draft and pending_approval are still being drafted. This mirrors the server
  // gate in sales-quotations.routes.ts — the server is the boundary, this just
  // avoids showing a mandatory field that isn't.
  const quotationEditRequiresNote =
    isEditingQuotation &&
    (selectedQuotation?.status === "approved" ||
      selectedQuotation?.status === "rejected");
  const [isQuotationRejectDialogOpen, setIsQuotationRejectDialogOpen] = useState(false);
  const [quotationRejectionReason, setQuotationRejectionReason] = useState("");
  const [isQuotationCancelDialogOpen, setIsQuotationCancelDialogOpen] = useState(false);
  const [quotationCancellationReason, setQuotationCancellationReason] = useState("");
  // Filter panel open/close
  const [quotationFilterOpen, setQuotationFilterOpen] = useState(false);

  // Quotation filters
  const [searchFilter, setSearchFilter] = useState<string>("");
  const debouncedSearchFilter = useDebounce(searchFilter, 500);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [archivedFilter, setArchivedFilter] = useState<string>("active");
  const [startDateFilter, setStartDateFilter] = useState<string>("");
  const [endDateFilter, setEndDateFilter] = useState<string>("");
  // Activity block in each view dialog: collapsed on open, and which tab is
  // showing once expanded. Collapsed by default keeps the dialog to the
  // document itself; the payment and edit-history requests are gated on the
  // matching tab, so opening a dialog costs no extra fetch.
  const [quotationActivityOpen, setQuotationActivityOpen] = useState(false);
  const [quotationActivityTab, setQuotationActivityTab] = useState("approval");

  const [formData, setFormData] = useState<CreateSalesQuotationData>({
    customerId: undefined,
    status: "draft",
    createdDate: formatDateForInput(new Date()),
    validUntil: formatDateForInput(new Date()),
    items: [],
    discountPercentage: "0",
    discount: "0",
    currency: "AED",
    exchangeRate: "1",
    remarks: "",
    subject: "",
    paymentTerms: "",
    bankAccount: "",
    billingAddress: "",
    termsAndConditions: "",
  });

  const [customerVatTreatment, setCustomerVatTreatment] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<{
    description: string;
    quantity: number | "";
    unitPrice: number | "";
    taxRate: number | "";
    taxAmount: number;
    discount: number | "";
    discountType: "amount" | "percentage";
  }>({
    description: "",
    // Quantity, unit price and discount start blank so the guidance sits in the
    // placeholder rather than as a value someone has to clear. Tax rate is the
    // exception — it is auto-filled from the customer's VAT treatment.
    quantity: "",
    unitPrice: "",
    taxRate: 0,
    taxAmount: 0,
    discount: "",
    discountType: "amount",
  });

  // Index of the line being edited, or null when the form is adding a new one.
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const quotationItemFormRef = useRef<HTMLDivElement>(null);
  const quotationDescriptionRef = useRef<HTMLTextAreaElement>(null);

  // Bring the staging form into view and put the cursor in Description, so
  // clicking Edit on a row far down the table doesn't leave the form off-screen.
  const focusItemForm = (
    cardRef: React.RefObject<HTMLDivElement>,
    descriptionRef: React.RefObject<HTMLTextAreaElement>,
  ) => {
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    window.setTimeout(() => descriptionRef.current?.focus(), 0);
  };

  // Never carry a half-finished line edit across a dialog open or close. This
  // keys off the open state rather than the dialog's onOpenChange because Radix
  // only fires that for its own triggers (Escape, overlay, close button) — the
  // programmatic setIsDialogOpen calls in the duplicate, edit and post-submit
  // paths would otherwise leave the index pointing at a row that is gone.
  // Only reset when an edit was actually abandoned: clearing the index alone
  // would leave that row's values sitting in the staging form, so the next
  // "Add Service" would append a duplicate of it. A half-typed NEW item is
  // left untouched.
  useEffect(() => {
    if (editingItemIndex !== null) {
      cancelEditItem();
    }
  }, [isDialogOpen]);

  // Reset each view dialog's Activity block when it closes, so the next
  // document opens with it collapsed on the Approval tab. Keyed on the open
  // flag rather than done in onOpenChange because most close paths — the Close
  // button, Edit, Record Payment, Reject — call the setter directly and never
  // reach Radix's onOpenChange.
  useEffect(() => {
    if (!isQuotationDetailsOpen) {
      setQuotationActivityOpen(false);
      setQuotationActivityTab("approval");
    }
  }, [isQuotationDetailsOpen]);

  // Pagination state
  const [quotationsCurrentPage, setQuotationsCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    } else if (user?.role !== "admin" && user?.role !== "finance") {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user, setLocation]);

  const { data: company } = useQuery<Company>({
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

  // Recalculate quotation discount when items or percentage changes
  const quotationSubtotal = formData.items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);

  const quotationTotals = docTotals(
    formData.items,
    formData.discountPercentage,
    formData.discount,
  );


  // Recalculate quotation discount when items or percentage changes
  useEffect(() => {
    const pct = parseFloat(formData.discountPercentage || "0") || 0;
    // No percentage set means the discount was entered as an amount. That value
    // is the user's own and must never be recalculated from a percentage.
    if (pct <= 0) return;
    const calcDiscountValue = quotationSubtotal * pct / 100;
    const currentDiscountValue = parseFloat(formData.discount || "0");

    // Only update if the difference is more than a small epsilon to avoid loop/jumping
    if (Math.abs(currentDiscountValue - calcDiscountValue) > 0.001) {
      setFormData(prev => ({ ...prev, discount: calcDiscountValue.toFixed(2) }));
    }
  }, [quotationSubtotal, formData.discountPercentage]);


  // Recalculate quotation validUntil when paymentTerms or createdDate changes
  useEffect(() => {
    if (isEditingQuotation || !formData.paymentTerms || !formData.createdDate) return;

    const baseDate = new Date(formData.createdDate);
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
    const validUntilString = validUntilDate.toISOString().split('T')[0];

    if (formData.validUntil !== validUntilString) {
      setFormData(prev => ({
        ...prev,
        validUntil: validUntilString
      }));
    }
  }, [formData.paymentTerms, formData.createdDate, isEditingQuotation]);

  const { data: salesStats } = useQuery<{
    totalQuotations: number;
    totalInvoices: number;
    totalQuotationValue: string;
    totalInvoiceValue: string;
    totalReceivablesValue: string;
  }>({
    queryKey: ["/api/sales/stats"],
    enabled: isAuthenticated,
  });

  const { data: quotationsResponse, isLoading: quotationsLoading } = useQuery<{
    data: SalesQuotation[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: [
      "/api/sales-quotations",
      {
        page: quotationsCurrentPage,
        limit: itemsPerPage,
        search: debouncedSearchFilter,
        status: statusFilter,
        customerId: customerFilter !== "all" ? customerFilter : undefined,
        archived: archivedFilter === "archived" ? "true" : archivedFilter === "active" ? "false" : undefined,
        startDate: startDateFilter,
        endDate: endDateFilter,
      },
    ],
    queryFn: async ({ queryKey }) => {
      const [_base, params] = queryKey as [string, any];
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          searchParams.append(key, value.toString());
        }
      });
      const response = await apiRequest(`${_base}?${searchParams.toString()}`);
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const quotations = quotationsResponse?.data || [];

  const { data: customersResponse } = useQuery<{
    data: any[];
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

  const customers = customersResponse?.data;

  const { data: quotationEditHistory } = useQuery<any[]>({
    queryKey: ["/api/sales-quotations", selectedQuotation?.id, "edit-history"],
    queryFn: async () => {
      const response = await apiRequest(`/api/sales-quotations/${selectedQuotation?.id}/edit-history`, { method: "GET" });
      if (!response.ok) return [];
      return response.json();
    },
    enabled:
      isAuthenticated &&
      !!selectedQuotation &&
      quotationActivityOpen &&
      quotationActivityTab === "history" &&
      (user?.role === "admin" || user?.role === "finance"),
  });

  const createQuotationMutation = useMutation({
    mutationFn: async (data: CreateSalesQuotationData) => {
      // Through the shared engine, the same way the summary panel above and the
      // server both do it. This used to charge tax on the gross and ignore line
      // discounts, so it disagreed with the figures on screen and with what the
      // server stored — the server recomputes and overwrites these anyway, but
      // the zero-total guard below was reading the wrong number.
      const totals = docTotals(
        data.items,
        data.discountPercentage,
        data.discount,
      );
      const subtotal = totals.gross;
      const discountAmount = totals.headerDiscount;
      const taxAmount = totals.taxTotal;
      const totalAmount = totals.total;
      // 🚨 VALIDATION
      if (totalAmount <= 0) {
        throw new Error("Total amount must be greater than zero");
      }
      const processedData = {
        ...data,
        customerId: data.customerId
          ? parseInt(data.customerId.toString())
          : undefined,
        validUntil: data.validUntil && data.validUntil !== "" ? new Date(data.validUntil).toISOString() : null,
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        discountPercentage: data.discountPercentage || "0",
        discount: discountAmount.toFixed(2),
        // The note rides on the update only — a brand new quotation has no
        // prior version to explain, and the create route would carry the field
        // straight into the insert.
        ...(isEditingQuotation
          ? { editNote: quotationEditNote.trim() }
          : {}),
      };

      const url =
        isEditingQuotation && selectedQuotation
          ? `/api/sales-quotations/${selectedQuotation.id}`
          : "/api/sales-quotations";
      const method = isEditingQuotation ? "PUT" : "POST";

      const response = await apiRequest(url, {
        method,
        body: processedData,
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-quotations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales-quotations", selectedQuotation?.id, "edit-history"] });
      toast({
        title: isEditingQuotation ? "Quotation Updated" : "Quotation Created",
        description: `The sales quotation has been ${isEditingQuotation ? "updated" : "created"} successfully.`,
      });
      setIsDialogOpen(false);
      setIsEditingQuotation(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description:
          error.message ||
          `Failed to ${isEditingQuotation ? "update" : "create"} quotation`,
        variant: "destructive",
      });
    },
  });

  const submitQuotationMutation = useMutation({
    mutationFn: async (quotationId: number) => {
      const response = await apiRequest(
        `/api/sales-quotations/${quotationId}/submit`,
        {
          method: "PATCH",
          body: {},
        },
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-quotations"] });
      toast({
        title: "Quotation Submitted",
        description: "The sales quotation has been submitted for approval.",
      });
      // Same snapshot problem as approve: the dialog would keep showing the
      // quotation as a draft with a live Submit button.
      setSelectedQuotation(null);
      setIsQuotationDetailsOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit quotation",
        variant: "destructive",
      });
    },
  });

  const approveQuotationMutation = useMutation({
    mutationFn: async (quotationId: number) => {
      const response = await apiRequest(
        `/api/sales-quotations/${quotationId}/approve`,
        {
          method: "PATCH",
          body: {},
        },
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-quotations"] });
      toast({
        title: "Quotation Approved",
        description: "The sales quotation has been approved successfully.",
      });
      setIsQuotationDetailsOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve quotation",
        variant: "destructive",
      });
    },
  });

  const rejectQuotationMutation = useMutation({
    mutationFn: async ({ quotationId, reason }: { quotationId: number; reason: string }) => {
      const response = await apiRequest(
        `/api/sales-quotations/${quotationId}/reject`,
        {
          method: "PATCH",
          body: { reason },
        },
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-quotations"] });
      toast({
        title: "Quotation Rejected",
        description: "The sales quotation has been rejected.",
        variant: "destructive",
      });
      setIsQuotationRejectDialogOpen(false);
      setQuotationRejectionReason("");
      setSelectedQuotation(null);
      setIsQuotationDetailsOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject quotation",
        variant: "destructive",
      });
    },
  });

  // Withdrawing an approved quotation. Shaped like the reject mutation above —
  // the server takes the reason and decides the status, and refuses anything
  // that is not approved.
  const cancelQuotationMutation = useMutation({
    mutationFn: async ({
      quotationId,
      cancellationReason,
    }: {
      quotationId: number;
      cancellationReason: string;
    }) => {
      const response = await apiRequest(
        `/api/sales-quotations/${quotationId}/cancel`,
        {
          method: "PATCH",
          body: { cancellationReason },
        },
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-quotations"] });
      toast({
        title: "Quotation Cancelled",
        description: "The sales quotation has been cancelled.",
      });
      setIsQuotationCancelDialogOpen(false);
      setQuotationCancellationReason("");
      setSelectedQuotation(null);
      setIsQuotationDetailsOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Cannot Cancel Quotation",
        description: error.message || "Failed to cancel quotation",
        variant: "destructive",
      });
    },
  });

  const archiveQuotationMutation = useMutation({
    mutationFn: async (quotationId: number) => {
      const response = await apiRequest(
        `/api/sales-quotations/${quotationId}/archive`,
        {
          method: "PUT",
        },
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-quotations"] });
      toast({
        title: "Quotation Archived",
        description: "The sales quotation has been archived successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to archive quotation",
        variant: "destructive",
      });
    },
  });

  const unarchiveQuotationMutation = useMutation({
    mutationFn: async (quotationId: number) => {
      const response = await apiRequest(
        `/api/sales-quotations/${quotationId}/unarchive`,
        {
          method: "PUT",
        },
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-quotations"] });
      toast({
        title: "Quotation Unarchived",
        description: "The sales quotation has been unarchived successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unarchive quotation",
        variant: "destructive",
      });
    },
  });

  const openNewQuotationDialog = () => {
    resetForm();              // clears form + editing state
    setIsDialogOpen(true);    // then open dialog
  };

  const resetForm = () => {
    setFormData({
      customerId: undefined,
      status: "draft",
      createdDate: formatDateForInput(new Date()),
      validUntil: formatDateForInput(new Date()),
      items: [],
      discountPercentage: "0",
      discount: "0",
      currency: "AED",
      exchangeRate: "1",
      remarks: "",
      subject: "",
      paymentTerms: "",
      bankAccount: "",
      billingAddress: "",
      termsAndConditions: "",
    });

    setNewItem({
      description: "",
      quantity: "",
      unitPrice: "",
      taxRate: 0,     // will be fixed by useEffect
      taxAmount: 0,
      discount: "",
      discountType: "amount",
    });

    setEditingItemIndex(null);
    setIsEditingQuotation(false);
    setSelectedQuotation(null);
    setQuotationEditNote("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.items.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item to the quotation",
        variant: "destructive",
      });
      return;
    }
    if (quotationEditRequiresNote && !quotationEditNote.trim()) {
      toast({
        title: "Error",
        description: "Please provide an edit note",
        variant: "destructive",
      });
      return;
    }
    const processedFormData = {
      ...formData,
      items: formData.items.map(item => ({
        ...item,
        quantity: typeof item.quantity === 'string' ? parseFloat(item.quantity) || 0 : item.quantity,
        unitPrice: typeof item.unitPrice === 'string' ? parseFloat(item.unitPrice) || 0 : item.unitPrice,
        taxRate: typeof item.taxRate === 'string' ? parseFloat(item.taxRate) || 0 : item.taxRate,
      }))
    };
    createQuotationMutation.mutate(processedFormData as any);
  };

  const addItem = () => {
    if (!newItem.description.trim()) {
      toast({
        title: "Error",
        description: "Please enter a service description",
        variant: "destructive",
      });
      return;
    }

    // Quantity and unit price are required: the fields now start blank, so a
    // missing one would otherwise be committed as a silent zero-value line.
    const quantity = newItem.quantity === "" ? NaN : Number(newItem.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast({
        title: "Error",
        description: "Please enter a quantity greater than zero",
        variant: "destructive",
      });
      return;
    }

    const unitPrice = newItem.unitPrice === "" ? NaN : Number(newItem.unitPrice);
    if (!Number.isFinite(unitPrice)) {
      toast({
        title: "Error",
        description: "Please enter a unit price",
        variant: "destructive",
      });
      return;
    }

    // Tax rate and discount are optional — blank means zero.
    const taxRate = newItem.taxRate === "" ? 0 : Number(newItem.taxRate) || 0;
    const discount = newItem.discount === "" ? 0 : Number(newItem.discount) || 0;
    const discountType = newItem.discountType;

    const lineSubtotal = quantity * unitPrice;
    const lineDiscount =
      discountType === "percentage"
        ? lineSubtotal * (discount / 100)
        : Math.min(discount, lineSubtotal);
    const calculatedTaxAmount = (lineSubtotal - lineDiscount) * (taxRate / 100);

    const item = {
      description: newItem.description,
      quantity,
      unitPrice,
      taxRate,
      taxAmount: calculatedTaxAmount,
      discount,
      discountType,
    };

    setFormData(prev => ({
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
      taxRate: customerVatTreatment === "standard" ? 5 : 0, // keep VAT for next item
      taxAmount: 0,
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
      taxAmount: item.taxAmount ?? 0,
      discount: Number(item.discount) || 0,
      discountType: item.discountType === "percentage" ? "percentage" : "amount",
    });
    setEditingItemIndex(index);
    focusItemForm(quotationItemFormRef, quotationDescriptionRef);
  };

  const cancelEditItem = () => {
    setNewItem({
      description: "",
      quantity: "",
      unitPrice: "",
      taxRate: customerVatTreatment === "standard" ? 5 : 0,
      taxAmount: 0,
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

  if (
    !isAuthenticated ||
    (user?.role !== "admin" && user?.role !== "finance")
  ) {
    return null;
  }

  const getQuotationStatusBadge = (status: string) => {
    const statusConfig = {
      draft: {
        icon: Clock,
        class:
          "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400",
        label: "Draft",
      },
      pending_approval: {
        icon: AlertTriangle,
        class:
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
        label: "Pending Approval",
      },
      sent: {
        icon: AlertTriangle,
        class:
          "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
        label: "Sent",
      },
      approved: {
        icon: CheckCircle,
        class:
          "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
        label: "Approved",
      },
      rejected: {
        icon: XCircle,
        class: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
        label: "Rejected",
      },
      converted: {
        icon: CheckCircle,
        class:
          "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400",
        label: "Converted",
      },
      cancelled: {
        icon: XCircle,
        class:
          "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400",
        label: "Cancelled",
      },
    };

    const config =
      statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    const Icon = config.icon;

    return (
      <Badge className={config.class}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const totalQuotationValue = parseFloat(salesStats?.totalQuotationValue || "0");

  const getCustomerName = (customerId: number, customerName?: string) => {
    // If customerName is provided (from invoice data), use it
    if (customerName) {
      return customerName;
    }
    // Fallback to looking up in customers array
    const customer = customers?.find((c) => c.id === customerId);
    return customer?.name || "Unknown Customer";
  };


  const openQuotationDetails = (quotation: SalesQuotation) => {
    setSelectedQuotation(quotation);
    setIsQuotationDetailsOpen(true);
  };


  const handleEditQuotation = (quotation?: SalesQuotation) => {
    if (quotation) {
      setSelectedQuotation(quotation);
      setFormData({
        customerId: quotation.customerId,
        status: quotation.status,
        createdDate: formatDateForInput(quotation.createdDate),
        validUntil: formatDateForInput(quotation.validUntil),
        items: quotation.items || [],
        discountPercentage: quotation.discountPercentage || "0",
        discount: quotation.discount || "0",
        subtotal: quotation.subtotal || "0",
        taxAmount: quotation.taxAmount || "0",
        totalAmount: quotation.totalAmount || "0",
        subject: quotation.subject || "",
        paymentTerms: quotation.paymentTerms || "",
        bankAccount: quotation.bankAccount || "",
        billingAddress: quotation.billingAddress || "",
        termsAndConditions: quotation.termsAndConditions || "",
        remarks: quotation.remarks || "",
        currency: quotation.currency || "AED",
        exchangeRate: quotation.exchangeRate || "1",
      });
      setQuotationEditNote("");
      setIsEditingQuotation(true);
      setIsQuotationDetailsOpen(false);
      setIsDialogOpen(true);
    }
  };

  const handleDuplicateQuotation = (quotation?: SalesQuotation) => {
    if (quotation) {
      setFormData({
        customerId: quotation.customerId,
        status: "draft",
        validUntil: formatDateForInput(quotation.validUntil),
        items: quotation.items || [],
        discount: quotation.discount || "0",
        discountPercentage: quotation.discountPercentage || "0",
        subtotal: quotation.subtotal || "0",
        taxAmount: quotation.taxAmount || "0",
        totalAmount: quotation.totalAmount || "0",
        subject: quotation.subject || "",
        paymentTerms: quotation.paymentTerms || "",
        bankAccount: quotation.bankAccount || "",
        billingAddress: quotation.billingAddress || "",
        termsAndConditions: quotation.termsAndConditions || "",
        remarks: quotation.remarks || "",
        currency: quotation.currency || "AED",
        exchangeRate: quotation.exchangeRate || "1",
      });
      setIsEditingQuotation(false);
      setIsQuotationDetailsOpen(false);
      setIsDialogOpen(true);
    }
  };

  const handlePrintPDF = async (quotation: SalesQuotation) => {
    try {
      await printByUrl(`/api/sales-quotations/${quotation.id}/pdf`);

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

  // Conversion hands the quotation to the invoice page rather than opening an
  // invoice dialog here — the two used to live in one component. The invoice
  // page reads the id, loads the quotation and pre-fills its create form with
  // exactly the same fields this copied across before the split.
  //
  // It stays a pre-fill and not a server-side conversion on purpose: the
  // quotation is only marked converted once an invoice is actually created
  // (see sales-invoices.routes.ts), so abandoning the form leaves it billable.
  const handleConvertToInvoice = (quotation: SalesQuotation) => {
    setLocation(`/sales-invoices?fromQuotation=${quotation.id}`);
  };

  const totalQuotationsPages = quotationsResponse?.pagination?.totalPages || 1;
  const paginatedQuotations = quotations;

  useEffect(() => {
    setQuotationsCurrentPage(1);
  }, [debouncedSearchFilter, statusFilter, customerFilter, archivedFilter, startDateFilter, endDateFilter]);

  useEffect(() => {
    if (!formData.customerId || !customers) return;

    const customer = customers.find(c => c.id === formData.customerId);
    const vatTreatment = customer?.vatTreatment ?? null;
    const taxRate = vatTreatment === "standard" ? 5 : 0;

    // VAT state (for display / logic)
    setCustomerVatTreatment(vatTreatment);

    // Default VAT for NEW items
    setNewItem(prev => ({
      ...prev,
      taxRate,
    }));

    // OPTIONAL: update EXISTING items
    // setFormData(prev => ({
    //   ...prev,
    //   items: prev.items.map(item => ({
    //     ...item,
    //     taxRate,
    //     taxAmount: item.quantity * item.unitPrice * (taxRate / 100),
    //   })),
    // }));
  }, [formData.customerId, customers]);

  return (
    <div className="container mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
              Sales Quotations
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Create and manage customer quotations
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button
                  className="w-full sm:w-auto"
                  onClick={openNewQuotationDialog}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Quotation
                </Button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {isEditingQuotation
                      ? `Edit Sales Quotation — ${selectedQuotation?.quotationNumber}`
                      : "Create Sales Quotation"}
                  </DialogTitle>
                  <DialogDescription>
                    {isEditingQuotation
                      ? "Update the sales quotation details below."
                      : "Fill in the details to create a new sales quotation."}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customerId">Customer *</Label>
                      <Autocomplete
                        options={(customers || []).map((customer) => ({
                          value: customer.id.toString(),
                          label: customer.name,
                          searchText: `${customer.name} ${customer.email || ""} ${customer.phone || ""}`
                        }))}
                        value={formData.customerId?.toString() || ""}
                        onValueChange={(value) => {
                          const customerId = parseInt(value);
                          const selectedCustomer = customers?.find(c => c.id === customerId);
                          const customerCurrency = selectedCustomer?.currency || "AED";
                          startTransition(() => {
                            setFormData(prev => ({
                              ...prev,
                              customerId,
                              billingAddress: selectedCustomer?.address || "",
                              currency: customerCurrency,
                              exchangeRate: customerCurrency === "AED" ? "1" : prev.exchangeRate,
                            }));
                          });
                          if (customerCurrency && customerCurrency !== "AED") {
                            fetch(`/api/exchange-rates/lookup?from=${customerCurrency}&to=AED`)
                              .then(res => res.json())
                              .then(data => {
                                if (data.rate) {
                                  setFormData(prev => ({
                                    ...prev,
                                    exchangeRate: data.rate.toString(),
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
                      <Label htmlFor="createdDate">Quotation Date</Label>
                      <Input
                        id="createdDate"
                        type="date"
                        value={formData.createdDate || ""}
                        onChange={(e) =>
                          startTransition(() =>
                            setFormData((prev) => ({
                              ...prev,
                              createdDate: e.target.value,
                            })),
                          )
                        }
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
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject Line</Label>
                    <Input
                      id="subject"
                      value={formData.subject || ""}
                      onChange={(e) =>
                        startTransition(() =>
                          setFormData((prev) => ({
                            ...prev,
                            subject: e.target.value,
                          })),
                        )
                      }
                      placeholder="Enter quotation subject"
                    />
                  </div>

                  {/* Payment Details Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="paymentTerms">Payment Terms</Label>
                      <Select
                        value={formData.paymentTerms || ""}
                        onValueChange={(value) =>
                          startTransition(() =>
                            setFormData((prev) => ({
                              ...prev,
                              paymentTerms: value,
                            })),
                          )
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
                            startTransition(() =>
                              setFormData((prev) => ({
                                ...prev,
                                bankAccount: value,
                              })),
                            )
                          }
                          placeholder="Bank account details"
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
                        startTransition(() =>
                          setFormData((prev) => ({
                            ...prev,
                            billingAddress: e.target.value,
                          })),
                        )
                      }
                      placeholder="Billing address (auto-populated from customer)"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="termsAndConditions">Terms & Conditions</Label>
                    <textarea
                      id="termsAndConditions"
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={formData.termsAndConditions || ""}
                      onChange={(e) =>
                        startTransition(() =>
                          setFormData((prev) => ({
                            ...prev,
                            termsAndConditions: e.target.value,
                          })),
                        )
                      }
                      placeholder="Enter terms and conditions for this quotation"
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="remarks">Notes</Label>
                    <div className="mt-1 border border-input rounded-md overflow-hidden text-sm">
                      <ReactQuill
                        theme="snow"
                        value={formData.remarks || ""}
                        onChange={(value) =>
                          startTransition(() =>
                            setFormData((prev) => ({
                              ...prev,
                              remarks: value,
                            })),
                          )
                        }
                        placeholder="Additional notes for this quotation"
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

                  {/* Services Section */}
                  <div className="space-y-4">
                    <Label className="text-base font-medium">Services</Label>

                    {/* Add Service Form */}
                    <Card ref={quotationItemFormRef}>
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                          <div className="md:col-span-2 lg:col-span-4">
                            <Label className="text-xs text-gray-600">
                              Description
                            </Label>
                            <Textarea
                              ref={quotationDescriptionRef}
                              rows={3}
                              placeholder="Service description"
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
                            <Label className="text-xs text-gray-600">
                              Quantity
                            </Label>
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
                            <Label className="text-xs text-gray-600">
                              Unit Price
                            </Label>
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
                            <Label className="text-xs text-gray-600">
                              Tax Rate (%)
                            </Label>
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
                            <Label className="text-xs text-gray-600">
                              Discount
                            </Label>
                            <div className="flex gap-1">
                              <Input
                                type="number"
                                step="any"
                                placeholder="0.00"
                                value={newItem.discount}
                                onChange={(e) =>
                                  setNewItem((prev) => ({
                                    ...prev,
                                    discount:
                                      e.target.value === ""
                                        ? ""
                                        : parseFloat(e.target.value),
                                  }))
                                }
                              />
                              <select
                                className="border rounded px-2 text-sm bg-background"
                                value={newItem.discountType}
                                onChange={(e) =>
                                  setNewItem((prev) => ({
                                    ...prev,
                                    discountType: e.target.value as
                                      | "amount"
                                      | "percentage",
                                  }))
                                }
                              >
                                <option value="amount">
                                  {formData.currency || "AED"}
                                </option>
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
                                Add Service
                              </>
                            ) : (
                              <>
                                <Pencil className="h-4 w-4 mr-2" />
                                Update Service
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

                    {/* Services List */}
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
                                <col className="w-[100px]" />
                                <col className="w-[90px]" />
                                <col className="w-[110px]" />
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
                                    Discount
                                  </th>
                                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Tax Rate
                                  </th>
                                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Tax Amount
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
                                  // Taken from the same engine result the summary
                                  // below is built from, so the rows add up to it.
                                  // Computing tax here from the line's own net
                                  // ignored this line's share of the header
                                  // discount, so with one set the Tax and Line
                                  // total columns read higher than the document's
                                  // actual tax and total — and higher than what
                                  // the server stores, which uses this engine.
                                  const line = quotationTotals.lines[index];
                                  const taxAmount = line?.taxAmount ?? 0;
                                  const lineTotal = line?.lineTotal ?? 0;

                                  return (
                                    <tr
                                      key={index}
                                      className={
                                        editingItemIndex === index
                                          ? "bg-blue-50 dark:bg-blue-950"
                                          : undefined
                                      }
                                    >
                                      <td className="px-4 py-3 text-sm whitespace-pre-wrap break-words">
                                        {item.description}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-right">
                                        {item.quantity}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-right">
                                        {formData.currency || "AED"} {(typeof item.unitPrice === 'number' ? item.unitPrice : 0).toFixed(2)}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-right">
                                        {(Number(item.discount) || 0) > 0
                                          ? item.discountType === "percentage"
                                            ? `${item.discount}%`
                                            : `${formData.currency || "AED"} ${(Number(item.discount) || 0).toFixed(2)}`
                                          : "-"}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-right">
                                        {item.taxRate || 0}%
                                      </td>
                                      <td className="px-4 py-3 text-sm text-right">
                                        {formData.currency || "AED"} {taxAmount.toFixed(2)}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-right font-medium">
                                        {formData.currency || "AED"} {lineTotal.toFixed(2)}
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-1">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            title="Edit item"
                                            aria-label="Edit item"
                                            data-testid={`button-edit-quotation-item-${index}`}
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
                                            data-testid={`button-remove-quotation-item-${index}`}
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
                              const calcDiscount = (quotationSubtotal * pct / 100);
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
                              // A typed amount is authoritative, so the percentage is
                              // cleared rather than derived: the totals, the stored
                              // record and the PDF all prefer a percentage whenever
                              // one is set, and a derived one would round the amount.
                              setFormData(prev => ({
                                ...prev,
                                discount: val,
                                discountPercentage: ""
                              }));
                            }}
                            placeholder="0.00"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg p-4 border">
                      <h4 className="font-semibold mb-3 text-sm">Quotation Summary</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span className="font-medium">{formatCurrency(quotationTotals.gross, formData.currency)}</span>
                        </div>
                        {quotationTotals.discountTotal > 0 && (
                          <div className="flex justify-between text-sm text-red-600">
                            <span>Total Discount:</span>
                            <span className="font-medium">- {formatCurrency(quotationTotals.discountTotal, formData.currency)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Tax Amount:</span>
                          <span className="font-medium">{formatCurrency(quotationTotals.taxTotal, formData.currency)}</span>
                        </div>
                        <div className="border-t pt-2">
                          <div className="flex justify-between text-lg font-bold">
                            <span>Total Amount:</span>
                            <span className="text-blue-600">{formatCurrency(quotationTotals.total, formData.currency)}</span>
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
                  {quotationEditRequiresNote && (
                    <div className="space-y-2 border-t pt-4 mt-4">
                      <Label className="text-sm font-medium text-red-600">Edit Note (Required) *</Label>
                      <Textarea
                        value={quotationEditNote}
                        onChange={(e) => setQuotationEditNote(e.target.value)}
                        placeholder="Explain the reason for this edit..."
                        className="min-h-[80px]"
                      />
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setIsDialogOpen(false); resetForm(); }}
                      className="w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createQuotationMutation.isPending}
                      className="w-full sm:w-auto"
                    >
                      {createQuotationMutation.isPending
                        ? isEditingQuotation
                          ? "Updating..."
                          : "Creating..."
                        : isEditingQuotation
                          ? "Update Quotation"
                          : "Create Quotation"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Quotations
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {salesStats?.totalQuotations || 0}
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
                  Quotation Value
                </p>
                <div className="flex flex-col">
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {formatCurrency(totalQuotationValue, "AED")}
                  </p>
                  <p className="text-xs text-slate-500 italic">AED Equivalent</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {/* Collapsible Filters */}
        <Card>
          <div
            className="flex items-center justify-between p-4 cursor-pointer select-none"
            onClick={() => setQuotationFilterOpen((o) => !o)}
          >
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span className="font-medium text-sm">Filters</span>
              {(() => {
                const active = [
                  searchFilter,
                  statusFilter !== "all" ? statusFilter : "",
                  customerFilter !== "all" ? customerFilter : "",
                  archivedFilter !== "active" ? archivedFilter : "",
                  startDateFilter,
                  endDateFilter,
                ].filter(Boolean).length;
                return active > 0 ? (
                  <Badge className="bg-primary text-primary-foreground text-xs px-1.5 py-0">{active}</Badge>
                ) : null;
              })()}
            </div>
            {quotationFilterOpen
              ? <ChevronUp className="h-4 w-4 text-slate-400" />
              : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </div>

          {quotationFilterOpen && (
            <CardContent className="pt-0 pb-4 px-4 border-t">
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="searchFilter" className="text-sm font-medium">Search</Label>
                    <Input
                      id="searchFilter"
                      placeholder="Search quotations..."
                      value={searchFilter}
                      onChange={(e) =>
                        startTransition(() => setSearchFilter(e.target.value))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="statusFilter" className="text-sm font-medium">Status</Label>
                    <Select
                      value={statusFilter}
                      onValueChange={(value) =>
                        startTransition(() => setStatusFilter(value))
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
                        <SelectItem value="converted">Converted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="customerFilter" className="text-sm font-medium">Customer</Label>
                    <Autocomplete
                      options={[
                        { value: "all", label: "All Customers" },
                        ...(customers || []).map((customer) => ({
                          value: customer.id.toString(),
                          label: customer.name,
                          searchText: `${customer.name} ${customer.email || ""} ${customer.phone || ""}`,
                        }))
                      ]}
                      value={customerFilter}
                      onValueChange={(value) =>
                        startTransition(() => setCustomerFilter(value))
                      }
                      placeholder="Search customer..."
                      emptyMessage="No customers found"
                    />
                  </div>
                  <div>
                    <Label htmlFor="archivedFilter" className="text-sm font-medium">Archive Status</Label>
                    <Select
                      value={archivedFilter}
                      onValueChange={(value) =>
                        startTransition(() => setArchivedFilter(value))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Quotations" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Quotations</SelectItem>
                        <SelectItem value="active">Active Only</SelectItem>
                        <SelectItem value="archived">Archived Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="startDate" className="text-sm font-medium">Created From</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDateFilter}
                      onChange={(e) =>
                        startTransition(() => setStartDateFilter(e.target.value))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate" className="text-sm font-medium">Created To</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDateFilter}
                      onChange={(e) =>
                        startTransition(() => setEndDateFilter(e.target.value))
                      }
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        startTransition(() => {
                          setSearchFilter("");
                          setStatusFilter("all");
                          setCustomerFilter("all");
                          setArchivedFilter("all");
                          setStartDateFilter("");
                          setEndDateFilter("");
                        });
                      }}
                      className="w-full"
                    >
                      Clear All Filters
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Quotations List */}
        {quotationsLoading ? (
          <div className="text-center py-12">
            <p className="text-slate-500 dark:text-slate-400">
              Loading quotations...
            </p>
          </div>
        ) : !quotations || quotations.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="h-16 w-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                No quotations found
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6">
                Create your first sales quotation to get started
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Quotation
              </Button>
            </CardContent>
          </Card>
        ) : quotations.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="h-16 w-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                No quotations match your filters
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6">
                Try adjusting your filters to see more results
              </p>
              <Button
                onClick={() => {
                  startTransition(() => {
                    setStatusFilter("all");
                    setArchivedFilter("all");
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
            {paginatedQuotations.map((quotation) => (
              <Card
                key={quotation.id}
                role="button"
                tabIndex={0}
                onClick={() => openQuotationDetails(quotation)}
                onKeyDown={(e) => {
                  // A keypress on an inline button bubbles to the row, so without
                  // this an Enter on Approve would both approve and open the dialog.
                  if (e.target !== e.currentTarget) {
                    return;
                  }
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openQuotationDetails(quotation);
                  }
                }}
                className="cursor-pointer hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                data-testid={`card-quotation-${quotation.id}`}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-lg">
                          {quotation.quotationNumber}
                        </span>
                        {getQuotationStatusBadge(quotation.status)}
                        {quotation.isArchived && (
                          <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400">
                            <Archive className="h-3 w-3 mr-1" />
                            Archived
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Customer: {getCustomerName(quotation.customerId)}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-500">
                        Created: {formatDate(quotation.createdDate)}
                        {quotation.validUntil && (
                          <>
                            {" "}
                            • Valid until: {formatDate(quotation.validUntil)}
                          </>
                        )}
                      </p>
                    </div>

                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="text-right">
                        <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(quotation.totalAmount || "0", quotation.currency)}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-500">
                          {quotation.items?.length || 0} service
                          {(quotation.items?.length || 0) !== 1 ? "s" : ""}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {/* Drafts for anyone who can reach this page,
                            post-approval statuses for admin/finance only —
                            those carry a mandatory edit note and a history
                            entry. Converted and expired quotations show no
                            Edit at all. */}
                        {(quotation.status === "draft" ||
                          (["pending_approval", "approved", "rejected"].includes(quotation.status) &&
                            (user?.role === "admin" || user?.role === "finance"))) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditQuotation(quotation);
                              }}
                              data-testid={`button-edit-quotation-${quotation.id}`}
                            >
                              <Pencil className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          )}
                        {quotation.status === "draft" && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              startTransition(() =>
                                submitQuotationMutation.mutate(quotation.id),
                              );
                            }}
                            disabled={submitQuotationMutation.isPending}
                            data-testid={`button-submit-quotation-${quotation.id}`}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            {submitQuotationMutation.isPending
                              ? "Submitting..."
                              : "Submit"}
                          </Button>
                        )}
                        {user?.role === "admin" &&
                          quotation.status === "pending_approval" && (
                            <>
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startTransition(() =>
                                    approveQuotationMutation.mutate(
                                      quotation.id,
                                    ),
                                  );
                                }}
                                disabled={approveQuotationMutation.isPending}
                                data-testid={`button-approve-quotation-${quotation.id}`}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                {approveQuotationMutation.isPending
                                  ? "Approving..."
                                  : "Approve"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedQuotation(quotation);
                                  setIsQuotationRejectDialogOpen(true);
                                }}
                                disabled={rejectQuotationMutation.isPending}
                                data-testid={`button-reject-quotation-${quotation.id}`}
                                className="border-red-300 text-red-600 hover:bg-red-50"
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                        {/* Archive is not offered on a converted quotation — it
                            is the origin of a live invoice and hiding it would
                            leave that invoice traceable back to a document
                            nobody can find. Same gate as the archive route.
                            Unarchive stays available regardless, so anything
                            archived before the rule existed can still come
                            back. */}
                        {user?.role === "admin" &&
                          (quotation.isArchived ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                startTransition(() =>
                                  unarchiveQuotationMutation.mutate(
                                    quotation.id,
                                  ),
                                );
                              }}
                              disabled={unarchiveQuotationMutation.isPending}
                              data-testid={`button-unarchive-quotation-${quotation.id}`}
                            >
                              <ArchiveRestore className="h-4 w-4 mr-1" />
                              {unarchiveQuotationMutation.isPending
                                ? "Unarchiving..."
                                : "Unarchive"}
                            </Button>
                          ) : (
                            quotation.status !== "converted" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startTransition(() =>
                                    archiveQuotationMutation.mutate(
                                      quotation.id,
                                    ),
                                  );
                                }}
                                disabled={archiveQuotationMutation.isPending}
                                data-testid={`button-archive-quotation-${quotation.id}`}
                              >
                                <Archive className="h-4 w-4 mr-1" />
                                {archiveQuotationMutation.isPending
                                  ? "Archiving..."
                                  : "Archive"}
                              </Button>
                            )
                          ))}
                        {quotation.status === "approved" && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConvertToInvoice(quotation);
                            }}
                            data-testid={`button-convert-quotation-${quotation.id}`}
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

        {/* Quotations Pagination */}
        {totalQuotationsPages > 1 && (
          <div className="flex justify-center mt-6">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (quotationsCurrentPage > 1) {
                        startTransition(() =>
                          setQuotationsCurrentPage(quotationsCurrentPage - 1),
                        );
                      }
                    }}
                    className={
                      quotationsCurrentPage <= 1
                        ? "pointer-events-none opacity-50"
                        : ""
                    }
                  />
                </PaginationItem>

                {Array.from(
                  { length: totalQuotationsPages },
                  (_, i) => i + 1,
                ).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        startTransition(() => setQuotationsCurrentPage(page));
                      }}
                      isActive={page === quotationsCurrentPage}
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
                      if (quotationsCurrentPage < totalQuotationsPages) {
                        startTransition(() =>
                          setQuotationsCurrentPage(quotationsCurrentPage + 1),
                        );
                      }
                    }}
                    className={
                      quotationsCurrentPage >= totalQuotationsPages
                        ? "pointer-events-none opacity-50"
                        : ""
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      {/* Quotation Details Dialog */}
      <Dialog
        open={isQuotationDetailsOpen}
        onOpenChange={setIsQuotationDetailsOpen}
      >
        <DialogContent className="max-w-6xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
          {selectedQuotation ? (() => {
            const quotationCurrency = selectedQuotation.currency || "AED";
            const showExchangeRate =
              quotationCurrency !== "AED" && !!selectedQuotation.exchangeRate;
            const totalAmount = parseFloat(selectedQuotation.totalAmount || "0");
            // Total discount (header + line) derived from stored fields; the
            // `discount` column itself holds only the header portion.
            const totalDiscount =
              parseFloat(selectedQuotation.subtotal || "0") +
              parseFloat(selectedQuotation.taxAmount || "0") -
              totalAmount;
            const customer = customers?.find(
              (c) => c.id === selectedQuotation.customerId,
            );
            // Resolved once: the header band and the customer card both show it.
            const customerLabel = getCustomerName(selectedQuotation.customerId);
            const hasCommercialTerms = !!(
              selectedQuotation.paymentTerms || showExchangeRate
            );

            return (
              <>
                {/* Header band. Document actions (edit, duplicate, print,
                    archive) live up here; status-flow actions (submit, approve,
                    convert) stay in the footer. pr-5 sm:pr-14 keeps the buttons
                    clear of the dialog's own X. */}
                <header className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0 border-b border-[#E3E7EE] py-4 pl-5 sm:pl-6 pr-5 sm:pr-14 print:border-b-2 print:border-black">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <div className="grid place-items-center w-[42px] h-[42px] shrink-0 rounded-[10px] bg-[#EEF2FE] border border-[#DCE4FB] print:bg-blue-100">
                      <FileText className="w-5 h-5 text-[#2B4ACB] print:text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#8A93A3] print:text-gray-700">
                        Sales quotation
                      </div>
                      <div className="flex items-center flex-wrap gap-2.5 mt-px">
                        <DialogTitle className="text-[19px] font-semibold tracking-[-0.01em] text-[#171B23] print:text-black">
                          {selectedQuotation.quotationNumber}
                        </DialogTitle>
                        <span className={`${DOC_STAMP} ${docStatusTone(selectedQuotation.status)}`}>
                          {selectedQuotation.status.replace(/_/g, " ")}
                        </span>
                        {selectedQuotation.isArchived && (
                          <span className="text-[11px] font-semibold tracking-[0.06em] uppercase px-[9px] py-[3px] rounded-[5px] border text-[#5B6472] bg-[#F7F9FC] border-[#E3E7EE]">
                            Archived
                          </span>
                        )}
                      </div>
                      <div className="text-[13px] text-[#5B6472] mt-0.5 break-words print:text-gray-700">
                        <strong className="font-semibold text-[#171B23] print:text-black">
                          {customerLabel}
                        </strong>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0 print:hidden">
                    {/* Same gate as the list's Edit button. */}
                    {(selectedQuotation.status === "draft" ||
                      (["pending_approval", "approved", "rejected"].includes(selectedQuotation.status) &&
                        (user?.role === "admin" || user?.role === "finance"))) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditQuotation(selectedQuotation)}
                          data-testid="button-edit-quotation-header"
                          className={DOC_BTN}
                        >
                          <Pencil className="w-[15px] h-[15px] text-[#5B6472]" />
                          Edit
                        </Button>
                      )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDuplicateQuotation(selectedQuotation)}
                      data-testid="button-duplicate-quotation-header"
                      className={DOC_BTN}
                    >
                      <Copy className="w-[15px] h-[15px] text-[#5B6472]" />
                      Duplicate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePrintPDF(selectedQuotation)}
                      data-testid="button-print-quotation-header"
                      className={DOC_BTN}
                    >
                      <Printer className="w-[15px] h-[15px] text-[#5B6472]" />
                      Print
                    </Button>
                    {user?.role === "admin" &&
                      (selectedQuotation.isArchived ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsQuotationDetailsOpen(false);
                            startTransition(() =>
                              unarchiveQuotationMutation.mutate(selectedQuotation.id),
                            );
                          }}
                          disabled={unarchiveQuotationMutation.isPending}
                          data-testid="button-unarchive-quotation-header"
                          className={DOC_BTN}
                        >
                          <ArchiveRestore className="w-[15px] h-[15px] text-[#5B6472]" />
                          {unarchiveQuotationMutation.isPending ? "Unarchiving..." : "Unarchive"}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsQuotationDetailsOpen(false);
                            startTransition(() =>
                              archiveQuotationMutation.mutate(selectedQuotation.id),
                            );
                          }}
                          disabled={archiveQuotationMutation.isPending}
                          data-testid="button-archive-quotation-header"
                          className={DOC_BTN}
                        >
                          <Archive className="w-[15px] h-[15px] text-[#5B6472]" />
                          {archiveQuotationMutation.isPending ? "Archiving..." : "Archive"}
                        </Button>
                      ))}
                  </div>
                </header>

                {/* Key facts. flex rather than a fixed grid so the cells spread
                    evenly when one of them is absent. */}
                <div className="flex flex-wrap shrink-0 border-b border-[#E3E7EE] bg-[#F7F9FC] print:bg-white">
                  <div className={DOC_META_CELL}>
                    <div className={DOC_META_LABEL}>Created date</div>
                    <div className={DOC_META_VALUE}>{formatDate(selectedQuotation.createdDate)}</div>
                  </div>
                  {selectedQuotation.validUntil && (
                    <div className={DOC_META_CELL}>
                      <div className={DOC_META_LABEL}>Valid until</div>
                      <div className={DOC_META_VALUE}>{formatDate(selectedQuotation.validUntil)}</div>
                    </div>
                  )}
                  <div className={DOC_META_CELL}>
                    <div className={DOC_META_LABEL}>Currency</div>
                    <div className={DOC_META_VALUE}>{quotationCurrency}</div>
                    {showExchangeRate && (
                      <div className="text-[12px] text-[#8A93A3] mt-px print:text-gray-700">
                        1 {quotationCurrency} = {selectedQuotation.exchangeRate} AED
                      </div>
                    )}
                  </div>
                  <div className={DOC_META_CELL}>
                    <div className={DOC_META_LABEL}>Total amount</div>
                    <div className={DOC_META_VALUE}>
                      {formatCurrency(selectedQuotation.totalAmount || "0", quotationCurrency)}
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto bg-[#FBFCFE] print:overflow-visible print:bg-white">
                  <div className="flex flex-col gap-4 p-5 sm:p-6 print:gap-3 print:p-0">

                    {/* Customer and commercial terms. flex-wrap rather than a
                        two-column grid so the customer card still fills the row
                        when the terms card is dropped entirely. */}
                    <div className="flex flex-wrap gap-4 items-start">
                      <div className={`${DOC_CARD} flex-1 min-w-[260px]`}>
                        <Accordion type="single" collapsible defaultValue="customer" className="w-full">
                          <AccordionItem value="customer" className="border-b-0">
                            <AccordionTrigger className={DOC_ACC_TRIGGER}>
                              <span className="flex items-center gap-2.5">
                                <Building2 className={DOC_CARD_ICON} />
                                <span className={DOC_CARD_TITLE}>Customer</span>
                              </span>
                            </AccordionTrigger>
                            <AccordionContent className={DOC_ACC_BODY}>
                              <div className="text-[15px] font-semibold mb-0.5 break-words print:text-black">
                                {customerLabel}
                              </div>
                              {customer?.email && (
                                <div className={DOC_KV_ROW}>
                                  <span className={DOC_KV_LABEL}>Email</span>
                                  <span className={DOC_KV_VAL}>{customer.email}</span>
                                </div>
                              )}
                              {customer?.phone && (
                                <div className={DOC_KV_ROW}>
                                  <span className={DOC_KV_LABEL}>Phone</span>
                                  <span className={DOC_KV_VAL}>{customer.phone}</span>
                                </div>
                              )}
                              {selectedQuotation.billingAddress && (
                                <div className="text-[13.5px] leading-[1.55] text-[#333B47] whitespace-pre-wrap break-words mt-2 print:text-black">
                                  {selectedQuotation.billingAddress}
                                </div>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </div>
                      {hasCommercialTerms && (
                        <div className={`${DOC_CARD} flex-1 min-w-[260px]`}>
                          <Accordion type="single" collapsible defaultValue="terms" className="w-full">
                            <AccordionItem value="terms" className="border-b-0">
                              <AccordionTrigger className={DOC_ACC_TRIGGER}>
                                <span className="flex items-center gap-2.5">
                                  <DollarSign className={DOC_CARD_ICON} />
                                  <span className={DOC_CARD_TITLE}>Commercial terms</span>
                                </span>
                              </AccordionTrigger>
                              <AccordionContent className={DOC_ACC_BODY}>
                                <div className="flex flex-col">
                                  {selectedQuotation.paymentTerms && (
                                    <div className={DOC_KV_ROW}>
                                      <span className={DOC_KV_LABEL}>Payment terms</span>
                                      <span className={DOC_KV_VAL}>{selectedQuotation.paymentTerms}</span>
                                    </div>
                                  )}
                                  {showExchangeRate && (
                                    <div className={DOC_KV_ROW}>
                                      <span className={DOC_KV_LABEL}>Exchange rate</span>
                                      <span className={`${DOC_KV_VAL} text-[12.5px]`}>
                                        1 {quotationCurrency} = {selectedQuotation.exchangeRate} AED
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

                    {/* Subject sits directly above the items and opens by
                        default — it is what the quotation is for. */}
                    {selectedQuotation.subject && (
                      <div className={DOC_CARD}>
                        <Accordion type="single" collapsible defaultValue="subject" className="w-full">
                          <AccordionItem value="subject" className="border-b-0">
                            <AccordionTrigger className={DOC_ACC_TRIGGER}>
                              <span className="flex items-center gap-2.5">
                                <AlignLeft className={DOC_CARD_ICON} />
                                <span className={DOC_CARD_TITLE}>Subject</span>
                              </span>
                            </AccordionTrigger>
                            <AccordionContent className={DOC_ACC_BODY}>
                              <div className={`${DOC_PROSE} whitespace-pre-wrap break-words`}>
                                {selectedQuotation.subject}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </div>
                    )}

                    {/* Quotation items, with the ledger totals at the foot of
                        the same card so the numbers sit under the lines they
                        come from. */}
                    <div className={DOC_CARD}>
                      <div className={DOC_CARD_HEAD}>
                        <Package className={DOC_CARD_ICON} />
                        <span className={DOC_CARD_TITLE}>Services / items</span>
                        <span className={DOC_COUNT}>{selectedQuotation.items?.length || 0} items</span>
                      </div>
                      {selectedQuotation.items && selectedQuotation.items.length > 0 ? (
                        <>
                          <div className="relative w-full overflow-auto">
                            <table className="w-full caption-bottom text-sm">
                              <thead>
                                <tr className="border-b border-[#E3E7EE]">
                                  <th className={`${DOC_TH} w-9`}>#</th>
                                  <th className={DOC_TH}>Description</th>
                                  <th className={`${DOC_TH} text-right`}>Qty</th>
                                  <th className={`${DOC_TH} text-right`}>Unit price</th>
                                  <th className={`${DOC_TH} text-right`}>Discount</th>
                                  <th className={`${DOC_TH} text-right`}>Tax rate</th>
                                  <th className={`${DOC_TH} text-right`}>Tax</th>
                                  <th className={`${DOC_TH} text-right`}>Line total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedQuotation.items.map((item, index) => {
                                  const lineSubtotal = item.quantity * item.unitPrice;
                                  const lineDiscount =
                                    (item as any).discountType === "percentage"
                                      ? lineSubtotal * ((Number((item as any).discount) || 0) / 100)
                                      : Math.min(Number((item as any).discount) || 0, lineSubtotal);
                                  const taxRate = item.taxRate || 0;
                                  const taxable = lineSubtotal - lineDiscount;
                                  const calculatedTaxAmount = taxable * (taxRate / 100);
                                  const taxAmount =
                                    item.taxAmount !== undefined
                                      ? parseFloat(item.taxAmount.toString())
                                      : calculatedTaxAmount;
                                  // Prefer the stored line total for the same
                                  // reason as the tax above: the server writes
                                  // both from the shared engine, which nets off
                                  // this line's share of the header discount.
                                  // Deriving it from `taxable` here left the
                                  // column overstated against the totals below
                                  // whenever the document carried one.
                                  const lineTotal =
                                    (item as any).lineTotal !== undefined
                                      ? parseFloat((item as any).lineTotal.toString())
                                      : taxable + taxAmount;

                                  return (
                                    <tr key={index} className="border-b border-[#EDF0F5] last:border-b-0 hover:bg-[#F7F9FC]">
                                      <td className={`${DOC_TD} text-[12.5px] text-[#8A93A3] print:text-black`}>{index + 1}</td>
                                      <td className={DOC_TD}>
                                        <span className="text-[13.5px] font-semibold whitespace-pre-wrap break-words print:text-black">
                                          {item.description}
                                        </span>
                                      </td>
                                      <td className={DOC_TDN}>{item.quantity}</td>
                                      <td className={DOC_TDN}>
                                        {formatAmount(item.unitPrice)}
                                      </td>
                                      <td className={DOC_TDN}>
                                        {(Number((item as any).discount) || 0) > 0
                                          ? (item as any).discountType === "percentage"
                                            ? `${(item as any).discount}%`
                                            : formatAmount((item as any).discount)
                                          : "—"}
                                      </td>
                                      <td className={DOC_TDN}>{taxRate}%</td>
                                      <td className={DOC_TDN}>
                                        {formatAmount(taxAmount)}
                                      </td>
                                      <td className={`${DOC_TDN} font-semibold`}>
                                        {formatAmount(lineTotal)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <div className="flex justify-end px-[18px] pt-3.5 pb-4 bg-[#F7F9FC] border-t border-[#EDF0F5] print:bg-white">
                            <div className="w-full sm:w-[320px] text-[13.5px]">
                              <div className={DOC_TROW}>
                                <span className="text-[#5B6472] print:text-gray-700">Subtotal</span>
                                <span className="font-medium">
                                  {formatCurrency(selectedQuotation.subtotal || "0", quotationCurrency)}
                                </span>
                              </div>
                              {totalDiscount > 0.005 && (
                                <div className={DOC_TROW}>
                                  <span className="text-[#5B6472] print:text-gray-700">Total discount</span>
                                  <span className="font-medium text-[#B42318] print:text-red-700">
                                    −{formatCurrency(totalDiscount.toFixed(2), quotationCurrency)}
                                  </span>
                                </div>
                              )}
                              <div className={DOC_TROW}>
                                <span className="text-[#5B6472] print:text-gray-700">Tax</span>
                                <span className="font-medium">
                                  {formatCurrency(selectedQuotation.taxAmount || "0", quotationCurrency)}
                                </span>
                              </div>
                              <div className={`${DOC_TROW} mt-[7px] pt-[9px] border-t-[3px] border-double border-[#171B23]`}>
                                <span className="text-sm font-semibold text-[#171B23] print:text-black">
                                  Total ({quotationCurrency})
                                </span>
                                <span className="text-[17px] font-semibold text-[#2B4ACB] print:text-blue-600">
                                  {formatCurrency(selectedQuotation.totalAmount || "0", quotationCurrency)}
                                </span>
                              </div>
                              {showExchangeRate && (
                                <div className="text-right text-[11.5px] text-[#8A93A3] mt-2.5 print:text-gray-700">
                                  Exchange rate 1 {quotationCurrency} = {selectedQuotation.exchangeRate} AED
                                  <br />
                                  AED equivalent: AED {(totalAmount * parseFloat(selectedQuotation.exchangeRate || "1")).toFixed(2)}
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className={DOC_CARD_BODY}>
                          <p className="text-sm text-muted-foreground italic">No items found.</p>
                        </div>
                      )}
                    </div>

                    {/* Notes and terms are reference text, not something a
                        reader needs on opening the document, so both stay
                        collapsed. */}
                    {selectedQuotation.remarks && (
                      <div className={DOC_CARD}>
                        <Accordion type="single" collapsible className="w-full">
                          <AccordionItem value="notes" className="border-b-0">
                            <AccordionTrigger className={DOC_ACC_TRIGGER}>
                              <span className="flex items-center gap-2.5">
                                <Pencil className={DOC_CARD_ICON} />
                                <span className={DOC_CARD_TITLE}>Notes</span>
                              </span>
                            </AccordionTrigger>
                            <AccordionContent className={DOC_ACC_BODY}>
                              <div
                                className={`${DOC_PROSE} break-words rich-text-content`}
                                dangerouslySetInnerHTML={{ __html: sanitize(selectedQuotation.remarks) }}
                              />
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </div>
                    )}
                    {selectedQuotation.termsAndConditions && (
                      <div className={DOC_CARD}>
                        <Accordion type="single" collapsible className="w-full">
                          <AccordionItem value="terms-and-conditions" className="border-b-0">
                            <AccordionTrigger className={DOC_ACC_TRIGGER}>
                              <span className="flex items-center gap-2.5">
                                <FileText className={DOC_CARD_ICON} />
                                <span className={DOC_CARD_TITLE}>Terms &amp; conditions</span>
                              </span>
                            </AccordionTrigger>
                            <AccordionContent className={DOC_ACC_BODY}>
                              <p className={`${DOC_PROSE} whitespace-pre-wrap break-words`}>
                                {selectedQuotation.termsAndConditions}
                              </p>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </div>
                    )}

                    {/* Bank account sits after the notes and terms: it is
                        settlement reference detail, read last. */}
                    {selectedQuotation.bankAccount && (
                      <div className={DOC_CARD}>
                        <Accordion type="single" collapsible className="w-full">
                          <AccordionItem value="bank" className="border-b-0">
                            <AccordionTrigger className={DOC_ACC_TRIGGER}>
                              <span className="flex items-center gap-2.5">
                                <CreditCard className={DOC_CARD_ICON} />
                                <span className={DOC_CARD_TITLE}>Bank account</span>
                              </span>
                            </AccordionTrigger>
                            <AccordionContent className={DOC_ACC_BODY}>
                              <div
                                className="text-[13px] leading-[1.6] text-[#333B47] break-words rich-text-content print:text-black"
                                dangerouslySetInnerHTML={{ __html: sanitize(selectedQuotation.bankAccount) }}
                              />
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </div>
                    )}

                    {/* Activity — approval trail and edit history in one tabbed
                        block rather than two stacked cards. Collapsed on open so
                        the dialog leads with the document; edit history fetches
                        on first click of its tab. Quotations never hold
                        payments, so there is no payments tab. */}
                    <div className={`${DOC_CARD} print:hidden`}>
                      <button
                        type="button"
                        onClick={() => setQuotationActivityOpen((o) => !o)}
                        aria-expanded={quotationActivityOpen}
                        className={`${DOC_CARD_HEAD} w-full text-left cursor-pointer hover:bg-[#F7F9FC] ${quotationActivityOpen ? "" : "border-b-0"}`}
                        data-testid="button-toggle-quotation-activity"
                      >
                        <History className={DOC_CARD_ICON} />
                        <span className={DOC_CARD_TITLE}>Activity</span>
                        <span className="ml-auto">
                          {quotationActivityOpen ? (
                            <ChevronUp className="w-4 h-4 text-[#8A93A3]" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-[#8A93A3]" />
                          )}
                        </span>
                      </button>
                      {quotationActivityOpen && (
                        <div className={DOC_CARD_BODY}>
                          <Tabs value={quotationActivityTab} onValueChange={setQuotationActivityTab}>
                            <TabsList>
                              <TabsTrigger value="approval" data-testid="tab-quotation-approval">
                                Approval
                              </TabsTrigger>
                              <TabsTrigger value="history" data-testid="tab-quotation-edit-history">
                                Edit History
                                {quotationEditHistory ? ` (${quotationEditHistory.length})` : ""}
                              </TabsTrigger>
                            </TabsList>

                            {/* Approval trail. The names are resolved
                                server-side on the list rows: /api/users is
                                admin-only while finance can open this dialog,
                                so looking them up from here would 403. */}
                            <TabsContent value="approval" className="mt-4">
                              {(selectedQuotation as any).submittedAt ||
                              (selectedQuotation as any).approvedAt ||
                              (selectedQuotation as any).rejectionReason ||
                              (selectedQuotation as any).cancelledAt ? (
                                <ul className={DOC_TIMELINE}>
                                  {(selectedQuotation as any).submittedAt && (
                                    <li className="relative pb-4 last:pb-0">
                                      <span className={`${DOC_DOT} border-[#8A93A3]`} />
                                      <div className="text-[13.5px] font-semibold">Submitted for approval</div>
                                      <div className="text-[12.5px] text-[#8A93A3] mt-px">
                                        {(selectedQuotation as any).submittedByName || "—"} ·{" "}
                                        {new Date((selectedQuotation as any).submittedAt).toLocaleString()}
                                      </div>
                                    </li>
                                  )}
                                  {(selectedQuotation as any).approvedAt && (
                                    <li className="relative pb-4 last:pb-0">
                                      <span className={`${DOC_DOT} border-[#12B76A]`} />
                                      <div className="text-[13.5px] font-semibold">Approved</div>
                                      <div className="text-[12.5px] text-[#8A93A3] mt-px">
                                        {(selectedQuotation as any).approvedByName || "—"} ·{" "}
                                        {new Date((selectedQuotation as any).approvedAt).toLocaleString()}
                                      </div>
                                    </li>
                                  )}
                                  {(selectedQuotation as any).rejectionReason && (
                                    <li className="relative pb-4 last:pb-0">
                                      <span className={`${DOC_DOT} border-[#B42318]`} />
                                      <div className="text-[13.5px] font-semibold">Rejected</div>
                                      <div className="mt-2 text-[13px] text-[#912018] bg-[#FEF3F2] border border-[#F0C5C1] rounded-[7px] px-[11px] py-2 whitespace-pre-wrap break-words">
                                        {(selectedQuotation as any).rejectionReason}
                                      </div>
                                    </li>
                                  )}
                                  {/* Same step the sales invoice trail renders,
                                      keyed on cancelledAt for the same reason. */}
                                  {(selectedQuotation as any).cancelledAt && (
                                    <li className="relative pb-4 last:pb-0">
                                      <span className={`${DOC_DOT} border-[#B42318]`} />
                                      <div className="text-[13.5px] font-semibold">Cancelled</div>
                                      <div className="text-[12.5px] text-[#8A93A3] mt-px">
                                        {(selectedQuotation as any).cancelledByName || "—"} ·{" "}
                                        {new Date((selectedQuotation as any).cancelledAt).toLocaleString()}
                                      </div>
                                      {(selectedQuotation as any).cancellationReason && (
                                        <div className="mt-2 text-[13px] text-[#912018] bg-[#FEF3F2] border border-[#F0C5C1] rounded-[7px] px-[11px] py-2 whitespace-pre-wrap break-words">
                                          {(selectedQuotation as any).cancellationReason}
                                        </div>
                                      )}
                                    </li>
                                  )}
                                  {selectedQuotation.status === "pending_approval" && (
                                    <li className="relative pb-4 last:pb-0">
                                      <span className={`${DOC_DOT} border-[#E3E7EE]`} />
                                      <div className="text-[13.5px] font-semibold text-[#5B6472]">Awaiting approval</div>
                                      <div className="text-[12.5px] text-[#8A93A3] mt-px">Pending review</div>
                                    </li>
                                  )}
                                </ul>
                              ) : (
                                <p className="text-sm text-muted-foreground italic">
                                  This quotation has not been submitted for approval yet.
                                </p>
                              )}
                            </TabsContent>

                            <TabsContent value="history" className="mt-4">
                              <EditHistoryTab
                                entries={quotationEditHistory}
                                currency={selectedQuotation.currency}
                                emptyMessage="No edits have been recorded for this quotation."
                              />
                            </TabsContent>
                          </Tabs>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer band — status-flow actions only; document actions
                    live in the header. */}
                <div className="flex flex-col sm:flex-row sm:justify-end gap-3 shrink-0 border-t border-[#E3E7EE] bg-white px-5 sm:px-6 py-3.5 print:hidden">
                  {selectedQuotation.status === "draft" && (
                    <Button
                      onClick={() =>
                        startTransition(() =>
                          submitQuotationMutation.mutate(selectedQuotation.id),
                        )
                      }
                      disabled={submitQuotationMutation.isPending}
                      className="w-full sm:w-auto"
                      data-testid="button-submit-quotation-dialog"
                    >
                      <Send className="h-4 w-4 mr-1" />
                      {submitQuotationMutation.isPending ? "Submitting..." : "Submit"}
                    </Button>
                  )}
                  {user?.role === "admin" &&
                    selectedQuotation.status === "pending_approval" && (
                      <>
                        <Button
                          onClick={() =>
                            startTransition(() =>
                              approveQuotationMutation.mutate(selectedQuotation.id),
                            )
                          }
                          disabled={approveQuotationMutation.isPending}
                          data-testid="button-approve-quotation-dialog"
                          className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {approveQuotationMutation.isPending ? "Approving..." : "Approve"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsQuotationDetailsOpen(false);
                            setIsQuotationRejectDialogOpen(true);
                          }}
                          disabled={rejectQuotationMutation.isPending}
                          data-testid="button-reject-quotation-dialog"
                          className="w-full sm:w-auto border-red-300 text-red-600 hover:bg-red-50"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}
                  {selectedQuotation.status === "approved" && (
                    <Button
                      onClick={() => handleConvertToInvoice(selectedQuotation)}
                      className="w-full sm:w-auto"
                      data-testid="button-convert-quotation-dialog"
                    >
                      <ArrowRightLeft className="h-4 w-4 mr-1" />
                      Convert to Invoice
                    </Button>
                  )}
                  {user?.role === "admin" &&
                    selectedQuotation.status === "approved" && (
                      <Button
                        variant="outline"
                        onClick={() => setIsQuotationCancelDialogOpen(true)}
                        disabled={cancelQuotationMutation.isPending}
                        className="w-full sm:w-auto border-red-300 text-red-600 hover:bg-red-50"
                        data-testid="button-cancel-quotation-dialog"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Cancel Quotation
                      </Button>
                    )}
                  <Button
                    variant="outline"
                    onClick={() => setIsQuotationDetailsOpen(false)}
                    className="w-full sm:w-auto"
                    data-testid="button-close-quotation-details"
                  >
                    Close
                  </Button>
                </div>
              </>
            );
          })() : (
            <div className="p-6">
              <DialogTitle className="text-base font-semibold">Quotation Details</DialogTitle>
              <p className="mt-2 text-sm text-muted-foreground">No quotation selected.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quotation Reject Dialog */}
      <Dialog
        open={isQuotationRejectDialogOpen}
        onOpenChange={setIsQuotationRejectDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Sales Quotation</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this quotation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quotationRejectionReason">Rejection Reason *</Label>
              <Textarea
                id="quotationRejectionReason"
                value={quotationRejectionReason}
                onChange={(e) => setQuotationRejectionReason(e.target.value)}
                placeholder="Explain why this quotation is being rejected..."
                rows={4}
                className="resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsQuotationRejectDialogOpen(false);
                  setQuotationRejectionReason("");
                }}
                disabled={rejectQuotationMutation.isPending}
                data-testid="button-cancel-reject-quotation"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (!quotationRejectionReason.trim()) {
                    toast({
                      title: "Error",
                      description: "Please provide a rejection reason",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (selectedQuotation) {
                    rejectQuotationMutation.mutate({
                      quotationId: selectedQuotation.id,
                      reason: quotationRejectionReason,
                    });
                  }
                }}
                disabled={rejectQuotationMutation.isPending}
                data-testid="button-confirm-reject-quotation"
              >
                {rejectQuotationMutation.isPending ? "Rejecting..." : "Reject Quotation"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quotation Cancel Dialog */}
      <Dialog
        open={isQuotationCancelDialogOpen}
        onOpenChange={setIsQuotationCancelDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Sales Quotation</DialogTitle>
            <DialogDescription>
              This withdraws the approved quotation. It cannot be edited or
              converted to an invoice afterwards.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quotationCancellationReason">
                Cancellation Reason *
              </Label>
              <Textarea
                id="quotationCancellationReason"
                value={quotationCancellationReason}
                onChange={(e) => setQuotationCancellationReason(e.target.value)}
                placeholder="Explain why this quotation is being cancelled..."
                rows={4}
                className="resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsQuotationCancelDialogOpen(false);
                  setQuotationCancellationReason("");
                }}
                disabled={cancelQuotationMutation.isPending}
                data-testid="button-dismiss-cancel-quotation"
              >
                Keep Quotation
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (!quotationCancellationReason.trim()) {
                    toast({
                      title: "Error",
                      description: "Please provide a cancellation reason",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (selectedQuotation) {
                    cancelQuotationMutation.mutate({
                      quotationId: selectedQuotation.id,
                      cancellationReason: quotationCancellationReason.trim(),
                    });
                  }
                }}
                disabled={cancelQuotationMutation.isPending}
                data-testid="button-confirm-cancel-quotation"
              >
                {cancelQuotationMutation.isPending
                  ? "Cancelling..."
                  : "Cancel Quotation"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
