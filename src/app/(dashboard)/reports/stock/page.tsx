"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { TrendingUp, TrendingDown, Package, Warehouse, ArrowUpDown, BarChart3, DollarSign } from "lucide-react";
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
  const t = useTranslations("stockReportsPage");
  const locale = useLocale();
  type StockMovementGroupBy = NonNullable<StockMovementFilters["groupBy"]>;
  type StockValuationGroupBy = NonNullable<StockValuationFilters["groupBy"]>;

  const [activeTab, setActiveTab] = useState("movement");
  const formatPhp = (amount: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "PHP" }).format(amount);

  const [movementStartDate, setMovementStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [movementEndDate, setMovementEndDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [movementWarehouseId, setMovementWarehouseId] = useState<string>("all");
  const [movementItemId, setMovementItemId] = useState<string>("all");
  const [movementGroupBy, setMovementGroupBy] = useState<StockMovementGroupBy>("item");

  const [valuationWarehouseId, setValuationWarehouseId] = useState<string>("all");
  const [valuationItemId, setValuationItemId] = useState<string>("all");
  const [valuationCategory, setValuationCategory] = useState<string>("all");
  const [valuationGroupBy, setValuationGroupBy] = useState<StockValuationGroupBy>("item");

  const { data: itemsData } = useItems({ limit: 50 });
  const { data: warehousesData } = useWarehouses({ limit: 100 });

  const items = itemsData?.data || [];
  const warehouses = warehousesData?.data || [];
  const categories = Array.from(new Set(items.map((item) => item.category).filter(Boolean)));

  const movementQuery = useStockMovement({
    startDate: movementStartDate,
    endDate: movementEndDate,
    warehouseId: movementWarehouseId === "all" ? undefined : movementWarehouseId,
    itemId: movementItemId === "all" ? undefined : movementItemId,
    groupBy: movementGroupBy,
  });

  const valuationQuery = useStockValuation({
    warehouseId: valuationWarehouseId === "all" ? undefined : valuationWarehouseId,
    itemId: valuationItemId === "all" ? undefined : valuationItemId,
    category: valuationCategory === "all" ? undefined : valuationCategory,
    groupBy: valuationGroupBy,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{t("title")}</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">{t("subtitle")}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="movement" className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4" />
            {t("movementTab")}
          </TabsTrigger>
          <TabsTrigger value="valuation" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {t("valuationTab")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="movement" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("filters")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("startDate")}</label>
                  <Input type="date" value={movementStartDate} onChange={(e) => setMovementStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("endDate")}</label>
                  <Input type="date" value={movementEndDate} onChange={(e) => setMovementEndDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("groupBy")}</label>
                  <Select value={movementGroupBy} onValueChange={(value) => setMovementGroupBy(value as StockMovementGroupBy)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="item">{t("byItem")}</SelectItem>
                      <SelectItem value="warehouse">{t("byWarehouse")}</SelectItem>
                      <SelectItem value="item-warehouse">{t("byItemWarehouse")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("warehouse")}</label>
                  <Select value={movementWarehouseId} onValueChange={setMovementWarehouseId}>
                    <SelectTrigger><SelectValue placeholder={t("allWarehouses")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("allWarehouses")}</SelectItem>
                      {warehouses.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.code} - {warehouse.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("item")}</label>
                  <Select value={movementItemId} onValueChange={setMovementItemId}>
                    <SelectTrigger><SelectValue placeholder={t("allItems")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("allItems")}</SelectItem>
                      {items.map((item) => (
                        <SelectItem key={item.id} value={item.id}>{item.code} - {item.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {movementQuery.data && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{t("totalIn")}</CardTitle><TrendingUp className="h-4 w-4 text-green-600" /></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">+{Math.trunc(movementQuery.data.summary.totalIn)}</div><p className="text-xs text-muted-foreground">{formatPhp(movementQuery.data.summary.totalInValue)}</p></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{t("totalOut")}</CardTitle><TrendingDown className="h-4 w-4 text-red-600" /></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">-{Math.trunc(movementQuery.data.summary.totalOut)}</div><p className="text-xs text-muted-foreground">{formatPhp(movementQuery.data.summary.totalOutValue)}</p></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{t("netMovement")}</CardTitle><ArrowUpDown className="h-4 w-4 text-blue-600" /></CardHeader><CardContent><div className={`text-2xl font-bold ${movementQuery.data.summary.netMovement > 0 ? "text-green-600" : movementQuery.data.summary.netMovement < 0 ? "text-red-600" : ""}`}>{movementQuery.data.summary.netMovement > 0 ? "+" : ""}{Math.trunc(movementQuery.data.summary.netMovement)}</div><p className="text-xs text-muted-foreground">{formatPhp(movementQuery.data.summary.netValue)}</p></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{t("transactions")}</CardTitle><BarChart3 className="h-4 w-4 text-purple-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{movementQuery.data.summary.totalTransactions}</div><p className="text-xs text-muted-foreground">{movementQuery.data.summary.itemCount} {t("items")}, {movementQuery.data.summary.warehouseCount} {t("warehouses")}</p></CardContent></Card>
              </div>

              {movementQuery.data.periodComparison && (
                <Card>
                  <CardHeader><CardTitle>{t("periodComparison")}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="mb-2 text-sm font-medium">{t("totalIn")}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold">{Math.trunc(movementQuery.data.summary.totalIn)}</span>
                          <Badge variant="outline" className={movementQuery.data.periodComparison.changes.totalInChangePercent > 0 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-rose-500/30 bg-rose-500/10 text-rose-600"}>{movementQuery.data.periodComparison.changes.totalInChangePercent > 0 ? "+" : ""}{movementQuery.data.periodComparison.changes.totalInChangePercent.toFixed(1)}%</Badge>
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-sm font-medium">{t("totalOut")}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold">{Math.trunc(movementQuery.data.summary.totalOut)}</span>
                          <Badge variant="outline" className={movementQuery.data.periodComparison.changes.totalOutChangePercent > 0 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-rose-500/30 bg-rose-500/10 text-rose-600"}>{movementQuery.data.periodComparison.changes.totalOutChangePercent > 0 ? "+" : ""}{movementQuery.data.periodComparison.changes.totalOutChangePercent.toFixed(1)}%</Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader><CardTitle>{t("movementDetails")}</CardTitle></CardHeader>
                <CardContent>
                  {movementQuery.data.data.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">{t("noMovements")}</div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader><TableRow>{movementGroupBy !== "warehouse" && <TableHead>{t("item")}</TableHead>}{movementGroupBy !== "item" && <TableHead>{t("warehouse")}</TableHead>}<TableHead className="text-right">{t("inQty")}</TableHead><TableHead className="text-right">{t("outQty")}</TableHead><TableHead className="text-right">{t("net")}</TableHead><TableHead className="text-right">{t("inValue")}</TableHead><TableHead className="text-right">{t("outValue")}</TableHead><TableHead className="text-right">{t("netValue")}</TableHead><TableHead className="text-right">{t("transactions")}</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {movementQuery.data.data.map((movement, index) => (
                            <TableRow key={index}>
                              {movementGroupBy !== "warehouse" && <TableCell><div className="font-medium">{movement.itemCode}</div><div className="text-sm text-muted-foreground">{movement.itemName}</div></TableCell>}
                              {movementGroupBy !== "item" && <TableCell><div className="font-medium">{movement.warehouseCode}</div><div className="text-sm text-muted-foreground">{movement.warehouseName}</div></TableCell>}
                              <TableCell className="text-right font-medium text-green-600">+{Math.trunc(movement.totalIn)}</TableCell>
                              <TableCell className="text-right font-medium text-red-600">-{Math.trunc(movement.totalOut)}</TableCell>
                              <TableCell className={`text-right font-bold ${movement.netMovement > 0 ? "text-green-600" : movement.netMovement < 0 ? "text-red-600" : ""}`}>{movement.netMovement > 0 ? "+" : ""}{Math.trunc(movement.netMovement)}</TableCell>
                              <TableCell className="text-right">{formatPhp(movement.totalInValue)}</TableCell>
                              <TableCell className="text-right">{formatPhp(movement.totalOutValue)}</TableCell>
                              <TableCell className="text-right font-medium">{formatPhp(movement.netValue)}</TableCell>
                              <TableCell className="text-right">{movement.transactionCount}</TableCell>
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

          {movementQuery.isLoading && <div className="space-y-4">{[1,2,3,4].map((i) => <Card key={i}><CardContent className="py-6"><Skeleton className="h-8 w-full" /></CardContent></Card>)}</div>}
          {movementQuery.isError && !movementQuery.data && <Card><CardContent className="py-8 text-center text-muted-foreground">{t("loadError")}</CardContent></Card>}
        </TabsContent>

        <TabsContent value="valuation" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>{t("filters")}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2"><label className="text-sm font-medium">{t("groupBy")}</label><Select value={valuationGroupBy} onValueChange={(value) => setValuationGroupBy(value as StockValuationGroupBy)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="item">{t("byItem")}</SelectItem><SelectItem value="warehouse">{t("byWarehouse")}</SelectItem><SelectItem value="category">{t("byCategory")}</SelectItem><SelectItem value="item-warehouse">{t("byItemWarehouse")}</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><label className="text-sm font-medium">{t("warehouse")}</label><Select value={valuationWarehouseId} onValueChange={setValuationWarehouseId}><SelectTrigger><SelectValue placeholder={t("allWarehouses")} /></SelectTrigger><SelectContent><SelectItem value="all">{t("allWarehouses")}</SelectItem>{warehouses.map((warehouse) => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.code} - {warehouse.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><label className="text-sm font-medium">{t("item")}</label><Select value={valuationItemId} onValueChange={setValuationItemId}><SelectTrigger><SelectValue placeholder={t("allItems")} /></SelectTrigger><SelectContent><SelectItem value="all">{t("allItems")}</SelectItem>{items.map((item) => <SelectItem key={item.id} value={item.id}>{item.code} - {item.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><label className="text-sm font-medium">{t("category")}</label><Select value={valuationCategory} onValueChange={setValuationCategory}><SelectTrigger><SelectValue placeholder={t("allCategories")} /></SelectTrigger><SelectContent><SelectItem value="all">{t("allCategories")}</SelectItem>{categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div>
              </div>
            </CardContent>
          </Card>

          {valuationQuery.data && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{t("totalStockValue")}</CardTitle><TrendingUp className="h-4 w-4 text-green-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatPhp(valuationQuery.data.summary.totalStockValue)}</div><p className="text-xs text-muted-foreground">{t("currentValuation")}</p></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{t("totalQtyOnHand")}</CardTitle><Package className="h-4 w-4 text-blue-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{Math.trunc(valuationQuery.data.summary.totalQuantity)}</div><p className="text-xs text-muted-foreground">{valuationQuery.data.summary.itemCount} {t("items")}</p></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{t("avgUnitCost")}</CardTitle><DollarSign className="h-4 w-4 text-purple-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatPhp(valuationQuery.data.summary.averageItemValue)}</div><p className="text-xs text-muted-foreground">{t("weightedAverage")}</p></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{t("totalGroups")}</CardTitle><Warehouse className="h-4 w-4 text-orange-600" /></CardHeader><CardContent><div className="text-2xl font-bold">{valuationQuery.data.summary.categoryCount}</div><p className="text-xs text-muted-foreground">{t("groupedView")}</p></CardContent></Card>
              </div>

              <Card>
                <CardHeader><CardTitle>{t("valuationDetails")}</CardTitle></CardHeader>
                <CardContent>
                  {valuationQuery.data.data.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">{t("noValuation")}</div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader><TableRow>{valuationGroupBy !== "warehouse" && <TableHead>{t("item")}</TableHead>}{valuationGroupBy !== "item" && <TableHead>{t("warehouse")}</TableHead>}{valuationGroupBy === "category" && <TableHead>{t("category")}</TableHead>}<TableHead className="text-right">{t("qtyOnHand")}</TableHead><TableHead className="text-right">{t("unitCost")}</TableHead><TableHead className="text-right">{t("totalValue")}</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {valuationQuery.data.data.map((valuation, index) => (
                            <TableRow key={index}>
                              {valuationGroupBy !== "warehouse" && <TableCell><div className="font-medium">{valuation.itemCode}</div><div className="text-sm text-muted-foreground">{valuation.itemName}</div></TableCell>}
                              {valuationGroupBy !== "item" && <TableCell><div className="font-medium">{valuation.warehouseCode}</div><div className="text-sm text-muted-foreground">{valuation.warehouseName}</div></TableCell>}
                              {valuationGroupBy === "category" && <TableCell>{valuation.category || "-"}</TableCell>}
                              <TableCell className="text-right">{Math.trunc(valuation.totalQuantity)}</TableCell>
                              <TableCell className="text-right">{formatPhp(valuation.averageRate)}</TableCell>
                              <TableCell className="text-right font-medium">{formatPhp(valuation.totalValue)}</TableCell>
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

          {valuationQuery.isLoading && <div className="space-y-4">{[1,2,3,4].map((i) => <Card key={i}><CardContent className="py-6"><Skeleton className="h-8 w-full" /></CardContent></Card>)}</div>}
          {valuationQuery.isError && !valuationQuery.data && <Card><CardContent className="py-8 text-center text-muted-foreground">{t("loadError")}</CardContent></Card>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
