# RBAC Implementation Review + Corrected Copy Plan

This document reviews the current RBAC implementation (including UI layout) and provides a corrected, production-ready plan to reproduce it in another project. The plan keeps the same feature set and UI/UX, while fixing known issues.

## Review Findings (Issues/Risks)

1) **High — Granular CRUD flags are ignored in permission checks.**
   - The database functions `get_user_permissions` and `user_has_permission` aggregate flags from `permissions.can_*` instead of `role_permissions.can_*`, so toggling CRUD flags in the Role Permissions UI does not change effective permissions.
   - Evidence: `supabase/migrations/20251230000001_fix_permission_business_unit_filter.sql:18`, `supabase/migrations/20251230000001_fix_permission_business_unit_filter.sql:57`.

2) **Medium — usePermissionDetail double-unwraps the API response.**
   - The hook returns `response.data.data`, but `apiClient` already returns parsed JSON; the permissions endpoint returns `{ data: Permission }`, so this resolves to `undefined` at runtime.
   - Evidence: `src/hooks/usePermissionsManagement.ts:61`.

3) **Low — Role permissions management button is visible without edit permission.**
   - The “Permissions” action on the Roles page isn’t wrapped in an edit guard, so a user with view-only access can open the dialog and attempt changes (the API still blocks the save).
   - Evidence: `src/app/(dashboard)/admin/roles/page.tsx:199`.

## Corrected Implementation Plan (Exact Features + UI, Fixed Behavior)

This section mirrors the existing feature set and UI layout, while correcting the issues above.

### 1) Database Schema + Functions (Supabase)

- **Core tables and relationships** (migration: `supabase/migrations/20251228000000_create_rbac_tables.sql`):
  - `roles`: company-scoped roles with `is_system_role` and soft delete.
  - `permissions`: global resources with CRUD flags (`can_view/create/edit/delete`).
  - `role_permissions`: junction table (role ↔ permission).
  - `user_roles`: junction table (user ↔ role) with optional `business_unit_id` scope.
- **Granular CRUD for role permissions** (migration: `supabase/migrations/20251230000000_add_granular_crud_to_role_permissions.sql`):
  - Adds `role_permissions.can_view/can_create/can_edit/can_delete` and backfills from `permissions`.
- **Corrected business-unit aware permission functions** (new migration or update `20251230000001_fix_permission_business_unit_filter.sql`):
  - `get_user_permissions` should aggregate **`role_permissions.can_*`**, not `permissions.can_*`.
  - `user_has_permission` should read from **`role_permissions.can_*`**.
  - Keep the existing BU logic: global roles apply when `user_roles.business_unit_id IS NULL` or matches the requested BU.

### 2) Seed Data and Default Roles

- **Seed base permissions and default roles** (migration: `supabase/migrations/20251228000001_seed_rbac_data.sql`):
  - Inserts resource permissions for admin, inventory, sales, purchasing, accounting, HR, reports.
  - Creates `Super Admin`, `Admin`, `Manager`, `User`, `Viewer` roles per company.
  - Assigns Super Admin to the first user in each company.
  - Creates trigger to auto-seed RBAC for new companies.
- **Follow-up permission patches**:
  - Missing resources: `supabase/migrations/20251230000002_add_missing_resources.sql`.
  - POS + Van Sales: `supabase/migrations/20251230000003_add_pos_van_sales_permissions.sql`.

### 3) Business Unit Context (JWT-Based)

- **Server client with BU context**: `src/lib/supabase/server-with-bu.ts`.
  - Decodes `current_business_unit_id` from JWT to set business unit context.
  - Used in permission checks to scope permissions by business unit.

### 4) Permission Resolution (Server Side)

- **Permission resolver**: `src/services/permissions/permissionResolver.ts`.
  - Calls `get_user_permissions` via Supabase RPC.
  - Aggregates into `UserPermissions` object keyed by `Resource`.
  - Cache disabled (`CACHE_TTL = 0`) and API responses set `Cache-Control: no-store`.
  - Exposes `getUserPermissions`, `can`, `canView`, `canCreate`, `canEdit`, `canDelete` helpers.

### 5) Auth Helpers for API Routes

- **Check authenticated user**: `src/lib/auth/checkPermission.ts`.
  - Uses `createServerClientWithBU()` to extract user + company + BU.
  - Calls permission resolver `can()` for checks.
- **API guard functions**: `src/lib/auth/requirePermission.ts`.
  - `requirePermission(resource, action)` returns 401/403 `NextResponse` or `null`.
  - `requireLookupDataAccess(lookupResource)` implements lookup-data access pattern.

### 6) API Endpoints (RBAC)

- **Roles**:
  - `GET /api/rbac/roles` (view) — lists roles, optionally includes permissions.
  - `POST /api/rbac/roles` (create) — creates role; optionally assigns permission IDs.
  - `GET /api/rbac/roles/[id]` (view) — returns role with CRUD flags per permission.
  - `PUT /api/rbac/roles/[id]` (edit) — updates role name/description.
  - `DELETE /api/rbac/roles/[id]` (delete) — soft deletes if no assignments.
  - `POST /api/rbac/roles/[id]/permissions` (edit) — replaces all role permissions with CRUD flags.
  - `DELETE /api/rbac/roles/[id]/permissions` (edit) — removes specific permissions.
- **Permissions**:
  - `GET /api/rbac/permissions` (view) — list permissions with pagination.
  - `POST /api/rbac/permissions` (create).
  - `GET /api/rbac/permissions/[id]` (view) — detail.
  - `PUT /api/rbac/permissions/[id]` (edit).
  - `DELETE /api/rbac/permissions/[id]` (delete).
- **Users**:
  - `GET /api/rbac/users` (view).
  - `GET /api/rbac/users/[id]` (view).
  - `PATCH /api/rbac/users/[id]` (edit) — activate/deactivate.
  - `GET /api/rbac/users/[id]/roles` — list roles for user.
  - `POST /api/rbac/users/[id]/roles` — assign role per BU.
  - `DELETE /api/rbac/users/[id]/roles` — remove role per BU.
  - `GET /api/rbac/users/[id]/permissions` — effective permissions (no cache headers).

### 7) Client State + Hooks

- **Permission store**: `src/stores/permissionStore.ts`.
  - Stores `UserPermissions`, `isLoading`, `error`, `lastFetchedAt`.
  - Exposes `can`, `canView`, `canCreate`, `canEdit`, `canDelete`, `hasAnyPermissions()`.
- **Permissions loader**: `src/hooks/usePermissions.ts`.
  - `useLoadPermissions()` fetches `/api/rbac/users/:id/permissions` and normalizes to `UserPermissions`.
  - React Query configured with `staleTime: 0`, `gcTime: 0`, `refetchOnMount: true`.
  - `usePermissions()` reads from store.
- **Roles/Users hooks**:
  - `src/hooks/useRoles.ts`: CRUD + assign permissions with invalidation.
  - `src/hooks/useUsers.ts`: list users, toggle active status, assign/remove roles.
  - `src/hooks/useUserPermissions.ts`: effective permissions fetch for dialogs.
  - `src/hooks/useUserRoles.ts`: role list + default landing page helper.
- **Corrected hook behavior**:
  - `usePermissionDetail` should return `response.data`, not `response.data.data`.

### 8) UI Guards + Routing

- **ProtectedRoute**: `src/components/permissions/ProtectedRoute.tsx`.
  - Wraps a page; redirects to `/403` if no view permission.
  - Shows a loading spinner while permissions are loading.
- **Permission guards**: `src/components/permissions/PermissionGuard.tsx`.
  - `CreateGuard`, `EditGuard`, `DeleteGuard`, `ViewGuard`, `AnyPermissionGuard`, `AllPermissionsGuard`.
- **Default landing logic**: `src/config/roleDefaultPages.ts`.
  - Role-to-default-page mapping with page-to-resource map.
  - `getFirstAccessiblePage()` checks permission map before redirect.

### 9) Admin UI: Layout and Components (Same UI, Corrected Guards)

#### Roles Page (`/admin/roles`)
- **File**: `src/app/(dashboard)/admin/roles/page.tsx`.
- **Layout**:
  - Title + subtitle on the left; Create Role button on the right.
  - Search input with left icon, full-width.
  - Table with columns: Role, Description, Type, Created, Actions.
- **Design elements**:
  - Uses `Table`, `Badge`, `Skeleton`, `Button` (shadcn UI).
  - System vs Custom badges (`variant="secondary"` vs `variant="outline"`).
  - Actions: Permissions (outline), Edit (ghost), Delete (ghost, destructive icon).
- **Dialogs**:
  - Delete confirmation (`AlertDialog`).
  - Create, Edit, Role Permissions dialogs.
- **Guards (corrected)**:
  - Page wrapped by `ProtectedRoute(resource=roles)`.
  - Create/Edit/Delete action buttons wrapped by guards.
  - **Permissions action should also be wrapped with `EditGuard`** to match edit capability.

#### Users Page (`/admin/users`)
- **File**: `src/app/(dashboard)/admin/users/page.tsx`.
- **Layout**:
  - Title + subtitle; no create button.
  - Search input + status filter buttons (All/Active/Inactive).
  - Table with columns: User, Username, Status, Created, Actions.
- **Design elements**:
  - Status badge uses outline with green text for Active, secondary for Inactive.
  - Actions: Manage Roles, View Permissions, Activate/Deactivate.
- **Dialogs**:
  - `UserRolesDialog` and `UserPermissionsDialog`.
- **Guards**:
  - Page wrapped by `ProtectedRoute(resource=users)`.

#### UserRolesDialog
- **File**: `src/components/admin/UserRolesDialog.tsx`.
- **Layout**:
  - Two panels: Current Roles list + Assign New Role form.
  - Role removal is inline with ghost button.
  - Assign form uses two `Select` controls (Role + Business Unit) and a full-width action button.

#### RolePermissionsDialog
- **File**: `src/components/admin/RolePermissionsDialog.tsx`.
- **Layout**:
  - Search input + scrollable list of permissions.
  - Each permission is a bordered card with description and CRUD checkboxes.
  - Shows “Available” CRUD tags when not assigned.
  - Footer shows count and Save/Cancel buttons.
- **Behavior (corrected)**:
  - CRUD flags for a role should actually affect permission checks (via corrected SQL functions).

#### UserPermissionsDialog
- **File**: `src/components/admin/UserPermissionsDialog.tsx`.
- **Layout**:
  - Dialog header with badges for active permission count + email.
  - Search input, scrollable table with View/Create/Edit/Delete columns.
  - Uses colored outline badges to show enabled actions.

### 10) Access Denied UI

- **File**: `src/app/(dashboard)/403/page.tsx`.
- **Design**:
  - Centered card with icon, title, message, and actions.
  - Actions change based on whether user has any permissions:
    - If yes: Go Back + Go to Home (first accessible page).
    - If no: Logout only.

### 11) Lookup Data Permission Pattern

- **Config**: `src/config/lookupDataPermissions.ts`.
- **Behavior**:
  - If user can view a transactional feature (POS, Sales Orders, etc.), they get read-only access to required lookup data (items, customers, suppliers, warehouses, item categories, employees).
  - Enforced via `requireLookupDataAccess()` in API routes.

### 12) Resource Definitions

- **Resources list**: `src/constants/resources.ts`.
  - Defines all resources (admin, inventory, sales, etc.).
  - Includes `RESOURCE_METADATA` for UI display and grouping.

---

## Notes for Porting

- Keep the same API response shapes: most endpoints return `{ data: ... }` and the `apiClient` returns the parsed JSON body directly.
- Keep permission caching disabled both client- and server-side (zero-stale, `Cache-Control: no-store`).
- Preserve the role default page mapping and `PAGE_RESOURCE_MAP` to match the landing logic.
- If you need business-unit scoping, replicate the JWT claim approach (`current_business_unit_id`) and use `createServerClientWithBU()` to read it.
