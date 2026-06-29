import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import { reorderSeasonSchema } from "@/lib/validations/reorder";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

type DbReorderSeason = {
  id: string;
  code: string;
  name: string;
  effective_from: string;
  effective_to: string;
  priority: number;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
};

const parsePositiveInt = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toSeasonResponse = (row: DbReorderSeason) => ({
  id: row.id,
  code: row.code,
  name: row.name,
  effectiveFrom: row.effective_from,
  effectiveTo: row.effective_to,
  priority: row.priority,
  isActive: row.is_active ?? true,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

async function GETHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.REORDER_MANAGEMENT, "view");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId } = context;

    const searchParams = request.nextUrl.searchParams;
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = Math.min(parsePositiveInt(searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);
    const search = searchParams.get("search")?.trim();
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("reorder_seasons")
      .select(
        "id, code, name, effective_from, effective_to, priority, is_active, created_at, updated_at",
        {
          count: "exact",
        }
      )
      .eq("company_id", companyId)
      .is("deleted_at", null);

    if (search) {
      query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .order("effective_from", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("Error fetching reorder seasons:", error);
      return NextResponse.json({ error: "Failed to fetch reorder seasons" }, { status: 500 });
    }

    return NextResponse.json({
      data: ((data || []) as DbReorderSeason[]).map(toSeasonResponse),
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: count ? Math.ceil(count / limit) : 0,
      },
    });
  } catch (error) {
    console.error("Unexpected error fetching reorder seasons:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POSTHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.REORDER_MANAGEMENT, "create");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, userId } = context;

    const parsed = reorderSeasonSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid season" },
        { status: 400 }
      );
    }

    const { data: season, error } = await supabase
      .from("reorder_seasons")
      .insert({
        company_id: companyId,
        code: parsed.data.code.trim().toUpperCase(),
        name: parsed.data.name.trim(),
        effective_from: parsed.data.effectiveFrom,
        effective_to: parsed.data.effectiveTo,
        priority: parsed.data.priority,
        is_active: parsed.data.isActive,
        created_by: userId,
        updated_by: userId,
      })
      .select(
        "id, code, name, effective_from, effective_to, priority, is_active, created_at, updated_at"
      )
      .single();

    if (error) {
      console.error("Error creating reorder season:", error);
      const message =
        error.code === "23505"
          ? "A reorder season with this code already exists"
          : error.code === "23514"
            ? "An active reorder season with the same priority overlaps this date range"
            : "Failed to create reorder season";
      return NextResponse.json({ error: message }, { status: error.code === "23505" ? 409 : 400 });
    }

    return NextResponse.json(
      { data: toSeasonResponse(season as DbReorderSeason) },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error creating reorder season:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "reorder",
  route: "/api/reorder/seasons",
});
export const POST = withActivityLogging(POSTHandler, {
  action: "create",
  resourceType: "reorder",
  route: "/api/reorder/seasons",
});
