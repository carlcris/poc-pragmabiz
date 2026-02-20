import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

// POST /api/delivery-notes/[id]/start-picking
export async function POST() {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
    if (unauthorized) return unauthorized;
    return NextResponse.json(
      {
        error: "Picking lifecycle is now managed by pick list statuses",
        next: "PATCH /api/pick-lists/:id/status with status='in_progress'",
      },
      { status: 409 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
