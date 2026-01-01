import { NextResponse } from 'next/server';
import type { Resource } from '@/constants/resources';
import type { PermissionAction } from '@/types/rbac';
import { getAuthenticatedUser, checkPermission } from './checkPermission';
import {
  type LookupResource,
  getAccessorsForLookupData,
} from '@/config/lookupDataPermissions';

/**
 * Error response for unauthorized access
 */
export type UnauthorizedResponse = NextResponse<{
  error: string;
  details?: string;
  resource?: string;
  action?: string;
}>;

/**
 * Require permission middleware wrapper for API routes
 *
 * This function checks if the authenticated user has the required permission.
 * If not, it returns a 403 Forbidden response.
 *
 * Usage in API routes:
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const unauthorized = await requirePermission('items', 'view');
 *   if (unauthorized) return unauthorized;
 *
 *   // Continue with authorized logic...
 * }
 * ```
 *
 * @param resource - Resource to check
 * @param action - Action to check (view, create, edit, delete)
 * @returns UnauthorizedResponse if not authorized, null if authorized
 */
export async function requirePermission(
  resource: Resource,
  action: PermissionAction
): Promise<UnauthorizedResponse | null> {
  // Check authentication
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        details: 'You must be logged in to access this resource',
      },
      { status: 401 }
    );
  }

  // Check permission
  const hasPermission = await checkPermission(resource, action);

  if (!hasPermission) {
    return NextResponse.json(
      {
        error: 'Forbidden',
        details: `You do not have permission to ${action} ${resource}`,
        resource,
        action,
      },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Helper functions for specific permission types
 */
export async function requireView(
  resource: Resource
): Promise<UnauthorizedResponse | null> {
  return requirePermission(resource, 'view');
}

export async function requireCreate(
  resource: Resource
): Promise<UnauthorizedResponse | null> {
  return requirePermission(resource, 'create');
}

export async function requireEdit(
  resource: Resource
): Promise<UnauthorizedResponse | null> {
  return requirePermission(resource, 'edit');
}

export async function requireDelete(
  resource: Resource
): Promise<UnauthorizedResponse | null> {
  return requirePermission(resource, 'delete');
}

/**
 * Require multiple permissions (user must have ALL)
 *
 * @param checks - Array of [resource, action] tuples
 * @returns UnauthorizedResponse if any check fails, null if all pass
 */
export async function requireAllPermissions(
  checks: Array<[Resource, PermissionAction]>
): Promise<UnauthorizedResponse | null> {
  for (const [resource, action] of checks) {
    const unauthorized = await requirePermission(resource, action);
    if (unauthorized) {
      return unauthorized;
    }
  }
  return null;
}

/**
 * Require any of multiple permissions (user must have AT LEAST ONE)
 *
 * @param checks - Array of [resource, action] tuples
 * @returns UnauthorizedResponse if all checks fail, null if any passes
 */
export async function requireAnyPermission(
  checks: Array<[Resource, PermissionAction]>
): Promise<UnauthorizedResponse | null> {
  // Check authentication first
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        details: 'You must be logged in to access this resource',
      },
      { status: 401 }
    );
  }

  // Check if user has any of the required permissions
  for (const [resource, action] of checks) {
    const hasPermission = await checkPermission(resource, action);
    if (hasPermission) {
      return null; // User has at least one required permission
    }
  }

  // User doesn't have any of the required permissions
  const resources = checks.map(([r]) => r).join(', ');
  const actions = checks.map(([, a]) => a).join(' or ');

  return NextResponse.json(
    {
      error: 'Forbidden',
      details: `You do not have permission to ${actions} any of: ${resources}`,
    },
    { status: 403 }
  );
}

/**
 * Require lookup data access permission
 *
 * This function implements the Lookup Data Access Pattern.
 * User can access lookup data if they have EITHER:
 * 1. Direct 'view' permission to the lookup resource, OR
 * 2. 'view' permission to any transactional feature that depends on it
 *
 * SECURITY: This ONLY grants VIEW access, never CREATE/EDIT/DELETE
 *
 * @see /docs/plans/lookup-data-permission-pattern.md
 * @see /app/src/config/lookupDataPermissions.ts
 *
 * @param lookupResource - The lookup resource to check access for
 * @returns UnauthorizedResponse if not authorized, null if authorized
 *
 * @example
 * // In /api/items/route.ts GET endpoint
 * export async function GET(request: NextRequest) {
 *   const unauthorized = await requireLookupDataAccess('items');
 *   if (unauthorized) return unauthorized;
 *
 *   // User has either 'items' view permission
 *   // OR 'pos'/'sales_orders'/etc permission
 *   // Continue with authorized logic...
 * }
 */
export async function requireLookupDataAccess(
  lookupResource: LookupResource
): Promise<UnauthorizedResponse | null> {
  // Check authentication first
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        details: 'You must be logged in to access this resource',
      },
      { status: 401 }
    );
  }

  // First, check if user has direct view permission to the lookup resource
  const hasDirectPermission = await checkPermission(lookupResource, 'view');
  if (hasDirectPermission) {
    return null; // Authorized via direct permission
  }

  // Check if user has any transactional feature permission that grants access
  const accessors = getAccessorsForLookupData(lookupResource);

  for (const accessor of accessors) {
    const hasFeaturePermission = await checkPermission(accessor, 'view');
    if (hasFeaturePermission) {
      // User has permission via transactional feature
      return null; // Authorized via dependent feature
    }
  }

  // No permission found
  return NextResponse.json(
    {
      error: 'Forbidden',
      details: `You need either '${lookupResource}' view permission or permission for a feature that uses this data (${accessors.join(', ')})`,
      resource: lookupResource,
      action: 'view',
    },
    { status: 403 }
  );
}
