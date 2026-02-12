import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import type {
  PurchasingDashboardData,
  WidgetName,
  DamageType,
  DashboardLoadList,
  DashboardStockRequisition,
  DashboardGRN,
} from "@/types/purchasing-dashboard";
import type { LoadListStatus } from "@/types/load-list";

/**
 * GET /api/dashboard/purchasing
 *
 * Fetches dashboard widget data for the purchasing module.
 * Supports selective widget fetching via query parameters.
 *
 * Query Parameters:
 * - widgets: Comma-separated list of widget names to fetch
 * - dateFrom: Start date for time-based queries (ISO 8601)
 * - dateTo: End date for time-based queries (ISO 8601)
 * - warehouseId: Filter by specific warehouse
 * - businessUnitId: Filter by business unit
 */
export async function GET(request: NextRequest) {
  try {
    // Check permissions - user needs view access to load lists or requisitions
    await requirePermission(RESOURCES.LOAD_LISTS, "view");

    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();
    const { searchParams } = new URL(request.url);

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's company
    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    const companyId = userData.company_id;

    // Parse query parameters
    const widgetsParam = searchParams.get("widgets");
    const requestedWidgets: WidgetName[] = widgetsParam
      ? (widgetsParam.split(",") as WidgetName[])
      : [];

    const warehouseId = searchParams.get("warehouseId");
    const businessUnitId = searchParams.get("businessUnitId") || currentBusinessUnitId;

    const damageTypes: DamageType[] = [
      "broken",
      "defective",
      "missing",
      "expired",
      "wrong_item",
      "other",
    ];
    const normalizeDamageType = (value: string | null): DamageType => {
      if (value && damageTypes.includes(value as DamageType)) {
        return value as DamageType;
      }
      return "other";
    };


    // Initialize response object
    const dashboardData: PurchasingDashboardData = {};

    // Helper function to check if a widget is requested
    const shouldFetch = (widgetName: WidgetName): boolean => {
      return requestedWidgets.length === 0 || requestedWidgets.includes(widgetName);
    };

    // ========================================================================
    // 1. Outstanding Requisitions
    // ========================================================================
    if (shouldFetch("outstandingRequisitions")) {
      let query = supabase
        .from("stock_requisitions")
        .select(
          `
          id,
          sr_number,
          company_id,
          business_unit_id,
          status,
          total_amount,
          created_at,
          business_unit:business_units(id, name, code)
        `,
          { count: "exact" }
        )
        .eq("company_id", companyId)
        .in("status", ["submitted", "partially_fulfilled"])
        .is("deleted_at", null);

      if (businessUnitId) {
        query = query.eq("business_unit_id", businessUnitId);
      }

      const { data, error, count } = await query.order("created_at", { ascending: false });

      if (!error && data) {
        type StockRequisitionRow = {
          id: string;
          sr_number: string;
          status: DashboardStockRequisition["status"];
          total_amount: number | string | null;
          business_unit?:
            | { id: string; name: string; code: string }
            | { id: string; name: string; code: string }[]
            | null;
        };

        const rows = data as StockRequisitionRow[];
        const requisitions: DashboardStockRequisition[] = rows.map((row) => {
          const businessUnit = Array.isArray(row.business_unit)
            ? row.business_unit[0] ?? null
            : row.business_unit ?? null;
          return {
            id: row.id,
            sr_number: row.sr_number,
            status: row.status,
            total_amount: Number(row.total_amount) || 0,
            business_unit: businessUnit,
            warehouse: null,
          };
        });

        const totalValue = requisitions.reduce((sum, sr) => sum + sr.total_amount, 0);

        dashboardData.outstandingRequisitions = {
          count: count || 0,
          totalValue,
          items: requisitions,
        };
      }
    }

    // ========================================================================
    // 2. Damaged Items This Month
    // ========================================================================
    if (shouldFetch("damagedItemsThisMonth")) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      type DamagedItemRow = {
        qty: number | null;
        damage_type: string | null;
        grns?: {
          load_lists?: {
            suppliers?: {
              id: string;
              supplier_name: string;
            } | null;
          } | null;
        } | null;
        items?: {
          cost_price?: number | null;
          purchase_price?: number | null;
        } | null;
      };

      const query = supabase
        .from("damaged_items")
        .select(
          `
          id,
          qty,
          damage_type,
          reported_date,
          grns!inner(
            load_list_id,
            business_unit_id,
            warehouse_id,
            load_lists!inner(
              supplier_id,
              suppliers(id, supplier_name)
            )
          ),
          items!inner(
            cost_price,
            purchase_price
          )
        `
        )
        .gte("reported_date", startOfMonth)
        .lte("reported_date", endOfMonth);

      if (businessUnitId) {
        query.eq("grns.business_unit_id", businessUnitId);
      }

      if (warehouseId) {
        query.eq("grns.warehouse_id", warehouseId);
      }

      const { data, error } = await query;

      if (!error && data) {
        const rows = data as DamagedItemRow[];
        const totalQty = rows.reduce((sum, item) => sum + (item.qty || 0), 0);

        // Calculate total value
        const totalValue = rows.reduce((sum, item) => {
          const unitCost = item.items?.cost_price ?? item.items?.purchase_price ?? 0;
          const damagedQty = item.qty || 0;
          return sum + unitCost * damagedQty;
        }, 0);

        // Group by supplier
        const supplierMap = new Map<string, { id: string; name: string; count: number; value: number }>();
        rows.forEach((item) => {
          const supplier = item.grns?.load_lists?.suppliers;

          if (supplier) {
            const supplierId = supplier.id;
            const existing = supplierMap.get(supplierId) || {
              id: supplierId,
              name: supplier.supplier_name,
              count: 0,
              value: 0,
            };

            const unitCost = item.items?.cost_price ?? item.items?.purchase_price ?? 0;
            const damagedQty = item.qty || 0;
            existing.count += damagedQty;
            existing.value += unitCost * damagedQty;
            supplierMap.set(supplierId, existing);
          }
        });

        // Group by damage type
        const damageTypeMap = new Map<string, number>();
        rows.forEach((item) => {
          const type = item.damage_type || "other";
          const damagedQty = item.qty || 0;
          damageTypeMap.set(type, (damageTypeMap.get(type) || 0) + damagedQty);
        });

        dashboardData.damagedItemsThisMonth = {
          count: totalQty,
          totalValue,
          bySupplier: Array.from(supplierMap.values()).map((s) => ({
            supplierId: s.id,
            supplierName: s.name,
            count: s.count,
            value: s.value,
          })),
          byDamageType: Array.from(damageTypeMap.entries()).map(([type, count]) => ({
            damageType: normalizeDamageType(type),
            count,
          })),
        };
      }
    }

    // ========================================================================
    // 3. Expected Arrivals This Week
    // ========================================================================
    if (shouldFetch("expectedArrivalsThisWeek")) {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday
      endOfWeek.setHours(23, 59, 59, 999);

      let query = supabase
        .from("load_lists")
        .select(
          `
          *,
          supplier:suppliers(id, supplier_name, supplier_code),
          warehouse:warehouses(id, warehouse_name, warehouse_code)
        `,
          { count: "exact" }
        )
        .eq("company_id", companyId)
        .in("status", ["confirmed", "in_transit"])
        .gte("estimated_arrival_date", startOfWeek.toISOString().split("T")[0])
        .lte("estimated_arrival_date", endOfWeek.toISOString().split("T")[0])
        .is("deleted_at", null);

      if (businessUnitId) {
        query = query.eq("business_unit_id", businessUnitId);
      }

      if (warehouseId) {
        query = query.eq("warehouse_id", warehouseId);
      }

      const { data, error, count } = await query.order("estimated_arrival_date", { ascending: true });

      if (!error && data) {
        dashboardData.expectedArrivalsThisWeek = {
          count: count || 0,
          items: data as DashboardLoadList[],
        };
      }
    }

    // ========================================================================
    // 4. Delayed Shipments
    // ========================================================================
    if (shouldFetch("delayedShipments")) {
      const today = new Date().toISOString().split("T")[0];

      let query = supabase
        .from("load_lists")
        .select(
          `
          *,
          supplier:suppliers(id, supplier_name, supplier_code),
          warehouse:warehouses(id, warehouse_name, warehouse_code)
        `,
          { count: "exact" }
        )
        .eq("company_id", companyId)
        .not("status", "in", '("received","cancelled")')
        .lt("estimated_arrival_date", today)
        .is("deleted_at", null);

      if (businessUnitId) {
        query = query.eq("business_unit_id", businessUnitId);
      }

      if (warehouseId) {
        query = query.eq("warehouse_id", warehouseId);
      }

      const { data, error, count } = await query.order("estimated_arrival_date", { ascending: true });

      if (!error && data) {
        dashboardData.delayedShipments = {
          count: count || 0,
          items: data as DashboardLoadList[],
        };
      }
    }

    // ========================================================================
    // 5. Today's Receiving Queue
    // ========================================================================
    if (shouldFetch("todaysReceivingQueue")) {
      const today = new Date().toISOString().split("T")[0];

      let query = supabase
        .from("load_lists")
        .select(
          `
          *,
          supplier:suppliers(id, supplier_name, supplier_code),
          warehouse:warehouses(id, warehouse_name, warehouse_code)
        `,
          { count: "exact" }
        )
        .eq("company_id", companyId)
        .eq("actual_arrival_date", today)
        .in("status", ["arrived", "receiving"])
        .is("deleted_at", null);

      if (businessUnitId) {
        query = query.eq("business_unit_id", businessUnitId);
      }

      if (warehouseId) {
        query = query.eq("warehouse_id", warehouseId);
      }

      const { data, error, count } = await query.order("actual_arrival_date", { ascending: true });

      if (!error && data) {
        dashboardData.todaysReceivingQueue = {
          count: count || 0,
          items: data as DashboardLoadList[],
        };
      }
    }

    // ========================================================================
    // 6. Pending Approvals
    // ========================================================================
    if (shouldFetch("pendingApprovals")) {
      const query = supabase
        .from("grns")
        .select(
          `
          *,
          load_list:load_lists(
            id,
            ll_number,
            supplier:suppliers(id, supplier_name)
          )
        `,
          { count: "exact" }
        )
        .eq("status", "pending_approval")
        .is("deleted_at", null);

      const { data, error, count } = await query.order("created_at", { ascending: true });

      if (!error && data) {
        dashboardData.pendingApprovals = {
          count: count || 0,
          items: data as DashboardGRN[],
        };
      }
    }

    // ========================================================================
    // 7. Box Assignment Queue
    // ========================================================================
    if (shouldFetch("boxAssignmentQueue")) {
      // Items that have been received but don't have box assignments yet
      const { data, error } = await supabase
        .from("grn_items")
        .select(
          `
          id,
          grn_id,
          item_id,
          received_qty,
          grns!inner(grn_number),
          items!inner(item_name, item_code)
        `
        )
        .gt("received_qty", 0);

      if (!error && data) {
        type GrnItemRow = {
          id: string;
          grn_id: string;
          item_id: string;
          received_qty: number | null;
          grns?: { grn_number?: string | null } | null;
          items?: { item_name?: string | null; item_code?: string | null } | null;
        };
        const grnItems = data as GrnItemRow[];

        // For each GRN item, count how many boxes are assigned
        const itemsWithBoxCounts = await Promise.all(
          grnItems.map(async (grnItem) => {
            const { count: boxCount } = await supabase
              .from("grn_boxes")
              .select("*", { count: "exact", head: true })
              .eq("grn_item_id", grnItem.id);

            const grnNumber = grnItem.grns?.grn_number || "";
            const itemName = grnItem.items?.item_name || "";
            const itemCode = grnItem.items?.item_code || "";

            return {
              grnId: grnItem.grn_id,
              grnNumber,
              itemId: grnItem.item_id,
              itemName,
              itemCode,
              receivedQty: grnItem.received_qty || 0,
              boxesAssigned: boxCount || 0,
            };
          })
        );

        // Filter only items that don't have boxes assigned
        const itemsNeedingBoxes = itemsWithBoxCounts.filter((item) => item.boxesAssigned === 0);

        dashboardData.boxAssignmentQueue = {
          count: itemsNeedingBoxes.length,
          items: itemsNeedingBoxes,
        };
      }
    }

    // ========================================================================
    // 8. Warehouse Capacity
    // ========================================================================
    if (shouldFetch("warehouseCapacity")) {
      let query = supabase
        .from("warehouse_locations")
        .select("id, is_occupied", { count: "exact" });

      if (warehouseId) {
        query = query.eq("warehouse_id", warehouseId);
      }

      const { data, error, count } = await query;

      if (!error && data) {
        const totalLocations = count || 0;
        const occupiedLocations = data.filter((loc) => loc.is_occupied).length;
        const availableSpace = totalLocations - occupiedLocations;
        const utilizationPercent = totalLocations > 0 ? (occupiedLocations / totalLocations) * 100 : 0;

        dashboardData.warehouseCapacity = {
          totalLocations,
          occupiedLocations,
          utilizationPercent: Math.round(utilizationPercent * 100) / 100,
          availableSpace,
        };
      }
    }

    // ========================================================================
    // 9. Active Requisitions by Status
    // ========================================================================
    if (shouldFetch("activeRequisitions")) {
      let query = supabase
        .from("stock_requisitions")
        .select("status", { count: "exact" })
        .eq("company_id", companyId)
        .is("deleted_at", null);

      if (businessUnitId) {
        query = query.eq("business_unit_id", businessUnitId);
      }

      const { data, error } = await query;

      if (!error && data) {
        const statusCounts = {
          draft: 0,
          submitted: 0,
          partiallyFulfilled: 0,
          fulfilled: 0,
          cancelled: 0,
        };

        data.forEach((sr) => {
          const status = sr.status;
          if (status === "draft") statusCounts.draft++;
          else if (status === "submitted") statusCounts.submitted++;
          else if (status === "partially_fulfilled") statusCounts.partiallyFulfilled++;
          else if (status === "fulfilled") statusCounts.fulfilled++;
          else if (status === "cancelled") statusCounts.cancelled++;
        });

        dashboardData.activeRequisitions = {
          ...statusCounts,
          total: data.length,
        };
      }
    }

    // ========================================================================
    // 10. Incoming Deliveries with SRs
    // ========================================================================
    if (shouldFetch("incomingDeliveriesWithSRs")) {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      let query = supabase
        .from("load_lists")
        .select(
          `
          *,
          supplier:suppliers(id, supplier_name, supplier_code),
          warehouse:warehouses(id, warehouse_name, warehouse_code)
        `
        )
        .eq("company_id", companyId)
        .in("status", ["confirmed", "in_transit", "arrived"])
        .lte("estimated_arrival_date", nextWeek.toISOString().split("T")[0])
        .is("deleted_at", null);

      if (businessUnitId) {
        query = query.eq("business_unit_id", businessUnitId);
      }

      if (warehouseId) {
        query = query.eq("warehouse_id", warehouseId);
      }

      const { data: loadLists, error } = await query.order("estimated_arrival_date", { ascending: true });

      if (!error && loadLists) {
        // For each load list, get linked SRs
        const deliveriesWithSRs = await Promise.all(
          (loadLists as DashboardLoadList[]).map(async (ll) => {
            const { data: srLinks } = await supabase
              .from("load_list_sr_items")
              .select(
                `
                sr_item:stock_requisition_items!inner(
                  stock_requisition:stock_requisitions!inner(*)
                ),
                load_list_item:load_list_items!inner(
                  id,
                  load_list_id
                )
              `
              )
              .eq("load_list_item.load_list_id", ll.id);

            const srLinkRows =
              (srLinks as Array<{
                sr_item?: { stock_requisition?: DashboardStockRequisition | null } | null;
              }>) || [];
            const requisitions = srLinkRows
              .map((link) => link.sr_item?.stock_requisition || null)
              .filter((sr): sr is DashboardStockRequisition => Boolean(sr));
            const uniqueSRs = Array.from(new Map(requisitions.map((sr) => [sr.id, sr])).values());

            return {
              loadList: ll,
              linkedRequisitions: uniqueSRs,
            };
          })
        );

        // Filter to only include load lists that have linked SRs
        const deliveriesWithLinkedSRs = deliveriesWithSRs.filter(
          (d) => d.linkedRequisitions.length > 0
        );

        dashboardData.incomingDeliveriesWithSRs = {
          count: deliveriesWithLinkedSRs.length,
          items: deliveriesWithLinkedSRs,
        };
      }
    }

    // ========================================================================
    // 11. Active Containers
    // ========================================================================
    if (shouldFetch("activeContainers")) {
      let query = supabase
        .from("load_lists")
        .select(
          `
          id,
          ll_number,
          container_number,
          status,
          estimated_arrival_date,
          supplier:suppliers(supplier_name)
        `
        )
        .eq("company_id", companyId)
        .in("status", ["confirmed", "in_transit", "arrived"])
        .not("container_number", "is", null)
        .is("deleted_at", null);

      if (businessUnitId) {
        query = query.eq("business_unit_id", businessUnitId);
      }

      const { data, error } = await query.order("estimated_arrival_date", { ascending: true });

      if (!error && data) {
        const containers = (data as Array<{
          id: string;
          ll_number: string;
          container_number: string | null;
          status: LoadListStatus;
          estimated_arrival_date: string | null;
          supplier?: { supplier_name?: string | null } | null;
        }>).map((ll) => ({
          containerNumber: ll.container_number || "",
          loadListId: ll.id,
          llNumber: ll.ll_number,
          status: ll.status,
          estimatedArrival: ll.estimated_arrival_date || "",
          supplierName: ll.supplier?.supplier_name || "",
        }));

        dashboardData.activeContainers = {
          count: containers.length,
          items: containers,
        };
      }
    }

    // ========================================================================
    // 12. Location Assignment Status
    // ========================================================================
    if (shouldFetch("locationAssignmentStatus")) {
      const { data: boxes, error } = await supabase
        .from("grn_boxes")
        .select("id, warehouse_location_id", { count: "exact" });

      if (!error && boxes) {
        const totalBoxes = boxes.length;
        const assignedBoxes = boxes.filter((box) => box.warehouse_location_id !== null).length;
        const unassignedBoxes = totalBoxes - assignedBoxes;
        const assignmentPercent = totalBoxes > 0 ? (assignedBoxes / totalBoxes) * 100 : 0;

        dashboardData.locationAssignmentStatus = {
          totalBoxes,
          assignedBoxes,
          unassignedBoxes,
          assignmentPercent: Math.round(assignmentPercent * 100) / 100,
        };
      }
    }

    // ========================================================================
    // Return aggregated dashboard data
    // ========================================================================
    return NextResponse.json(dashboardData, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
