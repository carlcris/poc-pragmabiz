import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { checkPermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { getAuthContext } from "../delivery-notes/_lib";
import {
  getWarehouseBusinessUnitMap,
  notifyBusinessUnits,
} from "@/app/api/_lib/workflow-notifications";

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
          code,
          name
        ),
        items!pick_list_items_item_id_fkey(item_name, item_code),
        units_of_measure!pick_list_items_uom_id_fkey(code, symbol, name)
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

export const fetchPickListHeader = async (
  supabase: SupabaseClient,
  companyId: string,
  id: string
) => {
  const { data } = await supabase
    .from("pick_lists")
    .select("*")
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
    .select("id, dn_no, requesting_warehouse_id, fulfilling_warehouse_id")
    .eq("id", pickList.dn_id)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .single();

  if (dnDetailsError || !dnDetails) {
    throw new Error(dnDetailsError?.message || "Delivery note details not found");
  }

  const warehouseBuMap = await getWarehouseBusinessUnitMap(supabase, companyId, [
    dnDetails.requesting_warehouse_id,
    dnDetails.fulfilling_warehouse_id,
  ]);

  await notifyBusinessUnits({
    supabase,
    companyId,
    actorUserId,
    businessUnitIds: [
      warehouseBuMap.get(dnDetails.requesting_warehouse_id),
      warehouseBuMap.get(dnDetails.fulfilling_warehouse_id),
    ],
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

type RelatedRow<T> = T | T[] | null | undefined;

type AllocationSource = {
  batchLocationSku: string | null;
  locationId: string;
  locationCode: string | null;
  locationName: string | null;
  batchCode: string;
  batchReceivedAt: string;
  availableQty: number;
  availableBaseQty: number;
};

export type PickListAllocationChoiceLine = {
  deliveryNoteItemId: string;
  itemId: string;
  itemLabel: string;
  unitLabel: string;
  requiredQty: number;
  requiredBaseQty: number;
  suggestedSource: AllocationSource | null;
  singleSource: AllocationSource | null;
  splitSources: AllocationSource[];
  totalAvailableQty: number;
  totalAvailableBaseQty: number;
};

export type PickListAllocationChoice = {
  lines: PickListAllocationChoiceLine[];
  insufficientLines: PickListAllocationChoiceLine[];
};

const toNumber = (value: unknown) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const one = <T>(value: RelatedRow<T>) => (Array.isArray(value) ? (value[0] ?? null) : (value ?? null));

const toText = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

const sortAllocationSources = (a: AllocationSource, b: AllocationSource) => {
  const receivedCompare = a.batchReceivedAt.localeCompare(b.batchReceivedAt);
  if (receivedCompare !== 0) return receivedCompare;
  return (a.batchLocationSku || "").localeCompare(b.batchLocationSku || "");
};

export const getPickListAllocationChoice = async (
  supabase: SupabaseClient,
  companyId: string,
  dnId: string
): Promise<PickListAllocationChoice> => {
  const { data: dnItems, error: dnItemsError } = await supabase
    .from("delivery_note_items")
    .select(
      `
      id,
      item_id,
      item_unit_option_id,
      uom_id,
      sr_item_id,
      allocated_qty,
      picked_qty,
      fulfilling_warehouse_id,
      items!delivery_note_items_item_id_fkey(item_name, item_code),
      units_of_measure!delivery_note_items_uom_id_fkey(code, symbol, name),
      item_unit_options!delivery_note_items_item_unit_option_id_fkey(option_label, qty_per_unit)
    `
    )
    .eq("company_id", companyId)
    .eq("dn_id", dnId)
    .eq("is_voided", false)
    .gt("allocated_qty", 0)
    .order("created_at", { ascending: true });

  if (dnItemsError) {
    throw new Error(dnItemsError.message);
  }

  const dnItemRows = (dnItems || []) as Array<Record<string, unknown>>;
  const srItemIds = Array.from(
    new Set(dnItemRows.map((row) => toText(row.sr_item_id)).filter((id): id is string => !!id))
  );
  const selectedBatchBySrItemId = new Map<string, string>();

  if (srItemIds.length > 0) {
    const { data: stockRequestItems, error: stockRequestItemsError } = await supabase
      .from("stock_request_items")
      .select("id, selected_item_batch_id")
      .in("id", srItemIds);

    if (stockRequestItemsError) {
      throw new Error(stockRequestItemsError.message);
    }

    for (const item of (stockRequestItems || []) as Array<Record<string, unknown>>) {
      const id = toText(item.id);
      const selectedBatchId = toText(item.selected_item_batch_id);
      if (id && selectedBatchId) {
        selectedBatchBySrItemId.set(id, selectedBatchId);
      }
    }
  }

  const lines: PickListAllocationChoiceLine[] = [];
  const insufficientLines: PickListAllocationChoiceLine[] = [];

  for (const rawLine of dnItemRows) {
    const allocatedQty = toNumber(rawLine.allocated_qty);
    const pickedQty = toNumber(rawLine.picked_qty);
    const requiredQty = Math.max(0, allocatedQty - pickedQty);
    if (requiredQty <= 0) continue;

    const unitOption = one(
      rawLine.item_unit_options as RelatedRow<{
        option_label?: string | null;
        qty_per_unit?: number | string | null;
      }>
    );
    const uom = one(
      rawLine.units_of_measure as RelatedRow<{
        code?: string | null;
        symbol?: string | null;
        name?: string | null;
      }>
    );
    const item = one(
      rawLine.items as RelatedRow<{
        item_name?: string | null;
        item_code?: string | null;
      }>
    );
    const qtyPerUnit = Math.max(1, toNumber(unitOption?.qty_per_unit) || 1);
    const requiredBaseQty = requiredQty * qtyPerUnit;
    const itemId = String(rawLine.item_id || "");
    const warehouseId = String(rawLine.fulfilling_warehouse_id || "");
    const selectedBatchId = selectedBatchBySrItemId.get(String(rawLine.sr_item_id || "")) || null;

    let sourceQuery = supabase
      .from("item_batch_locations")
      .select(
        `
        id,
        location_id,
        batch_location_sku,
        qty_on_hand,
        qty_reserved,
        warehouse_location:warehouse_locations!item_batch_locations_location_id_fkey(id, code, name),
        item_batch:item_batches!item_batch_locations_item_batch_id_fkey(
          id,
          batch_code,
          received_at,
          qty_on_hand,
          qty_reserved
        )
      `
      )
      .eq("company_id", companyId)
      .eq("item_id", itemId)
      .eq("warehouse_id", warehouseId)
      .is("deleted_at", null);

    if (selectedBatchId) {
      sourceQuery = sourceQuery.eq("item_batch_id", selectedBatchId);
    }

    const { data: sourceRows, error: sourceError } = await sourceQuery.limit(100);

    if (sourceError) {
      throw new Error(sourceError.message);
    }

    const sources = ((sourceRows || []) as Array<Record<string, unknown>>)
      .map((row): AllocationSource | null => {
        const batch = one(
          row.item_batch as RelatedRow<{
            batch_code?: string | null;
            id?: string | null;
            received_at?: string | null;
            qty_on_hand?: number | string | null;
            qty_reserved?: number | string | null;
          }>
        );
        const location = one(
          row.warehouse_location as RelatedRow<{
            code?: string | null;
            name?: string | null;
          }>
        );
        const batchCode = toText(batch?.batch_code);
        const batchId = toText(batch?.id);
        const receivedAt = toText(batch?.received_at);
        const locationId = toText(row.location_id);
        if (!batchCode || !receivedAt || !locationId) return null;
        if (selectedBatchId && batchId !== selectedBatchId) return null;

        const locationAvailable = Math.max(
          0,
          toNumber(row.qty_on_hand) - toNumber(row.qty_reserved)
        );
        const batchAvailable = Math.max(
          0,
          toNumber(batch?.qty_on_hand) - toNumber(batch?.qty_reserved)
        );
        const availableBaseQty = Math.max(0, Math.min(locationAvailable, batchAvailable));
        const availableQty = Math.floor(availableBaseQty / qtyPerUnit);
        const usableBaseQty = availableQty * qtyPerUnit;
        if (availableQty <= 0 || usableBaseQty <= 0) return null;

        return {
          batchLocationSku: toText(row.batch_location_sku),
          locationId,
          locationCode: toText(location?.code),
          locationName: toText(location?.name),
          batchCode,
          batchReceivedAt: receivedAt,
          availableQty,
          availableBaseQty: usableBaseQty,
        };
      })
      .filter((source): source is AllocationSource => source !== null)
      .sort(sortAllocationSources);

    const suggestedSource = sources[0] || null;

    if (suggestedSource && suggestedSource.availableBaseQty >= requiredBaseQty) {
      continue;
    }

    const singleSource = sources.find((source) => source.availableBaseQty >= requiredBaseQty) || null;
    const totalAvailableBaseQty = sources.reduce(
      (total, source) => total + source.availableBaseQty,
      0
    );
    const totalAvailableQty = sources.reduce((total, source) => total + source.availableQty, 0);
    const splitSources: AllocationSource[] = [];
    let remainingQty = requiredQty;
    for (const source of sources) {
      if (remainingQty <= 0) break;
      splitSources.push(source);
      remainingQty -= source.availableQty;
    }

    const choiceLine: PickListAllocationChoiceLine = {
      deliveryNoteItemId: String(rawLine.id || ""),
      itemId,
      itemLabel: item?.item_name || item?.item_code || itemId,
      unitLabel: unitOption?.option_label || uom?.symbol || uom?.code || uom?.name || "Unit",
      requiredQty,
      requiredBaseQty,
      suggestedSource,
      singleSource,
      splitSources: remainingQty <= 0 ? splitSources : [],
      totalAvailableQty,
      totalAvailableBaseQty,
    };

    if (totalAvailableBaseQty < requiredBaseQty) {
      insufficientLines.push(choiceLine);
    } else {
      lines.push(choiceLine);
    }
  }

  return { lines, insufficientLines };
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
