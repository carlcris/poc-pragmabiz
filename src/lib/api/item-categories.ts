import type { ItemCategoriesResponse } from "@/types/item-category";

const API_BASE = "/api/item-categories";

export const itemCategoriesApi = {
  getCategories: async (): Promise<ItemCategoriesResponse> => {
    const response = await fetch(API_BASE, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) throw new Error("Failed to fetch item categories");
    return response.json();
  },
};
