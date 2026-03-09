import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { fetchDeliveryNoteHeader } from "../delivery-notes/_lib";
import {
  getWarehouseBusinessUnitMap,
  notifyBusinessUnits,
} from "@/app/api/_lib/workflow-notifications";
import { createPickListForDn, fetchPickList, getPickListAuthContext, mapPickListRecord, type PickListStatus } from "./_lib";

type CreatePickListBody = {
  dnId?: string;
  pickerUserIds?: string[];
  notes?: string;
};
type PickListApiRecord = Record<string, unknown>;

// GET /api/pick-lists
export async function GET(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "view");
    if (unauthorized) return unauthorized;

    const auth = await getPickListAuthContext();
    if (auth instanceof NextResponse) return auth;

    const status = request.nextUrl.searchParams.get("status") as PickListStatus | null;
    const dnId = request.nextUrl.searchParams.get("dnId");

    let query = auth.supabase
      .from("pick_lists")
      .select(
        `
        *,
        delivery_notes(id, dn_no, status, requesting_warehouse_id, fulfilling_warehouse_id),
        delivery_note_item_picks(*),
        pick_list_assignees(*, users:users!pick_list_assignees_user_id_fkey(id, email, first_name, last_name)),
        pick_list_items(
          *,
          items!pick_list_items_item_id_fkey(item_name, item_code, sku),
          units_of_measure!pick_list_items_uom_id_fkey(symbol, name)
        )
      `
      )
      .eq("company_id", auth.companyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }
    if (dnId) {
      query = query.eq("dn_id", dnId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: (data || []).map((row) => mapPickListRecord(row as PickListApiRecord)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/pick-lists
export async function POST(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
    if (unauthorized) return unauthorized;

    const auth = await getPickListAuthContext();
    if (auth instanceof NextResponse) return auth;

    const body = (await request.json().catch(() => ({}))) as CreatePickListBody;
    const dnId = body.dnId?.trim();
    if (!dnId) {
      return NextResponse.json({ error: "dnId is required" }, { status: 400 });
    }

    const uniquePickers = Array.from(new Set((body.pickerUserIds || []).map((id) => id.trim()).filter(Boolean)));
    if (uniquePickers.length === 0) {
      return NextResponse.json({ error: "At least one picker must be assigned" }, { status: 400 });
    }

    const header = await fetchDeliveryNoteHeader(auth.supabase, auth.companyId, dnId);
    if (!header) {
      return NextResponse.json({ error: "Delivery note not found" }, { status: 404 });
    }

    if (!["confirmed", "dispatched"].includes(header.status)) {
      return NextResponse.json(
        { error: "Pick list can only be created from confirmed or dispatched delivery notes" },
        { status: 400 }
      );
    }
    let createdPickList;
    try {
      createdPickList = await createPickListForDn({
        supabase: auth.supabase,
        companyId: auth.companyId,
        userId: auth.userId,
        currentBusinessUnitId: auth.currentBusinessUnitId,
        dnId,
        dnBusinessUnitId: header.business_unit_id,
        fulfillingWarehouseId: header.fulfilling_warehouse_id,
        pickerUserIds: uniquePickers,
        notes: body.notes?.trim() || null,
      });
    } catch (createPickListError) {
      const message =
        createPickListError instanceof Error
          ? createPickListError.message
          : "Failed to create pick list";
      const status = message === "Delivery note already has an active pick list" ? 409 : 400;
      return NextResponse.json({ error: message }, { status });
    }

    try {
      const warehouseBuMap = await getWarehouseBusinessUnitMap(auth.supabase, auth.companyId, [
        header.requesting_warehouse_id,
      ]);
      const requestingBuId = warehouseBuMap.get(header.requesting_warehouse_id);

      await notifyBusinessUnits({
        supabase: auth.supabase,
        companyId: auth.companyId,
        actorUserId: auth.userId,
        businessUnitIds: [requestingBuId],
        title: "Picking in progress",
        message: `Delivery note ${header.dn_no} has been queued for picking.`,
        type: "pick_list_workflow",
        metadata: {
          delivery_note_id: header.id,
          dn_no: header.dn_no,
          pick_list_id: createdPickList.pickListId,
          pick_list_no: createdPickList.pickListNo,
          status: "queued_for_picking",
        },
      });
    } catch (notificationError) {
      console.error("Error creating queue picking notifications:", notificationError);
    }

    const pickList = await fetchPickList(auth.supabase, auth.companyId, createdPickList.pickListId);
    return NextResponse.json(pickList, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
