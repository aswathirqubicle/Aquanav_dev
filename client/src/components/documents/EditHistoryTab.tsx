import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { sanitize } from "@/lib/sanitize";

/**
 * The Activity → Edit History tab, shared by sales quotations, sales invoices,
 * purchase orders and purchase invoices.
 *
 * There were two renderers before this: the purchase pages had collapsible
 * entries and sanitised their rich-text fields, while the sales pages printed
 * every entry expanded and rendered stored HTML as raw markup, so a change to
 * Terms & Conditions read as "<p>Net 30</p>". One component means the four
 * documents cannot drift apart again.
 *
 * Entries written before server/lib/document-edit-history.ts existed carry no
 * `detail` on their items change. Nothing was backfilled, so those keep the old
 * "Line items were modified" summary and only newer edits show the breakdown.
 */

type EditHistoryEntry = {
  id: number;
  editedByName?: string | null;
  editedAt: string;
  editNote: string;
  changes?: Record<string, any> | null;
};

type Props = {
  entries: EditHistoryEntry[] | undefined;
  isLoading?: boolean;
  /** Document currency, so amount changes read as "AED 1,500.00". */
  currency?: string | null;
  emptyMessage?: string;
};

/** Fields whose stored value is HTML, produced by the ReactQuill editors. */
const RICH_TEXT_FIELDS = new Set([
  "notes",
  "remarks",
  "bankAccount",
  "billingAddress",
  "termsAndConditions",
]);

const FIELD_LABELS: Record<string, string> = {
  customerId: "Customer",
  supplierId: "Supplier",
  projectId: "Project",
  poId: "Purchase order",
  supplierInvoiceNumber: "Supplier invoice number",
  totalAmount: "Total amount",
  taxAmount: "Tax amount",
  discountAmount: "Discount amount",
  discountPercentage: "Discount %",
  exchangeRate: "Exchange rate",
  paymentTerms: "Payment terms",
  deliveryTerms: "Delivery terms",
  deliverTo: "Deliver to",
  termsAndConditions: "Terms & conditions",
  billingAddress: "Billing address",
  bankAccount: "Bank account",
  workOrderNumber: "Work order number",
  expectedDeliveryDate: "Expected delivery date",
  invoiceDate: "Invoice date",
  orderDate: "Order date",
  dueDate: "Due date",
  validUntil: "Valid until",
  createdDate: "Created date",
  paymentStatus: "Payment status",
  unitPrice: "Unit price",
  lineTotal: "Line total",
  taxRate: "Tax rate",
  discountType: "Discount type",
};

const labelFor = (field: string) =>
  FIELD_LABELS[field] ??
  field.charAt(0).toUpperCase() +
    field.slice(1).replace(/([A-Z])/g, " $1").toLowerCase();

const money = (value: any, currency?: string | null) => {
  const parsed = parseFloat(String(value ?? ""));
  if (isNaN(parsed)) return String(value ?? "—");
  return `${currency || "AED"} ${parsed.toFixed(2)}`;
};

/** A line as "2 × 450.00 = 900.00", so an added or removed row reads at a glance. */
const lineSummary = (line: any, currency?: string | null) => {
  const parts = [`${line?.quantity ?? "—"} × ${line?.unitPrice ?? "—"}`];
  if (line?.lineTotal !== undefined) {
    parts.push(`= ${money(line.lineTotal, currency)}`);
  }
  return parts.join(" ");
};

const OLD_TEXT = "text-[#B42318] line-through break-words whitespace-pre-wrap";
const NEW_TEXT = "text-[#027A48] break-words whitespace-pre-wrap";

function ScalarChange({
  field,
  change,
  currency,
}: {
  field: string;
  change: any;
  currency?: string | null;
}) {
  // Reference fields carry the counterparty's name as it stood at the time of
  // the edit; fall back to the raw id for entries written before that existed.
  const oldValue =
    change?.oldLabel ?? (change?.isAmount ? money(change?.old, currency) : change?.old);
  const newValue =
    change?.newLabel ?? (change?.isAmount ? money(change?.new, currency) : change?.new);

  if (RICH_TEXT_FIELDS.has(field)) {
    return (
      <div className="flex flex-col gap-1">
        <span className="font-medium">{labelFor(field)}:</span>
        <div
          className="text-[#B42318] line-through break-words rich-text-content"
          dangerouslySetInnerHTML={{ __html: sanitize(String(oldValue || "—")) }}
        />
        <div
          className="text-[#027A48] break-words rich-text-content"
          dangerouslySetInnerHTML={{ __html: sanitize(String(newValue || "—")) }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
      <span className="font-medium shrink-0">{labelFor(field)}:</span>
      <span className={OLD_TEXT}>{String(oldValue ?? "") || "—"}</span>
      <span className="text-[#8A93A3] shrink-0">→</span>
      <span className={NEW_TEXT}>{String(newValue ?? "") || "—"}</span>
    </div>
  );
}

function LineItemChanges({
  detail,
  currency,
}: {
  detail: any;
  currency?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-medium">Line items:</span>

      {detail.added?.map((line: any, index: number) => (
        <div key={`added-${index}`} className="pl-3">
          <span className="text-[#027A48] font-medium">Added</span>{" "}
          <span className="text-[#333B47]">{line.description || "—"}</span>{" "}
          <span className="text-[#5B6472]">— {lineSummary(line, currency)}</span>
        </div>
      ))}

      {detail.removed?.map((line: any, index: number) => (
        <div key={`removed-${index}`} className="pl-3">
          <span className="text-[#B42318] font-medium">Removed</span>{" "}
          <span className="text-[#333B47]">{line.description || "—"}</span>{" "}
          <span className="text-[#5B6472]">— {lineSummary(line, currency)}</span>
        </div>
      ))}

      {detail.changed?.map((line: any, index: number) => (
        <div key={`changed-${index}`} className="pl-3">
          <span className="text-[#B54708] font-medium">Changed</span>{" "}
          <span className="text-[#333B47]">{line.description || "—"}</span>
          <div className="pl-4 mt-0.5 flex flex-col gap-0.5">
            {Object.entries(line.fields || {}).map(
              ([field, change]: [string, any]) => (
                <div key={field} className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[#5B6472]">{labelFor(field)}</span>
                  <span className={OLD_TEXT}>{String(change.old ?? "—")}</span>
                  <span className="text-[#8A93A3]">→</span>
                  <span className={NEW_TEXT}>{String(change.new ?? "—")}</span>
                </div>
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function AttachmentChanges({ detail }: { detail: any }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-medium">Attachments:</span>
      {detail.added?.map((name: string) => (
        <div key={`added-${name}`} className="pl-3">
          <span className="text-[#027A48] font-medium">Added</span>{" "}
          <span className="text-[#333B47] break-words">{name}</span>
        </div>
      ))}
      {detail.removed?.map((name: string) => (
        <div key={`removed-${name}`} className="pl-3">
          <span className="text-[#B42318] font-medium">Removed</span>{" "}
          <span className="text-[#333B47] break-words">{name}</span>
        </div>
      ))}
    </div>
  );
}

export function EditHistoryTab({
  entries,
  isLoading = false,
  currency,
  emptyMessage = "No edits have been recorded for this document.",
}: Props) {
  // One entry open at a time: a single edit can carry a long line-item diff, and
  // expanding several at once buries the list it is meant to explain.
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        Loading edit history…
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return <p className="text-sm text-muted-foreground italic">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const changedFields = entry.changes ? Object.keys(entry.changes) : [];
        const isExpanded = expandedEntry === entry.id;

        return (
          <div
            key={entry.id}
            className="border border-[#E3E7EE] rounded-lg overflow-hidden"
            data-testid={`edit-history-entry-${entry.id}`}
          >
            <div
              className={`p-3 ${changedFields.length > 0 ? "cursor-pointer hover:bg-[#F7F9FC]" : ""} transition-colors`}
              onClick={() =>
                changedFields.length > 0 &&
                setExpandedEntry(isExpanded ? null : entry.id)
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[13.5px]">
                      {entry.editedByName || "Unknown"}
                    </span>
                    <span className="text-[11.5px] text-[#8A93A3]">
                      {new Date(entry.editedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[13px] text-[#333B47] mt-1 break-words">
                    {entry.editNote}
                  </p>
                  {changedFields.length > 0 && (
                    <p className="text-[11.5px] text-[#8A93A3] mt-1">
                      {changedFields.length} field
                      {changedFields.length === 1 ? "" : "s"} changed
                    </p>
                  )}
                </div>
                {changedFields.length > 0 && (
                  <ChevronDown
                    className={`h-4 w-4 flex-shrink-0 mt-1 text-[#8A93A3] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  />
                )}
              </div>
            </div>

            {isExpanded && changedFields.length > 0 && (
              <div className="px-3 pb-3 pt-3 border-t border-[#EDF0F5] bg-[#F7F9FC]">
                <div className="text-[12px] space-y-2">
                  {Object.entries(entry.changes || {}).map(
                    ([field, change]: [string, any]) => {
                      if (field === "items") {
                        return change?.detail ? (
                          <LineItemChanges
                            key={field}
                            detail={change.detail}
                            currency={currency}
                          />
                        ) : (
                          // Pre-existing entry: the arrays are on the row but
                          // were never broken down, so say only what is known.
                          <div key={field} className="text-[#8A93A3] italic">
                            Line items were modified
                          </div>
                        );
                      }

                      if (field === "attachments") {
                        return change?.detail ? (
                          <AttachmentChanges key={field} detail={change.detail} />
                        ) : (
                          <div key={field} className="text-[#8A93A3] italic">
                            Attachments were modified
                          </div>
                        );
                      }

                      return (
                        <ScalarChange
                          key={field}
                          field={field}
                          change={change}
                          currency={currency}
                        />
                      );
                    },
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
