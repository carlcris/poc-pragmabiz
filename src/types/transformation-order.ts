// ============================================================================
// Transformation Order Types
// Purpose: Type definitions for transformation orders (actual executions)
// ============================================================================

// State machine: DRAFT → PREPARING/CANCELLED → COMPLETED
export type TransformationOrderStatus = "DRAFT" | "PREPARING" | "COMPLETED" | "CANCELLED";

export interface TransformationOrderInput {
  id: string;
  orderId: string;
  itemId: string;
  itemCode?: string;
  itemName?: string;
  warehouseId: string;
  warehouseName?: string;
  plannedQuantity: number;
  consumedQuantity?: number;
  uomId: string;
  uomName?: string;
  unitCost: number;
  totalCost: number;
  stockTransactionId?: string;
  stockTransactionCode?: string;
  sequence: number;
  notes?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface TransformationOrderOutput {
  id: string;
  orderId: string;
  itemId: string;
  itemCode?: string;
  itemName?: string;
  warehouseId: string;
  warehouseName?: string;
  plannedQuantity: number;
  producedQuantity?: number;
  uomId: string;
  uomName?: string;
  allocatedCostPerUnit: number;
  totalAllocatedCost: number;
  stockTransactionId?: string;
  stockTransactionCode?: string;
  isScrap: boolean;
  sequence: number;
  notes?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface TransformationOrder {
  id: string;
  companyId: string;
  orderCode: string;
  templateId: string;
  templateCode?: string;
  templateName?: string;
  warehouseId: string;
  warehouseName?: string;
  status: TransformationOrderStatus;
  plannedQuantity: number;
  actualQuantity?: number;
  totalInputCost: number;
  totalOutputCost: number;
  costVariance: number;
  varianceNotes?: string;
  orderDate: string;
  plannedDate?: string;
  executionDate?: string;
  completionDate?: string;
  notes?: string;
  referenceType?: string;
  referenceId?: string;
  createdAt: string;
  createdBy: string;
  createdByName?: string;
  updatedAt: string;
  updatedBy: string;
  updatedByName?: string;
  deletedAt?: string;
  inputs: TransformationOrderInput[];
  outputs: TransformationOrderOutput[];
}

// ============================================================================
// Request/Response Types for API
// ============================================================================

export interface CreateTransformationOrderRequest {
  companyId: string;
  templateId: string;
  warehouseId: string;
  plannedQuantity: number;
  orderDate?: string;
  plannedDate?: string;
  notes?: string;
  referenceType?: string;
  referenceId?: string;
}

export interface UpdateTransformationOrderRequest {
  plannedQuantity?: number;
  plannedDate?: string;
  notes?: string;
}

export interface ExecuteTransformationOrderRequest {
  inputs: {
    inputLineId: string;
    consumedQuantity: number;
  }[];
  outputs: {
    outputLineId: string;
    producedQuantity: number;
    wastedQuantity?: number;
    wasteReason?: string | null;
  }[];
  executionDate?: string;
  notes?: string;
}

export interface TransformationOrderFilters {
  companyId?: string;
  search?: string;
  status?: TransformationOrderStatus;
  templateId?: string;
  warehouseId?: string;
  itemId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export type TransformationOrderTemplateApi = {
  id: string;
  template_code: string | null;
  template_name: string | null;
};

export type TransformationOrderWarehouseApi = {
  id: string;
  warehouse_code: string | null;
  warehouse_name: string | null;
};

export type TransformationOrderItemApi = {
  id: string;
  item_code: string | null;
  item_name: string | null;
};

export type TransformationOrderUomApi = {
  id: string;
  code: string | null;
  name: string | null;
};

export type TransformationOrderInputApi = {
  id: string;
  planned_quantity: number;
  consumed_quantity: number | null;
  unit_cost: number | null;
  total_cost: number | null;
  items?: TransformationOrderItemApi | null;
  warehouse?: TransformationOrderWarehouseApi | null;
  uom?: TransformationOrderUomApi | null;
};

export type TransformationOrderOutputApi = {
  id: string;
  planned_quantity: number;
  produced_quantity: number | null;
  wasted_quantity: number | null;
  waste_reason: string | null;
  is_scrap: boolean;
  allocated_cost_per_unit: number | null;
  total_allocated_cost: number | null;
  items?: TransformationOrderItemApi | null;
  warehouse?: TransformationOrderWarehouseApi | null;
  uom?: TransformationOrderUomApi | null;
};

export type TransformationOrderApi = {
  id: string;
  order_code: string;
  order_date: string;
  status: TransformationOrderStatus;
  planned_quantity: number;
  actual_quantity: number | null;
  total_input_cost: number | null;
  total_output_cost: number | null;
  cost_variance: number | null;
  template?: TransformationOrderTemplateApi | null;
  source_warehouse?: TransformationOrderWarehouseApi | null;
  inputs?: TransformationOrderInputApi[] | null;
  outputs?: TransformationOrderOutputApi[] | null;
};

export type TransformationOrderListResponse = {
  data: TransformationOrderApi[];
  total: number;
  page: number;
  limit: number;
};

// ============================================================================
// State Transition Validation
// ============================================================================

export type TransformationOrderTransition =
  | { from: "DRAFT"; to: "PREPARING" }
  | { from: "PREPARING"; to: "COMPLETED" }
  | { from: "DRAFT" | "PREPARING"; to: "CANCELLED" };

export const VALID_TRANSITIONS: Record<TransformationOrderStatus, TransformationOrderStatus[]> = {
  DRAFT: ["PREPARING", "CANCELLED"],
  PREPARING: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function isValidTransition(
  from: TransformationOrderStatus,
  to: TransformationOrderStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
