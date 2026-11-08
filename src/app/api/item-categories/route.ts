import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requireLookupDataAccess } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";

async function GETHandler(request: NextRequest) {
  try {
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, userId, companyId, currentBusinessUnitId } = context;
    const permissionCheck = await requireLookupDataAccess(RESOURCES.ITEM_CATEGORIES, {
      id: userId,
      companyId,
      businessUnitId: currentBusinessUnitId,
    });
    if (permissionCheck) return permissionCheck;

    const params = request.nextUrl.searchParams;
    const page = Number(params.get("page") ?? 1);
    const limit = Number(params.get("limit") ?? 5);
    const search = (params.get("search") ?? "").trim();
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 50 ||
      search.length > 100 ||
      !Number.isSafeInteger(page * limit)
    ) {
      return NextResponse.json({ error: "Invalid category search parameters" }, { status: 400 });
    }
    let query = supabase
      .from("item_categories")
      .select("id, name", { count: "exact" })
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .range((page - 1) * limit, page * limit - 1);
    if (search) query = query.ilike("name", `%${search.replace(/[\\%_]/g, "\\$&")}%`);
    const { data, error, count } = await query;
    if (error) {
      console.error("Failed to fetch item categories:", error);
      return NextResponse.json({ error: "Failed to fetch item categories" }, { status: 500 });
    }
    const total = count ?? 0;
    return NextResponse.json({
      data: data ?? [],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Failed to fetch item categories:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "item_categories",
  route: "/api/item-categories",
});
