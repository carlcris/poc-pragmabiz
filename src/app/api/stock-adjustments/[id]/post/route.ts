import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";

type DbStockAdjustmentItem = {
  id: string;
  adjustment_id: string;
  item_id: string;
  item_batch_location_id: string | null;
  item_code: string;
  item_name: string;
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

type PostStockAdjustmentResult = {
  adjustment_id: string;
  stock_transaction_id: string;
  stock_transaction_code: string | null;
};

// POST /api/stock-adjustments/[id]/post - Post/approve stock adjustment (creates stock transaction)
async function POSTHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Require 'stock_adjustments' edit permission (posting is a form of editing)
    const unauthorized = await requirePermission(RESOURCES.STOCK_ADJUSTMENTS, "edit");
    if (unauthorized) return unauthorized;

    const { id } = await params;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, currentBusinessUnitId, userId } = context;

    // Validate business unit context
    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc("post_stock_adjustment", {
      p_adjustment_id: id,
      p_company_id: companyId,
      p_business_unit_id: currentBusinessUnitId,
      p_user_id: userId,
    });

    if (rpcError) {
      console.error("Error posting stock adjustment:", rpcError);
      return NextResponse.json({ error: "Failed to post stock adjustment" }, { status: 500 });
    }

    const postResult = ((rpcData || []) as PostStockAdjustmentResult[])[0] || null;

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

    return NextResponse.json({
      success: true,
      message: "Stock adjustment posted successfully. Stock levels updated.",
      stockTransactionCode: postResult?.stock_transaction_code || null,
      adjustment: {
        id: updatedAdjustment.id,
        companyId: updatedAdjustment.company_id,
        adjustmentCode: updatedAdjustment.adjustment_code,
        adjustmentType: updatedAdjustment.adjustment_type,
        adjustmentDate: updatedAdjustment.adjustment_date,
        warehouseId: updatedAdjustment.warehouse_id,
        status: updatedAdjustment.status,
        reason: updatedAdjustment.reason,
        notes: updatedAdjustment.notes,
        totalValue: parseFloat(String(updatedAdjustment.total_value ?? 0)),
        stockTransactionId: updatedAdjustment.stock_transaction_id,
        approvedBy: updatedAdjustment.approved_by,
        approvedAt: updatedAdjustment.approved_at,
        postedBy: updatedAdjustment.posted_by,
        postedAt: updatedAdjustment.posted_at,
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
      },
    });
  } catch (error) {
    console.error("Error posting stock adjustment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "post",
  resourceType: "stock_adjustments",
  route: "/api/stock-adjustments/[id]/post",
});
