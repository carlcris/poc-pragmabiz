import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { mapStockRequest } from "../../stock-request-mapper";
import {
  adjustItemLocation,
  consumeItemLocationsFIFO,
  ensureWarehouseDefaultLocation,
} from "@/services/inventory/locationService";

type StockRequestDbRecord = Parameters<typeof mapStockRequest>[0];
type StockRequestItemRow = {
  item_id: string;
  requested_qty: number | string;
  uom_id: string | null;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/stock-requests/[id]/picked - Mark stock request as delivered
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

    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    const { data: stockRequest, error: requestError } = await supabase
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
        stock_request_items(
          id,
          item_id,
          requested_qty,
          uom_id
        )
      `
      )
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (requestError || !stockRequest) {
      return NextResponse.json({ error: "Stock request not found" }, { status: 404 });
    }

    if (stockRequest.status !== "ready_for_pick") {
      return NextResponse.json(
        { error: "Only ready-for-pick stock requests can be marked as delivered" },
        { status: 400 }
      );
    }

    const destinationWarehouseRecord = stockRequest.destination_warehouse;
    const destinationWarehouse = Array.isArray(destinationWarehouseRecord)
      ? destinationWarehouseRecord[0] ?? null
      : destinationWarehouseRecord ?? null;
    const destinationBusinessUnitId = destinationWarehouse?.business_unit_id || null;

    if (!destinationBusinessUnitId || destinationBusinessUnitId !== currentBusinessUnitId) {
      return NextResponse.json(
        { error: "Only the fulfillment business unit can mark delivered" },
        { status: 403 }
      );
    }

    if (!destinationWarehouse?.id) {
      return NextResponse.json(
        { error: "Destination warehouse is required to deliver this request" },
        { status: 400 }
      );
    }

    const requestItems = (stockRequest.stock_request_items as StockRequestItemRow[] | null) || [];
    const requestItemIds = requestItems.map((item) => item.item_id);
    const { data: requestItemUoms } = await supabase
      .from("items")
      .select("id, uom_id")
      .in("id", requestItemIds);
    const requestUomMap = new Map(
      (requestItemUoms as Array<{ id: string; uom_id: string | null }> | null)?.map((row) => [
        row.id,
        row.uom_id,
      ]) || []
    );

    const itemsToDeliver = requestItems.map((item) => ({
      itemId: item.item_id,
      quantity: Number(item.requested_qty),
      uomId: item.uom_id ?? requestUomMap.get(item.item_id) ?? null,
      notes: `Stock request ${stockRequest.request_code} delivered`,
    }));

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0].replace(/-/g, "");
    const milliseconds = now.getTime().toString().slice(-4);
    const transactionCode = `ST-${dateStr}${milliseconds}`;

    const defaultFromLocationId = await ensureWarehouseDefaultLocation({
      supabase,
      companyId: userData.company_id,
      warehouseId: destinationWarehouse.id,
      userId: user.id,
    });

    const { data: stockTransaction, error: transactionError } = await supabase
      .from("stock_transactions")
      .insert({
        company_id: userData.company_id,
        business_unit_id: currentBusinessUnitId,
        transaction_code: transactionCode,
        transaction_type: "out",
        transaction_date: now.toISOString().split("T")[0],
        warehouse_id: destinationWarehouse.id,
        from_location_id: defaultFromLocationId,
        reference_type: "stock_request",
        reference_id: stockRequest.id,
        reference_code: stockRequest.request_code,
        status: "posted",
        notes: `Stock request ${stockRequest.request_code} delivered`,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (transactionError || !stockTransaction) {
      return NextResponse.json(
        { error: transactionError?.message || "Failed to create stock transaction" },
        { status: 500 }
      );
    }

    const postingDate = now.toISOString().split("T")[0];
    const postingTime = now.toTimeString().split(" ")[0];

    for (const item of itemsToDeliver) {
      if (!item.uomId) {
        return NextResponse.json({ error: "Item UOM not found for stock request" }, { status: 400 });
      }
      const { data: warehouseStock } = await supabase
        .from("item_warehouse")
        .select("id, current_stock, default_location_id")
        .eq("company_id", userData.company_id)
        .eq("item_id", item.itemId)
        .eq("warehouse_id", destinationWarehouse.id)
        .is("deleted_at", null)
        .maybeSingle();

      const currentBalance = warehouseStock ? parseFloat(String(warehouseStock.current_stock)) : 0;

      if (currentBalance < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for item ${item.itemId}` },
          { status: 400 }
        );
      }

      const newBalance = currentBalance - item.quantity;

      const { data: locationRows } = await supabase
        .from("item_location")
        .select("location_id, qty_on_hand")
        .eq("company_id", userData.company_id)
        .eq("item_id", item.itemId)
        .eq("warehouse_id", destinationWarehouse.id)
        .is("deleted_at", null);

      const locationTotal = (locationRows || []).reduce(
        (sum, row) => sum + Number(row.qty_on_hand || 0),
        0
      );

      if (locationTotal < currentBalance) {
        const missingQty = currentBalance - locationTotal;
        await adjustItemLocation({
          supabase,
          companyId: userData.company_id,
          itemId: item.itemId,
          warehouseId: stockRequest.destination_warehouse.id,
          locationId: defaultFromLocationId || warehouseStock?.default_location_id || null,
          userId: user.id,
          qtyOnHandDelta: missingQty,
        });
      }

      await consumeItemLocationsFIFO({
        supabase,
        companyId: userData.company_id,
        itemId: item.itemId,
        warehouseId: destinationWarehouse.id,
        quantity: item.quantity,
        userId: user.id,
      });

      if (warehouseStock?.id) {
        await supabase
          .from("item_warehouse")
          .update({
            current_stock: newBalance,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", warehouseStock.id);
      } else {
        await supabase.from("item_warehouse").insert({
          company_id: userData.company_id,
          item_id: item.itemId,
          warehouse_id: destinationWarehouse.id,
          current_stock: newBalance,
          default_location_id: defaultFromLocationId,
          created_by: user.id,
          updated_by: user.id,
        });
      }

      await supabase.from("stock_transaction_items").insert({
        company_id: userData.company_id,
        transaction_id: stockTransaction.id,
        item_id: item.itemId,
        quantity: item.quantity,
        uom_id: item.uomId,
        unit_cost: 0,
        total_cost: 0,
        qty_before: currentBalance,
        qty_after: newBalance,
        valuation_rate: 0,
        stock_value_before: 0,
        stock_value_after: 0,
        posting_date: postingDate,
        posting_time: postingTime,
        notes: `Stock request ${stockRequest.request_code} delivered`,
        created_by: user.id,
        updated_by: user.id,
      });
    }

    // Update status to delivered
    const { error: updateError } = await supabase
      .from("stock_requests")
      .update({
        status: "delivered",
        picked_by: user.id,
        picked_at: now.toISOString(),
        updated_by: user.id,
        updated_at: now.toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error marking stock request as delivered:", updateError);
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
    console.error("Error in stock-request delivered:", error);
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Internal server error", details }, { status: 500 });
  }
}
