import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

type BatchLocationRow = {
  id: string;
  item_id: string;
  warehouse_id: string;
  location_id: string;
  qty_on_hand: number | string | null;
  qty_reserved: number | string | null;
  qty_available: number | string | null;
  item_batch?:
    | {
        id: string;
        batch_code: string;
        received_at: string;
      }
    | {
        id: string;
        batch_code: string;
        received_at: string;
      }[]
    | null;
  warehouse?:
    | {
        id: string;
        warehouse_code: string | null;
        warehouse_name: string | null;
        business_unit_id: string | null;
        company_id: string | null;
        deleted_at: string | null;
      }
    | {
        id: string;
        warehouse_code: string | null;
        warehouse_name: string | null;
        business_unit_id: string | null;
        company_id: string | null;
        deleted_at: string | null;
      }[]
    | null;
  location?:
    | {
        id: string;
        code: string | null;
        name: string | null;
        location_type: string | null;
        company_id: string | null;
        deleted_at: string | null;
      }
    | {
        id: string;
        code: string | null;
        name: string | null;
        location_type: string | null;
        company_id: string | null;
        deleted_at: string | null;
      }[]
    | null;
};

const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const one = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

// GET /api/items/[id]/locations - List item quantities by warehouse location
async function GETHandler(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requireAnyPermission([
      [RESOURCES.VIEW_LOCATION_STOCK, "view"],
      [RESOURCES.ITEMS, "view"],
    ]);
    if (unauthorized) return unauthorized;

    const { id } = await params;
    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    let warehouseScopeQuery = supabase
      .from("warehouses")
      .select("id")
      .eq("company_id", userData.company_id)
      .is("deleted_at", null);

    if (currentBusinessUnitId) {
      warehouseScopeQuery = warehouseScopeQuery.eq("business_unit_id", currentBusinessUnitId);
    }

    const { data: warehouseScopeRows, error: warehouseScopeError } = await warehouseScopeQuery;

    if (warehouseScopeError) {
      console.error("Failed to resolve warehouse scope for item locations", warehouseScopeError);
      return NextResponse.json({ error: "Failed to fetch item locations" }, { status: 500 });
    }

    const warehouseScopeIds = (warehouseScopeRows || []).map((warehouse) => warehouse.id);
    if (warehouseScopeIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const batchLocationQuery = supabase
      .from("item_batch_locations")
      .select(
        `
        id,
        item_id,
        warehouse_id,
        location_id,
        qty_on_hand,
        qty_reserved,
        qty_available,
        item_batch:item_batches!item_batch_locations_item_batch_id_fkey(
          id,
          batch_code,
          received_at
        ),
        warehouse:warehouses!item_batch_locations_warehouse_id_fkey(
          id,
          warehouse_code,
          warehouse_name,
          business_unit_id,
          company_id,
          deleted_at
        ),
        location:warehouse_locations!item_batch_locations_location_id_fkey(
          id,
          code,
          name,
          location_type,
          company_id,
          deleted_at
        )
      `
      )
      .eq("company_id", userData.company_id)
      .eq("item_id", id)
      .is("deleted_at", null)
      .in("warehouse_id", warehouseScopeIds)
      .order("warehouse_id");

    const { data, error } = await batchLocationQuery;

    if (error) {
      console.error("Failed to fetch item locations", error);
      return NextResponse.json({ error: "Failed to fetch item locations" }, { status: 500 });
    }

    const batchRows = (data || []) as BatchLocationRow[];
    const warehouseIds = Array.from(new Set(batchRows.map((row) => row.warehouse_id)));

    const { data: itemWarehouses } =
      warehouseIds.length > 0
        ? await supabase
            .from("item_warehouse")
            .select(
              "warehouse_id, default_location_id, max_quantity, in_transit, estimated_arrival_date"
            )
            .eq("company_id", userData.company_id)
            .eq("item_id", id)
            .in("warehouse_id", warehouseIds)
            .is("deleted_at", null)
        : { data: [] };

    const defaultLocationMap = new Map(
      (itemWarehouses || []).map((row) => [row.warehouse_id, row.default_location_id])
    );
    const inTransitMap = new Map(
      (itemWarehouses || []).map((row) => [row.warehouse_id, Number(row.in_transit || 0)])
    );
    const maxQuantityMap = new Map(
      (itemWarehouses || []).map((row) => [
        row.warehouse_id,
        row.max_quantity == null ? null : Number(row.max_quantity),
      ])
    );
    const estimatedArrivalMap = new Map(
      (itemWarehouses || []).map((row) => [row.warehouse_id, row.estimated_arrival_date || null])
    );

    const locationsByKey = new Map<
      string,
      {
        id: string;
        itemId: string;
        warehouseId: string;
        locationId: string;
        warehouseCode: string;
        warehouseName: string;
        locationCode: string;
        locationName: string;
        locationType: string;
        qtyOnHand: number;
        qtyReserved: number;
        qtyAvailable: number;
        maxQuantity: number | null;
        inTransit: number;
        estimatedArrivalDate: string | null;
        isDefault: boolean;
        defaultLocationId: string | null;
        batches: Array<{
          id: string;
          batchCode: string;
          receivedAt: string;
          qtyOnHand: number;
          qtyReserved: number;
          qtyAvailable: number;
        }>;
      }
    >();

    batchRows.forEach((row) => {
      const defaultLocationId = defaultLocationMap.get(row.warehouse_id) || null;
      const warehouse = one(row.warehouse);
      const location = one(row.location);
      const itemBatch = one(row.item_batch);
      if (
        warehouse?.company_id !== userData.company_id ||
        !!warehouse?.deleted_at ||
        location?.company_id !== userData.company_id ||
        !!location?.deleted_at
      ) {
        return;
      }

      const key = `${row.warehouse_id}:${row.location_id}`;
      const existing = locationsByKey.get(key) ?? {
        id: key,
        itemId: row.item_id,
        warehouseId: row.warehouse_id,
        locationId: row.location_id,
        warehouseCode: warehouse?.warehouse_code || "",
        warehouseName: warehouse?.warehouse_name || "",
        locationCode: location?.code || "",
        locationName: location?.name || "",
        locationType: location?.location_type || "",
        qtyOnHand: 0,
        qtyReserved: 0,
        qtyAvailable: 0,
        maxQuantity: maxQuantityMap.get(row.warehouse_id) ?? null,
        inTransit: inTransitMap.get(row.warehouse_id) || 0,
        estimatedArrivalDate: estimatedArrivalMap.get(row.warehouse_id) || null,
        isDefault: defaultLocationId === row.location_id,
        defaultLocationId,
        batches: [] as Array<{
          id: string;
          batchCode: string;
          receivedAt: string;
          qtyOnHand: number;
          qtyReserved: number;
          qtyAvailable: number;
        }>,
      };

      existing.qtyOnHand += toNumber(row.qty_on_hand);
      existing.qtyReserved += toNumber(row.qty_reserved);
      existing.qtyAvailable += toNumber(row.qty_available);

      if (itemBatch) {
        existing.batches.push({
          id: row.id,
          batchCode: itemBatch.batch_code,
          receivedAt: itemBatch.received_at,
          qtyOnHand: toNumber(row.qty_on_hand),
          qtyReserved: toNumber(row.qty_reserved),
          qtyAvailable: toNumber(row.qty_available),
        });
      }

      locationsByKey.set(key, existing);
    });

    const locations = Array.from(locationsByKey.values()).map((location) => ({
      ...location,
      batches: location.batches.sort(
        (left, right) => new Date(left.receivedAt).getTime() - new Date(right.receivedAt).getTime()
      ),
    }));

    return NextResponse.json({ data: locations });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "items",
  route: "/api/items/[id]/locations",
});
