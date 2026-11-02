"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Download, Pencil, Printer } from "lucide-react";
import { toast } from "sonner";
import { DocumentDetailField } from "@/components/document-page/DocumentDetailField";
import { DocumentLinesTable } from "@/components/document-page/DocumentLinesTable";
import { DocumentSection } from "@/components/document-page/DocumentSection";
import { DocumentSummaryPanel } from "@/components/document-page/DocumentSummaryPanel";
import {
  getDocumentLineColumns,
  type DocumentTrackingColumn,
} from "@/components/document-page/document-line-columns";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusText } from "@/components/shared/StatusText";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { RESOURCES } from "@/constants/resources";
import { useCurrency } from "@/hooks/useCurrency";
import { useResourcePermissions } from "@/hooks/usePermissions";
import { useUpdateStockRequisitionStatus } from "@/hooks/useStockRequisitions";
import {
  formatDocumentAmount,
  formatDocumentDate,
  formatDocumentPerson,
} from "@/lib/documents/document-display";
import type { StockRequisitionPDFData } from "@/lib/pdf-generator";
import { canEditStockRequisition } from "@/lib/stock-requisitions/editability";
import {
  STOCK_REQUISITION_STATUS_LABEL_KEYS,
  STOCK_REQUISITION_STATUS_TONES,
  showsStockRequisitionFulfillment,
} from "@/lib/stock-requisitions/stock-requisition-display";
import type { StockRequisition } from "@/types/stock-requisition";

type StockRequisitionDetailsProps = {
  stockRequisition: StockRequisition;
};

const FULFILLMENT_COLUMNS: readonly DocumentTrackingColumn[] = ["fulfilledQty", "outstandingQty"];

export function StockRequisitionDetails({ stockRequisition }: StockRequisitionDetailsProps) {
  const t = useTranslations("stockRequisitionPage");
  const locale = useLocale();
  const { currentCurrency } = useCurrency();
  const updateStatusMutation = useUpdateStockRequisitionStatus();
  const { canEdit: canEditResource } = useResourcePermissions(RESOURCES.STOCK_REQUISITIONS);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const capabilities = stockRequisition.capabilities;
  const canViewUnitCost = capabilities?.canViewUnitCost === true;
  const canViewTotalAmount = capabilities?.canViewTotalAmount === true;
  const currency = stockRequisition.currency ?? currentCurrency.code;
  const status = stockRequisition.status;
  const noValue = t("notProvided");
  // Editing and sending share the API's edit permission and draft-only rule.
  const canEdit = canEditStockRequisition(stockRequisition, canEditResource);

  const columns = getDocumentLineColumns({
    trackingColumns: showsStockRequisitionFulfillment(status) ? FULFILLMENT_COLUMNS : [],
    showUnitCost: canViewUnitCost,
    showLineTotal: canViewTotalAmount,
    showAction: false,
  });
  const formatDate = (value?: string | null) => (value ? formatDocumentDate(value, locale) : null);
  const statusText = (
    <StatusText tone={STOCK_REQUISITION_STATUS_TONES[status]} className="font-semibold">
      {t(STOCK_REQUISITION_STATUS_LABEL_KEYS[status])}
    </StatusText>
  );
  const createdByName = formatDocumentPerson(stockRequisition.createdByUser);

  const handleSend = async () => {
    try {
      await updateStatusMutation.mutateAsync({ id: stockRequisition.id, status: "submitted" });
      toast.success(t("submitSuccess"));
      setSendDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : t("submitError"));
    }
  };

  const formatPdfAmount = (amount: number | null | undefined, currencyCode?: string | null) =>
    amount == null ? t("noValue") : formatDocumentAmount(amount, currencyCode ?? currency, locale);

  const buildPdfData = (): StockRequisitionPDFData => {
    const supplierLanguage = stockRequisition.supplier?.lang === "chinese" ? "chinese" : "english";
    const settings = stockRequisition.documentSettings;
    const showTotalAmount = settings?.showTotalAmount === true && canViewTotalAmount;
    const showUnitPrice = settings?.showUnitPrice === true && canViewUnitCost;
    const showLineTotal = settings?.showLineTotal === true && canViewTotalAmount;
    const documentCurrency = stockRequisition.documentCurrency ?? stockRequisition.currency;

    return {
      language: supplierLanguage,
      srNumber: stockRequisition.srNumber,
      supplierName: stockRequisition.supplier?.name || t("unknownSupplier"),
      requisitionDate: formatDate(stockRequisition.requisitionDate) ?? t("noValue"),
      requiredByDate: formatDate(stockRequisition.requiredByDate) ?? undefined,
      showTotalAmount,
      totalAmount: showTotalAmount
        ? formatPdfAmount(stockRequisition.documentTotalAmount, documentCurrency)
        : undefined,
      showUnitPrice,
      showLineTotal,
      items: stockRequisition.items.map((item) => ({
        itemCode: item.item?.code || t("na"),
        itemName:
          supplierLanguage === "chinese"
            ? item.item?.chineseName || item.item?.name || t("unknownItem")
            : item.item?.name || t("unknownItem"),
        requestedQty: item.requestedQty,
        unitPrice: showUnitPrice
          ? formatPdfAmount(item.documentUnitPrice, documentCurrency)
          : undefined,
        totalPrice: showLineTotal
          ? formatPdfAmount(item.documentTotalPrice, documentCurrency)
          : undefined,
      })),
      notes: stockRequisition.notes || undefined,
      createdBy: createdByName ?? t("noValue"),
      businessUnit: stockRequisition.businessUnit?.name
        ? `${stockRequisition.businessUnit.name} (${stockRequisition.businessUnit.code || ""})`
        : undefined,
    };
  };

  const handlePdf = async (output: "download" | "print") => {
    setIsGeneratingPdf(true);
    try {
      const { generateStockRequisitionPDF } = await import("@/lib/pdf-generator");
      await generateStockRequisitionPDF(
        buildPdfData(),
        output === "print" ? { output: "print" } : undefined
      );
      toast.success(output === "print" ? t("printSuccess") : t("pdfSuccess"));
    } catch (error) {
      console.error("Failed to generate stock requisition PDF:", error);
      toast.error(output === "print" ? t("printError") : t("pdfError"));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="tabular-nums">{stockRequisition.srNumber}</span>
            {statusText}
          </span>
        }
        subtitle={
          stockRequisition.supplier
            ? t("viewDescription", { supplier: stockRequisition.supplier.name })
            : undefined
        }
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 overflow-hidden rounded-xl border bg-card">
          <DocumentSection id="stock-requisition-request" title={t("requestTitle")}>
            <dl className="grid gap-5 sm:grid-cols-2">
              <DocumentDetailField
                label={t("supplier")}
                value={stockRequisition.supplier?.name}
                hint={stockRequisition.supplier?.contactPerson}
                emptyLabel={noValue}
              />
              <DocumentDetailField
                label={t("businessUnit")}
                value={stockRequisition.businessUnit?.name}
                hint={stockRequisition.businessUnit?.code}
                emptyLabel={noValue}
              />
              <DocumentDetailField
                label={t("requisitionDate")}
                value={formatDate(stockRequisition.requisitionDate)}
                emptyLabel={noValue}
                numeric
              />
              <DocumentDetailField
                label={t("requiredByDate")}
                value={formatDate(stockRequisition.requiredByDate)}
                emptyLabel={noValue}
                numeric
              />
            </dl>
          </DocumentSection>

          <section
            aria-labelledby="stock-requisition-items"
            className="border-t px-5 pb-2 pt-6 sm:px-7"
          >
            <div className="flex items-center gap-2">
              <h2 id="stock-requisition-items" className="text-sm font-semibold">
                {t("itemsTitle")}
              </h2>
              <span className="rounded-full bg-primary/10 px-2 text-xs font-semibold tabular-nums">
                {stockRequisition.items.length}
              </span>
            </div>
            {/* Fulfillment columns add width, so phones scroll the table instead of squeezing it. */}
            <div className="mt-2 overflow-x-auto">
              <div className="min-w-[44rem]">
                <DocumentLinesTable
                  rows={stockRequisition.items.map((item) => ({
                    key: item.id,
                    itemCode: item.item?.code ?? "",
                    itemName: item.item?.name ?? "",
                    unitLabel:
                      item.itemUnitOption?.optionLabel?.trim() ||
                      item.itemUnitOption?.uomName ||
                      item.uomCode ||
                      "",
                    uomCode: item.itemUnitOption?.uomCode || item.uomCode || "",
                    qtyPerUnit: item.itemUnitOption?.qtyPerUnit ?? 1,
                    quantity: item.requestedQty,
                    unitPrice: item.unitPrice,
                    lineTotal: item.totalPrice,
                    tracking: {
                      fulfilledQty: item.fulfilledQty,
                      outstandingQty: item.outstandingQty,
                    },
                  }))}
                  columns={columns}
                  currency={currency}
                  totalAmount={canViewTotalAmount ? stockRequisition.totalAmount : null}
                  emptyTitle={t("noItemsTitle")}
                  emptyDescription={t("noItemsViewDescription")}
                />
              </div>
            </div>
          </section>

          <DocumentSection id="stock-requisition-notes" title={t("notesTitle")}>
            <p
              className={
                stockRequisition.notes
                  ? "max-w-prose whitespace-pre-line text-sm leading-relaxed"
                  : "text-sm text-muted-foreground"
              }
            >
              {stockRequisition.notes || noValue}
            </p>
          </DocumentSection>
        </div>

        <DocumentSummaryPanel
          title={t("summaryTitle")}
          rows={[
            { key: "status", label: t("summaryStatus"), value: statusText },
            {
              key: "supplier",
              label: t("summarySupplier"),
              value: stockRequisition.supplier?.name ?? t("noValue"),
            },
            {
              key: "requested",
              label: t("summaryRequested"),
              value: formatDate(stockRequisition.requisitionDate) ?? t("noValue"),
            },
            {
              key: "requiredBy",
              label: t("summaryRequiredBy"),
              value: formatDate(stockRequisition.requiredByDate) ?? t("noValue"),
            },
            { key: "items", label: t("summaryItems"), value: stockRequisition.items.length },
          ]}
          totalLabel={t("total")}
          total={
            canViewTotalAmount && stockRequisition.totalAmount != null
              ? formatDocumentAmount(stockRequisition.totalAmount, currency, locale)
              : null
          }
          actions={
            <>
              {canEdit ? (
                <>
                  <Button
                    type="button"
                    className="h-11 w-full"
                    onClick={() => setSendDialogOpen(true)}
                  >
                    {t("send")}
                  </Button>
                  <p className="text-xs text-muted-foreground">{t("sendHint")}</p>
                  <Button asChild variant="outline" className="h-11 w-full">
                    <Link href={`/purchasing/stock-requisitions/${stockRequisition.id}/edit`}>
                      <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                      {t("edit")}
                    </Link>
                  </Button>
                </>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full"
                onClick={() => handlePdf("print")}
                disabled={isGeneratingPdf}
              >
                <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("print")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full"
                onClick={() => handlePdf("download")}
                disabled={isGeneratingPdf}
              >
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("downloadPdf")}
              </Button>
            </>
          }
          footer={
            createdByName ? (
              <p>
                {t("createdBy", {
                  name: createdByName,
                  date: formatDocumentDate(stockRequisition.createdAt, locale),
                })}
              </p>
            ) : null
          }
        />
      </div>

      <AlertDialog open={canEdit && sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("sendTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("sendDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleSend();
              }}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? t("sending") : t("send")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
