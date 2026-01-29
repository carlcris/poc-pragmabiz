import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import type { UserPreferences, UpdateUserPreferencesRequest } from "@/types/user-preferences";
import type { Database } from "@/types/database.types";

type DbUserPreferences = Database["public"]["Tables"]["user_preferences"]["Row"];
type UserPreferencesUpdate = Partial<DbUserPreferences>;

// Transform database preferences to frontend type
function transformDbPreferences(dbPrefs: DbUserPreferences): UserPreferences {
  return {
    id: dbPrefs.id,
    userId: dbPrefs.user_id,
    fontSize: dbPrefs.font_size as UserPreferences["fontSize"],
    theme: dbPrefs.theme as UserPreferences["theme"],
    createdAt: dbPrefs.created_at,
    updatedAt: dbPrefs.updated_at,
  };
}

// GET /api/user-preferences - Get current user's preferences
export async function GET() {
  try {
    const { supabase } = await createServerClientWithBU();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user preferences
    const { data, error } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch preferences", details: error.message },
        { status: 500 }
      );
    }

    // If no preferences exist, return defaults
    if (!data) {
      return NextResponse.json({
        data: {
          id: "",
          userId: user.id,
          fontSize: "medium",
          theme: "light",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as UserPreferences,
      });
    }

    return NextResponse.json({ data: transformDbPreferences(data) });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/user-preferences - Update or create user preferences
export async function PUT(request: NextRequest) {
  try {
    const { supabase } = await createServerClientWithBU();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body: UpdateUserPreferencesRequest = await request.json();

    // Check if preferences exist
    const { data: existing } = await supabase
      .from("user_preferences")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    let result;

    if (existing) {
      // Update existing preferences
      const updateData: UserPreferencesUpdate = {};
      if (body.fontSize !== undefined) updateData.font_size = body.fontSize;
      if (body.theme !== undefined) updateData.theme = body.theme;

      const { data, error } = await supabase
        .from("user_preferences")
        .update(updateData)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: "Failed to update preferences", details: error.message },
          { status: 500 }
        );
      }

      result = data;
    } else {
      // Create new preferences
      const { data, error } = await supabase
        .from("user_preferences")
        .insert({
          user_id: user.id,
          font_size: body.fontSize || "medium",
          theme: body.theme || "light",
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: "Failed to create preferences", details: error.message },
          { status: 500 }
        );
      }

      result = data;
    }

    return NextResponse.json({ data: transformDbPreferences(result) });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
