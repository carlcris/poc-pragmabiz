/**
 * Permissions Hook
 *
 * React hooks for fetching and checking user permissions
 */

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { apiClient } from "@/lib/api";
import { usePermissionStore } from "@/stores/permissionStore";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import { useAuthStore } from "@/stores/authStore";
import type { Resource } from "@/constants/resources";
import type { PermissionAction, UserPermissions, ResourcePermission } from "@/types/rbac";

type UserPermissionsResponse = {
  data: {
    userId: string;
    businessUnitId: string | null;
    permissions: Array<{
      resource: string;
      can_view: boolean;
      can_create: boolean;
      can_edit: boolean;
      can_delete: boolean;
    }>;
  };
};

/**
 * Fetch and load user permissions into store
 *
 * This hook automatically loads permissions when:
 * - User is authenticated
 * - Business unit changes
 * - Permissions are stale (5 minutes)
 */
export function useLoadPermissions() {
  const user = useAuthStore((state) => state.user);
  const currentBusinessUnit = useBusinessUnitStore((state) => state.currentBusinessUnit);
  const { setPermissions, setLoading, setError } = usePermissionStore();

  const userId = user?.id;
  const businessUnitId = currentBusinessUnit?.id || null;

  const query = useQuery({
    queryKey: ["permissions", userId, businessUnitId],
    queryFn: async () => {
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const params: Record<string, string> = {};
      if (businessUnitId) {
        params.businessUnitId = businessUnitId;
      }

      const response = await apiClient.get<UserPermissionsResponse>(
        `/api/rbac/users/${userId}/permissions`,
        { params }
      );

      // Transform array response to UserPermissions object
      const permissions: UserPermissions = {} as UserPermissions;

      // The apiClient uses fetch, not axios, so response is the direct JSON
      const permissionsArray = response.data.permissions;

      if (!permissionsArray || !Array.isArray(permissionsArray)) {
        return permissions;
      }

      permissionsArray.forEach((perm) => {
        permissions[perm.resource as Resource] = {
          can_view: perm.can_view,
          can_create: perm.can_create,
          can_edit: perm.can_edit,
          can_delete: perm.can_delete,
        };
      });

      return permissions;
    },
    enabled: !!userId, // Only run if user is authenticated
    // SECURITY: No caching for permissions - they are security-critical
    staleTime: 0, // Data is immediately stale
    gcTime: 0, // Don't keep in cache after component unmounts
    refetchOnMount: true, // Always refetch on mount
    refetchOnWindowFocus: true, // Refetch when window regains focus
    retry: 1,
  });

  // Update store when query data changes
  useEffect(() => {
    if (query.isLoading) {
      setLoading(true);
    } else if (query.error) {
      setError(query.error instanceof Error ? query.error.message : "Failed to load permissions");
      setLoading(false);
    } else if (query.data) {
      setPermissions(query.data);
      setLoading(false);
    }
  }, [query.data, query.isLoading, query.error, setPermissions, setLoading, setError]);

  return {
    permissions: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Get current permissions from store
 * Does not trigger a fetch - use useLoadPermissions for that
 */
export function usePermissions() {
  const {
    permissions,
    isLoading,
    error,
    can,
    canView,
    canCreate,
    canEdit,
    canDelete,
    getResourcePermission,
    hasAnyPermissions,
  } = usePermissionStore();

  return {
    permissions,
    isLoading,
    error,
    can,
    canView,
    canCreate,
    canEdit,
    canDelete,
    getResourcePermission,
    hasAnyPermissions: hasAnyPermissions(),
  };
}

/**
 * Check if user can perform an action on a resource
 */
export function useCan(resource: Resource, action: PermissionAction): boolean {
  const { can } = usePermissionStore();
  return can(resource, action);
}

/**
 * Check if user can view a resource
 */
export function useCanView(resource: Resource): boolean {
  const { canView } = usePermissionStore();
  return canView(resource);
}

/**
 * Check if user can create a resource
 */
export function useCanCreate(resource: Resource): boolean {
  const { canCreate } = usePermissionStore();
  return canCreate(resource);
}

/**
 * Check if user can edit a resource
 */
export function useCanEdit(resource: Resource): boolean {
  const { canEdit } = usePermissionStore();
  return canEdit(resource);
}

/**
 * Check if user can delete a resource
 */
export function useCanDelete(resource: Resource): boolean {
  const { canDelete } = usePermissionStore();
  return canDelete(resource);
}

/**
 * Get all permissions for a specific resource
 */
export function useResourcePermission(resource: Resource): ResourcePermission | null {
  const { getResourcePermission } = usePermissionStore();
  return getResourcePermission(resource);
}

/**
 * Check multiple permissions at once
 * Returns object with boolean values for each permission check
 */
export function useResourcePermissions(resource: Resource) {
  const permission = useResourcePermission(resource);

  return {
    canView: permission?.can_view ?? false,
    canCreate: permission?.can_create ?? false,
    canEdit: permission?.can_edit ?? false,
    canDelete: permission?.can_delete ?? false,
    hasAnyPermission: permission
      ? permission.can_view || permission.can_create || permission.can_edit || permission.can_delete
      : false,
  };
}
