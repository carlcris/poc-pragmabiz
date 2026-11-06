import {
  setActivityContext,
  withActivityLogging,
} from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { createUserProfileSchema } from "@/lib/validations/user-profile";
import type { UserProfile, UserProfileRole } from "@/types/user-profile";

const userProfileUpdateSchema = createUserProfileSchema({
  firstNameRequired: "FIRST_NAME_REQUIRED",
  firstNameTooLong: "FIRST_NAME_TOO_LONG",
  lastNameTooLong: "LAST_NAME_TOO_LONG",
  phoneTooLong: "PHONE_TOO_LONG",
}).strict();

const pickRelation = <T>(relation: T | T[] | null): T | null =>
  Array.isArray(relation) ? (relation[0] ?? null) : relation;

// GET /api/users/me - Get the signed-in user's profile
async function GETHandler() {
  try {
    const context = await requireRequestContext();
    if (context instanceof NextResponse) return context;

    const { supabase, userId, companyId } = context;

    const [userResult, rolesResult] = await Promise.all([
      supabase
        .from("users")
        .select(
          "id, username, email, first_name, last_name, phone, last_login_at, created_at, companies(name)"
        )
        .eq("id", userId)
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("user_roles")
        .select("id, roles(name), business_units(name)")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
    ]);

    if (userResult.error || rolesResult.error) {
      console.error("Failed to load user profile", {
        userError: userResult.error?.message,
        rolesError: rolesResult.error?.message,
      });
      return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
    }

    const userRow = userResult.data;
    if (!userRow) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const roles: UserProfileRole[] = (rolesResult.data ?? []).flatMap((assignment) => {
      const role = pickRelation(assignment.roles);
      if (!role) return [];
      return [
        {
          id: assignment.id,
          roleName: role.name,
          businessUnitName: pickRelation(assignment.business_units)?.name ?? null,
        },
      ];
    });

    const profile: UserProfile = {
      id: userRow.id,
      username: userRow.username,
      email: userRow.email,
      firstName: userRow.first_name ?? "",
      lastName: userRow.last_name ?? "",
      phone: userRow.phone ?? "",
      companyName: pickRelation(userRow.companies)?.name ?? "",
      lastLoginAt: userRow.last_login_at,
      createdAt: userRow.created_at,
      roles,
    };

    return NextResponse.json({ data: profile });
  } catch (error) {
    console.error("Unexpected error loading user profile", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/users/me - Update the signed-in user's editable profile fields
async function PATCHHandler(request: NextRequest) {
  try {
    const context = await requireRequestContext();
    if (context instanceof NextResponse) return context;

    const { supabase, userId, companyId } = context;

    const body: unknown = await request.json().catch(() => null);
    const parsed = userProfileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid profile details" }, { status: 400 });
    }

    const { firstName, lastName, phone } = parsed.data;

    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update({
        first_name: firstName,
        last_name: lastName || null,
        phone: phone || null,
      })
      .eq("id", userId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .select("id, username, first_name, last_name, phone")
      .maybeSingle();

    if (updateError) {
      console.error("Failed to update user profile", { error: updateError.message });
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    if (!updatedUser) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    setActivityContext({
      entityId: updatedUser.id,
      entityCode: updatedUser.username,
      resourceType: "users",
    });

    return NextResponse.json({
      data: {
        firstName: updatedUser.first_name ?? "",
        lastName: updatedUser.last_name ?? "",
        phone: updatedUser.phone ?? "",
      },
    });
  } catch (error) {
    console.error("Unexpected error updating user profile", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "view",
  resourceType: "users",
  route: "/api/users/me",
});
export const PATCH = withActivityLogging(PATCHHandler, {
  action: "update",
  resourceType: "users",
  route: "/api/users/me",
});
