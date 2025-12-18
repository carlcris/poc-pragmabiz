// ============================================================================
// Transformation Lineage Types
// Purpose: Type definitions for input → output traceability
// ============================================================================

export interface TransformationLineage {
  id: string;
  orderId: string;
  inputLineId: string;
  outputLineId: string;
  inputQuantityUsed: number;
  outputQuantityFrom: number;
  costAttributed: number;
  createdAt: string;
}

export interface TransformationLineageWithDetails {
  id: string;
  orderId: string;
  orderCode?: string;

  // Input details
  inputLineId: string;
  inputItemId: string;
  inputItemCode?: string;
  inputItemName?: string;
  inputQuantityUsed: number;
  inputUomName?: string;

  // Output details
  outputLineId: string;
  outputItemId: string;
  outputItemCode?: string;
  outputItemName?: string;
  outputQuantityFrom: number;
  outputUomName?: string;

  // Cost tracking
  costAttributed: number;

  createdAt: string;
}

// ============================================================================
// Request/Response Types for API
// ============================================================================

export interface TransformationLineageFilters {
  orderId?: string;
  inputItemId?: string;
  outputItemId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface TransformationLineageListResponse {
  data: TransformationLineageWithDetails[];
  total: number;
  page: number;
  limit: number;
}

// ============================================================================
// Lineage Tracing Types (for reporting/audit)
// ============================================================================

export interface InputLineageTrace {
  inputItemId: string;
  inputItemCode: string;
  inputItemName: string;
  inputQuantityUsed: number;
  inputUomName: string;
  costAttributed: number;
  warehouseName: string;
}

export interface OutputLineageTrace {
  outputItemId: string;
  outputItemCode: string;
  outputItemName: string;
  outputQuantityProduced: number;
  outputUomName: string;
  allocatedCost: number;
  warehouseName: string;
}

export interface TransformationLineageTrace {
  orderId: string;
  orderCode: string;
  templateName: string;
  executionDate: string;
  inputs: InputLineageTrace[];
  outputs: OutputLineageTrace[];
  totalInputCost: number;
  totalOutputCost: number;
}
