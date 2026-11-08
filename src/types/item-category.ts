export type ItemCategory = {
  id: string;
  name: string;
};

export type ItemCategoryFilters = {
  search?: string;
  page?: number;
  limit?: number;
};

export type ItemCategoriesResponse = {
  data: ItemCategory[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};
