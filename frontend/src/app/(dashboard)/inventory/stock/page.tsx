"use client";

import { useState } from "react";
import { Plus, Search, Filter, ArrowUpCircle, ArrowDownCircle, ArrowRightLeft, Settings2 } from "lucide-react";
import { useStockTransactions } from "@/hooks/useStockTransactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { StockTransactionFormDialog } from "@/components/stock/StockTransactionFormDialog";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import type { StockTransaction, TransactionType } from "@/types/stock-transaction";

export default function StockTransactionsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data, isLoading, error } = useStockTransactions({
    search,
    page: 1,
    limit: 1000, // Get all for client-side filtering
  });

  // Apply client-side filters
  let filteredTransactions = data?.data || [];

  if (typeFilter !== "all") {
    filteredTransactions = filteredTransactions.filter(
      (txn) => txn.transactionType === typeFilter
    );
  }

  // Calculate pagination
  const total = filteredTransactions.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const transactions = filteredTransactions.slice(start, end);

  const pagination = {
    total,
    page,
    limit: pageSize,
    totalPages,
  };

  const getTransactionTypeIcon = (type: TransactionType) => {
    switch (type) {
      case "in":
        return <ArrowDownCircle className="h-4 w-4 text-green-600" />;
      case "out":
        return <ArrowUpCircle className="h-4 w-4 text-red-600" />;
      case "transfer":
        return <ArrowRightLeft className="h-4 w-4 text-blue-600" />;
      case "adjustment":
        return <Settings2 className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getTransactionTypeBadge = (type: TransactionType) => {
    const configs: Record<TransactionType, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
      in: { label: "IN", variant: "default" },
      out: { label: "OUT", variant: "destructive" },
      transfer: { label: "TRANSFER", variant: "outline" },
      adjustment: { label: "ADJUSTMENT", variant: "secondary" },
    };

    const config = configs[type];
    return (
      <div className="flex items-center gap-2">
        {getTransactionTypeIcon(type)}
        <Badge variant={config.variant}>{config.label}</Badge>
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleCreateTransaction = () => {
    setDialogOpen(true);
  };

  const handleTypeFilterChange = (value: string) => {
    setTypeFilter(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock Transactions</h1>
          <p className="text-muted-foreground">
            Track all inventory movements and adjustments
          </p>
        </div>
        <Button onClick={handleCreateTransaction}>
          <Plus className="mr-2 h-4 w-4" />
          New Transaction
        </Button>
      </div>

      <div className="space-y-4">
          <div className="mb-4 flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={typeFilter} onValueChange={handleTypeFilterChange}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="in">Stock In</SelectItem>
                <SelectItem value="out">Stock Out</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
                <SelectItem value="adjustment">Adjustment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              Error loading stock transactions. Please try again.
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No stock transactions found.
            </div>
          ) : (
            <>
              <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Created By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="font-medium">
                          {formatDate(transaction.transactionDate)}
                        </TableCell>
                        <TableCell>{getTransactionTypeBadge(transaction.transactionType)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{transaction.itemCode}</div>
                            <div className="text-muted-foreground">{transaction.itemName}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{transaction.warehouseCode}</div>
                            {transaction.transactionType === "transfer" && transaction.toWarehouseCode && (
                              <div className="text-muted-foreground flex items-center gap-1">
                                <ArrowRightLeft className="h-3 w-3" />
                                {transaction.toWarehouseCode}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <span className={
                            transaction.transactionType === "in" ? "text-green-600" :
                            transaction.transactionType === "out" ? "text-red-600" :
                            transaction.quantity < 0 ? "text-red-600" : "text-green-600"
                          }>
                            {transaction.transactionType === "in" ? "+" :
                             transaction.transactionType === "out" ? "-" : ""}
                            {Math.abs(transaction.quantity)} {transaction.uom}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {transaction.referenceNumber || "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm max-w-[200px] truncate" title={transaction.reason}>
                            {transaction.reason}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{transaction.createdByName}</div>
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

      <StockTransactionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
