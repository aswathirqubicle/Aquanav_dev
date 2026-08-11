import { useEffect, useRef, useState, startTransition } from "react";
import { useLocation } from "wouter";
import { computeDocumentTotals } from "@shared/document-totals";
import {
  useQuery,
  useMutation,
  useQueryClient,
  useQueries,
} from "@tanstack/react-query";
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
import { formatDateForInput, formatDisplayDate } from "@/lib/utils";
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
  Download,
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
  Ban,
  CreditCard,
  Building2,
  DollarSign,
  AlignLeft,
  Package,
} from "lucide-react";
import {
  SalesQuotation,
  SalesInvoice,
  Customer,
  Project,
  InvoicePayment,
  Company,
  insertSalesQuotationSchema,
  insertSalesInvoiceSchema,
  insertInvoicePaymentSchema,
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

// Design tokens for the two view dialogs, ported from the purchase invoice
// view so a sales document reads the same way as a purchase one. Literal hex
// rather than the app's semantic tokens because the approved design fixes the
// palette; nothing in here follows a theme. Module scope rather than inline —
// the purchase file declares them inside its single dialog, but quotations and
// invoices are two dialogs in this file and would otherwise duplicate the lot.
const DOC_CARD =
  "bg-white border border-[#E3E7EE] rounded-[10px] overflow-hidden print:bg-white print:border print:border-gray-300";
const DOC_CARD_HEAD =
  "flex items-center gap-2.5 px-[18px] py-3 border-b border-[#EDF0F5]";
const DOC_CARD_TITLE = "text-sm font-semibold text-[#171B23] print:text-black";
const DOC_CARD_ICON = "w-[15px] h-[15px] shrink-0 text-[#8A93A3]";
const DOC_CARD_BODY = "px-[18px] py-4";
const DOC_ACC_TRIGGER =
  "px-[18px] py-3 hover:no-underline data-[state=open]:border-b data-[state=open]:border-[#EDF0F5]";
const DOC_ACC_BODY = "px-[18px] pt-3.5 pb-4";
const DOC_KV_ROW =
  "flex justify-between gap-3.5 py-2 text-[13.5px] border-b border-dashed border-[#EDF0F5] last:border-b-0 first:pt-0 last:pb-0";
const DOC_KV_LABEL = "shrink-0 text-[#5B6472] print:text-gray-700";
const DOC_KV_VAL =
  "min-w-0 text-right font-medium break-words print:text-black";
const DOC_META_LABEL =
  "text-[10.5px] font-semibold tracking-[0.08em] uppercase text-[#8A93A3] mb-[3px] print:text-gray-700";
const DOC_META_VALUE = "text-[14.5px] font-semibold text-[#171B23] print:text-black";
const DOC_META_CELL =
  "flex-1 min-w-[150px] px-5 sm:px-6 py-3.5 border-r border-[#E3E7EE] last:border-r-0";
const DOC_TH =
  "h-auto px-3.5 py-2.5 bg-[#F7F9FC] text-[10.5px] font-semibold tracking-[0.07em] uppercase text-[#8A93A3] whitespace-nowrap text-left align-middle print:bg-gray-100 print:text-black";
const DOC_TD = "px-3.5 py-3 align-top print:text-black";
const DOC_TDN =
  "px-3.5 py-3 align-top text-right text-[13px] print:text-black";
const DOC_TROW =
  "flex justify-between items-baseline gap-4 py-[5px] print:text-black";
const DOC_BTN =
  "inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors border bg-background h-auto gap-[7px] rounded-lg border-[#E3E7EE] px-[13px] py-[7px] text-[13.5px] text-[#171B23] hover:bg-[#F7F9FC] hover:border-[#D4DAE3] cursor-pointer";
const DOC_COUNT =
  "text-[11.5px] font-semibold text-[#5B6472] bg-[#EDF0F5] rounded-full px-2.5 py-0.5";
const DOC_PROSE = "text-[13.5px] leading-[1.65] text-[#333B47] print:text-black";
const DOC_STAMP =
  "text-[11px] font-semibold tracking-[0.09em] uppercase px-[9px] py-[3px] rounded-[5px] border";
const DOC_TIMELINE =
  "relative list-none pl-5 before:content-[''] before:absolute before:left-[5px] before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-[#EDF0F5]";
const DOC_DOT = "absolute -left-5 top-[5px] w-3 h-3 rounded-full bg-white border-[3px]";

// Chip tones for the header stamps. Local on purpose — the list rows keep using
// getQuotationStatusBadge / getInvoiceStatusBadge, which must not change shape.
const docStatusTone = (status: string) => {
  switch (status) {
    case "draft":
      return "text-[#5B6472] bg-[#F7F9FC] border-[#E3E7EE]";
    case "pending_approval":
      return "text-[#B54708] bg-[#FFFAEB] border-[#FEDF89]";
    case "approved":
    case "paid":
      return "text-[#027A48] bg-[#ECFDF3] border-[#A6F4C5]";
    case "rejected":
      return "text-[#B42318] bg-[#FEF3F2] border-[#F0C5C1]";
    case "cancelled":
      return "text-[#B42318] bg-[#F7F9FC] border-[#F0C5C1]";
    case "overdue":
      return "text-[#B42318] bg-[#FEF3F2] border-[#F0C5C1]";
    case "partially_paid":
      return "text-[#B54708] bg-[#FFFAEB] border-[#FEDF89]";
    case "unpaid":
      return "text-[#2B4ACB] bg-[#EEF2FE] border-[#DCE4FB]";
    case "converted":
      return "text-[#6941C6] bg-[#F4F3FF] border-[#D9D6FE]";
    default:
      return "text-[#5B6472] bg-[#F7F9FC] border-[#E3E7EE]";
  }
};

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

const createSalesInvoiceSchema = insertSalesInvoiceSchema.extend({
  invoiceDate: z.string(),
  dueDate: z.string(),
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

const createPaymentSchema = insertInvoicePaymentSchema.extend({
  paymentDate: z.string(),
});

type CreateSalesQuotationData = z.infer<typeof createSalesQuotationSchema>;
type CreateSalesInvoiceData = z.infer<typeof createSalesInvoiceSchema>;
type CreatePaymentData = z.infer<typeof createPaymentSchema>;

interface QuotationItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  taxAmount?: number;
  discount?: number;
  discountType?: "amount" | "percentage";
}

export default function SalesIndex() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null);
  const [editNote, setEditNote] = useState("");
  const [selectedQuotation, setSelectedQuotation] =
    useState<SalesQuotation | null>(null);
  const [isQuotationDetailsOpen, setIsQuotationDetailsOpen] = useState(false);
  const [isEditingQuotation, setIsEditingQuotation] = useState(false);
  // Kept separate from the invoice's `editNote` above: the two dialogs have
  // independent open state and neither closes the other, so one shared box
  // could carry a half-typed invoice note into a quotation save.
  const [quotationEditNote, setQuotationEditNote] = useState("");
  // An edit note is only required once the quotation has been through approval;
  // draft and pending_approval are still being drafted. This mirrors the server
  // gate in sales-quotations.routes.ts — the server is the boundary, this just
  // avoids showing a mandatory field that isn't.
  const quotationEditRequiresNote =
    isEditingQuotation &&
    (selectedQuotation?.status === "approved" ||
      selectedQuotation?.status === "rejected");
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(
    null,
  );
  // An edit note is only required once the invoice is approved and its ledger
  // entries exist; draft and pending_approval are pre-ledger. This mirrors the
  // server gate in sales-invoices.routes.ts — the server is the boundary, this
  // just avoids showing a mandatory field that isn't.
  const editRequiresNote =
    !!editingInvoiceId &&
    selectedInvoice?.status !== "draft" &&
    selectedInvoice?.status !== "pending_approval";
  const [isInvoiceDetailsOpen, setIsInvoiceDetailsOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isReceivablesOpen, setIsReceivablesOpen] = useState(false);
  const [isQuotationRejectDialogOpen, setIsQuotationRejectDialogOpen] = useState(false);
  const [quotationRejectionReason, setQuotationRejectionReason] = useState("");
  const [isInvoiceRejectDialogOpen, setIsInvoiceRejectDialogOpen] = useState(false);
  const [invoiceRejectionReason, setInvoiceRejectionReason] = useState("");
  // Filter panel open/close
  const [quotationFilterOpen, setQuotationFilterOpen] = useState(false);
  const [invoiceFilterOpen, setInvoiceFilterOpen] = useState(false);

  // Quotation filters
  const [searchFilter, setSearchFilter] = useState<string>("");
  const debouncedSearchFilter = useDebounce(searchFilter, 500);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [archivedFilter, setArchivedFilter] = useState<string>("active");
  const [startDateFilter, setStartDateFilter] = useState<string>("");
  const [endDateFilter, setEndDateFilter] = useState<string>("");

  // Invoice filters
  const [invoiceSearchFilter, setInvoiceSearchFilter] = useState<string>("");
  const debouncedInvoiceSearchFilter = useDebounce(invoiceSearchFilter, 500);
  const [invoiceStatusFilter, setInvoiceStatusFilter] =
    useState<string>("all");
  const [invoiceCustomerFilter, setInvoiceCustomerFilter] =
    useState<string>("all");
  const [invoiceProjectFilter, setInvoiceProjectFilter] =
    useState<string>("all");
  const [invoiceStartDateFilter, setInvoiceStartDateFilter] =
    useState<string>("");
  const [invoiceEndDateFilter, setInvoiceEndDateFilter] = useState<string>("");
  const [expandedPayment, setExpandedPayment] = useState<number | null>(null);
  // Activity block in each view dialog: collapsed on open, and which tab is
  // showing once expanded. Collapsed by default keeps the dialog to the
  // document itself; the payment and edit-history requests are gated on the
  // matching tab, so opening a dialog costs no extra fetch.
  const [quotationActivityOpen, setQuotationActivityOpen] = useState(false);
  const [quotationActivityTab, setQuotationActivityTab] = useState("approval");
  const [invoiceActivityOpen, setInvoiceActivityOpen] = useState(false);
  const [invoiceActivityTab, setInvoiceActivityTab] = useState("approval");
  // Cancelling reverses posted ledger entries, so the reason is mandatory and
  // is recorded against the invoice — same as a rejection reason.
  const [cancellationReason, setCancellationReason] = useState("");
  const [selectedPaymentFiles, setSelectedPaymentFiles] =
    useState<FileList | null>(null);

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

  const [invoiceFormData, setInvoiceFormData] =
    useState<CreateSalesInvoiceData>({
      customerId: undefined,
      projectId: undefined,
      quotationId: undefined,
      status: "draft",
      invoiceDate: formatDateForInput(new Date()),
      dueDate: formatDateForInput(new Date()),
      items: [],
      discountPercentage: "0",
      discount: "0",
      subtotal: "0",
      taxAmount: "0",
      totalAmount: "0",
      currency: "AED",
      exchangeRate: "1",
      remarks: "",
      workOrderNumber: "",
      subject: "",
      paymentTerms: "",
      bankAccount: "",
      billingAddress: "",
      termsAndConditions: "",
    });

  const getDefaultTaxRate = () =>
    customerVatTreatment === "standard" ? 5 : 0;


  const handleCustomerChange = async (customerId: string) => {
    const id = parseInt(customerId);
    const customer = customers?.find((c) => c.id === id);
    if (customer) {
      const currency = customer.currency || "AED";
      let exchangeRate = "1";

      if (currency !== "AED") {
        try {
          const response = await apiRequest(`/api/exchange-rates/lookup?from=${currency}`);
          const data = await response.json();
          exchangeRate = data.rate;
        } catch (error) {
          console.error("Failed to lookup exchange rate:", error);
        }
      }

      setInvoiceFormData((prev) => ({
        ...prev,
        customerId: id,
        currency,
        exchangeRate,
      }));
    }
  };

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
  // Quotation and invoice keep separate indices because they hold separate item
  // arrays, even though they share the newItem staging object above.
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [editingInvoiceItemIndex, setEditingInvoiceItemIndex] = useState<
    number | null
  >(null);
  const quotationItemFormRef = useRef<HTMLDivElement>(null);
  const quotationDescriptionRef = useRef<HTMLTextAreaElement>(null);
  const invoiceItemFormRef = useRef<HTMLDivElement>(null);
  const invoiceDescriptionRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
    if (editingInvoiceItemIndex !== null) {
      cancelEditInvoiceItem();
    }
  }, [isInvoiceDialogOpen]);

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

  useEffect(() => {
    if (!isInvoiceDetailsOpen) {
      setInvoiceActivityOpen(false);
      setInvoiceActivityTab("approval");
    }
  }, [isInvoiceDetailsOpen]);

  const [paymentFormData, setPaymentFormData] = useState<CreatePaymentData>({
    invoiceId: 0,
    amount: "0",
    paymentDate: formatDateForInput(new Date()),
    paymentMethod: "bank_transfer",
    referenceNumber: "",
    notes: "",
    recordedBy: undefined,
  });

  // Pagination state
  const [quotationsCurrentPage, setQuotationsCurrentPage] = useState(1);
  const [invoicesCurrentPage, setInvoicesCurrentPage] = useState(1);
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
  const invoiceSubtotalValue = invoiceFormData.items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);

  // Authoritative document totals (VAT on the discounted base, line + header
  // discounts) via the shared engine — matches exactly what the server stores.
  const docTotals = (
    items: any[],
    discountPercentage?: string,
    discountAmount?: string,
  ) => {
    const pct = parseFloat(discountPercentage || "0") || 0;
    return computeDocumentTotals(
      (items || []).map((it) => ({
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        taxRate: Number(it.taxRate) || 0,
        discount: Number(it.discount) || 0,
        discountType: it.discountType === "percentage" ? "percentage" : "amount",
      })),
      pct > 0
        ? { discount: pct, discountType: "percentage" }
        : { discount: parseFloat(discountAmount || "0") || 0, discountType: "amount" },
    );
  };
  const quotationTotals = docTotals(
    formData.items,
    formData.discountPercentage,
    formData.discount,
  );
  const invoiceTotals = docTotals(
    invoiceFormData.items,
    invoiceFormData.discountPercentage,
    invoiceFormData.discount,
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

  useEffect(() => {
    if (!isInvoiceDialogOpen || !company?.bankAccount) return;

    setInvoiceFormData(prev => ({
      ...prev,
      bankAccount: prev.bankAccount || company.bankAccount, // ✅ default only
    }));
  }, [isInvoiceDialogOpen, company]);

  // Recalculate invoice discount when items or percentage changes
  useEffect(() => {
    const pct = parseFloat(invoiceFormData.discountPercentage || "0") || 0;
    // No percentage set means the discount was entered as an amount. That value
    // is the user's own and must never be recalculated from a percentage.
    if (pct <= 0) return;
    const calcDiscountValue = invoiceSubtotalValue * pct / 100;
    const currentDiscountValue = parseFloat(invoiceFormData.discount || "0");

    if (Math.abs(currentDiscountValue - calcDiscountValue) > 0.001) {
      setInvoiceFormData(prev => ({ ...prev, discount: calcDiscountValue.toFixed(2) }));
    }
  }, [invoiceSubtotalValue, invoiceFormData.discountPercentage]);

  useEffect(() => {
    if (!invoiceFormData.paymentTerms || !invoiceFormData.invoiceDate) return;

    const baseDate = new Date(invoiceFormData.invoiceDate);
    if (isNaN(baseDate.getTime())) return;

    let daysToAdd = 0;
    switch (invoiceFormData.paymentTerms) {
      case "Net 10": daysToAdd = 10; break;
      case "Net 15": daysToAdd = 15; break;
      case "Net 30": daysToAdd = 30; break;
      case "Due on receipt": daysToAdd = 0; break;
      default: return;
    }

    const dueDate = new Date(baseDate);
    dueDate.setUTCDate(baseDate.getUTCDate() + daysToAdd);
    const dueDateString = dueDate.toISOString().split('T')[0];

    if (invoiceFormData.dueDate !== dueDateString) {
      setInvoiceFormData(prev => ({
        ...prev,
        dueDate: dueDateString
      }));
    }
  }, [invoiceFormData.paymentTerms, invoiceFormData.invoiceDate]);

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

  const { data: invoicesResponse, isLoading: invoicesLoading } = useQuery<{
    data: SalesInvoice[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: [
      "/api/sales-invoices",
      {
        page: invoicesCurrentPage,
        limit: itemsPerPage,
        search: debouncedInvoiceSearchFilter,
        status: invoiceStatusFilter,
        customerId: invoiceCustomerFilter !== "all" ? invoiceCustomerFilter : undefined,
        projectId: invoiceProjectFilter !== "all" ? (invoiceProjectFilter === "no-project" ? -1 : invoiceProjectFilter) : undefined,
        startDate: invoiceStartDateFilter,
        endDate: invoiceEndDateFilter,
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

  const invoices = invoicesResponse?.data || [];

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

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: isAuthenticated,
  });

  const { data: receivables } = useQuery<any[]>({
    queryKey: [
      "/api/receivables",
      {
        customerId: invoiceCustomerFilter !== "all" ? invoiceCustomerFilter : undefined,
        projectId: invoiceProjectFilter !== "all" ? (invoiceProjectFilter === "no-project" ? -1 : invoiceProjectFilter) : undefined,
        startDate: invoiceStartDateFilter,
        endDate: invoiceEndDateFilter,
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

  const { data: invoicePayments, isLoading: isLoadingPayments } = useQuery<
    InvoicePayment[]
  >({
    queryKey: [`/api/sales-invoices/${selectedInvoice?.id}/payments`],
    enabled:
      isAuthenticated &&
      !!selectedInvoice &&
      invoiceActivityOpen &&
      invoiceActivityTab === "payments",
  });

  const { data: invoiceEditHistory } = useQuery<any[]>({
    queryKey: ["/api/sales-invoices", selectedInvoice?.id, "edit-history"],
    queryFn: async () => {
      const response = await apiRequest(`/api/sales-invoices/${selectedInvoice?.id}/edit-history`, { method: "GET" });
      if (!response.ok) return [];
      return response.json();
    },
    enabled:
      isAuthenticated &&
      !!selectedInvoice &&
      invoiceActivityOpen &&
      invoiceActivityTab === "history" &&
      (user?.role === "admin" || user?.role === "finance"),
  });

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

  const paymentFilesQueries = useQueries({
    queries: (invoicePayments || []).map((payment) => ({
      queryKey: [`/api/payments/${payment.id}/files`],
      queryFn: async () => {
        const response = await apiRequest(`/api/payments/${payment.id}/files`, {
          method: "GET",
        });
        return response.json();
      },
      enabled: isAuthenticated && !!selectedInvoice,
    })),
  });

  const createQuotationMutation = useMutation({
    mutationFn: async (data: CreateSalesQuotationData) => {
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

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: CreateSalesInvoiceData) => {
      console.log("Creating invoice with data:", data);

      // Validate required fields
      if (!data.customerId) {
        throw new Error("Customer is required");
      }

      if (!data.items || data.items.length === 0) {
        throw new Error("At least one item is required");
      }

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
        customerId: parseInt(data.customerId.toString()),
        projectId: data.projectId ? parseInt(data.projectId.toString()) : null,
        quotationId: data.quotationId
          ? parseInt(data.quotationId.toString())
          : null,
        // Ensure dates are properly formatted
        invoiceDate: data.invoiceDate,
        dueDate: data.dueDate,
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        discountPercentage: data.discountPercentage || "0",
        discount: discountAmount.toFixed(2),
      };

      console.log("Processed invoice data:", processedData);

      const response = await apiRequest("/api/sales-invoices", {
        method: "POST",
        body: processedData,
      });

      console.log("Invoice creation response:", response);
      return response;
    },
    onSuccess: (data) => {
      console.log("Invoice created successfully:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/sales-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receivables"] });
      toast({
        title: "Invoice Created",
        description: "The sales invoice has been created successfully.",
      });
      setIsInvoiceDialogOpen(false);
      resetInvoiceForm();
    },
    onError: (error: Error) => {
      console.error("Invoice creation error:", error);
      toast({
        title: "Error",
        description:
          error.message ||
          "Failed to create invoice. Please check your data and try again.",
        variant: "destructive",
      });
    },
  });


  const updateInvoiceMutation = useMutation({
    mutationFn: async ({ id, data, editNote }: { id: number; data: any; editNote: string }) => {
      const subtotal = data.items.reduce(
        (sum: number, item: any) => sum + item.quantity * item.unitPrice,
        0,
      );

      const discountAmount = parseFloat(data.discount || "0");

      const taxAmount = data.items.reduce((sum: number, item: any) => {
        const itemTotal = item.quantity * item.unitPrice;
        const itemTax = (itemTotal * (item.taxRate || 0)) / 100;
        return sum + itemTax;
      }, 0);
      const totalAmount = subtotal - discountAmount + taxAmount;

      const processedData = {
        ...data,
        customerId: parseInt(data.customerId.toString()),
        projectId: data.projectId ? parseInt(data.projectId.toString()) : null,
        quotationId: data.quotationId ? parseInt(data.quotationId.toString()) : null,
        invoiceDate: data.invoiceDate,
        dueDate: data.dueDate,
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        discountPercentage: data.discountPercentage || "0",
        discount: discountAmount.toFixed(2),
        editNote,
      };

      const response = await apiRequest(`/api/sales-invoices/${id}`, {
        method: "PUT",
        body: processedData,
      });
      return response;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receivables"] });
      // Editing a line item changes the invoice total, so the header summary
      // cards (receivables, invoice value) are stale until this refetches.
      queryClient.invalidateQueries({ queryKey: ["/api/sales/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales-invoices", variables.id, "edit-history"] });
      toast({
        title: "Invoice Updated",
        description: "The sales invoice has been updated successfully.",
      });
      setIsInvoiceDialogOpen(false);
      setEditingInvoiceId(null);
      setEditNote("");
      resetInvoiceForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update invoice.",
        variant: "destructive",
      });
    },
  });

  const submitInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      const response = await apiRequest(
        `/api/sales-invoices/${invoiceId}/submit`,
        {
          method: "PATCH",
          body: {},
        },
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receivables"] });
      toast({
        title: "Invoice Submitted",
        description: "The sales invoice has been submitted for approval.",
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
      const response = await apiRequest(
        `/api/sales-invoices/${invoiceId}/approve`,
        {
          method: "PATCH",
          body: {},
        },
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receivables"] });
      toast({
        title: "Invoice Approved",
        description: "The sales invoice has been approved and general ledger entries have been posted.",
      });
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
      const response = await apiRequest(
        `/api/sales-invoices/${invoiceId}/reject`,
        {
          method: "PATCH",
          body: { reason },
        },
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receivables"] });
      toast({
        title: "Invoice Rejected",
        description: "The sales invoice has been rejected.",
        variant: "destructive",
      });
      setIsInvoiceRejectDialogOpen(false);
      setInvoiceRejectionReason("");
      setSelectedInvoice(null);
      setIsInvoiceDetailsOpen(false);
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
    mutationFn: async ({
      invoiceId,
      cancellationReason,
    }: {
      invoiceId: number;
      cancellationReason: string;
    }) => {
      const response = await apiRequest(
        `/api/sales-invoices/${invoiceId}/cancel`,
        { method: "PATCH", body: { cancellationReason } },
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receivables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/general-ledger"] });
      toast({
        title: "Invoice Cancelled",
        description: "The sales invoice has been cancelled and reversal ledger entries have been posted.",
      });
      setCancellationReason("");
      setSelectedInvoice(null);
      setIsInvoiceDetailsOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Cannot Cancel Invoice",
        description: error.message || "Failed to cancel invoice",
        variant: "destructive",
      });
    },
  });


  const recordPaymentMutation = useMutation({
    mutationFn: async (data: CreatePaymentData & { files?: FileList }) => {
      const formData = new FormData();

      // Append payment data
      formData.append("invoiceId", data.invoiceId.toString());
      formData.append("amount", data.amount);
      formData.append("paymentDate", data.paymentDate);
      formData.append("paymentMethod", data.paymentMethod);
      formData.append("referenceNumber", data.referenceNumber || "");
      formData.append("notes", data.notes || "");
      console.log("formData", formData);

      // Append files
      if (data.files) {
        for (let i = 0; i < data.files.length; i++) {
          formData.append("paymentFiles", data.files[i]);
        }
      }

      const response = await fetch(
        `/api/sales-invoices/${data.invoiceId}/payments`,
        {
          method: "POST",
          body: formData,
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to record payment");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receivables"] });
      queryClient.invalidateQueries({
        queryKey: [`/api/sales-invoices/${selectedInvoice?.id}/payments`],
      });
      toast({
        title: "Payment Recorded",
        description: "The payment has been recorded successfully.",
      });
      setIsPaymentDialogOpen(false);
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

  const resetInvoiceForm = () => {
    setInvoiceFormData({
      customerId: undefined,
      projectId: undefined,
      quotationId: undefined,
      status: "draft",
      invoiceDate: formatDateForInput(new Date()),
      dueDate: formatDateForInput(new Date()),
      items: [],
      discountPercentage: "0",
      discount: "0",
      subtotal: "0",
      taxAmount: "0",
      totalAmount: "0",
      remarks: "",
      workOrderNumber: "",
      subject: "",
      paymentTerms: "",
      bankAccount: "",
      billingAddress: "",
      termsAndConditions: "",
      // Both were missing while the declared initial state sets them, so a
      // reset form carried currency undefined and the totals panel rendered
      // its non-AED branch: "Exchange Rate: 1 undefined = undefined AED".
      currency: "AED",
      exchangeRate: "1",
    });
    setNewItem({
      description: "",
      quantity: "",
      unitPrice: "",
      taxRate: 0,
      taxAmount: 0,
      discount: "",
      discountType: "amount",
    });
    setEditingInvoiceItemIndex(null);
    // The invoice dialog is reused for create and edit, so a dismissed edit must
    // also drop the row it was editing and its note — otherwise the next "New
    // Invoice" would save over that row.
    setEditingInvoiceId(null);
    setEditNote("");
  };

  const resetPaymentForm = () => {
    setPaymentFormData({
      invoiceId: 0,
      amount: "0",
      paymentDate: formatDateForInput(new Date()),
      paymentMethod: "bank_transfer",
      referenceNumber: "",
      notes: "",
      recordedBy: undefined,
    });
    setSelectedPaymentFiles(null);
  };

  const openPaymentDialog = (invoice: SalesInvoice) => {
    setSelectedInvoice(invoice);
    const outstandingAmount =
      parseFloat(invoice.totalAmount || "0") -
      parseFloat(invoice.paidAmount || "0");
    setPaymentFormData({
      invoiceId: invoice.id,
      amount: outstandingAmount.toFixed(2),
      paymentDate: formatDateForInput(new Date()),
      paymentMethod: "bank_transfer",
      referenceNumber: "",
      notes: "",
      recordedBy: undefined,
    });
    setIsPaymentDialogOpen(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentFormData.amount || parseFloat(paymentFormData.amount) <= 0) {
      toast({
        title: "Error",
        description: "Payment amount must be greater than zero",
        variant: "destructive",
      });
      return;
    }

    recordPaymentMutation.mutate({
      ...paymentFormData,
      files: selectedPaymentFiles,
    });
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

  const handleInvoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!invoiceFormData.customerId) {
      toast({
        title: "Error",
        description: "Please select a customer",
        variant: "destructive",
      });
      return;
    }

    if (invoiceFormData.items.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item to the invoice",
        variant: "destructive",
      });
      return;
    }

    if (!invoiceFormData.invoiceDate || !invoiceFormData.dueDate) {
      toast({
        title: "Error",
        description: "Please set invoice date and due date",
        variant: "destructive",
      });
      return;
    }

    // Additional validation for date format
    const invoiceDate = new Date(invoiceFormData.invoiceDate);
    const dueDate = new Date(invoiceFormData.dueDate);

    if (isNaN(invoiceDate.getTime()) || isNaN(dueDate.getTime())) {
      toast({
        title: "Error",
        description: "Please enter valid dates",
        variant: "destructive",
      });
      return;
    }

    if (dueDate < invoiceDate) {
      toast({
        title: "Error",
        description: "Due date cannot be earlier than invoice date",
        variant: "destructive",
      });
      return;
    }

    console.log("Submitting invoice data:", invoiceFormData);
    if (editingInvoiceId) {
      if (editRequiresNote && !editNote.trim()) {
        toast({
          title: "Error",
          description: "Please provide an edit note explaining the changes",
          variant: "destructive",
        });
        return;
      }
      updateInvoiceMutation.mutate({ id: editingInvoiceId, data: invoiceFormData, editNote: editNote.trim() });
    } else {
      createInvoiceMutation.mutate(invoiceFormData);
    }
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

  const addInvoiceItem = () => {
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
    const taxAmount = (lineSubtotal - lineDiscount) * (taxRate / 100);

    const item = {
      description: newItem.description,
      quantity,
      unitPrice,
      taxRate,
      taxAmount,
      discount,
      discountType,
    };

    setInvoiceFormData(prev => ({
      ...prev,
      items:
        editingInvoiceItemIndex === null
          ? [...prev.items, item]
          : prev.items.map((existing, i) =>
            i === editingInvoiceItemIndex ? item : existing,
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
    setEditingInvoiceItemIndex(null);
  };

  const startEditInvoiceItem = (index: number) => {
    const item = invoiceFormData.items[index];
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
    setEditingInvoiceItemIndex(index);
    focusItemForm(invoiceItemFormRef, invoiceDescriptionRef);
  };

  const cancelEditInvoiceItem = () => {
    setNewItem({
      description: "",
      quantity: "",
      unitPrice: "",
      taxRate: customerVatTreatment === "standard" ? 5 : 0,
      taxAmount: 0,
      discount: "",
      discountType: "amount",
    });
    setEditingInvoiceItemIndex(null);
  };

  const removeInvoiceItem = (index: number) => {
    setInvoiceFormData((prev) => ({
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

  const getInvoiceStatusBadge = (status: string) => {
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
      approved: {
        icon: CheckCircle,
        class:
          "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
        label: "Approved",
      },
      rejected: {
        icon: XCircle,
        class: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
        label: "Rejected",
      },
      unpaid: {
        icon: Clock,
        class:
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
        label: "Unpaid",
      },
      partially_paid: {
        icon: AlertTriangle,
        class:
          "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
        label: "Partially Paid",
      },
      paid: {
        icon: CheckCircle,
        class:
          "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
        label: "Paid",
      },
      overdue: {
        icon: XCircle,
        class: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
        label: "Overdue",
      },
      cancelled: {
        icon: XCircle,
        class: "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400 line-through",
        label: "Cancelled",
      },
    };

    const config =
      statusConfig[status as keyof typeof statusConfig] || statusConfig.unpaid;
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

  // Bare number for the line-item columns. The document's currency is stated
  // once on the key-facts band and again on the totals, so repeating it on
  // every cell only crowds the table. Mirrors the purchase invoice view.
  const formatAmount = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return num.toFixed(2);
  };

  const formatDate = (date: string | Date) => {
    return formatDisplayDate(date);
  };

  const totalQuotationValue = parseFloat(salesStats?.totalQuotationValue || "0");
  const totalInvoiceValue = parseFloat(salesStats?.totalInvoiceValue || "0");
  const totalReceivablesValue = parseFloat(salesStats?.totalReceivablesValue || "0");

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

  const openInvoiceDetails = (invoice: SalesInvoice) => {
    setSelectedInvoice(invoice);
    setIsInvoiceDetailsOpen(true);
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

  const handlePrintInvoice = async (invoice: SalesInvoice) => {
    try {
      const response = await fetch(`/api/sales-invoices/${invoice.id}/pdf`, {
        method: "GET",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      });

      if (!response.ok) {
        throw new Error("Failed to generate PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // Open the PDF in a new window for printing
      const newWindow = window.open(url, "_blank");
      if (newWindow) {
        newWindow.onload = () => {
          newWindow.print();
          // Revoke the blob URL after printing
          newWindow.onafterprint = () => {
            window.URL.revokeObjectURL(url);
            newWindow.close(); // Close the blank window after printing
          };
        };
      } else {
        // Handle the case where the new window couldn't be opened
        toast({
          title: "Error",
          description:
            "Failed to open print preview. Please check your browser settings.",
          variant: "destructive",
        });
        window.URL.revokeObjectURL(url); // Revoke the blob URL in case of an error
      }

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


  const handleDuplicateInvoice = async (invoice: any) => {
    let source = invoice;
    if (!invoice.items || invoice.items.length === 0) {
      try {
        const response = await apiRequest(`/api/sales-invoices/${invoice.id}`, { method: "GET" });
        if (response.ok) {
          source = await response.json();
        }
      } catch { }
    }
    setEditingInvoiceId(null);
    setInvoiceFormData({
      customerId: source.customerId,
      projectId: source.projectId || undefined,
      quotationId: undefined,
      status: "draft",
      invoiceDate: formatDateForInput(new Date()),
      dueDate: formatDateForInput(new Date()),
      items: (source.items || []).map((item: any) => ({ ...item })),
      discountPercentage: source.discountPercentage || "0",
      discount: source.discount || "0",
      subtotal: source.subtotal || "0",
      taxAmount: source.taxAmount || "0",
      totalAmount: source.totalAmount || "0",
      currency: source.currency || "AED",
      exchangeRate: source.exchangeRate || "1",
      remarks: source.remarks || "",
      workOrderNumber: source.workOrderNumber || "",
      subject: source.subject || "",
      paymentTerms: source.paymentTerms || "",
      bankAccount: source.bankAccount || "",
      billingAddress: source.billingAddress || "",
      termsAndConditions: source.termsAndConditions || "",
    });
    setEditNote("");
    setIsInvoiceDetailsOpen(false);
    setIsInvoiceDialogOpen(true);
    toast({
      title: "Invoice Duplicated",
      description: "A new draft invoice has been pre-filled. Review and save to create it.",
    });
  };

  const handleEditInvoice = async (invoice: any) => {
    setEditingInvoiceId(invoice.id);
    setSelectedInvoice(invoice);

    // The customer's currency is authoritative — an invoice must always be
    // denominated in the currency of the customer it bills. Historic rows can
    // disagree (they were created before that was enforced, or the customer was
    // switched afterwards), so derive it here instead of trusting what was
    // stored. Only look the rate up when the currency actually changes; an
    // invoice that already agrees keeps the rate it was issued at.
    const editCustomer = customers?.find((c) => c.id === invoice.customerId);
    const derivedCurrency =
      editCustomer?.currency || invoice.currency || "AED";
    let derivedExchangeRate = invoice.exchangeRate || "1";

    if (derivedCurrency !== (invoice.currency || "AED")) {
      derivedExchangeRate = "1";
      if (derivedCurrency !== "AED") {
        try {
          const response = await apiRequest(
            `/api/exchange-rates/lookup?from=${derivedCurrency}`,
          );
          const data = await response.json();
          derivedExchangeRate = data.rate;
        } catch (error) {
          console.error("Failed to lookup exchange rate:", error);
        }
      }
    }

    setInvoiceFormData({
      customerId: invoice.customerId,
      projectId: invoice.projectId || undefined,
      quotationId: invoice.quotationId || undefined,
      status: invoice.status,
      invoiceDate: formatDateForInput(invoice.invoiceDate) || formatDateForInput(new Date()),
      dueDate: formatDateForInput(invoice.dueDate) || formatDateForInput(new Date()),
      items: invoice.items || [],
      discountPercentage: invoice.discountPercentage || "0",
      discount: invoice.discount || "0",
      subtotal: invoice.subtotal || "0",
      taxAmount: invoice.taxAmount || "0",
      totalAmount: invoice.totalAmount || "0",
      currency: derivedCurrency,
      exchangeRate: derivedExchangeRate,
      remarks: invoice.remarks || "",
      workOrderNumber: invoice.workOrderNumber || "",
      subject: invoice.subject || "",
      paymentTerms: invoice.paymentTerms || "",
      bankAccount: invoice.bankAccount || "",
      billingAddress: invoice.billingAddress || "",
      termsAndConditions: invoice.termsAndConditions || "",
    });
    setEditNote("");
    setIsInvoiceDialogOpen(true);
  };

  const handleConvertToInvoice = (quotation: SalesQuotation) => {
    setInvoiceFormData({
      customerId: quotation.customerId,
      projectId: undefined,
      quotationId: quotation.id,
      status: "draft",
      invoiceDate: formatDateForInput(new Date()),
      dueDate: formatDateForInput(new Date()),

      // ✅ COPY FROM QUOTATION
      billingAddress: quotation.billingAddress || "",
      bankAccount: quotation.bankAccount || "",
      subject: quotation.subject || "",
      paymentTerms: quotation.paymentTerms || "",
      termsAndConditions: quotation.termsAndConditions || "",
      remarks: quotation.remarks || "",

      items: quotation.items || [],
      discountPercentage: quotation.discountPercentage || "0",
      discount: quotation.discount || "0",
      subtotal: quotation.subtotal || "0",
      taxAmount: quotation.taxAmount || "0",
      totalAmount: quotation.totalAmount || "0",
      currency: quotation.currency || "AED",
      exchangeRate: quotation.exchangeRate || "1",
      workOrderNumber: "",
    });

    setIsInvoiceDialogOpen(true);
  };

  const totalQuotationsPages = quotationsResponse?.pagination?.totalPages || 1;
  const paginatedQuotations = quotations;

  const totalInvoicesPages = invoicesResponse?.pagination?.totalPages || 1;
  const paginatedInvoices = invoices;


  useEffect(() => {
    setQuotationsCurrentPage(1);
  }, [debouncedSearchFilter, statusFilter, customerFilter, archivedFilter, startDateFilter, endDateFilter]);

  useEffect(() => {
    setInvoicesCurrentPage(1);
  }, [debouncedInvoiceSearchFilter, invoiceStatusFilter, invoiceCustomerFilter, invoiceProjectFilter, invoiceStartDateFilter, invoiceEndDateFilter]);

  useEffect(() => {
    if (!invoiceFormData.customerId || !customers) return;

    const customer = customers.find(
      c => c.id === invoiceFormData.customerId
    );
    const vatTreatment = customer?.vatTreatment ?? null;
    const taxRate = vatTreatment === "standard" ? 5 : 0;

    setCustomerVatTreatment(vatTreatment);

    // Default VAT for new invoice items
    setNewItem(prev => ({
      ...prev,
      taxRate,
    }));

    // OPTIONAL: update existing invoice items
    // setInvoiceFormData(prev => ({
    //   ...prev,
    //   items: prev.items.map(item => ({
    //     ...item,
    //     taxRate,
    //     taxAmount:
    //       item.quantity * item.unitPrice * (taxRate / 100),
    //   })),
    // }));
  }, [invoiceFormData.customerId, customers]);

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
              Sales & Invoicing
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Manage quotations and customer invoices
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
                                  const lineSubtotal =
                                    item.quantity * item.unitPrice;
                                  const lineDiscount =
                                    item.discountType === "percentage"
                                      ? lineSubtotal * ((Number(item.discount) || 0) / 100)
                                      : Math.min(Number(item.discount) || 0, lineSubtotal);
                                  const taxable = lineSubtotal - lineDiscount;
                                  const taxAmount =
                                    taxable * ((item.taxRate || 0) / 100);
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

            <Dialog
              open={isInvoiceDialogOpen}
              onOpenChange={(open) => { setIsInvoiceDialogOpen(open); if (!open) resetInvoiceForm(); }}
            >
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    resetInvoiceForm();
                    setEditingInvoiceId(null);
                    setIsInvoiceDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Invoice
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingInvoiceId ? `Edit Sales Invoice — ${selectedInvoice?.invoiceNumber}` : "Create Sales Invoice"}</DialogTitle>
                  <DialogDescription>
                    {editingInvoiceId ? "Update the details of this invoice." : "Fill in the details to create a new sales invoice."}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleInvoiceSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="invoiceCustomerId">Customer *</Label>
                      <Autocomplete
                        options={(customers || []).map((customer) => ({
                          value: customer.id.toString(),
                          label: customer.name,
                          searchText: `${customer.name} ${customer.email || ""} ${customer.phone || ""}`
                        }))}
                        value={invoiceFormData.customerId?.toString() || ""}
                        onValueChange={(value) => {
                          const selectedCustomer = customers?.find(
                            (c) => c.id === parseInt(value)
                          );
                          const customerCurrency = selectedCustomer?.currency || "AED";
                          startTransition(() =>
                            setInvoiceFormData((prev) => ({
                              ...prev,
                              customerId: parseInt(value),
                              billingAddress: selectedCustomer?.address || "",
                              currency: customerCurrency,
                              exchangeRate: customerCurrency === "AED" ? "1" : prev.exchangeRate,
                            })),
                          );
                          if (customerCurrency && customerCurrency !== "AED") {
                            fetch(`/api/exchange-rates/lookup?from=${customerCurrency}&to=AED`)
                              .then(res => res.json())
                              .then(data => {
                                if (data.rate) {
                                  setInvoiceFormData(prev => ({
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
                      {invoiceFormData.currency && invoiceFormData.currency !== "AED" && (
                        <div className="text-sm text-muted-foreground mt-1">
                          Currency: {invoiceFormData.currency} | Exchange Rate: {invoiceFormData.exchangeRate} (to AED)
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invoiceProjectId">
                        Project (Optional)
                      </Label>
                      <Select
                        value={invoiceFormData.projectId?.toString() || ""}
                        onValueChange={(value) =>
                          startTransition(() =>
                            setInvoiceFormData((prev) => ({
                              ...prev,
                              projectId:
                                value === "no-project"
                                  ? undefined
                                  : parseInt(value),
                            })),
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no-project">No Project</SelectItem>
                          {projects
                            ?.filter((project) => project.id)
                            .map((project) => (
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
                        value={invoiceFormData.invoiceDate || ""}
                        onChange={(e) =>
                          startTransition(() =>
                            setInvoiceFormData((prev) => ({
                              ...prev,
                              invoiceDate: e.target.value,
                            })),
                          )
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dueDate">Due Date *</Label>
                      <Input
                        id="dueDate"
                        type="date"
                        value={invoiceFormData.dueDate || ""}
                        onChange={(e) =>
                          startTransition(() =>
                            setInvoiceFormData((prev) => ({
                              ...prev,
                              dueDate: e.target.value,
                            })),
                          )
                        }
                        required
                        disabled
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invoiceSubject">Subject Line</Label>
                    <Input
                      id="invoiceSubject"
                      value={invoiceFormData.subject || ""}
                      onChange={(e) =>
                        startTransition(() =>
                          setInvoiceFormData((prev) => ({
                            ...prev,
                            subject: e.target.value,
                          })),
                        )
                      }
                      placeholder="Enter invoice subject"
                    />
                  </div>

                  {/* Payment Details Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="invoicePaymentTerms">Payment Terms</Label>
                      <Select
                        value={invoiceFormData.paymentTerms || ""}
                        onValueChange={(value) =>
                          startTransition(() =>
                            setInvoiceFormData((prev) => ({
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
                      <Label htmlFor="workOrderNumber">Work Order Number</Label>
                      <Input
                        id="workOrderNumber"
                        value={invoiceFormData.workOrderNumber || ""}
                        onChange={(e) =>
                          startTransition(() =>
                            setInvoiceFormData((prev) => ({
                              ...prev,
                              workOrderNumber: e.target.value,
                            })),
                          )
                        }
                        placeholder="Enter work order number"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="invoiceBankAccount">Bank Account</Label>
                        {company && (company.bankAccount || company.bankAccount2) && (
                          <div className="flex gap-2">
                            {company.bankAccount && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px] px-2"
                                onClick={() => setInvoiceFormData(prev => ({ ...prev, bankAccount: company.bankAccount }))}
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
                                onClick={() => setInvoiceFormData(prev => ({ ...prev, bankAccount: company.bankAccount2 }))}
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
                          value={invoiceFormData.bankAccount || ""}
                          onChange={(value) =>
                            startTransition(() =>
                              setInvoiceFormData((prev) => ({
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
                    <Label htmlFor="invoiceBillingAddress">Billing Address</Label>
                    <textarea
                      id="invoiceBillingAddress"
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={invoiceFormData.billingAddress || ""}
                      onChange={(e) =>
                        startTransition(() =>
                          setInvoiceFormData((prev) => ({
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
                    <Label htmlFor="invoiceTermsAndConditions">Terms & Conditions</Label>
                    <textarea
                      id="invoiceTermsAndConditions"
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={invoiceFormData.termsAndConditions || ""}
                      onChange={(e) =>
                        startTransition(() =>
                          setInvoiceFormData((prev) => ({
                            ...prev,
                            termsAndConditions: e.target.value,
                          })),
                        )
                      }
                      placeholder="Enter terms and conditions for this invoice"
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invoiceRemarks">Notes</Label>
                    <div className="mt-1 border border-input rounded-md overflow-hidden text-sm">
                      <ReactQuill
                        theme="snow"
                        value={invoiceFormData.remarks || ""}
                        onChange={(value) =>
                          startTransition(() =>
                            setInvoiceFormData((prev) => ({
                              ...prev,
                              remarks: value,
                            })),
                          )
                        }
                        placeholder="Additional notes for this invoice"
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

                  {/* Services Section for Invoice */}
                  <div className="space-y-4">
                    <Label className="text-base font-medium">Services</Label>

                    {/* Add Service Form for Invoice */}
                    <Card ref={invoiceItemFormRef}>
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                          <div className="md:col-span-2 lg:col-span-4">
                            <Label className="text-xs text-gray-600">
                              Description
                            </Label>
                            <Textarea
                              ref={invoiceDescriptionRef}
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
                                  {invoiceFormData.currency || "AED"}
                                </option>
                                <option value="percentage">%</option>
                              </select>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col md:flex-row gap-2">
                          <Button
                            type="button"
                            onClick={addInvoiceItem}
                            size="sm"
                            className="w-full md:w-auto"
                          >
                            {editingInvoiceItemIndex === null ? (
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
                          {editingInvoiceItemIndex !== null && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={cancelEditInvoiceItem}
                              className="w-full md:w-auto"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Cancel
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Services List for Invoice */}
                    {invoiceFormData.items.length > 0 && (
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
                                {invoiceFormData.items.map((item, index) => {
                                  const lineSubtotal =
                                    item.quantity * item.unitPrice;
                                  const lineDiscount =
                                    item.discountType === "percentage"
                                      ? lineSubtotal * ((Number(item.discount) || 0) / 100)
                                      : Math.min(Number(item.discount) || 0, lineSubtotal);
                                  const taxable = lineSubtotal - lineDiscount;
                                  const taxAmount =
                                    taxable * ((item.taxRate || 0) / 100);
                                  const lineTotal = taxable + taxAmount;

                                  return (
                                    <tr
                                      key={index}
                                      className={
                                        editingInvoiceItemIndex === index
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
                                        {invoiceFormData.currency || "AED"} {(typeof item.unitPrice === 'number' ? item.unitPrice : 0).toFixed(2)}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-right">
                                        {(Number(item.discount) || 0) > 0
                                          ? item.discountType === "percentage"
                                            ? `${item.discount}%`
                                            : `${invoiceFormData.currency || "AED"} ${(Number(item.discount) || 0).toFixed(2)}`
                                          : "-"}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-right">
                                        {item.taxRate || 0}%
                                      </td>
                                      <td className="px-4 py-3 text-sm text-right">
                                        {invoiceFormData.currency || "AED"} {taxAmount.toFixed(2)}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-right font-medium">
                                        {invoiceFormData.currency || "AED"} {lineTotal.toFixed(2)}
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
                                            data-testid={`button-edit-invoice-item-${index}`}
                                            onClick={() =>
                                              startEditInvoiceItem(index)
                                            }
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                            title={
                                              editingInvoiceItemIndex !== null
                                                ? "Finish or cancel the current edit first"
                                                : "Remove item"
                                            }
                                            aria-label="Remove item"
                                            data-testid={`button-remove-invoice-item-${index}`}
                                            disabled={
                                              editingInvoiceItemIndex !== null
                                            }
                                            onClick={() =>
                                              removeInvoiceItem(index)
                                            }
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

                  {/* Financial Summary for Invoice */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm">Discounts</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="invoiceDiscountPercentage">Discount (%)</Label>
                          <Input
                            id="invoiceDiscountPercentage"
                            type="number"
                            min="0"
                            max="100"
                            step="any"
                            value={invoiceFormData.discountPercentage}
                            onChange={(e) => {
                              const val = e.target.value;
                              const pct = parseFloat(val) || 0;
                              const calcDiscount = (invoiceSubtotalValue * pct / 100);
                              setInvoiceFormData(prev => ({
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
                          <Label htmlFor="invoiceDiscountAmount">Discount Amount ({invoiceFormData.currency})</Label>
                          <Input
                            id="invoiceDiscountAmount"
                            type="number"
                            min="0"
                            step="any"
                            value={invoiceFormData.discount}
                            onChange={(e) => {
                              const val = e.target.value;
                              // A typed amount is authoritative, so the percentage is
                              // cleared rather than derived: the totals, the stored
                              // record and the PDF all prefer a percentage whenever
                              // one is set, and a derived one would round the amount.
                              setInvoiceFormData(prev => ({
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
                      <h4 className="font-semibold mb-3 text-sm">Invoice Summary</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span className="font-medium">{formatCurrency(invoiceTotals.gross, invoiceFormData.currency)}</span>
                        </div>
                        {invoiceTotals.discountTotal > 0 && (
                          <div className="flex justify-between text-sm text-red-600">
                            <span>Total Discount:</span>
                            <span className="font-medium">- {formatCurrency(invoiceTotals.discountTotal, invoiceFormData.currency)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Tax Amount:</span>
                          <span className="font-medium">{formatCurrency(invoiceTotals.taxTotal, invoiceFormData.currency)}</span>
                        </div>
                        <div className="border-t pt-2">
                          <div className="flex justify-between text-lg font-bold">
                            <span>Total Amount:</span>
                            <span className="text-blue-600">{formatCurrency(invoiceTotals.total, invoiceFormData.currency)}</span>
                          </div>
                          {invoiceFormData.currency !== "AED" && (
                            <div className="text-xs text-muted-foreground mt-2 text-right">
                              Exchange Rate: 1 {invoiceFormData.currency} = {invoiceFormData.exchangeRate} AED
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Form Actions */}
                  {editRequiresNote && (
                    <div className="space-y-2 border-t pt-4 mt-4">
                      <Label className="text-sm font-medium text-red-600">Edit Note (Required) *</Label>
                      <Textarea
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        placeholder="Explain the reason for this edit..."
                        className="min-h-[80px]"
                      />
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setIsInvoiceDialogOpen(false); resetInvoiceForm(); }}
                      className="w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createInvoiceMutation.isPending || updateInvoiceMutation.isPending}
                      className="w-full sm:w-auto"
                    >
                      {editingInvoiceId
                        ? (updateInvoiceMutation.isPending ? "Updating..." : "Update Invoice")
                        : (createInvoiceMutation.isPending ? "Creating..." : "Create Invoice")}
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
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <FileText className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Invoices
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {salesStats?.totalInvoices || 0}
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

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Total Receivables
                </p>
                <div className="flex flex-col">
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {formatCurrency(totalReceivablesValue, "AED")}
                  </p>
                  <p className="text-xs text-slate-500 italic">AED Equivalent</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                <FileText className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Invoice Value
                </p>
                <div className="flex flex-col">
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {formatCurrency(totalInvoiceValue, "AED")}
                  </p>
                  <p className="text-xs text-slate-500 italic">AED Equivalent</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="quotations" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="quotations">Quotations</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="quotations" className="space-y-6">
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
        </TabsContent>

        <TabsContent value="invoices" className="space-y-6">
          {/* Collapsible Invoice Filters */}
          <Card>
            <div
              className="flex items-center justify-between p-4 cursor-pointer select-none"
              onClick={() => setInvoiceFilterOpen((o) => !o)}
            >
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <span className="font-medium text-sm">Filters</span>
                {(() => {
                  const active = [
                    invoiceSearchFilter,
                    invoiceStatusFilter !== "all" ? invoiceStatusFilter : "",
                    invoiceCustomerFilter !== "all" ? invoiceCustomerFilter : "",
                    invoiceProjectFilter !== "all" ? invoiceProjectFilter : "",
                    invoiceStartDateFilter,
                    invoiceEndDateFilter,
                  ].filter(Boolean).length;
                  return active > 0 ? (
                    <Badge className="bg-primary text-primary-foreground text-xs px-1.5 py-0">{active}</Badge>
                  ) : null;
                })()}
              </div>
              {invoiceFilterOpen
                ? <ChevronUp className="h-4 w-4 text-slate-400" />
                : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>

            {invoiceFilterOpen && (
              <CardContent className="pt-0 pb-4 px-4 border-t">
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="invoiceSearchFilter" className="text-sm font-medium">Search</Label>
                      <Input
                        id="invoiceSearchFilter"
                        placeholder="Search invoices..."
                        value={invoiceSearchFilter}
                        onChange={(e) =>
                          startTransition(() => setInvoiceSearchFilter(e.target.value))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="invoiceStatusFilter" className="text-sm font-medium">Status</Label>
                      <Select
                        value={invoiceStatusFilter}
                        onValueChange={(value) =>
                          startTransition(() => setInvoiceStatusFilter(value))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="unpaid">Unpaid (Including Partial & Overdue)</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="partially_paid">Partially Paid</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="invoiceCustomerFilter" className="text-sm font-medium">Customer</Label>
                      <Autocomplete
                        options={[
                          { value: "all", label: "All Customers" },
                          ...(customers || []).map((customer) => ({
                            value: customer.id.toString(),
                            label: customer.name,
                            searchText: `${customer.name} ${customer.email || ""} ${customer.phone || ""}`,
                          }))
                        ]}
                        value={invoiceCustomerFilter}
                        onValueChange={(value) =>
                          startTransition(() => setInvoiceCustomerFilter(value))
                        }
                        placeholder="Search customer..."
                        emptyMessage="No customers found"
                      />
                    </div>
                    <div>
                      <Label htmlFor="invoiceProjectFilter" className="text-sm font-medium">Project</Label>
                      <Select
                        value={invoiceProjectFilter}
                        onValueChange={(value) =>
                          startTransition(() => setInvoiceProjectFilter(value))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Projects" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Projects</SelectItem>
                          <SelectItem value="no-project">No Project</SelectItem>
                          {projects?.map((project) => (
                            <SelectItem key={project.id} value={project.id.toString()}>
                              {project.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="invoiceStartDate" className="text-sm font-medium">Invoice Date From</Label>
                      <Input
                        id="invoiceStartDate"
                        type="date"
                        value={invoiceStartDateFilter}
                        onChange={(e) =>
                          startTransition(() => setInvoiceStartDateFilter(e.target.value))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="invoiceEndDate" className="text-sm font-medium">Invoice Date To</Label>
                      <Input
                        id="invoiceEndDate"
                        type="date"
                        value={invoiceEndDateFilter}
                        onChange={(e) =>
                          startTransition(() => setInvoiceEndDateFilter(e.target.value))
                        }
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); setIsReceivablesOpen(true); }}
                        className="w-full"
                      >
                        View Receivables
                      </Button>
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          startTransition(() => {
                            setInvoiceSearchFilter("");
                            setInvoiceStatusFilter("unpaid");
                            setInvoiceCustomerFilter("all");
                            setInvoiceProjectFilter("all");
                            setInvoiceStartDateFilter("");
                            setInvoiceEndDateFilter("");
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

          {invoicesLoading ? (
            <div className="text-center py-12">
              <p className="text-slate-500 dark:text-slate-400">
                Loading invoices...
              </p>
            </div>
          ) : !invoices || invoices.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="h-16 w-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                  No invoices found
                </h3>
                <p className="text-slate-500 dark:text-slate-400">
                  Invoices will appear here when created from approved
                  quotations
                </p>
              </CardContent>
            </Card>
          ) : invoices.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="h-16 w-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                  No invoices match your filter
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mb-6">
                  Try adjusting your filter to see more results
                </p>
                <Button
                  onClick={() =>
                    startTransition(() => setInvoiceStatusFilter("all"))
                  }
                  variant="outline"
                >
                  Show All Invoices
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {paginatedInvoices.map((invoice) => (
                <Card
                  key={invoice.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openInvoiceDetails(invoice)}
                  onKeyDown={(e) => {
                    // A keypress on an inline button bubbles to the row, so without
                    // this an Enter on Approve would both approve and open the dialog.
                    if (e.target !== e.currentTarget) {
                      return;
                    }
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openInvoiceDetails(invoice);
                    }
                  }}
                  className="cursor-pointer hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  data-testid={`card-invoice-${invoice.id}`}
                >
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-base sm:text-lg">
                            {invoice.invoiceNumber || (
                              <span className="text-slate-500 dark:text-slate-400 italic">
                                Draft Invoice (Pending Approval)
                              </span>
                            )}
                          </span>
                          {getInvoiceStatusBadge(invoice.status)}
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Customer:{" "}
                          {getCustomerName(
                            invoice.customerId,
                            invoice.customerName,
                          )}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-500">
                          Invoice Date: {formatDate(invoice.invoiceDate)}
                          {invoice.dueDate && (
                            <> • Due: {formatDate(invoice.dueDate)}</>
                          )}
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="text-left sm:text-right">
                          <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                            {formatCurrency(invoice.totalAmount || "0", invoice.currency)}
                          </p>
                          {invoice.paidAmount &&
                            parseFloat(invoice.paidAmount) > 0 && (
                              <p className="text-sm text-green-600 dark:text-green-400">
                                Paid: {formatCurrency(invoice.paidAmount, invoice.currency)}
                              </p>
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                          {invoice.status === "draft" && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditInvoice(invoice);
                                }}
                                className="w-full sm:w-auto"
                              >
                                <Pencil className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startTransition(() =>
                                    submitInvoiceMutation.mutate(invoice.id),
                                  );
                                }}
                                disabled={submitInvoiceMutation.isPending}
                                className="w-full sm:w-auto"
                                data-testid={`button-submit-invoice-${invoice.id}`}
                              >
                                <Send className="h-4 w-4 mr-1" />
                                {submitInvoiceMutation.isPending
                                  ? "Submitting..."
                                  : "Submit"}
                              </Button>
                            </>
                          )}
                          {["approved", "pending_approval", "unpaid", "overdue"].includes(invoice.status) && parseFloat(invoice.paidAmount || "0") === 0 && user?.role === "admin" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditInvoice(invoice);
                              }}
                              className="w-full sm:w-auto"
                            >
                              <Pencil className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          )}
                          {user?.role === "admin" &&
                            invoice.status === "pending_approval" && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startTransition(() =>
                                      approveInvoiceMutation.mutate(invoice.id),
                                    );
                                  }}
                                  disabled={approveInvoiceMutation.isPending}
                                  className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                                  data-testid={`button-approve-invoice-${invoice.id}`}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  {approveInvoiceMutation.isPending
                                    ? "Approving..."
                                    : "Approve"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedInvoice(invoice);
                                    setIsInvoiceRejectDialogOpen(true);
                                  }}
                                  disabled={rejectInvoiceMutation.isPending}
                                  className="w-full sm:w-auto border-red-300 text-red-600 hover:bg-red-50"
                                  data-testid={`button-reject-invoice-${invoice.id}`}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Reject
                                </Button>
                              </>
                            )}
                          {(invoice.status === "unpaid" ||
                            invoice.status === "partially_paid" ||
                            invoice.status === "overdue" ||
                            invoice.status === "approved") &&
                            invoice.invoiceNumber && (
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPaymentDialog(invoice);
                                }}
                                className="w-full sm:w-auto"
                                data-testid={`button-record-payment-${invoice.id}`}
                              >
                                <CreditCard className="h-4 w-4 mr-1" />
                                Record Payment
                              </Button>
                            )}
                          {invoice.invoiceNumber && (invoice.status === "unpaid" || invoice.status === "partially_paid") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(
                                  `/credit-notes?invoiceId=${invoice.id}`,
                                  "_blank",
                                );
                              }}
                              className="w-full sm:w-auto"
                              data-testid={`button-credit-note-${invoice.id}`}
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              Credit Note
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

          {/* Invoices Pagination */}
          {totalInvoicesPages > 1 && (
            <div className="flex justify-center mt-6">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (invoicesCurrentPage > 1) {
                          startTransition(() =>
                            setInvoicesCurrentPage(invoicesCurrentPage - 1),
                          );
                        }
                      }}
                      className={
                        invoicesCurrentPage <= 1
                          ? "pointer-events-none opacity-50"
                          : ""
                      }
                    />
                  </PaginationItem>

                  {Array.from(
                    { length: totalInvoicesPages },
                    (_, i) => i + 1,
                  ).map((page) => (
                    <PaginationItem key={page}>
                      <PaginationLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          startTransition(() => setInvoicesCurrentPage(page));
                        }}
                        isActive={page === invoicesCurrentPage}
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
                        if (invoicesCurrentPage < totalInvoicesPages) {
                          startTransition(() =>
                            setInvoicesCurrentPage(invoicesCurrentPage + 1),
                          );
                        }
                      }}
                      className={
                        invoicesCurrentPage >= totalInvoicesPages
                          ? "pointer-events-none opacity-50"
                          : ""
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </TabsContent>
      </Tabs>

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
                                  const lineTotal = taxable + taxAmount;

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
                              (selectedQuotation as any).rejectionReason ? (
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

      {/* Invoice Details Dialog */}
      <Dialog
        open={isInvoiceDetailsOpen}
        onOpenChange={setIsInvoiceDetailsOpen}
      >
        <DialogContent className="max-w-6xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
          {selectedInvoice ? (() => {
            const invoiceCurrency = selectedInvoice.currency || "AED";
            const showExchangeRate =
              invoiceCurrency !== "AED" && !!selectedInvoice.exchangeRate;
            const totalAmount = parseFloat(selectedInvoice.totalAmount || "0");
            const paidAmount = parseFloat(selectedInvoice.paidAmount || "0");
            // Total discount (header + line) derived from stored fields; the
            // `discount` column itself holds only the header portion.
            const totalDiscount =
              parseFloat(selectedInvoice.subtotal || "0") +
              parseFloat(selectedInvoice.taxAmount || "0") -
              totalAmount;
            const customer = customers?.find(
              (c) => c.id === selectedInvoice.customerId,
            );
            // Resolved once: the header band and the customer card both show it.
            const customerLabel = getCustomerName(
              selectedInvoice.customerId,
              selectedInvoice.customerName,
            );
            const projectTitle = projects?.find(
              (p) => p.id === selectedInvoice.projectId,
            )?.title;
            const fromQuotation = quotations?.find(
              (q) => q.id === selectedInvoice.quotationId,
            )?.quotationNumber;
            // Drafts and pending invoices cannot hold payments, so the tab is
            // dropped rather than shown empty — same rule the old section used.
            const canHavePayments = [
              "approved",
              "unpaid",
              "partially_paid",
              "overdue",
              "paid",
            ].includes(selectedInvoice.status);
            const hasCommercialTerms = !!(
              selectedInvoice.paymentTerms ||
              selectedInvoice.workOrderNumber ||
              fromQuotation ||
              projectTitle ||
              showExchangeRate
            );

            return (
              <>
                {/* Header band. Document actions (edit, duplicate, print) live
                    up here; status-flow actions (submit, approve, pay, cancel)
                    stay in the footer. pr-5 sm:pr-14 keeps the buttons clear of
                    the dialog's own X. */}
                <header className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0 border-b border-[#E3E7EE] py-4 pl-5 sm:pl-6 pr-5 sm:pr-14 print:border-b-2 print:border-black">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <div className="grid place-items-center w-[42px] h-[42px] shrink-0 rounded-[10px] bg-[#EEF2FE] border border-[#DCE4FB] print:bg-blue-100">
                      <FileText className="w-5 h-5 text-[#2B4ACB] print:text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#8A93A3] print:text-gray-700">
                        Sales invoice
                      </div>
                      <div className="flex items-center flex-wrap gap-2.5 mt-px">
                        {/* DialogTitle rather than a plain h2 so the dialog has
                            an accessible name. */}
                        <DialogTitle className="text-[19px] font-semibold tracking-[-0.01em] text-[#171B23] print:text-black">
                          {selectedInvoice.invoiceNumber || "Draft invoice"}
                        </DialogTitle>
                        <span className={`${DOC_STAMP} ${docStatusTone(selectedInvoice.status)}`}>
                          {selectedInvoice.status.replace(/_/g, " ")}
                        </span>
                        {fromQuotation && (
                          <span className="text-[11px] font-semibold tracking-[0.06em] px-[9px] py-[3px] rounded-[5px] border text-[#5B6472] bg-[#F7F9FC] border-[#E3E7EE]">
                            &larr; {fromQuotation}
                          </span>
                        )}
                      </div>
                      <div className="text-[13px] text-[#5B6472] mt-0.5 break-words print:text-gray-700">
                        <strong className="font-semibold text-[#171B23] print:text-black">
                          {customerLabel}
                        </strong>
                        {projectTitle && <>&nbsp;·&nbsp;{projectTitle}</>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0 print:hidden">
                    {(selectedInvoice.status === "draft" ||
                      (["approved", "pending_approval", "unpaid", "overdue"].includes(selectedInvoice.status) &&
                        parseFloat(selectedInvoice.paidAmount || "0") === 0 &&
                        user?.role === "admin")) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsInvoiceDetailsOpen(false);
                            handleEditInvoice(selectedInvoice);
                          }}
                          data-testid="button-edit-invoice-header"
                          className={DOC_BTN}
                        >
                          <Pencil className="w-[15px] h-[15px] text-[#5B6472]" />
                          Edit
                        </Button>
                      )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDuplicateInvoice(selectedInvoice)}
                      data-testid="button-duplicate-invoice-header"
                      className={DOC_BTN}
                    >
                      <Copy className="w-[15px] h-[15px] text-[#5B6472]" />
                      Duplicate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePrintInvoice(selectedInvoice)}
                      data-testid="button-print-invoice-header"
                      className={DOC_BTN}
                    >
                      <Printer className="w-[15px] h-[15px] text-[#5B6472]" />
                      Print
                    </Button>
                  </div>
                </header>

                {/* Key facts. flex rather than a fixed grid so the cells spread
                    evenly when one of them is absent. */}
                <div className="flex flex-wrap shrink-0 border-b border-[#E3E7EE] bg-[#F7F9FC] print:bg-white">
                  <div className={DOC_META_CELL}>
                    <div className={DOC_META_LABEL}>Invoice date</div>
                    <div className={DOC_META_VALUE}>{formatDate(selectedInvoice.invoiceDate)}</div>
                  </div>
                  <div className={DOC_META_CELL}>
                    <div className={DOC_META_LABEL}>Due date</div>
                    <div className={DOC_META_VALUE}>{formatDate(selectedInvoice.dueDate)}</div>
                  </div>
                  <div className={DOC_META_CELL}>
                    <div className={DOC_META_LABEL}>Currency</div>
                    <div className={DOC_META_VALUE}>{invoiceCurrency}</div>
                    {showExchangeRate && (
                      <div className="text-[12px] text-[#8A93A3] mt-px print:text-gray-700">
                        1 {invoiceCurrency} = {selectedInvoice.exchangeRate} AED
                      </div>
                    )}
                  </div>
                  <div className={DOC_META_CELL}>
                    <div className={DOC_META_LABEL}>Total amount</div>
                    <div className={DOC_META_VALUE}>
                      {formatCurrency(selectedInvoice.totalAmount || "0", invoiceCurrency)}
                    </div>
                  </div>
                  {canHavePayments && (
                    <div className={DOC_META_CELL}>
                      <div className={DOC_META_LABEL}>Balance due</div>
                      <div className={`${DOC_META_VALUE} text-[#B42318] print:text-red-700`}>
                        {formatCurrency((totalAmount - paidAmount).toFixed(2), invoiceCurrency)}
                      </div>
                      <div className="text-[12px] text-[#8A93A3] mt-px print:text-gray-700">
                        {formatCurrency(paidAmount.toFixed(2), invoiceCurrency)} paid
                      </div>
                    </div>
                  )}
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
                              {selectedInvoice.billingAddress && (
                                <div className="text-[13.5px] leading-[1.55] text-[#333B47] whitespace-pre-wrap break-words mt-2 print:text-black">
                                  {selectedInvoice.billingAddress}
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
                                  {selectedInvoice.paymentTerms && (
                                    <div className={DOC_KV_ROW}>
                                      <span className={DOC_KV_LABEL}>Payment terms</span>
                                      <span className={DOC_KV_VAL}>{selectedInvoice.paymentTerms}</span>
                                    </div>
                                  )}
                                  {selectedInvoice.workOrderNumber && (
                                    <div className={DOC_KV_ROW}>
                                      <span className={DOC_KV_LABEL}>Work order no.</span>
                                      <span className={DOC_KV_VAL}>{selectedInvoice.workOrderNumber}</span>
                                    </div>
                                  )}
                                  {fromQuotation && (
                                    <div className={DOC_KV_ROW}>
                                      <span className={DOC_KV_LABEL}>From quotation</span>
                                      <span className={DOC_KV_VAL}>{fromQuotation}</span>
                                    </div>
                                  )}
                                  {projectTitle && (
                                    <div className={DOC_KV_ROW}>
                                      <span className={DOC_KV_LABEL}>Project</span>
                                      <span className={DOC_KV_VAL}>{projectTitle}</span>
                                    </div>
                                  )}
                                  {showExchangeRate && (
                                    <div className={DOC_KV_ROW}>
                                      <span className={DOC_KV_LABEL}>Exchange rate</span>
                                      <span className={`${DOC_KV_VAL} text-[12.5px]`}>
                                        1 {invoiceCurrency} = {selectedInvoice.exchangeRate} AED
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
                        default — it is what the invoice is for. */}
                    {selectedInvoice.subject && (
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
                                {selectedInvoice.subject}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </div>
                    )}

                    {/* Invoice items, with the ledger totals at the foot of the
                        same card so the numbers sit under the lines they come
                        from. */}
                    <div className={DOC_CARD}>
                      <div className={DOC_CARD_HEAD}>
                        <Package className={DOC_CARD_ICON} />
                        <span className={DOC_CARD_TITLE}>Services / items</span>
                        <span className={DOC_COUNT}>{selectedInvoice.items?.length || 0} items</span>
                      </div>
                      {selectedInvoice.items && selectedInvoice.items.length > 0 ? (
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
                                {selectedInvoice.items.map((item, index) => {
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
                                  const lineTotal = taxable + taxAmount;

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
                                  {formatCurrency(selectedInvoice.subtotal || "0", invoiceCurrency)}
                                </span>
                              </div>
                              {totalDiscount > 0.005 && (
                                <div className={DOC_TROW}>
                                  <span className="text-[#5B6472] print:text-gray-700">Total discount</span>
                                  <span className="font-medium text-[#B42318] print:text-red-700">
                                    −{formatCurrency(totalDiscount.toFixed(2), invoiceCurrency)}
                                  </span>
                                </div>
                              )}
                              <div className={DOC_TROW}>
                                <span className="text-[#5B6472] print:text-gray-700">Tax</span>
                                <span className="font-medium">
                                  {formatCurrency(selectedInvoice.taxAmount || "0", invoiceCurrency)}
                                </span>
                              </div>
                              <div className={`${DOC_TROW} mt-[7px] pt-[9px] border-t-[3px] border-double border-[#171B23]`}>
                                <span className="text-sm font-semibold text-[#171B23] print:text-black">
                                  Total ({invoiceCurrency})
                                </span>
                                <span className="text-[17px] font-semibold text-[#2B4ACB] print:text-blue-600">
                                  {formatCurrency(selectedInvoice.totalAmount || "0", invoiceCurrency)}
                                </span>
                              </div>
                              {paidAmount > 0 && (
                                <>
                                  <div className={`${DOC_TROW} mt-1`}>
                                    <span className="text-[#5B6472] print:text-gray-700">Paid amount</span>
                                    <span className="font-medium text-[#027A48] print:text-green-700">
                                      − {formatCurrency(selectedInvoice.paidAmount || "0", invoiceCurrency)}
                                    </span>
                                  </div>
                                  <div className={`${DOC_TROW} pt-2 border-t border-[#E3E7EE]`}>
                                    <span className="text-sm font-semibold text-[#171B23] print:text-black">
                                      Balance due ({invoiceCurrency})
                                    </span>
                                    <span className="text-[17px] font-semibold text-[#B42318] print:text-red-700">
                                      {formatCurrency((totalAmount - paidAmount).toFixed(2), invoiceCurrency)}
                                    </span>
                                  </div>
                                </>
                              )}
                              {showExchangeRate && (
                                <div className="text-right text-[11.5px] text-[#8A93A3] mt-2.5 print:text-gray-700">
                                  Exchange rate 1 {invoiceCurrency} = {selectedInvoice.exchangeRate} AED
                                  <br />
                                  AED equivalent: AED {(totalAmount * parseFloat(selectedInvoice.exchangeRate || "1")).toFixed(2)}
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
                    {selectedInvoice.remarks && (
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
                                dangerouslySetInnerHTML={{ __html: sanitize(selectedInvoice.remarks) }}
                              />
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </div>
                    )}
                    {selectedInvoice.termsAndConditions && (
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
                                {selectedInvoice.termsAndConditions}
                              </p>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </div>
                    )}

                    {/* Bank account sits after the notes and terms: it is
                        settlement reference detail, read last. */}
                    {selectedInvoice.bankAccount && (
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
                                dangerouslySetInnerHTML={{ __html: sanitize(selectedInvoice.bankAccount) }}
                              />
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </div>
                    )}

                    {/* Activity — approval trail, payments and edit history in
                        one tabbed block rather than three stacked cards. The
                        whole card is collapsed on open so the dialog leads with
                        the document; payments and edit history fetch on first
                        click of their tab, so expanding costs one request. */}
                    <div className={`${DOC_CARD} print:hidden`}>
                      <button
                        type="button"
                        onClick={() => setInvoiceActivityOpen((o) => !o)}
                        aria-expanded={invoiceActivityOpen}
                        className={`${DOC_CARD_HEAD} w-full text-left cursor-pointer hover:bg-[#F7F9FC] ${invoiceActivityOpen ? "" : "border-b-0"}`}
                        data-testid="button-toggle-invoice-activity"
                      >
                        <History className={DOC_CARD_ICON} />
                        <span className={DOC_CARD_TITLE}>Activity</span>
                        <span className="ml-auto">
                          {invoiceActivityOpen ? (
                            <ChevronUp className="w-4 h-4 text-[#8A93A3]" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-[#8A93A3]" />
                          )}
                        </span>
                      </button>
                      {invoiceActivityOpen && (
                        <div className={DOC_CARD_BODY}>
                          <Tabs value={invoiceActivityTab} onValueChange={setInvoiceActivityTab}>
                            <TabsList>
                              <TabsTrigger value="approval" data-testid="tab-invoice-approval">
                                Approval
                              </TabsTrigger>
                              {canHavePayments && (
                                <TabsTrigger value="payments" data-testid="tab-invoice-payments">
                                  Payments
                                  {invoicePayments ? ` (${invoicePayments.length})` : ""}
                                </TabsTrigger>
                              )}
                              <TabsTrigger value="history" data-testid="tab-invoice-edit-history">
                                Edit History
                                {invoiceEditHistory ? ` (${invoiceEditHistory.length})` : ""}
                              </TabsTrigger>
                            </TabsList>

                            {/* Approval trail. The names are resolved
                                server-side on the list rows: /api/users is
                                admin-only while finance can open this dialog,
                                so looking them up from here would 403. */}
                            <TabsContent value="approval" className="mt-4">
                              {(selectedInvoice as any).submittedAt ||
                              (selectedInvoice as any).approvedAt ||
                              (selectedInvoice as any).rejectionReason ||
                              (selectedInvoice as any).cancelledAt ? (
                                <ul className={DOC_TIMELINE}>
                                  {(selectedInvoice as any).submittedAt && (
                                    <li className="relative pb-4 last:pb-0">
                                      <span className={`${DOC_DOT} border-[#8A93A3]`} />
                                      <div className="text-[13.5px] font-semibold">Submitted for approval</div>
                                      <div className="text-[12.5px] text-[#8A93A3] mt-px">
                                        {(selectedInvoice as any).submittedByName || "—"} ·{" "}
                                        {new Date((selectedInvoice as any).submittedAt).toLocaleString()}
                                      </div>
                                    </li>
                                  )}
                                  {(selectedInvoice as any).approvedAt && (
                                    <li className="relative pb-4 last:pb-0">
                                      <span className={`${DOC_DOT} border-[#12B76A]`} />
                                      <div className="text-[13.5px] font-semibold">Approved</div>
                                      <div className="text-[12.5px] text-[#8A93A3] mt-px">
                                        {(selectedInvoice as any).approvedByName || "—"} ·{" "}
                                        {new Date((selectedInvoice as any).approvedAt).toLocaleString()}
                                      </div>
                                    </li>
                                  )}
                                  {(selectedInvoice as any).rejectionReason && (
                                    <li className="relative pb-4 last:pb-0">
                                      <span className={`${DOC_DOT} border-[#B42318]`} />
                                      <div className="text-[13.5px] font-semibold">Rejected</div>
                                      <div className="mt-2 text-[13px] text-[#912018] bg-[#FEF3F2] border border-[#F0C5C1] rounded-[7px] px-[11px] py-2 whitespace-pre-wrap break-words">
                                        {(selectedInvoice as any).rejectionReason}
                                      </div>
                                    </li>
                                  )}
                                  {/* Rendered only when cancelledAt is set. Invoices
                                      cancelled before this was recorded have no
                                      attribution to show, so they keep displaying
                                      exactly as they did. */}
                                  {(selectedInvoice as any).cancelledAt && (
                                    <li className="relative pb-4 last:pb-0">
                                      <span className={`${DOC_DOT} border-[#B42318]`} />
                                      <div className="text-[13.5px] font-semibold">Cancelled</div>
                                      <div className="text-[12.5px] text-[#8A93A3] mt-px">
                                        {(selectedInvoice as any).cancelledByName || "—"} ·{" "}
                                        {new Date((selectedInvoice as any).cancelledAt).toLocaleString()}
                                      </div>
                                      {(selectedInvoice as any).cancellationReason && (
                                        <div className="mt-2 text-[13px] text-[#912018] bg-[#FEF3F2] border border-[#F0C5C1] rounded-[7px] px-[11px] py-2 whitespace-pre-wrap break-words">
                                          {(selectedInvoice as any).cancellationReason}
                                        </div>
                                      )}
                                    </li>
                                  )}
                                  {selectedInvoice.status === "pending_approval" && (
                                    <li className="relative pb-4 last:pb-0">
                                      <span className={`${DOC_DOT} border-[#E3E7EE]`} />
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

                            {canHavePayments && (
                              <TabsContent value="payments" className="mt-4">
                                {isLoadingPayments ? (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                    Loading payments…
                                  </div>
                                ) : invoicePayments && invoicePayments.length > 0 ? (
                                  <div className="space-y-2">
                                    {invoicePayments.map((payment, index) => (
                                      <div key={payment.id} className="border border-[#E3E7EE] rounded-lg overflow-hidden">
                                        <div
                                          className="p-3 cursor-pointer hover:bg-[#F7F9FC] transition-colors"
                                          onClick={() =>
                                            startTransition(() =>
                                              setExpandedPayment(
                                                expandedPayment === payment.id ? null : payment.id,
                                              ),
                                            )
                                          }
                                        >
                                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                              <span className="font-semibold text-[#027A48]">
                                                {formatCurrency(payment.amount, invoiceCurrency)}
                                              </span>
                                              <span className="text-[13px] text-[#5B6472]">
                                                {formatDate(payment.paymentDate)}
                                              </span>
                                              <span className="text-[13px] text-[#5B6472] capitalize">
                                                {payment.paymentMethod?.replace("_", " ") || "N/A"}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <span className="text-[11.5px] text-[#8A93A3]">
                                                Recorded: {formatDate(payment.recordedAt)}
                                              </span>
                                              <ChevronDown
                                                className={`h-4 w-4 text-[#8A93A3] transition-transform ${expandedPayment === payment.id ? "rotate-180" : ""}`}
                                              />
                                            </div>
                                          </div>
                                        </div>

                                        {expandedPayment === payment.id && (
                                          <div className="px-3 pb-3 border-t border-[#EDF0F5] bg-[#F7F9FC]">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
                                              <div>
                                                <div className="text-[11px] font-semibold tracking-[0.07em] uppercase text-[#8A93A3]">
                                                  Reference number
                                                </div>
                                                <p className="text-[13px] mt-1 p-2 bg-white rounded border border-[#E3E7EE]">
                                                  {payment.referenceNumber || "No reference provided"}
                                                </p>
                                              </div>
                                              <div>
                                                <div className="text-[11px] font-semibold tracking-[0.07em] uppercase text-[#8A93A3]">
                                                  Payment ID
                                                </div>
                                                <p className="text-[13px] mt-1 p-2 bg-white rounded border border-[#E3E7EE]">
                                                  #{payment.id}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="mt-3">
                                              <div className="text-[11px] font-semibold tracking-[0.07em] uppercase text-[#8A93A3]">
                                                Notes
                                              </div>
                                              <p className="text-[13px] mt-1 p-3 bg-white rounded border border-[#E3E7EE] min-h-[60px]">
                                                {payment.notes || "No notes provided"}
                                              </p>
                                            </div>
                                            <div className="mt-3">
                                              <div className="text-[11px] font-semibold tracking-[0.07em] uppercase text-[#8A93A3]">
                                                Attachments
                                              </div>
                                              <div className="mt-1">
                                                {(() => {
                                                  const filesQuery = paymentFilesQueries[index];
                                                  const files = filesQuery?.data || [];

                                                  if (filesQuery?.isLoading) {
                                                    return <p className="text-[13px] text-[#8A93A3]">Loading attachments...</p>;
                                                  }

                                                  if (files.length === 0) {
                                                    return <p className="text-[13px] text-[#8A93A3] italic">No attachments</p>;
                                                  }

                                                  return (
                                                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                      {files.map((file: any) => (
                                                        <li
                                                          key={file.id}
                                                          className="flex items-center justify-between p-2 bg-white rounded border border-[#E3E7EE]"
                                                        >
                                                          <div className="flex items-center gap-2 overflow-hidden">
                                                            <Download className="h-4 w-4 flex-shrink-0 text-[#2B4ACB]" />
                                                            <span className="text-[13px] truncate" title={file.originalName}>
                                                              {file.originalName}
                                                            </span>
                                                          </div>
                                                          <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            asChild
                                                            className="h-8 ml-2 text-[13px]"
                                                          >
                                                            <a
                                                              href={`/api/payment-files/${file.id}/download`}
                                                              target="_blank"
                                                              rel="noopener noreferrer"
                                                            >
                                                              Download
                                                            </a>
                                                          </Button>
                                                        </li>
                                                      ))}
                                                    </ul>
                                                  );
                                                })()}
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ))}

                                    <div className="mt-4 pt-3 border-t border-[#E3E7EE] flex justify-between text-[15px] font-semibold">
                                      <span>Total payments</span>
                                      <span className="text-[#027A48]">
                                        {formatCurrency(
                                          invoicePayments
                                            .reduce((sum, payment) => sum + parseFloat(payment.amount), 0)
                                            .toFixed(2),
                                          invoiceCurrency,
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground italic">
                                    No payments recorded for this invoice yet.
                                  </p>
                                )}
                              </TabsContent>
                            )}

                            <TabsContent value="history" className="mt-4">
                              <EditHistoryTab
                                entries={invoiceEditHistory}
                                currency={invoiceCurrency}
                                emptyMessage="No edits have been recorded for this invoice."
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
                  {selectedInvoice.status === "draft" && (
                    <Button
                      onClick={() =>
                        startTransition(() =>
                          submitInvoiceMutation.mutate(selectedInvoice.id),
                        )
                      }
                      disabled={submitInvoiceMutation.isPending}
                      className="w-full sm:w-auto"
                      data-testid="button-submit-invoice-dialog"
                    >
                      <Send className="h-4 w-4 mr-1" />
                      {submitInvoiceMutation.isPending ? "Submitting..." : "Submit"}
                    </Button>
                  )}
                  {user?.role === "admin" &&
                    selectedInvoice.status === "pending_approval" && (
                      <>
                        <Button
                          onClick={() =>
                            startTransition(() =>
                              approveInvoiceMutation.mutate(selectedInvoice.id),
                            )
                          }
                          disabled={approveInvoiceMutation.isPending}
                          className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                          data-testid="button-approve-invoice-dialog"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {approveInvoiceMutation.isPending ? "Approving..." : "Approve"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsInvoiceDetailsOpen(false);
                            setIsInvoiceRejectDialogOpen(true);
                          }}
                          disabled={rejectInvoiceMutation.isPending}
                          className="w-full sm:w-auto border-red-300 text-red-600 hover:bg-red-50"
                          data-testid="button-reject-invoice-dialog"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}
                  {selectedInvoice.invoiceNumber &&
                    (selectedInvoice.status === "unpaid" ||
                      selectedInvoice.status === "partially_paid") && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          window.open(
                            `/credit-notes?invoiceId=${selectedInvoice.id}`,
                            "_blank",
                          )
                        }
                        className="w-full sm:w-auto"
                        data-testid="button-credit-note-dialog"
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        Credit Note
                      </Button>
                    )}
                  {(selectedInvoice.status === "unpaid" ||
                    selectedInvoice.status === "partially_paid" ||
                    selectedInvoice.status === "overdue" ||
                    selectedInvoice.status === "approved") &&
                    selectedInvoice.invoiceNumber && (
                      <Button
                        onClick={() => {
                          setIsInvoiceDetailsOpen(false);
                          openPaymentDialog(selectedInvoice);
                        }}
                        className="w-full sm:w-auto"
                        data-testid="button-record-payment-dialog"
                      >
                        <CreditCard className="h-4 w-4 mr-1" />
                        Record Payment
                      </Button>
                    )}
                  {canHavePayments && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        // Payments are a tab on the Activity card now, so this
                        // expands the card and switches to it rather than
                        // toggling a hidden section's display style.
                        setInvoiceActivityOpen(true);
                        setInvoiceActivityTab("payments");
                      }}
                      className="w-full sm:w-auto"
                      data-testid="button-view-payment-history"
                    >
                      <History className="h-4 w-4 mr-1" />
                      Payment History
                    </Button>
                  )}
                  {user?.role === "admin" &&
                    selectedInvoice.status === "approved" &&
                    parseFloat(selectedInvoice.paidAmount || "0") === 0 && (
                      <AlertDialog
                        onOpenChange={(open) => {
                          if (!open) setCancellationReason("");
                        }}
                      >
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            disabled={cancelInvoiceMutation.isPending}
                            className="w-full sm:w-auto"
                          >
                            <Ban className="h-4 w-4 mr-1" />
                            {cancelInvoiceMutation.isPending ? "Cancelling..." : "Cancel Invoice"}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel Invoice</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to cancel invoice{" "}
                              {selectedInvoice.invoiceNumber}? This will create
                              reversal ledger entries. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="space-y-2">
                            <Label htmlFor="cancellationReason">
                              Reason for Cancellation
                            </Label>
                            <Textarea
                              id="cancellationReason"
                              placeholder="Why is this invoice being cancelled?"
                              value={cancellationReason}
                              onChange={(e) => setCancellationReason(e.target.value)}
                              rows={3}
                              data-testid="input-cancellation-reason"
                            />
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep Invoice</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={(e) => {
                                // The reason is recorded on the invoice, so an
                                // empty one has to keep the dialog open rather
                                // than cancel without it.
                                if (!cancellationReason.trim()) {
                                  e.preventDefault();
                                  toast({
                                    title: "Reason required",
                                    description:
                                      "Enter why this invoice is being cancelled.",
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                startTransition(() =>
                                  cancelInvoiceMutation.mutate({
                                    invoiceId: selectedInvoice.id,
                                    cancellationReason: cancellationReason.trim(),
                                  }),
                                );
                              }}
                              disabled={cancelInvoiceMutation.isPending}
                            >
                              {cancelInvoiceMutation.isPending ? "Cancelling..." : "Cancel Invoice"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  <Button
                    variant="outline"
                    onClick={() => setIsInvoiceDetailsOpen(false)}
                    className="w-full sm:w-auto"
                    data-testid="button-close-invoice-details"
                  >
                    Close
                  </Button>
                </div>
              </>
            );
          })() : (
            <div className="p-6">
              <DialogTitle className="text-base font-semibold">Invoice Details</DialogTitle>
              <p className="mt-2 text-sm text-muted-foreground">No invoice selected.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Recording Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[500px] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a payment for invoice {selectedInvoice?.invoiceNumber || `Invoice #${selectedInvoice?.id}`}
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Invoice Details</Label>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">Total Amount:</span>
                      <span>
                        {formatCurrency(selectedInvoice.totalAmount || "0", selectedInvoice?.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Paid Amount:</span>
                      <span className="text-green-600">
                        {formatCurrency(selectedInvoice.paidAmount || "0", selectedInvoice?.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-medium">Outstanding:</span>
                      <span className="font-bold text-red-600">
                        {formatCurrency(
                          (
                            parseFloat(selectedInvoice.totalAmount || "0") -
                            parseFloat(selectedInvoice.paidAmount || "0")
                          ).toFixed(2),
                          selectedInvoice?.currency,
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="paymentAmount">Payment Amount ({selectedInvoice?.currency || "AED"}) *</Label>
                  <Input
                    id="paymentAmount"
                    type="number"
                    step="any"
                    value={paymentFormData.amount}
                    onChange={(e) =>
                      setPaymentFormData((prev) => ({
                        ...prev,
                        amount: e.target.value,
                      }))
                    }
                    placeholder="0.00"
                    required
                  />
                  {selectedInvoice?.currency && selectedInvoice.currency !== "AED" && selectedInvoice.exchangeRate && (
                    <p className="text-xs text-slate-500">
                      AED Equivalent: {formatCurrency((parseFloat(paymentFormData.amount || "0") * parseFloat(selectedInvoice.exchangeRate || "1")).toFixed(2), "AED")}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentDate">Payment Date *</Label>
                  <Input
                    id="paymentDate"
                    type="date"
                    value={paymentFormData.paymentDate}
                    onChange={(e) =>
                      setPaymentFormData((prev) => ({
                        ...prev,
                        paymentDate: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select
                  value={paymentFormData.paymentMethod || ""}
                  onValueChange={(value) =>
                    setPaymentFormData((prev) => ({
                      ...prev,
                      paymentMethod: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="referenceNumber">Reference Number</Label>
                <Input
                  id="referenceNumber"
                  value={paymentFormData.referenceNumber || ""}
                  onChange={(e) =>
                    setPaymentFormData((prev) => ({
                      ...prev,
                      referenceNumber: e.target.value,
                    }))
                  }
                  placeholder="Transaction ID, check number, etc."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentFiles">Attach Files (Optional)</Label>
                <Input
                  id="paymentFiles"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.txt,.csv,.xlsx,.xls"
                  onChange={(e) => setSelectedPaymentFiles(e.target.files)}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="text-sm text-gray-500">
                  You can attach multiple files (PDF, DOC, images, etc.). Max
                  25MB per file.
                </p>
                {selectedPaymentFiles && selectedPaymentFiles.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium">Selected files:</p>
                    <ul className="text-sm text-gray-600 mt-1">
                      {Array.from(selectedPaymentFiles).map((file, index) => (
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentNotes">Notes</Label>
                <Textarea
                  id="paymentNotes"
                  value={paymentFormData.notes || ""}
                  onChange={(e) =>
                    setPaymentFormData((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  placeholder="Additional notes about this payment"
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPaymentDialogOpen(false)}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={recordPaymentMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  {recordPaymentMutation.isPending
                    ? "Recording..."
                    : "Record Payment"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Receivables Dialog */}
      <Dialog open={isReceivablesOpen} onOpenChange={setIsReceivablesOpen}>
        <DialogContent className="w-[95vw] max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Accounts Receivable</DialogTitle>
            <DialogDescription>
              View all outstanding invoices and payments due
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {receivables && receivables.length > 0 ? (
              <>
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">Invoice</th>
                        <th className="text-left p-3 font-medium">Customer</th>
                        <th className="text-right p-3 font-medium">
                          Total Amount
                        </th>
                        <th className="text-right p-3 font-medium">
                          Paid Amount
                        </th>
                        <th className="text-right p-3 font-medium">
                          Outstanding
                        </th>
                        <th className="text-left p-3 font-medium">Due Date</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-center p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receivables.map((receivable) => (
                        <tr
                          key={receivable.invoiceId}
                          className={`border-b ${receivable.isOverdue ? "bg-red-50 dark:bg-red-900/10" : ""}`}
                        >
                          <td className="p-3 font-medium">
                            {receivable.invoiceNumber}
                          </td>
                          <td className="p-3">{receivable.customerName}</td>
                          <td className="text-right p-3">
                            {formatCurrency(receivable.totalAmount || "0")}
                          </td>
                          <td className="text-right p-3">
                            {formatCurrency(receivable.paidAmount || "0")}
                          </td>
                          <td className="text-right p-3 font-medium">
                            {formatCurrency(receivable.outstandingAmount)}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col">
                              <span>{formatDate(receivable.dueDate)}</span>
                              {receivable.isOverdue && (
                                <span className="text-xs text-red-600 font-medium">
                                  OVERDUE
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            {getInvoiceStatusBadge(receivable.status)}
                          </td>
                          <td className="text-center p-3">
                            {receivable.invoiceNumber && receivable.status !== "paid" && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  const invoice = invoices?.find(
                                    (inv) => inv.id === receivable.invoiceId,
                                  );
                                  if (invoice) {
                                    setIsReceivablesOpen(false);
                                    openPaymentDialog(invoice);
                                  }
                                }}
                              >
                                Record Payment
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-4">
                  {receivables.map((receivable) => (
                    <Card
                      key={receivable.invoiceId}
                      className={`${receivable.isOverdue ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10" : ""}`}
                    >
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                            <div className="flex-1">
                              <h3 className="font-medium text-lg">
                                {receivable.invoiceNumber}
                              </h3>
                              <p className="text-sm text-slate-600 dark:text-slate-400">
                                {receivable.customerName}
                              </p>
                            </div>
                            <div className="flex-shrink-0">
                              {getInvoiceStatusBadge(receivable.status)}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="font-medium text-slate-500 dark:text-slate-400 block">
                                Total Amount:
                              </span>
                              <p className="font-medium">
                                {formatCurrency(receivable.totalAmount || "0")}
                              </p>
                            </div>
                            <div>
                              <span className="font-medium text-slate-500 dark:text-slate-400 block">
                                Paid Amount:
                              </span>
                              <p className="font-medium text-green-600">
                                {formatCurrency(receivable.paidAmount || "0")}
                              </p>
                            </div>
                            <div>
                              <span className="font-medium text-slate-500 dark:text-slate-400 block">
                                Outstanding:
                              </span>
                              <p className="font-bold text-red-600">
                                {formatCurrency(receivable.outstandingAmount)}
                              </p>
                            </div>
                            <div>
                              <span className="font-medium text-slate-500 dark:text-slate-400 block">
                                Due Date:
                              </span>
                              <div>
                                <p className="font-medium">
                                  {formatDate(receivable.dueDate)}
                                </p>
                                {receivable.isOverdue && (
                                  <span className="text-xs text-red-600 font-medium">
                                    OVERDUE
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="pt-3 border-t">
                            <Button
                              size="sm"
                              className="w-full"
                              onClick={() => {
                                const invoice = invoices?.find(
                                  (inv) => inv.id === receivable.invoiceId,
                                );
                                if (invoice) {
                                  setIsReceivablesOpen(false);
                                  openPaymentDialog(invoice);
                                }
                              }}
                            >
                              Record Payment
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">
                  No outstanding receivables found
                </p>
              </div>
            )}

            {receivables && receivables.length > 0 && (
              <div className="border-t pt-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <span className="font-medium text-lg">
                    Total Outstanding:
                  </span>
                  <span className="text-xl sm:text-2xl font-bold text-red-600">
                    {formatCurrency(
                      receivables
                        .reduce(
                          (sum, r) => sum + parseFloat(r.outstandingAmount),
                          0,
                        )
                        .toFixed(2),
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setIsReceivablesOpen(false)}
              className="w-full sm:w-auto"
            >
              Close
            </Button>
          </div>
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

      {/* Invoice Reject Dialog */}
      <Dialog
        open={isInvoiceRejectDialogOpen}
        onOpenChange={setIsInvoiceRejectDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Sales Invoice</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this invoice.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invoiceRejectionReason">Rejection Reason *</Label>
              <Textarea
                id="invoiceRejectionReason"
                value={invoiceRejectionReason}
                onChange={(e) => setInvoiceRejectionReason(e.target.value)}
                placeholder="Explain why this invoice is being rejected..."
                rows={4}
                className="resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsInvoiceRejectDialogOpen(false);
                  setInvoiceRejectionReason("");
                }}
                disabled={rejectInvoiceMutation.isPending}
                data-testid="button-cancel-reject-invoice"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (!invoiceRejectionReason.trim()) {
                    toast({
                      title: "Error",
                      description: "Please provide a rejection reason",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (selectedInvoice) {
                    rejectInvoiceMutation.mutate({
                      invoiceId: selectedInvoice.id,
                      reason: invoiceRejectionReason,
                    });
                  }
                }}
                disabled={rejectInvoiceMutation.isPending}
                data-testid="button-confirm-reject-invoice"
              >
                {rejectInvoiceMutation.isPending ? "Rejecting..." : "Reject Invoice"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div >
  );
}
