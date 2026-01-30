import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { normalizeTransactionItems } from "@/services/inventory/normalizationService";
import {
  adjustItemLocation,
  ensureWarehouseDefaultLocation,
} from "@/services/inventory/locationService";
import type { StockTransactionItemInput } from "@/types/inventory-normalization";

type StockRequestRow = {
  id: string;
  company_id: string;
  request_code: string;
  status: string;
  source_warehouse_id: string | null;
  destination_warehouse_id: string | null;
};
type StockRequestItemRow = {
  id: string;
  item_id: string;
  requested_qty: number | string;
  packaging_id?: string | null;
  uom_id?: string | null;
};
type StockRequestWarehouse = {
  id: string;
  warehouse_code: string;
  warehouse_name: string;
  business_unit_id: string | null;
};

type StockRequestQueryRow = StockRequestRow & {
  source_warehouse: StockRequestWarehouse | StockRequestWarehouse[] | null;
  destination_warehouse: StockRequestWarehouse | StockRequestWarehouse[] | null;
  stock_request_items: StockRequestItemRow[];
};

type ReceiveStockRequestItemInput = {
  stockRequestItemId: string;
  itemId: string;
  requestedQty: number;
  receivedQty: number;
  packagingId?: string | null;
  uomId?: string | null;
  locationId?: string | null;
};

type ReceiveStockRequestBody = {
  receivedDate?: string;
  notes?: string | null;
  items?: ReceiveStockRequestItemInput[];
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/stock-requests/[id]/receive - Receive delivered stock request
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
    if (unauthorized) return unauthorized;

    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();
    const { id } = await context.params;
    const body = (await request.json()) as ReceiveStockRequestBody;

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

    const { data: requestData, error: requestError } = await supabase
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
          packaging_id,
          uom_id
        )
      `
      )
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (requestError || !requestData) {
      return NextResponse.json({ error: "Stock request not found" }, { status: 404 });
    }

    const stockRequest = requestData as StockRequestQueryRow;

    if (!["delivered", "picked"].includes(stockRequest.status)) {
      return NextResponse.json(
        { error: "Only delivered stock requests can be received" },
        { status: 400 }
      );
    }

    const sourceWarehouseRecord = stockRequest.source_warehouse;
    const sourceWarehouse = Array.isArray(sourceWarehouseRecord)
      ? sourceWarehouseRecord[0] ?? null
      : sourceWarehouseRecord ?? null;
    if (!sourceWarehouse?.business_unit_id) {
      return NextResponse.json({ error: "Source warehouse not found" }, { status: 400 });
    }

    if (sourceWarehouse.business_unit_id !== currentBusinessUnitId) {
      return NextResponse.json(
        { error: "Stock request can only be received from the source business unit" },
        { status: 403 }
      );
    }

    const itemsToReceive: ReceiveStockRequestItemInput[] =
      body.items ??
      stockRequest.stock_request_items.map((item) => ({
        stockRequestItemId: item.id,
        itemId: item.item_id,
        requestedQty: Number(item.requested_qty),
        receivedQty: Number(item.requested_qty),
        packagingId: item.packaging_id ?? null,
        uomId: item.uom_id ?? null,
        locationId: null,
      }));

    const nonZeroItems = itemsToReceive.filter((item) => item.receivedQty > 0);

    if (nonZeroItems.length === 0) {
      return NextResponse.json({ error: "Please provide quantities to receive" }, { status: 400 });
    }

    const itemInputs: StockTransactionItemInput[] = nonZeroItems.map((item) => ({
      itemId: item.itemId,
      packagingId: item.packagingId || null,
      inputQty: item.receivedQty,
      unitCost: 0,
      notes: body.notes || undefined,
    }));

    const normalizedItems = await normalizeTransactionItems(userData.company_id, itemInputs);

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0].replace(/-/g, "");
    const milliseconds = now.getTime().toString().slice(-4);
    const transactionCode = `ST-${dateStr}${milliseconds}`;

    const defaultLocationId = await ensureWarehouseDefaultLocation({
      supabase,
      companyId: userData.company_id,
      warehouseId: sourceWarehouse.id,
      userId: user.id,
    });

    const { data: stockTransaction, error: transactionError } = await supabase
      .from("stock_transactions")
      .insert({
        company_id: userData.company_id,
        business_unit_id: currentBusinessUnitId,
        transaction_code: transactionCode,
        transaction_type: "in",
        transaction_date: body.receivedDate || now.toISOString().split("T")[0],
        warehouse_id: sourceWarehouse.id,
        to_location_id: defaultLocationId,
        reference_type: "stock_request",
        reference_id: stockRequest.id,
        reference_code: stockRequest.request_code,
        status: "posted",
        notes: body.notes || `Stock request ${stockRequest.request_code} received`,
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

    const postingDate = body.receivedDate || now.toISOString().split("T")[0];
    const postingTime = now.toTimeString().split(" ")[0];

    for (let i = 0; i < normalizedItems.length; i++) {
      const item = normalizedItems[i];
      const receiveInput = nonZeroItems[i];

      const { data: warehouseStock } = await supabase
        .from("item_warehouse")
        .select("id, current_stock, default_location_id")
        .eq("company_id", userData.company_id)
        .eq("item_id", item.itemId)
        .eq("warehouse_id", sourceWarehouse.id)
        .is("deleted_at", null)
        .maybeSingle();

      const currentStock = warehouseStock ? parseFloat(String(warehouseStock.current_stock)) : 0;
      const newStock = currentStock + item.normalizedQty;

      await adjustItemLocation({
        supabase,
        companyId: userData.company_id,
        itemId: item.itemId,
        warehouseId: sourceWarehouse.id,
        locationId:
          receiveInput.locationId ||
          defaultLocationId ||
          warehouseStock?.default_location_id ||
          null,
        userId: user.id,
        qtyOnHandDelta: item.normalizedQty,
      });

      if (warehouseStock?.id) {
        await supabase
          .from("item_warehouse")
          .update({
            current_stock: newStock,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", warehouseStock.id);
      } else {
        await supabase.from("item_warehouse").insert({
          company_id: userData.company_id,
          item_id: item.itemId,
          warehouse_id: sourceWarehouse.id,
          current_stock: newStock,
          default_location_id: defaultLocationId,
          created_by: user.id,
          updated_by: user.id,
        });
      }

      await supabase.from("stock_transaction_items").insert({
        company_id: userData.company_id,
        transaction_id: stockTransaction.id,
        item_id: item.itemId,
        input_qty: item.inputQty,
        input_packaging_id: item.inputPackagingId,
        conversion_factor: item.conversionFactor,
        normalized_qty: item.normalizedQty,
        base_package_id: item.basePackageId,
        quantity: item.normalizedQty,
        uom_id: item.uomId,
        unit_cost: 0,
        total_cost: 0,
        qty_before: currentStock,
        qty_after: newStock,
        valuation_rate: 0,
        stock_value_before: 0,
        stock_value_after: 0,
        posting_date: postingDate,
        posting_time: postingTime,
        notes: body.notes || `Stock request ${stockRequest.request_code} received`,
        created_by: user.id,
        updated_by: user.id,
      });
    }

    const receivedAt = body.receivedDate
      ? new Date(body.receivedDate).toISOString()
      : now.toISOString();

    const { error: statusError } = await supabase
      .from("stock_requests")
      .update({
        status: "received",
        received_by: user.id,
        received_at: receivedAt,
        updated_by: user.id,
        updated_at: now.toISOString(),
      })
      .eq("id", stockRequest.id);

    if (statusError) {
      return NextResponse.json(
        { error: statusError.message || "Failed to update stock request status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Stock request received successfully",
      data: {
        id: stockRequest.id,
        status: "received",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
