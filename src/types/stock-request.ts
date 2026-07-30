import type { ItemUnitOption } from "@/types/item";

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

export type StockRequestItem = {
  id: string;
  stock_request_id: string;
  item_id: string;
  requested_qty: number;
  received_qty?: number;
  item_unit_option_id?: string | null;
  selected_item_batch_id?: string | null;
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
  item_unit_option?: ItemUnitOption;
  selected_item_batch?: {
    id: string;
    batch_code: string;
    received_at?: string | null;
    warehouse?: {
      id: string;
      warehouse_code: string;
      warehouse_name: string;
    } | null;
  } | null;
};

export type StockRequest = {
  id: string;
  company_id: string;
  business_unit_id?: string | null;
  fulfilling_business_unit_id: string;
  request_code: string;
  request_date: string;
  required_date: string;
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
  requesting_business_unit?: {
    id: string;
    code: string;
    name: string;
  } | null;
  fulfilling_business_unit?: {
    id: string;
    code: string;
    name: string;
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
};

export type CreateStockRequestPayload = {
  request_date: string;
  required_date: string;
  fulfilling_business_unit_id: string;
  department?: string;
  priority: StockRequestPriority;
  purpose?: string;
  notes?: string;
  items: Array<{
    item_id: string;
    requested_qty: number;
    item_unit_option_id: string;
    selected_item_batch_id?: string | null;
    uom_id: string;
    notes?: string;
  }>;
};

export type UpdateStockRequestPayload = Partial<
  Omit<CreateStockRequestPayload, "fulfilling_business_unit_id">
>;

export type StockRequestListParams = {
  search?: string;
  requestingBusinessUnitId?: string;
  fulfillingBusinessUnitId?: string;
  status?: StockRequestStatus;
  priority?: StockRequestPriority;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
};

export type StockRequestListResponse = {
  data: StockRequest[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};
