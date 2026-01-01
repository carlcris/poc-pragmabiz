/**
 * User Roles Hook
 *
 * React hook for fetching user roles and determining default landing page
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { getDefaultPageForUser } from '@/config/roleDefaultPages';

type UserRole = {
  id: string;
  name: string;
  description: string | null;
};

type UserRolesResponse = {
  data: UserRole[];
};

/**
 * Fetch user's roles
 */
export function useUserRoles(userId: string | undefined, businessUnitId?: string) {
  return useQuery({
    queryKey: ['userRoles', userId, businessUnitId],
    queryFn: async () => {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const params: Record<string, string> = {};
      if (businessUnitId) {
        params.businessUnitId = businessUnitId;
      }

      const response = await apiClient.get<UserRolesResponse>(
        `/api/rbac/users/${userId}/roles`,
        { params }
      );

      return response.data;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

/**
 * Get the default landing page for the current user based on their roles
 */
export function useDefaultLandingPage(userId: string | undefined, businessUnitId?: string) {
  const { data: roles, isLoading } = useUserRoles(userId, businessUnitId);

  const defaultPage = roles && roles.length > 0
    ? getDefaultPageForUser(roles.map(r => r.name))
    : '/dashboard';

  return {
    defaultPage,
    isLoading,
    roles,
  };
}
