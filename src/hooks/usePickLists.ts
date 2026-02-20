import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { pickListsApi } from "@/lib/api/pick-lists";
import { DELIVERY_NOTES_QUERY_KEY, PICK_LISTS_QUERY_KEY } from "@/hooks/queryKeys";
import { useInventoryRealtimeInvalidation } from "@/hooks/useInventoryRealtimeInvalidation";
import type {
  CreatePickListPayload,
  UpdatePickListItemsPayload,
  UpdatePickListStatusPayload,
} from "@/types/pick-list";

export { PICK_LISTS_QUERY_KEY };

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PICK_LISTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PICK_LISTS_QUERY_KEY] });
      toast.success("Pick list items updated");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to update pick list items"));
    },
  });
}
