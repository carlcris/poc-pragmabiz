import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { RESOURCES } from "@/constants/resources";
import { requirePermission } from "@/lib/auth";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import type { TransformationAdditionalOutputItem } from "@/types/transformation-template";

const filtersSchema = z.object({
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(5),
  excludedItemIds: z.array(z.string().uuid()).max(100).default([]),
});

type AdditionalOutputItemRow = TransformationAdditionalOutputItem & {
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

    const validationResult = filtersSchema.safeParse({
      search: request.nextUrl.searchParams.get("search") || undefined,
      page: request.nextUrl.searchParams.get("page") || undefined,
      limit: request.nextUrl.searchParams.get("limit") || undefined,
      excludedItemIds: request.nextUrl.searchParams.getAll("excludedItemId"),
    });

    if (!validationResult.success) {
      return NextResponse.json({ error: "Invalid item filters" }, { status: 400 });
    }

    const { search, page, limit, excludedItemIds } = validationResult.data;
    const { data, error } = await supabase.rpc("list_transformation_additional_output_items", {
      p_search: search ?? null,
      p_offset: (page - 1) * limit,
      p_limit: limit,
      p_excluded_item_ids: excludedItemIds,
    });

    if (error) {
      console.error("Failed to list transformation additional output items", {
        code: error.code,
        message: error.message,
      });
      return NextResponse.json({ error: "Failed to load output items" }, { status: 500 });
    }

    const rows = (data ?? []) as AdditionalOutputItemRow[];
    const items = rows.map(
      (row): TransformationAdditionalOutputItem => ({
        id: row.id,
        item_code: row.item_code,
        item_name: row.item_name,
        uom_id: row.uom_id,
        uom_code: row.uom_code,
        uom_name: row.uom_name,
      })
    );

    return NextResponse.json({
      data: items,
      total: rows[0]?.total_count ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Unexpected transformation additional output item list error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "transformations",
  route: "/api/transformations/additional-output-items",
});
