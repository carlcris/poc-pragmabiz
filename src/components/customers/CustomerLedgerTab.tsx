"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ReceiptText, Search } from "lucide-react";
import { useCustomerLedger } from "@/hooks/useCustomers";
import { useCurrency } from "@/hooks/useCurrency";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
import type {
  CustomerLedgerEntry,
  CustomerLedgerResponse,
  CustomerLedgerSourceType,
} from "@/types/customer";

type CustomerLedgerTabProps = {
  customerId: string;
  enabled: boolean;
};

const DEFAULT_PAGE_SIZE = 20;

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));

const getSourceLabel = (sourceType: CustomerLedgerEntry["sourceType"]) => {
  if (sourceType === "invoice") return "Invoice";
  if (sourceType === "payment") return "Payment";
  return "POS";
};

const getSourceBadge = (sourceType: CustomerLedgerEntry["sourceType"]) => {
  if (sourceType === "invoice") return <Badge variant="default">Invoice</Badge>;
  if (sourceType === "payment") return <Badge variant="secondary">Payment</Badge>;
  return <Badge variant="outline">POS</Badge>;
};

const getLatestSummary = (
  ledger: CustomerLedgerResponse | undefined,
  rows: CustomerLedgerEntry[]
) => {
  if (ledger?.summary) return ledger.summary;
  return {
    openingBalance: 0,
    closingBalance: rows[0]?.runningBalance ?? 0,
    periodDebits: 0,
    periodCredits: 0,
    invoiceCharges: 0,
    paymentsReceived: 0,
    posSales: 0,
    activeInvoiceCount: 0,
    overdueInvoiceCount: 0,
    lastActivityAt: undefined,
  };
};

export const CustomerLedgerTab = ({ customerId, enabled }: CustomerLedgerTabProps) => {
  const { formatCurrency } = useCurrency();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sourceType, setSourceType] = useState<CustomerLedgerSourceType>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const { data, isLoading, isFetching, error } = useCustomerLedger(customerId, {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sourceType,
    search: search || undefined,
    page,
    limit: pageSize,
    enabled,
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, search, sourceType]);

  const rows = data?.data || [];
  const summary = getLatestSummary(data, rows);
  const hasRows = rows.length > 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Opening Balance</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {isLoading && !hasRows ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              formatCurrency(summary.openingBalance)
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Charges</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold">{formatCurrency(summary.periodDebits)}</div>
            <p className="text-xs text-muted-foreground">Invoices and paid POS customer sales</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Credits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold">{formatCurrency(summary.periodCredits)}</div>
            <p className="text-xs text-muted-foreground">Payments and POS settlement</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Closing Balance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div
              className={
                summary.closingBalance > 0
                  ? "text-2xl font-bold text-orange-600"
                  : "text-2xl font-bold"
              }
            >
              {formatCurrency(summary.closingBalance)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.activeInvoiceCount} active invoices
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div>
            <CardTitle className="text-base font-semibold">Customer Ledger</CardTitle>
            <CardDescription>
              Invoice charges, payments, and linked POS customer sales with running balance.
            </CardDescription>
          </div>
          <div className="grid gap-3 lg:grid-cols-[1fr_150px_160px_160px]">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search document, method, or reference..."
                className="pl-8"
              />
            </div>
            <Select
              value={sourceType}
              onValueChange={(value) => {
                setSourceType(value as CustomerLedgerSourceType);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="invoice">Invoices</SelectItem>
                <SelectItem value="payment">Payments</SelectItem>
                <SelectItem value="pos">POS</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && !hasRows ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <EmptyStatePanel
              icon={AlertCircle}
              title="Unable to load customer ledger"
              description="Please refresh and try again."
            />
          ) : !hasRows ? (
            <EmptyStatePanel
              icon={ReceiptText}
              title="No ledger activity found"
              description="Invoices, payments, and linked POS customer sales will appear here."
            />
          ) : (
            <div className="space-y-4">
              <div className="max-h-[34rem] overflow-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(entry.eventAt)}
                        </TableCell>
                        <TableCell>{getSourceBadge(entry.sourceType)}</TableCell>
                        <TableCell>
                          <div className="font-medium">{entry.documentNumber}</div>
                          <div className="text-xs text-muted-foreground">
                            {entry.paymentMethod || getSourceLabel(entry.sourceType)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="line-clamp-1">{entry.description}</div>
                          {entry.reference ? (
                            <div className="line-clamp-1 text-xs text-muted-foreground">
                              Ref: {entry.reference}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {entry.debit > 0 ? formatCurrency(entry.debit) : "-"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {entry.credit > 0 ? formatCurrency(entry.credit) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrency(entry.runningBalance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DataTablePagination
                currentPage={data?.pagination.page ?? page}
                totalPages={data?.pagination.totalPages ?? 1}
                pageSize={data?.pagination.limit ?? pageSize}
                totalItems={data?.pagination.total ?? rows.length}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[10, 20, 30, 50]}
              />
              {isFetching && !isLoading ? (
                <p className="text-center text-xs text-muted-foreground">Refreshing ledger...</p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
