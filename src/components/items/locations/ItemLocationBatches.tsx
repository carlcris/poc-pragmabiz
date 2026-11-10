"use client";

import { useState } from "react";
import { format as formatDate } from "date-fns";
import { cn } from "@/lib/utils";
import { useCanEdit } from "@/hooks/usePermissions";
import { RESOURCES } from "@/constants/resources";
import { ItemBatchExpirationDialog } from "./ItemBatchExpirationDialog";
import { useFormatter, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { ITEM_LOCATIONS_QUERY_KEY } from "@/hooks/queryKeys";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
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
import type { ItemLocation, ItemLocationBatch } from "@/types/inventory-location";

const BATCH_PAGE_SIZE = 20;

type ItemLocationBatchesProps = {
  itemId: string;
  locationId: string;
  canPrint: boolean;
  printDisabled: boolean;
  onPrint: (batch: ItemLocationBatch) => void;
};

// Batches stored directly at one location, oldest first, 20 per page.
export function ItemLocationBatches({
  itemId,
  locationId,
  canPrint,
  printDisabled,
  onPrint,
}: ItemLocationBatchesProps) {
  const [page, setPage] = useState(1);
  const [editingBatch, setEditingBatch] = useState<ItemLocationBatch | null>(null);
  const canEdit = useCanEdit(RESOURCES.ITEMS);
  const hasActions = canPrint || canEdit;
  const t = useTranslations("itemLocationsTab");
  const common = useTranslations("common");
  const format = useFormatter();
  const today = formatDate(new Date(), "yyyy-MM-dd");
  const businessUnitId = useBusinessUnitStore((state) => state.currentBusinessUnit?.id);
  const query = useQuery<{ data: ItemLocation[] }>({
    queryKey: [ITEM_LOCATIONS_QUERY_KEY, itemId, businessUnitId, locationId, page],
    queryFn: () =>
      apiClient.get(`/api/items/${itemId}/locations`, {
        params: { locationId, batchPage: page, limit: 1 },
      }),
  });
  const location = query.data?.data[0];
  const batches = location?.batches ?? [];
  const batchCount = location?.batchCount ?? 0;
  const pageSize = location?.batchPageSize ?? BATCH_PAGE_SIZE;

  return (
    <div className="space-y-3">
      {query.isError ? <p className="text-sm text-destructive">{t("loadError")}</p> : null}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">{t("batchCode")}</TableHead>
              <TableHead className="whitespace-nowrap px-3">{t("receivedDate")}</TableHead>
              <TableHead className="whitespace-nowrap px-3">{t("expirationDate")}</TableHead>
              <TableHead className="whitespace-nowrap px-3 text-right">{t("onHand")}</TableHead>
              <TableHead className="whitespace-nowrap px-3 text-right">{t("reserved")}</TableHead>
              <TableHead className="whitespace-nowrap px-3 text-right">{t("available")}</TableHead>
              {hasActions ? (
                <TableHead className="whitespace-nowrap px-3 text-right">
                  {common("actions")}
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading
              ? Array.from({ length: 2 }, (_, index) => (
                  <TableRow key={`batch-skeleton-${index}`}>
                    <TableCell colSpan={hasActions ? 7 : 6}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              : batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="whitespace-nowrap font-medium">
                      {batch.batchCode}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3">
                      {format.dateTime(new Date(batch.receivedAt))}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "whitespace-nowrap px-3",
                        batch.expirationDate && batch.expirationDate < today && "text-destructive"
                      )}
                    >
                      {batch.expirationDate
                        ? format.dateTime(new Date(`${batch.expirationDate}T00:00:00Z`), {
                            timeZone: "UTC",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3 text-right tabular-nums">
                      {format.number(batch.qtyOnHand)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3 text-right tabular-nums">
                      {format.number(batch.qtyReserved)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3 text-right tabular-nums">
                      {format.number(batch.qtyAvailable)}
                    </TableCell>
                    {hasActions ? (
                      <TableCell className="whitespace-nowrap px-3 text-right">
                        <div className="flex justify-end gap-1">
                          {canEdit ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="px-2"
                              onClick={() => setEditingBatch(batch)}
                            >
                              {t("editExpiration")}
                            </Button>
                          ) : null}
                          {canPrint ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="px-2"
                              disabled={printDisabled}
                              onClick={() => onPrint(batch)}
                            >
                              {t("printBatchQr")}
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
      {canEdit && editingBatch ? (
        <ItemBatchExpirationDialog
          itemId={itemId}
          batch={editingBatch}
          onClose={() => setEditingBatch(null)}
        />
      ) : null}
      {batchCount > pageSize ? (
        <DataTablePagination
          currentPage={page}
          totalPages={Math.ceil(batchCount / pageSize)}
          pageSize={pageSize}
          totalItems={batchCount}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}
