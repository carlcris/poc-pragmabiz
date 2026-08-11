import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import type { Setting, SettingValue, SettingsGroupKey } from "@/types/settings";

const VALID_GROUPS: SettingsGroupKey[] = [
  "company",
  "financial",
  "inventory",
  "pos",
  "workflow",
  "integration",
  "business_unit",
  "security",
];

/**
 * GET /api/settings/[group]
 * Fetch all settings for a specific group
 */
async function GETHandler(request: NextRequest, context: { params: Promise<{ group: string }> }) {
  try {
    const { group } = await context.params;

    // Validate group parameter
    if (!VALID_GROUPS.includes(group as SettingsGroupKey)) {
      return NextResponse.json(
        { error: `Invalid group: ${group}. Must be one of: ${VALID_GROUPS.join(", ")}` },
        { status: 400 }
      );
    }

    const unauthorized = await requirePermission(RESOURCES.COMPANY_SETTINGS, "view");
    if (unauthorized) return unauthorized;

    const { supabase, userId } = await createServerClientWithBU();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's company
    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", userId)
      .single();

    if (userError || !userRow?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    if (group === "company") {
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select(
          "code, name, legal_name, tax_id, email, phone, address_line1, address_line2, city, state, postal_code, country, currency_code, is_active"
        )
        .eq("id", userRow.company_id)
        .is("deleted_at", null)
        .single();

      if (companyError) {
        console.error("Error fetching company settings:", companyError);
        return NextResponse.json({ error: "Failed to fetch company settings" }, { status: 500 });
      }

      return NextResponse.json({ data: company });
    }

    // Determine business_unit_id filter based on group
    const businessUnitId =
      group !== "company" ? (await supabase.rpc("get_current_business_unit_id")).data : null;

    if (group !== "company" && !businessUnitId) {
      return NextResponse.json({ error: "No business unit selected" }, { status: 400 });
    }

    // Fetch settings for this group
    let query = supabase
      .from("settings")
      .select(
        "id, company_id, business_unit_id, group_key, setting_key, value, created_at, updated_at, created_by, updated_by"
      )
      .eq("company_id", userRow.company_id)
      .eq("group_key", group)
      .order("setting_key");

    // All non-company settings are scoped to the active business unit.
    if (group !== "company") {
      query = query.eq("business_unit_id", businessUnitId);
    } else {
      query = query.is("business_unit_id", null);
    }

    const { data: settings, error } = await query;

    if (error) {
      console.error("Error fetching settings:", error);
      return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
    }

    // Transform to key-value object
    const settingsObject: Record<string, SettingValue> = {};
    (settings || []).forEach((setting: Setting) => {
      settingsObject[setting.setting_key] = setting.value;
    });

    if (group === "business_unit" && businessUnitId) {
      const { data: businessUnit, error: businessUnitError } = await supabase
        .from("business_units")
        .select("name, code")
        .eq("id", businessUnitId)
        .eq("company_id", userRow.company_id)
        .single();

      if (businessUnitError) {
        console.error("Error fetching business unit settings:", businessUnitError);
        return NextResponse.json(
          { error: "Failed to fetch business unit settings" },
          { status: 500 }
        );
      }

      settingsObject.display_name = businessUnit.name;
      settingsObject.short_code = businessUnit.code;
    }

    return NextResponse.json({ data: settingsObject });
  } catch (error) {
    console.error("Error in GET /api/settings/[group]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/settings/[group]
 * Update or create settings for a specific group
 */
async function PUTHandler(request: NextRequest, context: { params: Promise<{ group: string }> }) {
  try {
    const { group } = await context.params;

    // Validate group parameter
    if (!VALID_GROUPS.includes(group as SettingsGroupKey)) {
      return NextResponse.json(
        { error: `Invalid group: ${group}. Must be one of: ${VALID_GROUPS.join(", ")}` },
        { status: 400 }
      );
    }

    const unauthorized = await requirePermission(RESOURCES.COMPANY_SETTINGS, "edit");
    if (unauthorized) return unauthorized;

    const { supabase, userId } = await createServerClientWithBU();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's company
    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", userId)
      .single();

    if (userError || !userRow?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    // Parse request body
    const body = (await request.json()) as Record<string, SettingValue>;

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (group === "company") {
      const {
        code,
        name,
        legal_name,
        tax_id,
        email,
        phone,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        country,
        currency_code,
        is_active,
      } = body;

      const { data: company, error: companyError } = await supabase
        .from("companies")
        .update({
          code,
          name,
          legal_name,
          tax_id,
          email,
          phone,
          address_line1,
          address_line2,
          city,
          state,
          postal_code,
          country,
          currency_code,
          is_active,
        })
        .eq("id", userRow.company_id)
        .is("deleted_at", null)
        .select(
          "code, name, legal_name, tax_id, email, phone, address_line1, address_line2, city, state, postal_code, country, currency_code, is_active"
        )
        .single();

      if (companyError) {
        console.error("Error updating company settings:", companyError);
        return NextResponse.json({ error: "Failed to update company settings" }, { status: 500 });
      }

      return NextResponse.json({ data: company });
    }

    // Determine business_unit_id for the settings
    const businessUnitId =
      group !== "company" ? (await supabase.rpc("get_current_business_unit_id")).data : null;

    if (group !== "company" && !businessUnitId) {
      return NextResponse.json({ error: "No business unit selected" }, { status: 400 });
    }

    if (!businessUnitId || JSON.stringify(body).length > 32_768) {
      return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 });
    }

    const { data: updatedSettings, error: saveError } = await supabase.rpc(
      "save_settings_group_transactionally",
      {
        p_company_id: userRow.company_id,
        p_user_id: userId,
        p_business_unit_id: businessUnitId,
        p_group_key: group,
        p_settings: body,
      }
    );

    if (saveError) {
      console.error("Transactional settings save failed:", saveError);
      if (saveError.message.includes("SETTINGS_UNAUTHORIZED")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
      if (
        saveError.message.includes("SETTINGS_INVALID_INPUT") ||
        saveError.message.includes("SETTINGS_INVALID_PICKING_POLICY")
      ) {
        return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 });
      }
      if (saveError.message.includes("SETTINGS_BUSINESS_UNIT_NOT_FOUND")) {
        return NextResponse.json({ error: "Business unit not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
    }

    return NextResponse.json({ data: updatedSettings });
  } catch (error) {
    console.error("Error in PUT /api/settings/[group]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "view",
  resourceType: "settings",
  route: "/api/settings/[group]",
});
export const PUT = withActivityLogging(PUTHandler, {
  action: "update",
  resourceType: "settings",
  route: "/api/settings/[group]",
});
