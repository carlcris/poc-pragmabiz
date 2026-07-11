import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { DELIVERY_NOTE_ALLOCATION_AVAILABILITY_MAX_LINES } from "@/constants/delivery-notes";
import { getAuthContext } from "../_lib";

type AvailabilityRequestBody = {
  srItemIds?: string[];
};

type AvailabilityRow = {
  sr_item_id: string;
  available_qty: number | string;
  available_base_qty: number | string;
  qty_per_unit: number | string;
  selected_item_batch_id: string | null;
  base_unit_label: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function POSTHandler(request: NextRequest) {
  const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
  if (unauthorized) return unauthorized;

  const auth = await getAuthContext();
  if (auth instanceof NextResponse) return auth;
  if (!auth.currentBusinessUnitId) {
    return NextResponse.json({ error: "Business unit context is required" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as AvailabilityRequestBody;
  const srItemIds = Array.from(new Set(body.srItemIds || []));

  if (
    srItemIds.length < 1 ||
    srItemIds.length > DELIVERY_NOTE_ALLOCATION_AVAILABILITY_MAX_LINES ||
    srItemIds.some((id) => !UUID_PATTERN.test(id))
  ) {
    return NextResponse.json({ error: "Invalid stock request item selection" }, { status: 400 });
  }

  const { data, error } = await auth.supabase.rpc(
    "get_delivery_note_allocation_availability",
    {
      p_company_id: auth.companyId,
      p_user_id: auth.userId,
      p_business_unit_id: auth.currentBusinessUnitId,
      p_sr_item_ids: srItemIds,
    }
  );

  if (error) {
    console.error("Failed to calculate delivery-note allocation availability", error);
    return NextResponse.json({ error: "Failed to calculate inventory availability" }, { status: 500 });
  }

  const rows = (data || []) as AvailabilityRow[];
  return NextResponse.json({
    data: rows.map((row) => ({
      srItemId: row.sr_item_id,
      availableQty: Number(row.available_qty || 0),
      availableBaseQty: Number(row.available_base_qty || 0),
      qtyPerUnit: Number(row.qty_per_unit || 1),
      selectedItemBatchId: row.selected_item_batch_id,
      baseUnitLabel: row.base_unit_label,
    })),
  });
}

export const POST = withActivityLogging(POSTHandler, {
  action: "view",
  resourceType: "delivery_note_allocation_availability",
  route: "/api/delivery-notes/allocation-availability",
});
