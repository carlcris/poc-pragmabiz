/**
 * Purchasing Dashboard Widget Types
 *
 * Type definitions for all dashboard widgets in the purchasing module.
 * These types define the data structures returned by the dashboard API.
 */

import type { LoadListStatus } from './load-list';

// ============================================================================
// WIDGET DATA TYPES
// ============================================================================

/**
 * Outstanding Requisitions Widget Data
 * Shows active stock requisitions count and total value
 */
export type OutstandingRequisitionsData = {
  count: number;
  totalValue: number;
  items: DashboardStockRequisition[];
};

/**
 * Damaged Items Widget Data
 * Shows damaged items this month with breakdowns by supplier and damage type
 */
export type DamagedItemsData = {
  count: number;
  totalValue: number;
  bySupplier: SupplierDamageStats[];
  byDamageType: DamageTypeStats[];
};

export type SupplierDamageStats = {
  supplierId: string;
  supplierName: string;
  count: number;
  value: number;
};

export type DamageTypeStats = {
  damageType: DamageType;
  count: number;
};

/**
 * Expected Arrivals Widget Data
 * Shows load lists expected to arrive this week
 */
export type ExpectedArrivalsData = {
  count: number;
  items: DashboardLoadList[];
};

/**
 * Delayed Shipments Widget Data
 * Shows load lists that are past their estimated arrival date
 */
export type DelayedShipmentsData = {
  count: number;
  items: DashboardLoadList[];
};

/**
 * Today's Receiving Queue Widget Data
 * Shows load lists that arrived today and need receiving
 */
export type TodaysReceivingQueueData = {
  count: number;
  items: DashboardLoadList[];
};

/**
 * Pending Approvals Widget Data
 * Shows GRNs awaiting approval
 */
export type PendingApprovalsData = {
  count: number;
  items: DashboardGRN[];
};

/**
 * Box Assignment Queue Item
 * Represents an item that needs box assignment
 */
export type BoxAssignmentQueueItem = {
  grnId: string;
  grnNumber: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  receivedQty: number;
  boxesAssigned: number;
};

/**
 * Box Assignment Queue Widget Data
 * Shows items that need box assignments
 */
export type BoxAssignmentQueueData = {
  count: number;
  items: BoxAssignmentQueueItem[];
};

/**
 * Warehouse Capacity Widget Data
 * Shows warehouse space utilization metrics
 */
export type WarehouseCapacityData = {
  totalLocations: number;
  occupiedLocations: number;
  utilizationPercent: number;
  availableSpace: number;
};

/**
 * Active Requisitions Widget Data
 * Shows breakdown of stock requisitions by status
 */
export type ActiveRequisitionsData = {
  draft: number;
  submitted: number;
  partiallyFulfilled: number;
  fulfilled: number;
  cancelled: number;
  total: number;
};

/**
 * Incoming Delivery with Stock Requisitions
 * Represents a load list with its linked stock requisitions
 */
export type IncomingDeliveryWithSRs = {
  loadList: DashboardLoadList;
  linkedRequisitions: DashboardStockRequisition[];
};

/**
 * Incoming Deliveries Widget Data
 * Shows upcoming deliveries with their linked requisitions
 */
export type IncomingDeliveriesData = {
  count: number;
  items: IncomingDeliveryWithSRs[];
};

/**
 * Active Container Item
 * Represents a container in transit
 */
export type ActiveContainerItem = {
  containerNumber: string;
  loadListId: string;
  llNumber: string;
  status: LoadListStatus;
  estimatedArrival: string;
  supplierName: string;
};

/**
 * Active Containers Widget Data
 * Shows containers currently in transit
 */
export type ActiveContainersData = {
  count: number;
  items: ActiveContainerItem[];
};

/**
 * Location Assignment Status Widget Data
 * Shows warehouse location assignment metrics
 */
export type LocationAssignmentStatusData = {
  totalBoxes: number;
  assignedBoxes: number;
  unassignedBoxes: number;
  assignmentPercent: number;
};

// ============================================================================
// MAIN DASHBOARD RESPONSE
// ============================================================================

/**
 * Purchasing Dashboard Data
 * Main response type for the dashboard API
 * Contains data for all requested widgets
 */
export type PurchasingDashboardData = {
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
  locationAssignmentStatus?: LocationAssignmentStatusData;
};

// ============================================================================
// QUERY PARAMETERS
// ============================================================================

/**
 * Dashboard Query Parameters
 * Used to filter and customize dashboard data requests
 */
export type DashboardQueryParams = {
  /** Which widgets to fetch data for */
  widgets?: string[];
  /** Start date for time-based queries (ISO 8601) */
  dateFrom?: string;
  /** End date for time-based queries (ISO 8601) */
  dateTo?: string;
  /** Filter by specific warehouse */
  warehouseId?: string;
  /** Filter by business unit */
  businessUnitId?: string;
};

/**
 * Widget Names
 * Type-safe widget identifiers
 */
export type WidgetName =
  | 'outstandingRequisitions'
  | 'damagedItemsThisMonth'
  | 'expectedArrivalsThisWeek'
  | 'delayedShipments'
  | 'todaysReceivingQueue'
  | 'pendingApprovals'
  | 'boxAssignmentQueue'
  | 'warehouseCapacity'
  | 'activeRequisitions'
  | 'incomingDeliveriesWithSRs'
  | 'activeContainers'
  | 'locationAssignmentStatus';
export type DamageType = 'broken' | 'defective' | 'missing' | 'expired' | 'wrong_item' | 'other';

export type DashboardSupplier = {
  id?: string;
  supplier_name?: string;
  supplier_code?: string;
};

export type DashboardWarehouse = {
  id?: string;
  warehouse_name?: string;
  warehouse_code?: string;
};

export type DashboardLoadList = {
  id: string;
  ll_number: string;
  status: LoadListStatus;
  supplier?: DashboardSupplier | null;
  warehouse?: DashboardWarehouse | null;
  estimated_arrival_date?: string | null;
  actual_arrival_date?: string | null;
  container_number?: string | null;
};

export type DashboardStockRequisition = {
  id: string;
  sr_number: string;
  status: 'draft' | 'submitted' | 'partially_fulfilled' | 'fulfilled' | 'cancelled';
  total_amount: number;
  business_unit?: {
    id: string;
    name: string;
    code: string;
  } | null;
  warehouse?: DashboardWarehouse | null;
};

export type DashboardGRN = {
  id: string;
  grn_number: string;
  created_at?: string | null;
  load_list?: {
    id?: string;
    ll_number?: string | null;
  } | null;
};
