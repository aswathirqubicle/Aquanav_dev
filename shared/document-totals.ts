/**
 * Document totals — the ONE place VAT, discounts and totals are computed, shared
 * by the document forms (client) and the server-side validation, so the two can
 * never drift.
 *
 * Order of operations (P4b + line-item discounts):
 *   1. line discount applies first     → lineNet = qty×price − lineDiscount
 *   2. header discount apportions pro-rata across the line nets
 *   3. VAT per line on its discounted amount:
 *          tax = rate × (lineNet − its header-discount share)
 *   4. document VAT = Σ rounded line taxes; the total is derived from the same
 *      rounded figures, so it balances to the cent.
 *
 * Per UAE VAT law, tax is charged on the DISCOUNTED consideration — hence the
 * discount reaches the tax base here, unlike the old per-line-gross calculation.
 */

export type DiscountType = "percentage" | "amount";

export interface LineItemInput {
  quantity: number;
  unitPrice: number;
  /** Percent. 0 / undefined → the line carries no VAT. */
  taxRate?: number;
  /** The line discount value; read according to `discountType`. */
  discount?: number;
  /** How to read `discount`. Defaults to a fixed "amount". */
  discountType?: DiscountType;
}

export interface HeaderDiscountInput {
  discount?: number;
  discountType?: DiscountType;
}

export interface LineTotals {
  gross: number; // qty × unitPrice
  lineDiscount: number; // the resolved line discount amount
  afterLineDiscount: number; // gross − lineDiscount
  headerDiscountShare: number; // this line's share of the header discount
  taxable: number; // afterLineDiscount − headerDiscountShare (the VAT base)
  taxAmount: number; // rounded to 2dp
  lineTotal: number; // taxable + taxAmount
}

export interface DocumentTotals {
  lines: LineTotals[];
  gross: number; // Σ gross
  lineDiscountTotal: number; // Σ line discounts
  headerDiscount: number; // the resolved header discount amount
  discountTotal: number; // lineDiscountTotal + headerDiscount
  taxableTotal: number; // Σ taxable (subtotal net of all discounts)
  taxTotal: number; // Σ line taxAmount
  total: number; // taxableTotal + taxTotal
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Resolve a discount value (percentage or fixed) against a base, never below 0. */
function resolveDiscount(
  base: number,
  value: number | undefined,
  type: DiscountType | undefined,
): number {
  const v = value ?? 0;
  if (v <= 0 || base <= 0) return 0;
  const amount = type === "percentage" ? (base * v) / 100 : v;
  return round2(Math.min(amount, base));
}

/**
 * Distribute `total` across `weights`, each rounded to 2dp, with the rounding
 * remainder placed on the largest-weight line so the parts sum to `total` to the
 * cent. All-zero weights (or a zero total) yield all zeros.
 */
export function apportion(weights: number[], total: number): number[] {
  const n = weights.length;
  if (n === 0 || total === 0) return weights.map(() => 0);
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => round2((total * w) / sum));
  const diff = round2(total - raw.reduce((s, v) => s + v, 0));
  if (diff !== 0) {
    let largest = 0;
    for (let i = 1; i < weights.length; i++) {
      if (weights[i] > weights[largest]) largest = i;
    }
    raw[largest] = round2(raw[largest] + diff);
  }
  return raw;
}

export function computeDocumentTotals(
  items: LineItemInput[],
  header: HeaderDiscountInput = {},
): DocumentTotals {
  // 1. line discounts
  const base = items.map((it) => {
    const gross = round2((it.quantity || 0) * (it.unitPrice || 0));
    const lineDiscount = resolveDiscount(gross, it.discount, it.discountType);
    return {
      it,
      gross,
      lineDiscount,
      afterLineDiscount: round2(gross - lineDiscount),
    };
  });

  const afterLineTotal = round2(
    base.reduce((s, b) => s + b.afterLineDiscount, 0),
  );

  // 2. header discount, resolved then apportioned pro-rata over the line nets
  const headerDiscount = resolveDiscount(
    afterLineTotal,
    header.discount,
    header.discountType,
  );
  const shares = apportion(
    base.map((b) => b.afterLineDiscount),
    headerDiscount,
  );

  // 3. VAT per line on the discounted taxable amount
  const lines: LineTotals[] = base.map((b, i) => {
    const headerDiscountShare = shares[i];
    const taxable = round2(b.afterLineDiscount - headerDiscountShare);
    const rate = b.it.taxRate ?? 0;
    const taxAmount = round2((taxable * rate) / 100);
    return {
      gross: b.gross,
      lineDiscount: b.lineDiscount,
      afterLineDiscount: b.afterLineDiscount,
      headerDiscountShare,
      taxable,
      taxAmount,
      lineTotal: round2(taxable + taxAmount),
    };
  });

  // 4. totals from the same rounded per-line figures
  const gross = round2(base.reduce((s, b) => s + b.gross, 0));
  const lineDiscountTotal = round2(
    base.reduce((s, b) => s + b.lineDiscount, 0),
  );
  const taxableTotal = round2(lines.reduce((s, l) => s + l.taxable, 0));
  const taxTotal = round2(lines.reduce((s, l) => s + l.taxAmount, 0));

  return {
    lines,
    gross,
    lineDiscountTotal,
    headerDiscount,
    discountTotal: round2(lineDiscountTotal + headerDiscount),
    taxableTotal,
    taxTotal,
    total: round2(taxableTotal + taxTotal),
  };
}
