import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import type { Setting, SettingValue, SettingsGroupKey } from "@/types/settings";

const BUSINESS_UNIT_TABLE_SETTING_KEYS = new Set(["display_name", "short_code"]);

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
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ group: string }> }
) {
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
    const businessUnitId = group !== "company"
      ? (await supabase.rpc("get_current_business_unit_id")).data
      : null;

    if (group !== "company" && !businessUnitId) {
      return NextResponse.json({ error: "No business unit selected" }, { status: 400 });
    }

    // Fetch settings for this group
    let query = supabase
      .from("settings")
      .select("*")
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
        return NextResponse.json({ error: "Failed to fetch business unit settings" }, { status: 500 });
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
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ group: string }> }
) {
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
    const businessUnitId = group !== "company"
      ? (await supabase.rpc("get_current_business_unit_id")).data
      : null;

    if (group !== "company" && !businessUnitId) {
      return NextResponse.json({ error: "No business unit selected" }, { status: 400 });
    }

    let businessUnitResponseData: Record<string, SettingValue> = {};

    if (group === "business_unit" && businessUnitId) {
      const { display_name, short_code, ...settingsBody } = body;

      if (display_name !== undefined || short_code !== undefined) {
        const updatePayload: {
          name?: string;
          code?: string;
          updated_by: string;
          updated_at: string;
        } = {
          updated_by: userId,
          updated_at: new Date().toISOString(),
        };

        if (display_name !== undefined) {
          updatePayload.name = String(display_name);
        }

        if (short_code !== undefined) {
          updatePayload.code = String(short_code);
        }

        const { error: businessUnitError } = await supabase
          .from("business_units")
          .update(updatePayload)
          .eq("id", businessUnitId)
          .eq("company_id", userRow.company_id);

        if (businessUnitError) {
          console.error("Error updating business unit information:", businessUnitError);
          return NextResponse.json(
            { error: "Failed to update business unit information" },
            { status: 500 }
          );
        }
      }

      businessUnitResponseData = {
        ...(display_name !== undefined ? { display_name } : {}),
        ...(short_code !== undefined ? { short_code } : {}),
      };

      if (Object.keys(settingsBody).length === 0) {
        return NextResponse.json({ data: businessUnitResponseData });
      }

      Object.keys(settingsBody).forEach((key) => {
        body[key] = settingsBody[key];
      });

      Object.keys(body).forEach((key) => {
        if (BUSINESS_UNIT_TABLE_SETTING_KEYS.has(key)) {
          delete body[key];
        }
      });
    }

    const settingKeys = Object.keys(body);

    if (settingKeys.length === 0) {
      return NextResponse.json({ data: businessUnitResponseData });
    }

    // Build query based on group type
    let existingQuery = supabase
      .from("settings")
      .select("id, setting_key")
      .eq("company_id", userRow.company_id)
      .eq("group_key", group)
      .in("setting_key", settingKeys);

    if (group !== "company") {
      existingQuery = existingQuery.eq("business_unit_id", businessUnitId);
    } else {
      existingQuery = existingQuery.is("business_unit_id", null);
    }

    const { data: existingSettings, error: existingSettingsError } = await existingQuery;

    if (existingSettingsError) {
      console.error("Error fetching existing settings:", existingSettingsError);
      return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
    }

    const existingByKey = new Map(
      (existingSettings || []).map((setting) => [setting.setting_key, setting.id])
    );

    const results = await Promise.all(
      Object.entries(body).map(([key, value]) => {
        const existingId = existingByKey.get(key);

        if (existingId) {
          return supabase
            .from("settings")
            .update({
              value,
              updated_by: userId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingId)
            .select()
            .single();
        }

        return supabase
          .from("settings")
          .insert({
            company_id: userRow.company_id,
            business_unit_id: businessUnitId,
            group_key: group,
            setting_key: key,
            value,
            created_by: userId,
            updated_by: userId,
          })
          .select()
          .single();
      })
    );

    // Check for errors
    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      console.error("Error upserting settings:", errors);
      return NextResponse.json({ error: "Failed to update some settings" }, { status: 500 });
    }

    // Return updated settings
    const updatedSettings: Record<string, SettingValue> = {};
    results.forEach((result) => {
      if (result.data) {
        updatedSettings[result.data.setting_key] = result.data.value;
      }
    });

    return NextResponse.json({
      data: {
        ...updatedSettings,
        ...businessUnitResponseData,
      },
    });
  } catch (error) {
    console.error("Error in PUT /api/settings/[group]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
