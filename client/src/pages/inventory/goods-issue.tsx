import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Package,
  Calendar,
  ArrowUpRight,
  Trash2,
  AlertTriangle,
  Filter,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { z } from "zod";

const goodsIssueSchema = z.object({
  reference: z.string().min(1, "Reference is required"),
  projectId: z.number().optional(),
  items: z.array(z.object({
    inventoryItemId: z.number(),
    quantity: z.number().min(1, "Quantity must be at least 1"),
  })).min(1, "At least one item is required"),
});

type GoodsIssueData = z.infer<typeof goodsIssueSchema>;

type InventoryItem = {
  id: number;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStockLevel: number;
  avgCost?: string;
};

type Project = {
  id: number;
  title: string;
  status: string;
};

type GoodsIssueItem = {
  inventoryItemId: number;
  itemName: string;
  quantity: string;
  unit: string;
  availableStock: number;
};

type GoodsIssueRecord = {
  id: number;
  reference: string;
  timestamp: string;
  projectTitle?: string;
  items: {
    inventoryItemName: string;
    quantity: number;
    unit: string;
  }[];
  createdByName?: string;
};

export default function GoodsIssue() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterItem, setFilterItem] = useState("all");
  const [filterProject, setFilterProject] = useState("all");

  const [formData, setFormData] = useState({
    reference: "",
    projectId: "",
  });

  const [issueItems, setIssueItems] = useState<GoodsIssueItem[]>([]);
  const [newItem, setNewItem] = useState<GoodsIssueItem>({
    inventoryItemId: 0,
    itemName: "",
    quantity: "1",
    unit: "",
    availableStock: 0,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    } else if (
      user?.role !== "admin" &&
      user?.role !== "project_manager" &&
      user?.role !== "finance"
    ) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user, setLocation]);

  const { data: inventoryResponse } = useQuery<{
    data: InventoryItem[];
  }>({
    queryKey: ["/api/inventory"],
    enabled: isAuthenticated,
  });

  const inventoryItems = inventoryResponse?.data;

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: isAuthenticated,
  });

  const { data: issuesData } = useQuery<GoodsIssueRecord[]>({
    queryKey: ["/api/goods-issue"],
    enabled: isAuthenticated,
  });

  const createIssueMutation = useMutation({
    mutationFn: async (data: GoodsIssueData) => {
      const response = await apiRequest("POST", "/api/goods-issue", data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goods-issue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({
        title: "Goods Issue Created",
        description: "Inventory has been updated successfully.",
      });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create goods issue",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({ reference: "", projectId: "" });
    setIssueItems([]);
    setNewItem({
      inventoryItemId: 0,
      itemName: "",
      quantity: "1",
      unit: "",
      availableStock: 0,
    });
  };

  const addItem = () => {
    if (!newItem.inventoryItemId) {
      toast({
        title: "Error",
        description: "Please select an item",
        variant: "destructive",
      });
      return;
    }

    const requestedQuantity = parseInt(newItem.quantity);
    if (isNaN(requestedQuantity) || requestedQuantity <= 0) {
      toast({
        title: "Error",
        description: "Quantity must be a valid number greater than 0",
        variant: "destructive",
      });
      return;
    }

    if (requestedQuantity > newItem.availableStock) {
      toast({
        title: "Error",
        description: `Insufficient stock. Available: ${newItem.availableStock} ${newItem.unit}`,
        variant: "destructive",
      });
      return;
    }

    // Check if item is already added
    if (issueItems.some(item => item.inventoryItemId === newItem.inventoryItemId)) {
      toast({
        title: "Error",
        description: "This item is already in the issue",
        variant: "destructive",
      });
      return;
    }

    setIssueItems(prev => [...prev, { ...newItem }]);
    setNewItem({
      inventoryItemId: 0,
      itemName: "",
      quantity: "1",
      unit: "",
      availableStock: 0,
    });
  };

  const removeItem = (index: number) => {
    setIssueItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.reference.trim()) {
      toast({
        title: "Error",
        description: "Reference is required",
        variant: "destructive",
      });
      return;
    }

    if (issueItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item",
        variant: "destructive",
      });
      return;
    }

    const issueData = {
      reference: formData.reference.trim(),
      projectId: formData.projectId ? parseInt(formData.projectId) : undefined,
      items: issueItems.map(item => ({
        inventoryItemId: item.inventoryItemId,
        quantity: parseInt(item.quantity),
      })),
    };

    createIssueMutation.mutate(issueData);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString();
  };

  const uniqueProjects = Array.from(
    new Map(
      (issuesData || [])
        .filter((i) => i.projectTitle)
        .map((i) => [i.projectTitle, i.projectTitle])
    ).values()
  ).sort();

  const filteredIssues = (issuesData || []).filter((issue) => {
    if (filterDateFrom) {
      const txDate = new Date(issue.timestamp);
      txDate.setHours(0, 0, 0, 0);
      const from = new Date(filterDateFrom);
      if (txDate < from) return false;
    }
    if (filterDateTo) {
      const txDate = new Date(issue.timestamp);
      txDate.setHours(23, 59, 59, 999);
      const to = new Date(filterDateTo);
      to.setHours(23, 59, 59, 999);
      if (txDate > to) return false;
    }
    if (filterItem && filterItem !== "all") {
      const hasItem = issue.items.some((i) =>
        i.inventoryItemName.toLowerCase().includes(filterItem.toLowerCase())
      );
      if (!hasItem) return false;
    }
    if (filterProject && filterProject !== "all") {
      if (issue.projectTitle !== filterProject) return false;
    }
    return true;
  });

  const hasActiveFilters = filterDateFrom || filterDateTo || (filterItem && filterItem !== "all") || (filterProject && filterProject !== "all");

  const clearFilters = () => {
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterItem("all");
    setFilterProject("all");
    setCurrentPage(1);
  };

  if (
    !isAuthenticated ||
    (user?.role !== "admin" &&
      user?.role !== "project_manager" &&
      user?.role !== "finance")
  ) {
    return null;
  }

  const paginatedData = filteredIssues.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredIssues.length / itemsPerPage);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Goods Issue
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Issue inventory items to projects or general use
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Issue
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Goods Issue</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reference">Reference *</Label>
                  <Input
                    id="reference"
                    value={formData.reference}
                    onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
                    placeholder="e.g., GI-2024-001, Issue-001"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="projectId">Project (Optional)</Label>
                  <Select
                    value={formData.projectId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, projectId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects?.filter(p => p.status === "in_progress" && p.id).map((project) => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          {project.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Add Items Section */}
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <Label className="text-base font-medium">Issue Items</Label>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-sm">Item</Label>
                    <Select
                      value={newItem.inventoryItemId?.toString() || ""}
                      onValueChange={(value) => {
                        const itemId = parseInt(value);
                        const item = inventoryItems?.find(item => item.id === itemId);
                        setNewItem(prev => ({ 
                          ...prev, 
                          inventoryItemId: itemId,
                          itemName: item?.name || "",
                          unit: item?.unit || "",
                          availableStock: item?.currentStock || 0
                        }));
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                      <SelectContent>
                        {inventoryItems?.map((item) => (
                          <SelectItem key={item.id} value={item.id.toString()}>
                            {item.name} ({item.currentStock} {item.unit} available)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm">Available Stock</Label>
                    <Input
                      className="h-9"
                      value={`${newItem.availableStock} ${newItem.unit}`}
                      readOnly
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Quantity to Issue</Label>
                    <Input
                      className="h-9"
                      type="number"
                      min="1"
                      max={newItem.availableStock}
                      value={newItem.quantity}
                      onChange={(e) => setNewItem(prev => ({ ...prev, quantity: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" onClick={addItem} size="sm" className="h-9">
                      Add Item
                    </Button>
                  </div>
                </div>

                {/* Issue Items List */}
                {issueItems.length > 0 && (
                  <div className="space-y-3">
                    <Label className="text-sm text-slate-600 dark:text-slate-400">
                      Items to Issue
                    </Label>
                    {issueItems.map((item, index) => (
                      <div
                        key={index}
                        className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 grid grid-cols-3 gap-3">
                            <div>
                              <span className="font-medium text-sm">{item.itemName}</span>
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              Qty: {item.quantity} {item.unit}
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              Available: {item.availableStock} {item.unit}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createIssueMutation.isPending}
                >
                  {createIssueMutation.isPending
                    ? "Creating..."
                    : "Create Issue"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter Bar */}
      <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 shrink-0">
            <Filter className="h-4 w-4" />
            Filters
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 dark:text-slate-400">From Date</label>
            <Input
              type="date"
              value={filterDateFrom}
              onChange={(e) => { setFilterDateFrom(e.target.value); setCurrentPage(1); }}
              className="h-9 w-40 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 dark:text-slate-400">To Date</label>
            <Input
              type="date"
              value={filterDateTo}
              onChange={(e) => { setFilterDateTo(e.target.value); setCurrentPage(1); }}
              className="h-9 w-40 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1 min-w-[180px]">
            <label className="text-xs text-slate-500 dark:text-slate-400">Item</label>
            <Select value={filterItem} onValueChange={(v) => { setFilterItem(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="All items" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All items</SelectItem>
                {inventoryItems?.map((item) => (
                  <SelectItem key={item.id} value={item.name}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1 min-w-[180px]">
            <label className="text-xs text-slate-500 dark:text-slate-400">Project</label>
            <Select value={filterProject} onValueChange={(v) => { setFilterProject(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {uniqueProjects.map((name) => (
                  <SelectItem key={name as string} value={name as string}>
                    {name as string}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
          {hasActiveFilters && (
            <span className="text-xs text-slate-500 dark:text-slate-400 self-end pb-2">
              {filteredIssues.length} of {issuesData?.length || 0} records
            </span>
          )}
        </div>
      </div>

      {/* Issues List */}
      {paginatedData && paginatedData.length > 0 ? (
        <div className="space-y-6">
          {/* Desktop Table View */}
          <Card className="hidden md:block">
            <CardHeader>
              <CardTitle className="flex items-center">
                <ArrowUpRight className="h-5 w-5 mr-2 text-red-600 dark:text-red-400" />
                Goods Issue Records
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Reference
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Project
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Items
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Created By
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
                    {paginatedData.map((issue) => (
                      <tr key={issue.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {issue.reference}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            {formatDate(issue.timestamp)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            {issue.projectTitle || "-"}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            {issue.items.map((item, index) => (
                              <div key={index} className="text-sm">
                                <span className="font-medium text-slate-900 dark:text-slate-100">
                                  {item.inventoryItemName}
                                </span>
                                <span className="text-slate-600 dark:text-slate-400 ml-2">
                                  ({item.quantity} {item.unit})
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            {issue.createdByName || "-"}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            <div className="flex items-center mb-4">
              <ArrowUpRight className="h-5 w-5 mr-2 text-red-600 dark:text-red-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Goods Issue Records
              </h2>
            </div>
            {paginatedData.map((issue) => (
              <Card key={issue.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-slate-900 dark:text-slate-100">
                          {issue.reference}
                        </h3>
                        <div className="text-sm text-slate-600 dark:text-slate-400 flex items-center mt-1">
                          <Calendar className="h-3 w-3 mr-1" />
                          {formatDate(issue.timestamp)}
                        </div>
                      </div>
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                        Issue
                      </Badge>
                    </div>

                    {issue.projectTitle && (
                      <div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Project:</span>
                        <div className="text-sm text-slate-900 dark:text-slate-100">
                          {issue.projectTitle}
                        </div>
                      </div>
                    )}

                    <div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">Items Issued:</span>
                      <div className="space-y-1 mt-1">
                        {issue.items.map((item, index) => (
                          <div key={index} className="text-sm bg-slate-50 dark:bg-slate-800 p-2 rounded">
                            <span className="font-medium text-slate-900 dark:text-slate-100">
                              {item.inventoryItemName}
                            </span>
                            <span className="text-slate-600 dark:text-slate-400 ml-2">
                              ({item.quantity} {item.unit})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {issue.createdByName && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Created by: {issue.createdByName}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="w-8"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Package className="h-16 w-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            {hasActiveFilters ? (
              <>
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                  No issues match your filters
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mb-6">
                  Try adjusting the date range or item selection
                </p>
                <Button variant="outline" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                  No goods issues found
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mb-6">
                  Start by creating your first goods issue
                </p>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Issue
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}