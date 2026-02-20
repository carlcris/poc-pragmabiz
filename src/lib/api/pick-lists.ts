import { apiClient } from "@/lib/api";
import type {
  CreatePickListPayload,
  PickList,
  PickListListResponse,
  UpdatePickListItemsPayload,
  UpdatePickListStatusPayload,
} from "@/types/pick-list";

export const pickListsApi = {
  async list(params?: { status?: string; dnId?: string }): Promise<PickListListResponse> {
    const search = new URLSearchParams();
    if (params?.status) search.set("status", params.status);
    if (params?.dnId) search.set("dnId", params.dnId);
    const query = search.toString();
    return apiClient.get<PickListListResponse>(`/api/pick-lists${query ? `?${query}` : ""}`);
  },

  async getById(id: string): Promise<PickList> {
    return apiClient.get<PickList>(`/api/pick-lists/${id}`);
  },

  async create(data: CreatePickListPayload): Promise<PickList> {
    return apiClient.post<PickList>("/api/pick-lists", data);
  },

  async updateStatus(id: string, data: UpdatePickListStatusPayload): Promise<PickList> {
    return apiClient.patch<PickList>(`/api/pick-lists/${id}/status`, data);
  },

  async updateItems(id: string, data: UpdatePickListItemsPayload): Promise<PickList> {
    return apiClient.patch<PickList>(`/api/pick-lists/${id}/items`, data);
  },
};
