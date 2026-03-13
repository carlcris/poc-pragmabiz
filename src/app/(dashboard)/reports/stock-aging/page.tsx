"use client";

import { Fragment, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Clock3, Download, Package, PhilippinePeso, RefreshCw } from "lucide-react";
import {
  useStockAgingReport,
  type StockAgingAgeBucket,
  type StockAgingReportRow,
} from "@/hooks/useStockAgingReport";
import { useItemCategories } from "@/hooks/useItemCategories";
import { MetricCard } from "@/components/shared/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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

export default function StockAgingReportPage() {
  const t = useTranslations("stockAgingReportPage");
  const locale = useLocale();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [ageBucket, setAgeBucket] = useState<StockAgingAgeBucket>("90_plus");
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const { data: categoriesData } = useItemCategories();
  const categories = categoriesData?.data || [];

  const reportQuery = useStockAgingReport({
    page,
    limit,
    search: search || undefined,
    category: category === "all" ? undefined : category,
    ageBucket,
  });

  const groupedRows = (reportQuery.data?.data || []).reduce<
    Array<{
      itemId: string;
      itemName: string;
      itemCode: string | null;
      itemSku: string | null;
      category: string;
      rows: StockAgingReportRow[];
      subtotalQtyOnHand: number;
      subtotalQtyReserved: number;
      subtotalQtyAvailable: number;
      subtotalStockValue: number;
      oldestAgeDays: number;
    }>
  >((groups, row) => {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.itemId === row.itemId) {
      lastGroup.rows.push(row);
      lastGroup.subtotalQtyOnHand += row.qtyOnHand;
      lastGroup.subtotalQtyReserved += row.qtyReserved;
      lastGroup.subtotalQtyAvailable += row.qtyAvailable;
      lastGroup.subtotalStockValue += row.stockValue;
      lastGroup.oldestAgeDays = Math.max(lastGroup.oldestAgeDays, row.batchAgeDays);
      return groups;
    }

    groups.push({
      itemId: row.itemId,
      itemName: row.itemName || row.itemCode || row.itemId,
      itemCode: row.itemCode,
      itemSku: row.itemSku,
      category: row.category,
      rows: [row],
      subtotalQtyOnHand: row.qtyOnHand,
      subtotalQtyReserved: row.qtyReserved,
      subtotalQtyAvailable: row.qtyAvailable,
      subtotalStockValue: row.stockValue,
      oldestAgeDays: row.batchAgeDays,
    });

    return groups;
  }, []);

  const formatNumber = (value: number, digits = 0) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(Number.isFinite(value) ? value : 0);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "PHP" }).format(
      Number.isFinite(value) ? value : 0
    );

  const formatDateTime = (value: string | null) =>
    value ? new Date(value).toLocaleString(locale) : t("noValue");

  const getAgeBucketLabel = (bucket: Exclude<StockAgingAgeBucket, "all">) => {
    if (bucket === "0_30") return t("bucket0to30");
    if (bucket === "31_60") return t("bucket31to60");
    if (bucket === "61_90") return t("bucket61to90");
    if (bucket === "91_180") return t("bucket91to180");
    return t("bucket181Plus");
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  const handleReset = () => {
    setPage(1);
    setLimit(25);
    setSearchInput("");
    setSearch("");
    setCategory("all");
    setAgeBucket("90_plus");
  };

  const handleExportPdf = async () => {
    if (!reportQuery.data || groupedRows.length === 0) {
      return;
    }

    try {
      setIsExportingPdf(true);
      const [{ pdf }, { StockAgingReportPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/reports/StockAgingReportPDF"),
      ]);

      const blob = await pdf(
        <StockAgingReportPDF
          title={t("title")}
          subtitle={t("subtitle")}
          generatedAtLabel={t("generatedAt")}
          warehouseLocationLabel={t("warehouseLocation")}
          batchLabel={t("batch")}
          ageDaysLabel={t("ageDays")}
          qtyOnHandLabel={t("qtyOnHand")}
          qtyReservedLabel={t("qtyReserved")}
          qtyAvailableLabel={t("qtyAvailable")}
          stockValueLabel={t("stockValue")}
          updatedAtLabel={t("updatedAt")}
          itemSubtotalLabel={t("itemSubtotal")}
          noValueLabel={t("noValue")}
          groups={groupedRows}
          currentPage={reportQuery.data.pagination.page}
          totalPages={reportQuery.data.pagination.totalPages}
          totalRows={reportQuery.data.pagination.total}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const fileSuffix = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `stock-aging-report-${fileSuffix}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{t("title")}</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">{t("subtitle")}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("reset")}
          </Button>
          <Button
            variant="outline"
            onClick={handleExportPdf}
            disabled={isExportingPdf || reportQuery.isLoading || !reportQuery.data || groupedRows.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            {isExportingPdf ? t("exportingPdf") : t("exportPdf")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title={t("agingRows")}
          icon={Package}
          iconClassName="h-4 w-4 text-blue-600"
          value={reportQuery.data ? formatNumber(reportQuery.data.summary.rowCount) : undefined}
          caption={t("agingRowsDescription")}
          isLoading={reportQuery.isLoading}
        />
        <MetricCard
          title={t("qtyOnHand")}
          icon={Package}
          iconClassName="h-4 w-4 text-green-600"
          value={
            reportQuery.data ? formatNumber(reportQuery.data.summary.totalQtyOnHand, 2) : undefined
          }
          caption={t("qtyOnHandDescription")}
          isLoading={reportQuery.isLoading}
        />
        <MetricCard
          title={t("stockValue")}
          icon={PhilippinePeso}
          iconClassName="h-4 w-4 text-amber-600"
          value={
            reportQuery.data ? formatCurrency(reportQuery.data.summary.totalStockValue) : undefined
          }
          caption={t("stockValueDescription")}
          isLoading={reportQuery.isLoading}
        />
        <MetricCard
          title={t("oldestStock")}
          icon={Clock3}
          iconClassName="h-4 w-4 text-rose-600"
          value={
            reportQuery.data
              ? t("daysValue", { value: formatNumber(reportQuery.data.summary.oldestAgeDays) })
              : undefined
          }
          caption={t("currentBusinessUnitScope")}
          isLoading={reportQuery.isLoading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("filters")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("itemSearch")}</label>
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t("searchPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("category")}</label>
              <Select
                value={category}
                onValueChange={(value) => {
                  setCategory(value);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("allCategories")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allCategories")}</SelectItem>
                  {categories.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("ageBucket")}</label>
              <Select
                value={ageBucket}
                onValueChange={(value) => {
                  setAgeBucket(value as StockAgingAgeBucket);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="90_plus">{t("bucket90Plus")}</SelectItem>
                  <SelectItem value="all">{t("allAges")}</SelectItem>
                  <SelectItem value="0_30">{t("bucket0to30")}</SelectItem>
                  <SelectItem value="31_60">{t("bucket31to60")}</SelectItem>
                  <SelectItem value="61_90">{t("bucket61to90")}</SelectItem>
                  <SelectItem value="91_180">{t("bucket91to180")}</SelectItem>
                  <SelectItem value="181_plus">{t("bucket181Plus")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("rowsPerPage")}</label>
              <Select
                value={String(limit)}
                onValueChange={(value) => {
                  setLimit(Number(value));
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("agingDetails")}</CardTitle>
        </CardHeader>
        <CardContent className="max-h-[70vh] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-20 bg-background shadow-sm [&_th]:bg-background">
              <TableRow>
                <TableHead>{t("warehouseLocation")}</TableHead>
                <TableHead>{t("batch")}</TableHead>
                <TableHead className="text-right">{t("ageDays")}</TableHead>
                <TableHead>{t("ageBucket")}</TableHead>
                <TableHead className="text-right">{t("qtyOnHand")}</TableHead>
                <TableHead className="text-right">{t("qtyReserved")}</TableHead>
                <TableHead className="text-right">{t("qtyAvailable")}</TableHead>
                <TableHead className="text-right">{t("stockValue")}</TableHead>
                <TableHead>{t("updatedAt")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportQuery.isLoading ? (
                [...Array(3)].map((_, groupIndex) => (
                  <Fragment key={`skeleton-group-${groupIndex}`}>
                    <TableRow className="sticky top-10 z-10 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/90">
                      <TableCell colSpan={9} className="min-w-[240px]">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="mt-2 h-4 w-64" />
                      </TableCell>
                    </TableRow>
                    {[...Array(2)].map((__, rowIndex) => (
                      <TableRow key={`skeleton-row-${groupIndex}-${rowIndex}`}>
                        <TableCell className="min-w-[220px]">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="mt-2 h-4 w-36" />
                        </TableCell>
                        <TableCell className="min-w-[200px]">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="mt-2 h-4 w-32" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Skeleton className="ml-auto h-4 w-12" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-20 rounded-full" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Skeleton className="ml-auto h-4 w-14" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Skeleton className="ml-auto h-4 w-14" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Skeleton className="ml-auto h-4 w-14" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Skeleton className="ml-auto h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30">
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="ml-auto h-4 w-8" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-8" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="ml-auto h-4 w-14" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="ml-auto h-4 w-14" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="ml-auto h-4 w-14" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="ml-auto h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                    </TableRow>
                  </Fragment>
                ))
              ) : reportQuery.isError ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    {t("loadError")}
                  </TableCell>
                </TableRow>
              ) : groupedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    {t("noRows")}
                  </TableCell>
                </TableRow>
              ) : (
                groupedRows.map((group) => (
                  <Fragment key={`group-${group.itemId}`}>
                    <TableRow className="sticky top-10 z-10 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/90">
                      <TableCell colSpan={9} className="min-w-[240px]">
                        <div className="font-medium">{group.itemName}</div>
                        <div className="text-xs text-muted-foreground">
                          {group.itemCode || t("noValue")}
                          {group.itemSku ? ` • ${group.itemSku}` : ""}
                          {group.category ? ` • ${group.category}` : ""}
                        </div>
                      </TableCell>
                    </TableRow>
                    {group.rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="min-w-[220px]">
                          <div className="font-medium">
                            {row.warehouseCode || t("noValue")} - {row.warehouseName || t("unknown")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.locationCode || t("noValue")} - {row.locationName || t("unknown")}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[200px]">
                          <div className="font-mono text-xs">{row.batchCode || t("noValue")}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDateTime(row.batchReceivedAt)}
                          </div>
                          {row.batchLocationSku && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {t("locationSku")}: <span className="font-mono">{row.batchLocationSku}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(row.batchAgeDays)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getAgeBucketLabel(row.ageBucket)}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(row.qtyOnHand, 2)}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.qtyReserved, 2)}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.qtyAvailable, 2)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(row.stockValue)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(row.updatedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30">
                      <TableCell className="font-medium text-muted-foreground">
                        {t("itemSubtotal")}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {t("oldestStockForItem", {
                          value: formatNumber(group.oldestAgeDays),
                        })}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                      <TableCell className="text-muted-foreground">-</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(group.subtotalQtyOnHand, 2)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(group.subtotalQtyReserved, 2)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(group.subtotalQtyAvailable, 2)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(group.subtotalStockValue)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {t("batchesCount", { count: formatNumber(group.rows.length) })}
                      </TableCell>
                    </TableRow>
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>

          <div className="mt-4 flex items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">
              {reportQuery.data
                ? t("pageOfTotal", {
                    page: formatNumber(reportQuery.data.pagination.page),
                    totalPages: formatNumber(reportQuery.data.pagination.totalPages),
                    total: formatNumber(reportQuery.data.pagination.total),
                  })
                : t("pageOfTotal", {
                    page: formatNumber(page),
                    totalPages: "1",
                    total: "0",
                  })}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={reportQuery.isLoading || page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                {t("previous")}
              </Button>
              <Badge variant="secondary">{page}</Badge>
              <Button
                variant="outline"
                size="sm"
                disabled={
                  reportQuery.isLoading ||
                  !reportQuery.data ||
                  page >= reportQuery.data.pagination.totalPages
                }
                onClick={() => setPage((value) => value + 1)}
              >
                {t("next")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
