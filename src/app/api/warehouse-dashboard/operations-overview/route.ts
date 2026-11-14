import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { GRANULAR_CAPABILITIES } from "@/constants/granular-permissions";
import { getUserCapabilities, hasCapability } from "@/services/permissions/permissionResolver";
import {
  OPERATIONS_OVERVIEW_RANGES,
  type WarehouseOperationsOverview,
} from "@/types/warehouse-operations-overview";

// The viewer's IANA time zone decides "today" and local created-at days in the RPC.
const isSupportedTimeZone = (timeZone: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
};

const schema = z
  .object({
    timeZone: z.string().min(1).max(64).refine(isSupportedTimeZone),
    days: z.coerce
      .number()
      .int()
      .refine((days) => (OPERATIONS_OVERVIEW_RANGES as readonly number[]).includes(days)),
  })
  .strict();

async function GETHandler(request: NextRequest) {
  const parsed = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid overview range", code: "OPERATIONS_OVERVIEW_RANGE_INVALID" },
      { status: 400 }
    );
  }

  try {
    const context = await requireRequestContext();
    if ("status" in context) return context;

    const scopedBusinessUnitIds = context.currentBusinessUnitId
      ? [context.currentBusinessUnitId]
      : context.accessibleBusinessUnitIds;
    if (scopedBusinessUnitIds.length === 0) {
      return NextResponse.json({ error: "No business unit access" }, { status: 403 });
    }

    const capabilities = await getUserCapabilities(
      context.userId,
      context.currentBusinessUnitId ?? null
    );
    const can = (capability: string) => hasCapability(capabilities, capability);

    const { data, error } = await context.supabase.rpc("get_warehouse_operations_overview", {
      p_company_id: context.companyId,
      p_business_unit_ids: scopedBusinessUnitIds,
      p_time_zone: parsed.data.timeZone,
      p_days: parsed.data.days,
      p_include_stock: can(GRANULAR_CAPABILITIES.DASHBOARD_STOCK_VALUE),
      p_include_reorder: can(GRANULAR_CAPABILITIES.DASHBOARD_REORDER_VALUE),
      p_include_inbound: can(GRANULAR_CAPABILITIES.DASHBOARD_INCOMING_SHIPMENTS_CARD),
      p_include_pick_lists: can(GRANULAR_CAPABILITIES.DASHBOARD_PICK_LIST_QUEUE),
      p_include_stock_requests: can(GRANULAR_CAPABILITIES.DASHBOARD_STOCK_REQUESTS_QUEUE),
      p_include_incoming: can(GRANULAR_CAPABILITIES.DASHBOARD_INCOMING_DELIVERIES_QUEUE),
    });

    if (error) {
      // 22023: a time zone the database does not recognise, or an invalid range.
      if (error.code === "22023") {
        return NextResponse.json(
          { error: "Invalid overview range", code: "OPERATIONS_OVERVIEW_RANGE_INVALID" },
          { status: 400 }
        );
      }
      if (error.code === "42501") {
        return NextResponse.json({ error: "Not allowed to view this overview" }, { status: 403 });
      }
      throw error;
    }

    return NextResponse.json(data as unknown as WarehouseOperationsOverview);
  } catch (error) {
    console.error("Failed to fetch warehouse operations overview", error);
    return NextResponse.json(
      { error: "Failed to fetch warehouse operations overview" },
      { status: 500 }
    );
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "warehouse_dashboard",
  route: "/api/warehouse-dashboard/operations-overview",
});
