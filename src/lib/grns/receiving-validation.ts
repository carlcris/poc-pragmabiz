import { z } from "zod";

export const grnReceivingLinePatchSchema = z
  .object({
    id: z.string().uuid(),
    receivedQty: z.number().finite().min(0).max(1_000_000_000),
    damagedQty: z.number().finite().min(0).max(1_000_000_000),
    numBoxes: z.number().int().min(0).max(1_000_000),
    notes: z.string().max(2_000).nullable().optional(),
  })
  .strict();

export const grnReceivingPatchSchema = z
  .object({
    receivingDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    notes: z.string().max(2_000).nullable().optional(),
    items: z.array(grnReceivingLinePatchSchema).max(500).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export const submitGrnReceivingSchema = z
  .object({
    notes: z.string().trim().max(2_000).nullable().optional(),
    receivingPatch: grnReceivingPatchSchema.optional(),
  })
  .strict();

export type GrnReceivingPatch = z.infer<typeof grnReceivingPatchSchema>;
