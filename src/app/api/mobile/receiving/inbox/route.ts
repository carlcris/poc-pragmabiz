import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import { DELIVERY_NOTE_RECEIVING_CAPABILITY } from "@/lib/delivery-notes/permissions";
import { getUserCapabilities, hasCapability } from "@/services/permissions/permissionResolver";

const RECEIVING_INBOX_STAGES = [
  "to_receive",
  "ready",
  "in_progress",
  "expected",
  "awaiting_approval",
  "completed",
  "all",
] as const;
const RECEIVING_INBOX_KINDS = ["all", "load_list", "delivery_note"] as const;

type ReceivingInboxStage = (typeof RECEIVING_INBOX_STAGES)[number];
type ReceivingInboxKind = (typeof RECEIVING_INBOX_KINDS)[number];

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_SEARCH_LENGTH = 100;

const RECEIVING_INBOX_ERRORS: Record<string, { message: string; status: number }> = {
  RECEIVING_INBOX_INVALID_STAGE: { message: "Invalid receiving stage", status: 400 },
  RECEIVING_INBOX_INVALID_KIND: { message: "Invalid document type", status: 400 },
  RECEIVING_INBOX_INVALID_PAGE: { message: "Invalid page", status: 400 },
  RECEIVING_INBOX_BUSINESS_UNIT_DENIED: {
    message: "You do not have access to this business unit",
    status: 403,
  },
};

const isStage = (value: string): value is ReceivingInboxStage =>
  (RECEIVING_INBOX_STAGES as readonly string[]).includes(value);

const isKind = (value: string): value is ReceivingInboxKind =>
  (RECEIVING_INBOX_KINDS as readonly string[]).includes(value);

const parsePositiveInt = (value: string | null, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const mapInboxError = (message: string) =>
  RECEIVING_INBOX_ERRORS[
    Object.keys(RECEIVING_INBOX_ERRORS).find((code) => message.includes(code)) || ""
  ] || null;

// GET /api/mobile/receiving/inbox
async function GETHandler(request: NextRequest) {
  try {
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, userId, companyId, currentBusinessUnitId } = context;

    const capabilities = await getUserCapabilities(userId, currentBusinessUnitId);
    const canViewLoadLists =
      hasCapability(capabilities, RESOURCES.LOAD_LISTS, "view") ||
      hasCapability(capabilities, RESOURCES.GOODS_RECEIPT_NOTES, "view");
    const canViewDeliveryNotes =
      hasCapability(capabilities, RESOURCES.DELIVERY_NOTES, "view") &&
      hasCapability(capabilities, DELIVERY_NOTE_RECEIVING_CAPABILITY, "edit");

    if (!canViewLoadLists && !canViewDeliveryNotes) {
      return NextResponse.json(
        { error: "Forbidden", details: "You do not have permission to view receiving" },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const stage = searchParams.get("stage") || "to_receive";
    const kind = searchParams.get("kind") || "all";
    if (!isStage(stage)) {
      return NextResponse.json({ error: "Invalid receiving stage" }, { status: 400 });
    }
    if (!isKind(kind)) {
      return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
    }

    const search = (searchParams.get("search") || "").trim().slice(0, MAX_SEARCH_LENGTH);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = Math.min(
      parsePositiveInt(searchParams.get("limit"), DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE
    );
    const access = { loadLists: canViewLoadLists, deliveryNotes: canViewDeliveryNotes };

    if (!currentBusinessUnitId) {
      return NextResponse.json({
        data: [],
        stageCounts: [],
        access,
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }

    const { data, error } = await supabase.rpc("list_receiving_inbox", {
      p_company_id: companyId,
      p_business_unit_id: currentBusinessUnitId,
      p_include_load_lists: canViewLoadLists,
      p_include_delivery_notes: canViewDeliveryNotes,
      p_stage: stage,
      p_kind: kind,
      p_search: search,
      p_limit: limit,
      p_offset: (page - 1) * limit,
    });

    if (error) {
      const mapped = mapInboxError(error.message);
      if (mapped) {
        return NextResponse.json({ error: mapped.message }, { status: mapped.status });
      }
      console.error("Failed to load receiving inbox:", error);
      return NextResponse.json({ error: "Failed to load receiving inbox" }, { status: 500 });
    }

    const result = isRecord(data) ? data : {};
    const total = typeof result.total === "number" ? result.total : 0;

    return NextResponse.json({
      data: Array.isArray(result.rows) ? result.rows : [],
      stageCounts: Array.isArray(result.stageCounts) ? result.stageCounts : [],
      access,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Unexpected error loading receiving inbox:", error);
    return NextResponse.json({ error: "Failed to load receiving inbox" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "view",
  resourceType: "receiving_inbox",
  route: "/api/mobile/receiving/inbox",
});
