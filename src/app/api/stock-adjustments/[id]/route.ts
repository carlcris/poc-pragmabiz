import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import type { Json } from "@/types/database.types";
type DbStockAdjustmentItem = {
  id: string;
  adjustment_id: string;
  item_id: string;
  item_batch_location_id: string | null;
  item_code: string | null;
  item_name: string | null;
  current_qty: number | string | null;
  adjusted_qty: number | string | null;
  difference: number | string | null;
  unit_cost: number | string | null;
  total_cost: number | string | null;
  uom_id: string | null;
  uom_name: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string | null;
};

type StockAdjustmentItemInput = {
  itemId: string;
  itemBatchLocationId?: string | null;
  batchCode?: string | null;
  currentQty: number;
  adjustedQty: number;
  unitCost: number;
  uomId: string;
  reason?: string | null;
};

type StockAdjustmentPatchBody = {
  adjustmentType?: string;
  adjustmentDate?: string;
  warehouseId?: string;
  reason?: string;
  notes?: string | null;
  locationId?: string | null;
  items?: StockAdjustmentItemInput[];
};

type StockAdjustmentSaveResult = {
  adjustment_id: string;
  adjustment_code: string;
  status: string;
};

type BatchLocationRow = {
  id: string;
  batch_location_sku: string | null;
  location_id: string;
  item_batch:
    | {
        batch_code: string | null;
        received_at: string | null;
      }
    | {
        batch_code: string | null;
        received_at: string | null;
      }[]
    | null;
  warehouse_location:
    | {
        code: string | null;
        name: string | null;
      }
    | {
        code: string | null;
        name: string | null;
      }[]
    | null;
};

const toOne = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

type RpcErrorLike = {
  code?: string;
  message?: string;
};

const STOCK_ADJUSTMENT_UPDATE_ERROR_RESPONSES = new Map<
  string,
  { message: string; status: number }
>([
  ["Stock adjustment not found", { message: "Stock adjustment not found", status: 404 }],
  [
    "Only draft adjustments can be updated",
    { message: "Only draft adjustments can be updated", status: 400 },
  ],
  [
    "Business unit context required",
    { message: "Business unit context required", status: 400 },
  ],
  [
    "Missing required stock adjustment fields",
    { message: "Missing required stock adjustment fields", status: 400 },
  ],
  ["At least one item is required", { message: "At least one item is required", status: 400 }],
  [
    "Selected warehouse is not valid for the current business unit",
    { message: "Selected warehouse is not valid for the current business unit", status: 400 },
  ],
  [
    "Stock adjustment is not valid for the current business unit",
    { message: "Stock adjustment not found", status: 404 },
  ],
  ["Invalid stock adjustment item", { message: "Invalid stock adjustment item", status: 400 }],
  [
    "Stock adjustment item does not exist",
    { message: "Stock adjustment item does not exist", status: 400 },
  ],
  [
    "Stock adjustment unit of measure does not exist",
    { message: "Stock adjustment unit of measure does not exist", status: 400 },
  ],
  [
    "Selected batch location is not valid for the adjustment",
    { message: "Selected batch location is not valid for the adjustment", status: 400 },
  ],
  ["Batch code is required", { message: "Batch code is required", status: 400 }],
  [
    "Location is required for a new batch",
    { message: "Location is required for a new batch", status: 400 },
  ],
  [
    "Selected location is not valid for the warehouse",
    { message: "Selected location is not valid for the warehouse", status: 400 },
  ],
  ["User context mismatch", { message: "Not authorized to update stock adjustment", status: 403 }],
  [
    "User is not valid for the company",
    { message: "Not authorized to update stock adjustment", status: 403 },
  ],
  [
    "User does not have access to the business unit",
    { message: "Not authorized to update stock adjustment", status: 403 },
  ],
]);

const getStockAdjustmentUpdateErrorResponse = (error: RpcErrorLike | null | undefined) => {
  const mapped = error?.message
    ? STOCK_ADJUSTMENT_UPDATE_ERROR_RESPONSES.get(error.message)
    : null;

  if (mapped) {
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  if (error?.code === "42501") {
    return NextResponse.json(
      { error: "Not authorized to update stock adjustment" },
      { status: 403 }
    );
  }

  return null;
};

// GET /api/stock-adjustments/[id] - Get single stock adjustment
async function GETHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Require 'stock_adjustments' view permission
    const unauthorized = await requirePermission(RESOURCES.STOCK_ADJUSTMENTS, "view");
    if (unauthorized) return unauthorized;

    const { id } = await params;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId } = context;

    // Fetch adjustment
    const { data: adjustment, error } = await supabase
      .from("stock_adjustments")
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();

    if (error || !adjustment) {
      return NextResponse.json({ error: "Stock adjustment not found" }, { status: 404 });
    }

    // Fetch items
    const { data: items } = await supabase
      .from("stock_adjustment_items")
      .select("*")
      .eq("adjustment_id", id);

    // Fetch related data
    const locationId = adjustment.custom_fields?.locationId;
    const [warehouse, location] = await Promise.all([
      adjustment.warehouse_id
        ? supabase
            .from("warehouses")
            .select("warehouse_name")
            .eq("id", adjustment.warehouse_id)
            .single()
        : Promise.resolve(null),
      locationId
        ? supabase.from("warehouse_locations").select("code, name").eq("id", locationId).single()
        : Promise.resolve(null),
    ]);

    const stockTransaction = adjustment.stock_transaction_id
      ? await supabase
          .from("stock_transactions")
          .select("transaction_code")
          .eq("id", adjustment.stock_transaction_id)
          .single()
      : null;

    const createdBy = await supabase
      .from("users")
      .select("first_name, last_name")
      .eq("id", adjustment.created_by)
      .single();
    const approvedBy = adjustment.approved_by
      ? await supabase
          .from("users")
          .select("first_name, last_name")
          .eq("id", adjustment.approved_by)
          .single()
      : null;
    const postedBy = adjustment.posted_by
      ? await supabase
          .from("users")
          .select("first_name, last_name")
          .eq("id", adjustment.posted_by)
          .single()
      : null;

    const typedItems = (items as DbStockAdjustmentItem[] | null) || [];
    const batchLocationIds = Array.from(
      new Set(
        typedItems
          .map((item) => item.item_batch_location_id)
          .filter((value): value is string => Boolean(value))
      )
    );
    const { data: batchLocationsData } =
      batchLocationIds.length > 0
        ? await supabase
            .from("item_batch_locations")
            .select(
              `
              id,
              batch_location_sku,
              location_id,
              item_batch:item_batches!item_batch_locations_item_batch_id_fkey(
                batch_code,
                received_at
              ),
              warehouse_location:warehouse_locations!item_batch_locations_location_id_fkey(
                code,
                name
              )
            `
            )
            .in("id", batchLocationIds)
        : { data: [] };
    const batchLocationsMap = new Map(
      (batchLocationsData as BatchLocationRow[] | null)?.map((row) => [row.id, row]) || []
    );

    return NextResponse.json({
      id: adjustment.id,
      companyId: adjustment.company_id,
      adjustmentCode: adjustment.adjustment_code,
      adjustmentType: adjustment.adjustment_type,
      adjustmentDate: adjustment.adjustment_date,
      warehouseId: adjustment.warehouse_id,
      locationId: adjustment.custom_fields?.locationId || null,
      locationCode: location?.data?.code || null,
      locationName: location?.data?.name || null,
      warehouseName: warehouse?.data?.warehouse_name || null,
      status: adjustment.status,
      reason: adjustment.reason,
      notes: adjustment.notes,
      totalValue: parseFloat(String(adjustment.total_value ?? 0)),
      stockTransactionId: adjustment.stock_transaction_id,
      stockTransactionCode: stockTransaction?.data?.transaction_code || null,
      approvedBy: adjustment.approved_by,
      approvedByName: approvedBy?.data
        ? `${approvedBy.data.first_name || ""} ${approvedBy.data.last_name || ""}`.trim()
        : null,
      approvedAt: adjustment.approved_at,
      postedBy: adjustment.posted_by,
      postedByName: postedBy?.data
        ? `${postedBy.data.first_name || ""} ${postedBy.data.last_name || ""}`.trim()
        : null,
      postedAt: adjustment.posted_at,
      createdBy: adjustment.created_by,
      createdByName: createdBy?.data
        ? `${createdBy.data.first_name || ""} ${createdBy.data.last_name || ""}`.trim()
        : null,
      updatedBy: adjustment.updated_by,
      createdAt: adjustment.created_at,
      updatedAt: adjustment.updated_at,
      items: typedItems.map((item) => {
        const batchLocation = item.item_batch_location_id
          ? batchLocationsMap.get(item.item_batch_location_id)
          : null;
        const itemBatch = toOne(batchLocation?.item_batch);
        const batchWarehouseLocation = toOne(batchLocation?.warehouse_location);

        return {
          id: item.id,
          adjustmentId: item.adjustment_id,
          itemId: item.item_id,
          itemBatchLocationId: item.item_batch_location_id,
          batchLocationSku: batchLocation?.batch_location_sku || null,
          batchCode: itemBatch?.batch_code || null,
          batchReceivedAt: itemBatch?.received_at || null,
          batchWarehouseLocationId: batchLocation?.location_id || null,
          batchLocationCode: batchWarehouseLocation?.code || null,
          batchLocationName: batchWarehouseLocation?.name || null,
          itemCode: item.item_code,
          itemName: item.item_name,
          currentQty: parseFloat(String(item.current_qty ?? 0)),
          adjustedQty: parseFloat(String(item.adjusted_qty ?? 0)),
          difference: parseFloat(String(item.difference ?? 0)),
          unitCost: parseFloat(String(item.unit_cost ?? 0)),
          totalCost: parseFloat(String(item.total_cost ?? 0)),
          uomId: item.uom_id,
          uomName: item.uom_name,
          reason: item.reason,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        };
      }),
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/stock-adjustments/[id] - Update stock adjustment (draft only)
async function PATCHHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Require 'stock_adjustments' edit permission
    const unauthorized = await requirePermission(RESOURCES.STOCK_ADJUSTMENTS, "edit");
    if (unauthorized) return unauthorized;

    const { id } = await params;
    const body = (await request.json()) as StockAdjustmentPatchBody;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, currentBusinessUnitId, userId } = context;

    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    if (body.items) {
      if (body.items.some((item) => !item.itemBatchLocationId && !item.batchCode?.trim())) {
        return NextResponse.json(
          { error: "Batch selection or batch code is required for every adjustment item" },
          { status: 400 }
        );
      }
    }

    const { data: savedAdjustments, error: updateError } = await supabase.rpc(
      "update_stock_adjustment",
      {
        p_adjustment_date: body.adjustmentDate || null,
        p_adjustment_id: id,
        p_adjustment_type: body.adjustmentType || null,
        p_business_unit_id: currentBusinessUnitId,
        p_company_id: companyId,
        p_items: body.items ? (body.items as unknown as Json) : null,
        p_location_id: body.locationId || null,
        p_location_id_provided: "locationId" in body,
        p_notes: body.notes || null,
        p_notes_provided: "notes" in body,
        p_reason: body.reason || null,
        p_user_id: userId,
        p_warehouse_id: body.warehouseId || null,
      }
    );
    const savedAdjustment = (savedAdjustments as StockAdjustmentSaveResult[] | null)?.[0];

    if (updateError) {
      console.error("Error updating stock adjustment:", updateError);
      const errorResponse = getStockAdjustmentUpdateErrorResponse(updateError);
      if (errorResponse) return errorResponse;

      return NextResponse.json({ error: "Failed to update stock adjustment" }, { status: 500 });
    }

    if (!savedAdjustment) {
      console.error("Error updating stock adjustment: RPC returned no saved adjustment");
      return NextResponse.json({ error: "Failed to update stock adjustment" }, { status: 500 });
    }

    // Fetch updated adjustment
    const { data: updatedAdjustment } = await supabase
      .from("stock_adjustments")
      .select("*")
      .eq("id", id)
      .single();

    const { data: updatedItems } = await supabase
      .from("stock_adjustment_items")
      .select("*")
      .eq("adjustment_id", id);

    const updatedLocationId = updatedAdjustment?.custom_fields?.locationId;
    const location = updatedLocationId
      ? await supabase
          .from("warehouse_locations")
          .select("code, name")
          .eq("id", updatedLocationId)
          .single()
      : null;

    return NextResponse.json({
      id: updatedAdjustment.id,
      companyId: updatedAdjustment.company_id,
      adjustmentCode: updatedAdjustment.adjustment_code,
      adjustmentType: updatedAdjustment.adjustment_type,
      adjustmentDate: updatedAdjustment.adjustment_date,
      warehouseId: updatedAdjustment.warehouse_id,
      locationId: updatedAdjustment.custom_fields?.locationId || null,
      locationCode: location?.data?.code || null,
      locationName: location?.data?.name || null,
      status: updatedAdjustment.status,
      reason: updatedAdjustment.reason,
      notes: updatedAdjustment.notes,
      totalValue: parseFloat(String(updatedAdjustment.total_value ?? 0)),
      createdBy: updatedAdjustment.created_by,
      updatedBy: updatedAdjustment.updated_by,
      createdAt: updatedAdjustment.created_at,
      updatedAt: updatedAdjustment.updated_at,
      items:
        (updatedItems as DbStockAdjustmentItem[] | null)?.map((item) => ({
          id: item.id,
          adjustmentId: item.adjustment_id,
          itemId: item.item_id,
          itemBatchLocationId: item.item_batch_location_id,
          itemCode: item.item_code,
          itemName: item.item_name,
          currentQty: parseFloat(String(item.current_qty ?? 0)),
          adjustedQty: parseFloat(String(item.adjusted_qty ?? 0)),
          difference: parseFloat(String(item.difference ?? 0)),
          unitCost: parseFloat(String(item.unit_cost ?? 0)),
          totalCost: parseFloat(String(item.total_cost ?? 0)),
          uomId: item.uom_id,
          uomName: item.uom_name,
          reason: item.reason,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        })) || [],
    });
  } catch (error) {
    console.error("Internal server error updating stock adjustment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/stock-adjustments/[id] - Soft delete stock adjustment (draft only)
async function DELETEHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require 'stock_adjustments' delete permission
    const unauthorized = await requirePermission(RESOURCES.STOCK_ADJUSTMENTS, "delete");
    if (unauthorized) return unauthorized;

    const { id } = await params;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, userId } = context;

    // Check adjustment exists and is draft
    const { data: adjustment, error: fetchError } = await supabase
      .from("stock_adjustments")
      .select("status")
      .eq("id", id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !adjustment) {
      return NextResponse.json({ error: "Stock adjustment not found" }, { status: 404 });
    }

    if (adjustment.status !== "draft") {
      return NextResponse.json({ error: "Only draft adjustments can be deleted" }, { status: 400 });
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from("stock_adjustments")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "view",
  resourceType: "stock_adjustments",
  route: "/api/stock-adjustments/[id]",
});
export const PATCH = withActivityLogging(PATCHHandler, {
  action: "update",
  resourceType: "stock_adjustments",
  route: "/api/stock-adjustments/[id]",
});
export const DELETE = withActivityLogging(DELETEHandler, {
  action: "delete",
  resourceType: "stock_adjustments",
  route: "/api/stock-adjustments/[id]",
});
