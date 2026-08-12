"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  InventoryReservationQuantity,
  InventoryReservationStatusText,
  InventoryReservationUpdatedAt,
} from "@/components/inventory-reservations/InventoryReservationCells";
import { useInventoryReservationAllocations } from "@/hooks/useInventoryReservations";
import type { InventoryReservationRow } from "@/types/inventory-reservations";

const ALLOCATION_LIMIT = 50;

type InventoryReservationAllocationTableProps = {
  reservation: InventoryReservationRow;
  businessUnitId?: string;
};

export function InventoryReservationAllocationTable({
  reservation,
  businessUnitId,
}: InventoryReservationAllocationTableProps) {
  const t = useTranslations("inventoryReservationsPage");
  const { data, isLoading, isError, refetch } = useInventoryReservationAllocations(
    reservation.reservationId,
    1,
    ALLOCATION_LIMIT,
    { enabled: Boolean(businessUnitId), businessUnitId }
  );

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-between gap-4 p-4 text-sm text-red-700">
        <span>{t("allocationsLoadError")}</span>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  const allocations = data?.data ?? [];

  if (allocations.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">{t("noAllocations")}</div>;
  }

  return (
    <div className="border-t bg-muted/30 p-6">
      <div className="overflow-x-auto rounded-lg border bg-background shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-b bg-muted/50">
              <TableHead className="py-3 font-semibold">{t("allocationOwner")}</TableHead>
              <TableHead className="py-3 font-semibold">{t("batch")}</TableHead>
              <TableHead className="py-3 font-semibold">{t("location")}</TableHead>
              <TableHead className="py-3 text-right font-semibold">{t("allocated")}</TableHead>
              <TableHead className="py-3 text-right font-semibold">{t("consumed")}</TableHead>
              <TableHead className="py-3 text-right font-semibold">{t("released")}</TableHead>
              <TableHead className="py-3 font-semibold">{t("statusLabel")}</TableHead>
              <TableHead className="py-3 font-semibold">{t("updated")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allocations.map((allocation) => (
              <TableRow key={allocation.allocationId} className="hover:bg-muted/30">
                <TableCell className="py-3">
                  <div className="font-semibold">{allocation.ownerReference}</div>
                  <div className="text-xs text-muted-foreground">
                    {allocation.ownerType === "pick_list"
                      ? t("allocationOwnerPickList")
                      : t("allocationOwnerTransformation")}
                  </div>
                </TableCell>
                <TableCell className="py-3">
                  <span className="font-medium">{allocation.batchCode}</span>
                </TableCell>
                <TableCell className="py-3">
                  <div className="font-medium">{allocation.locationCode}</div>
                  <div className="text-xs text-muted-foreground">
                    {allocation.locationName || allocation.locationSku}
                  </div>
                  {allocation.locationName ? (
                    <div className="text-xs text-muted-foreground">{allocation.locationSku}</div>
                  ) : null}
                </TableCell>
                <TableCell className="py-3">
                  <InventoryReservationQuantity
                    value={allocation.quantityBase}
                    unit={reservation.uomCode}
                  />
                </TableCell>
                <TableCell className="py-3">
                  <InventoryReservationQuantity
                    value={allocation.consumedBase}
                    unit={reservation.uomCode}
                  />
                </TableCell>
                <TableCell className="py-3">
                  <InventoryReservationQuantity
                    value={allocation.releasedBase}
                    unit={reservation.uomCode}
                  />
                </TableCell>
                <TableCell className="py-3">
                  <InventoryReservationStatusText status={allocation.status} />
                </TableCell>
                <TableCell className="py-3">
                  <InventoryReservationUpdatedAt value={allocation.updatedAt} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
