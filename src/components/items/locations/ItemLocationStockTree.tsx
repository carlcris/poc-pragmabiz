"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useItemLocationStockTree } from "@/hooks/useItemLocationStockTree";
import { useTreeKeyboardNavigation } from "@/hooks/useTreeKeyboardNavigation";
import type { WarehouseLocationTreeExpansion } from "@/hooks/useWarehouseLocationTreeExpansion";
import {
  getWarehouseLocationDisplayName,
  isWarehouseLocationType,
  warehouseLocationTypeLabelKeys,
} from "@/lib/warehouse-location-form";
import { WarehouseLocationTypeIcon } from "@/components/warehouses/WarehouseLocationTypeIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ItemLocationStockNode } from "@/types/inventory-location";

const INDENT_REM = 1.125;
const DIRECT_STOCK_SUFFIX = ":direct";

type ItemLocationStockTreeProps = {
  itemId: string;
  warehouseId: string;
  warehouseLabel: string;
  selectedLocationId: string | null;
  expansion: WarehouseLocationTreeExpansion;
  onSelect: (node: ItemLocationStockNode) => void;
};

type TreeLevelProps = Omit<ItemLocationStockTreeProps, "warehouseLabel"> & {
  parent: ItemLocationStockNode | null;
  level: number;
  focusId: string | null;
};

// Arbitrary grid template: a flexible name column plus two fixed quantity columns has no preset.
const rowClassName = (selected: boolean) =>
  cn(
    "grid min-h-11 cursor-pointer grid-cols-[minmax(0,1fr)_6rem_6rem] items-center gap-2 rounded-md pr-3 text-sm outline-none",
    "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
    selected && "bg-primary/10"
  );

function TreeLevelPage({
  page,
  isLastLoaded,
  onLoadMore,
  ...props
}: TreeLevelProps & { page: number; isLastLoaded: boolean; onLoadMore: () => void }) {
  const { itemId, warehouseId, parent, level, selectedLocationId, expansion, focusId } = props;
  const t = useTranslations("itemLocationsTab");
  const tLocations = useTranslations("warehouseLocationsPage");
  const format = useFormatter();
  const { data, isLoading, error } = useItemLocationStockTree(
    itemId,
    warehouseId,
    parent?.locationId ?? null,
    page
  );
  const paddingLeft = `${0.25 + (level - 1) * INDENT_REM}rem`;
  const quantity = (value: number) => format.number(value, { maximumFractionDigits: 4 });

  if (isLoading) {
    return (
      <li role="none" className="space-y-1 py-1" style={{ paddingLeft }}>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-6 w-40" />
      </li>
    );
  }
  if (error) {
    return (
      <li role="none" className="py-1 text-xs text-destructive" style={{ paddingLeft }}>
        {t("treeLoadError")}
      </li>
    );
  }

  const nodes = data?.data ?? [];
  const pagination = data?.pagination;
  const remaining = pagination ? pagination.total - pagination.page * pagination.limit : 0;
  return (
    <>
      {nodes.map((node, index) => {
        const isExpandable = node.hasStockedChildren;
        const isExpanded = isExpandable && expansion.isExpanded(node.locationId);
        const isSelected = selectedLocationId === node.locationId;
        const focusable = focusId
          ? focusId === node.locationId
          : level === 1 && page === 1 && index === 0;
        const typeLabel = isWarehouseLocationType(node.locationType)
          ? tLocations(warehouseLocationTypeLabelKeys[node.locationType])
          : node.locationType;
        const label = getWarehouseLocationDisplayName(node);
        return (
          <li
            key={node.locationId}
            role="treeitem"
            aria-level={level}
            aria-selected={isSelected}
            aria-expanded={isExpandable ? isExpanded : undefined}
            data-tree-id={node.locationId}
            data-tree-parent={parent?.locationId}
            data-tree-expandable={isExpandable ? "true" : undefined}
            data-tree-expanded={isExpanded ? "true" : undefined}
            tabIndex={focusable ? 0 : -1}
            onClick={(event) => {
              event.stopPropagation();
              props.onSelect(node);
            }}
          >
            <div className={rowClassName(isSelected)} style={{ paddingLeft }}>
              <span className="flex min-w-0 items-center gap-1.5">
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground",
                    !isExpandable && "invisible"
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    expansion.toggle(node.locationId);
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
                <WarehouseLocationTypeIcon locationType={node.locationType} />
                <span className="flex min-w-0 flex-col">
                  <span
                    className={cn(
                      "truncate",
                      isSelected ? "font-semibold text-primary" : isExpandable && "font-medium"
                    )}
                  >
                    {label}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {node.isDefault ? `${typeLabel} · ${t("preferredBadge")}` : typeLabel}
                  </span>
                </span>
              </span>
              <span className="text-right tabular-nums">{quantity(node.subtreeOnHand)}</span>
              <span className="text-right tabular-nums text-muted-foreground">
                {quantity(node.subtreeAvailable)}
              </span>
            </div>
            {isExpanded ? (
              <ul role="group">
                {node.directOnHand > 0 ? (
                  <li
                    role="treeitem"
                    aria-level={level + 1}
                    aria-selected={false}
                    aria-label={t("onLocationItself", { location: label })}
                    data-tree-id={`${node.locationId}${DIRECT_STOCK_SUFFIX}`}
                    data-tree-parent={node.locationId}
                    tabIndex={-1}
                    onClick={(event) => {
                      event.stopPropagation();
                      props.onSelect(node);
                    }}
                  >
                    <div
                      className={rowClassName(false)}
                      style={{ paddingLeft: `${0.25 + level * INDENT_REM + 1.625}rem` }}
                    >
                      <span aria-hidden className="text-muted-foreground">
                        -
                      </span>
                      <span className="text-right tabular-nums">{quantity(node.directOnHand)}</span>
                      <span className="text-right tabular-nums text-muted-foreground">
                        {quantity(node.directAvailable)}
                      </span>
                    </div>
                  </li>
                ) : null}
                <TreeLevel {...props} parent={node} level={level + 1} />
              </ul>
            ) : null}
          </li>
        );
      })}
      {isLastLoaded && remaining > 0 ? (
        <li role="none" style={{ paddingLeft: `calc(${paddingLeft} + 1.625rem)` }}>
          <button
            type="button"
            className="h-9 text-sm font-medium text-primary hover:underline"
            onClick={(event) => {
              event.stopPropagation();
              onLoadMore();
            }}
          >
            {t("showMoreLocations", { count: Math.min(remaining, pagination?.limit ?? 50) })}
          </button>
        </li>
      ) : null}
    </>
  );
}

function TreeLevel(props: TreeLevelProps) {
  const [pageCount, setPageCount] = useState(1);
  return (
    <>
      {Array.from({ length: pageCount }, (_, index) => (
        <TreeLevelPage
          key={index + 1}
          {...props}
          page={index + 1}
          isLastLoaded={index + 1 === pageCount}
          onLoadMore={() => setPageCount((count) => count + 1)}
        />
      ))}
    </>
  );
}

// An item's stock by location: only branches holding the item, each with totals for everything inside.
export function ItemLocationStockTree({
  warehouseLabel,
  selectedLocationId,
  ...props
}: ItemLocationStockTreeProps) {
  const t = useTranslations("itemLocationsTab");
  const { treeRef, focusedId, handleKeyDown } = useTreeKeyboardNavigation<HTMLUListElement>({
    onToggle: (id) => {
      if (!id.endsWith(DIRECT_STOCK_SUFFIX)) props.expansion.toggle(id);
    },
    onActivate: (id) =>
      treeRef.current?.querySelector<HTMLElement>(`[data-tree-id="${CSS.escape(id)}"]`)?.click(),
  });

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-[minmax(0,1fr)_6rem_6rem] gap-2 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
        <span>{t("whereStored")}</span>
        <span className="text-right">{t("onHand")}</span>
        <span className="text-right">{t("available")}</span>
      </div>
      <ul
        ref={treeRef}
        role="tree"
        aria-label={t("stockTreeLabel", { warehouse: warehouseLabel })}
        className="space-y-0.5 p-2"
        onKeyDown={handleKeyDown}
      >
        <TreeLevel
          {...props}
          selectedLocationId={selectedLocationId}
          parent={null}
          level={1}
          focusId={focusedId ?? selectedLocationId}
        />
      </ul>
    </div>
  );
}
