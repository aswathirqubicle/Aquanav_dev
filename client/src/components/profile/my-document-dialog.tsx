import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatDateForInput } from "@/lib/utils";

// The same type slugs the Employee Management page saves, so a document an
// employee adds lands in the right tab there (maritime documents or visas).
const MARITIME_TYPES: Array<[string, string]> = [
  ["passport", "Passport"],
  ["cdc", "CDC (Seaman Book)"],
  ["covid_vaccination", "COVID Vaccination Certificate"],
  ["stcw_course", "STCW Course Certificate"],
  ["sid", "SID (Seafarer Identity Document)"],
  ["ilo_medical", "ILO DG Medical Certificate"],
  ["yellow_fever", "Yellow Fever Document"],
  ["pp_photos", "PP Photos"],
  ["other", "Others"],
];

const VISA_TYPES: Array<[string, string]> = [
  ["us_visa", "US Visa"],
  ["schengen_visa", "Schengen Visa (EU)"],
  ["uk_visa", "UK Visa"],
  ["canada_visa", "Canada Visa"],
  ["australia_visa", "Australia Visa"],
  ["uae_visa", "UAE Visa"],
  ["saudi_visa", "Saudi Arabia Visa"],
  ["singapore_visa", "Singapore Visa"],
  ["work_permit", "Work Permit"],
  ["residence_permit", "Residence Permit"],
];

export interface MyDocument {
  id: number;
  documentType: string;
  documentNumber: string | null;
  placeOfIssue: string | null;
  dateOfIssue: string | null;
  expiryDate: string | null;
  notes?: string | null;
  attachmentPaths?: Array<{ originalName?: string; filePath?: string }> | null;
}

interface FormState {
  documentType: string;
  documentNumber: string;
  placeOfIssue: string;
  dateOfIssue: string;
  expiryDate: string;
  notes: string;
}

const emptyForm: FormState = {
  documentType: "passport",
  documentNumber: "",
  placeOfIssue: "",
  dateOfIssue: "",
  expiryDate: "",
  notes: "",
};

/** apiRequest throws "403: {json}"; show the server's message, not the raw text. */
const readError = (error: unknown, fallback: string) => {
  const text = error instanceof Error ? error.message : "";
  const body = text.replace(/^\d{3}:\s*/, "");
  try {
    return JSON.parse(body).message || fallback;
  } catch {
    return body || fallback;
  }
};

export function MyDocumentDialog({
  open,
  onOpenChange,
  employeeId,
  document,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: number;
  /** The document being edited; omit to add a new one. */
  document?: MyDocument | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [files, setFiles] = useState<FileList | null>(null);
  const isEdit = !!document;

  useEffect(() => {
    if (!open) return;
    setFiles(null);
    setForm(
      document
        ? {
            documentType: document.documentType,
            documentNumber: document.documentNumber ?? "",
            placeOfIssue: document.placeOfIssue ?? "",
            dateOfIssue: formatDateForInput(document.dateOfIssue),
            expiryDate: formatDateForInput(document.expiryDate),
            notes: document.notes ?? "",
          }
        : emptyForm,
    );
  }, [open, document]);

  const set = (key: keyof FormState) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("documentType", form.documentType);
      fd.append("documentNumber", form.documentNumber.trim());
      fd.append("dateOfIssue", form.dateOfIssue);
      if (form.placeOfIssue.trim()) fd.append("placeOfIssue", form.placeOfIssue.trim());
      if (form.expiryDate) fd.append("expiryDate", form.expiryDate);
      if (form.notes.trim()) fd.append("notes", form.notes.trim());
      // Status is HR's to set; a new document starts active.
      if (!isEdit) fd.append("status", "active");
      if (files) Array.from(files).forEach((file) => fd.append("files", file));

      const response = await apiRequest(
        isEdit
          ? `/api/employees/documents/${document!.id}`
          : `/api/employees/${employeeId}/documents`,
        { method: isEdit ? "PUT" : "POST", body: fd },
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/me"] });
      toast({
        title: isEdit ? "Document updated" : "Document added",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: readError(error, "Failed to save the document"),
        variant: "destructive",
      });
    },
  });

  const submit = () => {
    if (!form.documentNumber.trim()) {
      toast({ title: "Document number is required", variant: "destructive" });
      return;
    }
    if (!form.dateOfIssue) {
      toast({ title: "Date of issue is required", variant: "destructive" });
      return;
    }
    if (form.expiryDate && form.expiryDate < form.dateOfIssue) {
      toast({
        title: "Expiry date can't be before the date of issue",
        variant: "destructive",
      });
      return;
    }
    if (!isEdit && (!files || files.length === 0)) {
      toast({
        title: "Attachment required",
        description: "Please upload at least one document file.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate();
  };

  const existing = document?.attachmentPaths ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Document" : "Add Document"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Document Type *</Label>
            <Select value={form.documentType} onValueChange={set("documentType")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Maritime documents</SelectLabel>
                  {MARITIME_TYPES.map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Visas &amp; permits</SelectLabel>
                  {VISA_TYPES.map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="my-doc-number">Document Number *</Label>
            <Input
              id="my-doc-number"
              value={form.documentNumber}
              onChange={(e) => set("documentNumber")(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="my-doc-place">Place of Issue</Label>
            <Input
              id="my-doc-place"
              value={form.placeOfIssue}
              onChange={(e) => set("placeOfIssue")(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="my-doc-issued">Date of Issue *</Label>
            <Input
              id="my-doc-issued"
              type="date"
              value={form.dateOfIssue}
              onChange={(e) => set("dateOfIssue")(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="my-doc-expiry">Expiry Date</Label>
            <Input
              id="my-doc-expiry"
              type="date"
              value={form.expiryDate}
              onChange={(e) => set("expiryDate")(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="my-doc-notes">Notes</Label>
            <Textarea
              id="my-doc-notes"
              value={form.notes}
              onChange={(e) => set("notes")(e.target.value)}
            />
          </div>

          {existing.length > 0 && (
            <div className="space-y-2 sm:col-span-2">
              <Label>Current attachments</Label>
              <ul className="rounded-md border p-3 space-y-1 text-sm">
                {existing.map((file, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="truncate">{file.originalName ?? "Attachment"}</span>
                    {file.filePath && (
                      <a
                        href={file.filePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline shrink-0"
                      >
                        View
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="my-doc-files">
              {isEdit ? "Replace attachments" : "Attachments *"}
            </Label>
            <Input
              id="my-doc-files"
              type="file"
              multiple
              onChange={(e) => setFiles(e.target.files)}
            />
            {isEdit && (
              <p className="text-xs text-muted-foreground">
                Leave empty to keep the current attachments. Choosing files
                replaces them.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saveMutation.isPending}>
            {saveMutation.isPending
              ? "Saving…"
              : isEdit
                ? "Save Changes"
                : "Add Document"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
