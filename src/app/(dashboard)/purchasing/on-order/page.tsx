"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, Eye, Filter, PackageSearch, Search, X } from "lucide-react";
import { usePurchaseOnOrderItems } from "@/hooks/usePurchaseOnOrder";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientOnly } from "@/components/shared/ClientOnly";
import { StatusText } from "@/components/shared/StatusText";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
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
import type { PurchaseOnOrderStatus } from "@/types/purchase-on-order";
import type { Supplier } from "@/types/supplier";

export default function PurchaseOnOrderPage() {
  const t = useTranslations("purchaseOnOrderPage");
  const locale = useLocale();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PurchaseOnOrderStatus | "all">("all");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [expectedFrom, setExpectedFrom] = useState("");
  const [expectedTo, setExpectedTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const debouncedSupplierSearch = useDebouncedValue(supplierSearch.trim(), 300);

  const { data: suppliersData, isLoading: isSuppliersLoading } = useSuppliers({
    page: 1,
    limit: 10,
    search: debouncedSupplierSearch || undefined,
    sort: "name",
  });
  const suppliers = suppliersData?.data || [];
  const { data, isLoading, error } = usePurchaseOnOrderItems({
    search,
    status: statusFilter,
    supplierId: supplierFilter || undefined,
    expectedFrom: expectedFrom || undefined,
    expectedTo: expectedTo || undefined,
    page,
    limit: pageSize,
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    if (data?.pagination.page && data.pagination.page !== page) {
      setPage(data.pagination.page);
    }
  }, [data?.pagination.page, page]);

  const formatDate = (value?: string | null) => {
    if (!value) return t("noValue");
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "2-digit",
      year: "numeric",
    }).format(new Date(value));
  };

  const formatQty = (value: number) =>
    new Intl.NumberFormat(locale, {
      maximumFractionDigits: 2,
    }).format(value);

  const renderStatus = (status: PurchaseOnOrderStatus) => {
    if (status === "partially_received") {
      return <StatusText tone="yellow">{t("partiallyReceived")}</StatusText>;
    }

    return <StatusText tone="blue">{t("awaitingDelivery")}</StatusText>;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="whitespace-nowrap text-lg font-semibold tracking-tight sm:text-xl">
            {t("title")}
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">{t("subtitle")}</p>
        </div>
      </div>

      <div className="space-y-3 sm:space-y-4">
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_repeat(4,12rem)]">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("searchPlaceholder")}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="pl-8"
            />
          </div>
          <ClientOnly fallback={<Skeleton className="h-10 w-full" />}>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as PurchaseOnOrderStatus | "all");
                setPage(1);
              }}
            >
              <SelectTrigger>
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder={t("statusPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allStatus")}</SelectItem>
                <SelectItem value="awaiting_delivery">{t("awaitingDelivery")}</SelectItem>
                <SelectItem value="partially_received">{t("partiallyReceived")}</SelectItem>
              </SelectContent>
            </Select>
          </ClientOnly>
          <ClientOnly fallback={<Skeleton className="h-10 w-full" />}>
            <div className="flex min-w-0 gap-2">
              <AsyncSearchCombobox
                value={supplierFilter}
                onValueChange={(value) => {
                  const supplier =
                    suppliers.find((option) => option.id === value) ||
                    (selectedSupplier?.id === value ? selectedSupplier : null);
                  setSupplierFilter(value);
                  setSelectedSupplier(supplier);
                  setPage(1);
                }}
                searchValue={supplierSearch}
                onSearchValueChange={setSupplierSearch}
                options={suppliers}
                selectedOption={selectedSupplier}
                getOptionValue={(supplier) => supplier.id}
                getOptionLabel={(supplier) => supplier.name}
                getOptionSearchValue={(supplier) => `${supplier.code} ${supplier.name}`}
                placeholder={t("allSuppliers")}
                searchPlaceholder={t("searchSupplier")}
                emptyMessage={t("noSuppliersFound")}
                loadingMessage={t("loadingSuppliers")}
                isLoading={isSuppliersLoading}
              />
              {supplierFilter ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={t("clearSupplier")}
                  onClick={() => {
                    setSupplierFilter("");
                    setSelectedSupplier(null);
                    setSupplierSearch("");
                    setPage(1);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </ClientOnly>
          <div className="relative">
            <CalendarDays className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={expectedFrom}
              onChange={(event) => {
                setExpectedFrom(event.target.value);
                setPage(1);
              }}
              className="pl-8"
              aria-label={t("expectedFrom")}
            />
          </div>
          <div className="relative">
            <CalendarDays className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={expectedTo}
              onChange={(event) => {
                setExpectedTo(event.target.value);
                setPage(1);
              }}
              className="pl-8"
              aria-label={t("expectedTo")}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="max-h-[calc(100vh-360px)] overflow-auto rounded-md border">
            <Table className="min-w-[1000px]">
              <OnOrderTableHeader />
              <TableBody>
                {[...Array(8)].map((_, index) => (
                  <TableRow key={index}>
                    {[...Array(8)].map((__, cellIndex) => (
                      <TableCell key={cellIndex}>
                        <Skeleton className="h-4 w-full max-w-28" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : error ? (
          <div className="rounded-md border py-8 text-center text-destructive">
            {t("loadError")}
          </div>
        ) : !data?.data.length ? (
          <div className="rounded-md border py-12 text-center">
            <PackageSearch className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">{t("emptyTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("emptyDescription")}</p>
          </div>
        ) : (
          <>
            <div className="max-h-[calc(100vh-360px)] overflow-auto rounded-md border">
              <Table className="min-w-[1000px]">
                <OnOrderTableHeader />
                <TableBody>
                  {data.data.map((row) => (
                    <TableRow key={row.srItemId}>
                      <TableCell>
                        <div className="font-medium">{row.supplierName}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.supplierCode || t("noValue")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/purchasing/stock-requisitions/${row.srId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {row.srNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{row.itemName}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.itemCode || t("noValue")}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatQty(row.orderedQty)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatQty(row.receivedQty)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatQty(row.outstandingQty)}
                      </TableCell>
                      <TableCell>{formatDate(row.expectedDelivery)}</TableCell>
                      <TableCell>{renderStatus(row.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/purchasing/stock-requisitions/${row.srId}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            {t("view")}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DataTablePagination
              currentPage={page}
              totalPages={data.pagination.totalPages}
              pageSize={pageSize}
              totalItems={data.pagination.total}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

function OnOrderTableHeader() {
  const t = useTranslations("purchaseOnOrderPage");

  return (
    <TableHeader className="sticky top-0 z-10 bg-background">
      <TableRow>
        <TableHead>{t("supplier")}</TableHead>
        <TableHead>{t("srNumber")}</TableHead>
        <TableHead>{t("item")}</TableHead>
        <TableHead className="text-right">{t("ordered")}</TableHead>
        <TableHead className="text-right">{t("received")}</TableHead>
        <TableHead className="text-right">{t("outstanding")}</TableHead>
        <TableHead>{t("expectedDelivery")}</TableHead>
        <TableHead>{t("status")}</TableHead>
        <TableHead className="text-right">{t("actions")}</TableHead>
      </TableRow>
    </TableHeader>
  );
}
