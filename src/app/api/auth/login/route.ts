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
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, username, email, first_name, last_name, company_id")
      .eq("id", data.user.id)
      .maybeSingle();

    if (userError) {
      return NextResponse.json({ message: "Failed to load user profile" }, { status: 500 });
    }

    if (!userData?.company_id) {
      await supabase.auth.signOut();
      return NextResponse.json(
        {
          message:
            "Your account is not provisioned in the application users table. Contact your administrator.",
        },
        { status: 403 }
      );
    }

    // Return user and session data
    const firstName = userData.first_name || "";
    const lastName = userData.last_name || "";
    const fullName = [firstName, lastName].filter(Boolean).join(" ");

    const jsonResponse = NextResponse.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        name: fullName || data.user.email || email,
        role: data.user.user_metadata?.role || "user",
        companyId: userData.company_id,
        username: userData.username || email.split("@")[0],
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
