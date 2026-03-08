import { z } from "zod";

export const invoiceStatusEnum = z.enum([
  "draft",
  "sent",
  "paid",
  "partially_paid",
  "overdue",
  "cancelled",
]);

export const createInvoiceLineItemSchema = (t: (key: string) => string) =>
  z.object({
    itemId: z.string().min(1, t("itemRequired")),
    itemCode: z.string().min(1, t("itemCodeRequired")),
    itemName: z.string().min(1, t("itemNameRequired")),
    description: z.string().default(""),
    quantity: z.number().min(0.01, t("quantityRequired")),
    unitPrice: z.number().min(0, t("unitPriceRequired")),
    discount: z.number().min(0, t("discountMin")).max(100, t("discountMax")),
    taxRate: z.number().min(0, t("taxMin")).max(100, t("taxMax")),
    uomId: z.string().min(1, t("uomRequired")),
  });

export const invoiceLineItemSchema = createInvoiceLineItemSchema((key) => key);

export const createInvoiceFormSchema = (t: (key: string) => string) =>
  z
    .object({
      customerId: z.string().min(1, t("customerRequired")),
      warehouseId: z.string().optional(),
      locationId: z.string().optional(),
      salesOrderId: z.string().optional(),
      invoiceDate: z.string().min(1, t("invoiceDateRequired")),
      dueDate: z.string().min(1, t("dueDateRequired")),
      terms: z.string().default(""),
      notes: z.string().default(""),
    })
    .refine(
      (data) => {
        const invoiceDate = new Date(data.invoiceDate);
        const dueDate = new Date(data.dueDate);
        return dueDate >= invoiceDate;
      },
      {
        message: t("dueDateAfterInvoiceDate"),
        path: ["dueDate"],
      }
    );

export const invoiceFormSchema = createInvoiceFormSchema((key) => key);

export const createRecordPaymentSchema = (t: (key: string) => string) =>
  z.object({
    invoiceId: z.string().min(1, t("invoiceIdRequired")),
    amount: z.number().min(0.01, t("amountRequired")),
    paymentDate: z.string().min(1, t("paymentDateRequired")),
    paymentMethod: z.string().min(1, t("paymentMethodRequired")),
    reference: z.string().default(""),
    notes: z.string().default(""),
  });

export const recordPaymentSchema = createRecordPaymentSchema((key) => key);

export const updateInvoiceStatusSchema = z.object({
  status: invoiceStatusEnum,
});

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;
export type InvoiceLineItemValues = z.infer<typeof invoiceLineItemSchema>;
export type RecordPaymentValues = z.infer<typeof recordPaymentSchema>;
