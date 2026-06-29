import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextResponse } from "next/server";

async function POSTHandler() {
  return NextResponse.json(
    {
      message: "Self-registration is disabled. Contact your administrator to create an account.",
    },
    { status: 403 }
  );
}

export const POST = withActivityLogging(POSTHandler, {
  action: "register",
  resourceType: "auth",
  route: "/api/auth/register",
});
