import type { ItemInventoryPreviewLabel } from "@/lib/items/inventory-preview-quantity";

export type ItemLocationPreviewQuantityProps = {
  baseQuantity: number;
  previewLabel: ItemInventoryPreviewLabel;
};

/**
 * The nominated whole-unit equivalent of one stock figure on the item's Locations tab. Every
 * figure keeps the base quantity its surface already renders and this line sits under it, so
 * the narrow tree, panel stats, and batch cells all read the same way. Renders nothing when
 * the item nominates no unit option. The unit's display label is rendered verbatim; a long
 * label breaks mid-word rather than widening its column, since a custom label of up to 120
 * characters may contain no break opportunity.
 */
export function ItemLocationPreviewQuantity({
  baseQuantity,
  previewLabel,
}: ItemLocationPreviewQuantityProps) {
  const equivalent = previewLabel(baseQuantity);
  if (equivalent === null) return null;

  return (
    <span className="block break-all text-xs font-normal text-muted-foreground">{equivalent}</span>
  );
}
