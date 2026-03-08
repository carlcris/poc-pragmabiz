"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Clock,
  Factory,
  Gauge,
  PackageCheck,
  TrendingDown,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import { useTransformationEfficiencyReport } from "@/hooks/useTransformationEfficiencyReport";
import { useTransformationTemplates } from "@/hooks/useTransformationTemplates";
import { useWarehouses } from "@/hooks/useWarehouses";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function TransformationEfficiencyReportPage() {
  const t = useTranslations("transformationEfficiencyReportPage");
  const locale = useLocale();

  const formatNumber = (value: number, digits = 0) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(Number.isFinite(value) ? value : 0);

  const formatPercent = (value: number) => `${formatNumber(value, 1)}%`;
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "PHP" }).format(value || 0);
  const formatDuration = (seconds: number) => {
    const total = Math.max(0, Math.round(seconds || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    if (h > 0) {
      return `${h}${t("hoursShort")} ${m}${t("minutesShort")}`;
    }
    return `${m}${t("minutesShort")}`;
  };

  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [warehouseId, setWarehouseId] = useState("all");
  const [templateId, setTemplateId] = useState("all");
  const [groupBy, setGroupBy] = useState<"template" | "warehouse">("template");
  const [status, setStatus] = useState<"COMPLETED" | "PREPARING" | "DRAFT" | "CANCELLED" | "ALL">("COMPLETED");

  const reportQuery = useTransformationEfficiencyReport({
    startDate,
    endDate,
    warehouseId: warehouseId === "all" ? undefined : warehouseId,
    templateId: templateId === "all" ? undefined : templateId,
    groupBy,
    status,
  });
  const { data: warehousesData } = useWarehouses({ limit: 50 });
  const { data: templatesData } = useTransformationTemplates({ page: 1, limit: 50, isActive: true });

  const warehouses = warehousesData?.data || [];
  const templates = templatesData?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader><CardTitle>{t("filters")}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <div className="space-y-2"><label className="text-sm font-medium">{t("startDate")}</label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div className="space-y-2"><label className="text-sm font-medium">{t("endDate")}</label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
            <div className="space-y-2"><label className="text-sm font-medium">{t("warehouse")}</label><Select value={warehouseId} onValueChange={setWarehouseId}><SelectTrigger><SelectValue placeholder={t("allWarehouses")} /></SelectTrigger><SelectContent><SelectItem value="all">{t("allWarehouses")}</SelectItem>{warehouses.map((wh) => <SelectItem key={wh.id} value={wh.id}>{wh.code} - {wh.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><label className="text-sm font-medium">{t("template")}</label><Select value={templateId} onValueChange={setTemplateId}><SelectTrigger><SelectValue placeholder={t("allTemplates")} /></SelectTrigger><SelectContent><SelectItem value="all">{t("allTemplates")}</SelectItem>{templates.map((tpl) => <SelectItem key={tpl.id} value={tpl.id}>{tpl.template_code} - {tpl.template_name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><label className="text-sm font-medium">{t("status")}</label><Select value={status} onValueChange={(v) => setStatus(v as typeof status)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="COMPLETED">{t("completed")}</SelectItem><SelectItem value="PREPARING">{t("preparing")}</SelectItem><SelectItem value="DRAFT">{t("draft")}</SelectItem><SelectItem value="CANCELLED">{t("cancelled")}</SelectItem><SelectItem value="ALL">{t("all")}</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><label className="text-sm font-medium">{t("primaryTable")}</label><Select value={groupBy} onValueChange={(v) => setGroupBy(v as "template" | "warehouse")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="template">{t("byTemplate")}</SelectItem><SelectItem value="warehouse">{t("byWarehouse")}</SelectItem></SelectContent></Select></div>
          </div>
        </CardContent>
      </Card>

      {reportQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
      ) : reportQuery.isError || !reportQuery.data ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{t("loadError")}</CardContent></Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{t("orders")}</CardTitle><Factory className="h-4 w-4 text-blue-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatNumber(reportQuery.data.summary.totalOrders)}</div><p className="text-xs text-muted-foreground">{t("completionRate", { value: formatPercent(reportQuery.data.summary.completionRatePct) })}</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{t("yield")}</CardTitle><TrendingUp className="h-4 w-4 text-green-600" /></CardHeader><CardContent><div className="text-2xl font-bold text-green-700">{formatPercent(reportQuery.data.summary.yieldPct)}</div><p className="text-xs text-muted-foreground">{t("outputQty", { value: formatNumber(reportQuery.data.summary.totalOutputProducedQty, 2) })}</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{t("wasteRate")}</CardTitle><TrendingDown className="h-4 w-4 text-amber-600" /></CardHeader><CardContent><div className="text-2xl font-bold text-amber-700">{formatPercent(reportQuery.data.summary.wasteRatePct)}</div><p className="text-xs text-muted-foreground">{t("wasteQty", { value: formatNumber(reportQuery.data.summary.totalWastedQty, 2) })}</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{t("avgCycleTime")}</CardTitle><Clock className="h-4 w-4 text-purple-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatDuration(reportQuery.data.summary.averageCycleSeconds)}</div><p className="text-xs text-muted-foreground">{t("executionToCompletion")}</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{t("planAdherence")}</CardTitle><Gauge className="h-4 w-4 text-indigo-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatPercent(reportQuery.data.summary.planAdherencePct)}</div><p className="text-xs text-muted-foreground">{t("actualVsPlanned", { actual: formatNumber(reportQuery.data.summary.totalActualQty, 2), planned: formatNumber(reportQuery.data.summary.totalPlannedQty, 2) })}</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{t("costVariance")}</CardTitle><TrendingDown className="h-4 w-4 text-rose-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(reportQuery.data.summary.totalCostVariance)}</div><p className="text-xs text-muted-foreground">{t("inputOutputCost", { input: formatCurrency(reportQuery.data.summary.totalInputCost), output: formatCurrency(reportQuery.data.summary.totalOutputCost) })}</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{t("templates")}</CardTitle><PackageCheck className="h-4 w-4 text-cyan-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatNumber(reportQuery.data.summary.templateCount)}</div><p className="text-xs text-muted-foreground">{t("inSelectedPeriod")}</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{t("warehouses")}</CardTitle><Warehouse className="h-4 w-4 text-emerald-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatNumber(reportQuery.data.summary.warehouseCount)}</div><p className="text-xs text-muted-foreground">{t("participatingWarehouses")}</p></CardContent></Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader><CardTitle>{groupBy === "template" ? t("templatePerformance") : t("warehousePerformance")}</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>{groupBy === "template" ? t("templateLabel") : t("warehouseLabel")}</TableHead><TableHead className="text-right">{t("orders")}</TableHead><TableHead className="text-right">{t("yield")}</TableHead><TableHead className="text-right">{t("waste")}</TableHead><TableHead className="text-right">{t("plan")}</TableHead><TableHead className="text-right">{t("avgCycle")}</TableHead><TableHead className="text-right">{t("variance")}</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {reportQuery.data.data.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{t("noDataForFilters")}</TableCell></TableRow>
                    ) : (
                      reportQuery.data.data.map((row) => (
                        <TableRow key={row.key}>
                          <TableCell><div className="font-medium">{row.groupType === "template" ? `${row.templateCode || "--"} - ${row.templateName || t("unknown")}` : `${row.warehouseCode || "--"} - ${row.warehouseName || t("unknown")}`}</div><div className="text-xs text-muted-foreground">{t("completedSuffix", { value: formatPercent(row.completionRatePct) })}</div></TableCell>
                          <TableCell className="text-right">{formatNumber(row.orderCount)}</TableCell>
                          <TableCell className="text-right">{formatPercent(row.yieldPct)}</TableCell>
                          <TableCell className="text-right">{formatPercent(row.wasteRatePct)}</TableCell>
                          <TableCell className="text-right">{formatPercent(row.planAdherencePct)}</TableCell>
                          <TableCell className="text-right">{formatDuration(row.averageCycleSeconds)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.totalCostVariance)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{t("wasteReasons")}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {reportQuery.data.wasteReasons.length === 0 ? (
                  <div className="text-sm text-muted-foreground">{t("noWasteReasons")}</div>
                ) : (
                  reportQuery.data.wasteReasons.slice(0, 10).map((reason) => (
                    <div key={reason.reason} className="flex items-center justify-between rounded-md border p-2">
                      <span className="text-sm">{reason.reason}</span>
                      <Badge variant="secondary">{reason.count}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>{t("dailyTrend")}</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>{t("date")}</TableHead><TableHead className="text-right">{t("orders")}</TableHead><TableHead className="text-right">{t("completion")}</TableHead><TableHead className="text-right">{t("yield")}</TableHead><TableHead className="text-right">{t("waste")}</TableHead><TableHead className="text-right">{t("avgCycle")}</TableHead><TableHead className="text-right">{t("variance")}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {reportQuery.data.dailyTrend.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{t("noDailyData")}</TableCell></TableRow>
                  ) : (
                    reportQuery.data.dailyTrend.map((day) => (
                      <TableRow key={day.date}>
                        <TableCell>{day.date}</TableCell>
                        <TableCell className="text-right">{formatNumber(day.orderCount)}</TableCell>
                        <TableCell className="text-right">{formatPercent(day.completionRatePct)}</TableCell>
                        <TableCell className="text-right">{formatPercent(day.yieldPct)}</TableCell>
                        <TableCell className="text-right">{formatPercent(day.wasteRatePct)}</TableCell>
                        <TableCell className="text-right">{formatDuration(day.avgCycleSeconds)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(day.totalCostVariance)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
