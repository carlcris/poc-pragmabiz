/**
 * Protected Route Component
 *
 * Wraps pages/routes and redirects to access denied page if user lacks permission
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Resource } from '@/constants/resources';
import { usePermissions } from '@/hooks/usePermissions';

type ProtectedRouteProps = {
  resource: Resource;
  children: ReactNode;
  redirectTo?: string;
  showLoading?: boolean;
  loadingComponent?: ReactNode;
};

/**
 * Protected Route
 *
 * Checks if user has view permission for the resource
 * Redirects to access denied page if permission is missing
 *
 * @example
 * <ProtectedRoute resource="items">
 *   <ItemsPage />
 * </ProtectedRoute>
 */
export function ProtectedRoute({
  resource,
  children,
  redirectTo = '/403',
  showLoading = true,
  loadingComponent,
}: ProtectedRouteProps) {
  const router = useRouter();
  const { canView, isLoading, hasAnyPermissions } = usePermissions();

  useEffect(() => {
    // Wait for permissions to load
    if (isLoading) return;

    // Check if user has view permission
    if (!canView(resource)) {
      // Redirect to access denied page
      router.push(`${redirectTo}?resource=${resource}`);
    }
  }, [canView, resource, isLoading, redirectTo, router]);

  // Show loading state while permissions are being fetched
  if (isLoading && showLoading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }

    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading permissions...</p>
        </div>
      </div>
    );
  }

  // Don't render children if user doesn't have permission
  if (!canView(resource)) {
    return null;
  }

  return <>{children}</>;
}

type MultiResourceProtectedRouteProps = {
  resources: Resource[];
  requireAll?: boolean;
  children: ReactNode;
  redirectTo?: string;
  showLoading?: boolean;
  loadingComponent?: ReactNode;
};

/**
 * Multi-Resource Protected Route
 *
 * Checks if user has view permission for multiple resources
 * Can require ALL permissions or ANY permission
 *
 * @example
 * // Require ANY permission
 * <MultiResourceProtectedRoute resources={['items', 'warehouses']}>
 *   <InventoryPage />
 * </MultiResourceProtectedRoute>
 *
 * // Require ALL permissions
 * <MultiResourceProtectedRoute resources={['items', 'warehouses']} requireAll>
 *   <AdvancedInventoryPage />
 * </MultiResourceProtectedRoute>
 */
export function MultiResourceProtectedRoute({
  resources,
  requireAll = false,
  children,
  redirectTo = '/403',
  showLoading = true,
  loadingComponent,
}: MultiResourceProtectedRouteProps) {
  const router = useRouter();
  const { canView, isLoading } = usePermissions();

  useEffect(() => {
    if (isLoading) return;

    let hasPermission = false;

    if (requireAll) {
      // User must have view permission for ALL resources
      hasPermission = resources.every((resource) => canView(resource));
    } else {
      // User must have view permission for AT LEAST ONE resource
      hasPermission = resources.some((resource) => canView(resource));
    }

    if (!hasPermission) {
      const resourcesParam = resources.join(',');
      router.push(`${redirectTo}?resources=${resourcesParam}&requireAll=${requireAll}`);
    }
  }, [canView, resources, requireAll, isLoading, redirectTo, router]);

  if (isLoading && showLoading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }

    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading permissions...</p>
        </div>
      </div>
    );
  }

  let hasPermission = false;

  if (requireAll) {
    hasPermission = resources.every((resource) => canView(resource));
  } else {
    hasPermission = resources.some((resource) => canView(resource));
  }

  if (!hasPermission) {
    return null;
  }

  return <>{children}</>;
}
