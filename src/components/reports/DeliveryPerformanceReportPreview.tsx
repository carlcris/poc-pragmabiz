"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Eye, Loader2 } from "lucide-react";
import {
  useDeliveryPerformanceReport,
  type DeliveryDirection,
  type DeliveryPerformanceStatus,
} from "@/hooks/useDeliveryPerformanceReport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PDF_REPORT_ROW_LIMIT,
  ReportPreviewFrame,
  useReportPdfPreviewState,
} from "@/components/reports/ReportPreviewFrame";

type DeliveryPerformanceReportPreviewProps = {
  open: boolean;
  reportName: string;
  onPreviewStateChange: (state: {
    url: string | null;
    isGenerating: boolean;
    fileName: string;
  }) => void;
};

export function DeliveryPerformanceReportPreview({
  open,
  reportName,
  onPreviewStateChange,
}: DeliveryPerformanceReportPreviewProps) {
  const tReports = useTranslations("reportsPage");
  const t = useTranslations("deliveryPerformanceReportPage");
  const locale = useLocale();
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState<DeliveryDirection>("all");
  const [performanceStatus, setPerformanceStatus] =
    useState<DeliveryPerformanceStatus>("all");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const { previewUrl, isGeneratingPreview, setIsGeneratingPreview, replacePreviewUrl } =
    useReportPdfPreviewState(open);

  const reportQuery = useDeliveryPerformanceReport({
    enabled: false,
    startDate,
    endDate,
    search: search || undefined,
    direction,
    performanceStatus,
    page: 1,
    limit: PDF_REPORT_ROW_LIMIT,
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    replacePreviewUrl(null);
    setPreviewError(null);
  }, [direction, endDate, performanceStatus, replacePreviewUrl, search, startDate]);

  useEffect(() => {
    onPreviewStateChange({
      url: previewUrl,
      isGenerating: isGeneratingPreview,
      fileName: `delivery-performance-report-${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  }, [isGeneratingPreview, onPreviewStateChange, previewUrl]);

  const formatNumber = (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);

  const formatPeriodDate = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(new Date(`${value}T00:00:00`));

  const dateSpanDays =
    startDate && endDate
      ? (new Date(`${endDate}T00:00:00`).getTime() -
          new Date(`${startDate}T00:00:00`).getTime()) /
        (24 * 60 * 60 * 1000)
      : -1;
  const isDateRangeValid = dateSpanDays >= 0 && dateSpanDays <= 366;

  const handlePreview = async () => {
    setIsGeneratingPreview(true);
    setPreviewError(null);
    try {
      const { data, error } = await reportQuery.refetch();
      if (error || !data) {
        setPreviewError(t("failedToGenerate"));
        return;
      }

      const [{ pdf }, { DeliveryPerformanceReportPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/reports/DeliveryPerformanceReportPDF"),
      ]);

      const blob = await pdf(
        <DeliveryPerformanceReportPDF
          title={t("title")}
          subtitle={t("subtitle")}
          generatedAtLabel={tReports("generatedAt")}
          periodLabel={t("period")}
          periodValue={`${formatPeriodDate(startDate)} - ${formatPeriodDate(endDate)}`}
          totalDeliveriesLabel={t("totalDeliveries")}
          onTimeRateLabel={t("onTimeRate")}
          averageTransitLabel={t("averageTransit")}
          perfectDeliveryRateLabel={t("perfectDeliveryRate")}
          deliveryNoteLabel={t("deliveryNote")}
          routeLabel={t("route")}
          dispatchedLabel={t("dispatched")}
          requiredLabel={t("required")}
          receivedLabel={t("received")}
          performanceLabel={t("performance")}
          transitLabel={t("transit")}
          quantityLabel={t("quantity")}
          varianceLabel={t("variance")}
          dispatchedQuantityLabel={t("dispatchedQuantity")}
          receivedQuantityLabel={t("receivedQuantity")}
          hoursLabel={t("hours")}
          notAvailableLabel={t("notAvailable")}
          onTimeLabel={t("onTime")}
          lateLabel={t("late")}
          inTransitLabel={t("inTransit")}
          discrepancyLabel={t("discrepancy")}
          noDeliveriesLabel={t("noDeliveries")}
          pageSummary={t("deliveryCount", {
            shown: formatNumber(data.data.length),
            total: formatNumber(data.pagination.total),
          })}
          locale={locale}
          rows={data.data}
          summary={data.summary}
        />
      ).toBlob();

      replacePreviewUrl(URL.createObjectURL(blob));
    } catch {
      setPreviewError(t("failedToGenerate"));
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  return (
    <div className="grid h-full min-h-0 gap-6 lg:grid-cols-4">
      <div className="flex h-full min-h-0 flex-col rounded-lg border bg-muted/20 p-4">
        <div className="space-y-1">
          <h3 className="font-semibold">{tReports("reportSettings")}</h3>
        </div>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("startDate")}</label>
            <Input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("endDate")}</label>
            <Input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("search")}</label>
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t("searchPlaceholder")}
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("direction")}</label>
            <Select
              value={direction}
              onValueChange={(value) => setDirection(value as DeliveryDirection)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allDirections")}</SelectItem>
                <SelectItem value="outbound">{t("outbound")}</SelectItem>
                <SelectItem value="inbound">{t("inbound")}</SelectItem>
                <SelectItem value="internal">{t("internal")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("performanceStatus")}</label>
            <Select
              value={performanceStatus}
              onValueChange={(value) =>
                setPerformanceStatus(value as DeliveryPerformanceStatus)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allStatuses")}</SelectItem>
                <SelectItem value="on_time">{t("onTime")}</SelectItem>
                <SelectItem value="late">{t("late")}</SelectItem>
                <SelectItem value="in_transit">{t("inTransit")}</SelectItem>
                <SelectItem value="discrepancy">{t("discrepancy")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {previewError && <p className="text-sm text-destructive">{previewError}</p>}
          {!previewError && startDate && endDate && !isDateRangeValid && (
            <p className="text-sm text-destructive">{t("invalidDateRange")}</p>
          )}
        </div>
        <div className="mt-auto pt-6">
          <Button
            className="w-full"
            onClick={handlePreview}
            disabled={reportQuery.isFetching || isGeneratingPreview || !isDateRangeValid}
          >
            {isGeneratingPreview ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            {tReports("preview")}
          </Button>
        </div>
      </div>

      <div className="flex h-full min-h-0 flex-col gap-4 lg:col-span-3">
        <ReportPreviewFrame
          url={previewUrl}
          isGenerating={isGeneratingPreview}
          emptyLabel={tReports("previewPlaceholder")}
          loadingLabel={tReports("generatingPreview")}
          title={tReports("previewFrameTitle", { report: reportName })}
        />
      </div>
    </div>
  );
}
