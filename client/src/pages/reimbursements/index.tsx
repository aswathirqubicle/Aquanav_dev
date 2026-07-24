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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
    originalExpenseDate: "",
    projectId: "",
  });
  const [editExistingAttachments, setEditExistingAttachments] = useState<string[]>([]);
  const [editNewFiles, setEditNewFiles] = useState<File[]>([]);

  const [formData, setFormData] = useState({
    amount: "",
    description: "",
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
      setFormData({ amount: "", description: "", originalExpenseDate: "", projectId: "", employeeId: "" });
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

  const getPayrollPeriod = (month: number | null, year: number | null) => {
    if (!month || !year) return "—";
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
                        <TableCell>{getPayrollPeriod(reimbursement.payrollMonth, reimbursement.payrollYear)}</TableCell>
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
        <DialogContent className="w-[95vw] max-w-lg sm:max-w-md md:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
              New Reimbursement Request
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            {canCreateForOthers && (
              <div className="space-y-2">
                <Label htmlFor="employee">Employee</Label>
                <Select
                  value={formData.employeeId}
                  onValueChange={(value) => setFormData({ ...formData, employeeId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Myself (leave empty for own request)" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee: any) => (
                      <SelectItem key={employee.id} value={employee.id.toString()}>
                        {employee.firstName} {employee.lastName} ({employee.employeeCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Leave empty to create for yourself, or select an employee
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (AED) *</Label>
              <Input
                id="amount"
                type="number"
                step="any"
                placeholder="Enter amount"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe the expense (e.g., Travel expenses for client meeting)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expenseDate">Original Expense Date *</Label>
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
            <div className="space-y-2">
              <Label className="text-sm">Attachments (Optional, max 5 files)</Label>
              <div className="border-2 border-dashed rounded-lg p-3 sm:p-4 text-center">
                <input
                  type="file"
                  id="fileUpload"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xlsx,.xls,.txt,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="fileUpload" className="cursor-pointer">
                  <div className="flex flex-col items-center gap-1 sm:gap-2">
                    <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
                    <span className="text-xs sm:text-sm text-muted-foreground">
                      Tap to upload receipts
                    </span>
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      PDF, Images, Word, Excel (max 25MB each)
                    </span>
                  </div>
                </label>
              </div>
              {selectedFiles.length > 0 && (
                <div className="space-y-1 sm:space-y-2 mt-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-muted/50 rounded px-2 sm:px-3 py-1.5 sm:py-2">
                      <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
                        <Paperclip className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs sm:text-sm truncate">{file.name}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0 hidden sm:inline">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 sm:h-8 sm:w-8 p-0"
                        onClick={() => removeFile(index)}
                      >
                        <X className="w-3 h-3 sm:w-4 sm:h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
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
        <DialogContent className="w-[95vw] max-w-lg sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
              Reimbursement Details
            </DialogTitle>
          </DialogHeader>
          {selectedReimbursement && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs sm:text-sm">Employee</Label>
                  <p className="font-medium text-sm sm:text-base">{selectedReimbursement.employeeName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs sm:text-sm">Created By</Label>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <p className="font-medium text-sm sm:text-base">{selectedReimbursement.userName}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs sm:text-sm">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedReimbursement.status)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs sm:text-sm">Amount</Label>
                  <p className="font-medium text-base sm:text-lg">AED {parseFloat(selectedReimbursement.amount).toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs sm:text-sm">Expense Date</Label>
                  <p className="font-medium text-sm sm:text-base">{formatDisplayDate(selectedReimbursement.originalExpenseDate)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs sm:text-sm">Submitted</Label>
                  <p className="font-medium text-sm sm:text-base">{new Date(selectedReimbursement.submissionTimestamp).toLocaleString()}</p>
                </div>
                {selectedReimbursement.payrollMonth && (
                  <div>
                    <Label className="text-muted-foreground text-xs sm:text-sm">Payroll Period</Label>
                    <p className="font-medium text-sm sm:text-base">{getPayrollPeriod(selectedReimbursement.payrollMonth, selectedReimbursement.payrollYear)}</p>
                  </div>
                )}
              </div>
              <div>
                <Label className="text-muted-foreground">Description</Label>
                <p className="mt-1">{selectedReimbursement.description}</p>
              </div>
              {selectedReimbursement.rejectionReason && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <Label className="text-red-600 dark:text-red-400">Rejection Reason</Label>
                  <p className="mt-1 text-red-700 dark:text-red-300">{selectedReimbursement.rejectionReason}</p>
                </div>
              )}
              {selectedReimbursement.approvedByName && (
                <div>
                  <Label className="text-muted-foreground">
                    {selectedReimbursement.status === "approved" ? "Approved By" : "Processed By"}
                  </Label>
                  <p className="font-medium">{selectedReimbursement.approvedByName}</p>
                </div>
              )}
              {selectedReimbursement.projectName && (
                <div>
                  <Label className="text-muted-foreground">Project</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <FolderOpen className="w-4 h-4 text-blue-600" />
                    <span className="font-medium">{selectedReimbursement.projectName}</span>
                  </div>
                </div>
              )}
              {selectedReimbursement.attachments && selectedReimbursement.attachments.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Attachments</Label>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedReimbursement.attachments.map((attachment: string, index: number) => (
                      <li
                        key={index}
                        className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow transition-shadow"
                      >
                        <div className="flex items-center gap-2 overflow-hidden mr-2">
                          <Download className="h-4 w-4 flex-shrink-0 text-blue-600" />
                          <span
                            className="text-sm truncate font-medium text-slate-700 dark:text-slate-300"
                            title={attachment.split('/').pop()}
                          >
                            {attachment.split('/').pop()}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                          <a
                            href={`/${attachment}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Download
                          </a>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedReimbursement.status === "pending" && (
                selectedReimbursement.userId === user?.id || isAdmin
              ) && (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => openEditDialog(selectedReimbursement)}
                    className="w-full sm:w-auto"
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </div>
              )}

              {selectedReimbursement.status === "pending" && canApprove && (
                isAdmin || (isFinance && selectedReimbursement.userRole !== "finance")
              ) && (
                <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsRejectDialogOpen(true);
                    }}
                    className="text-red-600 w-full sm:w-auto"
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
                </DialogFooter>
              )}

              {selectedReimbursement.status === "pending" && isFinance && selectedReimbursement.userRole === "finance" && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-yellow-700 dark:text-yellow-300 text-sm">
                  Finance users cannot approve reimbursements created by finance users. An Admin must approve this request.
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
        <DialogContent className="w-[95vw] max-w-lg sm:max-w-md md:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Pencil className="w-4 h-4 sm:w-5 sm:h-5" />
              Edit Reimbursement Request
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-3 sm:space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editAmount">Amount (AED) *</Label>
              <Input
                id="editAmount"
                type="number"
                step="any"
                placeholder="Enter amount"
                value={editFormData.amount}
                onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editDescription">Description *</Label>
              <Textarea
                id="editDescription"
                placeholder="Describe the expense"
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editExpenseDate">Original Expense Date *</Label>
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

            <div className="space-y-2">
              <Label className="text-sm">Attachments (Optional)</Label>

              {/* Existing Attachments */}
              {editExistingAttachments.length > 0 && (
                <div className="space-y-2 mb-3">
                  <p className="text-xs font-medium text-muted-foreground">Current files:</p>
                  {editExistingAttachments.map((att, index) => (
                    <div key={index} className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 rounded px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span className="text-sm truncate">{att.split('/').pop()}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-600"
                        onClick={() => setEditExistingAttachments(editExistingAttachments.filter((_, i) => i !== index))}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload New Files */}
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
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
                <label htmlFor="editFileUpload" className="cursor-pointer">
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Click to upload new receipts
                    </span>
                  </div>
                </label>
              </div>

              {editNewFiles.length > 0 && (
                <div className="space-y-2 mt-2">
                  <p className="text-xs font-medium text-muted-foreground">New files to upload:</p>
                  {editNewFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 rounded px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="text-sm truncate">{file.name}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setEditNewFiles(editNewFiles.filter((_, i) => i !== index))}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
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
