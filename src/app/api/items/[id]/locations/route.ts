import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

// GET /api/items/[id]/locations - List item quantities by warehouse location
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    let itemLocationQuery = supabase
      .from("item_location")
      .select(
        `
        id,
        item_id,
        warehouse_id,
        location_id,
        qty_on_hand,
        qty_reserved,
        qty_available,
        warehouses!inner(
          id,
          warehouse_code,
          warehouse_name,
          business_unit_id,
          company_id,
          deleted_at
        ),
        warehouse_locations!inner(
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
      .eq("warehouses.company_id", userData.company_id)
      .eq("warehouse_locations.company_id", userData.company_id)
      .is("warehouses.deleted_at", null)
      .is("warehouse_locations.deleted_at", null)
      .order("warehouse_id");

    // Restrict item locations to warehouses in the current BU scope when context is available.
    if (currentBusinessUnitId) {
      itemLocationQuery = itemLocationQuery.eq(
        "warehouses.business_unit_id",
        currentBusinessUnitId
      );
    }

    const { data, error } = await itemLocationQuery;

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch item locations", details: error.message },
        { status: 500 }
      );
    }

    const warehouseIds = Array.from(new Set((data || []).map((row) => row.warehouse_id)));
    const locationIds = Array.from(new Set((data || []).map((row) => row.location_id)));

    // Fetch batch information only for the BU-scoped warehouses/locations above.
    const { data: batchData } =
      warehouseIds.length > 0 && locationIds.length > 0
        ? await supabase
            .from("item_location_batch")
            .select(
              `
              id,
              location_id,
              qty_on_hand,
              qty_reserved,
              qty_available,
              item_batch:item_batch!item_location_batch_item_batch_id_fkey(
                id,
                batch_code,
                received_at
              )
            `
            )
            .eq("company_id", userData.company_id)
            .eq("item_id", id)
            .in("warehouse_id", warehouseIds)
            .in("location_id", locationIds)
            .is("deleted_at", null)
            .order("item_batch(received_at)", { ascending: true })
            .order("location_id", { ascending: true })
        : { data: [] };

    const { data: itemWarehouses } =
      warehouseIds.length > 0
        ? await supabase
            .from("item_warehouse")
            .select("warehouse_id, default_location_id, in_transit, estimated_arrival_date")
            .eq("company_id", userData.company_id)
            .eq("item_id", id)
            .in("warehouse_id", warehouseIds)
            .is("deleted_at", null)
        : { data: [] };

    const defaultLocationMap = new Map(
      (itemWarehouses || []).map((row) => [row.warehouse_id, row.default_location_id])
    );
    const inTransitMap = new Map(
      (itemWarehouses || []).map((row) => [
        row.warehouse_id,
        Number(row.in_transit || 0),
      ])
    );
    const estimatedArrivalMap = new Map(
      (itemWarehouses || []).map((row) => [row.warehouse_id, row.estimated_arrival_date || null])
    );

    // Group batches by location
    const batchesByLocation = new Map<string, Array<{
      id: string;
      batchCode: string;
      receivedAt: string;
      qtyOnHand: number;
      qtyReserved: number;
      qtyAvailable: number;
    }>>();

    (batchData || []).forEach((batch) => {
      const locationBatches = batchesByLocation.get(batch.location_id) || [];
      const itemBatch = Array.isArray(batch.item_batch) ? batch.item_batch[0] : batch.item_batch;

      if (itemBatch) {
        locationBatches.push({
          id: batch.id,
          batchCode: itemBatch.batch_code,
          receivedAt: itemBatch.received_at,
          qtyOnHand: Number(batch.qty_on_hand) || 0,
          qtyReserved: Number(batch.qty_reserved) || 0,
          qtyAvailable: Number(batch.qty_available) || 0,
        });
      }

      batchesByLocation.set(batch.location_id, locationBatches);
    });

    const locations = (data || []).map((row) => {
      const defaultLocationId = defaultLocationMap.get(row.warehouse_id) || null;
      const warehouse = Array.isArray(row.warehouses) ? row.warehouses[0] : row.warehouses;
      const location = Array.isArray(row.warehouse_locations)
        ? row.warehouse_locations[0]
        : row.warehouse_locations;
      const batches = batchesByLocation.get(row.location_id) || [];

      return {
        id: row.id,
        itemId: row.item_id,
        warehouseId: row.warehouse_id,
        locationId: row.location_id,
        warehouseCode: warehouse?.warehouse_code || "",
        warehouseName: warehouse?.warehouse_name || "",
        locationCode: location?.code || "",
        locationName: location?.name || "",
        locationType: location?.location_type || "",
        qtyOnHand: Number(row.qty_on_hand) || 0,
        qtyReserved: Number(row.qty_reserved) || 0,
        qtyAvailable: Number(row.qty_available) || 0,
        inTransit: inTransitMap.get(row.warehouse_id) || 0,
        estimatedArrivalDate: estimatedArrivalMap.get(row.warehouse_id) || null,
        isDefault: defaultLocationId === row.location_id,
        defaultLocationId,
        batches,
      };
    });

    return NextResponse.json({ data: locations });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
