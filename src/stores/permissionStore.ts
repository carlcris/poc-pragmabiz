/**
 * Permission Store
 *
 * Zustand store for managing user permissions
 * Stores permissions loaded from the backend for the current user
 */

import { create } from "zustand";
import type { Resource } from "@/constants/resources";
import type { UserPermissions, ResourcePermission, PermissionAction } from "@/types/rbac";

type PermissionStore = {
  // State
  permissions: UserPermissions | null;
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: number | null;

  // Actions
  setPermissions: (permissions: UserPermissions) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearPermissions: () => void;
  markFetched: () => void;

  // Permission checks
  can: (resource: Resource, action: PermissionAction) => boolean;
  canView: (resource: Resource) => boolean;
  canCreate: (resource: Resource) => boolean;
  canEdit: (resource: Resource) => boolean;
  canDelete: (resource: Resource) => boolean;
  getResourcePermission: (resource: Resource) => ResourcePermission | null;

  // Utility
  hasAnyPermissions: () => boolean;
  isStale: () => boolean; // Check if permissions need refresh (5 min)
};

const STALE_TIME = 5 * 60 * 1000; // 5 minutes

export const usePermissionStore = create<PermissionStore>((set, get) => ({
  // Initial state
  permissions: null,
  isLoading: false,
  error: null,
  lastFetchedAt: null,

  // Actions
  setPermissions: (permissions) => {
    set({
      permissions,
      error: null,
      lastFetchedAt: Date.now(),
    });
  },

  setLoading: (isLoading) => {
    set({ isLoading });
  },

  setError: (error) => {
    set({ error, isLoading: false });
  },

  clearPermissions: () => {
    set({
      permissions: null,
      isLoading: false,
      error: null,
      lastFetchedAt: null,
    });
  },

  markFetched: () => {
    set({ lastFetchedAt: Date.now() });
  },

  // Permission checks
  can: (resource, action) => {
    const { permissions } = get();
    if (!permissions || !permissions[resource]) {
      return false;
    }

    const resourcePermission = permissions[resource];

    switch (action) {
      case "view":
        return resourcePermission.can_view;
      case "create":
        return resourcePermission.can_create;
      case "edit":
        return resourcePermission.can_edit;
      case "delete":
        return resourcePermission.can_delete;
      default:
        return false;
    }
  },

  canView: (resource) => {
    return get().can(resource, "view");
  },

  canCreate: (resource) => {
    return get().can(resource, "create");
  },

  canEdit: (resource) => {
    return get().can(resource, "edit");
  },

  canDelete: (resource) => {
    return get().can(resource, "delete");
  },

  getResourcePermission: (resource) => {
    const { permissions } = get();
    if (!permissions || !permissions[resource]) {
      return null;
    }
    return permissions[resource];
  },

  // Utility
  hasAnyPermissions: () => {
    const { permissions } = get();
    if (!permissions) return false;

    // Check if user has at least one view permission
    return Object.values(permissions).some((perm) => perm.can_view);
  },

  isStale: () => {
    const { lastFetchedAt } = get();
    if (!lastFetchedAt) return true;
    return Date.now() - lastFetchedAt > STALE_TIME;
  },
}));
