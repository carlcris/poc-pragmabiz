// ============================================================================
// Types: Warehouse Dashboard
// ============================================================================

export type DashboardData = {
  summary: DashboardSummary;
  low_stocks: LowStockItem[];
  out_of_stocks: OutOfStockItem[];
  queues: DashboardQueues;
  last_stock_movements: StockMovementItem[];
};

export type DashboardSummary = {
  incoming_deliveries_today: number;
  pending_stock_requests: number;
  pick_list_to_pick: number;
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
  last_moved_at: string | null;
};

export type DashboardQueues = {
  pick_list: PickListItem[];
  incoming_deliveries: IncomingDeliveryItem[];
  stock_requests: StockRequestItem[];
};

export type PickListItem = {
  id: string;
  request_code: string;
  lines: number;
  priority: Priority;
  status: string;
  required_date: string;
  requested_by: string;
};

export type IncomingDeliveryItem = {
  id: string;
  order_code: string;
  supplier: string;
  eta: string;
  status: string;
  priority: Priority;
  lines: number;
};

export type StockRequestItem = {
  id: string;
  request_code: string;
  requested_by: string;
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
  performed_by: string;
};

export type Priority = 'low' | 'normal' | 'high' | 'urgent';
