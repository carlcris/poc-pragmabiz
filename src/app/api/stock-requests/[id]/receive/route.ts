import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/stock-requests/[id]/receive - deprecated in DN flow
export async function POST(_request: NextRequest, context: RouteContext) {
  const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  return NextResponse.json(
    {
      error: "Stock request receive is deprecated.",
      next: `Use Delivery Notes for receipt lifecycle: POST /api/delivery-notes/:id/receive and GET /api/stock-requests/${id}/status for derived status.`,
    },
    { status: 410 }
  );
}
