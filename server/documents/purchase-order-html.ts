import {
  renderDocument,
  documentTotalsFor,
  formatDocumentDate,
  moneyIn,
} from "./document-layout";

/**
 * Purchase order PDF, on the shared layout the sales invoice uses.
 *
 * Two things changed when it moved onto that layout. Figures now come from
 * computeDocumentTotals, so VAT is charged on the discounted base — the old
 * template printed `quantity × unitPrice + tax`, taxing the gross and
 * overstating VAT by the tax on any discount given. And the Deliver To and
 * Terms & Conditions blocks the client's own format carries now have somewhere
 * to print, having recently gained columns to be stored in.
 */
export function generatePurchaseOrderHTML(
  order: any,
  supplier: any,
  company: any,
): string {
  const val = (v: any) =>
    v === "null" || v === null || v === undefined ? "" : v;

  const currency = order.currency || supplier?.currency || "AED";
  const money = moneyIn(currency);

  // Purchase order lines live in a child table joined to inventory_items. A
  // stocked line carries its name on the joined inventory item rather than in
  // its own description column — five such lines exist today, and they printed
  // an empty Description cell — so resolve the two into the one field the
  // layout prints. The unit rides with the quantity, which the layout treats as
  // a display value; the totals below are computed from the raw items, so the
  // label cannot affect any figure.
  const raw: any[] = Array.isArray(order.items) ? order.items : [];
  const totals = documentTotalsFor(order, raw);
  const items = raw.map((item: any) => ({
    ...item,
    description:
      item.itemType === "product"
        ? [val(item.inventoryItemName), val(item.inventoryItemDescription)]
            .filter(Boolean)
            .join("\n") || val(item.description)
        : val(item.description),
    quantity: val(item.inventoryItemUnit)
      ? `${val(item.quantity)} ${val(item.inventoryItemUnit)}`
      : val(item.quantity),
  }));

  // An order that has not been approved commits the company to nothing yet,
  // so it should not present itself as a purchase order a supplier can act on.
  const status = String(order.status || "").toLowerCase();
  const isApproved =
    status !== "draft" && status !== "pending_approval" && status !== "rejected";

  return renderDocument({
    company,
    title: isApproved ? "PURCHASE ORDER" : "DRAFT PURCHASE ORDER",
    htmlTitle: `${isApproved ? "Purchase Order" : "Draft Purchase Order"} ${val(order.poNumber)}`,
    documentNumber: val(order.poNumber),
    draft: !isApproved,
    currency,
    highlight: { label: "Order Total", value: money(totals.total) },
    parties: [
      {
        label: "Vendor",
        name: val(supplier?.name),
        address: val(supplier?.address),
        phone: val(supplier?.phone),
        // TRN falls back to Tax ID: the two fields both exist on the
        // counterparty and most records carry only the latter, so printing
        // vatNumber alone left the TRN off nearly every document.
        vatNumber: val(supplier?.vatNumber) || val(supplier?.taxId),
      },
      // Free text rather than a structured address: deliveries go to vessels
      // and work sites as often as to the office. Absent when not set — an
      // order with no delivery address is valid.
      { label: "Deliver To", address: val(order.deliverTo) },
    ],
    meta: [
      { key: "Order Date", value: formatDocumentDate(order.orderDate) },
      {
        key: "Expected Delivery",
        value: formatDocumentDate(order.expectedDeliveryDate),
      },
      { key: "Payment Terms", value: val(order.paymentTerms) },
      { key: "Delivery Terms", value: val(order.deliveryTerms) },
      {
        key: "Project",
        value: val(order.projectName) || val(order.projectId),
      },
      {
        key: "Exchange Rate",
        value:
          currency !== "AED" && val(order.exchangeRate)
            ? `1 ${currency} = ${val(order.exchangeRate)} AED`
            : "",
      },
    ],
    subject: val(order.subject),
    items,
    totals,
    sections: [
      { heading: "Notes", bodies: [order.notes] },
      {
        heading: "Terms &amp; Conditions",
        bodies: [order.termsAndConditions, order.bankAccount],
      },
    ],
  });
}
