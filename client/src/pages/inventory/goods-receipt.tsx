
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
  DollarSign,
  ArrowDownLeft,
  Trash2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { z } from "zod";

const goodsReceiptSchema = z.object({
  reference: z.string().min(1, "Reference is required"),
  items: z.array(z.object({
    inventoryItemId: z.number(),
    quantity: z.number().min(1, "Quantity must be at least 1"),
    unitCost: z.number().min(0, "Unit cost must be positive"),
  })).min(1, "At least one item is required"),
});

type GoodsReceiptData = z.infer<typeof goodsReceiptSchema>;

type InventoryItem = {
  id: number;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStockLevel: number;
  avgCost?: string;
};

type GoodsReceiptItem = {
  inventoryItemId: number;
  itemName: string;
  quantity: string;
  unitCost: string;
  unit: string;
};

type GoodsReceiptRecord = {
  id: number;
  reference: string;
  timestamp: string;
  createdByName?: string;
  items: {
    inventoryItemName: string;
    quantity: number;
    unitCost: string;
    unit: string;
  }[];
};

export default function GoodsReceipt() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    reference: "",
  });

  const [receiptItems, setReceiptItems] = useState<GoodsReceiptItem[]>([]);
  const [newItem, setNewItem] = useState<GoodsReceiptItem>({
    inventoryItemId: 0,
    itemName: "",
    quantity: "1",
    unitCost: "0",
    unit: "",
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

  const { data: receiptsData } = useQuery<GoodsReceiptRecord[]>({
    queryKey: ["/api/goods-receipt"],
    enabled: isAuthenticated,
  });

  const createReceiptMutation = useMutation({
    mutationFn: async (data: GoodsReceiptData) => {
      const response = await apiRequest("POST", "/api/goods-receipt", data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goods-receipt"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({
        title: "Goods Receipt Created",
        description: "Inventory has been updated successfully.",
      });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create goods receipt",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({ reference: "" });
    setReceiptItems([]);
    setNewItem({
      inventoryItemId: 0,
      itemName: "",
      quantity: "1",
      unitCost: "0",
      unit: "",
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

    if (parseInt(newItem.quantity) <= 0) {
      toast({
        title: "Error",
        description: "Quantity must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    if (parseFloat(newItem.unitCost) < 0) {
      toast({
        title: "Error",
        description: "Unit cost must be positive",
        variant: "destructive",
      });
      return;
    }

    // Check if item is already added
    if (receiptItems.some(item => item.inventoryItemId === newItem.inventoryItemId)) {
      toast({
        title: "Error",
        description: "This item is already in the receipt",
        variant: "destructive",
      });
      return;
    }

    setReceiptItems(prev => [...prev, { ...newItem }]);
    setNewItem({
      inventoryItemId: 0,
      itemName: "",
      quantity: "1",
      unitCost: "0",
      unit: "",
    });
  };

  const removeItem = (index: number) => {
    setReceiptItems(prev => prev.filter((_, i) => i !== index));
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

    if (receiptItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item",
        variant: "destructive",
      });
      return;
    }

    const receiptData = {
      reference: formData.reference.trim(),
      items: receiptItems.map(item => ({
        inventoryItemId: item.inventoryItemId,
        quantity: parseInt(item.quantity),
        unitCost: parseFloat(item.unitCost),
      })),
    };

    createReceiptMutation.mutate(receiptData);
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(parseFloat(amount));
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString();
  };

  if (
    !isAuthenticated ||
    (user?.role !== "admin" &&
      user?.role !== "project_manager" &&
      user?.role !== "finance")
  ) {
    return null;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Goods Receipt
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Record incoming inventory items
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Receipt
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Goods Receipt</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="reference">Reference *</Label>
                <Input
                  id="reference"
                  value={formData.reference}
                  onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
                  placeholder="e.g., PO-2024-001, GRN-001"
                  required
                />
              </div>

              {/* Add Items Section */}
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <Label className="text-base font-medium">Receipt Items</Label>
                
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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
                          unitCost: item?.avgCost || "0"
                        }));
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                      <SelectContent>
                        {inventoryItems?.map((item) => (
                          <SelectItem key={item.id} value={item.id.toString()}>
                            {item.name} ({item.unit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm">Quantity</Label>
                    <Input
                      className="h-9"
                      type="number"
                      min="1"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem(prev => ({ ...prev, quantity: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Unit Cost</Label>
                    <Input
                      className="h-9"
                      type="number"
                      step="0.01"
                      min="0"
                      value={newItem.unitCost}
                      onChange={(e) => setNewItem(prev => ({ ...prev, unitCost: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" onClick={addItem} size="sm" className="h-9">
                      Add Item
                    </Button>
                  </div>
                </div>

                {/* Receipt Items List */}
                {receiptItems.length > 0 && (
                  <div className="space-y-3">
                    <Label className="text-sm text-slate-600 dark:text-slate-400">
                      Items to Receive
                    </Label>
                    {receiptItems.map((item, index) => (
                      <div
                        key={index}
                        className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 grid grid-cols-4 gap-3">
                            <div>
                              <span className="font-medium text-sm">{item.itemName}</span>
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              Qty: {item.quantity} {item.unit}
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              Cost: {formatCurrency(item.unitCost)}
                            </div>
                            <div className="text-sm font-medium">
                              Total: {formatCurrency((parseInt(item.quantity) * parseFloat(item.unitCost)).toString())}
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
                    <div className="text-right">
                      <span className="font-semibold">
                        Grand Total: {formatCurrency(
                          receiptItems.reduce((sum, item) => 
                            sum + (parseInt(item.quantity) * parseFloat(item.unitCost)), 0
                          ).toString()
                        )}
                      </span>
                    </div>
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
                  disabled={createReceiptMutation.isPending}
                >
                  {createReceiptMutation.isPending
                    ? "Creating..."
                    : "Create Receipt"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Receipts List */}
      {receiptsData && receiptsData.length > 0 ? (
        <div className="space-y-6">
          {/* Desktop Table View */}
          <Card className="hidden md:block">
            <CardHeader>
              <CardTitle className="flex items-center">
                <ArrowDownLeft className="h-5 w-5 mr-2 text-green-600 dark:text-green-400" />
                Goods Receipt Records
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
                        Items
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Total Value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Created By
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
                    {receiptsData.map((receipt) => (
                      <tr key={receipt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {receipt.reference}
                          </div>
                          <div className="text-xs text-green-600 dark:text-green-400">
                            Receipt
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            {formatDate(receipt.timestamp)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            {receipt.items.map((item, index) => (
                              <div key={index} className="text-sm">
                                <span className="font-medium text-slate-900 dark:text-slate-100">
                                  {item.inventoryItemName}
                                </span>
                                <span className="text-slate-600 dark:text-slate-400 ml-2">
                                  ({item.quantity} {item.unit} @ {formatCurrency(item.unitCost)})
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {formatCurrency(
                              receipt.items.reduce((sum, item) => 
                                sum + (item.quantity * parseFloat(item.unitCost)), 0
                              ).toString()
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            {receipt.createdByName || "-"}
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
              <ArrowDownLeft className="h-5 w-5 mr-2 text-green-600 dark:text-green-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Goods Receipt Records
              </h2>
            </div>
            {receiptsData.map((receipt) => (
              <Card key={receipt.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-slate-900 dark:text-slate-100">
                          {receipt.reference}
                        </h3>
                        <div className="text-sm text-slate-600 dark:text-slate-400 flex items-center mt-1">
                          <Calendar className="h-3 w-3 mr-1" />
                          {formatDate(receipt.timestamp)}
                        </div>
                      </div>
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                        Receipt
                      </Badge>
                    </div>

                    <div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">Items Received:</span>
                      <div className="space-y-1 mt-1">
                        {receipt.items.map((item, index) => (
                          <div key={index} className="text-sm bg-slate-50 dark:bg-slate-800 p-2 rounded">
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {item.inventoryItemName}
                            </div>
                            <div className="text-slate-600 dark:text-slate-400 text-xs">
                              {item.quantity} {item.unit} @ {formatCurrency(item.unitCost)} = {formatCurrency((item.quantity * parseFloat(item.unitCost)).toString())}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                      <div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Total Value:</span>
                        <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {formatCurrency(
                            receipt.items.reduce((sum, item) => 
                              sum + (item.quantity * parseFloat(item.unitCost)), 0
                            ).toString()
                          )}
                        </div>
                      </div>
                      {receipt.createdByName && (
                        <div className="text-right">
                          <span className="text-xs text-slate-500 dark:text-slate-400">Created by:</span>
                          <div className="text-sm text-slate-900 dark:text-slate-100">
                            {receipt.createdByName}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Package className="h-16 w-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              No goods receipts found
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              Start by creating your first goods receipt
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Receipt
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
