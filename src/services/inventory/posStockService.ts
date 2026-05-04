/**
 * POS Stock Transaction Service
 *
 * Handles stock transactions for POS sales:
 * - Creates outbound stock transactions when items are sold
 * - Reduces inventory quantities in item_warehouse (in base units)
 *
 * @see /docs/inventory-acquisition-workflow-v2.md
 */

import { createClient } from "@/lib/supabase/server";
import {
  consumeItemLocationsFIFO,
  ensureWarehouseDefaultLocation,
} from "./locationService";

export type POSStockTransactionData = {
  transactionId: string;
  transactionCode: string;
  transactionDate: string;
  warehouseId: string;
  items: Array<{
    itemId: string;
    quantity: number; // Input quantity in selected package
    uomId?: string; // Deprecated: kept for backward compatibility
    rate: number;
  }>;
};

/**
 * Create stock transaction for POS sale
 * - Creates stock_transactions record (type: 'out')
 * - Updates item_warehouse quantities (in base units)
 */
export async function createPOSStockTransaction(
  companyId: string,
  businessUnitId: string,
  userId: string,
  data: POSStockTransactionData
): Promise<{ success: boolean; stockTransactionId?: string; error?: string }> {
  try {
    const supabase = await createClient();

    const itemIds = data.items.map((item) => item.itemId);
    const { data: itemUoms } = await supabase.from("items").select("id, uom_id").in("id", itemIds);
    const itemUomMap = new Map(
      (itemUoms as Array<{ id: string; uom_id: string | null }> | null)?.map((row) => [
        row.id,
        row.uom_id,
      ]) || []
    );

    // STEP 1: Resolve item quantities (already in base UOM)
    const resolvedItems = data.items.map((item) => {
      const quantity = Number(item.quantity);
      const unitCost = Number(item.rate);
      const uomId = item.uomId ?? itemUomMap.get(item.itemId) ?? null;

      return {
        itemId: item.itemId,
        quantity,
        unitCost,
        totalCost: quantity * unitCost,
        uomId,
      };
    });

    // STEP 2: Validate stock availability (using base UOM quantities)
    for (const item of resolvedItems) {
      const { data: warehouseStock } = await supabase
        .from("item_warehouse")
        .select("current_stock")
        .eq("item_id", item.itemId)
        .eq("warehouse_id", data.warehouseId)
        .is("deleted_at", null)
        .single();

      const currentBalance = warehouseStock ? parseFloat(String(warehouseStock.current_stock)) : 0;

      if (!item.uomId) {
        return {
          success: false,
          error: "Item UOM not found for POS transaction",
        };
      }

      if (currentBalance < item.quantity) {
        return {
          success: false,
          error: `Insufficient stock. Available: ${currentBalance}, Requested: ${item.quantity}`,
        };
      }
    }

    const defaultLocationId = await ensureWarehouseDefaultLocation({
      supabase,
      companyId,
      warehouseId: data.warehouseId,
      userId,
    });

    // STEP 3: Create stock transaction header
    const { data: stockTransaction, error: transactionError } = await supabase
      .from("stock_transactions")
      .insert({
        company_id: companyId,
        business_unit_id: businessUnitId,
        transaction_type: "out",
        transaction_date: data.transactionDate.split("T")[0],
        warehouse_id: data.warehouseId,
        from_location_id: defaultLocationId,
        reference_type: "pos_transaction",
        reference_id: data.transactionId,
        reference_code: data.transactionCode,
        notes: `POS Sale - ${data.transactionCode}`,
        status: "posted",
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (transactionError || !stockTransaction) {
      return {
        success: false,
        error: "Failed to create stock transaction",
      };
    }

    // STEP 4: Create stock transaction items
    const now = new Date();
    const postingDate = now.toISOString().split("T")[0];
    const postingTime = now.toTimeString().split(" ")[0];

    for (const item of resolvedItems) {
      // Get current stock from item_warehouse (source of truth)
      const { data: warehouseStock } = await supabase
        .from("item_warehouse")
        .select("current_stock, default_location_id")
        .eq("item_id", item.itemId)
        .eq("warehouse_id", data.warehouseId)
        .single();

      const currentBalance = warehouseStock ? parseFloat(String(warehouseStock.current_stock)) : 0;

      const newBalance = currentBalance - item.quantity;

      // Create transaction item
      const { data: stockTxItem, error: itemError } = await supabase
        .from("stock_transaction_items")
        .insert({
          company_id: companyId,
          transaction_id: stockTransaction.id,
          item_id: item.itemId,
          // Standard fields
          quantity: item.quantity,
          uom_id: item.uomId,
          unit_cost: item.unitCost,
          total_cost: item.totalCost,
          // Audit fields
          qty_before: currentBalance,
          qty_after: newBalance,
          valuation_rate: item.unitCost,
          stock_value_before: currentBalance * item.unitCost,
          stock_value_after: newBalance * item.unitCost,
          posting_date: postingDate,
          posting_time: postingTime,
          created_by: userId,
          updated_by: userId,
        })
        .select()
        .single();

      if (itemError || !stockTxItem) {
        // Rollback: delete transaction
        await supabase.from("stock_transactions").delete().eq("id", stockTransaction.id);
        return {
          success: false,
          error: "Failed to create stock transaction items",
        };
      }

      await consumeItemLocationsFIFO({
        supabase,
        companyId,
        itemId: item.itemId,
        warehouseId: data.warehouseId,
        quantity: item.quantity,
        userId,
      });

      // STEP 5: Update item_warehouse with base units
      const { error: warehouseUpdateError } = await supabase
        .from("item_warehouse")
        .update({
          current_stock: newBalance,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq("item_id", item.itemId)
        .eq("warehouse_id", data.warehouseId);

      if (warehouseUpdateError) {
        // Rollback - delete transaction items and transaction
        await supabase
          .from("stock_transaction_items")
          .delete()
          .eq("transaction_id", stockTransaction.id);
        await supabase.from("stock_transactions").delete().eq("id", stockTransaction.id);
        return {
          success: false,
          error: "Failed to update warehouse inventory",
        };
      }
    }

    // All items processed successfully
    return {
      success: true,
      stockTransactionId: stockTransaction.id,
    };
  } catch (error) {
    console.error("POS stock transaction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Internal error creating stock transaction",
    };
  }
}
