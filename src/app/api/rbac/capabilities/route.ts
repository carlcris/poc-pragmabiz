import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { getUserCapabilities, hasCapability } from "@/services/permissions/permissionResolver";
import type { PermissionAction } from "@/types/rbac";

const ACTIONS = ["view", "create", "edit", "delete"] as const;

const normalizeAction = (value: string | null): PermissionAction => {
  return ACTIONS.includes(value as PermissionAction) ? (value as PermissionAction) : "view";
};

async function GETHandler(request: NextRequest) {
  try {
    const context = await requireRequestContext();
    if ("status" in context) return context;

    const { userId, currentBusinessUnitId } = context;
    const searchParams = request.nextUrl.searchParams;
    const action = normalizeAction(searchParams.get("action"));
    const keys = (searchParams.get("keys") || "")
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean);

    const capabilities = await getUserCapabilities(userId, currentBusinessUnitId);
    const responseCapabilities =
      keys.length > 0
        ? Object.fromEntries(keys.map((key) => [key, hasCapability(capabilities, key, action)]))
        : Object.fromEntries(
            Object.keys(capabilities).map((key) => [key, hasCapability(capabilities, key, action)])
          );

    const response = NextResponse.json({
      data: {
        action,
        capabilities: responseCapabilities,
      },
    });

    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");

    return response;
  } catch (error) {
    console.error("Failed to load capabilities:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "capabilities",
  route: "/api/rbac/capabilities",
});
