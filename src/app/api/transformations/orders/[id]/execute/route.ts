import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { executeTransformationOrderSchema } from "@/lib/validations/transformation-order";
import {
  executeTransformation,
  validateStateTransition,
} from "@/services/inventory/transformationService";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

// POST /api/transformations/orders/[id]/execute - Execute transformation (PREPARING → COMPLETED)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSFORMATIONS, "edit");
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

    // Validate state transition (must be in PREPARING status)
    const transitionValidation = await validateStateTransition(id, "COMPLETED");
    if (!transitionValidation.isValid) {
      return NextResponse.json(
        { error: transitionValidation.error || "Invalid state transition" },
        { status: 400 }
      );
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

    // Execute transformation (consumes inputs, produces outputs, records lineage)
    // Note: executeTransformation now handles status update to COMPLETED
    // IMPORTANT: Pass the supabase client so it uses the same session with BU context
    const result = await executeTransformation(id, user.id, data, supabase);

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Execution failed" }, { status: 500 });
    }

    // Fetch complete order with all details
    const { data: completeOrder } = await supabase
      .from("transformation_orders")
      .select(
        `
        *,
        inputs:transformation_order_inputs(*),
        outputs:transformation_order_outputs(*)
      `
      )
      .eq("id", id)
      .single();

    return NextResponse.json({
      data: completeOrder,
      message: "Transformation executed successfully",
      stockTransactions: result.stockTransactionIds,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
