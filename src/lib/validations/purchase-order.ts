import { z } from "zod";

export const purchaseOrderStatusEnum = z.enum([
  "draft",
  "submitted",
  "approved",
  "in_transit",
  "partially_received",
  "received",
  "cancelled",
]);

export const purchaseOrderLineItemSchema = z.object({
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

export const purchaseOrderFormSchema = z
  .object({
    companyId: z.string().min(1, "Company is required"),
    supplierId: z.string().min(1, "Supplier is required"),
    orderDate: z.string().min(1, "Order date is required"),
    expectedDeliveryDate: z.string().min(1, "Expected delivery date is required"),
    lineItems: z.array(purchaseOrderLineItemSchema).min(1, "At least one line item is required"),
    deliveryAddress: z.string().min(1, "Delivery address is required"),
    deliveryCity: z.string().min(1, "Delivery city is required"),
    deliveryState: z.string().min(1, "Delivery state is required"),
    deliveryPostalCode: z.string().min(1, "Delivery postal code is required"),
    deliveryCountry: z.string().min(1, "Delivery country is required"),
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

export const updatePurchaseOrderStatusSchema = z.object({
  status: purchaseOrderStatusEnum,
});

export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderFormSchema>;
export type PurchaseOrderLineItemValues = z.infer<typeof purchaseOrderLineItemSchema>;
