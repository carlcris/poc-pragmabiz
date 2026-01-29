# Tablet Warehouse App - Implementation Plan

## Project Overview
Build a tablet-first browser application for warehouse operations following the same architectural patterns as the Mobile Van Sales app.

**Target URL**: `/tablet/*`
**User Roles**: Super Admin (for MVP)
**Scope**: Receiving (Purchase Receipts) + Picking (Stock Requests)

---

## Architecture Decisions

### 1. Routing Structure
```
/tablet
├── /login              - Authentication (reuse mobile login pattern)
├── /receiving          - Purchase receipt operations
│   ├── page.tsx        - Receipt list (Open, In Progress)
│   └── /[receiptId]    - Receipt detail & receiving interface
├── /picking            - Stock request operations
│   ├── page.tsx        - Request list (tabs: Submitted/Approved, Ready, Picking, Picked)
│   └── /[requestId]    - Request detail & picking interface
└── layout.tsx          - Tablet layout (max-w-2xl, bottom nav)
```

### 2. Status Model Updates

**Purchase Receipts** (existing):
- `draft` - Created but not confirmed
- `received` - Confirmed (inventory updated)
- `cancelled` - Cancelled

**Stock Requests** (new statuses to add):
- `draft` - Initial (existing)
- `submitted` - Awaiting approval (existing)
- `approved` - Approved for picking (existing)
- `ready_for_pick` - **NEW** - Assigned to picker, ready to pick
- `picking` - **NEW** - Picker is actively picking
- `picked` - **NEW** - Picking complete, ready for handoff
- `delivered` - **NEW** - Delivered to requester
- `completed` - Final state (existing)
- `cancelled` - Cancelled (existing)

**Note**: Need database migration to add new status values and update check constraint.

### 3. Component Patterns (from Mobile Van Sales)

**Reuse Pattern**:
- `MobileHeader` → `TabletHeader` (with warehouse context)
- `BottomNav` → `TabletBottomNav` (Receiving | Dashboard | Picking)
- Card-based list views with touch-friendly targets
- Dialog-based forms for actions
- Skeleton loaders for data fetching
- Status badges and color coding

**New Components**:
- `ReceivingCard` - Purchase receipt list item
- `ReceiptDetailCard` - Receipt header info
- `ReceiveLineItem` - Line item with quantity stepper
- `PickingCard` - Stock request list item
- `PickRequestCard` - Pick request header
- `PickLineItem` - Line item with pick quantity input
- `QuantityStepper` - Large touch-friendly +/- control

---

## Database Schema Changes

### 1. Stock Request Status Migration

**File**: `supabase/migrations/VVVVV_add_stock_request_statuses.sql`

```sql
-- Add new statuses to stock_requests
ALTER TABLE stock_requests DROP CONSTRAINT IF EXISTS check_stock_request_status;
ALTER TABLE stock_requests ADD CONSTRAINT check_stock_request_status
  CHECK (status IN (
    'draft', 'submitted', 'approved', 'ready_for_pick',
    'picking', 'picked', 'delivered', 'completed', 'cancelled'
  ));

-- Add picker tracking fields
ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS picking_started_at TIMESTAMP;
ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS picking_started_by UUID REFERENCES users(id);
ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;
ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS delivered_by UUID REFERENCES users(id);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_stock_requests_picking_status
  ON stock_requests(status) WHERE status IN ('ready_for_pick', 'picking');
```

### 2. Purchase Receipt Enhancements (if needed)

Check if these fields exist:
- `receiving_started_at` - Track when receiving began
- `receiving_started_by` - User who started receiving
- `partially_received` status support

---

## API Routes to Create

### Receiving Module

**GET /api/tablet/purchase-receipts**
- Query params: status, warehouse_id, date_from, date_to
- Returns: List of purchase receipts with:
  - Receipt header info
  - Supplier name
  - Item count
  - Expected vs received quantities summary
  - Status

**GET /api/tablet/purchase-receipts/[receiptId]**
- Returns: Complete receipt with line items
  - Header: supplier, warehouse, dates, status
  - Items: item details, expected qty, received qty, UOM, packaging

**POST /api/tablet/purchase-receipts/[receiptId]/start-receiving**
- Updates status to `in_progress`
- Records `receiving_started_by` and `receiving_started_at`
- Returns: Updated receipt

**POST /api/tablet/purchase-receipts/[receiptId]/receive-all**
- Auto-fills all line items with expected quantities
- Returns: Updated receipt items

**PATCH /api/tablet/purchase-receipts/[receiptId]/items/[itemId]**
- Updates received_qty for a line item
- Validates: received_qty <= quantity_ordered
- Returns: Updated item

**POST /api/tablet/purchase-receipts/[receiptId]/post**
- Validates all items have received_qty
- Updates status to `received`
- Creates stock_transactions (type: 'in')
- Updates item_warehouse balances
- Updates purchase_order_items.quantity_received
- Triggers PO status update (partially_received/received)
- Returns: Posted receipt with transaction IDs

### Picking Module

**GET /api/tablet/stock-requests**
- Query params: status, priority, date_from, date_to, warehouse_id
- Returns: List of stock requests filtered by status tabs
  - Request info, source/dest, priority, item count, status

**GET /api/tablet/stock-requests/[requestId]**
- Returns: Complete request with line items
  - Header: requester, warehouses, priority, dates
  - Items: item details, requested qty, available stock, picked qty, UOM, packaging
  - Current stock levels from item_warehouse

**POST /api/tablet/stock-requests/[requestId]/start-picking**
- Updates status to `picking`
- Records `picking_started_by` and `picking_started_at`
- Validates: Only one picker can pick at a time
- Returns: Updated request

**PATCH /api/tablet/stock-requests/[requestId]/items/[itemId]**
- Updates picked_qty for a line item
- Validates: picked_qty <= requested_qty
- Validates: picked_qty <= available stock
- Returns: Updated item

**POST /api/tablet/stock-requests/[requestId]/mark-picked**
- Updates status to `picked`
- Records picked_by and picked_at
- Validates all items have picked_qty set
- Returns: Updated request

**POST /api/tablet/stock-requests/[requestId]/mark-delivered**
- Updates status to `delivered`
- Creates stock_transactions (type: 'out')
- Updates item_warehouse balances (deduct picked quantities)
- Records delivered_by and delivered_at
- Returns: Updated request with transaction IDs

---

## React Query Hooks

### Receiving Hooks

```typescript
// useTabletPurchaseReceipts.ts
- useTabletPurchaseReceipts(filters) - List receipts
- useTabletPurchaseReceipt(receiptId) - Single receipt
- useStartReceiving() - Mutation to start receiving
- useReceiveAll() - Mutation to auto-fill quantities
- useUpdateReceiptItem() - Mutation to update line item qty
- usePostReceipt() - Mutation to post receipt
```

### Picking Hooks

```typescript
// useTabletStockRequests.ts
- useTabletStockRequests(filters) - List requests
- useTabletStockRequest(requestId) - Single request
- useStartPicking() - Mutation to start picking
- useUpdatePickItem() - Mutation to update picked qty
- useMarkPicked() - Mutation to complete picking
- useMarkDelivered() - Mutation to deliver and post transactions
```

---

## UI Components

### Layout Components

**`/tablet/layout.tsx`**
```typescript
- Max width: 768px (tablet optimized)
- Bottom padding for navigation
- Sticky header support
```

**`TabletHeader.tsx`**
```typescript
- Warehouse context display
- User info dropdown
- Current date/time
- Back navigation for detail pages
```

**`TabletBottomNav.tsx`**
```typescript
- 3 items: Receiving | Dashboard | Picking
- Active state indicators
- Touch-friendly sizing (min 44px height)
```

### Receiving Components

**`ReceivingCard.tsx`**
```typescript
type ReceivingCardProps = {
  receipt: PurchaseReceipt
  onPress: () => void
}
// Displays: supplier, receipt #, item count, status badge
```

**`ReceiptDetailHeader.tsx`**
```typescript
// Supplier, warehouse, dates, document numbers, status
```

**`ReceiveLineItemRow.tsx`**
```typescript
type ReceiveLineItemRowProps = {
  item: PurchaseReceiptItem
  onUpdate: (qty: number) => void
  disabled: boolean
}
// Item name, SKU, expected qty, QuantityStepper, UOM
```

**`QuantityStepper.tsx`**
```typescript
type QuantityStepperProps = {
  value: number
  max: number
  onChange: (value: number) => void
  disabled: boolean
}
// Large +/- buttons, numeric display, validation
```

### Picking Components

**`PickingCard.tsx`**
```typescript
type PickingCardProps = {
  request: StockRequest
  onPress: () => void
}
// Request #, source→dest, priority badge, item count, status
```

**`PickRequestHeader.tsx`**
```typescript
// Requester, warehouses, priority, dates, purpose
```

**`PickLineItemRow.tsx`**
```typescript
type PickLineItemRowProps = {
  item: StockRequestItem
  availableStock: number
  onUpdate: (qty: number) => void
  disabled: boolean
}
// Item name, SKU, requested qty, available stock, QuantityStepper, UOM
```

**`LocationDisplay.tsx`** (future - when location support added)
```typescript
// Shows bin/location code if available
```

---

## Permissions & Security

**For MVP**: Use Super Admin role (bypass permission checks)

**Post-MVP**: Create granular permissions:
- Resource: `purchase_receipts`
  - Actions: `view`, `receive`, `post`
- Resource: `stock_requests` (already exists)
  - Add actions: `pick`, `deliver`

**RLS**: All tables already have company-level isolation

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create `/tablet` layout structure
- [ ] Build `TabletHeader` and `TabletBottomNav` components
- [ ] Setup authentication flow (reuse mobile pattern)
- [ ] Database migration for stock request statuses
- [ ] Test migration on local Supabase

### Phase 2: Receiving Module (Week 2)
- [ ] API routes for purchase receipts
- [ ] React Query hooks for receiving
- [ ] Receiving list page with filters
- [ ] Receipt detail page
- [ ] `QuantityStepper` component
- [ ] Receive line items functionality
- [ ] Post receipt with stock transaction creation
- [ ] Test full receiving workflow

### Phase 3: Picking Module (Week 3)
- [ ] API routes for stock requests (tablet endpoints)
- [ ] React Query hooks for picking
- [ ] Picking list page with status tabs
- [ ] Request detail page
- [ ] Pick line items functionality
- [ ] Mark picked functionality
- [ ] Mark delivered with stock transaction creation
- [ ] Test full picking workflow

### Phase 4: Polish & Testing (Week 4)
- [ ] Error handling and validation messages
- [ ] Loading states and skeletons
- [ ] Empty states
- [ ] Success feedback (toasts/alerts)
- [ ] Partial receiving/picking scenarios
- [ ] Stock validation (prevent negative stock)
- [ ] Integration testing
- [ ] User acceptance testing

---

## Testing Strategy

### Unit Tests
- API route handlers (mock Supabase client)
- React Query hooks (mock API calls)
- Component rendering (React Testing Library)
- Validation logic (quantity limits, stock checks)

### Integration Tests
- Complete receiving workflow
- Complete picking workflow
- Stock transaction creation
- Inventory balance updates
- Purchase order status updates

### Manual Testing Scenarios
1. Receive full quantity of all items
2. Receive partial quantity (some items short)
3. Multiple receipts for same PO
4. Pick full quantities
5. Pick partial quantities (short pick)
6. Stock validation (insufficient stock scenario)
7. Multiple users picking different requests
8. Prevent double-picking same request

---

## Data Validation Rules

### Receiving
- ✅ received_qty <= quantity_ordered
- ✅ received_qty >= 0
- ✅ Cannot post receipt with status != 'draft'
- ✅ Cannot modify posted receipt
- ✅ Sum of all receipts <= PO quantity

### Picking
- ✅ picked_qty <= requested_qty
- ✅ picked_qty <= available_stock
- ✅ picked_qty >= 0
- ✅ Cannot start picking if status != 'ready_for_pick'
- ✅ Only one picker per request at a time
- ✅ Cannot deliver if status != 'picked'
- ✅ Delivered qty deducted from item_warehouse

---

## Performance Considerations

### Query Optimization
- Indexes on status columns (already exist)
- Pagination for list views (limit 50 per page)
- Eager loading relationships (Supabase select with joins)
- Cache React Query results (staleTime: 30s for lists)

### Touch Performance
- Debounce quantity input (300ms)
- Optimistic updates for line item qty changes
- Skeleton loaders during data fetch
- Minimize re-renders (useMemo, useCallback)

---

## Open Questions / Future Enhancements

### Barcode Scanning
- Integration point identified
- Placeholder search by item code for now
- Future: Camera API or external scanner device

### Location/Bin Management
- Database columns exist (from_location_id, to_location_id)
- No location management UI yet
- Future: Location-guided picking

### Offline Support
- Current: Online-only
- Future: Draft queue with sync on reconnect

### Notifications
- Future: Push notifications for new receipts/requests

### Print Labels
- Future: Print receipt labels, pick lists

---

## Success Criteria

### Receiving Module
- ✅ Warehouse staff can view open purchase receipts
- ✅ Start receiving process updates status
- ✅ Update received quantities for each item
- ✅ Post receipt creates stock transactions
- ✅ Inventory balances updated correctly
- ✅ Purchase order status updated (partial/full)

### Picking Module
- ✅ Warehouse staff can view stock requests by status
- ✅ Start picking locks request to one picker
- ✅ Update picked quantities for each item
- ✅ Complete picking updates status
- ✅ Deliver creates outbound stock transactions
- ✅ Inventory balances deducted correctly

### User Experience
- ✅ Touch-friendly interface (44px min targets)
- ✅ Clear visual feedback (loading, success, error)
- ✅ Fast response times (<500ms for updates)
- ✅ Intuitive navigation (back buttons, breadcrumbs)
- ✅ Consistent with mobile van sales patterns

---

## Documentation Deliverables

- [x] This implementation plan
- [ ] API endpoint documentation (Swagger/OpenAPI)
- [ ] Database migration changelog
- [ ] User guide (warehouse staff)
- [ ] Developer onboarding guide
- [ ] Testing procedures document

---

## Sign-off

**Product Owner**: _______________ Date: _______

**Tech Lead**: _______________ Date: _______

**QA Lead**: _______________ Date: _______
