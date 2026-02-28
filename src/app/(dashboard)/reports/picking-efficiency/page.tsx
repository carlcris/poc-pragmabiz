"use client";

import { useMemo, useState } from "react";
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

const formatNumber = (value: number, digits = 0) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);

const formatPercent = (value: number) => `${formatNumber(value, 1)}%`;

const formatDuration = (seconds: number) => {
  const totalSeconds = Math.max(0, Math.round(seconds || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export default function PickingEfficiencyReportPage() {
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
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Picking Efficiency Report</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Measure warehouse picking productivity and short-pick-based accuracy across pick lists.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Warehouse</label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger>
                  <SelectValue placeholder="All Warehouses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.code} - {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Picker</label>
              <Select value={pickerUserId} onValueChange={setPickerUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="All Pickers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pickers</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {[user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Primary Table</label>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as "picker" | "warehouse")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="picker">By Picker</SelectItem>
                  <SelectItem value="warehouse">By Warehouse</SelectItem>
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
            Failed to load picking efficiency report.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pick Lines / Hour</CardTitle>
                <Gauge className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(reportQuery.data.summary.pickLinesPerHour, 1)}</div>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(reportQuery.data.summary.totalLines)} lines in{" "}
                  {formatNumber(reportQuery.data.summary.activePickHours, 1)} active hours
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pick Accuracy</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700">
                  {formatPercent(reportQuery.data.summary.pickAccuracyPct)}
                </div>
                <p className="text-xs text-muted-foreground">Short-pick proxy (line-based)</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Pick Time</CardTitle>
                <Clock className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatDuration(reportQuery.data.summary.averagePickSeconds)}</div>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(reportQuery.data.summary.totalPickLists)} completed pick lists
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Short Pick Rate</CardTitle>
                <TrendingDown className="h-4 w-4 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-700">
                  {formatPercent(reportQuery.data.summary.shortPickRatePct)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(reportQuery.data.summary.totalShortLines)} short lines
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Quantity Fill Rate</CardTitle>
                <PackageCheck className="h-4 w-4 text-indigo-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPercent(reportQuery.data.summary.quantityFillRatePct)}</div>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(reportQuery.data.summary.totalPickedQty, 2)} /{" "}
                  {formatNumber(reportQuery.data.summary.totalAllocatedQty, 2)} qty
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pickers</CardTitle>
                <Users className="h-4 w-4 text-sky-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(reportQuery.data.summary.pickerCount)}</div>
                <p className="text-xs text-muted-foreground">Observed in selected period</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Warehouses</CardTitle>
                <Warehouse className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(reportQuery.data.summary.warehouseCount)}</div>
                <p className="text-xs text-muted-foreground">Fulfilling warehouses</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Short Qty</CardTitle>
                <TrendingDown className="h-4 w-4 text-rose-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(reportQuery.data.summary.totalShortQty, 2)}</div>
                <p className="text-xs text-muted-foreground">Total quantity short-picked</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>
                  {groupBy === "picker" ? "Picker Performance" : "Warehouse Picking Performance"}
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{groupBy === "picker" ? "Picker" : "Warehouse"}</TableHead>
                      <TableHead className="text-right">Lines</TableHead>
                      <TableHead className="text-right">Lines/Hr</TableHead>
                      <TableHead className="text-right">Accuracy</TableHead>
                      <TableHead className="text-right">Short Rate</TableHead>
                      <TableHead className="text-right">Avg Time</TableHead>
                      <TableHead className="text-right">Utilization</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          No data for selected filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      topRows.map((row) => (
                        <TableRow key={row.groupKey}>
                          <TableCell>
                            <div className="font-medium">
                              {row.groupType === "picker"
                                ? row.pickerName || "Unknown"
                                : `${row.warehouseCode || "--"} - ${row.warehouseName || "Unknown"}`}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatNumber(row.pickListCount)} pick lists
                            </div>
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
              <CardHeader>
                <CardTitle>Short Pick Reasons</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {reportQuery.data.shortReasons.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No short-pick reasons recorded.</div>
                ) : (
                  reportQuery.data.shortReasons.slice(0, 10).map((reason) => (
                    <div
                      key={reason.reason}
                      className="flex items-center justify-between rounded-md border p-2"
                    >
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
              <CardHeader>
                <CardTitle>Daily Trend</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Pick Lists</TableHead>
                      <TableHead className="text-right">Lines</TableHead>
                      <TableHead className="text-right">Lines/Hr</TableHead>
                      <TableHead className="text-right">Accuracy</TableHead>
                      <TableHead className="text-right">Short Rate</TableHead>
                      <TableHead className="text-right">Avg Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportQuery.data.dailyTrend.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          No daily data in selected period.
                        </TableCell>
                      </TableRow>
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
              <CardHeader>
                <CardTitle>Top Pickers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {reportQuery.data.pickerLeaderboard.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No picker data.</div>
                ) : (
                  reportQuery.data.pickerLeaderboard.slice(0, 10).map((row, index) => (
                    <div key={row.groupKey} className="rounded-md border p-2">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {index + 1}. {row.pickerName || "Unknown"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatNumber(row.lineCount)} lines • {formatPercent(row.pickAccuracyPct)} accuracy
                          </div>
                        </div>
                        <Badge>{formatNumber(row.pickLinesPerHour, 1)} lph</Badge>
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

