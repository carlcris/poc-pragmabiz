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
      pick_list_items(
        *,
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
