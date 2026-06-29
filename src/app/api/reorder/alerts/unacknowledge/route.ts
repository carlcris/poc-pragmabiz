import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import { acknowledgeAlertSchema } from "@/lib/validations/reorder";

// POST /api/reorder/alerts/unacknowledge
// Restores generated reorder alerts to the active alert list.
async function POSTHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.REORDER_MANAGEMENT, "edit");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, userId } = context;

    const body = await request.json();
    const parsed = acknowledgeAlertSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request: alertIds must be a non-empty UUID array" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc("unacknowledge_reorder_alerts", {
      p_company_id: companyId,
      p_alert_ids: parsed.data.alertIds,
      p_unacknowledged_by: userId,
    });

    if (error) {
      console.error("Error restoring reorder alerts:", error);
      return NextResponse.json({ error: "Failed to restore alerts" }, { status: 500 });
    }

    const row = ((data || [])[0] || null) as {
      unacknowledged_count?: number | string | null;
    } | null;
    const unacknowledgedCount = Number(row?.unacknowledged_count || 0);

    return NextResponse.json({
      success: true,
      message: `${unacknowledgedCount} alert(s) restored`,
      unacknowledgedCount,
    });
  } catch (error) {
    console.error("Unexpected error restoring reorder alerts:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "unacknowledge",
  resourceType: "reorder",
  route: "/api/reorder/alerts/unacknowledge",
});
