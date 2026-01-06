"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Package,
  ArrowRightLeft,
  TrendingUp,
  FileText,
  ChevronRight,
} from "lucide-react";
import { usePackageConversions } from "@/hooks/useStockReports";
import { useItems } from "@/hooks/useItems";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useCurrency } from "@/hooks/useCurrency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";

export default function PackageConversionsReportPage() {
  const { formatCurrency } = useCurrency();

  // Filters
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [warehouseId, setWarehouseId] = useState<string>("all");
  const [itemId, setItemId] = useState<string>("all");
  const [hasConversion, setHasConversion] = useState<boolean>(false);
  const [offset, setOffset] = useState<number>(0);
  const limit = 50;

  // Fetch dropdown data
  const { data: itemsData } = useItems({ limit: 1000 });
  const { data: warehousesData } = useWarehouses({ limit: 100 });

  const items = itemsData?.data || [];
  const warehouses = warehousesData?.data || [];

  // Fetch report data
  const conversionQuery = usePackageConversions({
    startDate,
    endDate,
    warehouseId: warehouseId === "all" ? undefined : warehouseId,
    itemId: itemId === "all" ? undefined : itemId,
    hasConversion: hasConversion || undefined,
    limit,
    offset,
  });

  const reportData = conversionQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Package Conversion Audit
        </h1>
        <p className="text-muted-foreground">
          Detailed audit trail of all package conversions in stock transactions
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Filter transactions by date range, warehouse, item, or conversion status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setOffset(0);
                }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setOffset(0);
                }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Warehouse</label>
              <Select
                value={warehouseId}
                onValueChange={(value) => {
                  setWarehouseId(value);
                  setOffset(0);
                }}
              >
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
              <label className="text-sm font-medium">Item</label>
              <Select
                value={itemId}
                onValueChange={(value) => {
                  setItemId(value);
                  setOffset(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Items" />
                </SelectTrigger>
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
              <label className="text-sm font-medium">Filter Options</label>
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="hasConversion"
                  checked={hasConversion}
                  onCheckedChange={(checked) => {
                    setHasConversion(checked === true);
                    setOffset(0);
                  }}
                />
                <label
                  htmlFor="hasConversion"
                  className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Only show transactions with package conversions
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {conversionQuery.isLoading && (
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {reportData && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Transactions
                </CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {reportData.summary.totalTransactions.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  In selected period
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  With Package Conversion
                </CardTitle>
                <ArrowRightLeft className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {reportData.summary.transactionsWithConversion.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {reportData.summary.totalTransactions > 0
                    ? (
                        (reportData.summary.transactionsWithConversion /
                          reportData.summary.totalTransactions) *
                        100
                      ).toFixed(1)
                    : 0}
                  % of total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Base Package Only
                </CardTitle>
                <Package className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {reportData.summary.transactionsWithBasePackage.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {reportData.summary.totalTransactions > 0
                    ? (
                        (reportData.summary.transactionsWithBasePackage /
                          reportData.summary.totalTransactions) *
                        100
                      ).toFixed(1)
                    : 0}
                  % of total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Avg Conversion Factor
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {reportData.summary.averageConversionFactor.toFixed(2)}x
                </div>
                <p className="text-xs text-muted-foreground">
                  {reportData.summary.packageTypesUsed.length} package types used
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Package Type Breakdown */}
          {reportData.packageBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Package Type Breakdown</CardTitle>
                <CardDescription>
                  Summary of conversions by package type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Package Type</TableHead>
                      <TableHead className="text-right">Transactions</TableHead>
                      <TableHead className="text-right">Total Input Qty</TableHead>
                      <TableHead className="text-right">Total Normalized Qty</TableHead>
                      <TableHead className="text-right">Avg Conversion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.packageBreakdown.map((breakdown) => (
                      <TableRow key={breakdown.packType}>
                        <TableCell>
                          <Badge variant="outline">{breakdown.packType}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {breakdown.count.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {breakdown.totalInputQty.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {breakdown.totalNormalizedQty.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {breakdown.averageConversionFactor.toFixed(2)}x
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Transaction Details */}
          <Card>
            <CardHeader>
              <CardTitle>Transaction Details</CardTitle>
              <CardDescription>
                Detailed audit trail showing input quantities, packages, and conversions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Transaction</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead className="text-right">Input Qty</TableHead>
                      <TableHead>Input Package</TableHead>
                      <TableHead className="text-center">Conversion</TableHead>
                      <TableHead className="text-right">Normalized Qty</TableHead>
                      <TableHead>Base Package</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.data.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                          No transactions found for the selected filters
                        </TableCell>
                      </TableRow>
                    )}
                    {reportData.data.map((txn) => (
                      <TableRow key={txn.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(txn.postingDate), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-sm">
                              {txn.transactionCode}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {txn.transactionType}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-sm">
                              {txn.item.code}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {txn.item.name}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {txn.warehouse.code}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {txn.inputQty.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {txn.inputPackage ? (
                            <div>
                              <div className="text-sm font-medium">
                                {txn.inputPackage.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ({txn.inputPackage.qtyPerPack.toFixed(2)} units)
                              </div>
                            </div>
                          ) : (
                            <Badge variant="secondary">Base</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {txn.usedConversion ? (
                            <div className="flex items-center justify-center gap-1 text-sm">
                              <span className="font-medium text-blue-600">
                                {txn.conversionFactor.toFixed(2)}x
                              </span>
                              <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">1.00x</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {txn.normalizedQty.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {txn.basePackage && (
                            <div className="text-sm">
                              {txn.basePackage.name}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(txn.totalAmount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {reportData.pagination && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {offset + 1} to {Math.min(offset + limit, reportData.pagination.total)} of{" "}
                    {reportData.pagination.total.toLocaleString()} transactions
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOffset(Math.max(0, offset - limit))}
                      disabled={offset === 0}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOffset(offset + limit)}
                      disabled={!reportData.pagination.hasMore}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {conversionQuery.isError && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              Failed to load package conversion report. Please try again.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
