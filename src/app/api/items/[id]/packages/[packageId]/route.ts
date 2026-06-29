import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET/PUT/DELETE /api/items/[id]/packages/[packageId]
 *
 * Deprecated: packaging has been removed.
 */
async function GETHandler(request: NextRequest) {
  void request;
  return NextResponse.json({ error: "Packaging has been removed." }, { status: 410 });
}

async function PUTHandler(request: NextRequest) {
  void request;
  return NextResponse.json({ error: "Packaging has been removed." }, { status: 410 });
}

async function DELETEHandler(request: NextRequest) {
  void request;
  return NextResponse.json({ error: "Packaging has been removed." }, { status: 410 });
}

export const GET = withActivityLogging(GETHandler, {
  action: "view",
  resourceType: "items",
  route: "/api/items/[id]/packages/[packageId]",
});
export const PUT = withActivityLogging(PUTHandler, {
  action: "update",
  resourceType: "items",
  route: "/api/items/[id]/packages/[packageId]",
});
export const DELETE = withActivityLogging(DELETEHandler, {
  action: "delete",
  resourceType: "items",
  route: "/api/items/[id]/packages/[packageId]",
});
