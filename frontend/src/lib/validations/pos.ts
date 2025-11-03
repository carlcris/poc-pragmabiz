import { z } from "zod";

export const posCartItemSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  itemCode: z.string().min(1),
  itemName: z.string().min(1),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).default(0),
  lineTotal: z.number(),
});

export const posPaymentSchema = z.object({
  method: z.enum(["cash", "credit_card", "debit_card", "gcash", "paymaya"]),
  amount: z.number().min(0.01, "Payment amount must be greater than 0"),
  reference: z.string().optional(),
});

export const posTransactionCreateSchema = z.object({
  customerId: z.string().optional(),
  items: z.array(posCartItemSchema).min(1, "At least one item is required"),
  payments: z.array(posPaymentSchema).min(1, "At least one payment is required"),
  notes: z.string().optional(),
});

export type POSCartItemFormData = z.infer<typeof posCartItemSchema>;
export type POSPaymentFormData = z.infer<typeof posPaymentSchema>;
export type POSTransactionCreateFormData = z.infer<typeof posTransactionCreateSchema>;
