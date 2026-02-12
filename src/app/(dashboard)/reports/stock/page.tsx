"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Package, Warehouse, ArrowUpDown, BarChart3 } from "lucide-react";
import { useStockMovement, useStockValuation } from "@/hooks/useStockReports";
import { useItems } from "@/hooks/useItems";
import { useWarehouses } from "@/hooks/useWarehouses";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import type { StockMovementFilters, StockValuationFilters } from "@/hooks/useStockReports";

export default function StockReportsPage() {
  type StockMovementGroupBy = NonNullable<StockMovementFilters["groupBy"]>;
  type StockValuationGroupBy = NonNullable<StockValuationFilters["groupBy"]>;

  const [activeTab, setActiveTab] = useState("movement");
  const formatPhp = (amount: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount);

  // Movement report filters
  const [movementStartDate, setMovementStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [movementEndDate, setMovementEndDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [movementWarehouseId, setMovementWarehouseId] = useState<string>("all");
  const [movementItemId, setMovementItemId] = useState<string>("all");
  const [movementGroupBy, setMovementGroupBy] = useState<StockMovementGroupBy>("item");

  // Valuation report filters
  const [valuationWarehouseId, setValuationWarehouseId] = useState<string>("all");
  const [valuationItemId, setValuationItemId] = useState<string>("all");
  const [valuationCategory, setValuationCategory] = useState<string>("all");
  const [valuationGroupBy, setValuationGroupBy] = useState<StockValuationGroupBy>("item");

  // Fetch dropdown data
  const { data: itemsData } = useItems({ limit: 1000 });
  const { data: warehousesData } = useWarehouses({ limit: 100 });

  const items = itemsData?.data || [];
  const warehouses = warehousesData?.data || [];

  // Get unique categories
  const categories = Array.from(new Set(items.map((item) => item.category).filter(Boolean)));

  // Fetch movement report
  const movementQuery = useStockMovement({
    startDate: movementStartDate,
    endDate: movementEndDate,
    warehouseId: movementWarehouseId === "all" ? undefined : movementWarehouseId,
    itemId: movementItemId === "all" ? undefined : movementItemId,
    groupBy: movementGroupBy,
  });

  // Fetch valuation report
  const valuationQuery = useStockValuation({
    warehouseId: valuationWarehouseId === "all" ? undefined : valuationWarehouseId,
    itemId: valuationItemId === "all" ? undefined : valuationItemId,
    category: valuationCategory === "all" ? undefined : valuationCategory,
    groupBy: valuationGroupBy,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Stock Reports</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Comprehensive inventory reports for movement and valuation analysis
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="movement" className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4" />
            Stock Movement
          </TabsTrigger>
          <TabsTrigger value="valuation" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Stock Valuation
          </TabsTrigger>
        </TabsList>

        {/* Stock Movement Report */}
        <TabsContent value="movement" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <Input
                    type="date"
                    value={movementStartDate}
                    onChange={(e) => setMovementStartDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">End Date</label>
                  <Input
                    type="date"
                    value={movementEndDate}
                    onChange={(e) => setMovementEndDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Group By</label>
                  <Select
                    value={movementGroupBy}
                    onValueChange={(value) => setMovementGroupBy(value as StockMovementGroupBy)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="item">By Item</SelectItem>
                      <SelectItem value="warehouse">By Warehouse</SelectItem>
                      <SelectItem value="item-warehouse">By Item & Warehouse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Warehouse</label>
                  <Select value={movementWarehouseId} onValueChange={setMovementWarehouseId}>
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
                  <Select value={movementItemId} onValueChange={setMovementItemId}>
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
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          {movementQuery.data && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total IN</CardTitle>
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      +{Math.trunc(movementQuery.data.summary.totalIn)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatPhp(movementQuery.data.summary.totalInValue)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total OUT</CardTitle>
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      -{Math.trunc(movementQuery.data.summary.totalOut)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatPhp(movementQuery.data.summary.totalOutValue)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Net Movement</CardTitle>
                    <ArrowUpDown className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div
                      className={`text-2xl font-bold ${
                        movementQuery.data.summary.netMovement > 0
                          ? "text-green-600"
                          : movementQuery.data.summary.netMovement < 0
                            ? "text-red-600"
                            : ""
                      }`}
                    >
                      {movementQuery.data.summary.netMovement > 0 ? "+" : ""}
                      {Math.trunc(movementQuery.data.summary.netMovement)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatPhp(movementQuery.data.summary.netValue)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Transactions</CardTitle>
                    <BarChart3 className="h-4 w-4 text-purple-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {movementQuery.data.summary.totalTransactions}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {movementQuery.data.summary.itemCount} items,{" "}
                      {movementQuery.data.summary.warehouseCount} warehouses
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Period Comparison */}
              {movementQuery.data.periodComparison && (
                <Card>
                  <CardHeader>
                    <CardTitle>Period Comparison</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="mb-2 text-sm font-medium">Total IN</p>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold">
                            {Math.trunc(movementQuery.data.summary.totalIn)}
                          </span>
                          <Badge
                            variant="outline"
                            className={
                              movementQuery.data.periodComparison.changes.totalInChangePercent > 0
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                                : "border-rose-500/30 bg-rose-500/10 text-rose-600"
                            }
                          >
                            {movementQuery.data.periodComparison.changes.totalInChangePercent > 0
                              ? "+"
                              : ""}
                            {movementQuery.data.periodComparison.changes.totalInChangePercent.toFixed(
                              1
                            )}
                            %
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-sm font-medium">Total OUT</p>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold">
                            {Math.trunc(movementQuery.data.summary.totalOut)}
                          </span>
                          <Badge
                            variant="outline"
                            className={
                              movementQuery.data.periodComparison.changes.totalOutChangePercent > 0
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                                : "border-rose-500/30 bg-rose-500/10 text-rose-600"
                            }
                          >
                            {movementQuery.data.periodComparison.changes.totalOutChangePercent > 0
                              ? "+"
                              : ""}
                            {movementQuery.data.periodComparison.changes.totalOutChangePercent.toFixed(
                              1
                            )}
                            %
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Movement Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Movement Details</CardTitle>
                </CardHeader>
                <CardContent>
                  {movementQuery.data.data.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      No movements found for the selected period
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {movementGroupBy !== "warehouse" && <TableHead>Item</TableHead>}
                            {movementGroupBy !== "item" && <TableHead>Warehouse</TableHead>}
                            <TableHead className="text-right">IN Qty</TableHead>
                            <TableHead className="text-right">OUT Qty</TableHead>
                            <TableHead className="text-right">Net</TableHead>
                            <TableHead className="text-right">IN Value</TableHead>
                            <TableHead className="text-right">OUT Value</TableHead>
                            <TableHead className="text-right">Net Value</TableHead>
                            <TableHead className="text-right">Transactions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {movementQuery.data.data.map((movement, index) => (
                            <TableRow key={index}>
                              {movementGroupBy !== "warehouse" && (
                                <TableCell>
                                  <div className="font-medium">{movement.itemCode}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {movement.itemName}
                                  </div>
                                </TableCell>
                              )}
                              {movementGroupBy !== "item" && (
                                <TableCell>
                                  <div className="font-medium">{movement.warehouseCode}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {movement.warehouseName}
                                  </div>
                                </TableCell>
                              )}
                              <TableCell className="text-right font-medium text-green-600">
                                +{Math.trunc(movement.totalIn)}
                              </TableCell>
                              <TableCell className="text-right font-medium text-red-600">
                                -{Math.trunc(movement.totalOut)}
                              </TableCell>
                              <TableCell
                                className={`text-right font-bold ${
                                  movement.netMovement > 0
                                    ? "text-green-600"
                                    : movement.netMovement < 0
                                      ? "text-red-600"
                                      : ""
                                }`}
                              >
                                {movement.netMovement > 0 ? "+" : ""}
                                {Math.trunc(movement.netMovement)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatPhp(movement.totalInValue)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatPhp(movement.totalOutValue)}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatPhp(movement.netValue)}
                              </TableCell>
                              <TableCell className="text-right">
                                {movement.transactionCount}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {movementQuery.isLoading && (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="py-6">
                    <Skeleton className="h-8 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Stock Valuation Report */}
        <TabsContent value="valuation" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Group By</label>
                  <Select
                    value={valuationGroupBy}
                    onValueChange={(value) => setValuationGroupBy(value as StockValuationGroupBy)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="item">By Item</SelectItem>
                      <SelectItem value="warehouse">By Warehouse</SelectItem>
                      <SelectItem value="category">By Category</SelectItem>
                      <SelectItem value="item-warehouse">By Item & Warehouse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Warehouse</label>
                  <Select value={valuationWarehouseId} onValueChange={setValuationWarehouseId}>
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
                  <Select value={valuationItemId} onValueChange={setValuationItemId}>
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
                  <label className="text-sm font-medium">Category</label>
                  <Select value={valuationCategory} onValueChange={setValuationCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          {valuationQuery.data && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Stock Value</CardTitle>
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatPhp(valuationQuery.data.summary.totalStockValue)}
                    </div>
                    <p className="text-xs text-muted-foreground">Current valuation</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Items</CardTitle>
                    <Package className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {valuationQuery.data.summary.itemCount}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {valuationQuery.data.summary.categoryCount} categories
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Warehouses</CardTitle>
                    <Warehouse className="h-4 w-4 text-purple-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {valuationQuery.data.summary.warehouseCount}
                    </div>
                    <p className="text-xs text-muted-foreground">Locations</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Average Value</CardTitle>
                    <BarChart3 className="h-4 w-4 text-orange-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatPhp(valuationQuery.data.summary.averageItemValue)}
                    </div>
                    <p className="text-xs text-muted-foreground">Per item</p>
                  </CardContent>
                </Card>
              </div>

              {/* Top Items */}
              {valuationQuery.data.topItems.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Top 10 Most Valuable Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Rank</TableHead>
                            <TableHead>Item</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead className="text-right">Avg Rate</TableHead>
                            <TableHead className="text-right">Total Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {valuationQuery.data.topItems.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-bold">{index + 1}</TableCell>
                              <TableCell>
                                <div className="font-medium">{item.itemCode}</div>
                                <div className="text-sm text-muted-foreground">{item.itemName}</div>
                              </TableCell>
                              <TableCell className="text-right">
                                {Math.trunc(item.totalQuantity)} {item.uom}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatPhp(item.averageRate)}
                              </TableCell>
                              <TableCell className="text-right font-bold">
                                {formatPhp(item.totalValue)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Category Breakdown */}
              {valuationQuery.data.categoryBreakdown.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Category Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Items</TableHead>
                            <TableHead className="text-right">Total Value</TableHead>
                            <TableHead className="text-right">% of Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {valuationQuery.data.categoryBreakdown.map((category, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{category.category}</TableCell>
                              <TableCell className="text-right">{category.itemCount}</TableCell>
                              <TableCell className="text-right font-bold">
                                {formatPhp(category.totalValue)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="outline">
                                  {Number(category.percentage ?? 0).toFixed(1)}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {valuationQuery.isLoading && (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="py-6">
                    <Skeleton className="h-8 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
