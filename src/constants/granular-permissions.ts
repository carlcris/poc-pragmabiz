export type GranularPermissionAction = "view" | "create" | "edit" | "delete";

export const GRANULAR_CAPABILITIES = {
  DASHBOARD_TOTAL_SALES: "dashboard.widget.total_sales.view",
  DASHBOARD_TOP_AGENT_SALES: "dashboard.widget.top_agent_sales.view",
  DASHBOARD_RECENT_ACTIVITY_AMOUNT: "dashboard.widget.recent_activity_amount.view",
  DASHBOARD_STOCK_VALUE: "dashboard.widget.stock_value.view",
  DASHBOARD_REORDER_VALUE: "dashboard.widget.reorder_value.view",
  DASHBOARD_INCOMING_SHIPMENTS_CARD: "dashboard.card.incoming_shipments.view",
  DASHBOARD_STOCK_REQUESTS_CARD: "dashboard.card.stock_requests.view",
  DASHBOARD_PICK_LIST_CARD: "dashboard.card.pick_list.view",
  DASHBOARD_PICK_LIST_QUEUE: "dashboard.queue.pick_list.view",
  DASHBOARD_INCOMING_DELIVERIES_QUEUE: "dashboard.queue.incoming_deliveries.view",
  DASHBOARD_STOCK_REQUESTS_QUEUE: "dashboard.queue.stock_requests.view",

  ITEM_MASTER_TOTAL_AVAILABLE_VALUE: "items.widget.total_available_value.view",
  ITEM_DETAILS_PRICING_DETAILS: "items.card.pricing_details.view",
  ITEM_SOP_VIEW: "items.field.sop.view",
  ITEM_SOP_EDIT: "items.field.sop.edit",
  ITEM_BATCH_QR_PRINT: "items.operation.print_batch_qr.view",

  PURCHASING_SR_VALUE: "purchasing_dashboard.widget.stock_requisition_value.view",
  PURCHASING_DAMAGED_ITEMS_VALUE: "purchasing_dashboard.widget.damaged_items_value.view",
  PURCHASING_SUPPLIER_SPEND: "purchasing_dashboard.widget.supplier_spend.view",
  PURCHASING_OUTSTANDING_REQUISITIONS: "purchasing_dashboard.widget.outstanding_requisitions.view",
  PURCHASING_DAMAGED_ITEMS: "purchasing_dashboard.widget.damaged_items.view",
  PURCHASING_EXPECTED_ARRIVALS: "purchasing_dashboard.widget.expected_arrivals.view",
  PURCHASING_DELAYED_SHIPMENTS: "purchasing_dashboard.widget.delayed_shipments.view",
  PURCHASING_TODAYS_RECEIVING_QUEUE: "purchasing_dashboard.widget.todays_receiving_queue.view",
  PURCHASING_PENDING_APPROVALS: "purchasing_dashboard.widget.pending_approvals.view",
  PURCHASING_BOX_ASSIGNMENT_QUEUE: "purchasing_dashboard.widget.box_assignment_queue.view",
  PURCHASING_WAREHOUSE_CAPACITY: "purchasing_dashboard.widget.warehouse_capacity.view",
  PURCHASING_ACTIVE_REQUISITIONS: "purchasing_dashboard.widget.active_requisitions.view",
  PURCHASING_INCOMING_DELIVERIES: "purchasing_dashboard.widget.incoming_deliveries.view",
  PURCHASING_ACTIVE_CONTAINERS: "purchasing_dashboard.widget.active_containers.view",
  PURCHASING_LOCATION_ASSIGNMENT: "purchasing_dashboard.widget.location_assignment.view",

  SALES_ANALYTICS_TOTAL_SALES: "sales_analytics.widget.total_sales.view",
  SALES_ANALYTICS_COMMISSIONS: "sales_analytics.widget.commissions.view",
  SALES_ANALYTICS_AVERAGE_ORDER_VALUE: "sales_analytics.widget.average_order_value.view",

  REPORTS_FINANCIAL_CARDS: "reports.card.financial_reports.view",
  REPORTS_REVENUE_CARDS: "reports.card.revenue_reports.view",
  REPORTS_VALUATION_CARDS: "reports.card.valuation_reports.view",

  STOCK_REQUISITIONS_TOTAL_AMOUNT: "stock_requisitions.field.total_amount.view",
  STOCK_REQUISITIONS_UNIT_COST: "stock_requisitions.field.unit_cost.view",
  STOCK_REQUISITIONS_SUPPLIER_COST_SUMMARY: "stock_requisitions.summary.supplier_cost_summary.view",

  LOAD_LISTS_TOTAL_AMOUNT: "load_lists.field.total_amount.view",
  LOAD_LISTS_UNIT_PRICE: "load_lists.field.unit_price.view",

  DELIVERY_NOTE_RECEIVING: "stock_requests.operation.receive_delivery_notes.edit",
  PICK_LIST_VIEW_ONLY_ASSIGNED: "stock_requests.operation.view_only_assigned_pick_lists.view",
  GRN_RECEIVING_START: "goods_receipt_notes.operation.start_receiving.edit",
  GRN_RECEIVING_SAVE: "goods_receipt_notes.operation.save_receiving.edit",
  GRN_RECEIVING_SUBMIT: "goods_receipt_notes.operation.submit_receiving.edit",
} as const;

export type GranularCapability = (typeof GRANULAR_CAPABILITIES)[keyof typeof GRANULAR_CAPABILITIES];

export const PHASE_1_GRANULAR_CAPABILITY_KEYS = Object.values(GRANULAR_CAPABILITIES);

export type DashboardWidgetCapabilities = {
  canViewTotalSales: boolean;
  canViewTopAgentSales: boolean;
  canViewRecentActivityAmount: boolean;
  canViewStockValue: boolean;
  canViewReorderValue: boolean;
  canViewIncomingShipmentsCard: boolean;
  canViewStockRequestsCard: boolean;
  canViewPickListCard: boolean;
  canViewPickListQueue: boolean;
  canViewIncomingDeliveriesQueue: boolean;
  canViewStockRequestsQueue: boolean;
};

export type ItemMasterCapabilities = {
  canViewTotalAvailableValue: boolean;
  canViewPricingDetails: boolean;
  canViewSop: boolean;
  canEditSop: boolean;
};

export type PurchasingDashboardCapabilities = {
  canViewStockRequisitionValue: boolean;
  canViewDamagedItemsValue: boolean;
  canViewSupplierSpend: boolean;
  canViewOutstandingRequisitions: boolean;
  canViewDamagedItems: boolean;
  canViewExpectedArrivals: boolean;
  canViewDelayedShipments: boolean;
  canViewTodaysReceivingQueue: boolean;
  canViewPendingApprovals: boolean;
  canViewBoxAssignmentQueue: boolean;
  canViewWarehouseCapacity: boolean;
  canViewActiveRequisitions: boolean;
  canViewIncomingDeliveries: boolean;
  canViewActiveContainers: boolean;
  canViewLocationAssignment: boolean;
};

export type SalesAnalyticsCapabilities = {
  canViewTotalSales: boolean;
  canViewCommissions: boolean;
  canViewAverageOrderValue: boolean;
};

export type ReportsCardCapabilities = {
  canViewFinancialReports: boolean;
  canViewRevenueReports: boolean;
  canViewValuationReports: boolean;
};

export type StockRequisitionCapabilities = {
  canViewTotalAmount: boolean;
  canViewUnitCost: boolean;
  canViewSupplierCostSummary: boolean;
};

export type LoadListCapabilities = {
  canViewTotalAmount: boolean;
  canViewUnitPrice: boolean;
};

export type GrnReceivingCapabilities = {
  canStartReceiving: boolean;
  canSaveReceiving: boolean;
  canSubmitReceiving: boolean;
};

export type DeliveryNoteReceivingCapabilities = {
  canReceiveDeliveryNotes: boolean;
};
