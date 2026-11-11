"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ItemImage } from "@/components/items/ItemImage";
import {
  AnyPermissionGuard,
  DeleteGuard,
  EditGuard,
} from "@/components/permissions/PermissionGuard";
import { RESOURCES } from "@/constants/resources";
import type { ItemInventoryRow } from "@/types/item-inventory";

type InventoryItemMobileListProps = {
  items: ItemInventoryRow[];
  renderStatus: (status: ItemInventoryRow["status"]) => ReactNode;
  formatQuantity: (value: number) => number;
  onEditItem: (item: ItemInventoryRow) => void;
  onDeleteItem: (item: ItemInventoryRow) => void;
  isDeletePending: boolean;
};

/**
 * Phone layout of the inventory items list: one stacked row per item instead of the
 * 1240px table, with every table column kept. Edit and Delete live in the row menu.
 */
export function InventoryItemMobileList({
  items,
  renderStatus,
  formatQuantity,
  onEditItem,
  onDeleteItem,
  isDeletePending,
}: InventoryItemMobileListProps) {
  const t = useTranslations("itemsPage");
  const tCommon = useTranslations("common");

  return (
    <ul className="border-t">
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-2.5 border-b py-3">
          <div className="flex items-start gap-3">
            <Link
              href={`/inventory/items/${item.id}`}
              className="flex min-w-0 flex-1 items-start gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded border bg-muted">
                <ItemImage
                  src={item.imageUrl}
                  alt={item.name}
                  className="object-cover"
                  sizes="48px"
                />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="line-clamp-2 text-sm font-semibold text-violet-700 dark:text-violet-300">
                  {item.name}
                </span>
                {item.chineseName ? (
                  <span className="text-sm font-medium text-muted-foreground">
                    {item.chineseName}
                  </span>
                ) : null}
                <span className="text-xs tabular-nums text-muted-foreground">
                  {item.code} · {item.category} · {renderStatus(item.status)}
                </span>
              </span>
            </Link>
            <AnyPermissionGuard resource={RESOURCES.ITEMS} actions={["edit", "delete"]}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="-mr-2.5 -mt-1.5 h-11 w-11 shrink-0 p-0"
                    aria-label={t("moreActions")}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <EditGuard resource={RESOURCES.ITEMS}>
                    <DropdownMenuItem className="min-h-11" onClick={() => onEditItem(item)}>
                      <Pencil className="h-4 w-4" />
                      <span>{tCommon("edit")}</span>
                    </DropdownMenuItem>
                  </EditGuard>
                  <DeleteGuard resource={RESOURCES.ITEMS}>
                    <DropdownMenuItem
                      className="min-h-11 text-destructive focus:text-destructive"
                      onClick={() => onDeleteItem(item)}
                      disabled={isDeletePending}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>{tCommon("delete")}</span>
                    </DropdownMenuItem>
                  </DeleteGuard>
                </DropdownMenuContent>
              </DropdownMenu>
            </AnyPermissionGuard>
          </div>
          <dl className="grid grid-cols-4 gap-2 tabular-nums">
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">{t("onHand")}</dt>
              <dd className="text-sm font-medium">{formatQuantity(item.onHand)}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">{t("allocated")}</dt>
              <dd className="text-sm font-medium">{formatQuantity(item.allocated)}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">{t("putawayQty")}</dt>
              <dd className="text-sm font-medium">{formatQuantity(item.putawayQty)}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">{t("available")}</dt>
              <dd className="text-sm font-bold">{formatQuantity(item.available)}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

export function InventoryItemMobileListSkeleton({ rows }: { rows: number }) {
  return (
    <ul className="border-t" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex flex-col gap-2.5 border-b py-3">
          <div className="flex items-start gap-3">
            <Skeleton className="h-12 w-12 shrink-0 rounded" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-9 w-full" />
        </li>
      ))}
    </ul>
  );
}
