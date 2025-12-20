// ============================================================================
// Transformation Order Types
// Purpose: Type definitions for transformation orders (actual executions)
// ============================================================================

// State machine: DRAFT → PREPARING/CANCELLED → COMPLETED
export type TransformationOrderStatus =
  | 'DRAFT'
  | 'PREPARING'
  | 'COMPLETED'
  | 'CANCELLED';

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

export interface TransformationOrderListResponse {
  data: TransformationOrder[];
  total: number;
  page: number;
  limit: number;
}

// ============================================================================
// State Transition Validation
// ============================================================================

export type TransformationOrderTransition =
  | { from: 'DRAFT'; to: 'PREPARING' }
  | { from: 'PREPARING'; to: 'COMPLETED' }
  | { from: 'DRAFT' | 'PREPARING'; to: 'CANCELLED' };

export const VALID_TRANSITIONS: Record<
  TransformationOrderStatus,
  TransformationOrderStatus[]
> = {
  DRAFT: ['PREPARING', 'CANCELLED'],
  PREPARING: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function isValidTransition(
  from: TransformationOrderStatus,
  to: TransformationOrderStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
