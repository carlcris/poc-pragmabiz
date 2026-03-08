"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { format } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { Eye, Printer, Search, XCircle } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DateRangePicker } from "@/components/analytics/date-range-picker";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { usePOSTransaction, usePOSTransactions, useVoidPOSTransaction } from "@/hooks/usePos";
import type { POSTransaction } from "@/types/pos";

const AdminPinDialog = dynamic(() => import("@/components/pos/AdminPinDialog").then((mod) => mod.AdminPinDialog), { ssr: false });
const ReceiptPanel = dynamic(() => import("@/components/pos/ReceiptPanel").then((mod) => mod.ReceiptPanel), { ssr: false });
const TransactionDetailsDialog = dynamic(() => import("@/components/pos/TransactionDetailsDialog").then((mod) => mod.TransactionDetailsDialog), { ssr: false });

export default function POSTransactionsPage() {
  const t = useTranslations("posTransactionsPage");
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [cashierFilter, setCashierFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [transactionToVoid, setTransactionToVoid] = useState<POSTransaction | null>(null);
  const [showAdminPinDialog, setShowAdminPinDialog] = useState(false);
  const [showVoidConfirmDialog, setShowVoidConfirmDialog] = useState(false);
  const [receiptTransactionId, setReceiptTransactionId] = useState<string | null>(null);
  const [showReceiptPanel, setShowReceiptPanel] = useState(false);

  const queryParams = useMemo(() => {
    const params: Record<string, string | number | undefined> = {
      search: search || undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      dateFrom: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
      dateTo: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
      cashierId: cashierFilter !== "all" ? cashierFilter : undefined,
      page: currentPage,
      limit: pageSize,
    };
    return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined)) as Record<string, string | number>;
  }, [search, statusFilter, dateRange, cashierFilter, currentPage, pageSize]);

  const { data, isLoading } = usePOSTransactions(queryParams);
  const { data: selectedTransaction } = usePOSTransaction(selectedTransactionId || "");
  const { data: receiptTransaction } = usePOSTransaction(receiptTransactionId || "");
  const voidTransaction = useVoidPOSTransaction({ success: t("voidSuccess"), error: t("voidError") });

  useEffect(() => {
    const value = searchInput.trim();
    const timer = window.setTimeout(() => {
      if (value.length === 0 || value.length >= 3) setSearch(value);
      else setSearch("");
    }, 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const transactions = useMemo(() => data?.data || [], [data]);
  const uniqueCashiers = useMemo(() => {
    const cashiers = new Map<string, string>();
    transactions.forEach((txn: POSTransaction) => {
      if (txn.cashierId && txn.cashierName) cashiers.set(txn.cashierId, txn.cashierName);
    });
    return Array.from(cashiers.entries()).map(([id, name]) => ({ id, name }));
  }, [transactions]);

  const formatCurrency = (amount: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "PHP" }).format(amount);
  const formatDateTime = (dateString: string) => {
    try {
      return new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(dateString));
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "completed") return <Badge className="bg-green-100 text-green-800">{t("completedStatus")}</Badge>;
    if (status === "voided") return <Badge variant="secondary">{t("voidedStatus")}</Badge>;
    return <Badge>{status}</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{t("title")}</h1>
          <p className="text-sm text-muted-foreground md:text-base">{t("subtitle")}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <div className="rounded-lg border p-3 md:p-4">
          <div className="text-xs text-muted-foreground md:text-sm">{t("totalTransactions")}</div>
          <div className="text-xl font-bold md:text-2xl">{transactions.length}</div>
        </div>
        <div className="rounded-lg border p-3 md:p-4">
          <div className="text-xs text-muted-foreground md:text-sm">{t("completed")}</div>
          <div className="text-xl font-bold text-green-600 md:text-2xl">{transactions.filter((txn) => txn.status === "completed").length}</div>
        </div>
        <div className="rounded-lg border p-3 md:p-4">
          <div className="text-xs text-muted-foreground md:text-sm">{t("voided")}</div>
          <div className="text-xl font-bold text-gray-500 md:text-2xl">{transactions.filter((txn) => txn.status === "voided").length}</div>
        </div>
        <div className="rounded-lg border p-3 md:p-4">
          <div className="text-xs text-muted-foreground md:text-sm">{t("totalSales")}</div>
          <div className="text-lg font-bold md:text-2xl">{formatCurrency(transactions.filter((txn) => txn.status === "completed").reduce((sum, txn) => sum + txn.totalAmount, 0))}</div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col items-stretch gap-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
            <Input placeholder={t("searchPlaceholder")} value={searchInput} onChange={(e) => { setSearchInput(e.target.value); setCurrentPage(1); }} className="pl-10" />
          </div>

          <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder={t("statusPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allStatus")}</SelectItem>
              <SelectItem value="completed">{t("completedStatus")}</SelectItem>
              <SelectItem value="voided">{t("voidedStatus")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col items-stretch gap-4 md:flex-row md:items-center">
          <div className="w-full md:w-[300px]">
            <DateRangePicker value={dateRange} onChange={(range) => { setDateRange(range); setCurrentPage(1); }} />
          </div>

          <Select value={cashierFilter} onValueChange={(value) => { setCashierFilter(value); setCurrentPage(1); }}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder={t("allCashiers")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allCashiers")}</SelectItem>
              {uniqueCashiers.map((cashier) => <SelectItem key={cashier.id} value={cashier.id}>{cashier.name}</SelectItem>)}
            </SelectContent>
          </Select>

          {(searchInput || statusFilter !== "all" || dateRange || cashierFilter !== "all") && (
            <Button variant="ghost" onClick={() => { setSearch(""); setSearchInput(""); setStatusFilter("all"); setDateRange(undefined); setCashierFilter("all"); setCurrentPage(1); }} className="w-full md:w-auto">
              {t("clearFilters")}
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>{t("transactionNumber")}</TableHead>
                <TableHead>{t("dateTime")}</TableHead>
                <TableHead>{t("customer")}</TableHead>
                <TableHead>{t("cashier")}</TableHead>
                <TableHead>{t("items")}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center">{t("loading")}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-md border py-8 text-center text-muted-foreground">
          {searchInput || statusFilter !== "all" || dateRange || cashierFilter !== "all" ? t("emptyFiltered") : t("empty")}
        </div>
      ) : (
        <>
          <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>{t("transactionNumber")}</TableHead>
                  <TableHead>{t("dateTime")}</TableHead>
                  <TableHead>{t("customer")}</TableHead>
                  <TableHead>{t("cashier")}</TableHead>
                  <TableHead>{t("items")}</TableHead>
                  <TableHead className="text-right">{t("amount")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-mono font-medium">{transaction.transactionNumber}</TableCell>
                    <TableCell>{formatDateTime(transaction.transactionDate)}</TableCell>
                    <TableCell>{transaction.customerName || <span className="italic text-muted-foreground">{t("walkInCustomer")}</span>}</TableCell>
                    <TableCell>{transaction.cashierName}</TableCell>
                    <TableCell>{t("itemsCount", { count: transaction.itemCount ?? transaction.items.length })}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(transaction.totalAmount)}</TableCell>
                    <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedTransactionId(transaction.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" title={t("printReceipt")} onClick={() => { setReceiptTransactionId(transaction.id); setShowReceiptPanel(true); }}>
                          <Printer className="h-4 w-4" />
                        </Button>
                        {transaction.status === "completed" && (
                          <Button variant="ghost" size="sm" title={t("voidTransaction")} onClick={() => { setTransactionToVoid(transaction); setShowAdminPinDialog(true); }}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {data?.pagination && data.pagination.total > 0 && (
            <div className="mt-4">
              <DataTablePagination
                currentPage={currentPage}
                totalPages={data.pagination.totalPages}
                pageSize={pageSize}
                totalItems={data.pagination.total}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          )}
        </>
      )}

      {selectedTransactionId && <TransactionDetailsDialog transaction={selectedTransaction ?? null} open={!!selectedTransactionId} onOpenChange={(open) => !open && setSelectedTransactionId(null)} />}

      <AdminPinDialog open={showAdminPinDialog} onOpenChange={() => { setTransactionToVoid(null); setShowAdminPinDialog(false); setShowVoidConfirmDialog(false); }} onVerify={async (pin: string) => {
        const isValid = pin === "0000";
        if (isValid) {
          setShowAdminPinDialog(false);
          setShowVoidConfirmDialog(true);
        }
        return isValid;
      }} title={t("adminPinTitle")} description={t("adminPinDescription")} />

      <AlertDialog open={showVoidConfirmDialog} onOpenChange={() => { setTransactionToVoid(null); setShowAdminPinDialog(false); setShowVoidConfirmDialog(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("voidTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{transactionToVoid && t("voidDescription", { transactionNumber: transactionToVoid.transactionNumber })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setTransactionToVoid(null); setShowAdminPinDialog(false); setShowVoidConfirmDialog(false); }}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (!transactionToVoid) return;
              await voidTransaction.mutateAsync(transactionToVoid.id);
              setTransactionToVoid(null);
              setShowVoidConfirmDialog(false);
            }} className="bg-red-600 hover:bg-red-700">
              {t("voidAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showReceiptPanel && <ReceiptPanel transaction={receiptTransaction ?? null} open={showReceiptPanel} onClose={() => { setShowReceiptPanel(false); setReceiptTransactionId(null); }} />}
    </div>
  );
}
