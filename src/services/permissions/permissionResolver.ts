import { createClient } from "@/lib/supabase/server";
import { RESOURCES, type Resource } from "@/constants/resources";
import type { UserPermissions, PermissionAction } from "@/types/rbac";
import type {
  PermissionCheckResult,
  RawPermissionRow,
  PermissionCache,
  PermissionCacheEntry,
} from "./types";

// In-memory cache for permissions
// IMPORTANT: Cache is DISABLED for security-critical permission data
// Permissions must always be fresh to prevent unauthorized access
const CACHE_TTL = 0; // DISABLED - No caching for security
const permissionCache: PermissionCache = new Map();

/**
 * Generate cache key for user permissions
 */
function getCacheKey(userId: string, businessUnitId: string | null): string {
  return `${userId}:${businessUnitId || "global"}`;
}

/**
 * Check if cache entry is still valid
 */
function isCacheValid(entry: PermissionCacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL;
}

/**
 * Get permissions from cache
 */
function getFromCache(userId: string, businessUnitId: string | null): UserPermissions | null {
  const key = getCacheKey(userId, businessUnitId);
  const entry = permissionCache.get(key);

  if (!entry || !isCacheValid(entry)) {
    permissionCache.delete(key);
    return null;
  }

  return entry.permissions;
}

/**
 * Store permissions in cache
 */
function storeInCache(
  userId: string,
  businessUnitId: string | null,
  permissions: UserPermissions
): void {
  const key = getCacheKey(userId, businessUnitId);
  permissionCache.set(key, {
    permissions,
    timestamp: Date.now(),
    businessUnitId,
  });
}

/**
 * Invalidate cache for a specific user or all users
 */
export function invalidatePermissionCache(userId?: string): void {
  if (userId) {
    // Invalidate all entries for this user
    const keysToDelete: string[] = [];
    permissionCache.forEach((_, key) => {
      if (key.startsWith(`${userId}:`)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => permissionCache.delete(key));
  } else {
    // Clear entire cache
    permissionCache.clear();
  }
}

/**
 * Create empty permissions object with all resources set to no access
 */
function createEmptyPermissions(): UserPermissions {
  const permissions: Partial<UserPermissions> = {};

  Object.values(RESOURCES).forEach((resource) => {
    permissions[resource as Resource] = {
      can_view: false,
      can_create: false,
      can_edit: false,
      can_delete: false,
    };
  });

  return permissions as UserPermissions;
}

/**
 * Aggregate permissions using UNION logic
 * If ANY role grants the permission, it is allowed
 */
function aggregatePermissions(rawPermissions: RawPermissionRow[]): UserPermissions {
  const permissions = createEmptyPermissions();

  rawPermissions.forEach((row) => {
    const resource = row.resource as Resource;

    if (permissions[resource]) {
      // UNION logic: true if ANY role grants the permission
      permissions[resource].can_view = permissions[resource].can_view || row.can_view;
      permissions[resource].can_create = permissions[resource].can_create || row.can_create;
      permissions[resource].can_edit = permissions[resource].can_edit || row.can_edit;
      permissions[resource].can_delete = permissions[resource].can_delete || row.can_delete;
    }
  });

  return permissions;
}

/**
 * Fetch user permissions from database using the helper function
 */
async function fetchUserPermissions(
  userId: string,
  businessUnitId: string | null
): Promise<UserPermissions> {
  const supabase = await createClient();

  // Call the database function to get aggregated permissions
  const { data, error } = await supabase.rpc("get_user_permissions", {
    p_user_id: userId,
    p_business_unit_id: businessUnitId,
  });

  if (error) {
    return createEmptyPermissions();
  }

  if (!data || data.length === 0) {
    return createEmptyPermissions();
  }

  // The database function already does BOOL_OR aggregation
  // We just need to format it into our UserPermissions structure
  return aggregatePermissions(data as RawPermissionRow[]);
}

/**
 * Get all permissions for a user (with caching)
 *
 * @param userId - User ID
 * @param businessUnitId - Optional business unit ID for scoped permissions
 * @returns UserPermissions object with all resource permissions
 */
export async function getUserPermissions(
  userId: string,
  businessUnitId: string | null = null
): Promise<UserPermissions> {
  // Check cache first
  const cached = getFromCache(userId, businessUnitId);
  if (cached) {
    return cached;
  }

  // Fetch from database
  const permissions = await fetchUserPermissions(userId, businessUnitId);

  // Store in cache
  storeInCache(userId, businessUnitId, permissions);

  return permissions;
}

/**
 * Check if user has specific permission
 *
 * @param userId - User ID
 * @param resource - Resource to check
 * @param action - Action to check (view, create, edit, delete)
 * @param businessUnitId - Optional business unit ID for scoped permissions
 * @returns boolean indicating if user has permission
 */
export async function can(
  userId: string,
  resource: Resource,
  action: PermissionAction,
  businessUnitId: string | null = null
): Promise<boolean> {
  const permissions = await getUserPermissions(userId, businessUnitId);
  const resourcePermission = permissions[resource];

  if (!resourcePermission) {
    return false;
  }

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
}

/**
 * Check if user has specific permission with detailed result
 *
 * @param userId - User ID
 * @param resource - Resource to check
 * @param action - Action to check (view, create, edit, delete)
 * @param businessUnitId - Optional business unit ID for scoped permissions
 * @returns PermissionCheckResult with detailed information
 */
export async function checkPermission(
  userId: string,
  resource: Resource,
  action: PermissionAction,
  businessUnitId: string | null = null
): Promise<PermissionCheckResult> {
  const allowed = await can(userId, resource, action, businessUnitId);

  return {
    allowed,
    resource,
    action,
    reason: allowed ? undefined : `User does not have ${action} permission for ${resource}`,
  };
}

/**
 * Helper functions for specific permission types
 */
export async function canView(
  userId: string,
  resource: Resource,
  businessUnitId: string | null = null
): Promise<boolean> {
  return can(userId, resource, "view", businessUnitId);
}

export async function canCreate(
  userId: string,
  resource: Resource,
  businessUnitId: string | null = null
): Promise<boolean> {
  return can(userId, resource, "create", businessUnitId);
}

export async function canEdit(
  userId: string,
  resource: Resource,
  businessUnitId: string | null = null
): Promise<boolean> {
  return can(userId, resource, "edit", businessUnitId);
}

export async function canDelete(
  userId: string,
  resource: Resource,
  businessUnitId: string | null = null
): Promise<boolean> {
  return can(userId, resource, "delete", businessUnitId);
}
