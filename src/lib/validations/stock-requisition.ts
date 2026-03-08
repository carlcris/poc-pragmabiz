import { z } from "zod";

export const createStockRequisitionFormSchema = (t: (key: string) => string) =>
  z.object({
    supplierId: z.string().min(1, t("supplierRequired")),
    requisitionDate: z.string().min(1, t("requisitionDateRequired")),
    requiredByDate: z.string().optional(),
    notes: z.string().optional(),
  });

export const stockRequisitionFormSchema = createStockRequisitionFormSchema((key) => key);

export type StockRequisitionFormValues = z.infer<typeof stockRequisitionFormSchema>;
