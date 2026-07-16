export type MobileWarehouseDashboardData = {
  summary: {
    pending_receipts: number;
    pending_load_lists: number;
    pick_list_to_pick: number;
    urgent_stock_requests: number;
  };
};
