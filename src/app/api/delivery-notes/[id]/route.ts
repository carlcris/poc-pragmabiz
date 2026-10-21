import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { requireDeliveryNoteReceivingAccess } from "@/lib/delivery-notes/permissions";
import { fetchDeliveryNote, getAuthContext } from "../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/delivery-notes/[id]
async function GETHandler(request: NextRequest, context: RouteContext) {
  try {
    const receivingOnly = request.nextUrl.searchParams.get("receivingOnly") === "true";
    const unauthorized = receivingOnly
      ? await requireDeliveryNoteReceivingAccess("view")
      : await requirePermission(RESOURCES.DELIVERY_NOTES, "view");
    if (unauthorized) return unauthorized;

    const auth = await getAuthContext();
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json({ error: "Delivery note not found" }, { status: 404 });
    }
    const dn = await fetchDeliveryNote(
      auth.supabase,
      auth.companyId,
      id,
      auth.currentBusinessUnitId
    );

    if (!dn) {
      return NextResponse.json({ error: "Delivery note not found" }, { status: 404 });
    }

    return NextResponse.json(dn);
  } catch (error) {
    console.error("Unexpected error loading delivery note:", error);
    return NextResponse.json({ error: "Failed to load delivery note" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "view",
  resourceType: "delivery_notes",
  route: "/api/delivery-notes/[id]",
});
