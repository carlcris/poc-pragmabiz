"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PackageSearch, Search, Truck } from "lucide-react";
import { useStockInTransit } from "@/hooks/useStockInTransit";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import { RESOURCES } from "@/constants/resources";
import { ProtectedRoute } from "@/components/permissions/ProtectedRoute";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { EmptyStatePanel } from "@/components/shared/EmptyStatePanel";
import { MetricCard } from "@/components/shared/MetricCard";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const formatQuantity = (value: number, locale: string) =>
  new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

const formatDate = (value: string | null, locale: string, emptyValue: string) => {
  if (!value) return emptyValue;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
};

function StockInTransitPageContent() {
  const t = useTranslations("stockInTransitPage");
  const locale = useLocale();
  const currentBusinessUnit = useBusinessUnitStore((state) => state.currentBusinessUnit);
  const hasBusinessUnitHydrated = useBusinessUnitStore((state) => state.hasHydrated);
  const isBusinessUnitLoading = useBusinessUnitStore((state) => state.isLoading);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [currentBusinessUnit?.id]);

  const isEnabled =
    hasBusinessUnitHydrated && !isBusinessUnitLoading && Boolean(currentBusinessUnit?.id);
  const stockInTransitQuery = useStockInTransit(
    { search: search || undefined, page, limit: pageSize },
    { enabled: isEnabled, businessUnitId: currentBusinessUnit?.id }
  );
  const rows = stockInTransitQuery.data?.data ?? [];
  const pagination = stockInTransitQuery.data?.pagination;
  const isLoading = !isEnabled || stockInTransitQuery.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="whitespace-nowrap text-lg font-semibold tracking-tight sm:text-xl">
            {t("title")}
          </h1>
          <p className="whitespace-nowrap text-xs text-muted-foreground sm:text-sm">
            {t("subtitle")}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <MetricCard
          title={t("shipmentLines")}
          icon={Truck}
          value={formatQuantity(pagination?.total ?? 0, locale)}
          isLoading={isLoading}
        />
        <MetricCard
          title={t("totalBaseQuantity")}
          icon={PackageSearch}
          value={formatQuantity(stockInTransitQuery.data?.summary.totalBaseQuantity ?? 0, locale)}
          isLoading={isLoading}
        />
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
        </div>

        {isLoading ? (
          <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>{t("loadList")}</TableHead>
                  <TableHead>{t("item")}</TableHead>
                  <TableHead>{t("supplier")}</TableHead>
                  <TableHead>{t("shipment")}</TableHead>
                  <TableHead>{t("estimatedArrival")}</TableHead>
                  <TableHead className="text-right">{t("shipmentQuantity")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(8)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-36" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-4 w-20" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : stockInTransitQuery.error ? (
          <div className="py-8 text-center text-destructive">{t("loadingError")}</div>
        ) : rows.length === 0 ? (
          <EmptyStatePanel
            icon={Truck}
            title={search ? t("noSearchResultsTitle") : t("emptyTitle")}
            description={search ? t("noSearchResultsDescription") : t("emptyDescription")}
          />
        ) : (
          <>
            <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>{t("loadList")}</TableHead>
                    <TableHead>{t("item")}</TableHead>
                    <TableHead>{t("supplier")}</TableHead>
                    <TableHead>{t("shipment")}</TableHead>
                    <TableHead>{t("estimatedArrival")}</TableHead>
                    <TableHead className="text-right">{t("shipmentQuantity")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link
                          href={`/purchasing/load-lists/${row.loadListId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {row.loadListNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/inventory/items/${row.itemId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {row.itemCode}
                        </Link>
                        <div className="max-w-sm text-sm text-muted-foreground">{row.itemName}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{row.supplierName}</div>
                      </TableCell>
                      <TableCell>
                        <div>{row.containerNumber || t("notAvailable")}</div>
                        <div className="text-sm text-muted-foreground">
                          {row.linerName || t("notAvailable")}
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatDate(row.estimatedArrivalDate, locale, t("notAvailable"))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatQuantity(row.loadListQuantity, locale)} {row.unitName}
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
                  pageSizeOptions={[10, 25, 50]}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function StockInTransitPage() {
  return (
    <ProtectedRoute resource={RESOURCES.ITEMS}>
      <StockInTransitPageContent />
    </ProtectedRoute>
  );
}
