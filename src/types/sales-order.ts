import type { FrameQuotationComponent, FrameQuotationConfiguration } from "@/types/quotation";

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
  description: string;
  quantity: number;
  uomId: string; // Unit of measure ID
  uomCode?: string;
  uomName?: string;
  pricingTier?: string;
  pricingTierName?: string;
  unitPrice: number;
  discount: number; // Percentage
  taxRate: number; // Percentage
  lineTotal: number;
  skipInventory?: boolean;
  available?: number;
  reorderPoint?: number;
  quantityShipped?: number;
  quantityDelivered?: number;
  frameConfiguration?: FrameQuotationConfiguration | null;
  frameComponents?: FrameQuotationComponent[];
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
  lineItems: Omit<
    SalesOrderLineItem,
    "id" | "lineTotal" | "quantityShipped" | "quantityDelivered"
  >[];
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
  paymentTerms: string;
  notes: string;
};

export type UpdateSalesOrderRequest = Partial<CreateSalesOrderRequest> & {
  status?: SalesOrderStatus;
};

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
