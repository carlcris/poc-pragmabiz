import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import type { PurchaseOnOrderItem, PurchaseOnOrderStatus } from "@/types/purchase-on-order";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const MAX_PAGE = 100000;
const STATUS_VALUES = new Set<PurchaseOnOrderStatus>([
  "awaiting_delivery",
  "partially_received",
]);

type RpcError = {
  message?: string;
};

type OnOrderRpcRow = {
  sr_item_id: string;
  sr_id: string;
  sr_number: string;
  supplier_id: string;
  supplier_name: string;
  supplier_code: string | null;
  item_id: string;
  item_code: string | null;
  item_name: string;
  ordered_qty: number | string | null;
  received_qty: number | string | null;
  outstanding_qty: number | string | null;
  expected_delivery: string | null;
  status: PurchaseOnOrderStatus;
  total_count: number | string | null;
};

type RpcClient = {
  rpc: (
    fn: "get_purchase_on_order_items",
    args: {
      p_company_id: string;
      p_business_unit_id: string;
      p_search: string | null;
      p_supplier_id: string | null;
      p_status: PurchaseOnOrderStatus | null;
      p_expected_from: string | null;
      p_expected_to: string | null;
      p_page: number;
      p_limit: number;
    }
  ) => Promise<{ data: OnOrderRpcRow[] | null; error: RpcError | null }>;
};

type OnOrderRpcArgs = Parameters<RpcClient["rpc"]>[1];

const asRpcClient = (client: unknown): RpcClient => client as RpcClient;

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

const normalizeStatusFilter = (value: string | null): PurchaseOnOrderStatus | null => {
  if (!value || value === "all") return null;
  return STATUS_VALUES.has(value as PurchaseOnOrderStatus)
    ? (value as PurchaseOnOrderStatus)
    : null;
};

const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatRow = (row: OnOrderRpcRow): PurchaseOnOrderItem => ({
  srItemId: row.sr_item_id,
  srId: row.sr_id,
  srNumber: row.sr_number,
  supplierId: row.supplier_id,
  supplierName: row.supplier_name,
  supplierCode: row.supplier_code,
  itemId: row.item_id,
  itemCode: row.item_code,
  itemName: row.item_name,
  orderedQty: toNumber(row.ordered_qty),
  receivedQty: toNumber(row.received_qty),
  outstandingQty: toNumber(row.outstanding_qty),
  expectedDelivery: row.expected_delivery,
  status: row.status,
});

const fetchOnOrderRows = async (client: RpcClient, args: OnOrderRpcArgs) => {
  const { data, error } = await client.rpc("get_purchase_on_order_items", args);
  if (error) throw error;
  return data || [];
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

    const { searchParams } = new URL(request.url);
    const page = parsePositiveInteger(searchParams.get("page"), 1, MAX_PAGE);
    const limit = parsePositiveInteger(searchParams.get("limit"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const status = normalizeStatusFilter(searchParams.get("status"));
    const rpcClient = asRpcClient(supabase);

    const rpcArgs: OnOrderRpcArgs = {
      p_company_id: companyId,
      p_business_unit_id: currentBusinessUnitId,
      p_search: normalizeTextFilter(searchParams.get("search")),
      p_supplier_id: normalizeUuidFilter(searchParams.get("supplierId")),
      p_status: status,
      p_expected_from: normalizeDateFilter(searchParams.get("expectedFrom")),
      p_expected_to: normalizeDateFilter(searchParams.get("expectedTo")),
      p_page: page,
      p_limit: limit,
    };

    let rows = await fetchOnOrderRows(rpcClient, rpcArgs);
    let total = rows.length > 0 ? toNumber(rows[0].total_count) : 0;
    let responsePage = page;

    if (rows.length === 0 && page > 1) {
      const firstPageRows = await fetchOnOrderRows(rpcClient, { ...rpcArgs, p_page: 1 });
      total = firstPageRows.length > 0 ? toNumber(firstPageRows[0].total_count) : 0;

      if (total > 0) {
        const lastPage = Math.ceil(total / limit);
        responsePage = lastPage;
        rows =
          lastPage === 1
            ? firstPageRows
            : await fetchOnOrderRows(rpcClient, { ...rpcArgs, p_page: lastPage });
      }
    }

    return NextResponse.json({
      data: rows.map(formatRow),
      pagination: {
        total,
        page: responsePage,
        limit,
        totalPages: Math.ceil(total / limit),
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
