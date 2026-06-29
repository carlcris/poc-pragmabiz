import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET/POST /api/items/[id]/packages
 *
 * Deprecated: packaging has been removed.
 */
async function GETHandler(request: NextRequest) {
  void request;
  return NextResponse.json({ error: "Packaging has been removed." }, { status: 410 });
}

async function POSTHandler(request: NextRequest) {
  void request;
  return NextResponse.json({ error: "Packaging has been removed." }, { status: 410 });
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "items",
  route: "/api/items/[id]/packages",
});
export const POST = withActivityLogging(POSTHandler, {
  action: "create",
  resourceType: "items",
  route: "/api/items/[id]/packages",
});
