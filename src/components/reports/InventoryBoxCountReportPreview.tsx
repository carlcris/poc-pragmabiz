"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Eye, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ItemCategorySelect } from "@/components/items/ItemCategorySelect";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useInventoryBoxCountPackingUnits } from "@/hooks/useInventoryBoxCountPackingUnits";
import {
  getInventoryBoxCountReportErrorCode,
  useInventoryBoxCountReport,
} from "@/hooks/useInventoryBoxCountReport";
import {
  getInventoryBoxCountReferenceSize,
  renderInventoryBoxCountReportPdf,
} from "@/lib/reports/inventory-box-count-report-pdf";
import { getNamedPdfPreviewUrl } from "@/lib/reports/named-pdf-preview-url";
import { useAuthStore } from "@/stores/authStore";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import type {
  InventoryBoxCountBusinessUnit,
  InventoryBoxCountPackingUnit,
} from "@/types/inventory-box-count-report";
import { InventoryBoxCountBusinessUnitSelect } from "./InventoryBoxCountBusinessUnitSelect";
import { InventoryBoxCountPackingUnitSelect } from "./InventoryBoxCountPackingUnitSelect";
import { ReportPreviewFrame, useReportPdfPreviewState } from "./ReportPreviewFrame";
import {
  REPORT_PREVIEW_ACTIONS_CLASS_NAME,
  REPORT_PREVIEW_CONTENT_CLASS_NAME,
  REPORT_PREVIEW_FIELDS_CLASS_NAME,
  REPORT_PREVIEW_GRID_CLASS_NAME,
  REPORT_PREVIEW_SETTINGS_CLASS_NAME,
} from "./report-preview-layout";

type InventoryBoxCountReportPreviewProps = {
  open: boolean;
  reportName: string;
  onPreviewStateChange: (state: {
    url: string | null;
    isGenerating: boolean;
    fileName: string;
  }) => void;
};

export function InventoryBoxCountReportPreview({
  open,
  reportName,
  onPreviewStateChange,
}: InventoryBoxCountReportPreviewProps) {
  const t = useTranslations("inventoryBoxCountReport");
  const reports = useTranslations("reportsPage");
  const locale = useLocale();
  const currentBusinessUnit = useBusinessUnitStore((state) => state.currentBusinessUnit);
  const scopeBusy = useBusinessUnitStore((state) => state.isLoading || state.isSwitching);
  const user = useAuthStore((state) => state.user);
  const companyId = currentBusinessUnit?.company_id ?? user?.companyId;
  const currentBusinessUnitId = currentBusinessUnit?.id;
  const [category, setCategory] = useState<{ id: string; companyId: string | undefined }>();
  const categoryId = category?.companyId === companyId ? (category?.id ?? "") : "";
  const businessUnitScope = [user?.id, companyId, currentBusinessUnitId].join(":");
  const [businessUnitSelection, setBusinessUnitSelection] = useState<{
    scope: string;
    unit: InventoryBoxCountBusinessUnit | null;
  }>();
  if (businessUnitSelection && businessUnitSelection.scope !== businessUnitScope) {
    setBusinessUnitSelection(undefined);
  }
  const defaultBusinessUnit = currentBusinessUnit?.is_active ? currentBusinessUnit : null;
  const businessUnit =
    businessUnitSelection?.scope === businessUnitScope
      ? businessUnitSelection.unit
      : defaultBusinessUnit;
  const businessUnitId = businessUnit?.id;
  const unitLookupsEnabled = open && !scopeBusy;
  const packingUnitLookup = useInventoryBoxCountPackingUnits({
    companyId,
    businessUnitId: currentBusinessUnitId,
    enabled: unitLookupsEnabled,
  });
  const fetchReport = useInventoryBoxCountReport();
  const [packingUnitSelection, setPackingUnitSelection] = useState<{
    unit: InventoryBoxCountPackingUnit;
    companyId?: string;
  }>();
  const packingUnit =
    (packingUnitSelection?.companyId === companyId ? packingUnitSelection?.unit : undefined) ??
    packingUnitLookup.data?.pages[0]?.defaultUnit ??
    null;
  const packingUnitId = packingUnit?.id;
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const { previewUrl, isGeneratingPreview, setIsGeneratingPreview, replacePreviewUrl } =
    useReportPdfPreviewState(open);

  const resetPreview = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setIsGeneratingPreview(false);
    replacePreviewUrl(null);
    setViewerUrl(null);
    setPreviewError(null);
  }, [replacePreviewUrl, setIsGeneratingPreview]);

  useEffect(() => {
    resetPreview();
    return () => controllerRef.current?.abort();
  }, [open, businessUnitId, businessUnitScope, packingUnitId, locale, resetPreview, scopeBusy]);

  useEffect(() => {
    onPreviewStateChange({ url: previewUrl, fileName, isGenerating: isGeneratingPreview });
  }, [previewUrl, fileName, isGeneratingPreview, onPreviewStateChange]);

  function errorMessage(error: unknown) {
    switch (getInventoryBoxCountReportErrorCode(error)) {
      case "INVENTORY_BOX_COUNT_TOO_LARGE":
        return t("tooLarge");
      case "INVENTORY_BOX_COUNT_CATEGORY_NOT_FOUND":
        return t("categoryNotFound");
      case "INVENTORY_BOX_COUNT_PACKING_UNIT_NOT_FOUND":
        return t("packingUnitNotFound");
      case "INVENTORY_BOX_COUNT_FORBIDDEN":
        return t("forbidden");
      case "INVENTORY_BOX_COUNT_FILTERS_INVALID":
        return t("invalidFilters");
      default:
        return error instanceof Error && error.message === "REPORT_PDF_TIMEOUT"
          ? t("previewTimeout")
          : t("loadError");
    }
  }

  async function preview() {
    if (!categoryId || !packingUnitId || scopeBusy) return;
    resetPreview();
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsGeneratingPreview(true);
    let pendingBlobUrl: string | undefined;

    try {
      const data = await fetchReport(
        { categoryId, businessUnitId, packingUnitId },
        controller.signal
      );
      if (controller.signal.aborted) return;
      const generatedAt = new Date();
      const generatedAtLabel = new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(generatedAt);
      const unitLabelValues = {
        kind: data.packingUnit.code === "BOX" ? "box" : "other",
        code: data.packingUnit.code,
      };
      const referenceSize = getInventoryBoxCountReferenceSize(data.data);
      const packingUnitSummary =
        referenceSize === null
          ? t("unitNameWithCode", { name: data.packingUnit.name, code: data.packingUnit.code })
          : t("unitNameWithReferenceSize", {
              name: data.packingUnit.name,
              size: new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(
                referenceSize
              ),
            });
      const blob = await renderInventoryBoxCountReportPdf(
        {
          title: reportName,
          categoryName: data.category.name,
          businessUnitName: data.businessUnit?.name ?? t("allBusinessUnits"),
          packingUnitSummary,
          generatedAtLine: t("generatedAtLine", { date: generatedAtLabel }),
          totalFullPackingUnits: data.summary.totalFullPackingUnits,
          totalItems: data.summary.totalItems,
          itemsWithoutPackingUnitSize: data.summary.itemsWithoutPackingUnitSize,
          locale,
          rows: data.data,
          labels: {
            category: t("category"),
            businessUnit: t("businessUnit"),
            packingUnit: t("calculationUnit"),
            sortedByItemName: t("sortedByItemName"),
            totalFullPackingUnits: t("totalFullPackingUnits", unitLabelValues),
            reportedItems: t("reportedItems"),
            excludedItems: t("excludedItems", unitLabelValues),
            fullPackingUnitsNote: t("fullPackingUnitsNote", unitLabelValues),
            item: t("item"),
            onHand: t("onHand"),
            qtyPerPackingUnit: t("qtyPerPackingUnit", unitLabelValues),
            fullPackingUnits: t("fullPackingUnits", unitLabelValues),
            looseUnits: t("looseUnits"),
            empty: t("empty", unitLabelValues),
          },
        },
        controller.signal
      );
      if (controller.signal.aborted) return;

      const nextFileName = `${reportName} - ${format(generatedAt, "yyyy-MM-dd")}.pdf`;
      pendingBlobUrl = URL.createObjectURL(blob);
      const namedUrl = await getNamedPdfPreviewUrl(pendingBlobUrl, nextFileName);
      if (controller.signal.aborted) return;
      setFileName(nextFileName);
      setViewerUrl(namedUrl);
      replacePreviewUrl(pendingBlobUrl);
      pendingBlobUrl = undefined;
    } catch (error) {
      if (!controller.signal.aborted) setPreviewError(errorMessage(error));
    } finally {
      if (pendingBlobUrl) URL.revokeObjectURL(pendingBlobUrl);
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setIsGeneratingPreview(false);
      }
    }
  }

  return (
    <div className={REPORT_PREVIEW_GRID_CLASS_NAME}>
      <div className={REPORT_PREVIEW_SETTINGS_CLASS_NAME}>
        <h3 className="font-semibold">{reports("reportSettings")}</h3>
        <fieldset
          disabled={isGeneratingPreview || scopeBusy}
          className={REPORT_PREVIEW_FIELDS_CLASS_NAME}
        >
          <div className="space-y-2">
            <Label htmlFor="inventory-box-count-category">{t("category")}</Label>
            <ItemCategorySelect
              id="inventory-box-count-category"
              value={categoryId}
              onValueChange={(value) => {
                resetPreview();
                setCategory({ id: value, companyId });
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inventory-box-count-business-unit">{t("businessUnit")}</Label>
            <InventoryBoxCountBusinessUnitSelect
              key={businessUnitScope}
              id="inventory-box-count-business-unit"
              companyId={companyId}
              currentBusinessUnitId={currentBusinessUnitId}
              value={businessUnit}
              onValueChange={(unit) => {
                if (unit?.id === businessUnitId) return;
                resetPreview();
                setBusinessUnitSelection({ scope: businessUnitScope, unit });
              }}
              enabled={unitLookupsEnabled}
              disabled={isGeneratingPreview || scopeBusy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inventory-box-count-calculation-unit">{t("calculationUnit")}</Label>
            <InventoryBoxCountPackingUnitSelect
              key={companyId}
              id="inventory-box-count-calculation-unit"
              companyId={companyId}
              businessUnitId={currentBusinessUnitId}
              value={packingUnit}
              onValueChange={(unit) => {
                if (unit.id === packingUnitId) return;
                resetPreview();
                setPackingUnitSelection({ unit, companyId });
              }}
              enabled={unitLookupsEnabled}
              disabled={isGeneratingPreview || scopeBusy}
            />
          </div>
        </fieldset>
        <div className={REPORT_PREVIEW_ACTIONS_CLASS_NAME}>
          <Button
            type="button"
            className="w-full"
            disabled={!categoryId || !packingUnitId || scopeBusy || isGeneratingPreview}
            onClick={preview}
          >
            {isGeneratingPreview ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            {reports("preview")}
          </Button>
          {isGeneratingPreview && (
            <Button type="button" variant="outline" className="mt-2 w-full" onClick={resetPreview}>
              {t("cancelPreview")}
            </Button>
          )}
        </div>
      </div>
      <div className={REPORT_PREVIEW_CONTENT_CLASS_NAME}>
        {previewError && (
          <p role="alert" className="text-sm text-destructive">
            {previewError}
          </p>
        )}
        <ReportPreviewFrame
          url={previewUrl ? viewerUrl : null}
          isGenerating={isGeneratingPreview}
          emptyLabel={reports("previewPlaceholder")}
          loadingLabel={reports("generatingPreview")}
          title={reports("previewFrameTitle", { report: reportName })}
        />
      </div>
    </div>
  );
}
