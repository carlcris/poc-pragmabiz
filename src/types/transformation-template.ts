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

export type TransformationTemplateItemApi = {
  id: string;
  item_code: string | null;
  item_name: string | null;
};

export type TransformationTemplateUomApi = {
  id: string;
  uom_name?: string | null;
  name?: string | null;
  code?: string | null;
};

export type TransformationTemplateInputApi = {
  id: string;
  quantity: number;
  notes?: string | null;
  items?: TransformationTemplateItemApi | null;
  uom?: TransformationTemplateUomApi | null;
};

export type TransformationTemplateOutputApi = {
  id: string;
  quantity: number;
  notes?: string | null;
  is_scrap?: boolean;
  items?: TransformationTemplateItemApi | null;
  uom?: TransformationTemplateUomApi | null;
};

export type TransformationTemplateApi = {
  id: string;
  company_id?: string;
  template_code: string;
  template_name: string;
  description?: string | null;
  is_active: boolean;
  usage_count: number;
  created_by?: string | null;
  created_at?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
  inputs?: TransformationTemplateInputApi[] | null;
  outputs?: TransformationTemplateOutputApi[] | null;
};

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

export type TransformationTemplateListResponse = {
  data: TransformationTemplateApi[];
  total: number;
  page: number;
  limit: number;
};
