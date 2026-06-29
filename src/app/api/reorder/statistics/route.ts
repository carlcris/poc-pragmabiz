import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";

type ReorderStatisticsRpcRow = {
  total_items_tracked: number | string | null;
  items_ok: number | string | null;
  items_low_stock: number | string | null;
  items_critical: number | string | null;
  items_out_of_stock: number | string | null;
  pending_suggestions: number | string | null;
  approved_suggestions: number | string | null;
  total_estimated_reorder_cost: number | string | null;
  active_alerts: number | string | null;
};

const toNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

async function GETHandler() {
  try {
    const unauthorized = await requirePermission(RESOURCES.REORDER_MANAGEMENT, "view");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId } = context;

    const { data, error } = await supabase.rpc("get_reorder_statistics", {
      p_company_id: companyId,
    });

    if (error) {
      console.error("Error fetching reorder statistics:", error);
      return NextResponse.json({ error: "Failed to fetch reorder statistics" }, { status: 500 });
    }

    const row = ((data || [])[0] || null) as ReorderStatisticsRpcRow | null;

    return NextResponse.json({
      totalItemsTracked: toNumber(row?.total_items_tracked),
      itemsOk: toNumber(row?.items_ok),
      itemsLowStock: toNumber(row?.items_low_stock),
      itemsCritical: toNumber(row?.items_critical),
      itemsOutOfStock: toNumber(row?.items_out_of_stock),
      pendingSuggestions: toNumber(row?.pending_suggestions),
      approvedSuggestions: toNumber(row?.approved_suggestions),
      totalEstimatedReorderCost: toNumber(row?.total_estimated_reorder_cost),
      activeAlerts: toNumber(row?.active_alerts),
    });
  } catch (error) {
    console.error("Unexpected error fetching reorder statistics:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "reorder",
  route: "/api/reorder/statistics",
});
