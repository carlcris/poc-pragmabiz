import { z } from "zod";

export const salesOrderStatusEnum = z.enum([
  "draft",
  "confirmed",
  "in_progress",
  "shipped",
  "delivered",
  "cancelled",
]);

export const salesOrderLineItemSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  itemCode: z.string().min(1, "Item code is required"),
  itemName: z.string().min(1, "Item name is required"),
  description: z.string().default(""),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  unitPrice: z.number().min(0, "Unit price must be non-negative"),
  discount: z
    .number()
    .min(0, "Discount cannot be negative")
    .max(100, "Discount cannot exceed 100%"),
  taxRate: z.number().min(0, "Tax rate cannot be negative").max(100, "Tax rate cannot exceed 100%"),
});

export const salesOrderFormSchema = z
  .object({
    companyId: z.string().min(1, "Company is required"),
    customerId: z.string().min(1, "Customer is required"),
    quotationId: z.string().optional(),
    orderDate: z.string().min(1, "Order date is required"),
    expectedDeliveryDate: z.string().min(1, "Expected delivery date is required"),
    lineItems: z.array(salesOrderLineItemSchema).min(1, "At least one line item is required"),
    shippingAddress: z.string().min(1, "Shipping address is required"),
    shippingCity: z.string().min(1, "Shipping city is required"),
    shippingState: z.string().min(1, "Shipping state is required"),
    shippingPostalCode: z.string().min(1, "Shipping postal code is required"),
    shippingCountry: z.string().min(1, "Shipping country is required"),
    paymentTerms: z.string().default(""),
    notes: z.string().default(""),
  })
  .refine(
    (data) => {
      const orderDate = new Date(data.orderDate);
      const deliveryDate = new Date(data.expectedDeliveryDate);
      return deliveryDate >= orderDate;
    },
    {
      message: "Expected delivery date must be on or after order date",
      path: ["expectedDeliveryDate"],
    }
  );

export const updateSalesOrderStatusSchema = z.object({
  status: salesOrderStatusEnum,
});

export type SalesOrderFormValues = z.infer<typeof salesOrderFormSchema>;
export type SalesOrderLineItemValues = z.infer<typeof salesOrderLineItemSchema>;
