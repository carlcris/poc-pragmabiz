import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
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
      .select("id, dn_item_id, item_id, allocated_qty")
      .eq("company_id", auth.companyId)
      .eq("pick_list_id", id);

    if (fetchItemsError) {
      return NextResponse.json({ error: fetchItemsError.message }, { status: 500 });
    }

    const byId = new Map((currentItems || []).map((item) => [item.id, item]));
    const byDnItemId = new Map((currentItems || []).map((item) => [item.dn_item_id, item]));

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
          return NextResponse.json({ error: updateItemError.message }, { status: 500 });
        }
      }
    }

    if (hasPickRows) {
      type DnLineMeta = {
        id: string;
        item_id: string;
        fulfilling_warehouse_id: string;
        allocated_qty: number | string;
        dispatched_qty: number | string;
        suggested_pick_location_id?: string | null;
        suggested_pick_batch_code?: string | null;
        suggested_pick_batch_received_at?: string | null;
      };

      const { data: dnLineRows, error: dnLineError } = await auth.supabase
        .from("delivery_note_items")
        .select(
          "id, item_id, fulfilling_warehouse_id, allocated_qty, dispatched_qty, suggested_pick_location_id, suggested_pick_batch_code, suggested_pick_batch_received_at"
        )
        .eq("company_id", auth.companyId)
        .eq("dn_id", header.dn_id);

      if (dnLineError) {
        return NextResponse.json({ error: dnLineError.message }, { status: 500 });
      }

      const dnLineById = new Map(
        ((dnLineRows || []) as DnLineMeta[]).map((row) => [row.id, row])
      );

      const { data: existingPickRows, error: existingPickRowsError } = await auth.supabase
        .from("delivery_note_item_picks")
        .select(
          "id, delivery_note_item_id, picked_location_id, picked_batch_code, picked_batch_received_at, picked_qty, dispatched_qty"
        )
        .eq("company_id", auth.companyId)
        .eq("pick_list_id", id)
        .is("deleted_at", null);

      if (existingPickRowsError) {
        return NextResponse.json({ error: existingPickRowsError.message }, { status: 500 });
      }

      type ExistingPickRow = {
        id: string;
        delivery_note_item_id: string;
        picked_location_id: string;
        picked_batch_code: string;
        picked_batch_received_at: string;
        picked_qty: number | string;
        dispatched_qty: number | string;
      };

      const pickRowsById = new Map<string, ExistingPickRow>();
      const lineTotals = new Map<string, number>();
      const mergeKeyToRow = new Map<string, ExistingPickRow>();

      const mergeKey = (
        deliveryNoteItemId: string,
        locationId: string,
        batchCode: string,
        batchReceivedAt: string
      ) => `${deliveryNoteItemId}::${locationId}::${batchCode.trim()}::${batchReceivedAt}`;

      for (const row of (existingPickRows || []) as ExistingPickRow[]) {
        pickRowsById.set(row.id, row);
        lineTotals.set(
          row.delivery_note_item_id,
          (lineTotals.get(row.delivery_note_item_id) || 0) + toNumber(row.picked_qty)
        );
        mergeKeyToRow.set(
          mergeKey(
            row.delivery_note_item_id,
            row.picked_location_id,
            row.picked_batch_code,
            row.picked_batch_received_at
          ),
          row
        );
      }

      for (const row of body.pickRows || []) {
        const pickQty = toNumber(row.pickedQty);
        const dnLine = dnLineById.get(row.deliveryNoteItemId);
        const pickListItem = byDnItemId.get(row.deliveryNoteItemId);
        let resolvedPickedLocationId = row.pickedLocationId;
        let resolvedPickedBatchCode = row.pickedBatchCode?.trim();
        let resolvedPickedBatchReceivedAt = row.pickedBatchReceivedAt;

        if (!dnLine || !pickListItem) {
          return NextResponse.json(
            { error: `Invalid delivery note item ${row.deliveryNoteItemId} for this pick list` },
            { status: 400 }
          );
        }

        const allocatedQty = toNumber(pickListItem.allocated_qty);
        const currentLinePicked = lineTotals.get(row.deliveryNoteItemId) || 0;

        if (row.pickRowId) {
          const existingRow = pickRowsById.get(row.pickRowId);
          if (!existingRow || existingRow.delivery_note_item_id !== row.deliveryNoteItemId) {
            return NextResponse.json(
              { error: `Invalid pick row ${row.pickRowId}` },
              { status: 400 }
            );
          }

          if (pickQty < 0) {
            return NextResponse.json({ error: "Picked quantity cannot be negative" }, { status: 400 });
          }

          const alreadyDispatched = toNumber(existingRow.dispatched_qty);
          if (pickQty < alreadyDispatched) {
            return NextResponse.json(
              { error: `Picked quantity cannot be less than already dispatched quantity (${alreadyDispatched})` },
              { status: 400 }
            );
          }

          const nextLinePicked = currentLinePicked - toNumber(existingRow.picked_qty) + pickQty;
          if (nextLinePicked > allocatedQty) {
            return NextResponse.json(
              { error: `Picked quantity exceeds allocated quantity (${allocatedQty}) for this line` },
              { status: 400 }
            );
          }

          const { error: updatePickRowError } = await auth.supabase
            .from("delivery_note_item_picks")
            .update({
              picked_qty: pickQty,
              is_mismatch_warning_acknowledged: row.isMismatchWarningAcknowledged ?? false,
              mismatch_reason: row.mismatchReason?.trim() || null,
              updated_at: nowIso,
              updated_by: auth.userId,
            })
            .eq("id", row.pickRowId)
            .eq("company_id", auth.companyId)
            .eq("pick_list_id", id);

          if (updatePickRowError) {
            return NextResponse.json({ error: updatePickRowError.message }, { status: 500 });
          }

          lineTotals.set(row.deliveryNoteItemId, nextLinePicked);
          pickRowsById.set(row.pickRowId, {
            ...existingRow,
            picked_qty: pickQty,
          });
          continue;
        }

        if (row.batchLocationSku?.trim()) {
          const { data: resolvedSource, error: resolvedSourceError } = await auth.supabase
            .from("item_location_batch")
            .select(
              `
              location_id,
              batch_location_sku,
              item_batch:item_batch!item_location_batch_item_batch_id_fkey(
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
            return NextResponse.json({ error: resolvedSourceError.message }, { status: 500 });
          }

          if (!resolvedSource) {
            return NextResponse.json(
              { error: `Scanned batch location SKU ${row.batchLocationSku.trim()} not found for this item` },
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
        }

        if (!resolvedPickedLocationId || !resolvedPickedBatchCode || !resolvedPickedBatchReceivedAt) {
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
          return NextResponse.json({ error: "Item already picked" }, { status: 400 });
        }

        const rowKey = mergeKey(
          row.deliveryNoteItemId,
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
              { error: `Picked quantity exceeds allocated quantity (${allocatedQty}) for this line` },
              { status: 400 }
            );
          }

          const { error: mergeUpdateError } = await auth.supabase
            .from("delivery_note_item_picks")
            .update({
              picked_qty: nextPickedQty,
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
            return NextResponse.json({ error: mergeUpdateError.message }, { status: 500 });
          }

          lineTotals.set(row.deliveryNoteItemId, nextLinePicked);
          const updatedMergedRow: ExistingPickRow = {
            ...mergedRow,
            picked_qty: nextPickedQty,
          };
          mergeKeyToRow.set(rowKey, updatedMergedRow);
          pickRowsById.set(mergedRow.id, updatedMergedRow);
        } else {
          const nextLinePicked = currentLinePicked + pickQty;
          if (nextLinePicked > allocatedQty) {
            return NextResponse.json(
              { error: `Picked quantity exceeds allocated quantity (${allocatedQty}) for this line` },
              { status: 400 }
            );
          }

          const { data: insertedPickRow, error: insertPickRowError } = await auth.supabase
            .from("delivery_note_item_picks")
            .insert({
              company_id: auth.companyId,
              dn_id: header.dn_id,
              delivery_note_item_id: row.deliveryNoteItemId,
              pick_list_id: id,
              item_id: dnLine.item_id,
              source_warehouse_id: dnLine.fulfilling_warehouse_id,
              picked_location_id: resolvedPickedLocationId,
              picked_batch_code: resolvedPickedBatchCode,
              picked_batch_received_at: resolvedPickedBatchReceivedAt,
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
              "id, delivery_note_item_id, picked_location_id, picked_batch_code, picked_batch_received_at, picked_qty, dispatched_qty"
            )
            .single();

          if (insertPickRowError || !insertedPickRow) {
            return NextResponse.json(
              { error: insertPickRowError?.message || "Failed to create pick row" },
              { status: 500 }
            );
          }

          const inserted = insertedPickRow as ExistingPickRow;
          lineTotals.set(row.deliveryNoteItemId, nextLinePicked);
          pickRowsById.set(inserted.id, inserted);
          mergeKeyToRow.set(
            mergeKey(
              inserted.delivery_note_item_id,
              inserted.picked_location_id,
              inserted.picked_batch_code,
              inserted.picked_batch_received_at
            ),
            inserted
          );
        }

        const suggestedBatchCode = (dnLine as { suggested_pick_batch_code?: string | null })
          .suggested_pick_batch_code;
        const suggestedLocationId = (dnLine as { suggested_pick_location_id?: string | null })
          .suggested_pick_location_id;
        const isOverride =
          (suggestedLocationId && suggestedLocationId !== resolvedPickedLocationId) ||
          (suggestedBatchCode && suggestedBatchCode !== resolvedPickedBatchCode);

        if (isOverride) {
          const { error: updateSuggestionError } = await auth.supabase
            .from("delivery_note_items")
            .update({
              suggested_pick_location_id: resolvedPickedLocationId,
              suggested_pick_batch_code: resolvedPickedBatchCode,
              suggested_pick_batch_received_at: resolvedPickedBatchReceivedAt,
              has_pick_source_override: true,
              last_pick_source_override_at: nowIso,
              last_pick_source_override_by: auth.userId,
              updated_at: nowIso,
            })
            .eq("id", row.deliveryNoteItemId)
            .eq("company_id", auth.companyId);

          if (updateSuggestionError) {
            return NextResponse.json({ error: updateSuggestionError.message }, { status: 500 });
          }
        }
      }

      const lineIds = Array.from(byDnItemId.keys());
      if (lineIds.length > 0) {
        const { data: pickRowsAfter, error: pickRowsAfterError } = await auth.supabase
          .from("delivery_note_item_picks")
          .select("delivery_note_item_id, picked_qty")
          .eq("company_id", auth.companyId)
          .eq("pick_list_id", id)
          .is("deleted_at", null);

        if (pickRowsAfterError) {
          return NextResponse.json({ error: pickRowsAfterError.message }, { status: 500 });
        }

        const pickedTotalsByDnItem = new Map<string, number>();
        for (const row of pickRowsAfter || []) {
          const dnItemId = row.delivery_note_item_id as string;
          pickedTotalsByDnItem.set(
            dnItemId,
            (pickedTotalsByDnItem.get(dnItemId) || 0) + toNumber(row.picked_qty as number | string)
          );
        }

        for (const [dnItemId, pickListItem] of byDnItemId.entries()) {
          const allocatedQty = toNumber(pickListItem.allocated_qty);
          const pickedQty = Math.min(allocatedQty, pickedTotalsByDnItem.get(dnItemId) || 0);
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
            return NextResponse.json({ error: syncPickListItemError.message }, { status: 500 });
          }
        }
      }
    }

    const pickList = await fetchPickList(auth.supabase, auth.companyId, id);
    return NextResponse.json(pickList);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
