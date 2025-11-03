import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { itemsApi } from "@/lib/api/items";
import type {
  Item,
  CreateItemRequest,
  UpdateItemRequest,
  ItemFilters,
} from "@/types/item";

const ITEMS_QUERY_KEY = "items";

export function useItems(filters?: ItemFilters) {
  return useQuery({
    queryKey: [ITEMS_QUERY_KEY, filters],
    queryFn: () => itemsApi.getItems(filters),
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
