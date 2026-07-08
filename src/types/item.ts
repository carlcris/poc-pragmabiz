export type ItemType = "raw_material" | "finished_good" | "asset" | "service";

export type ItemDimensions = {
  width?: number;
  height?: number;
  unit?: string;
  length?: number;
};

export type ItemUnitOption = {
  id: string;
  itemId: string;
  uomId: string;
  uomCode: string;
  uomName: string;
  uomSymbol?: string;
  optionLabel?: string;
  displayLabel: string;
  qtyPerUnit: number;
  barcode: string;
  isBase: boolean;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
};

export type ItemCustomFields = Record<string, unknown>;

export type ItemPriceTier = {
  id: string;
  priceTier: string;
  priceTierName: string;
  price: number;
  currencyCode: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
};

export type Item = {
  id: string;
  companyId: string;
  code: string;
  primaryBarcode?: string;
  primaryBarcodeUnitOptionId?: string;
  unitOptions?: ItemUnitOption[];
  supplierCode?: string | null;
  sop?: number | null;
  name: string;
  chineseName?: string;
  description: string;
  dimensions?: ItemDimensions | null;
  itemType: ItemType;
  customFields?: ItemCustomFields | null;
  uom: string;
  uomId: string;
  category: string;
  purchasePrice: number;
  importCost?: number | null;
  importCurrency?: string | null;
  listPrice: number;
  defaultPriceTier?: string | null;
  priceTiers?: ItemPriceTier[];
  onHand?: number;
  allocated?: number;
  available?: number;
  putawayQty?: number;
  reorderLevel: number;
  reorderQty: number;
  maxStockLevel: number;
  inTransit?: number;
  estimatedArrivalDate?: string | null;
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ItemDetail = Omit<Item, "purchasePrice" | "importCost" | "importCurrency" | "listPrice"> & {
  purchasePrice: number | null;
  importCost: number | null;
  importCurrency: string | null;
  listPrice: number | null;
};

export type CreateItemRequest = {
  companyId: string;
  code: string;
  supplierCode?: string | null;
  sop?: number | null;
  name: string;
  chineseName?: string;
  description: string;
  dimensions?: ItemDimensions | null;
  itemType: ItemType;
  uom: string;
  category: string;
  purchasePrice: number;
  importCost?: number | null;
  importCurrency?: string | null;
  listPrice: number;
  reorderLevel: number;
  reorderQty: number;
  imageUrl?: string;
  isActive: boolean;
};

export type UpdateItemRequest = {
  supplierCode?: string | null;
  sop?: number | null;
  name?: string;
  chineseName?: string;
  description?: string;
  dimensions?: ItemDimensions | null;
  itemType?: ItemType;
  uom?: string;
  category?: string;
  purchasePrice?: number;
  importCost?: number | null;
  importCurrency?: string | null;
  listPrice?: number;
  reorderLevel?: number;
  reorderQty?: number;
  imageUrl?: string;
  isActive?: boolean;
};

export type UpsertItemCustomFieldRequest = {
  key: string;
  value: string;
  originalKey?: string;
};

export type ItemCustomFieldsResponse = {
  data: {
    customFields: ItemCustomFields;
  };
};

export type ItemsListResponse = {
  data: Item[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type ItemResponse = {
  data: ItemDetail;
  capabilities?: {
    canViewPricingDetails?: boolean;
    canViewSop?: boolean;
    canEditSop?: boolean;
  };
};

export type ItemFilters = {
  search?: string;
  category?: string;
  itemType?: ItemType;
  isActive?: boolean;
  page?: number;
  limit?: number;
};
