import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { executeTransformationOrderSchema } from "@/lib/validations/transformation-order";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import type { TransformationOrderCompleteErrorCode } from "@/types/transformation-order";

type TransformationOrderCompleteSafeError = {
  error: string;
  code: TransformationOrderCompleteErrorCode;
  status: 400 | 403 | 404 | 409;
};

const transformationOrderCompleteSafeErrors: Record<string, TransformationOrderCompleteSafeError> =
  {
    "Business unit context required": {
      error: "Your business unit context is no longer available. Refresh the page and try again.",
      code: "TRANSFORMATION_CONTEXT_INVALID",
      status: 409,
    },
    "Business unit context is invalid": {
      error: "Your business unit context is no longer available. Refresh the page and try again.",
      code: "TRANSFORMATION_CONTEXT_INVALID",
      status: 409,
    },
    Forbidden: {
      error: "You no longer have permission to complete transformation orders.",
      code: "TRANSFORMATION_COMPLETE_FORBIDDEN",
      status: 403,
    },
    "Order not found": {
      error: "This transformation order is no longer available.",
      code: "TRANSFORMATION_ORDER_UNAVAILABLE",
      status: 404,
    },
    "Order must be preparing": {
      error: "This order is no longer preparing. Refresh the page to see its current status.",
      code: "TRANSFORMATION_ORDER_STATUS_CHANGED",
      status: 409,
    },
    "Invalid execution lines": {
      error: "The completion lines are invalid. Refresh the order and try again.",
      code: "TRANSFORMATION_EXECUTION_LINES_INVALID",
      status: 400,
    },
    "All order lines must be supplied": {
      error: "The order lines changed. Refresh the order before completing it.",
      code: "TRANSFORMATION_EXECUTION_LINES_INCOMPLETE",
      status: 409,
    },
    "Execution lines must be unique": {
      error: "A completion line was submitted more than once. Refresh the order and try again.",
      code: "TRANSFORMATION_EXECUTION_LINES_DUPLICATE",
      status: 400,
    },
    "Invalid execution quantities": {
      error: "One or more completion quantities are invalid. Review the quantities and try again.",
      code: "TRANSFORMATION_EXECUTION_QUANTITIES_INVALID",
      status: 400,
    },
    "Transformation order contains an unavailable input or output item": {
      error:
        "This order references an inactive or deleted item or unit. Reactivate it before completing the order.",
      code: "TRANSFORMATION_ORDER_ITEM_UNAVAILABLE",
      status: 409,
    },
    "Insufficient input stock": {
      error: "There is not enough available stock for one or more input materials.",
      code: "TRANSFORMATION_INPUT_STOCK_INSUFFICIENT",
      status: 409,
    },
    "Insufficient input batch stock": {
      error: "There is not enough available stock for one or more input materials.",
      code: "TRANSFORMATION_INPUT_STOCK_INSUFFICIENT",
      status: 409,
    },
  };

// POST /api/transformations/orders/[id]/execute - Execute transformation (PREPARING → COMPLETED)
async function POSTHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSFORMATIONS, "edit");
    if (unauthorized) {
      if (unauthorized.status === 403) {
        return NextResponse.json(
          {
            error: "You do not have permission to complete transformation orders.",
            code: "TRANSFORMATION_COMPLETE_FORBIDDEN" satisfies TransformationOrderCompleteErrorCode,
          },
          { status: 403 }
        );
      }
      return unauthorized;
    }

    const { supabase } = await createServerClientWithBU();
    const { id } = await params;

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = executeTransformationOrderSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const data = validationResult.data;
    const { data: stockTransactions, error: executionError } = await supabase.rpc(
      "complete_transformation_order_transaction",
      {
        p_order_id: id,
        p_inputs: data.inputs,
        p_outputs: data.outputs,
        p_execution_date: data.executionDate ?? null,
        p_notes: data.notes ?? null,
      }
    );

    if (executionError) {
      console.error("Failed to complete transformation order transaction", {
        orderId: id,
        code: executionError.code,
        message: executionError.message,
      });
      const safeError = transformationOrderCompleteSafeErrors[executionError.message];
      if (safeError) {
        return NextResponse.json(
          { error: safeError.error, code: safeError.code },
          { status: safeError.status }
        );
      }

      return NextResponse.json(
        { error: "The transformation order could not be completed. Please try again." },
        { status: 500 }
      );
    }

    // Fetch complete order with all details
    const { data: completeOrder, error: fetchError } = await supabase
      .from("transformation_orders")
      .select(
        `
        id,
        company_id,
        business_unit_id,
        order_code,
        template_id,
        source_warehouse_id,
        status,
        planned_quantity,
        actual_quantity,
        total_input_cost,
        total_output_cost,
        cost_variance,
        variance_notes,
        order_date,
        planned_date,
        execution_date,
        completion_date,
        notes,
        reference_type,
        reference_id,
        created_at,
        created_by,
        updated_at,
        updated_by,
        inputs:transformation_order_inputs(
          id, order_id, item_id, warehouse_id, planned_quantity, consumed_quantity,
          uom_id, unit_cost, total_cost, stock_transaction_id, sequence, notes,
          created_at, created_by, updated_at, updated_by
        ),
        outputs:transformation_order_outputs(
          id, order_id, item_id, warehouse_id, planned_quantity, produced_quantity,
          uom_id, allocated_cost_per_unit, total_allocated_cost, stock_transaction_id,
          stock_transaction_waste_id, is_scrap, output_origin, sequence, notes,
          wasted_quantity, waste_reason, created_at, created_by, updated_at, updated_by
        )
      `
      )
      .eq("id", id)
      .single();

    if (fetchError || !completeOrder) {
      console.error("Completed transformation order could not be loaded", {
        orderId: id,
        code: fetchError?.code,
        message: fetchError?.message,
      });
      return NextResponse.json(
        { error: "Transformation completed but could not be loaded" },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      data: completeOrder,
      message: "Transformation executed successfully",
      stockTransactions,
    });
  } catch (error) {
    console.error("Unexpected transformation completion error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "execute",
  resourceType: "transformations",
  route: "/api/transformations/orders/[id]/execute",
});
