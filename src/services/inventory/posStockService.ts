/**
 * POS Stock Transaction Service
 *
 * Handles stock transactions for POS sales with inventory normalization:
 * - Creates outbound stock transactions when items are sold
 * - Normalizes quantities from selected packages to base units
 * - Updates stock_transaction_items with full conversion metadata
 * - Reduces inventory quantities in item_warehouse (in base units)
 * - Creates reversal transactions for voided sales
 *
 * @see /docs/inv-normalization-implementation-plan.md
 */

import { createClient } from "@/lib/supabase/server";
import { normalizeTransactionItems } from "./normalizationService";
import {
  adjustItemLocation,
  consumeItemLocationsFIFO,
  ensureWarehouseDefaultLocation,
} from "./locationService";
import type { StockTransactionItemInput } from "@/types/inventory-normalization";

export type POSStockTransactionData = {
  transactionId: string;
  transactionCode: string;
  transactionDate: string;
  warehouseId: string;
  items: Array<{
    itemId: string;
    quantity: number; // Input quantity in selected package
    packagingId?: string | null; // Package selected by user (null = use base package)
    uomId?: string; // Deprecated: kept for backward compatibility
    rate: number;
  }>;
};

/**
 * Create stock transaction for POS sale with inventory normalization
 * - Normalizes quantities from selected packages to base units
 * - Creates stock_transactions record (type: 'out')
 * - Creates stock_transaction_items with full conversion metadata
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

    // STEP 1: Normalize all item quantities from packages to base units
    const itemInputs: StockTransactionItemInput[] = data.items.map((item) => ({
      itemId: item.itemId,
      packagingId: item.packagingId || null, // null = use base package
      inputQty: item.quantity,
      unitCost: item.rate,
    }));

    const normalizedItems = await normalizeTransactionItems(companyId, itemInputs);

    // STEP 2: Validate stock availability (using normalized quantities in base units)
    for (const item of normalizedItems) {
      const { data: warehouseStock } = await supabase
        .from("item_warehouse")
        .select("current_stock")
        .eq("item_id", item.itemId)
        .eq("warehouse_id", data.warehouseId)
        .is("deleted_at", null)
        .single();

      const currentBalance = warehouseStock ? parseFloat(String(warehouseStock.current_stock)) : 0;

      if (currentBalance < item.normalizedQty) {
        return {
          success: false,
          error: `Insufficient stock. Available: ${currentBalance} (base units), Requested: ${item.normalizedQty} (base units)`,
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
    const stockTransactionCode = `ST-POS-${data.transactionCode}`;

    const { data: stockTransaction, error: transactionError } = await supabase
      .from("stock_transactions")
      .insert({
        company_id: companyId,
        business_unit_id: businessUnitId,
        transaction_code: stockTransactionCode,
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

    // STEP 4: Create stock transaction items with normalization metadata
    const now = new Date();
    const postingDate = now.toISOString().split("T")[0];
    const postingTime = now.toTimeString().split(" ")[0];

    for (const item of normalizedItems) {
      // Get current stock from item_warehouse (source of truth)
      const { data: warehouseStock } = await supabase
        .from("item_warehouse")
        .select("current_stock, default_location_id")
        .eq("item_id", item.itemId)
        .eq("warehouse_id", data.warehouseId)
        .single();

      const currentBalance = warehouseStock ? parseFloat(String(warehouseStock.current_stock)) : 0;

      const newBalance = currentBalance - item.normalizedQty;

      // Create transaction item with full normalization metadata
      const { data: stockTxItem, error: itemError } = await supabase
        .from("stock_transaction_items")
        .insert({
          company_id: companyId,
          transaction_id: stockTransaction.id,
          item_id: item.itemId,
          // Normalization fields (NEW)
          input_qty: item.inputQty,
          input_packaging_id: item.inputPackagingId,
          conversion_factor: item.conversionFactor,
          normalized_qty: item.normalizedQty,
          base_package_id: item.basePackageId,
          // Standard fields
          quantity: item.normalizedQty, // Backward compat
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
        quantity: item.normalizedQty,
        userId,
      });

      // STEP 5: Update item_warehouse with normalized quantity (base units)
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

/**
 * Reverse POS stock transaction (for voided sales)
 * - Creates reversing stock_transactions record (type: 'in')
 * - Creates reversing stock_transaction_items (add back stock)
 * - Updates item_warehouse quantities (restore stock)
 */
export async function reversePOSStockTransaction(
  companyId: string,
  businessUnitId: string,
  userId: string,
  transactionId: string,
  transactionCode: string,
  warehouseId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Get original POS transaction items
    const { data: posTransactionItems, error: itemsError } = await supabase
      .from("pos_transaction_items")
      .select("item_id, item_code, item_name, quantity, pos_transactions(transaction_date)")
      .eq("pos_transaction_id", transactionId);

    if (itemsError || !posTransactionItems || posTransactionItems.length === 0) {
      return {
        success: false,
        error: "Failed to fetch transaction items",
      };
    }

    // Generate reversal stock transaction code
    const reversalCode = `ST-POS-VOID-${transactionCode}`;

    const defaultLocationId = await ensureWarehouseDefaultLocation({
      supabase,
      companyId,
      warehouseId,
      userId,
    });

    // Create reversal stock transaction header
    const { data: reversalTransaction, error: transactionError } = await supabase
      .from("stock_transactions")
      .insert({
        company_id: companyId,
        business_unit_id: businessUnitId,
        transaction_code: reversalCode,
        transaction_type: "in", // Opposite of 'out'
        transaction_date: new Date().toISOString().split("T")[0], // Current date for reversal
        warehouse_id: warehouseId,
        to_location_id: defaultLocationId,
        reference_type: "pos_transaction",
        reference_id: transactionId,
        reference_code: transactionCode,
        notes: `Void/Reversal - POS Sale ${transactionCode}`,
        status: "posted",
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (transactionError || !reversalTransaction) {
      return {
        success: false,
        error: "Failed to create reversal transaction",
      };
    }

    // Get items with UOM
    const { data: itemsData, error: itemsDataError } = await supabase
      .from("items")
      .select("id, uom_id, purchase_price")
      .in(
        "id",
        posTransactionItems.map((item) => item.item_id)
      )
      .eq("company_id", companyId);

    if (itemsDataError || !itemsData) {
      await supabase.from("stock_transactions").delete().eq("id", reversalTransaction.id);
      return {
        success: false,
        error: "Failed to fetch items data",
      };
    }

    const itemsMap = new Map(itemsData.map((item) => [item.id, item]));

    // Get current stock levels for each item from item_warehouse (source of truth)
    const stockBalances = new Map<string, number>();

    for (const item of posTransactionItems) {
      const { data: warehouseStock } = await supabase
        .from("item_warehouse")
        .select("current_stock, default_location_id")
        .eq("company_id", companyId)
        .eq("item_id", item.item_id)
        .eq("warehouse_id", warehouseId)
        .single();

      stockBalances.set(
        item.item_id,
        warehouseStock ? parseFloat(String(warehouseStock.current_stock)) : 0
      );
    }

    // Create reversal stock_transaction_items with before/after quantities
    const now = new Date();
    const postingDate = now.toISOString().split("T")[0];
    const postingTime = now.toTimeString().split(" ")[0];

    const reversalItems = posTransactionItems.map((item) => {
      const itemData = itemsMap.get(item.item_id);
      const rate = parseFloat(itemData?.purchase_price || "0");
      const currentBalance = stockBalances.get(item.item_id) || 0;
      const newBalance = currentBalance + item.quantity;

      return {
        company_id: companyId,
        transaction_id: reversalTransaction.id,
        item_id: item.item_id,
        quantity: item.quantity, // Positive for returning stock
        uom_id: itemData?.uom_id || "",
        unit_cost: rate,
        total_cost: item.quantity * rate,
        qty_before: currentBalance,
        qty_after: newBalance,
        valuation_rate: rate,
        stock_value_before: currentBalance * rate,
        stock_value_after: newBalance * rate,
        posting_date: postingDate,
        posting_time: postingTime,
        created_by: userId,
        updated_by: userId,
      };
    });

    const { data: createdReversalItems, error: reversalItemsError } = await supabase
      .from("stock_transaction_items")
      .insert(reversalItems)
      .select();

    if (reversalItemsError || !createdReversalItems) {
      await supabase.from("stock_transactions").delete().eq("id", reversalTransaction.id);
      return {
        success: false,
        error: "Failed to create reversal items",
      };
    }

    // Update item_warehouse quantities (restore stock)
    for (const item of posTransactionItems) {
      const currentBalance = stockBalances.get(item.item_id) || 0;
      const newBalance = currentBalance + item.quantity;

      const { data: existingItemWarehouse } = await supabase
        .from("item_warehouse")
        .select("id")
        .eq("company_id", companyId)
        .eq("item_id", item.item_id)
        .eq("warehouse_id", warehouseId)
        .is("deleted_at", null)
        .single();

      await adjustItemLocation({
        supabase,
        companyId,
        itemId: item.item_id,
        warehouseId,
        locationId: defaultLocationId,
        userId,
        qtyOnHandDelta: item.quantity,
      });

      if (existingItemWarehouse) {
        const { error: updateError } = await supabase
          .from("item_warehouse")
          .update({
            current_stock: newBalance,
            updated_by: userId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingItemWarehouse.id);

        if (updateError) {
          // Log warning but continue
        }
      }
    }

    return {
      success: true,
    };
  } catch {
    return {
      success: false,
      error: "Internal error reversing stock transaction",
    };
  }
}
