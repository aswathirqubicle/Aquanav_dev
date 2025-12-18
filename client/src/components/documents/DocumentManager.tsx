import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Edit, Trash2, Download, Upload } from "lucide-react";
import { format } from "date-fns";

interface Document {
  id: number;
  documentType: string;
  documentName: string;
  documentNumber?: string;
  issuingAuthority?: string;
  dateOfIssue?: string;
  expiryDate?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  status: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface DocumentManagerProps {
  entityId: number;
  entityType: 'customer' | 'supplier';
  title: string;
}

const DOCUMENT_TYPES = {
  customer: [
    { value: "trade_license", label: "Trade License" },
    { value: "tax_registration", label: "Tax Registration" },
    { value: "vat_certificate", label: "VAT Certificate" },
    { value: "commercial_license", label: "Commercial License" },
    { value: "establishment_card", label: "Establishment Card" },
    { value: "chamber_membership", label: "Chamber Membership" },
    { value: "iso_certificate", label: "ISO Certificate" },
    { value: "insurance_certificate", label: "Insurance Certificate" },
    { value: "bank_guarantee", label: "Bank Guarantee" },
    { value: "other", label: "Other" },
  ],
  supplier: [
    { value: "trade_license", label: "Trade License" },
    { value: "tax_registration", label: "Tax Registration" },
    { value: "vat_certificate", label: "VAT Certificate" },
    { value: "commercial_license", label: "Commercial License" },
    { value: "establishment_card", label: "Establishment Card" },
    { value: "chamber_membership", label: "Chamber Membership" },
    { value: "iso_certificate", label: "ISO Certificate" },
    { value: "insurance_certificate", label: "Insurance Certificate" },
    { value: "bank_guarantee", label: "Bank Guarantee" },
    { value: "supplier_agreement", label: "Supplier Agreement" },
    { value: "quality_certificate", label: "Quality Certificate" },
    { value: "other", label: "Other" },
  ],
};

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "pending_renewal", label: "Pending Renewal" },
  { value: "cancelled", label: "Cancelled" },
];

export function DocumentManager({ entityId, entityType, title }: DocumentManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentData, setDocumentData] = useState({
    documentType: "",
    documentName: "",
    documentNumber: "",
    issuingAuthority: "",
    dateOfIssue: "",
    expiryDate: "",
    status: "active",
    notes: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: [`/api/${entityType}s/${entityId}/documents`],
  });

  const createDocumentMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(`/api/${entityType}s/${entityId}/documents`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to create document");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${entityType}s/${entityId}/documents`] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Document added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add document", variant: "destructive" });
    },
  });

  const updateDocumentMutation = useMutation({
    mutationFn: async ({ documentId, formData }: { documentId: number; formData: FormData }) => {
      const response = await fetch(`/api/${entityType}s/${entityId}/documents/${documentId}`, {
        method: "PUT",
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to update document");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${entityType}s/${entityId}/documents`] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Document updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update document", variant: "destructive" });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: number) => {
      const response = await fetch(`/api/${entityType}s/${entityId}/documents/${documentId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete document");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${entityType}s/${entityId}/documents`] });
      toast({ title: "Document deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete document", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setDocumentData({
      documentType: "",
      documentName: "",
      documentNumber: "",
      issuingAuthority: "",
      dateOfIssue: "",
      expiryDate: "",
      status: "active",
      notes: "",
    });
    setSelectedFile(null);
    setEditingDocument(null);
  };

  const handleSubmit = () => {
    if (!documentData.documentType || !documentData.documentName) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }

    const formData = new FormData();
    Object.entries(documentData).forEach(([key, value]) => {
      if (value) formData.append(key, value);
    });

    if (selectedFile) {
      formData.append("file", selectedFile);
    }

    if (editingDocument) {
      updateDocumentMutation.mutate({ documentId: editingDocument.id, formData });
    } else {
      createDocumentMutation.mutate(formData);
    }
  };

  const handleEdit = (document: Document) => {
    setEditingDocument(document);
    setDocumentData({
      documentType: document.documentType,
      documentName: document.documentName,
      documentNumber: document.documentNumber || "",
      issuingAuthority: document.issuingAuthority || "",
      dateOfIssue: document.dateOfIssue ? format(new Date(document.dateOfIssue), "yyyy-MM-dd") : "",
      expiryDate: document.expiryDate ? format(new Date(document.expiryDate), "yyyy-MM-dd") : "",
      status: document.status,
      notes: document.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (documentId: number) => {
    if (confirm("Are you sure you want to delete this document?")) {
      deleteDocumentMutation.mutate(documentId);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800";
      case "expired": return "bg-red-100 text-red-800";
      case "pending_renewal": return "bg-yellow-100 text-yellow-800";
      case "cancelled": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "N/A";
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + " " + sizes[i];
  };

  const isExpiringSoon = (expiryDate?: string) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return expiry <= thirtyDaysFromNow && expiry >= new Date();
  };

  if (isLoading) {
    return <div>Loading documents...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Document
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingDocument ? "Edit Document" : "Add New Document"}
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="documentType">Document Type *</Label>
                <Select
                  value={documentData.documentType}
                  onValueChange={(value) => setDocumentData(prev => ({ ...prev, documentType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES[entityType].map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="documentName">Document Name *</Label>
                <Input
                  id="documentName"
                  value={documentData.documentName}
                  onChange={(e) => setDocumentData(prev => ({ ...prev, documentName: e.target.value }))}
                  placeholder="Enter document name"
                />
              </div>

              <div>
                <Label htmlFor="documentNumber">Document Number</Label>
                <Input
                  id="documentNumber"
                  value={documentData.documentNumber}
                  onChange={(e) => setDocumentData(prev => ({ ...prev, documentNumber: e.target.value }))}
                  placeholder="Enter document number"
                />
              </div>

              <div>
                <Label htmlFor="issuingAuthority">Issuing Authority</Label>
                <Input
                  id="issuingAuthority"
                  value={documentData.issuingAuthority}
                  onChange={(e) => setDocumentData(prev => ({ ...prev, issuingAuthority: e.target.value }))}
                  placeholder="Enter issuing authority"
                />
              </div>

              <div>
                <Label htmlFor="dateOfIssue">Date of Issue</Label>
                <Input
                  id="dateOfIssue"
                  type="date"
                  value={documentData.dateOfIssue}
                  onChange={(e) => setDocumentData(prev => ({ ...prev, dateOfIssue: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={documentData.expiryDate}
                  onChange={(e) => setDocumentData(prev => ({ ...prev, expiryDate: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={documentData.status}
                  onValueChange={(value) => setDocumentData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="file">Upload File</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={documentData.notes}
                  onChange={(e) => setDocumentData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Enter any additional notes"
                />
              </div>

              <div className="col-span-2 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createDocumentMutation.isPending || updateDocumentMutation.isPending}
                >
                  {createDocumentMutation.isPending || updateDocumentMutation.isPending
                    ? (editingDocument ? "Updating..." : "Adding...")
                    : (editingDocument ? "Update Document" : "Add Document")
                  }
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {documents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No documents uploaded yet.</p>
            <p>Click "Add Document" to upload compliance documents.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Number</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((document: Document) => (
                <TableRow key={document.id}>
                  <TableCell className="font-medium">{document.documentName}</TableCell>
                  <TableCell>
                    {DOCUMENT_TYPES[entityType].find(t => t.value === document.documentType)?.label || document.documentType}
                  </TableCell>
                  <TableCell>{document.documentNumber || "N/A"}</TableCell>
                  <TableCell>
                    {document.dateOfIssue ? format(new Date(document.dateOfIssue), "dd/MM/yyyy") : "N/A"}
                  </TableCell>
                  <TableCell>
                    {document.expiryDate ? (
                      <span className={isExpiringSoon(document.expiryDate) ? "text-orange-600 font-medium" : ""}>
                        {format(new Date(document.expiryDate), "dd/MM/yyyy")}
                        {isExpiringSoon(document.expiryDate) && " ⚠️"}
                      </span>
                    ) : "N/A"}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(document.status)}>
                      {STATUS_OPTIONS.find(s => s.value === document.status)?.label || document.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {document.fileName ? (
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <div className="text-sm">
                          {/* <div>{document.fileName}</div>
                          <div className="text-gray-500">{formatFileSize(document.fileSize)}</div> */}
                          <a
                            href={`/${document.filePath}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline"
                          >
                            <div>{document.fileName}</div>
                            <div className="text-gray-500">
                              {formatFileSize(document.fileSize)}
                            </div>
                          </a>
                        </div>
                      </div>
                    ) : "No file"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(document)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(document.id)}
                        disabled={deleteDocumentMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}