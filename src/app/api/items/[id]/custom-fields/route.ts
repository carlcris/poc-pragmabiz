import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value: string): boolean => UUID_REGEX.test(value);

const normalizeCustomFields = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const normalizeFieldKey = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeFieldValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value);
};

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.ITEMS, "edit");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
    }

    const body = (await request.json()) as {
      key?: unknown;
      value?: unknown;
      originalKey?: unknown;
    };
    const key = normalizeFieldKey(body.key);
    const originalKey = normalizeFieldKey(body.originalKey);

    if (!key) {
      return NextResponse.json({ error: "Custom field key is required" }, { status: 400 });
    }

    const { data: customFields, error: updateError } = await supabase.rpc(
      "upsert_item_custom_field",
      {
        p_item_id: id,
        p_key: key,
        p_value: normalizeFieldValue(body.value),
        p_original_key: originalKey,
        p_updated_by: user.id,
      }
    );

    if (updateError) {
      if (updateError.code === "P0002") {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }
      if (updateError.code === "23505") {
        return NextResponse.json({ error: "Custom field key already exists" }, { status: 409 });
      }
      if (updateError.code === "22023") {
        return NextResponse.json({ error: "Custom field key is required" }, { status: 400 });
      }
      console.error("Failed to update item custom fields:", updateError);
      return NextResponse.json({ error: "Failed to update custom fields" }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        customFields: normalizeCustomFields(customFields),
      },
    });
  } catch (error) {
    console.error("Unexpected item custom field update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.ITEMS, "edit");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
    }

    const key = request.nextUrl.searchParams.get("key")?.trim();
    if (!key) {
      return NextResponse.json({ error: "Custom field key is required" }, { status: 400 });
    }

    const { data: customFields, error: updateError } = await supabase.rpc(
      "delete_item_custom_field",
      {
        p_item_id: id,
        p_key: key,
        p_updated_by: user.id,
      }
    );

    if (updateError) {
      if (updateError.code === "P0002") {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }
      if (updateError.code === "22023") {
        return NextResponse.json({ error: "Custom field key is required" }, { status: 400 });
      }
      console.error("Failed to delete item custom field:", updateError);
      return NextResponse.json({ error: "Failed to delete custom field" }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        customFields: normalizeCustomFields(customFields),
      },
    });
  } catch (error) {
    console.error("Unexpected item custom field delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
