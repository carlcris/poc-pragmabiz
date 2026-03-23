// ============================================================================
// Transformation Template Types
// Purpose: Type definitions for transformation templates (reusable recipes)
// ============================================================================

export type SheetLayoutUnit = "in" | "cm" | "mm";

export type SheetLayoutSectionType = "piece" | "leftover";

export type SheetLayoutMappedItem = {
  itemId: string;
  itemCode: string;
  itemName: string;
  uomId: string;
  uomCode?: string;
};

export type SheetLayoutSourceItem = {
  itemId: string;
  itemCode: string;
  itemName: string;
  uomId: string;
  uomCode?: string;
};

export interface SheetLayoutSection {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  order: number;
  type: SheetLayoutSectionType;
  mappedItem?: SheetLayoutMappedItem | null;
}

export interface SheetLayoutData {
  version: number;
  sourceItem?: SheetLayoutSourceItem | null;
  sections: SheetLayoutSection[];
}

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
  templateKind: "recipe" | "sheet_layout";
  templateCode: string;
  templateName: string;
  description?: string;
  imageUrl?: string;
  sheetWidth?: number;
  sheetHeight?: number;
  sheetUnit?: SheetLayoutUnit;
  layout?: SheetLayoutData | null;
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
  item_id?: string;
  uom_id?: string;
  sequence?: number;
  quantity: number;
  notes?: string | null;
  items?: TransformationTemplateItemApi | null;
  uom?: TransformationTemplateUomApi | null;
};

export type TransformationTemplateOutputApi = {
  id: string;
  item_id?: string;
  uom_id?: string;
  sequence?: number;
  quantity: number;
  notes?: string | null;
  is_scrap?: boolean;
  items?: TransformationTemplateItemApi | null;
  uom?: TransformationTemplateUomApi | null;
};

export type TransformationTemplateApi = {
  id: string;
  company_id?: string;
  template_kind?: "recipe" | "sheet_layout";
  template_code: string;
  template_name: string;
  description?: string | null;
  image_url?: string | null;
  sheet_width?: number | null;
  sheet_height?: number | null;
  sheet_unit?: SheetLayoutUnit | null;
  layout_json?: SheetLayoutData | null;
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
  templateCode?: string;
  templateName: string;
  templateKind?: "recipe" | "sheet_layout";
  description?: string;
  imageUrl?: string;
  sheetWidth?: number;
  sheetHeight?: number;
  sheetUnit?: SheetLayoutUnit;
  layout?: SheetLayoutData;
  inputs?: {
    itemId: string;
    quantity: number;
    uomId: string;
    sequence?: number;
    notes?: string;
  }[];
  outputs?: {
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
  imageUrl?: string;
  sheetWidth?: number;
  sheetHeight?: number;
  sheetUnit?: SheetLayoutUnit;
  layout?: SheetLayoutData;
  inputs?: {
    itemId: string;
    quantity: number;
    uomId: string;
    sequence?: number;
    notes?: string;
  }[];
  outputs?: {
    itemId: string;
    quantity: number;
    uomId: string;
    sequence?: number;
    isScrap?: boolean;
    notes?: string;
  }[];
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
