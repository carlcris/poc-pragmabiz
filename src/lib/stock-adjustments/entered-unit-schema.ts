import { z } from "zod";

// The delta is unsigned; adjustedQty/currentQty retain the direction in base units.
export const stockAdjustmentEnteredUnitSchema = z.object({
  enteredQty: z.number().nonnegative().max(1_000_000_000).multipleOf(0.01),
  enteredUnitOptionId: z.string().uuid().nullable(),
});
