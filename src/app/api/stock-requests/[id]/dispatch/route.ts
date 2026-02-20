import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const buildDeprecatedResponse = async (context: RouteContext) => {
  const { id } = await context.params;
  return NextResponse.json(
    {
      error: "Stock request dispatch is deprecated.",
      next: `Use Delivery Notes for dispatch lifecycle: POST /api/delivery-notes/:id/dispatch and GET /api/stock-requests/${id}/status for derived status.`,
    },
    { status: 410 }
  );
};

const dispatchStockRequest = async (_request: NextRequest, context: RouteContext) => {
  const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
  if (unauthorized) return unauthorized;
  return buildDeprecatedResponse(context);
};

// POST /api/stock-requests/[id]/dispatch
export async function POST(request: NextRequest, context: RouteContext) {
  return dispatchStockRequest(request, context);
}
