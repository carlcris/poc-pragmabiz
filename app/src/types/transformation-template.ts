// ============================================================================
// Transformation Template Types
// Purpose: Type definitions for transformation templates (reusable recipes)
// ============================================================================

export interface TransformationTemplateInput {
  id: string;
  templateId: string;
  itemId: string;
  itemCode?: string;
  itemName?: string;
  quantity: number;
  uomId: string;
  uomName?: string;
  sequence: number;
  notes?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface TransformationTemplateOutput {
  id: string;
  templateId: string;
  itemId: string;
  itemCode?: string;
  itemName?: string;
  quantity: number;
  uomId: string;
  uomName?: string;
  sequence: number;
  isScrap: boolean;
  notes?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface TransformationTemplate {
  id: string;
  companyId: string;
  templateCode: string;
  templateName: string;
  description?: string;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
  createdBy: string;
  createdByName?: string;
  updatedAt: string;
  updatedBy: string;
  updatedByName?: string;
  deletedAt?: string;
  inputs: TransformationTemplateInput[];
  outputs: TransformationTemplateOutput[];
}

// ============================================================================
// Request/Response Types for API
// ============================================================================

export interface CreateTransformationTemplateRequest {
  companyId: string;
  templateCode: string;
  templateName: string;
  description?: string;
  inputs: {
    itemId: string;
    quantity: number;
    uomId: string;
    sequence?: number;
    notes?: string;
  }[];
  outputs: {
    itemId: string;
    quantity: number;
    uomId: string;
    sequence?: number;
    isScrap?: boolean;
    notes?: string;
  }[];
}

export interface UpdateTransformationTemplateRequest {
  templateName?: string;
  description?: string;
  isActive?: boolean;
}

export interface TransformationTemplateFilters {
  companyId?: string;
  search?: string;
  isActive?: boolean;
  itemId?: string;
  page?: number;
  limit?: number;
}

export interface TransformationTemplateListResponse {
  data: TransformationTemplate[];
  total: number;
  page: number;
  limit: number;
}
