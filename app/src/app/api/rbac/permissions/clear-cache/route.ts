import { NextResponse } from 'next/server';
import { invalidatePermissionCache } from '@/services/permissions/permissionResolver';
import { requirePermission } from '@/lib/auth';
import { RESOURCES } from '@/constants/resources';

/**
 * POST /api/rbac/permissions/clear-cache
 *
 * Clears the server-side permission cache.
 * This should be called after updating role permissions to ensure users see updated permissions immediately.
 *
 * Requires: roles permission (edit or delete)
 */
export async function POST() {
  try {
    // Only admins with role management permission can clear the cache
    const unauthorized = await requirePermission(RESOURCES.ROLES, 'edit');
    if (unauthorized) return unauthorized;

    // Clear the entire permission cache
    invalidatePermissionCache();

    return NextResponse.json({
      message: 'Permission cache cleared successfully'
    });
  } catch {

    return NextResponse.json(
      { error: 'Failed to clear permission cache' },
      { status: 500 }
    );
  }
}
