import { z } from "zod";

export const transactionTypeEnum = z.enum(["in", "out", "transfer", "adjustment"]);

type StockTransactionValidationKey =
  | "transactionDateRequired"
  | "itemRequired"
  | "warehouseRequired"
  | "quantityMin"
  | "uomRequired"
  | "reasonRequired"
  | "destinationWarehouseRequired";

type StockTransactionValidationTranslator = (key: StockTransactionValidationKey) => string;

export const createStockTransactionFormSchema = (t: StockTransactionValidationTranslator) =>
  z
    .object({
      transactionDate: z.string().min(1, t("transactionDateRequired")),
      transactionType: transactionTypeEnum,
      itemId: z.string().min(1, t("itemRequired")),
      warehouseId: z.string().min(1, t("warehouseRequired")),
      toWarehouseId: z.string().optional(),
      fromLocationId: z.string().optional(),
      toLocationId: z.string().optional(),
      quantity: z.number().min(0.01, t("quantityMin")),
      uomId: z.string().min(1, t("uomRequired")),
      referenceType: z.string().optional(),
      referenceId: z.string().optional(),
      referenceNumber: z.string().optional(),
      reason: z.string().min(1, t("reasonRequired")),
      notes: z.string().default(""),
    })
    .refine(
      (data) => {
        if (data.transactionType === "transfer") {
          return !!data.toWarehouseId;
        }
        return true;
      },
      {
        message: t("destinationWarehouseRequired"),
        path: ["toWarehouseId"],
      }
    );

export type StockTransactionFormSchema = ReturnType<typeof createStockTransactionFormSchema>;
export type StockTransactionFormValues = z.infer<StockTransactionFormSchema>;
