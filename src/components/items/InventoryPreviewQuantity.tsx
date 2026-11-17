import type { ReactNode } from "react";
import type { ItemInventoryRow } from "@/types/item-inventory";
import type { InventoryPreviewQuantityFormatter } from "@/lib/items/inventory-preview-quantity";

type InventoryPreviewQuantityProps = {
  baseQuantity: number | string | null | undefined;
  previewUnit: ItemInventoryRow["inventoryPreviewUnit"];
  formatPreviewQuantity: InventoryPreviewQuantityFormatter;
  /** Receives the formatted base figure so callers keep their own colors and emphasis. */
  children: (baseQuantity: string) => ReactNode;
};

/**
 * Renders the base quantity and, when the item nominates a unit option, appends the whole
 * unit equivalent on the same line, wrapping only when the row runs out of width. The muted
 * text and gap keep the equivalent visually separate without parentheses, and the unit's own
 * display label is rendered verbatim. Colors stay on the caller's base node.
 */
export function InventoryPreviewQuantity({
  baseQuantity,
  previewUnit,
  formatPreviewQuantity,
  children,
}: InventoryPreviewQuantityProps) {
  const base = children(formatPreviewQuantity.formatBase(baseQuantity));
  const equivalent = formatPreviewQuantity.formatEquivalent(baseQuantity, previewUnit);
  if (!previewUnit || equivalent === null) return <>{base}</>;

  return (
    <span className="inline-flex max-w-32 flex-wrap items-baseline justify-end gap-x-1">
      {base}
      <span className="min-w-0 whitespace-normal break-words text-xs font-normal text-muted-foreground">
        {equivalent} {previewUnit.displayLabel}
      </span>
    </span>
  );
}
