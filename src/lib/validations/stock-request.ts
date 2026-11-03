import { z } from "zod";

export const createStockRequestFormSchema = (t: (key: string) => string) =>
  z.object({
    requestDate: z.string().min(1, t("requestDateRequired")),
    requiredDate: z.string().min(1, t("requiredDateRequired")),
    fulfillingBusinessUnitId: z.string().min(1, t("requestedToRequired")),
    priority: z.enum(["low", "normal", "high", "urgent"]),
    purpose: z.string().optional(),
    notes: z.string().optional(),
  });

export type StockRequestFormValues = z.infer<ReturnType<typeof createStockRequestFormSchema>>;
