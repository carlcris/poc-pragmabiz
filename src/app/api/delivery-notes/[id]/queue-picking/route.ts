import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

// POST /api/delivery-notes/[id]/queue-picking
export async function POST() {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
    if (unauthorized) return unauthorized;
    return NextResponse.json(
      {
        error: "Queue picking is now handled by creating a pick list",
        next: "POST /api/pick-lists with dnId and pickerUserIds",
      },
      { status: 409 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
