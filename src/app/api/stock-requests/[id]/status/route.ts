import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { getAuthContext } from "@/app/api/delivery-notes/_lib";
import { getStockRequestStatusProjection } from "@/app/api/stock-requests/stock-request-status-projection";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/stock-requests/[id]/status - SRS-derived status projection
async function GETHandler(_request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "view");
    if (unauthorized) return unauthorized;

    const auth = await getAuthContext();
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const result = await getStockRequestStatusProjection(auth.supabase, auth.companyId, id);

    if (!result) {
      return NextResponse.json({ error: "Stock request not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to load stock request status projection:", error);
    return NextResponse.json({ error: "Failed to load stock request status" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "change_status",
  resourceType: "stock_requests",
  route: "/api/stock-requests/[id]/status",
});
