import { z } from "zod";
import { batchExpirationDateSchema } from "./batch-expiration-date";
import { batchReceivedDateSchema } from "./batch-received-date";

export const createStockAdjustmentLineItemSchema = (
  tValidation: (
    key:
      | "receivedDateInvalid"
      | "expirationDateInvalid"
      | "itemRequired"
      | "batchRequired"
      | "uomRequired"
      | "currentQtyMin"
      | "adjustedQtyMin"
      | "unitCostMin"
      | "newBatchIncreaseOnly"
      | "newBatchPositiveQuantity"
      | "batchLocationIncreaseRequired"
      | "batchAlreadyExistsInWarehouse"
      | "batchAvailabilityCheckFailed"
  ) => string,
  quantityError: string
) =>
  z
    .object({
      itemId: z.string().min(1, tValidation("itemRequired")),
      batchEntryMode: z.enum(["existing", "new"]),
      itemBatchLocationId: z.string().optional(),
      itemBatchId: z.string().optional(),
      batchLocationSku: z.string().optional(),
      batchCode: z.string().optional(),
      batchReceivedAt: z.string().optional(),
      batchExpirationDate: z.string().optional(),
      batchExpirationDateOverridden: z.boolean().optional(),
      batchWarehouseLocationId: z.string().optional(),
      batchLocationCode: z.string().optional(),
      batchLocationName: z.string().optional(),
      itemCode: z.string().optional(),
      itemName: z.string().optional(),
      uomId: z.string().min(1, tValidation("uomRequired")),
      uomName: z.string().optional(),
      enteredQty: z
        .number()
        .nonnegative(quantityError)
        .max(1_000_000_000, quantityError)
        .multipleOf(0.01, quantityError)
        .optional(),
      enteredUnitOptionId: z.string().nullable().optional(),
      enteredUnitLabel: z.string().nullable().optional(),
      enteredQtyPerUnit: z.number().positive().optional(),
      currentQty: z.number().min(0, tValidation("currentQtyMin")),
      adjustedQty: z.number().min(0, tValidation("adjustedQtyMin")),
      unitCost: z.number().min(0, tValidation("unitCostMin")),
      adjustmentAmount: z
        .number()
        .nonnegative(quantityError)
        .max(1_000_000_000, quantityError)
        .multipleOf(0.01, quantityError)
        .optional(), // User input: the delta (always positive)
      adjustmentType: z.enum(["add", "remove"]).optional(), // Whether to add or remove
    })
    .superRefine((value, ctx) => {
      if (value.batchEntryMode === "existing" && !value.itemBatchLocationId && !value.itemBatchId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: tValidation("batchRequired"),
          path: ["itemBatchLocationId"],
        });
      }

      if (
        value.batchEntryMode === "new" &&
        !batchReceivedDateSchema.safeParse(value.batchReceivedAt).success
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: tValidation("receivedDateInvalid"),
          path: ["batchReceivedAt"],
        });
      }

      if (
        value.batchEntryMode === "new" &&
        !batchExpirationDateSchema.safeParse(value.batchExpirationDate || null).success
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: tValidation("expirationDateInvalid"),
          path: ["batchExpirationDate"],
        });
      }

      if (value.batchEntryMode === "new" && !value.batchCode?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: tValidation("batchRequired"),
          path: ["batchCode"],
        });
      }

      if (value.batchEntryMode === "new" && value.adjustmentType !== "add") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: tValidation("newBatchIncreaseOnly"),
          path: ["adjustmentType"],
        });
      }

      if (
        value.batchEntryMode === "new" &&
        (!value.adjustmentAmount || value.adjustmentAmount <= 0)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: tValidation("newBatchPositiveQuantity"),
          path: ["adjustmentAmount"],
        });
      }

      if (
        value.itemBatchId &&
        !value.itemBatchLocationId &&
        (value.adjustmentType !== "add" || !value.adjustmentAmount)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: tValidation("batchLocationIncreaseRequired"),
          path: ["adjustmentAmount"],
        });
      }

      const signedAdjustment =
        value.adjustmentType === "remove"
          ? -(value.adjustmentAmount || 0)
          : value.adjustmentAmount || 0;

      if (value.currentQty + signedAdjustment < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: tValidation("adjustedQtyMin"),
          path: ["adjustmentAmount"],
        });
      }
    });

type LineItemSchema = ReturnType<typeof createStockAdjustmentLineItemSchema>;
export type StockAdjustmentLineItemFormValues = z.infer<LineItemSchema>;
