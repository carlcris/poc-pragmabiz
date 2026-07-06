import { apiClient } from "@/lib/api";
import type {
  PostPutawayTaskRequest,
  PostPutawayTaskResponse,
  PutawayTaskFilters,
  PutawayTaskLabelsResponse,
  PutawayTaskListResponse,
} from "@/types/putaway-task";

export const putawayTasksApi = {
  async list(params?: PutawayTaskFilters): Promise<PutawayTaskListResponse> {
    return apiClient.get<PutawayTaskListResponse>("/api/putaway-tasks", {
      params: {
        status: params?.status,
        warehouseId: params?.warehouseId,
        search: params?.search,
        page: params?.page,
        limit: params?.limit,
      },
    });
  },

  async postTask(id: string, data: PostPutawayTaskRequest): Promise<PostPutawayTaskResponse> {
    return apiClient.post<PostPutawayTaskResponse>(`/api/putaway-tasks/${id}/post`, data);
  },

  async labels(id: string): Promise<PutawayTaskLabelsResponse> {
    return apiClient.get<PutawayTaskLabelsResponse>(`/api/putaway-tasks/${id}/labels`);
  },
};
