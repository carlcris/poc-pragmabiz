import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ITEMS_QUERY_KEY } from "@/hooks/queryKeys";
import {
  itemUnitOptionsApi,
  type CreateItemUnitOptionRequest,
  type ItemUnitOptionsQuery,
  type SetItemInventoryPreviewRequest,
  type UpdateItemUnitOptionRequest,
} from "@/lib/api/item-unit-options";

const ITEM_UNIT_OPTIONS_QUERY_KEY = "item-unit-options";

const invalidateItemQueries = (queryClient: ReturnType<typeof useQueryClient>, itemId: string) => {
  queryClient.invalidateQueries({ queryKey: [ITEM_UNIT_OPTIONS_QUERY_KEY, itemId] });
  queryClient.invalidateQueries({ queryKey: [ITEMS_QUERY_KEY, itemId] });
  queryClient.invalidateQueries({ queryKey: [ITEMS_QUERY_KEY] });
};

export const useItemUnitOptions = (itemId: string, query?: ItemUnitOptionsQuery) =>
  useQuery({
    queryKey: [ITEM_UNIT_OPTIONS_QUERY_KEY, itemId, query],
    queryFn: () => itemUnitOptionsApi.getItemUnitOptions(itemId, query),
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
    mutationFn: ({
      unitOptionId,
      data,
    }: {
      unitOptionId: string;
      data: UpdateItemUnitOptionRequest;
    }) => itemUnitOptionsApi.updateItemUnitOption(itemId, unitOptionId, data),
    onSuccess: () => invalidateItemQueries(queryClient, itemId),
  });
};

export const useDeleteItemUnitOption = (itemId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (unitOptionId: string) =>
      itemUnitOptionsApi.deleteItemUnitOption(itemId, unitOptionId),
    onSuccess: () => invalidateItemQueries(queryClient, itemId),
  });
};

/**
 * Nominating a unit option only moves the preview flag, so this refreshes the item's unit
 * options, the inventory list, and the item detail response that the detail stock cards and
 * the Locations tab both read for the nominated unit. The item key is matched exactly so the
 * detail query refreshes without invalidating its batch and location children, whose stock
 * data is unchanged. The invalidation is awaited so the caller's success feedback follows
 * refreshed data.
 */
export const useSetItemInventoryPreview = (itemId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      unitOptionId,
      data,
    }: {
      unitOptionId: string;
      data: SetItemInventoryPreviewRequest;
    }) => itemUnitOptionsApi.setItemInventoryPreview(itemId, unitOptionId, data),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [ITEM_UNIT_OPTIONS_QUERY_KEY, itemId] }),
        queryClient.invalidateQueries({ queryKey: [ITEMS_QUERY_KEY, "inventory"] }),
        queryClient.invalidateQueries({ queryKey: [ITEMS_QUERY_KEY, itemId], exact: true }),
      ]),
  });
};
