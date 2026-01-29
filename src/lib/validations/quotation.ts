import { z } from "zod";

export const quotationStatusEnum = z.enum(["draft", "sent", "accepted", "rejected", "expired"]);

export const quotationLineItemSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  itemCode: z.string().min(1, "Item code is required"),
  itemName: z.string().min(1, "Item name is required"),
  description: z.string().default(""),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  packagingId: z.string().nullable().optional(),
  unitPrice: z.number().min(0, "Unit price must be non-negative"),
  discount: z
    .number()
    .min(0, "Discount cannot be negative")
    .max(100, "Discount cannot exceed 100%"),
  taxRate: z.number().min(0, "Tax rate cannot be negative").max(100, "Tax rate cannot exceed 100%"),
});

export const quotationFormSchema = z
  .object({
    companyId: z.string().optional(),
    customerId: z.string().min(1, "Customer is required"),
    quotationDate: z.string().min(1, "Quotation date is required"),
    validUntil: z.string().min(1, "Valid until date is required"),
    lineItems: z.array(quotationLineItemSchema).min(1, "At least one line item is required"),
    terms: z.string().default(""),
    notes: z.string().default(""),
  })
  .refine(
    (data) => {
      const quotationDate = new Date(data.quotationDate);
      const validUntil = new Date(data.validUntil);
      return validUntil >= quotationDate;
    },
    {
      message: "Valid until date must be on or after quotation date",
      path: ["validUntil"],
    }
  );

export const updateQuotationStatusSchema = z.object({
  status: quotationStatusEnum,
});

export type QuotationFormValues = z.infer<typeof quotationFormSchema>;
export type QuotationLineItemValues = z.infer<typeof quotationLineItemSchema>;
