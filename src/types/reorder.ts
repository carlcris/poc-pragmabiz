export type ReorderStatus = "ok" | "low_stock" | "critical" | "out_of_stock";
export type ReorderSuggestionStatus = "pending" | "approved" | "rejected" | "ordered";

export interface StockLevel {
  itemId: string;
  itemCode: string;
  itemName: string;
  warehouseId: string;
  warehouseName: string;
  currentStock: number;
  reorderPoint: number;
  reorderQuantity: number;
  minimumLevel: number;
  maximumLevel: number;
  averageDailyUsage: number;
  leadTimeDays: number;
  status: ReorderStatus;
  lastRestockDate?: string;
}

export interface ReorderSuggestion {
  id: string;
  companyId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  warehouseId: string;
  warehouseName: string;
  currentStock: number;
  reorderPoint: number;
  suggestedQuantity: number;
  estimatedCost: number;
  priority: "high" | "medium" | "low";
  status: ReorderSuggestionStatus;
  reason: string;
  supplierId?: string;
  supplierName?: string;
  expectedDeliveryDays: number;
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  purchaseOrderId?: string;
}

export interface ReorderRule {
  id: string;
  companyId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  warehouseId: string | null;
  warehouseName: string | null;
  reorderPoint: number;
  reorderQuantity: number;
  minimumLevel: number;
  maximumLevel: number;
  leadTimeDays: number;
  preferredSupplierId?: string;
  preferredSupplierName?: string;
  autoGeneratePO: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReorderAlert {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  warehouseId: string | null;
  warehouseName: string | null;
  currentStock: number;
  totalCurrentStock: number;
  totalAvailableStock: number;
  reorderPoint: number;
  reorderQuantity: number;
  minimumLevel: number;
  severity: "critical" | "warning" | "info";
  message: string;
  createdAt: string;
  acknowledged: boolean;
  acknowledgmentId?: string | null;
  acknowledgedBy?: string | null;
  acknowledgedAt?: string | null;
  policySource: "season_override" | "item_default";
  seasonId: string | null;
  seasonCode: string | null;
  seasonName: string | null;
  warehouseBreakdown: unknown;
  requisitionUomId: string;
  requisitionUomLabel: string;
  requisitionItemUnitOptionId: string;
  requisitionQtyPerUnit: number;
  requisitionUnitPrice: number;
  requisitionUnitPriceCurrency: string | null;
}

export type ReorderSeason = {
  id: string;
  code: string;
  name: string;
  effectiveFrom: string;
  effectiveTo: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ReorderSeasonItemPolicy = {
  id: string;
  seasonId: string;
  seasonCode: string;
  seasonName: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemUnitOptionId: string | null;
  uomId: string;
  unitOptions: Array<{
    id: string;
    label: string;
    qtyPerUnit: number;
  }>;
  reorderLevel: number;
  reorderUnitLevel: number;
  reorderQuantity: number;
  reorderUnitQuantity: number;
  baseReorderLevel: number;
  baseReorderQuantity: number;
  unitLabel: string;
  qtyPerUnit: number;
  totalQuantity: number;
  baseUnitLabel: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export interface ReorderStatistics {
  totalItemsTracked: number;
  itemsOk: number;
  itemsLowStock: number;
  itemsCritical: number;
  itemsOutOfStock: number;
  pendingSuggestions: number;
  approvedSuggestions: number;
  totalEstimatedReorderCost: number;
  activeAlerts: number;
}
