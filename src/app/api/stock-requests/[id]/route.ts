import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { mapStockRequest } from "../stock-request-mapper";
import type { UpdateStockRequestPayload } from "@/types/stock-request";

type StockRequestDbRecord = Parameters<typeof mapStockRequest>[0];
type StockRequestItemInput = NonNullable<UpdateStockRequestPayload["items"]>[number];

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/stock-requests/[id] - Get single stock request
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "view");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const { id } = await context.params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: stockRequest, error } = await supabase
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
          units_of_measure(code, symbol)
        )
      `
      )
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error) {
      console.error("Error fetching stock request:", error);
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (!stockRequest) {
      return NextResponse.json({ error: "Stock request not found" }, { status: 404 });
    }

    return NextResponse.json(mapStockRequest(stockRequest as StockRequestDbRecord));
  } catch (error) {
    console.error("Error in stock-request GET:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/stock-requests/[id] - Update stock request (draft only)
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const { id } = await context.params;
    const body = (await request.json()) as UpdateStockRequestPayload;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if request exists and is draft
    const { data: existingRequest, error: checkError } = await supabase
      .from("stock_requests")
      .select("id, status")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (checkError || !existingRequest) {
      return NextResponse.json({ error: "Stock request not found" }, { status: 404 });
    }

    if (existingRequest.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft stock requests can be updated" },
        { status: 400 }
      );
    }

    const fromLocationId = body.from_location_id;
    const toLocationId = body.to_location_id;

    // Update stock request header
    const { error: updateError } = await supabase
      .from("stock_requests")
      .update({
        request_date: body.request_date,
        required_date: body.required_date,
        source_warehouse_id: fromLocationId,
        destination_warehouse_id: toLocationId ?? null,
        department: body.department || null,
        priority: body.priority,
        purpose: body.purpose || null,
        notes: body.notes || null,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating stock request:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Update items if provided
    if (body.items && Array.isArray(body.items)) {
      // Delete existing items
      await supabase.from("stock_request_items").delete().eq("stock_request_id", id);

      // Insert new items
      const requestItems = body.items.map((item: StockRequestItemInput) => ({
        stock_request_id: id,
        item_id: item.item_id,
        requested_qty: item.requested_qty,
        picked_qty: 0,
        uom_id: item.uom_id,
        notes: item.notes || null,
      }));

      const { error: itemsError } = await supabase.from("stock_request_items").insert(requestItems);

      if (itemsError) {
        console.error("Error updating stock request items:", itemsError);
        return NextResponse.json({ error: "Failed to update request items" }, { status: 500 });
      }
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
          units_of_measure(code, symbol)
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
    console.error("Error in stock-request PATCH:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/stock-requests/[id] - Delete stock request (draft only)
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "delete");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const { id } = await context.params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if request exists and is draft
    const { data: existingRequest, error: checkError } = await supabase
      .from("stock_requests")
      .select("id, status")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (checkError || !existingRequest) {
      return NextResponse.json({ error: "Stock request not found" }, { status: 404 });
    }

    if (existingRequest.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft stock requests can be deleted" },
        { status: 400 }
      );
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from("stock_requests")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting stock request:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in stock-request DELETE:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
