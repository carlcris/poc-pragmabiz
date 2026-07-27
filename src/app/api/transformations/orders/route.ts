import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { createTransformationOrderSchema } from "@/lib/validations/transformation-order";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import type { TransformationOrderCreateErrorCode } from "@/types/transformation-order";

type TransformationOrderCreateSafeError = {
  error: string;
  code: TransformationOrderCreateErrorCode;
  status: 400 | 403 | 409;
};

const transformationOrderCreateSafeErrors: Record<string, TransformationOrderCreateSafeError> = {
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
    error: "You no longer have permission to create transformation orders.",
    code: "TRANSFORMATION_CREATE_FORBIDDEN",
    status: 403,
  },
  "Planned quantity must be greater than zero": {
    error: "Planned quantity must be greater than zero.",
    code: "TRANSFORMATION_PLANNED_QUANTITY_INVALID",
    status: 400,
  },
  "Planned input and output quantities must be whole numbers": {
    error:
      "This quantity is not valid for the selected template because it would produce a fractional input or output quantity.",
    code: "TRANSFORMATION_PLANNED_QUANTITY_RATIO_INVALID",
    status: 400,
  },
  "Template not found": {
    error: "The selected template is no longer active or available. Choose another template.",
    code: "TRANSFORMATION_TEMPLATE_UNAVAILABLE",
    status: 409,
  },
  "Warehouse not found": {
    error: "The selected warehouse is no longer active or available. Choose another warehouse.",
    code: "TRANSFORMATION_WAREHOUSE_UNAVAILABLE",
    status: 409,
  },
  "Template requires input and output lines": {
    error:
      "The selected template needs at least one input and one primary output before it can be used.",
    code: "TRANSFORMATION_TEMPLATE_LINES_REQUIRED",
    status: 409,
  },
  "Template contains an unavailable input or output item": {
    error:
      "The selected template references an inactive or deleted item or unit. Update the template and try again.",
    code: "TRANSFORMATION_TEMPLATE_ITEM_UNAVAILABLE",
    status: 409,
  },
  "Template additional output item is unavailable": {
    error:
      "The selected template references an inactive or deleted item or unit. Update the template and try again.",
    code: "TRANSFORMATION_TEMPLATE_ITEM_UNAVAILABLE",
    status: 409,
  },
};

// GET /api/transformations/orders - List transformation orders
async function GETHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSFORMATIONS, "view");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const searchParams = request.nextUrl.searchParams;

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

    // Parse query parameters
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const templateId = searchParams.get("templateId") || "";
    const warehouseId = searchParams.get("warehouseId") || "";
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from("transformation_orders")
      .select(
        `
        id,
        company_id,
        order_code,
        template_id,
        source_warehouse_id,
        status,
        planned_quantity,
        actual_quantity,
        total_input_cost,
        total_output_cost,
        cost_variance,
        order_date,
        planned_date,
        execution_date,
        completion_date,
        notes,
        created_by,
        created_at,
        updated_by,
        updated_at,
        template:transformation_templates(template_code, template_name),
        source_warehouse:warehouses!transformation_orders_source_warehouse_id_fkey(warehouse_code, warehouse_name)
      `,
        { count: "exact" }
      )
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .order("order_date", { ascending: false })
      .order("created_at", { ascending: false });

    // Apply filters
    if (search) {
      query = query.or(`order_code.ilike.%${search}%,notes.ilike.%${search}%`);
    }
    if (status) {
      query = query.eq("status", status);
    }
    if (templateId) {
      query = query.eq("template_id", templateId);
    }
    if (warehouseId) {
      query = query.eq("source_warehouse_id", warehouseId);
    }
    if (dateFrom) {
      query = query.gte("order_date", dateFrom);
    }
    if (dateTo) {
      query = query.lte("order_date", dateTo);
    }

    // Execute query
    const { data: orders, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error("Failed to list transformation orders", {
        code: error.code,
        message: error.message,
      });
      return NextResponse.json({ error: "Failed to load transformation orders" }, { status: 500 });
    }

    return NextResponse.json({
      data: orders || [],
      total: count || 0,
      page,
      limit,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/transformations/orders - Create transformation order from template
async function POSTHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSFORMATIONS, "create");
    if (unauthorized) {
      if (unauthorized.status === 403) {
        return NextResponse.json(
          {
            error: "You do not have permission to create transformation orders.",
            code: "TRANSFORMATION_CREATE_FORBIDDEN" satisfies TransformationOrderCreateErrorCode,
          },
          { status: 403 }
        );
      }
      return unauthorized;
    }

    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!currentBusinessUnitId) {
      return NextResponse.json(
        {
          error:
            "Your business unit context is no longer available. Refresh the page and try again.",
          code: "TRANSFORMATION_CONTEXT_INVALID" satisfies TransformationOrderCreateErrorCode,
        },
        { status: 409 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = createTransformationOrderSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const data = validationResult.data;
    const { data: orderId, error: createError } = await supabase.rpc(
      "create_transformation_order_transaction",
      {
        p_template_id: data.templateId,
        p_warehouse_id: data.warehouseId,
        p_planned_quantity: data.plannedQuantity,
        p_order_date: data.orderDate ?? null,
        p_planned_date: data.plannedDate ?? null,
        p_notes: data.notes ?? null,
        p_reference_type: data.referenceType ?? null,
        p_reference_id: data.referenceId ?? null,
      }
    );

    if (createError) {
      console.error("Failed to create transformation order transaction", {
        code: createError.code,
        message: createError.message,
      });

      const safeError = transformationOrderCreateSafeErrors[createError.message];
      if (safeError) {
        return NextResponse.json(
          { error: safeError.error, code: safeError.code },
          { status: safeError.status }
        );
      }

      return NextResponse.json(
        { error: "The transformation order could not be created. Please try again." },
        { status: 500 }
      );
    }

    if (!orderId) {
      console.error("Transformation order transaction returned no order ID");
      return NextResponse.json(
        { error: "The transformation order could not be created. Please try again." },
        { status: 500 }
      );
    }

    // Fetch complete order with inputs/outputs
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
      .eq("id", orderId)
      .single();

    if (fetchError || !completeOrder) {
      console.error("Created transformation order could not be loaded", {
        orderId,
        code: fetchError?.code,
        message: fetchError?.message,
      });
      return NextResponse.json(
        { error: "Transformation order created but could not be loaded" },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({ data: completeOrder }, { status: 201 });
  } catch (error) {
    console.error("Unexpected transformation order creation error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "transformations",
  route: "/api/transformations/orders",
});
export const POST = withActivityLogging(POSTHandler, {
  action: "create",
  resourceType: "transformations",
  route: "/api/transformations/orders",
});
