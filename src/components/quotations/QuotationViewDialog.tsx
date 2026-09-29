"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Download, Eye, Loader2, Pencil, Printer, ShoppingCart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SalesDocumentLineItemsTable } from "@/components/common/SalesDocumentLineItemsTable";
import { useCurrency } from "@/hooks/useCurrency";
import { quotationTotals } from "@/lib/quotations/quotation-totals";
import { canEditQuotation } from "@/lib/quotations/editability";
import type { Quotation, QuotationStatus } from "@/types/quotation";
import { CreateGuard } from "@/components/permissions/PermissionGuard";
import { RESOURCES } from "@/constants/resources";

type QuotationViewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: Quotation | null;
  onConvertToSalesOrder?: (quotation: Quotation) => void;
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
  const t = useTranslations("quotationViewDialog");
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
          <DialogTitle>{t("previewTitle")}</DialogTitle>
          <DialogDescription>
            {t("previewDescription", { number: quotation.quotationNumber })}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden px-6 py-5">
          <PreviewFrame
            url={previewUrl}
            isGenerating={isGeneratingPreview}
            emptyLabel={t("previewUnavailable")}
            loadingLabel={tReports("generatingPreview")}
            title={t("previewFrameTitle", { number: quotation.quotationNumber })}
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

export function QuotationViewDialog({
  open,
  onOpenChange,
  quotation,
  onConvertToSalesOrder,
}: QuotationViewDialogProps) {
  const t = useTranslations("quotationViewDialog");
  const tq = useTranslations("quotationsPage");
  const ta = useTranslations("quotationAcceptance");
  const locale = useLocale();
  const { formatCurrency } = useCurrency();
  const router = useRouter();
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setPreviewOpen(false);
    }
  }, [open]);

  if (!quotation) return null;

  // Editing is a page, not a dialog, so this closes the preview first —
  // otherwise the route changes behind an open overlay and the user returns to
  // a dialog they thought they had left.
  const handleEdit = () => {
    onOpenChange(false);
    router.push(`/sales/quotations/${quotation.id}/edit`);
  };

  const handlePrint = () => {
    setPreviewOpen(true);
  };

  const getStatusText = (status: QuotationStatus) => {
    switch (status) {
      case "draft":
        return <span className="text-muted-foreground">{t("draft")}</span>;
      case "sent":
        return <span className="text-blue-600">{t("sent")}</span>;
      case "accepted":
        return <span className="text-green-600">{t("accepted")}</span>;
      case "partially_ordered":
        return <span className="text-amber-700">{t("partiallyOrdered")}</span>;
      case "rejected":
        return <span className="text-destructive">{t("rejected")}</span>;
      case "expired":
        return <span className="text-orange-700">{t("expired")}</span>;
      case "ordered":
        return <span className="text-purple-700">{t("ordered")}</span>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const showTermsAndConditions =
    Boolean(quotation.terms) && quotation.paymentTerms.trim().toLowerCase() !== "cash";
  const totals = quotationTotals(quotation.lineItems);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-h-[90vh] max-w-6xl overflow-y-auto print:max-h-none"
          hideCloseButton
        >
          <DialogHeader>
            <div className="flex items-center gap-4">
              <DialogTitle>{t("title")}</DialogTitle>
              <span className="text-sm font-medium">{getStatusText(quotation.status)}</span>
            </div>
            <DialogDescription>
              {t("description", { number: quotation.quotationNumber })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Header Information */}
            <div className="grid gap-6 md:grid-cols-2">
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
                  {quotation.paymentTerms && (
                    <div>
                      <span className="text-muted-foreground">{t("paymentTerms")}:</span>
                      <div className="font-medium">{quotation.paymentTerms}</div>
                    </div>
                  )}
                  {/* The acceptance record, once there is one. This is what the
                      shop produces months later if a job is disputed. */}
                  {quotation.acceptedByName && (
                    <div>
                      <span className="text-muted-foreground">{t("acceptedBy")}:</span>
                      <div className="font-medium">
                        {quotation.acceptedByName}
                        {quotation.acceptedChannel ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {ta(`channels.${quotation.acceptedChannel}`)}
                          </span>
                        ) : null}
                      </div>
                      {quotation.acceptedAt ? (
                        <div className="text-xs text-muted-foreground">
                          {formatDate(quotation.acceptedAt)}
                        </div>
                      ) : null}
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

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{t("lineItems")}</h3>
              <SalesDocumentLineItemsTable
                documentId={quotation.id}
                items={quotation.lineItems}
                showFulfilled
              />
            </section>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("subtotal")}:</span>
                  <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("discount")}:</span>
                  <span className="font-medium text-red-600">
                    -{formatCurrency(totals.totalDiscount)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("tax")}:</span>
                  <span className="font-medium">{formatCurrency(totals.totalTax)}</span>
                </div>
                <hr className="border-t" />
                <div className="flex justify-between text-base font-bold">
                  <span>{t("totalAmount")}:</span>
                  <span>{formatCurrency(totals.totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* Terms and Notes */}
            {(showTermsAndConditions || quotation.notes) && (
              <>
                <hr className="border-t" />
                <div className="space-y-4">
                  {showTermsAndConditions && (
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

          {/* Close sits left, away from the actions, so it is not fallen into
              while reaching for Print. Edit is the primary move on a quotation
              still being negotiated; once confirmed or accepted it is gone
              rather than disabled — a locked quotation is not "edit later", it
              is not editable at all. */}
          <DialogFooter className="gap-2 border-t pt-4 sm:justify-between print:hidden">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t("close")}
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={handlePrint} variant="outline">
                <Printer className="mr-2 h-4 w-4" />
                {t("printPreview")}
              </Button>
              {quotation.status === "accepted" && onConvertToSalesOrder ? (
                <CreateGuard resource={RESOURCES.SALES_ORDERS}>
                  <Button onClick={() => onConvertToSalesOrder(quotation)}>
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    {tq("convertAction")}
                  </Button>
                </CreateGuard>
              ) : null}
              {canEditQuotation(quotation.status) ? (
                <Button onClick={handleEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  {t("edit")}
                </Button>
              ) : null}
            </div>
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
