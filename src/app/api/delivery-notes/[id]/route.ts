import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { fetchDeliveryNote, getAuthContext } from "../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/delivery-notes/[id]
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "view");
    if (unauthorized) return unauthorized;

    const auth = await getAuthContext();
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const dn = await fetchDeliveryNote(auth.supabase, auth.companyId, id);

    if (!dn) {
      return NextResponse.json({ error: "Delivery note not found" }, { status: 404 });
    }

    return NextResponse.json(dn);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
