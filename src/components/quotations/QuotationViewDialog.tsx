"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Box, Download, Eye, Loader2, Printer, Ruler, Scissors } from "lucide-react";
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

type QuotationViewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: Quotation | null;
};

type PreviewFrameProps = {
  url: string | null;
  isGenerating: boolean;
  emptyLabel: string;
  loadingLabel: string;
  title: string;
};

function PreviewFrame({ url, isGenerating, emptyLabel, loadingLabel, title }: PreviewFrameProps) {
  if (isGenerating) {
    return (
      <div className="flex h-full min-h-[560px] items-center justify-center rounded-lg border bg-muted/30">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{loadingLabel}</p>
        </div>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex h-full min-h-[560px] items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 text-center">
        <div className="max-w-sm space-y-2">
          <Eye className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[560px] overflow-hidden rounded-lg border bg-white">
      <iframe src={url} title={title} className="h-full min-h-[560px] w-full border-0" />
    </div>
  );
}

function printPdfPreview(url: string | null) {
  if (!url) return;
  const printWindow = window.open(url, "_blank");
  if (!printWindow) return;

  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
}

function downloadPdfPreview(url: string | null, fileName: string) {
  if (!url) return;
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function usePdfPreviewState(open: boolean) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  useEffect(() => {
    if (!open && previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [open, previewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const replacePreviewUrl = useCallback((nextUrl: string | null) => {
    setPreviewUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
      return nextUrl;
    });
  }, []);

  return {
    previewUrl,
    isGeneratingPreview,
    setIsGeneratingPreview,
    replacePreviewUrl,
  };
}

function QuotationPrintPreviewDialog({
  open,
  onOpenChange,
  quotation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: Quotation;
}) {
  const tReports = useTranslations("reportsPage");
  const { previewUrl, isGeneratingPreview, setIsGeneratingPreview, replacePreviewUrl } =
    usePdfPreviewState(open);
  const fileName = useMemo(
    () => `quotation-${quotation.quotationNumber}-${new Date().toISOString().slice(0, 10)}.pdf`,
    [quotation.quotationNumber]
  );

  useEffect(() => {
    if (!open) return;

    let isActive = true;

    const generatePreview = async () => {
      setIsGeneratingPreview(true);
      try {
        const [{ pdf }, { QuotationPDF }] = await Promise.all([
          import("@react-pdf/renderer"),
          import("@/components/quotations/QuotationPDF"),
        ]);
        const generatedAt = new Date().toLocaleString("en-PH", {
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
        const blob = await pdf(
          <QuotationPDF quotation={quotation} generatedAt={generatedAt} />
        ).toBlob();

        if (!isActive) return;
        replacePreviewUrl(URL.createObjectURL(blob));
      } finally {
        if (isActive) {
          setIsGeneratingPreview(false);
        }
      }
    };

    replacePreviewUrl(null);
    void generatePreview();

    return () => {
      isActive = false;
    };
  }, [open, quotation, replacePreviewUrl, setIsGeneratingPreview]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-w-[88vw] flex-col gap-0 overflow-hidden p-0 xl:max-w-[1500px]">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Quotation Preview</DialogTitle>
          <DialogDescription>
            Review {quotation.quotationNumber} before printing or downloading.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden px-6 py-5">
          <PreviewFrame
            url={previewUrl}
            isGenerating={isGeneratingPreview}
            emptyLabel="The quotation preview is not available yet."
            loadingLabel={tReports("generatingPreview")}
            title={`Quotation ${quotation.quotationNumber}`}
          />
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button
            variant="outline"
            onClick={() => printPdfPreview(previewUrl)}
            disabled={!previewUrl || isGeneratingPreview}
          >
            <Printer className="mr-2 h-4 w-4" />
            {tReports("print")}
          </Button>
          <Button
            variant="outline"
            onClick={() => downloadPdfPreview(previewUrl, fileName)}
            disabled={!previewUrl || isGeneratingPreview}
          >
            <Download className="mr-2 h-4 w-4" />
            {tReports("downloadPdf")}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tReports("cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function QuotationViewDialog({ open, onOpenChange, quotation }: QuotationViewDialogProps) {
  const t = useTranslations("quotationViewDialog");
  const locale = useLocale();
  const { formatCurrency } = useCurrency();
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setPreviewOpen(false);
    }
  }, [open]);

  if (!quotation) return null;

  const handlePrint = () => {
    setPreviewOpen(true);
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
    return new Date(dateString).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatNumber = (value: number | undefined) => {
    if (value === undefined || !Number.isFinite(value)) return "—";
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatServiceFeeMode = (value: string) => {
    if (value === "per_frame") return "Per frame";
    if (value === "per_order") return "Per order";
    if (value === "size_based") return "By frame size";
    if (value === "service_type") return "By service type";
    if (value === "manual") return "Manual";
    return value;
  };

  const formatInvoiceDisplayMode = (value: string) => {
    if (value === "summary") return "Summary";
    if (value === "components") return "Components";
    if (value === "both") return "Summary and components";
    return value;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto print:max-h-none">
          <DialogHeader>
            <div className="flex items-center gap-4">
              <DialogTitle>{t("title")}</DialogTitle>
              {getStatusBadge(quotation.status)}
            </div>
            <DialogDescription>
              {t("description", { number: quotation.quotationNumber })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Header Information */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="mb-3 text-sm font-semibold">{t("customerInformation")}</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t("name")}:</span>
                    <div className="font-medium">{quotation.customerName}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("email")}:</span>
                    <div className="font-medium">{quotation.customerEmail}</div>
                  </div>
                  {quotation.salesOrderId && (
                    <div>
                      <span className="text-muted-foreground">{t("salesOrder")}:</span>
                      <div className="font-medium">{quotation.salesOrderId}</div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold">{t("quotationDetails")}</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t("quotationDate")}:</span>
                    <div className="font-medium">{formatDate(quotation.quotationDate)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("validUntil")}:</span>
                    <div className="font-medium">{formatDate(quotation.validUntil)}</div>
                  </div>
                  {quotation.terms && (
                    <div>
                      <span className="text-muted-foreground">{t("paymentTerms")}:</span>
                      <div className="font-medium">{quotation.terms}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Billing Address */}
            {quotation.billingAddress && (
              <div>
                <h3 className="mb-3 text-sm font-semibold">{t("billingAddress")}</h3>
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

            <div className="space-y-3">
              <h3 className="mb-3 text-sm font-semibold">{t("lineItems")}</h3>
              {quotation.lineItems.map((item, index) => {
                const config = item.frameConfiguration;
                const components = item.frameComponents || [];
                const moldingComponent = components.find(
                  (component) => component.componentType === "molding"
                );
                const otherComponents = components.filter(
                  (component) => component.componentType !== "molding"
                );

                return (
                  <div key={`${item.id}-${index}`} className="overflow-hidden rounded-lg border">
                    <div className="grid gap-3 bg-muted/40 p-4 text-sm md:grid-cols-12 md:items-start">
                      <div className="md:col-span-4">
                        <div className="font-semibold">{item.itemName}</div>
                        <div className="text-xs text-muted-foreground">{item.itemCode}</div>
                        {item.description && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {item.description}
                          </div>
                        )}
                      </div>
                      <div className="md:col-span-2 md:text-right">
                        <div className="text-xs text-muted-foreground">Quantity</div>
                        <div className="font-medium">
                          {formatNumber(item.quantity)} {item.uomCode || item.uomName || ""}
                        </div>
                      </div>
                      <div className="md:col-span-2 md:text-right">
                        <div className="text-xs text-muted-foreground">Unit Price</div>
                        <div className="font-medium">{formatCurrency(item.unitPrice)}</div>
                      </div>
                      <div className="md:col-span-1 md:text-right">
                        <div className="text-xs text-muted-foreground">Disc</div>
                        <div className="font-medium">{formatNumber(item.discount)}%</div>
                      </div>
                      <div className="md:col-span-1 md:text-right">
                        <div className="text-xs text-muted-foreground">Tax</div>
                        <div className="font-medium">{formatNumber(item.taxRate)}%</div>
                      </div>
                      <div className="md:col-span-2 md:text-right">
                        <div className="text-xs text-muted-foreground">Total</div>
                        <div className="text-base font-bold">{formatCurrency(item.lineTotal)}</div>
                      </div>
                    </div>

                    {config && (
                      <div className="space-y-4 p-4">
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="rounded-md border p-3">
                            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                              <Ruler className="h-4 w-4" />
                              Frame Size
                            </div>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Width</span>
                                <span>{formatNumber(config.width)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Height</span>
                                <span>{formatNumber(config.height)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Allowance</span>
                                <span>{formatNumber(config.fixedAllowance)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-md border p-3">
                            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                              <Scissors className="h-4 w-4" />
                              Molding
                            </div>
                            <div className="space-y-1 text-sm">
                              <div className="font-medium">
                                {config.moldingItemCode || moldingComponent?.itemCode || "—"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {config.moldingItemName || moldingComponent?.itemName || ""}
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Stick length</span>
                                <span>{formatNumber(config.moldingStickLength)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Sticks</span>
                                <span>{formatNumber(config.moldingSticksRequired)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Amount</span>
                                <span>{formatCurrency(moldingComponent?.totalAmount || 0)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-md border p-3">
                            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                              <Box className="h-4 w-4" />
                              Service
                            </div>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Mode</span>
                                <span>{formatServiceFeeMode(config.serviceFeeMode)}</span>
                              </div>
                              {config.serviceType && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Type</span>
                                  <span>{config.serviceType}</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Fee</span>
                                <span>{formatCurrency(config.serviceFeeAmount)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Total service</span>
                                <span>{formatCurrency(config.totalServiceFee)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Invoice</span>
                                <span>{formatInvoiceDisplayMode(config.invoiceDisplayMode)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="mb-2 text-sm font-semibold">Material Components</div>
                          <div className="overflow-hidden rounded-md border">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/60">
                                <tr>
                                  <th className="p-2 text-left">Type</th>
                                  <th className="p-2 text-left">Item</th>
                                  <th className="p-2 text-right">Qty / Frame</th>
                                  <th className="p-2 text-right">Total Qty</th>
                                  <th className="p-2 text-center">Unit</th>
                                  <th className="p-2 text-right">Rate</th>
                                  <th className="p-2 text-right">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {components.length === 0 ? (
                                  <tr>
                                    <td
                                      colSpan={7}
                                      className="p-3 text-center text-muted-foreground"
                                    >
                                      No material components recorded.
                                    </td>
                                  </tr>
                                ) : (
                                  components.map((component) => (
                                    <tr key={component.id || component.itemId} className="border-t">
                                      <td className="p-2 capitalize">{component.componentType}</td>
                                      <td className="p-2">
                                        <div className="font-medium">
                                          {component.itemCode || "—"} {component.itemName || ""}
                                        </div>
                                        {component.description && (
                                          <div className="text-xs text-muted-foreground">
                                            {component.description}
                                          </div>
                                        )}
                                      </td>
                                      <td className="p-2 text-right">
                                        {formatNumber(component.qtyPerFrame)}
                                      </td>
                                      <td className="p-2 text-right">
                                        {formatNumber(component.totalQuantity)}
                                      </td>
                                      <td className="p-2 text-center">
                                        {component.uomCode || component.uomId}
                                      </td>
                                      <td className="p-2 text-right">
                                        {formatCurrency(component.unitRate)}
                                      </td>
                                      <td className="p-2 text-right font-medium">
                                        {formatCurrency(component.totalAmount)}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {otherComponents.length > 0 && (
                          <div className="text-right text-sm">
                            <span className="text-muted-foreground">Other materials: </span>
                            <span className="font-medium">
                              {formatCurrency(
                                otherComponents.reduce(
                                  (sum, component) => sum + component.totalAmount,
                                  0
                                )
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("subtotal")}:</span>
                  <span className="font-medium">{formatCurrency(quotation.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("discount")}:</span>
                  <span className="font-medium text-red-600">
                    -{formatCurrency(quotation.totalDiscount)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("tax")}:</span>
                  <span className="font-medium">{formatCurrency(quotation.totalTax)}</span>
                </div>
                <hr className="border-t" />
                <div className="flex justify-between text-base font-bold">
                  <span>{t("totalAmount")}:</span>
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
                      <h3 className="mb-2 text-sm font-semibold">{t("termsConditions")}</h3>
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {quotation.terms}
                      </p>
                    </div>
                  )}
                  {quotation.notes && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold">{t("notes")}</h3>
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
              {t("printQuotation")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <QuotationPrintPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        quotation={quotation}
      />
    </>
  );
}
