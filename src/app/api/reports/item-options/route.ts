import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkPermissionForUser } from "@/lib/auth/checkPermission";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import type { ReportItemOptionsResponse } from "@/types/report-item-options";

const schema = z
  .object({
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(6),
    search: z.string().trim().max(100).optional(),
  })
  .strict();

const quoteItemSearch = (search: string) => {
  // PostgREST LIKE treats "*" as a wildcard. Match an escaped literal instead
  // so punctuation in item codes and names is searchable as entered.
  const literal = search.replace(/[.*+?^$(){}|[\]\\]/g, "\\$&");
  return '"' + literal.replace(/["\\]/g, "\\$&") + '"';
};

async function GETHandler(request: NextRequest) {
  try {
    const context = await requireRequestContext();
    if ("status" in context) {
      return NextResponse.json(
        { error: "Unauthorized", details: "You must be logged in to access this resource" },
        { status: 401 }
      );
    }
    const { supabase, companyId, currentBusinessUnitId, userId } = context;
    const canViewReports = await checkPermissionForUser(
      { id: userId, companyId, businessUnitId: currentBusinessUnitId },
      RESOURCES.REPORTS,
      "view"
    );
    if (!canViewReports) {
      return NextResponse.json(
        {
          error: "Forbidden",
          details: "You do not have permission to view " + RESOURCES.REPORTS,
          resource: RESOURCES.REPORTS,
          action: "view",
        },
        { status: 403 }
      );
    }

    const parsed = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid report item search parameters" }, { status: 400 });
    }

    const { page, limit, search } = parsed.data;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("items")
      .select("id, item_code, item_name")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("item_name", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + limit);

    if (search) {
      const value = quoteItemSearch(search);
      query = query.or("item_code.imatch." + value + ",item_name.imatch." + value);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json<ReportItemOptionsResponse>({
      data: data.slice(0, limit).map((item) => ({
        id: item.id,
        code: item.item_code,
        name: item.item_name,
      })),
      hasMore: data.length > limit,
    });
  } catch (error) {
    console.error("Failed to fetch report item options:", error);
    return NextResponse.json({ error: "Failed to load report item options" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "reports",
  route: "/api/reports/item-options",
});
