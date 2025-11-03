export type SalesOrderStatus =
  | "draft"
  | "confirmed"
  | "in_progress"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface SalesOrderLineItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number; // Percentage
  taxRate: number; // Percentage
  lineTotal: number;
  quantityShipped?: number;
  quantityDelivered?: number;
}

export interface SalesOrder {
  id: string;
  companyId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  quotationId?: string; // Optional reference to original quotation
  quotationNumber?: string;
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
}

export interface CreateSalesOrderRequest {
  companyId: string;
  customerId: string;
  quotationId?: string;
  orderDate: string;
  expectedDeliveryDate: string;
  lineItems: Omit<SalesOrderLineItem, "id" | "lineTotal" | "quantityShipped" | "quantityDelivered">[];
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
  paymentTerms: string;
  notes: string;
}

export interface UpdateSalesOrderRequest extends Partial<CreateSalesOrderRequest> {
  status?: SalesOrderStatus;
}

export interface SalesOrderFilters {
  search?: string;
  status?: SalesOrderStatus | "all";
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}
