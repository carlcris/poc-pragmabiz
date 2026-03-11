"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Boxes, Layers, MapPin, Package, RefreshCw } from "lucide-react";
import { useItemLocationBatchReport } from "@/hooks/useItemLocationBatchReport";
import { useItems } from "@/hooks/useItems";
import { useWarehouses } from "@/hooks/useWarehouses";
import { MetricCard } from "@/components/shared/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

export default function ItemLocationBatchReportPage() {
  const t = useTranslations("itemLocationBatchReportPage");
  const locale = useLocale();

  const formatNumber = (value: number, digits = 0) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(Number.isFinite(value) ? value : 0);

  const formatDateTime = (value: string | null) =>
    value ? new Date(value).toLocaleString(locale) : t("noValue");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [warehouseId, setWarehouseId] = useState("all");
  const [itemId, setItemId] = useState("all");
  const [stockStatus, setStockStatus] = useState<"all" | "zero" | "available_only" | "reserved">("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"updated_at" | "qty_on_hand" | "received_at">("updated_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const reportQuery = useItemLocationBatchReport({
    page,
    limit,
    warehouseId: warehouseId === "all" ? undefined : warehouseId,
    itemId: itemId === "all" ? undefined : itemId,
    stockStatus,
    search: search || undefined,
    sortBy,
    sortOrder,
  });
  const { data: itemsData } = useItems({ limit: 50 });
  const { data: warehousesData } = useWarehouses({ limit: 50 });

  const items = itemsData?.data || [];
  const warehouses = warehousesData?.data || [];

  const onApplySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("warehouse")}</label>
              <Select
                value={warehouseId}
                onValueChange={(v) => {
                  setWarehouseId(v);
                  setPage(1);
                }}
              >
                <SelectTrigger><SelectValue placeholder={t("allWarehouses")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allWarehouses")}</SelectItem>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>
                      {wh.code} - {wh.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("item")}</label>
              <Select
                value={itemId}
                onValueChange={(v) => {
                  setItemId(v);
                  setPage(1);
                }}
              >
                <SelectTrigger><SelectValue placeholder={t("allItems")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allItems")}</SelectItem>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.code} - {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("stockStatus")}</label>
              <Select
                value={stockStatus}
                onValueChange={(v) => {
                  setStockStatus(v as typeof stockStatus);
                  setPage(1);
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all")}</SelectItem>
                  <SelectItem value="available_only">{t("availableOnly")}</SelectItem>
                  <SelectItem value="reserved">{t("reservedGtZero")}</SelectItem>
                  <SelectItem value="zero">{t("zeroOnHand")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("sortBy")}</label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated_at">{t("updatedAt")}</SelectItem>
                  <SelectItem value="qty_on_hand">{t("qtyOnHand")}</SelectItem>
                  <SelectItem value="received_at">{t("receivedAt")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("sortOrder")}</label>
              <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as typeof sortOrder)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">{t("descending")}</SelectItem>
                  <SelectItem value="asc">{t("ascending")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("rowsPerPage")}</label>
              <Select
                value={String(limit)}
                onValueChange={(v) => {
                  setLimit(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("searchPlaceholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onApplySearch();
                }
              }}
            />
            <Button onClick={onApplySearch}>{t("search")}</Button>
            <Button
              variant="outline"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setPage(1);
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("reset")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          title={t("rows")}
          icon={Layers}
          iconClassName="h-4 w-4 text-blue-600"
          value={reportQuery.data ? formatNumber(reportQuery.data.summary.totalRows) : undefined}
          caption={
            reportQuery.data
              ? t("showingRows", {
                  count: formatNumber(reportQuery.data.summary.rowCount),
                })
              : undefined
          }
          isLoading={reportQuery.isLoading}
          skeletonCaption
        />
        <MetricCard
          title={t("qtyOnHand")}
          icon={Package}
          iconClassName="h-4 w-4 text-green-600"
          value={
            reportQuery.data
              ? formatNumber(reportQuery.data.summary.totalQtyOnHand, 2)
              : undefined
          }
          caption={t("currentPageTotal")}
          isLoading={reportQuery.isLoading}
        />
        <MetricCard
          title={t("reserved")}
          icon={Boxes}
          iconClassName="h-4 w-4 text-amber-600"
          value={
            reportQuery.data
              ? formatNumber(reportQuery.data.summary.totalQtyReserved, 2)
              : undefined
          }
          caption={
            reportQuery.data
              ? t("rowsWithReservedQty", {
                  count: formatNumber(reportQuery.data.summary.rowsWithReserved),
                })
              : undefined
          }
          isLoading={reportQuery.isLoading}
          skeletonCaption
        />
        <MetricCard
          title={t("available")}
          icon={Package}
          iconClassName="h-4 w-4 text-emerald-600"
          value={
            reportQuery.data
              ? formatNumber(reportQuery.data.summary.totalQtyAvailable, 2)
              : undefined
          }
          caption={t("currentPageTotal")}
          isLoading={reportQuery.isLoading}
        />
        <MetricCard
          title={t("dimensions")}
          icon={MapPin}
          iconClassName="h-4 w-4 text-purple-600"
          value={
            reportQuery.data
              ? t("dimensionsDesc", {
                  items: formatNumber(reportQuery.data.summary.uniqueItems),
                  locations: formatNumber(reportQuery.data.summary.uniqueLocations),
                })
              : undefined
          }
          caption={
            reportQuery.data
              ? t("batchesPage", {
                  count: formatNumber(reportQuery.data.summary.uniqueBatches),
                })
              : undefined
          }
          valueClassName="text-sm font-semibold"
          isLoading={reportQuery.isLoading}
          skeletonCaption
        />
      </div>

      {reportQuery.isError || !reportQuery.data ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("loadError")}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("locationBatchStockRows")}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("item")}</TableHead>
                    <TableHead>{t("warehouseLocation")}</TableHead>
                    <TableHead>{t("batch")}</TableHead>
                    <TableHead>{t("locationSku")}</TableHead>
                    <TableHead className="text-right">{t("onHand")}</TableHead>
                    <TableHead className="text-right">{t("reserved")}</TableHead>
                    <TableHead className="text-right">{t("available")}</TableHead>
                    <TableHead>{t("updated")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportQuery.data.data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        {t("noRows")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    reportQuery.data.data.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="min-w-[240px]">
                          <div className="font-medium">{row.itemName || row.itemCode || row.itemId}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.itemCode || t("noValue")} {row.itemSku ? `• ${row.itemSku}` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[220px]">
                          <div className="font-medium">
                            {row.warehouseCode || t("noValue")} - {row.warehouseName || t("unknown")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.locationCode || t("noValue")} - {row.locationName || t("unknown")}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          <div className="font-mono text-xs">{row.batchCode || t("noValue")}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.batchReceivedAt
                              ? t("oldDays", { count: formatNumber(row.batchAgeDays ?? 0) })
                              : t("noValue")}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.batchLocationSku || t("noValue")}
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(row.qtyOnHand, 2)}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.qtyReserved, 2)}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.qtyAvailable, 2)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(row.updatedAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="text-sm text-muted-foreground">
                  {t("pageOfTotal", {
                    page: formatNumber(reportQuery.data.pagination.page),
                    totalPages: formatNumber(reportQuery.data.pagination.totalPages),
                    total: formatNumber(reportQuery.data.pagination.total),
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    {t("previous")}
                  </Button>
                  <Badge variant="secondary">{page}</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= reportQuery.data.pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {t("next")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
