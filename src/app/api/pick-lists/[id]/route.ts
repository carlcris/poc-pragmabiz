import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import {
  fetchPickList,
  getPickListAuthContext,
  isAssignedPickListScopeEnabled,
  isPickListAssignee,
} from "../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/pick-lists/[id]
async function GETHandler(_request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "view");
    if (unauthorized) return unauthorized;

    const auth = await getPickListAuthContext();
    if (auth instanceof NextResponse) return auth;
    if (!auth.currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context is required" }, { status: 400 });
    }

    const { id } = await context.params;
    const assignedOnly = await isAssignedPickListScopeEnabled(
      auth.userId,
      auth.currentBusinessUnitId
    );
    if (
      assignedOnly &&
      !(await isPickListAssignee(auth.supabase, auth.companyId, id, auth.userId))
    ) {
      return NextResponse.json({ error: "Pick list not found" }, { status: 404 });
    }

    const pickList = await fetchPickList(auth.supabase, auth.companyId, id);

    if (!pickList || pickList.business_unit_id !== auth.currentBusinessUnitId) {
      return NextResponse.json({ error: "Pick list not found" }, { status: 404 });
    }

    return NextResponse.json(pickList);
  } catch (error) {
    console.error("Unexpected pick list detail fetch error", error);
    return NextResponse.json({ error: "Failed to fetch pick list" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "view",
  resourceType: "pick_lists",
  route: "/api/pick-lists/[id]",
});
