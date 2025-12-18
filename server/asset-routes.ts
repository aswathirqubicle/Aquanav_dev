import { Router } from "express";
import { assetInventoryStorage } from "./asset-storage";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";

export const assetRoutes = Router();

// Middleware to check authentication (simplified for this implementation)
const requireAuth = (req: any, res: any, next: any) => {
  // In a real implementation, this would check session or JWT
  // For now, we'll assume user is authenticated
  req.user = { id: 1, role: 'admin' };
  next();
};

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), 'uploads', 'maintenance');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `maintenance-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage: multerStorage ,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images and documents
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images and documents are allowed'));
    }
  }
});

// Asset Types Routes
assetRoutes.get('/api/asset-types', requireAuth, (req, res) => {
  try {
    const assetTypes = assetInventoryStorage.getAssetTypes();
    res.json(assetTypes);
  } catch (error) {
    console.error('Error fetching asset types:', error);
    res.status(500).json({ message: 'Failed to fetch asset types' });
  }
});

assetRoutes.get('/api/asset-types/:id', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const assetType = assetInventoryStorage.getAssetType(id);
    
    if (!assetType) {
      return res.status(404).json({ message: 'Asset type not found' });
    }
    
    res.json(assetType);
  } catch (error) {
    console.error('Error fetching asset type:', error);
    res.status(500).json({ message: 'Failed to fetch asset type' });
  }
});

assetRoutes.post('/api/asset-types', requireAuth, (req, res) => {
  try {
    const assetType = assetInventoryStorage.createAssetType(req.body);
    res.status(201).json(assetType);
  } catch (error) {
    console.error('Error creating asset type:', error);
    res.status(500).json({ message: 'Failed to create asset type' });
  }
});

assetRoutes.put('/api/asset-types/:id', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const assetType = assetInventoryStorage.updateAssetType(id, req.body);
    
    if (!assetType) {
      return res.status(404).json({ message: 'Asset type not found' });
    }
    
    res.json(assetType);
  } catch (error) {
    console.error('Error updating asset type:', error);
    res.status(500).json({ message: 'Failed to update asset type' });
  }
});

// Asset Instances Routes
assetRoutes.get('/api/asset-instances', requireAuth, (req, res) => {
  try {
    const { status, category, projectId, assignedToId } = req.query;
    
    const filters: any = {};
    if (status && status !== 'all') filters.status = status as string;
    if (category && category !== 'all') filters.category = category as string;
    if (projectId) filters.projectId = parseInt(projectId as string);
    if (assignedToId) filters.assignedToId = parseInt(assignedToId as string);
    
    const instances = assetInventoryStorage.getAssetInstances(filters);
    
    // Enrich instances with asset type information
    const enrichedInstances = instances.map(instance => {
      const assetType = assetInventoryStorage.getAssetType(instance.assetTypeId);
      return {
        ...instance,
        assetType: assetType ? {
          name: assetType.name,
          category: assetType.category,
          manufacturer: assetType.manufacturer,
          model: assetType.model,
        } : null,
      };
    });
    
    res.json(enrichedInstances);
  } catch (error) {
    console.error('Error fetching asset instances:', error);
    res.status(500).json({ message: 'Failed to fetch asset instances' });
  }
});

assetRoutes.get('/api/asset-instances/:id', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const instance = assetInventoryStorage.getAssetInstance(id);
    
    if (!instance) {
      return res.status(404).json({ message: 'Asset instance not found' });
    }
    
    // Enrich with asset type information
    const assetType = assetInventoryStorage.getAssetType(instance.assetTypeId);
    const enrichedInstance = {
      ...instance,
      assetType: assetType ? {
        name: assetType.name,
        category: assetType.category,
        manufacturer: assetType.manufacturer,
        model: assetType.model,
      } : null,
    };
    
    res.json(enrichedInstance);
  } catch (error) {
    console.error('Error fetching asset instance:', error);
    res.status(500).json({ message: 'Failed to fetch asset instance' });
  }
});

assetRoutes.get('/api/asset-instances/by-tag/:tag', requireAuth, (req, res) => {
  try {
    const tag = req.params.tag;
    const instance = assetInventoryStorage.getAssetInstanceByTag(tag);
    
    if (!instance) {
      return res.status(404).json({ message: 'Asset instance not found' });
    }
    
    res.json(instance);
  } catch (error) {
    console.error('Error fetching asset instance by tag:', error);
    res.status(500).json({ message: 'Failed to fetch asset instance' });
  }
});

assetRoutes.post('/api/asset-instances', requireAuth, (req, res) => {
  try {
    // Validate that asset tag is unique
    const existingInstance = assetInventoryStorage.getAssetInstanceByTag(req.body.assetTag);
    if (existingInstance) {
      return res.status(400).json({ message: 'Asset tag already exists' });
    }
    
    const instance = assetInventoryStorage.createAssetInstance({
      ...req.body,
      images: req.body.images || [],
      isActive: true,
    });
    
    res.status(201).json(instance);
  } catch (error) {
    console.error('Error creating asset instance:', error);
    res.status(500).json({ message: 'Failed to create asset instance' });
  }
});

assetRoutes.put('/api/asset-instances/:id', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const instance = assetInventoryStorage.updateAssetInstance(id, req.body);
    
    if (!instance) {
      return res.status(404).json({ message: 'Asset instance not found' });
    }
    
    res.json(instance);
  } catch (error) {
    console.error('Error updating asset instance:', error);
    res.status(500).json({ message: 'Failed to update asset instance' });
  }
});

// Asset Movement Routes
assetRoutes.get('/api/asset-movements/:assetInstanceId', requireAuth, (req, res) => {
  try {
    const assetInstanceId = parseInt(req.params.assetInstanceId);
    const movements = assetInventoryStorage.getAssetMovements(assetInstanceId);
    res.json(movements);
  } catch (error) {
    console.error('Error fetching asset movements:', error);
    res.status(500).json({ message: 'Failed to fetch asset movements' });
  }
});

assetRoutes.post('/api/asset-movements', requireAuth, (req, res) => {
  try {
    const movement = assetInventoryStorage.createAssetMovement({
      ...req.body,
      createdBy: req.user.id,
    });
    res.status(201).json(movement);
  } catch (error) {
    console.error('Error creating asset movement:', error);
    res.status(500).json({ message: 'Failed to create asset movement' });
  }
});

// Maintenance Routes
assetRoutes.get('/api/maintenance-records/:assetInstanceId?', requireAuth, (req, res) => {
  try {
    const assetInstanceId = req.params.assetInstanceId ? parseInt(req.params.assetInstanceId) : undefined;
    const records = assetInventoryStorage.getMaintenanceRecords(assetInstanceId);
    res.json(records);
  } catch (error) {
    console.error('Error fetching maintenance records:', error);
    res.status(500).json({ message: 'Failed to fetch maintenance records' });
  }
});

assetRoutes.get('/api/maintenance/upcoming', requireAuth, (req, res) => {
  try {
    const upcomingMaintenance = assetInventoryStorage.getUpcomingMaintenance();
    
    // Enrich with asset information
    const enrichedMaintenance = upcomingMaintenance.map(record => {
      const instance = assetInventoryStorage.getAssetInstance(record.assetInstanceId);
      const assetType = instance ? assetInventoryStorage.getAssetType(instance.assetTypeId) : null;
      
      return {
        ...record,
        assetInstance: instance ? {
          assetTag: instance.assetTag,
          location: instance.location,
        } : null,
        assetType: assetType ? {
          name: assetType.name,
          manufacturer: assetType.manufacturer,
          model: assetType.model,
        } : null,
      };
    });
    
    res.json(enrichedMaintenance);
  } catch (error) {
    console.error('Error fetching upcoming maintenance:', error);
    res.status(500).json({ message: 'Failed to fetch upcoming maintenance' });
  }
});

assetRoutes.post(
  "/api/maintenance-records",
  requireAuth,
  upload.none(),
  async (req, res) => {
    try {
      const { assetId, maintenanceCost, description, maintenanceDate,startDate,completedDate,maintenanceType } = req.body;
      console.log(assetId, maintenanceCost, description, maintenanceDate,startDate,completedDate,maintenanceType,"assetId, maintenanceCost, description, maintenanceDate,startDate,completedDate,maintenanceType")
      if (!assetId || !maintenanceCost) {
        return res.status(400).json({
          message: "assetId and maintenanceCost are required",
        });
      }

      const record = await storage.createAssetInventoryMaintenanceRecord({
        instanceId: Number(assetId),
        maintenanceCost: maintenanceCost.toString(),
        description: description || null,
        maintenanceDate: maintenanceDate ? new Date(maintenanceDate) : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        completedDate: completedDate ? new Date(completedDate) : undefined,
        maintenanceType:maintenanceType || null,
        performedBy: req.user.id,
      });

      // ✅ IMPORTANT
      return res.status(201).json(record);

    } catch (error) {
      console.error("Error creating maintenance record:", error);

      // ✅ IMPORTANT
      return res.status(500).json({
        message: "Failed to create maintenance record",
      });
    }
  }
);

//Maintenance update
assetRoutes.put(
  "/api/maintenance-records/:id",
  requireAuth,
  upload.none(),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const {
        maintenanceType,
        description,
        maintenanceDate,
        startDate,
        completedDate,
        maintenanceCost,
      } = req.body;

      const record = await storage.updateAssetInventoryMaintenanceRecord(
        id,
        {
          maintenanceType,
          description,
          maintenanceDate: maintenanceDate ? new Date(maintenanceDate) : undefined,
          startDate: startDate ? new Date(startDate) : undefined,
          completedDate: completedDate ? new Date(completedDate) : undefined,
          maintenanceCost,
        }
      );

      res.json(record);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to update record" });
    }
  }
);

//Maintenance archive
assetRoutes.put(
  "/api/maintenance-record/:id/archive",
  requireAuth,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      const record = await storage.updateAssetInventoryMaintenanceRecord(
        id,
        { isArchived: true }
      );
      if (!record) {
          return res.status(404).json({ message: "Maintenance record not found" });
        }
      res.json({ message: "Maintenance record archived successfully", record });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to update record" });
    }
  }
);

//Maintenance unarchive
assetRoutes.put(
  "/api/maintenance-record/:id/unarchive",
  requireAuth,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      const record = await storage.updateAssetInventoryMaintenanceRecord(
        id,
        { isArchived: false }
      );
      if (!record) {
          return res.status(404).json({ message: "Maintenance record not found" });
        }
      res.json({ message: "Maintenance record unarchived successfully", record });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to update record" });
    }
  }
);

// Maintenance File Upload Routes
assetRoutes.post('/api/maintenance-records/:id/files', requireAuth, upload.single('file'), (req, res) => {
  console.log('Headers:', req.headers['content-type']);
  try {
    const maintenanceRecordId = parseInt(req.params.id);
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const relativePath = req.file.path
  .replace(/\\/g, "/")                 // Windows → URL-safe
  .split("uploads/")[1]; 
    
    const fileRecord = storage.createAssetInventoryMaintenanceFile({
      maintenanceRecordId,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      filePath: `uploads/${relativePath}`,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: req.user.id,
    });
    
    res.status(201).json(fileRecord);
  } catch (error) {
    console.error('Error uploading maintenance file:', error);
    res.status(500).json({ message: 'Failed to upload maintenance file' });
  }
});

  assetRoutes.get(
    '/api/maintenance-records/:id/files',
    requireAuth,
    async (req, res) => {
      try {
        const maintenanceRecordId = parseInt(req.params.id, 10);

        if (isNaN(maintenanceRecordId)) {
          return res.status(400).json({ message: 'Invalid maintenance record id' });
        }

        const files = await storage.getAssetInventoryMaintenanceFiles(
          maintenanceRecordId
        );

        res.json(files);
      } catch (error) {
        console.error('Error fetching maintenance files:', error);
        res.status(500).json({ message: 'Failed to fetch maintenance files' });
      }
    }
  );


assetRoutes.delete('/api/maintenance-records/:recordId/files/:fileId', requireAuth, (req, res) => {
  try {
    const fileId = parseInt(req.params.fileId);
    const success = assetInventoryStorage.deleteAssetInventoryMaintenanceFile(fileId);
    
    if (success) {
      res.json({ message: 'File deleted successfully' });
    } else {
      res.status(404).json({ message: 'File not found' });
    }
  } catch (error) {
    console.error('Error deleting maintenance file:', error);
    res.status(500).json({ message: 'Failed to delete maintenance file' });
  }
});

// Route to serve uploaded files
assetRoutes.get('/api/files/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);
    
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ message: 'File not found' });
    }
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({ message: 'Failed to serve file' });
  }
});

// Summary and Analytics Routes
assetRoutes.get('/api/asset-summary', requireAuth, (req, res) => {
  try {
    const summary = assetInventoryStorage.getAssetSummary();
    res.json(summary);
  } catch (error) {
    console.error('Error fetching asset summary:', error);
    res.status(500).json({ message: 'Failed to fetch asset summary' });
  }
});

// Asset Assignment Routes
assetRoutes.post('/api/asset-instances/:id/assign', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { projectId, assignedToId, location, reason } = req.body;
    
    const instance = assetInventoryStorage.getAssetInstance(id);
    if (!instance) {
      return res.status(404).json({ message: 'Asset instance not found' });
    }
    
    // Update asset status and assignment
    const updatedInstance = assetInventoryStorage.updateAssetInstance(id, {
      status: 'in_use',
      projectId,
      assignedToId,
      location,
    });
    
    // Create movement record
    assetInventoryStorage.createAssetMovement({
      assetInstanceId: id,
      movementType: 'assignment',
      fromLocation: instance.location,
      toLocation: location,
      fromProjectId: instance.projectId,
      toProjectId: projectId,
      fromEmployeeId: instance.assignedToId,
      toEmployeeId: assignedToId,
      reason,
      createdBy: req.user.id,
    });
    
    res.json(updatedInstance);
  } catch (error) {
    console.error('Error assigning asset:', error);
    res.status(500).json({ message: 'Failed to assign asset' });
  }
});

assetRoutes.post('/api/asset-instances/:id/return', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { location, reason, condition } = req.body;
    
    const instance = assetInventoryStorage.getAssetInstance(id);
    if (!instance) {
      return res.status(404).json({ message: 'Asset instance not found' });
    }
    
    // Update asset status and assignment
    const updatedInstance = assetInventoryStorage.updateAssetInstance(id, {
      status: 'available',
      projectId: undefined,
      assignedToId: undefined,
      location,
      condition: condition || instance.condition,
    });
    
    // Create movement record
    assetInventoryStorage.createAssetMovement({
      assetInstanceId: id,
      movementType: 'return',
      fromLocation: instance.location,
      toLocation: location,
      fromProjectId: instance.projectId,
      fromEmployeeId: instance.assignedToId,
      reason,
      createdBy: req.user.id,
    });
    
    res.json(updatedInstance);
  } catch (error) {
    console.error('Error returning asset:', error);
    res.status(500).json({ message: 'Failed to return asset' });
  }
});