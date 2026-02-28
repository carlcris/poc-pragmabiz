import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";

type SupabaseClient = Awaited<ReturnType<typeof createServerClientWithBU>>["supabase"];

type WorkflowNotificationInput = {
  supabase: SupabaseClient;
  companyId: string;
  actorUserId: string;
  businessUnitIds: Array<string | null | undefined>;
  title: string;
  message: string;
  type: string;
  metadata?: Record<string, unknown>;
  excludeUserIds?: string[];
};

export const getWarehouseBusinessUnitMap = async (
  supabase: SupabaseClient,
  companyId: string,
  warehouseIds: Array<string | null | undefined>
) => {
  const uniqueWarehouseIds = Array.from(new Set(warehouseIds.filter(Boolean) as string[]));
  const map = new Map<string, string>();

  if (uniqueWarehouseIds.length === 0) return map;

  const { data, error } = await supabase.rpc("get_warehouse_business_units", {
    p_company_id: companyId,
    p_warehouse_ids: uniqueWarehouseIds,
  });

  if (error) {
    throw new Error(`Failed to resolve warehouse business units: ${error.message}`);
  }

  for (const row of data || []) {
    if (row.business_unit_id && row.warehouse_id) {
      map.set(row.warehouse_id as string, row.business_unit_id as string);
    }
  }

  return map;
};

type UserNotificationInput = {
  supabase: SupabaseClient;
  companyId: string;
  actorUserId: string;
  userIds: Array<string | null | undefined>;
  title: string;
  message: string;
  type: string;
  metadata?: Record<string, unknown>;
};

export const notifyUsers = async ({
  supabase,
  companyId,
  actorUserId,
  userIds,
  title,
  message,
  type,
  metadata,
}: UserNotificationInput) => {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean) as string[]));
  if (uniqueUserIds.length === 0) return;

  const { error } = await supabase.rpc("notify_users", {
    p_company_id: companyId,
    p_actor_user_id: actorUserId,
    p_target_user_ids: uniqueUserIds,
    p_title: title,
    p_message: message,
    p_type: type,
    p_metadata: metadata || null,
  });

  if (error) {
    throw new Error(`Failed to insert user notifications: ${error.message}`);
  }
};

export const notifyBusinessUnits = async ({
  companyId,
  supabase,
  actorUserId,
  businessUnitIds,
  title,
  message,
  type,
  metadata,
  excludeUserIds = [],
}: WorkflowNotificationInput) => {
  const uniqueBuIds = Array.from(new Set(businessUnitIds.filter(Boolean) as string[]));
  if (uniqueBuIds.length === 0) return;

  const { error } = await supabase.rpc("notify_business_units", {
    p_company_id: companyId,
    p_actor_user_id: actorUserId,
    p_target_business_unit_ids: uniqueBuIds,
    p_title: title,
    p_message: message,
    p_type: type,
    p_metadata: metadata || null,
    p_exclude_user_ids: excludeUserIds,
  });

  if (error) {
    throw new Error(`Failed to insert BU notifications: ${error.message}`);
  }
};
