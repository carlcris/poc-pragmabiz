// ============================================================================
// Types: Warehouse Dashboard
// ============================================================================

export type DashboardData = {
  summary: DashboardSummary;
  low_stocks: LowStockItem[];
  out_of_stocks: OutOfStockItem[];
  queues: DashboardQueues;
  last_stock_movements: StockMovementItem[];
  capabilities?: WarehouseDashboardCapabilities;
};

export type WarehouseDashboardCapabilities = {
  canViewStockValue: boolean;
  canViewReorderValue: boolean;
  canViewIncomingShipmentsCard: boolean;
  canViewStockRequestsCard: boolean;
  canViewPickListCard: boolean;
  canViewPickListQueue: boolean;
  canViewIncomingDeliveriesQueue: boolean;
  canViewStockRequestsQueue: boolean;
};

export type DashboardSummary = {
  incoming_deliveries_today: number;
  pending_stock_requests: number;
  pick_list_to_pick: number;
  urgent_stock_requests: number;
};

export type LowStockItem = {
  item_id: string;
  item_name: string;
  qty: number;
  uom: string;
  location_code: string | null;
  reorder_level: number;
};

export type OutOfStockItem = {
  item_id: string;
  item_name: string;
  qty: number;
  uom: string;
  location_code: string | null;
};

export type DashboardQueues = {
  pick_list: PickListItem[];
  incoming_deliveries: IncomingDeliveryItem[];
  stock_requests: StockRequestItem[];
  // Full open counts; each queue array is bounded and may hold fewer rows.
  totals: DashboardQueueTotals;
};

export type DashboardQueueTotals = {
  pick_list: number;
  incoming_deliveries: number;
  stock_requests: number;
};

export type PickListItem = {
  id: string;
  pick_list_no: string;
  delivery_note_id: string;
  lines: number;
  status: string;
  created_at: string;
  created_by: string | null;
};

export type IncomingDeliveryItem = {
  id: string;
  order_code: string;
  supplier: string | null;
  eta: string | null;
  status: string;
  lines: number;
};

export type StockRequestItem = {
  id: string;
  request_code: string;
  requested_by: string | null;
  lines: number;
  priority: Priority;
  status: string;
  required_date: string;
};

export type StockMovementItem = {
  type: string;
  item_name: string;
  qty: number;
  uom: string;
  timestamp: string;
  performed_by: string | null;
};

export type Priority = "low" | "normal" | "high" | "urgent";
