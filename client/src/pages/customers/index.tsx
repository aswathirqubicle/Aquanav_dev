import { useEffect, useState, startTransition } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CustomPagination } from "@/components/ui/pagination";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Users, Plus, Mail, Phone, MapPin, FileText, Ship, Archive, ArchiveRestore, Filter, Files } from "lucide-react";
import { z } from "zod";
import { DocumentManager } from "@/components/documents/DocumentManager";
import { CurrencySelector } from "@/components/currency/CurrencySelector";
import { CurrencyDisplay } from "@/components/currency/CurrencyDisplay";

const customerSchema = z.object({
  id: z.number(),
  name: z.string(),
  contactPerson: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  taxId: z.string().nullable(),
  userId: z.number().nullable(),
  isArchived: z.boolean().optional(),
  projectCount: z.number().optional(),
  // UAE VAT Compliance Fields
  vatNumber: z.string().nullable(),
  vatRegistrationStatus: z.string().nullable(),
  vatTreatment: z.string().nullable(),
  customerType: z.string().nullable(),
  taxCategory: z.string().nullable(),
  paymentTerms: z.string().nullable(),
  currency: z.string().nullable(),
  creditLimit: z.string().nullable(),
  isVatApplicable: z.boolean().optional(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const createCustomerSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  contactPerson: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  userId: z.number().nullable().optional(),
  // UAE VAT Compliance Fields
  vatNumber: z.string().optional(),
  vatRegistrationStatus: z.enum(["not_registered", "registered", "exempt", "suspended"]).default("not_registered"),
  vatTreatment: z.enum(["standard", "zero_rated", "exempt", "out_of_scope"]).optional(),
  customerType: z.enum(["business", "individual", "government", "non_profit"]).default("business"),
  taxCategory: z.enum(["standard", "export", "gcc_customer", "free_zone"]).default("standard"),
  paymentTerms: z.enum(["30_days", "15_days", "7_days", "immediate", "net_30", "net_60", "net_90"]).default("30_days"),
  currency: z.enum(["AED", "USD", "EUR", "GBP", "SAR"]).default("AED"),
  creditLimit: z.string().optional(),
  isVatApplicable: z.boolean().default(true),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.vatRegistrationStatus === "registered" && (!data.vatNumber || data.vatNumber.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["vatNumber"],
      message: "VAT Number is required when registered",
    });
  }
});

type Customer = z.infer<typeof customerSchema>;
type CreateCustomerData = z.infer<typeof createCustomerSchema>;

export default function CustomersIndex() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDocumentsDialogOpen, setIsDocumentsDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null>(null);

  const [formData, setFormData] = useState<CreateCustomerData>({
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    taxId: "",
    userId: null,
    // UAE VAT Compliance Fields
    vatNumber: "",
    vatRegistrationStatus: "not_registered",
    vatTreatment: "zero_rated",
    customerType: "business",
    taxCategory: "standard",
    paymentTerms: "30_days",
    currency: "AED",
    creditLimit: "",
    isVatApplicable: false,
    notes: "",
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    } else if (user?.role !== "admin" && user?.role !== "project_manager") {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user, setLocation]);

  const { data: customersResponse, isLoading } = useQuery<{
    data: Customer[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: ["/api/customers", currentPage, showArchived],
    queryFn: async () => {
      try {
        const response = await apiRequest(`/api/customers?page=${currentPage}&limit=10&showArchived=${showArchived}`, {
          method: "GET"
        });
        const result = await response.json();
        console.log("Customers API response:", result);
        return result;
      } catch (error) {
        console.error("Error fetching customers:", error);
        throw error;
      }
    },
    enabled: isAuthenticated,
  });

  const customers = customersResponse?.data || [];

  useEffect(() => {
    if (customersResponse?.pagination) {
      setPagination(customersResponse.pagination);
    }
  }, [customersResponse]);

  const { data: stats } = useQuery<{
    totalCustomers: number;
    activeCustomers: number;
    totalProjects: number;
  }>({
    queryKey: ["/api/customers/stats"],
    queryFn: async () => {
      const response = await apiRequest("/api/customers/stats");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (data: CreateCustomerData) => {
      const response = await apiRequest("/api/customers", {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Customer Created",
        description: "The customer has been added successfully.",
      });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create customer",
        variant: "destructive",
      });
    },
  });

  const updateCustomerMutation = useMutation({
    mutationFn: async (data: CreateCustomerData & { id: number }) => {
      const response = await apiRequest(`/api/customers/${data.id}`, {
        method: "PUT",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Customer Updated",
        description: "The customer has been updated successfully.",
      });
      setIsEditDialogOpen(false);
      setEditingCustomer(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update customer",
        variant: "destructive",
      });
    },
  });

  const archiveCustomerMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/customers/${id}/archive`, {
        method: "PUT",
        body: JSON.stringify({}),
        headers: {
          "Content-Type": "application/json",
        },
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Customer Archived",
        description: "The customer has been archived successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to archive customer",
        variant: "destructive",
      });
    },
  });

  const unarchiveCustomerMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/customers/${id}/unarchive`, {
        method: "PUT",
        body: JSON.stringify({}),
        headers: {
          "Content-Type": "application/json",
        },
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Customer Unarchived",
        description: "The customer has been unarchived successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unarchive customer",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      taxId: "",
      userId: null,
      // UAE VAT Compliance Fields
      vatNumber: "",
      vatRegistrationStatus: "not_registered",
      vatTreatment: "zero_rated",
      customerType: "business",
      taxCategory: "standard",
      paymentTerms: "30_days",
      currency: "AED",
      creditLimit: "",
      isVatApplicable: false,
      notes: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      creditLimit:
        formData.creditLimit && Number(formData.creditLimit) > 0
          ? formData.creditLimit
          : "0.00",
    };
    startTransition(() => {
      if (editingCustomer) {
        updateCustomerMutation.mutate({ ...payload, id: editingCustomer.id });
      } else {
        createCustomerMutation.mutate(payload);
      }
    });
  };

  const handleChange = (field: keyof CreateCustomerData, value: any) => {
    setFormData(prev => {
      const newFormData = { ...prev, [field]: value };

      if (field === "vatRegistrationStatus") {
        if (value === "not_registered") {
          newFormData.vatNumber = "";
          newFormData.vatTreatment = "zero_rated";
          newFormData.isVatApplicable = false;
        } else if (prev.vatRegistrationStatus === "not_registered") {
          newFormData.isVatApplicable = true;
          newFormData.vatTreatment = "standard";
        } else {
          newFormData.isVatApplicable = true;
        }
      }

      return newFormData;
    });
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    const isNotRegistered = (customer.vatRegistrationStatus || "not_registered") === "not_registered";
    setFormData({
      name: customer.name,
      contactPerson: customer.contactPerson || "",
      email: customer.email || "",
      phone: customer.phone || "",
      address: customer.address || "",
      taxId: customer.taxId || "",
      userId: customer.userId,
      // UAE VAT Compliance Fields
      vatNumber: isNotRegistered ? "" : customer.vatNumber || "",
      vatRegistrationStatus: customer.vatRegistrationStatus || "not_registered",
      vatTreatment: isNotRegistered ? "zero_rated" : customer.vatTreatment || "standard",
      customerType: customer.customerType || "business",
      taxCategory: customer.taxCategory || "standard",
      paymentTerms: customer.paymentTerms || "30_days",
      currency: customer.currency || "AED",
      creditLimit: customer.creditLimit && Number(customer.creditLimit) > 0
        ? customer.creditLimit
        : "",
      isVatApplicable: !isNotRegistered,
      notes: customer.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleManageDocuments = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDocumentsDialogOpen(true);
  };

  const handleViewProjects = (customer: Customer) => {
    startTransition(() => {
      setLocation(`/projects?customer=${customer.id}`);
    });
  };

  const handleViewInvoices = (customer: Customer) => {
    startTransition(() => {
      setLocation(`/sales?customer=${customer.id}`);
    });
  };

  if (!isAuthenticated || (user?.role !== "admin" && user?.role !== "project_manager")) {
    return null;
  }

  const handlePageChange = (page: number) => {
    startTransition(() => {
      setCurrentPage(page);
    });
  };

  const handleArchiveToggle = () => {
    startTransition(() => {
      setShowArchived(!showArchived);
      setCurrentPage(1); // Reset to first page when changing filter
    });
  };

  // Ensure we have valid data before filtering
  const validCustomers = Array.isArray(customers) ? customers : [];

  // Filter customers based on archived status - since pagination is server-side, show all returned customers
  const filteredCustomers = validCustomers;

  const totalPages = pagination?.totalPages || 0;

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">Customer Management</h1>
          <p className="text-sm md:text-base text-slate-600 dark:text-slate-400">Manage customer relationships and project assignments</p>
        </div>
        <div className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-2">
          <Button
            variant="outline"
            onClick={handleArchiveToggle}
            className="w-full md:w-auto"
          >
            <Filter className="h-4 w-4 mr-2" />
            {showArchived ? "Show Active" : "Show Archived"}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="w-full md:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Customer</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Company Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    placeholder="e.g., Maritime Logistics Corp"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactPerson">Contact Person</Label>
                  <Input
                    id="contactPerson"
                    value={formData.contactPerson}
                    onChange={(e) => handleChange("contactPerson", e.target.value)}
                    placeholder="e.g., John Smith"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      placeholder="contact@company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      placeholder="+1-555-0123"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleChange("address", e.target.value)}
                    placeholder="123 Harbor Street, Port City"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taxId">Tax ID</Label>
                  <Input
                    id="taxId"
                    value={formData.taxId}
                    onChange={(e) => handleChange("taxId", e.target.value)}
                    placeholder="TAX123456"
                  />
                </div>

                {/* UAE VAT Compliance Section */}
                <div className="space-y-4 border-t pt-4">
                  <h4 className="font-medium text-sm text-slate-700 dark:text-slate-300">UAE VAT & Tax Information</h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="vatRegistrationStatus">VAT Registration Status</Label>
                      <Select value={formData.vatRegistrationStatus} onValueChange={(value) => handleChange("vatRegistrationStatus", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_registered">Not Registered</SelectItem>
                          <SelectItem value="registered">Registered</SelectItem>
                          <SelectItem value="exempt">Exempt</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.vatRegistrationStatus !== "not_registered" && (
                      <div className="space-y-2">
                        <Label htmlFor="vatNumber">VAT Number {formData.vatRegistrationStatus === "registered" && <span>*</span>}</Label>
                        <Input
                          id="vatNumber"
                          value={formData.vatNumber}
                          onChange={(e) => handleChange("vatNumber", e.target.value)}
                          placeholder="100123456700003"
                          required={formData.vatRegistrationStatus === "registered"}
                        />
                      </div>
                    )}
                    {formData.vatRegistrationStatus !== "not_registered" && (
                      <div className="space-y-2">
                        <Label htmlFor="vatTreatment">VAT Treatment</Label>
                        <Select value={formData.vatTreatment || "standard"} onValueChange={(value) => handleChange("vatTreatment", value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select treatment" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="standard">Standard (5%)</SelectItem>
                            <SelectItem value="zero_rated">Zero Rated (0%)</SelectItem>
                            <SelectItem value="exempt">Exempt</SelectItem>
                            <SelectItem value="out_of_scope">Out of Scope</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="customerType">Customer Type</Label>
                      <Select value={formData.customerType} onValueChange={(value) => handleChange("customerType", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="business">Business</SelectItem>
                          <SelectItem value="individual">Individual</SelectItem>
                          <SelectItem value="government">Government</SelectItem>
                          <SelectItem value="non_profit">Non-Profit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="taxCategory">Tax Category</Label>
                      <Select value={formData.taxCategory} onValueChange={(value) => handleChange("taxCategory", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="export">Export</SelectItem>
                          <SelectItem value="gcc_customer">GCC Customer</SelectItem>
                          <SelectItem value="free_zone">Free Zone</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paymentTerms">Payment Terms</Label>
                      <Select value={formData.paymentTerms} onValueChange={(value) => handleChange("paymentTerms", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select terms" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="immediate">Immediate</SelectItem>
                          <SelectItem value="7_days">7 Days</SelectItem>
                          <SelectItem value="15_days">15 Days</SelectItem>
                          <SelectItem value="30_days">30 Days</SelectItem>
                          <SelectItem value="net_30">Net 30</SelectItem>
                          <SelectItem value="net_60">Net 60</SelectItem>
                          <SelectItem value="net_90">Net 90</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <CurrencySelector
                        value={formData.currency}
                        onChange={(value) => handleChange("currency", value)}
                        variant="major"
                        placeholder="Select currency"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="creditLimit">Credit Limit</Label>
                      <Input
                        id="creditLimit"
                        value={formData.creditLimit}
                        onChange={(e) => handleChange("creditLimit", e.target.value)}
                        placeholder="0.00"
                        type="number"
                        step="0.01"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isVatApplicable"
                      checked={formData.isVatApplicable}
                      onCheckedChange={(checked) => handleChange("isVatApplicable", checked)}
                    />
                    <Label htmlFor="isVatApplicable">VAT Applicable</Label>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => handleChange("notes", e.target.value)}
                      placeholder="Additional notes about this customer..."
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createCustomerMutation.isPending}>
                    {createCustomerMutation.isPending ? "Creating..." : "Create Customer"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Customer Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditingCustomer(null);
            resetForm();
          }
        }}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Customer</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Company Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="e.g., Maritime Logistics Corp"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-contactPerson">Contact Person</Label>
                <Input
                  id="edit-contactPerson"
                  value={formData.contactPerson}
                  onChange={(e) => handleChange("contactPerson", e.target.value)}
                  placeholder="e.g., John Smith"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    placeholder="contact@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder="+1-555-0123"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-address">Address</Label>
                <Input
                  id="edit-address"
                  value={formData.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  placeholder="123 Harbor Street, Port City"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-taxId">Tax ID</Label>
                <Input
                  id="edit-taxId"
                  value={formData.taxId}
                  onChange={(e) => handleChange("taxId", e.target.value)}
                  placeholder="TAX123456"
                />
              </div>

              {/* UAE VAT Compliance Section */}
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-medium text-sm text-slate-700 dark:text-slate-300">UAE VAT & Tax Information</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-vatRegistrationStatus">VAT Registration Status</Label>
                    <Select value={formData.vatRegistrationStatus} onValueChange={(value) => handleChange("vatRegistrationStatus", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_registered">Not Registered</SelectItem>
                        <SelectItem value="registered">Registered</SelectItem>
                        <SelectItem value="exempt">Exempt</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.vatRegistrationStatus !== "not_registered" && (
                    <div className="space-y-2">
                      <Label htmlFor="edit-vatNumber">VAT Number {formData.vatRegistrationStatus === "registered" && <span>*</span>}</Label>
                      <Input
                        id="edit-vatNumber"
                        value={formData.vatNumber}
                        onChange={(e) => handleChange("vatNumber", e.target.value)}
                        placeholder="100123456700003"
                        required={formData.vatRegistrationStatus === "registered"}
                      />
                    </div>
                  )}
                  {formData.vatRegistrationStatus !== "not_registered" && (
                    <div className="space-y-2">
                      <Label htmlFor="edit-vatTreatment">VAT Treatment</Label>
                      <Select value={formData.vatTreatment || "standard"} onValueChange={(value) => handleChange("vatTreatment", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select treatment" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard (5%)</SelectItem>
                          <SelectItem value="zero_rated">Zero Rated (0%)</SelectItem>
                          <SelectItem value="exempt">Exempt</SelectItem>
                          <SelectItem value="out_of_scope">Out of Scope</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="edit-customerType">Customer Type</Label>
                    <Select value={formData.customerType} onValueChange={(value) => handleChange("customerType", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="business">Business</SelectItem>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="government">Government</SelectItem>
                        <SelectItem value="non_profit">Non-Profit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-taxCategory">Tax Category</Label>
                    <Select value={formData.taxCategory} onValueChange={(value) => handleChange("taxCategory", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="export">Export</SelectItem>
                        <SelectItem value="gcc_customer">GCC Customer</SelectItem>
                        <SelectItem value="free_zone">Free Zone</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-paymentTerms">Payment Terms</Label>
                    <Select value={formData.paymentTerms} onValueChange={(value) => handleChange("paymentTerms", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select terms" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">Immediate</SelectItem>
                        <SelectItem value="7_days">7 Days</SelectItem>
                        <SelectItem value="15_days">15 Days</SelectItem>
                        <SelectItem value="30_days">30 Days</SelectItem>
                        <SelectItem value="net_30">Net 30</SelectItem>
                        <SelectItem value="net_60">Net 60</SelectItem>
                        <SelectItem value="net_90">Net 90</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-currency">Currency</Label>
                    <Select value={formData.currency} onValueChange={(value) => handleChange("currency", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AED">AED (UAE Dirham)</SelectItem>
                        <SelectItem value="USD">USD (US Dollar)</SelectItem>
                        <SelectItem value="EUR">EUR (Euro)</SelectItem>
                        <SelectItem value="GBP">GBP (British Pound)</SelectItem>
                        <SelectItem value="SAR">SAR (Saudi Riyal)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-creditLimit">Credit Limit</Label>
                    <Input
                      id="edit-creditLimit"
                      value={formData.creditLimit}
                      onChange={(e) => handleChange("creditLimit", e.target.value)}
                      placeholder="0.00"
                      type="number"
                      step="0.01"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="edit-isVatApplicable"
                    checked={formData.isVatApplicable}
                    onCheckedChange={(checked) => handleChange("isVatApplicable", checked)}
                  />
                  <Label htmlFor="edit-isVatApplicable">VAT Applicable</Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-notes">Notes</Label>
                  <Textarea
                    id="edit-notes"
                    value={formData.notes}
                    onChange={(e) => handleChange("notes", e.target.value)}
                    placeholder="Additional notes about this customer..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingCustomer(null);
                  resetForm();
                }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateCustomerMutation.isPending}>
                  {updateCustomerMutation.isPending ? "Updating..." : "Update Customer"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Customer Documents Dialog */}
        <Dialog open={isDocumentsDialogOpen} onOpenChange={setIsDocumentsDialogOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Documents for {selectedCustomer?.name}
              </DialogTitle>
            </DialogHeader>
            {selectedCustomer && (
              <DocumentManager
                entityId={selectedCustomer.id}
                entityType="customer"
                title="Customer Documents"
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6 mb-6 md:mb-8">
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Users className="h-5 w-5 md:h-6 md:w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-3 md:ml-4">
                <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400">Total Customers</p>
                <p className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {/* {pagination?.total || 0} */}
                   {stats?.totalCustomers || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <Ship className="h-5 w-5 md:h-6 md:w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-3 md:ml-4">
                <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400">Active Customers</p>
                <p className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {/* {showArchived ? 0 : (pagination?.total || 0)} */}
                  {stats?.activeCustomers || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <FileText className="h-5 w-5 md:h-6 md:w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="ml-3 md:ml-4">
                <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400">Projects</p>
                <p className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">{stats?.totalProjects || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                <Users className="h-5 w-5 md:h-6 md:w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="ml-3 md:ml-4">
                <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400">This Month</p>
                <p className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {customers?.filter(c => {
                    const created = new Date(c.createdAt);
                    const now = new Date();
                    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
                  }).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card> */}
      </div>

      {
        isLoading ? (
          <div className="text-center py-12">
            <p className="text-slate-500 dark:text-slate-400">Loading customers...</p>
          </div>
        ) : !customers || customers.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Users className="h-16 w-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No customers found</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6">
                Start building your customer base by adding your first customer
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Customer
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {filteredCustomers.map((customer) => (
              <Card key={customer.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                        <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {customer.name}
                        </h3>
                        {customer.contactPerson && (
                          <p className="text-slate-600 dark:text-slate-400">
                            Contact: {customer.contactPerson}
                          </p>
                        )}
                        <div className="flex items-center space-x-4 mt-2">
                          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                            Customer
                          </Badge>
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            Customer #{customer.id}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Added {new Date(customer.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mt-4 md:mt-6">
                    {customer.email && (
                      <div className="flex items-start space-x-2">
                        <Mail className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs md:text-sm font-medium text-slate-900 dark:text-slate-100">Email</p>
                          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 break-all">{customer.email}</p>
                        </div>
                      </div>
                    )}

                    {customer.phone && (
                      <div className="flex items-start space-x-2">
                        <Phone className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs md:text-sm font-medium text-slate-900 dark:text-slate-100">Phone</p>
                          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">{customer.phone}</p>
                        </div>
                      </div>
                    )}

                    {customer.address && (
                      <div className="flex items-start space-x-2">
                        <MapPin className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs md:text-sm font-medium text-slate-900 dark:text-slate-100">Address</p>
                          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                            {customer.address}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start space-x-2">
                      <Ship className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs md:text-sm font-medium text-slate-900 dark:text-slate-100">Projects</p>
                        <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">{customer.projectCount} total projects</p>
                      </div>
                    </div>
                  </div>

                  {/* UAE VAT & Tax Information */}
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">UAE VAT & Tax Information</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {customer.vatNumber && (
                        <div>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">VAT Number</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">{customer.vatNumber}</p>
                        </div>
                      )}
                      {customer.vatRegistrationStatus && (
                        <div>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">VAT Status</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 capitalize">
                            {customer.vatRegistrationStatus.replace('_', ' ')}
                          </p>
                        </div>
                      )}
                      {customer.vatTreatment && (
                        <div>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">VAT Treatment</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 capitalize">
                            {customer.vatTreatment.replace('_', ' ')}
                            {customer.vatTreatment === 'standard' && ' (5%)'}
                            {customer.vatTreatment === 'zero_rated' && ' (0%)'}
                          </p>
                        </div>
                      )}
                      {customer.customerType && (
                        <div>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Customer Type</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 capitalize">
                            {customer.customerType.replace('_', ' ')}
                          </p>
                        </div>
                      )}
                      {customer.currency && (
                        <div>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Currency</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">{customer.currency}</p>
                        </div>
                      )}
                      {customer.paymentTerms && (
                        <div>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Payment Terms</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 capitalize">
                            {customer.paymentTerms.replace('_', ' ')}
                          </p>
                        </div>
                      )}
                      {customer.taxId && (
                        <div>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Tax ID</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">{customer.taxId}</p>
                        </div>
                      )}
                      {customer.creditLimit && (
                        <div>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Credit Limit</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            {customer.currency || 'AED'} {parseFloat(customer.creditLimit).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">VAT Applicable</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {customer.isVatApplicable ? 'Yes' : 'No'}
                        </p>
                      </div>
                    </div>
                    {customer.notes && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Notes</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{customer.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 md:mt-6 flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => handleViewProjects(customer)}
                    >
                      View Projects
                    </Button>
                    {/* <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => handleViewInvoices(customer)}
                    >
                      View Invoices
                    </Button> */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => handleManageDocuments(customer)}
                    >
                      <Files className="h-4 w-4 mr-2" />
                      Documents
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => handleEditCustomer(customer)}
                    >
                      Edit Customer
                    </Button>
                    {customer.isArchived ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => startTransition(() => unarchiveCustomerMutation.mutate(customer.id))}
                        disabled={unarchiveCustomerMutation.isPending}
                      >
                        <ArchiveRestore className="h-4 w-4 mr-2" />
                        {unarchiveCustomerMutation.isPending ? "Unarchiving..." : "Unarchive"}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => startTransition(() => archiveCustomerMutation.mutate(customer.id))}
                        disabled={archiveCustomerMutation.isPending}
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        {archiveCustomerMutation.isPending ? "Archiving..." : "Archive"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      }

      {
        totalPages > 1 && (
          <div className="mt-6 flex justify-center">
            <CustomPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        )
      }
    </div >
  );
}
