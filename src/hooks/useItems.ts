import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { itemsApi } from "@/lib/api/items";
import type { Item, CreateItemRequest, UpdateItemRequest, ItemFilters } from "@/types/item";
import type { ItemWithStock } from "@/app/api/items/route";

const ITEMS_QUERY_KEY = "items";
const LOOKUP_MAX_LIMIT = 50;

export interface ItemsFilters extends ItemFilters {
  warehouseId?: string;
  supplierId?: string;
  status?: "all" | "normal" | "low_stock" | "out_of_stock" | "overstock" | "discontinued";
  includeStock?: boolean;
  includeStats?: boolean;
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
  statistics?: {
    totalAvailableValue: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
}

type ItemsQueryOptions = ItemsFilters & {
  enabled?: boolean;
};

export function useItems(filters?: ItemsQueryOptions) {
  const { enabled, ...restFilters } = filters ?? {};
  const normalizedFilters =
    restFilters.limit && restFilters.limit > LOOKUP_MAX_LIMIT
      ? { ...restFilters, limit: LOOKUP_MAX_LIMIT }
      : restFilters;
  const includeStock = normalizedFilters.includeStock ?? false;
  const includeStats = normalizedFilters.includeStats ?? false;

  return useQuery({
    queryKey: [ITEMS_QUERY_KEY, normalizedFilters],
    enabled: enabled ?? true,
    queryFn: async () => {
      if (includeStock) {
        // Use items API for stock information
        const params = new URLSearchParams();
        if (normalizedFilters.search) params.append("search", normalizedFilters.search);
        if (normalizedFilters.category) params.append("category", normalizedFilters.category);
        if (normalizedFilters.warehouseId) params.append("warehouseId", normalizedFilters.warehouseId);
        if (normalizedFilters.supplierId) params.append("supplierId", normalizedFilters.supplierId);
        if (normalizedFilters.status && normalizedFilters.status !== "all")
          params.append("status", normalizedFilters.status);
        if (normalizedFilters.itemType) params.append("itemType", normalizedFilters.itemType);
        if (includeStats) params.append("includeStats", "true");
        if (normalizedFilters.page) params.append("page", normalizedFilters.page.toString());
        if (normalizedFilters.limit) params.append("limit", normalizedFilters.limit.toString());

        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";
        const response = await fetch(`${API_BASE_URL}/items?${params.toString()}`, {
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
        return itemsApi.getItems(normalizedFilters) as Promise<ItemsResponse>;
      }
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
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
