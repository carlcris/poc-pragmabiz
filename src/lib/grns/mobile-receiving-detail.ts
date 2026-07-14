import type { RequestContext } from "@/lib/auth/requestContext";

const MAX_GRN_RECEIVING_ITEMS = 500;

type SupabaseClient = RequestContext["supabase"];

type RelatedOne<T> = T | T[] | null;

type GrnReceivingItemRecord = {
  id: string;
  item_id: string;
  load_list_item_id: string | null;
  item_unit_option_id: string | null;
  unit_name: string;
  qty_per_unit: number;
  load_list_qty: number;
  received_qty: number;
  damaged_qty: number;
  num_boxes: number | null;
  notes: string | null;
  item: RelatedOne<{
    id: string;
    item_code: string;
    item_name: string;
  }>;
};

type GrnReceivingRecord = {
  id: string;
  grn_number: string;
  load_list_id: string;
  company_id: string;
  business_unit_id: string;
  receiving_date: string;
  delivery_date: string;
  status: string;
  notes: string | null;
  items: Array<GrnReceivingItemRecord & { expected_base_qty: number }>;
};

type LoadListReceivingRecord = {
  id: string;
  ll_number: string;
  supplier_ll_number: string | null;
  status: string;
  estimated_arrival_date: string | null;
  actual_arrival_date: string | null;
  container_number: string | null;
  seal_number: string | null;
  batch_number: string | null;
  warehouse_id: string;
  supplier: RelatedOne<{
    id: string;
    supplier_name: string;
  }>;
  warehouse: RelatedOne<{
    id: string;
    warehouse_name: string;
    business_unit_id: string;
  }>;
  item_count: number;
};

const one = <T>(value: RelatedOne<T>): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : value;

const toNumber = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export async function fetchMobileGrnReceivingRecord({
  supabase,
  companyId,
  currentBusinessUnitId,
  grnId,
  loadListId,
}: {
  supabase: SupabaseClient;
  companyId: string;
  currentBusinessUnitId: string | null;
  grnId?: string;
  loadListId?: string;
}): Promise<GrnReceivingRecord | null> {
  if (!grnId && !loadListId) return null;

  let query = supabase
    .from("grns")
    .select(
      "id, grn_number, load_list_id, company_id, business_unit_id, receiving_date, delivery_date, status, notes, created_at"
    )
    .eq("company_id", companyId)
    .is("deleted_at", null);

  query = grnId ? query.eq("id", grnId) : query.eq("load_list_id", loadListId as string);

  const { data: grn, error: grnError } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (grnError) throw new Error("Failed to load GRN receiving detail");
  if (!grn || !currentBusinessUnitId || grn.business_unit_id !== currentBusinessUnitId) return null;

  const { data: items, error: itemsError } = await supabase
    .from("grn_items")
    .select(
      "id, item_id, load_list_item_id, item_unit_option_id, unit_name, qty_per_unit, load_list_qty, received_qty, damaged_qty, num_boxes, notes, created_at, item:items!grn_items_item_id_fkey(id, item_code, item_name)"
    )
    .eq("grn_id", grn.id)
    .order("created_at", { ascending: true })
    .limit(MAX_GRN_RECEIVING_ITEMS + 1);

  if (itemsError) throw new Error("Failed to load GRN receiving items");
  if ((items?.length ?? 0) > MAX_GRN_RECEIVING_ITEMS) {
    throw new Error("GRN receiving detail exceeds the supported item limit");
  }

  return {
    id: grn.id,
    grn_number: grn.grn_number,
    load_list_id: grn.load_list_id,
    company_id: grn.company_id,
    business_unit_id: grn.business_unit_id,
    receiving_date: grn.receiving_date,
    delivery_date: grn.delivery_date,
    status: grn.status,
    notes: grn.notes,
    items: (items ?? []).map((item) => ({
      ...item,
      expected_base_qty: toNumber(item.load_list_qty) * toNumber(item.qty_per_unit),
    })) as GrnReceivingRecord["items"],
  };
}

export async function fetchMobileLoadListReceivingDetail({
  supabase,
  companyId,
  currentBusinessUnitId,
  loadListId,
  includeGrn,
}: {
  supabase: SupabaseClient;
  companyId: string;
  currentBusinessUnitId: string | null;
  loadListId: string;
  includeGrn: boolean;
}): Promise<{ loadList: LoadListReceivingRecord; grn: GrnReceivingRecord | null } | null> {
  const [loadListResult, grn] = await Promise.all([
    supabase
      .from("load_lists")
      .select(
        "id, ll_number, supplier_ll_number, status, estimated_arrival_date, actual_arrival_date, container_number, seal_number, batch_number, warehouse_id, supplier:suppliers(id, supplier_name), warehouse:warehouses(id, warehouse_name, business_unit_id)"
      )
      .eq("id", loadListId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .maybeSingle(),
    includeGrn
      ? fetchMobileGrnReceivingRecord({
          supabase,
          companyId,
          currentBusinessUnitId,
          loadListId,
        })
      : Promise.resolve(null),
  ]);

  if (loadListResult.error) throw new Error("Failed to load load list receiving detail");
  if (!loadListResult.data || !currentBusinessUnitId) return null;

  const warehouse = one(loadListResult.data.warehouse);
  if (warehouse?.business_unit_id !== currentBusinessUnitId) return null;

  const supplier = one(loadListResult.data.supplier);
  return {
    loadList: {
      id: loadListResult.data.id,
      ll_number: loadListResult.data.ll_number,
      supplier_ll_number: loadListResult.data.supplier_ll_number,
      status: loadListResult.data.status,
      estimated_arrival_date: loadListResult.data.estimated_arrival_date,
      actual_arrival_date: loadListResult.data.actual_arrival_date,
      container_number: loadListResult.data.container_number,
      seal_number: loadListResult.data.seal_number,
      batch_number: loadListResult.data.batch_number,
      warehouse_id: loadListResult.data.warehouse_id,
      supplier,
      warehouse,
      item_count: grn?.items.length ?? 0,
    },
    grn,
  };
}
