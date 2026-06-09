import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { pickListsApi } from "@/lib/api/pick-lists";
import {
  DELIVERY_NOTES_QUERY_KEY,
  PICK_LISTS_QUERY_KEY,
  WAREHOUSE_DASHBOARD_QUERY_KEY,
} from "@/hooks/queryKeys";
import { useInventoryRealtimeInvalidation } from "@/hooks/useInventoryRealtimeInvalidation";
import type {
  CreatePickListPayload,
  PickList,
  PickListListResponse,
  UpdatePickListItemsPayload,
  UpdatePickListStatusPayload,
} from "@/types/pick-list";
import type { DashboardData } from "@/types/warehouse-dashboard";

export { PICK_LISTS_QUERY_KEY };

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const isPickListListResponse = (value: unknown): value is PickListListResponse =>
  !!value &&
  typeof value === "object" &&
  "data" in value &&
  Array.isArray((value as { data?: unknown }).data);

const syncPickListCaches = (queryClient: QueryClient, updated: PickList) => {
  queryClient.setQueryData([PICK_LISTS_QUERY_KEY, updated.id], updated);

  const pickListCaches = queryClient.getQueriesData<unknown>({
    queryKey: [PICK_LISTS_QUERY_KEY],
  });

  for (const [queryKey, cached] of pickListCaches) {
    if (!isPickListListResponse(cached)) continue;

    const statusFilter = typeof queryKey[1] === "string" ? queryKey[1] : undefined;
    const hasPickList = cached.data.some((row) => row.id === updated.id);
    if (!hasPickList) continue;

    const rows = cached.data.map((row) => (row.id === updated.id ? updated : row));
    const filteredRows =
      statusFilter && statusFilter !== updated.status
        ? rows.filter((row) => row.id !== updated.id)
        : rows;

    queryClient.setQueryData(queryKey, {
      ...cached,
      data: filteredRows,
    });
  }

  queryClient.setQueryData<DashboardData | undefined>([WAREHOUSE_DASHBOARD_QUERY_KEY], (cached) => {
    if (!cached) return cached;

    return {
      ...cached,
      queues: {
        ...cached.queues,
        pick_list: cached.queues.pick_list.map((row) =>
          row.id === updated.id ? { ...row, status: updated.status } : row
        ),
      },
    };
  });
};

export function usePickLists(params?: { status?: string; dnId?: string }) {
  useInventoryRealtimeInvalidation([PICK_LISTS_QUERY_KEY, DELIVERY_NOTES_QUERY_KEY]);

  return useQuery({
    queryKey: [PICK_LISTS_QUERY_KEY, params?.status, params?.dnId],
    queryFn: () => pickListsApi.list(params),
  });
}

export function usePickList(id: string) {
  useInventoryRealtimeInvalidation([PICK_LISTS_QUERY_KEY, DELIVERY_NOTES_QUERY_KEY], !!id);

  return useQuery({
    queryKey: [PICK_LISTS_QUERY_KEY, id],
    queryFn: () => pickListsApi.getById(id),
    enabled: !!id,
  });
}

export function useCreatePickList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePickListPayload) => pickListsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PICK_LISTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      toast.success("Pick list created");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to create pick list"));
    },
  });
}

export function useUpdatePickListStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePickListStatusPayload }) =>
      pickListsApi.updateStatus(id, data),
    onSuccess: (updated) => {
      syncPickListCaches(queryClient, updated);
      queryClient.invalidateQueries({ queryKey: [PICK_LISTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [DELIVERY_NOTES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [WAREHOUSE_DASHBOARD_QUERY_KEY] });
      toast.success("Pick list status updated");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to update pick list status"));
    },
  });
}

export function useUpdatePickListItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePickListItemsPayload }) =>
      pickListsApi.updateItems(id, data),
    onSuccess: (updated) => {
      syncPickListCaches(queryClient, updated);
      queryClient.invalidateQueries({ queryKey: [PICK_LISTS_QUERY_KEY] });
    },
  });
}
