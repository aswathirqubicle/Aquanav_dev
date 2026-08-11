// Shared between the sales quotation and sales invoice pages.
//
// These two pages were one component until they were split onto separate
// routes. Only the pieces that were byte-identical and stateless moved here —
// the design tokens ported from the purchase document view, the status chip
// tones, the totals engine wrapper and the formatters. Anything holding state
// (the line-item staging form, the filter panels, the reset handlers) was
// deliberately left duplicated on each page rather than abstracted, because
// unifying it would mean reworking the item-editing code rather than moving it.
import { computeDocumentTotals } from "@shared/document-totals";
import { formatDisplayDate } from "@/lib/utils";


// Design tokens for the two view dialogs, ported from the purchase invoice
// view so a sales document reads the same way as a purchase one. Literal hex
// rather than the app's semantic tokens because the approved design fixes the
// palette; nothing in here follows a theme. Module scope rather than inline —
// the purchase file declares them inside its single dialog, but the quotation
// and invoice views would otherwise duplicate the lot between them.
export const DOC_CARD =
  "bg-white border border-[#E3E7EE] rounded-[10px] overflow-hidden print:bg-white print:border print:border-gray-300";
export const DOC_CARD_HEAD =
  "flex items-center gap-2.5 px-[18px] py-3 border-b border-[#EDF0F5]";
export const DOC_CARD_TITLE = "text-sm font-semibold text-[#171B23] print:text-black";
export const DOC_CARD_ICON = "w-[15px] h-[15px] shrink-0 text-[#8A93A3]";
export const DOC_CARD_BODY = "px-[18px] py-4";
export const DOC_ACC_TRIGGER =
  "px-[18px] py-3 hover:no-underline data-[state=open]:border-b data-[state=open]:border-[#EDF0F5]";
export const DOC_ACC_BODY = "px-[18px] pt-3.5 pb-4";
export const DOC_KV_ROW =
  "flex justify-between gap-3.5 py-2 text-[13.5px] border-b border-dashed border-[#EDF0F5] last:border-b-0 first:pt-0 last:pb-0";
export const DOC_KV_LABEL = "shrink-0 text-[#5B6472] print:text-gray-700";
export const DOC_KV_VAL =
  "min-w-0 text-right font-medium break-words print:text-black";
export const DOC_META_LABEL =
  "text-[10.5px] font-semibold tracking-[0.08em] uppercase text-[#8A93A3] mb-[3px] print:text-gray-700";
export const DOC_META_VALUE = "text-[14.5px] font-semibold text-[#171B23] print:text-black";
export const DOC_META_CELL =
  "flex-1 min-w-[150px] px-5 sm:px-6 py-3.5 border-r border-[#E3E7EE] last:border-r-0";
export const DOC_TH =
  "h-auto px-3.5 py-2.5 bg-[#F7F9FC] text-[10.5px] font-semibold tracking-[0.07em] uppercase text-[#8A93A3] whitespace-nowrap text-left align-middle print:bg-gray-100 print:text-black";
export const DOC_TD = "px-3.5 py-3 align-top print:text-black";
export const DOC_TDN =
  "px-3.5 py-3 align-top text-right text-[13px] print:text-black";
export const DOC_TROW =
  "flex justify-between items-baseline gap-4 py-[5px] print:text-black";
export const DOC_BTN =
  "inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors border bg-background h-auto gap-[7px] rounded-lg border-[#E3E7EE] px-[13px] py-[7px] text-[13.5px] text-[#171B23] hover:bg-[#F7F9FC] hover:border-[#D4DAE3] cursor-pointer";
export const DOC_COUNT =
  "text-[11.5px] font-semibold text-[#5B6472] bg-[#EDF0F5] rounded-full px-2.5 py-0.5";
export const DOC_PROSE = "text-[13.5px] leading-[1.65] text-[#333B47] print:text-black";
export const DOC_STAMP =
  "text-[11px] font-semibold tracking-[0.09em] uppercase px-[9px] py-[3px] rounded-[5px] border";
export const DOC_TIMELINE =
  "relative list-none pl-5 before:content-[''] before:absolute before:left-[5px] before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-[#EDF0F5]";
export const DOC_DOT = "absolute -left-5 top-[5px] w-3 h-3 rounded-full bg-white border-[3px]";

// Chip tones for the header stamps. Local on purpose — the list rows keep using
// getQuotationStatusBadge / getInvoiceStatusBadge, which must not change shape.
export const docStatusTone = (status: string) => {
  switch (status) {
    case "draft":
      return "text-[#5B6472] bg-[#F7F9FC] border-[#E3E7EE]";
    case "pending_approval":
      return "text-[#B54708] bg-[#FFFAEB] border-[#FEDF89]";
    case "approved":
    case "paid":
      return "text-[#027A48] bg-[#ECFDF3] border-[#A6F4C5]";
    case "rejected":
      return "text-[#B42318] bg-[#FEF3F2] border-[#F0C5C1]";
    case "cancelled":
      return "text-[#B42318] bg-[#F7F9FC] border-[#F0C5C1]";
    case "overdue":
      return "text-[#B42318] bg-[#FEF3F2] border-[#F0C5C1]";
    case "partially_paid":
      return "text-[#B54708] bg-[#FFFAEB] border-[#FEDF89]";
    case "unpaid":
      return "text-[#2B4ACB] bg-[#EEF2FE] border-[#DCE4FB]";
    case "converted":
      return "text-[#6941C6] bg-[#F4F3FF] border-[#D9D6FE]";
    default:
      return "text-[#5B6472] bg-[#F7F9FC] border-[#E3E7EE]";
  }
};

// Authoritative document totals (VAT on the discounted base, line + header
// discounts) via the shared engine — matches exactly what the server stores.
export const docTotals = (
  items: any[],
  discountPercentage?: string,
  discountAmount?: string,
) => {
  const pct = parseFloat(discountPercentage || "0") || 0;
  return computeDocumentTotals(
    (items || []).map((it) => ({
      quantity: Number(it.quantity) || 0,
      unitPrice: Number(it.unitPrice) || 0,
      taxRate: Number(it.taxRate) || 0,
      discount: Number(it.discount) || 0,
      discountType: it.discountType === "percentage" ? "percentage" : "amount",
    })),
    pct > 0
      ? { discount: pct, discountType: "percentage" }
      : { discount: parseFloat(discountAmount || "0") || 0, discountType: "amount" },
  );
};

export const formatCurrency = (amount: string | number, currency?: string) => {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return `${currency || "AED"} ${num.toFixed(2)}`;
};

// Bare number for the line-item columns. The document's currency is stated
// once on the key-facts band and again on the totals, so repeating it on
// every cell only crowds the table. Mirrors the purchase invoice view.
export const formatAmount = (amount: string | number) => {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return num.toFixed(2);
};

export const formatDate = (date: string | Date) => {
  return formatDisplayDate(date);
};
