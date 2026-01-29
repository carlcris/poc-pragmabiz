import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

export async function GET(request: NextRequest) {
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
