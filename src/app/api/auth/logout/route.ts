import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

export async function POST(request: NextRequest) {
  try {
    const { supabase, response } = createRouteHandlerClient(request);

    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();

    if (error) {
      return NextResponse.json({ message: error.message || "Logout failed" }, { status: 500 });
    }

    const jsonResponse = NextResponse.json({ message: "Logged out successfully" });

    response.cookies.getAll().forEach((cookie) => {
      jsonResponse.cookies.set(cookie.name, cookie.value, cookie);
    });

    return jsonResponse;
  } catch {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
