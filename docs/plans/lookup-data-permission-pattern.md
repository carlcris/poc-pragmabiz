# Lookup/Reference Data Permission Pattern - Implementation Plan

## Problem Statement

**Current Issue**: Cashier role needs POS permission but POS page requires fetching items, customers, and other lookup data. When "items" permission is removed from Cashier, the POS page throws 403 errors.

**Root Cause**: Transactional features (POS, Sales Orders, etc.) depend on reference/lookup data (items, customers, suppliers, etc.) but users shouldn't need full CRUD permissions on these resources just to use them in transactions.

**Example Scenarios**:
- Cashier needs to VIEW items to sell them, but shouldn't MANAGE the item master
- Sales person needs to VIEW customers to create orders, but shouldn't DELETE customers
- Van sales needs to VIEW items and customers, but shouldn't EDIT inventory

---

## Architectural Solution: Lookup Data Access Pattern

### Core Principle

**"Transactional permissions implicitly grant READ-ONLY access to their required lookup data"**

### Design Pattern

Create a **configurable, reusable permission pattern** where:
1. Certain resources are designated as "lookup/reference data"
2. Other resources can declare which lookup data they depend on
3. API endpoints automatically check for EITHER direct permission OR dependent feature permission

---

## Implementation Architecture

### 1. Lookup Data Configuration

**File**: `/app/src/config/lookupDataPermissions.ts`

```typescript
/**
 * Defines which resources are lookup/reference data
 * and which transactional features can access them
 */

export type LookupResource =
  | 'items'
  | 'customers'
  | 'suppliers'
  | 'warehouses'
  | 'item_categories'
  | 'employees';

export type TransactionalResource =
  | 'pos'
  | 'van_sales'
  | 'sales_orders'
  | 'sales_quotations'
  | 'sales_invoices'
  | 'purchase_orders'
  | 'purchase_receipts'
  | 'stock_transfers'
  | 'stock_adjustments';

/**
 * Maps transactional features to their required lookup data
 *
 * Logic: If user has permission for the transactional feature,
 * they automatically get READ-ONLY access to the lookup data
 */
export const LOOKUP_DATA_ACCESS_MAP: Record<TransactionalResource, LookupResource[]> = {
  // POS Operations
  pos: [
    'items',           // Need to see items for sale
    'customers',       // Need to select customers
    'item_categories', // Need for item filtering
  ],

  // Van Sales
  van_sales: [
    'items',
    'customers',
    'warehouses',      // Need to know van warehouse
    'item_categories',
  ],

  // Sales Orders
  sales_orders: [
    'items',
    'customers',
    'employees',       // Need for sales rep assignment
    'item_categories',
  ],

  // Sales Quotations
  sales_quotations: [
    'items',
    'customers',
    'employees',
    'item_categories',
  ],

  // Sales Invoices
  sales_invoices: [
    'items',
    'customers',
    'employees',
    'item_categories',
  ],

  // Purchase Orders
  purchase_orders: [
    'items',
    'suppliers',       // Need to select suppliers
    'warehouses',      // Need to specify delivery warehouse
    'item_categories',
  ],

  // Purchase Receipts
  purchase_receipts: [
    'items',
    'suppliers',
    'warehouses',
    'item_categories',
  ],

  // Stock Transfers
  stock_transfers: [
    'items',
    'warehouses',      // Need source and destination warehouses
    'item_categories',
  ],

  // Stock Adjustments
  stock_adjustments: [
    'items',
    'warehouses',
    'item_categories',
  ],
};

/**
 * Get all transactional features that can access a lookup resource
 */
export function getAccessorsForLookupData(lookupResource: LookupResource): TransactionalResource[] {
  return Object.entries(LOOKUP_DATA_ACCESS_MAP)
    .filter(([_, lookups]) => lookups.includes(lookupResource))
    .map(([feature]) => feature as TransactionalResource);
}
```

### 2. Enhanced Permission Helper

**File**: `/app/src/lib/auth/requirePermission.ts`

```typescript
import { LOOKUP_DATA_ACCESS_MAP, type LookupResource } from '@/config/lookupDataPermissions';

/**
 * Check if user can access lookup data
 *
 * Returns true if user has EITHER:
 * 1. Direct permission to the lookup resource (can_view), OR
 * 2. Permission to any transactional feature that depends on it
 */
export async function requireLookupDataAccess(
  request: NextRequest,
  lookupResource: LookupResource
): Promise<NextResponse | null> {
  // First, check if user has direct view permission
  const hasDirectPermission = await checkPermission(request, lookupResource, 'view');
  if (hasDirectPermission) return null; // Authorized

  // Check if user has any transactional feature permission that grants access
  const accessors = getAccessorsForLookupData(lookupResource);

  for (const accessor of accessors) {
    const hasFeaturePermission = await checkPermission(request, accessor, 'view');
    if (hasFeaturePermission) {
      // User has permission via transactional feature
      return null; // Authorized
    }
  }

  // No permission found
  return NextResponse.json(
    {
      error: 'Forbidden',
      message: `You need either '${lookupResource}' view permission or permission for a feature that uses this data (${accessors.join(', ')})`
    },
    { status: 403 }
  );
}
```

---

## Progressive Rollout Plan

### Phase 1: Infrastructure Setup ✅ (No Breaking Changes)
**Goal**: Create the foundation without touching existing APIs

**Tasks**:
1. ✅ Create `/app/src/config/lookupDataPermissions.ts` configuration file
2. ✅ Add `requireLookupDataAccess()` helper to `/app/src/lib/auth/requirePermission.ts`
3. ✅ Add `getAccessorsForLookupData()` utility function
4. ✅ Write unit tests for the configuration and helpers
5. ✅ Document the pattern in RBAC documentation

**Validation**: Run existing tests - everything should still work

---

### Phase 2: Pilot Implementation (Items API)
**Goal**: Implement pattern on ONE critical API and validate

**Tasks**:
1. Update `/app/src/app/api/items/route.ts` GET endpoint
   - Replace current permission check with `requireLookupDataAccess()`
   - Add comment explaining the pattern

2. Test scenarios:
   - ✅ User with 'items' permission → Still works
   - ✅ User with 'pos' permission (no items) → Now works (read-only)
   - ✅ User with neither → Still gets 403
   - ✅ Verify POST/PUT/DELETE still require direct 'items' permission

3. Monitor production logs for 403 errors

**Rollback Plan**: Revert single file if issues detected

---

### Phase 3: Core Lookup APIs (Batch 1)
**Goal**: Roll out to most critical lookup data

**APIs to Update**:
1. `/app/src/app/api/customers/route.ts` (GET)
2. `/app/src/app/api/suppliers/route.ts` (GET)
3. `/app/src/app/api/warehouses/route.ts` (GET)
4. `/app/src/app/api/item-categories/route.ts` (GET)

**Validation After Each API**:
- Test POS page → Should work with only 'pos' permission
- Test Sales Orders → Should work with only 'sales_orders' permission
- Test Van Sales → Should work with only 'van_sales' permission

**Timeline**: 1 API per day with monitoring

---

### Phase 4: Secondary Lookup APIs (Batch 2)
**Goal**: Complete rollout to all lookup data

**APIs to Update**:
1. `/app/src/app/api/employees/route.ts` (GET)
2. `/app/src/app/api/items/[id]/route.ts` (GET)
3. `/app/src/app/api/customers/[id]/route.ts` (GET)
4. `/app/src/app/api/suppliers/[id]/route.ts` (GET)
5. `/app/src/app/api/warehouses/[id]/route.ts` (GET)

**Validation**: Full regression testing on all transactional features

---

### Phase 5: Enhanced Endpoints (Optional)
**Goal**: Apply pattern to enhanced/specialized endpoints

**APIs to Consider**:
- `/app/src/app/api/items-enhanced/route.ts`
- `/app/src/app/api/warehouses/[id]/inventory/route.ts`
- Item variants, pricing, packaging endpoints

---

## Testing Strategy

### Unit Tests
```typescript
describe('Lookup Data Permission Pattern', () => {
  test('User with direct permission can access', async () => {
    // Mock user with 'items' view permission
    // Call requireLookupDataAccess('items')
    // Expect: null (authorized)
  });

  test('User with transactional permission can access', async () => {
    // Mock user with 'pos' view permission (no items)
    // Call requireLookupDataAccess('items')
    // Expect: null (authorized via POS)
  });

  test('User with no permission is denied', async () => {
    // Mock user with no relevant permissions
    // Call requireLookupDataAccess('items')
    // Expect: 403 response
  });

  test('Configuration covers all lookup resources', () => {
    // Verify every lookup resource has at least one accessor
  });
});
```

### Integration Tests
```typescript
describe('Items API with Lookup Pattern', () => {
  test('GET with items permission', async () => {
    // Create user with 'items' view
    // Call GET /api/items
    // Expect: 200 with data
  });

  test('GET with POS permission', async () => {
    // Create user with 'pos' view (no items)
    // Call GET /api/items
    // Expect: 200 with data
  });

  test('POST still requires items create', async () => {
    // Create user with 'pos' view (no items)
    // Call POST /api/items
    // Expect: 403 (POS doesn't grant create)
  });
});
```

### E2E Tests
1. **POS Flow**: Login as Cashier → Open POS → Verify items load → Complete sale
2. **Sales Order Flow**: Login as Sales Rep → Create order → Verify items/customers load
3. **Van Sales Flow**: Login as Van Sales → View inventory → Complete sale

---

## Migration Matrix

### Lookup Data Resources
| Resource | Current Permission Required | After Implementation | Affected Features |
|----------|----------------------------|----------------------|-------------------|
| Items | `items.view` | `items.view` OR `pos.view` OR `van_sales.view` OR `sales_orders.view` OR `purchase_orders.view` | POS, Van Sales, Sales, Purchasing |
| Customers | `customers.view` | `customers.view` OR `pos.view` OR `van_sales.view` OR `sales_orders.view` | POS, Van Sales, Sales |
| Suppliers | `suppliers.view` | `suppliers.view` OR `purchase_orders.view` OR `purchase_receipts.view` | Purchasing |
| Warehouses | `warehouses.view` | `warehouses.view` OR `stock_transfers.view` OR `purchase_orders.view` | Inventory, Purchasing |
| Item Categories | `item_categories.view` | `item_categories.view` OR `pos.view` OR `sales_orders.view` | POS, Sales |
| Employees | `employees.view` | `employees.view` OR `sales_orders.view` | Sales |

---

## Security Considerations

### ✅ What This Pattern DOES Allow
- **Read-only** access to lookup data when user has relevant transactional permission
- Viewing items in a dropdown/list for creating orders
- Selecting customers in POS
- Browsing warehouse list for transfers

### ❌ What This Pattern DOES NOT Allow
- **Creating** new items/customers/suppliers (still requires direct permission)
- **Editing** master data (still requires direct permission)
- **Deleting** records (still requires direct permission)
- Accessing administrative pages (still requires direct permission)

### Audit Trail
All access is still logged with the actual permission that granted access:
```json
{
  "user_id": "xyz",
  "resource": "items",
  "action": "view",
  "granted_via": "pos.view",
  "timestamp": "2025-01-01T12:00:00Z"
}
```

---

## Rollback Plan

### If Critical Issue Found

1. **Immediate**: Revert affected API file(s) to previous version
2. **Within 1 hour**: Deploy rollback
3. **Root cause analysis**: Identify what went wrong
4. **Fix and re-test**: Address issue in development
5. **Re-deploy**: Follow progressive rollout again

### Rollback Decision Criteria
- 403 errors spike > 5% compared to baseline
- Any feature completely broken
- Data security concern identified
- Performance degradation > 20%

---

## Success Metrics

### Technical Metrics
- ✅ Zero 403 errors for users with valid transactional permissions
- ✅ No increase in API response times (< 5ms overhead)
- ✅ 100% test coverage for new pattern
- ✅ Zero security vulnerabilities introduced

### Business Metrics
- ✅ Cashier can use POS without item management permissions
- ✅ Sales reps can create orders without customer management permissions
- ✅ Van sales can operate without full inventory permissions
- ✅ Reduced support tickets about permission issues

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Infrastructure | 2 hours | None |
| Phase 2: Pilot (Items API) | 4 hours | Phase 1 |
| Phase 3: Core APIs (Batch 1) | 1 week | Phase 2 validated |
| Phase 4: Secondary APIs (Batch 2) | 1 week | Phase 3 validated |
| Phase 5: Enhanced Endpoints | 3 days | Phase 4 validated |
| **Total** | **~3 weeks** | Progressive with validation |

---

## Documentation Updates Required

1. **RBAC Implementation Plan** (`/docs/plans/rbac-implementation-plan.md`)
   - Add new section: "Lookup Data Access Pattern"
   - Update Phase 3 with this approach

2. **Developer Guide** (New: `/docs/guides/lookup-data-permissions.md`)
   - How to use `requireLookupDataAccess()`
   - How to add new lookup resources
   - How to configure dependencies

3. **API Documentation**
   - Update each affected endpoint
   - Note which permissions grant access
   - Explain lookup data pattern

---

## Alternative Approaches Considered

### ❌ Option A: Give All Roles All Lookup Permissions
**Why Rejected**: Violates principle of least privilege, users can access admin pages

### ❌ Option B: Create Duplicate "View-Only" Permissions
**Why Rejected**: Permission explosion (items_view, pos_items_view, sales_items_view...), complex to manage

### ❌ Option C: Hardcode POS → Items Check
**Why Rejected**: Not reusable, becomes spaghetti code with many hardcoded rules

### ✅ Option D: Configurable Lookup Data Pattern (CHOSEN)
**Why Chosen**: Reusable, maintainable, explicit, scalable, follows DRY principle

---

## Review Checklist

Before implementation:
- [ ] Configuration covers all necessary lookup resources
- [ ] All transactional features mapped to their dependencies
- [ ] Security implications reviewed and approved
- [ ] Testing strategy covers all scenarios
- [ ] Rollout plan includes monitoring and rollback
- [ ] Documentation plan is complete
- [ ] Team has reviewed and approved approach

---

## Next Steps

1. **Review this plan** with team and get approval
2. **Create Phase 1 tasks** in project management tool
3. **Schedule kick-off meeting** to assign responsibilities
4. **Begin implementation** following progressive rollout plan
