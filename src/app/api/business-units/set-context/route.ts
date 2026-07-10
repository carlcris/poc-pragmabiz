import {
  setActivityContext,
  withActivityLogging,
} from "@/lib/activity-logging/route-activity-logger";
/**
 * Set Business Unit Context API Route
 *
 * POST /api/business-units/set-context
 *
 * NEW JWT-BASED APPROACH:
 * - Calls update_current_business_unit() database function to validate access
 * - Function returns success flag and business unit details
 * - Route refreshes the Supabase session immediately after the RPC
 * - Returned session tokens contain current_business_unit_id in claims
 * - RLS policies read from JWT via get_current_business_unit_id()
 *
 * This solves the connection pooling issue where session-level config
 * doesn't persist across different connections from the pool.
 */

import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";
import { RESOURCES, type Resource } from "@/constants/resources";
import type { UserPermissions } from "@/types/rbac";
import type { RawPermissionRow, UserCapabilityMap } from "@/services/permissions/types";

type SetContextRequest = {
  business_unit_id: string;
};

type ResponseCookieReader = {
  getAll: () => Array<{ name: string; value: string }>;
};

const isMobileContextRequest = (request: NextRequest) =>
  request.headers.get("x-client-source")?.toLowerCase() === "mobile";

const toCookieHeader = (cookies: ResponseCookieReader) =>
  cookies
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

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

function aggregateCapabilities(rows: RawPermissionRow[]): UserCapabilityMap {
  const capabilities: UserCapabilityMap = {};

  rows.forEach((row) => {
    capabilities[row.resource] = {
      can_view: row.can_view,
      can_create: row.can_create,
      can_edit: row.can_edit,
      can_delete: row.can_delete,
    };
  });

  return capabilities;
}

async function resolveUserAccess(
  supabase: ReturnType<typeof createRouteHandlerClient>["supabase"],
  userId: string,
  businessUnitId: string | null
) {
  const { data, error } = await supabase.rpc("get_user_permissions", {
    p_user_id: userId,
    p_business_unit_id: businessUnitId,
  });

  if (error) {
    console.error("Failed to resolve switched business unit access", {
      userId,
      businessUnitId,
      error: error.message,
    });
    return {
      permissions: createEmptyPermissions(),
      capabilities: {},
    };
  }

  const rows = (data || []) as RawPermissionRow[];
  return {
    permissions: aggregatePermissions(rows),
    capabilities: aggregateCapabilities(rows),
  };
}

async function POSTHandler(request: NextRequest) {
  try {
    // Note: No permission check - all authenticated users can switch their BU context

    const { supabase, response } = createRouteHandlerClient(request);

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body: SetContextRequest = await request.json();

    if (!body.business_unit_id) {
      return NextResponse.json({ error: "business_unit_id is required" }, { status: 400 });
    }

    // Call the database function to validate access and prepare for BU switch
    // This function verifies the user has access to the requested BU
    const { data, error } = await supabase.rpc("update_current_business_unit", {
      p_business_unit_id: body.business_unit_id,
    });

    if (error) {
      // Handle specific errors
      if (error.message.includes("not authenticated")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      } else if (error.message.includes("does not have access")) {
        return NextResponse.json({ error: "Access denied to this business unit" }, { status: 403 });
      } else if (error.message.includes("not found")) {
        return NextResponse.json({ error: "Business unit not found" }, { status: 404 });
      }

      return NextResponse.json(
        { error: "Failed to update business unit context" },
        { status: 500 }
      );
    }

    // Refresh the server-side session immediately so the response sets cookies
    // with a JWT that contains the updated current_business_unit_id claim.
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();

    if (refreshError || !refreshed.session) {
      return NextResponse.json(
        { error: "Failed to refresh business unit context" },
        { status: 500 }
      );
    }

    const mobileAccess = isMobileContextRequest(request)
      ? await resolveUserAccess(supabase, user.id, data.business_unit.id)
      : null;

    const jsonResponse = NextResponse.json({
      success: data.success,
      message: data.message,
      business_unit_id: data.business_unit.id,
      business_unit: data.business_unit,
      requires_refresh: false,
      token: refreshed.session.access_token,
      refreshToken: refreshed.session.refresh_token,
      ...(mobileAccess
        ? {
            ...mobileAccess,
            cookieHeader: toCookieHeader(response.cookies),
          }
        : {}),
    });

    setActivityContext({ businessUnitId: data.business_unit.id });

    response.cookies.getAll().forEach((cookie) => {
      jsonResponse.cookies.set(cookie.name, cookie.value, cookie);
    });

    return jsonResponse;
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "switch_business_unit",
  resourceType: "business_units",
  route: "/api/business-units/set-context",
});
