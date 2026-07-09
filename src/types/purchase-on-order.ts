export type PurchaseOnOrderStatus = "awaiting_delivery" | "partially_received";

export type PurchaseOnOrderItem = {
  srItemId: string;
  srId: string;
  srNumber: string;
  supplierId: string;
  supplierName: string;
  supplierCode: string | null;
  itemId: string;
  itemCode: string | null;
  itemName: string;
  orderedQty: number;
  receivedQty: number;
  outstandingQty: number;
  expectedDelivery: string | null;
  status: PurchaseOnOrderStatus;
};

export type PurchaseOnOrderFilters = {
  search?: string;
  supplierId?: string;
  status?: PurchaseOnOrderStatus | "all";
  expectedFrom?: string;
  expectedTo?: string;
  page?: number;
  limit?: number;
};

export type PurchaseOnOrderResponse = {
  data: PurchaseOnOrderItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};
