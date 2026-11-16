"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, Check, Eye, PackageSearch, Search, X } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { StatusTextTone } from "@/components/shared/StatusText";
import type { PurchaseOnOrderStatus } from "@/types/purchase-on-order";
import type { Supplier } from "@/types/supplier";

const ON_ORDER_COLUMN_COUNT = 8;
// The table keeps its own horizontal and vertical scrolling on the panel alone,
// so long lists scroll inside the bordered container that the sticky header
// positions against. The eight columns size to their own content, so no minimum
// table width is needed. The height subtracts the page chrome above the table,
// which the Tailwind max-height scale cannot express; the value matches the
// list-page convention used elsewhere in the app.
const ON_ORDER_TABLE_CONTAINER_CLASS_NAME = "max-h-[calc(100vh-400px)] rounded-md border";
const ON_ORDER_STATUSES: readonly PurchaseOnOrderStatus[] = [
  "awaiting_delivery",
  "partially_received",
];

const statusTone: Record<PurchaseOnOrderStatus, StatusTextTone> = {
  awaiting_delivery: "blue",
  partially_received: "yellow",
};

// Selected tints match each status tone so the chosen panel button reads as the
// same semantic color as the heading it drives.
const selectedStatusClassName: Record<PurchaseOnOrderStatus, string> = {
  awaiting_delivery:
    "border-blue-300 bg-blue-50 hover:bg-blue-50 dark:border-blue-800 dark:bg-blue-950/50 dark:hover:bg-blue-950/50",
  partially_received:
    "border-yellow-300 bg-yellow-50 hover:bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/50 dark:hover:bg-yellow-950/50",
};

const selectedStatusCountClassName: Record<PurchaseOnOrderStatus, string> = {
  awaiting_delivery:
    "border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-900/60 dark:text-blue-200",
  partially_received:
    "border-yellow-300 bg-yellow-100 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-200",
};

export default function PurchaseOnOrderPage() {
  const t = useTranslations("purchaseOnOrderPage");
  const locale = useLocale();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<PurchaseOnOrderStatus>("awaiting_delivery");
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
  const { data, isLoading, isPlaceholderData, error } = usePurchaseOnOrderItems({
    search,
    status: selectedStatus,
    supplierId: supplierFilter || undefined,
    expectedFrom: expectedFrom || undefined,
    expectedTo: expectedTo || undefined,
    page,
    limit: pageSize,
  });

  // Comparing the trimmed input with the applied search keeps an unchanged or
  // empty box from resetting the page the user is already on, including the
  // repeated first run under Strict Mode that a one-shot ref would consume.
  const trimmedSearchInput = searchInput.trim();
  useEffect(() => {
    if (trimmedSearchInput === search) return;

    const timeout = window.setTimeout(() => {
      setSearch(trimmedSearchInput);
      setPage(1);
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [trimmedSearchInput, search]);

  // Only follow the server's clamped page once the response matches the
  // requested filters. A placeholder response carries the page number of the
  // status or page the user just left, which would pull them back.
  useEffect(() => {
    if (isPlaceholderData) return;
    if (data?.pagination.page && data.pagination.page !== page) {
      setPage(data.pagination.page);
    }
  }, [data?.pagination.page, isPlaceholderData, page]);

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

  const formatCount = (value: number) => new Intl.NumberFormat(locale).format(value);

  const statusLabel = (status: PurchaseOnOrderStatus) =>
    status === "partially_received" ? t("partiallyReceived") : t("awaitingDelivery");

  const emptyDescription = (status: PurchaseOnOrderStatus) =>
    status === "partially_received"
      ? t("emptyPartiallyReceivedDescription")
      : t("emptyAwaitingDeliveryDescription");

  // A placeholder response is only served for the same business unit and the same
  // counted scope, so its counts still describe the current filters and can stay
  // on screen while a status or page loads. Its rows belong to the status or page
  // the user just left, so they are replaced by the table skeleton.
  const isLoadingRows = isLoading || isPlaceholderData;
  const statusCounts = data?.statusCounts;
  const rows = isLoadingRows ? [] : data?.data || [];

  // The server derives pagination from the selected status count and the page
  // limit, so the same arithmetic reproduces it from placeholder counts while a
  // status or page request is in flight. The placeholder's own pagination
  // describes the status the user just left and is never shown.
  const selectedStatusCount = statusCounts?.[selectedStatus];
  const serverPagination = isPlaceholderData ? undefined : data?.pagination;
  const totalItems = serverPagination?.total ?? selectedStatusCount;
  const totalPages =
    serverPagination?.totalPages ??
    (totalItems === undefined ? undefined : Math.ceil(totalItems / pageSize));
  // Keeping the pager mounted while a same-scope placeholder resolves preserves
  // keyboard focus on the control the user just activated.
  const showPagination = Boolean(totalItems) && (rows.length > 0 || isPlaceholderData);

  const handleSelectStatus = (status: PurchaseOnOrderStatus) => {
    if (status === selectedStatus) return;
    setSelectedStatus(status);
    setPage(1);
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

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <div className="relative sm:col-span-2 xl:col-span-2">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="pl-8"
          />
        </div>
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

      <div className="flex flex-col gap-4 lg:flex-row">
        <section
          aria-label={t("statusPanelLabel")}
          className="w-full shrink-0 space-y-3 lg:w-64"
        >
          {/* Both column headings reserve the same min-h-6 slot and sit in a
              space-y-3 section so the first status button and the table top
              start on the same line once the columns sit side by side. */}
          <h2 className="flex min-h-6 items-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("statusPanelLabel")}
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-1">
            {ON_ORDER_STATUSES.map((status) => {
              const isSelected = status === selectedStatus;
              const count = statusCounts?.[status];

              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleSelectStatus(status)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md border px-3 py-3 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isSelected
                      ? selectedStatusClassName[status]
                      : "border-border bg-background hover:bg-muted/60"
                  )}
                >
                  <Check
                    aria-hidden="true"
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isSelected ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <StatusText
                    tone={isSelected ? statusTone[status] : "muted"}
                    className={cn(
                      "min-w-0 flex-1 break-words",
                      isSelected && "font-semibold"
                    )}
                  >
                    {statusLabel(status)}
                  </StatusText>
                  {count === undefined && isLoading ? (
                    <Skeleton className="h-5 w-10 shrink-0 rounded-full" />
                  ) : (
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums",
                        isSelected
                          ? selectedStatusCountClassName[status]
                          : "border-border bg-muted text-muted-foreground"
                      )}
                    >
                      {count === undefined ? t("noValue") : formatCount(count)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section
          aria-labelledby="on-order-status-heading"
          aria-busy={isLoadingRows}
          className="w-full min-w-0 flex-1 space-y-3"
        >
          <h2 id="on-order-status-heading" className="flex min-h-6 items-center">
            <StatusText tone={statusTone[selectedStatus]} className="text-base font-semibold">
              {statusLabel(selectedStatus)}
            </StatusText>
          </h2>

          {error ? (
            <div className="rounded-md border py-8 text-center text-destructive">
              {t("loadError")}
            </div>
          ) : isLoadingRows ? (
            <Table containerClassName={ON_ORDER_TABLE_CONTAINER_CLASS_NAME}>
              <OnOrderTableHeader />
              <TableBody>
                {[...Array(8)].map((_, index) => (
                  <TableRow key={index}>
                    {[...Array(ON_ORDER_COLUMN_COUNT)].map((__, cellIndex) => (
                      <TableCell key={cellIndex}>
                        <Skeleton className="h-4 w-full max-w-28" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : !rows.length ? (
            <div className="rounded-md border py-12 text-center">
              <PackageSearch className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium">{t("emptyTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {emptyDescription(selectedStatus)}
              </p>
            </div>
          ) : (
            <Table containerClassName={ON_ORDER_TABLE_CONTAINER_CLASS_NAME}>
              <OnOrderTableHeader />
              <TableBody>
                {rows.map((row) => (
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
          )}

          {/* Rendered outside the content branches so clicking Next keeps keyboard
              focus on the pager while the next page resolves from a placeholder. */}
          {!error && showPagination ? (
            <DataTablePagination
              currentPage={page}
              totalPages={totalPages || 1}
              pageSize={pageSize}
              totalItems={totalItems || 0}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          ) : null}
        </section>
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
        <TableHead className="text-right">{t("actions")}</TableHead>
      </TableRow>
    </TableHeader>
  );
}
