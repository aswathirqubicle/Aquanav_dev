
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, FileText, Package, Truck, CheckCircle, XCircle, Clock, Eye, Trash2, Search, Filter, DollarSign, TrendingUp, CreditCard, Printer, Paperclip } from "lucide-react";
import { InventoryItem, type SupplierBankDetails } from "@shared/schema";

interface Supplier {
  id: number;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  bankAccountDetails?: SupplierBankDetails[];
}

interface PurchaseOrder {
  id: number;
  poNumber: string;
  supplierId: number;
  supplierName: string;
  status: "draft" | "pending_approval" | "approved" | "rejected" | "converted";
  orderDate: string;
  expectedDeliveryDate?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  bankAccount?: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");

  const [formData, setFormData] = useState({
    supplierId: "",
    orderDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: "",
    paymentTerms: "",
    deliveryTerms: "",
    bankAccount: "",
    notes: "",
  });

  const [orderItems, setOrderItems] = useState<{
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

  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [existingFiles, setExistingFiles] = useState<PurchaseOrderFile[]>([]);

  const [invoiceData, setInvoiceData] = useState({
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: "",
    partial: false,
  });

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

  const { data: orders, isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ["/api/purchase-orders"],
    enabled: isAuthenticated,
  });

  const { data: suppliersResponse } = useQuery<{ data: Supplier[] }>({
    queryKey: ["/api/suppliers/all"],
    enabled: isAuthenticated,
  });

  const { data: inventoryResponse } = useQuery<{ data: InventoryItem[] }>({
    queryKey: ["/api/inventory"],
    enabled: isAuthenticated,
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
      const response = await apiRequest(`/api/purchase-orders/${orderId}/submit`,{method:"POST"});
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
      const response = await apiRequest(`/api/purchase-orders/${orderId}/approve`,{method:"PATCH"});
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
      const response = await apiRequest(`/api/purchase-orders/${orderId}/reject`,{method:"PATCH", body:{ reason }});
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
    mutationFn: async ({ orderId, invoiceData }: { orderId: number; invoiceData: any }) => {
      const response = await apiRequest(`/api/purchase-orders/${orderId}/convert-to-invoice`,{method:"POST", body:invoiceData});
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to convert to invoice");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({
        title: "Invoice Created",
        description: "Purchase order has been converted to invoice and inventory updated.",
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
    });
    setOrderItems([]);
    setNewItem({
      itemType: "product",
      inventoryItemId: "",
      description: "",
      quantity: "1",
      unitPrice: "0",
      taxRate: "0",
    });
    setSelectedFiles(null);
    setEditingOrder(null);
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
    });
    
    if (order.items && order.items.length > 0) {
      setOrderItems(order.items.map(item => ({
        itemType: item.itemType,
        inventoryItemId: item.inventoryItemId?.toString() || "",
        description: item.description || "",
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice,
        taxRate: "0",
      })));
    } else {
      setOrderItems([]);
    }

    setExistingFiles(order.files || []);
    
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

      if (orderItems.some(item => item.itemType === "product" && item.inventoryItemId === newItem.inventoryItemId)) {
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

    setOrderItems(prev => [...prev, { ...newItem }]);
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
      const taxAmount = (quantity * unitPrice * taxRate) / 100;

      return {
        itemType: item.itemType,
        inventoryItemId: item.inventoryItemId ? parseInt(item.inventoryItemId) : null,
        description: item.description || null,
        quantity,
        unitPrice,
        taxRate,
        taxAmount,
      };
    });
    formDataInstance.append("items", JSON.stringify(items));

    // Calculate and append totals
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const taxAmount = calculateTotalTax();
    const totalAmount = subtotal + taxAmount;
    formDataInstance.append("subtotal", subtotal.toFixed(2));
    formDataInstance.append("taxAmount", taxAmount.toFixed(2));
    formDataInstance.append("totalAmount", totalAmount.toFixed(2));

    // Append files
    if (selectedFiles) {
      for (let i = 0; i < selectedFiles.length; i++) {
        formDataInstance.append("files", selectedFiles[i]);
      }
    }

    if (editingOrder) {
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

  const handleConvertToInvoice = () => {
    if (!viewingOrder) return;

    convertToInvoiceMutation.mutate({
      orderId: viewingOrder.id,
      invoiceData,
    });
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

  // Filter orders based on search and filters
  const filteredOrders = orders?.filter(order => {
    const matchesSearch = !searchQuery || 
      order.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.supplierName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    const matchesSupplier = supplierFilter === "all" || order.supplierId.toString() === supplierFilter;

    return matchesSearch && matchesStatus && matchesSupplier;
  }) || [];

  const applyFilters = () => {
    // Filters are applied automatically through filteredOrders
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setSupplierFilter("all");
  };

  // Calculate statistics
  const totalOrderValue = orders?.length 
    ? orders.reduce((sum, order) => sum + parseFloat(order.totalAmount || "0"), 0)
    : 0;

  const statusCounts = orders?.reduce((counts, order) => {
    counts[order.status] = (counts[order.status] || 0) + 1;
    return counts;
  }, {} as Record<string, number>) || {};

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
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
          <div className="relative flex-1 lg:w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                Filters
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
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
                  <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Suppliers</SelectItem>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id.toString()}>
                          {supplier.name}
                        </SelectItem>
                      ))}
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
                  {orders?.length || 0}
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
                  {statusCounts.approved || 0}
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
                  {statusCounts.pending_approval || 0}
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
                  {formatCurrency(totalOrderValue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
                        {new Date(order.orderDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(order.status)}
                      </TableCell>
                      <TableCell className="font-semibold text-green-600">
                        {formatCurrency(order.totalAmount)}
                      </TableCell>
                      <TableCell>
                        {order.expectedDeliveryDate 
                          ? new Date(order.expectedDeliveryDate).toLocaleDateString() 
                          : "-"
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => viewOrder(order)} className="gap-1" data-testid={`button-view-order-${order.id}`}>
                            <Eye className="w-4 h-4" />
                            <span className="hidden sm:inline">View</span>
                          </Button>
                          
                          {/* Edit - Draft orders only */}
                          {order.status === "draft" && (
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
                              onClick={() => {
                                setViewingOrder(order);
                                setIsInvoiceDialogOpen(true);
                              }}
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
                  <Select
                    value={formData.supplierId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, supplierId: value, bankAccount: "" }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id.toString()}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  value={formData.bankAccount}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, bankAccount: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccountOptions.map((detail, index) => (
                      <React.Fragment key={detail.id}>
                        <SelectItem value={detail.accountDetails}>
                          <div className="whitespace-pre-wrap">{detail.accountDetails}</div>
                        </SelectItem>
                        {index < bankAccountOptions.length - 1 && (
                          <hr className="my-1" />
                        )}
                      </React.Fragment>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional notes"
                  className="mt-1"
                />
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
                  You can attach multiple files (PDF, DOC, images, etc.). Max 10MB per file.
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
                <Card className="p-4 bg-muted/30">
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
                              label: `${item.name} (${item.unit})`,
                              searchText: `${item.name} ${item.unit}`
                            }))}
                            value={newItem.inventoryItemId || ""}
                            onValueChange={(value) => setNewItem(prev => ({ ...prev, inventoryItemId: value }))}
                            placeholder="Type to search items..."
                            className="mt-1"
                          />
                        </div>
                      ) : (
                        <div className="sm:col-span-2 lg:col-span-1">
                          <Label>Description *</Label>
                          <Input
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
                        <Label>Unit Price *</Label>
                        <Input
                          type="number"
                          step="0.01"
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
                          step="0.01"
                          min="0"
                          max="100"
                          value={newItem.taxRate}
                          onChange={(e) => setNewItem(prev => ({ ...prev, taxRate: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <div className="flex items-end sm:col-span-2 lg:col-span-1">
                        <Button type="button" onClick={addItem} className="w-full lg:w-auto gap-1">
                          <Plus className="w-4 h-4" />
                          Add
                        </Button>
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
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-[100px]">Type</TableHead>
                              <TableHead className="min-w-[200px]">Item/Description</TableHead>
                              <TableHead className="min-w-[80px]">Quantity</TableHead>
                              <TableHead className="min-w-[100px]">Unit Price</TableHead>
                              <TableHead className="min-w-[80px]">Tax Rate</TableHead>
                              <TableHead className="min-w-[100px]">Line Total</TableHead>
                              <TableHead className="w-16"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {orderItems.map((item, index) => {
                              const quantity = parseInt(item.quantity) || 0;
                              const unitPrice = parseFloat(item.unitPrice) || 0;
                              const taxRate = parseFloat(item.taxRate) || 0;
                              const lineSubtotal = quantity * unitPrice;
                              const lineTax = (lineSubtotal * taxRate) / 100;
                              const lineTotal = lineSubtotal + lineTax;

                              return (
                                <TableRow key={index}>
                                  <TableCell>
                                    <Badge variant={item.itemType === "product" ? "default" : "secondary"}>
                                      {item.itemType === "product" ? "Product" : "Service"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    {item.itemType === "product" 
                                      ? getItemName(item.inventoryItemId || "")
                                      : item.description}
                                  </TableCell>
                                  <TableCell>
                                    {item.quantity} {item.itemType === "product" ? getItemUnit(item.inventoryItemId || "") : ""}
                                  </TableCell>
                                  <TableCell>${item.unitPrice}</TableCell>
                                  <TableCell>{item.taxRate}%</TableCell>
                                  <TableCell className="font-semibold">${lineTotal.toFixed(2)}</TableCell>
                                  <TableCell>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeItem(index)}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
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
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>${orderItems.reduce((sum, item) => {
                            const quantity = parseInt(item.quantity) || 0;
                            const unitPrice = parseFloat(item.unitPrice) || 0;
                            return sum + (quantity * unitPrice);
                          }, 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Tax:</span>
                          <span>${calculateTotalTax().toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold border-t pt-2">
                          <span>Total Amount:</span>
                          <span>${(orderItems.reduce((sum, item) => {
                            const quantity = parseInt(item.quantity) || 0;
                            const unitPrice = parseFloat(item.unitPrice) || 0;
                            return sum + (quantity * unitPrice);
                          }, 0) + calculateTotalTax()).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

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
                    onClick={() => window.print()}
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
                        <p className="text-sm font-medium mt-1">{new Date(viewingOrder.orderDate).toLocaleDateString()}</p>
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
                          <p className="text-sm font-medium mt-1">{new Date(viewingOrder.expectedDeliveryDate).toLocaleDateString()}</p>
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
                    <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">
                      {viewingOrder.bankAccount}
                    </p>
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
                    <p className="text-sm text-muted-foreground">{viewingOrder.notes}</p>
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
                    <ul className="space-y-2">
                      {viewingOrder.files.map((file) => (
                        <li
                          key={file.id}
                          className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-md"
                        >
                          <a
                            href={`/${file.filePath}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-blue-600 hover:underline truncate"
                          >
                            <FileText className="w-4 h-4" />
                            <span className="truncate">{file.originalName}</span>
                          </a>
                          <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                            ({(file.fileSize / 1024).toFixed(2)} KB)
                          </span>
                        </li>
                      ))}
                    </ul>
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
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Line Total</TableHead>
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
                                <span className="font-medium">
                                  {item.itemType === "product" ? item.inventoryItemName : item.description}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {item.quantity} {item.itemType === "product" ? item.inventoryItemUnit : ""}
                            </TableCell>
                            <TableCell className="text-right">${item.unitPrice}</TableCell>
                            <TableCell className="text-right font-semibold">${item.lineTotal}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Financial Summary */}
                  <div className="mt-6 space-y-3">
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-medium">${viewingOrder.subtotal}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm mt-2">
                        <span className="text-muted-foreground">Tax</span>
                        <span className="font-medium">${viewingOrder.taxAmount}</span>
                      </div>
                    </div>
                    <div className="border-t pt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-base font-semibold">Total Amount</span>
                        <span className="text-xl font-bold text-primary">${viewingOrder.totalAmount}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              {canEdit && canCreateInvoice(viewingOrder) && (
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    onClick={() => setIsInvoiceDialogOpen(true)}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to Purchase Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="invoiceDate">Invoice Date</Label>
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
            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsInvoiceDialogOpen(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConvertToInvoice}
                disabled={convertToInvoiceMutation.isPending}
                className="w-full sm:w-auto"
              >
                {convertToInvoiceMutation.isPending ? "Converting..." : "Create Invoice"}
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
