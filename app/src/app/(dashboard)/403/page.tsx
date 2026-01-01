'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { RESOURCE_METADATA } from '@/constants/resources';
import { usePermissions } from '@/hooks/usePermissions';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useAuthStore } from '@/stores/authStore';
import { getFirstAccessiblePage } from '@/config/roleDefaultPages';

export default function AccessDeniedPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { permissions, isLoading: permissionsLoading } = usePermissions();
  const { data: rolesData, isLoading: rolesLoading } = useUserRoles();
  const { logout } = useAuthStore();

  const resource = searchParams.get('resource');
  const resources = searchParams.get('resources');
  const requireAll = searchParams.get('requireAll') === 'true';

  // Get resource metadata for display
  const getResourceName = (resourceKey: string) => {
    const metadata = RESOURCE_METADATA.find((r) => r.key === resourceKey);
    return metadata?.name || resourceKey;
  };

  // SECURITY: Navigate to first accessible page based on user's actual permissions
  // Never hardcode dashboard - user might not have access to it
  const handleGoToAccessiblePage = () => {
    if (permissionsLoading || rolesLoading) return;

    const roleNames = rolesData?.map((r: { name: string }) => r.name) || [];
    const accessiblePage = getFirstAccessiblePage(permissions, roleNames);

    // If user has no accessible pages, they'll be redirected back to 403
    // This prevents infinite loops - the page won't render the button if no access
    router.push(accessiblePage);
  };

  // SECURITY: Logout user if they have no accessible pages
  // Better UX than being stuck on 403 page - forces them to contact admin
  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  // Check if user has any accessible pages at all
  const hasAnyAccess = permissions && Object.values(permissions).some(perm => perm.can_view);

  const renderResourceMessage = () => {
    if (resources) {
      const resourceList = resources.split(',').map(getResourceName);
      if (requireAll) {
        return (
          <>
            You need permission to access <strong>all</strong> of the following resources:{' '}
            <strong>{resourceList.join(', ')}</strong>
          </>
        );
      }
      return (
        <>
          You need permission to access at least one of the following resources:{' '}
          <strong>{resourceList.join(', ')}</strong>
        </>
      );
    }

    if (resource) {
      return (
        <>
          You need <strong>view</strong> permission for <strong>{getResourceName(resource)}</strong>
        </>
      );
    }

    return 'You do not have permission to access this resource';
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-gray-50">
      <div className="text-center px-6 py-12 max-w-md">
        {/* Icon */}
        <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-red-100 mb-6">
          <svg
            className="h-12 w-12 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Access Denied</h1>

        {/* Message */}
        <div className="space-y-3 mb-8">
          <p className="text-lg text-gray-700">{renderResourceMessage()}</p>

          <p className="text-sm text-gray-600">
            If you believe this is an error, please contact your system administrator to request
            access.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {/* SECURITY: Show different actions based on user's permissions */}
          {hasAnyAccess ? (
            <>
              {/* User has some permissions - show Go Back and Go to Home */}
              <button
                onClick={() => router.back()}
                className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Go Back
              </button>

              <button
                onClick={handleGoToAccessiblePage}
                disabled={permissionsLoading || rolesLoading}
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                {permissionsLoading || rolesLoading ? 'Loading...' : 'Go to Home'}
              </button>
            </>
          ) : (
            <>
              {/* User has ZERO permissions - only show Logout */}
              <button
                onClick={handleLogout}
                disabled={permissionsLoading || rolesLoading}
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                {permissionsLoading || rolesLoading ? 'Loading...' : 'Logout'}
              </button>
            </>
          )}
        </div>

        {/* Additional Info */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Error Code: 403 - Forbidden
          </p>
        </div>
      </div>
    </div>
  );
}
