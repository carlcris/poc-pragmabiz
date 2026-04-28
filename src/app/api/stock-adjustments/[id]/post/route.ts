import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import {
  adjustItemLocation,
  ensureWarehouseDefaultLocation,
} from "@/services/inventory/locationService";

type DbStockAdjustmentItem = {
  id: string;
  adjustment_id: string;
  item_id: string;
  item_code: string;
  item_name: string;
  current_qty: number | string | null;
  adjusted_qty: number | string | null;
  difference: number | string | null;
  unit_cost: number | string | null;
  total_cost: number | string | null;
  uom_id: string | null;
  uom_name: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string | null;
};

type BatchLayerAdjustmentInput = {
  itemId: string;
  warehouseId: string;
  locationId: string;
  quantityDelta: number;
  adjustmentCode: string;
  postingDate: string;
  userId: string;
};

const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const applyBatchLayerAdjustment = async (
  supabase: SupabaseClient,
  companyId: string,
  {
    itemId,
    warehouseId,
    locationId,
    quantityDelta,
    adjustmentCode,
    postingDate,
    userId,
  }: BatchLayerAdjustmentInput
) => {
  if (quantityDelta === 0) return;

  if (quantityDelta > 0) {
    const batchCode = `ADJ-${adjustmentCode}`;

    const { data: existingBatch, error: existingBatchError } = await supabase
      .from("item_batch")
      .select("id, qty_on_hand, qty_reserved")
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
      const { error: batchUpdateError } = await supabase
        .from("item_batch")
        .update({
          qty_on_hand: toNumber(existingBatch.qty_on_hand) + quantityDelta,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingBatch.id);

      if (batchUpdateError) {
        throw new Error(batchUpdateError.message);
      }
    } else {
      const { data: insertedBatch, error: batchInsertError } = await supabase
        .from("item_batch")
        .insert({
          company_id: companyId,
          item_id: itemId,
          warehouse_id: warehouseId,
          batch_code: batchCode,
          received_at: postingDate,
          qty_on_hand: quantityDelta,
          qty_reserved: 0,
          created_by: userId,
          updated_by: userId,
        })
        .select("id")
        .single();

      if (batchInsertError || !insertedBatch) {
        throw new Error(batchInsertError?.message || "Failed to create item batch for adjustment");
      }

      itemBatchId = insertedBatch.id;
    }

    const { data: existingLocationBatch, error: existingLocationBatchError } = await supabase
      .from("item_location_batch")
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
      const { error: locationBatchUpdateError } = await supabase
        .from("item_location_batch")
        .update({
          qty_on_hand: toNumber(existingLocationBatch.qty_on_hand) + quantityDelta,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingLocationBatch.id);

      if (locationBatchUpdateError) {
        throw new Error(locationBatchUpdateError.message);
      }
    } else {
      const { error: locationBatchInsertError } = await supabase
        .from("item_location_batch")
        .insert({
          company_id: companyId,
          item_id: itemId,
          warehouse_id: warehouseId,
          location_id: locationId,
          item_batch_id: itemBatchId,
          qty_on_hand: quantityDelta,
          qty_reserved: 0,
          created_by: userId,
          updated_by: userId,
        });

      if (locationBatchInsertError) {
        throw new Error(locationBatchInsertError.message);
      }
    }

    return;
  }

  let remaining = Math.abs(quantityDelta);

  const { data: locationBatchRows, error: locationBatchRowsError } = await supabase
    .from("item_location_batch")
    .select(
      `
      id,
      qty_on_hand,
      item_batch:item_batch!item_location_batch_item_batch_id_fkey(
        id,
        received_at,
        qty_on_hand
      )
    `
    )
    .eq("company_id", companyId)
    .eq("item_id", itemId)
    .eq("warehouse_id", warehouseId)
    .eq("location_id", locationId)
    .is("deleted_at", null);

  if (locationBatchRowsError) {
    throw new Error(locationBatchRowsError.message);
  }

  const sortedRows = (locationBatchRows || [])
    .map((row) => ({
      id: row.id as string,
      qtyOnHand: toNumber(row.qty_on_hand as number | string),
      itemBatch: Array.isArray(row.item_batch) ? row.item_batch[0] : row.item_batch,
    }))
    .filter((row) => row.itemBatch?.id)
    .sort((a, b) => {
      const aTime = new Date(String(a.itemBatch?.received_at || 0)).getTime();
      const bTime = new Date(String(b.itemBatch?.received_at || 0)).getTime();
      return aTime - bTime;
    });

  for (const row of sortedRows) {
    if (remaining <= 0) break;

    const takeQty = Math.min(row.qtyOnHand, remaining);
    if (takeQty <= 0) continue;

    const nextLocationBatchQty = row.qtyOnHand - takeQty;
    const nextItemBatchQty = toNumber(row.itemBatch?.qty_on_hand as number | string) - takeQty;

    if (nextItemBatchQty < 0) {
      throw new Error("Insufficient item batch stock for stock adjustment.");
    }

    const { error: updateLocationBatchError } = await supabase
      .from("item_location_batch")
      .update({
        qty_on_hand: nextLocationBatchQty,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updateLocationBatchError) {
      throw new Error(updateLocationBatchError.message);
    }

    const { error: updateItemBatchError } = await supabase
      .from("item_batch")
      .update({
        qty_on_hand: nextItemBatchQty,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", String(row.itemBatch?.id));

    if (updateItemBatchError) {
      throw new Error(updateItemBatchError.message);
    }

    remaining -= takeQty;
  }

  if (remaining > 0) {
    throw new Error("Insufficient batch stock at the selected location.");
  }
};

// POST /api/stock-adjustments/[id]/post - Post/approve stock adjustment (creates stock transaction)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Require 'stock_adjustments' edit permission (posting is a form of editing)
    const unauthorized = await requirePermission(RESOURCES.STOCK_ADJUSTMENTS, "edit");
    if (unauthorized) return unauthorized;

    const { id } = await params;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, currentBusinessUnitId, userId } = context;

    // Validate business unit context
    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    // Fetch adjustment with items
    const { data: adjustment, error: fetchError } = await supabase
      .from("stock_adjustments")
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !adjustment) {
      return NextResponse.json({ error: "Stock adjustment not found" }, { status: 404 });
    }

    // Only draft adjustments can be posted
    if (adjustment.status !== "draft") {
      return NextResponse.json({ error: "Only draft adjustments can be posted" }, { status: 400 });
    }

    // Fetch adjustment items
    const { data: items } = await supabase
      .from("stock_adjustment_items")
      .select("*")
      .eq("adjustment_id", id);

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items found for this adjustment" }, { status: 400 });
    }

    // STEP 1: Use base quantities from stock_adjustment_items
    const typedItems = (items || []) as DbStockAdjustmentItem[];
    const itemsWithChanges = typedItems.filter(
      (item) => parseFloat(String(item.difference ?? 0)) !== 0
    );

    if (itemsWithChanges.length === 0) {
      return NextResponse.json(
        { error: "No net adjustment (all differences are zero)" },
        { status: 400 }
      );
    }

    // Calculate total difference to determine transaction type
    const totalDifference = itemsWithChanges.reduce((sum, item) => {
      return sum + parseFloat(String(item.difference ?? 0));
    }, 0);

    // Determine transaction type based on total difference
    let transactionType: "in" | "out";
    if (totalDifference > 0) {
      transactionType = "in";
    } else if (totalDifference < 0) {
      transactionType = "out";
    } else {
      return NextResponse.json(
        { error: "No net adjustment (total difference is zero)" },
        { status: 400 }
      );
    }

    const defaultLocationId = await ensureWarehouseDefaultLocation({
      supabase,
      companyId,
      warehouseId: adjustment.warehouse_id,
      userId,
    });

    const selectedLocationId = adjustment.custom_fields?.locationId || defaultLocationId;
    const fromLocationId = transactionType === "out" ? selectedLocationId : null;
    const toLocationId = transactionType === "in" ? selectedLocationId : null;

    // Create stock transaction
    const { data: stockTransaction, error: stockTxError } = await supabase
      .from("stock_transactions")
      .insert({
        company_id: companyId,
        business_unit_id: currentBusinessUnitId,
        transaction_type: transactionType,
        transaction_date: adjustment.adjustment_date,
        warehouse_id: adjustment.warehouse_id,
        from_location_id: fromLocationId,
        to_location_id: toLocationId,
        reference_type: "stock_adjustment",
        reference_id: adjustment.id,
        status: "posted",
        notes: `Stock adjustment: ${adjustment.adjustment_code} - ${adjustment.reason}`,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (stockTxError) {
      return NextResponse.json(
        { error: stockTxError.message || "Failed to create stock transaction" },
        { status: 500 }
      );
    }

    // STEP 3: Create stock transaction items and update inventory
    const now = new Date();
    const postingDate = adjustment.adjustment_date;
    const postingTime = now.toTimeString().split(" ")[0];

    for (const item of typedItems) {
      const difference = parseFloat(String(item.difference ?? 0));

      // Skip items with zero difference
      if (difference === 0) continue;

      // Get current stock from item_warehouse (source of truth)
      const { data: existingStock } = await supabase
        .from("item_warehouse")
        .select("id, current_stock, default_location_id")
        .eq("company_id", companyId)
        .eq("item_id", item.item_id)
        .eq("warehouse_id", adjustment.warehouse_id)
        .is("deleted_at", null)
        .maybeSingle();

      const currentBalance = existingStock ? parseFloat(String(existingStock.current_stock)) : 0;

      const newBalance = currentBalance + difference;

      if (!item.uom_id) {
        return NextResponse.json({ error: "Item UOM missing on adjustment item" }, { status: 400 });
      }

      // Create stock transaction item
      const { error: stockTxItemError } = await supabase
        .from("stock_transaction_items")
        .insert({
          company_id: companyId,
          transaction_id: stockTransaction.id,
          item_id: item.item_id,
          // Standard fields
          quantity: Math.abs(difference),
          uom_id: item.uom_id,
          unit_cost: parseFloat(String(item.unit_cost ?? 0)),
          total_cost: Math.abs(difference) * parseFloat(String(item.unit_cost ?? 0)),
          // Audit fields
          qty_before: currentBalance,
          qty_after: newBalance,
          valuation_rate: parseFloat(String(item.unit_cost ?? 0)),
          stock_value_before: currentBalance * parseFloat(String(item.unit_cost ?? 0)),
          stock_value_after: newBalance * parseFloat(String(item.unit_cost ?? 0)),
          posting_date: postingDate,
          posting_time: postingTime,
          notes: item.reason || `Adjustment: ${adjustment.adjustment_code}`,
          created_by: userId,
          updated_by: userId,
        })
        .select()
        .single();

      if (stockTxItemError) {
        // Rollback stock transaction
        await supabase.from("stock_transactions").delete().eq("id", stockTransaction.id);
        return NextResponse.json(
          { error: "Failed to create stock transaction items" },
          { status: 500 }
        );
      }

      const resolvedLocationId = await adjustItemLocation({
        supabase,
        companyId,
        itemId: item.item_id,
        warehouseId: adjustment.warehouse_id,
        locationId: selectedLocationId || existingStock?.default_location_id || null,
        userId,
        qtyOnHandDelta: difference,
      });

      await applyBatchLayerAdjustment(supabase, companyId, {
        itemId: item.item_id,
        warehouseId: adjustment.warehouse_id,
        locationId: resolvedLocationId,
        quantityDelta: difference,
        adjustmentCode: adjustment.adjustment_code,
        postingDate,
        userId,
      });

      // STEP 4: Update item_warehouse with base difference
      if (existingStock) {
        // Update existing stock record
        await supabase
          .from("item_warehouse")
          .update({
            current_stock: Math.max(0, newBalance),
            updated_by: userId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingStock.id);
      } else {
        // Create new stock record
        await supabase.from("item_warehouse").insert({
          company_id: companyId,
          item_id: item.item_id,
          warehouse_id: adjustment.warehouse_id,
          current_stock: Math.max(0, newBalance),
          default_location_id: resolvedLocationId,
          created_by: userId,
          updated_by: userId,
        });
      }
    }

    // Update adjustment status to posted
    const { error: updateError } = await supabase
      .from("stock_adjustments")
      .update({
        status: "posted",
        stock_transaction_id: stockTransaction.id,
        approved_by: userId,
        approved_at: new Date().toISOString(),
        posted_by: userId,
        posted_at: new Date().toISOString(),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      // Rollback stock transactions
      await supabase
        .from("stock_transaction_items")
        .delete()
        .eq("transaction_id", stockTransaction.id);
      await supabase.from("stock_transactions").delete().eq("id", stockTransaction.id);
      return NextResponse.json({ error: "Failed to update adjustment status" }, { status: 500 });
    }

    // Fetch updated adjustment
    const { data: updatedAdjustment } = await supabase
      .from("stock_adjustments")
      .select("*")
      .eq("id", id)
      .single();

    const { data: updatedItems } = await supabase
      .from("stock_adjustment_items")
      .select("*")
      .eq("adjustment_id", id);

    return NextResponse.json({
      success: true,
      message: "Stock adjustment posted successfully. Stock levels updated.",
      stockTransactionCode: stockTransaction.transaction_code,
      adjustment: {
        id: updatedAdjustment.id,
        companyId: updatedAdjustment.company_id,
        adjustmentCode: updatedAdjustment.adjustment_code,
        adjustmentType: updatedAdjustment.adjustment_type,
        adjustmentDate: updatedAdjustment.adjustment_date,
        warehouseId: updatedAdjustment.warehouse_id,
        status: updatedAdjustment.status,
        reason: updatedAdjustment.reason,
        notes: updatedAdjustment.notes,
        totalValue: parseFloat(String(updatedAdjustment.total_value ?? 0)),
        stockTransactionId: updatedAdjustment.stock_transaction_id,
        approvedBy: updatedAdjustment.approved_by,
        approvedAt: updatedAdjustment.approved_at,
        postedBy: updatedAdjustment.posted_by,
        postedAt: updatedAdjustment.posted_at,
        createdBy: updatedAdjustment.created_by,
        updatedBy: updatedAdjustment.updated_by,
        createdAt: updatedAdjustment.created_at,
        updatedAt: updatedAdjustment.updated_at,
        items:
          (updatedItems as DbStockAdjustmentItem[] | null)?.map((item) => ({
            id: item.id,
            adjustmentId: item.adjustment_id,
            itemId: item.item_id,
            itemCode: item.item_code,
            itemName: item.item_name,
            currentQty: parseFloat(String(item.current_qty ?? 0)),
            adjustedQty: parseFloat(String(item.adjusted_qty ?? 0)),
            difference: parseFloat(String(item.difference ?? 0)),
            unitCost: parseFloat(String(item.unit_cost ?? 0)),
            totalCost: parseFloat(String(item.total_cost ?? 0)),
            uomId: item.uom_id,
            uomName: item.uom_name,
            reason: item.reason,
            createdAt: item.created_at,
            updatedAt: item.updated_at,
          })) || [],
      },
    });
  } catch (error) {
    console.error("Error posting stock adjustment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
