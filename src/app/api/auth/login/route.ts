import { createRouteHandlerClient } from "@/lib/supabase/route-handler";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { supabase, response } = createRouteHandlerClient(request);
    const { email, password } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required" }, { status: 400 });
    }

    // Sign in with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json(
        { message: error.message || "Invalid credentials" },
        { status: 401 }
      );
    }

    if (!data.user || !data.session) {
      return NextResponse.json({ message: "Login failed" }, { status: 401 });
    }

    // Fetch user details from our users table
    const { data: userData } = await supabase
      .from("users")
      .select("id, username, email, first_name, last_name, company_id")
      .eq("id", data.user.id)
      .maybeSingle();

    // If user doesn't exist in users table, create it
    let userRecord = userData;
    if (!userData) {
      const firstName = data.user.user_metadata?.first_name || "";
      const lastName = data.user.user_metadata?.last_name || "";

      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert({
          id: data.user.id,
          company_id: "00000000-0000-0000-0000-000000000001", // Demo company
          username: email.split("@")[0],
          email: email,
          first_name: firstName,
          last_name: lastName,
          is_active: true,
        })
        .select("id, username, email, first_name, last_name, company_id")
        .single();

      if (!createError) {
        userRecord = newUser;
      } else {
      }
    }

    // Return user and session data
    const firstName = userRecord?.first_name || "";
    const lastName = userRecord?.last_name || "";
    const fullName = [firstName, lastName].filter(Boolean).join(" ");

    const jsonResponse = NextResponse.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        name: fullName || data.user.email || email,
        role: data.user.user_metadata?.role || "user",
        companyId: userRecord?.company_id || "00000000-0000-0000-0000-000000000001",
        username: userRecord?.username || email.split("@")[0],
        firstName,
        lastName,
      },
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
    });

    response.cookies.getAll().forEach((cookie) => {
      jsonResponse.cookies.set(cookie.name, cookie.value, cookie);
    });

    return jsonResponse;
  } catch {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
