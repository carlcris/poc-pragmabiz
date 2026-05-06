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

export type Item = {
  id: string;
  companyId: string;
  code: string;
  primaryBarcode?: string;
  primaryBarcodeUnitOptionId?: string;
  unitOptions?: ItemUnitOption[];
  name: string;
  chineseName?: string;
  description: string;
  dimensions?: ItemDimensions | null;
  itemType: ItemType;
  customFields?: ItemCustomFields | null;
  uom: string;
  uomId: string;
  category: string;
  standardCost: number;
  purchasePrice?: number;
  importCost?: number | null;
  importCurrency?: string | null;
  listPrice: number;
  onHand?: number;
  allocated?: number;
  available?: number;
  reorderLevel: number;
  reorderQty: number;
  inTransit?: number;
  estimatedArrivalDate?: string | null;
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateItemRequest = {
  companyId: string;
  code: string;
  name: string;
  chineseName?: string;
  description: string;
  dimensions?: ItemDimensions | null;
  itemType: ItemType;
  uom: string;
  category: string;
  standardCost: number;
  purchasePrice?: number;
  importCost?: number | null;
  importCurrency?: string | null;
  listPrice: number;
  reorderLevel: number;
  reorderQty: number;
  imageUrl?: string;
  isActive: boolean;
};

export type UpdateItemRequest = {
  name?: string;
  chineseName?: string;
  description?: string;
  dimensions?: ItemDimensions | null;
  itemType?: ItemType;
  uom?: string;
  category?: string;
  standardCost?: number;
  purchasePrice?: number;
  importCost?: number | null;
  importCurrency?: string | null;
  listPrice?: number;
  reorderLevel?: number;
  reorderQty?: number;
  imageUrl?: string;
  isActive?: boolean;
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
  data: Item;
};

export type ItemFilters = {
  search?: string;
  category?: string;
  itemType?: ItemType;
  isActive?: boolean;
  page?: number;
  limit?: number;
};
