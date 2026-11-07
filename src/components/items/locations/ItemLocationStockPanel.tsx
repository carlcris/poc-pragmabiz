"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useItemLocationStockTree } from "@/hooks/useItemLocationStockTree";
import {
  getWarehouseLocationDisplayName,
  isWarehouseLocationType,
  warehouseLocationTypeLabelKeys,
} from "@/lib/warehouse-location-form";
import { ItemLocationBatches } from "@/components/items/locations/ItemLocationBatches";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ItemLocationBatch, ItemLocationStockNode } from "@/types/inventory-location";

type ItemLocationStockPanelProps = {
  itemId: string;
  warehouseName: string;
  node: ItemLocationStockNode;
  canMoveStock: boolean;
  canPrint: boolean;
  printDisabled: boolean;
  isSettingPreferred: boolean;
  onPrint: (batch: ItemLocationBatch) => void;
  onSelect: (node: ItemLocationStockNode) => void;
  onSetPreferred: (node: ItemLocationStockNode) => void;
  onMoveFromHere: (node: ItemLocationStockNode) => void;
};

// The selected location: totals, actions, its stocked sublocations, and batches stored on it.
export function ItemLocationStockPanel({
  itemId,
  warehouseName,
  node,
  canMoveStock,
  canPrint,
  printDisabled,
  isSettingPreferred,
  onPrint,
  onSelect,
  onSetPreferred,
  onMoveFromHere,
}: ItemLocationStockPanelProps) {
  const t = useTranslations("itemLocationsTab");
  const tLocations = useTranslations("warehouseLocationsPage");
  const format = useFormatter();
  const children = useItemLocationStockTree(
    itemId,
    node.hasStockedChildren ? node.warehouseId : "",
    node.locationId
  );
  const label = getWarehouseLocationDisplayName(node);
  const quantity = (value: number) => format.number(value, { maximumFractionDigits: 4 });
  const typeLabel = isWarehouseLocationType(node.locationType)
    ? tLocations(warehouseLocationTypeLabelKeys[node.locationType])
    : node.locationType;
  const stats = node.hasStockedChildren
    ? [
        { label: t("includingSublocations"), value: node.subtreeOnHand },
        { label: t("reserved"), value: node.subtreeReserved },
        { label: t("available"), value: node.subtreeAvailable },
        { label: t("storedHere"), value: node.directOnHand },
      ]
    : [
        { label: t("onHand"), value: node.directOnHand },
        { label: t("reserved"), value: node.directReserved },
        { label: t("available"), value: node.directAvailable },
      ];
  const childTotal = children.data?.pagination.total ?? 0;
  const childRows = children.data?.data ?? [];

  return (
    <section aria-labelledby={`item-location-${node.locationId}`} className="space-y-4">
      <p className="break-words text-xs text-muted-foreground">
        {warehouseName} / {node.namePath}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`item-location-${node.locationId}`} className="text-lg font-semibold">
          {label}
        </h3>
        <Badge variant="secondary">{typeLabel}</Badge>
        {node.isDefault ? <Badge variant="secondary">{t("preferredBadge")}</Badge> : null}
        <span className="flex-1" />
        {node.isDefault || !node.isStorable ? null : (
          <Button
            variant="outline"
            size="sm"
            disabled={isSettingPreferred}
            onClick={() => onSetPreferred(node)}
          >
            {t("setAsPreferred")}
          </Button>
        )}
        {canMoveStock && node.directAvailable > 0 ? (
          <Button variant="outline" size="sm" onClick={() => onMoveFromHere(node)}>
            {t("moveFromHere")}
          </Button>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg bg-muted/50 px-3 py-2">
            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
            <dd className="text-base font-semibold tabular-nums">{quantity(stat.value)}</dd>
          </div>
        ))}
      </dl>

      {node.hasStockedChildren ? (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">{t("insideLocation", { location: label })}</h4>
          {children.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <ul className="divide-y rounded-md border">
              {childRows.map((child) => (
                <li key={child.locationId}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => onSelect(child)}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {getWarehouseLocationDisplayName(child)}
                    </span>
                    <span className="tabular-nums">{quantity(child.subtreeOnHand)}</span>
                  </button>
                </li>
              ))}
              {childTotal > childRows.length ? (
                <li className="px-3 py-2 text-xs text-muted-foreground">
                  {t("moreInTree", { count: childTotal - childRows.length })}
                </li>
              ) : null}
            </ul>
          )}
        </div>
      ) : null}

      {node.directOnHand > 0 ? (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">
            {node.hasStockedChildren
              ? t("storedDirectlyOn", { location: label })
              : t("batchesIn", { location: label })}
          </h4>
          <ItemLocationBatches
            key={node.locationId}
            itemId={itemId}
            locationId={node.locationId}
            canPrint={canPrint}
            printDisabled={printDisabled}
            onPrint={onPrint}
          />
        </div>
      ) : null}
    </section>
  );
}
