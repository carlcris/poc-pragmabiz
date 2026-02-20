import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

// POST /api/delivery-notes/[id]/dispatch-ready
export async function POST() {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
    if (unauthorized) return unauthorized;
    return NextResponse.json(
      {
        error: "Dispatch-ready is now derived from pick list completion",
        next: "PATCH /api/pick-lists/:id/status with status='done'",
      },
      { status: 409 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
