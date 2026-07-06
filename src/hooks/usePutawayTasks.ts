import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { putawayTasksApi } from "@/lib/api/putaway-tasks";
import type { PostPutawayTaskRequest, PutawayTaskFilters } from "@/types/putaway-task";

export const PUTAWAY_TASKS_QUERY_KEY = "putaway-tasks";

export function usePutawayTasks(params?: PutawayTaskFilters) {
  return useQuery({
    queryKey: [PUTAWAY_TASKS_QUERY_KEY, params],
    queryFn: () => putawayTasksApi.list(params),
  });
}

export function usePostPutawayTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PostPutawayTaskRequest }) =>
      putawayTasksApi.postTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PUTAWAY_TASKS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
      queryClient.invalidateQueries({ queryKey: ["item-warehouse"] });
      queryClient.invalidateQueries({ queryKey: ["stock-transactions"] });
    },
  });
}
