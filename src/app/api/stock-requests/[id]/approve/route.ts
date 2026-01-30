import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { mapStockRequest } from "../../stock-request-mapper";

type StockRequestDbRecord = Parameters<typeof mapStockRequest>[0];

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/stock-requests/[id]/approve - Approve stock request
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
    if (unauthorized) return unauthorized;

    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();
    const { id } = await context.params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if request exists and is submitted
    const { data: existingRequest, error: checkError } = await supabase
      .from("stock_requests")
      .select("id, status")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (checkError || !existingRequest) {
      return NextResponse.json({ error: "Stock request not found" }, { status: 404 });
    }

    if (existingRequest.status !== "submitted") {
      return NextResponse.json(
        { error: "Only submitted stock requests can be approved" },
        { status: 400 }
      );
    }

    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    const { data: destinationWarehouse } = await supabase
      .from("stock_requests")
      .select(
        "destination_warehouse_id, destination_warehouse:warehouses!stock_requests_destination_warehouse_id_fkey(business_unit_id)"
      )
      .eq("id", id)
      .single();

    const destinationWarehouseRecord = destinationWarehouse?.destination_warehouse;
    const destinationWarehouseRow = Array.isArray(destinationWarehouseRecord)
      ? destinationWarehouseRecord[0] ?? null
      : destinationWarehouseRecord ?? null;
    const destinationBusinessUnitId = destinationWarehouseRow?.business_unit_id || null;

    if (!destinationBusinessUnitId || destinationBusinessUnitId !== currentBusinessUnitId) {
      return NextResponse.json(
        { error: "Only the fulfillment business unit can approve this request" },
        { status: 403 }
      );
    }

    // Update status to approved
    const { error: updateError } = await supabase
      .from("stock_requests")
      .update({
        status: "approved",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error approving stock request:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Fetch updated request
    const { data: updatedRequest } = await supabase
      .from("stock_requests")
      .select(
        `
        *,
        source_warehouse:warehouses!stock_requests_source_warehouse_id_fkey(
          id,
          warehouse_code,
          warehouse_name,
          business_unit_id
        ),
        destination_warehouse:warehouses!stock_requests_destination_warehouse_id_fkey(
          id,
          warehouse_code,
          warehouse_name,
          business_unit_id
        ),
        requested_by_user:users!stock_requests_requested_by_user_id_fkey(
          id,
          email,
          first_name,
          last_name
        ),
        received_by_user:users!stock_requests_received_by_fkey(
          id,
          email,
          first_name,
          last_name
        ),
        stock_request_items(
          *,
          items(item_code, item_name),
          units_of_measure(code, symbol),
          packaging:item_packaging(id, pack_name, qty_per_pack)
        )
      `
      )
      .eq("id", id)
      .single();

    if (!updatedRequest) {
      return NextResponse.json({ error: "Stock request not found" }, { status: 404 });
    }

    return NextResponse.json(mapStockRequest(updatedRequest as StockRequestDbRecord));
  } catch (error) {
    console.error("Error in stock-request approve:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
