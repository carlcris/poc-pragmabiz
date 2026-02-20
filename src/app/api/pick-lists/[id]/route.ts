import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { fetchPickList, getPickListAuthContext } from "../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/pick-lists/[id]
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "view");
    if (unauthorized) return unauthorized;

    const auth = await getPickListAuthContext();
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const pickList = await fetchPickList(auth.supabase, auth.companyId, id);

    if (!pickList) {
      return NextResponse.json({ error: "Pick list not found" }, { status: 404 });
    }

    return NextResponse.json(pickList);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
