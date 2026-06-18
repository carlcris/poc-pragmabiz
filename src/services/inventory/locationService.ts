import type { SupabaseClient } from "@supabase/supabase-js";

type WarehouseLocationInput = {
  supabase: SupabaseClient;
  companyId: string;
  warehouseId: string;
  userId?: string | null;
};

type ItemLocationInput = {
  supabase: SupabaseClient;
  companyId: string;
  itemId: string;
  warehouseId: string;
  locationId?: string | null;
  userId?: string | null;
};

type ItemLocationAdjustment = ItemLocationInput & {
  qtyOnHandDelta?: number;
  qtyReservedDelta?: number;
  batchCode?: string;
  receivedAt?: string;
};

type ItemLocationFifoInput = {
  supabase: SupabaseClient;
  companyId: string;
  itemId: string;
  warehouseId: string;
  locationId?: string | null;
  quantity: number;
  userId?: string | null;
};

const DEFAULT_LOCATION_CODE = "MAIN";
const UNTRACKED_BATCH_CODE = "UNTRACKED";

const parseNumber = (value: unknown) => {
  if (value == null) return 0;
  const num = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(num) ? num : 0;
};

const one = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

export const getItemLocationOnHand = async ({
  supabase,
  companyId,
  itemId,
  warehouseId,
  locationId,
}: ItemLocationInput) => {
  const resolvedLocationId = locationId
    ? locationId
    : await resolveItemLocationId({ supabase, companyId, itemId, warehouseId });

  const { data, error } = await supabase
    .from("item_batch_locations")
    .select("qty_on_hand")
    .eq("company_id", companyId)
    .eq("item_id", itemId)
    .eq("warehouse_id", warehouseId)
    .eq("location_id", resolvedLocationId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).reduce((sum, row) => sum + parseNumber(row.qty_on_hand), 0);
};

const increaseItemBatchLocation = async ({
  supabase,
  companyId,
  itemId,
  warehouseId,
  locationId,
  quantity,
  userId,
  batchCode = UNTRACKED_BATCH_CODE,
  receivedAt,
}: ItemLocationFifoInput & {
  batchCode?: string;
  receivedAt?: string;
}) => {
  if (quantity <= 0) return;

  const { data: existingBatch, error: existingBatchError } = await supabase
    .from("item_batches")
    .select("id, qty_on_hand")
    .eq("company_id", companyId)
    .eq("item_id", itemId)
    .eq("warehouse_id", warehouseId)
    .eq("batch_code", batchCode)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingBatchError) {
    throw new Error(existingBatchError.message);
  }

  let itemBatchId = existingBatch?.id ?? null;

  if (existingBatch) {
    const { error: updateBatchError } = await supabase
      .from("item_batches")
      .update({
        qty_on_hand: parseNumber(existingBatch.qty_on_hand) + quantity,
        updated_by: userId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingBatch.id);

    if (updateBatchError) {
      throw new Error(updateBatchError.message);
    }
  } else {
    const { data: insertedBatch, error: insertBatchError } = await supabase
      .from("item_batches")
      .insert({
        company_id: companyId,
        item_id: itemId,
        warehouse_id: warehouseId,
        batch_code: batchCode,
        received_at: receivedAt ?? new Date().toISOString(),
        qty_on_hand: quantity,
        qty_reserved: 0,
        created_by: userId ?? null,
        updated_by: userId ?? null,
      })
      .select("id")
      .single();

    if (insertBatchError || !insertedBatch) {
      throw new Error(insertBatchError?.message || "Failed to create item batch.");
    }

    itemBatchId = insertedBatch.id;
  }

  const { data: existingLocationBatch, error: existingLocationBatchError } = await supabase
    .from("item_batch_locations")
    .select("id, qty_on_hand")
    .eq("company_id", companyId)
    .eq("item_id", itemId)
    .eq("warehouse_id", warehouseId)
    .eq("location_id", locationId)
    .eq("item_batch_id", itemBatchId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingLocationBatchError) {
    throw new Error(existingLocationBatchError.message);
  }

  if (existingLocationBatch) {
    const { error: updateLocationBatchError } = await supabase
      .from("item_batch_locations")
      .update({
        qty_on_hand: parseNumber(existingLocationBatch.qty_on_hand) + quantity,
        updated_by: userId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingLocationBatch.id);

    if (updateLocationBatchError) {
      throw new Error(updateLocationBatchError.message);
    }

    return;
  }

  const { error: insertLocationBatchError } = await supabase.from("item_batch_locations").insert({
    company_id: companyId,
    item_id: itemId,
    warehouse_id: warehouseId,
    location_id: locationId,
    item_batch_id: itemBatchId,
    qty_on_hand: quantity,
    qty_reserved: 0,
    created_by: userId ?? null,
    updated_by: userId ?? null,
  });

  if (insertLocationBatchError) {
    throw new Error(insertLocationBatchError.message);
  }
};

export const ensureWarehouseDefaultLocation = async ({
  supabase,
  companyId,
  warehouseId,
  userId,
}: WarehouseLocationInput) => {
  const { data: existing } = await supabase
    .from("warehouse_locations")
    .select("id")
    .eq("company_id", companyId)
    .eq("warehouse_id", warehouseId)
    .eq("code", DEFAULT_LOCATION_CODE)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing?.id) {
    return existing.id;
  }

  const { data: created, error: insertError } = await supabase
    .from("warehouse_locations")
    .insert({
      company_id: companyId,
      warehouse_id: warehouseId,
      code: DEFAULT_LOCATION_CODE,
      name: "Main",
      location_type: "bin",
      is_pickable: true,
      is_storable: true,
      is_active: true,
      created_by: userId ?? null,
      updated_by: userId ?? null,
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return created.id;
};

export const resolveItemLocationId = async ({
  supabase,
  companyId,
  itemId,
  warehouseId,
  locationId,
  userId,
}: ItemLocationInput) => {
  if (locationId) return locationId;

  const { data: itemWarehouse } = await supabase
    .from("item_warehouse")
    .select("id, default_location_id")
    .eq("company_id", companyId)
    .eq("item_id", itemId)
    .eq("warehouse_id", warehouseId)
    .is("deleted_at", null)
    .maybeSingle();

  if (itemWarehouse?.default_location_id) {
    return itemWarehouse.default_location_id;
  }

  const defaultLocationId = await ensureWarehouseDefaultLocation({
    supabase,
    companyId,
    warehouseId,
    userId,
  });

  if (itemWarehouse?.id) {
    await supabase
      .from("item_warehouse")
      .update({
        default_location_id: defaultLocationId,
        updated_by: userId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemWarehouse.id);
  }

  return defaultLocationId;
};

export const adjustItemLocation = async ({
  supabase,
  companyId,
  itemId,
  warehouseId,
  locationId,
  userId,
  qtyOnHandDelta = 0,
  qtyReservedDelta = 0,
  batchCode,
  receivedAt,
}: ItemLocationAdjustment) => {
  const resolvedLocationId = await resolveItemLocationId({
    supabase,
    companyId,
    itemId,
    warehouseId,
    locationId,
    userId,
  });

  if (qtyOnHandDelta === 0 && qtyReservedDelta === 0) {
    return resolvedLocationId;
  }

  if (qtyReservedDelta !== 0) {
    throw new Error("Reserved quantity adjustments must be applied at the batch-location layer.");
  }

  if (qtyOnHandDelta > 0) {
    await increaseItemBatchLocation({
      supabase,
      companyId,
      itemId,
      warehouseId,
      locationId: resolvedLocationId,
      quantity: qtyOnHandDelta,
      userId,
      batchCode,
      receivedAt,
    });
  } else {
    await consumeItemLocationsFIFO({
      supabase,
      companyId,
      itemId,
      warehouseId,
      locationId: resolvedLocationId,
      quantity: Math.abs(qtyOnHandDelta),
      userId,
    });
  }

  return resolvedLocationId;
};

export const consumeItemLocationsFIFO = async ({
  supabase,
  companyId,
  itemId,
  warehouseId,
  locationId,
  quantity,
  userId,
}: ItemLocationFifoInput) => {
  if (quantity <= 0) return [];

  let query = supabase
    .from("item_batch_locations")
    .select(
      `
      id,
      location_id,
      qty_on_hand,
      qty_reserved,
      created_at,
      item_batch:item_batches!item_batch_locations_item_batch_id_fkey(
        id,
        qty_on_hand,
        received_at
      )
    `
    )
    .eq("company_id", companyId)
    .eq("item_id", itemId)
    .eq("warehouse_id", warehouseId)
    .is("deleted_at", null);

  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  const { data: locations, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  let remaining = quantity;
  const consumed: Array<{ locationId: string; quantity: number }> = [];
  const nextItemBatchQtyById = new Map<string, number>();

  const sortedLocations = (locations || [])
    .map((location) => {
      const itemBatch = one(location.item_batch);
      return {
        id: location.id,
        locationId: location.location_id,
        qtyOnHand: parseNumber(location.qty_on_hand),
        qtyReserved: parseNumber(location.qty_reserved),
        createdAt: location.created_at,
        itemBatch,
      };
    })
    .filter((location) => location.itemBatch?.id)
    .sort((left, right) => {
      const leftReceivedAt = new Date(String(left.itemBatch?.received_at || 0)).getTime();
      const rightReceivedAt = new Date(String(right.itemBatch?.received_at || 0)).getTime();
      if (leftReceivedAt !== rightReceivedAt) return leftReceivedAt - rightReceivedAt;
      return String(left.createdAt || "").localeCompare(String(right.createdAt || ""));
    });

  for (const location of sortedLocations) {
    if (remaining <= 0) break;
    const available = Math.max(0, location.qtyOnHand - location.qtyReserved);
    if (available <= 0) continue;

    const takeQty = Math.min(available, remaining);
    const itemBatchId = String(location.itemBatch?.id);
    const currentItemBatchQty =
      nextItemBatchQtyById.get(itemBatchId) ?? parseNumber(location.itemBatch?.qty_on_hand);
    const nextLocationQty = location.qtyOnHand - takeQty;
    const nextItemBatchQty = currentItemBatchQty - takeQty;

    if (nextItemBatchQty < 0) {
      throw new Error("Insufficient batch stock for FIFO consumption.");
    }

    const { error: updateLocationBatchError } = await supabase
      .from("item_batch_locations")
      .update({
        qty_on_hand: nextLocationQty,
        updated_by: userId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", location.id);

    if (updateLocationBatchError) {
      throw new Error(updateLocationBatchError.message);
    }

    const { error: updateItemBatchError } = await supabase
      .from("item_batches")
      .update({
        qty_on_hand: nextItemBatchQty,
        updated_by: userId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemBatchId);

    if (updateItemBatchError) {
      throw new Error(updateItemBatchError.message);
    }

    nextItemBatchQtyById.set(itemBatchId, nextItemBatchQty);

    consumed.push({ locationId: location.locationId, quantity: takeQty });
    remaining -= takeQty;
  }

  if (remaining > 0) {
    throw new Error("Insufficient stock across locations for FIFO consumption.");
  }

  return consumed;
};
