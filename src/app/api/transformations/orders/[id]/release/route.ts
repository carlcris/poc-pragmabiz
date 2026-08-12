import { NextRequest, NextResponse } from "next/server";
import { RESOURCES } from "@/constants/resources";
import { requirePermission } from "@/lib/auth";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";

const prepareErrors: Record<string, { error: string; status: 404 | 409 }> = {
  TRANSFORMATION_ORDER_NOT_FOUND: {
    error: "This transformation order is no longer available.",
    status: 404,
  },
  TRANSFORMATION_ORDER_STATUS_CHANGED: {
    error: "Only draft transformation orders can begin preparation.",
    status: 409,
  },
  TRANSFORMATION_INPUT_BATCH_STOCK_INSUFFICIENT: {
    error: "There is not enough FIFO batch stock to prepare every input.",
    status: 409,
  },
  TRANSFORMATION_TEMPLATE_UNAVAILABLE: {
    error: "Reactivate the transformation template before preparing this order.",
    status: 409,
  },
  TRANSFORMATION_INPUT_ITEM_UNAVAILABLE: {
    error: "Reactivate every transformation input item before preparing this order.",
    status: 409,
  },
};

async function POSTHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSFORMATIONS, "edit");
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const { supabase } = await createServerClientWithBU();
    const { error } = await supabase.rpc("allocate_transformation_reservations", {
      p_order_id: id,
    });

    if (error) {
      console.error("Failed to prepare transformation order", {
        orderId: id,
        code: error.code,
        message: error.message,
      });
      const safeError = prepareErrors[error.message];
      return NextResponse.json(
        { error: safeError?.error ?? "The transformation order could not be prepared." },
        { status: safeError?.status ?? 500 }
      );
    }

    const { data: order, error: fetchError } = await supabase
      .from("transformation_orders")
      .select(
        "id, company_id, business_unit_id, order_code, template_id, source_warehouse_id, status, planned_quantity, actual_quantity, total_input_cost, total_output_cost, cost_variance, variance_notes, order_date, planned_date, execution_date, completion_date, notes, reference_type, reference_id, created_at, created_by, updated_at, updated_by"
      )
      .eq("id", id)
      .single();

    if (fetchError || !order) {
      console.error("Prepared transformation order could not be loaded", {
        orderId: id,
        code: fetchError?.code,
        message: fetchError?.message,
      });
      return NextResponse.json(
        { error: "The order was prepared but could not be reloaded. Refresh the page." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      data: order,
      message: `Order ${order.order_code} is now being prepared`,
    });
  } catch (error) {
    console.error("Unexpected transformation preparation failure", { error });
    return NextResponse.json(
      { error: "The transformation order could not be prepared." },
      { status: 500 }
    );
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "release",
  resourceType: "transformations",
  route: "/api/transformations/orders/[id]/release",
});
