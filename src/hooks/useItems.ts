import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { itemsApi } from "@/lib/api/items";
import type { Item, CreateItemRequest, UpdateItemRequest, ItemFilters } from "@/types/item";
import type { ItemWithStock } from "@/app/api/items-enhanced/route";

const ITEMS_QUERY_KEY = "items";

export interface ItemsFilters extends ItemFilters {
  warehouseId?: string;
  supplierId?: string;
  status?: "all" | "normal" | "low_stock" | "out_of_stock" | "overstock" | "discontinued";
  includeStock?: boolean;
}

export interface ItemsResponse {
  data: Item[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ItemsWithStockResponse {
  data: ItemWithStock[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function useItems(filters?: ItemsFilters) {
  const includeStock = filters?.includeStock ?? false;

  return useQuery({
    queryKey: [ITEMS_QUERY_KEY, filters],
    queryFn: async () => {
      if (includeStock) {
        // Use items-enhanced API for stock information
        const params = new URLSearchParams();
        if (filters?.search) params.append("search", filters.search);
        if (filters?.category) params.append("category", filters.category);
        if (filters?.warehouseId) params.append("warehouseId", filters.warehouseId);
        if (filters?.supplierId) params.append("supplierId", filters.supplierId);
        if (filters?.status && filters.status !== "all") params.append("status", filters.status);
        if (filters?.itemType) params.append("itemType", filters.itemType);
        if (filters?.page) params.append("page", filters.page.toString());
        if (filters?.limit) params.append("limit", filters.limit.toString());

        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";
        const response = await fetch(`${API_BASE_URL}/items-enhanced?${params.toString()}`, {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Failed to fetch items with stock");
        }

        return response.json() as Promise<ItemsWithStockResponse>;
      } else {
        // Use regular items API
        return itemsApi.getItems(filters) as Promise<ItemsResponse>;
      }
    },
    placeholderData: keepPreviousData,
  });
}

export function useItem(id: string) {
  return useQuery({
    queryKey: [ITEMS_QUERY_KEY, id],
    queryFn: () => itemsApi.getItem(id),
    enabled: !!id,
  });
}

export function useCreateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateItemRequest) => itemsApi.createItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ITEMS_QUERY_KEY] });
    },
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateItemRequest }) =>
      itemsApi.updateItem(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [ITEMS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ITEMS_QUERY_KEY, variables.id] });
    },
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => itemsApi.deleteItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ITEMS_QUERY_KEY] });
    },
  });
}
