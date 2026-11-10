export type ExpiredBatchesGroupBy = "item" | "batch";
export type ExpiredBatchesFilters = {
  asOf: string;
  groupBy: ExpiredBatchesGroupBy;
  search?: string;
  warehouseId?: string;
  categoryId?: string;
  page?: number;
  limit?: number;
  exportMode?: "pdf";
};
export type ExpiredBatchRow = {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  warehouseId: string;
  warehouse: string;
  batchCode: string;
  expirationDate: string;
  daysExpired: number;
  qtyOnHand: number;
  qtyReserved: number;
  qtyAvailable: number;
  unit: string | null;
  groupKey: string;
  groupLabel: string;
};
export type ExpiredBatchesResponse = {
  data: ExpiredBatchRow[];
  totalRows: number;
  pageRows: number;
  pagination: { page: number; limit: number; total: number; totalPages: number };
};
