export interface ItemCategory {
  id: string;
  name: string;
  description?: string;
}

export interface ItemCategoriesResponse {
  data: ItemCategory[];
}
