import { z } from "zod";
import { MAX_STOCK_MOVE_BATCH_SELECTION } from "@/types/stock-move";

const stockMoveBatchSelectionSchema = z
  .object({
    mode: z.enum(["include", "exclude"]),
    batchLocationIds: z
      .array(z.string().uuid())
      .max(MAX_STOCK_MOVE_BATCH_SELECTION)
      .refine((ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length),
  })
  .strict()
  .refine(({ mode, batchLocationIds }) => mode === "exclude" || batchLocationIds.length > 0, {
    path: ["batchLocationIds"],
  });

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
            batchSelection: stockMoveBatchSelectionSchema,
            quantity: z.number().positive().max(1_000_000_000).multipleOf(0.01),
          })
          .strict()
      )
      .length(1),
  })
  .strict()
  .refine((value) => value.fromLocationId !== value.toLocationId);

export type StockMovePayload = z.infer<typeof stockMoveSchema>;
export type StockMoveBatchSelection = z.infer<typeof stockMoveBatchSelectionSchema>;
