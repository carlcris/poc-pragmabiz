"use client";

import { useState } from "react";
import { Boxes, Layers, MapPin, Package, RefreshCw } from "lucide-react";
import { useItemLocationBatchReport } from "@/hooks/useItemLocationBatchReport";
import { useItems } from "@/hooks/useItems";
import { useWarehouses } from "@/hooks/useWarehouses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const formatNumber = (value: number, digits = 0) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);

const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "--";

export default function ItemLocationBatchReportPage() {
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
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight">
          Item Location (Location + Batch) Report
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          View stock balances at exact warehouse location and batch level, including location batch SKU.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Warehouse</label>
              <Select
                value={warehouseId}
                onValueChange={(v) => {
                  setWarehouseId(v);
                  setPage(1);
                }}
              >
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
              <label className="text-sm font-medium">Item</label>
              <Select
                value={itemId}
                onValueChange={(v) => {
                  setItemId(v);
                  setPage(1);
                }}
              >
                <SelectTrigger><SelectValue placeholder="All Items" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.code} - {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Stock Status</label>
              <Select
                value={stockStatus}
                onValueChange={(v) => {
                  setStockStatus(v as typeof stockStatus);
                  setPage(1);
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="available_only">Available Only</SelectItem>
                  <SelectItem value="reserved">Reserved &gt; 0</SelectItem>
                  <SelectItem value="zero">Zero On Hand</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Sort By</label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated_at">Updated At</SelectItem>
                  <SelectItem value="qty_on_hand">Qty On Hand</SelectItem>
                  <SelectItem value="received_at">Batch Received At</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Sort Order</label>
              <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as typeof sortOrder)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Descending</SelectItem>
                  <SelectItem value="asc">Ascending</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Rows / Page</label>
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
              placeholder="Search item, SKU, batch code, location, or location batch SKU..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onApplySearch();
                }
              }}
            />
            <Button onClick={onApplySearch}>Search</Button>
            <Button
              variant="outline"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setPage(1);
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {reportQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : reportQuery.isError || !reportQuery.data ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Failed to load item location batch report.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Rows</CardTitle>
                <Layers className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(reportQuery.data.summary.totalRows)}</div>
                <p className="text-xs text-muted-foreground">
                  Showing {formatNumber(reportQuery.data.summary.rowCount)} rows
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Qty On Hand</CardTitle>
                <Package className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(reportQuery.data.summary.totalQtyOnHand, 2)}</div>
                <p className="text-xs text-muted-foreground">Current page total</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Reserved</CardTitle>
                <Boxes className="h-4 w-4 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(reportQuery.data.summary.totalQtyReserved, 2)}</div>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(reportQuery.data.summary.rowsWithReserved)} rows with reserved qty
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Available</CardTitle>
                <Package className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(reportQuery.data.summary.totalQtyAvailable, 2)}</div>
                <p className="text-xs text-muted-foreground">Current page total</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Dimensions</CardTitle>
                <MapPin className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-sm font-semibold">
                  {formatNumber(reportQuery.data.summary.uniqueItems)} items •{" "}
                  {formatNumber(reportQuery.data.summary.uniqueLocations)} locations
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(reportQuery.data.summary.uniqueBatches)} batches (page)
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Location + Batch Stock Rows</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Warehouse / Location</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Location SKU</TableHead>
                    <TableHead className="text-right">On Hand</TableHead>
                    <TableHead className="text-right">Reserved</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportQuery.data.data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No rows found for selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reportQuery.data.data.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="min-w-[240px]">
                          <div className="font-medium">{row.itemName || row.itemCode || row.itemId}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.itemCode || "--"} {row.itemSku ? `• ${row.itemSku}` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[220px]">
                          <div className="font-medium">
                            {row.warehouseCode || "--"} - {row.warehouseName || "Unknown"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.locationCode || "--"} - {row.locationName || "Unknown"}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          <div className="font-mono text-xs">{row.batchCode || "--"}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.batchReceivedAt ? `${row.batchAgeDays ?? 0}d old` : "--"}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.batchLocationSku || "--"}
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
                  Page {reportQuery.data.pagination.page} of {reportQuery.data.pagination.totalPages} •{" "}
                  {formatNumber(reportQuery.data.pagination.total)} total rows
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Badge variant="secondary">{page}</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= reportQuery.data.pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
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

