import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextResponse } from "next/server";
import type { DashboardData, Priority } from "@/types/warehouse-dashboard";

type PickListQueueRow = {
  id: string;
  request_code: string;
  required_date: string;
  priority: Priority;
  status: string;
  users?: { email?: string | null } | null;
  stock_request_items?: Array<{ id: string }> | null;
};

type IncomingDeliveriesQueueRow = {
  id: string;
  ll_number: string;
  estimated_arrival_date: string | null;
  status: string;
  suppliers?: { supplier_name?: string | null } | null;
  load_list_items?: Array<{ id: string }> | null;
};

type StockRequestsQueueRow = {
  id: string;
  request_code: string;
  required_date: string;
  priority: Priority;
  status: string;
  users?: { email?: string | null } | null;
  stock_request_items?: Array<{ id: string }> | null;
};

type StockMovementsRow = {
  quantity: number;
  stock_transactions:
    | {
        transaction_type: string;
        created_at: string;
        users?: { email?: string | null } | { email?: string | null }[] | null;
      }
    | {
        transaction_type: string;
        created_at: string;
        users?: { email?: string | null } | { email?: string | null }[] | null;
      }[]
    | null;
  items: { item_name: string } | { item_name: string }[] | null;
  units_of_measure: { symbol: string } | { symbol: string }[] | null;
};

export async function GET() {
  try {
    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's accessible business units
    const { data: userBUAccess } = await supabase
      .from("user_business_unit_access")
      .select("business_unit_id")
      .eq("user_id", user.id);

    const accessibleBUIds = userBUAccess?.map((access) => access.business_unit_id) || [];
    const scopedBUIds = currentBusinessUnitId ? [currentBusinessUnitId] : accessibleBUIds;

    if (scopedBUIds.length === 0) {
      return NextResponse.json({ error: "No business unit access" }, { status: 403 });
    }

    // Execute all queries in parallel for performance
    const [
      incomingDeliveriesTodayResult,
      pendingStockRequestsResult,
      urgentStockRequestsResult,
      pickListToPickResult,
      inventoryHealthResult,
      pickListQueueResult,
      incomingDeliveriesQueueResult,
      stockRequestsQueueResult,
      stockMovementsResult,
    ] = await Promise.all([
      // Summary: Incoming deliveries (load lists in transit/receiving)
      supabase
        .from("load_lists")
        .select("id", { count: "exact", head: true })
        .in("business_unit_id", accessibleBUIds)
        .in("status", ["in_transit", "receiving"])
        .is("deleted_at", null),

      // Summary: Pending stock requests
      supabase
        .from("stock_requests")
        .select("id", { count: "exact", head: true })
        .in("business_unit_id", scopedBUIds)
        .in("status", ["submitted", "approved"])
        .is("deleted_at", null),

      // Summary: Urgent stock requests needing attention
      supabase
        .from("stock_requests")
        .select("id", { count: "exact", head: true })
        .in("business_unit_id", scopedBUIds)
        .in("status", ["submitted", "approved", "ready_for_pick"])
        .eq("priority", "urgent")
        .is("deleted_at", null),

      // Summary: Pick list to pick
      supabase
        .from("stock_requests")
        .select("id", { count: "exact", head: true })
        .in("business_unit_id", scopedBUIds)
        .eq("status", "ready_for_pick")
        .is("deleted_at", null),

      // Inventory health (low + out of stock)
      supabase
        .from("item_warehouse")
        .select(
          `
          item_id,
          warehouse_id,
          current_stock,
          reorder_level,
          warehouses!inner(business_unit_id),
          warehouse_locations!item_warehouse_default_location_id_fkey(code),
          items!inner(item_name, units_of_measure!inner(symbol))
        `
        )
        .in("warehouses.business_unit_id", scopedBUIds)
        .is("deleted_at", null)
        .order("current_stock", { ascending: true }),

      // Pick list queue
      supabase
        .from("stock_requests")
        .select(
          `
          id,
          request_code,
          required_date,
          priority,
          status,
          created_by,
          users!stock_requests_created_by_fkey(email),
          stock_request_items(id)
        `
        )
        .in("business_unit_id", scopedBUIds)
        .eq("status", "ready_for_pick")
        .is("deleted_at", null)
        .order("priority", { ascending: false })
        .order("required_date", { ascending: true })
        .limit(12),

      // Incoming deliveries queue (load lists)
      supabase
        .from("load_lists")
        .select(
          `
          id,
          ll_number,
          estimated_arrival_date,
          status,
          suppliers(supplier_name),
          load_list_items(id)
        `
        )
        .in("business_unit_id", accessibleBUIds)
        .in("status", ["in_transit", "receiving"])
        .is("deleted_at", null)
        .order("estimated_arrival_date", { ascending: true })
        .limit(12),

      // Stock requests queue
      supabase
        .from("stock_requests")
        .select(
          `
          id,
          request_code,
          request_date,
          priority,
          status,
          required_date,
          created_by,
          users!stock_requests_created_by_fkey(email),
          stock_request_items(id)
        `
        )
        .in("business_unit_id", scopedBUIds)
        .in("status", ["submitted", "approved"])
        .is("deleted_at", null)
        .order("priority", { ascending: false })
        .order("request_date", { ascending: true })
        .limit(12),

      // Last 5 stock movements
      supabase
        .from("stock_transaction_items")
        .select(
          `
          quantity,
          stock_transactions!inner(
            transaction_type,
            created_at,
            business_unit_id,
            users!stock_transactions_created_by_fkey(email)
          ),
          items!inner(item_name),
          units_of_measure!inner(symbol)
        `
        )
        .in("stock_transactions.business_unit_id", scopedBUIds)
        .order("stock_transactions(created_at)", { ascending: false })
        .limit(5),
    ]);

    // Check for errors
    if (incomingDeliveriesTodayResult.error) throw incomingDeliveriesTodayResult.error;
    if (pendingStockRequestsResult.error) throw pendingStockRequestsResult.error;
    if (urgentStockRequestsResult.error) throw urgentStockRequestsResult.error;
    if (pickListToPickResult.error) throw pickListToPickResult.error;
    if (inventoryHealthResult.error) throw inventoryHealthResult.error;
    if (pickListQueueResult.error) throw pickListQueueResult.error;
    if (incomingDeliveriesQueueResult.error) throw incomingDeliveriesQueueResult.error;
    if (stockRequestsQueueResult.error) throw stockRequestsQueueResult.error;
    if (stockMovementsResult.error) throw stockMovementsResult.error;

    const inventoryRows = (inventoryHealthResult.data || []) as Array<{
      item_id: string;
      warehouse_id: string;
      current_stock: number | string | null;
      reorder_level: number | string | null;
      warehouse_locations?: { code?: string | null } | { code?: string | null }[] | null;
      items:
        | { item_name: string; units_of_measure: { symbol: string } | { symbol: string }[] }
        | { item_name: string; units_of_measure: { symbol: string } | { symbol: string }[] }[]
        | null;
    }>;

    const aggregatedInventory = new Map<
      string,
      {
        item_id: string;
        item_name: string;
        qty: number;
        reorder_level: number;
        uom: string;
        location_code: string | null;
        hasMultipleLocations: boolean;
      }
    >();

    for (const row of inventoryRows) {
      const itemRecord = Array.isArray(row.items) ? row.items[0] ?? null : row.items ?? null;
      const uomRecord = Array.isArray(itemRecord?.units_of_measure)
        ? itemRecord?.units_of_measure[0] ?? null
        : itemRecord?.units_of_measure ?? null;
      const locationRecord = Array.isArray(row.warehouse_locations)
        ? row.warehouse_locations[0] ?? null
        : row.warehouse_locations ?? null;
      const qty = Number(row.current_stock || 0);
      const reorderLevel = Number(row.reorder_level || 0);
      const locationCode = locationRecord?.code || null;

      const existing = aggregatedInventory.get(row.item_id);
      if (existing) {
        existing.qty += qty;
        existing.reorder_level += reorderLevel;
        if (existing.location_code !== locationCode) {
          existing.hasMultipleLocations = true;
          existing.location_code = null;
        }
      } else {
        aggregatedInventory.set(row.item_id, {
          item_id: row.item_id,
          item_name: itemRecord?.item_name || "",
          qty,
          reorder_level: reorderLevel,
          uom: uomRecord?.symbol || "",
          location_code: locationCode,
          hasMultipleLocations: false,
        });
      }
    }

    const aggregatedList = Array.from(aggregatedInventory.values());
    const pickListQueue = (pickListQueueResult.data || []) as PickListQueueRow[];
    const incomingDeliveriesQueue = (incomingDeliveriesQueueResult.data ||
      []) as IncomingDeliveriesQueueRow[];
    const stockRequestsQueue = (stockRequestsQueueResult.data || []) as StockRequestsQueueRow[];
    const stockMovements = (stockMovementsResult.data || []) as StockMovementsRow[];
    const lowStocks = aggregatedList
      .filter((item) => item.reorder_level > 0 && item.qty > 0 && item.qty <= item.reorder_level)
      .sort((a, b) => a.qty - b.qty)
      .slice(0, 8);

    const outOfStocks = aggregatedList
      .filter((item) => item.qty <= 0)
      .sort((a, b) => a.qty - b.qty)
      .slice(0, 8);

    // Build response
    const dashboardData: DashboardData = {
      summary: {
        incoming_deliveries_today: incomingDeliveriesTodayResult.count || 0,
        pending_stock_requests: pendingStockRequestsResult.count || 0,
        pick_list_to_pick: pickListToPickResult.count || 0,
        urgent_stock_requests: urgentStockRequestsResult.count || 0,
      },
      low_stocks: lowStocks.map((item) => ({
        item_id: item.item_id,
        item_name: item.item_name,
        qty: item.qty,
        uom: item.uom,
        location_code: item.location_code,
        reorder_level: item.reorder_level,
      })),
      out_of_stocks: outOfStocks.map((item) => ({
        item_id: item.item_id,
        item_name: item.item_name,
        qty: item.qty,
        uom: item.uom,
        location_code: item.location_code,
        last_moved_at: null, // TODO: derive from latest stock movement
      })),
      queues: {
        pick_list: pickListQueue.map((item) => ({
          id: item.id,
          request_code: item.request_code,
          lines: item.stock_request_items?.length || 0,
          priority: item.priority,
          status: item.status,
          required_date: item.required_date,
          requested_by: item.users?.email || "Unknown",
        })),
        incoming_deliveries: incomingDeliveriesQueue.map((item) => ({
          id: item.id,
          order_code: item.ll_number,
          supplier: item.suppliers?.supplier_name || "Unknown",
          eta: item.estimated_arrival_date || "",
          status: item.status,
          priority: "normal",
          lines: item.load_list_items?.length || 0,
        })),
        stock_requests: stockRequestsQueue.map((item) => ({
          id: item.id,
          request_code: item.request_code,
          requested_by: item.users?.email || "Unknown",
          lines: item.stock_request_items?.length || 0,
          priority: item.priority,
          status: item.status,
          required_date: item.required_date,
        })),
      },
      last_stock_movements: stockMovements.map((item) => {
        const transaction = Array.isArray(item.stock_transactions)
          ? item.stock_transactions[0] ?? null
          : item.stock_transactions ?? null;
        const user = Array.isArray(transaction?.users)
          ? transaction?.users[0] ?? null
          : transaction?.users ?? null;
        const itemRecord = Array.isArray(item.items) ? item.items[0] ?? null : item.items ?? null;
        const uomRecord = Array.isArray(item.units_of_measure)
          ? item.units_of_measure[0] ?? null
          : item.units_of_measure ?? null;

        return {
          type: transaction?.transaction_type || "",
          item_name: itemRecord?.item_name || "",
          qty: item.quantity,
          uom: uomRecord?.symbol || "",
          performed_by: user?.email || "Unknown",
          timestamp: transaction?.created_at || "",
        };
      }),
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error("Error in warehouse-dashboard API:", error);

    // Better error serialization
    let errorDetails = "Unknown error";
    if (error instanceof Error) {
      errorDetails = error.message;
    } else if (typeof error === "object" && error !== null) {
      errorDetails = JSON.stringify(error);
    } else {
      errorDetails = String(error);
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        details: errorDetails,
      },
      { status: 500 }
    );
  }
}
