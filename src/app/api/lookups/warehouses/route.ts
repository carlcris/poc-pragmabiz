import { NextRequest, NextResponse } from "next/server";
import { requireLookupDataAccess } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

const parseLimit = (raw: string | null) => {
  const parsed = Number.parseInt(raw || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
};

const normalizeSearch = (raw: string | null) => {
  const value = raw?.trim();
  return value ? value : null;
};

export async function GET(request: NextRequest) {
  try {
    const unauthorized = await requireLookupDataAccess(RESOURCES.WAREHOUSES);
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { companyId } = context;
    const adminSupabase = createAdminClient();

    const searchParams = request.nextUrl.searchParams;
    const search = normalizeSearch(searchParams.get("search"));
    const limit = parseLimit(searchParams.get("limit"));
    const includeInactive = searchParams.get("includeInactive") === "true";

    let query = adminSupabase
      .from("warehouses")
      .select("id, business_unit_id, warehouse_code, warehouse_name, is_active")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("warehouse_name", { ascending: true })
      .limit(limit);

    if (!includeInactive) query = query.eq("is_active", true);
    if (search) query = query.or(`warehouse_code.ilike.%${search}%,warehouse_name.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch warehouses", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: (data || []).map((row) => ({
        id: row.id,
        code: row.warehouse_code,
        name: row.warehouse_name,
        businessUnitId: row.business_unit_id,
        isActive: row.is_active ?? true,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
