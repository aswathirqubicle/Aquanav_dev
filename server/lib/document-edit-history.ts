import { storage } from "../storage";

/**
 * One capture format for the edit history of all four approvable documents —
 * sales quotations, sales invoices, purchase orders and purchase invoices.
 *
 * Each of the four grew its own copy of this logic, and the copies drifted:
 * different date handling, different rules for when a history row is written,
 * and two of them diffed line items against the request payload rather than the
 * stored rows, so items were reported as changed on every edit. Everything they
 * have in common now lives here, and each route supplies only its own field
 * list.
 *
 * The `changes` column is untyped JSON, so entries written before this existed
 * keep their old shape and stay readable. Nothing is backfilled — the renderer
 * falls back for rows that carry no `detail`.
 */

export type FieldChange = {
  old: any;
  new: any;
  /** Present on reference fields (customerId, supplierId, projectId): the
   *  counterparty's name as it stood at the time of the edit, so history does
   *  not silently re-label itself when a customer is later renamed. */
  oldLabel?: string | null;
  newLabel?: string | null;
  /** Marks the field as money so the renderer can format it in the document's
   *  currency instead of printing a bare decimal. */
  isAmount?: boolean;
};

export type LineSnapshot = {
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  discountType: string;
  taxRate: string;
  taxAmount: string;
  lineTotal: string;
};

export type LineItemsDetail = {
  added: LineSnapshot[];
  removed: LineSnapshot[];
  changed: Array<{
    description: string;
    fields: Record<string, { old: string; new: string }>;
  }>;
};

export type DocumentChanges = Record<string, any>;

/**
 * When an edit needs a note and a history row.
 *
 * draft and pending_approval are the document still being written: recording
 * those edits would bury the entries that matter under drafting noise. Anything
 * past that point is a change to a decided record — an approved commitment, a
 * rejection someone revisited, a posted ledger — and has to be accounted for.
 *
 * Always read from the PERSISTED row, never from req.body, or a client can
 * claim draft status to skip the note.
 */
export function documentRequiresEditNote(status: string | null | undefined) {
  return status !== "draft" && status !== "pending_approval";
}

/** Money fields, by the names the four documents use for them. */
const AMOUNT_FIELDS = new Set([
  "totalAmount",
  "subtotal",
  "taxAmount",
  "discount",
  "discountAmount",
  "paidAmount",
]);

/** Reference fields that store an id but need to read as a name. */
const REFERENCE_FIELDS = new Set(["customerId", "supplierId", "projectId"]);

/**
 * Dates are compared and stored as YYYY-MM-DD.
 *
 * The columns are not consistent across the four documents — sales invoices and
 * quotations use timestamp({ mode: "string" }) while purchase invoices use the
 * Date-mode default — so without this the same edit reads as "2026-08-12" on
 * one document and "Tue Aug 12 2026 00:00:00 GMT+0400" on another.
 */
function toDateOnly(value: any): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return String(value);
  return parsed.toISOString().split("T")[0];
}

function isDateField(field: string) {
  return /date$|Date$|validUntil/.test(field);
}

/**
 * Diff two PERSISTED rows.
 *
 * Both sides must come from the database, never from the request: the server
 * recomputes subtotal / discount / taxAmount / totalAmount (VAT on the
 * discounted base), so a payload holds pre-recompute values that were never
 * stored, and diffing against it records changes that did not happen.
 */
export function diffDocumentFields(
  existing: Record<string, any>,
  updated: Record<string, any>,
  fieldsToTrack: string[],
): DocumentChanges {
  const changes: DocumentChanges = {};

  for (const field of fieldsToTrack) {
    const oldVal = existing?.[field];
    const newVal = updated?.[field];

    if (isDateField(field)) {
      const oldDate = toDateOnly(oldVal);
      const newDate = toDateOnly(newVal);
      if (oldDate !== newDate) {
        changes[field] = { old: oldDate, new: newDate };
      }
      continue;
    }

    if (String(oldVal ?? "") !== String(newVal ?? "")) {
      const change: FieldChange = { old: oldVal, new: newVal };
      if (AMOUNT_FIELDS.has(field)) change.isAmount = true;
      changes[field] = change;
    }
  }

  return changes;
}

/**
 * Resolve the names behind any reference ids that changed, so the history reads
 * "Acme Marine → Gulf Steel" rather than "12 → 15". Looked up once, at write
 * time, and stored alongside the id: a customer renamed next year must not
 * rewrite what this edit said.
 */
export async function labelReferenceChanges(changes: DocumentChanges) {
  for (const field of Object.keys(changes)) {
    if (!REFERENCE_FIELDS.has(field)) continue;
    const change = changes[field] as FieldChange;
    change.oldLabel = await lookupReferenceName(field, change.old);
    change.newLabel = await lookupReferenceName(field, change.new);
  }
  return changes;
}

async function lookupReferenceName(
  field: string,
  id: any,
): Promise<string | null> {
  if (id === null || id === undefined || id === "") return null;
  const numericId = Number(id);
  if (isNaN(numericId)) return null;

  try {
    if (field === "customerId") {
      const customer = await storage.getCustomer(numericId);
      return customer?.name ?? null;
    }
    if (field === "supplierId") {
      const supplier = await storage.getSupplier(numericId);
      return supplier?.name ?? null;
    }
    if (field === "projectId") {
      // Projects are titled, not named.
      const project = await storage.getProject(numericId);
      return project?.title ?? null;
    }
  } catch {
    // A name is a nicety on top of the id, which is already recorded. A lookup
    // that fails must not cost the caller its history row.
    return null;
  }
  return null;
}

const num = (value: any): string => {
  if (value === null || value === undefined || value === "") return "0";
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? String(value) : String(parsed);
};

/**
 * Project a line onto one shape, whichever side it came from.
 *
 * Sales items are plain JSON objects on the parent row; purchase items are
 * child-table rows carrying id / invoiceId / createdAt that the JSON side has
 * no equivalent for. Comparing them raw is what made every purchase edit report
 * its line items as changed.
 */
function toSnapshot(item: any): LineSnapshot {
  return {
    description: String(item?.description ?? "").trim(),
    quantity: num(item?.quantity),
    unitPrice: num(item?.unitPrice),
    discount: num(item?.discount),
    discountType: String(item?.discountType ?? "amount"),
    taxRate: num(item?.taxRate),
    taxAmount: num(item?.taxAmount),
    lineTotal: num(item?.lineTotal),
  };
}

const COMPARED_LINE_FIELDS: Array<keyof LineSnapshot> = [
  "quantity",
  "unitPrice",
  "discount",
  "discountType",
  "taxRate",
  "taxAmount",
  "lineTotal",
];

/**
 * Diff line items into added / removed / changed.
 *
 * Lines are matched by description, and duplicates of the same description are
 * matched in the order they appear. Ids are deliberately not used: sales items
 * are JSON with no id at all, and purchase items are deleted and reinserted on
 * every update, so their ids change even when the line did not.
 *
 * The consequence is that editing a description reads as one line removed and
 * another added rather than as a description change. That is the honest result
 * of description being the only stable key across all four documents, and it
 * still shows the reader exactly what the document said before and after.
 *
 * Returns null when nothing changed.
 */
export function diffLineItems(
  oldItems: any[] | null | undefined,
  newItems: any[] | null | undefined,
): LineItemsDetail | null {
  const oldSnaps = (Array.isArray(oldItems) ? oldItems : []).map(toSnapshot);
  const newSnaps = (Array.isArray(newItems) ? newItems : []).map(toSnapshot);

  const detail: LineItemsDetail = { added: [], removed: [], changed: [] };
  const unmatchedNew = newSnaps.map((snap, index) => ({ snap, index }));
  const claimed = new Set<number>();

  for (const oldSnap of oldSnaps) {
    const match = unmatchedNew.find(
      (candidate) =>
        !claimed.has(candidate.index) &&
        candidate.snap.description.toLowerCase() ===
          oldSnap.description.toLowerCase(),
    );

    if (!match) {
      detail.removed.push(oldSnap);
      continue;
    }

    claimed.add(match.index);
    const fields: Record<string, { old: string; new: string }> = {};
    for (const field of COMPARED_LINE_FIELDS) {
      if (oldSnap[field] !== match.snap[field]) {
        fields[field] = { old: oldSnap[field], new: match.snap[field] };
      }
    }
    if (Object.keys(fields).length > 0) {
      detail.changed.push({ description: oldSnap.description, fields });
    }
  }

  for (const candidate of unmatchedNew) {
    if (!claimed.has(candidate.index)) detail.added.push(candidate.snap);
  }

  if (
    detail.added.length === 0 &&
    detail.removed.length === 0 &&
    detail.changed.length === 0
  ) {
    return null;
  }
  return detail;
}

/**
 * Add an `items` entry to a changes map when the lines actually moved.
 *
 * `old` and `new` are kept as the raw arrays so the row remains a full record
 * of what the document held, and `detail` carries the breakdown the Activity
 * tab renders. Both sides must be persisted rows.
 */
export function addLineItemChanges(
  changes: DocumentChanges,
  oldItems: any[] | null | undefined,
  newItems: any[] | null | undefined,
) {
  const detail = diffLineItems(oldItems, newItems);
  if (!detail) return changes;
  changes["items"] = { old: oldItems ?? [], new: newItems ?? [], detail };
  return changes;
}

/**
 * Attachments are part of the document, so adding or removing one is an edit
 * like any other. Recorded as filename lists — the files themselves live on
 * disk and are already reachable from the document.
 */
export function addAttachmentChanges(
  changes: DocumentChanges,
  oldFiles: any[] | null | undefined,
  newFiles: any[] | null | undefined,
) {
  const names = (files: any[] | null | undefined) =>
    (Array.isArray(files) ? files : [])
      .map((file) =>
        String(
          file?.fileName ?? file?.originalname ?? file?.filename ?? file ?? "",
        ),
      )
      .filter(Boolean);

  const oldNames = names(oldFiles);
  const newNames = names(newFiles);

  const added = newNames.filter((name) => !oldNames.includes(name));
  const removed = oldNames.filter((name) => !newNames.includes(name));
  if (added.length === 0 && removed.length === 0) return changes;

  changes["attachments"] = {
    old: oldNames,
    new: newNames,
    detail: { added, removed },
  };
  return changes;
}

/**
 * Write the history row.
 *
 * The editor's name is resolved the same way the approval trails resolve theirs
 * — employee full name, falling back to the username — so the same person does
 * not appear under two different names in the two halves of one Activity block.
 */
export async function recordDocumentEdit(params: {
  invoiceType: string;
  invoiceId: number;
  editNote: string;
  changes: DocumentChanges;
  userId: number | null | undefined;
}) {
  const { invoiceType, invoiceId, editNote, changes, userId } = params;
  const editedByName = userId
    ? await storage.getUserDisplayName(userId)
    : null;

  return storage.createInvoiceEditHistory({
    invoiceType,
    invoiceId,
    editNote: editNote.trim(),
    changes: Object.keys(changes).length > 0 ? changes : null,
    editedBy: userId || null,
    editedByName,
  });
}
