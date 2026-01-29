"use client";

import { useState } from "react";
import { Package, Warehouse, FileText, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { useStockLedger } from "@/hooks/useStockLedger";
import { useItems } from "@/hooks/useItems";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useCurrency } from "@/hooks/useCurrency";
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

export default function StockLedgerPage() {
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [voucherTypeFilter, setVoucherTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const { formatCurrency } = useCurrency();

  // Fetch items and warehouses for dropdowns
  const { data: itemsData } = useItems({ limit: 1000 });
  const { data: warehousesData } = useWarehouses({ limit: 100 });

  const items = itemsData?.data || [];
  const warehouses = warehousesData?.data || [];

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

  // Calculate summary statistics
  const totalIn = ledgerEntries
    .filter((entry) => entry.actualQty > 0)
    .reduce((sum, entry) => sum + entry.actualQty, 0);

  const totalOut = ledgerEntries
    .filter((entry) => entry.actualQty < 0)
    .reduce((sum, entry) => sum + Math.abs(entry.actualQty), 0);

  const closingBalance =
    ledgerEntries.length > 0 ? ledgerEntries[0].qtyAfterTransaction : openingBalance;

  const selectedItem = items.find((item) => item.id === selectedItemId);

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

  const getVoucherTypeBadge = (type: string) => {
    const variants: Record<
      string,
      { variant: "default" | "secondary" | "outline" | "destructive" }
    > = {
      "Purchase Receipt": { variant: "default" },
      "Sales Invoice": { variant: "secondary" },
      "Stock Transfer": { variant: "outline" },
      "Stock Adjustment": { variant: "outline" },
    };

    const config = variants[type] || { variant: "outline" };
    return <Badge variant={config.variant}>{type}</Badge>;
  };

  const getTransactionTypeBadge = (type: string) => {
    if (type === "in") {
      return (
        <Badge variant="default" className="bg-green-600">
          IN
        </Badge>
      );
    } else if (type === "out") {
      return (
        <Badge variant="default" className="bg-red-600">
          OUT
        </Badge>
      );
    } else if (type === "transfer") {
      return <Badge variant="outline">TRANSFER</Badge>;
    }
    return <Badge variant="secondary">{type.toUpperCase()}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock Ledger</h1>
          <p className="text-muted-foreground">
            View detailed item movement history with running balance
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Item *</label>
              <Select value={selectedItemId} onValueChange={handleItemChange}>
                <SelectTrigger>
                  <Package className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.code} - {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Warehouse *</label>
              <Select value={selectedWarehouseId} onValueChange={handleWarehouseChange}>
                <SelectTrigger>
                  <Warehouse className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.code} - {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Input type="date" value={startDate} onChange={handleStartDateChange} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Input type="date" value={endDate} onChange={handleEndDateChange} />
            </div>
          </div>

          <div className="mt-4">
            <Select value={voucherTypeFilter} onValueChange={handleVoucherTypeChange}>
              <SelectTrigger className="w-[200px]">
                <FileText className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Voucher type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vouchers</SelectItem>
                <SelectItem value="Purchase Receipt">Purchase Receipt</SelectItem>
                <SelectItem value="Sales Invoice">Sales Invoice</SelectItem>
                <SelectItem value="Stock Transfer">Stock Transfer</SelectItem>
                <SelectItem value="Stock Adjustment">Stock Adjustment</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {selectedItemId && selectedWarehouseId && !isLoading && data && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Opening Balance</CardTitle>
              <Package className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{openingBalance.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">{selectedItem?.uom}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total IN</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {totalIn > 0 ? `+${totalIn.toFixed(2)}` : totalIn.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Stock received</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total OUT</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {totalOut > 0 ? `-${totalOut.toFixed(2)}` : totalOut.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Stock issued</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Closing Balance</CardTitle>
              <ArrowRight className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{closingBalance.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Current stock</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Selection prompt */}
      {!selectedItemId || !selectedWarehouseId ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Package className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p className="text-lg font-medium">Select an item and warehouse to view ledger</p>
              <p className="mt-2 text-sm">
                Choose filters above to see detailed stock movement history
              </p>
            </div>
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
              <p className="text-lg font-medium">No transactions found</p>
              <p className="mt-2 text-sm">No stock movements for the selected filters</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-md border">
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
                        {entry.transactionCode && (
                          <div className="text-xs text-muted-foreground">
                            {entry.transactionCode}
                          </div>
                        )}
                        {getVoucherTypeBadge(entry.voucherType)}
                      </div>
                    </TableCell>
                    <TableCell>{getTransactionTypeBadge(entry.transactionType)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {entry.actualQty > 0 ? (
                        <span className="text-green-600">+{entry.actualQty.toFixed(2)}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {entry.actualQty < 0 ? (
                        <span className="text-red-600">{Math.abs(entry.actualQty).toFixed(2)}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {entry.qtyAfterTransaction.toFixed(2)}
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
