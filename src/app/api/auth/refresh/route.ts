import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

async function POSTHandler(request: NextRequest) {
  try {
    const { supabase, response } = createRouteHandlerClient(request);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.refresh_token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: session.refresh_token,
    });

    if (error || !data.session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const jsonResponse = NextResponse.json({
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
    });

    response.cookies.getAll().forEach((cookie) => {
      jsonResponse.cookies.set(cookie.name, cookie.value, cookie);
    });

    return jsonResponse;
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "refresh_session",
  resourceType: "auth",
  route: "/api/auth/refresh",
});
