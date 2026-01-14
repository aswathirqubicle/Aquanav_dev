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
import { Settings, Building, Users, Mail, Bell, Shield, Database, Download } from "lucide-react";
import { Company, insertCompanySchema } from "@shared/schema";
import { z } from "zod";

const updateCompanySchema = insertCompanySchema.extend({
  address: z.string().optional().nullable(),
  bankAccount: z.string().optional().nullable(),
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
    phone: "",
    email: "",
    website: "",
  });

  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    pushNotifications: true,
    lowStockAlerts: true,
    projectUpdates: true,
    payrollReminders: true,
  });

  const [security, setSecurity] = useState({
    twoFactorAuth: false,
    sessionTimeout: "30",
    passwordPolicy: "medium",
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    } else if (user?.role !== "admin") {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user, setLocation]);

  const { data: company, isLoading } = useQuery<Company>({
    queryKey: ["/api/company"],
    enabled: isAuthenticated && user?.role === "admin",
  });

  useEffect(() => {
    if (company) {
      console.log("company",company)
      setCompanyData({
        name: company.name || "",
        address: company.address || "",
        bankAccount: company.bankAccount || "",
        phone: company.phone || "",
        email: company.email || "",
        website: company.website || "",
      });

      // ✅ show existing logo
      setLogoPreview(company.logo || null);
    }
  }, [company]);

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: UpdateCompanyData) => {
      console.log("data",data);
      const formData = new FormData();

      formData.append("name", data.name);
      formData.append("email", data.email ?? "");
      formData.append("phone", data.phone ?? "");
      formData.append("address", data.address ?? "");
      formData.append("bankAccount", data.bankAccount ?? "");
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

  if (!isAuthenticated || user?.role !== "admin") {
    return null;
  }

  const handleCompanySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateCompanyMutation.mutate(companyData);
  };

  const handleCompanyChange = (field: keyof UpdateCompanyData, value: string) => {
    setCompanyData(prev => ({ ...prev, [field]: value }));
  };

  const handleNotificationChange = (field: keyof typeof notifications, value: boolean) => {
    setNotifications(prev => ({ ...prev, [field]: value }));
  };

  const handleSecurityChange = (field: keyof typeof security, value: string | boolean) => {
    setSecurity(prev => ({ ...prev, [field]: value }));
  };

  const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null);

  const handleBackupDownload = () => {
    toast({
      title: "Backup Download",
      description: "System backup download will be available soon.",
    });
  };

  const handleDataExport = () => {
    toast({
      title: "Data Export",
      description: "Data export functionality will be available soon.",
    });
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

      <Tabs defaultValue="company" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
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
                      <Label htmlFor="bankAccount">Bank Account</Label>
                      <Textarea
                        id="bankAccount"
                        value={companyData.bankAccount}
                        onChange={(e) => handleCompanyChange("bankAccount", e.target.value)}
                        rows={3}
                        placeholder="Bank account details"
                      />
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

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                User Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-slate-100">User Registration</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Control how new users can register and access the system
                    </p>
                  </div>
                  <Switch />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-slate-100">Email Verification</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Require email verification for new user accounts
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-slate-100">Role Management</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Allow dynamic role assignment and permissions
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Manage Roles
                  </Button>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium text-slate-900 dark:text-slate-100">Default User Settings</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Default Role for New Users</Label>
                      <select className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
                        <option value="employee">Employee</option>
                        <option value="customer">Customer</option>
                        <option value="project_manager">Project Manager</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Account Approval</Label>
                      <select className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
                        <option value="automatic">Automatic</option>
                        <option value="manual">Manual Review</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="h-5 w-5 mr-2" />
                Notification Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-slate-100">Email Notifications</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Send notifications via email
                    </p>
                  </div>
                  <Switch
                    checked={notifications.emailNotifications}
                    onCheckedChange={(checked) => handleNotificationChange("emailNotifications", checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-slate-100">Push Notifications</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Send browser push notifications
                    </p>
                  </div>
                  <Switch
                    checked={notifications.pushNotifications}
                    onCheckedChange={(checked) => handleNotificationChange("pushNotifications", checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-slate-100">Low Stock Alerts</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Alert when inventory items are running low
                    </p>
                  </div>
                  <Switch
                    checked={notifications.lowStockAlerts}
                    onCheckedChange={(checked) => handleNotificationChange("lowStockAlerts", checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-slate-100">Project Updates</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Notify about project status changes
                    </p>
                  </div>
                  <Switch
                    checked={notifications.projectUpdates}
                    onCheckedChange={(checked) => handleNotificationChange("projectUpdates", checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-slate-100">Payroll Reminders</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Send reminders for payroll processing
                    </p>
                  </div>
                  <Switch
                    checked={notifications.payrollReminders}
                    onCheckedChange={(checked) => handleNotificationChange("payrollReminders", checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Security Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-slate-100">Two-Factor Authentication</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Require 2FA for all admin users
                    </p>
                  </div>
                  <Switch
                    checked={security.twoFactorAuth}
                    onCheckedChange={(checked) => handleSecurityChange("twoFactorAuth", checked)}
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Session Timeout (minutes)</Label>
                    <select
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                      value={security.sessionTimeout}
                      onChange={(e) => handleSecurityChange("sessionTimeout", e.target.value)}
                    >
                      <option value="15">15 minutes</option>
                      <option value="30">30 minutes</option>
                      <option value="60">1 hour</option>
                      <option value="120">2 hours</option>
                      <option value="480">8 hours</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Password Policy</Label>
                    <select
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                      value={security.passwordPolicy}
                      onChange={(e) => handleSecurityChange("passwordPolicy", e.target.value)}
                    >
                      <option value="low">Low (6+ characters)</option>
                      <option value="medium">Medium (8+ chars, mixed case)</option>
                      <option value="high">High (12+ chars, special chars)</option>
                    </select>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium text-slate-900 dark:text-slate-100">Login Security</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-900 dark:text-slate-100">Login Attempt Monitoring</span>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-900 dark:text-slate-100">IP Whitelist</span>
                      <Switch />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="h-5 w-5 mr-2" />
                System Administration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-4">Data Management</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button variant="outline" onClick={handleBackupDownload}>
                      <Download className="h-4 w-4 mr-2" />
                      Download System Backup
                    </Button>
                    <Button variant="outline" onClick={handleDataExport}>
                      <Download className="h-4 w-4 mr-2" />
                      Export All Data
                    </Button>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-4">System Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600 dark:text-slate-400">System Version:</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">v1.0.0</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Database Status:</span>
                        <span className="text-sm font-medium text-green-600 dark:text-green-400">Connected</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Last Backup:</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {new Date().toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Storage Used:</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">1.2 GB</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Active Users:</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">5</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Uptime:</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">99.9%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-4">Maintenance</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button variant="outline">
                      Clear Cache
                    </Button>
                    <Button variant="outline">
                      Optimize Database
                    </Button>
                    <Button variant="outline">
                      System Health Check
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
