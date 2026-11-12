"use client";

import {
  REPORT_PREVIEW_GRID_CLASS_NAME,
  REPORT_PREVIEW_SETTINGS_CLASS_NAME,
  REPORT_PREVIEW_CONTENT_CLASS_NAME,
  REPORT_PREVIEW_FIELDS_CLASS_NAME,
} from "./report-preview-layout";
import { useEffect, useState, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import { useExpiredBatchesReport } from "@/hooks/useExpiredBatchesReport";
import { EXPIRED_BATCHES_REPORT_QUERY_KEY } from "@/hooks/queryKeys";
import { getApiErrorCode } from "@/lib/api";
import type { ExpiredBatchesGroupBy } from "@/types/expired-batches-report";
import { WarehouseSelect } from "@/components/warehouses/WarehouseSelect";
import { ItemCategorySelect } from "@/components/items/ItemCategorySelect";
import { Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ReportPreviewFrame, useReportPdfPreviewState } from "./ReportPreviewFrame";
import type { ExpiredBatchesLabels } from "./ExpiredBatchesReportPDF";

type Props = {
  open: boolean;
  reportName: string;
  onPreviewStateChange: (state: {
    url: string | null;
    isGenerating: boolean;
    fileName: string;
  }) => void;
};
export function ExpiredBatchesReportPreview({ open, reportName, onPreviewStateChange }: Props) {
  const t = useTranslations("expiredBatchesReport");
  const reports = useTranslations("reportsPage");
  const locale = useLocale();
  const client = useQueryClient();
  const businessUnitId = useBusinessUnitStore((state) => state.currentBusinessUnit?.id);
  const [asOf, setAsOf] = useState(format(new Date(), "yyyy-MM-dd"));
  const [groupBy, setGroupBy] = useState<ExpiredBatchesGroupBy>("item");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [error, setError] = useState("");
  const previewVersion = useRef(0);
  const { previewUrl, isGeneratingPreview, setIsGeneratingPreview, replacePreviewUrl } =
    useReportPdfPreviewState(open);
  const filters = {
    asOf,
    groupBy,
    search: search || undefined,
    warehouseId: warehouseId || undefined,
    categoryId: categoryId === "all" ? undefined : categoryId,
  };
  const exportQuery = useExpiredBatchesReport({ ...filters, page: 1, exportMode: "pdf" }, false);
  const errorMessage = (failure: unknown) =>
    getApiErrorCode(failure, ["EXPIRED_BATCHES_TOO_LARGE"] as const)
      ? t("tooLarge")
      : t("loadError");
  const labels: ExpiredBatchesLabels = {
    title: t("title"),
    item: t("item"),
    batch: t("batch"),
    warehouse: t("warehouse"),
    expiration: t("expiration"),
    daysExpired: t("daysExpired"),
    onHand: t("onHand"),
    reserved: t("reserved"),
    available: t("available"),
    unit: t("unit"),
    subtotal: groupBy === "item" ? t("itemSubtotal") : t("batchSubtotal"),
    generatedAt: t("generatedAt"),
    empty: t("empty"),
  };
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  useEffect(() => {
    previewVersion.current += 1;
    replacePreviewUrl(null);
    setError("");
    return () => {
      previewVersion.current += 1;
    };
  }, [asOf, groupBy, search, warehouseId, categoryId, businessUnitId, replacePreviewUrl]);
  useEffect(() => {
    onPreviewStateChange({
      url: previewUrl,
      isGenerating: isGeneratingPreview,
      fileName: `expired-batches-${asOf}.pdf`,
    });
  }, [previewUrl, isGeneratingPreview, asOf, onPreviewStateChange]);
  useEffect(
    () =>
      client.getQueryCache().subscribe((event) => {
        if (
          event.type === "updated" &&
          event.action.type === "invalidate" &&
          event.query.queryKey[0] === EXPIRED_BATCHES_REPORT_QUERY_KEY
        ) {
          previewVersion.current += 1;
          replacePreviewUrl(null);
        }
      }),
    [client, replacePreviewUrl]
  );
  const preview = async () => {
    const version = previewVersion.current;
    setIsGeneratingPreview(true);
    setError("");
    replacePreviewUrl(null);
    try {
      const [{ data, error: failure }, { pdf }, { ExpiredBatchesReportPDF }] = await Promise.all([
        exportQuery.refetch(),
        import("@react-pdf/renderer"),
        import("./ExpiredBatchesReportPDF"),
      ]);
      if (failure) throw failure;
      if (!data) throw new Error("Missing expired batches export");
      const subtitle = t("summary", { date: asOf, count: data.totalRows });
      const blob = await pdf(
        <ExpiredBatchesReportPDF
          rows={data.data}
          labels={labels}
          subtitle={subtitle}
          locale={locale}
          groupBy={groupBy}
        />
      ).toBlob();
      if (version === previewVersion.current) replacePreviewUrl(URL.createObjectURL(blob));
    } catch (failure) {
      if (version === previewVersion.current) setError(errorMessage(failure));
    } finally {
      setIsGeneratingPreview(false);
    }
  };
  return (
    <div className={REPORT_PREVIEW_GRID_CLASS_NAME}>
      <div className={REPORT_PREVIEW_SETTINGS_CLASS_NAME}>
        <h3 className="font-semibold">{reports("reportSettings")}</h3>
        <div className={REPORT_PREVIEW_FIELDS_CLASS_NAME}>
          <div className="space-y-2">
            <Label htmlFor="expired-group">{t("groupBy")}</Label>
            <Select
              value={groupBy}
              disabled={isGeneratingPreview}
              onValueChange={(value) => {
                if (value === "item" || value === "batch") setGroupBy(value);
              }}
            >
              <SelectTrigger id="expired-group">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="item">{t("item")}</SelectItem>
                <SelectItem value="batch">{t("batch")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="expired-search">{t("search")}</Label>
            <Input
              id="expired-search"
              value={searchInput}
              disabled={isGeneratingPreview}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("category")}</Label>
            <ItemCategorySelect value={categoryId} onValueChange={setCategoryId} allowAll />
          </div>
          <div className="space-y-2">
            <Label>{t("warehouse")}</Label>
            <WarehouseSelect
              value={warehouseId}
              onValueChange={setWarehouseId}
              scope={businessUnitId ? "current_business_unit" : "accessible_business_units"}
              allowAll
              disabled={isGeneratingPreview}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expired-as-of">{t("asOf")}</Label>
            <Input
              id="expired-as-of"
              type="date"
              value={asOf}
              disabled={isGeneratingPreview}
              onChange={(event) => setAsOf(event.target.value)}
            />
          </div>
        </div>
        <div className="shrink-0 pt-6">
          <Button
            className="w-full"
            onClick={preview}
            disabled={
              isGeneratingPreview ||
              exportQuery.isFetching ||
              !asOf ||
              searchInput.trim() !== search
            }
          >
            {isGeneratingPreview ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            {reports("preview")}
          </Button>
        </div>
      </div>
      <div className={REPORT_PREVIEW_CONTENT_CLASS_NAME}>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <ReportPreviewFrame
          url={previewUrl}
          isGenerating={isGeneratingPreview}
          emptyLabel={reports("previewPlaceholder")}
          loadingLabel={reports("generatingPreview")}
          title={reports("previewFrameTitle", { report: reportName })}
        />
      </div>
    </div>
  );
}
