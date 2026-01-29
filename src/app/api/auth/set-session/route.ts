import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

type SetSessionBody = {
  accessToken: string;
  refreshToken: string;
};

export async function POST(request: NextRequest) {
  try {
    const { supabase, response } = createRouteHandlerClient(request);
    const body = (await request.json()) as SetSessionBody;

    if (!body.accessToken || !body.refreshToken) {
      return NextResponse.json({ error: "Missing tokens" }, { status: 400 });
    }

    const { error } = await supabase.auth.setSession({
      access_token: body.accessToken,
      refresh_token: body.refreshToken,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
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
