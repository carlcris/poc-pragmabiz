import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { RESOURCES } from "@/constants/resources";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import type {
  InventoryBoxCountBusinessUnitsResponse,
  InventoryBoxCountReportErrorResponse,
} from "@/types/inventory-box-count-report";

const filterSchema = z
  .object({
    search: z.string().trim().max(100).default(""),
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(5),
  })
  .strict();

async function GETHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.REPORTS, "view");
    if (unauthorized) return unauthorized;

    const parsed = filterSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) {
      return NextResponse.json<InventoryBoxCountReportErrorResponse>(
        {
          error: "Invalid business unit search filters",
          code: "INVENTORY_BOX_COUNT_BUSINESS_UNITS_FILTERS_INVALID",
        },
        { status: 400 }
      );
    }

    const context = await requireRequestContext();
    if ("status" in context) return context;

    const { page, limit, search } = parsed.data;
    const offset = (page - 1) * limit;
    let query = context.supabase
      .from("business_units")
      .select(
        "id, name, access:user_business_unit_access!user_business_unit_access_business_unit_id_fkey!inner(user_id)",
        { count: "exact" }
      )
      .eq("company_id", context.companyId)
      .eq("is_active", true)
      .eq("access.user_id", context.userId)
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);

    if (search) {
      const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
      const literal = pattern.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
      query = query.or(`code.ilike."${literal}",name.ilike."${literal}"`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    const total = count ?? 0;
    const response: InventoryBoxCountBusinessUnitsResponse = {
      data: (data ?? []).map(({ id, name }) => ({ id, name })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch inventory box count business units", error);
    return NextResponse.json<InventoryBoxCountReportErrorResponse>(
      {
        error: "Failed to fetch business units",
        code: "INVENTORY_BOX_COUNT_BUSINESS_UNITS_FAILED",
      },
      { status: 500 }
    );
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "reports",
  route: "/api/reports/inventory-box-count/business-units",
});
