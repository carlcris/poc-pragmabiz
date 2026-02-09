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
import type { Quotation, QuotationStatus } from "@/types/quotation";

interface QuotationViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: Quotation | null;
}

export function QuotationViewDialog({ open, onOpenChange, quotation }: QuotationViewDialogProps) {
  const { formatCurrency } = useCurrency();

  if (!quotation) return null;

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status: QuotationStatus) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "sent":
        return (
          <Badge variant="default" className="bg-blue-600">
            Sent
          </Badge>
        );
      case "accepted":
        return (
          <Badge variant="default" className="bg-green-600">
            Accepted
          </Badge>
        );
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "expired":
        return (
          <Badge variant="secondary" className="bg-orange-100 text-orange-800">
            Expired
          </Badge>
        );
      case "ordered":
        return (
          <Badge variant="default" className="bg-purple-600">
            Ordered
          </Badge>
        );
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
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto print:max-h-none">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <DialogTitle>Quotation Details</DialogTitle>
            {getStatusBadge(quotation.status)}
          </div>
          <DialogDescription>Quotation #{quotation.quotationNumber}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Information */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold">Customer Information</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>
                  <div className="font-medium">{quotation.customerName}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>
                  <div className="font-medium">{quotation.customerEmail}</div>
                </div>
                {quotation.salesOrderId && (
                  <div>
                    <span className="text-muted-foreground">Sales Order:</span>
                    <div className="font-medium">{quotation.salesOrderId}</div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold">Quotation Details</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Quotation Date:</span>
                  <div className="font-medium">{formatDate(quotation.quotationDate)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Valid Until:</span>
                  <div className="font-medium">{formatDate(quotation.validUntil)}</div>
                </div>
                {quotation.terms && (
                  <div>
                    <span className="text-muted-foreground">Payment Terms:</span>
                    <div className="font-medium">{quotation.terms}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Billing Address */}
          {quotation.billingAddress && (
            <div>
              <h3 className="mb-3 text-sm font-semibold">Billing Address</h3>
              <div className="text-sm text-muted-foreground">
                <div>{quotation.billingAddress}</div>
                <div>
                  {quotation.billingCity && `${quotation.billingCity}, `}
                  {quotation.billingState && `${quotation.billingState} `}
                  {quotation.billingPostalCode}
                </div>
                {quotation.billingCountry && <div>{quotation.billingCountry}</div>}
              </div>
            </div>
          )}

          <hr className="border-t" />

          {/* Line Items */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">Line Items</h3>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 text-left">Item</th>
                    <th className="p-3 text-right">Quantity</th>
                    <th className="p-3 text-center">Unit</th>
                    <th className="p-3 text-right">Unit Price</th>
                    <th className="p-3 text-right">Discount</th>
                    <th className="p-3 text-right">Tax</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.lineItems.map((item, index) => {
                    return (
                      <tr key={index} className="border-t">
                        <td className="p-3">
                          <div className="font-medium">{item.itemName}</div>
                          <div className="text-xs text-muted-foreground">{item.itemCode}</div>
                          {item.description && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {item.description}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-right">{item.quantity}</td>
                        <td className="p-3 text-center">
                          <span className="text-muted-foreground">{item.uomId || "—"}</span>
                        </td>
                        <td className="p-3 text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="p-3 text-right">{item.discount}%</td>
                        <td className="p-3 text-right">{item.taxRate}%</td>
                        <td className="p-3 text-right font-medium">
                          {formatCurrency(item.lineTotal)}
                        </td>
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
                <span className="font-medium">{formatCurrency(quotation.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Discount:</span>
                <span className="font-medium text-red-600">
                  -{formatCurrency(quotation.totalDiscount)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax:</span>
                <span className="font-medium">{formatCurrency(quotation.totalTax)}</span>
              </div>
              <hr className="border-t" />
              <div className="flex justify-between text-base font-bold">
                <span>Total Amount:</span>
                <span>{formatCurrency(quotation.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Terms and Notes */}
          {(quotation.terms || quotation.notes) && (
            <>
              <hr className="border-t" />
              <div className="space-y-4">
                {quotation.terms && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Terms & Conditions</h3>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {quotation.terms}
                    </p>
                  </div>
                )}
                {quotation.notes && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Notes</h3>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {quotation.notes}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="print:hidden">
          <Button onClick={handlePrint} variant="outline">
            <Printer className="mr-2 h-4 w-4" />
            Print Quotation
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
