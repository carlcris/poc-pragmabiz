import { NextRequest, NextResponse } from "next/server";
import { RESOURCES } from "@/constants/resources";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import type {
  InventoryReservationAllocationRow,
  InventoryReservationAllocationsResponse,
  InventoryReservationStatus,
} from "@/types/inventory-reservations";

type RouteContext = { params: Promise<{ id: string }> };

type InventoryReservationAllocationRpcRow = {
  allocation_id: string;
  owner_type: "pick_list" | "transformation_order";
  owner_id: string;
  owner_reference: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  item_batch_id: string;
  batch_code: string;
  item_batch_location_id: string;
  location_sku: string;
  location_id: string;
  location_code: string;
  location_name: string | null;
  quantity_base: number | string;
  transferred_in_base: number | string;
  transferred_out_base: number | string;
  active_quantity_base: number | string;
  consumed_base: number | string;
  released_base: number | string;
  status: InventoryReservationStatus;
  updated_at: string;
};

type InventoryReservationAllocationsRpcResult = {
  data: InventoryReservationAllocationRpcRow[];
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

const mapRow = (row: InventoryReservationAllocationRpcRow): InventoryReservationAllocationRow => ({
  allocationId: row.allocation_id,
  ownerType: row.owner_type,
  ownerId: row.owner_id,
  ownerReference: row.owner_reference,
  warehouseId: row.warehouse_id,
  warehouseCode: row.warehouse_code,
  warehouseName: row.warehouse_name,
  itemBatchId: row.item_batch_id,
  batchCode: row.batch_code,
  itemBatchLocationId: row.item_batch_location_id,
  locationSku: row.location_sku,
  locationId: row.location_id,
  locationCode: row.location_code,
  locationName: row.location_name,
  quantityBase: toNumber(row.quantity_base),
  transferredInBase: toNumber(row.transferred_in_base),
  transferredOutBase: toNumber(row.transferred_out_base),
  activeQuantityBase: toNumber(row.active_quantity_base),
  consumedBase: toNumber(row.consumed_base),
  releasedBase: toNumber(row.released_base),
  status: row.status,
  updatedAt: row.updated_at,
});

async function GETHandler(request: NextRequest, { params }: RouteContext) {
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

    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid inventory reservation" }, { status: 400 });
    }

    const page = parsePositiveInteger(request.nextUrl.searchParams.get("page"), 1);
    const limit = Math.min(
      parsePositiveInteger(request.nextUrl.searchParams.get("limit"), DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE
    );

    const { data, error } = await context.supabase.rpc(
      "get_inventory_reservation_allocations_page",
      {
        p_company_id: context.companyId,
        p_user_id: context.userId,
        p_business_unit_id: context.currentBusinessUnitId,
        p_reservation_id: id,
        p_page: page,
        p_limit: limit,
      }
    );

    if (error) {
      const isNotFound = error.message.includes("INVENTORY_RESERVATION_NOT_FOUND");
      console.error("Failed to fetch inventory reservation allocations:", error);
      return NextResponse.json(
        { error: isNotFound ? "Inventory reservation not found" : "Failed to fetch allocations" },
        { status: isNotFound ? 404 : 500 }
      );
    }

    const result = data as unknown as InventoryReservationAllocationsRpcResult;
    const total = toNumber(result.total);
    const response: InventoryReservationAllocationsResponse = {
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
    console.error("Unexpected inventory reservation allocations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "inventory_reservation_allocations",
  route: "/api/inventory-reservations/[id]/allocations",
});
