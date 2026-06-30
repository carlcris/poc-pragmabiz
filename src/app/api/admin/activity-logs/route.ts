import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, getAuthenticatedUser } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;
const DEFAULT_TIME_ZONE = "Asia/Manila";

const OUTCOMES = new Set(["succeeded", "failed"]);
const SOURCES = new Set(["web", "mobile", "tablet", "api", "system"]);

const clampPageSize = (value: string | null) => {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(parsed, 10), MAX_PAGE_SIZE);
};

const escapeFilterValue = (value: string) =>
  value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_")
    .replaceAll(",", "\\,");

const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const resolveTimeZone = (value: string | null) => {
  const timeZone = value?.trim() || DEFAULT_TIME_ZONE;
  try {
    Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
};

const getTimeZoneOffsetMs = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );

  const asUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour === 24 ? 0 : values.hour,
    values.minute,
    values.second
  );

  return asUtc - date.getTime();
};

const shiftDateInputValue = (value: string, days: number) => {
  if (!DATE_INPUT_PATTERN.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (!Number.isFinite(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate()
  ).padStart(2, "0")}`;
};

const hasInvalidDateRange = (startDate: string | null, endDate: string | null) =>
  !!startDate &&
  !!endDate &&
  DATE_INPUT_PATTERN.test(startDate) &&
  DATE_INPUT_PATTERN.test(endDate) &&
  startDate > endDate;

const resolveZonedDateStart = (value: string | null, timeZone: string) => {
  if (!value || !DATE_INPUT_PATTERN.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  if (!Number.isFinite(utcGuess.getTime())) return null;

  const firstOffset = getTimeZoneOffsetMs(utcGuess, timeZone);
  const firstUtc = new Date(utcGuess.getTime() - firstOffset);
  const finalOffset = getTimeZoneOffsetMs(firstUtc, timeZone);
  const finalUtc =
    finalOffset === firstOffset ? firstUtc : new Date(utcGuess.getTime() - finalOffset);

  return Number.isFinite(finalUtc.getTime()) ? finalUtc.toISOString() : null;
};

const resolveZonedDateEndExclusive = (value: string | null, timeZone: string) => {
  if (!value) return null;
  const nextDate = shiftDateInputValue(value, 1);
  return nextDate ? resolveZonedDateStart(nextDate, timeZone) : null;
};

async function GETHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.ACTIVITY_LOGS, "view");
    if (unauthorized) return unauthorized;

    const user = await getAuthenticatedUser();
    if (!user?.companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = clampPageSize(searchParams.get("limit"));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const requestedStartDate = searchParams.get("startDate");
    const requestedEndDate = searchParams.get("endDate");
    if (hasInvalidDateRange(requestedStartDate, requestedEndDate)) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }

    const timeZone = resolveTimeZone(searchParams.get("timeZone"));
    const startDate = resolveZonedDateStart(requestedStartDate, timeZone);
    const endDateExclusive = resolveZonedDateEndExclusive(requestedEndDate, timeZone);
    const search = searchParams.get("search")?.trim() || null;
    const outcome = searchParams.get("outcome") || null;
    const source = searchParams.get("source") || null;

    const adminSupabase = createAdminClient();
    let query = adminSupabase
      .from("user_activity_logs")
      .select(
        `
        id,
        occurred_at,
        request_id,
        actor_type,
        actor_label,
        user_id,
        business_unit_id,
        source,
        http_method,
        route,
        action,
        resource_type,
        entity_id,
        entity_code,
        entity_label,
        outcome,
        http_status,
        duration_ms,
        error_code,
        message_key,
        display_message
      `,
        { count: "exact" }
      )
      .eq("company_id", user.companyId)
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false });

    if (startDate) query = query.gte("occurred_at", startDate);
    if (endDateExclusive) query = query.lt("occurred_at", endDateExclusive);
    if (outcome && OUTCOMES.has(outcome)) query = query.eq("outcome", outcome);
    if (source && SOURCES.has(source)) query = query.eq("source", source);

    if (search) {
      const escapedSearch = escapeFilterValue(search);
      query = query.or(
        [
          `display_message.ilike.%${escapedSearch}%`,
          `actor_label.ilike.%${escapedSearch}%`,
          `entity_code.ilike.%${escapedSearch}%`,
          `entity_label.ilike.%${escapedSearch}%`,
        ].join(",")
      );
    }

    const { data, error, count } = await query.range(from, to);
    if (error) {
      console.error("Failed to fetch activity logs:", error);
      return NextResponse.json({ error: "Failed to fetch activity logs" }, { status: 500 });
    }

    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
      },
      filters: {
        startDate: requestedStartDate || null,
        endDate: requestedEndDate || null,
        timeZone,
        search,
        outcome: outcome && OUTCOMES.has(outcome) ? outcome : null,
        source: source && SOURCES.has(source) ? source : null,
      },
    });
  } catch (error) {
    console.error("Unexpected activity log list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "activity_logs",
  route: "/api/admin/activity-logs",
});
