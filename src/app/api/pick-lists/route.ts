import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { fetchDeliveryNoteHeader, fetchDeliveryNoteItems } from "../delivery-notes/_lib";
import {
  buildPickListNo,
  fetchPickList,
  getPickListAuthContext,
  mapPickListRecord,
  type PickListStatus,
} from "./_lib";

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

    if (header.status !== "confirmed") {
      return NextResponse.json(
        { error: "Pick list can only be created from confirmed delivery notes" },
        { status: 400 }
      );
    }

    const { data: existingActive, error: existingActiveError } = await auth.supabase
      .from("pick_lists")
      .select("id, status")
      .eq("company_id", auth.companyId)
      .eq("dn_id", dnId)
      .neq("status", "cancelled")
      .is("deleted_at", null)
      .maybeSingle();

    if (existingActiveError) {
      return NextResponse.json({ error: existingActiveError.message }, { status: 500 });
    }

    if (existingActive) {
      return NextResponse.json(
        { error: "Delivery note already has an active pick list" },
        { status: 409 }
      );
    }

    const dnItems = await fetchDeliveryNoteItems(auth.supabase, auth.companyId, dnId);
    if (dnItems.length === 0) {
      return NextResponse.json({ error: "Delivery note has no items" }, { status: 400 });
    }

    const { data: fulfillingWarehouse, error: fulfillingWarehouseError } = await auth.supabase
      .from("warehouses")
      .select("business_unit_id")
      .eq("id", header.fulfilling_warehouse_id)
      .eq("company_id", auth.companyId)
      .is("deleted_at", null)
      .maybeSingle();

    if (fulfillingWarehouseError) {
      return NextResponse.json({ error: fulfillingWarehouseError.message }, { status: 500 });
    }

    const pickListBusinessUnitId =
      fulfillingWarehouse?.business_unit_id || header.business_unit_id || auth.currentBusinessUnitId;

    const { data: pickerUsers, error: pickerUserError } = await auth.supabase
      .from("users")
      .select("id")
      .eq("company_id", auth.companyId)
      .eq("is_active", true)
      .in("id", uniquePickers)
      .is("deleted_at", null);

    if (pickerUserError) {
      return NextResponse.json({ error: pickerUserError.message }, { status: 500 });
    }

    if (!pickerUsers || pickerUsers.length !== uniquePickers.length) {
      return NextResponse.json({ error: "One or more picker users are invalid" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const pickListNo = buildPickListNo();

    const { data: createdPickList, error: createError } = await auth.supabase
      .from("pick_lists")
      .insert({
        company_id: auth.companyId,
        business_unit_id: pickListBusinessUnitId,
        dn_id: dnId,
        pick_list_no: pickListNo,
        status: "pending",
        notes: body.notes?.trim() || null,
        created_by: auth.userId,
        updated_by: auth.userId,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("id")
      .single();

    if (createError || !createdPickList) {
      if (createError?.code === "23505") {
        return NextResponse.json(
          { error: "Delivery note already has an active pick list" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: createError?.message || "Failed to create pick list" }, { status: 500 });
    }

    const assignees = uniquePickers.map((userId) => ({
      company_id: auth.companyId,
      pick_list_id: createdPickList.id,
      user_id: userId,
      assigned_at: nowIso,
      assigned_by: auth.userId,
    }));

    const { error: assigneeError } = await auth.supabase.from("pick_list_assignees").insert(assignees);
    if (assigneeError) {
      return NextResponse.json({ error: assigneeError.message }, { status: 500 });
    }

    const pickListItems = dnItems.map((item) => ({
      company_id: auth.companyId,
      pick_list_id: createdPickList.id,
      dn_item_id: item.id,
      sr_id: item.sr_id,
      sr_item_id: item.sr_item_id,
      item_id: item.item_id,
      uom_id: item.uom_id,
      allocated_qty: item.allocated_qty,
      picked_qty: 0,
      short_qty: item.allocated_qty,
      created_at: nowIso,
      updated_at: nowIso,
    }));

    const { error: itemError } = await auth.supabase.from("pick_list_items").insert(pickListItems);
    if (itemError) {
      return NextResponse.json({ error: itemError.message }, { status: 500 });
    }

    const { error: dnUpdateError } = await auth.supabase
      .from("delivery_notes")
      .update({
        status: "queued_for_picking",
        updated_at: nowIso,
        updated_by: auth.userId,
      })
      .eq("id", dnId)
      .eq("company_id", auth.companyId)
      .eq("status", "confirmed");

    if (dnUpdateError) {
      return NextResponse.json({ error: dnUpdateError.message }, { status: 500 });
    }

    const pickList = await fetchPickList(auth.supabase, auth.companyId, createdPickList.id);
    return NextResponse.json(pickList, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
