/**
 * Permission Store
 *
 * Zustand store for managing user permissions
 * Stores permissions loaded from the backend for the current user
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Resource } from "@/constants/resources";
import type { UserPermissions, ResourcePermission, PermissionAction } from "@/types/rbac";

type PermissionStore = {
  // State
  permissions: UserPermissions | null;
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  currentScopeKey: string | null;
  permissionsCacheByScope: Record<string, UserPermissions>;
  fetchedAtByScope: Record<string, number>;

  // Actions
  setScope: (scopeKey: string | null) => void;
  setPermissions: (permissions: UserPermissions) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearPermissions: () => void;

  // Permission checks
  can: (resource: Resource, action: PermissionAction) => boolean;
  canView: (resource: Resource) => boolean;
  canCreate: (resource: Resource) => boolean;
  canEdit: (resource: Resource) => boolean;
  canDelete: (resource: Resource) => boolean;
  getResourcePermission: (resource: Resource) => ResourcePermission | null;

  // Utility
  hasAnyPermissions: () => boolean;
};

export const usePermissionStore = create<PermissionStore>()(
  persist(
    (set, get) => ({
      // Initial state
      permissions: null,
      isLoading: false,
      error: null,
      lastFetchedAt: null,
      currentScopeKey: null,
      permissionsCacheByScope: {},
      fetchedAtByScope: {},

  // Actions
      setScope: (scopeKey) => {
        if (!scopeKey) {
          set({
            currentScopeKey: null,
            permissions: null,
            lastFetchedAt: null,
            error: null,
          });
          return;
        }

        set((state) => ({
          currentScopeKey: scopeKey,
          permissions: state.permissionsCacheByScope[scopeKey] ?? null,
          lastFetchedAt: state.fetchedAtByScope[scopeKey] ?? null,
          error: null,
        }));
      },

      setPermissions: (permissions) => {
        set((state) => {
          const now = Date.now();
          if (!state.currentScopeKey) {
            return {
              permissions,
              error: null,
              lastFetchedAt: now,
            };
          }

          return {
            permissions,
            error: null,
            lastFetchedAt: now,
            permissionsCacheByScope: {
              ...state.permissionsCacheByScope,
              [state.currentScopeKey]: permissions,
            },
            fetchedAtByScope: {
              ...state.fetchedAtByScope,
              [state.currentScopeKey]: now,
            },
          };
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
          currentScopeKey: null,
          permissionsCacheByScope: {},
          fetchedAtByScope: {},
        });
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

    }),
    {
      name: "permission-store",
      partialize: (state) => ({
        currentScopeKey: state.currentScopeKey,
        permissionsCacheByScope: state.permissionsCacheByScope,
        fetchedAtByScope: state.fetchedAtByScope,
      }),
    }
  )
);
