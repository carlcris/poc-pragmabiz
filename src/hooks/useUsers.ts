/**
 * Users Hook
 *
 * React hooks for fetching and managing users
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, getApiErrorCode } from "@/lib/api";
import { WAREHOUSE_DASHBOARD_QUERY_KEY } from "@/hooks/queryKeys";
import { useAuthStore } from "@/stores/authStore";

type User = {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type UsersResponse = {
  data: User[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

type UsersFilters = {
  search?: string;
  page?: number;
  limit?: number;
  isActive?: boolean;
};

type UserRole = {
  id: string;
  name: string;
  description: string | null;
  business_unit_id: string;
  business_unit_name?: string;
};

type UserRolesResponse = {
  data: UserRole[];
};

export const USER_ROLE_MUTATION_ERROR_CODES = [
  "USER_ROLE_INVALID_REQUEST",
  "USER_ROLE_UNAUTHORIZED",
  "USER_ROLE_FORBIDDEN",
  "USER_ROLE_TARGET_NOT_FOUND",
  "USER_ROLE_ROLE_NOT_FOUND",
  "USER_ROLE_BUSINESS_UNIT_NOT_FOUND",
  "USER_ROLE_ALREADY_ASSIGNED",
  "USER_ROLE_NOT_ASSIGNED",
  "USER_ROLE_ASSIGNMENT_FAILED",
  "USER_ROLE_REMOVAL_FAILED",
] as const;

export type UserRoleMutationErrorCode = (typeof USER_ROLE_MUTATION_ERROR_CODES)[number];

export const getUserRoleMutationErrorCode = (error: unknown) =>
  getApiErrorCode(error, USER_ROLE_MUTATION_ERROR_CODES);

/**
 * Fetch all users
 */
export function useUsers(filters?: UsersFilters) {
  return useQuery({
    queryKey: ["users", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.search) params.append("search", filters.search);
      if (filters?.page) params.append("page", filters.page.toString());
      if (filters?.limit) params.append("limit", filters.limit.toString());
      if (filters?.isActive !== undefined) params.append("isActive", String(filters.isActive));
      const query = params.toString();
      const response = await apiClient.get<UsersResponse>(
        query ? `/api/rbac/users?${query}` : "/api/rbac/users"
      );
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch user's roles
 */
export function useUserRoles(userId: string | undefined) {
  return useQuery({
    queryKey: ["userRoles", userId],
    queryFn: async () => {
      if (!userId) return { data: [] };

      const response = await apiClient.get<UserRolesResponse>(`/api/rbac/users/${userId}/roles`);
      return response;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Assign role to user
 */
export function useAssignRole() {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?.id);

  return useMutation({
    mutationFn: async ({
      userId,
      roleId,
      businessUnitId,
    }: {
      userId: string;
      roleId: string;
      businessUnitId: string;
    }) => {
      const response = await apiClient.post(`/api/rbac/users/${userId}/roles`, {
        roleId,
        businessUnitId,
      });
      return response;
    },
    onSuccess: (_, variables) => {
      // Invalidate user roles query
      queryClient.invalidateQueries({ queryKey: ["userRoles", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      if (variables.userId === currentUserId) {
        queryClient.invalidateQueries({ queryKey: ["business-units"] });
      }
      queryClient.invalidateQueries({ queryKey: ["permissions"] });
      queryClient.invalidateQueries({ queryKey: ["granular-capabilities"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["purchasing-dashboard"] });
      queryClient.invalidateQueries({ queryKey: [WAREHOUSE_DASHBOARD_QUERY_KEY] });
    },
  });
}

/**
 * Remove role from user
 */
export function useRemoveRole() {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?.id);

  return useMutation({
    mutationFn: async ({
      userId,
      roleId,
      businessUnitId,
    }: {
      userId: string;
      roleId: string;
      businessUnitId: string;
    }) => {
      const response = await apiClient.delete(
        `/api/rbac/users/${userId}/roles?roleId=${roleId}&businessUnitId=${businessUnitId}`
      );
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["userRoles", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      if (variables.userId === currentUserId) {
        queryClient.invalidateQueries({ queryKey: ["business-units"] });
      }
      queryClient.invalidateQueries({ queryKey: ["permissions"] });
      queryClient.invalidateQueries({ queryKey: ["granular-capabilities"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["purchasing-dashboard"] });
      queryClient.invalidateQueries({ queryKey: [WAREHOUSE_DASHBOARD_QUERY_KEY] });
    },
  });
}

/**
 * Toggle user active status
 */
export function useToggleUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const response = await apiClient.patch(`/api/rbac/users/${userId}`, { is_active: isActive });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
