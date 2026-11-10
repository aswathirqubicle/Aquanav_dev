// Recurring invoices made from a sales quotation: the Convert chooser, the
// recurring set-up dialog, and the schedule card on the quotation view.
//
// Kept apart from quotations.tsx so the quotation page only gains a few lines;
// nothing here touches the quotation's own line-item form. The periods, the
// default Bill from and the next-run preview come from the same engine the
// server bills with (shared/recurring-billing.ts), so what the dialog promises
// is what the job drafts.
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FileText, Repeat } from "lucide-react";
import type { Project, SalesQuotation } from "@shared/schema";
import {
  BILLING_TYPE_LABELS,
  addDays,
  defaultBillFrom,
  firstRunOnOrAfter,
  hasRecurringLine,
  localYmd,
  periodFrom,
  rangeLabel,
  type BillingType,
  type ScheduleTiming,
} from "@shared/recurring-billing";
import {
  DOC_CARD,
  DOC_CARD_BODY,
  DOC_CARD_HEAD,
  DOC_CARD_ICON,
  DOC_CARD_TITLE,
  DOC_KV_LABEL,
  DOC_KV_ROW,
  DOC_KV_VAL,
  docStatusTone,
  DOC_STAMP,
  formatCurrency,
} from "./shared";

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] || "th"}`;
}

const DAY_OPTIONS = Array.from({ length: 30 }, (_, i) => String(i + 1));

function timingFrom(day: string): ScheduleTiming {
  return day === "last"
    ? { generationDay: null, lastDayOfMonth: true }
    : { generationDay: parseInt(day, 10), lastDayOfMonth: false };
}

function scheduleKey(quotationId: number) {
  return ["/api/sales-quotations", quotationId, "recurring-schedule"];
}

function dayLabel(s: { generationDay: number | null; lastDayOfMonth: boolean }) {
  return s.lastDayOfMonth ? "Last day of the month" : `Day ${s.generationDay} of the month`;
}

const projectStart = (p?: Project | null): string | null =>
  p?.startDate ? localYmd(new Date(p.startDate as any)) : null;

/**
 * Convert to Invoice: choose a one-off invoice (the existing pre-fill, unchanged)
 * or a recurring one, then set the recurring one up.
 */
export function ConvertQuotationDialog({
  quotation,
  open,
  onOpenChange,
  onPlainInvoice,
}: {
  quotation: SalesQuotation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlainInvoice: (quotation: SalesQuotation) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"choose" | "recurring">("choose");
  const [projectId, setProjectId] = useState<string>("none");
  const [day, setDay] = useState<string>("last");
  const [billFrom, setBillFrom] = useState<string>("");
  const [billFromTouched, setBillFromTouched] = useState(false);
  const [endDate, setEndDate] = useState<string>("");
  const [workOrderNumber, setWorkOrderNumber] = useState<string>("");
  const [billingTypes, setBillingTypes] = useState<BillingType[]>([]);

  const items: any[] = (quotation?.items as any[]) || [];

  // Reset every time the dialog opens on a quotation.
  useEffect(() => {
    if (!open) return;
    setStep("choose");
    setProjectId("none");
    setDay("last");
    setBillFromTouched(false);
    setEndDate("");
    setWorkOrderNumber("");
    setBillingTypes(
      items.map((i) => (i.billingType as BillingType) || "one_time"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, quotation?.id]);

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: open && step === "recurring",
  });

  const customerProjects = useMemo(
    () =>
      (projects || []).filter(
        (p) =>
          p.customerId === quotation?.customerId &&
          p.status !== "cancelled" &&
          p.status !== "completed",
      ),
    [projects, quotation?.customerId],
  );
  const selectedProject =
    projectId === "none"
      ? null
      : customerProjects.find((p) => String(p.id) === projectId) || null;

  const timing = timingFrom(day);
  const today = localYmd(new Date());

  // Bill from follows the project and the generation day until someone sets it.
  useEffect(() => {
    if (!open || billFromTouched) return;
    setBillFrom(defaultBillFrom(today, timing, projectStart(selectedProject)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, day, projectId, selectedProject?.startDate, billFromTouched]);

  const firstPeriod = billFrom ? periodFrom(billFrom, timing) : null;
  const linesForCheck = items.map((i, idx) => ({ ...i, billingType: billingTypes[idx] }));

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        `/api/sales-quotations/${quotation!.id}/recurring-schedule`,
        {
          method: "POST",
          body: {
            projectId: selectedProject ? selectedProject.id : null,
            lastDayOfMonth: day === "last",
            generationDay: day === "last" ? null : parseInt(day, 10),
            billFrom,
            endDate: selectedProject ? null : endDate || null,
            workOrderNumber,
            billingTypes,
          },
        },
      );
      return response.json();
    },
    onSuccess: (result: { invoicesCreated?: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-quotations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales-invoices"] });
      const n = result?.invoicesCreated || 0;
      toast({
        title: "Recurring invoice set up",
        description:
          n > 0
            ? `${n} draft invoice${n === 1 ? "" : "s"} created for periods already ended. Further drafts follow on each run date.`
            : "The first draft invoice will be created on its run date.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set up the recurring invoice",
        variant: "destructive",
      });
    },
  });

  const submit = () => {
    if (!billFrom) {
      toast({
        title: "Error",
        description: "Please choose the date to bill from",
        variant: "destructive",
      });
      return;
    }
    if (!selectedProject && endDate && endDate < billFrom) {
      toast({
        title: "Error",
        description: "The end date must be on or after the bill from date",
        variant: "destructive",
      });
      return;
    }
    if (!hasRecurringLine(linesForCheck)) {
      toast({
        title: "Error",
        description:
          "Mark at least one line as monthly (pro rata or fixed) to bill it every month",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate();
  };

  if (!quotation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={step === "recurring" ? "sm:max-w-3xl max-h-[90vh] overflow-y-auto" : undefined}>
        {step === "choose" ? (
          <>
            <DialogHeader>
              <DialogTitle>Convert to Invoice</DialogTitle>
              <DialogDescription>
                {quotation.quotationNumber}: raise one invoice now, or bill it every month.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className="text-left border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                onClick={() => {
                  onOpenChange(false);
                  onPlainInvoice(quotation);
                }}
                data-testid="button-convert-choice-invoice"
              >
                <FileText className="h-5 w-5 mb-2 text-muted-foreground" />
                <div className="font-medium">Invoice</div>
                <div className="text-sm text-muted-foreground">
                  Open the invoice form filled from this quotation.
                </div>
              </button>
              <button
                type="button"
                className="text-left border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                onClick={() => setStep("recurring")}
                data-testid="button-convert-choice-recurring"
              >
                <Repeat className="h-5 w-5 mb-2 text-muted-foreground" />
                <div className="font-medium">Recurring invoice</div>
                <div className="text-sm text-muted-foreground">
                  Draft an invoice automatically every month, for finance to review and approve.
                </div>
              </button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Recurring invoice</DialogTitle>
              <DialogDescription>
                {quotation.quotationNumber}: each invoice is created as a draft
                covering the period since the previous one.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Project (Optional)</Label>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger data-testid="select-recurring-project">
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Project</SelectItem>
                      {customerProjects.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {selectedProject
                      ? `Pro rata lines follow the project's start${projectStart(selectedProject) ? ` (${projectStart(selectedProject)})` : ""} and actual end dates.`
                      : "Without a project, pro rata lines run from Bill from to the end date."}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Generate on</Label>
                  <Select value={day} onValueChange={setDay}>
                    <SelectTrigger data-testid="select-recurring-day">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last">Last day of the month</SelectItem>
                      {DAY_OPTIONS.map((d) => (
                        <SelectItem key={d} value={d}>
                          Day {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Days 29 and 30 fall on the last day in February.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recurringBillFrom">Bill from</Label>
                  <Input
                    id="recurringBillFrom"
                    type="date"
                    value={billFrom}
                    onChange={(e) => {
                      setBillFrom(e.target.value);
                      setBillFromTouched(true);
                    }}
                  />
                </div>
                {!selectedProject && (
                  <div className="space-y-2">
                    <Label htmlFor="recurringEndDate">End date (Optional)</Label>
                    <Input
                      id="recurringEndDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="recurringPo">P.O. number (Optional)</Label>
                  <Input
                    id="recurringPo"
                    value={workOrderNumber}
                    onChange={(e) => setWorkOrderNumber(e.target.value)}
                    placeholder="Client purchase order"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>How each line bills</Label>
                <div className="border rounded-lg divide-y">
                  {items.map((item, index) => (
                    <div
                      key={index}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm whitespace-pre-wrap break-words line-clamp-3">
                          {item.description}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.quantity} × {formatCurrency(item.unitPrice, quotation.currency || "AED")}
                        </div>
                      </div>
                      <Select
                        value={billingTypes[index] || "one_time"}
                        onValueChange={(value) =>
                          setBillingTypes((prev) =>
                            prev.map((t, i) => (i === index ? (value as BillingType) : t)),
                          )
                        }
                      >
                        <SelectTrigger className="sm:w-52" data-testid={`select-recurring-billing-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(BILLING_TYPE_LABELS) as BillingType[]).map((t) => (
                            <SelectItem key={t} value={t}>
                              {BILLING_TYPE_LABELS[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Pro rata bills the monthly rate ÷ 30 per day for a part month, and the
                  full rate for a full one. Fixed bills the full rate every month.
                  One-time lines go on the first invoice only.
                </p>
              </div>

              {firstPeriod && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  First invoice: <strong>{firstPeriod.end}</strong>, covering{" "}
                  {rangeLabel(firstPeriod.start, firstPeriod.end)}
                  {firstPeriod.end <= today
                    ? ". It and any other ended periods are drafted as soon as you save."
                    : "."}{" "}
                  Then every month on the{" "}
                  {day === "last" ? "last day" : `${ordinal(parseInt(day, 10))}`} (next after
                  that: {firstRunOnOrAfter(addDays(firstPeriod.end, 1), timing)}).
                </div>
              )}

              <div className="flex justify-between gap-3 pt-4 border-t">
                <Button variant="ghost" onClick={() => setStep("choose")} disabled={createMutation.isPending}>
                  Back
                </Button>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>
                    Cancel
                  </Button>
                  <Button onClick={submit} disabled={createMutation.isPending} data-testid="button-create-recurring">
                    {createMutation.isPending ? "Setting up..." : "Set up recurring invoice"}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ScheduleView {
  id: number;
  status: string;
  projectTitle: string | null;
  generationDay: number | null;
  lastDayOfMonth: boolean;
  billFrom: string;
  endDate: string | null;
  lastPeriodEnd: string | null;
  nextRunDate: string;
  currency: string;
  workOrderNumber: string | null;
  invoices: {
    id: number;
    invoiceNumber: string | null;
    status: string;
    billingPeriodStart: string | null;
    billingPeriodEnd: string | null;
    totalAmount: string | null;
  }[];
}

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Stopped",
};

/** The quotation's recurring schedule, if it has one, with its drafts and actions. */
export function RecurringScheduleCard({
  quotationId,
  canManage,
}: {
  quotationId: number;
  canManage: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: schedule } = useQuery<ScheduleView | null>({
    queryKey: scheduleKey(quotationId),
    queryFn: async () => {
      const response = await apiRequest(
        `/api/sales-quotations/${quotationId}/recurring-schedule`,
      );
      return response.json();
    },
    enabled: canManage,
  });

  const action = useMutation({
    mutationFn: async (verb: "pause" | "resume" | "cancel") => {
      const response = await apiRequest(
        `/api/recurring-invoice-schedules/${schedule!.id}/${verb}`,
        { method: "POST", body: {} },
      );
      return response.json();
    },
    onSuccess: (result: { message?: string }) => {
      queryClient.invalidateQueries({ queryKey: scheduleKey(quotationId) });
      queryClient.invalidateQueries({ queryKey: ["/api/sales-invoices"] });
      toast({ title: result?.message || "Recurring invoice updated" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update the recurring invoice",
        variant: "destructive",
      });
    },
  });

  if (!schedule) return null;
  const live = schedule.status === "active" || schedule.status === "paused";
  const tone =
    schedule.status === "active"
      ? docStatusTone("approved")
      : schedule.status === "paused"
        ? docStatusTone("pending_approval")
        : docStatusTone(schedule.status === "cancelled" ? "cancelled" : "draft");

  return (
    <div className={DOC_CARD} data-testid="card-recurring-schedule">
      <div className={`${DOC_CARD_HEAD} justify-between`}>
        <span className="flex items-center gap-2.5">
          <Repeat className={DOC_CARD_ICON} />
          <span className={DOC_CARD_TITLE}>Recurring invoice</span>
        </span>
        <span className={`${DOC_STAMP} ${tone}`}>
          {STATUS_LABEL[schedule.status] || schedule.status}
        </span>
      </div>
      <div className={DOC_CARD_BODY}>
        <div className={DOC_KV_ROW}>
          <span className={DOC_KV_LABEL}>Project</span>
          <span className={DOC_KV_VAL}>{schedule.projectTitle || "No project"}</span>
        </div>
        <div className={DOC_KV_ROW}>
          <span className={DOC_KV_LABEL}>Generated on</span>
          <span className={DOC_KV_VAL}>{dayLabel(schedule)}</span>
        </div>
        <div className={DOC_KV_ROW}>
          <span className={DOC_KV_LABEL}>Billing from</span>
          <span className={DOC_KV_VAL}>
            {schedule.billFrom}
            {schedule.endDate ? ` to ${schedule.endDate}` : ""}
          </span>
        </div>
        <div className={DOC_KV_ROW}>
          <span className={DOC_KV_LABEL}>Billed through</span>
          <span className={DOC_KV_VAL}>{schedule.lastPeriodEnd || "Nothing yet"}</span>
        </div>
        {schedule.status === "active" && (
          <div className={DOC_KV_ROW}>
            <span className={DOC_KV_LABEL}>Next invoice</span>
            <span className={DOC_KV_VAL}>{schedule.nextRunDate}</span>
          </div>
        )}
        {schedule.workOrderNumber && (
          <div className={DOC_KV_ROW}>
            <span className={DOC_KV_LABEL}>P.O. number</span>
            <span className={DOC_KV_VAL}>{schedule.workOrderNumber}</span>
          </div>
        )}

        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#8A93A3] mb-2">
            Generated invoices
          </div>
          {schedule.invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="divide-y border rounded-md">
              {schedule.invoices.map((inv) => (
                <li key={inv.id} className="flex flex-wrap justify-between gap-2 px-3 py-2 text-sm">
                  <span className="font-medium">{inv.invoiceNumber}</span>
                  <span className="text-muted-foreground">
                    {inv.billingPeriodStart && inv.billingPeriodEnd
                      ? rangeLabel(inv.billingPeriodStart, inv.billingPeriodEnd)
                      : ""}
                  </span>
                  <span className="capitalize">{inv.status.replace(/_/g, " ")}</span>
                  <span>{formatCurrency(inv.totalAmount || "0", schedule.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {canManage && live && (
          <div className="flex flex-wrap gap-2 mt-4">
            {schedule.status === "active" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => action.mutate("pause")}
                disabled={action.isPending}
              >
                Pause
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => action.mutate("resume")}
                disabled={action.isPending}
              >
                Resume
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => {
                if (
                  confirm(
                    "Stop this recurring invoice? No further drafts will be created. Drafts already created stay as they are.",
                  )
                ) {
                  action.mutate("cancel");
                }
              }}
              disabled={action.isPending}
            >
              Stop
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
