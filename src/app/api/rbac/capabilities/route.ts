import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextResponse } from "next/server";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { getUserCapabilities } from "@/services/permissions/permissionResolver";
import { PHASE_1_GRANULAR_CAPABILITY_KEYS } from "@/constants/granular-permissions";

async function GETHandler() {
  try {
    const context = await requireRequestContext();
    if ("status" in context) return context;

    const { userId, currentBusinessUnitId } = context;
    const capabilities = await getUserCapabilities(userId, currentBusinessUnitId);
    const responseCapabilities = Object.fromEntries(
      PHASE_1_GRANULAR_CAPABILITY_KEYS.flatMap((key) => {
        const permission = capabilities[key];
        return permission ? [[key, permission]] : [];
      })
    );

    const response = NextResponse.json({
      data: {
        businessUnitId: currentBusinessUnitId,
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
