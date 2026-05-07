import type { Resource } from "@/constants/resources";
import type { PermissionAction, ResourcePermission, UserPermissions } from "@/types/rbac";

/**
 * Permission check result with detailed information
 */
export type PermissionCheckResult = {
  allowed: boolean;
  resource: Resource;
  action: PermissionAction;
  reason?: string;
};

/**
 * Raw permission data from database
 */
export type RawPermissionRow = {
  resource: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

/**
 * Cache entry for user permissions
 */
export type PermissionCacheEntry = {
  permissions: UserPermissions;
  timestamp: number;
  businessUnitId: string | null;
};

/**
 * Permission cache storage
 */
export type PermissionCache = Map<string, PermissionCacheEntry>;

export type UserCapabilityMap = Record<string, ResourcePermission>;

export type CapabilityCacheEntry = {
  capabilities: UserCapabilityMap;
  timestamp: number;
  businessUnitId: string | null;
};

export type CapabilityCache = Map<string, CapabilityCacheEntry>;
