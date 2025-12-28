/**
 * POS Stock Transaction Service
 *
 * Handles stock transactions for POS sales:
 * - Creates outbound stock transactions when items are sold
 * - Updates stock_transaction_items with before/after quantities
 * - Reduces inventory quantities in item_warehouse
 * - Creates reversal transactions for voided sales
 */

import { createClient } from "@/lib/supabase/server";

export type POSStockTransactionData = {
  transactionId: string;
  transactionCode: string;
  transactionDate: string;
  warehouseId: string;
  items: Array<{
    itemId: string;
    quantity: number;
    uomId: string;
    rate: number;
  }>;
};

/**
 * Create stock transaction for POS sale
 * - Creates stock_transactions record (type: 'out')
 * - Creates stock_transaction_items with before/after quantities
 * - Updates item_warehouse quantities (reduces stock)
 */
export async function createPOSStockTransaction(
  companyId: string,
  businessUnitId: string,
  userId: string,
  data: POSStockTransactionData
): Promise<{ success: boolean; stockTransactionId?: string; error?: string }> {
  try {
    const supabase = await createClient();

    // Generate stock transaction code: ST-POS-{transaction_code}
    const stockTransactionCode = `ST-POS-${data.transactionCode}`;

    // Create stock transaction header
    const { data: stockTransaction, error: transactionError } = await supabase
      .from("stock_transactions")
      .insert({
        company_id: companyId,
        business_unit_id: businessUnitId,
        transaction_code: stockTransactionCode,
        transaction_type: "out",
        transaction_date: data.transactionDate.split("T")[0], // Extract date only
        warehouse_id: data.warehouseId,
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
      console.error("Error creating POS stock transaction:", transactionError);
      return {
        success: false,
        error: "Failed to create stock transaction",
      };
    }

    // Create stock transaction items and update warehouse inventory
    const now = new Date();
    const postingDate = now.toISOString().split("T")[0];
    const postingTime = now.toTimeString().split(" ")[0];

    for (const item of data.items) {
      // Get current stock from item_warehouse (source of truth)
      const { data: warehouseStock } = await supabase
        .from("item_warehouse")
        .select("current_stock")
        .eq("item_id", item.itemId)
        .eq("warehouse_id", data.warehouseId)
        .single();

      const currentBalance = warehouseStock
        ? parseFloat(String(warehouseStock.current_stock))
        : 0;

      const newBalance = currentBalance - item.quantity;

      // Validate sufficient stock
      if (newBalance < 0) {
        // Rollback: delete transaction
        await supabase
          .from("stock_transactions")
          .delete()
          .eq("id", stockTransaction.id);
        return {
          success: false,
          error: `Insufficient stock for item. Available: ${currentBalance}, Requested: ${item.quantity}`,
        };
      }

      // Create stock transaction item with before/after quantities
      const { data: stockTxItem, error: itemError } = await supabase
        .from("stock_transaction_items")
        .insert({
          company_id: companyId,
          transaction_id: stockTransaction.id,
          item_id: item.itemId,
          quantity: item.quantity,
          uom_id: item.uomId,
          unit_cost: item.rate,
          total_cost: item.quantity * item.rate,
          qty_before: currentBalance,
          qty_after: newBalance,
          valuation_rate: item.rate,
          stock_value_before: currentBalance * item.rate,
          stock_value_after: newBalance * item.rate,
          posting_date: postingDate,
          posting_time: postingTime,
          created_by: userId,
          updated_by: userId,
        })
        .select()
        .single();

      if (itemError || !stockTxItem) {
        console.error("Error creating stock transaction item:", itemError);
        // Rollback: delete transaction
        await supabase
          .from("stock_transactions")
          .delete()
          .eq("id", stockTransaction.id);
        return {
          success: false,
          error: "Failed to create stock transaction items",
        };
      }

      // Update item_warehouse current_stock
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
        console.error("Error updating item_warehouse stock:", warehouseUpdateError);
        // Rollback - delete transaction items created so far and transaction
        await supabase
          .from("stock_transaction_items")
          .delete()
          .eq("transaction_id", stockTransaction.id);
        await supabase
          .from("stock_transactions")
          .delete()
          .eq("id", stockTransaction.id);
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
    console.error("Unexpected error in createPOSStockTransaction:", error);
    return {
      success: false,
      error: "Internal error creating stock transaction",
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
      console.error("Error fetching POS transaction items:", itemsError);
      return {
        success: false,
        error: "Failed to fetch transaction items",
      };
    }

    // Get transaction date from first item
    const transactionDate = (posTransactionItems[0].pos_transactions as { transaction_date: string })?.transaction_date || new Date().toISOString();

    // Generate reversal stock transaction code
    const reversalCode = `ST-POS-VOID-${transactionCode}`;

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
      console.error("Error creating reversal stock transaction:", transactionError);
      return {
        success: false,
        error: "Failed to create reversal transaction",
      };
    }

    // Get items with UOM
    const { data: itemsData, error: itemsDataError } = await supabase
      .from("items")
      .select("id, uom_id, purchase_price")
      .in("id", posTransactionItems.map((item) => item.item_id))
      .eq("company_id", companyId);

    if (itemsDataError || !itemsData) {
      console.error("Error fetching items data:", itemsDataError);
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
        .select("current_stock")
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
      console.error("Error creating reversal transaction items:", reversalItemsError);
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
          console.error("Error updating item_warehouse:", updateError);
          // Log warning but continue
        }
      }
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("Unexpected error in reversePOSStockTransaction:", error);
    return {
      success: false,
      error: "Internal error reversing stock transaction",
    };
  }
}
