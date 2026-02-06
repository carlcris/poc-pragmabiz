import type {
  GRN,
  CreateGRNRequest,
  UpdateGRNRequest,
  GRNFilters,
  GRNsResponse,
  GRNStatus,
  CreateDamagedItemRequest,
  UpdateDamagedItemRequest,
  DamagedItem,
} from "@/types/grn";

const API_BASE = "/api/grns";

export const grnsApi = {
  getGRNs: async (filters?: GRNFilters): Promise<GRNsResponse> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append("search", filters.search);
    if (filters?.status && filters.status !== "all") params.append("status", filters.status);
    if (filters?.warehouseId) params.append("warehouse_id", filters.warehouseId);
    if (filters?.loadListId) params.append("load_list_id", filters.loadListId);
    if (filters?.dateFrom) params.append("from_date", filters.dateFrom);
    if (filters?.dateTo) params.append("to_date", filters.dateTo);
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.limit) params.append("limit", filters.limit.toString());

    const response = await fetch(`${API_BASE}?${params.toString()}`);
    if (!response.ok) throw new Error("Failed to fetch GRNs");
    return response.json();
  },

  getGRN: async (id: string): Promise<GRN> => {
    const response = await fetch(`${API_BASE}/${id}`);
    if (!response.ok) throw new Error("Failed to fetch GRN");
    return response.json();
  },

  createGRN: async (data: CreateGRNRequest): Promise<GRN> => {
    const response = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create GRN");
    }
    return response.json();
  },

  updateGRN: async (id: string, data: UpdateGRNRequest): Promise<GRN> => {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update GRN");
    }
    return response.json();
  },

  deleteGRN: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete GRN");
    }
  },

  updateGRNStatus: async (
    id: string,
    status: GRNStatus
  ): Promise<{ id: string; grnNumber: string; status: string; message: string }> => {
    const response = await fetch(`${API_BASE}/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update GRN status");
    }
    return response.json();
  },

  submitGRN: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/${id}/submit`, {
      method: "POST",
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to submit GRN");
    }
  },

  approveGRN: async (id: string, notes?: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to approve GRN");
    }
  },

  rejectGRN: async (id: string, reason: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to reject GRN");
    }
  },

  // Damaged Items
  getDamagedItems: async (grnId: string): Promise<{ data: DamagedItem[] }> => {
    const response = await fetch(`${API_BASE}/${grnId}/damaged-items`);
    if (!response.ok) throw new Error("Failed to fetch damaged items");
    return response.json();
  },

  createDamagedItem: async (
    grnId: string,
    data: CreateDamagedItemRequest
  ): Promise<DamagedItem> => {
    const response = await fetch(`${API_BASE}/${grnId}/damaged-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create damaged item");
    }
    return response.json();
  },

  updateDamagedItem: async (
    id: string,
    data: UpdateDamagedItemRequest
  ): Promise<DamagedItem> => {
    const response = await fetch(`/api/damaged-items/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update damaged item");
    }
    return response.json();
  },

  deleteDamagedItem: async (id: string): Promise<void> => {
    const response = await fetch(`/api/damaged-items/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete damaged item");
    }
  },
};
