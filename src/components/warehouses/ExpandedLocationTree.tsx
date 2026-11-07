"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useWarehouseLocationHierarchy } from "@/hooks/useWarehouseLocationHierarchy";
import type { WarehouseLocationTreeExpansion } from "@/hooks/useWarehouseLocationTreeExpansion";
import { WarehouseLocationTypeIcon } from "./WarehouseLocationTypeIcon";
import { Button } from "@/components/ui/button";
import {
  isWarehouseLocationType,
  warehouseLocationTypeLabelKeys,
} from "@/lib/warehouse-location-form";
import { cn } from "@/lib/utils";
import {
  flattenLocationTree,
  locationTreeWindow,
  LOCATION_TREE_ROW_HEIGHT,
  LOCATION_TREE_VIEWPORT_HEIGHT,
} from "@/lib/warehouse-location-tree";

const rowId = (id: string, direct: boolean) => (direct ? `${id}:direct` : id);

// The tree lays out at full height like the lazy tree; null means the window scrolls it.
function findScrollContainer(element: HTMLElement): HTMLElement | null {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (/auto|scroll|overlay/.test(getComputedStyle(parent).overflowY)) return parent;
  }
  return null;
}

const visibleBounds = (container: HTMLElement | null) =>
  container ? container.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };

type ExpandedLocationTreeProps = {
  warehouseId: string;
  itemId?: string;
  label: string;
  selectedId: string | null;
  disabledId?: string;
  expansion: WarehouseLocationTreeExpansion;
  onSelect: (id: string) => void;
};

/** A flat ARIA tree with virtual rows; keyboard navigation operates on data, not mounted DOM. */
export function ExpandedLocationTree({
  warehouseId,
  itemId,
  label,
  selectedId,
  disabledId,
  expansion,
  onSelect,
}: ExpandedLocationTreeProps) {
  const t = useTranslations("warehouseLocationsPage");
  const tItem = useTranslations("itemLocationsTab");
  const format = useFormatter();
  const query = useWarehouseLocationHierarchy(warehouseId, itemId);
  const rows = useMemo(
    () => flattenLocationTree(query.data ?? [], expansion.isExpanded, disabledId),
    [query.data, expansion.isExpanded, disabledId]
  );
  const [focusedId, setFocusedId] = useState<string | null>(selectedId);
  // The slice of the tree inside its scroll container, in tree-relative pixels.
  const [viewport, setViewport] = useState({ top: 0, height: LOCATION_TREE_VIEWPORT_HEIGHT });
  const treeRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const isLoaded = Boolean(query.data);
  useEffect(() => {
    const tree = treeRef.current;
    if (!tree) return;
    const container = findScrollContainer(tree);
    scrollContainerRef.current = container;
    const measure = () => {
      const treeTop = tree.getBoundingClientRect().top;
      const { top, bottom } = visibleBounds(container);
      setViewport({
        top: Math.max(0, top - treeTop),
        height: Math.max(0, bottom - Math.max(top, treeTop)),
      });
    };
    measure();
    const scrollTarget = container ?? window;
    scrollTarget.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    // Collapsing or expanding branches changes the tree height and therefore the visible slice.
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(tree);
    if (container) resizeObserver.observe(container);
    return () => {
      scrollTarget.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      resizeObserver.disconnect();
    };
  }, [isLoaded]);
  const focusedIndex = Math.max(
    0,
    rows.findIndex((row) => rowId(row.node.id, row.direct) === focusedId)
  );
  const { start, end } = locationTreeWindow(rows.length, viewport.top, viewport.height);
  const domId = (index: number) => `expanded-${itemId ?? "warehouse"}-${warehouseId}-${index}`;
  const focusRow = (index: number) => {
    const row = rows[index];
    if (!row) return;
    setFocusedId(rowId(row.node.id, row.direct));
    const tree = treeRef.current;
    if (!tree) return;
    const container = scrollContainerRef.current;
    const rowTop = tree.getBoundingClientRect().top + index * LOCATION_TREE_ROW_HEIGHT;
    const { top, bottom } = visibleBounds(container);
    const delta =
      rowTop < top ? rowTop - top : Math.max(0, rowTop + LOCATION_TREE_ROW_HEIGHT - bottom);
    if (delta !== 0) (container ?? window).scrollBy({ top: delta });
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const row = rows[focusedIndex];
    if (!row) return;
    const expandable = row.node.hasChildren && !row.direct && row.node.id !== disabledId;
    const expanded = expandable && expansion.isExpanded(row.node.id);
    switch (event.key) {
      case "ArrowDown":
        focusRow(Math.min(rows.length - 1, focusedIndex + 1));
        break;
      case "ArrowUp":
        focusRow(Math.max(0, focusedIndex - 1));
        break;
      case "Home":
        focusRow(0);
        break;
      case "End":
        focusRow(rows.length - 1);
        break;
      case "ArrowRight":
        if (expandable && !expanded) expansion.toggle(row.node.id);
        else if (expanded) focusRow(focusedIndex + 1);
        break;
      case "ArrowLeft":
        if (expanded) expansion.toggle(row.node.id);
        else
          focusRow(
            rows.findIndex(
              (candidate) =>
                !candidate.direct &&
                candidate.node.id === (row.direct ? row.node.id : row.node.parentId)
            )
          );
        break;
      case "Enter":
      case " ":
        if (row.node.id !== disabledId) onSelect(row.node.id);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  if (!query.data) {
    return (
      <div className="h-96 p-2" role="status">
        {query.error ? (
          <>
            <p className="text-sm text-destructive">{t("treeLoadError")}</p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              {t("treeRetry")}
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("treeLoadingProgress", query.progress)}
          </p>
        )}
      </div>
    );
  }
  return (
    <div
      ref={treeRef}
      role="tree"
      aria-label={label}
      tabIndex={0}
      aria-activedescendant={
        rows.length && focusedIndex >= start && focusedIndex < end ? domId(focusedIndex) : undefined
      }
      className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onKeyDown={handleKeyDown}
      // Keyboard entry reveals the focused row; a pointer press must not scroll away from its target.
      onFocus={(event) => {
        if (event.currentTarget.matches(":focus-visible")) focusRow(focusedIndex);
      }}
    >
      <div
        role="none"
        style={{ height: rows.length * LOCATION_TREE_ROW_HEIGHT, position: "relative" }}
      >
        {rows.slice(start, end).map((row, offset) => {
          const index = start + offset;
          const { node, direct, level } = row;
          const expandable = node.hasChildren && !direct && node.id !== disabledId;
          const expanded = expandable && expansion.isExpanded(node.id);
          const name = node.name?.trim() || node.code;
          return (
            <div
              key={rowId(node.id, direct)}
              id={domId(index)}
              role="treeitem"
              aria-level={level}
              aria-selected={!direct && selectedId === node.id}
              aria-expanded={expandable ? expanded : undefined}
              aria-disabled={node.id === disabledId || undefined}
              aria-label={direct ? tItem("onLocationItself", { location: name }) : undefined}
              className={cn(
                "absolute left-0 right-0 flex h-11 cursor-pointer items-center gap-2 rounded px-2 text-sm hover:bg-muted",
                selectedId === node.id && !direct && "bg-primary/10 text-primary",
                focusedIndex === index && "ring-1 ring-inset ring-ring",
                !node.isActive && "text-muted-foreground"
              )}
              style={{
                top: index * LOCATION_TREE_ROW_HEIGHT,
                paddingLeft: `${0.5 + (level - 1) * 1.125}rem`,
              }}
              onClick={() => {
                focusRow(index);
                treeRef.current?.focus({ preventScroll: true });
                if (node.id !== disabledId) onSelect(node.id);
              }}
            >
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center",
                  !expandable && "invisible"
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  focusRow(index);
                  expansion.toggle(node.id);
                }}
              >
                {expanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
              {!direct && <WarehouseLocationTypeIcon locationType={node.locationType} />}
              <span className="min-w-0 flex-1 truncate">
                {direct ? (
                  "−"
                ) : (
                  <>
                    <span className="block truncate">{name}</span>
                    {itemId && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {isWarehouseLocationType(node.locationType)
                          ? t(warehouseLocationTypeLabelKeys[node.locationType])
                          : node.locationType}
                        {node.isDefault ? ` · ${tItem("preferredBadge")}` : ""}
                      </span>
                    )}
                  </>
                )}
              </span>
              {itemId && (
                <>
                  <span className="w-20 shrink-0 text-right tabular-nums">
                    {format.number((direct ? node.directOnHand : node.onHand) ?? 0)}
                  </span>
                  <span className="w-20 shrink-0 text-right tabular-nums text-muted-foreground">
                    {format.number((direct ? node.directAvailable : node.available) ?? 0)}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
