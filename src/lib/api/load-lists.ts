import type {
  LoadList,
  CreateLoadListRequest,
  UpdateLoadListRequest,
  LoadListFilters,
  LoadListsResponse,
  LoadListStatus,
  LoadListSRLink,
  CreateLoadListSRLinkRequest,
} from "@/types/load-list";
import { apiClient } from "@/lib/api";

const API_BASE = "/api/load-lists";

export const loadListsApi = {
  getLoadLists: async (filters?: LoadListFilters): Promise<LoadListsResponse> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append("search", filters.search);
    if (filters?.status && filters.status !== "all") params.append("status", filters.status);
    if (filters?.supplierId) params.append("supplier_id", filters.supplierId);
    if (filters?.warehouseId) params.append("warehouse_id", filters.warehouseId);
    if (filters?.dateFrom) params.append("from_date", filters.dateFrom);
    if (filters?.dateTo) params.append("to_date", filters.dateTo);
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.limit) params.append("limit", filters.limit.toString());

    return apiClient.get<LoadListsResponse>(`${API_BASE}?${params.toString()}`);
  },

  getLoadList: async (id: string): Promise<LoadList> => {
    return apiClient.get<LoadList>(`${API_BASE}/${id}`);
  },

  createLoadList: async (data: CreateLoadListRequest): Promise<LoadList> => {
    return apiClient.post<LoadList>(API_BASE, data);
  },

  updateLoadList: async (id: string, data: UpdateLoadListRequest): Promise<LoadList> => {
    return apiClient.put<LoadList>(`${API_BASE}/${id}`, data);
  },

  deleteLoadList: async (id: string): Promise<void> => {
    await apiClient.delete(`${API_BASE}/${id}`);
  },

  updateLoadListStatus: async (
    id: string,
    status: LoadListStatus
  ): Promise<{ id: string; llNumber: string; status: string; message: string }> => {
    return apiClient.patch<{ id: string; llNumber: string; status: string; message: string }>(
      `${API_BASE}/${id}/status`,
      { status }
    );
  },

  linkSRsToLoadList: async (
    id: string,
    data: CreateLoadListSRLinkRequest
  ): Promise<{ message: string; linksCreated: number }> => {
    return apiClient.post<{ message: string; linksCreated: number }>(
      `${API_BASE}/${id}/link-requisitions`,
      data
    );
  },

  getLoadListSRLinks: async (id: string): Promise<{ data: LoadListSRLink[] }> => {
    return apiClient.get<{ data: LoadListSRLink[] }>(`${API_BASE}/${id}/link-requisitions`);
  },
};
