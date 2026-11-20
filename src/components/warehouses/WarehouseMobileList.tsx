"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Map, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusText } from "@/components/shared/StatusText";
import { ViewGuard } from "@/components/permissions/PermissionGuard";
import { useCanView } from "@/hooks/usePermissions";
import { RESOURCES } from "@/constants/resources";
import type { Warehouse } from "@/types/warehouse";

type WarehouseMobileListProps = {
  warehouses: Warehouse[];
  onEditWarehouse: (warehouse: Warehouse) => void;
  onDeleteWarehouse: (warehouse: Warehouse) => void;
  isDeletePending: boolean;
};

/**
 * Phone layout of the warehouses list: one stacked row per warehouse instead of the
 * table, with every table column kept. The name opens the warehouse's Locations, and
 * Edit, Floor Map and Delete live in the row menu.
 */
export function WarehouseMobileList({
  warehouses,
  onEditWarehouse,
  onDeleteWarehouse,
  isDeletePending,
}: WarehouseMobileListProps) {
  const t = useTranslations("warehousesPage");
  const tCommon = useTranslations("common");
  const canViewLocations = useCanView(RESOURCES.MANAGE_LOCATIONS);

  return (
    <ul className="border-t">
      {warehouses.map((warehouse) => {
        const heading = (
          <>
            <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">
              {warehouse.name}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {warehouse.code} ·{" "}
              <StatusText tone={warehouse.isActive ? "green" : "muted"}>
                {warehouse.isActive ? tCommon("active") : tCommon("inactive")}
              </StatusText>
            </span>
          </>
        );

        return (
          <li key={warehouse.id} className="flex flex-col gap-2.5 border-b py-3">
            <div className="flex items-start gap-3">
              {canViewLocations ? (
                <Link
                  href={`/inventory/warehouses/${warehouse.id}/locations`}
                  className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {heading}
                </Link>
              ) : (
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">{heading}</div>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="-mr-2.5 -mt-1.5 h-11 w-11 shrink-0 p-0"
                    aria-label={t("moreActionsFor", { name: warehouse.name })}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem className="min-h-11" onClick={() => onEditWarehouse(warehouse)}>
                    <Pencil className="h-4 w-4" />
                    <span>{tCommon("edit")}</span>
                  </DropdownMenuItem>
                  {warehouse.isActive ? (
                    <ViewGuard resource={RESOURCES.WAREHOUSES}>
                      <DropdownMenuItem className="min-h-11" asChild>
                        <Link href={`/inventory/warehouses/${warehouse.id}/floor-map`}>
                          <Map className="h-4 w-4" />
                          <span>{t("floorMap")}</span>
                        </Link>
                      </DropdownMenuItem>
                    </ViewGuard>
                  ) : null}
                  <DropdownMenuItem
                    className="min-h-11 text-destructive focus:text-destructive"
                    onClick={() => onDeleteWarehouse(warehouse)}
                    disabled={isDeletePending}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>{tCommon("delete")}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
              <div className="flex min-w-0 flex-col">
                <dt className="text-xs text-muted-foreground">{t("location")}</dt>
                <dd className="break-words text-sm">
                  {warehouse.city}, {warehouse.state}
                  <span className="block text-xs text-muted-foreground">{warehouse.country}</span>
                </dd>
              </div>
              <div className="flex min-w-0 flex-col">
                <dt className="text-xs text-muted-foreground">{t("manager")}</dt>
                <dd className="break-words text-sm">{warehouse.managerName || "-"}</dd>
              </div>
              <div className="col-span-2 flex min-w-0 flex-col">
                <dt className="text-xs text-muted-foreground">{t("contact")}</dt>
                <dd className="break-words text-sm">
                  {warehouse.phone}
                  <span className="block break-all text-xs text-muted-foreground">
                    {warehouse.email}
                  </span>
                </dd>
              </div>
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

export function WarehouseMobileListSkeleton({ rows }: { rows: number }) {
  return (
    <ul className="border-t" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex flex-col gap-2.5 border-b py-3">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-16 w-full" />
        </li>
      ))}
    </ul>
  );
}
