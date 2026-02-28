import { NextRequest, NextResponse } from "next/server";
import { requireLookupDataAccess } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

const parseLimit = (raw: string | null) => {
  const parsed = Number.parseInt(raw || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
};

const normalizeSearch = (raw: string | null) => {
  const value = raw?.trim();
  return value ? value : null;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = await requireLookupDataAccess(RESOURCES.WAREHOUSES);
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { companyId } = context;
    const adminSupabase = createAdminClient();

    const { id: warehouseId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const search = normalizeSearch(searchParams.get("search"));
    const limit = parseLimit(searchParams.get("limit"));
    const includeInactive = searchParams.get("includeInactive") === "true";

    const { data: warehouse, error: warehouseError } = await adminSupabase
      .from("warehouses")
      .select("id, business_unit_id")
      .eq("id", warehouseId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .maybeSingle();

    if (warehouseError) {
      return NextResponse.json(
        { error: "Failed to validate warehouse", details: warehouseError.message },
        { status: 500 }
      );
    }

    if (!warehouse) {
      return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
    }

    let query = adminSupabase
      .from("warehouse_locations")
      .select(
        "id, company_id, warehouse_id, code, name, parent_id, location_type, is_pickable, is_storable, is_active, created_at, updated_at"
      )
      .eq("company_id", companyId)
      .eq("warehouse_id", warehouseId)
      .is("deleted_at", null)
      .order("code", { ascending: true })
      .limit(limit);

    if (!includeInactive) query = query.eq("is_active", true);
    if (search) query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch warehouse locations", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: (data || []).map((location) => ({
        id: location.id,
        companyId: location.company_id,
        warehouseId: location.warehouse_id,
        code: location.code,
        name: location.name,
        parentId: location.parent_id,
        locationType: location.location_type,
        isPickable: location.is_pickable,
        isStorable: location.is_storable,
        isActive: location.is_active,
        createdAt: location.created_at,
        updatedAt: location.updated_at,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
