import {
  REIMBURSEMENT_CATEGORIES,
  DEFAULT_REIMBURSEMENT_CATEGORY,
} from "@shared/payroll-types";
import { formatDisplayDate } from "@/lib/utils";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Autocomplete } from "@/components/ui/autocomplete";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Calendar,
  User,
  FileText,
  Receipt,
  Eye,
  Trash2,
  Loader2,
  Upload,
  Paperclip,
  FolderOpen,
  X,
  Pencil,
  Download,
  Tag,
  UserCog,
} from "lucide-react";

export default function ReimbursementsIndex() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [selectedReimbursement, setSelectedReimbursement] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editFormData, setEditFormData] = useState({
    amount: "",
    description: "",
    category: DEFAULT_REIMBURSEMENT_CATEGORY as string,
    originalExpenseDate: "",
    projectId: "",
  });
  const [editExistingAttachments, setEditExistingAttachments] = useState<string[]>([]);
  const [editNewFiles, setEditNewFiles] = useState<File[]>([]);

  const [formData, setFormData] = useState({
    amount: "",
    description: "",
    category: DEFAULT_REIMBURSEMENT_CATEGORY as string,
    originalExpenseDate: "",
    projectId: "",
    employeeId: "",
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const isAdmin = user?.role === "admin";
  const isFinance = user?.role === "finance";
  const isProjectManager = user?.role === "project_manager";
  const canApprove = isAdmin || isFinance;
  const canCreateForOthers = isAdmin || isFinance || isProjectManager;

  const { data: reimbursements = [], isLoading } = useQuery({
    queryKey: ["/api/reimbursements", activeTab === "my" ? "my" : "all"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeTab === "my") params.set("view", "my");
      const response = await fetch(`/api/reimbursements?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch reimbursements");
      return response.json();
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["/api/projects"],
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["/api/employees"],
    enabled: canCreateForOthers,
  });

  const createMutation = useMutation({
    mutationFn: async (formDataToSend: FormData) => {
      const response = await fetch("/api/reimbursements", {
        method: "POST",
        body: formDataToSend,
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create reimbursement");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reimbursements"] });
      setIsCreateDialogOpen(false);
      setFormData({ amount: "", description: "", category: DEFAULT_REIMBURSEMENT_CATEGORY, originalExpenseDate: "", projectId: "", employeeId: "" });
      setSelectedFiles([]);
      toast({ title: "Success", description: "Reimbursement request submitted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create reimbursement", variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/reimbursements/${id}/approve`, { method: "PUT" });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reimbursements"] });
      setIsViewDialogOpen(false);
      toast({ title: "Success", description: "Reimbursement approved and added to upcoming payroll" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to approve", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const response = await apiRequest(`/api/reimbursements/${id}/reject`, { method: "PUT", body: { reason } });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reimbursements"] });
      setIsRejectDialogOpen(false);
      setIsViewDialogOpen(false);
      setRejectionReason("");
      toast({ title: "Success", description: "Reimbursement rejected" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to reject", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/reimbursements/${id}`, { method: "DELETE" });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reimbursements"] });
      toast({ title: "Success", description: "Reimbursement deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: number; formData: FormData }) => {
      const response = await fetch(`/api/reimbursements/${id}`, {
        method: "PUT",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update reimbursement");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reimbursements"] });
      setIsEditDialogOpen(false);
      setIsViewDialogOpen(false);
      setEditNewFiles([]);
      toast({ title: "Success", description: "Reimbursement updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update", variant: "destructive" });
    },
  });

  const openEditDialog = (reimbursement: any) => {
    setEditFormData({
      amount: reimbursement.amount?.toString() || "",
      description: reimbursement.description || "",
      category: reimbursement.category || DEFAULT_REIMBURSEMENT_CATEGORY,
      originalExpenseDate: reimbursement.originalExpenseDate?.split('T')[0] || "",
      projectId: reimbursement.projectId?.toString() || "",
    });
    setEditExistingAttachments(reimbursement.attachments || []);
    setEditNewFiles([]);
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReimbursement) return;
    if (!editFormData.amount || !editFormData.description || !editFormData.originalExpenseDate) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    const formDataToSend = new FormData();
    formDataToSend.append("amount", editFormData.amount);
    formDataToSend.append("description", editFormData.description);
    formDataToSend.append("category", editFormData.category);
    formDataToSend.append("originalExpenseDate", editFormData.originalExpenseDate);
    formDataToSend.append("projectId", editFormData.projectId || "");

    editExistingAttachments.forEach(att => {
      formDataToSend.append("existingAttachments", att);
    });

    editNewFiles.forEach(file => {
      formDataToSend.append("attachments", file);
    });

    updateMutation.mutate({
      id: selectedReimbursement.id,
      formData: formDataToSend,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.description || !formData.originalExpenseDate) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }
    
    const formDataToSend = new FormData();
    formDataToSend.append("amount", formData.amount);
    formDataToSend.append("description", formData.description);
    formDataToSend.append("category", formData.category);
    formDataToSend.append("originalExpenseDate", formData.originalExpenseDate);
    if (formData.projectId) {
      formDataToSend.append("projectId", formData.projectId);
    }
    if (formData.employeeId && canCreateForOthers) {
      formDataToSend.append("employeeId", formData.employeeId);
    }
    selectedFiles.forEach((file) => {
      formDataToSend.append("attachments", file);
    });
    
    createMutation.mutate(formDataToSend);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 5) {
      toast({ title: "Error", description: "Maximum 5 files allowed", variant: "destructive" });
      return;
    }
    setSelectedFiles([...selectedFiles, ...files]);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500 text-white"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const getPayrollPeriod = (month: number | null, year: number | null, status?: string) => {
    // An approved claim carries no period until a payroll run actually picks it
    // up, so "—" would read as though it had been missed. It is queued, not lost.
    if (!month || !year) return status === "approved" ? "Next payroll" : "—";
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${monthNames[month - 1]} ${year}`;
  };

  const filteredReimbursements = reimbursements.filter((r: any) => {
    if (statusFilter === "all") return true;
    return r.status === statusFilter;
  });

  const stats = {
    total: reimbursements.length,
    pending: reimbursements.filter((r: any) => r.status === "pending").length,
    approved: reimbursements.filter((r: any) => r.status === "approved").length,
    rejected: reimbursements.filter((r: any) => r.status === "rejected").length,
    totalAmount: reimbursements.reduce((sum: number, r: any) => sum + parseFloat(r.amount || 0), 0),
    approvedAmount: reimbursements
      .filter((r: any) => r.status === "approved")
      .reduce((sum: number, r: any) => sum + parseFloat(r.amount || 0), 0),
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Reimbursements</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Submit and track expense reimbursement requests
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          New Request
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Receipt className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Requests</p>
                <p className="text-xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-xl font-bold">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-xl font-bold">{stats.approved}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <DollarSign className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Approved Amount</p>
                <p className="text-xl font-bold">AED {stats.approvedAmount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle>Reimbursement Requests</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              {canApprove && (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
                  <TabsList>
                    <TabsTrigger value="all">All Requests</TabsTrigger>
                    <TabsTrigger value="my">My Requests</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredReimbursements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No reimbursement requests found</p>
              <Button variant="outline" className="mt-4" onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Submit Your First Request
              </Button>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Expense Date</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payroll Period</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReimbursements.map((reimbursement: any) => (
                      <TableRow key={reimbursement.id}>
                        <TableCell className="font-medium">{reimbursement.employeeName}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          <div className="flex items-center gap-2">
                            {reimbursement.attachments && reimbursement.attachments.length > 0 && (
                              <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" title={`${reimbursement.attachments.length} attachment(s)`} />
                            )}
                            <span className="truncate">{reimbursement.description}</span>
                          </div>
                        </TableCell>
                        <TableCell>AED {parseFloat(reimbursement.amount).toLocaleString()}</TableCell>
                        <TableCell>{formatDisplayDate(reimbursement.originalExpenseDate)}</TableCell>
                        <TableCell>{formatDisplayDate(reimbursement.submissionTimestamp)}</TableCell>
                        <TableCell>{getStatusBadge(reimbursement.status)}</TableCell>
                        <TableCell>{getPayrollPeriod(reimbursement.payrollMonth, reimbursement.payrollYear, reimbursement.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedReimbursement(reimbursement);
                                setIsViewDialogOpen(true);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {reimbursement.status === "pending" && reimbursement.userId === user?.id && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteMutation.mutate(reimbursement.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="md:hidden space-y-4">
                {filteredReimbursements.map((reimbursement: any) => (
                  <Card key={reimbursement.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">{reimbursement.employeeName}</p>
                            <p className="text-sm text-muted-foreground line-clamp-2">{reimbursement.description}</p>
                          </div>
                          {getStatusBadge(reimbursement.status)}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-muted-foreground" />
                            <span>AED {parseFloat(reimbursement.amount).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span>{formatDisplayDate(reimbursement.originalExpenseDate)}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              setSelectedReimbursement(reimbursement);
                              setIsViewDialogOpen(true);
                            }}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View
                          </Button>
                          {reimbursement.status === "pending" && reimbursement.userId === user?.id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteMutation.mutate(reimbursement.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-0 border-b pb-4">
            <div className="flex items-center gap-3 text-left">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-sky-500 text-white shadow-sm shadow-blue-500/30">
                <Receipt className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base sm:text-lg">New Reimbursement Request</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Submit an expense for approval
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {canCreateForOthers && (
              <div className="space-y-2">
                <Label htmlFor="employee">Employee</Label>
                <Autocomplete
                  // "Myself" carries the empty value the rest of the form
                  // already treats as "no employee chosen". The field is
                  // optional, so a type-to-search box needs a way back to that
                  // once someone has been picked.
                  options={[
                    { value: "", label: "Myself" },
                    ...employees
                      .filter((employee: any) => employee.isActive)
                      .map((employee: any) => ({
                        value: employee.id.toString(),
                        label: `${employee.firstName} ${employee.lastName} (${employee.employeeCode})`,
                        searchText: `${employee.firstName} ${employee.lastName} ${employee.employeeCode || ""} ${employee.email || ""}`,
                      })),
                  ]}
                  value={formData.employeeId}
                  onValueChange={(value) => setFormData({ ...formData, employeeId: value })}
                  placeholder="Search by name or employee code..."
                  emptyMessage="No active employees found"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to create for yourself, or select an employee
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                    AED
                  </span>
                  <Input
                    id="amount"
                    type="number"
                    step="any"
                    placeholder="0.00"
                    className="pl-12"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {REIMBURSEMENT_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe the expense (e.g., Travel expenses for client meeting)"
                className="min-h-[80px] resize-none"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="expenseDate">Expense Date *</Label>
                <Input
                  id="expenseDate"
                  type="date"
                  value={formData.originalExpenseDate}
                  onChange={(e) => setFormData({ ...formData, originalExpenseDate: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project">Project (Optional)</Label>
                <Select
                  value={formData.projectId}
                  onValueChange={(value) => setFormData({ ...formData, projectId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project: any) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">
                Attachments <span className="font-normal text-muted-foreground">(optional, max 5 files)</span>
              </Label>
              <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/50 dark:hover:border-blue-500 dark:hover:bg-blue-950/20">
                <input
                  type="file"
                  id="fileUpload"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xlsx,.xls,.txt,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="fileUpload" className="flex cursor-pointer flex-col items-center gap-1.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                    <Upload className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-medium">Tap to upload receipts</span>
                  <span className="text-xs text-muted-foreground">
                    PDF, Images, Word, Excel (max 25MB each)
                  </span>
                </label>
              </div>
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm">{file.name}</span>
                        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} className="w-full sm:w-auto">
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="w-[95vw] max-w-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-0 border-b pb-4">
            <div className="flex items-center gap-3 text-left">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-sky-500 text-white shadow-sm shadow-blue-500/30">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base sm:text-lg">Reimbursement Details</DialogTitle>
                <DialogDescription className="truncate text-xs sm:text-sm">
                  {selectedReimbursement ? `Submitted by ${selectedReimbursement.employeeName}` : "View request information"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {selectedReimbursement && (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3 rounded-xl border bg-gradient-to-br from-blue-50 to-sky-50 p-4 dark:border-blue-950/50 dark:from-blue-950/30 dark:to-sky-950/20">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold sm:text-3xl">AED {parseFloat(selectedReimbursement.amount).toLocaleString()}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {getStatusBadge(selectedReimbursement.status)}
                  <Badge variant="outline" className="gap-1 bg-background/60">
                    <Tag className="h-3 w-3" />
                    {REIMBURSEMENT_CATEGORIES.find((c) => c.value === selectedReimbursement.category)?.label || selectedReimbursement.category}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <User className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Employee</p>
                    <p className="truncate text-sm font-medium sm:text-base">{selectedReimbursement.employeeName}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <UserCog className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Created By</p>
                    <p className="truncate text-sm font-medium sm:text-base">{selectedReimbursement.userName}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Expense Date</p>
                    <p className="truncate text-sm font-medium sm:text-base">{formatDisplayDate(selectedReimbursement.originalExpenseDate)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Clock className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Submitted</p>
                    <p className="truncate text-sm font-medium sm:text-base">{new Date(selectedReimbursement.submissionTimestamp).toLocaleString()}</p>
                  </div>
                </div>
                {(selectedReimbursement.payrollMonth ||
                  selectedReimbursement.status === "approved") && (
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Payroll Period</p>
                      <p className="truncate text-sm font-medium sm:text-base">{getPayrollPeriod(selectedReimbursement.payrollMonth, selectedReimbursement.payrollYear, selectedReimbursement.status)}</p>
                    </div>
                  </div>
                )}
                {selectedReimbursement.projectName && (
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                      <FolderOpen className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Project</p>
                      <p className="truncate text-sm font-medium sm:text-base">{selectedReimbursement.projectName}</p>
                    </div>
                  </div>
                )}
                {selectedReimbursement.approvedByName && (
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <CheckCircle className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        {selectedReimbursement.status === "approved" ? "Approved By" : "Processed By"}
                      </p>
                      <p className="truncate text-sm font-medium sm:text-base">{selectedReimbursement.approvedByName}</p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Description</p>
                <p className="rounded-lg bg-muted/50 p-3 text-sm leading-relaxed">{selectedReimbursement.description}</p>
              </div>

              {selectedReimbursement.rejectionReason && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-destructive">
                    <XCircle className="h-3.5 w-3.5" />
                    Rejection Reason
                  </p>
                  <p className="text-sm text-destructive/90">{selectedReimbursement.rejectionReason}</p>
                </div>
              )}

              {selectedReimbursement.attachments && selectedReimbursement.attachments.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Attachments ({selectedReimbursement.attachments.length})
                  </p>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {selectedReimbursement.attachments.map((attachment: string, index: number) => (
                      <li
                        key={index}
                        className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 transition-shadow hover:shadow-sm"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                            <Paperclip className="h-3.5 w-3.5" />
                          </span>
                          <span
                            className="truncate text-sm font-medium text-slate-700 dark:text-slate-300"
                            title={attachment.split('/').pop()}
                          >
                            {attachment.split('/').pop()}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-8 shrink-0 gap-1 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/20"
                        >
                          <a
                            href={`/${attachment}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Download</span>
                          </a>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedReimbursement.status === "pending" && (
                (selectedReimbursement.userId === user?.id || isAdmin) ||
                (canApprove && (isAdmin || (isFinance && selectedReimbursement.userRole !== "finance")))
              ) && (
                <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                  {(selectedReimbursement.userId === user?.id || isAdmin) && (
                    <Button
                      variant="outline"
                      onClick={() => openEditDialog(selectedReimbursement)}
                      className="w-full sm:mr-auto sm:w-auto"
                    >
                      <Pencil className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  )}
                  {canApprove && (isAdmin || (isFinance && selectedReimbursement.userRole !== "finance")) && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsRejectDialogOpen(true);
                        }}
                        className="w-full text-destructive hover:text-destructive sm:w-auto"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                      <Button
                        onClick={() => approveMutation.mutate(selectedReimbursement.id)}
                        disabled={approveMutation.isPending}
                        className="w-full sm:w-auto"
                      >
                        {approveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve
                      </Button>
                    </>
                  )}
                </div>
              )}

              {selectedReimbursement.status === "pending" && isFinance && selectedReimbursement.userRole === "finance" && (
                <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-900/50 dark:bg-yellow-950/30 dark:text-yellow-300">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Finance users cannot approve reimbursements created by finance users. An Admin must approve this request.</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Reimbursement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rejectionReason">Reason for Rejection</Label>
              <Textarea
                id="rejectionReason"
                placeholder="Please provide a reason for rejecting this request..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedReimbursement) {
                    rejectMutation.mutate({ id: selectedReimbursement.id, reason: rejectionReason });
                  }
                }}
                disabled={rejectMutation.isPending}
              >
                {rejectMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirm Rejection
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-0 border-b pb-4">
            <div className="flex items-center gap-3 text-left">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-sky-500 text-white shadow-sm shadow-blue-500/30">
                <Pencil className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base sm:text-lg">Edit Reimbursement Request</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Update the details before approval
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="editAmount">Amount *</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                    AED
                  </span>
                  <Input
                    id="editAmount"
                    type="number"
                    step="any"
                    placeholder="0.00"
                    className="pl-12"
                    value={editFormData.amount}
                    onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editCategory">Category *</Label>
                <Select
                  value={editFormData.category}
                  onValueChange={(value) => setEditFormData({ ...editFormData, category: value })}
                >
                  <SelectTrigger id="editCategory">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {REIMBURSEMENT_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editDescription">Description *</Label>
              <Textarea
                id="editDescription"
                placeholder="Describe the expense"
                className="min-h-[80px] resize-none"
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="editExpenseDate">Expense Date *</Label>
                <Input
                  id="editExpenseDate"
                  type="date"
                  value={editFormData.originalExpenseDate}
                  onChange={(e) => setEditFormData({ ...editFormData, originalExpenseDate: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editProject">Project (Optional)</Label>
                <Select
                  value={editFormData.projectId}
                  onValueChange={(value) => setEditFormData({ ...editFormData, projectId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project: any) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">
                Attachments <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>

              {editExistingAttachments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Current files</p>
                  {editExistingAttachments.map((att, index) => (
                    <div key={index} className="flex items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-900/50 dark:bg-blue-950/30">
                      <div className="flex min-w-0 items-center gap-2">
                        <Paperclip className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                        <span className="truncate text-sm">{att.split('/').pop()}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => setEditExistingAttachments(editExistingAttachments.filter((_, i) => i !== index))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/50 dark:hover:border-blue-500 dark:hover:bg-blue-950/20">
                <input
                  type="file"
                  id="editFileUpload"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xlsx,.xls,.txt,.csv"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setEditNewFiles([...editNewFiles, ...files]);
                    e.target.value = "";
                  }}
                  className="hidden"
                />
                <label htmlFor="editFileUpload" className="flex cursor-pointer flex-col items-center gap-1.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                    <Upload className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-medium">Click to upload new receipts</span>
                </label>
              </div>

              {editNewFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">New files to upload</p>
                  {editNewFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 dark:border-green-900/50 dark:bg-green-950/30">
                      <div className="flex min-w-0 items-center gap-2">
                        <Paperclip className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                        <span className="truncate text-sm">{file.name}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => setEditNewFiles(editNewFiles.filter((_, i) => i !== index))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending} className="w-full sm:w-auto">
                {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
