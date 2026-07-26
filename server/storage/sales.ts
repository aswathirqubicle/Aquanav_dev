import { LedgerStorage } from "./ledger";
import {
  CreatePaymentFileData,
  CreditNoteWithDetails,
  PaginatedResponse,
  SalesQuotationWithCustomerName,
} from "./types";
import {
  CreditNote,
  InsertCreditNote,
  InsertInvoiceEditHistory,
  InsertInvoicePayment,
  InsertSalesInvoice,
  InsertSalesQuotation,
  InvoiceEditHistory,
  InvoicePayment,
  PaymentFile,
  SalesInvoice,
  SalesQuotation,
  creditNotes,
  customers,
  generalLedgerEntries,
  invoiceEditHistory,
  invoicePayments,
  paymentFiles,
  proformaInvoices,
  projects,
  salesInvoices,
  salesQuotations,
} from "@shared/schema";
import {
  computeDocumentTotals,
  type HeaderDiscountInput,
  type LineItemInput,
} from "@shared/document-totals";
import {
  and,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lte,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { db } from "../db";

export class SalesStorage extends LedgerStorage {
  // Payment file methods
  async createPaymentFile(
    fileData: CreatePaymentFileData,
  ): Promise<PaymentFile> {
    try {
      const result = await db
        .insert(paymentFiles)
        .values({
          paymentId: fileData.paymentId,
          fileName: fileData.fileName,
          originalName: fileData.originalName,
          filePath: fileData.filePath,
          fileSize: fileData.fileSize || null,
          mimeType: fileData.mimeType || null,
        })
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createPaymentFile: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createPaymentFile",
        severity: "error",
      });
      throw error;
    }
  }

  async getPaymentFiles(paymentId: number): Promise<PaymentFile[]> {
    try {
      const files: PaymentFile[] = await db
        .select()
        .from(paymentFiles)
        .where(eq(paymentFiles.paymentId, paymentId))
        .orderBy(desc(paymentFiles.uploadedAt));

      return files;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getPaymentFiles (paymentId: ${paymentId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPaymentFiles",
        severity: "error",
      });
      throw error;
    }
  }

  async getPaymentFile(id: number): Promise<PaymentFile | undefined> {
    try {
      const result = await db
        .select()
        .from(paymentFiles)
        .where(eq(paymentFiles.id, id))
        .limit(1);
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getPaymentFile (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getPaymentFile",
        severity: "error",
      });
      throw error;
    }
  }

  async deletePaymentFile(fileId: number): Promise<boolean> {
    try {
      const result = await db
        .delete(paymentFiles)
        .where(eq(paymentFiles.id, fileId));
      return result.count > 0;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deletePaymentFile (fileId: ${fileId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deletePaymentFile",
        severity: "error",
      });
      throw error;
    }
  }

  async updateInvoicePaidAmount(invoiceId: number): Promise<void> {
    try {
      // Get all payments for this invoice
      const payments = await db
        .select({
          amount: invoicePayments.amount,
        })
        .from(invoicePayments)
        .where(eq(invoicePayments.invoiceId, invoiceId));

      // Calculate total paid amount
      const totalPaid = payments.reduce((sum, payment) => {
        return sum + parseFloat(payment.amount || "0");
      }, 0);

      // Get invoice details
      const invoice = await db
        .select()
        .from(salesInvoices)
        .where(eq(salesInvoices.id, invoiceId))
        .limit(1);

      if (invoice.length === 0) {
        throw new Error(`Invoice with ID ${invoiceId} not found`);
      }

      const invoiceData = invoice[0];
      const totalAmount = parseFloat(invoiceData.totalAmount || "0");

      // Determine status based on payment amounts and due date
      let status = "unpaid";
      if (totalPaid >= totalAmount) {
        status = "paid";
      } else if (totalPaid > 0) {
        status = "partially_paid";
      }

      // Check if invoice is overdue (only if not fully paid and not draft)
      if (invoiceData.status !== "draft" && status !== "paid") {
        const currentDate = new Date();
        const dueDate = new Date(invoiceData.dueDate);
        if (currentDate > dueDate) {
          status = "overdue";
        }
      }

      // Update invoice
      await db
        .update(salesInvoices)
        .set({
          paidAmount: totalPaid.toFixed(2),
          status,
        })
        .where(eq(salesInvoices.id, invoiceId));

      console.log(
        `Updated invoice ${invoiceId} paid amount to ${totalPaid.toFixed(
          2,
        )} with status ${status}`,
      );
    } catch (error: any) {
      console.error("Original error in updateInvoicePaidAmount:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in updateInvoicePaidAmount (invoiceId: ${invoiceId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateInvoicePaidAmount",
        severity: "error",
      });
      throw error;
    }
  }

  async getCreditNote(id: number): Promise<CreditNote | undefined> {
    try {
      const result: CreditNote[] = await db
        .select()
        .from(creditNotes)
        .where(eq(creditNotes.id, id))
        .limit(1);
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getCreditNote (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getCreditNote",
        severity: "error",
      });
      throw error;
    }
  }

  async createCreditNote(
    creditNoteData: InsertCreditNote,
  ): Promise<CreditNote> {
    try {
      console.log("Creating credit note with data:", creditNoteData);

      const linkedInvoice = await this.resolveCreditNoteInvoice(
        creditNoteData.salesInvoiceId,
        creditNoteData.status,
      );

      // Generate credit note number
      const creditNoteNumber = await this.generateNextNumber(
        "CN",
        creditNotes,
        creditNotes.creditNoteNumber,
      );

      // The InsertCreditNote type from schema.ts should be used.
      // If creditNoteData might contain fields not in InsertCreditNote (like projectId), they should be handled.
      const { projectId, ...validCreditNoteData } = creditNoteData as any; // Cast if necessary

      const insertData = {
        ...validCreditNoteData,
        creditNoteNumber, // Generated above
        // Ensure date fields are correctly formatted if they are part of InsertCreditNote and are strings
        creditNoteDate: validCreditNoteData.creditNoteDate
          ? new Date(validCreditNoteData.creditNoteDate)
              .toISOString()
              .split("T")[0]
          : new Date().toISOString().split("T")[0],
        // items should be handled by the schema type (e.g. JSON stringified if needed by Drizzle)
        items: validCreditNoteData.items
          ? typeof validCreditNoteData.items === "string"
            ? validCreditNoteData.items
            : JSON.stringify(validCreditNoteData.items)
          : JSON.stringify([]),
      };

      // Validate the total the server computes from the line items, not the one
      // the client sent — applySalesDocumentTotals is what actually gets stored.
      const finalData = this.applyCreditNoteInvoiceCurrency(
        this.applySalesDocumentTotals(insertData),
        linkedInvoice,
      );
      if (linkedInvoice && finalData.status === "issued") {
        await this.assertCreditNoteWithinInvoice(
          linkedInvoice,
          parseFloat(finalData.totalAmount || "0"),
        );
      }

      const result: CreditNote[] = await db
        .insert(creditNotes)
        .values(finalData)
        .returning();

      const createdCreditNote = result[0];
      console.log("Credit note created:", createdCreditNote);

      if (!createdCreditNote || !createdCreditNote.id) {
        throw new Error(
          "Failed to create credit note - no credit note record returned",
        );
      }

      // Get related invoice and customer information for GL entries
      // Ensure salesInvoiceId and customerId are numbers if they are not null/undefined
      const invoice = await this.getSalesInvoice(
        createdCreditNote.salesInvoiceId as number,
      );
      const customer = await this.getCustomer(
        createdCreditNote.customerId as number,
      );

      console.log("Retrieved invoice:", invoice);
      console.log("Retrieved customer:", customer);

      // Only create GL entries if status is "issued"
      if (createdCreditNote.status === "issued") {
        console.log(
          `Creating double-entry GL records for credit note ${
            createdCreditNote.id
          } - ${createdCreditNote.creditNoteNumber || "N/A"} - Amount: ${
            createdCreditNote.totalAmount
          }`,
        );

        const cnCurrency = createdCreditNote.currency || "AED";
        const cnExchangeRate = parseFloat(
          createdCreditNote.exchangeRate || "1",
        );
        const cnOriginalAmount = parseFloat(
          (createdCreditNote.totalAmount as string) || "0",
        );
        // Standard sales-return posting (H1): a credit note reverses revenue and
        // the output VAT — Dr Sales Returns (net) / Dr VAT/GST Payable (tax) /
        // Cr Accounts Receivable (gross). VAT line omitted when tax is zero.
        const cnOriginalTax = parseFloat(
          (createdCreditNote.taxAmount as string) || "0",
        );
        const cnAedTotal =
          Math.round(cnOriginalAmount * cnExchangeRate * 100) / 100;
        const cnAedTax = Math.round(cnOriginalTax * cnExchangeRate * 100) / 100;
        const cnAedNet = Math.round((cnAedTotal - cnAedTax) * 100) / 100;
        const cnCurrencyNote =
          cnCurrency !== "AED"
            ? ` (${cnCurrency} ${cnOriginalAmount.toFixed(2)} @ ${cnExchangeRate})`
            : "";

        const cnShared = {
          entryType: "receivable" as const,
          referenceType: "credit_note" as const,
          referenceId: createdCreditNote.id,
          description: `Credit Note: ${createdCreditNote.creditNoteNumber || "N/A"} for Invoice: ${invoice?.invoiceNumber || "N/A"}${cnCurrencyNote}`,
          entityId: createdCreditNote.customerId as number,
          entityName: customer?.name || "Unknown Customer",
          projectId: invoice?.projectId || undefined,
          invoiceNumber: invoice?.invoiceNumber || undefined,
          transactionDate:
            createdCreditNote.creditNoteDate ||
            new Date().toISOString().split("T")[0],
          status: "issued" as const,
        };

        try {
          // All three rows in ONE transaction (1.7/L14). Posted independently,
          // a failure after the first left Sales Returns debited with no
          // matching credit to Accounts Receivable — a permanently one-sided
          // ledger on a credit note that still reported success.
          await db.transaction(async (tx) => {
            await this.createGeneralLedgerEntry(
              {
                ...cnShared,
                accountName: "Sales Returns and Allowances",
                debitAmount: cnAedNet.toFixed(2),
                creditAmount: "0",
              },
              tx,
            );
            if (cnAedTax > 0.005) {
              await this.createGeneralLedgerEntry(
                {
                  ...cnShared,
                  accountName: "VAT/GST Payable",
                  debitAmount: cnAedTax.toFixed(2),
                  creditAmount: "0",
                },
                tx,
              );
            }
            await this.createGeneralLedgerEntry(
              {
                ...cnShared,
                accountName: "Accounts Receivable",
                debitAmount: "0",
                creditAmount: cnAedTotal.toFixed(2),
              },
              tx,
            );
          });
          console.log(
            `Successfully created credit-note GL entries for ${createdCreditNote.id}`,
          );
        } catch (glError) {
          console.error("Error creating credit note GL entries:", glError);
          throw new Error(
            `Failed to create credit note GL entries: ${
              glError instanceof Error ? glError.message : String(glError)
            }`,
          );
        }

        // Update the related sales invoice
        if (invoice) {
          await this.updateSalesInvoiceFromCreditNote(
            invoice.id,
            parseFloat(createdCreditNote.totalAmount as string),
          );

          // Create an invoice payment entry to show credit note application in payment history
          await this.createInvoicePaymentForCreditNote(
            invoice.id,
            createdCreditNote,
          );

          // A credit note reduces the project's revenue — it is contra-revenue
          // in the ledger, so the project must be recalculated too.
          if (invoice.projectId) {
            await this.updateProjectRevenue(invoice.projectId);
          }
        }
      }

      return createdCreditNote;
    } catch (error: any) {
      // Preserve existing console.error and specific error logging structure
      console.error("Error creating credit note:", error);
      if (!error.isLogged) {
        // Avoid double logging if error is already from createErrorLog
        await this.createErrorLog({
          message: `Error in createCreditNote: ${
            error?.message || String(error)
          }. Context: ${JSON.stringify(creditNoteData)}`,
          stack: error?.stack,
          url: "server/storage.ts",
          severity: "error",
          component: "createCreditNote",
        });
      }
      throw error;
    }
  }

  async updateCreditNote(
    id: number,
    creditNoteData: Partial<InsertCreditNote>,
  ): Promise<CreditNote | undefined> {
    try {
      // Get the current credit note before update
      const currentCreditNote = await this.getCreditNote(id);
      if (!currentCreditNote) {
        throw new Error(`Credit note ${id} not found`);
      }

      // Remove projectId from the data if present, as it's not in creditNotes table
      const { projectId, ...validCreditNoteData } = creditNoteData as any;

      // The same guard as on create, for the draft -> issued route. The invoice
      // may be supplied by this very edit, so check the incoming value first and
      // fall back to what the note already carries.
      const linkedInvoice = await this.resolveCreditNoteInvoice(
        validCreditNoteData.salesInvoiceId !== undefined
          ? validCreditNoteData.salesInvoiceId
          : currentCreditNote.salesInvoiceId,
        validCreditNoteData.status !== undefined
          ? validCreditNoteData.status
          : currentCreditNote.status,
      );

      const updateData: Partial<InsertCreditNote> = { ...validCreditNoteData };

      // Ensure date fields are correctly formatted
      if (validCreditNoteData.creditNoteDate) {
        updateData.creditNoteDate = new Date(validCreditNoteData.creditNoteDate)
          .toISOString()
          .split("T")[0];
      }
      // Handle items: stringify if it's an object and the field expects a string
      if (
        validCreditNoteData.items &&
        typeof validCreditNoteData.items !== "string"
      ) {
        updateData.items = JSON.stringify(validCreditNoteData.items);
      }

      const finalUpdate = this.applyCreditNoteInvoiceCurrency(
        this.applySalesDocumentTotals(updateData),
        linkedInvoice,
      );

      // An edit can change the amount, the status, or neither, so fall back to
      // what the note already carries. This note is excluded from the running
      // total it is checked against — otherwise re-saving an issued note would
      // count it twice and refuse itself.
      const effectiveStatus = finalUpdate.status ?? currentCreditNote.status;
      const effectiveAmount =
        finalUpdate.totalAmount ?? currentCreditNote.totalAmount;
      if (linkedInvoice && effectiveStatus === "issued") {
        await this.assertCreditNoteWithinInvoice(
          linkedInvoice,
          parseFloat((effectiveAmount as string) || "0"),
          id,
        );
      }

      const result: CreditNote[] = await db
        .update(creditNotes)
        .set(finalUpdate)
        .where(eq(creditNotes.id, id))
        .returning();

      const updatedCreditNote = result[0];

      // If status changed to 'issued' and wasn't already issued, create double-entry GL records
      if (
        validCreditNoteData.status === "issued" &&
        currentCreditNote.status !== "issued" &&
        updatedCreditNote
      ) {
        try {
          // Get related invoice and customer information
          const invoice = await this.getSalesInvoice(
            updatedCreditNote.salesInvoiceId as number,
          );
          const customer = await this.getCustomer(
            updatedCreditNote.customerId as number,
          );

          if (customer) {
            const transactionDate =
              updatedCreditNote.creditNoteDate || // Already a string
              new Date().toISOString().split("T")[0];

            const cnCurrency = updatedCreditNote.currency || "AED";
            const cnExchangeRate = parseFloat(
              updatedCreditNote.exchangeRate || "1",
            );
            const cnOriginalAmount = parseFloat(
              (updatedCreditNote.totalAmount as string) || "0",
            );
            // Standard sales-return posting (H1): Dr Sales Returns (net) /
            // Dr VAT/GST Payable (tax) / Cr Accounts Receivable (gross). VAT line
            // omitted when tax is zero.
            const cnOriginalTax = parseFloat(
              (updatedCreditNote.taxAmount as string) || "0",
            );
            const cnAedTotal =
              Math.round(cnOriginalAmount * cnExchangeRate * 100) / 100;
            const cnAedTax =
              Math.round(cnOriginalTax * cnExchangeRate * 100) / 100;
            const cnAedNet = Math.round((cnAedTotal - cnAedTax) * 100) / 100;
            const cnCurrencyNote =
              cnCurrency !== "AED"
                ? ` (${cnCurrency} ${cnOriginalAmount.toFixed(2)} @ ${cnExchangeRate})`
                : "";

            const cnShared = {
              entryType: "receivable" as const,
              referenceType: "credit_note" as const,
              referenceId: updatedCreditNote.id,
              description: `Credit Note: ${
                updatedCreditNote.creditNoteNumber || "N/A"
              } for Invoice: ${invoice?.invoiceNumber || "N/A"}${cnCurrencyNote}`,
              entityId: customer.id,
              entityName: customer.name,
              projectId: invoice?.projectId || undefined,
              invoiceNumber: invoice?.invoiceNumber || undefined,
              transactionDate: transactionDate,
              status: "issued" as const,
            };

            // All three rows in ONE transaction (1.7/L14), as on the
            // create-as-issued path above.
            await db.transaction(async (tx) => {
              await this.createGeneralLedgerEntry(
                {
                  ...cnShared,
                  accountName: "Sales Returns and Allowances",
                  debitAmount: cnAedNet.toFixed(2),
                  creditAmount: "0",
                },
                tx,
              );
              if (cnAedTax > 0.005) {
                await this.createGeneralLedgerEntry(
                  {
                    ...cnShared,
                    accountName: "VAT/GST Payable",
                    debitAmount: cnAedTax.toFixed(2),
                    creditAmount: "0",
                  },
                  tx,
                );
              }
              await this.createGeneralLedgerEntry(
                {
                  ...cnShared,
                  accountName: "Accounts Receivable",
                  debitAmount: "0",
                  creditAmount: cnAedTotal.toFixed(2),
                },
                tx,
              );
            });

            console.log(
              `Created double-entry GL records for credit note ${updatedCreditNote.id}`,
            );

            // Update the related sales invoice
            if (invoice) {
              await this.updateSalesInvoiceFromCreditNote(
                invoice.id,
                parseFloat(updatedCreditNote.totalAmount as string),
              );

              // Create an invoice payment entry to show credit note application in payment history
              await this.createInvoicePaymentForCreditNote(
                invoice.id,
                updatedCreditNote,
              );

              // Contra-revenue: the project must be recalculated (see
              // createCreditNote).
              if (invoice.projectId) {
                await this.updateProjectRevenue(invoice.projectId);
              }
            }
          }
        } catch (glError) {
          console.error("Error creating GL entries for credit note:", glError);
          // Re-throw. Previously this was swallowed, so a credit note could
          // transition draft -> issued and report success while its ledger
          // postings had failed - the document said the customer was credited
          // and the ledger never recorded it. createCreditNote already
          // re-throws on the same failure; the two paths now agree.
          throw glError;
        }
      }

      return updatedCreditNote;
    } catch (error: any) {
      console.error("Original error in updateCreditNote:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in updateCreditNote (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateCreditNote",
        severity: "error",
      });
      throw error;
    }
  }

  async getCreditNotes(): Promise<CreditNoteWithDetails[]> {
    try {
      const result: CreditNoteWithDetails[] = await db
        .select({
          // All fields from CreditNote schema
          id: creditNotes.id,
          creditNoteNumber: creditNotes.creditNoteNumber,
          salesInvoiceId: creditNotes.salesInvoiceId,
          customerId: creditNotes.customerId,
          status: creditNotes.status,
          creditNoteDate: creditNotes.creditNoteDate,
          reason: creditNotes.reason,
          items: creditNotes.items,
          subtotal: creditNotes.subtotal,
          taxAmount: creditNotes.taxAmount,
          discountPercentage: creditNotes.discountPercentage,
          discount: creditNotes.discount,
          totalAmount: creditNotes.totalAmount,
          createdAt: creditNotes.createdAt,
          // Joined fields
          customerName: customers.name,
          invoiceNumber: salesInvoices.invoiceNumber,
        })
        .from(creditNotes)
        .leftJoin(customers, eq(creditNotes.customerId, customers.id))
        .leftJoin(
          salesInvoices,
          eq(creditNotes.salesInvoiceId, salesInvoices.id),
        )
        .orderBy(desc(creditNotes.createdAt));

      return result;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getCreditNotes: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getCreditNotes",
        severity: "error",
      });
      throw error;
    }
  }

  async getInvoicePayments(invoiceId: number): Promise<InvoicePayment[]> {
    try {
      const result = await db
        .select()
        .from(invoicePayments)
        .where(eq(invoicePayments.invoiceId, invoiceId))
        .orderBy(desc(invoicePayments.paymentDate));
      return result;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getInvoicePayments (invoiceId: ${invoiceId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getInvoicePayments",
        severity: "error",
      });
      throw error;
    }
  }

  async createInvoicePayment(
    paymentData: InsertInvoicePayment,
  ): Promise<InvoicePayment> {
    try {
      console.log("Creating invoice payment with data:", paymentData);

      const result = await db
        .insert(invoicePayments)
        .values(paymentData)
        .returning();

      const payment = result[0];
      console.log("Payment created:", payment);

      if (!payment || !payment.id) {
        throw new Error(
          "Failed to create payment - no payment record returned",
        );
      }

      // Get invoice and customer information
      const invoice = await this.getSalesInvoice(paymentData.invoiceId);
      console.log("Retrieved invoice:", invoice);

      if (!invoice) {
        throw new Error(`Invoice with ID ${paymentData.invoiceId} not found`);
      }

      const customer = await this.getCustomer(invoice.customerId);
      console.log("Retrieved customer:", customer);

      console.log(
        `Creating double-entry GL records for payment ${
          payment.id
        } - Invoice: ${invoice.invoiceNumber || "N/A"} - Amount: ${
          payment.amount
        }`,
      );

      const invoiceCurrency = invoice.currency || "AED";
      const invoiceExchangeRate = parseFloat(invoice.exchangeRate || "1");
      const originalAmount = parseFloat(payment.amount || "0");
      const aedAmount = (originalAmount * invoiceExchangeRate).toFixed(2);
      const currencyNote =
        invoiceCurrency !== "AED"
          ? ` (${invoiceCurrency} ${originalAmount.toFixed(2)} @ ${invoiceExchangeRate})`
          : "";

      // Create double-entry accounting records for payment.
      //
      // A credit note is recorded here as a payment (paymentType 'credit_note')
      // so the invoice shows part-settled — but it must NOT post the cash
      // settlement (Dr Cash/Bank / Cr AR). The credit note posts its own
      // Sales Returns / VAT / AR entry (L1/D1). Only real payments settle here.
      if (paymentData.paymentType !== "credit_note") {
      // Both rows in ONE transaction (1.7/L14). Posted independently, a failure
      // between them left Cash/Bank debited with no matching credit to
      // Accounts Receivable — cash recorded as received while the customer
      // still owed the full amount.
      const paymentShared = {
        entryType: "receivable",
        referenceType: "payment",
        referenceId: payment.id,
        description: `Payment received for Invoice: ${
          invoice.invoiceNumber || "N/A"
        }${currencyNote}`,
        entityId: invoice.customerId,
        entityName: customer?.name || "Unknown Customer",
        projectId: invoice.projectId || undefined,
        invoiceNumber: invoice.invoiceNumber,
        transactionDate:
          payment.paymentDate || new Date().toISOString().split("T")[0],
        status: "paid",
      };

      try {
        await db.transaction(async (tx) => {
          // 1. Debit: Cash/Bank (increase asset - cash received) in AED
          await this.createGeneralLedgerEntry(
            {
              ...paymentShared,
              accountName: "Cash/Bank",
              debitAmount: aedAmount,
              creditAmount: "0",
            },
            tx,
          );
          // 2. Credit: Accounts Receivable (customer no longer owes this) in AED
          await this.createGeneralLedgerEntry(
            {
              ...paymentShared,
              accountName: "Accounts Receivable",
              debitAmount: "0",
              creditAmount: aedAmount,
            },
            tx,
          );
        });

        console.log(
          `Successfully created payment GL entries for payment ${payment.id}`,
        );
      } catch (glError) {
        console.error("Error creating payment GL entries:", glError);
        throw new Error(
          `Failed to create payment GL entries: ${
            glError instanceof Error ? glError.message : String(glError)
          }`,
        );
      }
      }

      // Update invoice paid amount and project revenue
      await this.updateInvoicePaidAmount(paymentData.invoiceId);

      return payment;
    } catch (error: any) {
      // Preserve existing console.error and specific error logging structure
      console.error("Error creating invoice payment:", error);
      if (!error.isLogged) {
        // Avoid double logging
        await this.createErrorLog({
          message: `Error in createInvoicePayment: ${
            error?.message || String(error)
          }. Context: ${JSON.stringify(paymentData)}`,
          stack: error?.stack,
          url: "server/storage.ts",
          severity: "error",
          component: "createInvoicePayment",
        });
      }
      throw error;
    }
  }

  // Sales Quotations pagination method
  async getSalesQuotationsPaginated(
    page: number,
    limit: number,
    filters?: {
      search?: string;
      status?: string;
      customerId?: number;
      archived?: boolean;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<PaginatedResponse<SalesQuotationWithCustomerName>> {
    try {
      const queryConditions = [];
      // Search filter
      if (filters?.search && filters.search.trim()) {
        queryConditions.push(
          or(
            ilike(salesQuotations.quotationNumber, `%${filters.search}%`),
            ilike(customers.name, `%${filters.search}%`),
          ),
        );
      }
      // Customer filter
      if (filters?.customerId) {
        queryConditions.push(
          eq(salesQuotations.customerId, filters.customerId),
        );
      }
      // Date range filters
      if (filters?.startDate) {
        queryConditions.push(
          gte(salesQuotations.createdDate, new Date(filters.startDate)),
        );
      }
      if (filters?.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        queryConditions.push(lte(salesQuotations.createdDate, endDate));
      }
      // Status filter
      if (filters?.status && filters.status !== "all") {
        queryConditions.push(eq(salesQuotations.status, filters.status));
      }
      // Archive filter
      if (filters?.archived !== undefined) {
        queryConditions.push(eq(salesQuotations.isArchived, filters.archived));
      }

      const finalConditions =
        queryConditions.length > 0 ? and(...queryConditions) : undefined;

      const dataQueryBuilder = db
        .select({
          id: salesQuotations.id,
          quotationNumber: salesQuotations.quotationNumber,
          customerId: salesQuotations.customerId,
          customerName: customers.name,
          status: salesQuotations.status,
          validUntil: salesQuotations.validUntil,
          paymentTerms: salesQuotations.paymentTerms,
          bankAccount: salesQuotations.bankAccount,
          billingAddress: salesQuotations.billingAddress,
          termsAndConditions: salesQuotations.termsAndConditions,
          remarks: salesQuotations.remarks,
          items: salesQuotations.items,
          subtotal: salesQuotations.subtotal,
          taxAmount: salesQuotations.taxAmount,
          discountPercentage: salesQuotations.discountPercentage,
          discount: salesQuotations.discount,
          totalAmount: salesQuotations.totalAmount,
          currency: salesQuotations.currency,
          exchangeRate: salesQuotations.exchangeRate,
          isArchived: salesQuotations.isArchived,
          createdDate: salesQuotations.createdDate,
        })
        .from(salesQuotations)
        .leftJoin(customers, eq(salesQuotations.customerId, customers.id))
        .where(finalConditions)
        .orderBy(desc(salesQuotations.createdDate));

      const countQueryBuilder = db
        .select({ count: sql<number>`count(*)` })
        .from(salesQuotations)
        .leftJoin(customers, eq(salesQuotations.customerId, customers.id))
        .where(finalConditions);

      return this._getPaginatedResults<SalesQuotationWithCustomerName>(
        dataQueryBuilder,
        countQueryBuilder,
        page,
        limit,
      );
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getSalesQuotationsPaginated: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getSalesQuotationsPaginated",
        severity: "error",
      });
      throw error;
    }
  }

  // Sales Invoices pagination method
  async getSalesInvoicesPaginated(
    page: number,
    limit: number,
    filters?: {
      search?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      customerId?: number;
      projectId?: number;
    },
  ): Promise<{
    data: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const queryConditions = [];

      if (filters?.search && filters.search.trim()) {
        queryConditions.push(
          or(
            ilike(salesInvoices.invoiceNumber, `%${filters.search}%`),
            ilike(customers.name, `%${filters.search}%`),
          ),
        );
      }

      if (filters?.status && filters.status !== "all") {
        if (filters.status === "unpaid") {
          queryConditions.push(
            and(
              notInArray(salesInvoices.status, [
                "draft",
                "rejected",
                "pending_approval",
                "cancelled",
              ]),
              sql`CAST(COALESCE(${salesInvoices.totalAmount}, '0') AS DECIMAL) > CAST(COALESCE(${salesInvoices.paidAmount}, '0') AS DECIMAL)`,
            ),
          );
        } else if (filters.status === "overdue") {
          const now = new Date().toISOString();
          queryConditions.push(
            and(
              notInArray(salesInvoices.status, [
                "draft",
                "rejected",
                "pending_approval",
                "cancelled",
                "paid",
              ]),
              sql`CAST(COALESCE(${salesInvoices.totalAmount}, '0') AS DECIMAL) > CAST(COALESCE(${salesInvoices.paidAmount}, '0') AS DECIMAL)`,
              sql`${salesInvoices.dueDate} < ${now}`,
            ),
          );
        } else {
          queryConditions.push(eq(salesInvoices.status, filters.status));
        }
      }
      if (filters?.startDate) {
        queryConditions.push(gte(salesInvoices.invoiceDate, filters.startDate));
      }
      if (filters?.endDate) {
        queryConditions.push(lte(salesInvoices.invoiceDate, filters.endDate));
      }
      if (filters?.customerId) {
        queryConditions.push(eq(salesInvoices.customerId, filters.customerId));
      }
      if (filters?.projectId) {
        if (filters.projectId === -1) {
          queryConditions.push(isNull(salesInvoices.projectId));
        } else {
          queryConditions.push(eq(salesInvoices.projectId, filters.projectId));
        }
      }

      const finalConditions =
        queryConditions.length > 0 ? and(...queryConditions) : undefined;

      const dataQueryBuilder = db
        .select({
          id: salesInvoices.id,
          invoiceNumber: salesInvoices.invoiceNumber,
          customerId: salesInvoices.customerId,
          customerName: customers.name,
          projectId: salesInvoices.projectId,
          workOrderNumber: salesInvoices.workOrderNumber,
          projectTitle: projects.title,
          quotationId: salesInvoices.quotationId,
          status: salesInvoices.status,
          invoiceDate: salesInvoices.invoiceDate,
          dueDate: salesInvoices.dueDate,
          paymentTerms: salesInvoices.paymentTerms,
          bankAccount: salesInvoices.bankAccount,
          billingAddress: salesInvoices.billingAddress,
          termsAndConditions: salesInvoices.termsAndConditions,
          remarks: salesInvoices.remarks,
          items: salesInvoices.items,
          subtotal: salesInvoices.subtotal,
          taxAmount: salesInvoices.taxAmount,
          discountPercentage: salesInvoices.discountPercentage,
          discount: salesInvoices.discount,
          totalAmount: salesInvoices.totalAmount,
          paidAmount: salesInvoices.paidAmount,
          currency: salesInvoices.currency,
          exchangeRate: salesInvoices.exchangeRate,
        })
        .from(salesInvoices)
        .leftJoin(customers, eq(salesInvoices.customerId, customers.id))
        .leftJoin(projects, eq(salesInvoices.projectId, projects.id))
        .where(finalConditions)
        .orderBy(desc(salesInvoices.id));

      const countQueryBuilder = db
        .select({ count: sql<number>`count(*)` })
        .from(salesInvoices)
        .leftJoin(customers, eq(salesInvoices.customerId, customers.id))
        .leftJoin(projects, eq(salesInvoices.projectId, projects.id))
        .where(finalConditions);

      return this._getPaginatedResults<any>( // Using any for TData due to custom select shape
        dataQueryBuilder,
        countQueryBuilder,
        page,
        limit,
      );
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getSalesInvoicesPaginated: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getSalesInvoicesPaginated",
        severity: "error",
      });
      throw error;
    }
  }

  // Sales Quotation methods
  async getSalesQuotation(id: number): Promise<SalesQuotation | undefined> {
    try {
      const result = await db
        .select()
        .from(salesQuotations)
        .where(eq(salesQuotations.id, id))
        .limit(1);
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getSalesQuotation (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getSalesQuotation",
        severity: "error",
      });
      throw error;
    }
  }

  /**
   * Recompute a sales document's totals authoritatively from its line items and
   * discounts, so VAT is charged on the DISCOUNTED base (UAE law) and the server
   * never trusts a client-supplied `taxAmount` (P4b). Line items are the JSON
   * `items` array (`quantity`, `unitPrice`, `taxRate`, and now `discount` /
   * `discountType`); the header discount is `discountPercentage` (%) or, when
   * that is zero, the fixed `discount` amount. Returns a copy of `data` with each
   * line's `taxAmount`/`lineTotal` and the document `subtotal`/`discount`
   * (line + header total)/`taxAmount`/`totalAmount` corrected. A document with no
   * items array is returned unchanged.
   */
  private applySalesDocumentTotals<T extends Record<string, any>>(data: T): T {
    // `items` is an array on most sales docs but a JSON string on credit notes.
    const raw = (data as any).items;
    let items: any[] | null = null;
    let wasString = false;
    if (Array.isArray(raw)) {
      items = raw;
    } else if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          items = parsed;
          wasString = true;
        }
      } catch {
        /* not JSON — leave items null so this is a no-op */
      }
    }
    if (!items || items.length === 0) return data;

    const lineInputs: LineItemInput[] = items.map((it) => ({
      quantity: Number(it.quantity) || 0,
      unitPrice: Number(it.unitPrice) || 0,
      taxRate: Number(it.taxRate) || 0,
      discount: Number(it.discount) || 0,
      discountType: it.discountType === "percentage" ? "percentage" : "amount",
    }));

    const headerPct = Number((data as any).discountPercentage) || 0;
    const header: HeaderDiscountInput =
      headerPct > 0
        ? { discount: headerPct, discountType: "percentage" }
        : {
            discount: Number((data as any).discount) || 0,
            discountType: "amount",
          };

    const totals = computeDocumentTotals(lineInputs, header);

    const itemsOut = items.map((it, i) => ({
      ...it,
      taxAmount: totals.lines[i].taxAmount,
      lineTotal: totals.lines[i].lineTotal,
    }));

    return {
      ...data,
      items: wasString ? JSON.stringify(itemsOut) : itemsOut,
      subtotal: totals.gross.toFixed(2),
      // The `discount` column stores the HEADER discount only (its pre-P4b
      // meaning) so the edit/convert forms reload it correctly. The combined
      // total (header + line) is derived for display as
      // subtotal + taxAmount - totalAmount, which equals discountTotal to the cent.
      discount: totals.headerDiscount.toFixed(2),
      taxAmount: totals.taxTotal.toFixed(2),
      totalAmount: totals.total.toFixed(2),
    };
  }

  /**
   * Resolves the invoice a credit note credits, and refuses the cases that
   * would corrupt Accounts Receivable. Returns the invoice so the caller can
   * inherit its currency, or `undefined` for an unlinked draft.
   *
   * **Issuing without an invoice is refused.** It would still post
   * `Cr Accounts Receivable`, reducing the control account against nothing — an
   * amount no statement, receivables list or ageing view can attribute to
   * anyone, because there is no document to attribute it to. Three such notes
   * exist (CN-AQNV-2026-005/006/007), holding 315.00 of AR credit between them
   * that reconciles to no invoice.
   *
   * Only issuing is blocked. A draft posts nothing, so it can be saved and
   * linked later, which is also how the existing edit flow reaches `issued`.
   *
   * The invoice is fetched rather than the id merely checked for presence: a
   * stale or wrong id resolves to `undefined` and then posts exactly the same
   * way, since every use of it downstream is optional-chained.
   */
  private async resolveCreditNoteInvoice(
    salesInvoiceId: number | null | undefined,
    status: string | null | undefined,
  ): Promise<any | undefined> {
    if (!salesInvoiceId) {
      if (status === "issued") {
        throw new Error(
          "A credit note must be linked to a sales invoice before it can be issued — it posts against that invoice's receivable.",
        );
      }
      return undefined;
    }

    const invoice = await this.getSalesInvoice(salesInvoiceId);
    if (!invoice && status === "issued") {
      throw new Error(
        `Sales invoice ${salesInvoiceId} could not be found, so this credit note cannot be issued against it.`,
      );
    }
    return invoice;
  }

  /**
   * A credit note cannot credit more than the invoice was worth, and neither
   * can the credit notes against one invoice in aggregate.
   *
   * Nothing enforced this, which is how `CN-AQNV-2026-002` came to exist: USD
   * 483.79 against a USD 179.56 invoice, 2.7 times what was ever owed. It read
   * as an overpayment of 1,117.30 in every receivables view and was a third of
   * the gap between the document view of receivables and the AR control
   * account. Checking one note against the invoice alone would not be enough —
   * five notes at a quarter of the invoice each would pass individually — so
   * the test is on the running total.
   *
   * Only ISSUED notes count toward that total: a draft has posted nothing and a
   * cancelled one has been reversed, so counting either would refuse credits
   * that are genuinely available. Amounts are directly comparable because a
   * credit note now takes its invoice's currency and rate.
   */
  private async assertCreditNoteWithinInvoice(
    invoice: any,
    amount: number,
    excludeCreditNoteId?: number,
  ): Promise<void> {
    const invoiceTotal = parseFloat(invoice.totalAmount || "0");

    const issued = await db
      .select({ id: creditNotes.id, totalAmount: creditNotes.totalAmount })
      .from(creditNotes)
      .where(
        and(
          eq(creditNotes.salesInvoiceId, invoice.id),
          eq(creditNotes.status, "issued"),
        ),
      );

    const alreadyCredited = issued
      .filter((c) => c.id !== excludeCreditNoteId)
      .reduce((sum, c) => sum + parseFloat(c.totalAmount || "0"), 0);

    if (alreadyCredited + amount > invoiceTotal + 0.005) {
      const remaining = invoiceTotal - alreadyCredited;
      throw new Error(
        `A credit note cannot exceed the invoice it credits. Invoice ` +
          `${invoice.invoiceNumber} is ${invoiceTotal.toFixed(2)} ` +
          `${invoice.currency || "AED"}` +
          (alreadyCredited > 0
            ? `, of which ${alreadyCredited.toFixed(2)} is already credited by other credit notes`
            : "") +
          `, so at most ${Math.max(0, remaining).toFixed(2)} can be credited — this one is ` +
          `${amount.toFixed(2)}.`,
      );
    }
  }

  /**
   * A credit note is denominated in the currency of the invoice it credits, at
   * that invoice's rate — never in its own.
   *
   * Both sides of the system already assume this. The ledger posts the note at
   * whatever rate the note carries, while `paid_amount` sums settlement amounts
   * currency-blind and the receivables views translate that sum at the
   * *invoice's* rate. A note in a different currency is therefore counted at one
   * rate in the ledger and another in every document view. CN-AQNV-2026-003 and
   * -004 are AED 105.00 against a USD invoice at 3.672555: the ledger has
   * 105.00, the document side reads 385.62, and the 564.90 between them is most
   * of the gap between receivables and the AR control account.
   *
   * The credit note form already copies both fields from the selected invoice.
   * The two that got through were written 31ms apart by a script, so the rule
   * is enforced here as well, where every path has to pass.
   */
  private applyCreditNoteInvoiceCurrency<T extends Record<string, any>>(
    data: T,
    invoice: any | undefined,
  ): T {
    if (!invoice) return data;
    return {
      ...data,
      currency: invoice.currency || "AED",
      exchangeRate: invoice.exchangeRate || "1",
    };
  }

  async createSalesQuotation(
    quotationData: InsertSalesQuotation,
  ): Promise<SalesQuotation> {
    try {
      const result = await db
        .insert(salesQuotations)
        .values(this.applySalesDocumentTotals(quotationData))
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createSalesQuotation: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createSalesQuotation",
        severity: "error",
      });
      throw error;
    }
  }

  async updateSalesQuotation(
    id: number,
    quotationData: Partial<InsertSalesQuotation>,
  ): Promise<SalesQuotation | undefined> {
    try {
      const result = await db
        .update(salesQuotations)
        .set(this.applySalesDocumentTotals(quotationData))
        .where(eq(salesQuotations.id, id))
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateSalesQuotation (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateSalesQuotation",
        severity: "error",
      });
      throw error;
    }
  }

  async submitSalesQuotationForApproval(
    id: number,
    userId: number,
  ): Promise<any> {
    try {
      await db
        .update(salesQuotations)
        .set({
          status: "pending_approval",
          submittedById: userId,
          submittedAt: new Date(),
        })
        .where(eq(salesQuotations.id, id));

      return this.getSalesQuotation(id);
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in submitSalesQuotationForApproval (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "submitSalesQuotationForApproval",
        severity: "error",
      });
      throw error;
    }
  }

  async approveSalesQuotation(id: number, userId: number): Promise<void> {
    try {
      await db
        .update(salesQuotations)
        .set({
          status: "approved",
          approvedById: userId,
          approvedAt: new Date(),
        })
        .where(eq(salesQuotations.id, id));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in approveSalesQuotation (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "approveSalesQuotation",
        severity: "error",
      });
      throw error;
    }
  }

  async rejectSalesQuotation(
    id: number,
    userId: number,
    reason?: string,
  ): Promise<any> {
    try {
      await db
        .update(salesQuotations)
        .set({
          status: "rejected",
          rejectionReason: reason || null,
          approvedById: userId,
          approvedAt: new Date(),
        })
        .where(eq(salesQuotations.id, id));

      return this.getSalesQuotation(id);
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in rejectSalesQuotation (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "rejectSalesQuotation",
        severity: "error",
      });
      throw error;
    }
  }

  // Proforma Invoice methods
  async getProformaInvoices(): Promise<any[]> {
    try {
      const result = await db
        .select({
          id: proformaInvoices.id,
          proformaNumber: proformaInvoices.proformaNumber,
          customerId: proformaInvoices.customerId,
          customerName: customers.name,
          projectId: proformaInvoices.projectId,
          workOrderNumber: proformaInvoices.workOrderNumber,
          status: proformaInvoices.status,
          createdDate: proformaInvoices.createdDate,
          invoiceDate: proformaInvoices.invoiceDate,
          validUntil: proformaInvoices.validUntil,
          paymentTerms: proformaInvoices.paymentTerms,
          deliveryTerms: proformaInvoices.deliveryTerms,
          billingAddress: proformaInvoices.billingAddress,
          bankAccount: proformaInvoices.bankAccount,
          termsAndConditions: proformaInvoices.termsAndConditions,
          remarks: proformaInvoices.remarks,
          items: proformaInvoices.items,
          subtotal: proformaInvoices.subtotal,
          taxAmount: proformaInvoices.taxAmount,
          discountPercentage: proformaInvoices.discountPercentage,
          discount: proformaInvoices.discount,
          totalAmount: proformaInvoices.totalAmount,
          currency: proformaInvoices.currency,
          exchangeRate: proformaInvoices.exchangeRate,
          isArchived: proformaInvoices.isArchived,
        })
        .from(proformaInvoices)
        .leftJoin(customers, eq(proformaInvoices.customerId, customers.id))
        .orderBy(desc(proformaInvoices.createdDate));

      return result;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in getProformaInvoices: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getProformaInvoices",
        severity: "error",
      });
      throw error;
    }
  }

  async getProformaInvoice(id: number): Promise<any | undefined> {
    try {
      const result = await db
        .select({
          id: proformaInvoices.id,
          proformaNumber: proformaInvoices.proformaNumber,
          customerId: proformaInvoices.customerId,
          customerName: customers.name,
          projectId: proformaInvoices.projectId,
          workOrderNumber: proformaInvoices.workOrderNumber,
          status: proformaInvoices.status,
          createdDate: proformaInvoices.createdDate,
          validUntil: proformaInvoices.validUntil,
          paymentTerms: proformaInvoices.paymentTerms,
          deliveryTerms: proformaInvoices.deliveryTerms,
          billingAddress: proformaInvoices.billingAddress,
          bankAccount: proformaInvoices.bankAccount,
          termsAndConditions: proformaInvoices.termsAndConditions,
          remarks: proformaInvoices.remarks,
          items: proformaInvoices.items,
          subtotal: proformaInvoices.subtotal,
          taxAmount: proformaInvoices.taxAmount,
          discountPercentage: proformaInvoices.discountPercentage,
          discount: proformaInvoices.discount,
          totalAmount: proformaInvoices.totalAmount,
          currency: proformaInvoices.currency,
          exchangeRate: proformaInvoices.exchangeRate,
          isArchived: proformaInvoices.isArchived,
        })
        .from(proformaInvoices)
        .leftJoin(customers, eq(proformaInvoices.customerId, customers.id))
        .where(eq(proformaInvoices.id, id))
        .limit(1);

      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getProformaInvoice (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getProformaInvoice",
        severity: "error",
      });
      throw error;
    }
  }

  async createProformaInvoice(proformaData: any): Promise<any> {
    try {
      console.log(
        "Storage: Creating proforma invoice with data:",
        proformaData,
      );

      // Generate proforma number
      const proformaNumber = await this.generateNextNumber(
        "PRF",
        proformaInvoices,
        proformaInvoices.proformaNumber,
      );

      // Prepare the data
      const insertData = {
        proformaNumber,
        customerId: proformaData.customerId,
        projectId: proformaData.projectId || null,
        quotationId: proformaData.quotationId || null,
        workOrderNumber: proformaData.workOrderNumber || null,
        currency: proformaData.currency || "AED",
        exchangeRate: proformaData.exchangeRate || "1",
        status: proformaData.status || "draft",
        validUntil: proformaData.validUntil
          ? new Date(proformaData.validUntil).toISOString()
          : null,
        billingAddress: proformaData.billingAddress,
        paymentTerms: proformaData.paymentTerms || null,
        deliveryTerms: proformaData.deliveryTerms || null,
        bankAccount: proformaData.bankAccount || null,
        termsAndConditions: proformaData.termsAndConditions || null,
        remarks: proformaData.remarks || null,
        items: JSON.stringify(proformaData.items || []),
        subtotal: proformaData.subtotal || null,
        taxAmount: proformaData.taxAmount || null,
        discount: proformaData.discount || "0",
        discountPercentage: proformaData.discountPercentage || "0",
        totalAmount: proformaData.totalAmount || null,
        isArchived: false,
      };

      console.log("Storage: Insert data:", insertData);

      const result = await db
        .insert(proformaInvoices)
        .values(this.applySalesDocumentTotals(insertData))
        .returning();

      console.log("Storage: Created proforma invoice:", result[0]);
      return result[0];
    } catch (error: any) {
      console.error("Original error in createProformaInvoice:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          "Error in createProformaInvoice: " +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createProformaInvoice",
        severity: "error",
      });
      throw error;
    }
  }

  async updateProformaInvoice(
    id: number,
    proformaData: any,
  ): Promise<any | undefined> {
    try {
      console.log(
        "Storage: Updating proforma invoice",
        id,
        "with data:",
        proformaData,
      );

      // Get existing proforma to preserve data that's not being updated
      const existing = await this.getProformaInvoice(id);
      if (!existing) {
        throw new Error(`Proforma invoice with ID ${id} not found`);
      }

      // Prepare the update data, only updating fields that are provided
      const updateData: any = {};

      if (proformaData.customerId !== undefined)
        updateData.customerId = proformaData.customerId;
      if (proformaData.projectId !== undefined)
        updateData.projectId = proformaData.projectId || null;
      if (proformaData.quotationId !== undefined)
        updateData.quotationId = proformaData.quotationId || null;
      if (proformaData.workOrderNumber !== undefined)
        updateData.workOrderNumber = proformaData.workOrderNumber || null;
      if (proformaData.status !== undefined)
        updateData.status = proformaData.status;
      if (proformaData.invoiceDate !== undefined)
        updateData.invoiceDate = proformaData.invoiceDate
          ? new Date(proformaData.invoiceDate).toISOString()
          : null;
      if (proformaData.billingAddress !== undefined)
        updateData.billingAddress = proformaData.billingAddress || null;
      if (proformaData.validUntil !== undefined)
        updateData.validUntil = proformaData.validUntil
          ? new Date(proformaData.validUntil).toISOString()
          : null;
      if (proformaData.paymentTerms !== undefined)
        updateData.paymentTerms = proformaData.paymentTerms || null;
      if (proformaData.deliveryTerms !== undefined)
        updateData.deliveryTerms = proformaData.deliveryTerms || null;
      if (proformaData.bankAccount !== undefined)
        updateData.bankAccount = proformaData.bankAccount || null;
      if (proformaData.remarks !== undefined)
        updateData.remarks = proformaData.remarks || null;
      if (proformaData.termsAndConditions !== undefined)
        updateData.termsAndConditions = proformaData.termsAndConditions || null;
      if (proformaData.items !== undefined)
        updateData.items = JSON.stringify(proformaData.items || []);
      if (proformaData.subtotal !== undefined)
        updateData.subtotal = proformaData.subtotal || null;
      if (proformaData.taxAmount !== undefined) updateData.taxAmount || null;
      if (proformaData.discount !== undefined)
        updateData.discount = proformaData.discount || "0";
      if (proformaData.discountPercentage !== undefined)
        updateData.discountPercentage = proformaData.discountPercentage;
      if (proformaData.totalAmount !== undefined)
        updateData.totalAmount = proformaData.totalAmount || null;
      if (proformaData.currency !== undefined)
        updateData.currency = proformaData.currency;
      if (proformaData.exchangeRate !== undefined)
        updateData.exchangeRate = proformaData.exchangeRate;
      if (proformaData.isArchived !== undefined)
        updateData.isArchived = proformaData.isArchived || false;

      const result = await db
        .update(proformaInvoices)
        .set(this.applySalesDocumentTotals(updateData))
        .where(eq(proformaInvoices.id, id))
        .returning();
      return result[0];
    } catch (error: any) {
      console.error("Original error in updateProformaInvoice:", error); // Keep original console.error
      await this.createErrorLog({
        message:
          `Error in updateProformaInvoice (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateProformaInvoice",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteProformaInvoice(id: number): Promise<void> {
    try {
      await db.delete(proformaInvoices).where(eq(proformaInvoices.id, id));
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deleteProformaInvoice (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteProformaInvoice",
        severity: "error",
      });
      throw error;
    }
  }

  /**
   * Cancel an ISSUED credit note, reversing everything issuing it did.
   *
   * Issuing a credit note has three effects: it posts three GL rows
   * (Dr Sales Returns / Dr VAT Payable / Cr Accounts Receivable), it writes a
   * settlement row into invoice_payments so the invoice shows part-settled, and
   * the invoice's paidAmount and status are recalculated from that. Cancelling
   * undoes all three, in one transaction:
   *
   *   - a mirrored GL set is posted, so net movement is zero and BOTH the
   *     original and the reversal stay visible for audit
   *   - the settlement row is deleted. It posts no GL of its own (D1), so
   *     removing it destroys no ledger history, and paidAmount is derived by
   *     summing invoice_payments — so deleting the row is what makes the
   *     invoice self-correct. The credit note itself remains, marked cancelled,
   *     as the record that this happened
   *   - the invoice's paidAmount and status are recalculated
   *
   * Refused when the credit note is worth more than the invoice's outstanding
   * balance: that means cash has since settled what the credit note was
   * covering, and reopening it would demand money the customer has already
   * paid. Refund the payment instead.
   */
  async cancelCreditNote(id: number, userId?: number): Promise<CreditNote> {
    try {
      const [creditNote] = await db
        .select()
        .from(creditNotes)
        .where(eq(creditNotes.id, id))
        .limit(1);
      if (!creditNote) throw new Error("Credit note not found");
      if (creditNote.status === "cancelled") {
        throw new Error("This credit note is already cancelled");
      }
      if (creditNote.status !== "issued") {
        throw new Error(
          `Only an issued credit note can be cancelled. This one is ${creditNote.status} — delete it instead, it has posted nothing.`,
        );
      }

      const invoiceId = creditNote.salesInvoiceId;

      let invoice: SalesInvoice | undefined;
      if (invoiceId) {
        invoice = await this.getSalesInvoice(invoiceId);
        if (invoice) {
          // Measure the invoice WITHOUT this credit note, since cancelling is
          // precisely the act of removing it. The previous check read
          // `paidAmount`, which already includes this note's own settlement
          // row, so a note that settled its invoice in full always looked like
          // it exceeded the outstanding balance and could never be cancelled —
          // the one case most likely to need correcting. Partial ones passed,
          // which is why the tests missed it.
          //
          // Cancelling never demands money the customer has already handed
          // over: their cash stays applied and only the credited portion of the
          // debt reopens, which is the correct outcome when the credit was
          // wrong. What is genuinely unsafe is cancelling into an invoice that
          // OTHER settlements have already over-paid, because that compounds a
          // state needing a refund rather than a reversal.
          const settlements = await db
            .select({
              amount: invoicePayments.amount,
              creditNoteId: invoicePayments.creditNoteId,
            })
            .from(invoicePayments)
            .where(eq(invoicePayments.invoiceId, invoiceId));

          const total = parseFloat(invoice.totalAmount || "0");
          const settledByOthers = settlements
            .filter((s) => s.creditNoteId !== id)
            .reduce((sum, s) => sum + parseFloat(s.amount || "0"), 0);

          if (settledByOthers > total + 0.005) {
            throw new Error(
              `Cannot cancel: invoice ${invoice.invoiceNumber} is already settled ` +
                `${settledByOthers.toFixed(2)} against a total of ${total.toFixed(2)} by ` +
                `other payments and credit notes, so removing this one would leave it ` +
                `over-settled. Refund the excess instead.`,
            );
          }
        }
      }

      // Mirror whatever was actually posted, rather than recomputing it, so the
      // reversal matches the original line for line even if rates have moved.
      const original = await db
        .select()
        .from(generalLedgerEntries)
        .where(
          and(
            eq(generalLedgerEntries.referenceType, "credit_note"),
            eq(generalLedgerEntries.referenceId, id),
            ne(generalLedgerEntries.status, "cancelled"),
          ),
        );

      await db.transaction(async (tx) => {
        for (const row of original) {
          await tx.insert(generalLedgerEntries).values({
            entryType: row.entryType,
            referenceType: "credit_note",
            referenceId: id,
            accountName: row.accountName,
            description: `CANCELLED - ${row.description ?? ""}`,
            debitAmount: row.creditAmount ?? "0", // swap
            creditAmount: row.debitAmount ?? "0", // swap
            entityId: row.entityId,
            entityName: row.entityName,
            projectId: row.projectId,
            invoiceNumber: row.invoiceNumber,
            transactionDate: new Date().toISOString().split("T")[0],
            status: "cancelled",
            createdBy: userId ?? null,
          });
        }

        // Drop the settlement row so the invoice's paidAmount self-corrects.
        if (invoiceId) {
          await tx
            .delete(invoicePayments)
            .where(
              and(
                eq(invoicePayments.invoiceId, invoiceId),
                eq(invoicePayments.creditNoteId, id),
              ),
            );
        }

        await tx
          .update(creditNotes)
          .set({ status: "cancelled" })
          .where(eq(creditNotes.id, id));
      });

      // Recalculate outside the transaction: these read the rows back.
      if (invoiceId) await this.updateInvoicePaidAmount(invoiceId);
      // The credit note no longer counts against the project, so its revenue
      // must be restored.
      if (invoice?.projectId) {
        await this.updateProjectRevenue(invoice.projectId);
      }

      const [updated] = await db
        .select()
        .from(creditNotes)
        .where(eq(creditNotes.id, id))
        .limit(1);
      return updated;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in cancelCreditNote (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "cancelCreditNote",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteCreditNote(id: number): Promise<boolean> {
    // This is for sales credit notes
    try {
      // Only a draft may be deleted. An issued credit note has posted to the
      // ledger and settled part of an invoice; deleting it left those rows
      // orphaned — revenue still reduced and VAT still reversed for a document
      // that no longer exists. Issued notes go through cancelCreditNote, which
      // reverses all of it and keeps the note on record.
      const [existing] = await db
        .select({ status: creditNotes.status })
        .from(creditNotes)
        .where(eq(creditNotes.id, id))
        .limit(1);
      if (existing && existing.status !== "draft") {
        throw new Error(
          `Only a draft credit note can be deleted. This one is ${existing.status} — cancel it instead, so its ledger entries are reversed rather than orphaned.`,
        );
      }

      const result = await db.delete(creditNotes).where(eq(creditNotes.id, id));
      return result.count > 0;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in deleteCreditNote (sales, id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteCreditNote",
        severity: "error",
      });
      throw error;
    }
  }

  async getCreditNotesByInvoice(invoiceId: number): Promise<any[]> {
    try {
      const result = await db
        .select()
        .from(creditNotes)
        .where(eq(creditNotes.salesInvoiceId, invoiceId))
        .orderBy(desc(creditNotes.createdAt));

      return result;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getCreditNotesByInvoice (invoiceId: ${invoiceId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getCreditNotesByInvoice",
        severity: "error",
      });
      throw error;
    }
  }

  async createInvoicePaymentForCreditNote(
    invoiceId: number,
    creditNote: CreditNote,
  ): Promise<InvoicePayment> {
    try {
      const paymentData: InsertInvoicePayment = {
        invoiceId: invoiceId,
        amount: creditNote.totalAmount as string,
        paymentDate: creditNote.creditNoteDate,
        paymentMethod: "Credit Note",
        referenceNumber: creditNote.creditNoteNumber,
        notes: `Credit note applied: ${creditNote.reason || "N/A"}`,
        paymentType: "credit_note",
        creditNoteId: creditNote.id,
        // recordedBy is optional in InsertInvoicePayment based on schema (nullable, no default)
      };

      // Ensure createInvoicePayment is awaited as it's an async function
      const payment = await this.createInvoicePayment(paymentData);
      return payment;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in createInvoicePaymentForCreditNote (invoiceId: ${invoiceId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createInvoicePaymentForCreditNote",
        severity: "error",
      });
      throw error;
    }
  }

  async updateSalesInvoiceFromCreditNote(
    invoiceId: number,
    creditNoteAmount: number,
  ): Promise<SalesInvoice | undefined> {
    try {
      const invoice = await this.getSalesInvoice(invoiceId);
      if (!invoice) {
        throw new Error(`Sales invoice ${invoiceId} not found`);
      }

      const currentPaidAmount = parseFloat(invoice.paidAmount || "0");
      const newPaidAmount = currentPaidAmount + creditNoteAmount; // Credit note effectively "pays" this amount

      // Update invoice paid amount and status
      await this.updateInvoicePaidAmount(invoiceId); // This will recalculate status

      // Return the updated invoice
      return this.getSalesInvoice(invoiceId);
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateSalesInvoiceFromCreditNote (invoiceId: ${invoiceId}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateSalesInvoiceFromCreditNote",
        severity: "error",
      });
      throw error;
    }
  }

  async getSalesQuotations(): Promise<SalesQuotation[]> {
    try {
      return await db.select().from(salesQuotations);
    } catch (error: any) {
      // console.error("Error getting sales quotations:", error); // Original console.error commented out
      await this.createErrorLog({
        message:
          "Error in getSalesQuotations: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getSalesQuotations",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteSalesQuotation(id: number): Promise<void> {
    try {
      await db.delete(salesQuotations).where(eq(salesQuotations.id, id));
    } catch (error: any) {
      // console.error("Error deleting sales quotation:", error); // Original console.error commented out
      await this.createErrorLog({
        message:
          `Error in deleteSalesQuotation (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteSalesQuotation",
        severity: "error",
      });
      throw error;
    }
  }

  async getSalesInvoices(): Promise<SalesInvoice[]> {
    try {
      return await db.select().from(salesInvoices);
    } catch (error: any) {
      // console.error("Error getting sales invoices:", error); // Original console.error commented out
      await this.createErrorLog({
        message:
          "Error in getSalesInvoices: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getSalesInvoices",
        severity: "error",
      });
      throw error;
    }
  }

  async getSalesInvoice(id: number): Promise<SalesInvoice | undefined> {
    try {
      const result = await db
        .select()
        .from(salesInvoices)
        .where(eq(salesInvoices.id, id))
        .limit(1);
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in getSalesInvoice (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "getSalesInvoice",
        severity: "error",
      });
      throw error;
    }
  }

  async createSalesInvoice(
    invoiceData: InsertSalesInvoice,
  ): Promise<SalesInvoice> {
    try {
      // Generate a temporary invoice number if not provided, ensuring it fits in 20 chars
      // INV-DRAFT- + 10 digits (from timestamp) = 20 chars
      const timestamp = Date.now().toString().slice(-10);
      const invoiceNumber =
        invoiceData.invoiceNumber || `INV-DRFT-${timestamp}`;
      const [invoice] = await db
        .insert(salesInvoices)
        .values(
          this.applySalesDocumentTotals({
            ...invoiceData,
            invoiceNumber,
            status: invoiceData.status || "draft",
            paidAmount: "0",
          }),
        )
        .returning();
      return invoice;
    } catch (error: any) {
      await this.createErrorLog({
        message:
          "Error in createSalesInvoice: " + (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "createSalesInvoice",
        severity: "error",
      });
      throw error;
    }
  }

  async updateSalesInvoice(
    id: number,
    invoiceData: Partial<InsertSalesInvoice>,
  ): Promise<SalesInvoice | undefined> {
    try {
      console.log("invoiceData", invoiceData);
      const result = await db
        .update(salesInvoices)
        .set(this.applySalesDocumentTotals(invoiceData))
        .where(eq(salesInvoices.id, id))
        .returning();
      return result[0];
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in updateSalesInvoice (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "updateSalesInvoice",
        severity: "error",
      });
      throw error;
    }
  }

  async submitSalesInvoiceForApproval(
    id: number,
    userId: number,
  ): Promise<any> {
    try {
      await db
        .update(salesInvoices)
        .set({
          status: "pending_approval",
          submittedById: userId,
          submittedAt: new Date(),
        })
        .where(eq(salesInvoices.id, id));

      return this.getSalesInvoice(id);
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in submitSalesInvoiceForApproval (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "submitSalesInvoiceForApproval",
        severity: "error",
      });
      throw error;
    }
  }

  async approveSalesInvoice(id: number, userId: number): Promise<void> {
    try {
      const invoice = await this.getSalesInvoice(id);
      if (!invoice) throw new Error("Invoice not found");

      // Generate permanent invoice number if it was a draft
      const invoiceNumber = invoice.invoiceNumber?.startsWith("INV-AQNV-")
        ? invoice.invoiceNumber
        : await this.generateNextNumber(
            "INV",
            salesInvoices,
            salesInvoices.invoiceNumber,
          );

      await db
        .update(salesInvoices)
        .set({
          status: "approved",
          invoiceNumber,
          approvedById: userId,
          approvedAt: new Date(),
        })
        .where(eq(salesInvoices.id, id));

      // Create GL entries
      await this.createInvoiceGLEntries(id);

      // If invoice is linked to a project, update project total revenue (accrual basis)
      if (invoice.projectId) {
        await this.updateProjectRevenue(invoice.projectId);
      }
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in approveSalesInvoice (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "approveSalesInvoice",
        severity: "error",
      });
      throw error;
    }
  }

  async rejectSalesInvoice(
    id: number,
    userId: number,
    reason?: string,
  ): Promise<any> {
    try {
      await db
        .update(salesInvoices)
        .set({
          status: "rejected",
          rejectionReason: reason || null,
          approvedById: userId,
          approvedAt: new Date(),
        })
        .where(eq(salesInvoices.id, id));

      return this.getSalesInvoice(id);
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in rejectSalesInvoice (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "rejectSalesInvoice",
        severity: "error",
      });
      throw error;
    }
  }

  async deleteSalesInvoice(id: number): Promise<void> {
    try {
      await db.delete(salesInvoices).where(eq(salesInvoices.id, id));
    } catch (error: any) {
      // console.error("Error deleting sales invoice:", error); // Original console.error commented out
      await this.createErrorLog({
        message:
          `Error in deleteSalesInvoice (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "deleteSalesInvoice",
        severity: "error",
      });
      throw error;
    }
  }

  async cancelSalesInvoice(id: number, userId: number): Promise<any> {
    try {
      const invoice = await this.getSalesInvoice(id);
      if (!invoice) throw new Error("Invoice not found");

      const cancellableStatuses = ["approved", "unpaid", "overdue"];
      if (!cancellableStatuses.includes(invoice.status)) {
        throw new Error("Only approved or unpaid invoices can be cancelled");
      }

      const payments = await this.getInvoicePayments(id);
      if (payments && payments.length > 0) {
        throw new Error("Cannot cancel invoice with payments received");
      }

      const creditNotesList = await this.getCreditNotesByInvoice(id);
      if (creditNotesList && creditNotesList.length > 0) {
        throw new Error("Cannot cancel invoice with credit notes issued");
      }

      await db
        .update(salesInvoices)
        .set({ status: "cancelled" })
        .where(eq(salesInvoices.id, id));

      await this.createCancellationGLEntries(id);

      // If invoice was linked to a project, reverse the revenue contribution
      if (invoice.projectId) {
        await this.updateProjectRevenue(invoice.projectId);
      }

      return this.getSalesInvoice(id);
    } catch (error: any) {
      await this.createErrorLog({
        message:
          `Error in cancelSalesInvoice (id: ${id}): ` +
          (error?.message || "Unknown error"),
        stack: error?.stack,
        component: "cancelSalesInvoice",
        severity: "error",
      });
      throw error;
    }
  }

  async createInvoiceEditHistory(
    data: InsertInvoiceEditHistory,
  ): Promise<InvoiceEditHistory> {
    try {
      const [entry] = await db
        .insert(invoiceEditHistory)
        .values(data)
        .returning();
      return entry;
    } catch (error: any) {
      await this.createErrorLog({
        message: `Error in createInvoiceEditHistory: ${error?.message || "Unknown error"}`,
        stack: error?.stack,
        component: "createInvoiceEditHistory",
        severity: "error",
      });
      throw error;
    }
  }

  async getInvoiceEditHistory(
    invoiceType: string,
    invoiceId: number,
  ): Promise<InvoiceEditHistory[]> {
    try {
      return await db
        .select()
        .from(invoiceEditHistory)
        .where(
          and(
            eq(invoiceEditHistory.invoiceType, invoiceType),
            eq(invoiceEditHistory.invoiceId, invoiceId),
          ),
        )
        .orderBy(desc(invoiceEditHistory.editedAt));
    } catch (error: any) {
      await this.createErrorLog({
        message: `Error in getInvoiceEditHistory: ${error?.message || "Unknown error"}`,
        stack: error?.stack,
        component: "getInvoiceEditHistory",
        severity: "error",
      });
      throw error;
    }
  }

  async updateSalesInvoiceGLEntries(invoiceId: number): Promise<void> {
    try {
      const invoice = await db
        .select()
        .from(salesInvoices)
        .leftJoin(customers, eq(salesInvoices.customerId, customers.id))
        .where(eq(salesInvoices.id, invoiceId))
        .limit(1);

      if (!invoice[0]) {
        throw new Error(`Invoice with ID ${invoiceId} not found`);
      }

      const invoiceData = invoice[0].sales_invoices;
      const customerData = invoice[0].customers;

      const invoiceCurrency = invoiceData.currency || "AED";
      const invoiceExchangeRate = parseFloat(invoiceData.exchangeRate || "1");
      const originalAmount = parseFloat(invoiceData.totalAmount || "0");
      // Recompute the standard 3-row split from the EDITED figures.
      const originalTax = parseFloat(invoiceData.taxAmount || "0");
      const aedTotal = Math.round(originalAmount * invoiceExchangeRate * 100) / 100;
      const aedTax = Math.round(originalTax * invoiceExchangeRate * 100) / 100;
      const aedRevenue = Math.round((aedTotal - aedTax) * 100) / 100;
      const currencyNote =
        invoiceCurrency !== "AED"
          ? ` (${invoiceCurrency} ${originalAmount.toFixed(2)} @ ${invoiceExchangeRate})`
          : "";

      const description = `Sales Invoice ${invoiceData.invoiceNumber} - ${customerData?.name || "Unknown Customer"}${currencyNote}`;

      const shared = {
        entryType: "receivable" as const,
        referenceType: "sales_invoice" as const,
        referenceId: invoiceId,
        description,
        entityId: invoiceData.customerId,
        entityName: customerData?.name || null,
        projectId: invoiceData.projectId,
        invoiceNumber: invoiceData.invoiceNumber,
        transactionDate: invoiceData.invoiceDate,
        dueDate: invoiceData.dueDate,
        status: "pending" as const,
      };

      // Reverse-and-re-post (H2): a fixed in-place UPDATE can neither create a VAT
      // row that didn't exist nor delete one that should no longer exist (e.g. an
      // edit that makes the customer zero-rated). Instead, reverse the current
      // active posting and post the new split — atomically, and leaving the
      // reversal visible for audit (T5.21/T5.22).
      const activeRows = await db
        .select()
        .from(generalLedgerEntries)
        .where(
          and(
            eq(generalLedgerEntries.referenceType, "sales_invoice"),
            eq(generalLedgerEntries.referenceId, invoiceId),
            eq(generalLedgerEntries.status, "pending"),
          ),
        );

      await db.transaction(async (tx) => {
        for (const row of activeRows) {
          // Post a reversal (debit/credit swapped) and retire the original row.
          await tx.insert(generalLedgerEntries).values({
            entryType: row.entryType,
            referenceType: "sales_invoice",
            referenceId: invoiceId,
            accountName: row.accountName,
            description: `REVERSAL (edit) - ${row.description}`,
            debitAmount: row.creditAmount,
            creditAmount: row.debitAmount,
            entityId: row.entityId,
            entityName: row.entityName,
            projectId: row.projectId,
            invoiceNumber: row.invoiceNumber,
            transactionDate: row.transactionDate,
            dueDate: row.dueDate,
            status: "reversed",
          });
          await tx
            .update(generalLedgerEntries)
            .set({ status: "reversed" })
            .where(eq(generalLedgerEntries.id, row.id));
        }

        // Re-post the new 3-row split (VAT line omitted when zero).
        await tx.insert(generalLedgerEntries).values({
          ...shared,
          accountName: "Accounts Receivable",
          debitAmount: aedTotal.toFixed(2),
          creditAmount: "0",
        });
        await tx.insert(generalLedgerEntries).values({
          ...shared,
          accountName: "Sales Revenue",
          debitAmount: "0",
          creditAmount: aedRevenue.toFixed(2),
        });
        if (aedTax > 0.005) {
          await tx.insert(generalLedgerEntries).values({
            ...shared,
            accountName: "VAT/GST Payable",
            debitAmount: "0",
            creditAmount: aedTax.toFixed(2),
          });
        }
      });

      console.log(
        `GL entries updated for sales invoice ${invoiceData.invoiceNumber}`,
      );
    } catch (error: any) {
      await this.createErrorLog({
        message: `Error in updateSalesInvoiceGLEntries (invoiceId: ${invoiceId}): ${error?.message || "Unknown error"}`,
        stack: error?.stack,
        component: "updateSalesInvoiceGLEntries",
        severity: "error",
      });
      throw error;
    }
  }
}
