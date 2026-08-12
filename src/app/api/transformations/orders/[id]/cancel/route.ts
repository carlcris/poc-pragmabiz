import { NextRequest, NextResponse } from "next/server";
import { RESOURCES } from "@/constants/resources";
import { requirePermission } from "@/lib/auth";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";

async function POSTHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSFORMATIONS, "edit");
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const { supabase } = await createServerClientWithBU();
    const { error } = await supabase.rpc("cancel_transformation_order_transaction", {
      p_order_id: id,
    });

    if (error) {
      console.error("Failed to cancel transformation order", {
        orderId: id,
        code: error.code,
        message: error.message,
      });
      const status = error.message === "TRANSFORMATION_ORDER_NOT_FOUND" ? 404 : 409;
      const message =
        error.message === "TRANSFORMATION_ORDER_NOT_FOUND"
          ? "This transformation order is no longer available."
          : "Only draft or preparing transformation orders can be cancelled.";
      return NextResponse.json({ error: message }, { status });
    }

    const { data: order, error: fetchError } = await supabase
      .from("transformation_orders")
      .select(
        "id, company_id, business_unit_id, order_code, template_id, source_warehouse_id, status, planned_quantity, actual_quantity, total_input_cost, total_output_cost, cost_variance, variance_notes, order_date, planned_date, execution_date, completion_date, notes, reference_type, reference_id, created_at, created_by, updated_at, updated_by"
      )
      .eq("id", id)
      .single();

    if (fetchError || !order) {
      return NextResponse.json(
        { error: "The order was cancelled but could not be reloaded. Refresh the page." },
        { status: 409 }
      );
    }

    return NextResponse.json({ data: order, message: "Order cancelled successfully" });
  } catch (error) {
    console.error("Unexpected transformation cancellation failure", { error });
    return NextResponse.json(
      { error: "The transformation order could not be cancelled." },
      { status: 500 }
    );
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "cancel",
  resourceType: "transformations",
  route: "/api/transformations/orders/[id]/cancel",
});
