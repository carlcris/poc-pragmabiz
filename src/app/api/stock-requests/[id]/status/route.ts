import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { computeStockRequestDerivedStatus, getAuthContext } from "@/app/api/delivery-notes/_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/stock-requests/[id]/status - SRS-derived status projection
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "view");
    if (unauthorized) return unauthorized;

    const auth = await getAuthContext();
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const result = await computeStockRequestDerivedStatus(auth.supabase, auth.companyId, id);

    if (!result) {
      return NextResponse.json({ error: "Stock request not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
