import type { ItemInventoryRow } from "@/types/item-inventory";

const toFiniteNumber = (value: number | string | null | undefined): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Quantities and conversion factors are stored with four decimal places. */
const STORED_DECIMAL_SCALE = 10_000;

/** Lifts a stored decimal to the integer it represents, so division is exact. */
const toStoredScaleInteger = (value: number): number => Math.round(value * STORED_DECIMAL_SCALE);

export type InventoryPreviewQuantityFormatter = {
  /** Every row keeps the existing whole-number base figure, nominated or not. */
  formatBase: (baseQuantity: number | string | null | undefined) => string;
  /**
   * Whole nominated units only: a partial unit is dropped rather than rounded up, so
   * less than one unit reads as `0`.
   */
  formatEquivalent: (
    baseQuantity: number | string | null | undefined,
    previewUnit: ItemInventoryRow["inventoryPreviewUnit"]
  ) => string | null;
};

/**
 * Formats one item's nominated equivalent, for surfaces that keep their own base formatting
 * and only need the extra line. Returns `null` when the item nominates no unit, so callers
 * render nothing rather than an empty line.
 */
export type ItemInventoryPreviewLabel = (
  baseQuantity: number | string | null | undefined
) => string | null;

export const createInventoryPreviewQuantityFormatter = (
  locale: string
): InventoryPreviewQuantityFormatter => {
  // One formatter per locale instead of one per cell, since every row reuses it.
  const numberFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });

  return {
    formatBase: (baseQuantity) => String(Math.trunc(toFiniteNumber(baseQuantity))),
    formatEquivalent: (baseQuantity, previewUnit) => {
      if (!previewUnit) return null;

      const divisor = toStoredScaleInteger(toFiniteNumber(previewUnit.qtyPerUnit));
      if (divisor <= 0) return null;

      const wholeUnits = Math.trunc(toStoredScaleInteger(toFiniteNumber(baseQuantity)) / divisor);
      // Math.trunc keeps the sign, so a negative partial pack would format as "-0".
      return numberFormat.format(wholeUnits === 0 ? 0 : wholeUnits);
    },
  };
};

/**
 * Binds one item's nominated unit to one locale formatter so a surface can build the label
 * once and hand the callback to every quantity it renders, instead of one number formatter
 * per row. Without a nomination every call returns `null`.
 */
export const createItemInventoryPreviewLabel = (
  locale: string,
  previewUnit: ItemInventoryRow["inventoryPreviewUnit"]
): ItemInventoryPreviewLabel => {
  if (!previewUnit) return () => null;

  const { formatEquivalent } = createInventoryPreviewQuantityFormatter(locale);
  return (baseQuantity) => {
    const equivalent = formatEquivalent(baseQuantity, previewUnit);
    return equivalent === null ? null : `${equivalent} ${previewUnit.displayLabel}`;
  };
};
