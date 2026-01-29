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
};

type ItemLocationFifoInput = {
  supabase: SupabaseClient;
  companyId: string;
  itemId: string;
  warehouseId: string;
  quantity: number;
  userId?: string | null;
};

const DEFAULT_LOCATION_CODE = "MAIN";

const parseNumber = (value: unknown) => {
  if (value == null) return 0;
  const num = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(num) ? num : 0;
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

  const { data: existing } = await supabase
    .from("item_location")
    .select("id, qty_on_hand, qty_reserved")
    .eq("company_id", companyId)
    .eq("item_id", itemId)
    .eq("warehouse_id", warehouseId)
    .eq("location_id", resolvedLocationId)
    .is("deleted_at", null)
    .maybeSingle();

  const currentOnHand = parseNumber(existing?.qty_on_hand);
  const currentReserved = parseNumber(existing?.qty_reserved);
  const nextOnHand = currentOnHand + qtyOnHandDelta;
  const nextReserved = currentReserved + qtyReservedDelta;

  if (nextOnHand < 0) {
    throw new Error("Insufficient on-hand quantity at the selected location.");
  }

  if (nextReserved < 0 || nextReserved > nextOnHand) {
    throw new Error("Invalid reserved quantity for the selected location.");
  }

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("item_location")
      .update({
        qty_on_hand: nextOnHand,
        qty_reserved: nextReserved,
        updated_by: userId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (updateError) {
      throw new Error(updateError.message);
    }
  } else {
    const { error: insertError } = await supabase.from("item_location").insert({
      company_id: companyId,
      item_id: itemId,
      warehouse_id: warehouseId,
      location_id: resolvedLocationId,
      qty_on_hand: nextOnHand,
      qty_reserved: nextReserved,
      created_by: userId ?? null,
      updated_by: userId ?? null,
    });

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  return resolvedLocationId;
};

export const consumeItemLocationsFIFO = async ({
  supabase,
  companyId,
  itemId,
  warehouseId,
  quantity,
  userId,
}: ItemLocationFifoInput) => {
  if (quantity <= 0) return [];

  const { data: locations, error } = await supabase
    .from("item_location")
    .select("id, location_id, qty_on_hand, qty_reserved, created_at")
    .eq("company_id", companyId)
    .eq("item_id", itemId)
    .eq("warehouse_id", warehouseId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  let remaining = quantity;
  const consumed: Array<{ locationId: string; quantity: number }> = [];

  for (const location of locations || []) {
    if (remaining <= 0) break;
    const onHand = parseNumber(location.qty_on_hand);
    const reserved = parseNumber(location.qty_reserved);
    const available = Math.max(0, onHand - reserved);
    if (available <= 0) continue;

    const takeQty = Math.min(available, remaining);
    await adjustItemLocation({
      supabase,
      companyId,
      itemId,
      warehouseId,
      locationId: location.location_id,
      userId,
      qtyOnHandDelta: -takeQty,
    });

    consumed.push({ locationId: location.location_id, quantity: takeQty });
    remaining -= takeQty;
  }

  if (remaining > 0) {
    throw new Error("Insufficient stock across locations for FIFO consumption.");
  }

  return consumed;
};
