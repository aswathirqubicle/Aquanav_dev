import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card, CardContent, CardHeader, CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import {
  FileText, Calendar, CheckCircle, Clock, Plus
} from "lucide-react";
import { format } from "date-fns";

/* ================= SAFE DATE ================= */
const safeFormatDate = (date?: string | null) => {
  if (!date) return '—';
  const d = new Date(date);
  return isNaN(d.getTime()) ? '—' : format(d, 'MMM dd, yyyy');
};

/* ================= TYPES ================= */
interface MaintenanceRecord {
  id: number;
  maintenanceType: string;
  description: string;
  performedBy: string;
  startDate: string;
  completedDate?: string;
  nextMaintenanceDate?: string;
  cost?: number;
  status?: 'completed' | 'in_progress' | 'scheduled';
  assetInstance?: {
    assetTag: string;
    assetType?: { name: string };
  };
}

interface AssetInstance {
  id: number;
  assetTag: string;
  assetType?: { name: string };
}

/* ================= CONSTANTS ================= */
const maintenanceTypes = [
  { value: 'preventive', label: 'Preventive Maintenance' },
  { value: 'corrective', label: 'Corrective Maintenance' },
  { value: 'inspection', label: 'Inspection' }
];

const statusColors: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  in_progress: 'bg-blue-100 text-blue-800',
  scheduled: 'bg-yellow-100 text-yellow-800'
};

const statusIcons: any = {
  completed: CheckCircle,
  in_progress: Clock,
  scheduled: Calendar
};

/* ================================================= */
/* ================= MAIN ========================== */
/* ================================================= */

export function MaintenanceManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRecorderOpen, setIsRecorderOpen] = useState(false);

  const { data: records = [] } = useQuery({
    queryKey: ['/api/maintenance-records'],
    queryFn: async () => (await apiRequest('/api/maintenance-records')).json()
  });

  const { data: assetInstances = [] } = useQuery({
    queryKey: ['/api/asset-inventory/instances'],
    queryFn: async () => (await apiRequest('/api/asset-inventory/instances')).json()
  });

  const handleCreated = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/maintenance-records'] });
    setIsRecorderOpen(false);
    toast({ title: "Success", description: "Maintenance record created" });
  };

  return (
    <div className="space-y-6">
      <Dialog open={isRecorderOpen} onOpenChange={setIsRecorderOpen}>
        <DialogTrigger asChild>
          <Button><Plus className="mr-2 h-4 w-4" /> Record Maintenance</Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Record Maintenance</DialogTitle>
          </DialogHeader>
          <MaintenanceRecorder
            assetInstances={assetInstances}
            onRecordSaved={handleCreated}
          />
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader><CardTitle>Maintenance Records</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {(records as MaintenanceRecord[]).map(record => {
            const Icon = statusIcons[record.status || 'completed'];
            return (
              <div key={record.id} className="border rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <strong>{record.assetInstance?.assetTag}</strong>
                  <Badge variant="outline">
                    {record.assetInstance?.assetType?.name}
                  </Badge>
                  {record.status && (
                    <Badge className={statusColors[record.status]}>
                      {record.status.replace('_', ' ')}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm mt-2">
                  <div>
                    <p><b>Type:</b> {record.maintenanceType}</p>
                    <p><b>Performed By:</b> {record.performedByName}</p>
                    <p><b>Start Date:</b> {safeFormatDate(record.startDate)}</p>
                    <p><b>Completed Date:</b> {safeFormatDate(record.completedDate)}</p>
                  </div>
                  <div>
                    <p><b>Description:</b> {record.description}</p>
                    <p><b>Next Maintenance Date:</b> {safeFormatDate(record.maintenanceDate)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

/* ================================================= */
/* ================= FORM ========================== */
/* ================================================= */

function MaintenanceRecorder({
  assetInstances,
  onRecordSaved
}: {
  assetInstances: AssetInstance[];
  onRecordSaved: () => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

  const [formData, setFormData] = useState({
    assetInstanceId: '',
    maintenanceType: '',
    description: '',
    performedBy: user?.username || '',
    startDate: '',
    completedDate: new Date().toISOString().split('T')[0],
    nextMaintenanceDate: '',
    cost: '',
    status: 'completed'
  });

  const mutation = useMutation({
  mutationFn: async () => {
    /* ---------------- 1. CREATE RECORD ---------------- */
    const createRes = await apiRequest('/api/maintenance-records', {
      method: 'POST',
      body: JSON.stringify({
        assetId: Number(formData.assetInstanceId),
        maintenanceCost: formData.cost || '0',
        description: formData.description,
        startDate: formData.startDate,
        completedDate: formData.completedDate,
        maintenanceType: formData.maintenanceType,
        maintenanceDate: formData.completedDate,
      }),
    });

    console.log("formData",formData);

    const createdRecord = await createRes.json();
    const maintenanceId = createdRecord.id;

    if (!maintenanceId) {
      throw new Error('Maintenance ID not returned');
    }

    /* ---------------- 2. UPLOAD FILES (IF ANY) ---------------- */
    if (selectedFiles && selectedFiles.length > 0) {
      const fileForm = new FormData();

      Array.from(selectedFiles).forEach((file) => {
        fileForm.append('file', file); // MUST be "files"
      });

      await apiRequest(`/api/maintenance-records/${maintenanceId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'multipart/form-data' },
        body: fileForm,
      });
    }

    return createdRecord;
  },

  onSuccess: () => {
    onRecordSaved();
    toast({
      title: 'Success',
      description: 'Maintenance record created successfully',
    });
  },

  onError: (error: any) => {
    toast({
      title: 'Error',
      description: error.message || 'Failed to create maintenance record',
      variant: 'destructive',
    });
  },
});


  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!formData.assetInstanceId || !formData.maintenanceType) {
    toast({
      title: 'Error',
      description: 'Please fill required fields',
      variant: 'destructive',
    });
    return;
  }

  setIsSubmitting(true);
  try {
    await mutation.mutateAsync();
  } finally {
    setIsSubmitting(false);
  }
};


  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Asset */}
      <div>
        <Label>Asset *</Label>
        <Select
          value={formData.assetInstanceId}
          onValueChange={(v) => setFormData({ ...formData, assetInstanceId: v })}
        >
          <SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger>
          <SelectContent>
            {assetInstances.map(a => (
              <SelectItem key={a.id} value={String(a.id)}>
                {a.assetTag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Type */}
      <div>
        <Label>Maintenance Type *</Label>
        <Select
          value={formData.maintenanceType}
          onValueChange={(v) => setFormData({ ...formData, maintenanceType: v })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {maintenanceTypes.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Start Date</Label>
          <Input
            type="date"
            value={formData.startDate}
            onChange={e => setFormData({ ...formData, startDate: e.target.value })}
          />
        </div>
        <div>
          <Label>Completed Date</Label>
          <Input
            type="date"
            value={formData.completedDate}
            onChange={e => setFormData({ ...formData, completedDate: e.target.value })}
          />
        </div>
        <div>
          <Label>Next Maintenance</Label>
          <Input
            type="date"
            value={formData.nextMaintenanceDate}
            onChange={e => setFormData({ ...formData, nextMaintenanceDate: e.target.value })}
          />
        </div>
        {/* Cost */}
      <div>
        <Label>Cost</Label>
        <Input
          type="number"
          value={formData.cost}
          onChange={e => setFormData({ ...formData, cost: e.target.value })}
        />
      </div>
      </div>
      

      {/* Description */}
      <div>
        <Label>Description</Label>
        <Textarea
          value={formData.description}
          onChange={e => setFormData({ ...formData, description: e.target.value })}
        />
      </div>

      {/* Files */}
      <div>
        <Label>Attachments</Label>
        <Input type="file" multiple onChange={e => setSelectedFiles(e.target.files)} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        <FileText className="mr-2 h-4 w-4" />
        {isSubmitting ? 'Saving...' : 'Record Maintenance'}
      </Button>
    </form>
  );
}
