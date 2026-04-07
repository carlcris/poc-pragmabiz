import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  itemUnitOptionsApi,
  type CreateItemUnitOptionRequest,
  type UpdateItemUnitOptionRequest,
} from "@/lib/api/item-unit-options";

const ITEM_UNIT_OPTIONS_QUERY_KEY = "item-unit-options";
const ITEMS_QUERY_KEY = "items";

const invalidateItemQueries = (queryClient: ReturnType<typeof useQueryClient>, itemId: string) => {
  queryClient.invalidateQueries({ queryKey: [ITEM_UNIT_OPTIONS_QUERY_KEY, itemId] });
  queryClient.invalidateQueries({ queryKey: [ITEMS_QUERY_KEY, itemId] });
  queryClient.invalidateQueries({ queryKey: [ITEMS_QUERY_KEY] });
};

export const useItemUnitOptions = (itemId: string) =>
  useQuery({
    queryKey: [ITEM_UNIT_OPTIONS_QUERY_KEY, itemId],
    queryFn: () => itemUnitOptionsApi.getItemUnitOptions(itemId),
    enabled: !!itemId,
  });

export const useCreateItemUnitOption = (itemId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateItemUnitOptionRequest) =>
      itemUnitOptionsApi.createItemUnitOption(itemId, data),
    onSuccess: () => invalidateItemQueries(queryClient, itemId),
  });
};

export const useUpdateItemUnitOption = (itemId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitOptionId, data }: { unitOptionId: string; data: UpdateItemUnitOptionRequest }) =>
      itemUnitOptionsApi.updateItemUnitOption(itemId, unitOptionId, data),
    onSuccess: () => invalidateItemQueries(queryClient, itemId),
  });
};

export const useDeleteItemUnitOption = (itemId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (unitOptionId: string) => itemUnitOptionsApi.deleteItemUnitOption(itemId, unitOptionId),
    onSuccess: () => invalidateItemQueries(queryClient, itemId),
  });
};
