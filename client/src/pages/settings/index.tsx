import { formatDisplayDate } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Settings, Building, Database, Download, RefreshCw, Activity, Trash2, Loader2, CheckCircle, XCircle, AlertTriangle, DollarSign, Plus, Pencil, Trash, Save, X } from "lucide-react";
import { Company, insertCompanySchema, ExchangeRate } from "@shared/schema";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { z } from "zod";

const updateCompanySchema = insertCompanySchema.extend({
  address: z.string().optional().nullable(),
  bankAccount: z.string().optional().nullable(),
  bankAccount2: z.string().optional().nullable(),
});

type UpdateCompanyData = z.infer<typeof updateCompanySchema>;

export default function SettingsIndex() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [companyData, setCompanyData] = useState<UpdateCompanyData>({
    name: "",
    address: "",
    bankAccount: "",
    bankAccount2: "",
    phone: "",
    email: "",
    website: "",
    financialYearStartDay: 1,
    financialYearStartMonth: 1,
    financialYearEndDay: 31,
    financialYearEndMonth: 12,
  });

  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";
  const isFinance = user?.role === "finance";
  const hasAccess = isAdmin || isFinance;

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    } else if (!hasAccess) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, hasAccess, setLocation]);

  const { data: company, isLoading } = useQuery<Company>({
    queryKey: ["/api/company"],
    enabled: isAuthenticated && user?.role === "admin",
  });

  useEffect(() => {
    if (company) {
      console.log("company", company)
      setCompanyData({
        name: company.name || "",
        address: company.address || "",
        bankAccount: company.bankAccount || "",
        bankAccount2: company.bankAccount2 || "",
        phone: company.phone || "",
        email: company.email || "",
        website: company.website || "",
        financialYearStartDay: company.financialYearStartDay || 1,
        financialYearStartMonth: company.financialYearStartMonth || 1,
        financialYearEndDay: company.financialYearEndDay || 31,
        financialYearEndMonth: company.financialYearEndMonth || 12,
      });

      // ✅ show existing logo
      setLogoPreview(company.logo || null);
    }
  }, [company]);

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: UpdateCompanyData) => {
      console.log("data", data);
      const formData = new FormData();

      formData.append("name", data.name);
      formData.append("email", data.email ?? "");
      formData.append("phone", data.phone ?? "");
      formData.append("address", data.address ?? "");
      formData.append("bankAccount", data.bankAccount ?? "");
      formData.append("bankAccount2", data.bankAccount2 ?? "");
      formData.append("website", data.website ?? "");

      if (companyLogoFile) {
        formData.append("companyLogo", companyLogoFile); // ✅ fixed
      }

      const response = await fetch("/api/company", {
        method: "PUT",
        body: formData,
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Update failed");
      }

      return response.json();

    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company"] });
      toast({
        title: "Company Settings Updated",
        description: "Company information has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update company settings",
        variant: "destructive",
      });
    },
  });

  if (!isAuthenticated || !hasAccess) {
    return null;
  }

  const handleCompanySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateCompanyMutation.mutate(companyData);
  };

  const handleCompanyChange = (field: keyof UpdateCompanyData, value: string | number) => {
    setCompanyData(prev => ({ ...prev, [field]: value }));
  };

  const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null);

  const [isBackupLoading, setIsBackupLoading] = useState(false);
  const [isExportLoading, setIsExportLoading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isHealthChecking, setIsHealthChecking] = useState(false);
  const [healthData, setHealthData] = useState<any>(null);
  const [optimizeResult, setOptimizeResult] = useState<any>(null);

  const handleBackupDownload = async () => {
    setIsBackupLoading(true);
    try {
      const response = await fetch("/api/system/backup", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to download backup");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aquanav_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Backup Downloaded", description: "System backup has been downloaded successfully." });
    } catch (error: any) {
      toast({ title: "Backup Failed", description: error.message || "Failed to download backup", variant: "destructive" });
    } finally {
      setIsBackupLoading(false);
    }
  };

  const handleDataExport = async () => {
    setIsExportLoading(true);
    try {
      const response = await fetch("/api/system/export", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to export data");
      const data = await response.json();

      const csvContent: string[] = [];
      for (const [tableName, csv] of Object.entries(data.tables as Record<string, string>)) {
        csvContent.push(`\n=== TABLE: ${tableName} ===\n`);
        csvContent.push(csv);
      }
      const blob = new Blob([csvContent.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aquanav_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Data Exported", description: "All data has been exported as CSV." });
    } catch (error: any) {
      toast({ title: "Export Failed", description: error.message || "Failed to export data", variant: "destructive" });
    } finally {
      setIsExportLoading(false);
    }
  };

  const handleClearCache = () => {
    queryClient.clear();
    toast({ title: "Cache Cleared", description: "Application cache has been cleared. Data will be refreshed on next load." });
  };

  const handleOptimizeDatabase = async () => {
    setIsOptimizing(true);
    setOptimizeResult(null);
    try {
      const response = await apiRequest("/api/system/optimize", { method: "POST" });
      const result = await response.json();
      setOptimizeResult(result);
      toast({ title: "Database Optimized", description: `Optimization completed in ${result.duration}. ${result.details.tablesReindexed} tables reindexed.` });
    } catch (error: any) {
      toast({ title: "Optimization Failed", description: error.message || "Failed to optimize database", variant: "destructive" });
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleHealthCheck = async () => {
    setIsHealthChecking(true);
    setHealthData(null);
    try {
      const response = await fetch("/api/system/health", { credentials: "include" });
      if (!response.ok) throw new Error("Health check failed");
      const data = await response.json();
      setHealthData(data);
      toast({ title: "Health Check Complete", description: `Database is ${data.status}. ${data.database.totalTables} tables, ${data.database.totalRows} total rows.` });
    } catch (error: any) {
      setHealthData({ status: "unhealthy", error: error.message });
      toast({ title: "Health Check Failed", description: error.message || "Failed to run health check", variant: "destructive" });
    } finally {
      setIsHealthChecking(false);
    }
  };


  const SUPPORTED_CURRENCIES = ["AED", "USD", "EUR", "GBP", "SAR", "INR", "PKR", "PHP", "BDT", "NPR", "LKR", "EGP", "JOD", "KWD", "BHD", "OMR", "QAR"];

  const { data: exchangeRatesData = [], isLoading: isLoadingRates } = useQuery<ExchangeRate[]>({
    queryKey: ["/api/exchange-rates"],
    enabled: isAuthenticated && hasAccess,
  });

  const [showAddRate, setShowAddRate] = useState(false);
  const [editingRateId, setEditingRateId] = useState<number | null>(null);
  const [rateForm, setRateForm] = useState({ fromCurrency: "AED", toCurrency: "USD", rate: "", isActive: true });

  const createRateMutation = useMutation({
    mutationFn: async (data: typeof rateForm) => {
      const response = await apiRequest("/api/exchange-rates", { method: "POST", body: data });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exchange-rates"] });
      setShowAddRate(false);
      setRateForm({ fromCurrency: "AED", toCurrency: "USD", rate: "", isActive: true });
      toast({ title: "Exchange Rate Added", description: "New currency conversion rate has been saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to add exchange rate", variant: "destructive" });
    },
  });

  const updateRateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof rateForm }) => {
      const response = await apiRequest(`/api/exchange-rates/${id}`, { method: "PUT", body: data });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exchange-rates"] });
      setEditingRateId(null);
      setRateForm({ fromCurrency: "AED", toCurrency: "USD", rate: "", isActive: true });
      toast({ title: "Exchange Rate Updated", description: "Currency conversion rate has been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update exchange rate", variant: "destructive" });
    },
  });

  const deleteRateMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/exchange-rates/${id}`, { method: "DELETE" });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exchange-rates"] });
      toast({ title: "Exchange Rate Deleted", description: "Currency conversion rate has been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to delete exchange rate", variant: "destructive" });
    },
  });

  const handleStartEdit = (rate: ExchangeRate) => {
    setEditingRateId(rate.id);
    setRateForm({
      fromCurrency: rate.fromCurrency,
      toCurrency: rate.toCurrency,
      rate: String(rate.rate),
      isActive: rate.isActive,
    });
  };

  const handleCancelEdit = () => {
    setEditingRateId(null);
    setRateForm({ fromCurrency: "AED", toCurrency: "USD", rate: "", isActive: true });
  };

  const handleSaveRate = () => {
    if (!rateForm.rate || parseFloat(rateForm.rate) <= 0) {
      toast({ title: "Invalid Rate", description: "Please enter a valid positive exchange rate.", variant: "destructive" });
      return;
    }
    if (rateForm.fromCurrency === rateForm.toCurrency) {
      toast({ title: "Invalid Currencies", description: "From and To currencies must be different.", variant: "destructive" });
      return;
    }
    if (editingRateId) {
      updateRateMutation.mutate({ id: editingRateId, data: rateForm });
    } else {
      createRateMutation.mutate(rateForm);
    }
  };


  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">System Settings</h1>
          <p className="text-slate-600 dark:text-slate-400">Configure system preferences and company information</p>
        </div>
        <div className="flex items-center space-x-2">
          <Settings className="h-5 w-5 text-slate-400" />
          <span className="text-sm text-slate-600 dark:text-slate-400">Administrator Panel</span>
        </div>
      </div>

      <Tabs defaultValue={isFinance && !isAdmin ? "currency" : "company"} className="space-y-6">
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-3' : 'grid-cols-1'}`}>
          {isAdmin && <TabsTrigger value="company">Company</TabsTrigger>}
          <TabsTrigger value="currency">Currency Rates</TabsTrigger>
          {isAdmin && <TabsTrigger value="system">System</TabsTrigger>}
        </TabsList>

        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building className="h-5 w-5 mr-2" />
                Company Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <p className="text-slate-500 dark:text-slate-400">Loading company information...</p>
                </div>
              ) : (
                <form onSubmit={handleCompanySubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company Name *</Label>
                      <Input
                        id="companyName"
                        value={companyData.name}
                        onChange={(e) => handleCompanyChange("name", e.target.value)}
                        placeholder="Your Company Name"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="companyWebsite">Website</Label>
                      <Input
                        id="companyWebsite"
                        value={companyData.website}
                        onChange={(e) => handleCompanyChange("website", e.target.value)}
                        placeholder="https://www.yourcompany.com"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="companyLogo">Company Logo</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setCompanyLogoFile(file);

                          if (file) {
                            // ✅ show selected image immediately
                            const previewUrl = URL.createObjectURL(file);
                            setLogoPreview(previewUrl);
                          } else {
                            // 🔁 revert to original logo
                            setLogoPreview(company?.logo || null);
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      {logoPreview && (
                        <img
                          src={logoPreview}
                          alt="Company Logo Preview"
                          className="h-20 object-contain mt-2 border rounded"
                        />
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="companyAddress">Address</Label>
                      <Textarea
                        id="companyAddress"
                        value={companyData.address}
                        onChange={(e) => handleCompanyChange("address", e.target.value)}
                        placeholder="Company address..."
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bankAccount">Bank Account 1</Label>
                      <div className="mt-1 border border-input rounded-md overflow-hidden">
                        <ReactQuill
                          theme="snow"
                          value={companyData.bankAccount || ""}
                          onChange={(value) => handleCompanyChange("bankAccount", value)}
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
                    <div className="space-y-2">
                      <Label htmlFor="bankAccount2">Bank Account 2</Label>
                      <div className="mt-1 border border-input rounded-md overflow-hidden">
                        <ReactQuill
                          theme="snow"
                          value={companyData.bankAccount2 || ""}
                          onChange={(value) => handleCompanyChange("bankAccount2", value)}
                          placeholder="Additional bank account details"
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="companyPhone">Phone</Label>
                      <Input
                        id="companyPhone"
                        value={companyData.phone}
                        onChange={(e) => handleCompanyChange("phone", e.target.value)}
                        placeholder="+1-555-0123"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="companyEmail">Email</Label>
                      <Input
                        id="companyEmail"
                        type="email"
                        value={companyData.email}
                        onChange={(e) => handleCompanyChange("email", e.target.value)}
                        placeholder="info@yourcompany.com"
                      />
                    </div>
                  </div>

                  <Separator className="my-6" />

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Financial Year Settings</h3>
                    <p className="text-sm text-muted-foreground">Configure your organization's financial year period.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4 p-4 border rounded-lg">
                        <h4 className="font-medium text-sm">Financial Year Start</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="fyStartDay">Day</Label>
                            <select
                              id="fyStartDay"
                              value={companyData.financialYearStartDay || 1}
                              onChange={(e) => handleCompanyChange("financialYearStartDay", parseInt(e.target.value))}
                              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                            >
                              {Array.from({ length: 31 }, (_, i) => (
                                <option key={i + 1} value={i + 1}>{i + 1}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="fyStartMonth">Month</Label>
                            <select
                              id="fyStartMonth"
                              value={companyData.financialYearStartMonth || 1}
                              onChange={(e) => handleCompanyChange("financialYearStartMonth", parseInt(e.target.value))}
                              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                            >
                              <option value={1}>January</option>
                              <option value={2}>February</option>
                              <option value={3}>March</option>
                              <option value={4}>April</option>
                              <option value={5}>May</option>
                              <option value={6}>June</option>
                              <option value={7}>July</option>
                              <option value={8}>August</option>
                              <option value={9}>September</option>
                              <option value={10}>October</option>
                              <option value={11}>November</option>
                              <option value={12}>December</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 p-4 border rounded-lg">
                        <h4 className="font-medium text-sm">Financial Year End</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="fyEndDay">Day</Label>
                            <select
                              id="fyEndDay"
                              value={companyData.financialYearEndDay || 31}
                              onChange={(e) => handleCompanyChange("financialYearEndDay", parseInt(e.target.value))}
                              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                            >
                              {Array.from({ length: 31 }, (_, i) => (
                                <option key={i + 1} value={i + 1}>{i + 1}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="fyEndMonth">Month</Label>
                            <select
                              id="fyEndMonth"
                              value={companyData.financialYearEndMonth || 12}
                              onChange={(e) => handleCompanyChange("financialYearEndMonth", parseInt(e.target.value))}
                              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                            >
                              <option value={1}>January</option>
                              <option value={2}>February</option>
                              <option value={3}>March</option>
                              <option value={4}>April</option>
                              <option value={5}>May</option>
                              <option value={6}>June</option>
                              <option value={7}>July</option>
                              <option value={8}>August</option>
                              <option value={9}>September</option>
                              <option value={10}>October</option>
                              <option value={11}>November</option>
                              <option value={12}>December</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-6">
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={updateCompanyMutation.isPending}>
                      {updateCompanyMutation.isPending ? "Updating..." : "Update Company Info"}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="currency">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <DollarSign className="h-5 w-5 mr-2" />
                  Currency Exchange Rates
                </CardTitle>
                <Button onClick={() => { setShowAddRate(true); setEditingRateId(null); setRateForm({ fromCurrency: "AED", toCurrency: "USD", rate: "", isActive: true }); }} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rate
                </Button>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Manually configure conversion rates between AED and other currencies. Base currency is AED.
              </p>
            </CardHeader>
            <CardContent>
              {(showAddRate || editingRateId) && (
                <div className="mb-6 p-4 border rounded-lg bg-slate-50 dark:bg-slate-900 space-y-4">
                  <h4 className="font-medium text-slate-900 dark:text-slate-100">
                    {editingRateId ? "Edit Exchange Rate" : "Add New Exchange Rate"}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="space-y-2">
                      <Label htmlFor="fromCurrency">From Currency</Label>
                      <select
                        id="fromCurrency"
                        value={rateForm.fromCurrency}
                        onChange={(e) => setRateForm(prev => ({ ...prev, fromCurrency: e.target.value }))}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      >
                        {SUPPORTED_CURRENCIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="toCurrency">To Currency</Label>
                      <select
                        id="toCurrency"
                        value={rateForm.toCurrency}
                        onChange={(e) => setRateForm(prev => ({ ...prev, toCurrency: e.target.value }))}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      >
                        {SUPPORTED_CURRENCIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rateValue">Rate (1 {rateForm.fromCurrency} = ? {rateForm.toCurrency})</Label>
                      <Input
                        id="rateValue"
                        type="number"
                        step="0.00000001"
                        min="0"
                        value={rateForm.rate}
                        onChange={(e) => setRateForm(prev => ({ ...prev, rate: e.target.value }))}
                        placeholder="e.g. 0.27229"
                      />
                    </div>
                    <div className="flex space-x-2">
                      <Button onClick={handleSaveRate} disabled={createRateMutation.isPending || updateRateMutation.isPending} className="flex-1">
                        {(createRateMutation.isPending || updateRateMutation.isPending) ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Save
                      </Button>
                      <Button variant="outline" onClick={() => { setShowAddRate(false); handleCancelEdit(); }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={rateForm.isActive}
                      onCheckedChange={(checked) => setRateForm(prev => ({ ...prev, isActive: checked }))}
                    />
                    <Label className="text-sm">Active</Label>
                  </div>
                </div>
              )}

              {isLoadingRates ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400" />
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Loading exchange rates...</p>
                </div>
              ) : exchangeRatesData.length === 0 ? (
                <div className="text-center py-12 border rounded-lg bg-slate-50 dark:bg-slate-900">
                  <DollarSign className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                  <h3 className="text-lg font-medium text-slate-600 dark:text-slate-400">No Exchange Rates Configured</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Click "Add Rate" to set up your first currency conversion rate.</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-900">
                      <tr>
                        <th className="text-left p-3 font-medium text-sm text-slate-600 dark:text-slate-400">From</th>
                        <th className="text-left p-3 font-medium text-sm text-slate-600 dark:text-slate-400">To</th>
                        <th className="text-right p-3 font-medium text-sm text-slate-600 dark:text-slate-400">Rate</th>
                        <th className="text-center p-3 font-medium text-sm text-slate-600 dark:text-slate-400">Status</th>
                        <th className="text-right p-3 font-medium text-sm text-slate-600 dark:text-slate-400">Last Updated</th>
                        <th className="text-right p-3 font-medium text-sm text-slate-600 dark:text-slate-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exchangeRatesData.map((rate, idx) => (
                        <tr key={rate.id} className={idx % 2 === 0 ? 'bg-white dark:bg-slate-950' : 'bg-slate-50 dark:bg-slate-900'}>
                          <td className="p-3">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              {rate.fromCurrency}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              {rate.toCurrency}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono text-sm text-slate-900 dark:text-slate-100">
                            1 {rate.fromCurrency} = {parseFloat(String(rate.rate)).toFixed(8)} {rate.toCurrency}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${rate.isActive
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              }`}>
                              {rate.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="p-3 text-right text-sm text-slate-500 dark:text-slate-400">
                            {rate.updatedAt ? formatDisplayDate(rate.updatedAt) : "-"}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end space-x-1">
                              <Button variant="ghost" size="sm" onClick={() => handleStartEdit(rate)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => deleteRateMutation.mutate(rate.id)} disabled={deleteRateMutation.isPending}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950">
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  <strong>Note:</strong> These exchange rates are manually configured and will be used across the system for currency conversions.
                  Make sure to keep them updated regularly. Rates are expressed as: 1 unit of source currency = X units of target currency.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Download className="h-5 w-5 mr-2" />
                  Data Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg space-y-3">
                    <h4 className="font-medium text-slate-900 dark:text-slate-100">Download System Backup</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Download a complete JSON backup of all database tables and records.
                    </p>
                    <Button variant="outline" onClick={handleBackupDownload} disabled={isBackupLoading} className="w-full">
                      {isBackupLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                      {isBackupLoading ? "Preparing Backup..." : "Download Backup (JSON)"}
                    </Button>
                  </div>
                  <div className="p-4 border rounded-lg space-y-3">
                    <h4 className="font-medium text-slate-900 dark:text-slate-100">Export All Data</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Export all data tables in CSV format for use in spreadsheet applications.
                    </p>
                    <Button variant="outline" onClick={handleDataExport} disabled={isExportLoading} className="w-full">
                      {isExportLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                      {isExportLoading ? "Preparing Export..." : "Export All Data (CSV)"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="h-5 w-5 mr-2" />
                  Maintenance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg space-y-3">
                    <h4 className="font-medium text-slate-900 dark:text-slate-100">Clear Cache</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Clear application cache to force fresh data loads on all pages.
                    </p>
                    <Button variant="outline" onClick={handleClearCache} className="w-full">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear Cache
                    </Button>
                  </div>
                  <div className="p-4 border rounded-lg space-y-3">
                    <h4 className="font-medium text-slate-900 dark:text-slate-100">Optimize Database</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Run VACUUM ANALYZE and reindex tables to improve performance.
                    </p>
                    <Button variant="outline" onClick={handleOptimizeDatabase} disabled={isOptimizing} className="w-full">
                      {isOptimizing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                      {isOptimizing ? "Optimizing..." : "Optimize Database"}
                    </Button>
                  </div>
                  <div className="p-4 border rounded-lg space-y-3">
                    <h4 className="font-medium text-slate-900 dark:text-slate-100">System Health Check</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Check database connectivity, table stats, and overall system health.
                    </p>
                    <Button variant="outline" onClick={handleHealthCheck} disabled={isHealthChecking} className="w-full">
                      {isHealthChecking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Activity className="h-4 w-4 mr-2" />}
                      {isHealthChecking ? "Checking..." : "Run Health Check"}
                    </Button>
                  </div>
                </div>

                {optimizeResult && (
                  <div className="mt-6 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center mb-3">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                      <h4 className="font-medium text-green-900 dark:text-green-100">Database Optimization Results</h4>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-green-700 dark:text-green-300 block">Duration</span>
                        <span className="font-medium text-green-900 dark:text-green-100">{optimizeResult.duration}</span>
                      </div>
                      <div>
                        <span className="text-green-700 dark:text-green-300 block">Tables Reindexed</span>
                        <span className="font-medium text-green-900 dark:text-green-100">{optimizeResult.details?.tablesReindexed} / {optimizeResult.details?.totalTables}</span>
                      </div>
                      <div>
                        <span className="text-green-700 dark:text-green-300 block">Dead Rows Before</span>
                        <span className="font-medium text-green-900 dark:text-green-100">{optimizeResult.details?.deadTuplesBefore?.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-green-700 dark:text-green-300 block">Dead Rows After</span>
                        <span className="font-medium text-green-900 dark:text-green-100">{optimizeResult.details?.deadTuplesAfter?.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {healthData && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    {healthData.status === "healthy" ? (
                      <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 mr-2 text-red-600" />
                    )}
                    System Health Report
                    <span className={`ml-3 px-2 py-0.5 text-xs rounded-full ${
                      healthData.status === "healthy" 
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                    }`}>
                      {healthData.status?.toUpperCase()}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {healthData.status === "unhealthy" ? (
                    <div className="flex items-center text-red-600 dark:text-red-400">
                      <AlertTriangle className="h-5 w-5 mr-2" />
                      <span>{healthData.error || "Database connection failed"}</span>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg text-center">
                          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{healthData.database?.latency}</div>
                          <div className="text-xs text-blue-600 dark:text-blue-400">DB Latency</div>
                        </div>
                        <div className="p-3 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg text-center">
                          <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{healthData.database?.size}</div>
                          <div className="text-xs text-purple-600 dark:text-purple-400">Database Size</div>
                        </div>
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg text-center">
                          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{healthData.database?.totalTables}</div>
                          <div className="text-xs text-emerald-600 dark:text-emerald-400">Total Tables</div>
                        </div>
                        <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg text-center">
                          <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{healthData.database?.totalRows?.toLocaleString()}</div>
                          <div className="text-xs text-amber-600 dark:text-amber-400">Total Rows</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-900 rounded">
                          <span className="text-slate-600 dark:text-slate-400">Total Indexes</span>
                          <span className="font-medium text-slate-900 dark:text-slate-100">{healthData.database?.totalIndexes}</span>
                        </div>
                        <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-900 rounded">
                          <span className="text-slate-600 dark:text-slate-400">Index Scans</span>
                          <span className="font-medium text-slate-900 dark:text-slate-100">{healthData.database?.totalIndexScans?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-900 rounded">
                          <span className="text-slate-600 dark:text-slate-400">Dead Rows (need cleanup)</span>
                          <span className={`font-medium ${healthData.database?.deadTuples > 1000 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                            {healthData.database?.deadTuples?.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-3">Table Details</h4>
                        <div className="max-h-64 overflow-y-auto border rounded-lg">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0">
                              <tr>
                                <th className="text-left p-2 font-medium text-slate-600 dark:text-slate-400">Table Name</th>
                                <th className="text-right p-2 font-medium text-slate-600 dark:text-slate-400">Rows</th>
                              </tr>
                            </thead>
                            <tbody>
                              {healthData.tables?.map((table: any, idx: number) => (
                                <tr key={table.name} className={idx % 2 === 0 ? 'bg-white dark:bg-slate-950' : 'bg-slate-50 dark:bg-slate-900'}>
                                  <td className="p-2 text-slate-900 dark:text-slate-100">{table.name}</td>
                                  <td className="p-2 text-right font-mono text-slate-700 dark:text-slate-300">{table.rows.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="text-xs text-slate-400 dark:text-slate-500 text-right">
                        Last checked: {new Date(healthData.timestamp).toLocaleString()}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
