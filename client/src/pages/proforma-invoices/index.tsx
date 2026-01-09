import { useEffect, useState, startTransition } from "react";
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
  Eye,
  Edit,
  Copy,
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

// Proforma Invoice Schema
const createProformaInvoiceSchema = z.object({
  customerId: z.number(),
  projectId: z.number().optional(),
  quotationId: z.number().optional(),
  invoiceDate: z.string().optional(),
  validUntil: z.string().optional(),
  paymentTerms: z.string().optional(),
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
      }),
    )
    .default([]),
  subtotal: z.string().optional(),
  taxAmount: z.string().optional(),
  discount: z.string().optional(),
  totalAmount: z.string().optional(),
});

type CreateProformaInvoiceData = z.infer<typeof createProformaInvoiceSchema>;

interface ProformaInvoice {
  id: number;
  proformaNumber: string;
  customerId: number;
  customerName?: string;
  projectId?: number;
  quotationId?: number;
  status: string;
  createdDate: string;
  invoiceDate?: string;
  validUntil?: string;
  paymentTerms?: string;
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
  }>;
  subtotal?: string;
  taxAmount?: string;
  discount?: string;
  totalAmount?: string;
  isArchived?: boolean;
}

interface ProformaItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
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
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [archivedFilter, setArchivedFilter] = useState<string>("active");
  const [customerVatTreatment, setCustomerVatTreatment] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateProformaInvoiceData>({
    customerId: 0,
    invoiceDate: new Date().toISOString().split('T')[0],
    items: [],
    discount: "0",
  });

  const [newItem, setNewItem] = useState<ProformaItem>({
    description: "",
    quantity: 1,
    unitPrice: 0,
    taxRate: 0,
  });

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
      const discount = parseFloat(data.discount || "0");
      const taxAmount = data.items.reduce((sum, item) => {
        const itemTotal = item.quantity * item.unitPrice;
        const itemTax = (itemTotal * (item.taxRate || 0)) / 100;
        return sum + itemTax;
      }, 0);
      const totalAmount = subtotal - discount + taxAmount;

      const processedData = {
        ...data,
        validUntil: data.validUntil ? data.validUntil : null,
        subtotal: subtotal.toString(),
        taxAmount: taxAmount.toString(),
        totalAmount: totalAmount.toString(),
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

  const resetForm = () => {
    setFormData({
      customerId: 0,
      invoiceDate: new Date().toISOString().split('T')[0],
      items: [],
      discount: "0",
    });
    setNewItem({
      description: "",
      quantity: 1,
      unitPrice: 0,
      taxRate: customerVatTreatment === "standard" ? 5 : 0,
    });
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

    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { ...newItem }],
    }));

    setNewItem({
      description: "",
      quantity: 1,
      unitPrice: 0,
      taxRate: customerVatTreatment === "standard" ? 5 : 0,
    });
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

  if (
    !isAuthenticated ||
    (user?.role !== "admin" &&
      user?.role !== "finance")
  ) {
    return null;
  }

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
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNewProformaDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Proforma Invoice
                </Button>
              </DialogTrigger>
              <DialogContent
                key={isEditingProforma ? selectedProforma?.id : "new"}
                className="sm:max-w-4xl max-h-[90vh] overflow-y-auto"
              >

                <DialogHeader>
                  <DialogTitle>
                    {isEditingProforma ? "Edit Proforma Invoice" : "Create Proforma Invoice"}
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
                      <Select
                        value={formData.customerId?.toString() || ""}
                        onValueChange={(value) => {
                          const selectedCustomer = customers?.find(
                            (c) => c.id === parseInt(value)
                          );

                          const vatTreatment = selectedCustomer?.vatTreatment || null;
                          const defaultTaxRate = vatTreatment === "standard" ? 5 : 0;

                          startTransition(() => {
                            setCustomerVatTreatment(vatTreatment);

                            setFormData((prev) => ({
                              ...prev,
                              customerId: parseInt(value),
                              billingAddress: selectedCustomer?.address || "",
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
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                        <SelectContent>
                          {customers?.filter(customer => customer.id).map((customer) => (
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

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paymentTerms">Payment Terms</Label>
                      <Input
                        id="paymentTerms"
                        value={formData.paymentTerms || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            paymentTerms: e.target.value,
                          }))
                        }
                        placeholder="e.g., Net 30 days"
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
                      <Label htmlFor="bankAccount">Bank Account</Label>
                      <Input
                        id="bankAccount"
                        value={formData.bankAccount || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            bankAccount: e.target.value,
                          }))
                        }
                        placeholder="Bank account for payment"
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
                    <Card>
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                          <div>
                            <Label className="text-xs text-gray-600">Description</Label>
                            <Input
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
                            <Label className="text-xs text-gray-600">Unit Price</Label>
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
                            <Label className="text-xs text-gray-600">Tax Rate (%)</Label>
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
                          Add Item
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Items List */}
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
                                  const taxAmount = lineSubtotal * ((item.taxRate || 0) / 100);
                                  const lineTotal = lineSubtotal + taxAmount;

                                  return (
                                    <tr key={index}>
                                      <td className="px-4 py-3 text-sm">{item.description}</td>
                                      <td className="px-4 py-3 text-sm text-right">{item.quantity}</td>
                                      <td className="px-4 py-3 text-sm text-right">
                                        ${item.unitPrice.toFixed(2)}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-right">
                                        {item.taxRate || 0}%
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

                  {/* Remarks */}
                  <div className="space-y-2">
                    <Label htmlFor="remarks">Remarks</Label>
                    <Textarea
                      id="remarks"
                      value={formData.remarks || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          remarks: e.target.value,
                        }))
                      }
                      placeholder="Additional remarks or notes"
                      rows={3}
                    />
                  </div>

                  {/* Financial Summary */}
                  <Card>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Discount ($)</Label>
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
                          <Label className="text-sm font-medium">Tax Amount</Label>
                          <div className="text-lg font-medium py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded">
                            {(() => {
                              const taxTotal = formData.items.reduce((sum, item) => {
                                const itemTotal = item.quantity * item.unitPrice;
                                return sum + (itemTotal * (item.taxRate || 0)) / 100;
                              }, 0);
                              return formatCurrency(taxTotal);
                            })()}
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Total Amount</Label>
                          <div className="text-xl font-bold py-2 px-3 bg-blue-50 dark:bg-blue-900/20 rounded border">
                            {(() => {
                              const subtotal = formData.items.reduce(
                                (sum, item) => sum + item.quantity * item.unitPrice,
                                0,
                              );
                              const discount = parseFloat(formData.discount || "0");
                              const taxTotal = formData.items.reduce((sum, item) => {
                                const itemTotal = item.quantity * item.unitPrice;
                                return sum + (itemTotal * (item.taxRate || 0)) / 100;
                              }, 0);
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
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency(
                    proformaInvoices?.reduce(
                      (sum, p) => sum + parseFloat(p.totalAmount || "0"),
                      0,
                    ) || 0
                  )}
                </p>
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
              <Label htmlFor="archivedFilter" className="text-sm font-medium">
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
              </Select>
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
            <Card key={proforma.id} className="hover:shadow-md transition-shadow">
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
                        {formatCurrency(proforma.totalAmount || "0")}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-500">
                        {proforma.items?.length || 0} item{(proforma.items?.length || 0) !== 1 ? "s" : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDetails(proforma)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>

                      
                      {proforma.status === "approved" && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-green-600 hover:text-green-700"
                          onClick={() => handleConvertToInvoice(proforma)}
                        >
                          <FileText className="h-4 w-4 mr-1" />
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
            <DialogTitle>Proforma Invoice Details</DialogTitle>
            <DialogDescription>
              View detailed information about this proforma invoice.
            </DialogDescription>
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
                      <span className="font-medium">Status:</span>
                      <span>{getStatusBadge(selectedProforma.status)}</span>
                    </div>
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
                    {selectedProforma.bankAccount && (
                      <div className="flex justify-between">
                        <span className="font-medium">Bank Account:</span>
                        <span>{selectedProforma.bankAccount}</span>
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
                            <th className="text-right p-3 font-medium">Line Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedProforma.items.map((item, index) => {
                            const lineSubtotal = item.quantity * item.unitPrice;
                            const taxAmount = lineSubtotal * ((item.taxRate || 0) / 100);
                            const lineTotal = lineSubtotal + taxAmount;

                            return (
                              <tr key={index} className="border-b">
                                <td className="p-3">{item.description}</td>
                                <td className="text-right p-3">{item.quantity}</td>
                                <td className="text-right p-3">{formatCurrency(item.unitPrice)}</td>
                                <td className="text-right p-3">{item.taxRate || 0}%</td>
                                <td className="text-right p-3 font-medium">{formatCurrency(lineTotal)}</td>
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
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Financial Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="font-medium">Subtotal:</span>
                      <span>{formatCurrency(selectedProforma.subtotal || "0")}</span>
                    </div>
                    {selectedProforma.discount && parseFloat(selectedProforma.discount) > 0 && (
                      <div className="flex justify-between">
                        <span className="font-medium">Discount:</span>
                        <span className="text-red-600">-{formatCurrency(selectedProforma.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="font-medium">Tax Amount:</span>
                      <span>{formatCurrency(selectedProforma.taxAmount || "0")}</span>
                    </div>
                    <div className="border-t pt-3">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total Amount:</span>
                        <span className="text-blue-600">
                          {formatCurrency(selectedProforma.totalAmount || "0")}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Remarks */}
              {selectedProforma.remarks && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Remarks</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{selectedProforma.remarks}</p>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
                  Close
                </Button>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-1" />
                  Print PDF
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    if (selectedProforma) {
                      const selectedCustomer = customers?.find(
                        (c) => c.id === selectedProforma.customerId
                      );

                      const vatTreatment = selectedCustomer?.vatTreatment || null;
                      const defaultTaxRate = vatTreatment === "standard" ? 5 : 0;

                      setCustomerVatTreatment(vatTreatment);
                      // Populate form with existing data
                      setFormData({
                        customerId: selectedProforma.customerId,
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
                        discount: selectedProforma.discount || '0',
                      });
                      // 🔹 ensure new item uses correct tax
                      setNewItem({
                        description: "",
                        quantity: 1,
                        unitPrice: 0,
                        taxRate: defaultTaxRate,
                      });
                      
                      setIsEditingProforma(true);
                      setIsDetailsOpen(false);
                      setIsDialogOpen(true);
                    }
                  }}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button variant="outline">
                  <Copy className="h-4 w-4 mr-1" />
                  Duplicate
                </Button>
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
                {selectedProforma && selectedProforma.status === "approved" && (
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => handleConvertToInvoice(selectedProforma)}
                    disabled={convertToInvoiceMutation.isPending}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    {convertToInvoiceMutation.isPending ? "Converting..." : "Convert to Invoice"}
                  </Button>
                )}
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
                  Amount: {formatCurrency(convertingProforma.totalAmount || "0")}
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
    </div>
  );
}