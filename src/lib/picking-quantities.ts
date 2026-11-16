import type { PickSourceResolution } from "../types/pick-source";

export const getPickingUnitLabel = (
  unit: string,
  qtyPerUnit: number,
  optionLabel?: string | null
) => optionLabel?.trim() || (qtyPerUnit > 1 ? `${unit} (${qtyPerUnit})` : unit);

// Pick quantities are stored and validated at four decimals, so derived line quantities are
// rounded back to that scale before any local comparison.
export const PICK_QUANTITY_DECIMALS = 4;

export const toPickQuantityScale = (quantity: number) =>
  Number(quantity.toFixed(PICK_QUANTITY_DECIMALS));

type PickLineRemainders = Pick<PickSourceResolution["line"], "remainingQty" | "remainingBaseQty">;
type PickLineQuantities = PickLineRemainders & Pick<PickSourceResolution["line"], "maxPickQty">;

// A packaged line prices its remainder in packs, so its base-unit remainder exceeds the line
// remainder whenever qty_per_unit is greater than one. Measured and base-unit lines keep
// qty_per_unit = 1, where the two remainders match and fractional picks stay legitimate.
export const isPackagedPickLine = (line: PickLineRemainders) =>
  line.remainingBaseQty > toPickQuantityScale(line.remainingQty);

// Partial packages cannot be picked, so a packaged cap is taken down to the last whole package.
// Base-unit lines keep the server cap exactly, including its decimals. The cap is never rounded
// up, so this can only ever offer less than the server allows.
export const getPickableQtyCap = (line: PickLineQuantities) => {
  const maxPickQty = Math.max(0, toPickQuantityScale(line.maxPickQty));
  return isPackagedPickLine(line) ? Math.floor(maxPickQty) : maxPickQty;
};

export type WholePickSourceQuantities =
  | { kind: "whole_units"; availableQty: number; shortQty: number }
  // The source holds less than a full unit, and the line's own reservation covers that exact
  // remainder. A whole-unit count would read as zero, so the chooser shows the remainder instead.
  | { kind: "remaining_only" };

export const getWholePickSourceQuantities = ({
  line,
  source,
}: PickSourceResolution): WholePickSourceQuantities => {
  // Restore the line's decimal scale after the API subtracts allocated and picked quantities.
  const qtyPerUnit = line.remainingBaseQty / toPickQuantityScale(line.remainingQty);
  const toPickUnits = (baseQty: number) => Number((baseQty / qtyPerUnit).toPrecision(15));

  // Reservations held for other lines make physical stock unreachable, so the chooser counts
  // only what this line may actually take.
  const availableQty = Math.floor(toPickUnits(source.availableBaseQty));
  if (availableQty === 0 && source.availableBaseQty >= line.remainingBaseQty) {
    return { kind: "remaining_only" };
  }

  return {
    kind: "whole_units",
    availableQty,
    shortQty: Math.ceil(toPickUnits(Math.max(0, line.remainingBaseQty - source.availableBaseQty))),
  };
};
