import type {
  FrameQuotationComponent,
  FrameQuotationConfiguration,
  FrameQuotationMatLayer,
  FrameQuotationSize,
} from "@/types/quotation";
import type { QuotationLinePricing } from "@/lib/sales-orders/sales-order-line-pricing";

export type SalesOrderStatus =
  | "draft"
  | "confirmed"
  | "in_progress"
  | "shipped"
  | "delivered"
  | "invoiced"
  | "cancelled";

export type SalesOrderLineItem = {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quotationId?: string | null;
  quotationNumber?: string;
  quotationItemId?: string | null;
  quotationRemainingQuantity?: number;
  quotationPricing?: QuotationLinePricing;
  description: string;
  quantity: number;
  uomId: string; // Unit of measure ID
  uomCode?: string;
  uomName?: string;
  pricingTier?: string;
  pricingTierName?: string;
  unitPrice: number;
  discount: number; // Percentage
  discountAmount: number; // Saved currency deduction; not reconstructed from the percentage.
  taxRate: number; // Percentage
  lineTotal: number;
  skipInventory?: boolean;
  available?: number;
  reorderPoint?: number;
  quantityShipped?: number;
  quantityDelivered?: number;
  frameConfiguration?: FrameQuotationConfiguration | null;
  frameComponents?: FrameQuotationComponent[];
  matLayers?: FrameQuotationMatLayer[];
  frameSizes?: FrameQuotationSize[];
  manufacturing?: {
    required: boolean;
    status:
      | "needs_job_order"
      | "job_order_ready"
      | "ready"
      | "in_progress"
      | "quality_check"
      | "on_hold"
      | "ready_for_release"
      | "cancelled";
    label: string;
    jobOrderId?: string;
    jobOrderCode?: string;
    manufacturingOrderId?: string;
    manufacturingOrderCode?: string;
    operationName?: string;
  } | null;
};

export type SalesOrder = {
  id: string;
  companyId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  orderDate: string;
  expectedDeliveryDate: string;
  status: SalesOrderStatus;
  fulfillingWarehouseId: string | null;
  fulfillingWarehouseCode: string | null;
  fulfillingWarehouseName: string | null;
  lineItems: SalesOrderLineItem[];
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  totalAmount: number;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
  paymentTerms: string;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  hasFrameJobEligibleItems?: boolean;
  frameJobOrder?: {
    id: string;
    jobOrderCode: string;
    status: string;
  } | null;
};

export type CreateSalesOrderRequest = {
  customerId: string;
  orderDate: string;
  expectedDeliveryDate: string;
  lineItems: SalesOrderLineItemRequest[];
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
  paymentTerms: string;
  notes: string;
};

export type SalesOrderFrameSizeSelection = {
  quotationConfigurationId: string;
  quantity: number;
};

export type SalesOrderLineItemRequest = {
  itemId: string;
  quotationId?: string | null;
  quotationItemId?: string | null;
  description: string;
  quantity: number;
  uomId: string;
  pricingTier?: string;
  pricingTierName?: string;
  unitPrice: number;
  discount: number;
  taxRate: number;
  frameSizeSelections?: SalesOrderFrameSizeSelection[];
};

/** Draft editing replaces the submitted header and line collection atomically. */
export type UpdateSalesOrderRequest = {
  customerId: string;
  orderDate: string;
  expectedDeliveryDate: string;
  lineItems: SalesOrderLineItemRequest[];
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
  paymentTerms: string;
  notes: string;
};

export type SalesOrderMutationErrorCode =
  | "SALES_ORDER_UNAUTHENTICATED"
  | "SALES_ORDER_FORBIDDEN"
  | "SALES_ORDER_NOT_FOUND"
  | "SALES_ORDER_NOT_EDITABLE"
  | "SALES_ORDER_ITEMS_REQUIRED"
  | "SALES_ORDER_VALIDATION_FAILED"
  | "SALES_ORDER_CUSTOMER_INVALID"
  | "SALES_ORDER_QUOTATION_LINE_INVALID"
  | "SALES_ORDER_QUOTATION_FRAME_INVALID"
  | "SALES_ORDER_FRAME_SOURCE_REQUIRED"
  | "SALES_ORDER_FRAME_SIZE_INVALID"
  | "SALES_ORDER_FRAME_QUANTITY_EXCEEDS_REMAINING"
  | "SALES_ORDER_FRAME_QUANTITY_MISMATCH"
  | "SALES_ORDER_SAVE_FAILED";

export type SalesOrderFilters = {
  search?: string;
  status?: SalesOrderStatus | "all";
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
};

export type SalesOrderPaymentSummary = {
  invoices: {
    id: string;
    invoiceCode: string;
    totalAmount: number;
    amountPaid: number;
    amountDue: number;
    status: string;
    payments: {
      id: string;
      paymentCode: string;
      paymentDate: string;
      amount: number;
      paymentMethod: string;
      reference?: string;
      notes?: string;
    }[];
  }[];
  summary: {
    totalInvoiced: number;
    totalPaid: number;
    totalDue: number;
  };
};
