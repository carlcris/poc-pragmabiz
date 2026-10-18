import { z } from "zod";

export const stockMoveSchema = z
  .object({
    transactionType: z.literal("transfer"),
    warehouseId: z.string().uuid(),
    toWarehouseId: z.string().uuid(),
    fromLocationId: z.string().uuid(),
    toLocationId: z.string().uuid(),
    transactionDate: z.string().date(),
    items: z
      .array(
        z
          .object({
            itemId: z.string().uuid(),
            quantity: z.number().positive().max(1_000_000_000).multipleOf(0.01),
          })
          .strict()
      )
      .length(1),
  })
  .strict()
  .refine((value) => value.fromLocationId !== value.toLocationId);

export type StockMovePayload = z.infer<typeof stockMoveSchema>;
