import { useQuery } from "@tanstack/react-query";
import { itemCategoriesApi } from "@/lib/api/item-categories";

const ITEM_CATEGORIES_QUERY_KEY = "item-categories";

export function useItemCategories() {
  return useQuery({
    queryKey: [ITEM_CATEGORIES_QUERY_KEY],
    queryFn: () => itemCategoriesApi.getCategories(),
    staleTime: 1000 * 60 * 5, // 5 minutes - categories don't change often
  });
}
