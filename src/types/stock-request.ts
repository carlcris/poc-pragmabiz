export type StockRequestStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "picking"
  | "picked"
  | "delivered"
  | "received"
  | "completed"
  | "cancelled"
  | "allocating"
  | "partially_allocated"
  | "allocated"
  | "dispatched"
  | "partially_fulfilled"
  | "fulfilled";

export type StockRequestPriority = "low" | "normal" | "high" | "urgent";

export interface StockRequestItem {
  id: string;
  stock_request_id: string;
  item_id: string;
  requested_qty: number;
  received_qty?: number;
  uom_id: string;
  notes?: string | null;
  dispatch_qty?: number;
  created_at: string;
  updated_at: string;
  // Joined data
  items?: {
    id: string;
    item_code: string;
    item_name: string;
  };
  units_of_measure?: {
    id: string;
    code: string;
    symbol: string;
  };
}

export interface StockRequest {
  id: string;
  company_id: string;
  business_unit_id?: string | null;
  request_code: string;
  request_date: string;
  required_date: string;
  requesting_warehouse_id: string;
  fulfilling_warehouse_id?: string | null;
  department?: string | null;
  status: StockRequestStatus;
  priority: StockRequestPriority;
  purpose?: string | null;
  notes?: string | null;
  requested_by_user_id: string;
  requested_by_name?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  picked_by?: string | null;
  picked_at?: string | null;
  received_by?: string | null;
  received_at?: string | null;
  created_at: string;
  created_by?: string | null;
  updated_at: string;
  updated_by?: string | null;
  deleted_at?: string | null;
  version: number;
  // Joined data
  requesting_warehouse?: {
    id: string;
    warehouse_code: string;
    warehouse_name: string;
    businessUnitId?: string | null;
  } | null;
  fulfilling_warehouse?: {
    id: string;
    warehouse_code: string;
    warehouse_name: string;
    businessUnitId?: string | null;
  } | null;
  fulfilling_delivery_note?: {
    id: string;
    dn_no: string;
    status: string;
    created_at?: string | null;
  } | null;
  fulfilling_delivery_notes?: Array<{
    id: string;
    dn_no: string;
    status: string;
    created_at?: string | null;
  }>;
  requested_by_user?: {
    id: string;
    email: string;
    first_name?: string | null;
    last_name?: string | null;
    full_name?: string | null;
  };
  received_by_user?: {
    id: string;
    email: string;
    first_name?: string | null;
    last_name?: string | null;
    full_name?: string | null;
  };
  stock_request_items?: StockRequestItem[];
}

export interface CreateStockRequestPayload {
  request_date: string;
  required_date: string;
  requesting_warehouse_id: string;
  fulfilling_warehouse_id: string;
  department?: string;
  priority: StockRequestPriority;
  purpose?: string;
  notes?: string;
  items: Array<{
    item_id: string;
    requested_qty: number;
    uom_id: string;
    notes?: string;
  }>;
}

export type UpdateStockRequestPayload = Partial<CreateStockRequestPayload>;

export interface StockRequestListParams {
  search?: string;
  requestingWarehouseId?: string;
  fulfillingWarehouseId?: string;
  status?: StockRequestStatus;
  priority?: StockRequestPriority;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface StockRequestListResponse {
  data: StockRequest[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export type ReceiveStockRequestPayload = {
  receivedDate?: string;
  notes?: string;
  items: Array<{
    stockRequestItemId: string;
    itemId: string;
    requestedQty: number;
    receivedQty: number;
    uomId: string;
    locationId?: string | null;
  }>;
};

export type StockRequestPickLineInput = {
  stockRequestItemId: string;
  pickedQty: number;
  shortReasonCode?: string;
};

export type PickStockRequestPayload = {
  notes?: string;
  items: StockRequestPickLineInput[];
};

export type StockRequestDispatchLineInput = {
  stockRequestItemId: string;
  dispatchQty?: number;
};

export type DispatchStockRequestPayload = {
  dispatchDate?: string;
  notes?: string;
  items?: StockRequestDispatchLineInput[];
};
