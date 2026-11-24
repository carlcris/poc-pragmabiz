import { z } from "zod";

export const generatedCodePaddingLimits = {
  document: { min: 1, max: 18, default: 9 },
  warehouseLocation: { min: 1, max: 6, default: 2 },
} as const;

export const generatedCodePaddingSchema = z.object({
  document_code_digits: z
    .number()
    .int()
    .min(generatedCodePaddingLimits.document.min)
    .max(generatedCodePaddingLimits.document.max),
  warehouse_location_code_digits: z
    .number()
    .int()
    .min(generatedCodePaddingLimits.warehouseLocation.min)
    .max(generatedCodePaddingLimits.warehouseLocation.max),
});
