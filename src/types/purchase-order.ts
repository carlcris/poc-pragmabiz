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
  item?: {
    id: string;
    code: string;
    name: string;
  };
  quantity: number;
  packagingId?: string | null;
  packagingName?: string;
  packaging?: {
    id: string;
    name: string;
    qtyPerPack: number;
  };
  uomId?: string;
  uom?: {
    id: string;
    code: string;
    name: string;
  };
  rate: number;
  discountPercent: number;
  taxPercent: number;
  lineTotal: number;
  quantityReceived?: number;
}

export interface PurchaseOrder {
  id: string;
  companyId: string;
  orderCode: string;
  supplierId: string;
  supplier?: {
    id: string;
    code: string;
    name: string;
  };
  orderDate: string;
  expectedDeliveryDate: string;
  status: PurchaseOrderStatus;
  items: PurchaseOrderLineItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  deliveryAddress: string;
  deliveryAddressLine2?: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryPostalCode: string;
  deliveryCountry: string;
  paymentTerms?: string;
  notes?: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePurchaseOrderRequest {
  supplierId: string;
  orderDate: string;
  expectedDeliveryDate: string;
  items: {
    itemId: string;
    quantity: number;
    packagingId?: string | null;
    uomId: string;
    rate: number;
    discountPercent: number;
    taxPercent: number;
  }[];
  deliveryAddress: string;
  deliveryAddressLine2?: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryPostalCode: string;
  deliveryCountry: string;
  notes?: string;
  discountAmount: number;
  taxAmount: number;
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
