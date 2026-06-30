import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
/**
 * Dashboard Reorder Alerts API
 *
 * Endpoint:
 * - GET /api/analytics/dashboard/reorder-alerts - Get items below reorder point
 */

import { NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

async function GETHandler() {
  try {
    await requirePermission(RESOURCES.REPORTS, "view");
    const { supabase } = await createServerClientWithBU();

    // Get current user and company
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData, error: companyError } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (companyError || !userData?.company_id) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const companyId = userData.company_id;

    type ReorderAlertRpcRow = {
      item_id: string;
      item_code: string | null;
      item_name: string | null;
      total_available_stock: number | string | null;
      reorder_point: number | string | null;
    };

    const { data: alerts, error: alertsError } = await supabase.rpc(
      "get_effective_reorder_alerts",
      {
        p_company_id: companyId,
        p_as_of_date: undefined,
        p_search: null,
        p_severity: null,
        p_page: 1,
        p_limit: 10,
        p_acknowledgment_status: "active",
      }
    );

    if (alertsError) {
      console.error("Error fetching dashboard reorder alerts:", alertsError);
      return NextResponse.json({ error: "Failed to fetch reorder alerts" }, { status: 500 });
    }

    const reorderAlerts = ((alerts as ReorderAlertRpcRow[] | null) || []).map((alert) => ({
      id: alert.item_id,
      code: alert.item_code || "",
      name: alert.item_name || "",
      currentStock: Number(alert.total_available_stock) || 0,
      reorderPoint: Number(alert.reorder_point) || 0,
      warehouseId: null,
    }));

    return NextResponse.json(reorderAlerts);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "dashboard",
  route: "/api/analytics/dashboard/reorder-alerts",
});
