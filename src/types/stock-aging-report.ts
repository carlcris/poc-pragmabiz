export type StockAgingGroupBy = "item" | "batch";

export type StockAgingAgeBucket =
  | "all"
  | "0_30"
  | "31_60"
  | "61_90"
  | "91_180"
  | "181_plus"
  | "90_plus";

export type StockAgingReportFilters = {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  ageBucket?: StockAgingAgeBucket;
  groupBy?: StockAgingGroupBy;
  enabled?: boolean;
  exportMode?: "pdf";
};

export type StockAgingReportRow = {
  id: string;
  itemId: string;
  itemCode: string | null;
  itemName: string | null;
  category: string;
  warehouseId: string;
  warehouseCode: string | null;
  warehouseName: string | null;
  locationId: string;
  locationCode: string | null;
  locationName: string | null;
  locationPath: string | null;
  itemBatchId: string;
  batchCode: string | null;
  batchReceivedAt: string | null;
  batchAgeDays: number;
  batchAgeDuration: { years: number; months: number; days: number } | null;
  ageBucket: Exclude<StockAgingAgeBucket, "all">;
  qtyOnHand: number;
  qtyReserved: number;
  qtyAvailable: number;
  unitCost: number;
  stockValue: number;
  batchLocationSku: string | null;
  updatedAt: string;
};

export type StockAgingReportResponse = {
  data: StockAgingReportRow[];
  groups: StockAgingReportGroup[];
  summary: {
    rowCount: number;
    totalQtyOnHand: number;
    totalQtyReserved: number;
    totalQtyAvailable: number;
    totalStockValue: number;
    aged90PlusRows: number;
    aged90PlusQty: number;
    oldestAgeDays: number;
    uniqueLocations: number;
    uniqueBatches: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    search: string | null;
    category: string | null;
    ageBucket: StockAgingAgeBucket;
    groupBy: StockAgingGroupBy;
    currentBusinessUnitId: string | null;
  };
};

export type StockAgingReportGroup = {
  id: string;
  title: string;
  subtitle: string | null;
  startIndex: number;
  rowCount: number;
  subtotalQtyOnHand: number;
  subtotalQtyReserved: number;
  subtotalQtyAvailable: number;
  subtotalStockValue: number;
  oldestAgeDays: number;
};
