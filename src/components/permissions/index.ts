/**
 * Permission Components
 *
 * Export all permission-related components for easy importing
 */

export {
  PermissionGuard,
  ViewGuard,
  CreateGuard,
  EditGuard,
  DeleteGuard,
  AnyPermissionGuard,
  AllPermissionsGuard,
} from "./PermissionGuard";

export { ProtectedRoute, MultiResourceProtectedRoute } from "./ProtectedRoute";
