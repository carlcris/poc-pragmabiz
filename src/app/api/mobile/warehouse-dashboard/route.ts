import { GRANULAR_CAPABILITIES } from "@/constants/granular-permissions";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { getUserCapabilities, hasCapability } from "@/services/permissions/permissionResolver";
import type {
  MobileWarehouseDashboardData,
  MobileWarehouseDashboardPickList,
} from "@/types/mobile-warehouse-dashboard";
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

    const emptyCount = Promise.resolve({ count: 0, error: null });
    const countLoadLists = (status: "arrived" | "receiving") =>
      supabase
        .from("load_lists")
        .select("id", { count: "exact", head: true })
        .in("destination_business_unit_id", scopedBUIds)
        .eq("status", status)
        .is("deleted_at", null);
    // Matches the receiving inbox stages: a dispatched delivery note is in progress once receiving starts.
    const countDispatchedDeliveryNotes = (receivingStarted: boolean) => {
      const query = supabase
        .from("delivery_notes")
        .select("id", { count: "exact", head: true })
        .in("requesting_business_unit_id", scopedBUIds)
        .eq("status", "dispatched")
        .is("deleted_at", null);
      return receivingStarted
        ? query.not("receiving_started_at", "is", null)
        : query.is("receiving_started_at", null);
    };
    const countPickLists = (statuses: ("pending" | "in_progress" | "paused")[]) =>
      supabase
        .from("pick_lists")
        .select("id", { count: "exact", head: true })
        .in("business_unit_id", scopedBUIds)
        .in("status", statuses)
        .is("deleted_at", null);

    const [
      readyLoadListsResult,
      receivingLoadListsResult,
      readyDeliveryNotesResult,
      receivingDeliveryNotesResult,
      pendingPickListsResult,
      startedPickListsResult,
      assignedPickListResult,
      urgentRequestsResult,
    ] = await Promise.all([
      canViewIncomingShipmentsCard ? countLoadLists("arrived") : emptyCount,
      canViewIncomingShipmentsCard ? countLoadLists("receiving") : emptyCount,
      canViewIncomingShipmentsCard ? countDispatchedDeliveryNotes(false) : emptyCount,
      canViewIncomingShipmentsCard ? countDispatchedDeliveryNotes(true) : emptyCount,
      canViewPickListCard ? countPickLists(["pending"]) : emptyCount,
      canViewPickListCard ? countPickLists(["in_progress", "paused"]) : emptyCount,
      canViewPickListCard
        ? supabase
            .from("pick_lists")
            .select(
              `id,
              pick_list_no,
              status,
              assignee:pick_list_assignees!inner(user_id),
              delivery_notes(
                dn_no,
                fulfilling_warehouse:warehouses!delivery_notes_fulfilling_warehouse_id_fkey(warehouse_name)
              ),
              pick_list_items(picked_qty)`
            )
            .in("business_unit_id", scopedBUIds)
            .in("status", ["pending", "in_progress", "paused"])
            .is("deleted_at", null)
            .eq("assignee.user_id", user.id)
            // Enum order is pending < in_progress < paused, so started lists sort before pending ones.
            .order("status", { ascending: false })
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("stock_requests")
        .select("id", { count: "exact", head: true })
        .in("fulfilling_business_unit_id", scopedBUIds)
        .in("status", ["submitted", "approved"])
        .eq("priority", "urgent")
        .is("deleted_at", null),
    ]);

    if (readyLoadListsResult.error) throw readyLoadListsResult.error;
    if (receivingLoadListsResult.error) throw receivingLoadListsResult.error;
    if (readyDeliveryNotesResult.error) throw readyDeliveryNotesResult.error;
    if (receivingDeliveryNotesResult.error) throw receivingDeliveryNotesResult.error;
    if (pendingPickListsResult.error) throw pendingPickListsResult.error;
    if (startedPickListsResult.error) throw startedPickListsResult.error;
    if (assignedPickListResult.error) throw assignedPickListResult.error;
    if (urgentRequestsResult.error) throw urgentRequestsResult.error;

    const assignedPickListRow = assignedPickListResult.data;
    const assignedDeliveryNote = Array.isArray(assignedPickListRow?.delivery_notes)
      ? assignedPickListRow.delivery_notes[0]
      : assignedPickListRow?.delivery_notes;
    const assignedWarehouse = Array.isArray(assignedDeliveryNote?.fulfilling_warehouse)
      ? assignedDeliveryNote.fulfilling_warehouse[0]
      : assignedDeliveryNote?.fulfilling_warehouse;
    const assignedItems = assignedPickListRow?.pick_list_items ?? [];

    const dashboardData: MobileWarehouseDashboardData = {
      receiving: {
        ready: (readyLoadListsResult.count ?? 0) + (readyDeliveryNotesResult.count ?? 0),
        inProgress:
          (receivingLoadListsResult.count ?? 0) + (receivingDeliveryNotesResult.count ?? 0),
      },
      picking: {
        pending: pendingPickListsResult.count ?? 0,
        inProgress: startedPickListsResult.count ?? 0,
        assignedPickList: assignedPickListRow
          ? {
              id: assignedPickListRow.id,
              code: assignedPickListRow.pick_list_no,
              status: assignedPickListRow.status as MobileWarehouseDashboardPickList["status"],
              deliveryNoteCode: assignedDeliveryNote?.dn_no ?? null,
              warehouseName: assignedWarehouse?.warehouse_name ?? null,
              lineCount: assignedItems.length,
              pickedLineCount: assignedItems.filter((item) => Number(item.picked_qty) > 0).length,
            }
          : null,
      },
      urgentStockRequests: urgentRequestsResult.count ?? 0,
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
