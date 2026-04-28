# Purchasing Dashboard Widgets - Implementation Plan

**Created**: 2026-02-11
**Status**: Planning
**Target Completion**: TBD

---

## 📋 Executive Summary

This plan covers the implementation of 13 dashboard widgets for the purchasing module:

- **4 widgets** for Owners/Management (strategic view)
- **9 widgets** for Warehouse Managers (operational view)

All widgets will use existing database schema and API endpoints from the purchasing module.

---

## 🎯 Selected Widgets Overview

### Owner/Management Dashboard (4 widgets)

1. **Outstanding Requisitions Summary** - Active SRs count + total value
2. **Damaged Items This Month** - Quality issues count + value impact
3. **Expected Arrivals This Week** - Upcoming deliveries planning
4. **Delayed Shipments Alert** - Overdue load lists tracker

### Warehouse Manager Dashboard (9 widgets)

1. **Today's Receiving Queue** - Load lists arrived today
2. **Pending Approvals** - GRNs awaiting approval
3. **Box Assignment Queue** - Items without box assignments
4. **Warehouse Capacity Utilization** - Space usage metrics
5. **Active Requisitions Board** - SR status breakdown
6. **Incoming Deliveries Linked to SRs** - Expected arrivals with SR links
7. **Active Containers Tracker** - Containers in transit
8. **Barcode Printing Queue** - GRNs awaiting barcode printing
9. **Location Assignment Status** - Warehouse location tracking

---

## 🏗️ Architecture & Tech Stack

### Frontend

- **Framework**: Next.js 15 (App Router)
- **UI Library**: Shadcn/ui + Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **Charts**: Recharts or Chart.js
- **Icons**: Lucide React

### Backend

- **API**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Authorization**: Row Level Security (RLS) + RBAC

### Widget Architecture

```
/src/components/dashboard/
├── widgets/
│   ├── OutstandingRequisitionsWidget.tsx
│   ├── DamagedItemsWidget.tsx
│   ├── ExpectedArrivalsWidget.tsx
│   ├── DelayedShipmentsWidget.tsx
│   ├── TodaysReceivingQueueWidget.tsx
│   ├── PendingApprovalsWidget.tsx
│   ├── BoxAssignmentQueueWidget.tsx
│   ├── WarehouseCapacityWidget.tsx
│   ├── ActiveRequisitionsWidget.tsx
│   ├── IncomingDeliveriesWidget.tsx
│   ├── ActiveContainersWidget.tsx
│   ├── BarcodePrintingQueueWidget.tsx
│   └── LocationAssignmentWidget.tsx
└── layouts/
    ├── OwnerDashboardLayout.tsx
    └── WarehouseDashboardLayout.tsx
```

---

## 📊 Implementation Phases

### Phase 1: Foundation (API & Data Layer)

**Goal**: Build all required API endpoints and data hooks

### Phase 2: Owner Dashboard Widgets

**Goal**: Implement 4 strategic widgets for management

### Phase 3: Warehouse Dashboard Widgets (Part 1)

**Goal**: Implement 5 high-priority operational widgets

### Phase 4: Warehouse Dashboard Widgets (Part 2)

**Goal**: Implement remaining 4 operational widgets

### Phase 5: Integration & Testing

**Goal**: Dashboard layouts, navigation, and end-to-end testing

---

## 📅 PHASE 1: FOUNDATION (API & Data Layer)

### 1.1 API Endpoints Development

#### ☐ **Task 1.1.1**: Create Dashboard Analytics API Route

**File**: `/src/app/api/dashboard/purchasing/route.ts`

**Endpoint**: `GET /api/dashboard/purchasing`

**Query Parameters**:

- `widgets` (array): Which widgets to fetch data for
- `dateFrom` (string): Start date for time-based queries
- `dateTo` (string): End date for time-based queries
- `warehouseId` (string, optional): Filter by warehouse
- `businessUnitId` (string, optional): Filter by business unit

**Response Structure**:

```typescript
{
  outstandingRequisitions: {
    count: number;
    totalValue: number;
    items: StockRequisition[];
  };
  damagedItemsThisMonth: {
    count: number;
    totalValue: number;
    bySupplier: { supplierId: string; supplierName: string; count: number; value: number }[];
    byDamageType: { damageType: string; count: number }[];
  };
  expectedArrivalsThisWeek: {
    count: number;
    items: LoadList[];
  };
  delayedShipments: {
    count: number;
    items: LoadList[];
  };
  todaysReceivingQueue: {
    count: number;
    items: LoadList[];
  };
  pendingApprovals: {
    count: number;
    items: GRN[];
  };
  boxAssignmentQueue: {
    count: number;
    items: { grnId: string; grnNumber: string; itemId: string; itemName: string; receivedQty: number }[];
  };
  warehouseCapacity: {
    totalLocations: number;
    occupiedLocations: number;
    utilizationPercent: number;
    availableSpace: number;
  };
  activeRequisitions: {
    draft: number;
    submitted: number;
    partiallyFulfilled: number;
    fulfilled: number;
    cancelled: number;
    total: number;
  };
  incomingDeliveriesWithSRs: {
    count: number;
    items: Array<{
      loadList: LoadList;
      linkedRequisitions: StockRequisition[];
    }>;
  };
  activeContainers: {
    count: number;
    items: Array<{
      containerNumber: string;
      loadListId: string;
      llNumber: string;
      status: string;
      estimatedArrival: string;
      supplierName: string;
    }>;
  };
  barcodePrintingQueue: {
    count: number;
    items: Array<{
      grnId: string;
      grnNumber: string;
      totalBoxes: number;
      unprintedBoxes: number;
    }>;
  };
  locationAssignmentStatus: {
    totalBoxes: number;
    assignedBoxes: number;
    unassignedBoxes: number;
    assignmentPercent: number;
  };
}
```

**SQL Queries Required**:

1. Outstanding requisitions: `SELECT COUNT(*), SUM(total_amount) FROM stock_requisitions WHERE status IN ('submitted', 'partially_fulfilled')`
2. Damaged items: Join `damaged_items` with `grn_items` for value calculation
3. Expected arrivals: `SELECT * FROM load_lists WHERE estimated_arrival_date BETWEEN @dateFrom AND @dateTo AND status IN ('confirmed', 'in_transit')`
4. Delayed shipments: `SELECT * FROM load_lists WHERE estimated_arrival_date < NOW() AND status NOT IN ('received', 'cancelled')`
5. Today's receiving: `SELECT * FROM load_lists WHERE actual_arrival_date = CURRENT_DATE AND status IN ('arrived', 'receiving')`
6. Pending approvals: `SELECT * FROM grns WHERE status = 'pending_approval'`
7. Box assignment: Join `grn_items` with `grn_boxes` to find items without boxes
8. Warehouse capacity: Aggregate from `warehouse_locations` table
9. Active requisitions: Count by status from `stock_requisitions`
10. Incoming with SRs: Join `load_lists` with `load_list_sr_items` and `stock_requisitions`
11. Active containers: `SELECT DISTINCT container_number FROM load_lists WHERE status IN ('confirmed', 'in_transit', 'arrived')`
12. Barcode printing: Join `grns` with `grn_boxes` where `barcodes_printed = false`
13. Location assignment: Aggregate from `grn_boxes` by `warehouse_location_id`

**Acceptance Criteria**:

- [ ] API route returns all widget data
- [ ] Proper error handling (try-catch)
- [ ] Permission checks (requirePermission)
- [ ] Business unit filtering
- [ ] Response time < 2 seconds
- [ ] Proper TypeScript types
- [ ] API documentation added

---

#### ☐ **Task 1.1.2**: Create Widget-Specific Endpoints (Optional Optimization)

If single endpoint is too slow, split into individual endpoints:

**Files**:

- `/src/app/api/dashboard/purchasing/outstanding-requisitions/route.ts`
- `/src/app/api/dashboard/purchasing/damaged-items/route.ts`
- `/src/app/api/dashboard/purchasing/expected-arrivals/route.ts`
- `/src/app/api/dashboard/purchasing/delayed-shipments/route.ts`
- `/src/app/api/dashboard/purchasing/todays-receiving/route.ts`
- `/src/app/api/dashboard/purchasing/pending-approvals/route.ts`
- `/src/app/api/dashboard/purchasing/box-assignment-queue/route.ts`
- `/src/app/api/dashboard/purchasing/warehouse-capacity/route.ts`
- `/src/app/api/dashboard/purchasing/active-requisitions/route.ts`
- `/src/app/api/dashboard/purchasing/incoming-deliveries/route.ts`
- `/src/app/api/dashboard/purchasing/active-containers/route.ts`
- `/src/app/api/dashboard/purchasing/barcode-printing-queue/route.ts`
- `/src/app/api/dashboard/purchasing/location-assignment/route.ts`

**Decision**: Implement single endpoint first, split only if performance issues occur.

**Acceptance Criteria**:

- [ ] Each endpoint returns specific widget data
- [ ] Consistent error handling
- [ ] Proper caching headers
- [ ] < 500ms response time per endpoint

---

### 1.2 TypeScript Types

#### ☐ **Task 1.2.1**: Define Dashboard Widget Types

**File**: `/src/types/purchasing-dashboard.ts`

```typescript
// Widget data types
export interface OutstandingRequisitionsData {
  count: number;
  totalValue: number;
  items: StockRequisition[];
}

export interface DamagedItemsData {
  count: number;
  totalValue: number;
  bySupplier: SupplierDamageStats[];
  byDamageType: DamageTypeStats[];
}

export interface SupplierDamageStats {
  supplierId: string;
  supplierName: string;
  count: number;
  value: number;
}

export interface DamageTypeStats {
  damageType: "broken" | "defective" | "missing" | "expired" | "wrong_item" | "other";
  count: number;
}

export interface ExpectedArrivalsData {
  count: number;
  items: LoadList[];
}

export interface DelayedShipmentsData {
  count: number;
  items: LoadList[];
}

export interface TodaysReceivingQueueData {
  count: number;
  items: LoadList[];
}

export interface PendingApprovalsData {
  count: number;
  items: GRN[];
}

export interface BoxAssignmentQueueItem {
  grnId: string;
  grnNumber: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  receivedQty: number;
  boxesAssigned: number;
}

export interface BoxAssignmentQueueData {
  count: number;
  items: BoxAssignmentQueueItem[];
}

export interface WarehouseCapacityData {
  totalLocations: number;
  occupiedLocations: number;
  utilizationPercent: number;
  availableSpace: number;
}

export interface ActiveRequisitionsData {
  draft: number;
  submitted: number;
  partiallyFulfilled: number;
  fulfilled: number;
  cancelled: number;
  total: number;
}

export interface IncomingDeliveryWithSRs {
  loadList: LoadList;
  linkedRequisitions: StockRequisition[];
}

export interface IncomingDeliveriesData {
  count: number;
  items: IncomingDeliveryWithSRs[];
}

export interface ActiveContainerItem {
  containerNumber: string;
  loadListId: string;
  llNumber: string;
  status: LoadListStatus;
  estimatedArrival: string;
  supplierName: string;
}

export interface ActiveContainersData {
  count: number;
  items: ActiveContainerItem[];
}

export interface BarcodePrintingQueueItem {
  grnId: string;
  grnNumber: string;
  totalBoxes: number;
  unprintedBoxes: number;
  percentComplete: number;
}

export interface BarcodePrintingQueueData {
  count: number;
  items: BarcodePrintingQueueItem[];
}

export interface LocationAssignmentStatusData {
  totalBoxes: number;
  assignedBoxes: number;
  unassignedBoxes: number;
  assignmentPercent: number;
}

// Main dashboard response
export interface PurchasingDashboardData {
  outstandingRequisitions?: OutstandingRequisitionsData;
  damagedItemsThisMonth?: DamagedItemsData;
  expectedArrivalsThisWeek?: ExpectedArrivalsData;
  delayedShipments?: DelayedShipmentsData;
  todaysReceivingQueue?: TodaysReceivingQueueData;
  pendingApprovals?: PendingApprovalsData;
  boxAssignmentQueue?: BoxAssignmentQueueData;
  warehouseCapacity?: WarehouseCapacityData;
  activeRequisitions?: ActiveRequisitionsData;
  incomingDeliveriesWithSRs?: IncomingDeliveriesData;
  activeContainers?: ActiveContainersData;
  barcodePrintingQueue?: BarcodePrintingQueueData;
  locationAssignmentStatus?: LocationAssignmentStatusData;
}

// Query parameters
export interface DashboardQueryParams {
  widgets?: string[]; // Which widgets to fetch
  dateFrom?: string;
  dateTo?: string;
  warehouseId?: string;
  businessUnitId?: string;
}
```

**Acceptance Criteria**:

- [ ] All types defined with proper TypeScript syntax
- [ ] Extends existing types (StockRequisition, LoadList, GRN)
- [ ] Exported for use in components
- [ ] JSDoc comments added

---

### 1.3 React Query Hooks

#### ☐ **Task 1.3.1**: Create Dashboard Data Hooks

**File**: `/src/hooks/usePurchasingDashboard.ts`

```typescript
import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import type { PurchasingDashboardData, DashboardQueryParams } from "@/types/purchasing-dashboard";

export function usePurchasingDashboard(
  params?: DashboardQueryParams,
  options?: Omit<UseQueryOptions<PurchasingDashboardData>, "queryKey" | "queryFn">
) {
  return useQuery<PurchasingDashboardData>({
    queryKey: ["purchasing-dashboard", params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.widgets) queryParams.append("widgets", params.widgets.join(","));
      if (params?.dateFrom) queryParams.append("dateFrom", params.dateFrom);
      if (params?.dateTo) queryParams.append("dateTo", params.dateTo);
      if (params?.warehouseId) queryParams.append("warehouseId", params.warehouseId);
      if (params?.businessUnitId) queryParams.append("businessUnitId", params.businessUnitId);

      const response = await fetch(`/api/dashboard/purchasing?${queryParams}`);
      if (!response.ok) {
        throw new Error("Failed to fetch dashboard data");
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 60 * 5, // Refresh every 5 minutes
    ...options,
  });
}

// Individual widget hooks (for granular fetching)
export function useOutstandingRequisitions(params?: DashboardQueryParams) {
  return usePurchasingDashboard(
    { ...params, widgets: ["outstandingRequisitions"] },
    { select: (data) => data.outstandingRequisitions }
  );
}

export function useDamagedItemsThisMonth(params?: DashboardQueryParams) {
  return usePurchasingDashboard(
    { ...params, widgets: ["damagedItemsThisMonth"] },
    { select: (data) => data.damagedItemsThisMonth }
  );
}

export function useExpectedArrivalsThisWeek(params?: DashboardQueryParams) {
  return usePurchasingDashboard(
    { ...params, widgets: ["expectedArrivalsThisWeek"] },
    { select: (data) => data.expectedArrivalsThisWeek }
  );
}

export function useDelayedShipments(params?: DashboardQueryParams) {
  return usePurchasingDashboard(
    { ...params, widgets: ["delayedShipments"] },
    { select: (data) => data.delayedShipments }
  );
}

export function useTodaysReceivingQueue(params?: DashboardQueryParams) {
  return usePurchasingDashboard(
    { ...params, widgets: ["todaysReceivingQueue"] },
    { select: (data) => data.todaysReceivingQueue }
  );
}

export function usePendingApprovals(params?: DashboardQueryParams) {
  return usePurchasingDashboard(
    { ...params, widgets: ["pendingApprovals"] },
    { select: (data) => data.pendingApprovals }
  );
}

export function useBoxAssignmentQueue(params?: DashboardQueryParams) {
  return usePurchasingDashboard(
    { ...params, widgets: ["boxAssignmentQueue"] },
    { select: (data) => data.boxAssignmentQueue }
  );
}

export function useWarehouseCapacity(params?: DashboardQueryParams) {
  return usePurchasingDashboard(
    { ...params, widgets: ["warehouseCapacity"] },
    { select: (data) => data.warehouseCapacity }
  );
}

export function useActiveRequisitions(params?: DashboardQueryParams) {
  return usePurchasingDashboard(
    { ...params, widgets: ["activeRequisitions"] },
    { select: (data) => data.activeRequisitions }
  );
}

export function useIncomingDeliveriesWithSRs(params?: DashboardQueryParams) {
  return usePurchasingDashboard(
    { ...params, widgets: ["incomingDeliveriesWithSRs"] },
    { select: (data) => data.incomingDeliveriesWithSRs }
  );
}

export function useActiveContainers(params?: DashboardQueryParams) {
  return usePurchasingDashboard(
    { ...params, widgets: ["activeContainers"] },
    { select: (data) => data.activeContainers }
  );
}

export function useBarcodePrintingQueue(params?: DashboardQueryParams) {
  return usePurchasingDashboard(
    { ...params, widgets: ["barcodePrintingQueue"] },
    { select: (data) => data.barcodePrintingQueue }
  );
}

export function useLocationAssignmentStatus(params?: DashboardQueryParams) {
  return usePurchasingDashboard(
    { ...params, widgets: ["locationAssignmentStatus"] },
    { select: (data) => data.locationAssignmentStatus }
  );
}
```

**Acceptance Criteria**:

- [ ] All hooks created with proper React Query syntax
- [ ] Proper query key management
- [ ] Auto-refresh configured (5 min interval)
- [ ] Stale time set appropriately
- [ ] Error handling built in
- [ ] TypeScript types enforced

---

### Phase 1 Progress Tracker

- [ ] **1.1.1**: Dashboard Analytics API Route created
- [ ] **1.1.2**: Individual widget endpoints created (if needed)
- [ ] **1.2.1**: TypeScript types defined
- [ ] **1.3.1**: React Query hooks created
- [ ] **Phase 1 Complete**: API & Data Layer ready

---

## 📅 PHASE 2: OWNER DASHBOARD WIDGETS

### 2.1 Outstanding Requisitions Widget

#### ☐ **Task 2.1.1**: Create Widget Component

**File**: `/src/components/dashboard/widgets/OutstandingRequisitionsWidget.tsx`

**Features**:

- Display count and total value as KPI cards
- List of top 5 outstanding requisitions
- "View All" link to full requisitions page
- Click to view requisition details

**UI Mockup**:

```
┌──────────────────────────────────────┐
│ 📋 Outstanding Requisitions          │
├──────────────────────────────────────┤
│  Count: 12        Value: ¥145,230.50 │
├──────────────────────────────────────┤
│ SR-2026-0045  │ Supplier A │ ¥12,500│
│ SR-2026-0043  │ Supplier B │ ¥8,900 │
│ SR-2026-0041  │ Supplier C │ ¥15,300│
│ ...                                   │
│ [View All Requisitions →]            │
└──────────────────────────────────────┘
```

**Acceptance Criteria**:

- [ ] Component renders with loading state
- [ ] Shows count and value prominently
- [ ] Lists top 5 requisitions
- [ ] Click navigates to requisition detail
- [ ] "View All" link works
- [ ] Responsive design (mobile/tablet/desktop)
- [ ] Error state handled gracefully

---

#### ☐ **Task 2.1.2**: Add Unit Tests

**File**: `/src/components/dashboard/widgets/__tests__/OutstandingRequisitionsWidget.test.tsx`

**Test Cases**:

- [ ] Renders loading state
- [ ] Renders with data
- [ ] Renders empty state
- [ ] Handles click on requisition
- [ ] Handles "View All" click
- [ ] Handles error state

---

### 2.2 Damaged Items Widget

#### ☐ **Task 2.2.1**: Create Widget Component

**File**: `/src/components/dashboard/widgets/DamagedItemsWidget.tsx`

**Features**:

- Display count and total value as KPI
- Pie chart showing damage by supplier (top 5)
- Bar chart showing damage types
- Alert indicator if count > threshold

**UI Mockup**:

```
┌──────────────────────────────────────┐
│ ⚠️ Damaged Items This Month          │
├──────────────────────────────────────┤
│  Count: 45        Value: ¥8,230.00   │
├──────────────────────────────────────┤
│ By Supplier:        By Type:         │
│ [Pie Chart]        [Bar Chart]       │
│                                       │
│ [View Damage Reports →]              │
└──────────────────────────────────────┘
```

**Acceptance Criteria**:

- [ ] Component renders with loading state
- [ ] Shows count and value
- [ ] Pie chart renders correctly
- [ ] Bar chart renders correctly
- [ ] Click navigates to damage reports
- [ ] Responsive design
- [ ] Error state handled

---

#### ☐ **Task 2.2.2**: Add Unit Tests

**File**: `/src/components/dashboard/widgets/__tests__/DamagedItemsWidget.test.tsx`

---

### 2.3 Expected Arrivals Widget

#### ☐ **Task 2.3.1**: Create Widget Component

**File**: `/src/components/dashboard/widgets/ExpectedArrivalsWidget.tsx`

**Features**:

- Show count of expected arrivals this week
- Timeline view by day
- Click to view load list details
- Color coding by status

**UI Mockup**:

```
┌──────────────────────────────────────┐
│ 📦 Expected Arrivals This Week       │
├──────────────────────────────────────┤
│  7 deliveries expected               │
├──────────────────────────────────────┤
│ Mon Feb 11: LL-001, LL-002 (2)       │
│ Tue Feb 12: LL-003 (1)               │
│ Wed Feb 13: LL-004, LL-005 (2)       │
│ Thu Feb 14: None                     │
│ Fri Feb 15: LL-006, LL-007 (2)       │
│                                       │
│ [View Load Lists →]                  │
└──────────────────────────────────────┘
```

**Acceptance Criteria**:

- [ ] Component renders with loading state
- [ ] Shows count
- [ ] Timeline grouped by day
- [ ] Click navigates to load list detail
- [ ] Responsive design
- [ ] Error state handled

---

#### ☐ **Task 2.3.2**: Add Unit Tests

---

### 2.4 Delayed Shipments Widget

#### ☐ **Task 2.4.1**: Create Widget Component

**File**: `/src/components/dashboard/widgets/DelayedShipmentsWidget.tsx`

**Features**:

- Display count with alert indicator
- List delayed load lists
- Show days overdue
- Sort by most overdue first
- Color coding (red for critical)

**UI Mockup**:

```
┌──────────────────────────────────────┐
│ 🔴 Delayed Shipments                 │
├──────────────────────────────────────┤
│  3 shipments overdue                 │
├──────────────────────────────────────┤
│ LL-2026-0034 │ 5 days late │ Supp A │
│ LL-2026-0029 │ 3 days late │ Supp B │
│ LL-2026-0025 │ 1 day late  │ Supp C │
│                                       │
│ [View All Load Lists →]              │
└──────────────────────────────────────┘
```

**Acceptance Criteria**:

- [ ] Component renders with loading state
- [ ] Shows count with alert styling
- [ ] Lists delayed shipments
- [ ] Shows days overdue
- [ ] Color coding applied
- [ ] Click navigates to load list
- [ ] Responsive design
- [ ] Error state handled

---

#### ☐ **Task 2.4.2**: Add Unit Tests

---

### Phase 2 Progress Tracker

- [ ] **2.1**: Outstanding Requisitions Widget complete
- [ ] **2.2**: Damaged Items Widget complete
- [ ] **2.3**: Expected Arrivals Widget complete
- [ ] **2.4**: Delayed Shipments Widget complete
- [ ] **Phase 2 Complete**: Owner Dashboard Widgets ready

---

## 📅 PHASE 3: WAREHOUSE DASHBOARD WIDGETS (Part 1)

### 3.1 Today's Receiving Queue Widget

#### ☐ **Task 3.1.1**: Create Widget Component

**File**: `/src/components/dashboard/widgets/TodaysReceivingQueueWidget.tsx`

**Features**:

- Show count of items in receiving queue
- List load lists arrived today
- Status indicator (arrived/receiving)
- Priority sorting
- Quick action button to start receiving

**UI Mockup**:

```
┌──────────────────────────────────────┐
│ 📥 Today's Receiving Queue           │
├──────────────────────────────────────┤
│  5 load lists to receive             │
├──────────────────────────────────────┤
│ LL-001 │ Arrived │ Supplier A │[Start]│
│ LL-002 │ Receiving │ Supplier B │[Resume]│
│ LL-003 │ Arrived │ Supplier C │[Start]│
│ ...                                   │
│ [View All →]                         │
└──────────────────────────────────────┘
```

**Acceptance Criteria**:

- [ ] Component renders with loading state
- [ ] Shows count
- [ ] Lists all items from today
- [ ] Status badges displayed
- [ ] Quick action buttons work
- [ ] Click navigates to GRN page
- [ ] Responsive design
- [ ] Error state handled

---

#### ☐ **Task 3.1.2**: Add Unit Tests

---

### 3.2 Pending Approvals Widget

#### ☐ **Task 3.2.1**: Create Widget Component

**File**: `/src/components/dashboard/widgets/PendingApprovalsWidget.tsx`

**Features**:

- Show count of GRNs pending approval
- List GRNs awaiting approval
- Show time pending (hours/days)
- Alert if pending > 24 hours
- Quick approve/reject actions

**UI Mockup**:

```
┌──────────────────────────────────────┐
│ ✅ Pending Approvals                 │
├──────────────────────────────────────┤
│  3 GRNs awaiting approval            │
├──────────────────────────────────────┤
│ GRN-001 │ 2 hrs │ LL-045 │[Approve][Reject]│
│ GRN-002 │ 5 hrs │ LL-043 │[Approve][Reject]│
│ GRN-003 🔴 26 hrs │ LL-041 │[Approve][Reject]│
│                                       │
│ [View All GRNs →]                    │
└──────────────────────────────────────┘
```

**Acceptance Criteria**:

- [ ] Component renders with loading state
- [ ] Shows count
- [ ] Lists pending GRNs
- [ ] Time pending displayed
- [ ] Alert indicator for >24h
- [ ] Quick actions work
- [ ] Click navigates to GRN detail
- [ ] Responsive design
- [ ] Error state handled

---

#### ☐ **Task 3.2.2**: Add Unit Tests

---

### 3.3 Box Assignment Queue Widget

#### ☐ **Task 3.3.1**: Create Widget Component

**File**: `/src/components/dashboard/widgets/BoxAssignmentQueueWidget.tsx`

**Features**:

- Show count of items without boxes
- List items awaiting box assignment
- Show GRN number and item details
- Quick action to assign boxes
- Priority sorting

**UI Mockup**:

```
┌──────────────────────────────────────┐
│ 📦 Box Assignment Queue              │
├──────────────────────────────────────┤
│  12 items awaiting box assignment    │
├──────────────────────────────────────┤
│ GRN-001 │ Item A │ 50 units │[Assign]│
│ GRN-002 │ Item B │ 30 units │[Assign]│
│ GRN-003 │ Item C │ 100 units│[Assign]│
│ ...                                   │
│ [View All →]                         │
└──────────────────────────────────────┘
```

**Acceptance Criteria**:

- [ ] Component renders with loading state
- [ ] Shows count
- [ ] Lists items without boxes
- [ ] Shows GRN and item details
- [ ] Quick assign button works
- [ ] Click navigates to box management
- [ ] Responsive design
- [ ] Error state handled

---

#### ☐ **Task 3.3.2**: Add Unit Tests

---

### 3.4 Warehouse Capacity Widget

#### ☐ **Task 3.4.1**: Create Widget Component

**File**: `/src/components/dashboard/widgets/WarehouseCapacityWidget.tsx`

**Features**:

- Show total locations and occupied count
- Utilization percentage with gauge
- Available space indicator
- Color coding (green/yellow/red)
- Alert if >90% capacity

**UI Mockup**:

```
┌──────────────────────────────────────┐
│ 🏭 Warehouse Capacity Utilization    │
├──────────────────────────────────────┤
│       [Gauge: 76%]                   │
│                                       │
│  Total Locations: 500                │
│  Occupied: 380                       │
│  Available: 120                      │
│                                       │
│ Status: Good (Yellow)                │
└──────────────────────────────────────┘
```

**Acceptance Criteria**:

- [ ] Component renders with loading state
- [ ] Shows utilization gauge
- [ ] Displays location counts
- [ ] Color coding based on percentage
- [ ] Alert indicator if >90%
- [ ] Responsive design
- [ ] Error state handled

---

#### ☐ **Task 3.4.2**: Add Unit Tests

---

### 3.5 Active Requisitions Board Widget

#### ☐ **Task 3.5.1**: Create Widget Component

**File**: `/src/components/dashboard/widgets/ActiveRequisitionsWidget.tsx`

**Features**:

- Show count by status
- Donut chart visualization
- Status breakdown list
- Click to filter requisitions by status

**UI Mockup**:

```
┌──────────────────────────────────────┐
│ 📋 Active Requisitions Status        │
├──────────────────────────────────────┤
│      [Donut Chart]                   │
│                                       │
│  Draft: 3                            │
│  Submitted: 8                        │
│  Partially Fulfilled: 12             │
│  Fulfilled: 45                       │
│                                       │
│ [View All Requisitions →]           │
└──────────────────────────────────────┘
```

**Acceptance Criteria**:

- [ ] Component renders with loading state
- [ ] Shows count by status
- [ ] Donut chart renders
- [ ] Click filters by status
- [ ] Responsive design
- [ ] Error state handled

---

#### ☐ **Task 3.5.2**: Add Unit Tests

---

### Phase 3 Progress Tracker

- [ ] **3.1**: Today's Receiving Queue Widget complete
- [ ] **3.2**: Pending Approvals Widget complete
- [ ] **3.3**: Box Assignment Queue Widget complete
- [ ] **3.4**: Warehouse Capacity Widget complete
- [ ] **3.5**: Active Requisitions Board Widget complete
- [ ] **Phase 3 Complete**: Warehouse Widgets Part 1 ready

---

## 📅 PHASE 4: WAREHOUSE DASHBOARD WIDGETS (Part 2)

### 4.1 Incoming Deliveries with SRs Widget

#### ☐ **Task 4.1.1**: Create Widget Component

**File**: `/src/components/dashboard/widgets/IncomingDeliveriesWidget.tsx`

**Features**:

- Show count of incoming deliveries
- List load lists with linked requisitions
- Show estimated arrival date
- Badge showing SR count per load list
- Click to view details

**UI Mockup**:

```
┌──────────────────────────────────────┐
│ 🚚 Incoming Deliveries (Linked)     │
├──────────────────────────────────────┤
│  7 deliveries with requisition links │
├──────────────────────────────────────┤
│ LL-001 │ Feb 12 │ 2 SRs │ Supplier A │
│ LL-002 │ Feb 13 │ 1 SR  │ Supplier B │
│ LL-003 │ Feb 14 │ 3 SRs │ Supplier C │
│ ...                                   │
│ [View All →]                         │
└──────────────────────────────────────┘
```

**Acceptance Criteria**:

- [ ] Component renders with loading state
- [ ] Shows count
- [ ] Lists deliveries with SR links
- [ ] Shows arrival dates
- [ ] SR count badges displayed
- [ ] Click navigates to load list
- [ ] Responsive design
- [ ] Error state handled

---

#### ☐ **Task 4.1.2**: Add Unit Tests

---

### 4.2 Active Containers Tracker Widget

#### ☐ **Task 4.2.1**: Create Widget Component

**File**: `/src/components/dashboard/widgets/ActiveContainersWidget.tsx`

**Features**:

- Show count of active containers
- List containers with details
- Show status and ETA
- Color coding by status
- Click to view load list

**UI Mockup**:

```
┌──────────────────────────────────────┐
│ 📦 Active Containers in Transit     │
├──────────────────────────────────────┤
│  5 containers tracked                │
├──────────────────────────────────────┤
│ CONT-001 │ LL-045 │ In Transit │ Feb 12│
│ CONT-002 │ LL-043 │ Arrived │ Today  │
│ CONT-003 │ LL-041 │ Confirmed │ Feb 15│
│ ...                                   │
│ [View All →]                         │
└──────────────────────────────────────┘
```

**Acceptance Criteria**:

- [ ] Component renders with loading state
- [ ] Shows count
- [ ] Lists active containers
- [ ] Shows status and ETA
- [ ] Color coding applied
- [ ] Click navigates to load list
- [ ] Responsive design
- [ ] Error state handled

---

#### ☐ **Task 4.2.2**: Add Unit Tests

---

### 4.3 Barcode Printing Queue Widget

#### ☐ **Task 4.3.1**: Create Widget Component

**File**: `/src/components/dashboard/widgets/BarcodePrintingQueueWidget.tsx`

**Features**:

- Show count of GRNs with unprinted boxes
- List GRNs with printing status
- Progress bar showing % complete
- Quick action to mark as printed
- Print button integration

**UI Mockup**:

```
┌──────────────────────────────────────┐
│ 🏷️ Barcode Printing Queue            │
├──────────────────────────────────────┤
│  3 GRNs awaiting barcode printing    │
├──────────────────────────────────────┤
│ GRN-001 │ 20/50 boxes │ [====    ] 40%│[Print]│
│ GRN-002 │ 15/30 boxes │ [=======] 50%│[Print]│
│ GRN-003 │ 0/25 boxes  │ [       ] 0% │[Print]│
│                                       │
│ [View All GRNs →]                    │
└──────────────────────────────────────┘
```

**Acceptance Criteria**:

- [ ] Component renders with loading state
- [ ] Shows count
- [ ] Lists GRNs with printing status
- [ ] Progress bars displayed
- [ ] Quick print action works
- [ ] Click navigates to GRN boxes
- [ ] Responsive design
- [ ] Error state handled

---

#### ☐ **Task 4.3.2**: Add Unit Tests

---

### 4.4 Location Assignment Status Widget

#### ☐ **Task 4.4.1**: Create Widget Component

**File**: `/src/components/dashboard/widgets/LocationAssignmentWidget.tsx`

**Features**:

- Show total boxes and assignment status
- Percentage with progress bar
- Count of assigned vs unassigned
- Alert if assignment rate < 80%
- Click to view unassigned boxes

**UI Mockup**:

```
┌──────────────────────────────────────┐
│ 📍 Location Assignment Status        │
├──────────────────────────────────────┤
│  [Progress Bar: 85%]                 │
│                                       │
│  Total Boxes: 500                    │
│  Assigned: 425                       │
│  Unassigned: 75                      │
│                                       │
│ Status: Good                         │
│ [View Unassigned →]                  │
└──────────────────────────────────────┘
```

**Acceptance Criteria**:

- [ ] Component renders with loading state
- [ ] Shows assignment percentage
- [ ] Progress bar displays correctly
- [ ] Box counts shown
- [ ] Alert if <80% assigned
- [ ] Click navigates to unassigned list
- [ ] Responsive design
- [ ] Error state handled

---

#### ☐ **Task 4.4.2**: Add Unit Tests

---

### Phase 4 Progress Tracker

- [ ] **4.1**: Incoming Deliveries Widget complete
- [ ] **4.2**: Active Containers Widget complete
- [ ] **4.3**: Barcode Printing Queue Widget complete
- [ ] **4.4**: Location Assignment Widget complete
- [ ] **Phase 4 Complete**: Warehouse Widgets Part 2 ready

---

## 📅 PHASE 5: INTEGRATION & TESTING

### 5.1 Dashboard Layout Pages

#### ☐ **Task 5.1.1**: Create Owner Dashboard Page

**File**: `/src/app/(dashboard)/purchasing/owner-dashboard/page.tsx`

**Features**:

- Grid layout for 4 widgets
- Responsive design (mobile/tablet/desktop)
- Refresh button
- Export functionality (optional)
- Print view (optional)

**Layout**:

```
Desktop (2x2 Grid):
┌─────────────┬─────────────┐
│ Outstanding │ Damaged     │
│ Requisitions│ Items       │
├─────────────┼─────────────┤
│ Expected    │ Delayed     │
│ Arrivals    │ Shipments   │
└─────────────┴─────────────┘

Mobile (1 column):
┌─────────────┐
│ Outstanding │
│ Requisitions│
├─────────────┤
│ Damaged     │
│ Items       │
├─────────────┤
│ Expected    │
│ Arrivals    │
├─────────────┤
│ Delayed     │
│ Shipments   │
└─────────────┘
```

**Acceptance Criteria**:

- [ ] Page renders with all 4 widgets
- [ ] Responsive layout works
- [ ] Loading states coordinated
- [ ] Refresh button updates all widgets
- [ ] Navigation breadcrumbs
- [ ] Proper permissions enforced

---

#### ☐ **Task 5.1.2**: Create Warehouse Dashboard Page

**File**: `/src/app/(dashboard)/purchasing/warehouse-dashboard/page.tsx`

**Features**:

- Grid layout for 9 widgets
- Tab organization (Queue / Status / Tracking)
- Warehouse filter dropdown
- Real-time updates (auto-refresh)
- Print view (optional)

**Layout**:

```
Desktop (3-column grid):
┌──────────┬──────────┬──────────┐
│ Today's  │ Pending  │ Box      │
│ Receiving│ Approvals│ Assignmnt│
├──────────┼──────────┼──────────┤
│ Warehouse│ Active   │ Incoming │
│ Capacity │ Requisit.│ Delivr.  │
├──────────┼──────────┼──────────┤
│ Active   │ Barcode  │ Location │
│ Container│ Printing │ Assignmnt│
└──────────┴──────────┴──────────┘

Tablet (2-column):
┌──────────┬──────────┐
│ Today's  │ Pending  │
│ Receiving│ Approvals│
├──────────┼──────────┤
│ Box      │ Warehouse│
│ Assignmnt│ Capacity │
│ ...                 │
└──────────┴──────────┘

Mobile (1-column):
All widgets stacked vertically
```

**Acceptance Criteria**:

- [ ] Page renders with all 9 widgets
- [ ] Responsive layout works
- [ ] Warehouse filter works
- [ ] Auto-refresh configured
- [ ] Tab organization (if used)
- [ ] Navigation breadcrumbs
- [ ] Proper permissions enforced

---

### 5.2 Navigation Integration

#### ☐ **Task 5.2.1**: Add Dashboard Links to Main Nav

**File**: `/src/components/navigation/MainNav.tsx` or similar

**Changes**:

- Add "Owner Dashboard" link under Purchasing menu
- Add "Warehouse Dashboard" link under Purchasing menu
- Add icons for visual distinction
- Implement active state highlighting

**Acceptance Criteria**:

- [ ] Links added to main navigation
- [ ] Icons displayed correctly
- [ ] Active state works
- [ ] Permissions checked (show/hide based on role)

---

#### ☐ **Task 5.2.2**: Create Dashboard Quick Access Widget

**File**: `/src/components/dashboard/DashboardQuickAccess.tsx`

**Features**:

- Small widget on main dashboard
- Shows critical counts (e.g., "5 items to receive")
- Click to navigate to relevant dashboard
- Color-coded alerts

**Acceptance Criteria**:

- [ ] Widget displays on main dashboard
- [ ] Shows aggregated counts
- [ ] Navigation works
- [ ] Alert indicators visible

---

### 5.3 Testing

#### ☐ **Task 5.3.1**: Integration Testing

**Test Suite**: End-to-end tests using Playwright or Cypress

**Test Scenarios**:

- [ ] Owner dashboard loads successfully
- [ ] Warehouse dashboard loads successfully
- [ ] All widgets render data
- [ ] Click navigation works
- [ ] Refresh functionality works
- [ ] Responsive layout works
- [ ] Error states handled
- [ ] Loading states shown correctly

---

#### ☐ **Task 5.3.2**: Performance Testing

**Metrics to Test**:

- [ ] Dashboard load time < 3 seconds
- [ ] API response time < 2 seconds
- [ ] Widget render time < 500ms
- [ ] Auto-refresh doesn't cause lag
- [ ] Memory usage reasonable

**Tools**: Lighthouse, Chrome DevTools, React Profiler

---

#### ☐ **Task 5.3.3**: User Acceptance Testing (UAT)

**Test with**:

- [ ] Owner/Management users
- [ ] Warehouse Manager users
- [ ] Warehouse staff users

**Feedback Collection**:

- [ ] Usability feedback
- [ ] Feature requests
- [ ] Bug reports
- [ ] Performance observations

---

### 5.4 Documentation

#### ☐ **Task 5.4.1**: Create User Guide

**File**: `/docs/purchasing-dashboard-user-guide.md`

**Sections**:

- [ ] Dashboard overview
- [ ] Widget descriptions
- [ ] How to use each widget
- [ ] Refresh and filtering
- [ ] Troubleshooting

---

#### ☐ **Task 5.4.2**: Create Developer Documentation

**File**: `/docs/purchasing-dashboard-developer-guide.md`

**Sections**:

- [ ] Architecture overview
- [ ] API endpoints documentation
- [ ] Component structure
- [ ] Adding new widgets
- [ ] Troubleshooting

---

#### ☐ **Task 5.4.3**: API Documentation

**File**: `/docs/api/purchasing-dashboard-api.md`

**Sections**:

- [ ] Endpoint specifications
- [ ] Request/response examples
- [ ] Query parameters
- [ ] Error codes
- [ ] Rate limiting

---

### Phase 5 Progress Tracker

- [ ] **5.1**: Dashboard layout pages created
- [ ] **5.2**: Navigation integration complete
- [ ] **5.3**: Testing complete (integration, performance, UAT)
- [ ] **5.4**: Documentation complete
- [ ] **Phase 5 Complete**: Integration & Testing done

---

## 📊 OVERALL PROJECT PROGRESS

### Overall Completion Checklist

- [ ] **Phase 1**: Foundation (API & Data Layer) - 0%
- [ ] **Phase 2**: Owner Dashboard Widgets - 0%
- [ ] **Phase 3**: Warehouse Widgets Part 1 - 0%
- [ ] **Phase 4**: Warehouse Widgets Part 2 - 0%
- [ ] **Phase 5**: Integration & Testing - 0%
- [ ] **Project Complete**: All widgets deployed to production

---

## 🎯 Success Criteria

### Functional Requirements

- [ ] All 13 widgets functional and displaying correct data
- [ ] Real-time updates working (5-min refresh)
- [ ] Click navigation working for all widgets
- [ ] Responsive design on mobile/tablet/desktop
- [ ] Error handling for all failure scenarios
- [ ] Loading states for all async operations

### Performance Requirements

- [ ] Dashboard load time < 3 seconds
- [ ] API response time < 2 seconds
- [ ] Widget render time < 500ms
- [ ] No memory leaks on auto-refresh
- [ ] Lighthouse score > 90

### Security Requirements

- [ ] Proper authentication checks
- [ ] Role-based access control (RBAC)
- [ ] Business unit data isolation
- [ ] API rate limiting
- [ ] Input validation and sanitization

### Usability Requirements

- [ ] Intuitive widget layouts
- [ ] Clear labels and descriptions
- [ ] Helpful empty states
- [ ] Actionable error messages
- [ ] Accessible (WCAG 2.1 Level AA)

---

## 📝 Notes & Assumptions

### Assumptions

1. All database tables exist (from migration 20260131000000)
2. Existing purchasing APIs are functional
3. Permissions system is configured
4. Recharts or Chart.js is already in the project
5. Shadcn/ui components are available

### Out of Scope

- Mobile app (native iOS/Android)
- Real-time WebSocket updates
- Advanced analytics (predictive, ML)
- Export to Excel/PDF
- Scheduled email reports
- Custom widget builder
- Dashboard customization per user

### Future Enhancements (Post-MVP)

1. Drag-and-drop widget rearrangement
2. Custom date range filters
3. Drill-down reports
4. Export functionality (CSV, PDF)
5. Email alerts for critical metrics
6. Mobile push notifications
7. Historical trend analysis
8. Forecasting and predictions
9. Comparison views (YoY, MoM)
10. Custom widget creation

---

## 📞 Support & Contact

**Project Lead**: TBD
**Development Team**: TBD
**QA Team**: TBD
**Product Owner**: TBD

---

## 📅 Timeline Estimate

| Phase     | Tasks                        | Estimated Time              | Dependencies                   |
| --------- | ---------------------------- | --------------------------- | ------------------------------ |
| Phase 1   | API & Data Layer             | 5-7 days                    | Database schema, existing APIs |
| Phase 2   | Owner Widgets (4)            | 4-5 days                    | Phase 1 complete               |
| Phase 3   | Warehouse Widgets Part 1 (5) | 6-8 days                    | Phase 1 complete               |
| Phase 4   | Warehouse Widgets Part 2 (4) | 5-6 days                    | Phase 1 complete               |
| Phase 5   | Integration & Testing        | 4-5 days                    | All widgets complete           |
| **Total** | **All Phases**               | **24-31 days** (~5-6 weeks) |                                |

**Note**: Timeline assumes 1 full-time developer. Can be parallelized with multiple developers.

---

## ✅ Definition of Done

A widget is considered "done" when:

- [ ] Component code written and reviewed
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] Responsive design implemented
- [ ] Error handling implemented
- [ ] Loading states implemented
- [ ] Accessibility checked
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Code review approved
- [ ] Deployed to staging
- [ ] UAT completed
- [ ] Deployed to production

---

**End of Implementation Plan**

---

## Change Log

| Date       | Change               | Author       |
| ---------- | -------------------- | ------------ |
| 2026-02-11 | Initial plan created | AI Assistant |
