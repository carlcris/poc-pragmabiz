import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RESOURCES } from "@/constants/resources";
import {
  ensurePickListActorAuthorized,
  fetchPickList,
  fetchPickListHeader,
  getPickListAuthContext,
} from "../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type UpdatePickListItemsBody = {
  items?: Array<{
    pickListItemId: string;
    pickedQty: number;
  }>;
  pickRows?: Array<{
    pickRowId?: string;
    pickListItemId?: string;
    deliveryNoteItemId: string;
    batchLocationSku?: string;
    pickedLocationId: string;
    pickedBatchCode: string;
    pickedBatchReceivedAt: string;
    pickedQty: number;
    isMismatchWarningAcknowledged?: boolean;
    mismatchReason?: string | null;
  }>;
};

const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatQty = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/\.?0+$/, "");

const internalError = (message: string, error: unknown) => {
  console.error(message, error);
  return NextResponse.json({ error: message }, { status: 500 });
};

const getPickSourceAvailability = async ({
  supabase,
  companyId,
  itemId,
  warehouseId,
  locationId,
  batchCode,
  batchReceivedAt,
}: {
  supabase: SupabaseClient;
  companyId: string;
  itemId: string;
  warehouseId: string;
  locationId: string;
  batchCode: string;
  batchReceivedAt: string;
}) => {
  const { data: itemBatchRow, error: itemBatchError } = await supabase
    .from("item_batches")
    .select("id, qty_on_hand")
    .eq("company_id", companyId)
    .eq("item_id", itemId)
    .eq("warehouse_id", warehouseId)
    .eq("batch_code", batchCode)
    .eq("received_at", batchReceivedAt)
    .is("deleted_at", null)
    .maybeSingle();

  if (itemBatchError) {
    throw new Error(itemBatchError.message);
  }

  if (!itemBatchRow) {
    return null;
  }

  const { data: locationBatchRow, error: locationBatchError } = await supabase
    .from("item_batch_locations")
    .select("qty_on_hand, batch_location_sku")
    .eq("company_id", companyId)
    .eq("item_id", itemId)
    .eq("warehouse_id", warehouseId)
    .eq("location_id", locationId)
    .eq("item_batch_id", itemBatchRow.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (locationBatchError) {
    throw new Error(locationBatchError.message);
  }

  if (!locationBatchRow) {
    return null;
  }

  return {
    locationBatchQty: toNumber(locationBatchRow.qty_on_hand as number | string),
    itemBatchQty: toNumber(itemBatchRow.qty_on_hand as number | string),
    batchLocationSku:
      typeof locationBatchRow.batch_location_sku === "string"
        ? locationBatchRow.batch_location_sku.trim()
        : null,
  };
};

// PATCH /api/pick-lists/[id]/items
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
    if (unauthorized) return unauthorized;

    const auth = await getPickListAuthContext();
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as UpdatePickListItemsBody;

    const hasLegacyItems = !!body.items?.length;
    const hasPickRows = !!body.pickRows?.length;

    if (!hasLegacyItems && !hasPickRows) {
      return NextResponse.json({ error: "items or pickRows is required" }, { status: 400 });
    }

    if (hasLegacyItems && hasPickRows) {
      return NextResponse.json(
        { error: "Provide either items or pickRows, not both" },
        { status: 400 }
      );
    }

    const header = await fetchPickListHeader(auth.supabase, auth.companyId, id);
    if (!header) {
      return NextResponse.json({ error: "Pick list not found" }, { status: 404 });
    }

    if (["cancelled", "done"].includes(header.status)) {
      return NextResponse.json(
        { error: `Cannot update items for pick list in ${header.status} status` },
        { status: 400 }
      );
    }

    const permission = await ensurePickListActorAuthorized(
      auth.supabase,
      auth.companyId,
      header.business_unit_id,
      id,
      auth.userId
    );

    if (!permission.ok) {
      return NextResponse.json({ error: permission.error }, { status: 403 });
    }

    const { data: dnHeader, error: dnHeaderError } = await auth.supabase
      .from("delivery_notes")
      .select("id, status")
      .eq("id", header.dn_id)
      .eq("company_id", auth.companyId)
      .is("deleted_at", null)
      .single();

    if (dnHeaderError || !dnHeader) {
      return NextResponse.json({ error: "Linked delivery note not found" }, { status: 500 });
    }

    const { data: currentItems, error: fetchItemsError } = await auth.supabase
      .from("pick_list_items")
      .select(
        "id, dn_item_id, item_id, allocated_qty, picked_qty, suggested_pick_location_id, suggested_pick_batch_code, suggested_pick_batch_received_at, suggested_batch_location_sku"
      )
      .eq("company_id", auth.companyId)
      .eq("pick_list_id", id);

    if (fetchItemsError) {
      return internalError("Unable to fetch pick list items", fetchItemsError);
    }

    type CurrentPickListItem = NonNullable<typeof currentItems>[number];
    const byId = new Map((currentItems || []).map((item) => [item.id, item]));
    const byDnItemId = new Map<string, CurrentPickListItem[]>();
    for (const item of currentItems || []) {
      const rows = byDnItemId.get(item.dn_item_id) || [];
      rows.push(item);
      byDnItemId.set(item.dn_item_id, rows);
    }

    if (hasPickRows && ["dispatched", "received", "voided"].includes(dnHeader.status)) {
      return NextResponse.json(
        { error: `Cannot edit pick rows after delivery note is ${dnHeader.status}` },
        { status: 400 }
      );
    }

    if (hasLegacyItems) {
      for (const item of body.items || []) {
        const existing = byId.get(item.pickListItemId);
        if (!existing) {
          return NextResponse.json(
            { error: `Invalid pick list item ${item.pickListItemId}` },
            { status: 400 }
          );
        }

        const allocatedQty = toNumber(existing.allocated_qty);
        const pickedQty = toNumber(item.pickedQty);
        if (pickedQty < 0 || pickedQty > allocatedQty) {
          return NextResponse.json(
            { error: `Picked quantity must be between 0 and ${allocatedQty}` },
            { status: 400 }
          );
        }
      }
    }

    const nowIso = new Date().toISOString();
    const lineTotals = new Map<string, number>();

    if (hasLegacyItems) {
      for (const item of body.items || []) {
        const existing = byId.get(item.pickListItemId);
        if (!existing) continue;

        const allocatedQty = toNumber(existing.allocated_qty);
        const pickedQty = toNumber(item.pickedQty);
        const shortQty = Math.max(0, allocatedQty - pickedQty);

        const { error: updateItemError } = await auth.supabase
          .from("pick_list_items")
          .update({
            picked_qty: pickedQty,
            short_qty: shortQty,
            updated_at: nowIso,
          })
          .eq("id", item.pickListItemId)
          .eq("company_id", auth.companyId)
          .eq("pick_list_id", id);

        if (updateItemError) {
          return internalError("Unable to update pick list item quantities", updateItemError);
        }

        lineTotals.set(item.pickListItemId, pickedQty);
      }
    }

    if (hasPickRows) {
      type DnLineMeta = {
        id: string;
        item_id: string;
        fulfilling_warehouse_id: string;
        item_unit_option_id?: string | null;
        allocated_qty: number | string;
        dispatched_qty: number | string;
        item_unit_options?:
          | {
              qty_per_unit: number | string | null;
            }
          | Array<{
              qty_per_unit: number | string | null;
            }>
          | null;
      };

      const { data: dnLineRows, error: dnLineError } = await auth.supabase
        .from("delivery_note_items")
        .select(
          "id, item_id, fulfilling_warehouse_id, item_unit_option_id, allocated_qty, dispatched_qty, item_unit_options!delivery_note_items_item_unit_option_id_fkey(qty_per_unit)"
        )
        .eq("company_id", auth.companyId)
        .eq("dn_id", header.dn_id);

      if (dnLineError) {
        return internalError("Unable to fetch delivery note item details", dnLineError);
      }

      const dnLineById = new Map(((dnLineRows || []) as DnLineMeta[]).map((row) => [row.id, row]));

      const { data: existingPickRows, error: existingPickRowsError } = await auth.supabase
        .from("delivery_note_item_picks")
        .select(
          "id, delivery_note_item_id, pick_list_item_id, picked_location_id, picked_batch_code, picked_batch_received_at, batch_location_sku, picked_qty, dispatched_qty"
        )
        .eq("company_id", auth.companyId)
        .eq("pick_list_id", id)
        .is("deleted_at", null);

      if (existingPickRowsError) {
        return internalError("Unable to fetch existing picked rows", existingPickRowsError);
      }

      type ExistingPickRow = {
        id: string;
        delivery_note_item_id: string;
        pick_list_item_id: string | null;
        picked_location_id: string;
        picked_batch_code: string;
        picked_batch_received_at: string;
        batch_location_sku: string | null;
        picked_qty: number | string;
        dispatched_qty: number | string;
      };

      const pickRowsById = new Map<string, ExistingPickRow>();
      const mergeKeyToRow = new Map<string, ExistingPickRow>();

      const mergeKey = (
        pickListItemId: string,
        locationId: string,
        batchCode: string,
        batchReceivedAt: string
      ) => `${pickListItemId}::${locationId}::${batchCode.trim()}::${batchReceivedAt}`;

      for (const row of (existingPickRows || []) as ExistingPickRow[]) {
        pickRowsById.set(row.id, row);
        const pickListItemId = row.pick_list_item_id || "";
        if (!pickListItemId) continue;
        lineTotals.set(pickListItemId, (lineTotals.get(pickListItemId) || 0) + toNumber(row.picked_qty));
        mergeKeyToRow.set(
          mergeKey(
            pickListItemId,
            row.picked_location_id,
            row.picked_batch_code,
            row.picked_batch_received_at
          ),
          row
        );
      }

      for (const row of body.pickRows || []) {
        const pickQty = toNumber(row.pickedQty);
        const candidatePickListItems = byDnItemId.get(row.deliveryNoteItemId) || [];
        const pickListItem = row.pickListItemId
          ? byId.get(row.pickListItemId)
          : candidatePickListItems.length === 1
            ? candidatePickListItems[0]
            : null;
        const dnLine = pickListItem ? dnLineById.get(pickListItem.dn_item_id) : null;
        let resolvedPickedLocationId = row.pickedLocationId;
        let resolvedPickedBatchCode = row.pickedBatchCode?.trim();
        let resolvedPickedBatchReceivedAt = row.pickedBatchReceivedAt;
        let resolvedPickedBatchLocationSku: string | null =
          typeof row.batchLocationSku === "string" && row.batchLocationSku.trim()
            ? row.batchLocationSku.trim()
            : null;

        if (!dnLine || !pickListItem) {
          return NextResponse.json(
            {
              error: row.pickListItemId
                ? `Invalid pick list item ${row.pickListItemId}`
                : `pickListItemId is required for split line ${row.deliveryNoteItemId}`,
            },
            { status: 400 }
          );
        }

        const deliveryNoteItemId = pickListItem.dn_item_id;
        const allocatedQty = toNumber(pickListItem.allocated_qty);
        const currentLinePicked = lineTotals.get(pickListItem.id) || 0;
        const dnLineUnitOption = Array.isArray(dnLine.item_unit_options)
          ? dnLine.item_unit_options[0]
          : dnLine.item_unit_options;
        const qtyPerUnit = Math.max(1, toNumber(dnLineUnitOption?.qty_per_unit));

        if (row.pickRowId) {
          const existingRow = pickRowsById.get(row.pickRowId);
          if (!existingRow || existingRow.pick_list_item_id !== pickListItem.id) {
            return NextResponse.json(
              { error: `Invalid pick row ${row.pickRowId}` },
              { status: 400 }
            );
          }

          if (pickQty < 0) {
            return NextResponse.json(
              { error: "Picked quantity cannot be negative" },
              { status: 400 }
            );
          }

          const alreadyDispatched = toNumber(existingRow.dispatched_qty);
          if (pickQty < alreadyDispatched) {
            return NextResponse.json(
              {
                error: `Picked quantity cannot be less than already dispatched quantity (${alreadyDispatched})`,
              },
              { status: 400 }
            );
          }

          const nextLinePicked = currentLinePicked - toNumber(existingRow.picked_qty) + pickQty;
          if (nextLinePicked > allocatedQty) {
            return NextResponse.json(
              {
                error: `Picked quantity exceeds allocated quantity (${allocatedQty}) for this line`,
              },
              { status: 400 }
            );
          }

          const sourceAvailability = await getPickSourceAvailability({
            supabase: auth.supabase,
            companyId: auth.companyId,
            itemId: dnLine.item_id,
            warehouseId: dnLine.fulfilling_warehouse_id,
            locationId: existingRow.picked_location_id,
            batchCode: existingRow.picked_batch_code,
            batchReceivedAt: existingRow.picked_batch_received_at,
          });

          if (!sourceAvailability) {
            return NextResponse.json(
              { error: `Picked source batch no longer exists for line ${row.deliveryNoteItemId}` },
              { status: 400 }
            );
          }

          const requiredBaseQty = pickQty * qtyPerUnit;
          const maxBaseQty = Math.min(
            sourceAvailability.locationBatchQty,
            sourceAvailability.itemBatchQty
          );

          if (requiredBaseQty > maxBaseQty) {
            return NextResponse.json(
              {
                error: `Picked source batch only has ${formatQty(maxBaseQty)} base units available, but ${formatQty(requiredBaseQty)} are required for this pick quantity`,
              },
              { status: 400 }
            );
          }

          const { error: updatePickRowError } = await auth.supabase
            .from("delivery_note_item_picks")
            .update({
              picked_qty: pickQty,
              batch_location_sku: sourceAvailability.batchLocationSku || existingRow.batch_location_sku,
              is_mismatch_warning_acknowledged: row.isMismatchWarningAcknowledged ?? false,
              mismatch_reason: row.mismatchReason?.trim() || null,
              updated_at: nowIso,
              updated_by: auth.userId,
            })
            .eq("id", row.pickRowId)
            .eq("company_id", auth.companyId)
            .eq("pick_list_id", id);

          if (updatePickRowError) {
            return internalError("Unable to update picked row", updatePickRowError);
          }

          lineTotals.set(pickListItem.id, nextLinePicked);
          pickRowsById.set(row.pickRowId, {
            ...existingRow,
            batch_location_sku: sourceAvailability.batchLocationSku || existingRow.batch_location_sku,
            picked_qty: pickQty,
          });
          continue;
        }

        if (row.batchLocationSku?.trim()) {
          const { data: resolvedSource, error: resolvedSourceError } = await auth.supabase
            .from("item_batch_locations")
            .select(
              `
              location_id,
              batch_location_sku,
              item_batch:item_batches!item_batch_locations_item_batch_id_fkey(
                id,
                item_id,
                warehouse_id,
                batch_code,
                received_at
              )
            `
            )
            .eq("company_id", auth.companyId)
            .eq("batch_location_sku", row.batchLocationSku.trim())
            .eq("item_id", dnLine.item_id)
            .eq("warehouse_id", dnLine.fulfilling_warehouse_id)
            .is("deleted_at", null)
            .maybeSingle();

          if (resolvedSourceError) {
            return internalError("Unable to resolve scanned batch location", resolvedSourceError);
          }

          if (!resolvedSource) {
            return NextResponse.json(
              {
                error: `Scanned batch location SKU ${row.batchLocationSku.trim()} not found for this item`,
              },
              { status: 400 }
            );
          }

          const itemBatch = Array.isArray(resolvedSource.item_batch)
            ? resolvedSource.item_batch[0]
            : resolvedSource.item_batch;

          if (!resolvedSource.location_id || !itemBatch?.batch_code || !itemBatch?.received_at) {
            return NextResponse.json(
              { error: "Scanned batch location SKU has incomplete source data" },
              { status: 400 }
            );
          }

          resolvedPickedLocationId = resolvedSource.location_id as string;
          resolvedPickedBatchCode = String(itemBatch.batch_code).trim();
          resolvedPickedBatchReceivedAt = String(itemBatch.received_at);
          resolvedPickedBatchLocationSku =
            typeof resolvedSource.batch_location_sku === "string"
              ? resolvedSource.batch_location_sku.trim()
              : null;
        }

        if (
          !resolvedPickedLocationId ||
          !resolvedPickedBatchCode ||
          !resolvedPickedBatchReceivedAt
        ) {
          return NextResponse.json(
            {
              error:
                "Provide batchLocationSku or pickedLocationId + pickedBatchCode + pickedBatchReceivedAt",
            },
            { status: 400 }
          );
        }

        if (pickQty <= 0) {
          return NextResponse.json(
            { error: "Picked quantity must be greater than zero for scan pick rows" },
            { status: 400 }
          );
        }

        if (currentLinePicked >= allocatedQty) {
          continue;
        }

        const rowKey = mergeKey(
          pickListItem.id,
          resolvedPickedLocationId,
          resolvedPickedBatchCode,
          resolvedPickedBatchReceivedAt
        );
        const mergedRow = mergeKeyToRow.get(rowKey);

        if (mergedRow) {
          const nextPickedQty = toNumber(mergedRow.picked_qty) + pickQty;
          const nextLinePicked = currentLinePicked + pickQty;
          if (nextLinePicked > allocatedQty) {
            return NextResponse.json(
              {
                error: `Picked quantity exceeds allocated quantity (${allocatedQty}) for this line`,
              },
              { status: 400 }
            );
          }

          const sourceAvailability = await getPickSourceAvailability({
            supabase: auth.supabase,
            companyId: auth.companyId,
            itemId: dnLine.item_id,
            warehouseId: dnLine.fulfilling_warehouse_id,
            locationId: resolvedPickedLocationId,
            batchCode: resolvedPickedBatchCode,
            batchReceivedAt: resolvedPickedBatchReceivedAt,
          });

          if (!sourceAvailability) {
            return NextResponse.json(
              { error: `Selected source batch was not found for line ${row.deliveryNoteItemId}` },
              { status: 400 }
            );
          }
          resolvedPickedBatchLocationSku =
            resolvedPickedBatchLocationSku || sourceAvailability.batchLocationSku;

          const requiredBaseQty = nextPickedQty * qtyPerUnit;
          const maxBaseQty = Math.min(
            sourceAvailability.locationBatchQty,
            sourceAvailability.itemBatchQty
          );

          if (requiredBaseQty > maxBaseQty) {
            return NextResponse.json(
              {
                error: `Selected source batch only has ${formatQty(maxBaseQty)} base units available, but ${formatQty(requiredBaseQty)} are required for this pick quantity`,
              },
              { status: 400 }
            );
          }

          const { error: mergeUpdateError } = await auth.supabase
            .from("delivery_note_item_picks")
            .update({
              picked_qty: nextPickedQty,
              batch_location_sku: resolvedPickedBatchLocationSku,
              is_mismatch_warning_acknowledged: row.isMismatchWarningAcknowledged ?? false,
              mismatch_reason: row.mismatchReason?.trim() || null,
              picker_user_id: auth.userId,
              picked_at: nowIso,
              updated_at: nowIso,
              updated_by: auth.userId,
            })
            .eq("id", mergedRow.id)
            .eq("company_id", auth.companyId)
            .eq("pick_list_id", id);

          if (mergeUpdateError) {
            return internalError("Unable to update picked row", mergeUpdateError);
          }

          lineTotals.set(pickListItem.id, nextLinePicked);
          const updatedMergedRow: ExistingPickRow = {
            ...mergedRow,
            batch_location_sku: resolvedPickedBatchLocationSku,
            picked_qty: nextPickedQty,
          };
          mergeKeyToRow.set(rowKey, updatedMergedRow);
          pickRowsById.set(mergedRow.id, updatedMergedRow);
        } else {
          const nextLinePicked = currentLinePicked + pickQty;
          if (nextLinePicked > allocatedQty) {
            return NextResponse.json(
              {
                error: `Picked quantity exceeds allocated quantity (${allocatedQty}) for this line`,
              },
              { status: 400 }
            );
          }

          const sourceAvailability = await getPickSourceAvailability({
            supabase: auth.supabase,
            companyId: auth.companyId,
            itemId: dnLine.item_id,
            warehouseId: dnLine.fulfilling_warehouse_id,
            locationId: resolvedPickedLocationId,
            batchCode: resolvedPickedBatchCode,
            batchReceivedAt: resolvedPickedBatchReceivedAt,
          });

          if (!sourceAvailability) {
            return NextResponse.json(
              { error: `Selected source batch was not found for line ${row.deliveryNoteItemId}` },
              { status: 400 }
            );
          }
          resolvedPickedBatchLocationSku =
            resolvedPickedBatchLocationSku || sourceAvailability.batchLocationSku;

          const requiredBaseQty = pickQty * qtyPerUnit;
          const maxBaseQty = Math.min(
            sourceAvailability.locationBatchQty,
            sourceAvailability.itemBatchQty
          );

          if (requiredBaseQty > maxBaseQty) {
            return NextResponse.json(
              {
                error: `Selected source batch only has ${formatQty(maxBaseQty)} base units available, but ${formatQty(requiredBaseQty)} are required for this pick quantity`,
              },
              { status: 400 }
            );
          }

          const { data: insertedPickRow, error: insertPickRowError } = await auth.supabase
            .from("delivery_note_item_picks")
            .insert({
              company_id: auth.companyId,
              dn_id: header.dn_id,
              delivery_note_item_id: deliveryNoteItemId,
              pick_list_item_id: pickListItem.id,
              pick_list_id: id,
              item_id: dnLine.item_id,
              source_warehouse_id: dnLine.fulfilling_warehouse_id,
              picked_location_id: resolvedPickedLocationId,
              picked_batch_code: resolvedPickedBatchCode,
              picked_batch_received_at: resolvedPickedBatchReceivedAt,
              batch_location_sku: resolvedPickedBatchLocationSku,
              picked_qty: pickQty,
              dispatched_qty: 0,
              picker_user_id: auth.userId,
              picked_at: nowIso,
              is_mismatch_warning_acknowledged: row.isMismatchWarningAcknowledged ?? false,
              mismatch_reason: row.mismatchReason?.trim() || null,
              created_by: auth.userId,
              updated_by: auth.userId,
            })
            .select(
              "id, delivery_note_item_id, pick_list_item_id, picked_location_id, picked_batch_code, picked_batch_received_at, batch_location_sku, picked_qty, dispatched_qty"
            )
            .single();

          if (insertPickRowError || !insertedPickRow) {
            return internalError("Unable to create picked row", insertPickRowError);
          }

          const inserted = insertedPickRow as ExistingPickRow;
          lineTotals.set(pickListItem.id, nextLinePicked);
          pickRowsById.set(inserted.id, inserted);
          mergeKeyToRow.set(
            mergeKey(
              inserted.pick_list_item_id || pickListItem.id,
              inserted.picked_location_id,
              inserted.picked_batch_code,
              inserted.picked_batch_received_at
            ),
            inserted
          );
        }

      }

      const pickListItemIds = Array.from(byId.keys());
      if (pickListItemIds.length > 0) {
        const { data: pickRowsAfter, error: pickRowsAfterError } = await auth.supabase
          .from("delivery_note_item_picks")
          .select("pick_list_item_id, picked_qty")
          .eq("company_id", auth.companyId)
          .eq("pick_list_id", id)
          .is("deleted_at", null);

        if (pickRowsAfterError) {
          return internalError("Unable to fetch picked rows after update", pickRowsAfterError);
        }

        const pickedTotalsByPickListItem = new Map<string, number>();
        for (const row of pickRowsAfter || []) {
          const pickListItemId = row.pick_list_item_id as string | null;
          if (!pickListItemId) continue;
          pickedTotalsByPickListItem.set(
            pickListItemId,
            (pickedTotalsByPickListItem.get(pickListItemId) || 0) +
              toNumber(row.picked_qty as number | string)
          );
        }

        for (const pickListItem of byId.values()) {
          const allocatedQty = toNumber(pickListItem.allocated_qty);
          const pickedQty = Math.min(
            allocatedQty,
            pickedTotalsByPickListItem.get(pickListItem.id) || 0
          );
          const shortQty = Math.max(0, allocatedQty - pickedQty);

          const { error: syncPickListItemError } = await auth.supabase
            .from("pick_list_items")
            .update({
              picked_qty: pickedQty,
              short_qty: shortQty,
              updated_at: nowIso,
            })
            .eq("id", pickListItem.id)
            .eq("company_id", auth.companyId)
            .eq("pick_list_id", id);

          if (syncPickListItemError) {
            return internalError("Unable to sync pick list item quantities", syncPickListItemError);
          }
        }
      }
    }

    const dnItemIds = Array.from(byDnItemId.keys());
    for (const dnItemId of dnItemIds) {
      const pickListItemsForDn = byDnItemId.get(dnItemId) || [];
      const pickedQty = pickListItemsForDn.reduce((total, item) => {
        const picked = lineTotals.get(item.id);
        return total + (picked == null ? toNumber(item.picked_qty) : picked);
      }, 0);
      const allocatedQty = pickListItemsForDn.reduce(
        (total, item) => total + toNumber(item.allocated_qty),
        0
      );

      const { error: syncDnItemError } = await auth.supabase
        .from("delivery_note_items")
        .update({
          picked_qty: Math.min(allocatedQty, pickedQty),
          short_qty: Math.max(0, allocatedQty - pickedQty),
          updated_at: nowIso,
        })
        .eq("id", dnItemId)
        .eq("company_id", auth.companyId)
        .eq("dn_id", header.dn_id);

      if (syncDnItemError) {
        return internalError("Unable to sync delivery note item quantities", syncDnItemError);
      }
    }

    const pickList = await fetchPickList(auth.supabase, auth.companyId, id);
    return NextResponse.json(pickList);
  } catch (error) {
    return internalError("Unable to update pick list items", error);
  }
}
