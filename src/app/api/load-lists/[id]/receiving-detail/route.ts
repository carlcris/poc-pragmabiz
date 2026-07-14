import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { fetchMobileLoadListReceivingDetail } from "@/lib/grns/mobile-receiving-detail";
import { requireLoadListReceivingDetailAccess } from "@/lib/receiving/permissions";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function GETHandler(request: NextRequest, context: RouteContext) {
  try {
    const includeGrn = request.nextUrl.searchParams.get("includeGrn") === "true";
    const access = await requireLoadListReceivingDetailAccess(includeGrn);
    if (access instanceof NextResponse) return access;

    const { id } = await context.params;
    const { supabase, companyId, currentBusinessUnitId } = access.context;
    const detail = await fetchMobileLoadListReceivingDetail({
      supabase,
      companyId,
      currentBusinessUnitId,
      loadListId: id,
      includeGrn,
    });

    if (!detail) {
      return NextResponse.json({ error: "Load list not found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error("Failed to load mobile load list receiving detail", error);
    return NextResponse.json({ error: "Failed to load receiving detail" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "view",
  resourceType: "load_lists",
  route: "/api/load-lists/[id]/receiving-detail",
});
