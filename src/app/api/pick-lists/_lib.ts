import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { GRANULAR_CAPABILITIES } from "@/constants/granular-permissions";
import { canAccessCapability } from "@/services/permissions/permissionResolver";
import { getAuthContext } from "../delivery-notes/_lib";
import { notifyBusinessUnits } from "@/app/api/_lib/workflow-notifications";
import { fetchWarehouseLocationNamePaths } from "@/lib/warehouse-location-name-path";

type SupabaseClient = Awaited<ReturnType<typeof createServerClientWithBU>>["supabase"];

export type PickListStatus = "pending" | "in_progress" | "paused" | "cancelled" | "done";
export type BatchAllocationMode = "single_sufficient" | "split";

export type PickListRow = {
  id: string;
  company_id: string;
  business_unit_id: string | null;
  dn_id: string;
  pick_list_no: string;
  status: PickListStatus;
  notes: string | null;
  cancel_reason: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  deleted_at: string | null;
};

export const getPickListAuthContext = async () => {
  const auth = await getAuthContext();
  return auth;
};

export const isAssignedPickListScopeEnabled = (userId: string, businessUnitId: string | null) =>
  canAccessCapability(
    userId,
    GRANULAR_CAPABILITIES.PICK_LIST_VIEW_ONLY_ASSIGNED,
    "view",
    businessUnitId
  );

export const isPickListAssignee = async (
  supabase: SupabaseClient,
  companyId: string,
  pickListId: string,
  userId: string
) => {
  const { data } = await supabase
    .from("pick_list_assignees")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("pick_list_id", pickListId)
    .eq("user_id", userId)
    .maybeSingle();

  return data !== null;
};

type PickLocationRow = {
  id: string;
  code: string;
  name: string | null;
  path_ids: string[];
};

export const fetchPickList = async (supabase: SupabaseClient, companyId: string, id: string) => {
  const { data, error } = await supabase
    .from("pick_lists")
    .select(
      `
      id,
      company_id,
      business_unit_id,
      dn_id,
      pick_list_no,
      status,
      notes,
      cancel_reason,
      started_at,
      completed_at,
      created_by,
      created_at,
      updated_by,
      updated_at,
      deleted_at,
      delivery_notes(
        id,
        dn_no,
        status,
        requesting_business_unit_id,
        fulfilling_business_unit_id,
        requesting_warehouse_id,
        fulfilling_warehouse_id
      ),
      delivery_note_item_picks(
        id,
        company_id,
        dn_id,
        delivery_note_item_id,
        pick_list_item_id,
        pick_list_id,
        item_id,
        source_warehouse_id,
        picked_location_id,
        picked_batch_code,
        picked_batch_received_at,
        batch_location_sku,
        picked_qty,
        dispatched_qty,
        received_qty,
        reversed_qty,
        picker_user_id,
        picked_at,
        is_mismatch_warning_acknowledged,
        mismatch_reason,
        version,
        created_by,
        created_at,
        updated_by,
        updated_at,
        deleted_at
      ),
      pick_list_items(
        id,
        company_id,
        pick_list_id,
        dn_item_id,
        sr_id,
        sr_item_id,
        item_id,
        item_unit_option_id,
        uom_id,
        allocated_qty,
        picked_qty,
        short_qty,
        suggested_pick_location_id,
        suggested_pick_batch_code,
        suggested_pick_batch_received_at,
        suggested_batch_location_sku,
        created_at,
        updated_at,
        item_unit_options!pick_list_items_item_unit_option_id_fkey(
          id,
          item_id,
          uom_id,
          option_label,
          qty_per_unit,
          barcode,
          is_base,
          is_default,
          is_active,
          sort_order,
          units_of_measure(
            id,
            code,
            name,
            symbol
          )
        ),
        delivery_note_items!pick_list_items_dn_item_id_fkey(
          id
        ),
        suggested_pick_location:warehouse_locations!pick_list_items_suggested_pick_location_id_fkey(
          id,
          warehouse_id,
          code,
          name,
          location_path,
          path_ids,
          warehouse:warehouses!warehouse_locations_warehouse_id_fkey(
            id,
            warehouse_code
          )
        ),
        items!pick_list_items_item_id_fkey(item_name, item_code),
        units_of_measure!pick_list_items_uom_id_fkey(code, symbol, name)
      ),
      pick_list_assignees(
        company_id,
        pick_list_id,
        user_id,
        assigned_at,
        assigned_by,
        users:users!pick_list_assignees_user_id_fkey(id, email, first_name, last_name)
      ),
      pick_list_item_claims(
        pick_list_item_id,
        claimed_by,
        claimed_at,
        expires_at,
        released_at,
        users:users!pick_list_item_claims_claimed_by_fkey(id, email, first_name, last_name)
      )
    `
    )
    .eq("id", id)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .single();

  if (error || !data) return null;

  // Pickers show names-only addresses; codes stay in location_path for sorting and scanning.
  const items = (data.pick_list_items ?? []).map(({ suggested_pick_location, ...item }) => ({
    item,
    // The untyped client reports this to-one embed as an array.
    location: (Array.isArray(suggested_pick_location)
      ? (suggested_pick_location[0] ?? null)
      : (suggested_pick_location ?? null)) as unknown as PickLocationRow | null,
  }));
  const locations = items.flatMap(({ location }) => (location ? [location] : []));
  const { data: namePaths, error: namePathError } = await fetchWarehouseLocationNamePaths(
    supabase,
    companyId,
    locations
  );
  if (namePathError) {
    console.error("Failed to fetch pick list location names:", namePathError);
    throw new Error("Failed to fetch pick list location names");
  }

  return mapPickListRecord({
    ...data,
    pick_list_items: items.map(({ item, location }) => ({
      ...item,
      suggested_pick_location: location
        ? { ...location, location_name_path: namePaths.get(location.id) ?? location.code }
        : null,
    })),
  } as Record<string, unknown>);
};

export const mapPickListRecord = <T extends Record<string, unknown>>(record: T) => {
  const deliveryNoteRaw = record.delivery_notes as
    | {
        id: string;
        dn_no: string;
        status: string;
        requesting_business_unit_id: string;
        fulfilling_business_unit_id: string;
        requesting_warehouse_id: string | null;
        fulfilling_warehouse_id: string;
      }
    | Array<{
        id: string;
        dn_no: string;
        status: string;
        requesting_business_unit_id: string;
        fulfilling_business_unit_id: string;
        requesting_warehouse_id: string | null;
        fulfilling_warehouse_id: string;
      }>
    | null
    | undefined;
  const deliveryNote = Array.isArray(deliveryNoteRaw)
    ? (deliveryNoteRaw[0] ?? null)
    : (deliveryNoteRaw ?? null);

  return {
    ...record,
    delivery_notes: deliveryNote
      ? {
          ...deliveryNote,
          requesting_warehouse_id: deliveryNote.requesting_warehouse_id,
          fulfilling_warehouse_id: deliveryNote.fulfilling_warehouse_id,
        }
      : null,
  };
};

export const fetchPickListHeader = async (
  supabase: SupabaseClient,
  companyId: string,
  id: string
) => {
  const { data } = await supabase
    .from("pick_lists")
    .select(
      "id, company_id, business_unit_id, dn_id, pick_list_no, status, notes, cancel_reason, started_at, completed_at, created_by, created_at, updated_by, updated_at, deleted_at"
    )
    .eq("id", id)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .single();

  return (data as PickListRow | null) ?? null;
};

export const notifyPickListReadyForDispatch = async (
  supabase: SupabaseClient,
  companyId: string,
  actorUserId: string,
  pickList: PickListRow
) => {
  const { data: dnDetails, error: dnDetailsError } = await supabase
    .from("delivery_notes")
    .select("id, dn_no, requesting_business_unit_id, fulfilling_business_unit_id")
    .eq("id", pickList.dn_id)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .single();

  if (dnDetailsError || !dnDetails) {
    throw new Error(dnDetailsError?.message || "Delivery note details not found");
  }

  await notifyBusinessUnits({
    supabase,
    companyId,
    actorUserId,
    businessUnitIds: [dnDetails.requesting_business_unit_id, dnDetails.fulfilling_business_unit_id],
    title: "Ready for dispatch",
    message: `Delivery note ${dnDetails.dn_no} is ready for dispatch.`,
    type: "delivery_note_workflow",
    metadata: {
      delivery_note_id: dnDetails.id,
      dn_no: dnDetails.dn_no,
      pick_list_id: pickList.id,
      pick_list_status: "done",
      status: "dispatch_ready",
    },
  });
};

type CreatePickListForDnArgs = {
  supabase: SupabaseClient;
  companyId: string;
  userId: string;
  currentBusinessUnitId: string | null;
  dnId: string;
  dnBusinessUnitId: string | null;
  fulfillingWarehouseId: string;
  pickerUserIds: string[];
  notes?: string | null;
  batchAllocationMode?: BatchAllocationMode | null;
  locationScopeId?: string | null;
};

export const createPickListForDn = async ({
  supabase,
  companyId,
  userId,
  currentBusinessUnitId,
  dnId,
  dnBusinessUnitId,
  fulfillingWarehouseId,
  pickerUserIds,
  notes,
  batchAllocationMode,
  locationScopeId,
}: CreatePickListForDnArgs) => {
  const uniquePickers = Array.from(new Set(pickerUserIds.map((id) => id.trim()).filter(Boolean)));
  if (uniquePickers.length === 0) {
    throw new Error("At least one picker must be assigned");
  }

  void dnBusinessUnitId;
  void fulfillingWarehouseId;

  const { data, error } = await supabase.rpc("create_pick_list_with_allocation", {
    p_company_id: companyId,
    p_user_id: userId,
    p_dn_id: dnId,
    p_picker_user_ids: uniquePickers,
    p_notes: notes?.trim() || null,
    p_current_business_unit_id: currentBusinessUnitId,
    p_batch_allocation_mode: batchAllocationMode || null,
    p_location_scope_id: locationScopeId || null,
  });

  if (error) {
    throw new Error(error.message || "Failed to create pick list");
  }

  const result = data as { pickListId?: unknown; pickListNo?: unknown } | null;
  const pickListId = typeof result?.pickListId === "string" ? result.pickListId : "";
  const pickListNo = typeof result?.pickListNo === "string" ? result.pickListNo : "";
  if (!pickListId) {
    throw new Error("Failed to create pick list");
  }

  return {
    pickListId,
    pickListNo,
  };
};

export const ensurePickListActorAuthorized = async (
  supabase: SupabaseClient,
  companyId: string,
  businessUnitId: string | null,
  pickListId: string,
  userId: string
) => {
  const [assignedOnly, assignee] = await Promise.all([
    isAssignedPickListScopeEnabled(userId, businessUnitId),
    isPickListAssignee(supabase, companyId, pickListId, userId),
  ]);
  if (assignedOnly && !assignee) {
    return {
      ok: false,
      error: "Only assigned pickers can perform this action",
    } as const;
  }
  return { ok: true } as const;
};
