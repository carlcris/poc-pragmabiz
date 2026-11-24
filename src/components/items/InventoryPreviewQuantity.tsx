import type { ReactNode } from "react";
import type { ItemInventoryRow } from "@/types/item-inventory";
import type { InventoryPreviewQuantityFormatter } from "@/lib/items/inventory-preview-quantity";

type InventoryPreviewQuantityProps = {
  baseQuantity: number;
  previewUnit: ItemInventoryRow["inventoryPreviewUnit"];
  formatPreviewQuantity: InventoryPreviewQuantityFormatter;
  /** Receives the formatted base figure so callers keep their own colors and emphasis. */
  children?: (baseQuantity: string) => ReactNode;
};

/** Shows the equivalent below the base quantity on phones and beside it in the table. */
export function InventoryPreviewQuantity({
  baseQuantity,
  previewUnit,
  formatPreviewQuantity,
  children,
}: InventoryPreviewQuantityProps) {
  const formattedBase = formatPreviewQuantity.formatBase(baseQuantity);
  const base = children ? children(formattedBase) : <span>{formattedBase}</span>;
  if (!previewUnit || baseQuantity === 0) return <>{base}</>;

  const equivalent = formatPreviewQuantity.formatEquivalent(baseQuantity, previewUnit);
  if (equivalent === null) return <>{base}</>;

  return (
    <span className="block md:inline-flex md:max-w-32 md:flex-wrap md:items-baseline md:justify-end md:gap-x-1">
      {base}
      <span className="block min-w-0 whitespace-normal break-words text-xs font-normal text-muted-foreground">
        {equivalent} {previewUnit.displayLabel}
      </span>
    </span>
  );
}
