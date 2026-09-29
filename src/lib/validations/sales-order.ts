import { z } from "zod";

export const salesOrderStatusEnum = z.enum([
  "draft",
  "confirmed",
  "in_progress",
  "shipped",
  "delivered",
  "cancelled",
]);

const optionalUuid = z.string().uuid().nullable().optional();

export const salesOrderFrameSizeSelectionSchema = z
  .object({
    quotationConfigurationId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })
  .strict();

export const salesOrderLineItemSchema = z
  .object({
    itemId: z.string().uuid(),
    quotationId: optionalUuid,
    quotationItemId: optionalUuid,
    description: z.string().max(2000),
    quantity: z.number().positive(),
    uomId: z.string().uuid(),
    pricingTier: z.string().max(100).optional(),
    pricingTierName: z.string().max(200).optional(),
    unitPrice: z.number().nonnegative(),
    discount: z.number().min(0).max(100),
    taxRate: z.number().min(0).max(100),
    frameSizeSelections: z.array(salesOrderFrameSizeSelectionSchema).min(1).max(50).optional(),
  })
  .strict();

export const salesOrderMutationSchema = z
  .object({
    customerId: z.string().uuid(),
    orderDate: z.iso.date(),
    expectedDeliveryDate: z.iso.date(),
    lineItems: z.array(salesOrderLineItemSchema).min(1).max(200),
    shippingAddress: z.string().max(500),
    shippingCity: z.string().max(200),
    shippingState: z.string().max(200),
    shippingPostalCode: z.string().max(50),
    shippingCountry: z.string().max(200),
    paymentTerms: z.string().max(2000),
    notes: z.string().max(5000),
  })
  .strict()
  .refine((data) => data.expectedDeliveryDate >= data.orderDate, {
    path: ["expectedDeliveryDate"],
  });

export const updateSalesOrderStatusSchema = z.object({
  status: salesOrderStatusEnum,
});

export type SalesOrderFormValues = z.infer<typeof salesOrderMutationSchema>;
export type SalesOrderLineItemValues = z.infer<typeof salesOrderLineItemSchema>;
