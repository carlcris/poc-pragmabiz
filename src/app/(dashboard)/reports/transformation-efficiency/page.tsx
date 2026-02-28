"use client";

import { useState } from "react";
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

const formatNumber = (value: number, digits = 0) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);

const formatPercent = (value: number) => `${formatNumber(value, 1)}%`;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value || 0);

const formatDuration = (seconds: number) => {
  const total = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

export default function TransformationEfficiencyReportPage() {
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [warehouseId, setWarehouseId] = useState("all");
  const [templateId, setTemplateId] = useState("all");
  const [groupBy, setGroupBy] = useState<"template" | "warehouse">("template");
  const [status, setStatus] = useState<"COMPLETED" | "PREPARING" | "DRAFT" | "CANCELLED" | "ALL">(
    "COMPLETED"
  );

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
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Transformation Efficiency</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Monitor transformation throughput, yield, waste, cycle time, and cost variance.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
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
                <SelectTrigger><SelectValue placeholder="All Warehouses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>
                      {wh.code} - {wh.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Template</label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue placeholder="All Templates" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Templates</SelectItem>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.template_code} - {tpl.template_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="PREPARING">Preparing</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  <SelectItem value="ALL">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Primary Table</label>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as "template" | "warehouse")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="template">By Template</SelectItem>
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
            Failed to load transformation efficiency report.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Orders</CardTitle>
                <Factory className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(reportQuery.data.summary.totalOrders)}</div>
                <p className="text-xs text-muted-foreground">
                  {formatPercent(reportQuery.data.summary.completionRatePct)} completion rate
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Yield</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700">
                  {formatPercent(reportQuery.data.summary.yieldPct)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Output {formatNumber(reportQuery.data.summary.totalOutputProducedQty, 2)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Waste Rate</CardTitle>
                <TrendingDown className="h-4 w-4 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-700">
                  {formatPercent(reportQuery.data.summary.wasteRatePct)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Waste {formatNumber(reportQuery.data.summary.totalWastedQty, 2)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Cycle Time</CardTitle>
                <Clock className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatDuration(reportQuery.data.summary.averageCycleSeconds)}
                </div>
                <p className="text-xs text-muted-foreground">Execution to completion</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Plan Adherence</CardTitle>
                <Gauge className="h-4 w-4 text-indigo-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatPercent(reportQuery.data.summary.planAdherencePct)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Actual {formatNumber(reportQuery.data.summary.totalActualQty, 2)} vs planned{" "}
                  {formatNumber(reportQuery.data.summary.totalPlannedQty, 2)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cost Variance</CardTitle>
                <TrendingDown className="h-4 w-4 text-rose-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(reportQuery.data.summary.totalCostVariance)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Input {formatCurrency(reportQuery.data.summary.totalInputCost)} / Output{" "}
                  {formatCurrency(reportQuery.data.summary.totalOutputCost)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Templates</CardTitle>
                <PackageCheck className="h-4 w-4 text-cyan-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(reportQuery.data.summary.templateCount)}</div>
                <p className="text-xs text-muted-foreground">In selected period</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Warehouses</CardTitle>
                <Warehouse className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(reportQuery.data.summary.warehouseCount)}</div>
                <p className="text-xs text-muted-foreground">Participating warehouses</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>
                  {groupBy === "template" ? "Template Performance" : "Warehouse Performance"}
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{groupBy === "template" ? "Template" : "Warehouse"}</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">Yield</TableHead>
                      <TableHead className="text-right">Waste</TableHead>
                      <TableHead className="text-right">Plan</TableHead>
                      <TableHead className="text-right">Avg Cycle</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportQuery.data.data.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          No data for selected filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      reportQuery.data.data.map((row) => (
                        <TableRow key={row.key}>
                          <TableCell>
                            <div className="font-medium">
                              {row.groupType === "template"
                                ? `${row.templateCode || "--"} - ${row.templateName || "Unknown"}`
                                : `${row.warehouseCode || "--"} - ${row.warehouseName || "Unknown"}`}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatPercent(row.completionRatePct)} completed
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{formatNumber(row.orderCount)}</TableCell>
                          <TableCell className="text-right">{formatPercent(row.yieldPct)}</TableCell>
                          <TableCell className="text-right">{formatPercent(row.wasteRatePct)}</TableCell>
                          <TableCell className="text-right">{formatPercent(row.planAdherencePct)}</TableCell>
                          <TableCell className="text-right">{formatDuration(row.averageCycleSeconds)}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(row.totalCostVariance)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Waste Reasons</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {reportQuery.data.wasteReasons.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No waste reasons recorded.</div>
                ) : (
                  reportQuery.data.wasteReasons.slice(0, 10).map((r) => (
                    <div key={r.reason} className="flex items-center justify-between rounded-md border p-2">
                      <span className="text-sm">{r.reason}</span>
                      <Badge variant="secondary">{r.count}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Daily Trend</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Completion</TableHead>
                    <TableHead className="text-right">Yield</TableHead>
                    <TableHead className="text-right">Waste</TableHead>
                    <TableHead className="text-right">Avg Cycle</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
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

