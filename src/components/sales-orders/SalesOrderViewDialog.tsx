"use client";

import { Printer, DollarSign, FileText, Download } from "lucide-react";
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
import { useSalesOrderPaymentSummary } from "@/hooks/useSalesOrders";
import { SalesOrderPDF } from "./SalesOrderPDF";
import type { SalesOrder, SalesOrderStatus } from "@/types/sales-order";
import { useState, useEffect } from "react";

interface SalesOrderViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salesOrder: SalesOrder | null;
}

export function SalesOrderViewDialog({
  open,
  onOpenChange,
  salesOrder,
}: SalesOrderViewDialogProps) {
  const { formatCurrency, symbol } = useCurrency();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  // Fetch payment summary for this sales order
  const { data: paymentSummary } = useSalesOrderPaymentSummary(salesOrder?.id || "");

  // Generate QR code when sales order changes
  useEffect(() => {
    if (salesOrder) {
      const generateQRCode = async () => {
        try {
          // Generate URL to sales order details page
          const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
          const orderUrl = `${baseUrl}/sales/orders?id=${salesOrder.id}`;

          // Generate QR code as data URL
          const qrDataUrl = await QRCode.toDataURL(orderUrl, {
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
  }, [salesOrder]);

  if (!salesOrder) return null;

  const handlePrint = async () => {
    try {
      setIsPrinting(true);

      // Generate PDF blob
      const blob = await pdf(
        <SalesOrderPDF
          salesOrder={salesOrder}
          currencySymbol={symbol}
          qrCodeDataUrl={qrCodeDataUrl}
        />
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
        <SalesOrderPDF
          salesOrder={salesOrder}
          currencySymbol={symbol}
          qrCodeDataUrl={qrCodeDataUrl}
        />
      ).toBlob();

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `SalesOrder-${salesOrder.orderNumber}.pdf`;
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

  const getStatusBadge = (status: SalesOrderStatus) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "confirmed":
        return (
          <Badge variant="default" className="bg-blue-600">
            Confirmed
          </Badge>
        );
      case "in_progress":
        return (
          <Badge variant="default" className="bg-yellow-600">
            In Progress
          </Badge>
        );
      case "shipped":
        return (
          <Badge variant="default" className="bg-purple-600">
            Shipped
          </Badge>
        );
      case "delivered":
        return (
          <Badge variant="default" className="bg-green-600">
            Delivered
          </Badge>
        );
      case "invoiced":
        return (
          <Badge variant="default" className="bg-indigo-600">
            Invoiced
          </Badge>
        );
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
    }
  };

  const getInvoiceStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "sent":
        return (
          <Badge variant="default" className="bg-blue-600">
            Sent
          </Badge>
        );
      case "partially_paid":
        return (
          <Badge variant="default" className="bg-yellow-600">
            Partially Paid
          </Badge>
        );
      case "paid":
        return (
          <Badge variant="default" className="bg-green-600">
            Paid
          </Badge>
        );
      case "overdue":
        return <Badge variant="destructive">Overdue</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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
            <DialogTitle>Sales Order Details</DialogTitle>
            {getStatusBadge(salesOrder.status)}
          </div>
          <DialogDescription>Order #{salesOrder.orderNumber}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Information */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold">Customer Information</h3>
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
              <h3 className="mb-3 text-sm font-semibold">Order Details</h3>
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
                    <div className="font-medium capitalize">{salesOrder.priority || "Normal"}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          {salesOrder.deliveryAddress && (
            <div>
              <h3 className="mb-3 text-sm font-semibold">Delivery Address</h3>
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
                  {salesOrder.lineItems.map((item, index) => {
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
                <span className="font-medium">{formatCurrency(salesOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Discount:</span>
                <span className="font-medium text-red-600">
                  -{formatCurrency(salesOrder.totalDiscount)}
                </span>
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
                <div className="mb-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  <h3 className="text-sm font-semibold">Payment Summary</h3>
                </div>

                {/* Summary Cards */}
                <div className="mb-4 grid grid-cols-3 gap-4">
                  <div className="rounded-lg border p-3">
                    <div className="mb-1 text-xs text-muted-foreground">Total Invoiced</div>
                    <div className="text-lg font-bold">
                      {formatCurrency(paymentSummary.summary.totalInvoiced)}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="mb-1 text-xs text-muted-foreground">Total Paid</div>
                    <div className="text-lg font-bold text-green-600">
                      {formatCurrency(paymentSummary.summary.totalPaid)}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="mb-1 text-xs text-muted-foreground">Balance Due</div>
                    <div className="text-lg font-bold text-orange-600">
                      {formatCurrency(paymentSummary.summary.totalDue)}
                    </div>
                  </div>
                </div>

                {/* Invoice and Payment Details */}
                {paymentSummary.invoices.map((invoice) => (
                  <div key={invoice.id} className="mb-3 rounded-lg border p-4">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <div>
                          <div className="text-sm font-medium">{invoice.invoiceCode}</div>
                          <div className="text-xs text-muted-foreground">
                            Total: {formatCurrency(invoice.totalAmount)} | Paid:{" "}
                            {formatCurrency(invoice.amountPaid)} | Due:{" "}
                            {formatCurrency(invoice.amountDue)}
                          </div>
                        </div>
                      </div>
                      {getInvoiceStatusBadge(invoice.status)}
                    </div>

                    {invoice.payments.length > 0 && (
                      <div className="mt-3 border-t pt-3">
                        <div className="mb-2 text-xs font-semibold">
                          Payments ({invoice.payments.length})
                        </div>
                        <div className="space-y-2">
                          {invoice.payments.map((payment) => (
                            <div
                              key={payment.id}
                              className="flex items-center justify-between rounded bg-muted p-2 text-xs"
                            >
                              <div>
                                <div className="font-medium">{payment.paymentCode}</div>
                                <div className="text-muted-foreground">
                                  {new Date(payment.paymentDate).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}{" "}
                                  • {payment.paymentMethod.replace(/_/g, " ")}
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
                    <h3 className="mb-2 text-sm font-semibold">Terms & Conditions</h3>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {salesOrder.terms}
                    </p>
                  </div>
                )}
                {salesOrder.notes && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Notes</h3>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {salesOrder.notes}
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
            {isPrinting ? "Preparing Print..." : "Print Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
