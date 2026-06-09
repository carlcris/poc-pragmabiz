export type QueueItem = {
  id: string;
  request_code?: string;
  ll_number?: string;
  supplier?: string | null;
  lines?: number;
  status?: string;
  required_date?: string | null;
  estimated_arrival_date?: string | null;
  requested_by?: string | null;
};

export type DashboardData = {
  summary: {
    incoming_deliveries_today: number;
    pending_stock_requests: number;
    pick_list_to_pick: number;
    urgent_stock_requests: number;
  };
  queues: {
    pick_list: QueueItem[];
    incoming_deliveries: QueueItem[];
    stock_requests: QueueItem[];
  };
  last_stock_movements: unknown[];
};
