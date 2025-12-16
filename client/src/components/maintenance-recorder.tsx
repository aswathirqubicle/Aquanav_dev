import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { FileText, Upload, Calendar, Wrench, AlertCircle, CheckCircle, Clock } from "lucide-react";

interface MaintenanceRecord {
  id: number;
  assetInstanceId: number;
  maintenanceType: string;
  description: string;
  performedBy: string;
  startDate: string;
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
}

interface MaintenanceRecorderProps {
  assetInstance: {
    id: number;
    assetTag: string;
    assetType: string;
    status: string;
    location?: string;
  };
  onRecordSaved: () => void;
}

export function MaintenanceRecorder({ assetInstance, onRecordSaved }: MaintenanceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [formData, setFormData] = useState({
    maintenanceType: '',
    description: '',
    performedBy: '',
    startDate: '',
    completedDate: new Date().toISOString().split('T')[0],
    nextMaintenanceDate: '',
    cost: '',
    status: 'completed' as const
  });
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentRecords, setRecentRecords] = useState<MaintenanceRecord[]>([
    {
      id: 1,
      assetInstanceId: assetInstance.id,
      maintenanceType: 'Preventive Maintenance',
      description: 'Monthly inspection and lubrication of hydraulic systems',
      performedBy: 'John Smith',
      completedDate: '2025-01-10',
      nextMaintenanceDate: '2025-02-10',
      cost: 150,
      status: 'completed'
    },
    {
      id: 2,
      assetInstanceId: assetInstance.id,
      maintenanceType: 'Corrective Maintenance',
      description: 'Replaced worn brake pads and adjusted brake system',
      performedBy: 'Mike Johnson',
      completedDate: '2025-01-05',
      cost: 85,
      status: 'completed'
    }
  ]);
  
  const { toast } = useToast();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(event.target.files);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.maintenanceType || !formData.description || !formData.performedBy) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create form data for file upload
      const submitData = new FormData();
      submitData.append('assetInstanceId', assetInstance.id.toString());
      submitData.append('maintenanceType', formData.maintenanceType);
      submitData.append('description', formData.description);
      submitData.append('performedBy', formData.performedBy);
      submitData.append('startDate', formData.startDate);
      submitData.append('completedDate', formData.completedDate);
      submitData.append('nextMaintenanceDate', formData.nextMaintenanceDate);
      submitData.append('cost', formData.cost);
      submitData.append('status', formData.status);

      // Add files if any
      if (selectedFiles) {
        for (let i = 0; i < selectedFiles.length; i++) {
          submitData.append('files', selectedFiles[i]);
        }
      }

      const response = await fetch('/api/maintenance-records', {
        method: 'POST',
        body: submitData,
      });

      if (response.ok) {
        const newRecord = await response.json();
        
        // Add to recent records
        setRecentRecords(prev => [newRecord, ...prev]);
        
        // Reset form
        setFormData({
          maintenanceType: '',
          description: '',
          performedBy: '',
          startDate: '',
          completedDate: new Date().toISOString().split('T')[0],
          nextMaintenanceDate: '',
          cost: '',
          status: 'completed'
        });
        setSelectedFiles(null);
        setIsRecording(false);
        
        toast({
          title: "Success",
          description: "Maintenance record saved successfully",
        });
        
        onRecordSaved();
      } else {
        throw new Error('Failed to save maintenance record');
      }
    } catch (error) {
      console.error('Error saving maintenance record:', error);
      toast({
        title: "Error",
        description: "Failed to save maintenance record. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'scheduled':
        return <Calendar className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>;
      case 'in_progress':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">In Progress</Badge>;
      case 'scheduled':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Scheduled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Asset Info Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wrench className="h-5 w-5" />
            <span>Maintenance Records - {assetInstance.assetTag}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <Label>Asset Type</Label>
              <p className="font-medium">{assetInstance.assetType}</p>
            </div>
            <div>
              <Label>Status</Label>
              <p className="font-medium">{assetInstance.status}</p>
            </div>
            <div>
              <Label>Location</Label>
              <p className="font-medium">{assetInstance.location || 'N/A'}</p>
            </div>
            <div>
              <Label>Total Records</Label>
              <p className="font-medium">{recentRecords.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Record New Maintenance */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Record Maintenance</CardTitle>
            {!isRecording && (
              <Button onClick={() => setIsRecording(true)}>
                <Wrench className="h-4 w-4 mr-2" />
                New Record
              </Button>
            )}
          </div>
        </CardHeader>
        
        {isRecording && (
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="maintenanceType">Maintenance Type *</Label>
                  <Select value={formData.maintenanceType} onValueChange={(value) => handleInputChange('maintenanceType', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select maintenance type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="preventive">Preventive Maintenance</SelectItem>
                      <SelectItem value="corrective">Corrective Maintenance</SelectItem>
                      <SelectItem value="predictive">Predictive Maintenance</SelectItem>
                      <SelectItem value="emergency">Emergency Repair</SelectItem>
                      <SelectItem value="inspection">Inspection</SelectItem>
                      <SelectItem value="calibration">Calibration</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="performedBy">Performed By *</Label>
                  <Input
                    id="performedBy"
                    value={formData.performedBy}
                    onChange={(e) => handleInputChange('performedBy', e.target.value)}
                    placeholder="Technician name"
                  />
                </div>

                <div>
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => handleInputChange('startDate', e.target.value)}
                  />
                </div>
                
                <div>
                  <Label htmlFor="completedDate">Completed Date *</Label>
                  <Input
                    id="completedDate"
                    type="date"
                    value={formData.completedDate}
                    onChange={(e) => handleInputChange('completedDate', e.target.value)}
                  />
                </div>
                
                <div>
                  <Label htmlFor="nextMaintenanceDate">Next Maintenance Date</Label>
                  <Input
                    id="nextMaintenanceDate"
                    type="date"
                    value={formData.nextMaintenanceDate}
                    onChange={(e) => handleInputChange('nextMaintenanceDate', e.target.value)}
                  />
                </div>
                
                <div>
                  <Label htmlFor="cost">Cost (AED)</Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    value={formData.cost}
                    onChange={(e) => handleInputChange('cost', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
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
              </div>
              
              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Describe the maintenance work performed..."
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="files">Attach Files</Label>
                <Input
                  id="files"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                />
                {selectedFiles && (
                  <div className="mt-2 text-sm text-gray-600">
                    {selectedFiles.length} file(s) selected
                  </div>
                )}
              </div>
              
              <div className="flex space-x-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Record'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsRecording(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      {/* Recent Records */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Maintenance Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentRecords.map((record) => (
              <div key={record.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      {getStatusIcon(record.status)}
                      <h4 className="font-semibold">{record.maintenanceType}</h4>
                      {getStatusBadge(record.status)}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{record.description}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-500">
                      <div>
                        <span className="font-medium">Performed by:</span> {record.performedBy}
                      </div>
                      <div>
                        <span className="font-medium">Date:</span> {record.completedDate}
                      </div>
                      {record.cost && (
                        <div>
                          <span className="font-medium">Cost:</span> AED {record.cost}
                        </div>
                      )}
                      {record.nextMaintenanceDate && (
                        <div>
                          <span className="font-medium">Next:</span> {record.nextMaintenanceDate}
                        </div>
                      )}
                    </div>
                  </div>
                  {record.files && record.files.length > 0 && (
                    <div className="flex items-center space-x-1 text-sm text-gray-500">
                      <FileText className="h-4 w-4" />
                      <span>{record.files.length} file(s)</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {recentRecords.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Wrench className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No maintenance records yet</p>
                <p className="text-sm">Click "New Record" to add the first maintenance entry</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}