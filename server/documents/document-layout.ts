import {
  getCommonStyles,
  generateCommonHeader,
  generateCommonFooter,
} from "../document-utils";
import { sanitize } from "./sanitize";
import {
  computeDocumentTotals,
  type DocumentTotals,
} from "@shared/document-totals";

/**
 * The shared layout every sales and purchase document prints through.
 *
 * All six documents — quotation, proforma, sales invoice, credit note,
 * purchase order, purchase invoice — are the same page in the client's own
 * templates: a title and number, a party block against a column of meta rows,
 * a subject line, the item table, totals, a tax summary banded by rate, then
 * Notes and Terms. Only the wording, the meta rows and one or two columns
 * differ. They were six separate files repeating that page, which is why the
 * same VAT bug existed five times over: each copy computed
 * `quantity × unitPrice + tax`, charging VAT on the gross and overstating it by
 * the tax on any discount given.
 *
 * Nothing here recalculates money. Every figure comes from
 * computeDocumentTotals, the same engine the forms and the ledger use, so a
 * printed document and its ledger entries cannot disagree.
 *
 * Following the client's format, figures inside the item table carry NO
 * currency code — it is stated in the totals block and the tax summary instead,
 * which keeps the table readable and lets Description take the slack.
 */

export interface DocumentParty {
  /** "Bill To", "Vendor Address", "Deliver To" … */
  label: string;
  name?: string;
  address?: string;
  phone?: string;
  vatNumber?: string;
}

export interface DocumentMetaRow {
  key: string;
  value: string;
}

/** A totals row beyond the standard set, e.g. Paid / Balance Due. */
export interface DocumentTotalRow {
  key: string;
  value: string;
  /** Tinted, for the one row that matters most on the page. */
  emphasis?: boolean;
}

export interface DocumentSection {
  heading: string;
  /**
   * Raw stored HTML or text; sanitized here, so callers must not pre-escape.
   * More than one body shares a single heading — an invoice prints its bank
   * details beneath Terms & Conditions rather than under a heading of their
   * own. Empty bodies are dropped, and a section whose bodies are all empty
   * prints no heading.
   */
  bodies: Array<string | null | undefined>;
}

export interface RenderDocumentOptions {
  company: any;
  /** Printed at the top right, e.g. "TAX INVOICE", "QUOTE", "PURCHASE ORDER". */
  title: string;
  /** Browser/tab title. */
  htmlTitle: string;
  documentNumber?: string;
  /**
   * A document that has not been approved is not the thing its title claims —
   * it has posted nothing and can still change. Muting the title keeps a reader
   * skimming the page from mistaking a working document for a committed one.
   */
  draft?: boolean;
  /**
   * A cancelled document has been reversed and is not payable or actionable.
   * Unlike a draft it may already be in the counterparty's hands, so the title
   * is printed in red rather than merely muted — grey reads as "not final yet",
   * which is the opposite of what a void document needs to say.
   *
   * Takes precedence over `draft`: a cancelled document is never a draft.
   */
  cancelled?: boolean;
  currency: string;
  /**
   * The document's rate against AED, as stored. Used only by the tax summary,
   * which states its figures in AED whatever currency the document is priced
   * in — see the conversion in renderDocument. Absent or unusable on a
   * non-AED document, the summary stays in the document's own currency.
   */
  exchangeRate?: string | number | null;
  /** The figure worth reading first: Balance Due on an invoice, Total elsewhere. */
  highlight?: { label: string; value: string };
  /** The company's own block sits left; these stack beneath it. */
  parties: DocumentParty[];
  meta: DocumentMetaRow[];
  subject?: string;
  items: any[];
  totals: DocumentTotals;
  /** Appended after Total, before the tax summary. */
  extraTotalRows?: DocumentTotalRow[];
  /** Notes, Terms & Conditions, bank details … rendered in order, blanks skipped. */
  sections: DocumentSection[];
}

const val = (v: any) =>
  v === "null" || v === null || v === undefined ? "" : v;

/**
 * Totals for a stored document, resolving the header discount the way the forms
 * do: a percentage when one is set, otherwise the stored amount.
 */
export function documentTotalsFor(doc: any, items: any[]): DocumentTotals {
  const headerPct = parseFloat(doc?.discountPercentage || "0") || 0;
  return computeDocumentTotals(
    (Array.isArray(items) ? items : []).map((it) => ({
      quantity: Number(it.quantity) || 0,
      unitPrice: Number(it.unitPrice) || 0,
      taxRate: Number(it.taxRate) || 0,
      discount: Number(it.discount) || 0,
      discountType: it.discountType === "percentage" ? "percentage" : "amount",
    })),
    headerPct > 0
      ? { discount: headerPct, discountType: "percentage" as const }
      : {
          discount:
            parseFloat(doc?.discount ?? doc?.discountAmount ?? "0") || 0,
          discountType: "amount" as const,
        },
  );
}

/** Plain grouped number — the item table repeats no currency code. */
export function num(amount: string | number): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export function moneyIn(currency: string) {
  return (amount: string | number) => `${currency}${num(amount)}`;
}

export function formatDocumentDate(
  date: string | Date | null | undefined,
): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function renderDocument(opts: RenderDocumentOptions): string {
  const {
    company,
    title,
    htmlTitle,
    documentNumber,
    draft,
    cancelled,
    currency,
    exchangeRate,
    highlight,
    parties,
    meta,
    subject,
    items,
    totals,
    extraTotalRows = [],
    sections,
  } = opts;

  const money = moneyIn(currency);

  // The tax summary states its figures in AED even when the document is priced
  // in another currency: the tax is owed in dirhams, and a summary that names
  // only the foreign amount leaves the reader — and the FTA — to do the
  // conversion themselves. Everything else on the page stays in the document's
  // own currency, so the item table and the totals block are untouched.
  //
  // The rate has to be a usable number for that. Without one, converting would
  // mean printing the document's own amounts relabelled AED, which is worse
  // than staying in the document currency and claiming nothing about dirhams.
  const rate = Number(exchangeRate);
  const toAED =
    currency !== "AED" && Number.isFinite(rate) && rate > 0 ? rate : null;
  const taxCurrency = toAED ? "AED" : currency;
  const taxMoney = moneyIn(taxCurrency);
  const inAED = (amount: number) => (toAED ? amount * toAED : amount);

  // The Discount column only appears when something was actually discounted,
  // so an ordinary document keeps the wider Description of the client's format.
  const anyDiscount = totals.discountTotal > 0.005;

  // Tax stated per rate band. A tax document has to show the tax charged at
  // each rate, which a single aggregate figure cannot do once the lines mix
  // standard and zero-rated work.
  const byRate = new Map<number, { taxable: number; tax: number }>();
  items.forEach((it, i) => {
    const line = totals.lines[i];
    if (!line) return;
    const rate = Number(it.taxRate) || 0;
    const bucket = byRate.get(rate) || { taxable: 0, tax: 0 };
    bucket.taxable += line.taxable;
    bucket.tax += line.taxAmount;
    byRate.set(rate, bucket);
  });
  const rateBands = Array.from(byRate.entries()).sort((a, b) => a[0] - b[0]);
  const rateLabel = (rate: number) =>
    rate === 0 ? "Zero Rate (0%)" : `Standard Rate (${rate}%)`;

  const partyBlocks = parties
    .filter((p) => val(p.name) || val(p.address))
    .map(
      (p) => `
              <div style="margin-bottom: 10px;">
                <p class="doc-party-h">${p.label}</p>
                ${val(p.name) ? `<p style="margin:0; font-size: 11px;"><strong>${val(p.name)}</strong></p>` : ""}
                ${val(p.address) ? `<p style="margin:0; font-size: 11px; white-space: pre-wrap;">${val(p.address)}</p>` : ""}
                ${val(p.phone) ? `<p style="margin:0; font-size: 11px;">PH: ${val(p.phone)}</p>` : ""}
                ${val(p.vatNumber) ? `<p style="margin:0; font-size: 11px;"><strong>TRN:</strong> ${val(p.vatNumber)}</p>` : ""}
              </div>`,
    )
    .join("");

  const sectionBlocks = sections
    .map((s) => ({ heading: s.heading, bodies: s.bodies.filter((b) => val(b)) }))
    .filter((s) => s.bodies.length > 0)
    .map(
      (s) => `
              <div class="doc-keep">
                <div class="doc-section-h">${s.heading}</div>
                ${s.bodies
                  .map(
                    (b, i) =>
                      `<div class="rich-text-content doc-block"${i > 0 ? ' style="margin-top:6px;"' : ""}>${sanitize(String(b))}</div>`,
                  )
                  .join("")}
              </div>`,
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${htmlTitle}</title>
      ${getCommonStyles()}
      <style>
        /* Palette. Kept as variables so a rebrand is one block to edit rather
           than a hunt through the rules below.
           --brand matches the shared letterhead in document-utils.ts. The two
           have to change together or the page carries a letterhead in one blue
           and a body in another. */
        :root {
          --brand:      #1328B8;  /* title, document number */
          --navy:       #0A175F;  /* headings, totals */
          --tint:       #EAF0FF;  /* table header fill */
          --stripe:     #F6F7FA;  /* alternate rows */
          --rule:       #D8DEE8;  /* borders */
          --ink:        #2C2C2C;  /* body text */
          --ink-muted:  #5A6270;
          --danger:     #B42318;  /* cancelled title — same red the app uses */
        }
        body { color: var(--ink); }
        .doc-title { font-size: 22px; letter-spacing: 3px; font-weight: 700; text-align: right; margin: 0; color: var(--brand); }
        .doc-title.doc-draft { color: var(--ink-muted); }
        .doc-title.doc-cancelled { color: var(--danger); }
        .doc-number { text-align: right; font-size: 12px; margin: 2px 0 14px; color: var(--brand); font-weight: 600; }
        .doc-highlight { text-align: right; margin-bottom: 18px; }
        .doc-highlight .label { font-size: 11px; color: var(--ink-muted); }
        .doc-highlight .value { font-size: 16px; font-weight: 700; color: var(--navy); }
        .doc-parties { width: 100%; border-collapse: collapse; border: none !important; margin-bottom: 14px; }
        .doc-parties td { border: none !important; vertical-align: top; padding: 0; font-size: 11px; }
        .doc-meta { width: 100%; border-collapse: collapse; border: none !important; }
        .doc-meta td { border: none !important; padding: 2px 0; font-size: 11px; }
        .doc-meta .k { color: var(--ink-muted); text-align: right; padding-right: 10px; white-space: nowrap; }
        .doc-meta .v { text-align: right; white-space: nowrap; font-weight: 600; color: var(--navy); }
        .doc-subject { font-size: 11px; margin: 6px 0 14px; }
        .doc-subject .k { font-weight: 700; color: var(--navy); }
        .doc-party-h { margin: 0 0 2px; font-size: 11px; font-weight: 700; color: var(--navy); }
        table.doc-items { width: 100%; border-collapse: collapse; table-layout: fixed; border: 1px solid var(--rule); }
        table.doc-items th { background: var(--tint); color: var(--navy); font-size: 10px; font-weight: 700; padding: 7px 6px; text-align: right; border-bottom: 1px solid var(--rule); }
        table.doc-items th.l { text-align: left; }
        table.doc-items td { font-size: 10.5px; padding: 7px 6px; vertical-align: top; text-align: right; border-bottom: 1px solid var(--rule); }
        /* Zebra shading is a reading aid only — it carries no meaning, which
           matters because these two tints are ~4 greyscale levels apart and
           effectively vanish on a black-and-white printer. */
        table.doc-items tbody tr:nth-child(even) td { background: var(--stripe); }
        table.doc-items td.l { text-align: left; white-space: pre-wrap; word-break: break-word; }
        table.doc-items td.c { text-align: center; }
        .doc-taxrate { display: block; font-size: 9px; color: var(--ink-muted); }
        .doc-totals { width: 62%; margin-left: auto; border-collapse: collapse; border: none !important; margin-top: 8px; page-break-inside: avoid; break-inside: avoid; }
        .doc-totals td { border: none !important; font-size: 11px; padding: 4px 6px; }
        .doc-totals td.k { text-align: right; color: var(--ink-muted); }
        .doc-totals td.v { text-align: right; width: 130px; font-weight: 600; color: var(--navy); }
        .doc-totals tr.grand td { border-top: 1px solid var(--rule) !important; font-size: 12.5px; font-weight: 700; color: var(--navy); }
        .doc-totals tr.due td { background: var(--tint); font-weight: 700; color: var(--navy); }
        .doc-taxsummary { width: 100%; border-collapse: collapse; margin-top: 6px; border: 1px solid var(--rule); }
        .doc-taxsummary th { background: var(--tint); color: var(--navy); font-size: 10px; font-weight: 700; padding: 6px; text-align: right; border-bottom: 1px solid var(--rule); }
        .doc-taxsummary th.l { text-align: left; }
        .doc-taxsummary td { font-size: 10.5px; padding: 6px; text-align: right; border-bottom: 1px solid var(--rule); }
        .doc-taxsummary td.l { text-align: left; }
        .doc-taxsummary tr.tot td { font-weight: 700; border-top: 1px solid var(--rule); color: var(--navy); }
        .doc-fxnote { margin: 2px 0 0; font-size: 10px; color: var(--ink-muted); text-align: right; }
        .doc-section-h { font-size: 12px; font-weight: 700; margin: 18px 0 4px; color: var(--navy); }
        .doc-block { font-size: 10.5px; white-space: pre-wrap; }
        .doc-keep { page-break-inside: avoid; break-inside: avoid; }
      </style>
    </head>
    <body>
      ${generateCommonHeader({ company })}
      <table class="report-wrapper" style="width: 100%; border-collapse: collapse; border: none !important;">
        <thead>
          <tr><td style="border: none !important; padding: 0 !important;"><div class="report-header-space"></div>
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="report-content-cell">

              <h1 class="doc-title${cancelled ? " doc-cancelled" : draft ? " doc-draft" : ""}">${title}</h1>
              ${documentNumber ? `<p class="doc-number"># ${val(documentNumber)}</p>` : ""}

              ${
                highlight
                  ? `<div class="doc-highlight">
                <div class="label">${highlight.label}</div>
                <div class="value">${highlight.value}</div>
              </div>`
                  : ""
              }

              <table class="doc-parties">
                <tr>
                  <td style="width: 55%;">
                    <p style="margin:0 0 2px;"><strong>${val(company?.name)}</strong></p>
                    <p style="margin:0; white-space: pre-wrap;">${val(company?.address)}</p>
                    ${val(company?.email) ? `<p style="margin:0;">${val(company.email)}</p>` : ""}
                    ${val(company?.vatNumber) ? `<p style="margin:2px 0 0;"><strong>TRN:</strong> ${val(company.vatNumber)}</p>` : ""}
                  </td>
                  <td style="width: 45%;">
                    <table class="doc-meta">
                      ${meta
                        .filter((m) => val(m.value))
                        .map(
                          (m) =>
                            `<tr><td class="k">${m.key} :</td><td class="v">${val(m.value)}</td></tr>`,
                        )
                        .join("")}
                    </table>
                  </td>
                </tr>
              </table>

              ${partyBlocks}

              ${
                val(subject)
                  ? `<div class="doc-subject"><span class="k">Subject :</span><br />${val(subject)}</div>`
                  : ""
              }

              <table class="doc-items">
                <colgroup>
                  <col style="width: 26px;" />
                  <col />
                  <col style="width: 46px;" />
                  <col style="width: 74px;" />
                  ${anyDiscount ? `<col style="width: 68px;" />` : ""}
                  <col style="width: 82px;" />
                  <col style="width: 62px;" />
                  <col style="width: 82px;" />
                </colgroup>
                <thead>
                  <tr>
                    <th class="l">#</th>
                    <th class="l">Item &amp; Description</th>
                    <th>Qty</th>
                    <th>Rate (${currency})</th>
                    ${anyDiscount ? `<th>Discount (${currency})</th>` : ""}
                    <th>Taxable Amount (${currency})</th>
                    <th>Tax (${currency})</th>
                    <th>Amount (${currency})</th>
                  </tr>
                </thead>
                <tbody>
                  ${items
                    .map((item: any, i: number) => {
                      const line = totals.lines[i];
                      if (!line) return "";
                      const rate = Number(item.taxRate) || 0;
                      // The line's own discount plus its share of the header
                      // discount, so the taxable amount is never smaller than
                      // rate × qty with nothing on the page accounting for it.
                      const shownDiscount =
                        line.lineDiscount + line.headerDiscountShare;
                      return `
                    <tr>
                      <td class="c">${i + 1}</td>
                      <!-- pre-wrap is set inline as well as on .l: descriptions
                           are multi-line and the guarantee that newlines survive
                           into the PDF should not depend on a stylesheet rule
                           someone could edit from a distance. -->
                      <td class="l" style="white-space: pre-wrap;">${val(item.description)}</td>
                      <td>${val(item.quantity)}</td>
                      <td>${num(item.unitPrice)}</td>
                      ${anyDiscount ? `<td>${shownDiscount > 0.005 ? num(shownDiscount) : "-"}</td>` : ""}
                      <td>${num(line.taxable)}</td>
                      <td>${num(line.taxAmount)}<span class="doc-taxrate">${rate}%</span></td>
                      <td>${num(line.lineTotal)}</td>
                    </tr>`;
                    })
                    .join("")}
                </tbody>
              </table>

              <table class="doc-totals">
                ${
                  anyDiscount
                    ? `
                <tr><td class="k">Gross</td><td class="v">${num(totals.gross)}</td></tr>
                <tr><td class="k">Discount</td><td class="v">-${num(totals.discountTotal)}</td></tr>`
                    : ""
                }
                <tr><td class="k">Sub Total</td><td class="v">${num(totals.taxableTotal)}</td></tr>
                <tr><td class="k">Tax</td><td class="v">${num(totals.taxTotal)}</td></tr>
                <tr class="grand"><td class="k">Total</td><td class="v">${money(totals.total)}</td></tr>
                ${extraTotalRows
                  .map(
                    (r) =>
                      `<tr${r.emphasis ? ' class="due"' : ""}><td class="k">${r.key}</td><td class="v">${r.value}</td></tr>`,
                  )
                  .join("")}
              </table>

              <div class="doc-keep">
                <div class="doc-section-h">Tax Summary</div>
                <table class="doc-taxsummary">
                  <thead>
                    <tr>
                      <th class="l">Tax Details</th>
                      <th>Taxable Amount (${taxCurrency})</th>
                      <th>Tax Amount (${taxCurrency})</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rateBands
                      .map(
                        ([rate, b]) => `
                    <tr>
                      <td class="l">${rateLabel(rate)}</td>
                      <td>${num(inAED(b.taxable))}</td>
                      <td>${num(inAED(b.tax))}</td>
                    </tr>`,
                      )
                      .join("")}
                    <tr class="tot">
                      <td class="l">Total</td>
                      <td>${taxMoney(inAED(totals.taxableTotal))}</td>
                      <td>${taxMoney(inAED(totals.taxTotal))}</td>
                    </tr>
                  </tbody>
                </table>
                ${
                  toAED
                    ? `<p class="doc-fxnote">Exchange Rate: 1 ${currency} = ${val(exchangeRate)} AED</p>`
                    : ""
                }
              </div>

              ${sectionBlocks}

            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr><td style="border: none !important; padding: 0 !important;"><div class="report-footer-space"></div>
            </td>
          </tr>
        </tfoot>
      </table>
      ${generateCommonFooter({ company })}
    </body>
    </html>
  `;
}
