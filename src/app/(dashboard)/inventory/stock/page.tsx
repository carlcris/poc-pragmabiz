"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import {
  Plus,
  Search,
  Filter,
  Calendar,
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowRightLeft,
  Settings2,
} from "lucide-react";
import { useStockTransactions } from "@/hooks/useStockTransactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { EmptyStatePanel } from "@/components/shared/EmptyStatePanel";
import type { TransactionType } from "@/types/stock-transaction";

const StockTransactionFormDialog = dynamic(
  () =>
    import("@/components/stock/StockTransactionFormDialog").then(
      (mod) => mod.StockTransactionFormDialog
    ),
  { ssr: false }
);
const StockTransactionDetailDialog = dynamic(
  () =>
    import("@/components/stock/StockTransactionDetailDialog").then(
      (mod) => mod.StockTransactionDetailDialog
    ),
  { ssr: false }
);

export default function StockTransactionsPage() {
  const t = useTranslations("stockTransactionsPage");
  const locale = useLocale();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);

  const { data, isLoading, error } = useStockTransactions({
    search: search || undefined,
    transactionType: typeFilter,
    page,
    limit: pageSize,
  });

  const transactions = data?.data || [];
  const pagination = data?.pagination;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

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
    const configs: Record<
      TransactionType,
      { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
    > = {
      in: { label: t("badgeIn"), variant: "default" },
      out: { label: t("badgeOut"), variant: "destructive" },
      transfer: { label: t("badgeTransfer"), variant: "outline" },
      adjustment: { label: t("badgeAdjustment"), variant: "secondary" },
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
    return new Date(dateString).toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatQuantity = (value: number) =>
    value.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  const formatLocationLabel = (transaction: (typeof transactions)[number]) => {
    if (transaction.transactionType === "transfer") {
      const fromLabel = transaction.fromLocationCode || "-";
      const toLabel = transaction.toLocationCode || "-";
      return `${fromLabel} → ${toLabel}`;
    }
    if (transaction.transactionType === "in") {
      return transaction.toLocationCode || "-";
    }
    return transaction.fromLocationCode || "-";
  };

  const formatWarehouseCell = (transaction: (typeof transactions)[number]) => {
    const warehouseLabel = transaction.warehouseCode || "-";
    const locationLabel = formatLocationLabel(transaction);

    if (transaction.transactionType === "transfer" && transaction.toWarehouseCode) {
      return {
        warehouse: warehouseLabel,
        location: locationLabel,
        transfer: `${transaction.toWarehouseCode} / ${transaction.toLocationCode || "-"}`,
      };
    }

    return {
      warehouse: warehouseLabel,
      location: locationLabel,
      transfer: null,
    };
  };

  const handleCreateTransaction = () => {
    setDialogOpen(true);
  };

  const handleTypeFilterChange = (value: string) => {
    setTypeFilter(value as TransactionType | "all");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight whitespace-nowrap">
            {t("title")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
            {t("subtitle")}
          </p>
        </div>
        <Button onClick={handleCreateTransaction} className="w-full sm:w-auto flex-shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          {t("newTransaction")}
        </Button>
      </div>

      <div className="space-y-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={typeFilter} onValueChange={handleTypeFilterChange}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder={t("typePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allTypes")}</SelectItem>
              <SelectItem value="in">{t("stockIn")}</SelectItem>
              <SelectItem value="out">{t("stockOut")}</SelectItem>
              <SelectItem value="transfer">{t("transfer")}</SelectItem>
              <SelectItem value="adjustment">{t("adjustment")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead>{t("item")}</TableHead>
                  <TableHead>{t("warehouse")}</TableHead>
                  <TableHead className="text-right">{t("quantity")}</TableHead>
                  <TableHead>{t("reference")}</TableHead>
                  <TableHead>{t("createdBy")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(8)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4 rounded-full" />
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-36" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-destructive">
            {t("loadingError")}
          </div>
        ) : transactions.length === 0 ? (
          <EmptyStatePanel
            icon={Calendar}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
          />
        ) : (
          <>
            <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead>{t("type")}</TableHead>
                    <TableHead>{t("item")}</TableHead>
                    <TableHead>{t("warehouse")}</TableHead>
                    <TableHead className="text-right">{t("quantity")}</TableHead>
                    <TableHead>{t("reference")}</TableHead>
                    <TableHead>{t("createdBy")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => {
                    const warehouseCell = formatWarehouseCell(transaction);

                    return (
                      <TableRow
                        key={transaction.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          setSelectedTransactionId(transaction.transactionId || transaction.id);
                          setDetailDialogOpen(true);
                        }}
                      >
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
                            <div className="font-medium">{warehouseCell.warehouse}</div>
                            <div className="text-muted-foreground">{warehouseCell.location}</div>
                            {warehouseCell.transfer ? (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <ArrowRightLeft className="h-3 w-3" />
                                {warehouseCell.transfer}
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <span
                            className={
                              transaction.transactionType === "in"
                                ? "text-green-600"
                                : transaction.transactionType === "out"
                                  ? "text-red-600"
                                  : transaction.quantity < 0
                                    ? "text-red-600"
                                    : "text-green-600"
                            }
                          >
                            {transaction.transactionType === "in"
                              ? "+"
                              : transaction.transactionType === "out"
                                ? "-"
                                : ""}
                            {formatQuantity(Math.abs(transaction.quantity))} {transaction.uom}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[260px] text-sm">
                            <div className="font-medium">{transaction.referenceNumber || "-"}</div>
                            <div
                              className="truncate text-muted-foreground"
                              title={transaction.reason || "-"}
                            >
                              {transaction.reason || "-"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{transaction.createdByName}</div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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

      {dialogOpen && <StockTransactionFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />}

      {detailDialogOpen && (
        <StockTransactionDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          transactionId={selectedTransactionId}
        />
      )}
    </div>
  );
}
