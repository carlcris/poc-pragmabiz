"use client";

import { useEffect, useState } from "react";
import { Package, FileText, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useStockLedger } from "@/hooks/useStockLedger";
import { useCurrency } from "@/hooks/useCurrency";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import { ItemSelect, type ItemSelectOption } from "@/components/common/ItemSelect";
import { WarehouseSelect } from "@/components/warehouses/WarehouseSelect";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { MetricCard } from "@/components/shared/MetricCard";

export default function StockLedgerPage() {
  const t = useTranslations("itemLedger");
  const locale = useLocale();
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<ItemSelectOption | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [voucherTypeFilter, setVoucherTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const currentBusinessUnit = useBusinessUnitStore((state) => state.currentBusinessUnit);
  const hasBusinessUnitHydrated = useBusinessUnitStore((state) => state.hasHydrated);

  const { formatCurrency } = useCurrency();

  useEffect(() => {
    setSelectedItemId("");
    setSelectedItem(null);
    setSelectedWarehouseId("");
    setPage(1);
  }, [currentBusinessUnit?.id]);

  // Fetch stock ledger data
  const { data, isLoading, error } = useStockLedger({
    itemId: selectedItemId || undefined,
    warehouseId: selectedWarehouseId || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    voucherType: voucherTypeFilter !== "all" ? voucherTypeFilter : undefined,
    page,
    limit: pageSize,
  });

  const ledgerEntries = data?.data || [];
  const pagination = data?.pagination;
  const openingBalance = data?.openingBalance || 0;
  const totalIn = data?.summary.totalIn || 0;
  const totalOut = data?.summary.totalOut || 0;

  const closingBalance = data?.summary.closingBalance ?? openingBalance;

  const handleItemChange = (value: string) => {
    setSelectedItemId(value);
    setPage(1);
  };

  const handleWarehouseChange = (value: string) => {
    setSelectedWarehouseId(value);
    setPage(1);
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartDate(e.target.value);
    setPage(1);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndDate(e.target.value);
    setPage(1);
  };

  const handleVoucherTypeChange = (value: string) => {
    setVoucherTypeFilter(value);
    setPage(1);
  };

  const formatQuantity = (value: number) =>
    value.toLocaleString(locale, {
      maximumFractionDigits: 4,
    });

  const getTransactionTypeBadge = (type: string) => {
    if (type === "in") {
      return (
        <Badge variant="default" className="bg-green-600">
          {t("stockInShort")}
        </Badge>
      );
    } else if (type === "out") {
      return (
        <Badge variant="default" className="bg-red-600">
          {t("stockOutShort")}
        </Badge>
      );
    } else if (type === "transfer") {
      return <Badge variant="outline">{t("transfer")}</Badge>;
    }
    return <Badge variant="secondary">{t("adjustment")}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t("filters")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("item")} *</label>
              <ItemSelect
                value={selectedItemId}
                selectedOption={selectedItem}
                onValueChange={handleItemChange}
                onItemSelect={setSelectedItem}
                enabled={hasBusinessUnitHydrated && !!currentBusinessUnit?.id}
                disabled={!hasBusinessUnitHydrated || !currentBusinessUnit?.id}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("warehouse")} *</label>
              <WarehouseSelect
                value={selectedWarehouseId}
                onValueChange={handleWarehouseChange}
                scope="current_business_unit"
                disabled={!hasBusinessUnitHydrated || !currentBusinessUnit?.id}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("startDate")}</label>
              <Input type="date" value={startDate} onChange={handleStartDateChange} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("endDate")}</label>
              <Input type="date" value={endDate} onChange={handleEndDateChange} />
            </div>
          </div>

          <div className="mt-4">
            <Select value={voucherTypeFilter} onValueChange={handleVoucherTypeChange}>
              <SelectTrigger className="w-48">
                <FileText className="mr-2 h-4 w-4" />
                <SelectValue placeholder={t("movementType")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allMovements")}</SelectItem>
                <SelectItem value="in">{t("stockIn")}</SelectItem>
                <SelectItem value="out">{t("stockOut")}</SelectItem>
                <SelectItem value="transfer">{t("transfer")}</SelectItem>
                <SelectItem value="adjustment">{t("adjustment")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {selectedItemId && selectedWarehouseId && (
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard
            title={t("openingBalance")}
            icon={Package}
            iconClassName="h-4 w-4 text-blue-600"
            value={data ? formatQuantity(openingBalance) : undefined}
            caption={selectedItem?.uom}
            isLoading={isLoading}
          />
          <MetricCard
            title={t("totalIn")}
            icon={TrendingUp}
            iconClassName="h-4 w-4 text-green-600"
            value={
              data
                ? totalIn > 0
                  ? `+${formatQuantity(totalIn)}`
                  : formatQuantity(totalIn)
                : undefined
            }
            caption={t("stockReceived")}
            valueClassName="text-2xl font-bold text-green-600"
            isLoading={isLoading}
          />
          <MetricCard
            title={t("totalOut")}
            icon={TrendingDown}
            iconClassName="h-4 w-4 text-red-600"
            value={
              data
                ? totalOut > 0
                  ? `−${formatQuantity(totalOut)}`
                  : formatQuantity(totalOut)
                : undefined
            }
            caption={t("stockIssued")}
            valueClassName="text-2xl font-bold text-red-600"
            isLoading={isLoading}
          />
          <MetricCard
            title={t("closingBalance")}
            icon={ArrowRight}
            iconClassName="h-4 w-4 text-purple-600"
            value={data ? formatQuantity(closingBalance) : undefined}
            caption={t("currentStock")}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Selection prompt */}
      {!selectedItemId || !selectedWarehouseId ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Package className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p className="text-lg font-medium">{t("selectFiltersTitle")}</p>
              <p className="mt-2 text-sm">{t("selectFiltersDescription")}</p>
            </div>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("voucher")}</TableHead>
                <TableHead>{t("type")}</TableHead>
                <TableHead className="text-right">{t("transactionQuantity")}</TableHead>
                <TableHead className="text-right">{t("stockEffect")}</TableHead>
                <TableHead className="text-right">{t("balance")}</TableHead>
                <TableHead className="text-right">{t("rate")}</TableHead>
                <TableHead className="text-right">{t("value")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(10)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-4 w-16" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-4 w-16" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-4 w-20" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-4 w-20" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-4 w-24" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-destructive">{t("loadError")}</div>
          </CardContent>
        </Card>
      ) : ledgerEntries.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p className="text-lg font-medium">{t("emptyTitle")}</p>
              <p className="mt-2 text-sm">{t("emptyDescription")}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("dateAndTime")}</TableHead>
                  <TableHead>{t("voucher")}</TableHead>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead className="text-right">{t("transactionQuantity")}</TableHead>
                  <TableHead className="text-right">{t("stockEffect")}</TableHead>
                  <TableHead className="text-right">{t("balance")}</TableHead>
                  <TableHead className="text-right">{t("rate")}</TableHead>
                  <TableHead className="text-right">{t("value")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      <div>{entry.postingDate}</div>
                      <div className="text-xs text-muted-foreground">{entry.postingTime}</div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{entry.voucherNo}</div>
                        {entry.transactionCode && (
                          <div className="text-xs text-muted-foreground">
                            {entry.transactionCode}
                          </div>
                        )}
                        <Badge variant="outline">{entry.voucherType}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>{getTransactionTypeBadge(entry.transactionType)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="font-medium">
                        {formatQuantity(entry.transactionQuantity)}
                      </span>
                      {entry.uom ? (
                        <span className="ml-1 text-xs text-muted-foreground">{entry.uom}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {entry.inventoryEffect === "in" ? (
                        <span className="text-green-600">
                          +{formatQuantity(entry.inventoryDelta)} {t("stockInShort")}
                        </span>
                      ) : entry.inventoryEffect === "out" ? (
                        <span className="text-red-600">
                          −{formatQuantity(Math.abs(entry.inventoryDelta))} {t("stockOutShort")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{t("internalTransfer")}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatQuantity(entry.qtyAfterTransaction)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(entry.valuationRate)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div>{formatCurrency(entry.stockValue)}</div>
                      <div
                        className={`text-xs ${
                          entry.stockValueDiff > 0
                            ? "text-green-600"
                            : entry.stockValueDiff < 0
                              ? "text-red-600"
                              : "text-muted-foreground"
                        }`}
                      >
                        {entry.stockValueDiff > 0 ? "+" : ""}
                        {formatCurrency(entry.stockValueDiff)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {pagination && pagination.total > 0 && (
            <div className="mt-4">
              <DataTablePagination
                currentPage={page}
                totalPages={pagination.totalPages}
                pageSize={pageSize}
                totalItems={pagination.total}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
