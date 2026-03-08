import { z } from "zod";

export const createLoadListFormSchema = (t: (key: string) => string) =>
  z.object({
    supplierId: z.string().min(1, t("supplierRequired")),
    warehouseId: z.string().min(1, t("warehouseRequired")),
    supplierLlNumber: z.string().optional(),
    containerNumber: z.string().optional(),
    sealNumber: z.string().optional(),
    batchNumber: z.string().optional(),
    linerName: z.string().optional(),
    estimatedArrivalDate: z.string().optional(),
    loadDate: z.string().optional(),
    notes: z.string().optional(),
  });

export const loadListFormSchema = createLoadListFormSchema((key) => key);

export type LoadListFormValues = z.infer<typeof loadListFormSchema>;
