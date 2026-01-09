export type ItemType = "raw_material" | "finished_good" | "asset" | "service";

export interface Item {
  id: string;
  companyId: string;
  code: string;
  name: string;
  chineseName?: string;
  description: string;
  itemType: ItemType;
  uom: string;
  uomId: string;
  category: string;
  standardCost: number;
  listPrice: number;
  reorderLevel: number;
  reorderQty: number;
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateItemRequest {
  companyId: string;
  code: string;
  name: string;
  chineseName?: string;
  description: string;
  itemType: ItemType;
  uom: string;
  category: string;
  standardCost: number;
  listPrice: number;
  reorderLevel: number;
  reorderQty: number;
  imageUrl?: string;
  isActive: boolean;
}

export interface UpdateItemRequest {
  name?: string;
  chineseName?: string;
  description?: string;
  itemType?: ItemType;
  uom?: string;
  category?: string;
  standardCost?: number;
  listPrice?: number;
  reorderLevel?: number;
  reorderQty?: number;
  imageUrl?: string;
  isActive?: boolean;
}

export interface ItemsListResponse {
  data: Item[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ItemResponse {
  data: Item;
}

export interface ItemFilters {
  search?: string;
  category?: string;
  itemType?: ItemType;
  isActive?: boolean;
  page?: number;
  limit?: number;
}
