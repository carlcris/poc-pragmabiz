"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, Clock, Gauge, PackageCheck, TrendingDown, Users, Warehouse } from "lucide-react";
import { usePickingEfficiencyReport } from "@/hooks/usePickingEfficiencyReport";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useUsers } from "@/hooks/useUsers";
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

export default function PickingEfficiencyReportPage() {
  const t = useTranslations("pickingEfficiencyReportPage");
  const locale = useLocale();

  const formatNumber = (value: number, digits = 0) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(Number.isFinite(value) ? value : 0);

  const formatPercent = (value: number) => `${formatNumber(value, 1)}%`;

  const formatDuration = (seconds: number) => {
    const totalSeconds = Math.max(0, Math.round(seconds || 0));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}${t("hoursShort")} ${minutes}${t("minutesShort")}`;
    }
    return `${minutes}${t("minutesShort")}`;
  };

  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [warehouseId, setWarehouseId] = useState("all");
  const [pickerUserId, setPickerUserId] = useState("all");
  const [groupBy, setGroupBy] = useState<"picker" | "warehouse">("picker");

  const reportQuery = usePickingEfficiencyReport({
    startDate,
    endDate,
    warehouseId: warehouseId === "all" ? undefined : warehouseId,
    pickerUserId: pickerUserId === "all" ? undefined : pickerUserId,
    groupBy,
  });
  const { data: warehousesData } = useWarehouses({ limit: 50 });
  const { data: usersData } = useUsers({ page: 1, limit: 50, isActive: true });

  const warehouses = warehousesData?.data || [];
  const users = usersData?.data || [];
  const topRows = useMemo(() => (reportQuery.data?.data || []).slice(0, 15), [reportQuery.data?.data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("filters")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("startDate")}</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("endDate")}</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("warehouse")}</label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger><SelectValue placeholder={t("allWarehouses")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allWarehouses")}</SelectItem>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.code} - {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("picker")}</label>
              <Select value={pickerUserId} onValueChange={setPickerUserId}>
                <SelectTrigger><SelectValue placeholder={t("allPickers")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allPickers")}</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {[user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("primaryTable")}</label>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as "picker" | "warehouse") }>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="picker">{t("byPicker")}</SelectItem>
                  <SelectItem value="warehouse">{t("byWarehouse")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {reportQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : reportQuery.isError || !reportQuery.data ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("loadError")}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{t("pickLinesPerHour")}</CardTitle><Gauge className="h-4 w-4 text-blue-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatNumber(reportQuery.data.summary.pickLinesPerHour, 1)}</div><p className="text-xs text-muted-foreground">{t("linesInActiveHours", { lines: formatNumber(reportQuery.data.summary.totalLines), hours: formatNumber(reportQuery.data.summary.activePickHours, 1) })}</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{t("pickAccuracy")}</CardTitle><CheckCircle2 className="h-4 w-4 text-green-600" /></CardHeader><CardContent><div className="text-2xl font-bold text-green-700">{formatPercent(reportQuery.data.summary.pickAccuracyPct)}</div><p className="text-xs text-muted-foreground">{t("shortPickProxy")}</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{t("avgPickTime")}</CardTitle><Clock className="h-4 w-4 text-purple-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatDuration(reportQuery.data.summary.averagePickSeconds)}</div><p className="text-xs text-muted-foreground">{t("completedPickLists", { count: formatNumber(reportQuery.data.summary.totalPickLists) })}</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{t("shortPickRate")}</CardTitle><TrendingDown className="h-4 w-4 text-amber-600" /></CardHeader><CardContent><div className="text-2xl font-bold text-amber-700">{formatPercent(reportQuery.data.summary.shortPickRatePct)}</div><p className="text-xs text-muted-foreground">{t("shortLines", { count: formatNumber(reportQuery.data.summary.totalShortLines) })}</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{t("quantityFillRate")}</CardTitle><PackageCheck className="h-4 w-4 text-indigo-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatPercent(reportQuery.data.summary.quantityFillRatePct)}</div><p className="text-xs text-muted-foreground">{t("quantityFillRateDesc", { picked: formatNumber(reportQuery.data.summary.totalPickedQty, 2), allocated: formatNumber(reportQuery.data.summary.totalAllocatedQty, 2) })}</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{t("pickers")}</CardTitle><Users className="h-4 w-4 text-sky-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatNumber(reportQuery.data.summary.pickerCount)}</div><p className="text-xs text-muted-foreground">{t("observedInPeriod")}</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{t("warehouses")}</CardTitle><Warehouse className="h-4 w-4 text-emerald-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatNumber(reportQuery.data.summary.warehouseCount)}</div><p className="text-xs text-muted-foreground">{t("fulfillingWarehouses")}</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{t("shortQty")}</CardTitle><TrendingDown className="h-4 w-4 text-rose-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatNumber(reportQuery.data.summary.totalShortQty, 2)}</div><p className="text-xs text-muted-foreground">{t("totalQuantityShortPicked")}</p></CardContent></Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>{groupBy === "picker" ? t("pickerPerformance") : t("warehousePerformance")}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{groupBy === "picker" ? t("pickerLabel") : t("warehouseLabel")}</TableHead>
                      <TableHead className="text-right">{t("lines")}</TableHead>
                      <TableHead className="text-right">{t("linesPerHour")}</TableHead>
                      <TableHead className="text-right">{t("accuracy")}</TableHead>
                      <TableHead className="text-right">{t("shortRate")}</TableHead>
                      <TableHead className="text-right">{t("avgTime")}</TableHead>
                      <TableHead className="text-right">{t("utilization")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">{t("noDataForFilters")}</TableCell>
                      </TableRow>
                    ) : (
                      topRows.map((row) => (
                        <TableRow key={row.groupKey}>
                          <TableCell>
                            <div className="font-medium">{row.groupType === "picker" ? row.pickerName || t("unknown") : `${row.warehouseCode || "--"} - ${row.warehouseName || t("unknown")}`}</div>
                            <div className="text-xs text-muted-foreground">{t("pickLists", { count: formatNumber(row.pickListCount) })}</div>
                          </TableCell>
                          <TableCell className="text-right">{formatNumber(row.lineCount)}</TableCell>
                          <TableCell className="text-right">{formatNumber(row.pickLinesPerHour, 1)}</TableCell>
                          <TableCell className="text-right">{formatPercent(row.pickAccuracyPct)}</TableCell>
                          <TableCell className="text-right">{formatPercent(row.shortPickRatePct)}</TableCell>
                          <TableCell className="text-right">{formatDuration(row.averagePickSeconds)}</TableCell>
                          <TableCell className="text-right">{formatPercent(row.pickerUtilizationPct)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{t("shortPickReasons")}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {reportQuery.data.shortReasons.length === 0 ? (
                  <div className="text-sm text-muted-foreground">{t("noShortReasons")}</div>
                ) : (
                  reportQuery.data.shortReasons.slice(0, 10).map((reason) => (
                    <div key={reason.reason} className="flex items-center justify-between rounded-md border p-2">
                      <span className="text-sm">{reason.reason}</span>
                      <Badge variant="secondary">{reason.count}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader><CardTitle>{t("dailyTrend")}</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("date")}</TableHead>
                      <TableHead className="text-right">{t("pickListsLabel")}</TableHead>
                      <TableHead className="text-right">{t("lines")}</TableHead>
                      <TableHead className="text-right">{t("linesPerHour")}</TableHead>
                      <TableHead className="text-right">{t("accuracy")}</TableHead>
                      <TableHead className="text-right">{t("shortRate")}</TableHead>
                      <TableHead className="text-right">{t("avgTime")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportQuery.data.dailyTrend.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{t("noDailyData")}</TableCell></TableRow>
                    ) : (
                      reportQuery.data.dailyTrend.map((day) => (
                        <TableRow key={day.date}>
                          <TableCell>{day.date}</TableCell>
                          <TableCell className="text-right">{formatNumber(day.pickListCount)}</TableCell>
                          <TableCell className="text-right">{formatNumber(day.lineCount)}</TableCell>
                          <TableCell className="text-right">{formatNumber(day.pickLinesPerHour, 1)}</TableCell>
                          <TableCell className="text-right">{formatPercent(day.pickAccuracyPct)}</TableCell>
                          <TableCell className="text-right">{formatPercent(day.shortPickRatePct)}</TableCell>
                          <TableCell className="text-right">{formatDuration(day.averagePickSeconds)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{t("topPickers")}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {reportQuery.data.pickerLeaderboard.length === 0 ? (
                  <div className="text-sm text-muted-foreground">{t("noPickerData")}</div>
                ) : (
                  reportQuery.data.pickerLeaderboard.slice(0, 10).map((row, index) => (
                    <div key={row.groupKey} className="rounded-md border p-2">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{index + 1}. {row.pickerName || t("unknown")}</div>
                          <div className="text-xs text-muted-foreground">{formatNumber(row.lineCount)} {t("lines")} • {formatPercent(row.pickAccuracyPct)} {t("accuracy")}</div>
                        </div>
                        <Badge>
                          {formatNumber(row.pickLinesPerHour, 1)} {t("linesPerHourShort")}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
