"use client";

import { Fragment, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, LockKeyhole, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { RESOURCES } from "@/constants/resources";
import { ProtectedRoute } from "@/components/permissions/ProtectedRoute";
import { InventoryReservationAllocationTable } from "@/components/inventory-reservations/InventoryReservationAllocationTable";
import {
  InventoryReservationQuantity,
  InventoryReservationStatusText,
  InventoryReservationUpdatedAt,
} from "@/components/inventory-reservations/InventoryReservationCells";
import { WarehouseSelect } from "@/components/warehouses/WarehouseSelect";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useInventoryReservations } from "@/hooks/useInventoryReservations";
import { usePermissions } from "@/hooks/usePermissions";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import type {
  InventoryReservationSortField,
  InventoryReservationSortOrder,
  InventoryReservationSourceType,
  InventoryReservationStatus,
} from "@/types/inventory-reservations";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

function InventoryReservationsContent() {
  const t = useTranslations("inventoryReservationsPage");
  const currentBusinessUnit = useBusinessUnitStore((state) => state.currentBusinessUnit);
  const hasHydrated = useBusinessUnitStore((state) => state.hasHydrated);
  const { canView, isLoading: permissionsLoading } = usePermissions();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [status, setStatus] = useState<InventoryReservationStatus | "all">("all");
  const [sourceType, setSourceType] = useState<InventoryReservationSourceType | "all">("all");
  const [warehouseId, setWarehouseId] = useState("");
  const [sortBy, setSortBy] = useState<InventoryReservationSortField>("updated_at");
  const [sortOrder, setSortOrder] = useState<InventoryReservationSortOrder>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [expandedReservationId, setExpandedReservationId] = useState<string | null>(null);

  const canViewReservations = canView(RESOURCES.INVENTORY_RESERVATIONS);
  const queryEnabled =
    hasHydrated && Boolean(currentBusinessUnit?.id) && !permissionsLoading && canViewReservations;

  const { data, isLoading, isError, isFetching, refetch } = useInventoryReservations(
    {
      search: debouncedSearch || undefined,
      sourceType: sourceType === "all" ? undefined : sourceType,
      status: status === "all" ? undefined : status,
      warehouseId: warehouseId || undefined,
      sortBy,
      sortOrder,
      page,
      limit: pageSize,
    },
    { enabled: queryEnabled, businessUnitId: currentBusinessUnit?.id }
  );

  useEffect(() => {
    setSearch("");
    setStatus("all");
    setSourceType("all");
    setWarehouseId("");
    setPage(1);
    setExpandedReservationId(null);
  }, [currentBusinessUnit?.id]);

  const reservations = data?.data ?? [];
  const pagination = data?.pagination;
  const showSkeleton = permissionsLoading || !hasHydrated || (queryEnabled && isLoading);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="reservation-search"
            value={search}
            aria-label={t("searchLabel")}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder={t("searchPlaceholder")}
            className="h-10 pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2 lg:flex-nowrap">
          <div className="w-full sm:w-48">
            <WarehouseSelect
              value={warehouseId}
              onValueChange={(value) => {
                setWarehouseId(value);
                setPage(1);
              }}
              scope="current_business_unit"
              allowAll
              allOptionLabel={t("allWarehouses")}
              disabled={!queryEnabled}
              buttonClassName="w-full"
            />
          </div>

          <div className="w-full sm:w-48">
            <Select
              value={sourceType}
              onValueChange={(value) => {
                setSourceType(value as InventoryReservationSourceType | "all");
                setPage(1);
              }}
              disabled={!queryEnabled}
            >
              <SelectTrigger aria-label={t("sourceTypeFilter")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allSourceTypes")}</SelectItem>
                <SelectItem value="delivery_note">{t("sourceDeliveryNote")}</SelectItem>
                <SelectItem value="sales_order">{t("sourceSalesOrder")}</SelectItem>
                <SelectItem value="transformation_order">{t("sourceTransformation")}</SelectItem>
                <SelectItem value="frame_job_order">{t("sourceFrameJobOrder")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-40">
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value as InventoryReservationStatus | "all");
                setPage(1);
              }}
              disabled={!queryEnabled}
            >
              <SelectTrigger aria-label={t("statusFilter")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allStatuses")}</SelectItem>
                <SelectItem value="active">{t("status.active")}</SelectItem>
                <SelectItem value="partial">{t("status.partial")}</SelectItem>
                <SelectItem value="consumed">{t("status.consumed")}</SelectItem>
                <SelectItem value="released">{t("status.released")}</SelectItem>
                <SelectItem value="transferred">{t("status.transferred")}</SelectItem>
                <SelectItem value="closed">{t("status.closed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-40">
            <Select
              value={sortBy}
              onValueChange={(value) => {
                setSortBy(value as InventoryReservationSortField);
                setPage(1);
              }}
              disabled={!queryEnabled}
            >
              <SelectTrigger aria-label={t("sortBy")} className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated_at">{t("updated")}</SelectItem>
                <SelectItem value="source_reference">{t("source")}</SelectItem>
                <SelectItem value="item_code">{t("item")}</SelectItem>
                <SelectItem value="warehouse_code">{t("warehouse")}</SelectItem>
                <SelectItem value="status">{t("statusLabel")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-32">
            <Select
              value={sortOrder}
              onValueChange={(value) => {
                setSortOrder(value as InventoryReservationSortOrder);
                setPage(1);
              }}
              disabled={!queryEnabled}
            >
              <SelectTrigger aria-label={t("sortOrder")} className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">{t("descending")}</SelectItem>
                <SelectItem value="asc">{t("ascending")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <LockKeyhole className="h-10 w-10 text-red-600" />
            <div>
              <h2 className="font-semibold">{t("loadErrorTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("loadErrorDescription")}</p>
            </div>
            <Button variant="outline" onClick={() => refetch()}>
              {t("retry")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-b bg-muted/40">
                  <TableHead className="w-12 py-3">
                    <span className="sr-only">{t("allocationDetails")}</span>
                  </TableHead>
                  <TableHead className="py-3 font-semibold">{t("source")}</TableHead>
                  <TableHead className="py-3 font-semibold">{t("item")}</TableHead>
                  <TableHead className="py-3 font-semibold">{t("warehouse")}</TableHead>
                  <TableHead className="py-3 text-right font-semibold">{t("committed")}</TableHead>
                  <TableHead className="py-3 text-right font-semibold">
                    {t("physicallyAllocated")}
                  </TableHead>
                  <TableHead className="py-3 text-right font-semibold">{t("consumed")}</TableHead>
                  <TableHead className="py-3 text-right font-semibold">{t("released")}</TableHead>
                  <TableHead className="py-3 font-semibold">{t("statusLabel")}</TableHead>
                  <TableHead className="py-3 font-semibold">{t("updated")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {showSkeleton
                  ? Array.from({ length: 5 }, (_, index) => (
                      <TableRow key={index}>
                        {Array.from({ length: 10 }, (__, cellIndex) => (
                          <TableCell key={cellIndex}>
                            <Skeleton className="h-5 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : reservations.map((reservation) => {
                      const isExpanded = expandedReservationId === reservation.reservationId;
                      return (
                        <Fragment key={reservation.reservationId}>
                          <TableRow className="hover:bg-muted/50">
                            <TableCell className="py-4">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  setExpandedReservationId(
                                    isExpanded ? null : reservation.reservationId
                                  )
                                }
                                aria-label={
                                  isExpanded ? t("hideAllocations") : t("showAllocations")
                                }
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell className="py-4 font-medium">
                              <div className="font-semibold">{reservation.sourceReference}</div>
                              <div className="text-xs font-normal text-muted-foreground">
                                {reservation.sourceType === "delivery_note"
                                  ? t("sourceDeliveryNote")
                                  : reservation.sourceType === "sales_order"
                                    ? t("sourceSalesOrder")
                                    : reservation.sourceType === "transformation_order"
                                      ? t("sourceTransformation")
                                      : t("sourceFrameJobOrder")}
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="font-medium">{reservation.itemCode}</div>
                              <div className="max-w-xs truncate text-xs text-muted-foreground">
                                {reservation.itemName}
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="font-medium">{reservation.warehouseCode}</div>
                              <div className="text-xs text-muted-foreground">
                                {reservation.warehouseName}
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <InventoryReservationQuantity
                                value={reservation.committedQuantityBase}
                                unit={reservation.uomCode}
                              />
                            </TableCell>
                            <TableCell className="py-4">
                              <InventoryReservationQuantity
                                value={reservation.physicallyAllocatedBase}
                                unit={reservation.uomCode}
                              />
                            </TableCell>
                            <TableCell className="py-4">
                              <InventoryReservationQuantity
                                value={reservation.consumedBase}
                                unit={reservation.uomCode}
                              />
                            </TableCell>
                            <TableCell className="py-4">
                              <InventoryReservationQuantity
                                value={reservation.releasedBase}
                                unit={reservation.uomCode}
                              />
                            </TableCell>
                            <TableCell className="py-4">
                              <InventoryReservationStatusText status={reservation.status} />
                            </TableCell>
                            <TableCell className="py-4">
                              <InventoryReservationUpdatedAt value={reservation.updatedAt} />
                            </TableCell>
                          </TableRow>
                          {isExpanded ? (
                            <TableRow>
                              <TableCell colSpan={10} className="p-0">
                                <InventoryReservationAllocationTable
                                  reservation={reservation}
                                  businessUnitId={currentBusinessUnit?.id}
                                />
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </Fragment>
                      );
                    })}
              </TableBody>
            </Table>
          </div>

          {!showSkeleton && reservations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <LockKeyhole className="h-10 w-10 text-muted-foreground" />
                <div>
                  <h2 className="font-semibold">{t("emptyTitle")}</h2>
                  <p className="text-sm text-muted-foreground">{t("emptyDescription")}</p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {pagination && pagination.total > 0 ? (
            <DataTablePagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              pageSize={pagination.limit}
              totalItems={pagination.total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
            />
          ) : null}

          {isFetching && !showSkeleton ? (
            <p className="text-right text-xs text-muted-foreground">{t("refreshing")}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function InventoryReservationsPage() {
  return (
    <ProtectedRoute resource={RESOURCES.INVENTORY_RESERVATIONS} allowRenderWhileLoading>
      <InventoryReservationsContent />
    </ProtectedRoute>
  );
}
