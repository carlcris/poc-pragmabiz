# Authentication & Authorization Module

## Overview

The Authentication & Authorization module provides secure user authentication, session management, and granular permission control across the entire ERP system. It implements JWT-based authentication via Supabase Auth and a comprehensive role-based access control (RBAC) system with 73+ resources and 40+ capabilities.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client Layer                         │
│  Login Form → Auth API → Session Storage                │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                 Middleware Layer                        │
│  Session Validation → Token Refresh → Route Protection  │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│               Permission Resolution Layer               │
│  User Roles → Aggregated Permissions → Cache (5s TTL)   │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                 Authorization Layer                     │
│  API Route Checks → UI Component Visibility             │
└─────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Authentication Flow

#### Login Process

```typescript
// Location: src/app/api/auth/login/route.ts

POST /api/auth/login
Request: { email: string, password: string }
Response: {
  user: User,
  token: string,
  refreshToken: string,
  currentBusinessUnit: { id: string, code: string, name: string } | null,
  landingPage: string
}
```

**Flow**:

1. User submits credentials
2. API calls `supabase.auth.signInWithPassword()`
3. JWT token generated with business unit context
4. Session stored in HTTP-only cookies
5. API validates the application profile, resolves business-unit context once, then loads
   business-unit details, effective permissions, and role names in parallel
6. Landing page determined by effective permissions and role priority
7. Native permission/capability maps are built from that same request's permission result
8. Web establishes its Supabase session using the returned tokens and reuses the returned name fields;
   native mobile saves its returned session to secure storage
9. Client redirects to its existing destination
10. Web dashboard initialization reuses one verified server context and loads profile, permissions,
    and selected active business-unit membership concurrently. It seeds the matching permission
    cache and selected business-unit state; an unchanged JWT business-unit context is not refreshed.

The password authentication call, application-account validation, browser Supabase session
verification, permission RPC, role selection, cookies, and response fields are preserved. The login
API performs one `get_user_permissions` call per request. A failed permission lookup keeps landing
access denied (`/403`) and returns denied mobile permissions with an empty capability map. No
permission result is cached by the API across login requests or business units.

The core successful API path uses five outgoing Supabase requests when the token contains a
business-unit ID. Missing token context adds one membership lookup. Native mobile no longer repeats
the permission or membership query. The browser no longer repeats the API's profile query after
session verification. See [Login Performance](../guides/LOGIN-PERFORMANCE.md) for measurements and
reproduction commands.

#### Switching accounts in the same browser tab

Web and tablet sign-in replace the login history entry and refresh the Next.js router cache after
session establishment. Web user-menu and access-denied logout also refresh the router cache after
sign-out. Clearing React Query alone does not clear cached server-component layouts.

A dashboard snapshot belonging to a different user than the active browser account is withheld and
refetched before its page, permissions, or business-unit providers mount. The authenticated shell is
keyed by user ID so initialization resets for the new account. Auth hydration also rejects a
conflicting account snapshot, preventing an old layout from replacing the newer identity or token.
Fresh browser loads still hydrate from the verified server snapshot.

#### Sign-in Failure Guidance

Native mobile, web, tablet, and mobile-browser login screens show safe guidance rather than provider
messages, database details, or proxy text such as `Internal Server Error`. English and Chinese
messages share the `loginErrors` namespace in `src/lib/i18n/translations.ts`. The native app uses
English, matching its current interface language.

`POST /api/auth/login` returns `{ message: string, code: string }` on failure. Clients select the
translated guidance by the allowlisted code; they do not display arbitrary response messages.

| Code                        | HTTP status | User guidance                                                     |
| --------------------------- | ----------- | ----------------------------------------------------------------- |
| `LOGIN_INVALID_INPUT`       | 400         | Enter an email address and password.                              |
| `LOGIN_INVALID_CREDENTIALS` | 401         | Check the email and password, then retry.                         |
| `LOGIN_EMAIL_NOT_CONFIRMED` | 403         | Confirm the email or contact the administrator.                   |
| `LOGIN_ACCOUNT_UNAVAILABLE` | 403         | Contact the administrator about account access.                   |
| `LOGIN_RATE_LIMITED`        | 429         | Wait a few minutes before retrying.                               |
| `LOGIN_UNAVAILABLE`         | 500 or 503  | Retry in a few minutes; contact the administrator if it persists. |

The shared native/web login request handles connection failures and a 20-second timeout with neutral
guidance: "We couldn't connect to the sign-in service. Please try again later." A failed request does
not establish whether the user's internet connection or the service is responsible, so the message
does not diagnose the cause. Plain-text or HTML proxy failures and malformed responses also use safe
service guidance. Requests are not automatically retried. Forms preserve credentials after failure, clear
stale messages when the inputs change or another attempt starts, and prevent submission while busy.
The mobile-browser van-sales login also explains when a supervisor must assign a van warehouse.

Raw provider and profile-query failures are logged server-side by the login API. The existing
activity-logging wrapper continues to record attempts with password fields redacted.

#### Session Management

```typescript
// Location: middleware.ts

// Middleware runs on every request
export async function middleware(request: NextRequest) {
  // 1. Refresh session if needed
  // 2. Validate JWT token
  // 3. Handle session invalidation
  // 4. Route protection
}
```

**Session Lifecycle**:

- **Storage**: HTTP-only cookies (secure)
- **Refresh**: Automatic via middleware
- **Expiry**: Managed by Supabase Auth
- **Invalidation**: Handled on token errors
- **Refresh-token rotation**: If middleware encounters a rotated or missing Supabase refresh token,
  it clears stale Supabase auth cookies and redirects protected pages to login with
  `session=invalid` instead of surfacing the Supabase Auth error as a production exception.
- **Web API authentication**: Browser API calls use Supabase auth cookies as the single server
  authentication source. They do not send a separate `Authorization` bearer token, avoiding stale
  in-memory JWTs competing with refreshed cookie sessions. Mobile clients continue to use bearer
  token authentication because they do not rely on browser cookies.

### 2. Permission System

#### Permission Hierarchy

```
User
  └─ User Roles (user_roles table)
      └─ Roles (roles table)
          └─ Role Permissions (role_permissions table)
              └─ Permissions (permissions table)
                  ├─ Resource Permissions (CRUD: view, create, edit, delete)
                  └─ Capabilities (granular UI/feature access)
```

#### Resources (73 total)

**Example Resources**:

- `items` - Product master data
- `warehouses` - Warehouse management
- `sales_orders` - Sales order documents
- `purchase_orders` - Purchase order documents
- `customers` - Customer master
- `suppliers` - Supplier master
- `journal_entries` - Accounting entries
- `reports` - Reporting features
- `analytics` - Dashboard widgets
- `activity_logs` - User activity log review

#### Seeded Operational Roles

The seed data includes operational roles for demo/local environments:

- `Cashier`: limited point-of-sale access with dashboard and inventory viewing.
- `Picker`: warehouse picking access for assigned pick lists, pick-list dashboard queues, item and warehouse lookup, location-stock visibility, and stock transaction review. The role enables `pick_lists.operation.view_only_assigned_pick_lists.view`, so list, detail, claim, and progress operations are limited to matching `pick_list_assignees` rows. Picker does not receive Stock Requests, create/delete, receiving, putaway, adjustment, transfer, admin, accounting, sales, user, role, or permission-management access.
- `Stockman`: warehouse operator access for assigned pick lists, delivery-note receiving, load-list receiving, GRN receiving start/save/submit operations, putaway, location management, transfers, stock requests, stock adjustments, stock transactions, and warehouse stock visibility. Stockman receives `stock_requests.edit`, `delivery_notes.edit`, and `pick_lists.edit`; enables the assigned-only pick-list scope; receives the granular delivery-note receiving capability, `load_lists.view`, `goods_receipt_notes.view`, and the granular GRN receiving operation capabilities; but does not receive broad purchasing workbench, GRN confirmation/delete, supplier, purchase order, purchase receipt, stock requisition, admin, accounting, sales, user, role, or permission-management access.

`pick_lists.operation.view_only_assigned_pick_lists.view` is a scope toggle layered on the parent Pick Lists permission. When enabled, pick-list reads and mutations require a current-user assignment. When disabled, the user can access all pick lists in the selected business unit allowed by their parent `view` or `edit` permission.

GRN receiving start/pause, save, and submit operations require `goods_receipt_notes.view` plus their documented granular capability. They do not require or implicitly grant broad `goods_receipt_notes.edit` access.

Final GRN confirmation requires `goods_receipt_notes.view` plus `goods_receipt_notes.operation.confirm_receiving.edit`. The capability is assigned to Admin and Super Admin by default, preserves access for existing non-warehouse roles that already had broad GRN edit access, and is not implicitly granted to Picker or Stockman. Confirming the GRN is the only supported way to mark its linked load list as received.

Adding or removing load-list stock-requisition links requires `load_lists.view` plus `load_lists.operation.link_stock_requisitions.edit`. Moving a confirmed load list into transit requires `load_lists.view` plus `load_lists.operation.mark_in_transit.edit`. Both capabilities preserve access for existing non-warehouse roles with broad load-list edit access and remain opt-in for Picker and Stockman.

Marking an in-transit load list as arrived requires `load_lists.view` plus `load_lists.operation.mark_arrived.edit`. Stockman receives this capability by default; Picker does not. The permission is evaluated in the user's current business unit, and the operation accepts either the load list's source business unit or the business unit that owns its target warehouse. The target-business-unit view is otherwise read-only. The arrival transition and linked GRN creation remain one atomic operation.

The role-permission editor preserves these least-privilege dependencies. Enabling a GRN receiving or load-list operation capability automatically enables its parent module's `view` action without granting broad parent `edit` access. Capabilities for operations that require parent `edit`, such as delivery-note receiving, customer special-price management, and warehouse floor-map management, continue to enable and require that parent action.

Every module action depends on `view`. Enabling `create`, `edit`, or `delete` in the role-permission editor automatically enables `view`; disabling `view` clears the module's other actions and all granular children. Saving the complete role-permission configuration is transactional, and the server rejects assignments where another module action lacks `view` or a granular capability lacks parent-module `view`. Removing a parent permission also removes its granular children in the same transaction.

The web client loads one granular-capability snapshot for the authenticated user and active business unit. All screens share that BU-scoped React Query entry and derive only their required capability/action flags locally; pages do not send capability catalogs in query parameters or perform one request per control. Business-unit switches, role assignments, and permission changes invalidate the snapshot. This client cache controls presentation only—protected APIs continue to resolve and enforce permissions server-side.

**Permission Types per Resource**:

- `view` - Read access
- `create` - Insert new records
- `edit` - Update existing records
- `delete` - Remove records

#### Capabilities (40+ total)

**Example Capabilities**:

- `view_dashboard_sales_widget` - Sales KPI widget visibility
- `view_dashboard_inventory_widget` - Inventory KPI visibility
- `view_item_cost_price` - See cost price in item details
- `edit_posted_invoices` - Edit invoices after posting
- `approve_purchase_orders` - PO approval rights
- `manage_locations` - Warehouse location management
- `warehouses.operation.manage_floor_map.edit` - Upload floor plans and edit rack mappings when
  Warehouse edit permission is also granted
- `view_customer_ledger` - Customer ledger access
- `export_reports` - Report export functionality

### 3. Permission Resolution

#### Permission Resolver Service

```typescript
// Location: src/services/permissions/permissionResolver.ts

class PermissionResolver {
  // Get all permissions for a user
  async getUserPermissions(userId: string): Promise<Permission[]>;

  // Check specific permission
  async hasPermission(
    userId: string,
    resource: string,
    action: "view" | "create" | "edit" | "delete"
  ): Promise<boolean>;

  // Check capability
  async hasCapability(userId: string, capability: string): Promise<boolean>;

  // Clear cache on role/permission changes
  clearCache(userId: string): void;
}
```

**Caching Strategy**:

- **In-memory cache** with 5-second TTL
- **Cache invalidation** on role/permission mutations
- **Per-user** cache isolation
- **Reduces database queries** by ~95%

### 4. API Route Protection

#### Permission Enforcement Pattern

```typescript
// Location: src/app/api/[module]/route.ts

import { requirePermission } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  // 1. Extract user from session (middleware ensures auth)
  const user = await getUser(request);

  // 2. Check permission
  await requirePermission(user.id, "resource_name", "view");

  // 3. Business logic
  const data = await fetchData();

  // 4. Return response
  return NextResponse.json(data);
}
```

**Permission Check Locations**:

- **Every API route** has permission checks
- **Middleware** handles authentication
- **Service layer** handles business logic
- **Database RLS** provides final safety layer

### 5. UI Component Protection

#### Component Permission Hooks

```typescript
// Location: src/hooks/usePermissions.ts

const {
  canView,    // Check view permission
  canCreate,  // Check create permission
  canEdit,    // Check edit permission
  canDelete,  // Check delete permission
  hasCapability  // Check capability
} = usePermissions('resource_name')

// Usage in components
{canCreate && <CreateButton />}
{canEdit(item.id) && <EditButton />}
{hasCapability('view_item_cost_price') && <CostPriceField />}
```

### 6. Business Unit Context

#### Multi-Tenant Scoping

```typescript
// Location: src/stores/businessUnitStore.ts

const businessUnitStore = create<BusinessUnitStore>((set) => ({
  currentBusinessUnit: null,
  setBusinessUnit: (bu) => set({ currentBusinessUnit: bu }),
  clearBusinessUnit: () => set({ currentBusinessUnit: null }),
}));
```

**Business Unit Access**:

- Users can access **multiple business units**
- Stored in `user_business_unit_access` table
- Assigning a BU-scoped role atomically grants access to that business unit
- Removing one of several roles keeps access; removing the final role atomically revokes access
- If the revoked business unit was current or default, another accessible business unit becomes the
  replacement; users with no remaining BU roles have no business unit access
- **Context switching** via UI selector
- **JWT token** includes business unit context
- **RLS policies** enforce data isolation

## Database Schema

### Core Tables

#### users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  company_id UUID REFERENCES companies(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### roles

```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR UNIQUE NOT NULL,
  description TEXT,
  landing_page VARCHAR,  -- Default landing page for role
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### permissions

```sql
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource VARCHAR NOT NULL,           -- Resource name (e.g., 'items', 'sales_orders')
  action VARCHAR NOT NULL,              -- Action type ('view', 'create', 'edit', 'delete')
  capability VARCHAR,                   -- Optional capability name
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(resource, action)
);
```

#### role_permissions

```sql
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role_id, permission_id)
);
```

#### user_roles

```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,  -- Primary role determines landing page
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role_id)
);
```

#### business_units

```sql
CREATE TABLE business_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  name VARCHAR NOT NULL,
  code VARCHAR,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### user_business_unit_access

```sql
CREATE TABLE user_business_unit_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  business_unit_id UUID REFERENCES business_units(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, business_unit_id)
);
```

## API Reference

### Authentication Endpoints

#### POST /api/auth/login

Login with email and password.

**Request**:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response**:

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "companyId": "uuid"
  },
  "token": "jwt-access-token",
  "refreshToken": "refresh-token",
  "currentBusinessUnit": {
    "id": "uuid",
    "code": "MAIN",
    "name": "Main"
  },
  "landingPage": "/dashboard"
}
```

Mobile clients that send `X-Client-Source: mobile` also receive a strict session cookie header for
manual replay plus permission maps for current-business-unit UI gating because native fetch must not
rely on the platform cookie jar:

```json
{
  "cookieHeader": "sb-project-auth-token=...",
  "permissions": {
    "load_lists": {
      "can_view": true,
      "can_create": false,
      "can_edit": false,
      "can_delete": false
    }
  },
  "capabilities": {
    "goods_receipt_notes.operation.start_receiving.edit": {
      "can_view": false,
      "can_create": false,
      "can_edit": true,
      "can_delete": false
    },
    "goods_receipt_notes.operation.save_receiving.edit": {
      "can_view": false,
      "can_create": false,
      "can_edit": true,
      "can_delete": false
    }
  }
}
```

The same mobile-only contract applies to `POST /api/business-units/set-context`; browser callers
receive refreshed tokens through the normal response body/cookie flow, while mobile callers receive
the refreshed `cookieHeader`, `permissions`, and `capabilities` for the selected business unit.

#### POST /api/auth/logout

End user session.

**Response**:

```json
{
  "message": "Logged out successfully"
}
```

Browser logout continues to use the existing `supabase.auth.signOut()` call and its default scope.
Before signing out, the auth store marks logout in progress, unmounts protected dashboard consumers,
pauses authenticated reads and realtime invalidation, and cancels pending React Query reads. The
business-unit, permissions, notifications, and warehouse-dashboard reads pass their cancellation
signals to `fetch`; the preferences provider separately aborts its read on logout or account change.
Business-unit, permission, and query caches are then cleared, including when sign-out throws, and
the web menu replaces the current history entry with `/login`.

Dashboard authentication initializes once from the verified server session. Intentional logout
blocks stale server hydration, and auth checks started before logout cannot restore the old user.
Existing API profile fields and role are retained when the server initializes the same user. A new
successful login clears the intentional-logout marker. API authentication, permissions, RLS,
business-unit scope, and sign-out scope are unchanged.

#### GET /api/auth/me

Get current authenticated user.

**Response**:

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "company_id": "uuid",
  "roles": ["Sales Manager", "Warehouse User"],
  "permissions": [...]
}
```

#### POST /api/auth/refresh

Refresh access token.

**Response**:

```json
{
  "session": { ... }
}
```

#### POST /api/auth/verify-admin-pin

Verify admin PIN for sensitive operations.

**Request**:

```json
{
  "pin": "1234"
}
```

**Response**:

```json
{
  "verified": true
}
```

### RBAC Management Endpoints

#### GET /api/rbac/roles

List all roles.

**Permissions**: `view` on `roles` resource

**Response**:

```json
{
  "roles": [
    {
      "id": "uuid",
      "name": "Sales Manager",
      "description": "Manage sales operations",
      "landing_page": "/dashboard/sales",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

#### POST /api/rbac/roles

Create a new role.

**Permissions**: `create` on `roles` resource

**Request**:

```json
{
  "name": "Warehouse Manager",
  "description": "Manage warehouse operations",
  "landing_page": "/dashboard/inventory",
  "permissions": ["permission_id_1", "permission_id_2"]
}
```

#### GET /api/rbac/permissions

List all permissions.

**Permissions**: `view` on `permissions` resource

**Response**:

```json
{
  "permissions": [
    {
      "id": "uuid",
      "resource": "items",
      "action": "view",
      "capability": null,
      "description": "View items"
    }
  ]
}
```

#### POST /api/rbac/users/[id]/roles

Assign roles to a user.

**Permissions**: `edit` on `users` resource

**Request**:

```json
{
  "role_ids": ["uuid1", "uuid2"],
  "primary_role_id": "uuid1"
}
```

#### GET /api/rbac/users/[id]/permissions

Get aggregated permissions for a user.

**Permissions**: `view` on `users` resource

**Response**:

```json
{
  "permissions": [
    {
      "resource": "items",
      "actions": ["view", "create", "edit"],
      "capabilities": ["view_item_cost_price"]
    }
  ]
}
```

## State Management

### Auth Store

```typescript
// Location: src/stores/authStore.ts

interface AuthStore {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  setSession: (session: Session) => void;
  logout: () => void;
}
```

### Permission Store

```typescript
// Location: src/stores/permissionStore.ts

interface PermissionStore {
  permissions: Permission[];
  capabilities: string[];
  setPermissions: (permissions: Permission[]) => void;
  clearPermissions: () => void;
  hasPermission: (resource: string, action: string) => boolean;
  hasCapability: (capability: string) => boolean;
}
```

### Business Unit Store

```typescript
// Location: src/stores/businessUnitStore.ts

interface BusinessUnitStore {
  currentBusinessUnit: BusinessUnit | null;
  availableBusinessUnits: BusinessUnit[];
  setBusinessUnit: (bu: BusinessUnit) => void;
  setAvailableBusinessUnits: (units: BusinessUnit[]) => void;
}
```

## Common Patterns

### Pattern 1: Protected API Route

```typescript
export async function GET(request: NextRequest) {
  const user = await getUser(request);
  await requirePermission(user.id, "resource_name", "view");

  const data = await supabase.from("table").select("*").eq("company_id", user.company_id);

  return NextResponse.json(data);
}
```

### Pattern 2: Conditional UI Rendering

```typescript
function ItemList() {
  const { canView, canCreate, canEdit, canDelete, hasCapability } =
    usePermissions('items')

  if (!canView) return <PermissionDenied />

  return (
    <div>
      {canCreate && <CreateItemButton />}
      <ItemTable
        onEdit={canEdit ? handleEdit : undefined}
        onDelete={canDelete ? handleDelete : undefined}
        showCostPrice={hasCapability('view_item_cost_price')}
      />
    </div>
  )
}
```

### Pattern 3: Business Unit Scoping

```typescript
const { currentBusinessUnit } = useBusinessUnitStore();

const { data: items } = useQuery({
  queryKey: ["items", currentBusinessUnit?.id],
  queryFn: async () => {
    const response = await fetch("/api/items", {
      headers: {
        "X-Business-Unit": currentBusinessUnit?.id || "",
      },
    });
    return response.json();
  },
  enabled: !!currentBusinessUnit,
});
```

## Security Considerations

### Authentication Security

- **HTTP-only cookies** prevent XSS attacks
- **Secure flag** ensures HTTPS-only transmission
- **Short token lifetime** with auto-refresh
- **Session invalidation** on suspicious activity

### Authorization Security

- **Defense in depth**: Middleware + API + RLS
- **Least privilege**: Default deny, explicit grants
- **Regular audits**: Permission cache expiry
- **Separation of duties**: Different roles for different operations

### Data Security

- **RLS policies** enforce company isolation
- **Business unit scoping** in JWT token
- **Encrypted passwords** via Supabase Auth
- **Audit logging** for sensitive operations

## Troubleshooting

### Common Issues

#### Issue: Permission denied errors

**Symptoms**: API returns 403, user cannot access features
**Solution**:

1. Check user roles: `SELECT * FROM user_roles WHERE user_id = 'uuid'`
2. Check role permissions: `SELECT * FROM role_permissions WHERE role_id = 'uuid'`
3. Clear permission cache
4. Verify RLS policies

#### Issue: Login reports "Failed to load user profile" after a local reset

**Symptoms**: `POST /api/auth/login` returns 500 after authentication succeeds, and PostgREST logs
error `42501` for `public.users`.

**Solution**:

1. Apply the complete local migration chain with `supabase db reset`.
2. Confirm `20260904120000_restore_data_api_table_privileges.sql` was applied.
3. Retry login with a seeded account.

The privilege migration restores authenticated operations only where an existing RLS policy allows
that operation. It also grants read-only access to the business-unit tables required during login.
Do not resolve this failure by disabling RLS or by using the service-role credential in the login
handler.

#### Issue: Session expired frequently

**Symptoms**: User redirected to login often
**Solution**:

1. Check Supabase Auth settings
2. Verify middleware token refresh logic
3. Check for clock skew on server

#### Issue: Landing page incorrect

**Symptoms**: User lands on wrong page after login
**Solution**:

1. Check primary role: `SELECT * FROM user_roles WHERE user_id = 'uuid' AND is_primary = true`
2. Verify role's landing_page field
3. Check login API response

## Testing

### Unit Tests

```typescript
describe("PermissionResolver", () => {
  it("should resolve user permissions correctly", async () => {
    const permissions = await resolver.getUserPermissions("user-id");
    expect(permissions).toContain({ resource: "items", action: "view" });
  });

  it("should cache permissions", async () => {
    await resolver.getUserPermissions("user-id");
    await resolver.getUserPermissions("user-id");
    expect(mockDb).toHaveBeenCalledTimes(1);
  });
});
```

### Integration Tests

```typescript
describe("POST /api/auth/login", () => {
  it("should login successfully with valid credentials", async () => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "test@example.com",
        password: "password123",
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user).toBeDefined();
    expect(data.session).toBeDefined();
  });
});
```

## Related Documentation

- **Granular Permissions Rule**: `docs/rules/granular-permissions-rule.md`
- **RBAC Implementation Plan**: `docs/plans/rbac-implementation-plan.md`
- **Multi-Business Unit Plan**: `docs/plans/multi-business-unit-implementation-plan.md`
- **API Design Rule**: `docs/rules/scalable-api-design-rule.md`

## Migration History

Key migrations related to authentication and authorization:

- `20240101000000_create_users_and_roles.sql` - Initial user/role tables
- `20240115000000_add_permissions_system.sql` - Permission tables
- `20240201000000_add_capabilities.sql` - Granular capabilities
- `20240301000000_add_business_units.sql` - Multi-tenant support
- `20240315000000_add_user_business_unit_access.sql` - BU access control
- `20260904120000_restore_data_api_table_privileges.sql` - RLS-aligned Data API table privileges
