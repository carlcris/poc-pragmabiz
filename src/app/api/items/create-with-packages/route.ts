import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/items/create-with-packages
 *
 * Deprecated: packaging has been removed. Use POST /api/items instead.
 */
async function POSTHandler(request: NextRequest) {
  void request;
  return NextResponse.json(
    { error: "Packaging has been removed. Use POST /api/items instead." },
    { status: 410 }
  );
}

export const POST = withActivityLogging(POSTHandler, {
  action: "create",
  resourceType: "items",
  route: "/api/items/create-with-packages",
});
