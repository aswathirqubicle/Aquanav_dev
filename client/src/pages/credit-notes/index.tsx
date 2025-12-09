import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Eye, FileText } from "lucide-react";
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
      }),
    )
    .default([]),
  subtotal: z.string().optional(),
  taxAmount: z.string().optional(),
  discount: z.string().optional(),
  totalAmount: z.string().optional(),
});

type CreditNoteFormData = z.infer<typeof createCreditNoteSchema>;

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
  const { data: creditNotes = [], isLoading: creditNotesLoading } = useQuery({
    queryKey: ["/api/credit-notes"],
  });

  // Fetch sales invoices for linking
  const { data: salesInvoicesResponse } = useQuery({
    queryKey: ["/api/sales-invoices"],
  });

  const salesInvoices = salesInvoicesResponse?.data || [];

  // Fetch customers
  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ["/api/customers"],
  });

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ["/api/projects"],
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

  // Delete credit note mutation
  const deleteCreditNoteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/credit-notes/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete credit note");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credit-notes"] });
      toast({
        title: "Success",
        description: "Credit note deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete credit note",
        variant: "destructive",
      });
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

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const CreditNoteForm = ({ creditNote, onSubmit }: { creditNote?: any; onSubmit: (data: CreditNoteFormData) => void }) => {
    const [formData, setFormData] = useState<CreditNoteFormData>({
      salesInvoiceId: creditNote?.salesInvoiceId || selectedInvoiceId || 0,
      customerId: creditNote?.customerId || 0,
      status: creditNote?.status || "draft",
      creditNoteDate: creditNote?.creditNoteDate?.split("T")[0] || new Date().toISOString().split("T")[0],
      billingAddress: creditNote?.billingAddress || "",
      reason: creditNote?.reason || "",
      items: creditNote?.items || [{ description: "", quantity: 1, unitPrice: 0, taxRate: 0, taxAmount: 0 }],
      subtotal: creditNote?.subtotal || "0.00",
      taxAmount: creditNote?.taxAmount || "0.00",
      discount: creditNote?.discount || "0.00",
      totalAmount: creditNote?.totalAmount || "0.00",
    });

    const selectedInvoice = salesInvoices.find((inv: any) => inv.id === formData.salesInvoiceId);

    useEffect(() => {
      if (selectedInvoice) {
        const selectedCustomer = Array.isArray(customers) ? customers.find((c: any) => c.id === selectedInvoice.customerId) : null;
        setFormData(prev => ({
          ...prev,
          customerId: selectedInvoice.customerId || 0,
          billingAddress: selectedCustomer?.address || "",
        }));
      }
    }, [selectedInvoice]);

    const calculateTotals = () => {
      let subtotal = 0;
      let totalTaxAmount = 0;

      formData.items.forEach((item) => {
        const lineSubtotal = item.quantity * item.unitPrice;
        const taxAmount = lineSubtotal * ((item.taxRate || 0) / 100);
        subtotal += lineSubtotal;
        totalTaxAmount += taxAmount;
      });

      const discount = parseFloat(formData.discount || "0");
      const finalSubtotal = subtotal - discount;
      const total = finalSubtotal + totalTaxAmount;

      setFormData(prev => ({
        ...prev,
        subtotal: subtotal.toFixed(2),
        taxAmount: totalTaxAmount.toFixed(2),
        totalAmount: total.toFixed(2),
      }));
    };

    useEffect(() => {
      calculateTotals();
    }, [formData.items, formData.discount]);

    const addItem = () => {
      setFormData(prev => ({
        ...prev,
        items: [...prev.items, { description: "", quantity: 1, unitPrice: 0, taxRate: 0, taxAmount: 0 }],
      }));
    };

    const removeItem = (index: number) => {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index),
      }));
    };

    const updateItem = (index: number, field: string, value: any) => {
      setFormData(prev => ({
        ...prev,
        items: prev.items.map((item, i) => 
          i === index ? { ...item, [field]: value } : item
        ),
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
                        value={formData.salesInvoiceId.toString()}
                        onValueChange={(value) => {
                          const selectedInvoice = salesInvoices.find((inv: any) => inv.id === parseInt(value));
                          const selectedCustomer = Array.isArray(customers) ? customers.find((c: any) => c.id === selectedInvoice?.customerId) : null;
                          setFormData(prev => ({ 
                            ...prev, 
                            salesInvoiceId: parseInt(value),
                            customerId: selectedInvoice?.customerId || 0,
                            billingAddress: selectedCustomer?.address || "",
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select an invoice number" />
                        </SelectTrigger>
                        <SelectContent>
                          {salesInvoices.map((invoice: any) => (
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
                                  <span className="font-medium">Amount:</span> {formatCurrency(selectedInvoice.totalAmount)}
                                </div>
                                <div>
                                  <span className="font-medium">Date:</span> {new Date(selectedInvoice.invoiceDate).toLocaleDateString()}
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
        <div>
          <div className="flex justify-between items-center mb-4">
            <Label className="text-lg font-semibold">Items</Label>
            <Button type="button" onClick={addItem} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>

          <div className="space-y-4">
            {formData.items.map((item, index) => (
              <div key={index} className="flex gap-4 p-4 border rounded-lg">
                <div className="flex-1">
                  <Label htmlFor={`description-${index}`}>Description</Label>
                  <Input
                    id={`description-${index}`}
                    value={item.description}
                    onChange={(e) => updateItem(index, "description", e.target.value)}
                    placeholder="Item description"
                  />
                </div>
                <div className="w-24">
                  <Label htmlFor={`quantity-${index}`}>Qty</Label>
                  <Input
                    id={`quantity-${index}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="w-32">
                  <Label htmlFor={`unitPrice-${index}`}>Unit Price</Label>
                  <Input
                    id={`unitPrice-${index}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="w-24">
                  <Label htmlFor={`taxRate-${index}`}>Tax %</Label>
                  <Input
                    id={`taxRate-${index}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={item.taxRate || 0}
                    onChange={(e) => updateItem(index, "taxRate", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeItem(index)}
                    disabled={formData.items.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals Section */}
        <div className="flex justify-end">
          <div className="w-80 space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formatCurrency(formData.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Discount:</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.discount}
                onChange={(e) => setFormData(prev => ({ ...prev, discount: e.target.value }))}
                className="w-24 text-right"
              />
            </div>
            <div className="flex justify-between">
              <span>Tax Amount:</span>
              <span>{formatCurrency(formData.taxAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Total:</span>
              <span>{formatCurrency(formData.totalAmount)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setIsCreateOpen(false);
              setEditingCreditNote(null);
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createCreditNoteMutation.isPending || updateCreditNoteMutation.isPending}
          >
            {creditNote ? "Update" : "Create"} Credit Note
          </Button>
        </div>
      </form>
    );
  };

  if (creditNotesLoading || customersLoading) {
    return <div>Loading...</div>;
  }

  return (
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
                    {new Date(creditNote.creditNoteDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{creditNote.reason}</TableCell>
                  <TableCell>{formatCurrency(creditNote.totalAmount)}</TableCell>
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
                          window.open(`/api/credit-notes/${creditNote.id}/pdf`, '_blank');
                        }}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this credit note?")) {
                            deleteCreditNoteMutation.mutate(creditNote.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
                    <p>{new Date(viewingCreditNote.creditNoteDate).toLocaleDateString()}</p>
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
                        <TableHead className="text-right">Tax Amount</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(viewingCreditNote.items || []).map((item: any, index: number) => {
                        const lineSubtotal = item.quantity * item.unitPrice;
                        const taxAmount = lineSubtotal * ((item.taxRate || 0) / 100);
                        const lineTotal = lineSubtotal + taxAmount;
                        return (
                          <TableRow key={index}>
                            <TableCell>{item.description}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                            <TableCell className="text-right">{item.taxRate || 0}%</TableCell>
                            <TableCell className="text-right">{formatCurrency(taxAmount)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(lineTotal)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Totals Section */}
              <div className="flex justify-end">
                <div className="w-80 space-y-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex justify-between">
                    <span className="font-medium">Subtotal:</span>
                    <span>{formatCurrency(viewingCreditNote.subtotal || 0)}</span>
                  </div>
                  {viewingCreditNote.discount && parseFloat(viewingCreditNote.discount) > 0 && (
                    <div className="flex justify-between">
                      <span className="font-medium">Discount:</span>
                      <span>-{formatCurrency(viewingCreditNote.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="font-medium">Tax Amount:</span>
                    <span>{formatCurrency(viewingCreditNote.taxAmount || 0)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-3">
                    <span>Total Amount:</span>
                    <span>{formatCurrency(viewingCreditNote.totalAmount || 0)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    window.open(`/api/credit-notes/${viewingCreditNote.id}/pdf`, '_blank');
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
  );
}