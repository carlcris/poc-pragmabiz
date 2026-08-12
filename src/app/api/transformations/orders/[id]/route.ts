import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { updateTransformationOrderSchema } from "@/lib/validations/transformation-order";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

// GET /api/transformations/orders/[id] - Get order by ID
async function GETHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSFORMATIONS, "view");
    if (unauthorized) return unauthorized;

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

    // Get user's company
    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    // Fetch order with all details
    const { data: order, error } = await supabase
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
        template:transformation_templates(id, template_code, template_name),
        source_warehouse:warehouses!transformation_orders_source_warehouse_id_fkey(id, warehouse_code, warehouse_name),
        inputs:transformation_order_inputs(
          id, order_id, item_id, warehouse_id, planned_quantity, consumed_quantity,
          uom_id, unit_cost, total_cost, stock_transaction_id, sequence, notes,
          created_at, created_by, updated_at, updated_by,
          items(id, item_code, item_name),
          warehouse:warehouses(id, warehouse_code, warehouse_name),
          uom:units_of_measure(id, code, name)
        ),
        outputs:transformation_order_outputs(
          id, order_id, item_id, warehouse_id, planned_quantity, produced_quantity,
          uom_id, allocated_cost_per_unit, total_allocated_cost, stock_transaction_id,
          stock_transaction_waste_id, is_scrap, output_origin, sequence, notes,
          wasted_quantity, waste_reason, created_at, created_by, updated_at, updated_by,
          items(id, item_code, item_name),
          warehouse:warehouses(id, warehouse_code, warehouse_name),
          uom:units_of_measure(id, code, name)
        )
      `
      )
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ data: order });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/transformations/orders/[id] - Update order (DRAFT only)
async function PATCHHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSFORMATIONS, "edit");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const { id } = await params;

    const { data: existingOrder } = await supabase
      .from("transformation_orders")
      .select("id, status, planned_quantity, planned_date, notes")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (existingOrder.status !== "DRAFT") {
      return NextResponse.json(
        {
          error: `Cannot update order in ${existingOrder.status} status. Only DRAFT orders can be updated.`,
        },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = updateTransformationOrderSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    const { error: updateError } = await supabase.rpc("update_transformation_order_transaction", {
      p_order_id: id,
      p_planned_quantity: data.plannedQuantity ?? existingOrder.planned_quantity,
      p_planned_date: data.plannedDate ?? existingOrder.planned_date,
      p_notes: data.notes ?? existingOrder.notes,
    });

    if (updateError) {
      console.error("Failed to update transformation order", {
        orderId: id,
        code: updateError.code,
        message: updateError.message,
      });
      const status = updateError.message === "TRANSFORMATION_ORDER_NOT_FOUND" ? 404 : 409;
      return NextResponse.json(
        { error: "The transformation order could not be updated. Refresh and try again." },
        { status }
      );
    }

    const { data: updatedOrder, error: fetchError } = await supabase
      .from("transformation_orders")
      .select(
        "id, company_id, business_unit_id, order_code, template_id, source_warehouse_id, status, planned_quantity, actual_quantity, total_input_cost, total_output_cost, cost_variance, variance_notes, order_date, planned_date, execution_date, completion_date, notes, reference_type, reference_id, created_at, created_by, updated_at, updated_by"
      )
      .eq("id", id)
      .single();

    if (fetchError || !updatedOrder) {
      console.error("Updated transformation order could not be loaded", {
        orderId: id,
        code: fetchError?.code,
        message: fetchError?.message,
      });
      return NextResponse.json(
        { error: "The order was updated but could not be reloaded. Refresh the page." },
        { status: 409 }
      );
    }

    return NextResponse.json({ data: updatedOrder });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/transformations/orders/[id] - Soft delete order (DRAFT only)
async function DELETEHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSFORMATIONS, "delete");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const { id } = await params;

    const { error: deleteError } = await supabase.rpc("delete_transformation_order_transaction", {
      p_order_id: id,
    });

    if (deleteError) {
      console.error("Failed to delete transformation order", {
        orderId: id,
        code: deleteError.code,
        message: deleteError.message,
      });
      const status = deleteError.message === "TRANSFORMATION_ORDER_NOT_FOUND" ? 404 : 409;
      return NextResponse.json(
        { error: "Only an available draft transformation order can be deleted." },
        { status }
      );
    }

    return NextResponse.json({ message: "Order deleted successfully" });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "view",
  resourceType: "transformations",
  route: "/api/transformations/orders/[id]",
});
export const PATCH = withActivityLogging(PATCHHandler, {
  action: "update",
  resourceType: "transformations",
  route: "/api/transformations/orders/[id]",
});
export const DELETE = withActivityLogging(DELETEHandler, {
  action: "delete",
  resourceType: "transformations",
  route: "/api/transformations/orders/[id]",
});
