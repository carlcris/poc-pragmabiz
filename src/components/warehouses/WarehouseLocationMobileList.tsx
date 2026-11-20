"use client";

import type { ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusText } from "@/components/shared/StatusText";
import {
  getWarehouseLocationDisplayName,
  getWarehouseLocationUse,
  warehouseLocationUseLabelKeys,
} from "@/lib/warehouse-location-form";
import type { WarehouseLocation } from "@/types/inventory-location";

type WarehouseLocationMobileListProps = {
  locations: WarehouseLocation[];
  isSearching: boolean;
  onOpenLocation: (locationId: string) => void;
  getLocationTypeLabel: (locationType: string) => string;
  formatCapacity: (location: WarehouseLocation) => string;
  renderOccupancy: (location: WarehouseLocation) => ReactNode;
  renderActionsMenu: (location: WarehouseLocation) => ReactNode;
};

/**
 * Phone layout of a warehouse's location list: one stacked row per location instead of
 * the nine-column table, with every column kept. Tapping the row opens the location;
 * Edit and the other row actions live in the row menu.
 */
export function WarehouseLocationMobileList({
  locations,
  isSearching,
  onOpenLocation,
  getLocationTypeLabel,
  formatCapacity,
  renderOccupancy,
  renderActionsMenu,
}: WarehouseLocationMobileListProps) {
  const t = useTranslations("warehouseLocationsPage");
  const format = useFormatter();

  return (
    <ul className="border-t">
      {locations.map((location) => (
        <li key={location.id} className="flex flex-col gap-2.5 border-b py-3">
          <div className="flex items-start gap-3">
            <button
              type="button"
              className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t("openLocation", {
                location: getWarehouseLocationDisplayName(location),
              })}
              onClick={() => onOpenLocation(location.id)}
            >
              <span className="break-words text-sm font-semibold text-violet-700 dark:text-violet-300">
                {location.code}
                {location.name ? (
                  <span className="font-medium text-foreground"> · {location.name}</span>
                ) : null}
              </span>
              {isSearching ? (
                <span className="break-words text-xs text-muted-foreground">
                  {location.locationPath}
                </span>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {getLocationTypeLabel(location.locationType)} ·{" "}
                {t(warehouseLocationUseLabelKeys[getWarehouseLocationUse(location)])} ·{" "}
                <StatusText tone={location.isActive ? "green" : "muted"}>
                  {location.isActive ? t("active") : t("inactive")}
                </StatusText>
              </span>
            </button>
            {renderActionsMenu(location)}
          </div>
          <dl className="grid grid-cols-3 gap-2 tabular-nums">
            <div className="flex min-w-0 flex-col">
              <dt className="text-xs text-muted-foreground">{t("capacity")}</dt>
              <dd className="break-words text-sm font-medium">{formatCapacity(location)}</dd>
            </div>
            <div className="flex min-w-0 flex-col">
              <dt className="text-xs text-muted-foreground">{t("subtreeQuantity")}</dt>
              <dd className="text-sm font-medium">
                {format.number(location.subtreeQuantity ?? 0, { maximumFractionDigits: 2 })}
              </dd>
            </div>
            <div className="flex min-w-0 flex-col">
              <dt className="text-xs text-muted-foreground">{t("occupancy")}</dt>
              <dd className="break-words text-sm font-medium">{renderOccupancy(location)}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

export function WarehouseLocationMobileListSkeleton({ rows }: { rows: number }) {
  return (
    <ul className="border-t" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex flex-col gap-2.5 border-b py-3">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-9 w-full" />
        </li>
      ))}
    </ul>
  );
}
