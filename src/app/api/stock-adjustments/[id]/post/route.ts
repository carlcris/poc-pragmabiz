import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { getStockAdjustmentPostError } from "@/lib/stock-adjustments/save-errors";
import { RESOURCES } from "@/constants/resources";

import type { Database } from "@/types/database.types";
import type { PostStockAdjustmentResponse } from "@/types/stock-adjustment";

type PostStockAdjustmentResult =
  Database["public"]["Functions"]["post_stock_adjustment"]["Returns"][number];

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
      return NextResponse.json(
        {
          code: "STOCK_ADJUSTMENT_BU_REQUIRED",
          error: "Select a business unit, then try posting again.",
        },
        { status: 400 }
      );
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc("post_stock_adjustment", {
      p_adjustment_id: id,
      p_company_id: companyId,
      p_business_unit_id: currentBusinessUnitId,
      p_user_id: userId,
    });

    if (rpcError) {
      console.error("Error posting stock adjustment:", rpcError);
      const failure = getStockAdjustmentPostError(rpcError);
      if (failure) {
        return NextResponse.json(
          { error: failure.error, code: failure.code },
          { status: failure.status }
        );
      }
      return NextResponse.json({ error: "Failed to post stock adjustment" }, { status: 500 });
    }

    const postResult = (rpcData as PostStockAdjustmentResult[] | null)?.[0];
    if (!postResult) {
      console.error("Error posting stock adjustment: RPC returned no posting result");
      return NextResponse.json({ error: "Failed to post stock adjustment" }, { status: 500 });
    }

    return NextResponse.json<PostStockAdjustmentResponse>({
      success: true,
      id: postResult.adjustment_id,
      status: "posted",
      stockTransactionId: postResult.stock_transaction_id,
      stockTransactionCode: postResult.stock_transaction_code,
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
