import { z } from "zod";

export const invoiceStatusEnum = z.enum([
  "draft",
  "sent",
  "paid",
  "partially_paid",
  "overdue",
  "cancelled",
]);

export const invoiceLineItemSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  itemCode: z.string().min(1, "Item code is required"),
  itemName: z.string().min(1, "Item name is required"),
  description: z.string().default(""),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  unitPrice: z.number().min(0, "Unit price must be non-negative"),
  discount: z.number().min(0, "Discount cannot be negative").max(100, "Discount cannot exceed 100%"),
  taxRate: z.number().min(0, "Tax rate cannot be negative").max(100, "Tax rate cannot exceed 100%"),
});

export const invoiceFormSchema = z.object({
  companyId: z.string().min(1, "Company is required"),
  customerId: z.string().min(1, "Customer is required"),
  salesOrderId: z.string().optional(),
  invoiceDate: z.string().min(1, "Invoice date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  lineItems: z.array(invoiceLineItemSchema).min(1, "At least one line item is required"),
  billingAddress: z.string().min(1, "Billing address is required"),
  billingCity: z.string().min(1, "Billing city is required"),
  billingState: z.string().min(1, "Billing state is required"),
  billingPostalCode: z.string().min(1, "Billing postal code is required"),
  billingCountry: z.string().min(1, "Billing country is required"),
  paymentTerms: z.string().default(""),
  notes: z.string().default(""),
}).refine(
  (data) => {
    const invoiceDate = new Date(data.invoiceDate);
    const dueDate = new Date(data.dueDate);
    return dueDate >= invoiceDate;
  },
  {
    message: "Due date must be on or after invoice date",
    path: ["dueDate"],
  }
);

export const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  paymentDate: z.string().min(1, "Payment date is required"),
  paymentMethod: z.string().min(1, "Payment method is required"),
  reference: z.string().default(""),
  notes: z.string().default(""),
});

export const updateInvoiceStatusSchema = z.object({
  status: invoiceStatusEnum,
});

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;
export type InvoiceLineItemValues = z.infer<typeof invoiceLineItemSchema>;
export type RecordPaymentValues = z.infer<typeof recordPaymentSchema>;
