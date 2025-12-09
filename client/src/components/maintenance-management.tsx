import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { FileText, Upload, Calendar, Wrench, AlertCircle, CheckCircle, Clock, Plus, Search, Filter, Download, Eye } from "lucide-react";
import { format } from 'date-fns';

interface MaintenanceRecord {
  id: number;
  assetInstanceId: number;
  maintenanceType: string;
  description: string;
  performedBy: string;
  completedDate: string;
  nextMaintenanceDate?: string;
  cost?: number;
  status: 'completed' | 'in_progress' | 'scheduled';
  files?: Array<{
    id: number;
    fileName: string;
    originalName: string;
    uploadedAt: string;
  }>;
  assetInstance?: {
    id: number;
    assetTag: string;
    assetType: {
      name: string;
      category: string;
    };
  };
}

interface AssetInstance {
  id: number;
  assetTag: string;
  serialNumber?: string;
  status: string;
  condition: string;
  location?: string;
  assetType: {
    id: number;
    name: string;
    category: string;
    manufacturer?: string;
    model?: string;
  };
}

const maintenanceTypes = [
  { value: 'preventive', label: 'Preventive Maintenance' },
  { value: 'corrective', label: 'Corrective Maintenance' },
  { value: 'predictive', label: 'Predictive Maintenance' },
  { value: 'emergency', label: 'Emergency Repair' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'calibration', label: 'Calibration' },
  { value: 'overhaul', label: 'Overhaul' }
];

const statusColors = {
  'completed': 'bg-green-100 text-green-800',
  'in_progress': 'bg-blue-100 text-blue-800',
  'scheduled': 'bg-yellow-100 text-yellow-800'
};

const statusIcons = {
  'completed': CheckCircle,
  'in_progress': Clock,
  'scheduled': Calendar
};

export function MaintenanceManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isRecorderOpen, setIsRecorderOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetInstance | null>(null);

  // Fetch maintenance records
  const { data: maintenanceRecordsData, isLoading: recordsLoading } = useQuery({
    queryKey: ['/api/maintenance-records'],
    queryFn: () => apiRequest('/api/maintenance-records')
  });

  // Ensure maintenanceRecords is always an array
  const maintenanceRecords = Array.isArray(maintenanceRecordsData) ? maintenanceRecordsData : [];

  // Fetch asset instances for dropdown
  const { data: assetInstancesData } = useQuery({
    queryKey: ['/api/asset-inventory/instances'],
    queryFn: () => apiRequest('/api/asset-inventory/instances')
  });

  // Ensure assetInstances is always an array
  const assetInstances = Array.isArray(assetInstancesData) ? assetInstancesData : [];

  // Filter records based on search and status
  const filteredRecords = maintenanceRecords?.filter((record: MaintenanceRecord) => {
    const matchesSearch = !searchTerm || 
      record.assetInstance?.assetTag.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.assetInstance?.assetType.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;

    return matchesSearch && matchesStatus;
  }) || [];

  // Get upcoming maintenance (records scheduled for next 30 days)
  const upcomingMaintenance = maintenanceRecords?.filter((record: MaintenanceRecord) => {
    if (!record.nextMaintenanceDate) return false;
    const nextDate = new Date(record.nextMaintenanceDate);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return nextDate <= thirtyDaysFromNow && nextDate >= new Date();
  }) || [];

  const handleRecordCreated = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/maintenance-records'] });
    setIsRecorderOpen(false);
    setSelectedAsset(null);
    toast({
      title: "Success",
      description: "Maintenance record created successfully",
    });
  };

  if (recordsLoading) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-96 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{maintenanceRecords?.filter((r: MaintenanceRecord) => r.status === 'completed').length || 0}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{maintenanceRecords?.filter((r: MaintenanceRecord) => r.status === 'in_progress').length || 0}</p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-8 w-8 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">{maintenanceRecords?.filter((r: MaintenanceRecord) => r.status === 'scheduled').length || 0}</p>
                <p className="text-sm text-muted-foreground">Scheduled</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-2xl font-bold">{upcomingMaintenance.length}</p>
                <p className="text-sm text-muted-foreground">Due Soon</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by asset tag, type, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Dialog open={isRecorderOpen} onOpenChange={setIsRecorderOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Record Maintenance
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Record New Maintenance</DialogTitle>
            </DialogHeader>
            <MaintenanceRecorder
              assetInstance={selectedAsset}
              onRecordSaved={handleRecordCreated}
              assetInstances={assetInstances}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="records" className="space-y-4">
        <TabsList>
          <TabsTrigger value="records">All Records</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming Maintenance</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Records</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No maintenance records found</p>
                  <p className="text-sm">Create your first maintenance record to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRecords.map((record: MaintenanceRecord) => {
                    const StatusIcon = statusIcons[record.status];
                    return (
                      <div key={record.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <StatusIcon className="h-5 w-5" />
                              <h3 className="font-semibold">{record.assetInstance?.assetTag}</h3>
                              <Badge variant="outline">{record.assetInstance?.assetType.name}</Badge>
                              <Badge className={statusColors[record.status]}>{record.status.replace('_', ' ')}</Badge>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <p><strong>Type:</strong> {record.maintenanceType}</p>
                                <p><strong>Performed by:</strong> {record.performedBy}</p>
                                <p><strong>Date:</strong> {format(new Date(record.completedDate), 'MMM dd, yyyy')}</p>
                                {record.cost && <p><strong>Cost:</strong> ${record.cost}</p>}
                              </div>
                              <div>
                                <p><strong>Description:</strong> {record.description}</p>
                                {record.nextMaintenanceDate && (
                                  <p><strong>Next Due:</strong> {format(new Date(record.nextMaintenanceDate), 'MMM dd, yyyy')}</p>
                                )}
                                {record.files && record.files.length > 0 && (
                                  <p><strong>Files:</strong> {record.files.length} attached</p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Maintenance</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingMaintenance.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No upcoming maintenance scheduled</p>
                  <p className="text-sm">All maintenance is up to date</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingMaintenance.map((record: MaintenanceRecord) => (
                    <div key={record.id} className="border rounded-lg p-4 bg-yellow-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{record.assetInstance?.assetTag}</h3>
                          <p className="text-sm text-muted-foreground">{record.assetInstance?.assetType.name}</p>
                          <p className="text-sm">Due: {format(new Date(record.nextMaintenanceDate!), 'MMM dd, yyyy')}</p>
                        </div>
                        <Button size="sm" onClick={() => {
                          setSelectedAsset(record.assetInstance as AssetInstance);
                          setIsRecorderOpen(true);
                        }}>
                          Record Now
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p>Analytics dashboard coming soon</p>
                <p className="text-sm">Track maintenance costs, frequency, and trends</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// MaintenanceRecorder component for creating new records
function MaintenanceRecorder({ 
  assetInstance, 
  onRecordSaved, 
  assetInstances 
}: { 
  assetInstance: AssetInstance | null; 
  onRecordSaved: () => void;
  assetInstances: AssetInstance[];
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    assetInstanceId: assetInstance?.id || '',
    maintenanceType: '',
    description: '',
    performedBy: user?.username || '',
    completedDate: new Date().toISOString().split('T')[0],
    nextMaintenanceDate: '',
    cost: '',
    status: 'completed' as const
  });
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const recordMaintenance = useMutation({
    mutationFn: async (data: any) => {
      const formDataToSend = new FormData();
      Object.keys(data).forEach(key => {
        if (data[key] !== '') {
          formDataToSend.append(key, data[key]);
        }
      });

      if (selectedFiles) {
        Array.from(selectedFiles).forEach(file => {
          formDataToSend.append('files', file);
        });
      }

      return apiRequest('/api/asset-maintenance-records', {
        method: 'POST',
        body: formDataToSend
      });
    },
    onSuccess: () => {
      onRecordSaved();
      toast({
        title: "Success",
        description: "Maintenance record created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create maintenance record",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.assetInstanceId || !formData.maintenanceType || !formData.description) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await recordMaintenance.mutateAsync(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="assetInstanceId">Asset *</Label>
          <Select value={formData.assetInstanceId.toString()} onValueChange={(value) => setFormData({...formData, assetInstanceId: parseInt(value)})}>
            <SelectTrigger>
              <SelectValue placeholder="Select asset" />
            </SelectTrigger>
            
            <SelectContent>
                {(assetInstances || []).map((asset: AssetInstance) => (
                  <SelectItem key={asset.id} value={asset.id.toString()}>
                    {asset.assetTag} - {asset.assetType?.name || 'Unknown Type'}
                  </SelectItem>
                ))}
              </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="maintenanceType">Maintenance Type *</Label>
          <Select value={formData.maintenanceType} onValueChange={(value) => setFormData({...formData, maintenanceType: value})}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {maintenanceTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="completedDate">Completed Date *</Label>
          <Input
            id="completedDate"
            type="date"
            value={formData.completedDate}
            onChange={(e) => setFormData({...formData, completedDate: e.target.value})}
            required
          />
        </div>

        <div>
          <Label htmlFor="nextMaintenanceDate">Next Maintenance Date</Label>
          <Input
            id="nextMaintenanceDate"
            type="date"
            value={formData.nextMaintenanceDate}
            onChange={(e) => setFormData({...formData, nextMaintenanceDate: e.target.value})}
          />
        </div>

        <div>
          <Label htmlFor="performedBy">Performed By *</Label>
          <Input
            id="performedBy"
            value={formData.performedBy}
            onChange={(e) => setFormData({...formData, performedBy: e.target.value})}
            required
          />
        </div>

        <div>
          <Label htmlFor="cost">Cost ($)</Label>
          <Input
            id="cost"
            type="number"
            step="0.01"
            value={formData.cost}
            onChange={(e) => setFormData({...formData, cost: e.target.value})}
            placeholder="0.00"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          placeholder="Describe the maintenance work performed..."
          required
        />
      </div>

      <div>
        <Label htmlFor="status">Status</Label>
        <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value as any})}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="files">Attach Files</Label>
        <Input
          id="files"
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
          onChange={(e) => setSelectedFiles(e.target.files)}
        />
        <p className="text-sm text-muted-foreground mt-1">
          Upload photos, reports, or other maintenance documentation
        </p>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center space-x-2"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Saving...</span>
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" />
              <span>Record Maintenance</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}