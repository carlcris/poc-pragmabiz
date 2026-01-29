import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

export async function POST(request: NextRequest) {
  try {
    const { supabase } = createRouteHandlerClient(request);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    const result = {
      hasSession: !!session,
      sessionError: sessionError?.message || null,
      hasRefreshToken: !!session?.refresh_token,
      refreshError: null as string | null,
    };

    if (session?.refresh_token) {
      const { error: refreshError } = await supabase.auth.refreshSession({
        refresh_token: session.refresh_token,
      });
      result.refreshError = refreshError?.message || null;
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
