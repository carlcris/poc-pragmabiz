import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/stock-requests/[id]/pick - deprecated in DN flow
export async function POST(_request: NextRequest, context: RouteContext) {
  const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  return NextResponse.json(
    {
      error: "Stock request pick updates are deprecated.",
      next: `Use Delivery Notes for picking lifecycle: POST /api/delivery-notes/:id/queue-picking, then warehouse flow starts via POST /api/delivery-notes/:id/start-picking and POST /api/delivery-notes/:id/dispatch-ready. Stock request ${id} status is now derived from DN aggregates.`,
    },
    { status: 410 }
  );
}
