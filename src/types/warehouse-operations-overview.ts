export const OPERATIONS_OVERVIEW_RANGES = [7, 14, 30] as const;

export type OperationsOverviewRange = (typeof OPERATIONS_OVERVIEW_RANGES)[number];

export type StockMovementDay = {
  date: string;
  in: number;
  out: number;
};

// Fully reserved items have stock in storage and all of it is reserved.
export type StockHealthCounts = {
  inStock: number;
  belowReorder: number;
  fullyReserved: number;
  outOfStock: number;
};

export type InboundPipelineStatus =
  | "confirmed"
  | "in_transit"
  | "arrived"
  | "receiving"
  | "pending_approval";

export type InboundOverview = {
  pipeline: Record<InboundPipelineStatus, number>;
  overdue: number;
  arrivals: Array<{ date: string; count: number }>;
};

// Counts by local days since created: [under 1, 1-3, 4-7, over 7].
export type OpenWorkAgeBuckets = [number, number, number, number];

export type OpenWorkAge = {
  pickLists: OpenWorkAgeBuckets | null;
  stockRequests: OpenWorkAgeBuckets | null;
  incoming: OpenWorkAgeBuckets | null;
};

export type ExpiringBatch = {
  batchId: string;
  itemId: string;
  itemName: string;
  batchCode: string;
  warehouseCode: string;
  qtyOnHand: number;
  uom: string | null;
  expirationDate: string;
  daysLeft: number;
};

// `batches` holds upcoming expiries only (daysLeft >= 0); expired stock is counted.
export type ExpiringBatches = {
  expired: number;
  withinSevenDays: number;
  batches: ExpiringBatch[];
};

export type SlowMovingItem = {
  itemId: string;
  itemName: string;
  onHand: number;
  uom: string | null;
  lastMovedOn: string | null;
  daysIdle: number | null;
};

export type SlowMovingStock = {
  total: number;
  items: SlowMovingItem[];
};

// Each section is null when the caller lacks the permission that gates it.
export type WarehouseOperationsOverview = {
  asOf: string;
  days: OperationsOverviewRange;
  stockMovements: StockMovementDay[] | null;
  stockHealth: StockHealthCounts | null;
  inbound: InboundOverview | null;
  openWorkAge: OpenWorkAge;
  expiringBatches: ExpiringBatches | null;
  slowMoving: SlowMovingStock | null;
};
