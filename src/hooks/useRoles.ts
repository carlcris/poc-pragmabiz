/**
 * Roles Hook
 *
 * React hooks for fetching and managing roles
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

type Role = {
  id: string;
  name: string;
  description: string | null;
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
};

type RolesResponse = {
  data: Role[];
};

type RolePermission = {
  resource: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

type RoleWithPermissions = Role & {
  permissions: RolePermission[];
};

/**
 * Fetch all roles
 */
export function useRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const response = await apiClient.get<RolesResponse>("/api/rbac/roles");
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch single role with permissions
 */
export function useRole(roleId: string | undefined) {
  return useQuery({
    queryKey: ["role", roleId],
    queryFn: async () => {
      if (!roleId) return null;

      const response = await apiClient.get<{ data: RoleWithPermissions }>(
        `/api/rbac/roles/${roleId}`
      );
      return response.data;
    },
    enabled: !!roleId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Create new role
 */
export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const response = await apiClient.post("/api/rbac/roles", data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });
}

/**
 * Update role
 */
export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roleId,
      data,
    }: {
      roleId: string;
      data: { name?: string; description?: string };
    }) => {
      const response = await apiClient.put(`/api/rbac/roles/${roleId}`, data);
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["role", variables.roleId] });
    },
  });
}

/**
 * Delete role
 */
export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roleId: string) => {
      const response = await apiClient.delete(`/api/rbac/roles/${roleId}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });
}

/**
 * Assign permissions to role with granular CRUD control
 */
export function useAssignPermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roleId,
      permissions,
    }: {
      roleId: string;
      permissions: Array<{
        permission_id: string;
        can_view: boolean;
        can_create: boolean;
        can_edit: boolean;
        can_delete: boolean;
      }>;
    }) => {
      const response = await apiClient.post(`/api/rbac/roles/${roleId}/permissions`, {
        permissions,
      });
      return response;
    },
    onSuccess: (_, variables) => {
      // Invalidate role queries
      queryClient.invalidateQueries({ queryKey: ["role", variables.roleId] });
      queryClient.invalidateQueries({ queryKey: ["roles"] });

      // IMPORTANT: Invalidate all user permissions queries
      // This ensures users see updated permissions immediately after role changes
      queryClient.invalidateQueries({ queryKey: ["permissions"] });
    },
  });
}

/**
 * Remove permissions from role
 */
export function useRemovePermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ roleId, permissionIds }: { roleId: string; permissionIds: string[] }) => {
      const response = await apiClient.delete(
        `/api/rbac/roles/${roleId}/permissions?permissionIds=${permissionIds.join(",")}`
      );
      return response;
    },
    onSuccess: (_, variables) => {
      // Invalidate role queries
      queryClient.invalidateQueries({ queryKey: ["role", variables.roleId] });
      queryClient.invalidateQueries({ queryKey: ["roles"] });

      // IMPORTANT: Invalidate all user permissions queries
      // This ensures users see updated permissions immediately after role changes
      queryClient.invalidateQueries({ queryKey: ["permissions"] });
    },
  });
}
