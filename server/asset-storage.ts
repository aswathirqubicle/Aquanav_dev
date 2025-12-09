// Memory-based asset inventory storage (separate from main inventory)
// This provides full asset tracking functionality independent of the consumable inventory system

export interface AssetType {
  id: number;
  name: string;
  category: string;
  manufacturer?: string;
  model?: string;
  description?: string;
  defaultMonthlyRentalRate?: number;
  warrantyPeriodMonths: number;
  maintenanceIntervalDays: number;
  isActive: boolean;
  createdAt: Date;
}

export interface AssetInstance {
  id: number;
  assetTypeId: number;
  assetTag: string;
  serialNumber?: string;
  barcode?: string;
  status: 'available' | 'in_use' | 'maintenance' | 'under_repair' | 'retired' | 'lost' | 'stolen';
  condition: 'excellent' | 'good' | 'fair' | 'poor' | 'damaged';
  location?: string;
  projectId?: number;
  assignedToId?: number;
  supplierId?: number;
  acquisitionDate?: Date;
  acquisitionCost?: number;
  currentValue?: number;
  monthlyRentalAmount?: number;
  warrantyExpiryDate?: Date;
  lastMaintenanceDate?: Date;
  nextMaintenanceDate?: Date;
  notes?: string;
  images: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssetMovement {
  id: number;
  assetInstanceId: number;
  movementType: 'assignment' | 'return' | 'transfer' | 'maintenance' | 'repair';
  fromLocation?: string;
  toLocation?: string;
  fromProjectId?: number;
  toProjectId?: number;
  fromEmployeeId?: number;
  toEmployeeId?: number;
  reason?: string;
  notes?: string;
  documentReference?: string;
  createdBy: number;
  createdAt: Date;
}

export interface MaintenanceRecord {
  id: number;
  assetInstanceId: number;
  maintenanceType: 'preventive' | 'corrective' | 'emergency' | 'inspection';
  description: string;
  performedBy?: string;
  vendorId?: number;
  cost?: number;
  laborHours?: number;
  partsUsed: Array<{name: string, quantity: number, cost: number}>;
  maintenanceDate: Date;
  nextScheduledDate?: Date;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  downtime?: number;
  notes?: string;
  attachments: string[];
  createdBy: number;
  createdAt: Date;
  completedAt?: Date;
}

class AssetInventoryStorage {
  private assetTypes: AssetType[] = [];
  private assetInstances: AssetInstance[] = [];
  private assetMovements: AssetMovement[] = [];
  private maintenanceRecords: MaintenanceRecord[] = [];
  private nextId = 1;

  constructor() {
    // Initialize with some sample data for demonstration
    this.seedSampleData();
  }

  private seedSampleData() {
    // Asset Types
    this.assetTypes = [
      {
        id: 1,
        name: "Marine Excavator",
        category: "equipment",
        manufacturer: "Caterpillar",
        model: "320D",
        description: "Heavy duty excavator for marine construction projects",
        defaultMonthlyRentalRate: 1200,
        warrantyPeriodMonths: 24,
        maintenanceIntervalDays: 90,
        isActive: true,
        createdAt: new Date('2023-01-01'),
      },
      {
        id: 2,
        name: "Underwater Welding Machine",
        category: "tools",
        manufacturer: "Miller",
        model: "Syncrowave 200",
        description: "Professional welding equipment for underwater and surface welding",
        defaultMonthlyRentalRate: 150,
        warrantyPeriodMonths: 12,
        maintenanceIntervalDays: 30,
        isActive: true,
        createdAt: new Date('2023-01-01'),
      },
      {
        id: 3,
        name: "Marine Crane",
        category: "equipment",
        manufacturer: "Liebherr",
        model: "LTM 1030-2.1",
        description: "Mobile crane for heavy lifting in port operations",
        defaultMonthlyRentalRate: 2000,
        warrantyPeriodMonths: 36,
        maintenanceIntervalDays: 60,
        isActive: true,
        createdAt: new Date('2023-01-01'),
      },
      {
        id: 4,
        name: "Project Vehicle",
        category: "vehicles",
        manufacturer: "Ford",
        model: "F-150",
        description: "Pickup truck for project transportation and light duty work",
        defaultMonthlyRentalRate: 80,
        warrantyPeriodMonths: 36,
        maintenanceIntervalDays: 180,
        isActive: true,
        createdAt: new Date('2023-01-01'),
      },
    ];

    // Asset Instances
    this.assetInstances = [
      {
        id: 1,
        assetTypeId: 1,
        assetTag: "EQP-001",
        serialNumber: "CAT320D001",
        status: "available",
        condition: "good",
        location: "Marine Yard A",
        acquisitionDate: new Date('2023-01-15'),
        acquisitionCost: 250000,
        currentValue: 200000,
        lastMaintenanceDate: new Date('2024-05-15'),
        nextMaintenanceDate: new Date('2024-08-15'),
        images: [],
        isActive: true,
        createdAt: new Date('2023-01-15'),
        updatedAt: new Date('2024-05-15'),
      },
      {
        id: 2,
        assetTypeId: 1,
        assetTag: "EQP-002",
        serialNumber: "CAT320D002",
        status: "in_use",
        condition: "excellent",
        location: "Project Site Alpha",
        projectId: 1,
        acquisitionDate: new Date('2023-02-20'),
        acquisitionCost: 250000,
        currentValue: 195000,
        lastMaintenanceDate: new Date('2024-06-01'),
        nextMaintenanceDate: new Date('2024-09-01'),
        images: [],
        isActive: true,
        createdAt: new Date('2023-02-20'),
        updatedAt: new Date('2024-06-01'),
      },
      {
        id: 3,
        assetTypeId: 2,
        assetTag: "WLD-001",
        serialNumber: "MIL200-001",
        status: "maintenance",
        condition: "fair",
        location: "Maintenance Shop",
        acquisitionDate: new Date('2022-06-10'),
        acquisitionCost: 8500,
        currentValue: 6800,
        lastMaintenanceDate: new Date('2024-06-20'),
        nextMaintenanceDate: new Date('2024-07-01'),
        images: [],
        isActive: true,
        createdAt: new Date('2022-06-10'),
        updatedAt: new Date('2024-06-20'),
      },
      {
        id: 4,
        assetTypeId: 4,
        assetTag: "VEH-001",
        serialNumber: "FORD150-001",
        status: "available",
        condition: "good",
        location: "Fleet Parking",
        acquisitionDate: new Date('2023-08-01'),
        acquisitionCost: 45000,
        currentValue: 38000,
        images: [],
        isActive: true,
        createdAt: new Date('2023-08-01'),
        updatedAt: new Date('2023-08-01'),
      },
      {
        id: 5,
        assetTypeId: 3,
        assetTag: "CRN-001",
        serialNumber: "LBR1030-001",
        status: "in_use",
        condition: "excellent",
        location: "Port Terminal B",
        projectId: 2,
        acquisitionDate: new Date('2023-03-10'),
        acquisitionCost: 400000,
        currentValue: 360000,
        lastMaintenanceDate: new Date('2024-04-10'),
        nextMaintenanceDate: new Date('2024-07-10'),
        images: [],
        isActive: true,
        createdAt: new Date('2023-03-10'),
        updatedAt: new Date('2024-04-10'),
      },
    ];

    this.nextId = 6;
  }

  // Asset Types Methods
  getAssetTypes(): AssetType[] {
    return this.assetTypes.filter(type => type.isActive);
  }

  getAssetType(id: number): AssetType | undefined {
    return this.assetTypes.find(type => type.id === id);
  }

  createAssetType(data: Omit<AssetType, 'id' | 'createdAt'>): AssetType {
    const assetType: AssetType = {
      ...data,
      id: this.nextId++,
      createdAt: new Date(),
    };
    this.assetTypes.push(assetType);
    return assetType;
  }

  updateAssetType(id: number, data: Partial<AssetType>): AssetType | undefined {
    const index = this.assetTypes.findIndex(type => type.id === id);
    if (index === -1) return undefined;
    
    this.assetTypes[index] = { ...this.assetTypes[index], ...data };
    return this.assetTypes[index];
  }

  // Asset Instances Methods
  getAssetInstances(filters?: {
    status?: string;
    category?: string;
    projectId?: number;
    assignedToId?: number;
  }): AssetInstance[] {
    let instances = this.assetInstances.filter(instance => instance.isActive);
    
    if (filters) {
      if (filters.status) {
        instances = instances.filter(instance => instance.status === filters.status);
      }
      if (filters.category) {
        const typeIds = this.assetTypes
          .filter(type => type.category === filters.category)
          .map(type => type.id);
        instances = instances.filter(instance => typeIds.includes(instance.assetTypeId));
      }
      if (filters.projectId) {
        instances = instances.filter(instance => instance.projectId === filters.projectId);
      }
      if (filters.assignedToId) {
        instances = instances.filter(instance => instance.assignedToId === filters.assignedToId);
      }
    }
    
    return instances;
  }

  getAssetInstance(id: number): AssetInstance | undefined {
    return this.assetInstances.find(instance => instance.id === id);
  }

  getAssetInstanceByTag(assetTag: string): AssetInstance | undefined {
    return this.assetInstances.find(instance => instance.assetTag === assetTag);
  }

  createAssetInstance(data: Omit<AssetInstance, 'id' | 'createdAt' | 'updatedAt'>): AssetInstance {
    const assetInstance: AssetInstance = {
      ...data,
      id: this.nextId++,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.assetInstances.push(assetInstance);
    return assetInstance;
  }

  updateAssetInstance(id: number, data: Partial<AssetInstance>): AssetInstance | undefined {
    const index = this.assetInstances.findIndex(instance => instance.id === id);
    if (index === -1) return undefined;
    
    this.assetInstances[index] = { 
      ...this.assetInstances[index], 
      ...data, 
      updatedAt: new Date() 
    };
    return this.assetInstances[index];
  }

  // Asset Movement Methods
  createAssetMovement(data: Omit<AssetMovement, 'id' | 'createdAt'>): AssetMovement {
    const movement: AssetMovement = {
      ...data,
      id: this.nextId++,
      createdAt: new Date(),
    };
    this.assetMovements.push(movement);
    return movement;
  }

  getAssetMovements(assetInstanceId?: number): AssetMovement[] {
    if (assetInstanceId) {
      return this.assetMovements.filter(movement => movement.assetInstanceId === assetInstanceId);
    }
    return this.assetMovements;
  }

  // Maintenance Methods
  createMaintenanceRecord(data: Omit<MaintenanceRecord, 'id' | 'createdAt'>): MaintenanceRecord {
    const record: MaintenanceRecord = {
      ...data,
      id: this.nextId++,
      createdAt: new Date(),
    };
    this.maintenanceRecords.push(record);
    return record;
  }

  getMaintenanceRecords(assetInstanceId?: number): MaintenanceRecord[] {
    if (assetInstanceId) {
      return this.maintenanceRecords.filter(record => record.assetInstanceId === assetInstanceId);
    }
    return this.maintenanceRecords;
  }

  getUpcomingMaintenance(): MaintenanceRecord[] {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    return this.maintenanceRecords.filter(record => 
      record.status === 'scheduled' && 
      record.maintenanceDate <= thirtyDaysFromNow
    );
  }

  // Summary Statistics
  getAssetSummary() {
    const instances = this.getAssetInstances();
    const totalAssets = instances.length;
    const totalValue = instances.reduce((sum, asset) => sum + (asset.currentValue || 0), 0);
    
    const statusCounts = instances.reduce((acc, asset) => {
      acc[asset.status] = (acc[asset.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const typesCounts = this.assetTypes.map(type => ({
      ...type,
      instanceCount: instances.filter(instance => instance.assetTypeId === type.id).length,
      availableCount: instances.filter(instance => 
        instance.assetTypeId === type.id && instance.status === 'available'
      ).length,
      totalValue: instances
        .filter(instance => instance.assetTypeId === type.id)
        .reduce((sum, asset) => sum + (asset.currentValue || 0), 0),
    }));

    return {
      totalAssets,
      totalValue,
      statusCounts,
      typesCounts,
      available: statusCounts.available || 0,
      inUse: statusCounts.in_use || 0,
      maintenance: statusCounts.maintenance || 0,
      retired: statusCounts.retired || 0,
    };
  }
}

export const assetInventoryStorage = new AssetInventoryStorage();