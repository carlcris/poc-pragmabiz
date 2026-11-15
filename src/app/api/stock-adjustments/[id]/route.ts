import {
  mapStockAdjustmentItem,
  STOCK_ADJUSTMENT_ITEM_COLUMNS,
} from "@/lib/stock-adjustments/stock-adjustment-item-response";
import {
  batchExpirationDateSchema,
  getBatchExpirationDateError,
} from "@/lib/stock-adjustments/batch-expiration-date";
import { stockAdjustmentEnteredUnitSchema } from "@/lib/stock-adjustments/entered-unit-schema";
import { getStockAdjustmentSaveError } from "@/lib/stock-adjustments/save-errors";
import {
  batchReceivedDateSchema,
  getBatchReceivedDateError,
} from "@/lib/stock-adjustments/batch-received-date";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import type { Database, Json } from "@/types/database.types";
import type { SaveStockAdjustmentResponse, StockAdjustmentStatus } from "@/types/stock-adjustment";
type StockAdjustmentItemInput = {
  itemId: string;
  itemBatchLocationId?: string | null;
  batchCode?: string | null;
  batchReceivedDate?: string;
  batchExpirationDate?: string | null;
  itemBatchId?: string;
  enteredQty: number;
  enteredUnitOptionId: string | null;
  currentQty: number;
  adjustedQty: number;
  unitCost: number;
  uomId: string;
  reason?: string | null;
};

type StockAdjustmentPatchBody = {
  adjustmentType?: string;
  adjustmentDate?: string;
  reason?: string;
  notes?: string | null;
  locationId?: string | null;
  items?: StockAdjustmentItemInput[];
};

type StockAdjustmentSaveResult =
  Database["public"]["Functions"]["update_stock_adjustment"]["Returns"][number];

const STOCK_ADJUSTMENT_COLUMNS = `
  id,
  company_id,
  adjustment_code,
  adjustment_type,
  adjustment_date,
  warehouse_id,
  status,
  reason,
  notes,
  total_value,
  stock_transaction_id,
  approved_by,
  approved_at,
  posted_by,
  posted_at,
  custom_fields,
  created_by,
  updated_by,
  created_at,
  updated_at
`;

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
      .select(STOCK_ADJUSTMENT_COLUMNS)
      .eq("id", id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw error;
    if (!adjustment) {
      return NextResponse.json({ error: "Stock adjustment not found" }, { status: 404 });
    }

    // Fetch items
    const { data: items, error: itemsError } = await supabase
      .from("stock_adjustment_items")
      .select(STOCK_ADJUSTMENT_ITEM_COLUMNS)
      .eq("adjustment_id", id);
    if (itemsError) throw itemsError;

    // Fetch related data
    const locationId = adjustment.custom_fields?.locationId;
    const [warehouse, location] = await Promise.all([
      adjustment.warehouse_id
        ? supabase
            .from("warehouses")
            .select("warehouse_code, warehouse_name")
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
      warehouseCode: warehouse?.data?.warehouse_code || null,
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
      items: (items ?? []).map((item) =>
        mapStockAdjustmentItem(item, {
          id: locationId,
          code: location?.data?.code,
          name: location?.data?.name,
        })
      ),
    });
  } catch (error) {
    console.error("Error reading stock adjustment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/stock-adjustments/[id] - Update stock adjustment (draft only)
async function PATCHHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Require 'stock_adjustments' edit permission
    const unauthorized = await requirePermission(RESOURCES.STOCK_ADJUSTMENTS, "edit");
    if (unauthorized) {
      if (unauthorized.status === 403) {
        const failure = getStockAdjustmentSaveError({ code: "42501" })!;
        return NextResponse.json({ error: failure.error, code: failure.code }, { status: 403 });
      }
      return unauthorized;
    }

    const { id } = await params;
    const body = (await request.json()) as StockAdjustmentPatchBody;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, currentBusinessUnitId, userId } = context;

    if (!currentBusinessUnitId) {
      return NextResponse.json(
        {
          error: "Select a business unit, then try saving again.",
          code: "STOCK_ADJUSTMENT_BU_REQUIRED",
        },
        { status: 400 }
      );
    }

    if ("warehouseId" in body) {
      return NextResponse.json(
        {
          error:
            "The warehouse cannot be changed. Create a new adjustment for the other warehouse.",
          code: "STOCK_ADJUSTMENT_WAREHOUSE_IMMUTABLE",
        },
        { status: 400 }
      );
    }

    if (body.items) {
      if (
        body.items.some(
          (item) => !item.itemBatchLocationId && !item.itemBatchId && !item.batchCode?.trim()
        )
      ) {
        return NextResponse.json(
          {
            error: "Select an existing batch or enter a batch code for every item.",
            code: "STOCK_ADJUSTMENT_BATCH_REQUIRED",
          },
          { status: 400 }
        );
      }
    }

    if (
      body.items?.some(
        (item) =>
          !item.itemBatchLocationId &&
          !item.itemBatchId &&
          !batchReceivedDateSchema.safeParse(item.batchReceivedDate).success
      )
    ) {
      const error = getBatchReceivedDateError("SA001")!;
      return NextResponse.json({ error: error.error, code: error.code }, { status: error.status });
    }

    if (
      body.items?.some(
        (item) =>
          item.batchExpirationDate !== undefined &&
          (Boolean(item.itemBatchLocationId) ||
            Boolean(item.itemBatchId) ||
            !batchExpirationDateSchema.safeParse(item.batchExpirationDate).success)
      )
    ) {
      const failure = getBatchExpirationDateError();
      return NextResponse.json(
        { error: failure.error, code: failure.code },
        { status: failure.status }
      );
    }

    if (body.items?.some((item) => !stockAdjustmentEnteredUnitSchema.safeParse(item).success)) {
      const failure = getStockAdjustmentSaveError({
        message: "Invalid stock adjustment entered quantity or unit",
      })!;
      return NextResponse.json(
        { error: failure.error, code: failure.code },
        { status: failure.status }
      );
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
        p_warehouse_id: null,
      }
    );
    const savedAdjustment = (savedAdjustments as StockAdjustmentSaveResult[] | null)?.[0];

    if (updateError) {
      console.error("Error updating stock adjustment:", updateError);
      const saveFailure = getStockAdjustmentSaveError(updateError);
      if (saveFailure)
        return NextResponse.json(
          { error: saveFailure.error, code: saveFailure.code },
          { status: saveFailure.status }
        );

      return NextResponse.json({ error: "Failed to update stock adjustment" }, { status: 500 });
    }

    if (!savedAdjustment) {
      console.error("Error updating stock adjustment: RPC returned no saved adjustment");
      return NextResponse.json({ error: "Failed to update stock adjustment" }, { status: 500 });
    }

    return NextResponse.json<SaveStockAdjustmentResponse>({
      id: savedAdjustment.adjustment_id,
      adjustmentCode: savedAdjustment.adjustment_code,
      status: savedAdjustment.status as StockAdjustmentStatus,
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
      return NextResponse.json(
        {
          error:
            "This adjustment is no longer available. Refresh the list and select another draft.",
          code: "STOCK_ADJUSTMENT_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    if (adjustment.status !== "draft") {
      return NextResponse.json({ error: "Only draft adjustments can be deleted" }, { status: 400 });
    }

    // Soft delete
    const { data: deletedAdjustment, error: deleteError } = await supabase
      .from("stock_adjustments")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", id)
      .eq("company_id", companyId)
      .eq("status", "draft")
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (deleteError) {
      console.error("Error deleting draft stock adjustment:", deleteError);
      return NextResponse.json({ error: "Failed to delete stock adjustment" }, { status: 500 });
    }
    if (!deletedAdjustment) {
      return NextResponse.json(
        { error: "This draft changed. Refresh the list before trying again." },
        { status: 409 }
      );
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
