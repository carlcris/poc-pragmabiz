import { requireRequestContext } from "./requestContext";
import type { Resource } from "@/constants/resources";
import type { PermissionAction } from "@/types/rbac";
import { can } from "@/services/permissions/permissionResolver";

/**
 * User data extracted from request
 */
export type AuthenticatedUser = {
  id: string;
  companyId: string;
  businessUnitId: string | null;
};

/**
 * Extract authenticated user from request
 *
 * @returns AuthenticatedUser or null if not authenticated
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const context = await requireRequestContext();
  if ("status" in context) {
    return null;
  }

  return {
    id: context.userId,
    companyId: context.companyId,
    businessUnitId: context.currentBusinessUnitId,
  };
}

export async function checkPermissionForUser(
  user: AuthenticatedUser,
  resource: Resource,
  action: PermissionAction
): Promise<boolean> {
  return can(user.id, resource, action, user.businessUnitId);
}

/**
 * Check if the authenticated user has a specific permission
 *
 * @param resource - Resource to check
 * @param action - Action to check (view, create, edit, delete)
 * @returns boolean indicating if user has permission
 */
export async function checkPermission(
  resource: Resource,
  action: PermissionAction
): Promise<boolean> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return false;
  }

  return checkPermissionForUser(user, resource, action);
}

/**
 * Helper functions for specific permission types
 */
export async function canView(resource: Resource): Promise<boolean> {
  return checkPermission(resource, "view");
}

export async function canCreate(resource: Resource): Promise<boolean> {
  return checkPermission(resource, "create");
}

export async function canEdit(resource: Resource): Promise<boolean> {
  return checkPermission(resource, "edit");
}

export async function canDelete(resource: Resource): Promise<boolean> {
  return checkPermission(resource, "delete");
}
