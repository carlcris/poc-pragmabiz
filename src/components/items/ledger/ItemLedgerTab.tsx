"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { ArrowRight, FileText, Package, TrendingDown, TrendingUp } from "lucide-react";
import { useLocale } from "next-intl";
import { useStockLedger } from "@/hooks/useStockLedger";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useCurrency } from "@/hooks/useCurrency";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { MetricCard } from "@/components/shared/MetricCard";

type ItemLedgerTabProps = {
  itemId: string;
  itemUom?: string;
};

const TRANSACTION_TYPE_OPTIONS = [
  { value: "all", label: "All Movements" },
  { value: "in", label: "Stock In" },
  { value: "out", label: "Stock Out" },
  { value: "transfer", label: "Transfer" },
  { value: "adjustment", label: "Adjustment" },
];

export const ItemLedgerTab = ({ itemId, itemUom }: ItemLedgerTabProps) => {
  const locale = useLocale();
  const { formatCurrency } = useCurrency();
  const currentBusinessUnit = useBusinessUnitStore((state) => state.currentBusinessUnit);
  const hasBusinessUnitHydrated = useBusinessUnitStore((state) => state.hasHydrated);
  const { data: warehousesData, isLoading: isWarehousesLoading } = useWarehouses({ limit: 100 });
  const warehouses = useMemo(() => warehousesData?.data || [], [warehousesData?.data]);
  const currentWarehouse = useMemo(() => {
    if (!currentBusinessUnit?.id) return null;

    return (
      warehouses.find((warehouse) => warehouse.businessUnitId === currentBusinessUnit.id) ?? null
    );
  }, [currentBusinessUnit?.id, warehouses]);
  const currentWarehouseId = currentWarehouse?.id;
  const isWarehouseContextLoading = !hasBusinessUnitHydrated || isWarehousesLoading;

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data, isLoading, error } = useStockLedger({
    itemId,
    warehouseId: currentWarehouseId,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    voucherType: transactionTypeFilter !== "all" ? transactionTypeFilter : undefined,
    page,
    limit: pageSize,
  });

  const ledgerEntries = data?.data || [];
  const pagination = data?.pagination;
  const openingBalance = data?.openingBalance || 0;

  const totalIn = ledgerEntries
    .filter((entry) => entry.actualQty > 0)
    .reduce((sum, entry) => sum + entry.actualQty, 0);

  const totalOut = ledgerEntries
    .filter((entry) => entry.actualQty < 0)
    .reduce((sum, entry) => sum + Math.abs(entry.actualQty), 0);

  const closingBalance =
    ledgerEntries.length > 0 ? ledgerEntries[0].qtyAfterTransaction : openingBalance;

  const resetToFirstPage = () => setPage(1);

  const handleStartDateChange = (event: ChangeEvent<HTMLInputElement>) => {
    setStartDate(event.target.value);
    resetToFirstPage();
  };

  const handleEndDateChange = (event: ChangeEvent<HTMLInputElement>) => {
    setEndDate(event.target.value);
    resetToFirstPage();
  };

  const handleTransactionTypeChange = (value: string) => {
    setTransactionTypeFilter(value);
    resetToFirstPage();
  };

  const formatQuantity = (value: number) =>
    value.toLocaleString(locale, {
      maximumFractionDigits: 4,
    });

  const getTransactionTypeBadge = (type: string) => {
    if (type === "in") {
      return <Badge className="bg-green-600 hover:bg-green-600">IN</Badge>;
    }

    if (type === "out") {
      return <Badge className="bg-red-600 hover:bg-red-600">OUT</Badge>;
    }

    if (type === "transfer") {
      return <Badge variant="outline">TRANSFER</Badge>;
    }

    return <Badge variant="secondary">{type.toUpperCase()}</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Stock Ledger</CardTitle>
          <CardDescription className="text-sm">
            Item movement history with running balance for the current warehouse context.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <div className="text-muted-foreground">Warehouse</div>
            <div className="font-medium">
              {isWarehouseContextLoading ? (
                <Skeleton className="mt-1 h-4 w-56" />
              ) : currentWarehouse ? (
                `${currentWarehouse.code} - ${currentWarehouse.name}`
              ) : (
                "No warehouse resolved from the current business unit"
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Input type="date" value={startDate} onChange={handleStartDateChange} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Input type="date" value={endDate} onChange={handleEndDateChange} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Movement Type</label>
              <Select value={transactionTypeFilter} onValueChange={handleTransactionTypeChange}>
                <SelectTrigger>
                  <FileText className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Movement type" />
                </SelectTrigger>
                <SelectContent>
                  {TRANSACTION_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {currentWarehouseId ? (
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard
            title="Opening Balance"
            icon={Package}
            iconClassName="h-4 w-4 text-blue-600"
            value={data ? formatQuantity(openingBalance) : undefined}
            caption={itemUom}
            isLoading={isLoading}
          />
          <MetricCard
            title="Total IN"
            icon={TrendingUp}
            iconClassName="h-4 w-4 text-green-600"
            value={
              data
                ? totalIn > 0
                  ? `+${formatQuantity(totalIn)}`
                  : formatQuantity(totalIn)
                : undefined
            }
            caption="Stock received"
            valueClassName="text-2xl font-bold text-green-600"
            isLoading={isLoading}
          />
          <MetricCard
            title="Total OUT"
            icon={TrendingDown}
            iconClassName="h-4 w-4 text-red-600"
            value={
              data
                ? totalOut > 0
                  ? `-${formatQuantity(totalOut)}`
                  : formatQuantity(totalOut)
                : undefined
            }
            caption="Stock issued"
            valueClassName="text-2xl font-bold text-red-600"
            isLoading={isLoading}
          />
          <MetricCard
            title="Closing Balance"
            icon={ArrowRight}
            iconClassName="h-4 w-4 text-purple-600"
            value={data ? formatQuantity(closingBalance) : undefined}
            caption={currentWarehouse ? currentWarehouse.code : "Current stock"}
            isLoading={isLoading}
          />
        </div>
      ) : null}

      {!currentWarehouseId ? (
        <Card>
          <CardContent className="py-12">
            {isWarehouseContextLoading ? (
              <div className="mx-auto max-w-sm space-y-3">
                <Skeleton className="mx-auto h-12 w-12 rounded-full" />
                <Skeleton className="mx-auto h-5 w-56" />
                <Skeleton className="mx-auto h-4 w-72" />
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                <Package className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p className="text-lg font-medium">
                  No warehouse is available for the current business unit context.
                </p>
                <p className="mt-2 text-sm">
                  Switch to a business unit with a warehouse to view this item ledger.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Voucher</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">IN Qty</TableHead>
                <TableHead className="text-right">OUT Qty</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(8)].map((_, index) => (
                <TableRow key={index}>
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
            <div className="text-center text-destructive">
              Error loading stock ledger. Please try again.
            </div>
          </CardContent>
        </Card>
      ) : ledgerEntries.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p className="text-lg font-medium">No transactions found.</p>
              <p className="mt-2 text-sm">No stock movements for the selected filters.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Voucher</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">IN Qty</TableHead>
                  <TableHead className="text-right">OUT Qty</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Value</TableHead>
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
                        {entry.transactionCode ? (
                          <div className="text-xs text-muted-foreground">
                            {entry.transactionCode}
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{getTransactionTypeBadge(entry.transactionType)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {entry.actualQty > 0 ? (
                        <span className="text-green-600">+{formatQuantity(entry.actualQty)}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {entry.actualQty < 0 ? (
                        <span className="text-red-600">
                          {formatQuantity(Math.abs(entry.actualQty))}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
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
                        className={
                          entry.stockValueDiff > 0
                            ? "text-xs text-green-600"
                            : entry.stockValueDiff < 0
                              ? "text-xs text-red-600"
                              : "text-xs text-muted-foreground"
                        }
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

          {pagination && pagination.total > 0 ? (
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
          ) : null}
        </>
      )}
    </div>
  );
};
