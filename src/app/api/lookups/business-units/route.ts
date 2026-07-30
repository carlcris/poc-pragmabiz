import { NextRequest, NextResponse } from "next/server";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const parsePositiveInteger = (raw: string | null, fallback: number) => {
  const parsed = Number.parseInt(raw || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeSearch = (raw: string | null) => {
  const value = raw?.trim().slice(0, 100).replace(/[,%]/g, " ");
  return value || null;
};

async function GETHandler(request: NextRequest) {
  try {
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { companyId } = context;
    const searchParams = request.nextUrl.searchParams;
    const page = parsePositiveInteger(searchParams.get("page"), 1);
    const limit = Math.min(
      parsePositiveInteger(searchParams.get("limit"), DEFAULT_LIMIT),
      MAX_LIMIT
    );
    const search = normalizeSearch(searchParams.get("search"));
    const excludeId = searchParams.get("excludeId");
    const offset = (page - 1) * limit;

    if (excludeId && !UUID_PATTERN.test(excludeId)) {
      return NextResponse.json({ error: "Invalid excluded business unit" }, { status: 400 });
    }

    let query = createAdminClient()
      .from("business_units")
      .select("id, code, name, type, is_active", { count: "exact" })
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("name", { ascending: true })
      .order("code", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);

    if (excludeId) query = query.neq("id", excludeId);
    if (search) query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%`);

    const { data, error, count } = await query;
    if (error) {
      console.error("Failed to fetch business unit lookup options:", error);
      return NextResponse.json({ error: "Failed to fetch business units" }, { status: 500 });
    }

    const total = count ?? 0;
    return NextResponse.json({
      data: data || [],
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
  route: "/api/lookups/business-units",
});
