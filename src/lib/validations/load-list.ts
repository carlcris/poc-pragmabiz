import { z } from "zod";

export const isValidLoadListQuantity = (value: string) =>
  /^\d*(\.\d{0,2})?$/.test(value) && Number.isFinite(Number(value)) && Number(value) > 0;

export const createLoadListFormSchema = (
  t: (key: string) => string,
  isLoadDateInputInvalid: () => boolean
) =>
  z.object({
    supplierId: z.string().min(1, t("supplierRequired")),
    destinationBusinessUnitId: z.string().min(1, t("destinationBusinessUnitRequired")),
    supplierLlNumber: z.string().optional(),
    containerNumber: z.string().optional(),
    sealNumber: z.string().optional(),
    batchNumber: z.string().optional(),
    loadDate: z
      .string()
      .optional()
      .refine(() => !isLoadDateInputInvalid(), t("dateInvalid")),
    notes: z.string().optional(),
  });

export const loadListFormSchema = createLoadListFormSchema(
  (key) => key,
  () => false
);

export type LoadListFormValues = z.infer<typeof loadListFormSchema>;
