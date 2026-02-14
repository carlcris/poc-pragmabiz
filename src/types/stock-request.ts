export type StockRequestStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "ready_for_pick"
  | "picked"
  | "delivered"
  | "received"
  | "completed"
  | "cancelled";

export type StockRequestPriority = "low" | "normal" | "high" | "urgent";

export interface StockRequestItem {
  id: string;
  stock_request_id: string;
  item_id: string;
  requested_qty: number;
  picked_qty: number;
  uom_id: string;
  notes?: string | null;
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
  from_location_id: string;
  to_location_id?: string | null;
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
  from_location?: {
    id: string;
    warehouse_code: string;
    warehouse_name: string;
    businessUnitId?: string | null;
  } | null;
  to_location?: {
    id: string;
    warehouse_code: string;
    warehouse_name: string;
    businessUnitId?: string | null;
  } | null;
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
  from_location_id: string;
  to_location_id: string;
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
  fromLocationId?: string;
  toLocationId?: string;
  status?: StockRequestStatus;
  priority?: StockRequestPriority;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface StockRequestListResponse {
  data: StockRequest[];
  total: number;
  page: number;
  limit: number;
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
