"use client";

import { useEffect, useState } from "react";
import { Download, DollarSign, Printer } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { useLocale, useTranslations } from "next-intl";
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
import { useInvoice, useInvoicePayments } from "@/hooks/useInvoices";
import { formatLineDiscount, salesDocumentRows } from "@/lib/framing/invoicePresenter";
import { InvoicePDF } from "./InvoicePDF";
import type { Invoice, InvoiceStatus } from "@/types/invoice";

interface InvoiceViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
}

export function InvoiceViewDialog({ open, onOpenChange, invoice }: InvoiceViewDialogProps) {
  const t = useTranslations("invoiceViewDialog");
  const locale = useLocale();
  const { formatCurrency, symbol } = useCurrency();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  const { data: paymentsData } = useInvoicePayments(invoice?.id || "");
  const {
    data: detailedInvoice,
    isLoading: isLoadingLineDetails,
    isError: isLineDetailsError,
    refetch: refetchLineDetails,
  } = useInvoice(open && invoice?.salesOrderId ? invoice.id : "");
  const payments = paymentsData?.data || [];

  useEffect(() => {
    if (!invoice) return;

    const generateQRCode = async () => {
      try {
        const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
        const invoiceUrl = `${baseUrl}/sales/invoices?id=${invoice.id}`;
        const qrDataUrl = await QRCode.toDataURL(invoiceUrl, {
          width: 200,
          margin: 1,
          color: { dark: "#000000", light: "#FFFFFF" },
        });
        setQrCodeDataUrl(qrDataUrl);
      } catch {}
    };

    generateQRCode();
  }, [invoice]);

  if (!invoice) return null;

  const lineDetailsReady = !invoice.salesOrderId || Boolean(detailedInvoice);
  const documentInvoice = detailedInvoice || invoice;
  const presentedLines = lineDetailsReady
    ? documentInvoice.lineItems.flatMap(salesDocumentRows)
    : [];

  const handlePrint = async () => {
    if (!lineDetailsReady) return;

    try {
      setIsPrinting(true);
      const blob = await pdf(
        <InvoicePDF
          invoice={documentInvoice}
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
    if (!lineDetailsReady) return;

    try {
      setIsGeneratingPDF(true);
      const blob = await pdf(
        <InvoicePDF
          invoice={documentInvoice}
          currencySymbol={symbol}
          qrCodeDataUrl={qrCodeDataUrl}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Invoice-${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
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
        return <Badge variant="secondary">{t("draft")}</Badge>;
      case "sent":
        return <Badge className="bg-blue-600">{t("sent")}</Badge>;
      case "paid":
        return <Badge className="bg-green-600">{t("paidStatus")}</Badge>;
      case "partially_paid":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            {t("partiallyPaid")}
          </Badge>
        );
      case "overdue":
        return <Badge variant="destructive">{t("overdue")}</Badge>;
      case "cancelled":
        return <Badge variant="secondary">{t("cancelled")}</Badge>;
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <DialogTitle>{t("title")}</DialogTitle>
            {getStatusBadge(invoice.status)}
          </div>
          <DialogDescription>
            {t("description", { number: invoice.invoiceNumber })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold">{t("customerInformation")}</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">{t("name")}:</span>
                  <div className="font-medium">{invoice.customerName}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("email")}:</span>
                  <div className="font-medium">{invoice.customerEmail}</div>
                </div>
                {invoice.salesOrderNumber && (
                  <div>
                    <span className="text-muted-foreground">{t("salesOrder")}:</span>
                    <div className="font-medium">{invoice.salesOrderNumber}</div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold">{t("invoiceDetails")}</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">{t("invoiceDate")}:</span>
                  <div className="font-medium">{formatDate(invoice.invoiceDate)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("dueDate")}:</span>
                  <div className="font-medium">{formatDate(invoice.dueDate)}</div>
                </div>
                {invoice.warehouseName && (
                  <div>
                    <span className="text-muted-foreground">{t("warehouse")}:</span>
                    <div className="font-medium">{invoice.warehouseName}</div>
                  </div>
                )}
                {(invoice.locationCode || invoice.locationName) && (
                  <div>
                    <span className="text-muted-foreground">{t("location")}:</span>
                    <div className="font-medium">
                      {invoice.locationCode}
                      {invoice.locationName ? ` - ${invoice.locationName}` : ""}
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">{t("paymentTerms")}:</span>
                  <div className="font-medium">
                    {invoice.paymentTerms || t("defaultPaymentTerms")}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">{t("billingAddress")}</h3>
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

          <div>
            <h3 className="mb-3 text-sm font-semibold">{t("lineItems")}</h3>
            {!lineDetailsReady && isLoadingLineDetails ? (
              <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                {t("lineDetailsLoading")}
              </div>
            ) : !lineDetailsReady && isLineDetailsError ? (
              <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <p className="text-sm text-destructive">{t("lineDetailsLoadError")}</p>
                <Button variant="outline" size="sm" onClick={() => void refetchLineDetails()}>
                  {t("retry")}
                </Button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 text-left">{t("itemDescription")}</th>
                      <th className="p-3 text-right">{t("quantity")}</th>
                      <th className="p-3 text-center">{t("unit")}</th>
                      <th className="p-3 text-right">{t("unitPrice")}</th>
                      <th className="p-3 text-right">{t("discount")}</th>
                      <th className="p-3 text-right">{t("tax")}</th>
                      <th className="p-3 text-right">{t("total")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {presentedLines.map((row) => (
                      <tr
                        key={row.key}
                        className={row.kind === "sizeHeading" ? "border-t bg-muted/40" : "border-t"}
                      >
                        <td className="p-3">
                          <div
                            className={row.kind === "sizeHeading" ? "font-semibold" : "font-medium"}
                          >
                            {row.description}
                          </div>
                          {row.detail && (
                            <div className="mt-1 text-xs text-muted-foreground">{row.detail}</div>
                          )}
                        </td>
                        <td className="p-3 text-right">{row.quantity}</td>
                        <td className="p-3 text-center">
                          <span className="text-muted-foreground">
                            {row.unit || t("notAvailable")}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {row.kind === "sizeHeading" ? "" : formatCurrency(row.unitPrice)}
                        </td>
                        <td className="p-3 text-right">
                          {row.kind === "sizeHeading"
                            ? ""
                            : formatLineDiscount(
                                row.discountAmount,
                                row.discountRate,
                                formatCurrency
                              )}
                        </td>
                        <td className="p-3 text-right">
                          {row.kind !== "sizeHeading" && row.taxRate ? `${row.taxRate}%` : ""}
                        </td>
                        <td className="p-3 text-right font-medium">
                          {row.kind === "sizeHeading" ? "" : formatCurrency(row.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("subtotal")}:</span>
                <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("discount")}:</span>
                <span className="font-medium text-red-600">
                  -{formatCurrency(invoice.totalDiscount)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("tax")}:</span>
                <span className="font-medium">{formatCurrency(invoice.totalTax)}</span>
              </div>
              <hr className="border-t" />
              <div className="flex justify-between text-base font-bold">
                <span>{t("totalAmount")}:</span>
                <span>{formatCurrency(invoice.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("amountPaid")}:</span>
                <span className="font-medium text-green-600">
                  {formatCurrency(invoice.amountPaid)}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold">
                <span className="text-orange-600">{t("amountDue")}:</span>
                <span className="text-orange-600">{formatCurrency(invoice.amountDue)}</span>
              </div>
            </div>
          </div>

          {payments.length > 0 && (
            <>
              <hr className="border-t" />
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  <h3 className="text-sm font-semibold">
                    {t("paymentHistory", { count: payments.length })}
                  </h3>
                </div>
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-3 text-left">{t("date")}</th>
                        <th className="p-3 text-left">{t("paymentNumber")}</th>
                        <th className="p-3 text-left">{t("method")}</th>
                        <th className="p-3 text-right">{t("amountPaid")}</th>
                        <th className="p-3 text-right">{t("balanceRemaining")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
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
                              <td className="p-3">{formatDate(payment.paymentDate)}</td>
                              <td className="p-3">
                                <div className="font-medium">
                                  {payment.paymentCode || t("notAvailable")}
                                </div>
                                {payment.reference && (
                                  <div className="text-xs text-muted-foreground">
                                    {t("reference", { value: payment.reference })}
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

          {(invoice.paymentTerms || invoice.notes) && (
            <>
              <hr className="border-t" />
              <div className="space-y-4">
                {invoice.paymentTerms && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">{t("termsConditions")}</h3>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {invoice.paymentTerms}
                    </p>
                  </div>
                )}
                {invoice.notes && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">{t("notes")}</h3>
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
            disabled={!lineDetailsReady || isGeneratingPDF || isPrinting}
          >
            <Download className="mr-2 h-4 w-4" />
            {isGeneratingPDF ? t("generatingPdf") : t("downloadPdf")}
          </Button>
          <Button
            onClick={handlePrint}
            variant="outline"
            disabled={!lineDetailsReady || isGeneratingPDF || isPrinting}
          >
            <Printer className="mr-2 h-4 w-4" />
            {isPrinting ? t("preparingPrint") : t("printInvoice")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
