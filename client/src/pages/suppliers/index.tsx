import { useEffect, useState } from "react";
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
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Users, Plus, Mail, Phone, MapPin, FileText, Package, Archive, ArchiveRestore, Filter, Files } from "lucide-react";
import { z } from "zod";
import { CustomPagination } from "@/components/ui/pagination";
import { DocumentManager } from "@/components/documents/DocumentManager";
import { CurrencySelector } from "@/components/currency/CurrencySelector";
import { CurrencyDisplay } from "@/components/currency/CurrencyDisplay";

const supplierSchema = z.object({
  id: z.number(),
  name: z.string(),
  contactPerson: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  taxId: z.string().nullable(),
  category: z.string().nullable(),
  isArchived: z.boolean().optional(),
  // UAE VAT fields
  vatNumber: z.string().nullable(),
  vatRegistrationStatus: z.string().default("not_registered"),
  vatTreatment: z.string().default("standard"),
  supplierType: z.string().default("business"),
  taxCategory: z.string().default("standard"),
  paymentTerms: z.string().nullable(),
  currency: z.string().default("AED"),
  creditLimit: z.string().nullable(),
  isVatApplicable: z.boolean().default(true),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  bankAccountDetails: z.array(z.object({
    id: z.number(),
    supplierId: z.number(),
    accountDetails: z.string(),
  })).optional(),
});

const createSupplierSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  contactPerson: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  category: z.string().optional(),
  bankAccountDetails: z.array(z.object({
    id: z.number().optional(),
    accountDetails: z.string(),
  })).optional(),
  // UAE VAT fields
  vatNumber: z.string().optional(),
  vatRegistrationStatus: z.string().default("not_registered"),
  vatTreatment: z.enum(["standard", "zero_rated", "exempt", "out_of_scope"]).optional(),
  supplierType: z.string().default("business"),
  taxCategory: z.string().default("standard"),
  paymentTerms: z.string().default("30_days"),
  currency: z.string().default("AED"),
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

type Supplier = z.infer<typeof supplierSchema>;
type CreateSupplierData = z.infer<typeof createSupplierSchema>;

export default function SuppliersIndex() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isDocumentsDialogOpen, setIsDocumentsDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null>(null);
  const [formData, setFormData] = useState<CreateSupplierData>({
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    taxId: "",
    category: "",
    // UAE VAT defaults
    vatNumber: "",
    vatRegistrationStatus: "not_registered",
    vatTreatment: "zero_rated",
    supplierType: "business",
    taxCategory: "standard",
    paymentTerms: "30_days",
    currency: "AED",
    creditLimit: "",
    isVatApplicable: false,
    notes: "",
    bankAccountDetails: [{ accountDetails: "" }],
  });
  const EMPTY_BANK_ROW = { accountDetails: "" };


  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    } else if (user?.role !== "admin" && user?.role !== "project_manager" && user?.role !== "finance") {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user, setLocation]);

  const { data: suppliersResponse, isLoading } = useQuery<{
    data: Supplier[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: ["/api/suppliers", currentPage, showArchived],
    queryFn: async () => {
      try {
        const response = await apiRequest(`/api/suppliers?page=${currentPage}&limit=10&showArchived=${showArchived}`, {
          method: "GET"
        });
        const result = await response.json();
        console.log("Suppliers API response:", result);
        return result;
      } catch (error) {
        console.error("Error fetching suppliers:", error);
        throw error;
      }
    },
    enabled: isAuthenticated,
  });

  const suppliers = suppliersResponse?.data || [];

  useEffect(() => {
    if (suppliersResponse?.pagination) {
      setPagination(suppliersResponse.pagination);
    }
  }, [suppliersResponse]);

  const createSupplierMutation = useMutation({
    mutationFn: async (data: CreateSupplierData) => {
      const response = await apiRequest("/api/suppliers", {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({
        title: "Supplier Created",
        description: "The supplier has been added successfully.",
      });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create supplier",
        variant: "destructive",
      });
    },
  });

  const updateSupplierMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: CreateSupplierData }) => {
      const response = await apiRequest(`/api/suppliers/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({
        title: "Supplier Updated",
        description: "The supplier has been updated successfully.",
      });
      setIsDialogOpen(false);
      setEditingSupplier(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update supplier",
        variant: "destructive",
      });
    },
  });

  const archiveSupplierMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/suppliers/${id}/archive`, {
        method: "PUT",
        body: JSON.stringify({}),
        headers: {
          "Content-Type": "application/json",
        },
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({
        title: "Supplier Archived",
        description: "The supplier has been archived successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to archive supplier",
        variant: "destructive",
      });
    },
  });

  const unarchiveSupplierMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/suppliers/${id}/unarchive`, {
        method: "PUT",
        body: JSON.stringify({}),
        headers: {
          "Content-Type": "application/json",
        },
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({
        title: "Supplier Unarchived",
        description: "The supplier has been unarchived successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unarchive supplier",
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
      category: "",
      // UAE VAT defaults
      vatNumber: "",
      vatRegistrationStatus: "not_registered",
      vatTreatment: "zero_rated",
      supplierType: "business",
      taxCategory: "standard",
      paymentTerms: "30_days",
      currency: "AED",
      creditLimit: "",
      isVatApplicable: false,
      notes: "",
      bankAccountDetails: [{ accountDetails: "" }],
    });
  };

  useEffect(() => {
    if (editingSupplier) {
      const isNotRegistered = (editingSupplier.vatRegistrationStatus || "not_registered") === "not_registered";
      setFormData({
        name: editingSupplier.name,
        contactPerson: editingSupplier.contactPerson || "",
        email: editingSupplier.email || "",
        phone: editingSupplier.phone || "",
        address: editingSupplier.address || "",
        taxId: editingSupplier.taxId || "",
        category: editingSupplier.category || "",
        bankAccountDetails:
          editingSupplier.bankAccountDetails?.length > 0
            ? editingSupplier.bankAccountDetails
            : [EMPTY_BANK_ROW],
        // UAE VAT fields
        vatNumber: isNotRegistered ? "" : editingSupplier.vatNumber || "",
        vatRegistrationStatus: editingSupplier.vatRegistrationStatus || "not_registered",
        vatTreatment: isNotRegistered ? "zero_rated" : editingSupplier.vatTreatment || "standard",
        supplierType: editingSupplier.supplierType || "business",
        taxCategory: editingSupplier.taxCategory || "standard",
        paymentTerms: editingSupplier.paymentTerms || "30_days",
        currency: editingSupplier.currency || "AED",
        creditLimit: editingSupplier.creditLimit && Number(editingSupplier.creditLimit) > 0
          ? editingSupplier.creditLimit
          : "",
        isVatApplicable: !isNotRegistered,
        notes: editingSupplier.notes || "",
      });
    }
  }, [editingSupplier]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      creditLimit:
        formData.creditLimit && Number(formData.creditLimit) > 0
          ? formData.creditLimit
          : "0.00",
    };
    if (editingSupplier) {
      updateSupplierMutation.mutate({ id: editingSupplier.id, data: payload });
    } else {
      createSupplierMutation.mutate(payload);
    }
  };

  const handleChange = (field: keyof CreateSupplierData, value: any) => {
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

  const handleBankAccountChange = (index: number, value: string) => {
    const newDetails = [...formData.bankAccountDetails];
    newDetails[index] = { ...newDetails[index], accountDetails: value };
    handleChange("bankAccountDetails", newDetails);
  };

  const addBankAccountField = () => {
    handleChange("bankAccountDetails", [
      ...formData.bankAccountDetails,
      { accountDetails: "" },
    ]);
  };

  const removeBankAccountField = (index: number) => {
    if (formData.bankAccountDetails.length === 1) {
      // Clear instead of remove
      handleChange("bankAccountDetails", [{ accountDetails: "" }]);
      return;
    }

    const newDetails = formData.bankAccountDetails.filter((_, i) => i !== index);
    handleChange("bankAccountDetails", newDetails);
  };

  const handleManageDocuments = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsDocumentsDialogOpen(true);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleArchiveToggle = () => {
    setShowArchived(!showArchived);
    setCurrentPage(1); // Reset to first page when changing filter
  };

  if (!isAuthenticated || (user?.role !== "admin" && user?.role !== "project_manager" && user?.role !== "finance")) {
    return null;
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">Supplier Management</h1>
          <p className="text-sm md:text-base text-slate-600 dark:text-slate-400">Manage supplier relationships and procurement sources</p>
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
            if (!open) {
              setEditingSupplier(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button className="w-full md:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Add Supplier
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingSupplier ? "Edit Supplier" : "Add New Supplier"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Company Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    placeholder="e.g., Marine Supply Co."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactPerson">Contact Person</Label>
                  <Input
                    id="contactPerson"
                    value={formData.contactPerson}
                    onChange={(e) => handleChange("contactPerson", e.target.value)}
                    placeholder="e.g., Jane Doe"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      placeholder="sales@supplier.com"
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
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => handleChange("category", e.target.value)}
                    placeholder="e.g., Marine Equipment, Tools, Materials"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleChange("address", e.target.value)}
                    placeholder="456 Industrial Blvd, Supply City"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taxId">Tax ID</Label>
                  <Input
                    id="taxId"
                    value={formData.taxId}
                    onChange={(e) => handleChange("taxId", e.target.value)}
                    placeholder="TAX789012"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Bank Account Details</Label>
                  {formData.bankAccountDetails?.map((detail, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Textarea
                        value={detail.accountDetails}
                        onChange={(e) => handleBankAccountChange(index, e.target.value)}
                        placeholder={`Bank Account Details #${index + 1}`}
                        rows={2}
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeBankAccountField(index)}
                        disabled={formData.bankAccountDetails.length === 1}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addBankAccountField}
                  >
                    Add Bank Account
                  </Button>
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
                      <Label htmlFor="supplierType">Supplier Type</Label>
                      <Select value={formData.supplierType} onValueChange={(value) => handleChange("supplierType", value)}>
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
                          <SelectItem value="import">Import</SelectItem>
                          <SelectItem value="gcc_supplier">GCC Supplier</SelectItem>
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
                      placeholder="Additional notes about this supplier..."
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => {
                    setIsDialogOpen(false);
                    setEditingSupplier(null);
                    resetForm();
                  }}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createSupplierMutation.isPending || updateSupplierMutation.isPending}>
                    {createSupplierMutation.isPending
                      ? "Creating..."
                      : updateSupplierMutation.isPending
                        ? "Updating..."
                        : editingSupplier
                          ? "Update Supplier"
                          : "Create Supplier"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Supplier Documents Dialog */}
          <Dialog open={isDocumentsDialogOpen} onOpenChange={setIsDocumentsDialogOpen}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  Documents for {selectedSupplier?.name}
                </DialogTitle>
              </DialogHeader>
              {selectedSupplier && (
                <DocumentManager
                  entityId={selectedSupplier.id}
                  entityType="supplier"
                  title="Supplier Documents"
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
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
                <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400">Total Suppliers</p>
                <p className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {pagination?.total || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <Package className="h-5 w-5 md:h-6 md:w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-3 md:ml-4">
                <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400">Active Suppliers</p>
                <p className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {showArchived ? 0 : (pagination?.total || 0)}
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
                <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400">Categories</p>
                <p className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {suppliers ? new Set(suppliers.map(s => s.category).filter(Boolean)).size : 0}
                </p>
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
                  {suppliers?.filter(s => {
                    const created = new Date(s.createdAt);
                    const now = new Date();
                    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
                  }).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card> */}
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-400">Loading suppliers...</p>
        </div>
      ) : !suppliers || suppliers.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-16 w-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No suppliers found</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              Start building your supplier network by adding your first supplier
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Supplier
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 md:space-y-6">
          {suppliers
            .filter(supplier => showArchived ? supplier.isArchived : !supplier.isArchived)
            .map((supplier) => (
              <Card key={supplier.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between space-y-4 lg:space-y-0">
                    <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                      <div className="h-10 w-10 md:h-12 md:w-12 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                        <Package className="h-5 w-5 md:h-6 md:w-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base md:text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {supplier.name}
                        </h3>
                        {supplier.contactPerson && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                            Contact: {supplier.contactPerson}
                          </p>
                        )}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 mt-2 space-y-1 sm:space-y-0">
                          {supplier.category && (
                            <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 w-fit">
                              {supplier.category}
                            </Badge>
                          )}
                          <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
                            Supplier #{supplier.id}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-left lg:text-right">
                      <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
                        Added {new Date(supplier.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mt-4 md:mt-6">
                    {supplier.email && (
                      <div className="flex items-start space-x-2">
                        <Mail className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs md:text-sm font-medium text-slate-900 dark:text-slate-100">Email</p>
                          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 break-all">{supplier.email}</p>
                        </div>
                      </div>
                    )}

                    {supplier.phone && (
                      <div className="flex items-start space-x-2">
                        <Phone className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs md:text-sm font-medium text-slate-900 dark:text-slate-100">Phone</p>
                          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">{supplier.phone}</p>
                        </div>
                      </div>
                    )}

                    {supplier.address && (
                      <div className="flex items-start space-x-2">
                        <MapPin className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs md:text-sm font-medium text-slate-900 dark:text-slate-100">Address</p>
                          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                            {supplier.address}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start space-x-2">
                      <Package className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs md:text-sm font-medium text-slate-900 dark:text-slate-100">Category</p>
                        <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
                          {supplier.category || "Uncategorized"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bank Account Details */}
                  {supplier.bankAccountDetails && supplier.bankAccountDetails.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                      <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">Bank Account Details</h4>
                      {supplier.bankAccountDetails.map((detail, index) => (
                        <div key={index} className="mb-2 flex gap-2">
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            {index + 1}.
                          </span>
                          <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                            {detail.accountDetails}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* UAE VAT & Tax Information */}
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">UAE VAT & Tax Information</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {supplier.vatNumber && (
                        <div>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">VAT Number</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">{supplier.vatNumber}</p>
                        </div>
                      )}
                      {supplier.vatRegistrationStatus && (
                        <div>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">VAT Status</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 capitalize">
                            {supplier.vatRegistrationStatus.replace('_', ' ')}
                          </p>
                        </div>
                      )}
                      {supplier.vatTreatment && (
                        <div>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">VAT Treatment</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 capitalize">
                            {supplier.vatTreatment.replace('_', ' ')}
                            {supplier.vatTreatment === 'standard' && ' (5%)'}
                            {supplier.vatTreatment === 'zero_rated' && ' (0%)'}
                          </p>
                        </div>
                      )}
                      {supplier.supplierType && (
                        <div>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Supplier Type</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 capitalize">
                            {supplier.supplierType.replace('_', ' ')}
                          </p>
                        </div>
                      )}
                      {supplier.currency && (
                        <div>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Currency</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">{supplier.currency}</p>
                        </div>
                      )}
                      {supplier.paymentTerms && (
                        <div>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Payment Terms</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 capitalize">
                            {supplier.paymentTerms.replace('_', ' ')}
                          </p>
                        </div>
                      )}
                      {supplier.taxId && (
                        <div>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Tax ID</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">{supplier.taxId}</p>
                        </div>
                      )}
                      {supplier.creditLimit && (
                        <div>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Credit Limit</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            {supplier.currency || 'AED'} {parseFloat(supplier.creditLimit).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">VAT Applicable</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {supplier.isVatApplicable ? 'Yes' : 'No'}
                        </p>
                      </div>
                    </div>
                    {supplier.notes && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Notes</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{supplier.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 md:mt-6 flex flex-col sm:flex-row sm:justify-end gap-2">
                    {/* <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => {
                    setLocation(`/suppliers/${supplier.id}/orders`);
                  }}>
                    View Orders
                  </Button>
                  <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => {
                    setLocation(`/suppliers/${supplier.id}/products`);
                  }}>
                    View Products
                  </Button> */}
                    <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => handleManageDocuments(supplier)}>
                      <Files className="h-4 w-4 mr-2" />
                      Documents
                    </Button>
                    <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => {
                      setEditingSupplier(supplier);
                      setIsDialogOpen(true);
                    }}>
                      Edit Supplier
                    </Button>
                    {supplier.isArchived ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => unarchiveSupplierMutation.mutate(supplier.id)}
                        disabled={unarchiveSupplierMutation.isPending}
                      >
                        <ArchiveRestore className="h-4 w-4 mr-2" />
                        {unarchiveSupplierMutation.isPending ? "Unarchiving..." : "Unarchive"}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => archiveSupplierMutation.mutate(supplier.id)}
                        disabled={archiveSupplierMutation.isPending}
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        {archiveSupplierMutation.isPending ? "Archiving..." : "Archive"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <CustomPagination
            currentPage={currentPage}
            totalPages={pagination.totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
}
