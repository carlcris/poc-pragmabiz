import { z } from "zod";

export const transactionTypeEnum = z.enum(["in", "out", "transfer", "adjustment"]);

export const stockTransactionFormSchema = z.object({
  transactionDate: z.string().min(1, "Transaction date is required"),
  transactionType: transactionTypeEnum,
  itemId: z.string().min(1, "Item is required"),
  warehouseId: z.string().min(1, "Warehouse is required"),
  toWarehouseId: z.string().optional(),
  fromLocationId: z.string().optional(),
  toLocationId: z.string().optional(),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  packagingId: z.string().nullable().optional(),
  uomId: z.string().min(1, "Unit of measure is required"),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
  referenceNumber: z.string().optional(),
  reason: z.string().min(1, "Reason is required"),
  notes: z.string().default(""),
}).refine(
  (data) => {
    // If transaction type is transfer, toWarehouseId is required
    if (data.transactionType === "transfer") {
      return !!data.toWarehouseId;
    }
    return true;
  },
  {
    message: "Destination warehouse is required for transfers",
    path: ["toWarehouseId"],
  }
);

export type StockTransactionFormValues = z.infer<typeof stockTransactionFormSchema>;
