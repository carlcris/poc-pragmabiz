import {
  setActivityContext,
  withActivityLogging,
} from "@/lib/activity-logging/route-activity-logger";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";
import { NextRequest, NextResponse } from "next/server";
import { getFirstAccessiblePage } from "@/config/roleDefaultPages";
import { RESOURCES, type Resource } from "@/constants/resources";
import type { UserPermissions } from "@/types/rbac";
import type { RawPermissionRow } from "@/services/permissions/types";

type JwtPayload = {
  current_business_unit_id?: string;
  default_business_unit_id?: string;
};

type UserRoleWithRole = {
  roles?: { name?: string | null } | { name?: string | null }[] | null;
};

function decodeBusinessUnitIdFromToken(token: string): string | null {
  try {
    const [, payloadPart] = token.split(".");
    if (!payloadPart) return null;
    const payload = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf-8")
    ) as JwtPayload;
    return payload.current_business_unit_id || payload.default_business_unit_id || null;
  } catch {
    return null;
  }
}

function createEmptyPermissions(): UserPermissions {
  const permissions: Partial<UserPermissions> = {};

  Object.values(RESOURCES).forEach((resource) => {
    permissions[resource as Resource] = {
      can_view: false,
      can_create: false,
      can_edit: false,
      can_delete: false,
    };
  });

  return permissions as UserPermissions;
}

function aggregatePermissions(rows: RawPermissionRow[]): UserPermissions {
  const permissions = createEmptyPermissions();

  rows.forEach((row) => {
    const resource = row.resource as Resource;
    if (!permissions[resource]) return;

    permissions[resource].can_view = permissions[resource].can_view || row.can_view;
    permissions[resource].can_create = permissions[resource].can_create || row.can_create;
    permissions[resource].can_edit = permissions[resource].can_edit || row.can_edit;
    permissions[resource].can_delete = permissions[resource].can_delete || row.can_delete;
  });

  return permissions;
}

async function resolveBusinessUnitId(
  supabase: ReturnType<typeof createRouteHandlerClient>["supabase"],
  userId: string,
  accessToken: string
): Promise<string | null> {
  const tokenBusinessUnitId = decodeBusinessUnitIdFromToken(accessToken);
  if (tokenBusinessUnitId) return tokenBusinessUnitId;

  const { data } = await supabase
    .from("user_business_unit_access")
    .select("business_unit_id, is_current, is_default")
    .eq("user_id", userId);

  const rows = data || [];
  return (
    rows.find((row) => row.is_current)?.business_unit_id ||
    rows.find((row) => row.is_default)?.business_unit_id ||
    rows[0]?.business_unit_id ||
    null
  );
}

async function resolveLandingPage(
  supabase: ReturnType<typeof createRouteHandlerClient>["supabase"],
  userId: string,
  accessToken: string
): Promise<string> {
  const businessUnitId = await resolveBusinessUnitId(supabase, userId, accessToken);

  const [{ data: permissionRows, error: permissionError }, { data: roleRows, error: roleError }] =
    await Promise.all([
      supabase.rpc("get_user_permissions", {
        p_user_id: userId,
        p_business_unit_id: businessUnitId,
      }),
      supabase
        .from("user_roles")
        .select(
          `
          roles (
            name
          )
        `
        )
        .eq("user_id", userId)
        .is("deleted_at", null),
    ]);

  if (permissionError) {
    console.error("Failed to resolve login permissions", {
      userId,
      businessUnitId,
      error: permissionError.message,
    });
    return "/403";
  }

  if (roleError) {
    console.error("Failed to resolve login roles", {
      userId,
      businessUnitId,
      error: roleError.message,
    });
  }

  const permissions = aggregatePermissions((permissionRows || []) as RawPermissionRow[]);
  const roleNames = ((roleRows as UserRoleWithRole[] | null) || [])
    .map((row) => (Array.isArray(row.roles) ? row.roles[0] : row.roles)?.name)
    .filter((name): name is string => typeof name === "string" && name.length > 0);

  return getFirstAccessiblePage(permissions, roleNames);
}

async function POSTHandler(request: NextRequest) {
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
    const actorLabel = fullName || userData.username || data.user.email || email;

    const jsonResponse = NextResponse.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        name: actorLabel,
        role: data.user.user_metadata?.role || "user",
        companyId: userData.company_id,
        username: userData.username || email.split("@")[0],
        firstName,
        lastName,
      },
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      landingPage: await resolveLandingPage(supabase, data.user.id, data.session.access_token),
    });

    setActivityContext({
      userId: data.user.id,
      actorLabel,
      companyId: userData.company_id,
      businessUnitId: decodeBusinessUnitIdFromToken(data.session.access_token),
    });

    response.cookies.getAll().forEach((cookie) => {
      jsonResponse.cookies.set(cookie.name, cookie.value, cookie);
    });

    return jsonResponse;
  } catch {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "login",
  resourceType: "auth",
  route: "/api/auth/login",
});
