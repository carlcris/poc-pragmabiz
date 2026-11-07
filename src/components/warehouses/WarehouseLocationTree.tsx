"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, ListCollapse, ListTree, Warehouse } from "lucide-react";
import { useTreeKeyboardNavigation } from "@/hooks/useTreeKeyboardNavigation";
import { useWarehouseLocationChildren } from "@/hooks/useWarehouseLocationChildren";
import type { WarehouseLocationTreeExpansion } from "@/hooks/useWarehouseLocationTreeExpansion";
import { getWarehouseLocationDisplayName } from "@/lib/warehouse-location-form";
import { WarehouseLocationTypeIcon } from "@/components/warehouses/WarehouseLocationTypeIcon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ROOT_ID = "__warehouse__";
const INDENT_REM = 1.125;

type WarehouseLocationTreeProps = {
  warehouseId: string;
  warehouseLabel: string;
  selectedId: string | null;
  expansion: WarehouseLocationTreeExpansion;
  onSelect: (locationId: string | null) => void;
  // A branch that cannot be chosen, e.g. the location being moved or copied.
  disabledId?: string;
  // Hands a level with more children to a full list; without it, the level pages in place.
  onShowAll?: (parentId: string | null) => void;
};

type TreeLevelProps = Omit<WarehouseLocationTreeProps, "warehouseLabel"> & {
  parentId: string | null;
  level: number;
  focusId: string;
};

const itemClassName = (selected: boolean) =>
  cn(
    "flex h-8 cursor-pointer items-center gap-1.5 rounded-md pr-2 text-sm outline-none",
    "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
    selected && "bg-primary/10 font-semibold text-primary"
  );

type TreeLevelPageProps = TreeLevelProps & {
  page: number;
  isLastLoaded: boolean;
  onLoadMore: () => void;
};

function TreeLevelPage({
  warehouseId,
  parentId,
  level,
  selectedId,
  expansion,
  focusId,
  onSelect,
  disabledId,
  onShowAll,
  page,
  isLastLoaded,
  onLoadMore,
}: TreeLevelPageProps) {
  const t = useTranslations("warehouseLocationsPage");
  const { data, isLoading, error } = useWarehouseLocationChildren(warehouseId, parentId, page);
  const paddingLeft = `${0.5 + (level - 1) * INDENT_REM}rem`;

  if (isLoading) {
    return (
      <li role="none" className="space-y-1 py-1" style={{ paddingLeft }}>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-32" />
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

  const children = data?.data ?? [];
  const total = data?.pagination.total ?? children.length;
  const pageSize = data?.pagination.limit ?? children.length;
  const remaining = total - (page - 1) * pageSize - children.length;
  return (
    <>
      {children.map((location, index) => {
        const isDisabled = location.id === disabledId;
        const isExpandable = !isDisabled && (location.childCount ?? 0) > 0;
        const isExpanded = isExpandable && expansion.isExpanded(location.id);
        return (
          <li
            key={location.id}
            role="treeitem"
            aria-level={level}
            aria-setsize={total}
            aria-posinset={(page - 1) * pageSize + index + 1}
            aria-selected={selectedId === location.id}
            aria-expanded={isExpandable ? isExpanded : undefined}
            aria-disabled={isDisabled || undefined}
            data-tree-id={location.id}
            data-tree-parent={parentId ?? ROOT_ID}
            data-tree-expandable={isExpandable ? "true" : undefined}
            data-tree-expanded={isExpanded ? "true" : undefined}
            tabIndex={focusId === location.id ? 0 : -1}
            onClick={(event) => {
              event.stopPropagation();
              if (!isDisabled) onSelect(location.id);
            }}
          >
            <div
              className={cn(
                itemClassName(selectedId === location.id),
                (!location.isActive || isDisabled) && "text-muted-foreground",
                isDisabled && "cursor-not-allowed hover:bg-transparent"
              )}
              style={{ paddingLeft }}
            >
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
                  expansion.toggle(location.id);
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
              <WarehouseLocationTypeIcon
                locationType={location.locationType}
                className={cn((!location.isActive || isDisabled) && "opacity-50")}
              />
              <span className="min-w-0 flex-1 truncate">
                {getWarehouseLocationDisplayName(location)}
              </span>
              {isExpandable ? (
                <span className="shrink-0 text-xs font-normal text-muted-foreground">
                  {location.childCount}
                </span>
              ) : null}
            </div>
            {isExpanded ? (
              <ul role="group">
                <TreeLevel
                  warehouseId={warehouseId}
                  parentId={location.id}
                  level={level + 1}
                  selectedId={selectedId}
                  expansion={expansion}
                  focusId={focusId}
                  onSelect={onSelect}
                  disabledId={disabledId}
                  onShowAll={onShowAll}
                />
              </ul>
            ) : null}
          </li>
        );
      })}
      {isLastLoaded && remaining > 0 ? (
        <li role="none" style={{ paddingLeft: `calc(${paddingLeft} + 1.625rem)` }}>
          <button
            type="button"
            className="h-8 text-sm font-medium text-primary hover:underline"
            onClick={(event) => {
              event.stopPropagation();
              if (onShowAll) onShowAll(parentId);
              else onLoadMore();
            }}
          >
            {onShowAll
              ? t("viewAllInTable", { count: total })
              : t("showMoreLocations", { count: Math.min(remaining, pageSize) })}
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

export function WarehouseLocationTree({
  warehouseId,
  warehouseLabel,
  selectedId,
  expansion,
  onSelect,
  disabledId,
  onShowAll,
}: WarehouseLocationTreeProps) {
  const t = useTranslations("warehouseLocationsPage");
  const { treeRef, focusedId, handleKeyDown } = useTreeKeyboardNavigation<HTMLUListElement>({
    onToggle: expansion.toggle,
    onActivate: (id) => onSelect(id === ROOT_ID ? null : id),
  });
  const focusId = focusedId ?? selectedId ?? ROOT_ID;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!expansion.canExpandAll}
          onClick={expansion.expandAll}
        >
          <ListTree className="mr-2 h-4 w-4" aria-hidden />
          {t("expandAll")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!expansion.canCollapseAll}
          onClick={expansion.collapseAll}
        >
          <ListCollapse className="mr-2 h-4 w-4" aria-hidden />
          {t("collapseAll")}
        </Button>
      </div>
      <ul
        ref={treeRef}
        role="tree"
        aria-label={t("structureLabel")}
        className="space-y-0.5"
        onKeyDown={handleKeyDown}
      >
        <li
          role="treeitem"
          aria-level={1}
          aria-expanded
          aria-selected={selectedId === null}
          data-tree-id={ROOT_ID}
          data-tree-expanded="true"
          tabIndex={focusId === ROOT_ID ? 0 : -1}
          onClick={() => onSelect(null)}
        >
          <div className={cn(itemClassName(selectedId === null), "pl-2")}>
            <Warehouse className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{warehouseLabel}</span>
          </div>
          <ul role="group">
            <TreeLevel
              warehouseId={warehouseId}
              parentId={null}
              level={2}
              selectedId={selectedId}
              expansion={expansion}
              focusId={focusId}
              onSelect={onSelect}
              disabledId={disabledId}
              onShowAll={onShowAll}
            />
          </ul>
        </li>
      </ul>
    </div>
  );
}
