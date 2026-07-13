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
  session: Session,
  landing_page?: string  // Role-based landing page
}
```

**Flow**:

1. User submits credentials
2. API calls `supabase.auth.signInWithPassword()`
3. JWT token generated with business unit context
4. Session stored in HTTP-only cookies
5. Landing page determined by user's primary role
6. Client redirects to landing page

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
- `Picker`: warehouse picking access for assigned pick lists, pick-list dashboard queues, item and warehouse lookup, location-stock visibility, stock request picking actions, and stock transaction review. The role enables `stock_requests.operation.view_only_assigned_pick_lists.view`, so list, detail, claim, and progress operations are limited to matching `pick_list_assignees` rows. Picker does not receive create/delete, receiving, putaway, adjustment, transfer, admin, accounting, sales, user, role, or permission-management access.
- `Stockman`: warehouse operator access for assigned pick lists, delivery-note receiving, load-list receiving, GRN receiving start/save/submit operations, putaway, location management, transfers, stock requests, stock adjustments, stock transactions, and warehouse stock visibility. Stockman receives `stock_requests.edit`, enables the assigned-only pick-list scope, receives the granular delivery-note receiving capability, `load_lists.view`, `goods_receipt_notes.view`, and the granular GRN receiving operation capabilities, but does not receive broad purchasing workbench, GRN confirmation/delete, supplier, purchase order, purchase receipt, stock requisition, admin, accounting, sales, user, role, or permission-management access.

`stock_requests.operation.view_only_assigned_pick_lists.view` is a scope toggle layered on the parent Stock Requests permission. When enabled, pick-list reads and mutations require a current-user assignment. When disabled, the user can access all pick lists in the selected business unit allowed by their parent `view` or `edit` permission.

GRN receiving start/pause, save, and submit operations require `goods_receipt_notes.view` plus their documented granular capability. They do not require or implicitly grant broad `goods_receipt_notes.edit` access.

Final GRN confirmation requires `goods_receipt_notes.view` plus `goods_receipt_notes.operation.confirm_receiving.edit`. The capability is assigned to Admin and Super Admin by default, preserves access for existing non-warehouse roles that already had broad GRN edit access, and is not implicitly granted to Picker or Stockman. Confirming the GRN is the only supported way to mark its linked load list as received.

Adding or removing load-list stock-requisition links requires `load_lists.view` plus `load_lists.operation.link_stock_requisitions.edit`. Moving a confirmed load list into transit requires `load_lists.view` plus `load_lists.operation.mark_in_transit.edit`. Both capabilities preserve access for existing non-warehouse roles with broad load-list edit access and remain opt-in for Picker and Stockman.

Marking an in-transit load list as arrived requires `load_lists.view` plus `load_lists.operation.mark_arrived.edit`. Stockman receives this capability by default; Picker does not. The permission is evaluated in the user's current business unit, and the operation accepts either the load list's source business unit or the business unit that owns its target warehouse. The target-business-unit view is otherwise read-only. The arrival transition and linked GRN creation remain one atomic operation.

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
