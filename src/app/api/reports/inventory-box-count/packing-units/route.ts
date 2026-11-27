import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { RESOURCES } from "@/constants/resources";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import type {
  InventoryBoxCountPackingUnitsResponse,
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
          error: "Invalid calculation unit search filters",
          code: "INVENTORY_BOX_COUNT_PACKING_UNITS_FILTERS_INVALID",
        },
        { status: 400 }
      );
    }

    const context = await requireRequestContext();
    if ("status" in context) return context;

    const { page, limit, search } = parsed.data;
    const offset = (page - 1) * limit;
    let query = context.supabase
      .from("units_of_measure")
      .select("id, code, name", { count: "exact" })
      .eq("company_id", context.companyId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("code", { ascending: true })
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);

    if (search) {
      const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
      const literal = pattern.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
      query = query.or(`code.ilike."${literal}",name.ilike."${literal}"`);
    }

    const defaultUnitQuery =
      page === 1 && !search
        ? context.supabase
            .from("units_of_measure")
            .select("id, code, name")
            .eq("company_id", context.companyId)
            .eq("is_active", true)
            .is("deleted_at", null)
            .eq("code", "BOX")
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });

    const [unitsResult, defaultResult] = await Promise.all([query, defaultUnitQuery]);
    if (unitsResult.error) throw unitsResult.error;
    if (defaultResult.error) throw defaultResult.error;

    const total = unitsResult.count ?? 0;
    const response: InventoryBoxCountPackingUnitsResponse = {
      data: unitsResult.data ?? [],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      defaultUnit: defaultResult.data,
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch inventory box count calculation units", error);
    return NextResponse.json<InventoryBoxCountReportErrorResponse>(
      {
        error: "Failed to fetch calculation units",
        code: "INVENTORY_BOX_COUNT_PACKING_UNITS_FAILED",
      },
      { status: 500 }
    );
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "reports",
  route: "/api/reports/inventory-box-count/packing-units",
});
