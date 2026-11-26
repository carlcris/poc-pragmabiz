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

/** Shows the equivalent below the base quantity. */
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
    <>
      {base}
      <span className="block whitespace-normal break-words text-xs font-normal text-muted-foreground md:ml-auto md:max-w-32">
        {equivalent} {previewUnit.displayLabel}
      </span>
    </>
  );
}
