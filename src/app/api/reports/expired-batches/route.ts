import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import type { ExpiredBatchesResponse } from "@/types/expired-batches-report";

const schema = z
  .object({
    asOf: z.iso.date().refine((date) => date >= "0001-01-01"),
    groupBy: z.enum(["item", "batch"]).default("item"),
    search: z.string().trim().max(100).optional(),
    warehouseId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    exportMode: z.literal("pdf").optional(),
  })
  .strict();

async function GETHandler(request: NextRequest) {
  const unauthorized = await requirePermission(RESOURCES.REPORTS, "view");
  if (unauthorized) return unauthorized;
  try {
    const parsed = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid report filters", code: "EXPIRED_BATCHES_FILTERS_INVALID" },
        { status: 400 }
      );
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const filters = parsed.data;
    const { data, error } = await context.supabase.rpc("get_expired_batches_report", {
      p_company_id: context.companyId,
      p_as_of: filters.asOf,
      p_business_unit_id: context.currentBusinessUnitId,
      p_warehouse_id: filters.warehouseId || null,
      p_category_id: filters.categoryId || null,
      p_search: filters.search || null,
      p_group_by: filters.groupBy,
      p_page: filters.exportMode ? 1 : filters.page,
      p_limit: filters.exportMode ? 501 : filters.limit,
    });
    if (error) throw error;
    const report = data as unknown as ExpiredBatchesResponse;
    if (!report) throw new Error("Missing expired batches report response");
    if (report.pageRows > 500 || (filters.exportMode && report.totalRows > 500)) {
      return NextResponse.json(
        {
          error: "Report exceeds 500 batch rows. Narrow the filters or use fewer groups per page.",
          code: "EXPIRED_BATCHES_TOO_LARGE",
        },
        { status: 413 }
      );
    }
    return NextResponse.json(report);
  } catch (error) {
    console.error("Failed to fetch expired batches report", error);
    return NextResponse.json({ error: "Failed to fetch expired batches report" }, { status: 500 });
  }
}
export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "reports",
  route: "/api/reports/expired-batches",
});
