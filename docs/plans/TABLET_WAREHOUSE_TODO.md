# Tablet Warehouse App - TODO Tracker

**Project Start Date**: 2026-01-14
**Target Completion**: 4 weeks from start
**Status**: 🟡 Planning Complete

---

## Phase 1: Foundation & Infrastructure (Week 1)

### Database Migration
- [ ] **CRITICAL**: Create stock request status migration
  - [ ] Add new status values: 'ready_for_pick', 'picking', 'picked', 'delivered'
  - [ ] Add columns: picking_started_at, picking_started_by, delivered_at, delivered_by
  - [ ] Update check constraint on status column
  - [ ] Create indexes for picking statuses
  - [ ] Test migration on local Supabase
  - [ ] Verify existing data compatibility
  - **File**: `supabase/migrations/VVVVV_add_stock_request_statuses.sql`

### Layout & Navigation Structure
- [ ] Create `/tablet` directory structure
  ```
  /src/app/tablet
  ├── layout.tsx
  ├── page.tsx (redirect to login)
  ├── /login
  │   └── page.tsx
  ├── /receiving
  │   ├── page.tsx
  │   └── /[receiptId]
  │       └── page.tsx
  └── /picking
      ├── page.tsx
      └── /[requestId]
          └── page.tsx
  ```

- [ ] **TabletLayout Component** (`/tablet/layout.tsx`)
  - [ ] Max width: 768px container
  - [ ] Bottom padding for navigation (80px)
  - [ ] Viewport meta tags (no zoom, device-width)
  - [ ] Import TabletBottomNav
  - [ ] Theme color configuration

- [ ] **TabletHeader Component** (`components/tablet/TabletHeader.tsx`)
  - [ ] Back button with navigation
  - [ ] Page title and subtitle
  - [ ] Warehouse context display
  - [ ] User dropdown menu
  - [ ] Current date/time display
  - [ ] Logout confirmation dialog
  - [ ] Sticky positioning

- [ ] **TabletBottomNav Component** (`components/tablet/TabletBottomNav.tsx`)
  - [ ] 3 navigation items: Receiving, Dashboard, Picking
  - [ ] Active state indicators
  - [ ] Touch-friendly sizing (min 44px)
  - [ ] Icons: Package, LayoutDashboard, Truck
  - [ ] Fixed bottom positioning
  - [ ] Safe area insets

### Authentication
- [ ] **Login Page** (`/tablet/login/page.tsx`)
  - [ ] Reuse mobile login pattern
  - [ ] Email/password form
  - [ ] Remember me option
  - [ ] Tablet-optimized layout
  - [ ] Redirect to /tablet/receiving after login
  - [ ] Error handling (invalid credentials)

- [ ] **Auth Context/Hook**
  - [ ] Check if existing useAuth can be reused
  - [ ] Session management
  - [ ] Auto-redirect if not authenticated

---

## Phase 2: Receiving Module (Week 2)

### TypeScript Types
- [ ] **Create types** (`src/types/tablet-receiving.ts`)
  ```typescript
  - PurchaseReceiptListItem
  - PurchaseReceiptDetail
  - ReceiptLineItem
  - ReceivingFilters
  - ReceivingStats
  ```

### API Routes - Receiving
- [ ] **GET /api/tablet/purchase-receipts**
  - [ ] Query params: status, warehouse_id, supplier_id, date_from, date_to, page, limit
  - [ ] Return paginated list with supplier info, item counts, status
  - [ ] Apply RLS and company filtering
  - [ ] Order by: receipt_date DESC, created_at DESC
  - [ ] **File**: `src/app/api/tablet/purchase-receipts/route.ts`

- [ ] **GET /api/tablet/purchase-receipts/[receiptId]**
  - [ ] Return complete receipt with items
  - [ ] Join: supplier, warehouse, items, UOM, packaging
  - [ ] Include: expected qty, received qty, notes
  - [ ] **File**: `src/app/api/tablet/purchase-receipts/[receiptId]/route.ts`

- [ ] **POST /api/tablet/purchase-receipts/[receiptId]/start-receiving**
  - [ ] Update status to 'in_progress' (if applicable)
  - [ ] Record receiving_started_by and receiving_started_at
  - [ ] Validate: status must be 'draft' or 'open'
  - [ ] Return updated receipt
  - [ ] **File**: `src/app/api/tablet/purchase-receipts/[receiptId]/start-receiving/route.ts`

- [ ] **POST /api/tablet/purchase-receipts/[receiptId]/receive-all**
  - [ ] Auto-fill all items with quantity_ordered
  - [ ] Update all purchase_receipt_items.quantity_received
  - [ ] Return updated items
  - [ ] **File**: `src/app/api/tablet/purchase-receipts/[receiptId]/receive-all/route.ts`

- [ ] **PATCH /api/tablet/purchase-receipts/[receiptId]/items/[itemId]**
  - [ ] Update quantity_received for single item
  - [ ] Validate: received_qty <= quantity_ordered
  - [ ] Validate: received_qty >= 0
  - [ ] Return updated item
  - [ ] **File**: `src/app/api/tablet/purchase-receipts/[receiptId]/items/[itemId]/route.ts`

- [ ] **POST /api/tablet/purchase-receipts/[receiptId]/post**
  - [ ] Validate all items have quantity_received > 0
  - [ ] Update receipt status to 'received'
  - [ ] Create stock_transactions (type: 'in')
  - [ ] Create stock_transaction_items for each line
  - [ ] Update item_warehouse.current_stock
  - [ ] Update purchase_order_items.quantity_received
  - [ ] Trigger PO status update (partially_received/received)
  - [ ] Return posted receipt with transaction IDs
  - [ ] **File**: `src/app/api/tablet/purchase-receipts/[receiptId]/post/route.ts`

### React Query Hooks - Receiving
- [ ] **Create hooks** (`src/hooks/useTabletReceiving.ts`)
  - [ ] `useTabletPurchaseReceipts(filters)` - List with pagination
  - [ ] `useTabletPurchaseReceipt(receiptId)` - Single receipt
  - [ ] `useStartReceiving()` - Mutation
  - [ ] `useReceiveAll()` - Mutation
  - [ ] `useUpdateReceiptItem()` - Mutation
  - [ ] `usePostReceipt()` - Mutation
  - [ ] Query key patterns: ['tablet', 'receipts', ...filters]
  - [ ] Invalidation logic on mutations
  - [ ] Error handling and toast notifications

### UI Components - Receiving
- [ ] **ReceivingCard** (`components/tablet/ReceivingCard.tsx`)
  - [ ] Display: supplier name, receipt #, date
  - [ ] Item count summary (e.g., "5 items")
  - [ ] Status badge
  - [ ] Touch-friendly (active:scale-98)
  - [ ] OnPress navigation

- [ ] **QuantityStepper** (`components/tablet/QuantityStepper.tsx`)
  - [ ] Large +/- buttons (min 48px)
  - [ ] Numeric display in center
  - [ ] Props: value, max, onChange, disabled
  - [ ] Validation visual feedback
  - [ ] Debounced onChange (300ms)

- [ ] **ReceiptDetailHeader** (`components/tablet/ReceiptDetailHeader.tsx`)
  - [ ] Supplier name and contact
  - [ ] Receipt code, date
  - [ ] Warehouse name
  - [ ] Supplier invoice # and date
  - [ ] Status badge
  - [ ] Notes section

- [ ] **ReceiveLineItemRow** (`components/tablet/ReceiveLineItemRow.tsx`)
  - [ ] Item name and SKU
  - [ ] Expected quantity display
  - [ ] QuantityStepper for received qty
  - [ ] UOM/packaging display
  - [ ] Notes input for damaged/rejected items
  - [ ] Visual indicator if qty mismatch

### Pages - Receiving
- [ ] **Receiving List Page** (`/tablet/receiving/page.tsx`)
  - [ ] Header with title "Receiving"
  - [ ] Filter bar: status dropdown, date range
  - [ ] Search by receipt # or supplier
  - [ ] Receipt cards in scrollable list
  - [ ] Empty state "No receipts to receive"
  - [ ] Loading skeletons
  - [ ] Pagination controls

- [ ] **Receipt Detail Page** (`/tablet/receiving/[receiptId]/page.tsx`)
  - [ ] Back button to list
  - [ ] ReceiptDetailHeader
  - [ ] Line items list with ReceiveLineItemRow
  - [ ] Action buttons:
    - [ ] "Start Receiving" (if not started)
    - [ ] "Receive All" (quick fill)
    - [ ] "Save Draft" (save progress)
    - [ ] "Post Receipt" (finalize)
  - [ ] Confirmation dialog before posting
  - [ ] Success feedback and redirect after post
  - [ ] Error handling display

### Testing - Receiving
- [ ] **API Tests**
  - [ ] List receipts with filters
  - [ ] Get single receipt with items
  - [ ] Start receiving workflow
  - [ ] Receive all auto-fill
  - [ ] Update single item quantity
  - [ ] Post receipt creates transactions

- [ ] **Integration Tests**
  - [ ] Full receive workflow: list → detail → update → post
  - [ ] Partial receiving (some items short)
  - [ ] Stock transaction creation
  - [ ] Inventory balance updates
  - [ ] PO status updates (partially_received, received)

- [ ] **Manual Testing Scenarios**
  - [ ] Receive full quantity of all items
  - [ ] Receive zero for some items (rejected/damaged)
  - [ ] Multiple receipts for same PO
  - [ ] Validation error handling
  - [ ] Network error recovery

---

## Phase 3: Picking Module (Week 3)

### TypeScript Types
- [ ] **Create types** (`src/types/tablet-picking.ts`)
  ```typescript
  - StockRequestListItem
  - StockRequestDetail
  - PickLineItem
  - PickingFilters
  - PickingStats
  - AvailableStockInfo
  ```

### API Routes - Picking
- [ ] **GET /api/tablet/stock-requests**
  - [ ] Query params: status, priority, warehouse_id, date_from, date_to, page, limit
  - [ ] Return paginated list with requester, warehouses, priority, item count
  - [ ] Filter by status tabs (submitted/approved, ready_for_pick, picking, picked)
  - [ ] Order by: priority DESC, required_date ASC
  - [ ] **File**: `src/app/api/tablet/stock-requests/route.ts`

- [ ] **GET /api/tablet/stock-requests/[requestId]**
  - [ ] Return complete request with items
  - [ ] Join: requester, warehouses, items, UOM, packaging
  - [ ] Include: available stock from item_warehouse
  - [ ] Calculate: can_fulfill (requested_qty <= available_stock)
  - [ ] **File**: `src/app/api/tablet/stock-requests/[requestId]/route.ts`

- [ ] **POST /api/tablet/stock-requests/[requestId]/start-picking**
  - [ ] Validate: status must be 'ready_for_pick'
  - [ ] Check: No other picker has locked this request
  - [ ] Update status to 'picking'
  - [ ] Record picking_started_by and picking_started_at
  - [ ] Return updated request
  - [ ] **File**: `src/app/api/tablet/stock-requests/[requestId]/start-picking/route.ts`

- [ ] **PATCH /api/tablet/stock-requests/[requestId]/items/[itemId]**
  - [ ] Update picked_qty for single item
  - [ ] Validate: picked_qty <= requested_qty
  - [ ] Validate: picked_qty <= available_stock
  - [ ] Validate: picked_qty >= 0
  - [ ] Allow short picks with reason in notes
  - [ ] Return updated item
  - [ ] **File**: `src/app/api/tablet/stock-requests/[requestId]/items/[itemId]/route.ts`

- [ ] **POST /api/tablet/stock-requests/[requestId]/mark-picked**
  - [ ] Validate: status must be 'picking'
  - [ ] Validate: picker must be current user
  - [ ] Validate: All items have picked_qty set (can be 0 for rejected)
  - [ ] Update status to 'picked'
  - [ ] Record picked_by and picked_at
  - [ ] Return updated request
  - [ ] **File**: `src/app/api/tablet/stock-requests/[requestId]/mark-picked/route.ts`

- [ ] **POST /api/tablet/stock-requests/[requestId]/mark-delivered**
  - [ ] Validate: status must be 'picked'
  - [ ] Create stock_transactions (type: 'out')
  - [ ] Create stock_transaction_items for each picked item
  - [ ] Update item_warehouse.current_stock (deduct picked_qty)
  - [ ] Update status to 'delivered'
  - [ ] Record delivered_by and delivered_at
  - [ ] Return updated request with transaction IDs
  - [ ] **File**: `src/app/api/tablet/stock-requests/[requestId]/mark-delivered/route.ts`

### React Query Hooks - Picking
- [ ] **Create hooks** (`src/hooks/useTabletPicking.ts`)
  - [ ] `useTabletStockRequests(filters)` - List with pagination
  - [ ] `useTabletStockRequest(requestId)` - Single request
  - [ ] `useItemAvailableStock(itemId, warehouseId)` - Stock check
  - [ ] `useStartPicking()` - Mutation
  - [ ] `useUpdatePickItem()` - Mutation
  - [ ] `useMarkPicked()` - Mutation
  - [ ] `useMarkDelivered()` - Mutation
  - [ ] Query key patterns: ['tablet', 'stock-requests', ...filters]
  - [ ] Invalidation logic on mutations
  - [ ] Error handling and toast notifications

### UI Components - Picking
- [ ] **PickingCard** (`components/tablet/PickingCard.tsx`)
  - [ ] Request code and requester name
  - [ ] Source → Destination warehouses
  - [ ] Priority badge (color-coded)
  - [ ] Item count
  - [ ] Status badge
  - [ ] Required date display
  - [ ] Touch-friendly, navigates on press

- [ ] **PickRequestHeader** (`components/tablet/PickRequestHeader.tsx`)
  - [ ] Request code, date
  - [ ] Requester name
  - [ ] Source and destination warehouses
  - [ ] Priority badge
  - [ ] Required date
  - [ ] Purpose/notes
  - [ ] Status badge

- [ ] **PickLineItemRow** (`components/tablet/PickLineItemRow.tsx`)
  - [ ] Item name and SKU
  - [ ] Requested quantity display
  - [ ] Available stock indicator (green/yellow/red)
  - [ ] QuantityStepper for picked qty
  - [ ] UOM/packaging display
  - [ ] Short pick reason input
  - [ ] Validation feedback

- [ ] **StockAvailabilityBadge** (`components/tablet/StockAvailabilityBadge.tsx`)
  - [ ] Green: Stock available (>= requested)
  - [ ] Yellow: Partial stock (< requested but > 0)
  - [ ] Red: Out of stock (0)
  - [ ] Display: "Available: X units"

### Pages - Picking
- [ ] **Picking List Page** (`/tablet/picking/page.tsx`)
  - [ ] Header with title "Picking"
  - [ ] Status tabs:
    - [ ] Submitted/Approved
    - [ ] Ready for Pick
    - [ ] Picking (In Progress)
    - [ ] Picked
  - [ ] Filter bar: priority, date range, warehouse
  - [ ] Search by request # or requester
  - [ ] Request cards in scrollable list
  - [ ] Empty state per tab
  - [ ] Loading skeletons
  - [ ] Pagination controls

- [ ] **Pick Request Detail Page** (`/tablet/picking/[requestId]/page.tsx`)
  - [ ] Back button to list
  - [ ] PickRequestHeader
  - [ ] Line items list with PickLineItemRow
  - [ ] Action buttons (conditional by status):
    - [ ] "Start Picking" (if ready_for_pick)
    - [ ] "Mark Picked" (if picking)
    - [ ] "Deliver" (if picked)
  - [ ] Confirmation dialogs before actions
  - [ ] Stock availability warnings
  - [ ] Success feedback and navigation
  - [ ] Error handling display

### Testing - Picking
- [ ] **API Tests**
  - [ ] List requests with status filters
  - [ ] Get single request with stock info
  - [ ] Start picking locks request
  - [ ] Update picked quantities
  - [ ] Mark picked validation
  - [ ] Deliver creates transactions

- [ ] **Integration Tests**
  - [ ] Full pick workflow: list → detail → start → pick → deliver
  - [ ] Short pick scenario (partial quantities)
  - [ ] Stock validation (insufficient stock)
  - [ ] Concurrent picking prevention
  - [ ] Stock transaction creation
  - [ ] Inventory balance deduction

- [ ] **Manual Testing Scenarios**
  - [ ] Pick full quantities for all items
  - [ ] Pick partial quantities (short pick)
  - [ ] Pick with insufficient stock warning
  - [ ] Multiple users trying to pick same request
  - [ ] Abandon picking (user navigates away)
  - [ ] Network error recovery
  - [ ] Validation error display

---

## Phase 4: Polish & Production Readiness (Week 4)

### Error Handling & Validation
- [ ] **API Error Responses**
  - [ ] Standardized error format
  - [ ] Validation error details
  - [ ] HTTP status codes (400, 404, 409, 500)
  - [ ] User-friendly error messages

- [ ] **Client-Side Validation**
  - [ ] Form validation (zod schemas)
  - [ ] Real-time feedback
  - [ ] Prevent invalid submissions
  - [ ] Clear error messages

- [ ] **Network Error Handling**
  - [ ] Retry logic (React Query)
  - [ ] Offline detection
  - [ ] Connection error messages
  - [ ] Recovery guidance

### Loading States & Feedback
- [ ] **Skeleton Loaders**
  - [ ] List page skeletons
  - [ ] Detail page skeletons
  - [ ] Line item skeletons
  - [ ] Match actual component layout

- [ ] **Loading Indicators**
  - [ ] Button loading states (spinner + disabled)
  - [ ] Page-level loading overlay
  - [ ] Inline action loaders

- [ ] **Success Feedback**
  - [ ] Toast notifications (sonner)
  - [ ] Success icons and colors
  - [ ] Auto-dismiss timers
  - [ ] Action confirmation messages

### Empty States
- [ ] **No Data States**
  - [ ] Empty receipt list
  - [ ] Empty request list
  - [ ] No items in receipt/request
  - [ ] Helpful guidance ("No receipts to receive today")
  - [ ] Icon illustrations

### Performance Optimization
- [ ] **Query Optimization**
  - [ ] Review N+1 query issues
  - [ ] Add database indexes if needed
  - [ ] Paginate large lists
  - [ ] Cache React Query (staleTime config)

- [ ] **Component Optimization**
  - [ ] useMemo for expensive calculations
  - [ ] useCallback for event handlers
  - [ ] Debounce search inputs
  - [ ] Lazy load detail pages

- [ ] **Bundle Size**
  - [ ] Check bundle analyzer
  - [ ] Code splitting by route
  - [ ] Dynamic imports for heavy components

### Security & Permissions
- [ ] **Authentication**
  - [ ] Require auth for all tablet routes
  - [ ] Session timeout handling
  - [ ] Auto-redirect to login
  - [ ] Secure token storage

- [ ] **Authorization**
  - [ ] Role check (Super Admin for MVP)
  - [ ] RLS verification (company isolation)
  - [ ] Action authorization
  - [ ] Error on unauthorized access

### Documentation
- [ ] **API Documentation**
  - [ ] Endpoint reference (inputs, outputs)
  - [ ] Error codes and meanings
  - [ ] Example requests/responses
  - [ ] Authentication requirements

- [ ] **User Guide**
  - [ ] Warehouse staff instructions
  - [ ] Screenshots/walkthrough
  - [ ] Troubleshooting section
  - [ ] FAQs

- [ ] **Developer Guide**
  - [ ] Setup instructions
  - [ ] Architecture overview
  - [ ] Component documentation
  - [ ] Testing guide
  - [ ] Deployment checklist

### Testing & QA
- [ ] **Comprehensive Testing**
  - [ ] Unit test coverage > 80%
  - [ ] Integration test all workflows
  - [ ] Manual QA checklist
  - [ ] Cross-browser testing (Chrome, Safari, Firefox)
  - [ ] Cross-device testing (iPad, Android tablets)

- [ ] **Edge Cases**
  - [ ] Partial receiving/picking
  - [ ] Zero quantity handling
  - [ ] Concurrent user scenarios
  - [ ] Network interruption
  - [ ] Session expiration
  - [ ] Invalid data handling

### Deployment Preparation
- [ ] **Database**
  - [ ] Run migration on staging
  - [ ] Verify data integrity
  - [ ] Backup before production
  - [ ] Run migration on production

- [ ] **Environment Config**
  - [ ] Environment variables
  - [ ] API endpoint configuration
  - [ ] Feature flags (if applicable)

- [ ] **Monitoring**
  - [ ] Error tracking (Sentry/similar)
  - [ ] Analytics events
  - [ ] Performance monitoring
  - [ ] Usage metrics

---

## Post-MVP Enhancements (Backlog)

### Barcode Scanning
- [ ] Research barcode scanner libraries
- [ ] Camera API integration
- [ ] External scanner device support
- [ ] Auto-jump to item on scan
- [ ] Scan to confirm pick

### Location/Bin Management
- [ ] Create warehouse_locations table
- [ ] Location assignment UI
- [ ] Location-guided picking
- [ ] Pick path optimization
- [ ] Location labels/QR codes

### Advanced Features
- [ ] Offline support with draft queue
- [ ] Push notifications (new receipts/requests)
- [ ] Print labels (receipts, pick lists)
- [ ] Batch receiving (multiple receipts)
- [ ] Cycle counting integration
- [ ] Returns processing

### Permissions Granularity
- [ ] Create "Warehouse Receiver" role
- [ ] Create "Picker" role
- [ ] Granular permissions: receive, pick, deliver
- [ ] Permission-based UI (hide unauthorized actions)

### Reporting & Analytics
- [ ] Receiving metrics (speed, accuracy)
- [ ] Picking metrics (speed, accuracy)
- [ ] User performance reports
- [ ] Stock accuracy dashboard

---

## Progress Tracking

### Phase 1: Foundation
- **Status**: ⬜ Not Started
- **Progress**: 0/X tasks
- **Blockers**: None
- **Notes**:

### Phase 2: Receiving
- **Status**: ⬜ Not Started
- **Progress**: 0/X tasks
- **Blockers**:
- **Notes**:

### Phase 3: Picking
- **Status**: ⬜ Not Started
- **Progress**: 0/X tasks
- **Blockers**:
- **Notes**:

### Phase 4: Polish
- **Status**: ⬜ Not Started
- **Progress**: 0/X tasks
- **Blockers**:
- **Notes**:

---

## Decision Log

### Date: 2026-01-14
**Decision**: Use existing stock_requests table for picking, add new statuses
**Reason**: Avoid duplicate data structures, leverage existing workflow
**Impact**: Need migration for new statuses

### Date: 2026-01-14
**Decision**: Super Admin role for MVP, defer granular permissions
**Reason**: Faster MVP delivery, add roles in post-MVP
**Impact**: No role checks needed initially

### Date: 2026-01-14
**Decision**: Defer barcode scanning to post-MVP
**Reason**: Complex integration, not critical for MVP
**Impact**: Use search/manual input for now

### Date: 2026-01-14
**Decision**: Track picking on stock_requests, no separate pick_sessions table
**Reason**: Simpler data model, sufficient for MVP
**Impact**: One picker per request at a time

---

## Change Log

### 2026-01-14
- Initial TODO created based on implementation plan
- All phases outlined with detailed tasks
- Decision log started

---

**Last Updated**: 2026-01-14
**Next Review**: Start of each phase
