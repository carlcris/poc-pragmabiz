/**
 * Permissions Management Hook
 *
 * React hooks for fetching and managing permissions (admin operations)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

type Permission = {
  id: string;
  resource: string;
  description: string | null;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  created_at: string;
  updated_at: string;
};

type PermissionsResponse = {
  data: Permission[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

/**
 * Fetch all permissions
 */
export function usePermissionsList(search?: string) {
  return useQuery<PermissionsResponse>({
    queryKey: ["permissionsList", search],
    queryFn: async (): Promise<PermissionsResponse> => {
      const params: Record<string, string> = {};
      if (search) params.search = search;

      const response = await apiClient.get<PermissionsResponse>("/api/rbac/permissions", {
        params,
      });
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch single permission
 */
export function usePermissionDetail(permissionId: string | undefined) {
  return useQuery({
    queryKey: ["permissionDetail", permissionId],
    queryFn: async () => {
      if (!permissionId) return null;

      const response = await apiClient.get<{ data: Permission }>(
        `/api/rbac/permissions/${permissionId}`
      );
      return response.data;
    },
    enabled: !!permissionId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Create new permission
 */
export function useCreatePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      resource: string;
      description?: string;
      can_view?: boolean;
      can_create?: boolean;
      can_edit?: boolean;
      can_delete?: boolean;
    }) => {
      const response = await apiClient.post("/api/rbac/permissions", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["permissionsList"] });
    },
  });
}

/**
 * Update permission
 */
export function useUpdatePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      permissionId,
      data,
    }: {
      permissionId: string;
      data: {
        resource?: string;
        description?: string;
        can_view?: boolean;
        can_create?: boolean;
        can_edit?: boolean;
        can_delete?: boolean;
      };
    }) => {
      const response = await apiClient.put(`/api/rbac/permissions/${permissionId}`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["permissionsList"] });
      queryClient.invalidateQueries({ queryKey: ["permissionDetail", variables.permissionId] });
    },
  });
}

/**
 * Delete permission
 */
export function useDeletePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (permissionId: string) => {
      const response = await apiClient.delete(`/api/rbac/permissions/${permissionId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["permissionsList"] });
    },
  });
}
