"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertCircle, ChevronRight, PackageSearch, Search, Truck } from "lucide-react";
import { useStockInTransit } from "@/hooks/useStockInTransit";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import { RESOURCES } from "@/constants/resources";
import { ProtectedRoute } from "@/components/permissions/ProtectedRoute";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { EmptyStatePanel } from "@/components/shared/EmptyStatePanel";
import { MetricCard } from "@/components/shared/MetricCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  const tNavigation = useTranslations("navigation");
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
    <div className="flex h-full min-h-0 flex-col gap-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/inventory/items" className="hover:text-foreground">
            {tNavigation("Inventory")}
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span>{t("title")}</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
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

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-6">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-9"
              aria-label={t("searchLabel")}
            />
          </div>

          {stockInTransitQuery.error ? (
            <div className="flex min-h-64 flex-1 items-center justify-center text-center">
              <div>
                <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
                <h2 className="mb-2 text-lg font-semibold">{t("loadErrorTitle")}</h2>
                <p className="mb-4 text-muted-foreground">{t("loadErrorMessage")}</p>
                <Button variant="outline" onClick={() => stockInTransitQuery.refetch()}>
                  {t("retry")}
                </Button>
              </div>
            </div>
          ) : isLoading || stockInTransitQuery.isFetching ? (
            <div className="min-h-0 flex-1 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {Array.from({ length: 8 }).map((_, index) => (
                      <TableHead key={index}>
                        <Skeleton className="h-4 w-20" />
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 8 }).map((_, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {Array.from({ length: 8 }).map((__, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex min-h-64 flex-1 items-center justify-center">
              <EmptyStatePanel
                icon={Truck}
                title={search ? t("noSearchResultsTitle") : t("emptyTitle")}
                description={search ? t("noSearchResultsDescription") : t("emptyDescription")}
              />
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead>{t("loadList")}</TableHead>
                      <TableHead>{t("item")}</TableHead>
                      <TableHead>{t("supplier")}</TableHead>
                      <TableHead>{t("sourceBusinessUnit")}</TableHead>
                      <TableHead>{t("shipmentReference")}</TableHead>
                      <TableHead>{t("estimatedArrival")}</TableHead>
                      <TableHead className="text-right">{t("shipmentQuantity")}</TableHead>
                      <TableHead className="text-right">{t("baseQuantity")}</TableHead>
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
                          <div className="max-w-sm text-sm text-muted-foreground">
                            {row.itemName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{row.supplierName}</div>
                          <div className="text-sm text-muted-foreground">{row.supplierCode}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{row.sourceBusinessUnitName}</div>
                          <div className="text-sm text-muted-foreground">
                            {row.sourceBusinessUnitCode}
                          </div>
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
                        <TableCell className="text-right">
                          {formatQuantity(row.loadListQuantity, locale)} {row.unitName}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatQuantity(row.baseQuantity, locale)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DataTablePagination
                currentPage={pagination?.page ?? page}
                totalPages={pagination?.totalPages ?? 1}
                pageSize={pagination?.limit ?? pageSize}
                totalItems={pagination?.total ?? 0}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[10, 25, 50]}
              />
            </>
          )}
        </CardContent>
      </Card>
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
