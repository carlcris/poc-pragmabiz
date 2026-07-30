import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requireLookupDataAccess } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 5;

type WarehouseLookupScope = "current_business_unit" | "accessible_business_units";

const parseLimit = (raw: string | null) => {
  const parsed = Number.parseInt(raw || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
};

const parsePage = (raw: string | null) => {
  const parsed = Number.parseInt(raw || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const normalizeSearch = (raw: string | null) => {
  const value = raw?.trim().replace(/[,%]/g, " ");
  return value ? value : null;
};

const parseScope = (raw: string | null): WarehouseLookupScope | null => {
  if (raw === "current_business_unit" || raw === "accessible_business_units") {
    return raw;
  }
  return null;
};

async function GETHandler(request: NextRequest) {
  try {
    const unauthorized = await requireLookupDataAccess(RESOURCES.WAREHOUSES);
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { companyId, currentBusinessUnitId, accessibleBusinessUnitIds } = context;
    const adminSupabase = createAdminClient();

    const searchParams = request.nextUrl.searchParams;
    const scope = parseScope(searchParams.get("scope"));
    const search = normalizeSearch(searchParams.get("search"));
    const page = parsePage(searchParams.get("page"));
    const limit = parseLimit(searchParams.get("limit"));
    const includeInactive = searchParams.get("includeInactive") === "true";
    const offset = (page - 1) * limit;

    if (!scope) {
      return NextResponse.json(
        { error: "A valid warehouse lookup scope is required" },
        { status: 400 }
      );
    }

    if (scope === "current_business_unit" && !currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    const scopedBusinessUnitIds =
      scope === "current_business_unit"
        ? [currentBusinessUnitId as string]
        : accessibleBusinessUnitIds;

    if (scopedBusinessUnitIds.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }

    let query = adminSupabase
      .from("warehouses")
      .select("id, business_unit_id, warehouse_code, warehouse_name, is_active", {
        count: "exact",
      })
      .eq("company_id", companyId)
      .in("business_unit_id", scopedBusinessUnitIds)
      .is("deleted_at", null)
      .order("warehouse_name", { ascending: true })
      .order("warehouse_code", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);

    if (!includeInactive) query = query.eq("is_active", true);
    if (search)
      query = query.or(`warehouse_code.ilike.%${search}%,warehouse_name.ilike.%${search}%`);

    const { data, error, count } = await query;
    if (error) {
      console.error("Failed to fetch warehouse lookup options:", error);
      return NextResponse.json({ error: "Failed to fetch warehouses" }, { status: 500 });
    }

    const total = count ?? 0;

    return NextResponse.json({
      data: (data || []).map((row) => ({
        id: row.id,
        code: row.warehouse_code,
        name: row.warehouse_name,
        businessUnitId: row.business_unit_id,
        isActive: row.is_active ?? true,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "lookups",
  route: "/api/lookups/warehouses",
});
