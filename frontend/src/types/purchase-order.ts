export type PurchaseOrderStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "in_transit"
  | "partially_received"
  | "received"
  | "cancelled";

export interface PurchaseOrderLineItem {
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
  quantityReceived?: number;
}

export interface PurchaseOrder {
  id: string;
  companyId: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  supplierEmail: string;
  orderDate: string;
  expectedDeliveryDate: string;
  status: PurchaseOrderStatus;
  lineItems: PurchaseOrderLineItem[];
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  totalAmount: number;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryPostalCode: string;
  deliveryCountry: string;
  paymentTerms: string;
  notes: string;
  createdBy: string;
  createdByName: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePurchaseOrderRequest {
  companyId: string;
  supplierId: string;
  orderDate: string;
  expectedDeliveryDate: string;
  lineItems: Omit<PurchaseOrderLineItem, "id" | "lineTotal" | "quantityReceived">[];
  deliveryAddress: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryPostalCode: string;
  deliveryCountry: string;
  paymentTerms: string;
  notes: string;
  createdBy: string;
}

export interface UpdatePurchaseOrderRequest extends Partial<CreatePurchaseOrderRequest> {
  status?: PurchaseOrderStatus;
}

export interface PurchaseOrderFilters {
  search?: string;
  status?: PurchaseOrderStatus | "all";
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface PurchaseOrdersResponse {
  data: PurchaseOrder[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
