/**
 * Authorization and Permission Utilities
 *
 * This module provides utilities for checking and enforcing permissions in API routes.
 */

// Re-export from checkPermission
export {
  getAuthenticatedUser,
  checkPermission,
  canView,
  canCreate,
  canEdit,
  canDelete,
  type AuthenticatedUser,
} from "./checkPermission";

// Re-export from requirePermission
export {
  requirePermission,
  requireView,
  requireCreate,
  requireEdit,
  requireDelete,
  requireAllPermissions,
  requireAnyPermission,
  requireLookupDataAccess,
  type UnauthorizedResponse,
} from "./requirePermission";
