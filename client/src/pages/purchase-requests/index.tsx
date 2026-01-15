
import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Plus,
  ShoppingCart,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  Search,
  Filter,
  Eye,
  User,
  Calendar,
  Package,
  FileText
} from "lucide-react";

interface PurchaseRequest {
  id: number;
  requestNumber: string;
  requestedBy: number;
  requestedByName: string;
  status: "pending" | "approved" | "rejected";
  urgency: "low" | "normal" | "high" | "urgent";
  reason?: string;
  requestDate: string;
  approvedBy?: number;
  approvedByName?: string;
  approvalDate?: string;
  items?: PurchaseRequestItem[];
}

interface PurchaseRequestItem {
  id: number;
  requestId: number;
  itemType: "product" | "service";
  inventoryItemId?: number;
  inventoryItemName?: string;
  inventoryItemUnit?: string;
  description?: string;
  quantity: number;
  unitPrice?: string;
  notes?: string;
}

export default function PurchaseRequestsIndex() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewingRequest, setViewingRequest] = useState<PurchaseRequest | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");

  const [formData, setFormData] = useState({
    urgency: "normal",
    reason: "",
  });

  const [requestItems, setRequestItems] = useState<{
    itemType: "product" | "service";
    inventoryItemId?: string;
    description?: string;
    quantity: string;
    unitPrice?: string;
    notes: string;
  }[]>([]);

  const [newItem, setNewItem] = useState({
    itemType: "product" as "product" | "service",
    inventoryItemId: "",
    description: "",
    quantity: "1",
    unitPrice: "",
    notes: "",
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, setLocation]);

  const { data: requests, isLoading } = useQuery<PurchaseRequest[]>({
    queryKey: ["/api/purchase-requests"],
    enabled: isAuthenticated,
  });

  const { data: inventoryResponse } = useQuery<{ data: any[] }>({
    queryKey: ["/api/inventory"],
    enabled: isAuthenticated,
  });

  const inventoryItems = inventoryResponse?.data || [];

  const createRequestMutation = useMutation({
    mutationFn: async (data: any) => {
      const items = requestItems.map(item => ({
        itemType: item.itemType,
        inventoryItemId: item.inventoryItemId ? parseInt(item.inventoryItemId) : null,
        description: item.description || null,
        quantity: parseInt(item.quantity),
        unitPrice: item.unitPrice || null,
        notes: item.notes,
      }));

      const requestData = {
        urgency: formData.urgency,
        reason: formData.reason,
        items,
      };

      const response = await apiRequest("/api/purchase-requests", { method: "POST", body: requestData });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create purchase request");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({
        title: "Request Created",
        description: "Purchase request has been submitted successfully.",
      });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create purchase request",
        variant: "destructive",
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/purchase-requests/${id}/approve`, { method: "PUT" });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to approve request");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({
        title: "Request Approved",
        description: "Purchase request has been approved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve request",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/purchase-requests/${id}/reject`, { method: "PUT" });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to reject request");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({
        title: "Request Rejected",
        description: "Purchase request has been rejected.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject request",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      urgency: "normal",
      reason: "",
    });
    setRequestItems([]);
    setNewItem({
      itemType: "product",
      inventoryItemId: "",
      description: "",
      quantity: "1",
      unitPrice: "",
      notes: "",
    });
  };

  const addItem = () => {
    // Validate based on item type
    if (newItem.itemType === "product") {
      if (!newItem.inventoryItemId || !newItem.quantity) {
        toast({
          title: "Error",
          description: "Please select an item and enter quantity",
          variant: "destructive",
        });
        return;
      }

      if (requestItems.some(item => item.itemType === "product" && item.inventoryItemId === newItem.inventoryItemId)) {
        toast({
          title: "Error",
          description: "This item is already in the request",
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

      const unitPrice = parseFloat(newItem.unitPrice);
      if (unitPrice <= 0) {
        toast({
          title: "Error",
          description: "Unit price must be greater than 0",
          variant: "destructive",
        });
        return;
      }
    }

    const quantity = parseInt(newItem.quantity);
    if (quantity <= 0) {
      toast({
        title: "Error",
        description: "Quantity must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    setRequestItems(prev => [...prev, { ...newItem }]);
    setNewItem({
      itemType: "product",
      inventoryItemId: "",
      description: "",
      quantity: "1",
      unitPrice: "",
      notes: "",
    });
  };

  const removeItem = (index: number) => {
    setRequestItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.urgency) {
      toast({
        title: "Error",
        description: "Please select urgency level",
        variant: "destructive",
      });
      return;
    }

    if (requestItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item",
        variant: "destructive",
      });
      return;
    }

    createRequestMutation.mutate(formData);
  };

  const viewRequest = (request: PurchaseRequest) => {
    setViewingRequest(request);
    setIsViewDialogOpen(true);
  };

  const getItemName = (itemId: string) => {
    const item = inventoryItems?.find(item => item.id === parseInt(itemId));
    return item ? item.name : "Unknown Item";
  };

  const getItemUnit = (itemId: string) => {
    const item = inventoryItems?.find(item => item.id === parseInt(itemId));
    return item ? item.unit : "";
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "urgent":
        return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />Urgent</Badge>;
      case "high":
        return <Badge variant="secondary" className="gap-1 bg-orange-100 text-orange-800"><AlertTriangle className="w-3 h-3" />High</Badge>;
      case "normal":
        return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" />Normal</Badge>;
      case "low":
        return <Badge variant="secondary" className="gap-1 bg-gray-100 text-gray-600"><Clock className="w-3 h-3" />Low</Badge>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge variant="default" className="gap-1 bg-green-100 text-green-800"><CheckCircle className="w-3 h-3" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Rejected</Badge>;
      case "pending":
        return <Badge variant="secondary" className="gap-1 bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3" />Pending</Badge>;
      default:
        return null;
    }
  };

  const canApprove = user?.role === "admin";// || user?.role === "finance";

  // Filter requests based on search and filters
  const filteredRequests = requests?.filter(request => {
    const matchesSearch = !searchQuery ||
      request.requestNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.requestedByName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.reason?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || request.status === statusFilter;
    const matchesUrgency = urgencyFilter === "all" || request.urgency === urgencyFilter;

    return matchesSearch && matchesStatus && matchesUrgency;
  }) || [];

  const applyFilters = () => {
    // Filters are applied automatically through filteredRequests
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setUrgencyFilter("all");
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-4 lg:flex-row lg:justify-between lg:items-center lg:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Purchase Requests</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage and track purchase requests across your organization
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <div className="relative flex-1 sm:flex-none sm:w-64 lg:w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search requests..."
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
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Urgency</Label>
                  <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Urgencies</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  {/* <Button onClick={applyFilters} className="flex-1">Apply</Button> */}
                  <Button onClick={clearFilters} variant="outline" className="flex-1">Clear</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            New Request
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <ShoppingCart className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Total Requests
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {requests?.length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Pending Approval
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {requests?.filter(r => r.status === "pending").length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Approved
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {requests?.filter(r => r.status === "approved").length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Urgent Priority
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {requests?.filter(r => r.urgency === "urgent" || r.urgency === "high").length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Request List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Purchase Requests
            <Badge variant="secondary" className="ml-auto">
              {filteredRequests.length} requests
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Loading requests...
              </div>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-16">
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                  <ShoppingCart className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-3">
                  {searchQuery || statusFilter !== "all" || urgencyFilter !== "all"
                    ? "No matching requests found"
                    : "No purchase requests yet"
                  }
                </h3>
                <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
                  {searchQuery || statusFilter !== "all" || urgencyFilter !== "all"
                    ? "We couldn't find any purchase requests that match your current filters. Try adjusting your search criteria or clearing filters to see more results."
                    : "Purchase requests help you manage procurement efficiently. Create your first request to get started with tracking items your organization needs."
                  }
                </p>
                {(!searchQuery && statusFilter === "all" && urgencyFilter === "all") && (
                  <Button onClick={() => setIsDialogOpen(true)} className="gap-2" size="lg">
                    <Plus className="w-5 h-5" />
                    Create First Request
                  </Button>
                )}
                {(searchQuery || statusFilter !== "all" || urgencyFilter !== "all") && (
                  <Button
                    onClick={clearFilters}
                    variant="outline"
                    className="gap-2"
                    size="lg"
                  >
                    Clear All Filters
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request #</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Urgency</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((request) => (
                      <TableRow key={request.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          #{request.requestNumber}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            {request.requestedByName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            {new Date(request.requestDate).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(request.status)}
                        </TableCell>
                        <TableCell>
                          {getUrgencyBadge(request.urgency)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-muted-foreground" />
                            {request.items?.length || 0} items
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={() => viewRequest(request)} className="gap-1">
                              <Eye className="w-4 h-4" />
                              View
                            </Button>
                            {request.status === "pending" && canApprove && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => rejectMutation.mutate(request.id)}
                                  disabled={rejectMutation.isPending}
                                  className="gap-1 text-red-600 hover:text-red-700"
                                >
                                  <XCircle className="w-4 h-4" />
                                  Reject
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => approveMutation.mutate(request.id)}
                                  disabled={approveMutation.isPending}
                                  className="gap-1"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Approve
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {filteredRequests.map((request) => (
                  <Card key={request.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="space-y-4">
                        <div className="flex flex-col space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-lg">#{request.requestNumber}</h3>
                            <div className="flex gap-2">
                              {getStatusBadge(request.status)}
                              {getUrgencyBadge(request.urgency)}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3 text-sm">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <span className="truncate">{request.requestedByName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <span>{new Date(request.requestDate).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <span>{request.items?.length || 0} items</span>
                            </div>
                            {request.reason && (
                              <div className="flex items-start gap-2">
                                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                                <span className="text-muted-foreground text-xs line-clamp-2">{request.reason}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 pt-2 border-t">
                          <Button variant="outline" size="sm" onClick={() => viewRequest(request)} className="gap-2 w-full">
                            <Eye className="w-4 h-4" />
                            View Details
                          </Button>
                          {request.status === "pending" && canApprove && (
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => rejectMutation.mutate(request.id)}
                                disabled={rejectMutation.isPending}
                                className="gap-1 text-red-600 hover:text-red-700 flex-1"
                              >
                                <XCircle className="w-4 h-4" />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => approveMutation.mutate(request.id)}
                                disabled={approveMutation.isPending}
                                className="gap-1 flex-1"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Approve
                              </Button>
                            </div>
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

      {/* Create Request Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-3xl lg:max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0 border-b pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-semibold">Create Purchase Request</DialogTitle>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Submit a new purchase request for approval</p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <Label htmlFor="urgency" className="text-sm font-medium">Urgency Level *</Label>
                  <Select
                    value={formData.urgency}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, urgency: value }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select urgency level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="reason" className="text-sm font-medium">Reason for Request</Label>
                  <Textarea
                    id="reason"
                    value={formData.reason}
                    onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="Enter reason for the request"
                    className="mt-1 min-h-[60px] sm:min-h-[80px]"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-semibold">Request Items *</Label>
                </div>

                {/* Add Item Form */}
                <Card className="p-3 sm:p-4 bg-muted/30">
                  <div className="space-y-4">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">Item Type *</Label>
                        <Select
                          value={newItem.itemType}
                          onValueChange={(value: "product" | "service") => setNewItem(prev => ({ 
                            ...prev, 
                            itemType: value,
                            inventoryItemId: "",
                            description: "",
                            unitPrice: ""
                          }))}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="product">Product (from Inventory)</SelectItem>
                            <SelectItem value="service">Service (Custom)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {newItem.itemType === "product" ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div>
                            <Label className="text-sm font-medium">Item *</Label>
                            <Select
                              value={newItem.inventoryItemId}
                              onValueChange={(value) => setNewItem(prev => ({ ...prev, inventoryItemId: value }))}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select item" />
                              </SelectTrigger>
                              <SelectContent>
                                {inventoryItems?.map((invItem) => (
                                  <SelectItem key={invItem.id} value={invItem.id.toString()}>
                                    {invItem.name} ({invItem.unit})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Quantity *</Label>
                            <Input
                              type="number"
                              min="1"
                              value={newItem.quantity}
                              onChange={(e) => setNewItem(prev => ({ ...prev, quantity: e.target.value }))}
                              placeholder="0"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Notes</Label>
                            <Input
                              value={newItem.notes}
                              onChange={(e) => setNewItem(prev => ({ ...prev, notes: e.target.value }))}
                              placeholder="Optional notes"
                              className="mt-1"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="sm:col-span-2">
                            <Label className="text-sm font-medium">Service Description *</Label>
                            <Textarea
                              value={newItem.description}
                              onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                              placeholder="Enter service description"
                              className="mt-1 min-h-[60px]"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Quantity *</Label>
                            <Input
                              type="number"
                              min="1"
                              value={newItem.quantity}
                              onChange={(e) => setNewItem(prev => ({ ...prev, quantity: e.target.value }))}
                              placeholder="0"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Est. Unit Price (AED) *</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={newItem.unitPrice}
                              onChange={(e) => setNewItem(prev => ({ ...prev, unitPrice: e.target.value }))}
                              placeholder="0.00"
                              className="mt-1"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <Label className="text-sm font-medium">Notes</Label>
                            <Input
                              value={newItem.notes}
                              onChange={(e) => setNewItem(prev => ({ ...prev, notes: e.target.value }))}
                              placeholder="Optional notes"
                              className="mt-1"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      onClick={addItem}
                      className="w-full sm:w-auto gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Add Item
                    </Button>
                  </div>
                </Card>

                {requestItems.length === 0 ? (
                  <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">No items added yet</p>
                    <p className="text-sm text-gray-400">Use the form above to add items to your request</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Est. Price</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead className="w-16"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {requestItems.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Badge variant={item.itemType === "product" ? "default" : "secondary"}>
                                {item.itemType === "product" ? "Product" : "Service"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {item.itemType === "product" 
                                ? item.inventoryItemId ? getItemName(item.inventoryItemId) : "-"
                                : item.description || "-"
                              }
                            </TableCell>
                            <TableCell>
                              {item.quantity}
                              {item.itemType === "product" && item.inventoryItemId && ` ${getItemUnit(item.inventoryItemId)}`}
                            </TableCell>
                            <TableCell>
                              {item.unitPrice ? `AED ${parseFloat(item.unitPrice).toFixed(2)}` : "-"}
                            </TableCell>
                            <TableCell>
                              {item.notes || "-"}
                            </TableCell>
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
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createRequestMutation.isPending} className="gap-2">
                  {createRequestMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" />
                      Create Request
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Request Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
              Purchase Request #{viewingRequest?.requestNumber}
            </DialogTitle>
          </DialogHeader>
          {viewingRequest && (
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                    <div className="mt-1">
                      {getStatusBadge(viewingRequest.status)}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Urgency</Label>
                    <div className="mt-1">
                      {getUrgencyBadge(viewingRequest.urgency)}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Requested By</Label>
                    <p className="mt-1">{viewingRequest.requestedByName}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Request Date</Label>
                    <p className="mt-1">{new Date(viewingRequest.requestDate).toLocaleDateString()}</p>
                  </div>
                  {viewingRequest.approvedByName && (
                    <>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">
                          {viewingRequest.status === "approved" ? "Approved By" : "Rejected By"}
                        </Label>
                        <p className="mt-1">{viewingRequest.approvedByName}</p>
                      </div>
                      {viewingRequest.approvalDate && (
                        <div>
                          <Label className="text-sm font-medium text-muted-foreground">
                            {viewingRequest.status === "approved" ? "Approval Date" : "Rejection Date"}
                          </Label>
                          <p className="mt-1">{new Date(viewingRequest.approvalDate).toLocaleDateString()}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {viewingRequest.reason && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Reason</Label>
                  <p className="mt-1 p-3 bg-muted rounded-md">{viewingRequest.reason}</p>
                </div>
              )}

              <div>
                <Label className="text-sm font-medium text-muted-foreground">Requested Items</Label>
                <div className="mt-2 border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Est. Price</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingRequest.items?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Badge variant={item.itemType === "product" ? "default" : "secondary"}>
                              {item.itemType === "product" ? "Product" : "Service"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {item.itemType === "product" 
                              ? item.inventoryItemName || "-"
                              : item.description || "-"
                            }
                          </TableCell>
                          <TableCell>
                            {item.quantity}
                            {item.itemType === "product" && item.inventoryItemUnit && ` ${item.inventoryItemUnit}`}
                          </TableCell>
                          <TableCell>
                            {item.unitPrice ? `AED ${parseFloat(item.unitPrice).toFixed(2)}` : "-"}
                          </TableCell>
                          <TableCell>{item.notes || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {viewingRequest.status === "pending" && canApprove && (
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      rejectMutation.mutate(viewingRequest.id);
                      setIsViewDialogOpen(false);
                    }}
                    disabled={rejectMutation.isPending}
                    className="gap-2 text-red-600 hover:text-red-700"
                  >
                    <XCircle className="w-4 h-4" />
                    {rejectMutation.isPending ? "Rejecting..." : "Reject"}
                  </Button>
                  <Button
                    onClick={() => {
                      approveMutation.mutate(viewingRequest.id);
                      setIsViewDialogOpen(false);
                    }}
                    disabled={approveMutation.isPending}
                    className="gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {approveMutation.isPending ? "Approving..." : "Approve"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
