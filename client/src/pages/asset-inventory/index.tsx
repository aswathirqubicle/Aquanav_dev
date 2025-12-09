import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MaintenanceRecorder } from "@/components/maintenance-recorder";
import { MaintenanceManagement } from "@/components/maintenance-management";
import { CurrencySelector } from "@/components/currency/CurrencySelector";
import { CurrencyDisplay } from "@/components/currency/CurrencyDisplay";
import { 
  Plus, 
  Search, 
  Package, 
  Wrench, 
  MapPin, 
  Calendar,
  DollarSign,
  Activity,
  Eye,
  Edit,
  QrCode,
  FileText
} from "lucide-react";

// Asset data structures separated from inventory module
const assetCategories = [
  { value: "equipment", label: "Heavy Equipment" },
  { value: "tools", label: "Tools & Machinery" },
  { value: "vehicles", label: "Vehicles & Transport" },
  { value: "electronics", label: "Electronics" },
  { value: "furniture", label: "Furniture & Fixtures" },
  { value: "safety", label: "Safety Equipment" },
];

const assetStatuses = [
  { value: "available", label: "Available", color: "bg-green-100 text-green-800" },
  { value: "in_use", label: "In Use", color: "bg-blue-100 text-blue-800" },
  { value: "maintenance", label: "Maintenance", color: "bg-yellow-100 text-yellow-800" },
  { value: "under_repair", label: "Under Repair", color: "bg-orange-100 text-orange-800" },
  { value: "retired", label: "Retired", color: "bg-gray-100 text-gray-800" },
  { value: "lost", label: "Lost", color: "bg-red-100 text-red-800" },
  { value: "stolen", label: "Stolen", color: "bg-red-100 text-red-800" },
];

const assetConditions = [
  { value: "excellent", label: "Excellent", color: "bg-green-100 text-green-800" },
  { value: "good", label: "Good", color: "bg-blue-100 text-blue-800" },
  { value: "fair", label: "Fair", color: "bg-yellow-100 text-yellow-800" },
  { value: "poor", label: "Poor", color: "bg-orange-100 text-orange-800" },
  { value: "damaged", label: "Damaged", color: "bg-red-100 text-red-800" },
];

export default function AssetInventoryIndex() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [isAddTypeDialogOpen, setIsAddTypeDialogOpen] = useState(false);
  const [isAddInstanceDialogOpen, setIsAddInstanceDialogOpen] = useState(false);
  const [selectedAssetType, setSelectedAssetType] = useState<any>(null);
  const [selectedInstance, setSelectedInstance] = useState<any>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isInstanceDetailOpen, setIsInstanceDetailOpen] = useState(false);
  const [selectedInstanceForDetail, setSelectedInstanceForDetail] = useState<any>(null);

  // Fetch asset types
  const { data: assetTypes = [], isLoading: isLoadingTypes } = useQuery({
    queryKey: ['asset-types'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/asset-types');
        if (!res.ok) {
          throw new Error('Failed to fetch asset types');
        }
        const data = await res.json();
        // Ensure we always return an array
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Error fetching asset types:', error);
        return [];
      }
    }
  });

  // Fetch asset instances
  const { data: assetInstances = [], isLoading: isLoadingInstances } = useQuery({
    queryKey: ['asset-instances'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/asset-inventory/instances');
        if (!res.ok) {
          throw new Error('Failed to fetch asset instances');
        }
        const data = await res.json();
        // Ensure we always return an array
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Error fetching asset instances:', error);
        return [];
      }
    }
  });

  // Fetch projects for assignment dropdown
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/projects');
        if (!res.ok) {
          throw new Error('Failed to fetch projects');
        }
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Error fetching projects:', error);
        return [];
      }
    }
  });

  // Fetch employees for assignment dropdown
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/employees');
        if (!res.ok) {
          throw new Error('Failed to fetch employees');
        }
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Error fetching employees:', error);
        return [];
      }
    }
  });

  // Create asset type mutation
  const createAssetTypeMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/asset-types', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-types'] });
      setIsAddTypeDialogOpen(false);
      setNewAssetType({
        name: "",
        category: "",
        manufacturer: "",
        model: "",
        description: "",
        defaultMonthlyRentalRate: "",
        currency: "AED",
        warrantyPeriodMonths: "12",
        maintenanceIntervalDays: "90",
      });
      toast({ title: "Asset type created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create asset type", variant: "destructive" });
    }
  });

  // Create asset instance mutation
  const createAssetInstanceMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/asset-inventory/instances', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-instances'] });
      queryClient.invalidateQueries({ queryKey: ['asset-types'] });
      setIsAddInstanceDialogOpen(false);
      setNewAssetInstance({
        assetTypeId: "",
        instanceNumber: "",
        assetTag: "",
        serialNumber: "",
        barcode: "",
        status: "available",
        condition: "excellent",
        location: "",
        assignedProjectId: "unassigned",
        assignedToId: "unassigned",
        acquisitionDate: "",
        acquisitionCost: "",
        acquisitionCurrency: "AED",
        currentValue: "",
        currentValueCurrency: "AED",
        monthlyRentalRate: "",
        rentalCurrency: "AED",
        warrantyExpiryDate: "",
        lastMaintenanceDate: "",
        nextMaintenanceDate: "",
        notes: "",
      });
      toast({ title: "Asset instance created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create asset instance", variant: "destructive" });
    }
  });

  // Update asset instance mutation
  const updateAssetInstanceMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/asset-inventory/instances/${selectedInstance?.id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-instances'] });
      queryClient.invalidateQueries({ queryKey: ['asset-types'] });
      setIsEditDialogOpen(false);
      setSelectedInstance(null);
      setNewAssetInstance({
        assetTypeId: "",
        instanceNumber: "",
        assetTag: "",
        serialNumber: "",
        barcode: "",
        status: "available",
        condition: "excellent",
        location: "",
        assignedProjectId: "unassigned",
        assignedToId: "unassigned",
        acquisitionDate: "",
        acquisitionCost: "",
        acquisitionCurrency: "AED",
        currentValue: "",
        currentValueCurrency: "AED",
        monthlyRentalRate: "",
        rentalCurrency: "AED",
        warrantyExpiryDate: "",
        lastMaintenanceDate: "",
        nextMaintenanceDate: "",
        notes: "",
      });
      toast({ title: "Asset instance updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update asset instance", variant: "destructive" });
    }
  });

  // Form states for asset type
  const [newAssetType, setNewAssetType] = useState({
    name: "",
    category: "",
    manufacturer: "",
    model: "",
    description: "",
    defaultMonthlyRentalRate: "",
    currency: "AED",
    warrantyPeriodMonths: "12",
    maintenanceIntervalDays: "90",
  });

  // Form states for asset instance
  const [newAssetInstance, setNewAssetInstance] = useState({
    assetTypeId: "",
    instanceNumber: "",
    assetTag: "",
    serialNumber: "",
    barcode: "",
    status: "available",
    condition: "excellent",
    location: "",
    assignedProjectId: "unassigned",
    assignedToId: "unassigned",
    acquisitionDate: "",
    acquisitionCost: "",
    acquisitionCurrency: "AED",
    currentValue: "",
    currentValueCurrency: "AED",
    monthlyRentalRate: "",
    rentalCurrency: "AED",
    warrantyExpiryDate: "",
    lastMaintenanceDate: "",
    nextMaintenanceDate: "",
    notes: "",
  });

  // Filter asset instances
  const filteredInstances = useMemo(() => {
    // Ensure both arrays exist and are arrays
    if (!Array.isArray(assetInstances) || !Array.isArray(assetTypes)) return [];
    
    return assetInstances.filter(instance => {
      const assetType = assetTypes.find(type => type.id === instance.assetTypeId);
      const matchesSearch = 
        (instance.assetTag || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (instance.serialNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (assetType?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = selectedCategory === "all" || assetType?.category === selectedCategory;
      const matchesStatus = selectedStatus === "all" || instance.status === selectedStatus;
      
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [assetInstances, assetTypes, searchTerm, selectedCategory, selectedStatus]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (!Array.isArray(assetInstances)) {
      return {
        totalAssets: 0,
        totalValue: 0,
        available: 0,
        inUse: 0,
        maintenance: 0,
        retired: 0,
      };
    }

    const totalAssets = assetInstances.length;
    const totalValue = assetInstances.reduce((sum, asset) => {
      const value = asset.currentValue || asset.acquisitionCost || 0;
      return sum + (typeof value === 'number' ? value : parseFloat(value) || 0);
    }, 0);
    
    const statusCounts = assetInstances.reduce((acc, asset) => {
      const status = asset.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalAssets,
      totalValue,
      available: statusCounts.available || 0,
      inUse: statusCounts.in_use || 0,
      maintenance: statusCounts.maintenance || 0,
      retired: statusCounts.retired || 0,
    };
  }, [assetInstances]);

  const handleAddAssetType = () => {
    toast({
      title: "Asset Type Added",
      description: `${newAssetType.name} has been added to the asset catalog.`,
    });
    setIsAddTypeDialogOpen(false);
    setNewAssetType({
      name: "",
      category: "",
      manufacturer: "",
      model: "",
      description: "",
      defaultMonthlyRentalRate: "",
      currency: "AED",
      warrantyPeriodMonths: "12",
      maintenanceIntervalDays: "90",
    });
  };

  const handleAddAssetInstance = () => {
    if (selectedInstance) {
      // Update existing instance
      const updateData = {
        ...newAssetInstance,
        assetTypeId: parseInt(newAssetInstance.assetTypeId),
        acquisitionCost: newAssetInstance.acquisitionCost ? parseFloat(newAssetInstance.acquisitionCost) : null,
      };
      updateAssetInstanceMutation.mutate(updateData);
    } else {
      // Create new instance
      const createData = {
        ...newAssetInstance,
        assetTypeId: parseInt(newAssetInstance.assetTypeId),
        acquisitionCost: newAssetInstance.acquisitionCost ? parseFloat(newAssetInstance.acquisitionCost) : null,
      };
      createAssetInstanceMutation.mutate(createData);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = assetStatuses.find(s => s.value === status);
    return (
      <Badge className={statusInfo?.color}>
        {statusInfo?.label || status}
      </Badge>
    );
  };

  const getConditionBadge = (condition: string) => {
    const conditionInfo = assetConditions.find(c => c.value === condition);
    return (
      <Badge variant="outline" className={conditionInfo?.color}>
        {conditionInfo?.label || condition}
      </Badge>
    );
  };

  const handleViewInstanceDetail = (instance: any) => {
    setSelectedInstanceForDetail(instance);
    setIsInstanceDetailOpen(true);
  };

  const handleEditInstance = (instance: any) => {
    setSelectedInstance(instance);
    // Pre-populate the form with instance data
    setNewAssetInstance({
      assetTypeId: instance.assetTypeId?.toString() || "",
      instanceNumber: instance.instanceNumber || "",
      assetTag: instance.assetTag || "",
      serialNumber: instance.serialNumber || "",
      barcode: instance.barcode || "",
      status: instance.status || "available",
      condition: instance.condition || "excellent",
      location: instance.location || "",
      assignedProjectId: instance.assignedProjectId?.toString() || "unassigned",
      assignedToId: instance.assignedToId?.toString() || "unassigned",
      acquisitionDate: instance.acquisitionDate ? new Date(instance.acquisitionDate).toISOString().split('T')[0] : "",
      acquisitionCost: instance.acquisitionCost?.toString() || "",
      acquisitionCurrency: "AED",
      currentValue: instance.currentValue?.toString() || "",
      currentValueCurrency: "AED",
      monthlyRentalRate: instance.monthlyRentalRate?.toString() || "",
      rentalCurrency: "AED",
      warrantyExpiryDate: instance.warrantyExpiryDate ? new Date(instance.warrantyExpiryDate).toISOString().split('T')[0] : "",
      lastMaintenanceDate: instance.lastMaintenanceDate ? new Date(instance.lastMaintenanceDate).toISOString().split('T')[0] : "",
      nextMaintenanceDate: instance.nextMaintenanceDate ? new Date(instance.nextMaintenanceDate).toISOString().split('T')[0] : "",
      notes: instance.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Asset Inventory</h1>
          <p className="text-slate-600 dark:text-slate-400">Track individual asset instances separately from consumable inventory</p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={isAddTypeDialogOpen} onOpenChange={setIsAddTypeDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Package className="h-4 w-4 mr-2" />
                Add Asset Type
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Asset Type</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="typeName">Name *</Label>
                    <Input
                      id="typeName"
                      value={newAssetType.name}
                      onChange={(e) => setNewAssetType({ ...newAssetType, name: e.target.value })}
                      placeholder="e.g., Marine Excavator"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="typeCategory">Category *</Label>
                    <Select 
                      value={newAssetType.category} 
                      onValueChange={(value) => setNewAssetType({ ...newAssetType, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {assetCategories.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="typeManufacturer">Manufacturer</Label>
                    <Input
                      id="typeManufacturer"
                      value={newAssetType.manufacturer}
                      onChange={(e) => setNewAssetType({ ...newAssetType, manufacturer: e.target.value })}
                      placeholder="e.g., Caterpillar"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="typeModel">Model</Label>
                    <Input
                      id="typeModel"
                      value={newAssetType.model}
                      onChange={(e) => setNewAssetType({ ...newAssetType, model: e.target.value })}
                      placeholder="e.g., 320D"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="typeDescription">Description</Label>
                  <Textarea
                    id="typeDescription"
                    value={newAssetType.description}
                    onChange={(e) => setNewAssetType({ ...newAssetType, description: e.target.value })}
                    placeholder="Asset description and specifications"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button variant="outline" onClick={() => setIsAddTypeDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddAssetType}>
                    Add Asset Type
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddInstanceDialogOpen} onOpenChange={setIsAddInstanceDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Asset Instance
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Asset Instance</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="instanceType">Asset Type *</Label>
                  <Select 
                    value={newAssetInstance.assetTypeId} 
                    onValueChange={(value) => setNewAssetInstance({ ...newAssetInstance, assetTypeId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select asset type" />
                    </SelectTrigger>
                    <SelectContent>
                      {assetTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id.toString()}>
                          {type.name} - {type.manufacturer} {type.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="instanceNumber">Instance Number</Label>
                    <Input
                      id="instanceNumber"
                      value={newAssetInstance.instanceNumber}
                      onChange={(e) => setNewAssetInstance({ ...newAssetInstance, instanceNumber: e.target.value })}
                      placeholder="e.g., Instance 1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="instanceTag">Asset Tag *</Label>
                    <Input
                      id="instanceTag"
                      value={newAssetInstance.assetTag}
                      onChange={(e) => setNewAssetInstance({ ...newAssetInstance, assetTag: e.target.value })}
                      placeholder="e.g., EQP-003"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="instanceSerial">Serial Number *</Label>
                    <Input
                      id="instanceSerial"
                      value={newAssetInstance.serialNumber}
                      onChange={(e) => setNewAssetInstance({ ...newAssetInstance, serialNumber: e.target.value })}
                      placeholder="Manufacturer serial"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="instanceBarcode">Barcode *</Label>
                    <Input
                      id="instanceBarcode"
                      value={newAssetInstance.barcode}
                      onChange={(e) => setNewAssetInstance({ ...newAssetInstance, barcode: e.target.value })}
                      placeholder="Unique barcode"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="instanceStatus">Status</Label>
                    <Select 
                      value={newAssetInstance.status} 
                      onValueChange={(value) => setNewAssetInstance({ ...newAssetInstance, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {assetStatuses.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="instanceCondition">Condition</Label>
                    <Select 
                      value={newAssetInstance.condition} 
                      onValueChange={(value) => setNewAssetInstance({ ...newAssetInstance, condition: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {assetConditions.map((condition) => (
                          <SelectItem key={condition.value} value={condition.value}>
                            {condition.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="instanceLocation">Location</Label>
                    <Input
                      id="instanceLocation"
                      value={newAssetInstance.location}
                      onChange={(e) => setNewAssetInstance({ ...newAssetInstance, location: e.target.value })}
                      placeholder="Current location"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assignedProject">Assigned Project</Label>
                    <Select 
                      value={newAssetInstance.assignedProjectId} 
                      onValueChange={(value) => setNewAssetInstance({ ...newAssetInstance, assignedProjectId: value === "unassigned" ? "" : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Not Assigned</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id.toString()}>
                            {project.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="assignedEmployee">Assigned To</Label>
                    <Select 
                      value={newAssetInstance.assignedToId} 
                      onValueChange={(value) => setNewAssetInstance({ ...newAssetInstance, assignedToId: value === "unassigned" ? "" : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Not Assigned</SelectItem>
                        {employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id.toString()}>
                            {employee.firstName} {employee.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="acquisitionDate">Acquisition Date</Label>
                    <Input
                      id="acquisitionDate"
                      type="date"
                      value={newAssetInstance.acquisitionDate}
                      onChange={(e) => setNewAssetInstance({ ...newAssetInstance, acquisitionDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="instanceCost">Acquisition Cost</Label>
                    <Input
                      id="instanceCost"
                      type="number"
                      step="0.01"
                      value={newAssetInstance.acquisitionCost}
                      onChange={(e) => setNewAssetInstance({ ...newAssetInstance, acquisitionCost: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currentValue">Current Value</Label>
                    <Input
                      id="currentValue"
                      type="number"
                      step="0.01"
                      value={newAssetInstance.currentValue}
                      onChange={(e) => setNewAssetInstance({ ...newAssetInstance, currentValue: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthlyRentalRate">Monthly Rent</Label>
                    <Input
                      id="monthlyRentalRate"
                      type="number"
                      step="0.01"
                      value={newAssetInstance.monthlyRentalRate}
                      onChange={(e) => setNewAssetInstance({ ...newAssetInstance, monthlyRentalRate: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="warrantyExpiryDate">Warranty Expiry Date</Label>
                    <Input
                      id="warrantyExpiryDate"
                      type="date"
                      value={newAssetInstance.warrantyExpiryDate}
                      onChange={(e) => setNewAssetInstance({ ...newAssetInstance, warrantyExpiryDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastMaintenanceDate">Last Maintenance Date</Label>
                    <Input
                      id="lastMaintenanceDate"
                      type="date"
                      value={newAssetInstance.lastMaintenanceDate}
                      onChange={(e) => setNewAssetInstance({ ...newAssetInstance, lastMaintenanceDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nextMaintenanceDate">Next Maintenance Date</Label>
                    <Input
                      id="nextMaintenanceDate"
                      type="date"
                      value={newAssetInstance.nextMaintenanceDate}
                      onChange={(e) => setNewAssetInstance({ ...newAssetInstance, nextMaintenanceDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="instanceNotes">Notes</Label>
                    <Input
                      id="instanceNotes"
                      value={newAssetInstance.notes}
                      onChange={(e) => setNewAssetInstance({ ...newAssetInstance, notes: e.target.value })}
                      placeholder="Additional notes"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button variant="outline" onClick={() => setIsAddInstanceDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddAssetInstance}>
                    Add Asset Instance
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Asset Instance Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Asset Instance</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="editInstanceType">Asset Type *</Label>
                  <Select 
                    value={newAssetInstance.assetTypeId} 
                    onValueChange={(value) => setNewAssetInstance({ ...newAssetInstance, assetTypeId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select asset type" />
                    </SelectTrigger>
                    <SelectContent>
                      {assetTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id.toString()}>
                          {type.name} - {type.manufacturer} {type.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editInstanceNumber">Instance Number</Label>
                    <Input
                      id="editInstanceNumber"
                      value={newAssetInstance.instanceNumber}
                      onChange={(e) => setNewAssetInstance({ ...newAssetInstance, instanceNumber: e.target.value })}
                      placeholder="e.g., Instance 1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editInstanceTag">Asset Tag *</Label>
                    <Input
                      id="editInstanceTag"
                      value={newAssetInstance.assetTag}
                      onChange={(e) => setNewAssetInstance({ ...newAssetInstance, assetTag: e.target.value })}
                      placeholder="e.g., EQP-003"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editInstanceSerial">Serial Number *</Label>
                    <Input
                      id="editInstanceSerial"
                      value={newAssetInstance.serialNumber}
                      onChange={(e) => setNewAssetInstance({ ...newAssetInstance, serialNumber: e.target.value })}
                      placeholder="Manufacturer serial"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editInstanceBarcode">Barcode *</Label>
                    <Input
                      id="editInstanceBarcode"
                      value={newAssetInstance.barcode}
                      onChange={(e) => setNewAssetInstance({ ...newAssetInstance, barcode: e.target.value })}
                      placeholder="Unique barcode"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editInstanceStatus">Status</Label>
                    <Select 
                      value={newAssetInstance.status} 
                      onValueChange={(value) => setNewAssetInstance({ ...newAssetInstance, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {assetStatuses.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editInstanceCondition">Condition</Label>
                    <Select 
                      value={newAssetInstance.condition} 
                      onValueChange={(value) => setNewAssetInstance({ ...newAssetInstance, condition: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {assetConditions.map((condition) => (
                          <SelectItem key={condition.value} value={condition.value}>
                            {condition.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editInstanceCondition">Condition</Label>
                    <Select 
                      value={newAssetInstance.condition} 
                      onValueChange={(value) => setNewAssetInstance({ ...newAssetInstance, condition: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {assetConditions.map((condition) => (
                          <SelectItem key={condition.value} value={condition.value}>
                            {condition.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editInstanceLocation">Location</Label>
                    <Input
                      id="editInstanceLocation"
                      value={newAssetInstance.location}
                      onChange={(e) => setNewAssetInstance({ ...newAssetInstance, location: e.target.value })}
                      placeholder="Current location"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editAssignedProject">Assigned Project</Label>
                    <Select 
                      value={newAssetInstance.assignedProjectId || "unassigned"} 
                      onValueChange={(value) => setNewAssetInstance({ ...newAssetInstance, assignedProjectId: value === "unassigned" ? "" : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Not Assigned</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id.toString()}>
                            {project.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editAssignedEmployee">Assigned To</Label>
                    <Select 
                      value={newAssetInstance.assignedToId || "unassigned"} 
                      onValueChange={(value) => setNewAssetInstance({ ...newAssetInstance, assignedToId: value === "unassigned" ? "" : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Not Assigned</SelectItem>
                        {employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id.toString()}>
                            {employee.firstName} {employee.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editAcquisitionDate">Acquisition Date</Label>
                    <Input
                      id="editAcquisitionDate"
                      type="date"
                      value={newAssetInstance.acquisitionDate}
                      onChange={(e) => setNewAssetInstance({ ...newAssetInstance, acquisitionDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editInstanceCost">Acquisition Cost</Label>
                    <Input
                      id="editInstanceCost"
                      type="number"
                      step="0.01"
                      value={newAssetInstance.acquisitionCost}
                      onChange={(e) => setNewAssetInstance({ ...newAssetInstance, acquisitionCost: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editCurrentValue">Current Value</Label>
                    <Input
                      id="editCurrentValue"
                      type="number"
                      step="0.01"
                      value={newAssetInstance.currentValue}
                      onChange={(e) => setNewAssetInstance({ ...newAssetInstance, currentValue: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editMonthlyRentalRate">Monthly Rent</Label>
                    <Input
                      id="editMonthlyRentalRate"
                      type="number"
                      step="0.01"
                      value={newAssetInstance.monthlyRentalRate}
                      onChange={(e) => setNewAssetInstance({ ...newAssetInstance, monthlyRentalRate: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editWarrantyExpiryDate">Warranty Expiry Date</Label>
                    <Input
                      id="editWarrantyExpiryDate"
                      type="date"
                      value={newAssetInstance.warrantyExpiryDate}
                      onChange={(e) => setNewAssetInstance({ ...newAssetInstance, warrantyExpiryDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editLastMaintenanceDate">Last Maintenance Date</Label>
                    <Input
                      id="editLastMaintenanceDate"
                      type="date"
                      value={newAssetInstance.lastMaintenanceDate}
                      onChange={(e) => setNewAssetInstance({ ...newAssetInstance, lastMaintenanceDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editNextMaintenanceDate">Next Maintenance Date</Label>
                    <Input
                      id="editNextMaintenanceDate"
                      type="date"
                      value={newAssetInstance.nextMaintenanceDate}
                      onChange={(e) => setNewAssetInstance({ ...newAssetInstance, nextMaintenanceDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editInstanceNotes">Notes</Label>
                    <Input
                      id="editInstanceNotes"
                      value={newAssetInstance.notes}
                      onChange={(e) => setNewAssetInstance({ ...newAssetInstance, notes: e.target.value })}
                      placeholder="Additional notes"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editInstanceLocation">Location</Label>
                    <Input
                      id="editInstanceLocation"
                      value={newAssetInstance.location}
                      onChange={(e) => setNewAssetInstance({ ...newAssetInstance, location: e.target.value })}
                      placeholder="Current location"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editInstanceCost">Acquisition Cost</Label>
                    <Input
                      id="editInstanceCost"
                      type="number"
                      value={newAssetInstance.acquisitionCost}
                      onChange={(e) => setNewAssetInstance({ ...newAssetInstance, acquisitionCost: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editInstanceDate">Acquisition Date</Label>
                  <Input
                    id="editInstanceDate"
                    type="date"
                    value={newAssetInstance.acquisitionDate}
                    onChange={(e) => setNewAssetInstance({ ...newAssetInstance, acquisitionDate: e.target.value })}
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button variant="outline" onClick={() => {
                    setIsEditDialogOpen(false);
                    setSelectedInstance(null);
                    setNewAssetInstance({
                      assetTypeId: "",
                      instanceNumber: "",
                      assetTag: "",
                      serialNumber: "",
                      barcode: "",
                      status: "available",
                      condition: "excellent",
                      location: "",
                      assignedProjectId: "unassigned",
                      assignedToId: "unassigned",
                      acquisitionDate: "",
                      acquisitionCost: "",
                      acquisitionCurrency: "AED",
                      currentValue: "",
                      currentValueCurrency: "AED",
                      monthlyRentalRate: "",
                      rentalCurrency: "AED",
                      warrantyExpiryDate: "",
                      lastMaintenanceDate: "",
                      nextMaintenanceDate: "",
                      notes: "",
                    });
                  }}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddAssetInstance}>
                    Update Asset Instance
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.totalAssets}</div>
            <p className="text-xs text-muted-foreground">Individual instances</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(summaryStats.totalValue || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Current book value</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summaryStats.available}</div>
            <p className="text-xs text-muted-foreground">Ready for assignment</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Use</CardTitle>
            <Activity className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summaryStats.inUse}</div>
            <p className="text-xs text-muted-foreground">Currently assigned</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="instances">Asset Instances</TabsTrigger>
          <TabsTrigger value="types">Asset Types</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Asset Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Available</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full" 
                          style={{ width: `${summaryStats.totalAssets > 0 ? (summaryStats.available / summaryStats.totalAssets) * 100 : 0}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium">{summaryStats.available}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">In Use</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${summaryStats.totalAssets > 0 ? (summaryStats.inUse / summaryStats.totalAssets) * 100 : 0}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium">{summaryStats.inUse}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Maintenance</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-yellow-600 h-2 rounded-full" 
                          style={{ width: `${summaryStats.totalAssets > 0 ? (summaryStats.maintenance / summaryStats.totalAssets) * 100 : 0}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium">{summaryStats.maintenance}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Asset Types Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {assetTypes.map((type) => (
                    <div key={type.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{type.name}</p>
                        <p className="text-xs text-muted-foreground">{type.manufacturer} {type.model}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{type.instanceCount} units</p>
                        <p className="text-xs text-green-600">{type.availableCount} available</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="instances" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Asset Instances</CardTitle>
              <CardDescription>Individual asset items with unique identifiers and tracking</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by asset tag, serial number, or type..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {assetCategories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {assetStatuses.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Asset Instance List */}
              <div className="space-y-4">
                {filteredInstances.map((instance) => {
                  const assetType = assetTypes.find(type => type.id === instance.assetTypeId);
                  return (
                    <div key={instance.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                            <QrCode className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="font-semibold">{instance.assetTag}</h3>
                              {getStatusBadge(instance.status)}
                              {getConditionBadge(instance.condition)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {assetType?.name} - {assetType?.manufacturer} {assetType?.model}
                            </p>
                            <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground mt-2">
                              <div className="space-y-1">
                                <div className="flex items-center">
                                  <span className="font-medium w-20">Serial:</span>
                                  <span>{instance.serialNumber || 'N/A'}</span>
                                </div>
                                <div className="flex items-center">
                                  <span className="font-medium w-20">Barcode:</span>
                                  <span>{instance.barcode || 'N/A'}</span>
                                </div>
                                <div className="flex items-center">
                                  <span className="font-medium w-20">Instance:</span>
                                  <span>{instance.instanceNumber || 'N/A'}</span>
                                </div>
                                <div className="flex items-center">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  <span className="font-medium">Location:</span>
                                  <span className="ml-1">{instance.location || 'Not specified'}</span>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center">
                                  <span className="font-medium w-24">Project:</span>
                                  <span>{projects.find(p => p.id === instance.assignedProjectId)?.title || 'Not assigned'}</span>
                                </div>
                                <div className="flex items-center">
                                  <span className="font-medium w-24">Assigned To:</span>
                                  <span>{employees.find(e => e.id === instance.assignedToId)?.firstName} {employees.find(e => e.id === instance.assignedToId)?.lastName || 'Not assigned'}</span>
                                </div>
                                <div className="flex items-center">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  <span className="font-medium">Acquired:</span>
                                  <span className="ml-1">{instance.acquisitionDate ? new Date(instance.acquisitionDate).toLocaleDateString() : 'N/A'}</span>
                                </div>
                                <div className="flex items-center">
                                  <DollarSign className="h-3 w-3 mr-1" />
                                  <span className="font-medium">Value:</span>
                                  <span className="ml-1">${instance.currentValue?.toLocaleString() || instance.acquisitionCost?.toLocaleString() || '0'}</span>
                                </div>
                              </div>
                            </div>
                            {(instance.monthlyRentalRate && parseFloat(instance.monthlyRentalRate) > 0) && (
                              <div className="mt-2 text-xs">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Monthly Rent: ${parseFloat(instance.monthlyRentalRate).toLocaleString()}/month
                                </span>
                              </div>
                            )}
                            {(instance.warrantyExpiryDate || instance.nextMaintenanceDate) && (
                              <div className="mt-2 flex gap-2 text-xs">
                                {instance.warrantyExpiryDate && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    Warranty: {new Date(instance.warrantyExpiryDate).toLocaleDateString()}
                                  </span>
                                )}
                                {instance.nextMaintenanceDate && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                    Next Maintenance: {new Date(instance.nextMaintenanceDate).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleViewInstanceDetail(instance)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEditInstance(instance)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <FileText className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="types" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Asset Types</CardTitle>
              <CardDescription>Master catalog of asset categories and specifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {assetTypes.map((type) => (
                  <div key={type.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold">{type.name}</h3>
                          <Badge variant="outline">{assetCategories.find(c => c.value === type.category)?.label}</Badge>
                          <Badge variant="secondary">{type.instanceCount || 0} instances</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {type.manufacturer} {type.model}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Total Value: ${(type.totalValue || 0).toLocaleString()} • {type.availableCount || 0} Available
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-6">
          <MaintenanceManagement />
        </TabsContent>
      </Tabs>

      {/* Asset Instance Detail Modal */}
      <Dialog open={isInstanceDetailOpen} onOpenChange={setIsInstanceDetailOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Asset Instance Details</DialogTitle>
          </DialogHeader>
          {selectedInstanceForDetail && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium">Asset Tag</Label>
                      <p className="text-sm text-muted-foreground">{selectedInstanceForDetail.assetTag}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Instance Number</Label>
                      <p className="text-sm text-muted-foreground">{selectedInstanceForDetail.instanceNumber || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Asset Type</Label>
                      <p className="text-sm text-muted-foreground">
                        {assetTypes.find(type => type.id === selectedInstanceForDetail.assetTypeId)?.name || 'Unknown'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Serial Number</Label>
                      <p className="text-sm text-muted-foreground">{selectedInstanceForDetail.serialNumber || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Barcode</Label>
                      <p className="text-sm text-muted-foreground">{selectedInstanceForDetail.barcode || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Status</Label>
                      <div className="mt-1">{getStatusBadge(selectedInstanceForDetail.status)}</div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Condition</Label>
                      <div className="mt-1">{getConditionBadge(selectedInstanceForDetail.condition)}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Location & Assignment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium">Current Location</Label>
                      <p className="text-sm text-muted-foreground">{selectedInstanceForDetail.location || 'Not specified'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Assigned Project</Label>
                      <p className="text-sm text-muted-foreground">
                        {selectedInstanceForDetail.assignedProjectId ? 
                          (projects.find(p => p.id === selectedInstanceForDetail.assignedProjectId)?.title || `Project ID: ${selectedInstanceForDetail.assignedProjectId}`) : 
                          'Not assigned'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Assigned To</Label>
                      <p className="text-sm text-muted-foreground">
                        {selectedInstanceForDetail.assignedToId ? 
                          (() => {
                            const employee = employees.find(e => e.id === selectedInstanceForDetail.assignedToId);
                            return employee ? `${employee.firstName} ${employee.lastName}` : `Employee ID: ${selectedInstanceForDetail.assignedToId}`;
                          })() : 
                          'Not assigned'}
                      </p>
                    </div>

                  </CardContent>
                </Card>
              </div>

              {/* Financial Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Financial Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Acquisition Cost</Label>
                      <p className="text-sm text-muted-foreground">
                        ${selectedInstanceForDetail.acquisitionCost ? parseFloat(selectedInstanceForDetail.acquisitionCost).toLocaleString() : '0.00'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Current Value</Label>
                      <p className="text-sm text-muted-foreground">
                        ${selectedInstanceForDetail.currentValue ? parseFloat(selectedInstanceForDetail.currentValue).toLocaleString() : '0.00'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Monthly Rent</Label>
                      <p className="text-sm text-muted-foreground">
                        ${selectedInstanceForDetail.monthlyRentalRate ? parseFloat(selectedInstanceForDetail.monthlyRentalRate).toLocaleString() : '0.00'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Dates Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Important Dates</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Acquisition Date</Label>
                      <p className="text-sm text-muted-foreground">
                        {selectedInstanceForDetail.acquisitionDate ? 
                          new Date(selectedInstanceForDetail.acquisitionDate).toLocaleDateString() : 'Not specified'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Warranty Expiry</Label>
                      <p className="text-sm text-muted-foreground">
                        {selectedInstanceForDetail.warrantyExpiryDate ? 
                          new Date(selectedInstanceForDetail.warrantyExpiryDate).toLocaleDateString() : 'Not specified'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Last Maintenance</Label>
                      <p className="text-sm text-muted-foreground">
                        {selectedInstanceForDetail.lastMaintenanceDate ? 
                          new Date(selectedInstanceForDetail.lastMaintenanceDate).toLocaleDateString() : 'Not specified'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Next Maintenance</Label>
                      <p className="text-sm text-muted-foreground">
                        {selectedInstanceForDetail.nextMaintenanceDate ? 
                          new Date(selectedInstanceForDetail.nextMaintenanceDate).toLocaleDateString() : 'Not scheduled'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Asset Type Information */}
              {(() => {
                const assetType = assetTypes.find(type => type.id === selectedInstanceForDetail.assetTypeId);
                return assetType ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Asset Type Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Manufacturer</Label>
                          <p className="text-sm text-muted-foreground">{assetType.manufacturer || 'Not specified'}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Model</Label>
                          <p className="text-sm text-muted-foreground">{assetType.model || 'Not specified'}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Category</Label>
                          <p className="text-sm text-muted-foreground">
                            {assetCategories.find(c => c.value === assetType.category)?.label || assetType.category}
                          </p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Default Monthly Rate</Label>
                          <p className="text-sm text-muted-foreground">
                            ${assetType.defaultMonthlyRentalRate ? parseFloat(assetType.defaultMonthlyRentalRate).toLocaleString() : '0.00'}
                          </p>
                        </div>
                      </div>
                      {assetType.description && (
                        <div className="mt-4">
                          <Label className="text-sm font-medium">Description</Label>
                          <p className="text-sm text-muted-foreground mt-1">{assetType.description}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : null;
              })()}

              {/* Notes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Notes & Additional Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium">Notes</Label>
                      <p className="text-sm text-muted-foreground">
                        {selectedInstanceForDetail.notes || 'No additional notes'}
                      </p>
                    </div>
                    {selectedInstanceForDetail.photos && selectedInstanceForDetail.photos.length > 0 && (
                      <div>
                        <Label className="text-sm font-medium">Photos</Label>
                        <p className="text-sm text-muted-foreground">
                          {selectedInstanceForDetail.photos.length} photo(s) attached
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Record Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Record Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Created At</Label>
                      <p className="text-sm text-muted-foreground">
                        {selectedInstanceForDetail.createdAt ? 
                          new Date(selectedInstanceForDetail.createdAt).toLocaleString() : 'Not available'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Last Updated</Label>
                      <p className="text-sm text-muted-foreground">
                        {selectedInstanceForDetail.updatedAt ? 
                          new Date(selectedInstanceForDetail.updatedAt).toLocaleString() : 'Not available'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Active Status</Label>
                      <p className="text-sm text-muted-foreground">
                        {selectedInstanceForDetail.isActive ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Asset ID</Label>
                      <p className="text-sm text-muted-foreground">
                        #{selectedInstanceForDetail.id}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setIsInstanceDetailOpen(false)}>
                  Close
                </Button>
                <Button onClick={() => {
                  setIsInstanceDetailOpen(false);
                  handleEditInstance(selectedInstanceForDetail);
                }}>
                  Edit Asset
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}