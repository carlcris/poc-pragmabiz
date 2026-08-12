import { NextRequest, NextResponse } from "next/server";
import { RESOURCES } from "@/constants/resources";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import type {
  InventoryReservationRow,
  InventoryReservationsResponse,
  InventoryReservationSortField,
  InventoryReservationSortOrder,
  InventoryReservationSourceType,
  InventoryReservationStatus,
} from "@/types/inventory-reservations";
import {
  INVENTORY_RESERVATION_SORT_FIELDS,
  INVENTORY_RESERVATION_SOURCE_TYPES,
  INVENTORY_RESERVATION_STATUSES,
} from "@/types/inventory-reservations";

type InventoryReservationRpcRow = {
  reservation_id: string;
  source_type: InventoryReservationSourceType;
  source_id: string;
  source_reference: string;
  item_id: string;
  item_code: string;
  item_name: string;
  uom_id: string;
  uom_code: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  committed_quantity_base: number | string;
  physically_allocated_base: number | string;
  active_quantity_base: number | string;
  consumed_base: number | string;
  released_base: number | string;
  transferred_out_base: number | string;
  status: InventoryReservationStatus;
  updated_at: string;
};

type InventoryReservationsRpcResult = {
  data: InventoryReservationRpcRow[];
  total: number | string;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;

const parsePositiveInteger = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toNumber = (value: number | string | null | undefined) => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeSearch = (value: string | null) => {
  const normalized = value?.trim().slice(0, 100).replaceAll("%", "").replaceAll("_", "");
  return normalized || null;
};

const isReservationStatus = (value: string): value is InventoryReservationStatus =>
  INVENTORY_RESERVATION_STATUSES.some((status) => status === value);

const isSourceType = (value: string): value is InventoryReservationSourceType =>
  INVENTORY_RESERVATION_SOURCE_TYPES.some((sourceType) => sourceType === value);

const isSortField = (value: string): value is InventoryReservationSortField =>
  INVENTORY_RESERVATION_SORT_FIELDS.some((field) => field === value);

const isSortOrder = (value: string): value is InventoryReservationSortOrder =>
  value === "asc" || value === "desc";

const mapRow = (row: InventoryReservationRpcRow): InventoryReservationRow => ({
  reservationId: row.reservation_id,
  sourceType: row.source_type,
  sourceId: row.source_id,
  sourceReference: row.source_reference,
  itemId: row.item_id,
  itemCode: row.item_code,
  itemName: row.item_name,
  uomId: row.uom_id,
  uomCode: row.uom_code,
  warehouseId: row.warehouse_id,
  warehouseCode: row.warehouse_code,
  warehouseName: row.warehouse_name,
  committedQuantityBase: toNumber(row.committed_quantity_base),
  physicallyAllocatedBase: toNumber(row.physically_allocated_base),
  activeQuantityBase: toNumber(row.active_quantity_base),
  consumedBase: toNumber(row.consumed_base),
  releasedBase: toNumber(row.released_base),
  transferredOutBase: toNumber(row.transferred_out_base),
  status: row.status,
  updatedAt: row.updated_at,
});

async function GETHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.INVENTORY_RESERVATIONS, "view");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;

    if (!context.currentBusinessUnitId) {
      return NextResponse.json(
        { error: "Select a business unit to view inventory reservations" },
        { status: 400 }
      );
    }

    const params = request.nextUrl.searchParams;
    const page = parsePositiveInteger(params.get("page"), 1);
    const limit = Math.min(
      parsePositiveInteger(params.get("limit"), DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE
    );
    const search = normalizeSearch(params.get("search"));
    const statusParam = params.get("status") || "all";
    const sourceTypeParam = params.get("sourceType") || "all";
    const sortByParam = params.get("sortBy") || "updated_at";
    const sortOrderParam = params.get("sortOrder") || "desc";
    const itemId = params.get("itemId") || null;
    const warehouseId = params.get("warehouseId") || null;

    if (statusParam !== "all" && !isReservationStatus(statusParam)) {
      return NextResponse.json({ error: "Invalid reservation status" }, { status: 400 });
    }
    if (sourceTypeParam !== "all" && !isSourceType(sourceTypeParam)) {
      return NextResponse.json({ error: "Invalid reservation source type" }, { status: 400 });
    }
    if (!isSortField(sortByParam) || !isSortOrder(sortOrderParam)) {
      return NextResponse.json({ error: "Invalid reservation sorting" }, { status: 400 });
    }
    if ((itemId && !UUID_REGEX.test(itemId)) || (warehouseId && !UUID_REGEX.test(warehouseId))) {
      return NextResponse.json({ error: "Invalid inventory reservation filter" }, { status: 400 });
    }

    const { data, error } = await context.supabase.rpc("get_inventory_reservations_page", {
      p_company_id: context.companyId,
      p_user_id: context.userId,
      p_business_unit_id: context.currentBusinessUnitId,
      p_search: search,
      p_source_type: sourceTypeParam === "all" ? null : sourceTypeParam,
      p_status: statusParam === "all" ? null : statusParam,
      p_item_id: itemId,
      p_warehouse_id: warehouseId,
      p_sort_by: sortByParam,
      p_sort_order: sortOrderParam,
      p_page: page,
      p_limit: limit,
    });

    if (error) {
      console.error("Failed to fetch inventory reservations:", error);
      return NextResponse.json(
        { error: "Failed to fetch inventory reservations" },
        { status: 500 }
      );
    }

    const result = data as unknown as InventoryReservationsRpcResult;
    const total = toNumber(result.total);
    const response: InventoryReservationsResponse = {
      data: (result.data || []).map(mapRow),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected inventory reservations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "inventory_reservations",
  route: "/api/inventory-reservations",
});
