import { createServerClientWithBU } from '@/lib/supabase/server-with-bu';
import { NextResponse } from 'next/server';
import type { DashboardData } from '@/types/warehouse-dashboard';

// Helper: Get today's date in Manila timezone (UTC+8)
function getTodayInManila(): string {
  const now = new Date();
  const manilaOffset = 8 * 60; // UTC+8 in minutes
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const manilaTime = new Date(utcTime + (manilaOffset * 60000));

  const year = manilaTime.getFullYear();
  const month = String(manilaTime.getMonth() + 1).padStart(2, '0');
  const day = String(manilaTime.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export async function GET() {
  try {
    const { supabase } = await createServerClientWithBU();

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's accessible business units
    const { data: userBUAccess } = await supabase
      .from('user_business_unit_access')
      .select('business_unit_id')
      .eq('user_id', user.id);

    const accessibleBUIds = userBUAccess?.map(access => access.business_unit_id) || [];

    if (accessibleBUIds.length === 0) {
      return NextResponse.json({ error: 'No business unit access' }, { status: 403 });
    }

    const today = getTodayInManila();

    // Execute all queries in parallel for performance
    const [
      incomingDeliveriesTodayResult,
      pendingStockRequestsResult,
      pickListToPickResult,
      inventoryHealthResult,
      pickListQueueResult,
      incomingDeliveriesQueueResult,
      stockRequestsQueueResult,
      stockMovementsResult,
    ] = await Promise.all([
      // Summary: Incoming deliveries today
      supabase
        .from('purchase_orders')
        .select('id', { count: 'exact', head: true })
        .in('business_unit_id', accessibleBUIds)
        .eq('status', 'approved')
        .eq('expected_delivery_date', today)
        .is('deleted_at', null),

      // Summary: Pending stock requests
      supabase
        .from('stock_requests')
        .select('id', { count: 'exact', head: true })
        .in('business_unit_id', accessibleBUIds)
        .in('status', ['submitted', 'approved'])
        .is('deleted_at', null),

      // Summary: Pick list to pick
      supabase
        .from('stock_requests')
        .select('id', { count: 'exact', head: true })
        .in('business_unit_id', accessibleBUIds)
        .eq('status', 'ready_for_pick')
        .is('deleted_at', null),

      // Inventory health (low + out of stock)
      supabase
        .from('item_warehouse')
        .select(`
          item_id,
          warehouse_id,
          current_stock,
          reorder_level,
          warehouses!inner(business_unit_id),
          warehouse_locations!item_warehouse_default_location_id_fkey(code),
          items!inner(item_name, units_of_measure!inner(symbol))
        `)
        .in('warehouses.business_unit_id', accessibleBUIds)
        .is('deleted_at', null)
        .order('current_stock', { ascending: true }),

      // Pick list queue
      supabase
        .from('stock_requests')
        .select(`
          id,
          request_code,
          required_date,
          priority,
          status,
          created_by,
          users!stock_requests_created_by_fkey(email),
          stock_request_items(id)
        `)
        .in('business_unit_id', accessibleBUIds)
        .eq('status', 'ready_for_pick')
        .is('deleted_at', null)
        .order('priority', { ascending: false })
        .order('required_date', { ascending: true })
        .limit(12),

      // Incoming deliveries queue
      supabase
        .from('purchase_orders')
        .select(`
          id,
          order_code,
          expected_delivery_date,
          priority,
          status,
          suppliers(supplier_name),
          purchase_order_items(id)
        `)
        .in('business_unit_id', accessibleBUIds)
        .eq('status', 'approved')
        .is('deleted_at', null)
        .order('priority', { ascending: false })
        .order('expected_delivery_date', { ascending: true })
        .limit(12),

      // Stock requests queue
      supabase
        .from('stock_requests')
        .select(`
          id,
          request_code,
          request_date,
          priority,
          status,
          required_date,
          created_by,
          users!stock_requests_created_by_fkey(email),
          stock_request_items(id)
        `)
        .in('business_unit_id', accessibleBUIds)
        .in('status', ['submitted', 'approved'])
        .is('deleted_at', null)
        .order('priority', { ascending: false })
        .order('request_date', { ascending: true })
        .limit(12),

      // Last 5 stock movements
      supabase
        .from('stock_transaction_items')
        .select(`
          quantity,
          stock_transactions!inner(
            transaction_type,
            created_at,
            business_unit_id,
            users!stock_transactions_created_by_fkey(email)
          ),
          items!inner(item_name),
          units_of_measure!inner(symbol)
        `)
        .in('stock_transactions.business_unit_id', accessibleBUIds)
        .order('stock_transactions(created_at)', { ascending: false })
        .limit(5),
    ]);

    // Check for errors
    if (incomingDeliveriesTodayResult.error) throw incomingDeliveriesTodayResult.error;
    if (pendingStockRequestsResult.error) throw pendingStockRequestsResult.error;
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
      warehouse_locations?: { code?: string | null } | null;
      items: { item_name: string; units_of_measure: { symbol: string } };
    }>;

    const aggregatedInventory = new Map<string, {
      item_id: string;
      item_name: string;
      qty: number;
      reorder_level: number;
      uom: string;
      location_code: string | null;
      hasMultipleLocations: boolean;
    }>();

    for (const row of inventoryRows) {
      const qty = Number(row.current_stock || 0);
      const reorderLevel = Number(row.reorder_level || 0);
      const locationCode = row.warehouse_locations?.code || null;

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
          item_name: row.items.item_name,
          qty,
          reorder_level: reorderLevel,
          uom: row.items.units_of_measure.symbol,
          location_code: locationCode,
          hasMultipleLocations: false,
        });
      }
    }

    const aggregatedList = Array.from(aggregatedInventory.values());
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
        pick_list: (pickListQueueResult.data || []).map((item: any) => ({
          id: item.id,
          request_code: item.request_code,
          lines: item.stock_request_items?.length || 0,
          priority: item.priority,
          status: item.status,
          required_date: item.required_date,
          requested_by: item.users?.email || 'Unknown',
        })),
        incoming_deliveries: (incomingDeliveriesQueueResult.data || []).map((item: any) => ({
          id: item.id,
          order_code: item.order_code,
          supplier: item.suppliers?.supplier_name || 'Unknown',
          eta: item.expected_delivery_date,
          status: item.status,
          priority: item.priority,
          lines: item.purchase_order_items?.length || 0,
        })),
        stock_requests: (stockRequestsQueueResult.data || []).map((item: any) => ({
          id: item.id,
          request_code: item.request_code,
          requested_by: item.users?.email || 'Unknown',
          lines: item.stock_request_items?.length || 0,
          priority: item.priority,
          status: item.status,
          required_date: item.required_date,
        })),
      },
      last_stock_movements: (stockMovementsResult.data || []).map((item: any) => ({
        type: item.stock_transactions.transaction_type,
        item_name: item.items.item_name,
        qty: item.quantity,
        uom: item.units_of_measure.symbol,
        performed_by: item.stock_transactions.users?.email || 'Unknown',
        timestamp: item.stock_transactions.created_at,
      })),
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('Error in warehouse-dashboard API:', error);

    // Better error serialization
    let errorDetails = 'Unknown error';
    if (error instanceof Error) {
      errorDetails = error.message;
    } else if (typeof error === 'object' && error !== null) {
      errorDetails = JSON.stringify(error);
    } else {
      errorDetails = String(error);
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: errorDetails
      },
      { status: 500 }
    );
  }
}
