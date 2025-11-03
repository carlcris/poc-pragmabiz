"use client";

import { Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/hooks/useCurrency";
import type { Invoice, InvoiceStatus } from "@/types/invoice";

interface InvoiceViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
}

export function InvoiceViewDialog({ open, onOpenChange, invoice }: InvoiceViewDialogProps) {
  const { formatCurrency } = useCurrency();

  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "sent":
        return <Badge variant="default" className="bg-blue-600">Sent</Badge>;
      case "paid":
        return <Badge variant="default" className="bg-green-600">Paid</Badge>;
      case "partially_paid":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Partially Paid</Badge>;
      case "overdue":
        return <Badge variant="destructive">Overdue</Badge>;
      case "cancelled":
        return <Badge variant="secondary">Cancelled</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:max-h-none">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <DialogTitle>Invoice Details</DialogTitle>
            {getStatusBadge(invoice.status)}
          </div>
          <DialogDescription>
            Invoice #{invoice.invoiceNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Information */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold mb-3">Customer Information</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>
                  <div className="font-medium">{invoice.customerName}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>
                  <div className="font-medium">{invoice.customerEmail}</div>
                </div>
                {invoice.salesOrderNumber && (
                  <div>
                    <span className="text-muted-foreground">Sales Order:</span>
                    <div className="font-medium">{invoice.salesOrderNumber}</div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3">Invoice Details</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Invoice Date:</span>
                  <div className="font-medium">{formatDate(invoice.invoiceDate)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Due Date:</span>
                  <div className="font-medium">{formatDate(invoice.dueDate)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Payment Terms:</span>
                  <div className="font-medium">{invoice.paymentTerms || "Net 30"}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Billing Address */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Billing Address</h3>
            <div className="text-sm text-muted-foreground">
              {invoice.billingAddress && (
                <>
                  <div>{invoice.billingAddress}</div>
                  <div>
                    {invoice.billingCity && `${invoice.billingCity}, `}
                    {invoice.billingState && `${invoice.billingState} `}
                    {invoice.billingPostalCode}
                  </div>
                  {invoice.billingCountry && <div>{invoice.billingCountry}</div>}
                </>
              )}
            </div>
          </div>

          <hr className="border-t" />

          {/* Line Items */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Line Items</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3">Item</th>
                    <th className="text-right p-3">Quantity</th>
                    <th className="text-right p-3">Unit Price</th>
                    <th className="text-right p-3">Discount</th>
                    <th className="text-right p-3">Tax</th>
                    <th className="text-right p-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((item, index) => {
                    const subtotal = item.quantity * item.unitPrice;
                    const discount = (subtotal * item.discount) / 100;
                    const taxableAmount = subtotal - discount;
                    const tax = (taxableAmount * item.taxRate) / 100;
                    const lineTotal = taxableAmount + tax;

                    return (
                      <tr key={index} className="border-t">
                        <td className="p-3">
                          <div className="font-medium">{item.itemName}</div>
                          <div className="text-xs text-muted-foreground">{item.itemCode}</div>
                          {item.description && (
                            <div className="text-xs text-muted-foreground mt-1">{item.description}</div>
                          )}
                        </td>
                        <td className="text-right p-3">{item.quantity}</td>
                        <td className="text-right p-3">{formatCurrency(item.unitPrice)}</td>
                        <td className="text-right p-3">{item.discount}%</td>
                        <td className="text-right p-3">{item.taxRate}%</td>
                        <td className="text-right p-3 font-medium">{formatCurrency(lineTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Discount:</span>
                <span className="font-medium text-red-600">-{formatCurrency(invoice.totalDiscount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax:</span>
                <span className="font-medium">{formatCurrency(invoice.totalTax)}</span>
              </div>
              <hr className="border-t" />
              <div className="flex justify-between text-base font-bold">
                <span>Total Amount:</span>
                <span>{formatCurrency(invoice.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount Paid:</span>
                <span className="font-medium text-green-600">{formatCurrency(invoice.amountPaid)}</span>
              </div>
              <div className="flex justify-between text-base font-bold">
                <span className="text-orange-600">Amount Due:</span>
                <span className="text-orange-600">{formatCurrency(invoice.amountDue)}</span>
              </div>
            </div>
          </div>

          {/* Payment History */}
          {invoice.payments && invoice.payments.length > 0 && (
            <>
              <hr className="border-t" />
              <div>
                <h3 className="text-sm font-semibold mb-3">Payment History</h3>
                <div className="space-y-2">
                  {invoice.payments.map((payment, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg text-sm">
                      <div>
                        <div className="font-medium">{formatDate(payment.paymentDate)}</div>
                        <div className="text-xs text-muted-foreground">
                          {payment.paymentMethod} {payment.reference && `- ${payment.reference}`}
                        </div>
                        {payment.notes && (
                          <div className="text-xs text-muted-foreground mt-1">{payment.notes}</div>
                        )}
                      </div>
                      <div className="font-bold text-green-600">
                        {formatCurrency(payment.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Terms and Notes */}
          {(invoice.terms || invoice.notes) && (
            <>
              <hr className="border-t" />
              <div className="space-y-4">
                {invoice.terms && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Terms & Conditions</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.terms}</p>
                  </div>
                )}
                {invoice.notes && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Notes</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="print:hidden">
          <Button onClick={handlePrint} variant="outline">
            <Printer className="h-4 w-4 mr-2" />
            Print Invoice
          </Button>
        </DialogFooter>
      </DialogContent>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }

          .print\\:max-h-none,
          .print\\:max-h-none * {
            visibility: visible;
          }

          .print\\:max-h-none {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            max-height: none !important;
            overflow: visible !important;
          }

          .print\\:hidden {
            display: none !important;
          }

          @page {
            size: A4;
            margin: 1cm;
          }

          table {
            page-break-inside: avoid;
          }

          h1, h2, h3, h4, h5, h6 {
            page-break-after: avoid;
          }

          /* Remove shadows and backgrounds for print */
          * {
            box-shadow: none !important;
            background: white !important;
            color: black !important;
          }

          /* Keep table borders visible */
          table, th, td {
            border: 1px solid #000 !important;
          }

          /* Ensure borders are visible */
          .border, .border-t {
            border-color: #000 !important;
          }
        }
      `}</style>
    </Dialog>
  );
}
