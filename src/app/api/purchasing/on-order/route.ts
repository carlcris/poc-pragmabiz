import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import type { Database } from "@/types/database.types";
import type { PurchaseOnOrderItem, PurchaseOnOrderResponse } from "@/types/purchase-on-order";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const MAX_PAGE = 100000;
const statusSchema = z.enum(["awaiting_delivery", "partially_received"]);

const onOrderItemSchema = z
  .object({
    sr_item_id: z.string(),
    sr_id: z.string(),
    sr_number: z.string(),
    supplier_id: z.string(),
    supplier_name: z.string(),
    supplier_code: z.string().nullable(),
    item_id: z.string(),
    item_code: z.string().nullable(),
    item_name: z.string(),
    ordered_qty: z.number(),
    received_qty: z.number(),
    outstanding_qty: z.number(),
    expected_delivery: z.string().nullable(),
    status: statusSchema,
  })
  .transform((row): PurchaseOnOrderItem => ({
    srItemId: row.sr_item_id,
    srId: row.sr_id,
    srNumber: row.sr_number,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    supplierCode: row.supplier_code,
    itemId: row.item_id,
    itemCode: row.item_code,
    itemName: row.item_name,
    orderedQty: row.ordered_qty,
    receivedQty: row.received_qty,
    outstandingQty: row.outstanding_qty,
    expectedDelivery: row.expected_delivery,
    status: row.status,
  }));

const statusPageSchema = z.object({
  items: z.array(onOrderItemSchema).max(MAX_PAGE_SIZE),
  awaiting_delivery_count: z.int().nonnegative(),
  partially_received_count: z.int().nonnegative(),
  page: z.int().min(1).max(MAX_PAGE),
  page_limit: z.int().min(1).max(MAX_PAGE_SIZE),
});

type StatusPageRpcArgs = Database["public"]["Functions"]["get_purchase_on_order_status_page"]["Args"];

const parsePositiveInteger = (value: string | null, fallback: number, max: number) => {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

const normalizeTextFilter = (value: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const normalizeDateFilter = (value: string | null) => {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
};

const normalizeUuidFilter = (value: string | null) => {
  const normalized = normalizeTextFilter(value);
  if (!normalized) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    normalized
  )
    ? normalized
    : null;
};

async function GETHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUISITIONS, "view");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, currentBusinessUnitId } = context;

    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    const { searchParams } = request.nextUrl;
    const status = statusSchema.safeParse(searchParams.get("status") ?? "awaiting_delivery");
    if (!status.success) {
      return NextResponse.json({ error: "Invalid on-order status" }, { status: 400 });
    }

    const page = parsePositiveInteger(searchParams.get("page"), 1, MAX_PAGE);
    const limit = parsePositiveInteger(searchParams.get("limit"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

    const rpcArgs: StatusPageRpcArgs = {
      p_company_id: companyId,
      p_business_unit_id: currentBusinessUnitId,
      p_search: normalizeTextFilter(searchParams.get("search")) ?? undefined,
      p_supplier_id: normalizeUuidFilter(searchParams.get("supplierId")) ?? undefined,
      p_status: status.data,
      p_expected_from: normalizeDateFilter(searchParams.get("expectedFrom")) ?? undefined,
      p_expected_to: normalizeDateFilter(searchParams.get("expectedTo")) ?? undefined,
      p_page: page,
      p_limit: limit,
    };

    const { data, error } = await supabase.rpc("get_purchase_on_order_status_page", rpcArgs).single();
    if (error) throw error;

    const statusPage = statusPageSchema.parse(data);
    const statusCounts = {
      awaiting_delivery: statusPage.awaiting_delivery_count,
      partially_received: statusPage.partially_received_count,
    };
    const total = statusCounts[status.data];

    return NextResponse.json<PurchaseOnOrderResponse>({
      data: statusPage.items,
      statusCounts,
      pagination: {
        total,
        page: statusPage.page,
        limit: statusPage.page_limit,
        totalPages: Math.ceil(total / statusPage.page_limit),
      },
    });
  } catch (error) {
    console.error("Error fetching purchase on-order items:", error);
    return NextResponse.json({ error: "Failed to fetch on-order items" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "stock_requisitions",
  route: "/api/purchasing/on-order",
});
