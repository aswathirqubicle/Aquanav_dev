import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Package, Plus, AlertTriangle, BarChart3 } from "lucide-react";
import {
  InventoryItem,
  insertInventoryItemSchema,
  Supplier,
  InsertSupplierInventoryItem,
} from "@shared/schema";
import { z } from "zod";
import { CustomPagination } from "@/components/ui/pagination";

const createInventoryItemSchema = insertInventoryItemSchema.extend({
  minStockLevel: z.string().transform((val) => parseInt(val)),
  initialQuantity: z.string().transform((val) => parseInt(val)),
});

type CreateInventoryItemData = z.infer<typeof createInventoryItemSchema>;

export default function InventoryIndex() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<InventoryItem | null>(null);
  const [viewingSupplierMappings, setViewingSupplierMappings] = useState<any[]>(
    [],
  );

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    description: "",
    category: "consumables",
    unit: "",
    minStockLevel: "0",
    initialQuantity: "0",
    unitPrice: "0",
  });

  const [supplierMappings, setSupplierMappings] = useState<
    {
      supplierId: string;
      supplierPartNumber: string;
      unitCost: string;
      minimumOrderQuantity: string;
      leadTimeDays: string;
      isPreferred: boolean;
    }[]
  >([]);

  const [newSupplierMapping, setNewSupplierMapping] = useState({
    supplierId: "",
    supplierPartNumber: "",
    unitCost: "0",
    minimumOrderQuantity: "1",
    leadTimeDays: "0",
    isPreferred: false,
  });

  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

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

  const { data: inventoryResponse, isLoading } = useQuery<{
    data: InventoryItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    },
    lowStockTotal: number,
    totalInventoryValue: number
  }>({
    queryKey: ["/api/inventory", currentPage],
    queryFn: async () => {
      try {
        const response = await apiRequest(
          `/api/inventory?page=${currentPage}&limit=10`,
          {
            method: "GET",
          }
        );

        const result = await response.json();
        console.log("Inventory API response:", result);
        return result;
      } catch (error) {
        console.error("Error fetching inventory:", error);
        throw error;
      }
    },
    enabled: isAuthenticated,
  });


  const items = inventoryResponse?.data || [];


  useEffect(() => {
    if (inventoryResponse?.pagination) {
      setPagination(inventoryResponse.pagination);
    }
  }, [inventoryResponse]);


  const { data: suppliersResponse } = useQuery<{
    data: Supplier[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: ["/api/suppliers"],
    enabled: isAuthenticated,
  });

  const suppliers = suppliersResponse?.data;

  const createItemMutation = useMutation({
    mutationFn: async (data: any) => {
      const { supplierMappings, ...itemData } = data;

      // Create the inventory item first
      const response = await apiRequest("/api/inventory", {
        method: "POST",
        body: JSON.stringify(itemData),
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create inventory item");
      }
      const newItem = await response.json();

      // Then create supplier mappings
      if (supplierMappings && supplierMappings.length > 0) {
        for (const mapping of supplierMappings) {
          if (mapping.supplierId) {
            try {
              const mappingResponse = await apiRequest(`/api/inventory/${newItem.id}/suppliers`, {
                method: "POST",
                body: JSON.stringify({
                  supplierId: parseInt(mapping.supplierId),
                  supplierPartNumber: mapping.supplierPartNumber || "",
                  unitCost: parseFloat(mapping.unitCost) || 0,
                  minimumOrderQuantity:
                    parseInt(mapping.minimumOrderQuantity) || 1,
                  leadTimeDays: parseInt(mapping.leadTimeDays) || 0,
                  isPreferred: mapping.isPreferred || false,
                }),
                headers: {
                  "Content-Type": "application/json",
                },
              });

              if (!mappingResponse.ok) {
                console.warn(
                  "Failed to create supplier mapping:",
                  await mappingResponse.text(),
                );
              }
            } catch (mappingError) {
              console.warn("Error creating supplier mapping:", mappingError);
            }
          }
        }
      }

      return newItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({
        title: "Item Created",
        description: "The inventory item has been added successfully.",
      });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      console.error("Create item error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create inventory item",
        variant: "destructive",
      });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async (data: {
      id: number;
      updateData: Partial<InventoryItem>;
    }) => {
      const response = await apiRequest(`/api/inventory/${data.id}`, {
        method: "PUT",
        body: JSON.stringify(data.updateData),
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update inventory item");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      console.error("Update item error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update inventory item",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      sku: "",
      description: "",
      category: "consumables",
      unit: "",
      minStockLevel: "0",
      initialQuantity: "0",
      unitPrice: "0",
    });
    setSupplierMappings([]);
    setNewSupplierMapping({
      supplierId: "",
      supplierPartNumber: "",
      unitCost: "0",
      minimumOrderQuantity: "1",
      leadTimeDays: "0",
      isPreferred: false,
    });
    setEditingItem(null);
  };

  const openDetailsDialog = async (item: InventoryItem) => {
    setViewingItem(item);

    // Load supplier mappings for viewing
    try {
      const response = await apiRequest(`/api/inventory/${item.id}/suppliers`, {
        method: "GET"
      });
      if (response.ok) {
        const mappings = await response.json();
        setViewingSupplierMappings(mappings);
      } else {
        setViewingSupplierMappings([]);
      }
    } catch (error) {
      console.error("Failed to load supplier mappings:", error);
      setViewingSupplierMappings([]);
    }

    setIsDetailsDialogOpen(true);
  };

  const openEditDialog = async (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      sku: item.sku,
      description: item.description || "",
      category: item.category,
      unit: item.unit,
      minStockLevel: item.minStockLevel.toString(),
      initialQuantity: item.currentStock.toString(),
      unitPrice: item.avgCost || "0",
    });

    // Load existing supplier mappings
    try {
      const response = await apiRequest(`/api/inventory/${item.id}/suppliers`, {
        method: "GET"
      });
      if (response.ok) {
        const mappings = await response.json();
        setSupplierMappings(
          mappings.map((m: any) => ({
            supplierId: m.supplierId.toString(),
            supplierPartNumber: m.supplierPartNumber || "",
            unitCost: m.unitCost?.toString() || "0",
            minimumOrderQuantity: m.minimumOrderQuantity?.toString() || "1",
            leadTimeDays: m.leadTimeDays?.toString() || "0",
            isPreferred: m.isPreferred || false,
          })),
        );
      } else {
        console.warn("Failed to load supplier mappings, response not ok");
        setSupplierMappings([]);
      }
    } catch (error) {
      console.error("Failed to load supplier mappings:", error);
      setSupplierMappings([]);
    }

    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingItem) {
        // Update existing item
        const updateData = {
          name: formData.name.trim(),
          sku: formData.sku.trim(),
          description: formData.description.trim(),
          category: formData.category,
          unit: formData.unit,
          minStockLevel: parseInt(formData.minStockLevel) || 0,
          currentStock: parseInt(formData.initialQuantity) || 0,
          avgCost: formData.unitPrice,
        };

        // Validate required fields
        if (!updateData.name || !updateData.unit) {
          toast({
            title: "Error",
            description: "Name and unit are required fields",
            variant: "destructive",
          });
          return;
        }

        // Update item
        await updateItemMutation.mutateAsync({
          id: editingItem.id,
          updateData,
        });

        // Update supplier mappings
        // First, delete existing mappings
        try {
          await apiRequest(`/api/inventory/${editingItem.id}/suppliers`, {
            method: "DELETE"
          });
        } catch (error) {
          console.log("No existing supplier mappings to delete");
        }

        // Then create new mappings
        for (const mapping of supplierMappings) {
          if (mapping.supplierId) {
            try {
              const mappingResponse = await apiRequest(`/api/inventory/${editingItem.id}/suppliers`, {
                method: "POST",
                body: JSON.stringify({
                  supplierId: parseInt(mapping.supplierId),
                  supplierPartNumber: mapping.supplierPartNumber || "",
                  unitCost: parseFloat(mapping.unitCost) || 0,
                  minimumOrderQuantity:
                    parseInt(mapping.minimumOrderQuantity) || 1,
                  leadTimeDays: parseInt(mapping.leadTimeDays) || 0,
                  isPreferred: mapping.isPreferred || false,
                }),
                headers: {
                  "Content-Type": "application/json",
                },
              });

              if (!mappingResponse.ok) {
                const errorText = await mappingResponse.text();
                console.warn("Failed to create supplier mapping:", errorText);
                toast({
                  title: "Warning",
                  description: `Failed to save supplier mapping for ${getSupplierName(mapping.supplierId)}`,
                  variant: "destructive",
                });
              }
            } catch (mappingError) {
              console.warn("Error creating supplier mapping:", mappingError);
              toast({
                title: "Warning",
                description: `Error saving supplier mapping for ${getSupplierName(mapping.supplierId)}`,
                variant: "destructive",
              });
            }
          }
        }

        toast({
          title: "Success",
          description: "Inventory item updated successfully",
        });
      } else {
        // Create new item
        const processedData = {
          name: formData.name.trim(),
          sku: formData.sku.trim(),
          description: formData.description.trim(),
          category: formData.category,
          unit: formData.unit,
          minStockLevel: parseInt(formData.minStockLevel) || 0,
          initialQuantity: parseInt(formData.initialQuantity) || 0,
          unitPrice: parseFloat(formData.unitPrice) || 0,
          supplierMappings: supplierMappings.filter((m) => m.supplierId),
        };

        // Validate required fields
        if (!processedData.name || !processedData.unit) {
          toast({
            title: "Error",
            description: "Name and unit are required fields",
            variant: "destructive",
          });
          return;
        }

        createItemMutation.mutate(processedData);
      }
    } catch (error) {
      console.error("Error saving item:", error);
      toast({
        title: "Error",
        description: "Failed to save inventory item. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleChange = (field: keyof CreateInventoryItemData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addSupplierMapping = () => {
    if (!newSupplierMapping.supplierId) {
      toast({
        title: "Error",
        description: "Please select a supplier",
        variant: "destructive",
      });
      return;
    }

    // Check if supplier is already mapped
    if (
      supplierMappings.some(
        (m) => m.supplierId === newSupplierMapping.supplierId,
      )
    ) {
      toast({
        title: "Error",
        description: "This supplier is already mapped to this item",
        variant: "destructive",
      });
      return;
    }

    // Validate numeric fields
    const unitCost = parseFloat(newSupplierMapping.unitCost) || 0;
    const minimumOrderQuantity =
      parseInt(newSupplierMapping.minimumOrderQuantity) || 1;
    const leadTimeDays = parseInt(newSupplierMapping.leadTimeDays) || 0;

    if (unitCost < 0 || minimumOrderQuantity < 1 || leadTimeDays < 0) {
      toast({
        title: "Error",
        description:
          "Please enter valid values for cost, quantity, and lead time",
        variant: "destructive",
      });
      return;
    }

    setSupplierMappings((prev) => [
      ...prev,
      {
        ...newSupplierMapping,
        unitCost: unitCost.toString(),
        minimumOrderQuantity: minimumOrderQuantity.toString(),
        leadTimeDays: leadTimeDays.toString(),
      },
    ]);
    setNewSupplierMapping({
      supplierId: "",
      supplierPartNumber: "",
      unitCost: "0",
      minimumOrderQuantity: "1",
      leadTimeDays: "0",
      isPreferred: false,
    });
  };

  const removeSupplierMapping = (index: number) => {
    setSupplierMappings((prev) => prev.filter((_, i) => i !== index));
  };

  const getSupplierName = (supplierId: string) => {
    return (
      suppliers?.find((s) => s.id.toString() === supplierId)?.name ||
      "Unknown Supplier"
    );
  };

  if (
    !isAuthenticated ||
    (user?.role !== "admin" &&
      user?.role !== "project_manager" &&
      user?.role !== "finance")
  ) {
    return null;
  }

  const getCategoryBadge = (category: string) => {
    const categoryClasses = {
      consumables:
        "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
      tools:
        "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
      equipment:
        "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400",
    };

    return (
      <Badge
        className={
          categoryClasses[category as keyof typeof categoryClasses] ||
          "bg-gray-100 text-gray-800"
        }
      >
        {category.charAt(0).toUpperCase() + category.slice(1)}
      </Badge>
    );
  };

  const getStockStatus = (item: InventoryItem) => {
    if (item.currentStock <= item.minStockLevel) {
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
          Low Stock
        </Badge>
      );
    } else if (item.currentStock <= item.minStockLevel * 1.5) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
          Low Stock Warning
        </Badge>
      );
    }
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
        In Stock
      </Badge>
    );
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(parseFloat(amount));
  };

  const lowStockItems = inventoryResponse?.lowStockTotal ?? 0;
  const totalValue = inventoryResponse?.totalInventoryValue ?? 0;

  // const lowStockItems =
  //   items?.filter((item) => item.currentStock <= item.minStockLevel) || [];
  // const totalValue =
  //   items?.reduce(
  //     (sum, item) => sum + item.currentStock * parseFloat(item.avgCost || "0"),
  //     0,
  //   ) || 0;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
            Inventory Management
          </h1>
          <p className="text-sm md:text-base text-slate-600 dark:text-slate-400">
            Track stock levels and manage inventory items
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                resetForm();
                setIsDialogOpen(true);
              }}
              className="w-full md:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg md:text-xl">
                {editingItem ? "Edit Inventory Item" : "Add New Inventory Item"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">Item Nameee *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    placeholder="e.g., Marine Grade Paint"
                    required
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">SKU *</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => handleChange("sku", e.target.value)}
                    placeholder="e.g., Marine Grade Paint"
                    required
                    className="w-full"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  placeholder="Item description..."
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-sm font-medium">Category *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => handleChange("category", value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consumables">Consumables</SelectItem>
                      <SelectItem value="tools">Tools</SelectItem>
                      <SelectItem value="equipment">Equipment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit" className="text-sm font-medium">Unit *</Label>
                  <Select
                    value={formData.unit}
                    onValueChange={(value) => handleChange("unit", value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pieces">Pieces</SelectItem>
                      <SelectItem value="liters">Liters</SelectItem>
                      <SelectItem value="gallons">Gallons</SelectItem>
                      <SelectItem value="kilograms">Kilograms</SelectItem>
                      <SelectItem value="pounds">Pounds</SelectItem>
                      <SelectItem value="meters">Meters</SelectItem>
                      <SelectItem value="feet">Feet</SelectItem>
                      <SelectItem value="square_meters">
                        Square Meters
                      </SelectItem>
                      <SelectItem value="square_feet">Square Feet</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="sets">Sets</SelectItem>
                      <SelectItem value="boxes">Boxes</SelectItem>
                      <SelectItem value="rolls">Rolls</SelectItem>
                      <SelectItem value="tubes">Tubes</SelectItem>
                      <SelectItem value="bottles">Bottles</SelectItem>
                      <SelectItem value="cans">Cans</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="initialQuantity" className="text-sm font-medium">
                    {editingItem ? "Current Stock *" : "Initial Quantity *"}
                  </Label>
                  <Input
                    id="initialQuantity"
                    type="number"
                    value={formData.initialQuantity}
                    onChange={(e) =>
                      handleChange("initialQuantity", e.target.value)
                    }
                    required
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minStockLevel" className="text-sm font-medium">Minimum Stock Level *</Label>
                  <Input
                    id="minStockLevel"
                    type="number"
                    value={formData.minStockLevel}
                    onChange={(e) =>
                      handleChange("minStockLevel", e.target.value)
                    }
                    required
                    className="w-full"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitPrice" className="text-sm font-medium">Unit Price</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  step="0.01"
                  value={formData.unitPrice}
                  onChange={(e) => handleChange("unitPrice", e.target.value)}
                  placeholder="0.00"
                  readOnly={!!editingItem}
                  className={`w-full ${editingItem
                    ? "bg-gray-50 dark:bg-gray-800 cursor-not-allowed"
                    : ""
                    }`}
                />
              </div>

              {/* Supplier Mappings Section */}
              {/*<div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <Label className="text-base font-medium">
                  Supplier Mappings
                </Label>*/}

              {/* Add Supplier Mapping Form - Mobile Responsive */}
              {/* <div className="space-y-4">
                  <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 md:gap-3">
                    <div className="xl:col-span-2">
                      <Label className="text-sm font-medium">Supplier</Label>
                      <Select
                        value={newSupplierMapping.supplierId}
                        onValueChange={(value) =>
                          setNewSupplierMapping((prev) => ({
                            ...prev,
                            supplierId: value,
                          }))
                        }
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers?.map((supplier) => (
                            <SelectItem
                              key={supplier.id}
                              value={supplier.id.toString()}
                            >
                              {supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Part #</Label>
                      <Input
                        className="h-9 w-full"
                        placeholder="Part number"
                        value={newSupplierMapping.supplierPartNumber}
                        onChange={(e) =>
                          setNewSupplierMapping((prev) => ({
                            ...prev,
                            supplierPartNumber: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Unit Cost</Label>
                      <Input
                        className="h-9 w-full"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={newSupplierMapping.unitCost}
                        onChange={(e) =>
                          setNewSupplierMapping((prev) => ({
                            ...prev,
                            unitCost: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Min Qty</Label>
                      <Input
                        className="h-9 w-full"
                        type="number"
                        min="1"
                        placeholder="1"
                        value={newSupplierMapping.minimumOrderQuantity}
                        onChange={(e) =>
                          setNewSupplierMapping((prev) => ({
                            ...prev,
                            minimumOrderQuantity: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Lead Days</Label>
                      <Input
                        className="h-9 w-full"
                        type="number"
                        min="0"
                        placeholder="0"
                        value={newSupplierMapping.leadTimeDays}
                        onChange={(e) =>
                          setNewSupplierMapping((prev) => ({
                            ...prev,
                            leadTimeDays: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={addSupplierMapping}
                    size="sm"
                    className="w-full md:w-auto"
                  >
                    Add Supplier Mapping
                  </Button>
                </div>*/}

              {/* Supplier Mappings List - Mobile Responsive */}
              {/*{supplierMappings.length > 0 && (
                  <div className="space-y-3">
                    <Label className="text-sm text-slate-600 dark:text-slate-400">
                      Mapped Suppliers
                    </Label>
                    {supplierMappings.map((mapping, index) => (
                      <div
                        key={index}
                        className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-2 lg:space-y-0">
                          <div className="flex-1 space-y-1 lg:space-y-0 lg:grid lg:grid-cols-5 lg:gap-3">
                            <div className="flex items-center">
                              <span className="font-medium text-sm">
                                {getSupplierName(mapping.supplierId)}
                              </span>
                              {mapping.isPreferred && (
                                <span className="ml-1 text-xs text-green-600">
                                  ★ Preferred
                                </span>
                              )}
                            </div>
                            <div className="text-xs lg:text-sm text-slate-600 dark:text-slate-400">
                              Part: {mapping.supplierPartNumber || "N/A"}
                            </div>
                            <div className="text-xs lg:text-sm text-slate-600 dark:text-slate-400">
                              Cost: ${mapping.unitCost}
                            </div>
                            <div className="text-xs lg:text-sm text-slate-600 dark:text-slate-400">
                              Min Order: {mapping.minimumOrderQuantity}
                            </div>
                            <div className="text-xs lg:text-sm text-slate-600 dark:text-slate-400">
                              Lead Time: {mapping.leadTimeDays} days
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeSupplierMapping(index)}
                            className="w-full lg:w-auto"
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>*/}

              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createItemMutation.isPending || updateItemMutation.isPending
                  }
                  className="w-full sm:w-auto"
                >
                  {editingItem
                    ? updateItemMutation.isPending
                      ? "Updating..."
                      : "Update Item"
                    : createItemMutation.isPending
                      ? "Creating..."
                      : "Create Item"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Item Details Dialog */}
        <Dialog
          open={isDetailsDialogOpen}
          onOpenChange={setIsDetailsDialogOpen}
        >
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Inventory Item Details</DialogTitle>
            </DialogHeader>

            {viewingItem && (
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Basic Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        Item Name
                      </Label>
                      <p className="text-slate-900 dark:text-slate-100 font-medium">
                        {viewingItem.name}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        SKU
                      </Label>
                      <p className="text-slate-900 dark:text-slate-100 font-medium">
                        {viewingItem.sku}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        Category
                      </Label>
                      <div className="mt-1">
                        {getCategoryBadge(viewingItem.category)}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        Average Cost
                      </Label>
                      <p className="text-slate-900 dark:text-slate-100">
                        {viewingItem.avgCost
                          ? formatCurrency(viewingItem.avgCost)
                          : "N/A"}
                      </p>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        Unit
                      </Label>
                      <p className="text-slate-900 dark:text-slate-100">
                        {viewingItem.unit}
                      </p>
                    </div>
                    {viewingItem.description && (
                      <div className="md:col-span-2">
                        <Label className="text-sm font-medium text-slate-500 dark:text-slate-400">
                          Description
                        </Label>
                        <p className="text-slate-900 dark:text-slate-100">
                          {viewingItem.description}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stock Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Stock Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        Current Stock
                      </Label>
                      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {viewingItem.currentStock} {viewingItem.unit}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        Minimum Stock Level
                      </Label>
                      <p className="text-xl text-slate-900 dark:text-slate-100">
                        {viewingItem.minStockLevel} {viewingItem.unit}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        Stock Status
                      </Label>
                      <div className="mt-1">{getStockStatus(viewingItem)}</div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      Total Stock Value
                    </Label>
                    <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(
                        (
                          viewingItem.currentStock *
                          parseFloat(viewingItem.avgCost || "0")
                        ).toString(),
                      )}
                    </p>
                  </div>
                </div>

                {/* Supplier Information */}
                {/*<div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Supplier Information
                  </h3>
                  {viewingSupplierMappings.length > 0 ? (
                    <div className="space-y-3">
                      {viewingSupplierMappings.map((mapping, index) => (
                        <div
                          key={index}
                          className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                              <Label className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                Supplier
                              </Label>
                              <div className="flex items-center space-x-2">
                                <p className="text-slate-900 dark:text-slate-100 font-medium">
                                  {getSupplierName(
                                    mapping.supplierId.toString(),
                                  )}
                                </p>
                                {mapping.isPreferred && (
                                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                                    ★ Preferred
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                Part Number
                              </Label>
                              <p className="text-slate-900 dark:text-slate-100">
                                {mapping.supplierPartNumber || "N/A"}
                              </p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                Unit Cost
                              </Label>
                              <p className="text-slate-900 dark:text-slate-100 font-medium">
                                {formatCurrency(
                                  mapping.unitCost?.toString() || "0",
                                )}
                              </p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                Minimum Order Quantity
                              </Label>
                              <p className="text-slate-900 dark:text-slate-100">
                                {mapping.minimumOrderQuantity}{" "}
                                {viewingItem.unit}
                              </p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                Lead Time
                              </Label>
                              <p className="text-slate-900 dark:text-slate-100">
                                {mapping.leadTimeDays} days
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Package className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-500 dark:text-slate-400">
                        No suppliers mapped to this item
                      </p>
                    </div>
                  )}
                </div>*/}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <Button
                    variant="outline"
                    onClick={() => setIsDetailsDialogOpen(false)}
                    className="w-full sm:w-auto"
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      setIsDetailsDialogOpen(false);
                      openEditDialog(viewingItem);
                    }}
                    className="w-full sm:w-auto"
                  >
                    Edit Item
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Package className="h-5 w-5 md:h-6 md:w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-3 md:ml-4">
                <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400">
                  Total Items
                </p>
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
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <AlertTriangle className="h-5 w-5 md:h-6 md:w-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="ml-3 md:ml-4">
                <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400">
                  Low Stock Alerts
                </p>
                <p className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {lowStockItems}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <BarChart3 className="h-5 w-5 md:h-6 md:w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-3 md:ml-4">
                <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400">
                  Total Value
                </p>
                <p className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency(totalValue.toString())}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-400">
            Loading inventory...
          </p>
        </div>
      ) : !items || items.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Package className="h-16 w-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              No inventory items found
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              Start tracking your inventory by adding items
            </p>
            <Button
              onClick={() => {
                resetForm();
                setIsDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add First Item
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 md:space-y-6">
          {items.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 md:p-6">
                <div className="flex flex-col space-y-4">
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-3 sm:space-y-0">
                    <div
                      className="flex items-start space-x-3 cursor-pointer flex-1"
                      onClick={() => openDetailsDialog(item)}
                    >
                      <div className="h-10 w-10 md:h-12 md:w-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Package className="h-5 w-5 md:h-6 md:w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 text-sm md:text-base">
                          {item.name}
                        </h3>
                        {item.description && (
                          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                            {item.description}
                          </p>
                        )}
                        <div className="flex items-center space-x-2 mt-2">
                          {getCategoryBadge(item.category)}
                          {getStockStatus(item)}
                        </div>
                      </div>
                    </div>

                    {/* Actions - Mobile/Desktop */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:space-x-2 sm:gap-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetailsDialog(item);
                        }}
                      >
                        View Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditDialog(item);
                        }}
                      >
                        Edit Item
                      </Button>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div
                    className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 pt-3 border-t border-slate-200 dark:border-slate-700 cursor-pointer"
                    onClick={() => openDetailsDialog(item)}
                  >
                    <div className="text-center sm:text-left">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Current Stock</p>
                      <p className="text-sm md:text-base font-semibold text-slate-900 dark:text-slate-100">
                        {item.currentStock} {item.unit}
                      </p>
                    </div>
                    <div className="text-center sm:text-left">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Min Level</p>
                      <p className="text-sm md:text-base text-slate-900 dark:text-slate-100">
                        {item.minStockLevel} {item.unit}
                      </p>
                    </div>
                    <div className="text-center sm:text-left">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Avg Cost</p>
                      <p className="text-sm md:text-base font-medium text-slate-900 dark:text-slate-100">
                        {item.avgCost ? formatCurrency(item.avgCost) : "N/A"}
                      </p>
                    </div>
                    <div className="text-center sm:text-left">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Value</p>
                      <p className="text-sm md:text-base font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(
                          (item.currentStock * parseFloat(item.avgCost || "0")).toString()
                        )}
                      </p>
                    </div>
                  </div>
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
