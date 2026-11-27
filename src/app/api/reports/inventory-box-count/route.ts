import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { RESOURCES } from "@/constants/resources";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import type {
  InventoryBoxCountReportErrorResponse,
  InventoryBoxCountReportResponse,
} from "@/types/inventory-box-count-report";

const PDF_REPORT_ROW_LIMIT = 5000;

const filterSchema = z
  .object({
    categoryId: z.uuid(),
    packingUnitId: z.uuid(),
    businessUnitId: z.uuid().optional(),
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(25),
    exportMode: z.literal("pdf").optional(),
  })
  .strict();

const dimensionSchema = z.object({ id: z.uuid(), name: z.string() });
const reportSchema = z.object({
  data: z.array(
    z.object({
      itemId: z.uuid(),
      itemCode: z.string(),
      itemName: z.string(),
      baseUnit: z.string().nullable(),
      onHand: z.number(),
      qtyPerPackingUnit: z.number().positive(),
      fullPackingUnits: z.number().int().nonnegative(),
      looseUnits: z.number().nonnegative(),
    })
  ),
  summary: z.object({
    totalItems: z.number().int().nonnegative(),
    totalFullPackingUnits: z.number().int().nonnegative(),
    itemsWithoutPackingUnitSize: z.number().int().nonnegative(),
  }),
  pagination: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
  }),
  category: dimensionSchema,
  businessUnit: dimensionSchema.nullable(),
  packingUnit: dimensionSchema.extend({ code: z.string() }),
});

async function GETHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.REPORTS, "view");
    if (unauthorized) return unauthorized;

    const parsed = filterSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) {
      return NextResponse.json<InventoryBoxCountReportErrorResponse>(
        { error: "Invalid report filters", code: "INVENTORY_BOX_COUNT_FILTERS_INVALID" },
        { status: 400 }
      );
    }

    const context = await requireRequestContext();
    if ("status" in context) return context;

    const filters = parsed.data;
    const { data, error } = await context.supabase.rpc("get_inventory_box_count_report", {
      p_company_id: context.companyId,
      p_category_id: filters.categoryId,
      p_packing_unit_id: filters.packingUnitId,
      p_business_unit_id: filters.businessUnitId ?? null,
      p_page: filters.exportMode ? 1 : filters.page,
      p_limit: filters.exportMode ? PDF_REPORT_ROW_LIMIT : filters.limit,
    });

    if (error?.code === "22023" && error.message === "INVENTORY_BOX_COUNT_PACKING_UNIT_NOT_FOUND") {
      return NextResponse.json<InventoryBoxCountReportErrorResponse>(
        {
          error: "Selected calculation unit is unavailable. Select another unit.",
          code: "INVENTORY_BOX_COUNT_PACKING_UNIT_NOT_FOUND",
        },
        { status: 400 }
      );
    }
    if (error?.code === "42501") {
      return NextResponse.json<InventoryBoxCountReportErrorResponse>(
        { error: "Report access denied", code: "INVENTORY_BOX_COUNT_FORBIDDEN" },
        { status: 403 }
      );
    }
    if (error) throw error;
    if (data === null) {
      return NextResponse.json<InventoryBoxCountReportErrorResponse>(
        { error: "Category not found", code: "INVENTORY_BOX_COUNT_CATEGORY_NOT_FOUND" },
        { status: 404 }
      );
    }

    const report: InventoryBoxCountReportResponse = reportSchema.parse(data);
    if (filters.exportMode && report.summary.totalItems > PDF_REPORT_ROW_LIMIT) {
      return NextResponse.json<InventoryBoxCountReportErrorResponse>(
        {
          error: "Report exceeds 5,000 items. Select a smaller category before exporting.",
          code: "INVENTORY_BOX_COUNT_TOO_LARGE",
        },
        { status: 413 }
      );
    }
    if (filters.exportMode && report.data.length !== report.summary.totalItems) {
      throw new Error("Inventory box count export returned an incomplete item list");
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error("Failed to fetch inventory box count report", error);
    return NextResponse.json<InventoryBoxCountReportErrorResponse>(
      { error: "Failed to fetch inventory box count report", code: "INVENTORY_BOX_COUNT_FAILED" },
      { status: 500 }
    );
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "reports",
  route: "/api/reports/inventory-box-count",
});
