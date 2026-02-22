/**
 * User Permissions Hook
 *
 * React hook for fetching user's effective permissions
 */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

type Permission = {
  resource: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

type UserPermissionsData = {
  userId: string;
  businessUnitId: string | null;
  permissions: Permission[];
};

type UserPermissionsResponse = {
  data: UserPermissionsData;
};

/**
 * Fetch user's effective permissions (aggregated from all roles)
 */
export function useUserPermissions(userId: string | undefined, businessUnitId?: string) {
  return useQuery({
    queryKey: ["userPermissions", userId, businessUnitId],
    queryFn: async () => {
      if (!userId) {
        throw new Error("User ID is required");
      }

      const params: Record<string, string> = {};
      if (businessUnitId) {
        params.businessUnitId = businessUnitId;
      }

      const response = await apiClient.get<UserPermissionsResponse>(
        `/api/rbac/users/${userId}/permissions`,
        { params }
      );

      return response.data;
    },
    enabled: !!userId,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}
