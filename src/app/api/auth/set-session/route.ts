import {
  setActivityContext,
  withActivityLogging,
} from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

type SetSessionBody = {
  accessToken: string;
  refreshToken: string;
};

async function POSTHandler(request: NextRequest) {
  try {
    const { supabase, response } = createRouteHandlerClient(request);
    const body = (await request.json()) as SetSessionBody;

    if (!body.accessToken || !body.refreshToken) {
      return NextResponse.json({ error: "Missing tokens" }, { status: 400 });
    }

    const { data, error } = await supabase.auth.setSession({
      access_token: body.accessToken,
      refresh_token: body.refreshToken,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from("users")
        .select("company_id")
        .eq("id", data.user.id)
        .maybeSingle();
      const { data: claimData } = await supabase.auth.getClaims(body.accessToken);
      const businessUnitId = claimData?.claims.current_business_unit_id;
      const actorLabel = claimData?.claims.actor_label;

      setActivityContext({
        userId: data.user.id,
        actorLabel: typeof actorLabel === "string" ? actorLabel : (data.user.email ?? null),
        companyId: profile?.company_id ?? null,
        businessUnitId: typeof businessUnitId === "string" ? businessUnitId : null,
      });
    }

    const jsonResponse = NextResponse.json({ success: true });
    response.cookies.getAll().forEach((cookie) => {
      jsonResponse.cookies.set(cookie.name, cookie.value, cookie);
    });

    return jsonResponse;
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "set_session",
  resourceType: "auth",
  route: "/api/auth/set-session",
});
