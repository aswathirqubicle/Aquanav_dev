import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Eye, FileText, Ban, Pencil, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { insertCreditNoteSchema } from "@shared/schema";
import { z } from "zod";
import { printByUrl } from "@/lib/print-utils";
import { formatDateForInput, formatDisplayDate } from "@/lib/utils";
import { computeDocumentTotals } from "@shared/document-totals";

const createCreditNoteSchema = insertCreditNoteSchema.extend({
  creditNoteDate: z.string(),
  items: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
        taxRate: z.number().optional(),
        taxAmount: z.number().optional(),
        discount: z.number().optional(),
        discountType: z.enum(["amount", "percentage"]).optional(),
      }),
    )
    .default([]),
  subtotal: z.string().optional(),
  taxAmount: z.string().optional(),
  discountPercentage: z.string().optional(),
  discount: z.string().optional(),
  totalAmount: z.string().optional(),
  currency: z.string().default("AED"),
  exchangeRate: z.string().default("1"),
});

type CreditNoteFormData = z.infer<typeof createCreditNoteSchema>;

interface CreditNoteItem {
  description: string;
  quantity: number | "";
  unitPrice: number | "";
  taxRate: number | "";
  taxAmount: number;
  discount: number | "";
  discountType: "amount" | "percentage";
}

const emptyCreditNoteItem: CreditNoteItem = {
  description: "",
  quantity: 1,
  unitPrice: 0,
  taxRate: 0,
  taxAmount: 0,
  discount: 0,
  discountType: "amount",
};

const formatCurrency = (amount: string | number, currency?: string) => {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return `${currency || "AED"} ${num.toFixed(2)}`;
};

const CreditNoteForm = ({
  creditNote,
  onSubmit,
  salesInvoices,
  customers,
  selectedInvoiceId,
  isCreateOpen,
  editingCreditNote,
  isSubmitting,
  onCancel,
}: {
  creditNote?: any;
  onSubmit: (data: CreditNoteFormData) => void;
  salesInvoices: any[];
  customers: any[];
  selectedInvoiceId: number | null;
  isCreateOpen: boolean;
  editingCreditNote: any;
  isSubmitting: boolean;
  onCancel: () => void;
}) => {
  const { toast } = useToast();

  const [formData, setFormData] = useState<any>({
    salesInvoiceId: creditNote?.salesInvoiceId || selectedInvoiceId || 0,
    customerId: creditNote?.customerId || 0,
    status: creditNote?.status || "draft",
    creditNoteDate: formatDateForInput(creditNote?.creditNoteDate) || formatDateForInput(new Date()),
    billingAddress: creditNote?.billingAddress || "",
    bankAccount: creditNote?.bankAccount || "",
    reason: creditNote?.reason || "",
    items: creditNote?.items || [],
    subtotal: creditNote?.subtotal || "0.00",
    taxAmount: creditNote?.taxAmount || "0.00",
    discountPercentage: creditNote?.discountPercentage || "0",
    discount: creditNote?.discount || "0.00",
    totalAmount: creditNote?.totalAmount || "0.00",
    currency: creditNote?.currency || "AED",
    exchangeRate: creditNote?.exchangeRate || "1",
  });

  const [newItem, setNewItem] = useState<CreditNoteItem>({ ...emptyCreditNoteItem });

  // Index of the line being edited, or null when the form is adding a new one.
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const itemFormRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // Bring the staging form into view and put the cursor in Description, so
  // clicking Edit on a row far down the table doesn't leave the form off-screen.
  const focusItemForm = () => {
    itemFormRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    window.setTimeout(() => descriptionRef.current?.focus(), 0);
  };

  // Never carry a half-finished line edit across a dialog open or close. This
  // keys off the open state rather than the dialog's onOpenChange because Radix
  // only fires that for its own triggers (Escape, overlay, close button) — the
  // programmatic setIsCreateOpen / setEditingCreditNote calls in the cancel and
  // post-submit paths would otherwise leave the index pointing at a row that is
  // gone. This one form is shared by the create and the edit dialog.
  // Only reset when an edit was actually abandoned: clearing the index alone
  // would leave that row's values sitting in the staging form, so the next
  // "Add Item" would append a duplicate of it. A half-typed NEW item is left
  // untouched.
  useEffect(() => {
    if (editingItemIndex !== null) {
      cancelEditItem();
    }
  }, [isCreateOpen, editingCreditNote]);

  const selectedInvoice = salesInvoices.find((inv: any) => inv.id === formData.salesInvoiceId);

  useEffect(() => {
    if (selectedInvoice) {
      const selectedCustomer = Array.isArray(customers) ? customers.find((c: any) => c.id === selectedInvoice.customerId) : null;
      const invoiceCurrency = selectedInvoice.currency || selectedCustomer?.currency || "AED";
      const invoiceExchangeRate = selectedInvoice.exchangeRate || "1";
      setFormData(prev => ({
        ...prev,
        customerId: selectedInvoice.customerId || 0,
        billingAddress: selectedCustomer?.address || "",
        currency: invoiceCurrency,
        exchangeRate: invoiceExchangeRate,
      }));
      if (invoiceCurrency && invoiceCurrency !== "AED" && !selectedInvoice.exchangeRate) {
        fetch('/api/exchange-rates/lookup?from=' + invoiceCurrency + '&to=AED')
          .then(r => r.json())
          .then(data => {
            if (data.rate) {
              setFormData(prev => ({ ...prev, exchangeRate: String(data.rate) }));
            }
          })
          .catch(() => { });
      }
    }
  }, [selectedInvoice]);

  const calculateTotals = () => {
    // Authoritative totals via the shared engine (VAT on the discounted base;
    // line discount first, then header apportioned). Mirrors the server.
    const totals = computeDocumentTotals(
      (formData.items || []).map((it: any) => ({
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        taxRate: Number(it.taxRate) || 0,
        discount: Number(it.discount) || 0,
        discountType: it.discountType === "percentage" ? "percentage" : "amount",
      })),
      parseFloat(formData.discountPercentage || "0") > 0
        ? { discount: parseFloat(formData.discountPercentage || "0"), discountType: "percentage" as const }
        : { discount: parseFloat(formData.discount || "0"), discountType: "amount" as const },
    );

    setFormData((prev: any) => ({
      ...prev,
      subtotal: totals.gross.toFixed(2),
      taxAmount: totals.taxTotal.toFixed(2),
      totalAmount: totals.total.toFixed(2),
    }));
  };

  useEffect(() => {
    calculateTotals();
  }, [formData.items, formData.discount]);

  const creditNoteSubtotalValue = formData.items.reduce((sum: number, item: any) => sum + ((typeof item.quantity === 'number' ? item.quantity : 0) || 0) * ((typeof item.unitPrice === 'number' ? item.unitPrice : 0) || 0), 0);

  // Recalculate credit note discount when items or percentage changes
  useEffect(() => {
    const pct = parseFloat(formData.discountPercentage || "0") || 0;
    const calcDiscountValue = creditNoteSubtotalValue * pct / 100;
    const currentDiscountValue = parseFloat(formData.discount || "0");

    if (Math.abs(currentDiscountValue - calcDiscountValue) > 0.001) {
      setFormData((prev: any) => ({ ...prev, discount: calcDiscountValue.toString() }));
    }
  }, [creditNoteSubtotalValue, formData.discountPercentage]);

  const addItem = () => {
    if (!newItem.description.trim()) {
      toast({
        title: "Error",
        description: "Please enter an item description",
        variant: "destructive",
      });
      return;
    }

    const item = {
      ...newItem,
      quantity: newItem.quantity === "" ? 0 : newItem.quantity,
      unitPrice: newItem.unitPrice === "" ? 0 : newItem.unitPrice,
      taxRate: newItem.taxRate === "" ? 0 : newItem.taxRate,
      discount: newItem.discount === "" ? 0 : (newItem.discount || 0),
      discountType: newItem.discountType || "amount",
    };

    setFormData((prev: any) => ({
      ...prev,
      items:
        editingItemIndex === null
          ? [...prev.items, item]
          : prev.items.map((existing: any, i: number) =>
              i === editingItemIndex ? item : existing,
            ),
    }));

    setNewItem({ ...emptyCreditNoteItem });
    setEditingItemIndex(null);
  };

  // Load an existing line back into the staging form above the table. Saving
  // then replaces that row instead of appending a new one.
  const startEditItem = (index: number) => {
    const item = formData.items[index];
    if (!item) return;

    setNewItem({
      description: item.description || "",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate ?? 0,
      taxAmount: Number(item.taxAmount) || 0,
      discount: Number(item.discount) || 0,
      discountType: item.discountType === "percentage" ? "percentage" : "amount",
    });
    setEditingItemIndex(index);
    focusItemForm();
  };

  const cancelEditItem = () => {
    setNewItem({ ...emptyCreditNoteItem });
    setEditingItemIndex(null);
  };

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.salesInvoiceId) {
      toast({
        title: "Error",
        description: "Please select a sales invoice",
        variant: "destructive",
      });
      return;
    }

    if (formData.items.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item to the credit note",
        variant: "destructive",
      });
      return;
    }

    try {
      const validatedData = createCreditNoteSchema.parse(formData);
      onSubmit(validatedData);
    } catch (error) {
      toast({
        title: "Validation Error",
        description: "Please check all required fields",
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div className="space-y-2">
          <Label htmlFor="salesInvoiceId">Linked Sales Invoice *</Label>
          <Select
            value={formData.salesInvoiceId ? formData.salesInvoiceId.toString() : "0"}
            onValueChange={(value) => {
              const selectedInvoice = salesInvoices.find((inv: any) => inv.id === parseInt(value));
              const selectedCustomer = Array.isArray(customers) ? customers.find((c: any) => c.id === selectedInvoice?.customerId) : null;
              const invoiceCurrency = selectedInvoice?.currency || selectedCustomer?.currency || "AED";
              const invoiceExchangeRate = selectedInvoice?.exchangeRate || "1";
              setFormData(prev => ({
                ...prev,
                salesInvoiceId: parseInt(value),
                customerId: selectedInvoice?.customerId || 0,
                billingAddress: selectedCustomer?.address || "",
                currency: invoiceCurrency,
                exchangeRate: invoiceExchangeRate,
              }));
              if (invoiceCurrency && invoiceCurrency !== "AED" && !selectedInvoice?.exchangeRate) {
                fetch('/api/exchange-rates/lookup?from=' + invoiceCurrency + '&to=AED')
                  .then(r => r.json())
                  .then(data => {
                    if (data.rate) {
                      setFormData(prev => ({ ...prev, exchangeRate: String(data.rate) }));
                    }
                  })
                  .catch(() => { });
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an invoice number" />
            </SelectTrigger>
            <SelectContent>
              {salesInvoices
                .filter(
                  (invoice: any) =>
                    invoice.status !== "draft" &&
                    invoice.status !== "paid" &&
                    parseFloat(invoice.totalAmount || "0") > 0,
                )
                .map((invoice: any) => (
                  <SelectItem key={invoice.id} value={invoice.id.toString()}>
                    {invoice.invoiceNumber || `Invoice #${invoice.id}`}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {(() => {
            const selectedInvoice = salesInvoices.find((inv: any) => inv.id === formData.salesInvoiceId);
            const selectedCustomer = Array.isArray(customers) ? customers.find((c: any) => c.id === selectedInvoice?.customerId) : null;

            if (selectedInvoice && selectedCustomer) {
              return (
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                  <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Invoice Details</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium">Customer:</span> {selectedCustomer.name}
                    </div>
                    <div>
                      <span className="font-medium">Amount:</span> {formatCurrency(selectedInvoice.totalAmount, selectedInvoice.currency)}
                    </div>
                    <div>
                      <span className="font-medium">Date:</span> {formatDisplayDate(selectedInvoice.invoiceDate)}
                    </div>
                    <div>
                      <span className="font-medium">Status:</span> {selectedInvoice.status}
                    </div>
                    {selectedCustomer.email && (
                      <div className="col-span-2">
                        <span className="font-medium">Email:</span> {selectedCustomer.email}
                      </div>
                    )}
                    {selectedCustomer.phone && (
                      <div className="col-span-2">
                        <span className="font-medium">Phone:</span> {selectedCustomer.phone}
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            return null;
          })()}
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="issued">Issued</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="creditNoteDate">Credit Note Date *</Label>
          <Input
            id="creditNoteDate"
            type="date"
            value={formData.creditNoteDate}
            onChange={(e) => setFormData(prev => ({ ...prev, creditNoteDate: e.target.value }))}
            required
          />
        </div>

        <div>
          <Label htmlFor="reason">Reason</Label>
          <Input
            id="reason"
            placeholder="e.g., Product return, pricing error..."
            value={formData.reason}
            onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="billingAddress">Billing Address</Label>
        <textarea
          id="billingAddress"
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          value={formData.billingAddress || ""}
          onChange={(e) => setFormData(prev => ({ ...prev, billingAddress: e.target.value }))}
          placeholder="Billing address (auto-populated from customer)"
          rows={3}
        />
      </div>

      {/* Items Section */}
      <div className="space-y-4">
        <Label className="text-lg font-semibold">Items</Label>
        {/* Add Item Form */}
        <Card ref={itemFormRef}>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="md:col-span-2 lg:col-span-4">
                <Label className="text-xs text-gray-600">Description</Label>
                <Textarea
                  ref={descriptionRef}
                  rows={3}
                  placeholder="Item description"
                  value={newItem.description}
                  onChange={(e) =>
                    setNewItem((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Qty</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Qty"
                  value={newItem.quantity}
                  onChange={(e) =>
                    setNewItem((prev) => ({
                      ...prev,
                      quantity: e.target.value === "" ? "" : parseFloat(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Unit Price</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Unit price"
                  value={newItem.unitPrice}
                  onChange={(e) =>
                    setNewItem((prev) => ({
                      ...prev,
                      unitPrice: e.target.value === "" ? "" : parseFloat(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Tax %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  placeholder="Tax %"
                  value={newItem.taxRate}
                  onChange={(e) =>
                    setNewItem((prev) => ({
                      ...prev,
                      taxRate: e.target.value === "" ? "" : parseFloat(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Discount</Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={newItem.discount}
                    onChange={(e) =>
                      setNewItem((prev) => ({
                        ...prev,
                        discount: e.target.value === "" ? "" : parseFloat(e.target.value),
                      }))
                    }
                  />
                  <select
                    className="border rounded px-2 text-sm bg-background"
                    value={newItem.discountType}
                    onChange={(e) =>
                      setNewItem((prev) => ({
                        ...prev,
                        discountType: e.target.value as "amount" | "percentage",
                      }))
                    }
                  >
                    <option value="amount">{formData.currency || "AED"}</option>
                    <option value="percentage">%</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-2">
              <Button
                type="button"
                onClick={addItem}
                size="sm"
                className="w-full md:w-auto"
              >
                {editingItemIndex === null ? (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4 mr-2" />
                    Update Item
                  </>
                )}
              </Button>
              {editingItemIndex !== null && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={cancelEditItem}
                  className="w-full md:w-auto"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Items List */}
        {formData.items.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] table-fixed">
                  {/* Description takes whatever the fixed numeric
                      columns leave, so long multi-line text has room. */}
                  <colgroup>
                    <col />
                    <col className="w-[70px]" />
                    <col className="w-[110px]" />
                    <col className="w-[90px]" />
                    <col className="w-[100px]" />
                    <col className="w-[120px]" />
                    <col className="w-[90px]" />
                  </colgroup>
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Unit Price
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tax Rate
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Discount
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {formData.items.map((item: any, index: number) => {
                      const lineSubtotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                      const lineDiscount = item.discountType === "percentage"
                        ? lineSubtotal * ((Number(item.discount) || 0) / 100)
                        : Math.min(Number(item.discount) || 0, lineSubtotal);
                      const taxable = lineSubtotal - lineDiscount;
                      const taxAmount = taxable * ((Number(item.taxRate) || 0) / 100);
                      const lineTotal = taxable + taxAmount;

                      return (
                        <tr
                          key={index}
                          className={
                            editingItemIndex === index
                              ? "bg-blue-50 dark:bg-blue-950"
                              : undefined
                          }
                        >
                          <td className="px-4 py-3 text-sm whitespace-pre-wrap break-words">{item.description}</td>
                          <td className="px-4 py-3 text-sm text-right">{item.quantity}</td>
                          <td className="px-4 py-3 text-sm text-right">
                            {formatCurrency(Number(item.unitPrice) || 0, formData.currency)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            {Number(item.taxRate) || 0}%
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            {Number(item.discount) > 0
                              ? (item.discountType === "percentage"
                                  ? `${item.discount}%`
                                  : `${formData.currency || "AED"} ${(Number(item.discount)).toFixed(2)}`)
                              : "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium">
                            {formatCurrency(lineTotal, formData.currency)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Edit item"
                                aria-label="Edit item"
                                data-testid={`button-edit-credit-note-item-${index}`}
                                onClick={() => startEditItem(index)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                title={
                                  editingItemIndex !== null
                                    ? "Finish or cancel the current edit first"
                                    : "Remove item"
                                }
                                aria-label="Remove item"
                                data-testid={`button-remove-credit-note-item-${index}`}
                                disabled={editingItemIndex !== null}
                                onClick={() => removeItem(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
        <div className="space-y-4">
          <h4 className="font-semibold text-sm">Discounts</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="discountPercentage">Discount (%)</Label>
              <Input
                id="discountPercentage"
                type="number"
                min="0"
                max="100"
                step="any"
                value={formData.discountPercentage}
                onChange={(e) => {
                  const val = e.target.value;
                  const pct = parseFloat(val) || 0;
                  const calcDiscount = (creditNoteSubtotalValue * pct / 100);
                  setFormData(prev => ({ 
                    ...prev, 
                    discountPercentage: val, 
                    discount: val === "" ? "" : calcDiscount.toString()
                  }));
                }}
                placeholder="0.00"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="discountAmount">Discount Amount ({formData.currency})</Label>
              <Input
                id="discountAmount"
                type="number"
                min="0"
                step="any"
                value={formData.discount}
                onChange={(e) => {
                  const val = e.target.value;
                  const amount = parseFloat(val) || 0;
                  const calcPct = creditNoteSubtotalValue > 0 ? ((amount / creditNoteSubtotalValue) * 100) : 0;
                  setFormData(prev => ({ 
                    ...prev, 
                    discount: val, 
                    discountPercentage: val === "" ? "" : calcPct.toString()
                  }));
                }}
                placeholder="0.00"
                className="mt-1"
              />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg p-4 border">
          <h4 className="font-semibold mb-3 text-sm">Credit Note Summary</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium">{formatCurrency(formData.subtotal || "0", formData.currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax Amount:</span>
              <span className="font-medium">{formatCurrency(formData.taxAmount || "0", formData.currency)}</span>
            </div>
            {(() => {
              // Total discount (header + line) derived from the engine-set
              // totals; equals discountTotal to the cent.
              const totalDiscount =
                parseFloat(formData.subtotal || "0") +
                parseFloat(formData.taxAmount || "0") -
                parseFloat(formData.totalAmount || "0");
              return totalDiscount > 0.005 ? (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Total Discount:</span>
                  <span className="font-medium">- {formatCurrency(totalDiscount.toFixed(2), formData.currency)}</span>
                </div>
              ) : null;
            })()}
            <div className="border-t pt-2">
              <div className="flex justify-between text-lg font-bold">
                <span>Total Amount:</span>
                <span className="text-blue-600">{formatCurrency(formData.totalAmount || "0", formData.currency)}</span>
              </div>
              {formData.currency !== "AED" && (
                <div className="text-xs text-muted-foreground mt-2 text-right">
                  Exchange Rate: 1 {formData.currency} = {formData.exchangeRate} AED
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            onCancel();
            setFormData(prev => ({ ...prev, currency: "AED", exchangeRate: "1" }));
          }}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
        >
          {creditNote ? "Update" : "Create"} Credit Note
        </Button>
      </div>
    </form>
  );
};

export default function CreditNotesIndex() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCreditNote, setEditingCreditNote] = useState<any>(null);
  const [viewingCreditNote, setViewingCreditNote] = useState<any>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);

  // Check for invoice ID in URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const invoiceId = urlParams.get('invoiceId');
    if (invoiceId) {
      setSelectedInvoiceId(parseInt(invoiceId));
      setIsCreateOpen(true);
    }
  }, [location]);

  // Fetch credit notes
  const { data: creditNotes = [], isLoading: creditNotesLoading } = useQuery<any[]>({
    queryKey: ["/api/credit-notes"],
  });

  // Fetch sales invoices for linking
  const { data: salesInvoicesResponse } = useQuery({
    // queryKey: ["/api/sales-invoices"],
    queryKey: ["/api/sales-invoices", { limit: 1000 }],
    queryFn: async () => {
      const response = await fetch("/api/sales-invoices?limit=1000");
      if (!response.ok) throw new Error("Failed to fetch sales invoices");
      return response.json();
    },
  });

  const salesInvoices = salesInvoicesResponse?.data || [];

  // Fetch customers
  const { data: customersResponse, isLoading: customersLoading } = useQuery<{
    data: any[];
  }>({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const response = await fetch("/api/customers?limit=1000");
      return response.json();
    },
  });

  const customers = customersResponse?.data || [];

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ["/api/projects"],
  });

  const { data: company } = useQuery({
    queryKey: ["/api/company"],
  });

  // Create credit note mutation
  const createCreditNoteMutation = useMutation({
    mutationFn: async (data: CreditNoteFormData) => {
      const response = await fetch("/api/credit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create credit note");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credit-notes"] });
      setIsCreateOpen(false);
      toast({
        title: "Success",
        description: "Credit note created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create credit note",
        variant: "destructive",
      });
    },
  });

  // Update credit note mutation
  const updateCreditNoteMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: CreditNoteFormData }) => {
      const response = await fetch(`/api/credit-notes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update credit note");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credit-notes"] });
      setEditingCreditNote(null);
      toast({
        title: "Success",
        description: "Credit note updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update credit note",
        variant: "destructive",
      });
    },
  });

  // Cancel an ISSUED credit note. Deleting one used to leave its ledger
  // entries behind — revenue still reduced and VAT still reversed for a
  // document that no longer existed. Cancelling reverses the postings, removes
  // the settlement row so the invoice's paid amount and status correct
  // themselves, and keeps the note on record.
  const cancelCreditNoteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/credit-notes/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to cancel credit note");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credit-notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales-invoices"] });
      toast({
        title: "Credit note cancelled",
        description:
          "Its ledger entries have been reversed and the invoice updated.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Cannot cancel", description: error.message, variant: "destructive" });
    },
  });

  // Deleting is only for drafts, which have posted nothing.
  const deleteCreditNoteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/credit-notes/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to delete credit note");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credit-notes"] });
      toast({ title: "Success", description: "Draft credit note deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Cannot delete", description: error.message, variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: "secondary",
      issued: "default",
      cancelled: "destructive",
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {status.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  if (creditNotesLoading || customersLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Credit Notes</h1>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Credit Note
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Credit Note</DialogTitle>
                <DialogDescription>
                  Create a credit note to reduce the amount owed by a customer.
                </DialogDescription>
              </DialogHeader>
              <CreditNoteForm
                onSubmit={(data) => createCreditNoteMutation.mutate(data)}
                salesInvoices={salesInvoices}
                customers={customers}
                selectedInvoiceId={selectedInvoiceId}
                isCreateOpen={isCreateOpen}
                editingCreditNote={editingCreditNote}
                isSubmitting={createCreditNoteMutation.isPending || updateCreditNoteMutation.isPending}
                onCancel={() => {
                  setIsCreateOpen(false);
                  setEditingCreditNote(null);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Credit Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Credit Note #</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditNotes.map((creditNote: any) => (
                  <TableRow key={creditNote.id}>
                    <TableCell className="font-medium">{creditNote.creditNoteNumber}</TableCell>
                    <TableCell>{creditNote.invoiceNumber}</TableCell>
                    <TableCell>{creditNote.customerName}</TableCell>
                    <TableCell>
                      {formatDisplayDate(creditNote.creditNoteDate)}
                    </TableCell>
                    <TableCell>{creditNote.reason || '-'}</TableCell>
                    <TableCell>{formatCurrency(creditNote.totalAmount || 0, creditNote.currency)}</TableCell>
                    <TableCell>{getStatusBadge(creditNote.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewingCreditNote(creditNote)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingCreditNote(creditNote)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            printByUrl(`/api/credit-notes/${creditNote.id}/pdf`);
                          }}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        {creditNote.status === "issued" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" title="Cancel credit note">
                                <Ban className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Cancel this credit note?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {creditNote.creditNoteNumber} will be reversed: its ledger
                                  entries are cancelled out, and the amount it settled is
                                  returned to the linked invoice's outstanding balance. The
                                  credit note stays on record as cancelled.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Keep it</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => cancelCreditNoteMutation.mutate(creditNote.id)}
                                  disabled={cancelCreditNoteMutation.isPending}
                                >
                                  {cancelCreditNoteMutation.isPending ? "Cancelling..." : "Cancel Credit Note"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        {creditNote.status === "draft" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" title="Delete draft">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {creditNote.creditNoteNumber} has not been issued and has
                                  posted nothing to the ledger, so it can be deleted outright.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Keep it</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteCreditNoteMutation.mutate(creditNote.id)}
                                >
                                  Delete Draft
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {creditNotes.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No credit notes found. Create your first credit note to get started.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editingCreditNote} onOpenChange={() => setEditingCreditNote(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Credit Note</DialogTitle>
              <DialogDescription>
                Update the credit note details.
              </DialogDescription>
            </DialogHeader>
            {editingCreditNote && (
              <CreditNoteForm
                creditNote={editingCreditNote}
                onSubmit={(data) => updateCreditNoteMutation.mutate({ id: editingCreditNote.id, data })}
                salesInvoices={salesInvoices}
                customers={customers}
                selectedInvoiceId={selectedInvoiceId}
                isCreateOpen={isCreateOpen}
                editingCreditNote={editingCreditNote}
                isSubmitting={createCreditNoteMutation.isPending || updateCreditNoteMutation.isPending}
                onCancel={() => {
                  setIsCreateOpen(false);
                  setEditingCreditNote(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* View Dialog */}
        <Dialog open={!!viewingCreditNote} onOpenChange={() => setViewingCreditNote(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Credit Note Details</DialogTitle>
              <DialogDescription>
                View credit note information.
              </DialogDescription>
            </DialogHeader>
            {viewingCreditNote && (
              <div className="space-y-6">
                {/* Header Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Credit Note Number</label>
                      <p className="text-lg font-semibold">{viewingCreditNote.creditNoteNumber}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                      <div className="mt-1">
                        {getStatusBadge(viewingCreditNote.status)}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
                      <p>{formatDisplayDate(viewingCreditNote.creditNoteDate)}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Invoice Number</label>
                      <p>{viewingCreditNote.invoiceNumber || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Customer</label>
                      <p>{viewingCreditNote.customerName}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Reason</label>
                      <p>{viewingCreditNote.reason || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {viewingCreditNote.billingAddress && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Billing Address</label>
                    <p className="mt-1 whitespace-pre-wrap">{viewingCreditNote.billingAddress}</p>
                  </div>
                )}

                {/* Items Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Items</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Tax Rate</TableHead>
                          <TableHead className="text-right">Discount</TableHead>
                          <TableHead className="text-right">Tax Amount</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(viewingCreditNote.items || []).map((item: any, index: number) => {
                          const lineSubtotal = item.quantity * item.unitPrice;
                          const lineDiscount = item.discountType === "percentage"
                            ? lineSubtotal * ((Number(item.discount) || 0) / 100)
                            : Math.min(Number(item.discount) || 0, lineSubtotal);
                          const taxable = lineSubtotal - lineDiscount;
                          const taxAmount = item.taxAmount !== undefined
                            ? parseFloat(item.taxAmount.toString())
                            : taxable * ((item.taxRate || 0) / 100);
                          const lineTotal = taxable + taxAmount;
                          return (
                            <TableRow key={index}>
                              <TableCell className="whitespace-pre-wrap break-words">{item.description}</TableCell>
                              <TableCell className="text-right">{item.quantity}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.unitPrice, viewingCreditNote.currency)}</TableCell>
                              <TableCell className="text-right">{item.taxRate || 0}%</TableCell>
                              <TableCell className="text-right">
                                {Number(item.discount) > 0
                                  ? (item.discountType === "percentage"
                                      ? `${item.discount}%`
                                      : `${viewingCreditNote.currency || "AED"} ${(Number(item.discount)).toFixed(2)}`)
                                  : "-"}
                              </TableCell>
                              <TableCell className="text-right">{formatCurrency(taxAmount, viewingCreditNote.currency)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(lineTotal, viewingCreditNote.currency)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 sm:p-6 print:bg-blue-50 print:border print:border-blue-300">
                  <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-white print:text-black flex items-center gap-2">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                    Financial Summary
                  </h3>
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex justify-between items-center text-gray-700 dark:text-gray-300 print:text-black">
                      <span className="font-medium">Subtotal:</span>
                      <span className="text-lg font-semibold">{formatCurrency(viewingCreditNote.subtotal || 0, viewingCreditNote.currency)}</span>
                    </div>
                    {(() => {
                      // Total discount (header + line) derived from stored fields;
                      // the discount column holds only the header portion.
                      const totalDiscount =
                        parseFloat(viewingCreditNote.subtotal || "0") +
                        parseFloat(viewingCreditNote.taxAmount || "0") -
                        parseFloat(viewingCreditNote.totalAmount || "0");
                      return totalDiscount > 0.005 ? (
                        <div className="flex justify-between items-center text-gray-700 dark:text-gray-300 print:text-black">
                          <span className="font-medium">Total Discount:</span>
                          <span className="text-lg font-semibold text-red-600">- {formatCurrency(totalDiscount.toFixed(2), viewingCreditNote.currency)}</span>
                        </div>
                      ) : null;
                    })()}
                    <div className="flex justify-between items-center text-gray-700 dark:text-gray-300 print:text-black">
                      <span className="font-medium">Tax Amount:</span>
                      <span className="text-lg font-semibold">{formatCurrency(viewingCreditNote.taxAmount || 0, viewingCreditNote.currency)}</span>
                    </div>
                    <div className="border-t border-gray-300 dark:border-gray-600 print:border-gray-400 pt-3 flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-900 dark:text-white print:text-black">Total Amount:</span>
                      <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 print:text-blue-600">{formatCurrency(viewingCreditNote.totalAmount || 0, viewingCreditNote.currency)}</span>
                    </div>
                    {viewingCreditNote.currency && viewingCreditNote.currency !== "AED" && (
                      <div className="text-xs text-muted-foreground mt-2 text-right">
                        Exchange Rate: 1 {viewingCreditNote.currency} = {viewingCreditNote.exchangeRate} AED
                        <br />
                        AED Equivalent: AED {(parseFloat(viewingCreditNote.totalAmount || "0") * parseFloat(viewingCreditNote.exchangeRate || "1")).toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  {viewingCreditNote.status === "issued" && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive">
                          <Ban className="h-4 w-4 mr-2" />
                          Cancel Credit Note
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel this credit note?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {viewingCreditNote.creditNoteNumber} will be reversed: its ledger
                            entries are cancelled out, and the amount it settled is returned
                            to the linked invoice's outstanding balance. The credit note stays
                            on record as cancelled.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep it</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              cancelCreditNoteMutation.mutate(viewingCreditNote.id);
                              setViewingCreditNote(null);
                            }}
                            disabled={cancelCreditNoteMutation.isPending}
                          >
                            {cancelCreditNoteMutation.isPending ? "Cancelling..." : "Cancel Credit Note"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      printByUrl(`/api/credit-notes/${viewingCreditNote.id}/pdf`);
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Print Credit Note
                  </Button>
                  <Button onClick={() => setViewingCreditNote(null)}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}