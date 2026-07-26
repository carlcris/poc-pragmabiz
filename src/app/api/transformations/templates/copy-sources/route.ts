import { NextRequest, NextResponse } from "next/server";
import { RESOURCES } from "@/constants/resources";
import { requirePermission } from "@/lib/auth";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { transformationTemplateCopySourceFiltersSchema } from "@/lib/validations/transformation-template";
import type { TransformationTemplateCopySourceSummary } from "@/types/transformation-template";

type CopySourceRow = TransformationTemplateCopySourceSummary & {
  total_count: number;
};

async function GETHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSFORMATIONS, "create");
    if (unauthorized) return unauthorized;

    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();
    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    const validationResult = transformationTemplateCopySourceFiltersSchema.safeParse({
      scope: request.nextUrl.searchParams.get("scope"),
      templateKind: request.nextUrl.searchParams.get("templateKind"),
      search: request.nextUrl.searchParams.get("search") || undefined,
      page: request.nextUrl.searchParams.get("page") || undefined,
      limit: request.nextUrl.searchParams.get("limit") || undefined,
    });

    if (!validationResult.success) {
      return NextResponse.json({ error: "Invalid copy source filters" }, { status: 400 });
    }

    const { scope, templateKind, search, page, limit } = validationResult.data;
    const offset = (page - 1) * limit;
    const { data, error } = await supabase.rpc("list_transformation_template_copy_sources", {
      p_scope: scope,
      p_template_kind: templateKind,
      p_search: search ?? null,
      p_offset: offset,
      p_limit: limit,
    });

    if (error) {
      console.error("Failed to list transformation template copy sources", {
        code: error.code,
        message: error.message,
      });
      return NextResponse.json({ error: "Failed to load template copy sources" }, { status: 500 });
    }

    const rows = (data ?? []) as CopySourceRow[];
    const templates = rows.map(
      (row): TransformationTemplateCopySourceSummary => ({
        id: row.id,
        template_code: row.template_code,
        template_name: row.template_name,
        description: row.description,
        template_kind: row.template_kind,
        business_unit_id: row.business_unit_id,
        business_unit_code: row.business_unit_code,
        business_unit_name: row.business_unit_name,
      })
    );

    return NextResponse.json({
      data: templates,
      total: rows[0]?.total_count ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Unexpected transformation template copy source list error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "transformations",
  route: "/api/transformations/templates/copy-sources",
});
