import { NextRequest, NextResponse } from "next/server";
import { RESOURCES } from "@/constants/resources";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 500;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type DeliveryDirection = "all" | "outbound" | "inbound" | "internal";
type DeliveryPerformanceStatus = "all" | "on_time" | "late" | "in_transit" | "discrepancy";

const deliveryDirections = new Set<DeliveryDirection>([
  "all",
  "outbound",
  "inbound",
  "internal",
]);
const performanceStatuses = new Set<DeliveryPerformanceStatus>([
  "all",
  "on_time",
  "late",
  "in_transit",
  "discrepancy",
]);

const parsePositiveInteger = (value: string | null, fallback: number, maximum: number) => {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
};

const isValidDateRange = (startDate: string, endDate: string) => {
  if (!DATE_PATTERN.test(startDate) || !DATE_PATTERN.test(endDate)) return false;
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return false;
  if (start.toISOString().slice(0, 10) !== startDate) return false;
  if (end.toISOString().slice(0, 10) !== endDate) return false;
  const daySpan = (end.getTime() - start.getTime()) / 86_400_000;
  return daySpan >= 0 && daySpan <= 366;
};

async function GETHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.REPORTS, "view");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;

    const { supabase, userId, companyId, currentBusinessUnitId } = context;
    if (!currentBusinessUnitId) {
      return NextResponse.json(
        { error: "A business unit context is required for this report" },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const today = new Date();
    const defaultStartDate = new Date(today.getTime() - 30 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const defaultEndDate = today.toISOString().slice(0, 10);
    const startDate = searchParams.get("startDate") || defaultStartDate;
    const endDate = searchParams.get("endDate") || defaultEndDate;

    if (!isValidDateRange(startDate, endDate)) {
      return NextResponse.json(
        { error: "Select a valid date range of up to 366 days" },
        { status: 400 }
      );
    }

    const requestedDirection = searchParams.get("direction") || "all";
    const requestedStatus = searchParams.get("performanceStatus") || "all";
    if (!deliveryDirections.has(requestedDirection as DeliveryDirection)) {
      return NextResponse.json({ error: "Invalid delivery direction" }, { status: 400 });
    }
    if (!performanceStatuses.has(requestedStatus as DeliveryPerformanceStatus)) {
      return NextResponse.json({ error: "Invalid delivery performance status" }, { status: 400 });
    }

    const search = searchParams.get("search")?.trim() || null;
    if (search && search.length > 100) {
      return NextResponse.json(
        { error: "Search must be 100 characters or fewer" },
        { status: 400 }
      );
    }

    const page = parsePositiveInteger(searchParams.get("page"), 1, 1_000_000);
    const limit = parsePositiveInteger(searchParams.get("limit"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

    const { data, error } = await supabase.rpc("get_delivery_performance_report", {
      p_business_unit_id: currentBusinessUnitId,
      p_company_id: companyId,
      p_direction: requestedDirection,
      p_end_date: endDate,
      p_limit: limit,
      p_page: page,
      p_performance_status: requestedStatus,
      p_search: search ?? undefined,
      p_start_date: startDate,
      p_user_id: userId,
    });

    if (error) {
      console.error("Failed to fetch delivery performance report", {
        businessUnitId: currentBusinessUnitId,
        startDate,
        endDate,
        direction: requestedDirection,
        performanceStatus: requestedStatus,
        error,
      });
      return NextResponse.json(
        { error: "Failed to fetch delivery performance report" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error generating delivery performance report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "delivery_performance",
  route: "/api/reports/delivery-performance",
});
