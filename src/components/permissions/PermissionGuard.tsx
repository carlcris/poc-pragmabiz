/**
 * Permission Guard Components
 *
 * Components that conditionally render children based on user permissions
 */

import type { ReactNode } from "react";
import type { Resource } from "@/constants/resources";
import type { PermissionAction } from "@/types/rbac";
import { usePermissions } from "@/hooks/usePermissions";

type PermissionGuardProps = {
  resource: Resource;
  action: PermissionAction;
  children: ReactNode;
  fallback?: ReactNode;
  showLoading?: boolean;
  loadingFallback?: ReactNode;
};

/**
 * Generic Permission Guard
 *
 * Renders children only if user has the specified permission
 *
 * @example
 * <PermissionGuard resource="items" action="create">
 *   <CreateButton />
 * </PermissionGuard>
 */
export function PermissionGuard({
  resource,
  action,
  children,
  fallback = null,
  showLoading = false,
  loadingFallback = null,
}: PermissionGuardProps) {
  const { can, isLoading } = usePermissions();

  if (isLoading && showLoading) {
    return <>{loadingFallback}</>;
  }

  if (!can(resource, action)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

type ResourceGuardProps = {
  resource: Resource;
  children: ReactNode;
  fallback?: ReactNode;
  showLoading?: boolean;
  loadingFallback?: ReactNode;
};

/**
 * View Permission Guard
 *
 * Renders children only if user can view the resource
 *
 * @example
 * <ViewGuard resource="items">
 *   <ItemsList />
 * </ViewGuard>
 */
export function ViewGuard({
  resource,
  children,
  fallback = null,
  showLoading = false,
  loadingFallback = null,
}: ResourceGuardProps) {
  return (
    <PermissionGuard
      resource={resource}
      action="view"
      fallback={fallback}
      showLoading={showLoading}
      loadingFallback={loadingFallback}
    >
      {children}
    </PermissionGuard>
  );
}

/**
 * Create Permission Guard
 *
 * Renders children only if user can create the resource
 *
 * @example
 * <CreateGuard resource="items">
 *   <CreateItemButton />
 * </CreateGuard>
 */
export function CreateGuard({
  resource,
  children,
  fallback = null,
  showLoading = false,
  loadingFallback = null,
}: ResourceGuardProps) {
  return (
    <PermissionGuard
      resource={resource}
      action="create"
      fallback={fallback}
      showLoading={showLoading}
      loadingFallback={loadingFallback}
    >
      {children}
    </PermissionGuard>
  );
}

/**
 * Edit Permission Guard
 *
 * Renders children only if user can edit the resource
 *
 * @example
 * <EditGuard resource="items">
 *   <EditItemButton />
 * </EditGuard>
 */
export function EditGuard({
  resource,
  children,
  fallback = null,
  showLoading = false,
  loadingFallback = null,
}: ResourceGuardProps) {
  return (
    <PermissionGuard
      resource={resource}
      action="edit"
      fallback={fallback}
      showLoading={showLoading}
      loadingFallback={loadingFallback}
    >
      {children}
    </PermissionGuard>
  );
}

/**
 * Delete Permission Guard
 *
 * Renders children only if user can delete the resource
 *
 * @example
 * <DeleteGuard resource="items">
 *   <DeleteItemButton />
 * </DeleteGuard>
 */
export function DeleteGuard({
  resource,
  children,
  fallback = null,
  showLoading = false,
  loadingFallback = null,
}: ResourceGuardProps) {
  return (
    <PermissionGuard
      resource={resource}
      action="delete"
      fallback={fallback}
      showLoading={showLoading}
      loadingFallback={loadingFallback}
    >
      {children}
    </PermissionGuard>
  );
}

type AnyPermissionGuardProps = {
  resource: Resource;
  actions: PermissionAction[];
  children: ReactNode;
  fallback?: ReactNode;
  showLoading?: boolean;
  loadingFallback?: ReactNode;
};

/**
 * Any Permission Guard
 *
 * Renders children if user has ANY of the specified permissions
 *
 * @example
 * <AnyPermissionGuard resource="items" actions={['view', 'edit']}>
 *   <ItemDetails />
 * </AnyPermissionGuard>
 */
export function AnyPermissionGuard({
  resource,
  actions,
  children,
  fallback = null,
  showLoading = false,
  loadingFallback = null,
}: AnyPermissionGuardProps) {
  const { can, isLoading } = usePermissions();

  if (isLoading && showLoading) {
    return <>{loadingFallback}</>;
  }

  const hasAnyPermission = actions.some((action) => can(resource, action));

  if (!hasAnyPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

type AllPermissionsGuardProps = {
  resource: Resource;
  actions: PermissionAction[];
  children: ReactNode;
  fallback?: ReactNode;
  showLoading?: boolean;
  loadingFallback?: ReactNode;
};

/**
 * All Permissions Guard
 *
 * Renders children only if user has ALL of the specified permissions
 *
 * @example
 * <AllPermissionsGuard resource="items" actions={['view', 'edit', 'delete']}>
 *   <AdminPanel />
 * </AllPermissionsGuard>
 */
export function AllPermissionsGuard({
  resource,
  actions,
  children,
  fallback = null,
  showLoading = false,
  loadingFallback = null,
}: AllPermissionsGuardProps) {
  const { can, isLoading } = usePermissions();

  if (isLoading && showLoading) {
    return <>{loadingFallback}</>;
  }

  const hasAllPermissions = actions.every((action) => can(resource, action));

  if (!hasAllPermissions) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
