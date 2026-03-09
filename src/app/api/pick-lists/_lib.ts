import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { checkPermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { getAuthContext } from "../delivery-notes/_lib";

type SupabaseClient = Awaited<ReturnType<typeof createServerClientWithBU>>["supabase"];

export type PickListStatus = "pending" | "in_progress" | "paused" | "cancelled" | "done";

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

export const buildPickListNo = () => {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0].replace(/-/g, "");
  const suffix = now.getTime().toString().slice(-5);
  return `PL-${dateStr}${suffix}`;
};

export const getPickListAuthContext = async () => {
  const auth = await getAuthContext();
  return auth;
};

export const fetchPickList = async (supabase: SupabaseClient, companyId: string, id: string) => {
  const { data, error } = await supabase
    .from("pick_lists")
    .select(
      `
      *,
      delivery_notes(id, dn_no, status, requesting_warehouse_id, fulfilling_warehouse_id),
      delivery_note_item_picks(*),
      pick_list_items(
        *,
        delivery_note_items!pick_list_items_dn_item_id_fkey(
          id,
          suggested_pick_location_id,
          suggested_pick_batch_code,
          suggested_pick_batch_received_at,
          suggested_pick_location:warehouse_locations!delivery_note_items_suggested_pick_location_id_fkey(
            id,
            code,
            name
          )
        ),
        items!pick_list_items_item_id_fkey(item_name, item_code, sku),
        units_of_measure!pick_list_items_uom_id_fkey(symbol, name)
      ),
      pick_list_assignees(*, users:users!pick_list_assignees_user_id_fkey(id, email, first_name, last_name))
    `
    )
    .eq("id", id)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .single();

  if (error || !data) return null;
  return mapPickListRecord(data as Record<string, unknown>);
};

export const mapPickListRecord = <T extends Record<string, unknown>>(record: T) => {
  const deliveryNoteRaw = record.delivery_notes as
    | {
        id: string;
        dn_no: string;
        status: string;
        requesting_warehouse_id: string;
        fulfilling_warehouse_id: string;
      }
    | Array<{
        id: string;
        dn_no: string;
        status: string;
        requesting_warehouse_id: string;
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

export const fetchPickListHeader = async (supabase: SupabaseClient, companyId: string, id: string) => {
  const { data } = await supabase
    .from("pick_lists")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .single();

  return (data as PickListRow | null) ?? null;
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
}: CreatePickListForDnArgs) => {
  const uniquePickers = Array.from(new Set(pickerUserIds.map((id) => id.trim()).filter(Boolean)));
  if (uniquePickers.length === 0) {
    throw new Error("At least one picker must be assigned");
  }

  const { data: existingActive, error: existingActiveError } = await supabase
    .from("pick_lists")
    .select("id, status")
    .eq("company_id", companyId)
    .eq("dn_id", dnId)
    .in("status", ["pending", "in_progress", "paused"])
    .is("deleted_at", null)
    .maybeSingle();

  if (existingActiveError) {
    throw new Error(existingActiveError.message);
  }

  if (existingActive) {
    throw new Error("Delivery note already has an active pick list");
  }

  const { data: dnItems, error: dnItemsError } = await supabase
    .from("delivery_note_items")
    .select("id, sr_id, sr_item_id, item_id, uom_id, allocated_qty, picked_qty, is_voided")
    .eq("company_id", companyId)
    .eq("dn_id", dnId)
    .eq("is_voided", false)
    .gt("allocated_qty", 0)
    .order("created_at", { ascending: true });

  if (dnItemsError) {
    throw new Error(dnItemsError.message);
  }

  const pendingDnItems = (dnItems || []).filter((item) => {
    const allocatedQty = Number(item.allocated_qty || 0);
    const pickedQty = Number(item.picked_qty || 0);
    return allocatedQty > pickedQty;
  });

  if (pendingDnItems.length === 0) {
    throw new Error("Delivery note has no pending lines for picking");
  }

  const { data: fulfillingWarehouse, error: fulfillingWarehouseError } = await supabase
    .from("warehouses")
    .select("business_unit_id")
    .eq("id", fulfillingWarehouseId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fulfillingWarehouseError) {
    throw new Error(fulfillingWarehouseError.message);
  }

  const pickListBusinessUnitId =
    fulfillingWarehouse?.business_unit_id || dnBusinessUnitId || currentBusinessUnitId;

  const { data: pickerUsers, error: pickerUserError } = await supabase
    .from("users")
    .select("id")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .in("id", uniquePickers)
    .is("deleted_at", null);

  if (pickerUserError) {
    throw new Error(pickerUserError.message);
  }

  if (!pickerUsers || pickerUsers.length !== uniquePickers.length) {
    throw new Error("One or more picker users are invalid");
  }

  const nowIso = new Date().toISOString();
  const pickListNo = buildPickListNo();

  const { data: createdPickList, error: createError } = await supabase
    .from("pick_lists")
    .insert({
      company_id: companyId,
      business_unit_id: pickListBusinessUnitId,
      dn_id: dnId,
      pick_list_no: pickListNo,
      status: "pending",
      notes: notes?.trim() || null,
      created_by: userId,
      updated_by: userId,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("id")
    .single();

  if (createError || !createdPickList) {
    if (createError?.code === "23505") {
      throw new Error("Delivery note already has an active pick list");
    }
    throw new Error(createError?.message || "Failed to create pick list");
  }

  const assignees = uniquePickers.map((pickerUserId) => ({
    company_id: companyId,
    pick_list_id: createdPickList.id,
    user_id: pickerUserId,
    assigned_at: nowIso,
    assigned_by: userId,
  }));

  const { error: assigneeError } = await supabase.from("pick_list_assignees").insert(assignees);
  if (assigneeError) {
    throw new Error(assigneeError.message);
  }

  const pickListItems = pendingDnItems.map((item) => {
    const allocatedQty = Number(item.allocated_qty || 0);
    const pickedQty = Number(item.picked_qty || 0);
    const outstandingQty = Math.max(0, allocatedQty - pickedQty);

    return {
      company_id: companyId,
      pick_list_id: createdPickList.id,
      dn_item_id: item.id,
      sr_id: item.sr_id,
      sr_item_id: item.sr_item_id,
      item_id: item.item_id,
      uom_id: item.uom_id,
      allocated_qty: outstandingQty,
      picked_qty: 0,
      short_qty: outstandingQty,
      created_at: nowIso,
      updated_at: nowIso,
    };
  });

  const { error: itemError } = await supabase.from("pick_list_items").insert(pickListItems);
  if (itemError) {
    throw new Error(itemError.message);
  }

  const { error: dnUpdateError } = await supabase
    .from("delivery_notes")
    .update({
      status: "queued_for_picking",
      updated_at: nowIso,
      updated_by: userId,
    })
    .eq("id", dnId)
    .eq("company_id", companyId);

  if (dnUpdateError) {
    throw new Error(dnUpdateError.message);
  }

  return {
    pickListId: createdPickList.id,
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
  const [isAdmin, isSuperAdmin] = await Promise.all([
    checkPermission(RESOURCES.USERS, "edit"),
    checkPermission(RESOURCES.ROLES, "view"),
  ]);

  if (isAdmin || isSuperAdmin) {
    return { ok: true } as const;
  }

  const { data: assignee } = await supabase
    .from("pick_list_assignees")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("pick_list_id", pickListId)
    .eq("user_id", userId)
    .maybeSingle();

  if (assignee) {
    return { ok: true } as const;
  }

  let rolesQuery = supabase
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (businessUnitId) {
    rolesQuery = rolesQuery.or(`business_unit_id.is.null,business_unit_id.eq.${businessUnitId}`);
  }

  const { data: roleAssignments } = await rolesQuery;

  const hasPrivilegedRole = (roleAssignments || []).some((assignment) => {
    const role = Array.isArray(assignment.roles) ? assignment.roles[0] : assignment.roles;
    const normalized = role?.name?.toLowerCase().trim() || "";
    return normalized === "admin" || normalized === "super admin";
  });

  if (hasPrivilegedRole) {
    return { ok: true } as const;
  }

  return {
    ok: false,
    error: "Only assigned pickers, admins, or super admins can perform this action",
  } as const;
};
