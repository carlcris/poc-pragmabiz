export type ItemType = "goods" | "service" | "raw_material" | "finished_goods";

export interface Item {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description: string;
  itemType: ItemType;
  uom: string;
  category: string;
  standardCost: number;
  listPrice: number;
  reorderLevel: number;
  reorderQty: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateItemRequest {
  companyId: string;
  code: string;
  name: string;
  description: string;
  itemType: ItemType;
  uom: string;
  category: string;
  standardCost: number;
  listPrice: number;
  reorderLevel: number;
  reorderQty: number;
  isActive: boolean;
}

export interface UpdateItemRequest {
  name?: string;
  description?: string;
  itemType?: ItemType;
  uom?: string;
  category?: string;
  standardCost?: number;
  listPrice?: number;
  reorderLevel?: number;
  reorderQty?: number;
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
