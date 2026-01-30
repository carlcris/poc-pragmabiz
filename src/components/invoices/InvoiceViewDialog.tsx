"use client";

import { Printer, DollarSign, Download } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import QRCode from "qrcode";
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
import { useInvoicePayments } from "@/hooks/useInvoices";
import { InvoicePDF } from "./InvoicePDF";
import type { Invoice, InvoiceStatus } from "@/types/invoice";
import { useState, useEffect } from "react";

interface InvoiceViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
}

export function InvoiceViewDialog({ open, onOpenChange, invoice }: InvoiceViewDialogProps) {
  const { formatCurrency, symbol } = useCurrency();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  // Fetch payments for this invoice
  const { data: paymentsData } = useInvoicePayments(invoice?.id || "");
  const payments = paymentsData?.data || [];

  // Generate QR code when invoice changes
  useEffect(() => {
    if (invoice) {
      const generateQRCode = async () => {
        try {
          // Generate URL to invoice details page
          const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
          const invoiceUrl = `${baseUrl}/sales/invoices?id=${invoice.id}`;

          // Generate QR code as data URL
          const qrDataUrl = await QRCode.toDataURL(invoiceUrl, {
            width: 200,
            margin: 1,
            color: {
              dark: "#000000",
              light: "#FFFFFF",
            },
          });

          setQrCodeDataUrl(qrDataUrl);
        } catch {}
      };

      generateQRCode();
    }
  }, [invoice]);

  if (!invoice) return null;

  const handlePrint = async () => {
    try {
      setIsPrinting(true);

      // Generate PDF blob
      const blob = await pdf(
        <InvoicePDF invoice={invoice} currencySymbol={symbol} qrCodeDataUrl={qrCodeDataUrl} />
      ).toBlob();

      // Create URL for the blob
      const url = URL.createObjectURL(blob);

      // Open the PDF in a new window and trigger print
      const printWindow = window.open(url, "_blank");
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
          // Cleanup after a delay to ensure print dialog has opened
          setTimeout(() => {
            URL.revokeObjectURL(url);
          }, 1000);
        };
      }
    } catch {
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setIsGeneratingPDF(true);

      // Generate PDF blob
      const blob = await pdf(
        <InvoicePDF invoice={invoice} currencySymbol={symbol} qrCodeDataUrl={qrCodeDataUrl} />
      ).toBlob();

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Invoice-${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "sent":
        return (
          <Badge variant="default" className="bg-blue-600">
            Sent
          </Badge>
        );
      case "paid":
        return (
          <Badge variant="default" className="bg-green-600">
            Paid
          </Badge>
        );
      case "partially_paid":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Partially Paid
          </Badge>
        );
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
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <DialogTitle>Invoice Details</DialogTitle>
            {getStatusBadge(invoice.status)}
          </div>
          <DialogDescription>Invoice #{invoice.invoiceNumber}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Information */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold">Customer Information</h3>
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
              <h3 className="mb-3 text-sm font-semibold">Invoice Details</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Invoice Date:</span>
                  <div className="font-medium">{formatDate(invoice.invoiceDate)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Due Date:</span>
                  <div className="font-medium">{formatDate(invoice.dueDate)}</div>
                </div>
                {invoice.warehouseName && (
                  <div>
                    <span className="text-muted-foreground">Warehouse:</span>
                    <div className="font-medium">{invoice.warehouseName}</div>
                  </div>
                )}
                {(invoice.locationCode || invoice.locationName) && (
                  <div>
                    <span className="text-muted-foreground">Location:</span>
                    <div className="font-medium">
                      {invoice.locationCode}
                      {invoice.locationName ? ` - ${invoice.locationName}` : ""}
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Payment Terms:</span>
                  <div className="font-medium">{invoice.paymentTerms || "Net 30"}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Billing Address */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">Billing Address</h3>
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
                  {invoice.lineItems.map((item, index) => {
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
                          <span className="text-muted-foreground">
                            {item.packaging?.name || "—"}
                          </span>
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
                <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Discount:</span>
                <span className="font-medium text-red-600">
                  -{formatCurrency(invoice.totalDiscount)}
                </span>
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
                <span className="font-medium text-green-600">
                  {formatCurrency(invoice.amountPaid)}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold">
                <span className="text-orange-600">Amount Due:</span>
                <span className="text-orange-600">{formatCurrency(invoice.amountDue)}</span>
              </div>
            </div>
          </div>

          {/* Payment History */}
          {payments.length > 0 && (
            <>
              <hr className="border-t" />
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  <h3 className="text-sm font-semibold">Payment History ({payments.length})</h3>
                </div>
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-3 text-left">Date</th>
                        <th className="p-3 text-left">Payment #</th>
                        <th className="p-3 text-left">Method</th>
                        <th className="p-3 text-right">Amount</th>
                        <th className="p-3 text-right">Balance Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        // Sort payments by date (oldest first) to calculate running balance
                        const sortedPayments = [...payments].sort(
                          (a, b) =>
                            new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()
                        );

                        let remainingBalance = invoice.totalAmount;

                        return sortedPayments.map((payment) => {
                          remainingBalance -= payment.amount;
                          const balanceAfterPayment = remainingBalance;

                          return (
                            <tr key={payment.id} className="border-t">
                              <td className="p-3">
                                {new Date(payment.paymentDate).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </td>
                              <td className="p-3">
                                <div className="font-medium">{payment.paymentCode || "-"}</div>
                                {payment.reference && (
                                  <div className="text-xs text-muted-foreground">
                                    Ref: {payment.reference}
                                  </div>
                                )}
                                {payment.notes && (
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    {payment.notes}
                                  </div>
                                )}
                              </td>
                              <td className="p-3 capitalize">
                                {payment.paymentMethod.replace(/_/g, " ")}
                              </td>
                              <td className="p-3 text-right font-medium text-green-600">
                                {formatCurrency(payment.amount)}
                              </td>
                              <td className="p-3 text-right font-medium">
                                <span className={balanceAfterPayment === 0 ? "text-green-600" : ""}>
                                  {formatCurrency(balanceAfterPayment)}
                                </span>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Terms and Notes */}
          {(invoice.paymentTerms || invoice.notes) && (
            <>
              <hr className="border-t" />
              <div className="space-y-4">
                {invoice.paymentTerms && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Terms & Conditions</h3>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {invoice.paymentTerms}
                    </p>
                  </div>
                )}
                {invoice.notes && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Notes</h3>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {invoice.notes}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleDownloadPDF}
            variant="default"
            disabled={isGeneratingPDF || isPrinting}
          >
            <Download className="mr-2 h-4 w-4" />
            {isGeneratingPDF ? "Generating PDF..." : "Download PDF"}
          </Button>
          <Button onClick={handlePrint} variant="outline" disabled={isGeneratingPDF || isPrinting}>
            <Printer className="mr-2 h-4 w-4" />
            {isPrinting ? "Preparing Print..." : "Print Invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
