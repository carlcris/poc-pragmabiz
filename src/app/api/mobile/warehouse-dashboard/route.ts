import { GRANULAR_CAPABILITIES } from "@/constants/granular-permissions";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { getUserCapabilities, hasCapability } from "@/services/permissions/permissionResolver";
import type { MobileWarehouseDashboardData } from "@/types/mobile-warehouse-dashboard";
import { NextResponse } from "next/server";

async function GETHandler() {
  try {
    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const capabilities = await getUserCapabilities(user.id, currentBusinessUnitId ?? null);
    const canViewIncomingShipmentsCard = hasCapability(
      capabilities,
      GRANULAR_CAPABILITIES.DASHBOARD_INCOMING_SHIPMENTS_CARD
    );
    const canViewPickListCard = hasCapability(
      capabilities,
      GRANULAR_CAPABILITIES.DASHBOARD_PICK_LIST_CARD
    );

    const { data: userBUAccess, error: accessError } = await supabase
      .from("user_business_unit_access")
      .select("business_unit_id")
      .eq("user_id", user.id);

    if (accessError) {
      throw accessError;
    }

    const accessibleBUIds = userBUAccess?.map((access) => access.business_unit_id) ?? [];
    const scopedBUIds = currentBusinessUnitId ? [currentBusinessUnitId] : accessibleBUIds;

    if (scopedBUIds.length === 0) {
      return NextResponse.json({ error: "No business unit access" }, { status: 403 });
    }

    const [loadListsResult, deliveryNotesResult, pickListsResult, urgentRequestsResult] =
      await Promise.all([
        canViewIncomingShipmentsCard
          ? supabase
              .from("load_lists")
              .select(
                "id, receiving_warehouse:warehouses!load_lists_warehouse_id_fkey!inner(business_unit_id)",
                { count: "exact", head: true }
              )
              .in("receiving_warehouse.business_unit_id", scopedBUIds)
              .in("status", ["arrived", "receiving"])
              .is("deleted_at", null)
          : Promise.resolve({ count: 0, error: null }),
        canViewIncomingShipmentsCard
          ? supabase
              .from("delivery_notes")
              .select(
                "id, requesting_warehouse:warehouses!delivery_notes_requesting_warehouse_id_fkey!inner(business_unit_id)",
                { count: "exact", head: true }
              )
              .in("requesting_warehouse.business_unit_id", scopedBUIds)
              .eq("status", "dispatched")
              .is("deleted_at", null)
          : Promise.resolve({ count: 0, error: null }),
        canViewPickListCard
          ? supabase
              .from("pick_lists")
              .select("id", { count: "exact", head: true })
              .in("business_unit_id", scopedBUIds)
              .in("status", ["pending", "in_progress", "paused"])
              .is("deleted_at", null)
          : Promise.resolve({ count: 0, error: null }),
        supabase
          .from("stock_requests")
          .select("id", { count: "exact", head: true })
          .in("business_unit_id", scopedBUIds)
          .in("status", ["submitted", "approved"])
          .eq("priority", "urgent")
          .is("deleted_at", null),
      ]);

    if (loadListsResult.error) throw loadListsResult.error;
    if (deliveryNotesResult.error) throw deliveryNotesResult.error;
    if (pickListsResult.error) throw pickListsResult.error;
    if (urgentRequestsResult.error) throw urgentRequestsResult.error;

    const pendingLoadLists = loadListsResult.count ?? 0;
    const pendingDeliveryNotes = deliveryNotesResult.count ?? 0;
    const dashboardData: MobileWarehouseDashboardData = {
      summary: {
        pending_receipts: pendingLoadLists + pendingDeliveryNotes,
        pending_load_lists: pendingLoadLists,
        pick_list_to_pick: pickListsResult.count ?? 0,
        urgent_stock_requests: urgentRequestsResult.count ?? 0,
      },
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error("Error in mobile warehouse-dashboard API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "mobile_warehouse_dashboard",
  route: "/api/mobile/warehouse-dashboard",
});
