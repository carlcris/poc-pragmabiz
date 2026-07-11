import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { fetchDeliveryNoteHeader } from "../delivery-notes/_lib";
import {
  getWarehouseBusinessUnitMap,
  notifyBusinessUnits,
} from "@/app/api/_lib/workflow-notifications";
import {
  type BatchAllocationMode,
  createPickListForDn,
  fetchPickList,
  getPickListAuthContext,
  mapPickListRecord,
  type PickListStatus,
} from "./_lib";

type CreatePickListBody = {
  dnId?: string;
  pickerUserIds?: string[];
  notes?: string;
  batchAllocationMode?: BatchAllocationMode;
};
type PickListApiRecord = Record<string, unknown>;

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

const parsePositiveInt = (value: string | null, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const BATCH_ALLOCATION_MODES = new Set<BatchAllocationMode>(["single_sufficient", "split"]);

const CREATE_PICK_LIST_ERROR: Record<string, { message: string; status: number }> = {
  PICK_LIST_UNAUTHORIZED: { message: "Not authorized to create pick list", status: 403 },
  PICK_LIST_DELIVERY_NOTE_NOT_FOUND: { message: "Delivery note not found", status: 404 },
  PICK_LIST_INVALID_DELIVERY_NOTE_STATUS: {
    message: "Pick list can only be created from confirmed or dispatched delivery notes",
    status: 400,
  },
  PICK_LIST_ACTIVE_EXISTS: {
    message: "Delivery note already has an active pick list",
    status: 409,
  },
  PICK_LIST_PICKER_REQUIRED: { message: "At least one picker must be assigned", status: 400 },
  PICK_LIST_INVALID_PICKER: { message: "One or more picker users are invalid", status: 400 },
  PICK_LIST_NO_PENDING_LINES: {
    message: "Delivery note has no pending lines for picking",
    status: 400,
  },
  PICK_ALLOCATION_INVALID_MODE: { message: "Invalid batch allocation mode", status: 400 },
  PICK_ALLOCATION_CHOICE_REQUIRED: {
    message: "Batch allocation choice is required",
    status: 409,
  },
  PICK_ALLOCATION_SINGLE_SOURCE_UNAVAILABLE: {
    message: "No single batch has enough quantity for this allocation",
    status: 400,
  },
  PICK_ALLOCATION_INSUFFICIENT_BATCH_QUANTITY: {
    message: "Batch quantity is not enough for this allocation",
    status: 400,
  },
};

const toCreatePickListError = (error: unknown) => {
  const rawMessage = error instanceof Error ? error.message : "";
  const mapped = CREATE_PICK_LIST_ERROR[rawMessage];
  return mapped || { message: "Failed to create pick list", status: 400 };
};

// GET /api/pick-lists
async function GETHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "view");
    if (unauthorized) return unauthorized;

    const auth = await getPickListAuthContext();
    if (auth instanceof NextResponse) return auth;

    const status = request.nextUrl.searchParams.get("status") as PickListStatus | null;
    const dnId = request.nextUrl.searchParams.get("dnId");
    const search = request.nextUrl.searchParams.get("search")?.trim() || "";
    const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const limit = Math.min(
      parsePositiveInt(request.nextUrl.searchParams.get("limit"), DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE
    );
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = auth.supabase
      .from("pick_lists")
      .select(
        `
        *,
        delivery_notes(
          id,
          dn_no,
          status,
          requesting_warehouse_id,
          fulfilling_warehouse_id,
          fulfilling_warehouse:warehouses!delivery_notes_fulfilling_warehouse_id_fkey(
            warehouse_code,
            warehouse_name
          )
        ),
        delivery_note_item_picks(*),
        pick_list_assignees(*, users:users!pick_list_assignees_user_id_fkey(id, email, first_name, last_name)),
        pick_list_items(
          *,
          item_unit_options!pick_list_items_item_unit_option_id_fkey(
            id,
            item_id,
            uom_id,
            option_label,
            qty_per_unit,
            barcode,
            is_base,
            is_default,
            is_active,
            sort_order,
            units_of_measure(
              id,
              code,
              name,
              symbol
            )
          ),
          items!pick_list_items_item_id_fkey(item_name, item_code),
          units_of_measure!pick_list_items_uom_id_fkey(code, symbol, name)
        )
      `,
        { count: "exact" }
      )
      .eq("company_id", auth.companyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (status) {
      query =
        status === "in_progress"
          ? query.in("status", ["in_progress", "paused"])
          : query.eq("status", status);
    }
    if (dnId) {
      query = query.eq("dn_id", dnId);
    }
    if (search) {
      query = query.ilike("pick_list_no", `%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) {
      console.error("Failed to fetch pick lists", error);
      return NextResponse.json({ error: "Failed to fetch pick lists" }, { status: 500 });
    }

    const total = count || 0;
    return NextResponse.json({
      data: (data || []).map((row) => mapPickListRecord(row as PickListApiRecord)),
      pagination: {
        page,
        limit,
        total,
        totalPages: total > 0 ? Math.ceil(total / limit) : 0,
      },
    });
  } catch (error) {
    console.error("Unexpected pick list fetch error", error);
    return NextResponse.json({ error: "Failed to fetch pick lists" }, { status: 500 });
  }
}

// POST /api/pick-lists
async function POSTHandler(request: NextRequest) {
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

    const uniquePickers = Array.from(
      new Set((body.pickerUserIds || []).map((id) => id.trim()).filter(Boolean))
    );
    if (uniquePickers.length === 0) {
      return NextResponse.json({ error: "At least one picker must be assigned" }, { status: 400 });
    }

    const batchAllocationMode = body.batchAllocationMode ?? "split";
    if (!BATCH_ALLOCATION_MODES.has(batchAllocationMode)) {
      return NextResponse.json({ error: "Invalid batch allocation mode" }, { status: 400 });
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
        batchAllocationMode,
      });
    } catch (createPickListError) {
      console.error("Failed to create pick list", createPickListError);
      const mapped = toCreatePickListError(createPickListError);
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
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
    console.error("Unexpected pick list creation error", error);
    return NextResponse.json({ error: "Failed to create pick list" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "pick_lists",
  route: "/api/pick-lists",
});
export const POST = withActivityLogging(POSTHandler, {
  action: "create",
  resourceType: "pick_lists",
  route: "/api/pick-lists",
});
