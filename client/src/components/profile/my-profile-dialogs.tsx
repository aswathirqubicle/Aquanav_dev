import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatDateForInput } from "@/lib/utils";

/**
 * Self-service dialogs for My Profile. Every request goes to /api/profile/*,
 * which resolves the employee from the login session, so these can only ever
 * change the signed-in employee's own record.
 */

/** apiRequest throws "400: {json}"; show the server's message, not the raw text. */
const readError = (error: unknown, fallback: string) => {
  const text = error instanceof Error ? error.message : "";
  const body = text.replace(/^\d{3}:\s*/, "");
  try {
    return JSON.parse(body).message || fallback;
  } catch {
    return body || fallback;
  }
};

const useSaved = (onOpenChange: (open: boolean) => void, title: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  return {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/me"] });
      toast({ title });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: readError(error, "Failed to save"),
        variant: "destructive",
      });
    },
  };
};

const Footer = ({
  onCancel,
  onSave,
  saving,
  label,
}: {
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  label: string;
}) => (
  <div className="flex justify-end gap-2 pt-2">
    <Button variant="outline" onClick={onCancel}>
      Cancel
    </Button>
    <Button onClick={onSave} disabled={saving}>
      {saving ? "Saving…" : label}
    </Button>
  </div>
);

// ---------------------------------------------------------------- Basic info

export interface MyBasicInfo {
  phone: string | null;
  email: string | null;
  address: string | null;
  dateOfBirth: string | null;
  height: string | null;
  weight: string | null;
  boilerSuitSize: string | null;
  safetyShoeSize: string | null;
}

const BASIC_FIELDS: Array<{
  key: keyof MyBasicInfo;
  label: string;
  type?: string;
  wide?: boolean;
}> = [
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email", type: "email" },
  { key: "dateOfBirth", label: "Date of Birth", type: "date" },
  { key: "height", label: "Height (cm)", type: "number" },
  { key: "weight", label: "Weight (kg)", type: "number" },
  { key: "boilerSuitSize", label: "Boiler Suit Size" },
  { key: "safetyShoeSize", label: "Safety Shoe Size" },
  { key: "address", label: "Address", wide: true },
];

export function MyBasicInfoDialog({
  open,
  onOpenChange,
  current,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: MyBasicInfo;
}) {
  const [form, setForm] = useState<Record<keyof MyBasicInfo, string>>(
    {} as Record<keyof MyBasicInfo, string>,
  );

  useEffect(() => {
    if (!open) return;
    const next = {} as Record<keyof MyBasicInfo, string>;
    for (const { key, type } of BASIC_FIELDS) {
      const value = current[key];
      next[key] =
        type === "date" ? formatDateForInput(value) : value == null ? "" : String(value);
    }
    setForm(next);
  }, [open, current]);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/profile/basic", {
        method: "PATCH",
        body: form,
      });
      return response.json();
    },
    ...useSaved(onOpenChange, "Your details have been updated"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Basic Info</DialogTitle>
          <DialogDescription>
            Name, position, department and salary are kept by HR. Contact them
            if any of those need changing.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {BASIC_FIELDS.map(({ key, label, type, wide }) => (
            <div key={key} className={`space-y-2 ${wide ? "sm:col-span-2" : ""}`}>
              <Label htmlFor={`my-basic-${key}`}>{label}</Label>
              {wide ? (
                <Textarea
                  id={`my-basic-${key}`}
                  value={form[key] ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                />
              ) : (
                <Input
                  id={`my-basic-${key}`}
                  type={type ?? "text"}
                  value={form[key] ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
        <Footer
          onCancel={() => onOpenChange(false)}
          onSave={() => mutation.mutate()}
          saving={mutation.isPending}
          label="Save Changes"
        />
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Next of kin

export interface MyNextOfKin {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  relationship: string;
  isPrimary: boolean;
}

const RELATIONSHIPS: Array<[string, string]> = [
  ["spouse", "Spouse"],
  ["parent", "Parent"],
  ["sibling", "Sibling"],
  ["child", "Child"],
  ["other", "Other"],
];

export function MyNextOfKinDialog({
  open,
  onOpenChange,
  kin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The contact being edited; omit to add a new one. */
  kin?: MyNextOfKin | null;
}) {
  const { toast } = useToast();
  const isEdit = !!kin;
  const [form, setForm] = useState({
    name: "",
    relationship: "spouse",
    phone: "",
    email: "",
    isPrimary: false,
  });

  useEffect(() => {
    if (!open) return;
    setForm(
      kin
        ? {
            name: kin.name,
            relationship: kin.relationship,
            phone: kin.phone ?? "",
            email: kin.email ?? "",
            isPrimary: kin.isPrimary,
          }
        : { name: "", relationship: "spouse", phone: "", email: "", isPrimary: false },
    );
  }, [open, kin]);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        isEdit ? `/api/profile/next-of-kin/${kin!.id}` : "/api/profile/next-of-kin",
        { method: isEdit ? "PUT" : "POST", body: form },
      );
      return response.json();
    },
    ...useSaved(onOpenChange, isEdit ? "Next of kin updated" : "Next of kin added"),
  });

  const submit = () => {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!form.phone.trim() && !form.email.trim()) {
      toast({ title: "Enter a phone number or an email", variant: "destructive" });
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Next of Kin" : "Add Next of Kin"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="my-kin-name">Name *</Label>
            <Input
              id="my-kin-name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Relationship *</Label>
            <Select
              value={form.relationship}
              onValueChange={(value) => setForm((p) => ({ ...p, relationship: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIPS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="my-kin-phone">Phone</Label>
            <Input
              id="my-kin-phone"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="my-kin-email">Email</Label>
            <Input
              id="my-kin-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox
              checked={form.isPrimary}
              onCheckedChange={(checked) =>
                setForm((p) => ({ ...p, isPrimary: checked === true }))
              }
            />
            Primary contact
          </label>
        </div>
        <Footer
          onCancel={() => onOpenChange(false)}
          onSave={submit}
          saving={mutation.isPending}
          label={isEdit ? "Save Changes" : "Add Next of Kin"}
        />
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Training

export interface MyTrainingRecord {
  id: number;
  trainingName: string;
  trainingProvider: string;
  certificationNumber: string | null;
  trainingDate: string;
  expiryDate: string | null;
  status: string;
  notes?: string | null;
  attachments?: Array<{
    fileName?: string;
    originalName?: string;
    filePath?: string;
  }> | null;
}

export function MyTrainingDialog({
  open,
  onOpenChange,
  record,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The record being edited; omit to add a new one. */
  record?: MyTrainingRecord | null;
}) {
  const { toast } = useToast();
  const isEdit = !!record;
  const [form, setForm] = useState({
    trainingName: "",
    trainingProvider: "",
    certificationNumber: "",
    trainingDate: "",
    expiryDate: "",
    notes: "",
  });
  const [files, setFiles] = useState<FileList | null>(null);
  const [keep, setKeep] = useState<Set<string>>(new Set());
  const existing = (record?.attachments ?? []).filter((a) => a?.fileName);

  useEffect(() => {
    if (!open) return;
    setFiles(null);
    setKeep(new Set(existing.map((a) => a.fileName!)));
    setForm(
      record
        ? {
            trainingName: record.trainingName,
            trainingProvider: record.trainingProvider,
            certificationNumber: record.certificationNumber ?? "",
            trainingDate: formatDateForInput(record.trainingDate),
            expiryDate: formatDateForInput(record.expiryDate),
            notes: record.notes ?? "",
          }
        : {
            trainingName: "",
            trainingProvider: "",
            certificationNumber: "",
            trainingDate: "",
            expiryDate: "",
            notes: "",
          },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record]);

  const mutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      for (const [key, value] of Object.entries(form)) fd.append(key, value.trim());
      if (isEdit) {
        Array.from(keep).forEach((fileName) =>
          fd.append("existingAttachments", JSON.stringify({ fileName })),
        );
      }
      if (files) Array.from(files).forEach((file) => fd.append("files", file));
      const response = await apiRequest(
        isEdit
          ? `/api/profile/training-records/${record!.id}`
          : "/api/profile/training-records",
        { method: isEdit ? "PUT" : "POST", body: fd },
      );
      return response.json();
    },
    ...useSaved(onOpenChange, isEdit ? "Training record updated" : "Training record added"),
  });

  const submit = () => {
    if (!form.trainingName.trim() || !form.trainingProvider.trim() || !form.trainingDate) {
      toast({
        title: "Training name, provider and date are required",
        variant: "destructive",
      });
      return;
    }
    if (form.expiryDate && form.expiryDate < form.trainingDate) {
      toast({
        title: "Expiry date can't be before the training date",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate();
  };

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value })),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Training" : "Add Training"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="my-training-name">Training Name *</Label>
            <Input id="my-training-name" {...field("trainingName")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="my-training-provider">Provider *</Label>
            <Input id="my-training-provider" {...field("trainingProvider")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="my-training-cert">Certificate Number</Label>
            <Input id="my-training-cert" {...field("certificationNumber")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="my-training-date">Training Date *</Label>
            <Input id="my-training-date" type="date" {...field("trainingDate")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="my-training-expiry">Expiry Date</Label>
            <Input id="my-training-expiry" type="date" {...field("expiryDate")} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="my-training-notes">Notes</Label>
            <Textarea id="my-training-notes" {...field("notes")} />
          </div>

          {existing.length > 0 && (
            <div className="space-y-2 sm:col-span-2">
              <Label>Current attachments</Label>
              <ul className="rounded-md border p-3 space-y-2 text-sm">
                {existing.map((file) => (
                  <li key={file.fileName} className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 min-w-0">
                      <Checkbox
                        checked={keep.has(file.fileName!)}
                        onCheckedChange={(checked) =>
                          setKeep((prev) => {
                            const next = new Set(prev);
                            if (checked === true) next.add(file.fileName!);
                            else next.delete(file.fileName!);
                            return next;
                          })
                        }
                      />
                      <span className="truncate">{file.originalName ?? "Attachment"}</span>
                    </label>
                    {file.filePath && (
                      <a
                        href={`/${String(file.filePath).replace(/^\/+/, "")}`}
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
              <p className="text-xs text-muted-foreground">Untick a file to remove it.</p>
            </div>
          )}

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="my-training-files">
              {isEdit ? "Add attachments" : "Attachments"}
            </Label>
            <Input
              id="my-training-files"
              type="file"
              multiple
              onChange={(e) => setFiles(e.target.files)}
            />
          </div>
        </div>
        <Footer
          onCancel={() => onOpenChange(false)}
          onSave={submit}
          saving={mutation.isPending}
          label={isEdit ? "Save Changes" : "Add Training"}
        />
      </DialogContent>
    </Dialog>
  );
}
