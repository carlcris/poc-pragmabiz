import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

async function GETHandler(request: NextRequest) {
  try {
    const { supabase } = createRouteHandlerClient(request);

    const { data, error } = await supabase.auth.getUser();

    return NextResponse.json({
      hasUser: !!data.user,
      error: error?.message || null,
      cookieNames: request.cookies.getAll().map((c) => c.name),
    });
  } catch {
    return NextResponse.json({ hasUser: false, error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "auth",
  route: "/api/auth/debug",
});
