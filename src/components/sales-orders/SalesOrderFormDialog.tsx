"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Download, DollarSign, FileText, Printer, Pencil } from "lucide-react";
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
import type { SalesOrder, SalesOrderLineItem, SalesOrderStatus } from "@/types/sales-order";
import { SalesOrderForm, type SalesOrderFormInitialValues } from "./SalesOrderForm";
import { SalesOrderPDF } from "./SalesOrderPDF";

type SalesOrderDialogMode = "view" | "edit";

type SalesOrderFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salesOrder?: SalesOrder | null;
  initialMode?: SalesOrderDialogMode;
  initialValues?: SalesOrderFormInitialValues;
  onSuccess?: (salesOrder: SalesOrder) => void;
};

export function SalesOrderFormDialog({
  open,
  onOpenChange,
  salesOrder,
  initialMode = salesOrder ? "view" : "edit",
  initialValues,
  onSuccess,
}: SalesOrderFormDialogProps) {
  const tForm = useTranslations("salesOrderForm");
  const tView = useTranslations("salesOrderViewDialog");
  const locale = useLocale();
  const { formatCurrency, symbol } = useCurrency();
  const [mode, setMode] = useState<SalesOrderDialogMode>(initialMode);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const isEditMode = mode === "edit";
  const isExistingOrder = !!salesOrder;
  const canEdit =
    isExistingOrder && (salesOrder.status === "draft" || salesOrder.status === "confirmed");

  const { data: paymentSummary } = useSalesOrderPaymentSummary(
    mode === "view" ? salesOrder?.id || "" : ""
  );

  useEffect(() => {
    if (open) setMode(initialMode);
  }, [initialMode, open, salesOrder?.id]);

  useEffect(() => {
    if (!salesOrder || mode !== "view") return;

    const generateQRCode = async () => {
      try {
        const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
        const orderUrl = `${baseUrl}/sales/orders?id=${salesOrder.id}`;
        const qrDataUrl = await QRCode.toDataURL(orderUrl, {
          width: 200,
          margin: 1,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        });
        setQrCodeDataUrl(qrDataUrl);
      } catch {
        setQrCodeDataUrl("");
      }
    };

    generateQRCode();
  }, [mode, salesOrder]);

  const handlePrint = async () => {
    if (!salesOrder) return;

    try {
      setIsPrinting(true);
      const blob = await pdf(
        <SalesOrderPDF
          salesOrder={salesOrder}
          currencySymbol={symbol}
          qrCodeDataUrl={qrCodeDataUrl}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, "_blank");
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        };
      }
    } catch {
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!salesOrder) return;

    try {
      setIsGeneratingPDF(true);
      const blob = await pdf(
        <SalesOrderPDF
          salesOrder={salesOrder}
          currencySymbol={symbol}
          qrCodeDataUrl={qrCodeDataUrl}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `SalesOrder-${salesOrder.orderNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
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
        return <Badge className="bg-blue-600">Confirmed</Badge>;
      case "in_progress":
        return <Badge className="bg-yellow-600">In Progress</Badge>;
      case "shipped":
        return <Badge className="bg-purple-600">Shipped</Badge>;
      case "delivered":
        return <Badge className="bg-green-600">Delivered</Badge>;
      case "invoiced":
        return <Badge className="bg-indigo-600">Invoiced</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
    }
  };

  const getInvoiceStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "sent":
        return <Badge className="bg-blue-600">Sent</Badge>;
      case "partially_paid":
        return <Badge className="bg-yellow-600">Partially Paid</Badge>;
      case "paid":
        return <Badge className="bg-green-600">Paid</Badge>;
      case "overdue":
      case "cancelled":
        return <Badge variant="destructive">{status === "overdue" ? "Overdue" : "Cancelled"}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getManufacturingStatusBadge = (manufacturing: SalesOrderLineItem["manufacturing"]) => {
    if (!manufacturing?.required) return null;

    if (manufacturing.status === "ready_for_release") {
      return <Badge className="bg-green-600">{manufacturing.label}</Badge>;
    }
    if (manufacturing.status === "in_progress" || manufacturing.status === "quality_check") {
      return <Badge className="bg-blue-600">{manufacturing.label}</Badge>;
    }
    if (manufacturing.status === "on_hold") {
      return <Badge variant="destructive">{manufacturing.label}</Badge>;
    }
    if (manufacturing.status === "needs_job_order") {
      return <Badge variant="secondary">{manufacturing.label}</Badge>;
    }

    return <Badge variant="outline">{manufacturing.label}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const renderViewMode = () => {
    if (!salesOrder) return null;

    const hasManufacturingLines = salesOrder.lineItems.some((item) => item.manufacturing?.required);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="mb-3 text-sm font-semibold">{tView("customerInformation")}</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">{tView("name")}:</span>
                <div className="font-medium">{salesOrder.customerName}</div>
              </div>
              <div>
                <span className="text-muted-foreground">{tView("email")}:</span>
                <div className="font-medium">{salesOrder.customerEmail}</div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">{tView("orderDetails")}</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">{tView("orderDate")}:</span>
                <div className="font-medium">{formatDate(salesOrder.orderDate)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">{tView("expectedDelivery")}:</span>
                <div className="font-medium">{formatDate(salesOrder.expectedDeliveryDate)}</div>
              </div>
            </div>
          </div>
        </div>

        {salesOrder.shippingAddress ? (
          <div>
            <h3 className="mb-3 text-sm font-semibold">{tView("deliveryAddress")}</h3>
            <div className="text-sm text-muted-foreground">
              <div>{salesOrder.shippingAddress}</div>
              <div>
                {salesOrder.shippingCity ? `${salesOrder.shippingCity}, ` : ""}
                {salesOrder.shippingState ? `${salesOrder.shippingState} ` : ""}
                {salesOrder.shippingPostalCode}
              </div>
              {salesOrder.shippingCountry ? <div>{salesOrder.shippingCountry}</div> : null}
            </div>
          </div>
        ) : null}

        <hr className="border-t" />

        <div>
          <h3 className="mb-3 text-sm font-semibold">{tView("lineItems")}</h3>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3 text-left">Item</th>
                  {hasManufacturingLines ? <th className="p-3 text-left">Production</th> : null}
                  <th className="p-3 text-right">Quantity</th>
                  <th className="p-3 text-center">Unit</th>
                  <th className="p-3 text-right">Selling Price</th>
                  <th className="p-3 text-right">Discount</th>
                  <th className="p-3 text-right">Tax</th>
                  <th className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {salesOrder.lineItems.map((item, index) => (
                  <tr key={index} className="border-t">
                    <td className="p-3">
                      <div className="font-medium">{item.itemName}</div>
                      <div className="text-xs text-muted-foreground">{item.itemCode}</div>
                      {item.description ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {item.description}
                        </div>
                      ) : null}
                    </td>
                    {hasManufacturingLines ? (
                      <td className="p-3">
                        {item.manufacturing?.required ? (
                          <div className="space-y-1">
                            {getManufacturingStatusBadge(item.manufacturing)}
                            <div className="text-xs text-muted-foreground">
                              {[
                                item.manufacturing.jobOrderCode,
                                item.manufacturing.manufacturingOrderCode,
                              ]
                                .filter(Boolean)
                                .join(" • ")}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not required</span>
                        )}
                      </td>
                    ) : null}
                    <td className="p-3 text-right">{item.quantity}</td>
                    <td className="p-3 text-center">
                      <span className="text-muted-foreground">
                        {item.uomCode || item.uomId || "-"}
                      </span>
                    </td>
                    <td className="p-3 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="p-3 text-right">{item.discount}%</td>
                    <td className="p-3 text-right">{item.taxRate}%</td>
                    <td className="p-3 text-right font-medium">
                      {formatCurrency(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{tView("subtotal")}:</span>
              <span className="font-medium">{formatCurrency(salesOrder.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{tView("discount")}:</span>
              <span className="font-medium text-red-600">
                -{formatCurrency(salesOrder.totalDiscount)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{tView("tax")}:</span>
              <span className="font-medium">{formatCurrency(salesOrder.totalTax)}</span>
            </div>
            <hr className="border-t" />
            <div className="flex justify-between text-base font-bold">
              <span>{tView("totalAmount")}:</span>
              <span>{formatCurrency(salesOrder.totalAmount)}</span>
            </div>
          </div>
        </div>

        {paymentSummary && paymentSummary.invoices.length > 0 ? (
          <>
            <hr className="border-t" />
            <div>
              <div className="mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                <h3 className="text-sm font-semibold">{tView("paymentSummary")}</h3>
              </div>
              <div className="mb-4 grid grid-cols-3 gap-4">
                <div className="rounded-lg border p-3">
                  <div className="mb-1 text-xs text-muted-foreground">
                    {tView("totalInvoiced")}
                  </div>
                  <div className="text-lg font-bold">
                    {formatCurrency(paymentSummary.summary.totalInvoiced)}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="mb-1 text-xs text-muted-foreground">{tView("totalPaid")}</div>
                  <div className="text-lg font-bold text-green-600">
                    {formatCurrency(paymentSummary.summary.totalPaid)}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="mb-1 text-xs text-muted-foreground">{tView("balanceDue")}</div>
                  <div className="text-lg font-bold text-orange-600">
                    {formatCurrency(paymentSummary.summary.totalDue)}
                  </div>
                </div>
              </div>

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

                  {invoice.payments.length > 0 ? (
                    <div className="mt-3 border-t pt-3">
                      <div className="mb-2 text-xs font-semibold">
                        {tView("payments", { count: String(invoice.payments.length) })}
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
                                {new Date(payment.paymentDate).toLocaleDateString(locale, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}{" "}
                                • {payment.paymentMethod.replace(/_/g, " ")}
                                {payment.reference ? ` • Ref: ${payment.reference}` : ""}
                              </div>
                            </div>
                            <div className="font-bold text-green-600">
                              {formatCurrency(payment.amount)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        ) : null}

        {salesOrder.paymentTerms || salesOrder.notes ? (
          <>
            <hr className="border-t" />
            <div className="space-y-4">
              {salesOrder.paymentTerms ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">{tView("termsConditions")}</h3>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {salesOrder.paymentTerms}
                  </p>
                </div>
              ) : null}
              {salesOrder.notes ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">{tView("notes")}</h3>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {salesOrder.notes}
                  </p>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <DialogTitle>
                {isEditMode
                  ? isExistingOrder
                    ? tForm("editTitle")
                    : tForm("createTitle")
                  : tView("title")}
              </DialogTitle>
              <DialogDescription>
                {isEditMode
                  ? isExistingOrder
                    ? tForm("editDescription")
                    : tForm("createDescription")
                  : salesOrder
                    ? tView("description", { number: salesOrder.orderNumber })
                    : ""}
              </DialogDescription>
            </div>
            {!isEditMode && salesOrder ? (
              <div className="flex flex-wrap items-center gap-2">
                {getStatusBadge(salesOrder.status)}
              </div>
            ) : null}
          </div>
        </DialogHeader>

        {isEditMode ? (
          <SalesOrderForm
            salesOrder={salesOrder}
            initialValues={initialValues}
            onCancel={() => {
              if (isExistingOrder) {
                setMode("view");
                return;
              }
              onOpenChange(false);
            }}
            onSuccess={(savedOrder) => {
              onSuccess?.(savedOrder);
              onOpenChange(false);
            }}
          />
        ) : (
          renderViewMode()
        )}

        {!isEditMode && salesOrder ? (
          <DialogFooter>
            {canEdit ? (
              <Button type="button" variant="outline" onClick={() => setMode("edit")}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            ) : null}
            <Button
              onClick={handleDownloadPDF}
              variant="default"
              disabled={isGeneratingPDF || isPrinting}
            >
              <Download className="mr-2 h-4 w-4" />
              {isGeneratingPDF ? tView("generatingPdf") : tView("downloadPdf")}
            </Button>
            <Button
              onClick={handlePrint}
              variant="outline"
              disabled={isGeneratingPDF || isPrinting}
            >
              <Printer className="mr-2 h-4 w-4" />
              {isPrinting ? tView("preparingPrint") : tView("printOrder")}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
