import React, { useState, useEffect, startTransition } from 'react';
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
  FileText, Calendar, CheckCircle, Clock, Plus, Archive, ArchiveRestore
} from "lucide-react";
import { format } from "date-fns";

/* ================= SAFE DATE ================= */
const safeFormatDate = (date?: string | null) => {
  if (!date) return '—';
  const d = new Date(date);
  return isNaN(d.getTime()) ? '—' : format(d, 'MMM dd, yyyy');
};

const toDateInputValue = (date?: string | null) => {
  if (!date) return '';
  const d = new Date(date);
  return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
};

/* ================= TYPES ================= */
interface MaintenanceRecord {
  id: number;
  instanceId: number;
  maintenanceType: string;
  description: string;
  performedByName?: string;
  startDate?: string;
  completedDate?: string;
  maintenanceDate?: string; // 👈 next maintenance date
  maintenanceCost?: string;
  isArchived: boolean;
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
  const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecord | null>(null);

  const { data: records = [] } = useQuery({
    queryKey: ['/api/maintenance-records'],
    queryFn: async () => (await apiRequest('/api/maintenance-records')).json()
  });

  const { data: assetInstances = [] } = useQuery({
    queryKey: ['/api/asset-inventory/instances'],
    queryFn: async () => (await apiRequest('/api/asset-inventory/instances')).json()
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/maintenance-records'] });
    setSelectedRecord(null);
    setIsRecorderOpen(false);
    toast({ title: "Success", description: "Maintenance record saved" });
  };  

  const archiveMaintenanceRecordMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/maintenance-record/${id}/archive`, {
        method: "PUT",
        body: JSON.stringify({}),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-records"] });
      toast({
        title: "Maintenance Record Archived",
        description: "The Maintenance Record has been archived successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to archive Maintenance Record",
        variant: "destructive",
      });
    },
  });
  
  const unarchiveMaintenanceRecordMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/maintenance-record/${id}/unarchive`, {
        method: "PUT",
        body: JSON.stringify({}),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-records"] });
      toast({
        title: "Maintenance Record Unarchived",
        description: "The Maintenance Record has been unarchived successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unarchive Maintenance Record",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <Dialog open={isRecorderOpen} onOpenChange={setIsRecorderOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Record Maintenance
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedRecord ? "Edit Maintenance" : "Record Maintenance"}
            </DialogTitle>
          </DialogHeader>

          <MaintenanceRecorder
            record={selectedRecord}
            assetInstances={assetInstances}
            onRecordSaved={refresh}
          />
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Maintenance Records</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {(records as MaintenanceRecord[]).map(record => {
            const Icon = statusIcons.completed;
            return (
              <div key={record.id} className="border rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <strong>{record.assetInstance?.assetTag}</strong>
                  <Badge variant="outline">
                    {record.assetInstance?.assetType?.name}
                  </Badge>
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
                    <p><b>Next Maintenance:</b> {safeFormatDate(record.maintenanceDate)}</p>
                  </div>
                </div>
                <div className="mt-4 md:mt-6 flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-2">
                    
                <Button
                  variant="outline"
                  size="sm"
                    className="w-full sm:w-auto"
                  onClick={() => {
                    setSelectedRecord(record);
                    setIsRecorderOpen(true);
                  }}
                >
                  Edit Maintenance
                </Button>
                {record.isArchived ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => startTransition(() => unarchiveMaintenanceRecordMutation.mutate(record.id))}
                    disabled={unarchiveMaintenanceRecordMutation.isPending}
                  >
                    <ArchiveRestore className="h-4 w-4 mr-2" />
                    {unarchiveMaintenanceRecordMutation.isPending ? "Unarchiving..." : "Unarchive"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => startTransition(() => archiveMaintenanceRecordMutation.mutate(record.id))}
                    disabled={archiveMaintenanceRecordMutation.isPending}
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    {archiveMaintenanceRecordMutation.isPending ? "Archiving..." : "Archive"}
                  </Button>
                )}
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
  record,
  assetInstances,
  onRecordSaved
}: {
  record: MaintenanceRecord | null;
  assetInstances: AssetInstance[];
  onRecordSaved: () => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

  const { data: existingFiles = [] } = useQuery<MaintenanceFile[]>({
    queryKey: ['/api/maintenance-records', record?.id, 'files'],
    enabled: !!record?.id, // 👈 only fetch on edit
    queryFn: async () =>
      (await apiRequest(`/api/maintenance-records/${record!.id}/files`)).json(),
  });


  const [formData, setFormData] = useState({
    assetInstanceId: '',
    maintenanceType: '',
    description: '',
    startDate: '',
    completedDate: '',
    maintenanceDate: '',
    maintenanceCost: ''
  });

  /* -------- PREFILL FOR EDIT -------- */
  useEffect(() => {
    if (record) {
      setFormData({
        assetInstanceId: String(record.instanceId),
        maintenanceType: record.maintenanceType || '',
        description: record.description || '',        
        startDate: toDateInputValue(record.startDate),
        completedDate: toDateInputValue(record.completedDate),
        maintenanceDate: toDateInputValue(record.maintenanceDate),
        maintenanceCost: record.maintenanceCost || ''
      });
    }
  }, [record]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        assetId: Number(formData.assetInstanceId),
        maintenanceType: formData.maintenanceType,
        description: formData.description,
        startDate: formData.startDate || null,
        completedDate: formData.completedDate || null,
        maintenanceDate: formData.maintenanceDate || null,
        maintenanceCost: formData.maintenanceCost || "0",
      };

      // ---------- CREATE or UPDATE ----------
      const res = record?.id
        ? await apiRequest(`/api/maintenance-records/${record.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await apiRequest("/api/maintenance-records", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      const saved = await res.json();
      const maintenanceId = saved.id;

      if (!maintenanceId) {
        throw new Error("Maintenance ID not returned");
      }

      // ---------- FILE UPLOAD ----------
      if (selectedFiles?.length) {
        const fd = new FormData();
        Array.from(selectedFiles).forEach((f) => fd.append("file", f));

        await apiRequest(`/api/maintenance-records/${maintenanceId}/files`, {
          method: "POST",
          body: fd, // ❗ DO NOT set headers
        });
      }

      return saved; // ✅ IMPORTANT
    },

    onSuccess: () => {
      onRecordSaved();
    },

    onError: (e: any) =>
      toast({
        title: "Error",
        description: e?.message || "Operation failed",
        variant: "destructive",
      }),
  });


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          onValueChange={v => setFormData({ ...formData, assetInstanceId: v })}
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
          onValueChange={v => setFormData({ ...formData, maintenanceType: v })}
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
          <Input type="date" value={formData.startDate}
            onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
        </div>

        <div>
          <Label>Completed Date</Label>
          <Input type="date" value={formData.completedDate}
            onChange={e => setFormData({ ...formData, completedDate: e.target.value })} />
        </div>

        <div>
          <Label>Next Maintenance</Label>
          <Input type="date" value={formData.maintenanceDate}
            onChange={e => setFormData({ ...formData, maintenanceDate: e.target.value })} />
        </div>

        <div>
          <Label>Cost</Label>
          <Input type="number" value={formData.maintenanceCost}
            onChange={e => setFormData({ ...formData, maintenanceCost: e.target.value })} />
        </div>
      </div>

      {/* Description */}
      <div>
        <Label>Description</Label>
        <Textarea value={formData.description}
          onChange={e => setFormData({ ...formData, description: e.target.value })} />
      </div>

      {/* Files */}
        {/* Existing Files (Edit mode only) */}
        {existingFiles.map((file: any) => {
          const viewUrl = `${file.filePath}`;
          const downloadUrl = `${file.filePath}`;

          return (
            <div
              key={file.id}
              className="flex items-center justify-between text-sm"
            >
              <span className="truncate max-w-[60%]">
                {file.originalName}
              </span>

              <div className="flex gap-2">
                {/* VIEW */}
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View
                  </a>
                </Button>

                {/* DOWNLOAD */}
                {/* <Button variant="outline" size="sm" asChild>
                  <a href={downloadUrl}>
                    Download
                  </a>
                </Button> */}
              </div>
            </div>
          );
        })}


        <div>
          <Label>Attachments</Label>
          <Input type="file" multiple onChange={e => setSelectedFiles(e.target.files)} />
        </div>
      

      <Button type="submit" disabled={isSubmitting}>
        <FileText className="mr-2 h-4 w-4" />
        {isSubmitting ? 'Saving...' : 'Save Maintenance'}
      </Button>
    </form>
  );
}

