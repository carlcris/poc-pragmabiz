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
import { CalendarClock, MoreVertical, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

  const formatExpiration = (batch: ItemLocationBatch) =>
    batch.expirationDate
      ? format.dateTime(new Date(`${batch.expirationDate}T00:00:00Z`), { timeZone: "UTC" })
      : "—";
  const isExpired = (batch: ItemLocationBatch) =>
    Boolean(batch.expirationDate && batch.expirationDate < today);

  // Edit Expiration and Print QR share one row menu so the table fits the side panel.
  const renderRowActions = (batch: ItemLocationBatch) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-11 w-11 shrink-0 p-0 lg:h-8 lg:w-8"
          aria-label={t("moreBatchActions")}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {canEdit ? (
          <DropdownMenuItem className="max-lg:min-h-11" onClick={() => setEditingBatch(batch)}>
            <CalendarClock className="h-4 w-4" />
            {t("editExpiration")}
          </DropdownMenuItem>
        ) : null}
        {canPrint ? (
          <DropdownMenuItem
            className="max-lg:min-h-11"
            disabled={printDisabled}
            onClick={() => onPrint(batch)}
          >
            <QrCode className="h-4 w-4" />
            {t("printBatchQr")}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderDates = (batch: ItemLocationBatch) => (
    <span className="block text-xs text-muted-foreground">
      {t("receivedDate")} {format.dateTime(new Date(batch.receivedAt))} · {t("expirationDate")}{" "}
      <span className={cn(isExpired(batch) && "text-destructive")}>{formatExpiration(batch)}</span>
    </span>
  );

  return (
    <div className="space-y-3">
      {query.isError ? <p className="text-sm text-destructive">{t("loadError")}</p> : null}
      {/* Below lg the batch panel is narrow, so batches stack; page size is 20, so both
          layouts render and CSS picks one. */}
      <ul className="divide-y rounded-md border lg:hidden">
        {query.isLoading
          ? Array.from({ length: 2 }, (_, index) => (
              <li key={`batch-skeleton-${index}`} className="p-3">
                <Skeleton className="h-10 w-full" />
              </li>
            ))
          : batches.map((batch) => (
              <li key={batch.id} className="flex items-start gap-2 p-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <span className="block break-words text-sm font-medium">{batch.batchCode}</span>
                    {renderDates(batch)}
                  </div>
                  <dl className="grid grid-cols-3 gap-2 tabular-nums">
                    <div>
                      <dt className="text-xs text-muted-foreground">{t("onHand")}</dt>
                      <dd className="text-sm font-medium">{format.number(batch.qtyOnHand)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">{t("reserved")}</dt>
                      <dd className="text-sm font-medium">{format.number(batch.qtyReserved)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">{t("available")}</dt>
                      <dd className="text-sm font-semibold">{format.number(batch.qtyAvailable)}</dd>
                    </div>
                  </dl>
                </div>
                {hasActions ? <div className="-mr-2 -mt-2">{renderRowActions(batch)}</div> : null}
              </li>
            ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-md border lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("batchCode")}</TableHead>
              <TableHead className="whitespace-nowrap px-3 text-right">{t("onHand")}</TableHead>
              <TableHead className="whitespace-nowrap px-3 text-right">{t("reserved")}</TableHead>
              <TableHead className="whitespace-nowrap px-3 text-right">{t("available")}</TableHead>
              {hasActions ? (
                <TableHead className="w-12 px-2">
                  <span className="sr-only">{common("actions")}</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading
              ? Array.from({ length: 2 }, (_, index) => (
                  <TableRow key={`batch-skeleton-${index}`}>
                    <TableCell colSpan={hasActions ? 5 : 4}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              : batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="py-3">
                      <span className="block font-medium">{batch.batchCode}</span>
                      {renderDates(batch)}
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
                      <TableCell className="px-2 text-right">{renderRowActions(batch)}</TableCell>
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
