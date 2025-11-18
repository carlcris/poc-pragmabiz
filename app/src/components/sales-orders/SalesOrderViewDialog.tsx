"use client";

import { Printer, DollarSign, FileText } from "lucide-react";
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
import { useSalesOrderPaymentSummary } from "@/hooks/useSalesOrders";
import type { SalesOrder, SalesOrderStatus } from "@/types/sales-order";

interface SalesOrderViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salesOrder: SalesOrder | null;
}

export function SalesOrderViewDialog({ open, onOpenChange, salesOrder }: SalesOrderViewDialogProps) {
  const { formatCurrency } = useCurrency();

  // Fetch payment summary for this sales order
  const { data: paymentSummary } = useSalesOrderPaymentSummary(salesOrder?.id || "");

  if (!salesOrder) return null;

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status: SalesOrderStatus) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "confirmed":
        return <Badge variant="default" className="bg-blue-600">Confirmed</Badge>;
      case "in_progress":
        return <Badge variant="default" className="bg-yellow-600">In Progress</Badge>;
      case "shipped":
        return <Badge variant="default" className="bg-purple-600">Shipped</Badge>;
      case "delivered":
        return <Badge variant="default" className="bg-green-600">Delivered</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
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
            <DialogTitle>Sales Order Details</DialogTitle>
            {getStatusBadge(salesOrder.status)}
          </div>
          <DialogDescription>
            Order #{salesOrder.orderNumber}
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
                  <div className="font-medium">{salesOrder.customerName}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>
                  <div className="font-medium">{salesOrder.customerEmail}</div>
                </div>
                {salesOrder.quotationNumber && (
                  <div>
                    <span className="text-muted-foreground">Quotation:</span>
                    <div className="font-medium">{salesOrder.quotationNumber}</div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3">Order Details</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Order Date:</span>
                  <div className="font-medium">{formatDate(salesOrder.orderDate)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Expected Delivery:</span>
                  <div className="font-medium">{formatDate(salesOrder.expectedDeliveryDate)}</div>
                </div>
                {salesOrder.deliveryAddress && (
                  <div>
                    <span className="text-muted-foreground">Priority:</span>
                    <div className="font-medium capitalize">{salesOrder.priority || 'Normal'}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          {salesOrder.deliveryAddress && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Delivery Address</h3>
              <div className="text-sm text-muted-foreground">
                <div>{salesOrder.deliveryAddress}</div>
                <div>
                  {salesOrder.deliveryCity && `${salesOrder.deliveryCity}, `}
                  {salesOrder.deliveryState && `${salesOrder.deliveryState} `}
                  {salesOrder.deliveryPostalCode}
                </div>
                {salesOrder.deliveryCountry && <div>{salesOrder.deliveryCountry}</div>}
              </div>
            </div>
          )}

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
                  {salesOrder.lineItems.map((item, index) => {
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
                <span className="font-medium">{formatCurrency(salesOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Discount:</span>
                <span className="font-medium text-red-600">-{formatCurrency(salesOrder.totalDiscount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax:</span>
                <span className="font-medium">{formatCurrency(salesOrder.totalTax)}</span>
              </div>
              <hr className="border-t" />
              <div className="flex justify-between text-base font-bold">
                <span>Total Amount:</span>
                <span>{formatCurrency(salesOrder.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          {paymentSummary && paymentSummary.invoices.length > 0 && (
            <>
              <hr className="border-t" />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-4 w-4" />
                  <h3 className="text-sm font-semibold">Payment Summary</h3>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="border rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Total Invoiced</div>
                    <div className="text-lg font-bold">{formatCurrency(paymentSummary.summary.totalInvoiced)}</div>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Total Paid</div>
                    <div className="text-lg font-bold text-green-600">{formatCurrency(paymentSummary.summary.totalPaid)}</div>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Balance Due</div>
                    <div className="text-lg font-bold text-orange-600">{formatCurrency(paymentSummary.summary.totalDue)}</div>
                  </div>
                </div>

                {/* Invoice and Payment Details */}
                {paymentSummary.invoices.map((invoice) => (
                  <div key={invoice.id} className="border rounded-lg p-4 mb-3">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <div>
                          <div className="font-medium text-sm">{invoice.invoiceCode}</div>
                          <div className="text-xs text-muted-foreground">
                            Total: {formatCurrency(invoice.totalAmount)} |
                            Paid: {formatCurrency(invoice.amountPaid)} |
                            Due: {formatCurrency(invoice.amountDue)}
                          </div>
                        </div>
                      </div>
                      <Badge variant={invoice.status === 'paid' ? 'default' : invoice.status === 'partially_paid' ? 'secondary' : 'outline'}>
                        {invoice.status}
                      </Badge>
                    </div>

                    {invoice.payments.length > 0 && (
                      <div className="border-t pt-3 mt-3">
                        <div className="text-xs font-semibold mb-2">Payments ({invoice.payments.length})</div>
                        <div className="space-y-2">
                          {invoice.payments.map((payment) => (
                            <div key={payment.id} className="flex items-center justify-between text-xs bg-muted rounded p-2">
                              <div>
                                <div className="font-medium">{payment.paymentCode}</div>
                                <div className="text-muted-foreground">
                                  {new Date(payment.paymentDate).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric"
                                  })} • {payment.paymentMethod.replace(/_/g, " ")}
                                  {payment.reference && ` • Ref: ${payment.reference}`}
                                </div>
                              </div>
                              <div className="font-bold text-green-600">
                                {formatCurrency(payment.amount)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Terms and Notes */}
          {(salesOrder.terms || salesOrder.notes) && (
            <>
              <hr className="border-t" />
              <div className="space-y-4">
                {salesOrder.terms && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Terms & Conditions</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{salesOrder.terms}</p>
                  </div>
                )}
                {salesOrder.notes && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Notes</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{salesOrder.notes}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="print:hidden">
          <Button onClick={handlePrint} variant="outline">
            <Printer className="h-4 w-4 mr-2" />
            Print Order
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
