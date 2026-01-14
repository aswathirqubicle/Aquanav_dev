import { useEffect, useState, startTransition } from "react";
import { useLocation } from "wouter";
import {
  useQuery,
  useMutation,
  useQueryClient,
  useQueries,
} from "@tanstack/react-query";
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
import { apiRequest } from "@/lib/queryClient";
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
  Copy,
} from "lucide-react";
import {
  SalesQuotation,
  SalesInvoice,
  Customer,
  Project,
  InvoicePayment,
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

const createSalesQuotationSchema = insertSalesQuotationSchema.extend({
  validUntil: z.string().optional(),
  items: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
      }),
    )
    .default([]),
  subtotal: z.string().optional(),
  taxAmount: z.string().optional(),
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
      }),
    )
    .default([]),
  subtotal: z.string().optional(),
  taxAmount: z.string().optional(),
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
}

export default function SalesIndex() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] =
    useState<SalesQuotation | null>(null);
  const [isQuotationDetailsOpen, setIsQuotationDetailsOpen] = useState(false);
  const [isEditingQuotation, setIsEditingQuotation] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(
    null,
  );
  const [isInvoiceDetailsOpen, setIsInvoiceDetailsOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isReceivablesOpen, setIsReceivablesOpen] = useState(false);
  // Quotation filters
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [archivedFilter, setArchivedFilter] = useState<string>("active");
  const [startDateFilter, setStartDateFilter] = useState<string>("");
  const [endDateFilter, setEndDateFilter] = useState<string>("");

  // Invoice filters
  const [invoiceSearchFilter, setInvoiceSearchFilter] = useState<string>("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] =
    useState<string>("unpaid");
  const [invoiceCustomerFilter, setInvoiceCustomerFilter] =
    useState<string>("all");
  const [invoiceProjectFilter, setInvoiceProjectFilter] =
    useState<string>("all");
  const [invoiceStartDateFilter, setInvoiceStartDateFilter] =
    useState<string>("");
  const [invoiceEndDateFilter, setInvoiceEndDateFilter] = useState<string>("");
  const [expandedPayment, setExpandedPayment] = useState<number | null>(null);
  const [selectedPaymentFiles, setSelectedPaymentFiles] =
    useState<FileList | null>(null);

  const [formData, setFormData] = useState<CreateSalesQuotationData>({
    customerId: undefined,
    status: "draft",
    items: [],
    discount: "0",
  });

  const [invoiceFormData, setInvoiceFormData] =
    useState<CreateSalesInvoiceData>({
      customerId: undefined,
      projectId: undefined,
      quotationId: undefined,
      status: "draft",
      invoiceDate: new Date().toISOString().split("T")[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      items: [],
      discount: "0",
      subtotal: "0",
      taxAmount: "0",
      totalAmount: "0",
    });

  const getDefaultTaxRate = () =>
    customerVatTreatment === "standard" ? 5 : 0;

  const [customerVatTreatment, setCustomerVatTreatment] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({
    description: "",
    quantity: 1,
    unitPrice: 0,
    taxRate: 0,
    taxAmount: 0,
  });

  const [paymentFormData, setPaymentFormData] = useState<CreatePaymentData>({
    invoiceId: 0,
    amount: "0",
    paymentDate: new Date().toISOString().split("T")[0],
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

  useEffect(() => {
    if (!isInvoiceDialogOpen || !company?.bankAccount) return;

    setInvoiceFormData(prev => ({
      ...prev,
      bankAccount: prev.bankAccount || company.bankAccount, // ✅ default only
    }));
  }, [isInvoiceDialogOpen, company]);

  const { data: quotationsResponse, isLoading: quotationsLoading } = useQuery<{
    data: SalesQuotation[];
    pagination?: any;
  }>({
    queryKey: ["/api/sales-quotations"],
    enabled: isAuthenticated,
  });

  const quotations = quotationsResponse?.data || [];

  const { data: invoicesResponse, isLoading: invoicesLoading } = useQuery<{
    data: SalesInvoice[];
    pagination?: any;
  }>({
    queryKey: ["/api/sales-invoices"],
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
    queryKey: ["/api/receivables"],
    enabled: isAuthenticated,
  });

  const { data: invoicePayments } = useQuery<InvoicePayment[]>({
    queryKey: [`/api/sales-invoices/${selectedInvoice?.id}/payments`],
    enabled: isAuthenticated && !!selectedInvoice,
  });

  const paymentFilesQueries = useQueries({
    queries: (invoicePayments || []).map((payment) => ({
      queryKey: [`/api/payment-files/${payment.id}`],
      queryFn: async () => {
        const response = await apiRequest(`/api/payment-files/${payment.id}`, {
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
      const discount = parseFloat(data.discount || "0");
      const taxAmount = data.items.reduce((sum, item) => {
        const itemTotal = item.quantity * item.unitPrice;
        const itemTax = (itemTotal * (item.taxRate || 0)) / 100;
        return sum + itemTax;
      }, 0);
      const totalAmount = subtotal - discount + taxAmount;

      const processedData = {
        ...data,
        customerId: data.customerId
          ? parseInt(data.customerId.toString())
          : undefined,
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
        subtotal: subtotal.toString(),
        taxAmount: taxAmount.toString(),
        totalAmount: totalAmount.toString(),
      };

      const url =
        isEditingQuotation && selectedQuotation
          ? `/api/sales-quotations/${selectedQuotation.id}`
          : "/api/sales-quotations";
      const method = isEditingQuotation ? "PUT" : "POST";

      const response = await apiRequest(url, {
        method,
        body: JSON.stringify(processedData),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-quotations"] });
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

  const approveQuotationMutation = useMutation({
    mutationFn: async (quotationId: number) => {
      const response = await apiRequest(
        `/api/sales-quotations/${quotationId}/approve`,
        {
          method: "POST",
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
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve quotation",
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
      const discount = parseFloat(data.discount || "0");
      const taxAmount = data.items.reduce((sum, item) => {
        const itemTotal = item.quantity * item.unitPrice;
        const itemTax = (itemTotal * (item.taxRate || 0)) / 100;
        return sum + itemTax;
      }, 0);
      const totalAmount = subtotal - discount + taxAmount;

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
        discount: discount.toFixed(2),
      };

      console.log("Processed invoice data:", processedData);

      const response = await apiRequest("/api/sales-invoices", {
        method: "POST",
        body: JSON.stringify(processedData),
        headers: {
          "Content-Type": "application/json",
        },
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

  const approveInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      const response = await apiRequest(
        `/api/sales-invoices/${invoiceId}/approve`,
        {
          method: "POST",
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
      console.log("formData",formData);
      
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
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
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
      items: [],
      discount: "0",
    });

    setNewItem({
      description: "",
      quantity: 1,
      unitPrice: 0,
      taxRate: 0,     // will be fixed by useEffect
      taxAmount: 0,
    });

    setIsEditingQuotation(false);
    setSelectedQuotation(null);
  };

  const resetInvoiceForm = () => {
    setInvoiceFormData({
      customerId: undefined,
      projectId: undefined,
      quotationId: undefined,
      status: "draft",
      invoiceDate: new Date().toISOString().split("T")[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      items: [],
      discount: "0",
      subtotal: "0",
      taxAmount: "0",
      totalAmount: "0",
    });
    setNewItem({
      description: "",
      quantity: 1,
      unitPrice: 0,
      taxRate: 0,
      taxAmount: 0,
    });
  };

  const resetPaymentForm = () => {
    setPaymentFormData({
      invoiceId: 0,
      amount: "0",
      paymentDate: new Date().toISOString().split("T")[0],
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
      paymentDate: new Date().toISOString().split("T")[0],
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
    createQuotationMutation.mutate(formData);
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
    createInvoiceMutation.mutate(invoiceFormData);
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

    // 🔥 Force correct tax rate here
    const taxRate =
      customerVatTreatment === "standard" ? 5 : 0;

    const lineSubtotal = newItem.quantity * newItem.unitPrice;
    const calculatedTaxAmount = lineSubtotal * (taxRate / 100);

    const item = {
      description: newItem.description,
      quantity: newItem.quantity,
      unitPrice: newItem.unitPrice,
      taxRate,
      taxAmount: calculatedTaxAmount,
    };

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, item],
    }));

    setNewItem({
      description: "",
      quantity: 1,
      unitPrice: 0,
      taxRate, // keep VAT for next item
      taxAmount: 0,
    });
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

    // 🔥 FORCE VAT HERE
    const taxRate =
      customerVatTreatment === "standard" ? 5 : 0;

    const lineSubtotal = newItem.quantity * newItem.unitPrice;
    const taxAmount = lineSubtotal * (taxRate / 100);

    const item = {
      description: newItem.description,
      quantity: newItem.quantity,
      unitPrice: newItem.unitPrice,
      taxRate,
      taxAmount,
    };

    setInvoiceFormData(prev => ({
      ...prev,
      items: [...prev.items, item],
    }));

    setNewItem({
      description: "",
      quantity: 1,
      unitPrice: 0,
      taxRate, // keep VAT for next item
      taxAmount: 0,
    });
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
      approved: {
        icon: CheckCircle,
        class:
          "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
        label: "Approved",
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

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString();
  };

  const totalQuotationValue = quotations?.length
    ? quotations.reduce(
        (sum, quotation) => sum + parseFloat(quotation.totalAmount || "0"),
        0,
      )
    : 0;

  const totalInvoiceValue = invoices?.length
    ? invoices.reduce(
        (sum, invoice) => sum + parseFloat(invoice.totalAmount || "0"),
        0,
      )
    : 0;

  const getCustomerName = (customerId: number, customerName?: string) => {
    // If customerName is provided (from invoice data), use it
    if (customerName) {
      return customerName;
    }
    // Fallback to looking up in customers array
    const customer = customers?.find((c) => c.id === customerId);
    return customer?.name || "Unknown Customer";
  };

  const filteredQuotations =
    quotations?.filter((quotation) => {
      // Search filter
      const searchMatch =
        !searchFilter ||
        quotation.quotationNumber
          ?.toLowerCase()
          .includes(searchFilter.toLowerCase()) ||
        getCustomerName(quotation.customerId)
          .toLowerCase()
          .includes(searchFilter.toLowerCase());

      // Status filter
      const statusMatch =
        statusFilter === "all" || quotation.status === statusFilter;

      // Customer filter
      const customerMatch =
        customerFilter === "all" ||
        quotation.customerId?.toString() === customerFilter;

      // Archive filter
      const archivedMatch =
        archivedFilter === "all" ||
        (archivedFilter === "archived" && quotation.isArchived) ||
        (archivedFilter === "active" && !quotation.isArchived);

      // Date range filter
      const createdDate = new Date(quotation.createdDate);
      const startDateMatch =
        !startDateFilter || createdDate >= new Date(startDateFilter);
      const endDateMatch =
        !endDateFilter || createdDate <= new Date(endDateFilter + "T23:59:59");

      return (
        searchMatch &&
        statusMatch &&
        customerMatch &&
        archivedMatch &&
        startDateMatch &&
        endDateMatch
      );
    }) || [];

  const filteredInvoices =
    invoices?.filter((invoice) => {
      // Search filter
      const searchMatch =
        !invoiceSearchFilter ||
        invoice.invoiceNumber
          ?.toLowerCase()
          .includes(invoiceSearchFilter.toLowerCase()) ||
        getCustomerName(invoice.customerId, invoice.customerName)
          .toLowerCase()
          .includes(invoiceSearchFilter.toLowerCase());

      // Status filter
      let statusMatch = true;
      if (invoiceStatusFilter !== "all") {
        if (invoiceStatusFilter === "paid")
          statusMatch = invoice.status === "paid";
        else if (invoiceStatusFilter === "unpaid")
          statusMatch =
            invoice.status === "unpaid" ||
            invoice.status === "partially_paid" ||
            invoice.status === "overdue";
        else if (invoiceStatusFilter === "partially_paid")
          statusMatch = invoice.status === "partially_paid";
        else if (invoiceStatusFilter === "overdue")
          statusMatch = invoice.status === "overdue";
        else statusMatch = invoice.status === invoiceStatusFilter;
      }

      // Customer filter
      const customerMatch =
        invoiceCustomerFilter === "all" ||
        invoice.customerId?.toString() === invoiceCustomerFilter;

      // Project filter
      const projectMatch =
        invoiceProjectFilter === "all" ||
        (invoiceProjectFilter === "no-project" && !invoice.projectId) ||
        invoice.projectId?.toString() === invoiceProjectFilter;

      // Date range filter
      const invoiceDate = new Date(invoice.invoiceDate);
      const startDateMatch =
        !invoiceStartDateFilter ||
        invoiceDate >= new Date(invoiceStartDateFilter);
      const endDateMatch =
        !invoiceEndDateFilter ||
        invoiceDate <= new Date(invoiceEndDateFilter + "T23:59:59");

      return (
        searchMatch &&
        statusMatch &&
        customerMatch &&
        projectMatch &&
        startDateMatch &&
        endDateMatch
      );
    }) || [];

  const openQuotationDetails = (quotation: SalesQuotation) => {
    setSelectedQuotation(quotation);
    setIsQuotationDetailsOpen(true);
  };

  const openInvoiceDetails = (invoice: SalesInvoice) => {
    setSelectedInvoice(invoice);
    setIsInvoiceDetailsOpen(true);
  };

  const handleEditQuotation = () => {
    if (selectedQuotation) {
      setFormData({
        customerId: selectedQuotation.customerId,
        status: selectedQuotation.status,
        validUntil: selectedQuotation.validUntil
          ? new Date(selectedQuotation.validUntil).toISOString().split("T")[0]
          : "",
        items: selectedQuotation.items || [],
        discount: selectedQuotation.discount || "0",
        subtotal: selectedQuotation.subtotal,
        taxAmount: selectedQuotation.taxAmount,
        totalAmount: selectedQuotation.totalAmount,
        paymentTerms: selectedQuotation.paymentTerms || "",
        bankAccount: selectedQuotation.bankAccount || "",
        billingAddress: selectedQuotation.billingAddress || "",
        termsAndConditions: selectedQuotation.termsAndConditions || "",
      });
      setIsEditingQuotation(true);
      setIsQuotationDetailsOpen(false);
      setIsDialogOpen(true);
    }
  };

  const handleDuplicateQuotation = () => {
    if (selectedQuotation) {
      setFormData({
        customerId: selectedQuotation.customerId,
        status: "draft",
        validUntil: selectedQuotation.validUntil
          ? new Date(selectedQuotation.validUntil).toISOString().split("T")[0]
          : "",
        items: selectedQuotation.items || [],
        discount: selectedQuotation.discount || "0",
        subtotal: selectedQuotation.subtotal,
        taxAmount: selectedQuotation.taxAmount,
        totalAmount: selectedQuotation.totalAmount,
        paymentTerms: selectedQuotation.paymentTerms || "",
        bankAccount: selectedQuotation.bankAccount || "",
        billingAddress: selectedQuotation.billingAddress || "",
        termsAndConditions: selectedQuotation.termsAndConditions || "",
      });
      setIsEditingQuotation(false);
      setIsQuotationDetailsOpen(false);
      setIsDialogOpen(true);
    }
  };

  const handlePrintPDF = async (quotation: SalesQuotation) => {
    try {
      const response = await fetch(
        `/api/sales-quotations/${quotation.id}/pdf`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

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

  const handlePrintInvoice = async (invoice: SalesInvoice) => {
    try {
      const response = await fetch(`/api/sales-invoices/${invoice.id}/pdf`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
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

  const handleConvertToInvoice = (quotation: SalesQuotation) => {
    setInvoiceFormData({
      customerId: quotation.customerId,
      projectId: undefined,
      quotationId: quotation.id,
      status: "draft",
      invoiceDate: new Date().toISOString().split("T")[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],

      // ✅ COPY FROM QUOTATION
      billingAddress: quotation.billingAddress || "",

      items: quotation.items || [],
      discount: quotation.discount || "0",
      subtotal: quotation.subtotal,
      taxAmount: quotation.taxAmount,
      totalAmount: quotation.totalAmount,
    });

    setIsInvoiceDialogOpen(true);
  };

  const totalQuotationsPages = Math.ceil(
    filteredQuotations.length / itemsPerPage,
  );
  const paginatedQuotations = filteredQuotations.slice(
    (quotationsCurrentPage - 1) * itemsPerPage,
    quotationsCurrentPage * itemsPerPage,
  );

  const totalInvoicesPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const paginatedInvoices = filteredInvoices.slice(
    (invoicesCurrentPage - 1) * itemsPerPage,
    invoicesCurrentPage * itemsPerPage,
  );

  // Initialize new fields in quotation form state
  const [quotationForm, setQuotationForm] = useState({
    customerId: "",
    validUntil: "",
    paymentTerms: "",
    bankAccount: "",
    billingAddress: "",
    termsAndConditions: "",
    remarks: "",
    discount: "0",
    items: [] as Array<{
      description: string;
      quantity: number;
      unitPrice: number;
    }>,
  });

  // Initialize new fields in invoice form state
  const [invoiceForm, setInvoiceForm] = useState({
    customerId: "",
    projectId: "",
    quotationId: "",
    invoiceDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    paymentTerms: "",
    bankAccount: "",
    billingAddress: "",
    termsAndConditions: "",
    remarks: "",
    items: [] as Array<{
      description: string;
      quantity: number;
      unitPrice: number;
    }>,
  });

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
    setInvoiceFormData(prev => ({
      ...prev,
      items: prev.items.map(item => ({
        ...item,
        taxRate,
        taxAmount:
          item.quantity * item.unitPrice * (taxRate / 100),
      })),
    }));
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
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => ({
        ...item,
        taxRate,
        taxAmount: item.quantity * item.unitPrice * (taxRate / 100),
      })),
    }));
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
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                      ? "Edit Sales Quotation"
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
                      <Select
                        value={formData.customerId?.toString() || ""}
                        onValueChange={(value) => {
                          const customerId = parseInt(value);
                          const selectedCustomer = customers?.find(c => c.id === customerId);

                          startTransition(() => {
                            setFormData(prev => ({
                              ...prev,
                              customerId,
                              billingAddress: selectedCustomer?.address || "", // ✅ AUTO POPULATE
                            }));
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                        <SelectContent>
                          {customers?.map((customer) => (
                            <SelectItem
                              key={customer.id}
                              value={customer.id.toString()}
                            >
                              {customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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

                  {/* Payment Details Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="paymentTerms">Payment Terms</Label>
                      <Input
                        id="paymentTerms"
                        type="text"
                        value={formData.paymentTerms || ""}
                        onChange={(e) =>
                          startTransition(() =>
                            setFormData((prev) => ({
                              ...prev,
                              paymentTerms: e.target.value,
                            })),
                          )
                        }
                        placeholder="e.g., Net 30, Due on Receipt"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bankAccount">Bank Account</Label>
                      <textarea
                        id="bankAccount"
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={formData.bankAccount || ""}
                        onChange={(e) =>
                          startTransition(() =>
                            setFormData((prev) => ({
                              ...prev,
                              bankAccount: e.target.value,
                            })),
                          )
                        }
                        placeholder="Bank account details"
                        rows={3}
                      />
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

                  {/* Services Section */}
                  <div className="space-y-4">
                    <Label className="text-base font-medium">Services</Label>

                    {/* Add Service Form */}
                    <Card>
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                          <div>
                            <Label className="text-xs text-gray-600">
                              Description
                            </Label>
                            <Input
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
                              placeholder="Qty"
                              value={newItem.quantity}
                              onChange={(e) =>
                                setNewItem((prev) => ({
                                  ...prev,
                                  quantity: parseInt(e.target.value) || 1,
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
                              step="0.01"
                              placeholder="Unit price"
                              value={newItem.unitPrice}
                              onChange={(e) =>
                                setNewItem((prev) => ({
                                  ...prev,
                                  unitPrice: parseFloat(e.target.value) || 0,
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
                              step="0.01"
                              placeholder="Tax %"
                              value={newItem.taxRate}
                              onChange={(e) =>
                                setNewItem((prev) => ({
                                  ...prev,
                                  taxRate: parseFloat(e.target.value) || 0,
                                }))
                              }
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          onClick={addItem}
                          size="sm"
                          className="w-full md:w-auto"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Service
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Services List */}
                    {formData.items.length > 0 && (
                      <Card>
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <table className="w-full">
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
                                  const taxAmount =
                                    lineSubtotal * ((item.taxRate || 0) / 100);
                                  const lineTotal = lineSubtotal + taxAmount;

                                  return (
                                    <tr key={index}>
                                      <td className="px-4 py-3 text-sm">
                                        {item.description}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-right">
                                        {item.quantity}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-right">
                                        ${item.unitPrice.toFixed(2)}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-right">
                                        {item.taxRate || 0}%
                                      </td>
                                      <td className="px-4 py-3 text-sm text-right">
                                        ${taxAmount.toFixed(2)}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-right font-medium">
                                        ${lineTotal.toFixed(2)}
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        <Button
                                          type="button"
                                          variant="destructive"
                                          size="sm"
                                          onClick={() => removeItem(index)}
                                        >
                                          Remove
                                        </Button>
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
                  <Card>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label className="text-sm font-medium">
                            Discount ($)
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={formData.discount}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                discount: e.target.value,
                              }))
                            }
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium">
                            Tax Amount
                          </Label>
                          <div className="text-lg font-medium py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded">
                            {(() => {
                              const taxTotal = formData.items.reduce(
                                (sum, item) => {
                                  const itemTotal =
                                    item.quantity * item.unitPrice;
                                  return (
                                    sum +
                                    (itemTotal * (item.taxRate || 0)) / 100
                                  );
                                },
                                0,
                              );
                              return formatCurrency(taxTotal);
                            })()}
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">
                            Total Amount
                          </Label>
                          <div className="text-xl font-bold py-2 px-3 bg-blue-50 dark:bg-blue-900/20 rounded border">
                            {(() => {
                              const subtotal = formData.items.reduce(
                                (sum, item) =>
                                  sum + item.quantity * item.unitPrice,
                                0,
                              );
                              const discount = parseFloat(
                                formData.discount || "0",
                              );
                              const taxTotal = formData.items.reduce(
                                (sum, item) => {
                                  const itemTotal =
                                    item.quantity * item.unitPrice;
                                  return (
                                    sum +
                                    (itemTotal * (item.taxRate || 0)) / 100
                                  );
                                },
                                0,
                              );
                              const total = subtotal - discount + taxTotal;
                              return formatCurrency(total);
                            })()}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Form Actions */}
                  <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
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
              onOpenChange={setIsInvoiceDialogOpen}
            >
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    resetInvoiceForm();
                    setIsInvoiceDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Invoice
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Sales Invoice</DialogTitle>
                  <DialogDescription>
                    Fill in the details to create a new sales invoice.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleInvoiceSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="invoiceCustomerId">Customer *</Label>
                      <Select
                        value={invoiceFormData.customerId?.toString() || ""}
                        onValueChange={(value) => {
                          const selectedCustomer = customers?.find(
                            (c) => c.id === parseInt(value)
                          );
                          startTransition(() =>
                            setInvoiceFormData((prev) => ({
                              ...prev,
                              customerId: parseInt(value),
                              billingAddress: selectedCustomer?.address || "",
                            })),
                          );
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                        <SelectContent>
                          {customers?.map((customer) => (
                            <SelectItem
                              key={customer.id}
                              value={customer.id.toString()}
                            >
                              {customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                      />
                    </div>
                  </div>

                  {/* Payment Details Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="invoicePaymentTerms">Payment Terms</Label>
                      <Input
                        id="invoicePaymentTerms"
                        type="text"
                        value={invoiceFormData.paymentTerms || ""}
                        onChange={(e) =>
                          startTransition(() =>
                            setInvoiceFormData((prev) => ({
                              ...prev,
                              paymentTerms: e.target.value,
                            })),
                          )
                        }
                        placeholder="e.g., Net 30, Due on Receipt"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invoiceBankAccount">Bank Account</Label>
                      <textarea
                        id="invoiceBankAccount"
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={invoiceFormData.bankAccount || ""}
                        onChange={(e) =>
                          startTransition(() =>
                            setInvoiceFormData((prev) => ({
                              ...prev,
                              bankAccount: e.target.value,
                            })),
                          )
                        }
                        placeholder="Bank account details"
                        rows={3}
                      />
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

                  {/* Services Section for Invoice */}
                  <div className="space-y-4">
                    <Label className="text-base font-medium">Services</Label>

                    {/* Add Service Form for Invoice */}
                    <Card>
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                          <div>
                            <Label className="text-xs text-gray-600">
                              Description
                            </Label>
                            <Input
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
                              placeholder="Qty"
                              value={newItem.quantity}
                              onChange={(e) =>
                                setNewItem((prev) => ({
                                  ...prev,
                                  quantity: parseInt(e.target.value) || 1,
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
                              step="0.01"
                              placeholder="Unit price"
                              value={newItem.unitPrice}
                              onChange={(e) =>
                                setNewItem((prev) => ({
                                  ...prev,
                                  unitPrice: parseFloat(e.target.value) || 0,
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
                              step="0.01"
                              placeholder="Tax %"
                              value={newItem.taxRate}
                              onChange={(e) =>
                                setNewItem((prev) => ({
                                  ...prev,
                                  taxRate: parseFloat(e.target.value) || 0,
                                }))
                              }
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          onClick={addInvoiceItem}
                          size="sm"
                          className="w-full md:w-auto"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Service
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Services List for Invoice */}
                    {invoiceFormData.items.length > 0 && (
                      <Card>
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <table className="w-full">
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
                                  const taxAmount =
                                    lineSubtotal * ((item.taxRate || 0) / 100);
                                  const lineTotal = lineSubtotal + taxAmount;

                                  return (
                                    <tr key={index}>
                                      <td className="px-4 py-3 text-sm">
                                        {item.description}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-right">
                                        {item.quantity}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-right">
                                        ${item.unitPrice.toFixed(2)}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-right">
                                        {item.taxRate || 0}%
                                      </td>
                                      <td className="px-4 py-3 text-sm text-right">
                                        ${taxAmount.toFixed(2)}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-right font-medium">
                                        ${lineTotal.toFixed(2)}
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        <Button
                                          type="button"
                                          variant="destructive"
                                          size="sm"
                                          onClick={() =>
                                            removeInvoiceItem(index)
                                          }
                                        >
                                          Remove
                                        </Button>
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
                  <Card>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label className="text-sm font-medium">
                            Discount ($)
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={invoiceFormData.discount}
                            onChange={(e) =>
                              setInvoiceFormData((prev) => ({
                                ...prev,
                                discount: e.target.value,
                              }))
                            }
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium">
                            Tax Amount
                          </Label>
                          <div className="text-lg font-medium py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded">
                            {(() => {
                              const taxTotal = invoiceFormData.items.reduce(
                                (sum, item) => {
                                  const itemTotal =
                                    item.quantity * item.unitPrice;
                                  return (
                                    sum +
                                    (itemTotal * (item.taxRate || 0)) / 100
                                  );
                                },
                                0,
                              );
                              return formatCurrency(taxTotal);
                            })()}
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">
                            Total Amount
                          </Label>
                          <div className="text-xl font-bold py-2 px-3 bg-blue-50 dark:bg-blue-900/20 rounded border">
                            {(() => {
                              const subtotal = invoiceFormData.items.reduce(
                                (sum, item) =>
                                  sum + item.quantity * item.unitPrice,
                                0,
                              );
                              const discount = parseFloat(
                                invoiceFormData.discount || "0",
                              );
                              const taxTotal = invoiceFormData.items.reduce(
                                (sum, item) => {
                                  const itemTotal =
                                    item.quantity * item.unitPrice;
                                  return (
                                    sum +
                                    (itemTotal * (item.taxRate || 0)) / 100
                                  );
                                },
                                0,
                              );
                              const total = subtotal - discount + taxTotal;
                              return formatCurrency(total);
                            })()}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Form Actions */}
                  <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsInvoiceDialogOpen(false)}
                      className="w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createInvoiceMutation.isPending}
                      className="w-full sm:w-auto"
                    >
                      {createInvoiceMutation.isPending
                        ? "Creating..."
                        : "Create Invoice"}
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
                  {quotations?.length || 0}
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
                  {invoices?.length || 0}
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
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency(totalQuotationValue)}
                </p>
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
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency(totalInvoiceValue)}
                </p>
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
          {/* Advanced Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label
                      htmlFor="searchFilter"
                      className="text-sm font-medium"
                    >
                      Search
                    </Label>
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
                    <Label
                      htmlFor="statusFilter"
                      className="text-sm font-medium"
                    >
                      Status
                    </Label>
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
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="converted">Converted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label
                      htmlFor="customerFilter"
                      className="text-sm font-medium"
                    >
                      Customer
                    </Label>
                    <Select
                      value={customerFilter}
                      onValueChange={(value) =>
                        startTransition(() => setCustomerFilter(value))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Customers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Customers</SelectItem>
                        {customers?.map((customer) => (
                          <SelectItem
                            key={customer.id}
                            value={customer.id.toString()}
                          >
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label
                      htmlFor="archivedFilter"
                      className="text-sm font-medium"
                    >
                      Archive Status
                    </Label>
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
                    <Label htmlFor="startDate" className="text-sm font-medium">
                      Created From
                    </Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDateFilter}
                      onChange={(e) =>
                        startTransition(() =>
                          setStartDateFilter(e.target.value),
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate" className="text-sm font-medium">
                      Created To
                    </Label>
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
          ) : filteredQuotations.length === 0 ? (
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
                  className="hover:shadow-md transition-shadow"
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
                            {formatCurrency(quotation.totalAmount || "0")}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-500">
                            {quotation.items?.length || 0} service
                            {(quotation.items?.length || 0) !== 1 ? "s" : ""}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openQuotationDetails(quotation)}
                          >
                            View Details
                          </Button>
                          {user?.role === "admin" &&
                            quotation.status === "draft" && (
                              <Button
                                size="sm"
                                onClick={() =>
                                  startTransition(() =>
                                    approveQuotationMutation.mutate(
                                      quotation.id,
                                    ),
                                  )
                                }
                                disabled={approveQuotationMutation.isPending}
                              >
                                {approveQuotationMutation.isPending
                                  ? "Approving..."
                                  : "Approve"}
                              </Button>
                            )}
                          {user?.role === "admin" &&
                            (quotation.isArchived ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  startTransition(() =>
                                    unarchiveQuotationMutation.mutate(
                                      quotation.id,
                                    ),
                                  )
                                }
                                disabled={unarchiveQuotationMutation.isPending}
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
                                onClick={() =>
                                  startTransition(() =>
                                    archiveQuotationMutation.mutate(
                                      quotation.id,
                                    ),
                                  )
                                }
                                disabled={archiveQuotationMutation.isPending}
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
                              onClick={() => handleConvertToInvoice(quotation)}
                            >
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
          {filteredQuotations.length > itemsPerPage && (
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
          {/* Advanced Invoice Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label
                      htmlFor="invoiceSearchFilter"
                      className="text-sm font-medium"
                    >
                      Search
                    </Label>
                    <Input
                      id="invoiceSearchFilter"
                      placeholder="Search invoices..."
                      value={invoiceSearchFilter}
                      onChange={(e) =>
                        startTransition(() =>
                          setInvoiceSearchFilter(e.target.value),
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="invoiceStatusFilter"
                      className="text-sm font-medium"
                    >
                      Status
                    </Label>
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
                        <SelectItem value="unpaid">
                          Unpaid (Including Partial & Overdue)
                        </SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="partially_paid">
                          Partially Paid
                        </SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label
                      htmlFor="invoiceCustomerFilter"
                      className="text-sm font-medium"
                    >
                      Customer
                    </Label>
                    <Select
                      value={invoiceCustomerFilter}
                      onValueChange={(value) =>
                        startTransition(() => setInvoiceCustomerFilter(value))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Customers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Customers</SelectItem>
                        {customers?.map((customer) => (
                          <SelectItem
                            key={customer.id}
                            value={customer.id.toString()}
                          >
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label
                      htmlFor="invoiceProjectFilter"
                      className="text-sm font-medium"
                    >
                      Project
                    </Label>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label
                      htmlFor="invoiceStartDate"
                      className="text-sm font-medium"
                    >
                      Invoice Date From
                    </Label>
                    <Input
                      id="invoiceStartDate"
                      type="date"
                      value={invoiceStartDateFilter}
                      onChange={(e) =>
                        startTransition(() =>
                          setInvoiceStartDateFilter(e.target.value),
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="invoiceEndDate"
                      className="text-sm font-medium"
                    >
                      Invoice Date To
                    </Label>
                    <Input
                      id="invoiceEndDate"
                      type="date"
                      value={invoiceEndDateFilter}
                      onChange={(e) =>
                        startTransition(() =>
                          setInvoiceEndDateFilter(e.target.value),
                        )
                      }
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      onClick={() => setIsReceivablesOpen(true)}
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
          ) : filteredInvoices.length === 0 ? (
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
                  className="hover:shadow-md transition-shadow"
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
                            {formatCurrency(invoice.totalAmount || "0")}
                          </p>
                          {invoice.paidAmount &&
                            parseFloat(invoice.paidAmount) > 0 && (
                              <p className="text-sm text-green-600 dark:text-green-400">
                                Paid: {formatCurrency(invoice.paidAmount)}
                              </p>
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openInvoiceDetails(invoice)}
                            className="w-full sm:w-auto"
                          >
                            View Details
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePrintInvoice(invoice)}
                            className="w-full sm:w-auto"
                          >
                            <Download className="h-4 w-4 mr-1" />
                            <span className="hidden sm:inline">
                              Print Invoice
                            </span>
                            <span className="sm:hidden">Print</span>
                          </Button>
                          {invoice.status === "draft" && user?.role === "admin" && (
                            <Button
                              size="sm"
                              onClick={() => approveInvoiceMutation.mutate(invoice.id)}
                              disabled={approveInvoiceMutation.isPending}
                              className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                            >
                              {approveInvoiceMutation.isPending ? "Approving..." : "Approve Invoice"}
                            </Button>
                          )}
                          {invoice.status !== "paid" && invoice.status !== "draft" && invoice.invoiceNumber && (
                            <Button
                              size="sm"
                              onClick={() => openPaymentDialog(invoice)}
                              className="w-full sm:w-auto"
                            >
                              Record Payment
                            </Button>
                          )}
                          {invoice.invoiceNumber && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                window.open(
                                  `/credit-notes?invoiceId=${invoice.id}`,
                                  "_blank",
                                )
                              }
                              className="w-full sm:w-auto"
                            >
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
          {filteredInvoices.length > itemsPerPage && (
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
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quotation Details</DialogTitle>
            <DialogDescription>
              View detailed information about this sales quotation.
            </DialogDescription>
          </DialogHeader>
          {selectedQuotation ? (
            <div className="space-y-6">
              {/* Header Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Quotation Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="font-medium">Quotation Number:</span>
                      <span>{selectedQuotation.quotationNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Status:</span>
                      <span>
                        {getQuotationStatusBadge(selectedQuotation.status)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Created Date:</span>
                      <span>{formatDate(selectedQuotation.createdDate)}</span>
                    </div>
                    {selectedQuotation.validUntil && (
                      <div className="flex justify-between">
                        <span className="font-medium">Valid Until:</span>
                        <span>{formatDate(selectedQuotation.validUntil)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Customer Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="font-medium">Customer:</span>
                      <span>
                        {getCustomerName(selectedQuotation.customerId)}
                      </span>
                    </div>
                    {(() => {
                      const customer = customers?.find(
                        (c) => c.id === selectedQuotation.customerId,
                      );
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
                        </>
                      ) : null;
                    })()}
                    {selectedQuotation.billingAddress && (
                      <div>
                        <span className="font-medium">Billing Address:</span>
                        <p className="mt-1 text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                          {selectedQuotation.billingAddress}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Payment Details */}
              {(selectedQuotation.paymentTerms || selectedQuotation.bankAccount || selectedQuotation.termsAndConditions) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Payment Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedQuotation.paymentTerms && (
                      <div>
                        <span className="font-medium">Payment Terms:</span>
                        <p className="mt-1 text-slate-600 dark:text-slate-400">
                          {selectedQuotation.paymentTerms}
                        </p>
                      </div>
                    )}
                    {selectedQuotation.bankAccount && (
                      <div>
                        <span className="font-medium">Bank Account:</span>
                        <p className="mt-1 text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                          {selectedQuotation.bankAccount}
                        </p>
                      </div>
                    )}
                    {selectedQuotation.termsAndConditions && (
                      <div>
                        <span className="font-medium">Terms & Conditions:</span>
                        <p className="mt-1 text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                          {selectedQuotation.termsAndConditions}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Items Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Services / Items</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedQuotation.items &&
                  selectedQuotation.items.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-3 font-medium">
                              Description
                            </th>
                            <th className="text-right p-3 font-medium">Qty</th>
                            <th className="text-right p-3 font-medium">
                              Unit Price
                            </th>
                            <th className="text-right p-3 font-medium">
                              Tax Rate
                            </th>
                            <th className="text-right p-3 font-medium">
                              Tax Amount
                            </th>
                            <th className="text-right p-3 font-medium">
                              Line Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedQuotation.items.map((item, index) => {
                            const lineSubtotal = item.quantity * item.unitPrice;
                            const taxRate = item.taxRate || 0;
                            const calculatedTaxAmount =
                              lineSubtotal * (taxRate / 100);
                            const taxAmount =
                              item.taxAmount !== undefined
                                ? parseFloat(item.taxAmount.toString())
                                : calculatedTaxAmount;
                            const lineTotal = lineSubtotal + taxAmount;

                            return (
                              <tr key={index} className="border-b">
                                <td className="p-3">{item.description}</td>
                                <td className="text-right p-3">
                                  {item.quantity}
                                </td>
                                <td className="text-right p-3">
                                  {formatCurrency(item.unitPrice)}
                                </td>
                                <td className="text-right p-3">{taxRate}%</td>
                                <td className="text-right p-3">
                                  {formatCurrency(taxAmount)}
                                </td>
                                <td className="text-right p-3 font-medium">
                                  {formatCurrency(lineTotal)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">
                      No items found
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Financial Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Financial Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="font-medium">Subtotal:</span>
                      <span>
                        {formatCurrency(selectedQuotation.subtotal || "0")}
                      </span>
                    </div>
                    {selectedQuotation.discount &&
                      parseFloat(selectedQuotation.discount) > 0 && (
                        <div className="flex justify-between">
                          <span className="font-medium">Discount:</span>
                          <span className="text-red-600">
                            -{formatCurrency(selectedQuotation.discount)}
                          </span>
                        </div>
                      )}
                    <div className="flex justify-between">
                      <span className="font-medium">Tax Amount:</span>
                      <span>
                        {formatCurrency(selectedQuotation.taxAmount || "0")}
                      </span>
                    </div>
                    <div className="border-t pt-3">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total Amount:</span>
                        <span className="text-blue-600">
                          {formatCurrency(selectedQuotation.totalAmount || "0")}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setIsQuotationDetailsOpen(false)}
                >
                  Close
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handlePrintPDF(selectedQuotation)}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Print PDF
                </Button>
                <Button variant="outline" onClick={handleDuplicateQuotation}>
                  <Copy className="h-4 w-4 mr-1" />
                  Duplicate
                </Button>
                {selectedQuotation.status === "draft" && (
                  <Button variant="outline" onClick={handleEditQuotation}>
                    Edit Quotation
                  </Button>
                )}
                {selectedQuotation.status === "approved" && (
                  <Button
                    onClick={() => handleConvertToInvoice(selectedQuotation)}
                  >
                    Convert to Invoice
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <p>No quotation selected.</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Invoice Details Dialog */}
      <Dialog
        open={isInvoiceDetailsOpen}
        onOpenChange={setIsInvoiceDetailsOpen}
      >
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
            <DialogDescription>
              View detailed information about this sales invoice.
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice ? (
            <div className="space-y-6">
              {/* Header Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Invoice Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="font-medium">Invoice Number:</span>
                      <span>{selectedInvoice.invoiceNumber || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Status:</span>
                      <span>
                        {getInvoiceStatusBadge(selectedInvoice.status)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Invoice Date:</span>
                      <span>{formatDate(selectedInvoice.invoiceDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Due Date:</span>
                      <span>{formatDate(selectedInvoice.dueDate)}</span>
                    </div>
                    {selectedInvoice.quotationId && (
                      <div className="flex justify-between">
                        <span className="font-medium">From Quotation:</span>
                        <span>
                          {quotations?.find(
                            (q) => q.id === selectedInvoice.quotationId,
                          )?.quotationNumber || "N/A"}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Customer Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="font-medium">Customer:</span>
                      <span>
                        {getCustomerName(
                          selectedInvoice.customerId,
                          selectedInvoice.customerName,
                        )}
                      </span>
                    </div>
                    {(() => {
                      const customer = customers?.find(
                        (c) => c.id === selectedInvoice.customerId,
                      );
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
                        </>
                      ) : null;
                    })()}
                    {selectedInvoice.billingAddress && (
                      <div>
                        <span className="font-medium">Billing Address:</span>
                        <p className="mt-1 text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                          {selectedInvoice.billingAddress}
                        </p>
                      </div>
                    )}
                    {selectedInvoice.projectId && (
                      <div className="flex justify-between">
                        <span className="font-medium">Project:</span>
                        <span>
                          {projects?.find(
                            (p) => p.id === selectedInvoice.projectId,
                          )?.title || "N/A"}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Payment Details */}
              {(selectedInvoice.paymentTerms || selectedInvoice.bankAccount || selectedInvoice.termsAndConditions) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Payment Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedInvoice.paymentTerms && (
                      <div>
                        <span className="font-medium">Payment Terms:</span>
                        <p className="mt-1 text-slate-600 dark:text-slate-400">
                          {selectedInvoice.paymentTerms}
                        </p>
                      </div>
                    )}
                    {selectedInvoice.bankAccount && (
                      <div>
                        <span className="font-medium">Bank Account:</span>
                        <p className="mt-1 text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                          {selectedInvoice.bankAccount}
                        </p>
                      </div>
                    )}
                    {selectedInvoice.termsAndConditions && (
                      <div>
                        <span className="font-medium">Terms & Conditions:</span>
                        <p className="mt-1 text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                          {selectedInvoice.termsAndConditions}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Items Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Services / Items</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedInvoice.items && selectedInvoice.items.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-3 font-medium">
                              Description
                            </th>
                            <th className="text-right p-3 font-medium">Qty</th>
                            <th className="text-right p-3 font-medium">
                              Unit Price
                            </th>
                            <th className="text-right p-3 font-medium">
                              Line Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedInvoice.items.map((item, index) => {
                            const lineTotal = item.quantity * item.unitPrice;

                            return (
                              <tr key={index} className="border-b">
                                <td className="p-3">{item.description}</td>
                                <td className="text-right p-3">
                                  {item.quantity}
                                </td>
                                <td className="text-right p-3">
                                  {formatCurrency(item.unitPrice)}
                                </td>
                                <td className="text-right p-3 font-medium">
                                  {formatCurrency(lineTotal)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">
                      No items found
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Financial Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Financial Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="font-medium">Subtotal:</span>
                      <span>
                        {formatCurrency(selectedInvoice.subtotal || "0")}
                      </span>
                    </div>
                    {selectedInvoice.discount &&
                      parseFloat(selectedInvoice.discount) > 0 && (
                        <div className="flex justify-between">
                          <span className="font-medium">Discount:</span>
                          <span className="text-red-600">
                            -{formatCurrency(selectedInvoice.discount)}
                          </span>
                        </div>
                      )}
                    <div className="flex justify-between">
                      <span className="font-medium">Tax Amount:</span>
                      <span>
                        {formatCurrency(selectedInvoice.taxAmount || "0")}
                      </span>
                    </div>
                    <div className="border-t pt-3">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total Amount:</span>
                        <span className="text-blue-600">
                          {formatCurrency(selectedInvoice.totalAmount || "0")}
                        </span>
                      </div>
                    </div>
                    {selectedInvoice.paidAmount &&
                      parseFloat(selectedInvoice.paidAmount) > 0 && (
                        <div className="border-t pt-3">
                          <div className="flex justify-between text-lg font-bold">
                            <span>Paid Amount:</span>
                            <span className="text-green-600">
                              {formatCurrency(selectedInvoice.paidAmount)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm text-gray-600 mt-1">
                            <span>Outstanding Balance:</span>
                            <span>
                              {formatCurrency(
                                parseFloat(selectedInvoice.totalAmount || "0") -
                                  parseFloat(selectedInvoice.paidAmount),
                              )}
                            </span>
                          </div>
                        </div>
                      )}
                  </div>
                </CardContent>
              </Card>

              {/* Payment History */}
              <div
                id={`payment-history-${selectedInvoice.id}`}
                style={{ display: "none" }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Payment History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {invoicePayments && invoicePayments.length > 0 ? (
                      <div className="space-y-2">
                        {invoicePayments.map((payment) => (
                          <div key={payment.id} className="border rounded-lg">
                            <div
                              className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                              onClick={() =>
                                startTransition(() =>
                                  setExpandedPayment(
                                    expandedPayment === payment.id
                                      ? null
                                      : payment.id,
                                  ),
                                )
                              }
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                  <span className="font-medium text-green-600">
                                    {formatCurrency(payment.amount)}
                                  </span>
                                  <span className="text-sm text-gray-600 dark:text-gray-400">
                                    {formatDate(payment.paymentDate)}
                                  </span>
                                  <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                                    {payment.paymentMethod?.replace("_", " ") ||
                                      "N/A"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500">
                                    Recorded: {formatDate(payment.recordedAt)}
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
                                      {payment.referenceNumber ||
                                        "No reference provided"}
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
                              </div>
                            )}
                          </div>
                        ))}

                        <div className="mt-6 pt-4 border-t">
                          <div className="flex justify-between text-lg font-bold">
                            <span>Total Payments:</span>
                            <span className="text-green-600">
                              {formatCurrency(
                                invoicePayments
                                  .reduce(
                                    (sum, payment) =>
                                      sum + parseFloat(payment.amount),
                                    0,
                                  )
                                  .toFixed(2),
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-gray-500">
                          No payments recorded for this invoice yet.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 pt-4 border-t">
                {/* Primary Actions Row */}
                <div className="flex flex-col sm:flex-row justify-end gap-3">
                  {selectedInvoice.status === "draft" && user?.role === "admin" && (
                    <Button
                      onClick={() => approveInvoiceMutation.mutate(selectedInvoice.id)}
                      disabled={approveInvoiceMutation.isPending}
                      className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                    >
                      {approveInvoiceMutation.isPending ? "Approving..." : "Approve Invoice"}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => handlePrintInvoice(selectedInvoice)}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Print Invoice
                  </Button>
                  {selectedInvoice.status !== "paid" && selectedInvoice.status !== "draft" && selectedInvoice.invoiceNumber && (
                    <Button
                      onClick={() => {
                        setIsInvoiceDetailsOpen(false);
                        openPaymentDialog(selectedInvoice);
                      }}
                      className="w-full sm:w-auto"
                    >
                      Record Payment
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Toggle the payment history section visibility
                      const paymentHistorySection = document.getElementById(
                        `payment-history-${selectedInvoice.id}`,
                      );
                      if (paymentHistorySection) {
                        paymentHistorySection.style.display =
                          paymentHistorySection.style.display === "none"
                            ? "block"
                            : "none";
                      }
                    }}
                    className="w-full sm:w-auto"
                  >
                    View Payment History
                  </Button>
                </div>
                {/* Secondary Actions Row */}
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setIsInvoiceDetailsOpen(false)}
                    className="w-full sm:w-auto"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p>No invoice selected.</p>
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
                        {formatCurrency(selectedInvoice.totalAmount || "0")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Paid Amount:</span>
                      <span className="text-green-600">
                        {formatCurrency(selectedInvoice.paidAmount || "0")}
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
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="paymentAmount">Payment Amount *</Label>
                  <Input
                    id="paymentAmount"
                    type="number"
                    step="0.01"
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
                  10MB per file.
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
                            {receivable.invoiceNumber && receivable.status !== "paid" &&(
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
    </div>
  );
}
