import { z } from "zod";

export const createPurchaseOrderFormSchema = (t: (key: string) => string) =>
  z.object({
    supplierId: z.string().min(1, t("supplierRequired")),
    orderDate: z.string().min(1, t("orderDateRequired")),
    expectedDeliveryDate: z.string().min(1, t("expectedDeliveryDateRequired")),
    deliveryAddress: z.string().min(1, t("deliveryAddressRequired")),
    deliveryCity: z.string().min(1, t("cityRequired")),
    deliveryState: z.string().min(1, t("stateRequired")),
    deliveryCountry: z.string().min(1, t("countryRequired")),
    deliveryPostalCode: z.string().min(1, t("postalCodeRequired")),
    notes: z.string().optional(),
  });

export const purchaseOrderFormSchema = createPurchaseOrderFormSchema((key) => key);

export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderFormSchema>;

export const createPurchaseOrderLineItemSchema = (t: (key: string) => string) =>
  z.object({
    itemId: z.string().min(1, t("itemRequired")),
    itemCode: z.string().optional(),
    itemName: z.string().optional(),
    quantity: z.number().min(0.01, t("quantityMin")),
    rate: z.number().min(0, t("rateMin")),
    uomId: z.string().min(1, t("uomRequired")),
    discountPercent: z.number().min(0).max(100).default(0),
    taxPercent: z.number().min(0).max(100).default(0),
  });

export const purchaseOrderLineItemSchema = createPurchaseOrderLineItemSchema((key) => key);

export type PurchaseOrderLineItemInput = z.input<typeof purchaseOrderLineItemSchema>;

export const createReceiveGoodsSchema = (t: (key: string) => string) =>
  z.object({
    warehouseId: z.string().min(1, t("warehouseRequired")),
    locationId: z.string().optional(),
    receiptDate: z.string().min(1, t("receiptDateRequired")),
    batchSequenceNumber: z.string().optional(),
    supplierInvoiceNumber: z.string().optional(),
    supplierInvoiceDate: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(
      z.object({
        purchaseOrderItemId: z.string(),
        itemId: z.string(),
        quantityOrdered: z.number(),
        quantityReceived: z.number().min(0, t("quantityNonNegative")),
        uomId: z.string(),
        rate: z.number(),
      })
    ),
  });

export const receiveGoodsSchema = createReceiveGoodsSchema((key) => key);

export type ReceiveGoodsFormValues = z.infer<typeof receiveGoodsSchema>;
