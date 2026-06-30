export type StockAdjustmentType =
  | "physical_count"
  | "damage"
  | "loss"
  | "found"
  | "quality_issue"
  | "other";

export type StockAdjustmentStatus = "draft" | "pending" | "approved" | "posted" | "rejected";

export type StockAdjustmentBatchLocation = {
  id: string;
  itemId: string;
  warehouseId: string;
  locationId: string;
  itemBatchId: string;
  batchLocationSku: string;
  batchCode: string;
  receivedAt: string;
  qtyOnHand: number;
  qtyAvailable: number;
  qtyReserved: number;
  locationCode?: string | null;
  locationName?: string | null;
};

export interface StockAdjustmentItem {
  id: string;
  adjustmentId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemBatchLocationId?: string | null;
  batchLocationSku?: string | null;
  batchCode?: string | null;
  batchReceivedAt?: string | null;
  batchWarehouseLocationId?: string | null;
  batchLocationCode?: string | null;
  batchLocationName?: string | null;
  currentQty: number;
  adjustedQty: number;
  difference: number;
  unitCost: number;
  totalCost: number;
  uomId: string;
  uomName?: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockAdjustment {
  id: string;
  companyId: string;
  adjustmentCode: string;
  adjustmentType: StockAdjustmentType;
  adjustmentDate: string;
  warehouseId: string;
  locationId?: string;
  locationCode?: string;
  locationName?: string;
  warehouseName?: string;
  status: StockAdjustmentStatus;
  reason: string;
  notes?: string;
  totalValue: number;
  stockTransactionId?: string;
  stockTransactionCode?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  postedBy?: string;
  postedByName?: string;
  postedAt?: string;
  createdBy: string;
  createdByName?: string;
  updatedBy: string;
  updatedByName?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  items: StockAdjustmentItem[];
}

export interface CreateStockAdjustmentRequest {
  companyId: string;
  adjustmentType: StockAdjustmentType;
  adjustmentDate: string;
  warehouseId: string;
  locationId?: string;
  reason: string;
  notes?: string;
  items: {
    itemId: string;
    itemBatchLocationId?: string | null;
    batchCode?: string | null;
    currentQty: number;
    adjustedQty: number;
    unitCost: number;
    uomId: string;
    reason?: string;
  }[];
}

export interface UpdateStockAdjustmentRequest {
  adjustmentType?: StockAdjustmentType;
  adjustmentDate?: string;
  warehouseId?: string;
  locationId?: string;
  reason?: string;
  notes?: string;
  items?: {
    id?: string;
    itemId: string;
    itemBatchLocationId?: string | null;
    batchCode?: string | null;
    currentQty: number;
    adjustedQty: number;
    unitCost: number;
    uomId: string;
    reason?: string;
  }[];
}

export interface PostStockAdjustmentRequest {
  approvedBy?: string;
}

export interface StockAdjustmentListParams {
  search?: string;
  warehouseId?: string;
  adjustmentType?: StockAdjustmentType;
  status?: StockAdjustmentStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface StockAdjustmentListResponse {
  data: StockAdjustment[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
