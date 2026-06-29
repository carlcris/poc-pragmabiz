import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import {
  asRpcClient,
  getClientErrorMessage,
  logQuotationError,
} from "../../../../quotations/_shared";

type ManufacturingAction = "start" | "complete_step" | "hold" | "resume" | "complete";

const isManufacturingAction = (value: unknown): value is ManufacturingAction =>
  value === "start" ||
  value === "complete_step" ||
  value === "hold" ||
  value === "resume" ||
  value === "complete";

async function POSTHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requireAnyPermission([
      [RESOURCES.MANUFACTURING, "edit"],
      [RESOURCES.STOCK_TRANSFORMATIONS, "edit"],
    ]);
    if (unauthorized) return unauthorized;

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      action?: unknown;
      note?: string | null;
    };

    if (!isManufacturingAction(body.action)) {
      return NextResponse.json(
        { error: "Unsupported manufacturing floor action" },
        { status: 400 }
      );
    }

    const { supabase } = await createServerClientWithBU();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await asRpcClient(supabase).rpc(
      "apply_manufacturing_floor_action_transaction",
      {
        p_manufacturing_order_id: id,
        p_action: body.action,
        p_note: body.note || null,
      }
    );

    if (error) {
      logQuotationError("Error applying manufacturing floor action:", error);
      const message = getClientErrorMessage(error, "Failed to update order");
      const status = message === "Order not found" ? 404 : 400;
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({ success: true, manufacturingOrderId: id });
  } catch (error) {
    logQuotationError("Unexpected manufacturing action error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "execute",
  resourceType: "manufacturing",
  route: "/api/manufacturing/orders/[id]/action",
});
