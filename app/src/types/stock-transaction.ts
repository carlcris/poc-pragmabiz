export type TransactionType = "in" | "out" | "transfer" | "adjustment";

export interface StockTransaction {
  id: string;
  companyId: string;
  transactionDate: string;
  transactionType: TransactionType;
  itemId: string;
  itemCode: string;
  itemName: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  toWarehouseId?: string;
  toWarehouseCode?: string;
  toWarehouseName?: string;
  quantity: number;
  uom: string;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  reason: string;
  notes: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockTransactionItem {
  itemId: string;
  quantity: number;
  uomId: string;
  unitCost?: number;
  batchNo?: string;
  serialNo?: string;
  expiryDate?: string;
  notes?: string;
}

export interface CreateStockTransactionRequest {
  transactionDate: string;
  transactionType: TransactionType;
  warehouseId: string;
  toWarehouseId?: string;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  notes?: string;
  items: StockTransactionItem[];
}

export interface StockTransactionFilters {
  search?: string;
  transactionType?: TransactionType | "all";
  itemId?: string;
  warehouseId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface StockTransactionListResponse {
  data: StockTransaction[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface StockBalance {
  itemId: string;
  itemCode: string;
  itemName: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  quantity: number;
  uom: string;
  lastUpdated: string;
}
